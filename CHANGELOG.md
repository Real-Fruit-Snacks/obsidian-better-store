# Changelog

All notable changes to Better Store are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.3.17] - 2026-07-12

### Changed
- Starting a catalog scan now shows a confirmation notice ("catalog scan started…"), so when you launch it from the settings tab — where the header progress bar isn't visible — you get immediate feedback. Clicking scan while one is already running says so instead of doing nothing.

## [0.3.16] - 2026-07-12

### Changed
- The **Scan GitHub** button is now disabled (greyed out) when no token is linked, with a tooltip explaining that a token is required — instead of being clickable and only telling you after the click. It re-enables the moment a token is linked.

## [0.3.15] - 2026-07-12

### Added
- **Full-catalog GitHub scan.** A **Scan GitHub** button in the store header (and a "Scan catalog for GitHub stars & issues" command) fetches stars and open-issue counts for every plugin — one request each — into a persistent cache. It requires a linked token, shows live progress, is cancellable, resumes where it left off, and pauses cleanly at the rate limit. Once scanned you can **sort the whole catalog by GitHub stars or open issues** and filter by **minimum stars**. Managed in settings (with a rescan-freshness control).
- **"Released within" filter** with finer buckets (24 hours / 7 days / 30 days / 3 months / 1 year), replacing the old month-only "Updated" control.

### Changed
- Removed the **"Recently updated" tab** — it was just a sort, and it's available as a sort option on the All tab (sessions that were on it reopen to All).
- Card star counts hide when a repo genuinely has 0 stars, instead of showing "0".

## [0.3.14] - 2026-07-12

### Changed
- **Hardened the internal-API access.** Obsidian's undocumented `app.plugins` and `app.commands` are now shape-checked before use: if a future Obsidian ever changes them, the installed-plugin views degrade to an empty state (with a console warning) instead of throwing during render, and BRAT command hand-offs fail quietly. This came out of a full self-audit of the codebase.
- Catalog-snapshot writes (`history.json`, `known.json`) are serialized through a lock, so two overlapping "refresh" actions can no longer race and drop a trending snapshot or a newly-seen plugin.
- A malformed (non-JSON) GitHub releases response now yields "no release notes" instead of surfacing as a generic error.

## [0.3.13] - 2026-07-12

### Added
- **BRAT beta-plugin panel** on the Installed tab. When [BRAT](https://github.com/TfTHacker/obsidian42-brat) is installed, it lists the beta plugins BRAT tracks (with pinned versions and repo links) and offers one-click **Add beta plugin** and **Check for updates** actions. Consistent with Better Store's core principle, it only *reads* BRAT's list and hands off to BRAT's own commands — it never writes another plugin's files. If BRAT isn't installed, the panel offers a one-click hand-off to install it.

## [0.3.12] - 2026-07-12

### Added
- **Author drill-down** — click an author's name on any card or in the detail pane to see everything they've published. A dismissible bar shows the active author filter.
- **Update controls on the Installed tab** — for any available update you can **Skip this version** (you'll be notified again when a newer one ships) or turn off update checks for a plugin entirely (**Don't check**). A **Mute updates…** control silences all proactive update nags (ribbon badge and notices) for 1 hour up to 1 week; the Installed tab still shows what's available while muted. Skipped versions, disabled plugins, and the mute status are all reviewable in settings.
- **Session restore** — the store reopens to the tab you last had open.

## [0.3.11] - 2026-07-12

### Added
- **GitHub stars on cards** — with a token linked, browse cards show star counts, fetched only for the cards actually on screen (one API request per plugin, cached for the session, halting gracefully if rate-limited). Without a token nothing is fetched, keeping anonymous browsing API-free. Togglable in settings.

## [0.3.10] - 2026-07-12

### Added
- A freshly linked (and valid) GitHub token is put to work immediately: an open detail pane re-fetches its stars / issues / release data — clearing any "GitHub data unavailable" state left by the anonymous rate limit — and the background update check reruns right away so the ribbon badge reflects the raised quota. Pressing Test later just reports; it doesn't retrigger these.

## [0.3.9] - 2026-07-12

### Changed
- Linking a GitHub token secret now verifies it immediately — you get the valid / invalid / rate-limit notice the moment you link, instead of having to press Test yourself. The Test button stays for re-checking later; unlinking stays silent.

## [0.3.8] - 2026-07-12

### Fixed
- The GitHub token setting now uses Obsidian's secret input the way it's designed: you **link a named secret** from Obsidian's secret storage, and the plugin stores only that name — resolving the token when it's needed. Previous versions mistook the linked secret's name for the token itself, which broke GitHub authentication (and the Test button reported "invalid") and created a stray `better-store-github-token` secret holding the name as text.
- Existing setups migrate automatically: a linked-name mixup is re-pointed at the right secret (the stray entry is emptied — feel free to delete it from Settings → Secrets), and a real token migrated from pre-0.3.2 plugin data keeps working where it is.
- The Test button now says when the linked secret no longer exists instead of reporting an anonymous rate limit.

## [0.3.7] - 2026-07-12

### Fixed
- Entering or clearing the GitHub token no longer crashes the settings tab (Obsidian's secret input reports an unset secret as `null`, which the save handler didn't expect). The crash also prevented a freshly entered token from being saved, which made the Test button report the wrong result.

## [0.3.6] - 2026-07-12

### Added
- **Test button** next to the GitHub token setting: verifies the token against the GitHub API (a free endpoint that doesn't consume quota) and reports whether it's valid, expired, or ignored, along with your remaining hourly rate limit. Works without a token too — it then reports the anonymous 60/hour baseline.

### Fixed
- Clicking Test right after typing a token now saves it first (the field's debounced save is flushed), so the test always checks what you just entered.

## [0.3.5] - 2026-07-12

### Fixed
- Detail-pane resizing now works when the store is open in a popout window (pointer listeners were bound to the main window, which never receives the popout's events).
- Arrow-key navigation and infinite scroll also bind to the view's own window/document, fixing the same popout blind spot before anyone hit it.

## [0.3.4] - 2026-07-12

### Added
- "Open the store in" setting: the ribbon icon and commands can open Better Store in a tab, a split, or a whole new window (new window is desktop-only and falls back to a tab on mobile).

## [0.3.3] - 2026-07-12

### Changed
- The tree view's Expand all / Collapse all controls now look like proper buttons instead of faint text, so they're actually discoverable.

## [0.3.2] - 2026-07-12

### Changed
- The GitHub token now lives in **Obsidian's secret storage** (the built-in keychain) instead of plain-text plugin data. Existing tokens migrate automatically on first load and are scrubbed from `data.json`; the settings field uses Obsidian's masked secret input.

## [0.3.1] - 2026-07-12

### Changed
- Removed the last localStorage usage (the one-time UI-state migration shim from 0.2.1); all state now lives exclusively in Obsidian's plugin data. Users upgrading directly from 0.1.x may need to re-pick their layout and detail-pane width once.
- README documents the plugin's privacy posture: clipboard access is write-only (export/copy actions), and network requests go only to the official registry and GitHub.

## [0.3.0] - 2026-07-12

### Added
- **Plugin profiles** — save named enable-sets and switch between them from the Installed tab or the `Apply plugin profile` command; managed in settings.
- **Export / import** — copy the installed-plugin list as a Markdown table or JSON; import an exported list to see what's missing and star the gaps as an install shopping list.
- **Maintenance health chip** in the detail pane (healthy / aging / at-risk, from update recency and release cadence). Togglable.
- **Download-history sparkline** in the detail pane, built from local catalog snapshots. Togglable.
- **Similar plugins** row in the detail pane, from shared categories and keywords. Togglable.
- **Filter presets** — save the sidebar's current filter combination under a name and reapply it from a dropdown; managed in settings.
- Quick jump now ranks **recently viewed** plugins first (togglable).
- **Expand all / Collapse all** tools in the tree view.
- **Copy repository URL** and **copy BRAT string** actions, plus category chips, in the detail pane.
- Skeleton loading cards and a designed empty state with a clear-filters button.
- `svelte-check` as a verification gate in CI, releases, and GitLab pipelines.

### Fixed
- Pre-release versions now compare correctly (`1.0.0-beta` is older than `1.0.0`), so update badges aren't hidden for pre-release users.
- READMEs named `readme.md` or `Readme.md` now load (case-sensitive host fallback).
- The GitHub token field no longer saves on every keystroke (600 ms debounce).

## [0.2.1] - 2026-07-12

### Changed
- Minimum Obsidian version raised to **1.13.0**.
- Settings tab migrated to Obsidian's declarative `getSettingDefinitions` API.
- UI state (layout, detail-pane width, tree expansion) moved from localStorage into plugin data, with one-time migration.
- Releases now ship only `main.js`, `manifest.json`, and `styles.css`, each with GitHub artifact attestations for provenance verification.

### Fixed
- `revealLeaf` is awaited (was flagged as an unsupported-API usage).
- Typed all `JSON.parse`/`loadData` results (no unsafe `any` assignments).

## [0.2.0] - 2026-07-12

### Added
- **Quick jump** — fuzzy `Search plugins` command that opens any plugin's details from anywhere.
- **"New" detection** — badges and a "New only" filter for plugins that entered the registry within 14 days (togglable).
- **Favorites** — star plugins from cards or the detail pane; "Starred only" filter; managed in settings.
- **Keyboard navigation** — arrow keys across the grid and tree, Enter opens, Esc closes the detail pane.
- **Background update check** with a ribbon badge and optional notice (togglable).
- **Bulk enable/disable** on the Installed tab via card selection.
- **Ignore menu** — hide a plugin, everything by an author, or a whole category; all reviewable in settings.
- **Compatibility warning** when a plugin requires a newer Obsidian than yours.
- **Inline release notes** — each release in the detail pane expands to its rendered changelog.

## [0.1.13] - 2026-07-12

### Added
- Tree view remembers expanded folders per sort mode.
- Indent guides connect nested tree rows.

## [0.1.12] - 2026-07-12

### Changed
- Tree folders drop the chevron; the open/closed folder icon alone conveys state.

## [0.1.11] - 2026-07-12

### Changed
- Tree counts sit beside folder labels, the tree caps at a readable column width, and folder icons get deliberate accent/muted roles.

## [0.1.10] - 2026-07-12

### Added
- **Explorer-style tree view** with a grid/tree toggle: folders derive from the active sort (download tiers, recency, A–Z, trending deltas), stale plugins collect under their own folder, and large folders page in lazily.

## [0.1.9] - 2026-07-12

### Fixed
- Installed-tab cards open the detail pane in place instead of jumping tabs.
- Install state refreshes live while the view is open, so native installs are noticed within seconds.

### Changed
- The detail action reads "Install via Community Plugins" until the plugin is actually installed.

## [0.1.8] - 2026-07-12

### Changed
- Sidebar polish: manifest-style section labels, uniform square-cornered category chips, full-width inputs, soft glow on the active tab, thousands separators on counts.

## [0.1.7] - 2026-07-12

### Changed
- Installed view rebuilt as a card grid with on-card enable/disable toggles, update buttons, and changelog links.

## [0.1.6] - 2026-07-12

### Fixed
- Trending without snapshot history now falls back to downloads order everywhere, with a neutral info note instead of an error-styled banner.

## [0.1.5] - 2026-07-12

### Fixed
- The active tab indicator survives themes that restyle buttons.

## [0.1.4] - 2026-07-12

### Fixed
- Tab switches took seconds with the full catalog; the grid now renders incrementally (60 cards, growing on scroll).

## [0.1.3] - 2026-07-12

### Added
- Resizable detail pane (drag its left edge; width persists).
- Installed view: search, updates-only filter, richer rows, native toggles.

### Changed
- The active tab renders as a solid accent pill.

## [0.1.2] - 2026-07-12

### Changed
- All emoji glyphs replaced with Obsidian's Lucide icons.

## [0.1.1] - 2026-07-12

### Fixed
- Svelte component imports were stripped at build time, crashing the store view; the build now fails if a bundled component goes missing.

## [0.1.0] - 2026-07-11

### Added
- Initial release: full-tab community plugin browser with filters, heuristic categories, sorting, rendered README detail pane with GitHub stats, trending from local snapshots, installed-plugins dashboard with update checks and enable/disable, ignore list, and settings.

[0.3.17]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.17
[0.3.16]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.16
[0.3.15]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.15
[0.3.14]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.14
[0.3.13]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.13
[0.3.12]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.12
[0.3.11]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.11
[0.3.10]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.10
[0.3.9]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.9
[0.3.8]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.8
[0.3.7]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.7
[0.3.6]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.6
[0.3.5]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.5
[0.3.4]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.4
[0.3.3]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.3
[0.3.2]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.2
[0.3.1]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.1
[0.3.0]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.3.0
[0.2.1]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.2.1
[0.2.0]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.2.0
[0.1.13]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.13
[0.1.12]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.12
[0.1.11]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.11
[0.1.10]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.10
[0.1.9]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.9
[0.1.8]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.8
[0.1.7]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.7
[0.1.6]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.6
[0.1.5]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.5
[0.1.4]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.4
[0.1.3]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.3
[0.1.2]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.2
[0.1.1]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.1
[0.1.0]: https://github.com/Real-Fruit-Snacks/obsidian-better-store/releases/tag/0.1.0
