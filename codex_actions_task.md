# GitHub Actions 自动化 — Codex 执行任务书

## 0. 背景

MVP 已完成，本地可以手动执行两步命令完成每周更新：

```bash
GITHUB_TOKEN=xxx npm run fetch-weekly
AI_API_KEY=xxx AI_BASE_URL=xxx AI_MODEL=xxx npm run enrich-ai
```

本阶段目标：**创建一个 GitHub Actions workflow，每周自动执行抓取 + AI 增强 + 构建部署，无需人工干预。**

---

## 1. 硬性约束

- 只新增 workflow 文件，**不修改任何现有代码**
- 不修改 `fetch-weekly.mjs`、`enrich-ai.mjs`、前端组件
- 不修改 `next.config.mjs`（保留 `output: "export"`）
- 敏感信息全部通过 GitHub Secrets 传入，不写在 workflow 文件里
- 支持手动触发（`workflow_dispatch`），方便随时手动跑一次

---

## 2. 新增文件

只需要新增 **一个文件**：

```
.github/workflows/weekly-update.yml
```

---

## 3. Workflow 设计

### 3.1 触发条件

```yaml
on:
  # 每周一 UTC 00:00 自动运行
  schedule:
    - cron: '0 0 * * 1'
  # 支持手动触发
  workflow_dispatch:
```

### 3.2 使用的 Secrets

workflow 文件中引用以下 secrets（用户需要自己在 GitHub 仓库设置中添加）：

| Secret 名称 | 用途 | 示例值 |
|-------------|------|--------|
| `GH_PAT` | GitHub Personal Access Token，用于 fetch-weekly 抓取数据 | `github_pat_xxxxxxxx` |
| `AI_API_KEY` | AI 服务的 API 密钥 | `sk-xxxxxxxx` |
| `AI_BASE_URL` | AI 服务的基础地址 | `https://www.luminai.cc/v1` |
| `AI_MODEL` | AI 模型名称 | `gpt-5.4` |

注意：**不要使用** `GITHUB_TOKEN` 作为 secret 名称，因为这是 Actions 的内置保留名。用 `GH_PAT` 代替。

### 3.3 完整 Workflow

```yaml
name: Weekly Trending Update

on:
  schedule:
    - cron: '0 0 * * 1'
  workflow_dispatch:

permissions:
  contents: write
  pages: write
  id-token: write

jobs:
  update-and-deploy:
    runs-on: ubuntu-latest
    steps:
      # 1. 检出代码
      - name: Checkout repository
        uses: actions/checkout@v4

      # 2. 安装 Node.js
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # 3. 安装依赖
      - name: Install dependencies
        run: npm ci

      # 4. 抓取 GitHub 热门仓库
      - name: Fetch weekly trending data
        env:
          GITHUB_TOKEN: ${{ secrets.GH_PAT }}
        run: npm run fetch-weekly

      # 5. AI 增强（失败不阻塞后续步骤）
      - name: AI enrichment
        continue-on-error: true
        env:
          AI_API_KEY: ${{ secrets.AI_API_KEY }}
          AI_BASE_URL: ${{ secrets.AI_BASE_URL }}
          AI_MODEL: ${{ secrets.AI_MODEL }}
          AI_TOP_N: '30'
        run: npm run enrich-ai

      # 6. 把更新后的 JSON 提交回仓库
      - name: Commit updated data
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/
          # 如果没有变更就跳过提交
          git diff --staged --quiet || git commit -m "chore: update weekly snapshot $(date +%Y-%m-%d)"
          git push

      # 7. 构建静态站点
      - name: Build static site
        run: npm run build

      # 8. 部署到 GitHub Pages
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

### 3.4 关键设计说明

Codex 在创建这个文件时需要理解以下设计意图：

1. **AI 步骤设置了 `continue-on-error: true`**：即使 AI 服务不可用，抓取到的数据仍然会被提交和部署。前端有降级逻辑，AI 字段为 null 时显示原始 description。

2. **提交步骤用了 `git diff --staged --quiet ||`**：如果数据没有变化（比如当周没有新的 trending repo），就跳过提交，不会产生空 commit。

3. **使用 `actions/deploy-pages` 部署**：这是 GitHub 官方推荐的 Pages 部署方式，需要仓库的 Pages 设置中 Source 选择 "GitHub Actions"。

4. **`permissions` 块显式声明了所需权限**：`contents: write` 用于推送 commit，`pages: write` 和 `id-token: write` 用于 Pages 部署。

---

## 4. 交付检查清单

- [ ] `.github/workflows/weekly-update.yml` 存在
- [ ] workflow 文件语法正确（可用 `actionlint` 检查或直接在 GitHub 上查看是否报错）
- [ ] 没有硬编码任何密钥或 URL
- [ ] AI 步骤设置了 `continue-on-error: true`
- [ ] 提交步骤在无变更时不会报错
- [ ] 未修改任何现有文件

---

## 5. 明确不做

- 不修改 `fetch-weekly.mjs` 或 `enrich-ai.mjs`
- 不修改前端代码
- 不添加 Slack/邮件通知（后续可加）
- 不添加多分支/多环境部署
- 不配置 GitHub Secrets（这个用户自己在 GitHub 网页上操作）

---

## 6. 给 Codex 的总提示词

```
Create a GitHub Actions workflow file at .github/workflows/weekly-update.yml

The workflow should:
1. Run every Monday at 00:00 UTC (cron) and support manual trigger (workflow_dispatch)
2. Checkout code, setup Node.js 20, npm ci
3. Run "npm run fetch-weekly" with GITHUB_TOKEN from secrets.GH_PAT
4. Run "npm run enrich-ai" with AI_API_KEY, AI_BASE_URL, AI_MODEL from secrets (continue-on-error: true)
5. Commit updated public/data/ files back to the repo (skip if no changes)
6. Build with "npm run build" and deploy the ./out directory to GitHub Pages

Constraints:
- Do NOT modify any existing files
- Use secrets.GH_PAT (not secrets.GITHUB_TOKEN) for the GitHub PAT
- AI enrichment step must not block deployment if it fails
- No hardcoded secrets or URLs in the workflow file
```
