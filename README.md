# Better Store

A polished community plugin browser for [Obsidian](https://obsidian.md) — the browsing experience the default one lacks.

## Features

- **Full workspace tab** — browse in a real tab with a filter sidebar, card grid, and detail pane.
- **Filters & sorting** — search, heuristic categories, "updated within", minimum downloads, hide installed, sort by downloads / recency / name / trending.
- **Rich details** — rendered README with images, GitHub stars & open issues, recent releases, funding links.
- **Trending** — local download-delta tracking (builds up as you use the plugin; no external service).
- **Installed dashboard** — versions vs. latest, update badges, enable/disable toggles, staleness warnings, changelog links.
- **Ignore list** — hide plugins you never want to see again.

## What it deliberately does NOT do

Better Store never installs, updates, or removes plugin files itself. Install actions open the plugin's page in Obsidian's native Community Plugins dialog.

## Settings

- **GitHub token** (optional) — raises the GitHub API rate limit for stars/issues/releases data. A classic token with no scopes is enough.
- **Cache lifetime** — how long the catalog is cached (default 12 h). Manual refresh available in the store header.
- **Default sort / hide installed** — your preferred starting state.

## Notes

- Categories are heuristic (keyword-based) since the official registry has none — expect occasional misfiles.
- Enable/disable uses an internal Obsidian API; if a future Obsidian update changes it, those toggles may stop working until this plugin updates. Everything else is unaffected.

## Development

```
npm install
npm run dev     # watch build
npm test        # unit tests
npm run build   # production build
```

Junction/symlink the repo into a test vault's `.obsidian/plugins/better-store` and enable it.
