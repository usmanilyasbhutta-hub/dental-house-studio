import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Strict CSP for the built app only (it would break Vite's dev server). Nothing may load from or send to other origins.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

let outDir = "dist";

// base "./" so the built app works from any folder or static host.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      // Writes every built file into dist/sw.js so the whole app is cached on the FIRST visit (offline straight away),
      // and versions the cache by a hash of that list so old caches are dropped on update.
      name: "precache-list",
      apply: "build",
      configResolved(cfg) {
        outDir = resolve(cfg.root, cfg.build.outDir);
      },
      closeBundle() {
        const out = outDir;
        const swPath = join(out, "sw.js");
        if (!existsSync(swPath)) return;
        const walk = (d: string): string[] =>
          readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
        const files = walk(out)
          .map((f) => relative(out, f).split(sep).join("/"))
          .filter((f) => f !== "sw.js" && !f.endsWith(".map"))
          .sort();
        const version = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 10);
        const src = readFileSync(swPath, "utf8")
          .replace("/*__PRECACHE__*/", files.map((f) => JSON.stringify("./" + f)).join(", "))
          .replace("__VERSION__", version);
        writeFileSync(swPath, src);
      },
    },
    {
      name: "csp",
      apply: "build",
      transformIndexHtml: (html) =>
        html.replace(
          "<head>",
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`,
        ),
    },
  ],
  build: { target: "es2020", outDir: "dist", assetsInlineLimit: 0 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
