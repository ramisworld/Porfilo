/**
 * Writes static favicon files from the shared SVG source in src/lib/porfilo-mark-string.ts.
 * Run via `pnpm icons:sync` (also invoked from engine:build).
 */
import { buildSync } from "esbuild";
import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const tmp = join(root, ".tmp-sync-icons.mjs");

buildSync({
  entryPoints: [join(root, "scripts/sync-brand-icons-entry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: tmp,
});

await import(pathToFileURL(tmp).href);
unlinkSync(tmp);
