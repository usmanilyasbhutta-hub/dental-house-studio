// Render one or more frames for several briefs from ONE bundle (fast visual checks of many examples).
// Usage: npx tsx scripts/stills-many.ts <outDir> <frame|"end"> <brief.yaml>…   ("end" = last body frame before the end card)
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { loadBrief } from "../src/brief/load";
import { durationSeconds } from "../src/brief/timing";

const [outDir, which, ...files] = process.argv.slice(2);
if (!outDir || !which || !files.length) throw new Error("usage: stills-many.ts <outDir> <frame|end> <brief…>");
const browserExecutable = process.env.REMOTION_BROWSER || undefined;
const chromiumOptions = { gl: "swangle" as const };
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), publicDir: resolve("public") });
for (const f of files) {
  const brief = loadBrief(f);
  const inputProps = { brief };
  const composition = await selectComposition({ serveUrl, id: "Video", inputProps, browserExecutable, chromiumOptions });
  const frame = which === "end" ? Math.round((durationSeconds(brief) - 4.5) * 30) - 8 : Number(which);
  const output = `${outDir}/${brief.id}.png`;
  await renderStill({ composition, serveUrl, output, frame, inputProps, browserExecutable, chromiumOptions });
  console.log("still →", output);
}
