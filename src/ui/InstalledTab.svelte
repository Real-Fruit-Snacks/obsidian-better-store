<script lang="ts">
  import { onMount } from "svelte";
  import { Notice } from "obsidian";
  import type BetterStorePlugin from "../main";
  import type { PluginEntry } from "../data/types";
  import { buildInstalledInfo, type InstalledInfo } from "../data/installed";
  import type { PluginProfile } from "../data/profiles";
  import { formatAge } from "../data/format";
  import { isUpdateActionable, muteRemaining, MUTE_OPTIONS, type MuteDuration } from "../data/updates";
  import { parseBratPlugins, BRAT_COMMANDS, BRAT_PLUGIN_ID, type BratBetaPlugin } from "../data/brat";
  import { getPluginsApi, getBratStatus, runCommand } from "./store-context";
  import { NameModal } from "./modals";
  import Icon from "./Icon.svelte";

  let {
    plugin,
    entries,
    onSelect,
  }: {
    plugin: BetterStorePlugin;
    entries: PluginEntry[];
    onSelect: (entry: PluginEntry) => void;
  } = $props();

  let infos = $state<InstalledInfo[]>([]);
  let checking = $state(true);
  let toggleError = $state<string | null>(null);
  let query = $state("");
  let updatesOnly = $state(false);
  let selectedIds = $state<Set<string>>(new Set());
  let bulkBusy = $state(false);

  const api = getPluginsApi(plugin.app);
  const byId = $derived(new Map(entries.map((e) => [e.id, e])));

  /** Bumped when update prefs change so derived values re-read plugin.settings. */
  let prefsTick = $state(0);

  /** An update the user hasn't skipped, ignored, or that a newer version superseded. */
  function actionable(info: InstalledInfo): boolean {
    void prefsTick;
    return (
      info.updateAvailable &&
      info.latestVersion != null &&
      isUpdateActionable(info.id, info.latestVersion, plugin.updatePrefs())
    );
  }

  let updateCount = $derived.by(() => {
    void prefsTick;
    return infos.filter(actionable).length;
  });

  let muteLabel = $derived.by(() => {
    void prefsTick;
    return muteRemaining(plugin.updatePrefs(), Date.now());
  });

  let visible = $derived.by(() => {
    void prefsTick;
    const q = query.trim().toLowerCase();
    const filtered = infos.filter(
      (i) =>
        (!updatesOnly || actionable(i)) &&
        (q === "" || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    );
    // Actionable updates float to the top; everything else stays alphabetical.
    return filtered.sort(
      (a, b) => Number(actionable(b)) - Number(actionable(a)) || a.name.localeCompare(b.name)
    );
  });

  async function skipUpdate(info: InstalledInfo): Promise<void> {
    if (info.latestVersion == null) return;
    await plugin.skipUpdate(info.id, info.latestVersion);
    prefsTick += 1;
  }

  async function ignoreUpdates(info: InstalledInfo): Promise<void> {
    await plugin.ignorePluginUpdates(info.id);
    prefsTick += 1;
  }

  async function muteUpdates(choice: MuteDuration): Promise<void> {
    await plugin.muteUpdates(choice);
    prefsTick += 1;
  }

  async function unmuteUpdates(): Promise<void> {
    await plugin.unmuteUpdates();
    prefsTick += 1;
  }

  // BRAT (beta plugin manager) integration — read-only listing plus hand-off to
  // BRAT's own commands. Better Store never writes BRAT's files.
  let brat = $state(getBratStatus(plugin.app));
  let betaPlugins = $state<BratBetaPlugin[]>([]);

  async function loadBrat(): Promise<void> {
    brat = getBratStatus(plugin.app);
    betaPlugins = brat.enabled ? parseBratPlugins(await plugin.readBratData()) : [];
  }

  onMount(() => void loadBrat());

  function runBrat(commandId: string): void {
    runCommand(plugin.app, commandId);
    // BRAT commands may open a modal or update in the background; refresh the
    // list shortly after so newly added/updated betas appear.
    window.setTimeout(() => void loadBrat(), 1500);
  }

  function installBrat(): void {
    window.open(`obsidian://show-plugin?id=${BRAT_PLUGIN_ID}`);
  }

  let lastLatest: Record<string, string | null> = {};

  function rebuild(latestVersions: Record<string, string | null>): void {
    infos = buildInstalledInfo(api.manifests, new Set(api.enabledPlugins), entries, latestVersions, Date.now());
  }

  onMount(async () => {
    rebuild({});
    const latest: Record<string, string | null> = {};
    await Promise.all(
      infos
        .filter((i) => i.repo != null && i.id !== plugin.manifest.id)
        .map(async (i) => {
          latest[i.id] = await plugin.service.getLatestVersion(i.repo as string);
        })
    );
    lastLatest = latest;
    rebuild(latest);
    checking = false;
  });

  // No Obsidian event fires for installs/uninstalls/toggles done elsewhere
  // (native dialog, another device syncing config) — poll while the tab is open.
  onMount(() => {
    const poll = window.setInterval(() => {
      const ids = Object.keys(api.manifests);
      const changed =
        ids.length !== infos.length ||
        ids.some((id) => !infos.some((i) => i.id === id)) ||
        infos.some((i) => i.enabled !== api.enabledPlugins.has(i.id));
      if (changed) rebuild(lastLatest);
      const s = getBratStatus(plugin.app);
      if (s.installed !== brat.installed || s.enabled !== brat.enabled) void loadBrat();
    }, 2000);
    return () => window.clearInterval(poll);
  });

  async function toggle(info: InstalledInfo): Promise<void> {
    if (info.id === plugin.manifest.id) return;
    toggleError = null;
    try {
      if (info.enabled) await api.disablePluginAndSave(info.id);
      else await api.enablePluginAndSave(info.id);
    } catch (e) {
      toggleError = `Could not toggle ${info.name}: ${e instanceof Error ? e.message : String(e)}`;
    }
    infos = infos.map((i) => (i.id === info.id ? { ...i, enabled: api.enabledPlugins.has(i.id) } : i));
  }

  function openNative(id: string): void {
    window.open(`obsidian://show-plugin?id=${encodeURIComponent(id)}`);
  }

  let profileNames = $state(plugin.settings.profiles.map((p) => p.name));

  function saveProfile(): void {
    new NameModal(plugin.app, "Save plugin profile", (name) => {
      const pluginIds = [...api.enabledPlugins].filter((id) => id !== plugin.manifest.id && id in api.manifests);
      const withoutSameName = plugin.settings.profiles.filter((p) => p.name !== name);
      plugin.settings.profiles = [...withoutSameName, { name, pluginIds }];
      void plugin.saveSettings();
      profileNames = plugin.settings.profiles.map((p) => p.name);
      new Notice(`Profile "${name}" saved (${pluginIds.length} plugins).`);
    }).open();
  }

  async function applyProfileByName(name: string): Promise<void> {
    const profile: PluginProfile | undefined = plugin.settings.profiles.find((p) => p.name === name);
    if (!profile) return;
    await plugin.applyProfile(profile);
    rebuild(lastLatest);
  }

  function toggleSelect(id: string): void {
    if (id === plugin.manifest.id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  async function bulkToggle(enable: boolean): Promise<void> {
    bulkBusy = true;
    toggleError = null;
    try {
      for (const id of selectedIds) {
        if (id === plugin.manifest.id) continue;
        const isEnabled = api.enabledPlugins.has(id);
        if (enable && !isEnabled) await api.enablePluginAndSave(id);
        if (!enable && isEnabled) await api.disablePluginAndSave(id);
      }
    } catch (e) {
      toggleError = `Bulk toggle stopped: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      bulkBusy = false;
      selectedIds = new Set();
      rebuild(lastLatest);
    }
  }
</script>

<div class="bs-installed">
  <div class="bs-installed-toolbar">
    <input
      type="search"
      class="bs-installed-search"
      placeholder="Filter installed plugins…"
      aria-label="Filter installed plugins"
      bind:value={query}
    />
    <button
      class="bs-chip"
      class:bs-chip-active={updatesOnly}
      onclick={() => (updatesOnly = !updatesOnly)}
    >
      Updates{#if !checking}&nbsp;({updateCount}){/if}
    </button>
    {#if profileNames.length > 0}
      <select
        class="dropdown bs-profile-select"
        aria-label="Apply plugin profile"
        onchange={(e) => {
          const name = e.currentTarget.value;
          e.currentTarget.value = "";
          void applyProfileByName(name);
        }}
      >
        <option value="" selected disabled>Profiles…</option>
        {#each profileNames as name (name)}<option value={name}>{name}</option>{/each}
      </select>
    {/if}
    <button class="bs-chip" title="Save the currently enabled plugins as a profile" onclick={saveProfile}>
      Save profile
    </button>
    {#if muteLabel}
      <button class="bs-chip bs-chip-active" title="Update notices are muted" onclick={() => void unmuteUpdates()}>
        <Icon name="bell-off" />Muted ({muteLabel}) · Unmute
      </button>
    {:else}
      <select
        class="dropdown bs-mute-select"
        aria-label="Mute update notices"
        onchange={(e) => {
          const choice = e.currentTarget.value as MuteDuration;
          e.currentTarget.value = "";
          if (choice) void muteUpdates(choice);
        }}
      >
        <option value="" selected disabled>Mute updates…</option>
        {#each MUTE_OPTIONS as opt (opt.value)}<option value={opt.value}>{opt.label}</option>{/each}
      </select>
    {/if}
    {#if selectedIds.size > 0}
      <span class="bs-bulk-actions">
        <span class="bs-bulk-count">{selectedIds.size} selected</span>
        <button class="bs-bulk-btn" disabled={bulkBusy} onclick={() => void bulkToggle(true)}>Enable</button>
        <button class="bs-bulk-btn" disabled={bulkBusy} onclick={() => void bulkToggle(false)}>Disable</button>
        <button class="bs-bulk-btn bs-bulk-clear" disabled={bulkBusy} onclick={() => (selectedIds = new Set())}>Clear</button>
      </span>
    {/if}
    <span class="bs-installed-summary">
      {#if checking}
        Checking for updates…
      {:else}
        {infos.length} installed · {updateCount} {updateCount === 1 ? "update" : "updates"} available
      {/if}
    </span>
  </div>

  {#if toggleError}
    <div class="bs-status bs-error">{toggleError}</div>
  {/if}

  <details class="bs-brat">
    <summary>
      <Icon name="flask-conical" />
      <span>Beta plugins (BRAT)</span>
      {#if brat.enabled}<span class="bs-brat-count">{betaPlugins.length}</span>{/if}
    </summary>
    <div class="bs-brat-body">
      {#if !brat.installed}
        <p>BRAT installs and auto-updates plugins straight from GitHub, before they reach the community store. Better Store hands off to BRAT — it never manages beta files itself.</p>
        <button class="bs-chip" onclick={installBrat}><Icon name="download" />Install BRAT</button>
      {:else if !brat.enabled}
        <p>BRAT is installed but disabled. Enable it to manage beta plugins here.</p>
      {:else}
        <div class="bs-brat-actions">
          <button class="bs-chip" onclick={() => runBrat(BRAT_COMMANDS.addBetaPlugin)}><Icon name="plus" />Add beta plugin</button>
          <button class="bs-chip" onclick={() => runBrat(BRAT_COMMANDS.checkAndUpdate)}><Icon name="refresh-cw" />Check for updates</button>
          <button class="bs-chip" title="Reload the BRAT list" onclick={() => void loadBrat()}><Icon name="rotate-cw" />Refresh</button>
        </div>
        {#if betaPlugins.length === 0}
          <p class="bs-brat-empty">No beta plugins tracked yet. Use "Add beta plugin" to start testing one from GitHub.</p>
        {:else}
          <ul class="bs-brat-list">
            {#each betaPlugins as bp (bp.repo)}
              <li>
                <a href={`https://github.com/${bp.repo}`} target="_blank" rel="noopener">{bp.repo}</a>
                {#if bp.frozenVersion}<span class="bs-badge">pinned v{bp.frozenVersion}</span>{/if}
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  </details>

  <div class="bs-grid bs-installed-grid">
    {#each visible as info (info.id)}
      {@const entry = byId.get(info.id)}
      <div
        class="bs-card bs-installed-card"
        class:bs-installed-off={!info.enabled}
        role={entry ? "button" : undefined}
        tabindex={entry ? 0 : undefined}
        onclick={entry ? () => onSelect(entry) : undefined}
        onkeydown={entry
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(entry);
              }
            }
          : undefined}
      >
        <div class="bs-card-top">
          {#if info.id !== plugin.manifest.id}
            <input
              type="checkbox"
              class="bs-select"
              class:bs-select-active={selectedIds.has(info.id)}
              aria-label={`Select ${info.name} for bulk actions`}
              checked={selectedIds.has(info.id)}
              onclick={(e) => e.stopPropagation()}
              onchange={() => toggleSelect(info.id)}
            />
          {/if}
          <span class="bs-card-name">{info.name}</span>
          {#if info.abandoned}
            <span class="bs-badge bs-badge-warn" title="No update in over a year">stale</span>
          {/if}
          <div
            class="checkbox-container bs-installed-toggle"
            class:is-enabled={info.enabled}
            class:bs-toggle-locked={info.id === plugin.manifest.id}
            role="switch"
            aria-checked={info.enabled}
            aria-label={`Enable ${info.name}`}
            tabindex={info.id === plugin.manifest.id ? -1 : 0}
            title={info.id === plugin.manifest.id ? "Better Store cannot disable itself" : info.enabled ? "Disable" : "Enable"}
            onclick={(e) => {
              e.stopPropagation();
              void toggle(info);
            }}
            onkeydown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void toggle(info);
              }
            }}
          >
            <input type="checkbox" tabindex="-1" checked={info.enabled} disabled={info.id === plugin.manifest.id} />
          </div>
        </div>

        <div class="bs-card-meta">
          <span>v{info.version}</span>
          <span>{info.updated ? `updated ${formatAge(info.updated, Date.now())}` : "not in catalog"}</span>
        </div>

        {#if entry}
          <p class="bs-card-desc">{entry.description}</p>
        {/if}

        <div class="bs-installed-actions">
          {#if actionable(info)}
            <button
              class="bs-update-btn"
              title="Open in Community Plugins to update"
              onclick={(e) => {
                e.stopPropagation();
                openNative(info.id);
              }}
            >
              <Icon name="arrow-up" />Update to {info.latestVersion}
            </button>
            <button
              class="bs-update-skip"
              title={`Skip v${info.latestVersion} — you'll be notified again on the next version`}
              onclick={(e) => {
                e.stopPropagation();
                void skipUpdate(info);
              }}
            >
              Skip this version
            </button>
            <button
              class="bs-update-skip"
              title="Never check this plugin for updates"
              onclick={(e) => {
                e.stopPropagation();
                void ignoreUpdates(info);
              }}
            >
              Don't check
            </button>
          {/if}
          {#if info.repo}
            <a
              class="bs-installed-changelog"
              href={`https://github.com/${info.repo}/releases`}
              target="_blank"
              rel="noopener"
              title="Changelog"
              aria-label={`Changelog for ${info.name}`}
              onclick={(e) => e.stopPropagation()}
            >
              <Icon name="scroll-text" />
            </a>
          {/if}
        </div>
      </div>
    {:else}
      <div class="bs-status">
        {updatesOnly ? "Everything is up to date." : "No installed plugins match."}
      </div>
    {/each}
  </div>
</div>
