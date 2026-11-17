import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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

// base "./" so the built app works from any folder or static host.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
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
