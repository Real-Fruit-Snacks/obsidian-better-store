[![Better Store — the community plugin browser, polished](docs/assets/banner.svg)](docs/assets/banner.svg)

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-63f2ab?style=flat-square)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/Real-Fruit-Snacks/obsidian-better-store?style=flat-square&color=63f2ab)](https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/latest)
[![Obsidian 1.5.0+](https://img.shields.io/badge/Obsidian-1.5.0%2B-6bdcff?style=flat-square)](https://obsidian.md)
[![CI](https://img.shields.io/github/actions/workflow/status/Real-Fruit-Snacks/obsidian-better-store/ci.yml?style=flat-square&label=CI)](https://github.com/Real-Fruit-Snacks/obsidian-better-store/actions/workflows/ci.yml)

**[Documentation site](https://real-fruit-snacks.github.io/obsidian-better-store/)** · **[Latest release](https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/latest)**

</div>

## Overview

Better Store is an [Obsidian](https://obsidian.md) plugin that replaces day-to-day use of the built-in community plugin browser. It opens as a full workspace tab with real filters, heuristic categories, rendered README previews, GitHub stats, a trending view, and a dashboard for the plugins you already have installed.

It deliberately does **not** install, update, or remove plugin files itself — install actions hand off to Obsidian's native Community Plugins dialog, so nothing about your vault's security model changes.

## Features

- **Full workspace tab** — a filter sidebar, card grid, and detail pane instead of a cramped modal. Stays open while you work.
- **Filters & sorting** — search across name/author/description, category chips, "updated within", minimum downloads, hide installed; sort by downloads, recency, name, or trending.
- **Heuristic categories** — Tasks, Sync & Backup, AI, Appearance, Editor, Export & Import, Calendar & Time, Data & Queries, Files & Organization, Publishing & Sharing, Integrations. The official registry has no categories, so these are keyword-derived — imperfect by design and easy to refine.
- **Rich details** — rendered README with images (sanitized), GitHub stars and open issues, recent releases, and funding links, fetched lazily and cached.
- **Trending** — local download-delta tracking across catalog refreshes. Builds up as you use the plugin; no external service, no telemetry.
- **Installed dashboard** — current vs. latest version, update badges, enable/disable toggles, "stale" warnings for plugins unmaintained for a year+, changelog links.
- **Ignore list** — hide plugins you never want to see again.

## Installation

### Manual

1. Download `better-store-x.y.z.zip` from the [latest release](https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/latest).
2. Extract it into `YourVault/.obsidian/plugins/` (it contains the `better-store/` folder with `main.js`, `manifest.json`, `styles.css`, `versions.json`).
3. Settings → Community plugins → enable **Better Store**.

### Via BRAT

Add `Real-Fruit-Snacks/obsidian-better-store` as a beta plugin in [BRAT](https://github.com/TfTHacker/obsidian42-brat).

## Getting Started

Open the store from the ribbon icon or the command palette (`Better Store: Open store`).

### Commands

| Command | Action |
| --- | --- |
| `Better Store: Open store` | Opens (or reveals) the store tab |

### Settings

| Setting | Default | What it does |
| --- | --- | --- |
| GitHub token | — | Optional. Raises the GitHub API rate limit (60/hr without) used for stars, issues, and releases. A classic token with **no scopes** is enough. Stored in plain text in the plugin's `data.json`, so it travels with vault sync/backups — omit it on vaults you sync somewhere you don't trust. |
| Cache lifetime | 12 h | How long the plugin catalog is cached. Manual refresh in the store header. |
| Default sort | Downloads | Downloads, recently updated, name, or trending. |
| Hide installed by default | Off | Start browsing with installed plugins hidden. |
| Ignored plugins | — | Review and un-ignore anything you've hidden. |

## How It Works

- The catalog comes from the official `obsidianmd/obsidian-releases` registry and stats files. The multi-megabyte stats file is slimmed to totals + last-updated timestamps and cached inside the plugin's own folder.
- Detail-view data (README, stars, releases) is fetched lazily per plugin — READMEs from `raw.githubusercontent.com` (no rate limit), API data from GitHub with your optional token.
- Trending compares download counts across your own catalog refreshes (snapshots kept locally, capped at 30).
- READMEs are third-party content: they're rendered through Obsidian's `MarkdownRenderer` and then passed through Obsidian's DOMPurify-backed sanitizer as defense in depth. Funding links are only accepted with `http(s)` schemes.
- Enable/disable toggles use an internal Obsidian API (the same one used by well-known plugin managers). If a future Obsidian update changes it, those toggles may stop working until this plugin updates — everything else is unaffected.

## Architecture

```
src/
├── main.ts              plugin entry: settings, service wiring, view registration
├── view.ts              ItemView hosting the Svelte root
├── settings.ts          settings tab
├── data/                pure, fully unit-tested modules (no Obsidian imports)
│   ├── registry.ts      registry parsing + stats slimming
│   ├── categories.ts    keyword → category heuristics
│   ├── filter.ts        filter/sort engine
│   ├── trending.ts      download-delta snapshots
│   ├── service.ts       fetch + cache orchestration (IO injected)
│   ├── installed.ts     installed-plugin status
│   └── ...              versions, readme URL rewriting, formatting
└── ui/                  Svelte 5 components
    ├── StoreView.svelte tabs, state, wiring
    ├── FilterSidebar / PluginCard / DetailPane / InstalledTab
    └── store-context.ts typed access to Obsidian internals
```

## Self-hosting & Offline

Every release includes an **offline bundle** (`better-store-x.y.z-offline-bundle.zip`): the full source tree, a prebuilt `main.js`, and a `.gitlab-ci.yml` so the project can be hosted and built on a self-hosted or air-gapped GitLab instance. The GitLab pipeline needs only a local `node:20` image (plus an npm mirror if the instance has no internet) and publishes the same artifacts and Pages site.

## Development

```bash
npm install
npm run dev     # watch build
npm run check   # type check
npm test        # unit tests (47)
npm run build   # production build
```

Junction/symlink the repo into a test vault's `.obsidian/plugins/better-store` and enable it.

## License

[MIT](LICENSE)
