import { Info, TrendingUp, Search, Globe, Zap } from "lucide-react"

export const metadata = {
  title: "About - GitTrends",
  description:
    "GitTrends helps developers discover trending open-source projects on GitHub.",
}

const features = [
  {
    icon: TrendingUp,
    title: "Weekly Discovery",
    description:
      "Browse a curated weekly snapshot of fast-rising repositories to stay on top of what the community is building.",
  },
  {
    icon: Search,
    title: "Snapshot Search",
    description:
      "Search within each weekly snapshot using repository names, descriptions, summaries, tags, and language filters.",
  },
  {
    icon: Globe,
    title: "Language Filtering",
    description:
      "Filter snapshot results by programming language to find projects in your tech stack faster.",
  },
  {
    icon: Zap,
    title: "Snapshot Pipeline",
    description:
      "Trending data is collected by a backend pipeline and published as static JSON for a fast, reliable browsing experience.",
  },
]

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Info className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            About GitTrends
          </h1>
        </div>
        <p className="text-muted-foreground">
          Discover what the developer community is building.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            GitTrends is a free, open-source tool that helps developers discover
            weekly trending repositories on GitHub. Whether you are looking for
            inspiration, staying up to date with the latest tools, or scanning
            for projects in a specific stack, GitTrends makes it easy to browse
            a curated weekly digest of what is getting traction in open source.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">Features</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            How It Works
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            GitTrends uses a weekly snapshot pipeline to collect trending
            repository data from GitHub, normalize it into a static JSON
            dataset, and publish that dataset for the frontend to browse. The
            site focuses on a single weekly cadence in this MVP so the browsing
            experience stays fast and predictable.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Disclaimer</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            GitTrends is not affiliated with, endorsed by, or sponsored by
            GitHub, Inc. Repository metadata originates from publicly available
            GitHub data and is republished here as a curated weekly snapshot.
            GitHub and the GitHub logo are trademarks of GitHub, Inc.
          </p>
        </section>
      </div>
    </div>
  )
}
