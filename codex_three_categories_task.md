# 三分类 Trending + AI 趋势分析 — Codex 执行任务书

## 0. 背景

当前 MVP 已跑通：pipeline 抓取 GitHub 数据 → AI 摘要 → 部署。但当前只有一个列表，且查询策略不够好。

本阶段目标：**把 trending 列表拆分为三个分类，每个分类各 30 个项目，并让 AI 分析"为什么这个项目最近涨 star"。**

三个分类：

| 分类 | 英文标签 | 查询策略 | 说明 |
|------|---------|---------|------|
| 经典热门 | Established | `pushed:>${7天前} stars:>10000` sort:stars | 长期高 star 的老仓库，最近一周仍在活跃 |
| 月度新星 | New This Month | `created:>${30天前} stars:>50` sort:stars | 最近一个月内新创建，已获得一定关注 |
| 季度新星 | Rising Stars | `created:>${90天前} created:<${30天前} stars:>100` sort:stars | 最近 1-3 个月创建，持续增长中 |

---

## 1. 硬性约束

- 保留 `output: "export"` 静态导出模式
- 保留现有 UI 风格，不做大幅重新设计
- AI 增强仍为独立脚本，不耦合进 fetch 脚本
- 环境变量方式不变（GITHUB_TOKEN, AI_API_KEY, AI_BASE_URL, AI_MODEL）
- 单个 repo AI 调用失败不影响整体流程

---

## 2. 需要修改的文件

| 文件 | 改动 |
|------|------|
| `lib/types.ts` | 更新类型定义，支持分类和新 AI 字段 |
| `scripts/fetch-weekly.mjs` | 三次查询，分类输出 |
| `scripts/enrich-ai.mjs` | 更新 prompt，分析涨 star 原因 |
| `lib/snapshot.ts` | 适配新数据结构 |
| `components/trending-list.tsx` | 增加分类 tab 切换 |
| `components/repo-card.tsx` | 显示新增的 AI 字段 |
| `public/data/*.json` | 结构变化（自动生成，不用手改） |

---

## 3. 数据结构变更

### 3.1 更新 `lib/types.ts`

```typescript
export interface TrendingRepo {
  github_repo_id: number
  owner: string
  name: string
  full_name: string
  html_url: string
  description: string | null
  language: string | null
  topics: string[]
  avatar_url: string
  stars: number
  forks: number
  watchers: number
  open_issues: number
  pushed_at: string
  created_at: string
  // 快照相关
  rank: number
  snapshot_date: string
  category_key: string  // "established" | "new_this_month" | "rising_stars"
  // AI 增强
  summary_short: string | null
  summary_medium: string | null
  tags: string[] | null
  category: string | null
  trending_reason: string | null  // 新增：为什么这周涨 star
}

export interface CategorySection {
  key: string           // "established" | "new_this_month" | "rising_stars"
  label: string         // 显示名称
  description: string   // 分类说明
  repos: TrendingRepo[]
}

export interface WeeklySnapshot {
  snapshot_date: string
  window_start: string
  window_end: string
  generated_at: string
  categories: CategorySection[]
  // 保留向后兼容
  repos: TrendingRepo[]  // 所有分类的 repos 合并，供搜索使用
}
```

---

## 4. 修改 `scripts/fetch-weekly.mjs`

### 4.1 三次查询

替换原来的单次查询逻辑，改为三次独立查询：

```javascript
const CATEGORIES = [
  {
    key: "established",
    label: "Established",
    description: "High-star repositories actively maintained this week",
    query: `pushed:>${windowStart} stars:>10000`,
    maxResults: 30,
  },
  {
    key: "new_this_month",
    label: "New This Month",
    description: "Repositories created in the last 30 days gaining traction",
    query: `created:>${formatDate(subtractDays(snapshotMoment, 30))} stars:>50`,
    maxResults: 30,
  },
  {
    key: "rising_stars",
    label: "Rising Stars",
    description: "Repositories created 1-3 months ago with sustained growth",
    query: `created:>${formatDate(subtractDays(snapshotMoment, 90))} created:<${formatDate(subtractDays(snapshotMoment, 30))} stars:>100`,
    maxResults: 30,
  },
]
```

### 4.2 每个分类独立抓取和排名

对每个分类：
- 用该分类的 query 调用 GitHub Search API
- 按 stars 降序排序
- rank 从 1 开始编号（每个分类独立排名）
- 给每条 repo 加上 `category_key` 字段

### 4.3 输出格式

```javascript
const snapshot = {
  snapshot_date: snapshotDate,
  window_start: windowStart,
  window_end: snapshotDate,
  generated_at: new Date().toISOString(),
  categories: [
    { key: "established", label: "Established", description: "...", repos: [...] },
    { key: "new_this_month", label: "New This Month", description: "...", repos: [...] },
    { key: "rising_stars", label: "Rising Stars", description: "...", repos: [...] },
  ],
  repos: allReposCombined,  // 三个分类合并，供搜索用
}
```

### 4.4 去重

同一个 repo 可能同时出现在多个分类中（比如一个 3 周前创建的 12000 star 项目）。在合并到 `repos` 数组时按 `github_repo_id` 去重，但在各自的 `categories` 里保留。

### 4.5 PER_PAGE 和分页

保留 `PER_PAGE = 25`，每个分类根据 `maxResults` 计算需要几页。

---

## 5. 修改 `scripts/enrich-ai.mjs`

### 5.1 读取新结构

从 `snapshot.categories` 中读取 repos，而不是 `snapshot.repos`。

### 5.2 处理范围

每个分类处理前 `AI_TOP_N` 个（默认 10，三个分类共 30 个）。

环境变量改动：`AI_TOP_N` 的含义改为"每个分类处理前 N 个"，默认值改为 `10`。

### 5.3 更新 Prompt

**System Prompt 更新为：**

```
You are a technical analyst for a GitHub trending digest.
Given a GitHub repository's metadata and its trending category, produce a JSON object with exactly these fields:

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
- tags should be lowercase, hyphenated for multi-word
- trending_reason should be specific and analytical, not generic
- Do not invent facts not present in the input
- Respond with valid JSON only, no markdown fences
```

**User Prompt 增加分类信息：**

```
Repository: {full_name}
Description: {description || 'No description provided'}
Language: {language || 'Unknown'}
Topics: {topics.join(', ') || 'None'}
Stars: {stars}
Forks: {forks}
Created: {created_at}
Last Pushed: {pushed_at}
Trending Category: {category_key} ({category_label})
Weekly Rank in Category: #{rank}
```

### 5.4 写回逻辑

处理完后，同时更新 `categories` 里的 repos 和 `repos` 合并数组中的对应记录。

### 5.5 解析新增字段

```javascript
repo.trending_reason = typeof parsed.trending_reason === 'string' ? parsed.trending_reason : null
```

---

## 6. 修改前端

### 6.1 修改 `lib/snapshot.ts`

- `getLatestSnapshot()` 返回值已包含 `categories` 数组
- 新增辅助函数：

```typescript
export function getCategoryRepos(
  snapshot: WeeklySnapshot,
  categoryKey: string
): TrendingRepo[] {
  const cat = snapshot.categories?.find(c => c.key === categoryKey)
  return cat?.repos ?? []
}

export function getAllCategories(
  snapshot: WeeklySnapshot
): CategorySection[] {
  return snapshot.categories ?? []
}
```

- `searchInSnapshot` 继续搜索 `snapshot.repos`（合并后的全量数据）

### 6.2 修改 `components/trending-list.tsx`

- 在列表顶部增加三个 tab 按钮，用于切换分类：
  - "Established"（经典热门）
  - "New This Month"（月度新星）
  - "Rising Stars"（季度新星）
- 默认选中 "New This Month"
- 切换 tab 时显示对应分类的 repos
- 保留现有的语言筛选和排序功能
- tab 样式使用现有的 UI 组件，保持视觉一致

### 6.3 修改 `components/repo-card.tsx`

- 如果 `trending_reason` 有值，在卡片底部展示，用稍浅的文字颜色
- 可以在 trending_reason 前面加一个小图标（比如 📈 或 🔥）
- 如果 `trending_reason` 为 null，不显示（不占空间）

---

## 7. 交付检查清单

- [ ] `scripts/fetch-weekly.mjs` 支持三个分类查询
- [ ] JSON 输出包含 `categories` 数组和合并的 `repos`
- [ ] `scripts/enrich-ai.mjs` 读取新结构，prompt 包含 trending_reason
- [ ] 前端有三个 tab 可切换
- [ ] 每个 tab 显示对应分类的 30 个 repo
- [ ] 搜索功能仍然正常（搜索全量数据）
- [ ] repo card 显示 trending_reason
- [ ] `npm run build` 静态导出成功
- [ ] AI 失败时 trending_reason 为 null，不影响展示

---

## 8. 明确不做

- 不改部署方式
- 不加数据库
- 不做历史趋势对比（只看当前快照）
- 不做 star 增量计算（GitHub API 不支持，后续可加）
- 不改 weekly-update.yml（现有 workflow 已覆盖 fetch + enrich + deploy）

---

## 9. 给 Codex 的总提示词

```
Refactor the weekly snapshot pipeline from a single list to three trending categories.

Changes needed:

1. scripts/fetch-weekly.mjs: Run three separate GitHub Search API queries:
   - "established": pushed in last 7 days + stars>10000 (top 30)
   - "new_this_month": created in last 30 days + stars>50 (top 30)
   - "rising_stars": created 30-90 days ago + stars>100 (top 30)
   Output JSON with a "categories" array and a merged "repos" array.

2. scripts/enrich-ai.mjs: Read from categories, process top 10 per category.
   Add "trending_reason" field to the prompt: 1-2 sentences analyzing why
   the repo is gaining attention this week.

3. lib/types.ts: Add CategorySection type, trending_reason field, category_key field.

4. lib/snapshot.ts: Add getCategoryRepos() and getAllCategories() helpers.

5. components/trending-list.tsx: Add three tab buttons to switch between categories.
   Default to "New This Month". Keep language filter and sort.

6. components/repo-card.tsx: Display trending_reason below the description if present.

Constraints:
- Keep output: "export" in next.config.mjs
- Keep basePath and env config unchanged
- AI failure = null fields, frontend handles fallback
- Do not modify weekly-update.yml
```
