import { Shield } from "lucide-react"

export const metadata = {
  title: "Privacy Policy - GitTrends",
  description:
    "Learn how GitTrends handles your data and respects your privacy.",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Shield className="h-5 w-5 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            Privacy Policy
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Last updated: February 6, 2026
        </p>
      </div>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Information We Collect
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            GitTrends does not require user accounts and does not ask visitors
            to submit personal information in order to browse weekly trending
            snapshots.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Repository Data
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Repository metadata displayed on GitTrends is collected by a backend
            pipeline on a scheduled basis and published as static snapshot
            files. The frontend does not directly request third-party GitHub
            APIs from your browser while you browse the site.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Cookies</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            GitTrends does not use cookies or persistent local storage to create
            user profiles. Temporary UI state such as active filters may exist
            only for the current page session.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Third-Party Services
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Our application may be hosted on platforms that collect standard web
            server logs (IP addresses, browser type, pages visited) for
            operational purposes. These logs are handled by the hosting
            provider{"'"}s privacy policy. We may also use analytics or
            advertising integrations that are configured at the site level
            rather than through direct GitHub API calls.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Changes to This Policy
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may update this privacy policy from time to time. Any changes
            will be reflected on this page with an updated revision date.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            If you have any questions about this privacy policy, please open an
            issue on our GitHub repository.
          </p>
        </section>
      </div>
    </div>
  )
}
