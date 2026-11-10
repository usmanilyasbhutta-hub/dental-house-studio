// Usage:
//   npm run render -- briefs/x.yaml                 -> out/<id>.mp4
//   npm run still  -- briefs/x.yaml --frame 90[,150,…] [--safe-zones]  -> qc/<id>/still-90.png
// Refuses to render if the brief fails validation/compliance.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { arg, flag, printFindings, validate } from "./lib";

export async function render(path: string, opts: { still?: number; stills?: number[]; safeZones?: boolean } = {}) {
  const { brief, findings } = validate(path);
  printFindings(path, findings);
  if (findings.some((f) => f.level === "error")) throw new Error("Brief has compliance errors; fix them before rendering.");

  const serveUrl = await bundle({ entryPoint: resolve("src/index.ts"), publicDir: resolve("public") });
  const inputProps = { brief, showSafeZones: !!opts.safeZones };
  const browserExecutable = process.env.REMOTION_BROWSER || undefined;
  // software WebGL (SwiftShader via ANGLE): 3D templates render the same on any machine, GPU or not
  const chromiumOptions = { gl: "swangle" as const };
  const composition = await selectComposition({ serveUrl, id: "Video", inputProps, browserExecutable, chromiumOptions });

  const stills = opts.stills ?? (opts.still !== undefined ? [opts.still] : []);
  if (stills.length) {
    mkdirSync(`qc/${brief.id}`, { recursive: true });
    let output = "";
    for (const f of stills) {
      output = `qc/${brief.id}/still-${f}${opts.safeZones ? "-safe" : ""}.png`;
      await renderStill({ composition, serveUrl, output, frame: f, inputProps, browserExecutable, chromiumOptions });
      console.log(`still → ${output}`);
    }
    return output;
  }

  mkdirSync("out", { recursive: true });
  const raw = `out/${brief.id}.raw.mp4`;
  const output = `out/${brief.id}.mp4`;
  let last = -1;
  await renderMedia({
    composition, serveUrl, codec: "h264", pixelFormat: "yuv420p", crf: 18, audioBitrate: "192k",
    outputLocation: raw, inputProps, browserExecutable, chromiumOptions,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== last) { last = p; process.stdout.write(`${p * 10}% `); }
    },
  });
  master(raw, output, !!brief.music);
  console.log(`\nvideo → ${output}`);
  return output;
}

/**
 * Mastering: H.264 yuv420p, TV range, BT.709 tags (what Instagram/TikTok expect), +faststart.
 * Audio loudness-normalised to -14 LUFS / -1.5 dBTP.
 */
function master(raw: string, output: string, hasAudio: boolean) {
  const v = ["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-vf", "scale=in_range=full:out_range=tv",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"];
  const a = hasAudio ? ["-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k"] : ["-an"];
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", raw, ...v, ...a, "-movflags", "+faststart", output]);
  rmSync(raw);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv.slice(2).find((a) => /\.ya?ml$/.test(a));
  if (!file) throw new Error("Pass a brief file, e.g. npm run render -- briefs/x.yaml");
  // --frame 90 (one) or --frame 10,60,120 (several stills from one bundle)
  const stills = flag("still") ? String(arg("frame") ?? 45).split(",").map(Number) : undefined;
  render(file, { stills, safeZones: flag("safe-zones") }).catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
