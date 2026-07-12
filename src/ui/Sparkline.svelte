<script lang="ts">
  import { formatCount } from "../data/format";

  let { points }: { points: { ts: number; downloads: number }[] } = $props();

  const W = 180;
  const H = 40;
  const PAD = 3;

  let path = $derived.by(() => {
    if (points.length < 2) return "";
    const xs = points.map((p) => p.ts);
    const ys = points.map((p) => p.downloads);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const sx = (x: number) => (maxX === minX ? W / 2 : PAD + ((x - minX) / (maxX - minX)) * (W - PAD * 2));
    const sy = (y: number) => (maxY === minY ? H / 2 : H - PAD - ((y - minY) / (maxY - minY)) * (H - PAD * 2));
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.ts).toFixed(1)},${sy(p.downloads).toFixed(1)}`).join(" ");
  });

  let delta = $derived(points.length >= 2 ? points[points.length - 1].downloads - points[0].downloads : 0);
</script>

{#if points.length >= 2}
  <div class="bs-spark">
    <svg viewBox="0 0 {W} {H}" width={W} height={H} aria-hidden="true">
      <path d={path} fill="none" stroke="var(--interactive-accent)" stroke-width="1.5" />
    </svg>
    <span class="bs-spark-label">
      {delta >= 0 ? "+" : "−"}{formatCount(Math.abs(delta))} downloads across {points.length} snapshots
    </span>
  </div>
{/if}
