function splitPrerelease(v: string): [string, string | null] {
  const i = v.indexOf("-");
  return i === -1 ? [v, null] : [v.slice(0, i), v.slice(i + 1)];
}

/** Compare dotted numeric versions with basic semver pre-release ordering
 * (`1.0.0-beta` < `1.0.0`). Non-numeric core segments count as 0. */
export function compareVersions(a: string, b: string): number {
  const [coreA, preA] = splitPrerelease(a);
  const [coreB, preB] = splitPrerelease(b);
  const pa = coreA.split(".").map((s) => parseInt(s, 10) || 0);
  const pb = coreB.split(".").map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  if (preA === null && preB === null) return 0;
  if (preA === null) return 1;
  if (preB === null) return -1;
  return preA < preB ? -1 : preA > preB ? 1 : 0;
}
