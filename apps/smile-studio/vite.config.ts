import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the built app works from any folder or static host.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", outDir: "dist", assetsInlineLimit: 0 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
