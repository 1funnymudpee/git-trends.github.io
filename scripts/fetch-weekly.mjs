import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const latestOutputPath = path.join(
  repoRoot,
  "public",
  "data",
  "latest-weekly.json"
)
const weeklyOutputDir = path.join(repoRoot, "public", "data", "weekly")

const PER_PAGE = 25
const MAX_RESULTS = 100
const MAX_RETRIES = 3

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function startOfDayUtc(date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function subtractDays(date, days) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000)
}

function requiredString(value) {
  return typeof value === "string" ? value : ""
}

function requiredNumber(value) {
  return typeof value === "number" ? value : 0
}

function mapRepo(item, rank, snapshotDate) {
  const [owner = "", name = ""] = requiredString(item.full_name).split("/")

  return {
    github_repo_id: requiredNumber(item.id),
    owner,
    name,
    full_name: requiredString(item.full_name),
    html_url: requiredString(item.html_url),
    description: item.description ?? null,
    language: item.language ?? null,
    topics: Array.isArray(item.topics) ? item.topics.filter(Boolean) : [],
    avatar_url: item.owner?.avatar_url ?? "",
    stars: requiredNumber(item.stargazers_count),
    forks: requiredNumber(item.forks_count),
    watchers: requiredNumber(item.watchers_count),
    open_issues: requiredNumber(item.open_issues_count),
    pushed_at: requiredString(item.pushed_at),
    created_at: requiredString(item.created_at),
    rank,
    snapshot_date: snapshotDate,
    summary_short: null,
    summary_medium: null,
    tags: null,
    category: null,
  }
}

function validateSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.repos) || snapshot.repos.length === 0) {
    throw new Error("Generated snapshot is empty.")
  }

  for (const repo of snapshot.repos) {
    const requiredFields = [
      "github_repo_id",
      "owner",
      "name",
      "full_name",
      "html_url",
      "stars",
      "forks",
      "watchers",
      "rank",
      "snapshot_date",
    ]

    for (const field of requiredFields) {
      if (repo[field] === undefined || repo[field] === null || repo[field] === "") {
        throw new Error(`Generated snapshot is missing required field: ${field}`)
      }
    }
  }
}

async function fetchGitHubPage(query, page, token) {
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(PER_PAGE),
    page: String(page),
  })

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "git-trends-weekly-digest-mvp",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?${params.toString()}`,
        {
          headers,
          signal: AbortSignal.timeout(30000),
        }
      )

      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          `GitHub API request failed with ${response.status} ${response.statusText}: ${body}`
        )
      }

      return response.json()
    } catch (error) {
      lastError = error

      if (attempt === MAX_RETRIES) {
        break
      }

      await sleep(attempt * 1000)
    }
  }

  const cause = lastError?.cause?.message ? ` Cause: ${lastError.cause.message}` : ""
  const message = lastError instanceof Error ? lastError.message : String(lastError)
  throw new Error(`GitHub API request failed after ${MAX_RETRIES} attempts: ${message}${cause}`)
}

async function main() {
  const token = process.env.GITHUB_TOKEN

  if (!token) {
    console.warn(
      "GITHUB_TOKEN is not set. Unauthenticated GitHub Search API requests have a much lower rate limit."
    )
  }

  const snapshotMoment = startOfDayUtc(new Date())
  const snapshotDate = formatDate(snapshotMoment)
  const windowStart = formatDate(subtractDays(snapshotMoment, 7))
  const query = `pushed:>${windowStart} stars:>500`
  const pages = Math.ceil(MAX_RESULTS / PER_PAGE)
  const allItems = []

  for (let page = 1; page <= pages; page += 1) {
    const payload = await fetchGitHubPage(query, page, token)
    const items = Array.isArray(payload.items) ? payload.items : []
    allItems.push(...items)
  }

  const rankedRepos = allItems
    .sort(
      (a, b) =>
        requiredNumber(b.stargazers_count) - requiredNumber(a.stargazers_count) ||
        requiredNumber(a.id) - requiredNumber(b.id)
    )
    .slice(0, MAX_RESULTS)
    .map((item, index) => mapRepo(item, index + 1, snapshotDate))

  const snapshot = {
    snapshot_date: snapshotDate,
    window_start: windowStart,
    window_end: snapshotDate,
    generated_at: new Date().toISOString(),
    repos: rankedRepos,
  }

  validateSnapshot(snapshot)

  await mkdir(weeklyOutputDir, { recursive: true })
  await writeFile(latestOutputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8")
  await writeFile(
    path.join(weeklyOutputDir, `${snapshotDate}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8"
  )

  console.log(
    `Wrote ${snapshot.repos.length} repositories to public/data/latest-weekly.json and public/data/weekly/${snapshotDate}.json`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
