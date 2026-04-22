# GitHub Weekly Trending Digest — Codex 执行任务书

## 0. 项目背景

当前仓库 `git-trends/git-trends.github.io` 是一个 Next.js 静态站点，浏览器直连 `api.github.com/search/repositories` 获取 trending 数据。

目标：改造成 **每周 GitHub 热门项目周报系统（Weekly Trending Digest MVP）**。

核心变化只有一个：**数据不再由浏览器实时去 GitHub 拉，而是由后台 pipeline 每周抓一次，生成 JSON 文件，前端读取 JSON。**

---

## 1. 硬性约束

- **保留 `output: "export"` 静态导出模式**，不引入服务端 API 路由
- **保留现有 UI 外壳**，不重新设计页面布局
- **不建数据库**，第一阶段只用 JSON 文件作为数据存储
- **不接入 AI API**，AI 摘要字段用 `null` 占位，前端写好降级逻辑即可
- **不做**：全量 GitHub 镜像、daily/monthly、语义搜索、向量数据库、用户系统、收藏/订阅/通知
- 每一步小改动、可验证、可回滚

---

## 2. 不动的文件

以下模块只做最小适配，不要重写：

- `app/page.tsx` — 首页壳子
- `app/search/page.tsx` — 搜索页壳子
- `app/layout.tsx` — 全局布局
- `components/site-header.tsx` — 导航栏
- `components/site-footer.tsx` — 底栏
- `lib/languages.ts` — 语言列表
- `components/ui/*` — shadcn 组件库

---

## 3. 必须改的文件

| 文件 | 改动性质 |
|------|---------|
| `components/trending-list.tsx` | **重写数据源**：删除 GitHub API 调用，改读 JSON |
| `components/search-content.tsx` | **重写数据源**：删除 GitHub API 调用，改为在快照数据中搜索 |
| `components/repo-card.tsx` | **适配**：更新类型定义，支持新字段，加降级逻辑 |
| `app/about/page.tsx` | **改文案** |
| `app/privacy/page.tsx` | **改文案** |
| `app/search/page.tsx` | **改文案**（页面壳子保留，只改描述文字） |

---

## 4. 执行步骤

严格按以下顺序执行，不要跳步。

---

### Phase 1：数据契约 + Mock 数据

**目标**：定义 JSON 数据格式，生成一份可用的假数据，让后续前端改造有东西可跑。

#### 1.1 创建 TypeScript 类型定义

新建 `lib/types.ts`，定义以下类型：

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
  // AI 增强（第一阶段全部为 null）
  summary_short: string | null
  summary_medium: string | null
  tags: string[] | null
  category: string | null
}

export interface WeeklySnapshot {
  snapshot_date: string
  window_start: string
  window_end: string
  generated_at: string
  repos: TrendingRepo[]
}
```

#### 1.2 创建 Mock 数据

新建 `public/data/latest-weekly.json`，手写 **至少 15 条**仿真数据，要求：

- 覆盖多种语言（TypeScript, Python, Rust, Go, Java 等）
- 部分记录有 `summary_short` 和 `tags`（模拟 AI 已处理）
- 部分记录 `summary_short` 和 `tags` 为 `null`（模拟未处理，用于验证降级）
- `rank` 从 1 开始连续编号
- `snapshot_date` 使用 `2026-04-20`
- 数据要看起来真实合理（star 数、描述、话题等）

同时创建 `public/data/weekly/2026-04-20.json`，内容与 `latest-weekly.json` 相同。

#### 1.3 创建数据读取工具函数

新建 `lib/snapshot.ts`，提供以下函数：

```typescript
// 获取最新一期快照
export async function getLatestSnapshot(): Promise<WeeklySnapshot>

// 获取指定日期的快照
export async function getSnapshotByDate(date: string): Promise<WeeklySnapshot>

// 在快照数据中搜索（按 name、description、tags 做文本匹配）
export function searchInSnapshot(repos: TrendingRepo[], query: string): TrendingRepo[]

// 按语言筛选
export function filterByLanguage(repos: TrendingRepo[], language: string): TrendingRepo[]
```

实现方式：`fetch('/data/latest-weekly.json')` 读取静态 JSON。

#### Phase 1 交付检查

- [ ] `lib/types.ts` 存在且类型定义完整
- [ ] `public/data/latest-weekly.json` 存在且包含 ≥15 条记录
- [ ] `public/data/weekly/2026-04-20.json` 存在
- [ ] `lib/snapshot.ts` 存在且函数可用
- [ ] 类型和 JSON 数据结构一致

---

### Phase 2：前端数据层改造

**目标**：让首页和搜索页读取 JSON 数据，不再请求 GitHub API。

#### 2.1 改造 `components/repo-card.tsx`

- 更新 props 类型，从 GitHub API 原始结构改为 `TrendingRepo`
- 描述展示逻辑：`summary_short ?? description`
- 标签展示逻辑：`tags ?? topics`（AI tags 优先，没有就用 GitHub topics）
- 新增 `rank` 显示（可选，在卡片左侧或角标显示排名）
- 新增 `snapshot_date` 显示（可选，轻量展示）
- 保留现有的 star/fork/language 展示，字段名对应到新类型即可

#### 2.2 重写 `components/trending-list.tsx`

- **删除**：所有 GitHub API 相关代码（fetcher、REST headers、useSWR、api.github.com URL）
- **新增**：调用 `getLatestSnapshot()` 获取数据
- 保留现有的视觉结构（列表、加载态、空态、语言筛选控件）
- 语言筛选改为客户端过滤：对已加载的 JSON 数据调用 `filterByLanguage()`
- 排序支持：至少支持按 rank（默认）和按 stars 排序
- 分页：客户端分页，每页 20 条即可
- 加载态：fetch JSON 期间显示 loading

#### 2.3 重写 `components/search-content.tsx`

- **删除**：所有 GitHub API 相关代码
- **新增**：调用 `getLatestSnapshot()` 获取数据，然后用 `searchInSnapshot()` 做客户端文本搜索
- 搜索范围：仅在当前最新快照的 `full_name`、`description`、`tags`、`summary_short` 字段中匹配
- 保留现有的搜索框、结果列表、空态展示
- 搜索结果使用改造后的 `repo-card` 组件渲染

#### Phase 2 交付检查

- [ ] 首页能显示 mock JSON 中的 trending 列表
- [ ] 语言筛选可用
- [ ] 排序可用
- [ ] 分页可用
- [ ] 搜索页能在快照数据中搜索并显示结果
- [ ] 有 AI 摘要的卡片显示 `summary_short`
- [ ] 没有 AI 摘要的卡片降级显示 `description`
- [ ] 浏览器 Network 面板中 **没有** `api.github.com` 的请求
- [ ] `npm run build` 静态导出成功（`output: "export"` 未被修改）

---

### Phase 3：Pipeline 脚本（仅 GitHub 抓取，不含 AI）

**目标**：创建一个可本地运行的脚本，从 GitHub API 抓取热门仓库，生成与 Phase 1 相同格式的 JSON。

#### 3.1 创建 pipeline 脚本

新建 `scripts/fetch-weekly.ts`（或 `.js`），实现以下流程：

1. **抓取**：使用 GitHub Search API（`https://api.github.com/search/repositories`），查询条件：
   - `created:>` 7 天前的日期
   - `sort=stars`
   - `order=desc`
   - 取前 100 条（分页拉取）
   - 需要 `GITHUB_TOKEN` 环境变量做认证（提高 rate limit）
2. **标准化**：将 GitHub API 返回的字段映射到 `TrendingRepo` 类型
3. **排名**：按 stars 降序，从 1 开始编号 rank
4. **AI 字段留空**：`summary_short`、`summary_medium`、`tags`、`category` 全部设为 `null`
5. **输出**：
   - 写入 `public/data/latest-weekly.json`
   - 写入 `public/data/weekly/<YYYY-MM-DD>.json`（日期为当天）

#### 3.2 提供运行方式

在 `package.json` 中添加 script：

```json
{
  "scripts": {
    "fetch-weekly": "npx tsx scripts/fetch-weekly.ts"
  }
}
```

运行命令：

```bash
GITHUB_TOKEN=your_token_here npm run fetch-weekly
```

#### 3.3 错误处理

- GitHub API 请求失败时，输出清晰的错误信息并退出
- `GITHUB_TOKEN` 未设置时，给出提示（不带 token 的请求 rate limit 只有 10 次/分钟）
- 生成的 JSON 需要做基本校验（非空、字段完整）

#### Phase 3 交付检查

- [ ] `scripts/fetch-weekly.ts` 存在
- [ ] 带 `GITHUB_TOKEN` 运行后，`public/data/latest-weekly.json` 被真实数据覆盖
- [ ] `public/data/weekly/<日期>.json` 被创建
- [ ] 输出的 JSON 格式与 `WeeklySnapshot` 类型一致
- [ ] 前端不做任何修改就能展示 pipeline 产出的真实数据
- [ ] 有 `README` 或注释说明如何运行

---

### Phase 4：文案更新 + 最终验证

**目标**：修正所有不准确的产品描述，完成 MVP。

#### 4.1 文案修改

**`app/about/page.tsx`**：
- 删除所有提到 "real-time"、"client-side GitHub API" 的表述
- 改为描述 "weekly snapshot" 和 "curated trending data"
- 说明数据每周更新一次

**`app/privacy/page.tsx`**：
- 删除关于浏览器直连 GitHub API 的描述
- 更新为"数据由后台定期采集，前端不直接请求第三方 API"

**`app/search/page.tsx`**：
- 将 "Search across millions of GitHub repositories" 改为类似：
  "Search within weekly trending snapshots"
- 保留页面结构不变

#### 4.2 最终验证清单

完成全部 Phase 后，确认以下全部通过：

- [ ] `npm install` 无报错
- [ ] `npm run build` 静态导出成功
- [ ] `npm run dev` 本地可运行
- [ ] 首页展示 weekly trending snapshot 数据
- [ ] 搜索页可在快照数据中搜索
- [ ] repo card 有 AI 摘要时显示摘要，无摘要时显示原始 description
- [ ] 浏览器不再请求 `api.github.com`
- [ ] About / Privacy / Search 文案已更正
- [ ] `npm run fetch-weekly`（带 token）可运行并生成真实数据
- [ ] `next.config.mjs` 中 `output: "export"` 未被修改

---

## 5. 工作方式要求

- 先分析现有代码，再改
- 每个 Phase 完成后报告：改了哪些文件、为什么、如何验证
- 保持 diff 最小化、可读
- 不引入新的重型依赖（不加 ORM、不加数据库、不加状态管理库）
- 遇到不确定的地方，选更简单的方案
- 不要提前做后续 Phase 的事

---

## 6. 明确不做的事（再次强调）

以下内容全部 **不在本次 MVP 范围内**，不要实现：

- SQLite / Postgres / 任何数据库
- Next.js API routes / 服务端渲染
- AI API 调用（字段留 null，等后续单独接入）
- 向量数据库 / 语义搜索 / RAG
- 用户账号 / 登录系统
- 收藏 / 订阅 / 邮件通知
- Daily / Monthly 周期
- GitHub Actions 自动化（后续再加）
- 部署配置（先保证本地可跑）

---

## 7. 给 Codex 的总提示词

```
Refactor this Next.js static site from a real-time GitHub API browser
into a weekly trending digest MVP.

Phase 1: Define TypeScript types + create mock JSON data + data utility functions
Phase 2: Rewrite trending-list.tsx and search-content.tsx to read JSON, adapt repo-card.tsx
Phase 3: Create a pipeline script that fetches from GitHub API and outputs JSON
Phase 4: Update About/Privacy/Search page copy, final validation

Hard constraints:
- Keep output: "export" in next.config.mjs
- No database, no API routes, no AI API calls
- AI fields (summary_short, tags) are null placeholders with frontend fallback
- Minimal dependencies, small diffs, each phase independently verifiable
```
