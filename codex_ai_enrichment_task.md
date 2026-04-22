# AI 摘要与标签增强 — Codex 执行任务书

## 0. 背景

MVP 已完成：pipeline 脚本（`scripts/fetch-weekly.mjs`）可以抓取 GitHub 热门仓库并生成 JSON，前端读取 JSON 展示数据。当前所有 repo 的 `summary_short`、`summary_medium`、`tags`、`category` 字段都是 `null`，前端已有降级逻辑（显示原始 description 和 topics）。

本阶段目标：**在 pipeline 之后增加一个 AI 增强脚本，对 top 仓库生成摘要和标签，写回 JSON 文件。**

---

## 1. 硬性约束

- 使用 **OpenAI 兼容格式** 的 API（`/v1/chat/completions`）
- API 的 `base_url`、`api_key`、`model` 全部通过环境变量配置，脚本里不硬编码
- **不修改现有前端代码**（前端的降级逻辑已经写好，AI 字段有值就显示，null 就 fallback）
- **不修改 `fetch-weekly.mjs`**（AI 增强是独立的第二步，不耦合进抓取流程）
- 不引入重型依赖（不用 langchain、不用向量数据库）
- AI 调用失败时，对应 repo 的 AI 字段保持 `null`，不中断整个流程

---

## 2. 新增文件

只需要新增 **一个脚本文件**：

```
scripts/enrich-ai.mjs
```

---

## 3. 脚本设计

### 3.1 环境变量

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `AI_API_KEY` | 是 | API 密钥 | `sk-xxxxxxxx` |
| `AI_BASE_URL` | 是 | API 基础地址（不含 `/chat/completions`） | `https://api.openai.com/v1` |
| `AI_MODEL` | 否 | 模型名称，默认 `gpt-4o-mini` | `gpt-4o-mini` |
| `AI_TOP_N` | 否 | 处理前 N 个 repo，默认 `30` | `30` |

### 3.2 执行流程

```
1. 读取 public/data/latest-weekly.json
2. 取前 AI_TOP_N 个 repo（按 rank 排序）
3. 对每个 repo 调用 AI API：
   - 输入：full_name, description, language, topics, stars, forks, rank
   - 输出：summary_short, summary_medium, tags, category
4. 把 AI 结果写回该 repo 对象的对应字段
5. 未处理的 repo（排名靠后的）保持 AI 字段为 null
6. 覆盖写入 public/data/latest-weekly.json
7. 同步覆盖写入 public/data/weekly/<对应日期>.json
```

### 3.3 API 调用格式

每个 repo 发一次请求，使用 OpenAI 兼容的 chat completions 格式：

```javascript
const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${AI_API_KEY}`
  },
  body: JSON.stringify({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  })
})
```

### 3.4 Prompt 设计

**System Prompt：**

```
You are a technical analyst for a GitHub trending digest.
Given a GitHub repository's metadata, produce a JSON object with exactly these fields:

{
  "summary_short": "One concise sentence (under 120 chars) describing what this repo does and why it's notable.",
  "summary_medium": "2-4 sentences providing more context: what problem it solves, key features, and why it's trending.",
  "tags": ["3 to 8 lowercase normalized tags describing the repo's domain, tech stack, and use case"],
  "category": "exactly one of: ai, devtools, infra, frontend, backend, data, security, mobile, gaming, other"
}

Rules:
- Write in English
- summary_short must be a single sentence, no line breaks
- tags should be lowercase, hyphenated for multi-word (e.g. "machine-learning")
- Do not invent facts not present in the input
- Respond with valid JSON only, no markdown fences
```

**User Prompt（每个 repo 构造一次）：**

```
Repository: {full_name}
Description: {description || 'No description provided'}
Language: {language || 'Unknown'}
Topics: {topics.join(', ') || 'None'}
Stars: {stars}
Forks: {forks}
Weekly Rank: #{rank}
```

### 3.5 响应解析

```javascript
// 解析 AI 返回的 JSON
const content = data.choices[0]?.message?.content
const parsed = JSON.parse(content)

// 校验字段存在且类型正确
repo.summary_short = typeof parsed.summary_short === 'string' ? parsed.summary_short : null
repo.summary_medium = typeof parsed.summary_medium === 'string' ? parsed.summary_medium : null
repo.tags = Array.isArray(parsed.tags) ? parsed.tags : null
repo.category = typeof parsed.category === 'string' ? parsed.category : null
```

### 3.6 错误处理

- 单个 repo 的 AI 调用失败（网络错误、JSON 解析失败、响应格式异常）：
  - 打印警告日志（含 repo 名和错误信息）
  - 该 repo 的 AI 字段保持 `null`
  - **继续处理下一个 repo，不中断**
- `AI_API_KEY` 或 `AI_BASE_URL` 未设置：
  - 打印错误信息并退出，不修改任何 JSON 文件
- `latest-weekly.json` 不存在或为空：
  - 打印错误信息并退出

### 3.7 速率控制

- 每次 API 调用之间等待 **1 秒**（`await sleep(1000)`）
- 避免触发第三方 API 的 rate limit
- 打印进度：`[3/30] Enriching owner/repo-name...`

---

## 4. package.json 新增 script

```json
{
  "scripts": {
    "enrich-ai": "node scripts/enrich-ai.mjs"
  }
}
```

运行命令：

```bash
AI_API_KEY=sk-xxx AI_BASE_URL=https://your-api.com/v1 npm run enrich-ai
```

Windows PowerShell：

```powershell
$env:AI_API_KEY="sk-xxx"; $env:AI_BASE_URL="https://your-api.com/v1"; npm run enrich-ai
```

完整的每周更新流程变成两步：

```bash
# 第一步：抓取 GitHub 数据
GITHUB_TOKEN=ghp_xxx npm run fetch-weekly

# 第二步：AI 增强
AI_API_KEY=sk-xxx AI_BASE_URL=https://your-api.com/v1 npm run enrich-ai
```

---

## 5. 交付检查清单

- [ ] `scripts/enrich-ai.mjs` 存在
- [ ] 不依赖任何新的 npm 包（只用 Node.js 内置的 `fetch`、`fs`、`path`）
- [ ] 环境变量未设置时，脚本打印清晰错误并退出
- [ ] 运行后 `latest-weekly.json` 中前 N 个 repo 的 `summary_short`、`tags` 等字段被填充
- [ ] 排名靠后的 repo 的 AI 字段仍为 `null`
- [ ] 对应日期的 `weekly/<date>.json` 也被同步更新
- [ ] 单个 repo AI 调用失败不影响其他 repo
- [ ] `npm run dev` 后首页卡片能显示 AI 摘要（有值的显示摘要，null 的显示原始 description）
- [ ] `fetch-weekly.mjs` 未被修改
- [ ] 前端代码未被修改

---

## 6. 明确不做

- 不修改 `fetch-weekly.mjs`（两个脚本保持独立）
- 不修改任何前端组件（降级逻辑已经在 MVP 阶段写好）
- 不做批量请求 / 并发调用（逐个处理 + sleep 最稳妥）
- 不缓存到数据库（JSON 文件就是缓存）
- 不做 README 摘取（后续可加，MVP 不需要）
- 不做多语言摘要（统一英文）

---

## 7. 给 Codex 的总提示词

```
Add an AI enrichment script to the weekly snapshot pipeline.

Create scripts/enrich-ai.mjs that:
1. Reads public/data/latest-weekly.json
2. For the top N repos (default 30), calls an OpenAI-compatible chat completions API
3. Generates: summary_short (1 sentence), summary_medium (2-4 sentences), tags (3-8), category
4. Writes results back into the same JSON files
5. Repos that fail AI enrichment keep null fields (frontend already handles fallback)

Environment variables: AI_API_KEY, AI_BASE_URL, AI_MODEL (default gpt-4o-mini), AI_TOP_N (default 30)

Constraints:
- Do NOT modify fetch-weekly.mjs or any frontend files
- No new npm dependencies (use native fetch)
- Process repos sequentially with 1s delay between calls
- Use response_format: { type: 'json_object' } for structured output
- Print progress like [3/30] Enriching owner/repo...
- Single repo failure must not break the whole run
```
