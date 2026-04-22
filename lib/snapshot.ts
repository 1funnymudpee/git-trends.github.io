import type { CategorySection, TrendingRepo, WeeklySnapshot } from "@/lib/types"

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""

const FALLBACK_CATEGORY_SECTIONS: CategorySection[] = [
  {
    key: "established",
    label: "Established",
    description: "High-star repositories actively maintained this week",
    repos: [],
  },
  {
    key: "new_this_month",
    label: "New This Month",
    description: "Repositories created in the last 30 days gaining traction",
    repos: [],
  },
  {
    key: "rising_stars",
    label: "Rising Stars",
    description: "Repositories created 1-3 months ago with sustained growth",
    repos: [],
  },
]

function normalizeSnapshot(snapshot: WeeklySnapshot): WeeklySnapshot {
  const repos = Array.isArray(snapshot.repos) ? snapshot.repos : []
  const categories =
    Array.isArray(snapshot.categories) && snapshot.categories.length > 0
      ? snapshot.categories
      : [
          {
            ...FALLBACK_CATEGORY_SECTIONS[1],
            repos,
          },
        ]

  return {
    ...snapshot,
    categories,
    repos,
  }
}

async function readSnapshot(path: string): Promise<WeeklySnapshot> {
  const response = await fetch(`${BASE_PATH}${path}`)

  if (!response.ok) {
    throw new Error(`Failed to load snapshot data from ${BASE_PATH}${path}`)
  }

  return normalizeSnapshot((await response.json()) as WeeklySnapshot)
}

export async function getLatestSnapshot(): Promise<WeeklySnapshot> {
  return readSnapshot("/data/latest-weekly.json")
}

export async function getSnapshotByDate(date: string): Promise<WeeklySnapshot> {
  return readSnapshot(`/data/weekly/${date}.json`)
}

export function searchInSnapshot(
  repos: TrendingRepo[],
  query: string
): TrendingRepo[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return repos
  }

  return repos.filter((repo) => {
    const haystacks = [
      repo.full_name,
      repo.description,
      repo.summary_short,
      repo.summary_medium,
      repo.trending_reason,
      ...(repo.tags ?? []),
    ]

    return haystacks.some((value) =>
      value?.toLowerCase().includes(normalizedQuery)
    )
  })
}

export function filterByLanguage(
  repos: TrendingRepo[],
  language: string
): TrendingRepo[] {
  if (!language) {
    return repos
  }

  return repos.filter(
    (repo) => repo.language?.toLowerCase() === language.toLowerCase()
  )
}

export function getCategoryRepos(
  snapshot: WeeklySnapshot,
  categoryKey: string
): TrendingRepo[] {
  const category = snapshot.categories?.find((item) => item.key === categoryKey)
  return category?.repos ?? []
}

export function getAllCategories(snapshot: WeeklySnapshot): CategorySection[] {
  return snapshot.categories ?? []
}
