// Usage: npm run qc -- briefs/x.yaml   (checks out/<id>.mp4)
// Writes qc/<id>/report.md, report.json, contact.jpg and frames/*.jpg. Exit 1 on any FAIL.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { video } from "../src/brand";
import { durationSeconds } from "../src/brief/timing";
import { validate } from "./lib";

type Check = { name: string; status: "PASS" | "WARN" | "FAIL"; detail: string };

export function qc(briefPath: string): Check[] {
  const { brief, findings } = validate(briefPath);
  const file = `out/${brief.id}.mp4`;
  const dir = `qc/${brief.id}`;
  mkdirSync(dir, { recursive: true });
  const checks: Check[] = [];
  const add = (name: string, ok: boolean | "warn", detail: string) =>
    checks.push({ name, status: ok === "warn" ? "WARN" : ok ? "PASS" : "FAIL", detail });

  // 0. brief compliance (re-checked: the brief may have changed since render)
  const errs = findings.filter((f) => f.level === "error");
  add("brief compliance", errs.length === 0, errs.map((f) => f.message).join("; ") || "no errors");
  for (const w of findings.filter((f) => f.level === "warning")) add(`brief: ${w.rule}`, "warn", w.message);

  // 1. container / stream specs
  const probe = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8" }),
  );
  const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  const a = probe.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
  const [num, den] = String(v.r_frame_rate).split("/").map(Number);
  const fps = num / (den || 1);
  const dur = Number(probe.format.duration);
  const expected = durationSeconds(brief);
  const mb = statSync(file).size / 1e6;
  add("resolution", v.width === video.width && v.height === video.height, `${v.width}x${v.height} (want ${video.width}x${video.height})`);
  add("frame rate", Math.abs(fps - video.fps) < 0.01, `${fps.toFixed(2)} fps`);
  add("codec", v.codec_name === "h264" && v.pix_fmt === "yuv420p" && v.color_range !== "pc", `${v.codec_name} ${v.pix_fmt} ${v.color_range ?? ""} ${v.color_space ?? ""}`);
  add("duration", Math.abs(dur - expected) <= 0.2, `${dur.toFixed(2)} s (brief ${expected.toFixed(2)} s)`);
  add("duration ≤ 90 s (Reels)", dur <= 90, `${dur.toFixed(1)} s`);
  add("file size", mb < 100, `${mb.toFixed(1)} MB`);
  add("audio stream", brief.music ? !!a : true, a ? `${a.codec_name} ${a.sample_rate} Hz` : "none");

  // 2. loudness (EBU R128) target -14 LUFS, true peak ≤ -1 dBTP
  if (a) {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
    const summary = r.stderr.slice(r.stderr.lastIndexOf("Summary:"));
    const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]);
    const tp = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]);
    const programme = !!brief.music || brief.type === "talking-head";
    add("loudness", programme ? I >= -16 && I <= -12 : true, programme ? `${I} LUFS (target -14 ±2)` : `${I} LUFS (sound effects only: no -14 target)`);
    add("true peak", tp <= -0.9, `${tp} dBTP (max -1)`);
  }

  // 3. black / frozen segments
  const det = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-vf", "blackdetect=d=0.4:pix_th=0.06,freezedetect=n=0.002:d=3", "-an", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const blacks = det.match(/black_start:[\d.]+ black_end:[\d.]+/g) ?? [];
  const freezes = det.match(/freeze_start: [\d.]+/g) ?? [];
  add("no black gaps", blacks.length === 0, blacks.join(", ") || "none");
  add("no frozen frames", freezes.length === 0 ? true : "warn", freezes.join(", ") || "none");

  // 4. frames for visual review: 2 per second, safe zones tinted red, + contact sheet
  rmSync(`${dir}/frames`, { recursive: true, force: true });
  mkdirSync(`${dir}/frames`, { recursive: true });
  const s = video.safe;
  const zones = [
    `drawbox=0:0:iw:${s.top}:red@0.12:t=fill`,
    `drawbox=0:ih-${s.bottom}:iw:${s.bottom}:red@0.12:t=fill`,
    `drawbox=${s.left}:${s.top}:iw-${s.left + s.right}:ih-${s.top + s.bottom}:red@0.8:t=4`,
  ].join(",");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", file, "-vf", `fps=2,${zones},scale=540:-2`, "-q:v", "3", `${dir}/frames/f%03d.jpg`]);
  const n = readdirSync(`${dir}/frames`).length;
  const cols = 8;
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", "1", "-i", `${dir}/frames/f%03d.jpg`, "-vf", `scale=270:-2,tile=${cols}x${Math.ceil(n / cols)}:padding=6:color=white`, "-frames:v", "1", "-q:v", "3", `${dir}/contact.jpg`]);
  add("frames extracted", n > 0, `${n} frames → ${dir}/frames, contact sheet → ${dir}/contact.jpg`);

  // report
  const failed = checks.filter((c) => c.status === "FAIL").length;
  const md = [
    `# QC report: ${brief.title}`,
    ``,
    `- Brief: \`${briefPath}\`  · Video: \`${file}\`  · ${new Date().toISOString()}`,
    `- Result: **${failed ? `FAIL (${failed})` : "PASS"}**${brief.demo ? " · DEMO (not for publishing)" : ""}`,
    ``,
    `| Check | Status | Detail |`,
    `|---|---|---|`,
    ...checks.map((c) => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, "/")} |`),
    ``,
    `## Visual review (fill in: visual-qc agent, then a human)`,
    ``,
    `Open \`contact.jpg\` (2 frames/s, red = platform UI). Check: text legible & inside safe area,`,
    `brand colours/fonts, logo not distorted, no overflowing text, before/after unwarped, end card facts correct.`,
    ``,
  ].join("\n");
  writeFileSync(`${dir}/report.md`, md);
  writeFileSync(`${dir}/report.json`, JSON.stringify({ brief: briefPath, file, checks }, null, 2));
  return checks;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run qc -- briefs/x.yaml");
  const checks = qc(file);
  for (const c of checks) console.log(`${c.status.padEnd(4)}  ${c.name}: ${c.detail}`);
  process.exit(checks.some((c) => c.status === "FAIL") ? 1 : 0);
}
