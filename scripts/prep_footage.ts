// Usage: npm run prep -- briefs/<talking-head>.yaml
// Builds public/footage/<id>.webm (cut-out speaker + speech) and public/footage/<id>.words.json (word timings).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { footagePaths, segmentsOf, type Word } from "../src/brief/schema";
import { printFindings, validate } from "./lib";

/** SRT (source seconds) → words relative to the trim; time spread inside each cue by character length. */
export function srtToWords(srt: string, trimStart: number, trimEnd: number): Word[] {
  const ts = (s: string) => {
    const [h, m, rest] = s.split(":");
    return Number(h) * 3600 + Number(m) * 60 + Number(rest.replace(",", "."));
  };
  const words: Word[] = [];
  for (const block of srt.replace(/\r/g, "").split(/\n\n+/)) {
    const lines = block.trim().split("\n");
    const tl = lines.find((l) => l.includes("-->"));
    if (!tl) continue;
    const [a, b] = tl.split("-->").map((x) => ts(x.trim()));
    if (b <= trimStart || a >= trimEnd) continue;
    const text = lines.slice(lines.indexOf(tl) + 1).join(" ").split(/\s+/).filter(Boolean);
    const weights = text.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.5);
    const total = weights.reduce((x, y) => x + y, 0);
    let t = a;
    text.forEach((w, i) => {
      const d = ((b - a) * weights[i]) / total;
      if (t >= trimStart && t + d <= trimEnd + 0.05)
        words.push({ text: w, start: +(t - trimStart).toFixed(3), end: +(t + d - trimStart).toFixed(3) });
      t += d;
    });
  }
  return words;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  const { brief, findings } = validate(file);
  printFindings(file, findings);
  if (brief.type !== "talking-head") throw new Error("prep is only for talking-head briefs");
  if (findings.some((f) => f.level === "error")) process.exit(1);
  const paths = footagePaths(brief.id);
  mkdirSync("public/footage", { recursive: true });

  const srt = readFileSync(brief.transcript, "utf8");
  const segs = segmentsOf(brief);
  let words: Word[];
  if (brief.transcript_timebase === "edit") {
    words = srtToWords(srt, 0, 1e9);
  } else {
    // map each kept source range into edit time
    words = [];
    let offset = 0;
    for (const g of segs) {
      for (const w of srtToWords(srt, g.start, g.end)) words.push({ ...w, start: +(w.start + offset).toFixed(3), end: +(w.end + offset).toFixed(3) });
      offset += g.end - g.start;
    }
  }
  writeFileSync(`public/${paths.words}`, JSON.stringify(words, null, 1));
  console.log(`words → public/${paths.words} (${words.length})`);

  const cfg = { ...brief.footage, segments: segs, out: `public/${paths.video}` };
  console.log("cut-out + grade + encode (a few minutes)…");
  const res = execFileSync("python3", ["scripts/footage_cutout.py", JSON.stringify(cfg)], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  console.log(res.trim().split("\n").pop());
}
