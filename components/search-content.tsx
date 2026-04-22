"use client"

import React from "react"

import { useCallback, useEffect, useMemo, useState } from "react"
import { LANGUAGES } from "@/lib/languages"
import { RepoCard, RepoCardSkeleton } from "@/components/repo-card"
import { Search, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"
import { filterByLanguage, getLatestSnapshot, searchInSnapshot } from "@/lib/snapshot"
import type { TrendingRepo } from "@/lib/types"

const SORT_OPTIONS = [
  { value: "rank", label: "Weekly Rank" },
  { value: "stars", label: "Stars" },
  { value: "forks", label: "Forks" },
  { value: "watchers", label: "Watchers" },
]

const ITEMS_PER_PAGE = 20

export function SearchContent() {
  const [repos, setRepos] = useState<TrendingRepo[]>([])
  const [query, setQuery] = useState("")
  const [submittedQuery, setSubmittedQuery] = useState("")
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

  const searchedRepos = useMemo(
    () => searchInSnapshot(repos, submittedQuery),
    [repos, submittedQuery]
  )

  const filteredRepos = useMemo(
    () => filterByLanguage(searchedRepos, language),
    [language, searchedRepos]
  )

  const sortedRepos = useMemo(() => {
    const items = [...filteredRepos]

    switch (sort) {
      case "stars":
        items.sort((a, b) => b.stars - a.stars || a.rank - b.rank)
        break
      case "forks":
        items.sort((a, b) => b.forks - a.forks || a.rank - b.rank)
        break
      case "watchers":
        items.sort((a, b) => b.watchers - a.watchers || a.rank - b.rank)
        break
      default:
        items.sort((a, b) => a.rank - b.rank || b.stars - a.stars)
        break
    }

    return items
  }, [filteredRepos, sort])

  const totalCount = sortedRepos.length
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE))
  const paginatedRepos = sortedRepos.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (query.trim()) {
        setSubmittedQuery(query.trim())
        setPage(1)
      }
    },
    [query]
  )

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-secondary py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Search
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value)
              setPage(1)
              if (submittedQuery) setSubmittedQuery(submittedQuery)
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
              if (submittedQuery) setSubmittedQuery(submittedQuery)
            }}
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {submittedQuery && !error && !isLoading && totalCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Found {totalCount.toLocaleString()} repositories in the latest weekly snapshot for{" "}
          <span className="font-medium text-foreground">{`"${submittedQuery}"`}</span>
        </p>
      )}

      <div className="flex flex-col gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
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

      {!submittedQuery && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Search className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">
            Start exploring
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Search within the latest weekly snapshot by repository name,
            description, AI summary, or tags. Filter by language and sort the
            ranked results.
          </p>
        </div>
      )}

      {submittedQuery && !isLoading && totalCount === 0 && !error && (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-lg font-medium text-foreground">
            No results found
          </p>
          <p className="text-sm text-muted-foreground">
            Try different keywords or adjust your filters.
          </p>
        </div>
      )}
    </div>
  )
}
