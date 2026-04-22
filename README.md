# Git Trends

A Next.js static site for browsing a weekly GitHub trending digest snapshot.

## Features

- Weekly trending snapshot browsing
- Language filter, sorting, and paginated results
- Snapshot-local repository search by name, description, summary, or tags
- Static JSON data source compatible with `output: "export"`

## Tech Stack

- Next.js App Router
- React 19
- Static JSON snapshot loading on the client
- Tailwind CSS

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Weekly Data Pipeline

The app reads from:

- `public/data/latest-weekly.json`
- `public/data/weekly/<YYYY-MM-DD>.json`

To refresh the weekly snapshot with real GitHub data:

```bash
GITHUB_TOKEN=your_token_here npm run fetch-weekly
```

Notes:

- `GITHUB_TOKEN` is recommended to avoid low unauthenticated rate limits.
- The fetch script writes both the latest snapshot file and a dated archive file.

## Scripts

- `npm run dev` - Start the dev server
- `npm run build` - Build for production
- `npm run start` - Run the production server
- `npm run fetch-weekly` - Fetch the latest weekly GitHub snapshot into static JSON

## Notes

- The frontend does not call `api.github.com` directly.
- GitHub Search API rate limits still apply to the local fetch pipeline.

## License

See `LICENSE`.
