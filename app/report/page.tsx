"use client"

import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import { FileText } from "lucide-react"

interface WeeklyReport {
  snapshot_date: string
  generated_at: string
  model?: string
  error?: boolean
  report_markdown: string | null
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || ""

export default function ReportPage() {
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadReport() {
      try {
        const response = await fetch(`${BASE_PATH}/data/reports/latest.json`)

        if (!response.ok) {
          throw new Error("Failed to load weekly report.")
        }

        const data = (await response.json()) as WeeklyReport

        if (!cancelled) {
          setReport(data)
        }
      } catch {
        if (!cancelled) {
          setReport(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadReport()

    return () => {
      cancelled = true
    }
  }, [])

  const hasReport = Boolean(report?.report_markdown) && !report?.error

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Weekly Report
          </h1>
        </div>
        <p className="text-muted-foreground">
          {report?.snapshot_date
            ? `Snapshot date: ${report.snapshot_date}`
            : "AI-generated weekly analysis of the latest trending snapshot."}
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading weekly report...
        </div>
      ) : hasReport ? (
        <article className="prose prose-invert max-w-none rounded-lg border border-border bg-card p-6 prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
          <ReactMarkdown>{report?.report_markdown ?? ""}</ReactMarkdown>
        </article>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          本周报告生成中，请稍后刷新。
        </div>
      )}
    </div>
  )
}
