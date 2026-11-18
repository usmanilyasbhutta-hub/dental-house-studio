#!/usr/bin/env node
// Labs (Auto-detect beta): puts the on-device model files into public/models/ so Vite serves them in dev and copies
// them into dist/ on build. The app then loads them from its OWN origin only (never from Google at runtime).
//  - MediaPipe wasm runtime: copied from node_modules/@mediapipe/tasks-vision (npm, Apache-2.0).
//  - Model files: downloaded once at dev/build time from storage.googleapis.com, pinned by version and SHA-256.
// Licences, versions and hashes are recorded in docs/models.md. Run: npm run models (also runs before npm run build).
// A missing model never breaks the build: the beta then shows its calm "not available" message and the manual flow runs.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(APP, "public", "models");
const WASM_SRC = join(APP, "node_modules", "@mediapipe", "tasks-vision", "wasm");

export const MODELS = [
  {
    file: "face_landmarker.task",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    sha256: "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff",
  },
  {
    file: "magic_touch.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite",
    sha256: "e24338a717c1b7ad8d159666677ef400babb7f33b8ad60c4d96db4ecf694cd25",
  },
];
const WASM = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

async function main() {
  mkdirSync(join(OUT, "wasm"), { recursive: true });
  let ok = true;
  for (const f of WASM) {
    const src = join(WASM_SRC, f);
    const dst = join(OUT, "wasm", f);
    if (!existsSync(src)) {
      console.warn(`[models] ${f} missing in node_modules (run npm install)`);
      ok = false;
      continue;
    }
    if (!existsSync(dst) || sha(readFileSync(src)) !== sha(readFileSync(dst))) copyFileSync(src, dst);
  }
  for (const m of MODELS) {
    const dst = join(OUT, m.file);
    if (existsSync(dst) && sha(readFileSync(dst)) === m.sha256) continue;
    try {
      const res = await fetch(m.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const got = sha(buf);
      if (got !== m.sha256) throw new Error(`SHA-256 mismatch (${got})`);
      writeFileSync(dst + ".part", buf);
      renameSync(dst + ".part", dst);
      console.log(`[models] ${m.file} ${(buf.length / 1e6).toFixed(1)} MB, sha256 ok`);
    } catch (e) {
      ok = false;
      console.warn(`[models] could not fetch ${m.file}: ${e.message}. Auto-detect (beta) will show its fallback message.`);
    }
  }
  if (ok) console.log("[models] Labs model files ready in public/models/");
}

main();
