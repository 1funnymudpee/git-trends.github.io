"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { LANGUAGES } from "@/lib/languages"
import { RepoCard, RepoCardSkeleton } from "@/components/repo-card"
import { AlertCircle, ArrowDownUp, ChevronLeft, ChevronRight, Database } from "lucide-react"
import { filterByLanguage, getLatestSnapshot } from "@/lib/snapshot"
import type { TrendingRepo } from "@/lib/types"

const ITEMS_PER_PAGE = 20

const SORT_OPTIONS = [
  { value: "rank", label: "Weekly Rank" },
  { value: "stars", label: "Stars" },
]

export function TrendingList() {
  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [language, setLanguage] = useState("")
  const [sort, setSort] = useState("rank")
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSnapshot() {
      try {
        setIsLoading(true)
        setError(null)
        const snapshot = await getLatestSnapshot()
        if (!cancelled) {
          setRepos(snapshot.repos)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load weekly snapshot."
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadSnapshot()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredRepos = useMemo(
    () => filterByLanguage(repos, language),
    [language, repos]
  )

  const sortedRepos = useMemo(() => {
    const items = [...filteredRepos]

    if (sort === "stars") {
      items.sort((a, b) => b.stars - a.stars || a.rank - b.rank)
      return items
    }

    items.sort((a, b) => a.rank - b.rank || b.stars - a.stars)
    return items
  }, [filteredRepos, sort])

  const totalCount = sortedRepos.length
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))
  const paginatedRepos = sortedRepos.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 rounded-lg bg-secondary p-1 text-sm text-muted-foreground">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-md bg-background px-3 py-1.5 font-medium text-foreground shadow-sm"
            )}
          >
            <Database className="h-3.5 w-3.5" />
            Weekly Snapshot
          </span>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!error && !isLoading && totalCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Showing {paginatedRepos.length} of {totalCount.toLocaleString()} repositories
          </span>
          <span className="flex items-center gap-1">
            <ArrowDownUp className="h-3.5 w-3.5" />
            Sorted by {sort === "stars" ? "stars" : "weekly rank"}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => (
              <RepoCardSkeleton key={`skeleton-${i}`} />
            ))
          : paginatedRepos.map((repo) => (
              <RepoCard
                key={repo.github_repo_id}
                repo={repo}
              />
            ))}
      </div>

      {!isLoading && paginatedRepos.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isLoading && totalCount === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-medium text-foreground">
            No repositories found
          </p>
          <p className="text-sm text-muted-foreground">
            Try changing the language filter or sort option.
          </p>
        </div>
      )}
    </div>
  )
}
