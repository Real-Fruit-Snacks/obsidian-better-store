/** A named set of plugins to have enabled; everything else gets disabled. */
export interface PluginProfile {
  name: string;
  pluginIds: string[];
}

export interface ProfileDiff {
  toEnable: string[];
  toDisable: string[];
  /** Profile entries that are not installed (cannot be enabled). */
  missing: string[];
}

/** Compute the enable/disable operations to reach a profile's state.
 * The plugin itself (`selfId`) is never touched — a profile must not
 * disable the tool applying it. */
export function diffProfile(
  profileIds: string[],
  enabled: Set<string>,
  installed: Set<string>,
  selfId: string
): ProfileDiff {
  const target = new Set(profileIds);
  return {
    toEnable: profileIds.filter((id) => id !== selfId && installed.has(id) && !enabled.has(id)),
    toDisable: [...enabled].filter((id) => id !== selfId && installed.has(id) && !target.has(id)),
    missing: profileIds.filter((id) => !installed.has(id)),
  };
}
