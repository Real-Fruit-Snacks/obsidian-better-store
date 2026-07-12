// Guards against the svelte-preprocess/TypeScript pitfall where component
// imports used only in markup are elided from the bundle (requires
// verbatimModuleSyntax). Run after `npm run build`.
import { readFileSync, readdirSync } from "node:fs";

const bundle = readFileSync("main.js", "utf8");
const components = readdirSync("src/ui")
  .filter((f) => f.endsWith(".svelte"))
  .map((f) => f.replace(".svelte", ""));

const missing = components.filter((name) => {
  const referenced = new RegExp(`\\b${name}\\s*\\(`).test(bundle);
  const defined = new RegExp(`function ${name}\\b|var ${name}\\b|${name} = `).test(bundle);
  return referenced && !defined;
});

if (missing.length > 0) {
  console.error(`Bundle references undefined component(s): ${missing.join(", ")}`);
  console.error("Their imports were stripped at build time (see tsconfig verbatimModuleSyntax).");
  process.exit(1);
}
console.log(`bundle ok: ${components.length} Svelte components accounted for`);
