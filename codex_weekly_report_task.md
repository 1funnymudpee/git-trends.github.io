# 每周趋势报告生成 — Codex 执行任务书

## 0. 背景

当前 pipeline 已有三分类数据 + per-repo AI 摘要。但缺少一份**全局性的周报**，把三个分类的趋势串起来分析，并给出推荐项目和落地建议。

本阶段目标：**在 AI enrichment 之后新增一步，用 AI 生成一份结构化的 Markdown 周报，前端新增 Report 页面展示。**

---

## 1. 硬性约束

- 周报通过**一次 AI 调用**生成（不是逐 repo 调用，是把所有数据汇总后一次性生成）
- 使用与 enrich-ai 相同的环境变量（AI_API_KEY, AI_BASE_URL, AI_MODEL）
- AI 失败时不阻塞部署，前端显示"本周报告生成中"的占位
- 保留 `output: "export"` 静态导出
- 报告同时存为 `.md`（后续给 Obsidian 用）和 `.json`（给前端用）

---

## 2. 新增和修改的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/generate-report.mjs` | 新增 | 周报生成脚本 |
| `public/data/reports/latest.json` | 新增（自动生成） | 前端读取的报告数据 |
| `public/data/reports/latest.md` | 新增（自动生成） | Markdown 原文，后续给 Obsidian |
| `public/data/reports/<date>.md` | 新增（自动生成） | 按日期归档 |
| `app/report/page.tsx` | 新增 | 周报展示页面 |
| `components/site-header.tsx` | 修改 | 导航栏加 Report 链接 |
| `.github/workflows/weekly-update.yml` | 修改 | 加一步运行 generate-report |
| `package.json` | 修改 | 加 script 命令 |

---

## 3. 脚本设计：`scripts/generate-report.mjs`

### 3.1 环境变量

与 enrich-ai 相同：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `AI_API_KEY` | 是 | API 密钥 |
| `AI_BASE_URL` | 是 | API 基础地址 |
| `AI_MODEL` | 否 | 默认 `gpt-4o-mini` |

### 3.2 执行流程

```
1. 读取 public/data/latest-weekly.json
2. 提取每个分类的 repo 摘要信息（不传原始大 JSON，构造精简输入）
3. 一次 AI 调用，生成完整周报
4. 解析返回内容
5. 写入 public/data/reports/latest.json
6. 写入 public/data/reports/latest.md
7. 写入 public/data/reports/<snapshot_date>.md
```

### 3.3 构造 AI 输入

为了控制 token 量，不要发送完整 JSON。对每个 repo 只提取关键字段，构造一份精简摘要：

```javascript
function summarizeForReport(snapshot) {
  return snapshot.categories.map(cat => ({
    category: cat.label,
    description: cat.description,
    total: cat.repos.length,
    repos: cat.repos.map(r => ({
      name: r.full_name,
      stars: r.stars,
      language: r.language,
      description: r.summary_short || r.description,
      trending_reason: r.trending_reason,
      tags: r.tags || r.topics,
      created_at: r.created_at,
      rank: r.rank,
    }))
  }))
}
```

### 3.4 AI Prompt

**System Prompt：**

```
You are a senior technology analyst writing a weekly GitHub Trending Report.
You will receive structured data about three categories of trending repositories.
Write a comprehensive yet concise weekly report in Markdown format.

The report MUST follow this exact structure with these exact headings:

## 📊 本周总览 (Executive Summary)
3-5 sentences summarizing the overall GitHub ecosystem trends this week.
Identify the dominant themes, notable shifts, and any surprising patterns.

## 🏛️ 经典热门趋势 (Established Projects)
Analyze the established/high-star projects that were active this week.
What directions are mature projects iterating toward?
Which domains are seeing renewed activity? (3-5 paragraphs)

## 🌱 月度新星趋势 (New This Month)  
Analyze newly created projects gaining traction.
What problem domains are attracting fresh solutions?
Any clustering of similar tools or approaches? (3-5 paragraphs)

## 🚀 季度成长趋势 (Rising Stars)
Analyze 1-3 month old projects with sustained growth.
Which early bets are proving out?
What does sustained growth tell us about these areas? (3-5 paragraphs)

## 🔗 跨分类洞察 (Cross-Category Patterns)
Look across all three categories for common threads.
What technology directions appear in old projects, new projects, AND growing projects simultaneously?
These cross-cutting themes are the strongest trend signals. (2-3 paragraphs)

## ⭐ 本周推荐 (Top Picks)
Select 3-5 projects from across all categories that are most worth attention.
For EACH recommended project, provide:
- **项目**: owner/repo
- **推荐理由**: One sentence on why it stands out
- **适合谁**: Beginner / Intermediate / Advanced
- **落地步骤**: 3-5 concrete steps from clone to running demo
- **预计时间**: How long to get a basic demo working

## 🔮 下周展望 (What to Watch)
Based on this week's patterns, predict 2-3 directions likely to continue trending.
What should readers keep an eye on? (1-2 paragraphs)

Rules:
- Write section headings and labels in Chinese, analysis content in Chinese
- Be specific and analytical, not generic
- Reference actual project names when making points
- Keep the total report between 1500-2500 words
- Do not invent information not present in the input data
- Output raw Markdown only, no code fences around the entire document
```

**User Prompt：**

```
以下是本周 GitHub Trending 三分类数据（快照日期：{snapshot_date}）：

{JSON.stringify(summarizedData, null, 2)}

请根据以上数据生成本周 GitHub Trending 周报。
```

### 3.5 输出文件

**`public/data/reports/latest.json`：**

```json
{
  "snapshot_date": "2026-04-22",
  "generated_at": "2026-04-22T19:00:00.000Z",
  "model": "gpt-5.4",
  "report_markdown": "## 📊 本周总览...\n\n..."
}
```

**`public/data/reports/latest.md`：**

纯 Markdown 文件，内容就是 `report_markdown` 的值，文件顶部加 frontmatter：

```markdown
---
snapshot_date: 2026-04-22
generated_at: 2026-04-22T19:00:00.000Z
model: gpt-5.4
---

## 📊 本周总览 (Executive Summary)
...
```

**`public/data/reports/2026-04-22.md`：**

与 `latest.md` 内容相同，按日期归档。

### 3.6 错误处理

- AI 调用失败：打印错误信息，写入一个包含错误状态的 `latest.json`：
  ```json
  {
    "snapshot_date": "2026-04-22",
    "generated_at": "...",
    "error": true,
    "report_markdown": null
  }
  ```
- `latest-weekly.json` 不存在：打印错误并退出
- AI 返回内容不包含预期的 Markdown 标题：打印警告但仍然保存（不做严格校验）

---

## 4. 前端：周报展示页面

### 4.1 新增 `app/report/page.tsx`

- 页面读取 `public/data/reports/latest.json`
- 如果 `report_markdown` 有值，渲染 Markdown 内容
- 如果 `error` 为 true 或 `report_markdown` 为 null，显示占位信息："本周报告正在生成中，请稍后刷新"
- 页面顶部显示快照日期

### 4.2 Markdown 渲染

使用 `react-markdown` 库渲染 Markdown：

```bash
npm install react-markdown
```

基本用法：

```tsx
import ReactMarkdown from 'react-markdown'

<ReactMarkdown>{reportMarkdown}</ReactMarkdown>
```

样式要求：
- 继承当前站点的暗色主题
- 标题、段落、列表、加粗等元素样式与站点整体风格一致
- 推荐项目部分的"落地步骤"用有序列表展示

### 4.3 数据获取

与 trending-list 一致，使用 fetch 读取静态 JSON：

```typescript
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ''
const res = await fetch(`${BASE_PATH}/data/reports/latest.json`)
```

### 4.4 修改 `components/site-header.tsx`

在导航栏 Trending 和 Search 旁边加一个 **Report** 链接，指向 `/report`。

---

## 5. 修改 GitHub Actions Workflow

在 `.github/workflows/weekly-update.yml` 的 AI enrichment 步骤后面，新增一步：

```yaml
      # 6. 生成周报
      - name: Generate weekly report
        continue-on-error: true
        env:
          AI_API_KEY: ${{ secrets.AI_API_KEY }}
          AI_BASE_URL: ${{ secrets.AI_BASE_URL }}
          AI_MODEL: ${{ secrets.AI_MODEL }}
        run: npm run generate-report
```

注意：
- 放在 enrich-ai 之后、git commit 之前
- 设置 `continue-on-error: true`
- commit 步骤的 `git add` 改为 `git add public/data/` 以包含 reports 目录

---

## 6. package.json 新增 script

```json
{
  "scripts": {
    "generate-report": "node scripts/generate-report.mjs"
  }
}
```

本地运行：

```bash
AI_API_KEY=xxx AI_BASE_URL=https://www.luminai.cc/v1 AI_MODEL=gpt-5.4 npm run generate-report
```

---

## 7. 完整的每周更新流程（更新后）

```
fetch-weekly → enrich-ai → generate-report → git commit → build → deploy
     │              │              │
     ▼              ▼              ▼
  抓取数据      逐 repo 增强     生成周报
  (30s)         (2-3min)        (30s)
```

---

## 8. 交付检查清单

- [ ] `scripts/generate-report.mjs` 存在
- [ ] 运行后生成 `public/data/reports/latest.json`
- [ ] 运行后生成 `public/data/reports/latest.md`
- [ ] 运行后生成 `public/data/reports/<date>.md`
- [ ] `app/report/page.tsx` 存在
- [ ] 导航栏有 Report 链接
- [ ] 周报页面能正常渲染 Markdown 内容
- [ ] AI 失败时页面显示占位信息而不是白屏
- [ ] `weekly-update.yml` 包含 generate-report 步骤
- [ ] `npm run build` 静态导出成功
- [ ] 只新增了 `react-markdown` 一个依赖

---

## 9. 明确不做

- 不做历史周报对比（后续再加）
- 不做项目打分（后续再加）
- 不做 Obsidian 导出（下一个任务）
- 不改 fetch-weekly.mjs 或 enrich-ai.mjs
- 不做报告的编辑/评论功能

---

## 10. 给 Codex 的总提示词

```
Add a weekly report generation step to the pipeline.

Create scripts/generate-report.mjs that:
1. Reads public/data/latest-weekly.json (after AI enrichment)
2. Summarizes all repos across 3 categories into a compact input
3. Makes ONE AI API call to generate a full Markdown weekly report
4. Report structure: Executive Summary → 3 Category Analyses → Cross-Category Patterns → Top Picks with action steps → What to Watch
5. Saves as public/data/reports/latest.json and .md, plus date-archived .md

Create app/report/page.tsx:
- Fetches and renders the report markdown using react-markdown
- Shows placeholder if report not yet generated
- Uses BASE_PATH for data fetch URL

Update:
- site-header.tsx: add Report nav link
- weekly-update.yml: add generate-report step after enrich-ai, before git commit
- package.json: add "generate-report" script

Constraints:
- Report content in Chinese
- One AI call only, not per-repo
- continue-on-error: true in workflow
- AI failure = graceful fallback in UI
- Only add react-markdown as new dependency
- Keep output: "export" and basePath unchanged
```
