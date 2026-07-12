# Changelog

All notable changes to Better Store are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

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
