// Render several stills of any composition from ONE bundle (fast checks).
// Usage: npx tsx scripts/stills.ts <CompositionId> <outDir> <frame> [frame…]
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [id, outDir, ...frames] = process.argv.slice(2);
if (!id || !outDir || !frames.length) throw new Error("usage: stills.ts <CompositionId> <outDir> <frame…>");
const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const chromiumOptions = { gl: "swangle" as const };
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), publicDir: resolve("public") });
const composition = await selectComposition({ serveUrl, id, inputProps: {}, browserExecutable, chromiumOptions });
for (const f of frames.map(Number)) {
  const output = `${outDir}/${id}-${f}.png`;
  await renderStill({ composition, serveUrl, output, frame: f, browserExecutable, chromiumOptions });
  console.log("still →", output);
}
