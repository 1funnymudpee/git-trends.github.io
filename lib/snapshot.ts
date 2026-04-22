import type { TrendingRepo, WeeklySnapshot } from "@/lib/types"

async function readSnapshot(path: string): Promise<WeeklySnapshot> {
  const response = await fetch(path)

  if (!response.ok) {
    throw new Error(`Failed to load snapshot data from ${path}`)
  }

  return (await response.json()) as WeeklySnapshot
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
