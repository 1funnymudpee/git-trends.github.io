import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")
const latestSnapshotPath = path.join(repoRoot, "public", "data", "latest-weekly.json")
const reportsDir = path.join(repoRoot, "public", "data", "reports")

const DEFAULT_MODEL = "gpt-4o-mini"

const SYSTEM_PROMPT = `You are a senior technology analyst writing a weekly GitHub Trending Report.
You will receive structured data about three categories of trending repositories.
Write a comprehensive yet concise weekly report in Markdown format.

The report MUST follow this exact structure with these exact headings:

## 本周总览 (Executive Summary)
3-5 sentences summarizing the overall GitHub ecosystem trends this week.
Identify the dominant themes, notable shifts, and any surprising patterns.

## 经典热门趋势 (Established Projects)
Analyze the established/high-star projects that were active this week.
What directions are mature projects iterating toward?
Which domains are seeing renewed activity? (3-5 paragraphs)

## 月度新星趋势 (New This Month)
Analyze newly created projects gaining traction.
What problem domains are attracting fresh solutions?
Any clustering of similar tools or approaches? (3-5 paragraphs)

## 季度成长趋势 (Rising Stars)
Analyze 1-3 month old projects with sustained growth.
Which early bets are proving out?
What does sustained growth tell us about these areas? (3-5 paragraphs)

## 跨分类洞察 (Cross-Category Patterns)
Look across all three categories for common threads.
What technology directions appear in old projects, new projects, AND growing projects simultaneously?
These cross-cutting themes are the strongest trend signals. (2-3 paragraphs)

## 本周推荐 (Top Picks)
Select 3-5 projects from across all categories that are most worth attention.
For EACH recommended project, provide:
- **项目**: owner/repo
- **推荐理由**: One sentence on why it stands out
- **适合谁**: Beginner / Intermediate / Advanced
- **落地步骤**: 3-5 concrete steps from clone to running demo
- **预计时间**: How long to get a basic demo working

## 下周展望 (What to Watch)
Based on this week's patterns, predict 2-3 directions likely to continue trending.
What should readers keep an eye on? (1-2 paragraphs)

Rules:
- Write section headings and labels in Chinese, analysis content in Chinese
- Be specific and analytical, not generic
- Reference actual project names when making points
- Keep the total report between 1500-2500 words
- Do not invent information not present in the input
- Output raw Markdown only, no code fences around the entire document`

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

function summarizeForReport(snapshot) {
  return (snapshot.categories ?? []).map((category) => ({
    category: category.label,
    description: category.description,
    total: category.repos.length,
    repos: category.repos.map((repo) => ({
      name: repo.full_name,
      stars: repo.stars,
      language: repo.language,
      description: repo.summary_short || repo.description,
      trending_reason: repo.trending_reason,
      tags: repo.tags || repo.topics,
      created_at: repo.created_at,
      rank: repo.rank,
    })),
  }))
}

function createErrorPayload(snapshotDate, model) {
  return {
    snapshot_date: snapshotDate,
    generated_at: new Date().toISOString(),
    model,
    error: true,
    report_markdown: "## 本周报告生成中\n\n本周报告生成中，请稍后刷新。",
  }
}

async function readLatestSnapshot() {
  const raw = await readFile(latestSnapshotPath, "utf8")

  if (!raw.trim()) {
    throw new Error("latest-weekly.json is empty.")
  }

  return JSON.parse(raw)
}

function buildFrontmatter(payload) {
  return `---
snapshot_date: ${payload.snapshot_date}
generated_at: ${payload.generated_at}
model: ${payload.model}
---
`
}

async function writeReportFiles(payload) {
  await mkdir(reportsDir, { recursive: true })

  const latestJsonPath = path.join(reportsDir, "latest.json")
  const latestMdPath = path.join(reportsDir, "latest.md")
  const datedMdPath = path.join(reportsDir, `${payload.snapshot_date}.md`)

  await writeFile(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")

  const markdownWithFrontmatter = `${buildFrontmatter(payload)}\n${payload.report_markdown ?? ""}\n`
  await writeFile(latestMdPath, markdownWithFrontmatter, "utf8")
  await writeFile(datedMdPath, markdownWithFrontmatter, "utf8")
}

async function generateMarkdown(baseUrl, apiKey, model, snapshot) {
  const summarizedData = summarizeForReport(snapshot)
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `以下是本周 GitHub Trending 三分类数据（快照日期：${snapshot.snapshot_date}）：\n\n${JSON.stringify(summarizedData, null, 2)}\n\n请根据以上数据生成本周 GitHub Trending 周报。`,
        },
      ],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(120000),
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
    throw new Error("AI API returned an empty report.")
  }

  return content.trim()
}

async function main() {
  const apiKey = getRequiredEnv("AI_API_KEY")
  const baseUrl = normalizeBaseUrl(getRequiredEnv("AI_BASE_URL"))
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL
  const snapshot = await readLatestSnapshot()

  if (!Array.isArray(snapshot.categories) || snapshot.categories.length === 0) {
    throw new Error("latest-weekly.json is missing categories.")
  }

  try {
    const reportMarkdown = await generateMarkdown(baseUrl, apiKey, model, snapshot)
    const payload = {
      snapshot_date: snapshot.snapshot_date,
      generated_at: new Date().toISOString(),
      model,
      error: false,
      report_markdown: reportMarkdown,
    }

    if (!reportMarkdown.includes("## 本周总览")) {
      console.warn("Warning: generated report is missing the expected heading '## 本周总览'.")
    }

    await writeReportFiles(payload)
    console.log(`Generated weekly report for ${snapshot.snapshot_date}.`)
  } catch (error) {
    const payload = createErrorPayload(snapshot.snapshot_date, model)
    await writeReportFiles(payload)
    console.error(error instanceof Error ? error.message : error)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
