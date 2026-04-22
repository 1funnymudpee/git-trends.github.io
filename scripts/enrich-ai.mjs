import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const latestSnapshotPath = path.join(
  repoRoot,
  "public",
  "data",
  "latest-weekly.json"
)

const DEFAULT_MODEL = "gpt-4o-mini"
const DEFAULT_TOP_N = 10
const REQUEST_DELAY_MS = 1000
const MAX_RETRIES = 2
const VALID_CATEGORIES = new Set([
  "ai",
  "devtools",
  "infra",
  "frontend",
  "backend",
  "data",
  "security",
  "mobile",
  "gaming",
  "other",
])

const SYSTEM_PROMPT = `You are a technical analyst for a GitHub trending digest.
Given a GitHub repository's metadata, produce a JSON object with exactly these fields:

{
  "summary_short": "One concise sentence (under 120 chars) describing what this repo does.",
  "summary_medium": "2-4 sentences providing more context about what it does and key features.",
  "tags": ["3 to 8 lowercase normalized tags"],
  "category": "exactly one of: ai, devtools, infra, frontend, backend, data, security, mobile, gaming, other",
  "trending_reason": "1-2 sentences analyzing why this repository is gaining attention this week. Consider: recent releases, community interest, solving a timely problem, viral content, or ecosystem changes."
}

Rules:
- Write in English
- summary_short must be a single sentence, no line breaks
- tags should be lowercase, hyphenated for multi-word (e.g. "machine-learning")
- trending_reason should be specific and analytical, not generic
- Do not invent facts not present in the input
- Respond with valid JSON only, no markdown fences`

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "")
}

function buildUserPrompt(repo, categoryLabel) {
  const description = repo.description || "No description provided"
  const language = repo.language || "Unknown"
  const topics = Array.isArray(repo.topics) && repo.topics.length > 0
    ? repo.topics.join(", ")
    : "None"

  return `Repository: ${repo.full_name}
Description: ${description}
Language: ${language}
Topics: ${topics}
Stars: ${repo.stars}
Forks: ${repo.forks}
Created: ${repo.created_at}
Last Pushed: ${repo.pushed_at}
Trending Category: ${repo.category_key} (${categoryLabel})
Weekly Rank in Category: #${repo.rank}`
}

function createNullEnrichment() {
  return {
    summary_short: null,
    summary_medium: null,
    tags: null,
    category: null,
    trending_reason: null,
  }
}

function applyEnrichment(snapshot, repoId, enrichment) {
  for (const section of snapshot.categories ?? []) {
    for (const repo of section.repos ?? []) {
      if (repo.github_repo_id !== repoId) {
        continue
      }

      repo.summary_short = enrichment.summary_short
      repo.summary_medium = enrichment.summary_medium
      repo.tags = enrichment.tags
      repo.category = enrichment.category
      repo.trending_reason = enrichment.trending_reason
    }
  }

  for (const repo of snapshot.repos ?? []) {
    if (repo.github_repo_id !== repoId) {
      continue
    }

    repo.summary_short = enrichment.summary_short
    repo.summary_medium = enrichment.summary_medium
    repo.tags = enrichment.tags
    repo.category = enrichment.category
    repo.trending_reason = enrichment.trending_reason
  }
}

function sanitizeString(value) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().replace(/\s+/g, " ")
  return normalized || null
}

function sanitizeTags(value) {
  if (!Array.isArray(value)) {
    return null
  }

  const tags = value
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, "-"))
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 8)

  return tags.length > 0 ? tags : null
}

function sanitizeCategory(value) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return VALID_CATEGORIES.has(normalized) ? normalized : null
}

function parseAiResponse(content) {
  const parsed = JSON.parse(content)

  return {
    summary_short: sanitizeString(parsed.summary_short),
    summary_medium: sanitizeString(parsed.summary_medium),
    tags: sanitizeTags(parsed.tags),
    category: sanitizeCategory(parsed.category),
    trending_reason: sanitizeString(parsed.trending_reason),
  }
}

async function callAi(baseUrl, apiKey, model, repo, categoryLabel) {
  const payload = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(repo, categoryLabel) },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  }

  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60000),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          `AI API request failed with ${response.status} ${response.statusText}: ${body}`
        )
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (typeof content !== "string" || !content.trim()) {
        throw new Error("AI API returned an empty response content.")
      }

      return parseAiResponse(content)
    } catch (error) {
      lastError = error

      if (attempt < MAX_RETRIES) {
        await sleep(1000)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError))
}

async function readLatestSnapshot() {
  const raw = await readFile(latestSnapshotPath, "utf8")

  if (!raw.trim()) {
    throw new Error("latest-weekly.json is empty.")
  }

  const snapshot = JSON.parse(raw)

  if (
    !snapshot ||
    !Array.isArray(snapshot.categories) ||
    snapshot.categories.length === 0
  ) {
    throw new Error("latest-weekly.json is missing categories.")
  }

  return snapshot
}

async function writeSnapshotFiles(snapshot) {
  const serialized = `${JSON.stringify(snapshot, null, 2)}\n`
  const datedSnapshotPath = path.join(
    repoRoot,
    "public",
    "data",
    "weekly",
    `${snapshot.snapshot_date}.json`
  )

  await writeFile(latestSnapshotPath, serialized, "utf8")
  await writeFile(datedSnapshotPath, serialized, "utf8")
}

async function main() {
  const apiKey = getRequiredEnv("AI_API_KEY")
  const baseUrl = normalizeBaseUrl(getRequiredEnv("AI_BASE_URL"))
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL
  const topN = Number.parseInt(process.env.AI_TOP_N || `${DEFAULT_TOP_N}`, 10)

  if (!Number.isFinite(topN) || topN <= 0) {
    throw new Error("AI_TOP_N must be a positive integer.")
  }

  const snapshot = await readLatestSnapshot()
  const categoryEntries = snapshot.categories.flatMap((section) =>
    [...(section.repos ?? [])]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, Math.min(topN, section.repos?.length ?? 0))
      .map((repo) => ({
        repo,
        categoryLabel: section.label,
      }))
  )

  for (let index = 0; index < categoryEntries.length; index += 1) {
    const { repo, categoryLabel } = categoryEntries[index]

    console.log(`[${index + 1}/${categoryEntries.length}] Enriching ${repo.full_name}...`)

    try {
      const enrichment = await callAi(baseUrl, apiKey, model, repo, categoryLabel)
      applyEnrichment(snapshot, repo.github_repo_id, enrichment)
    } catch (error) {
      const fallback = createNullEnrichment()
      applyEnrichment(snapshot, repo.github_repo_id, fallback)

      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Warning: failed to enrich ${repo.full_name}: ${message}`)
    }

    if (index < categoryEntries.length - 1) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  await writeSnapshotFiles(snapshot)

  console.log(
    `AI enrichment finished for ${categoryEntries.length} repositories using model ${model}.`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
