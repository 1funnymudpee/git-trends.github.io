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
  rank: number
  snapshot_date: string
  category_key: string
  summary_short: string | null
  summary_medium: string | null
  tags: string[] | null
  category: string | null
  trending_reason: string | null
}

export interface CategorySection {
  key: string
  label: string
  description: string
  repos: TrendingRepo[]
}

export interface WeeklySnapshot {
  snapshot_date: string
  window_start: string
  window_end: string
  generated_at: string
  categories: CategorySection[]
  repos: TrendingRepo[]
}
