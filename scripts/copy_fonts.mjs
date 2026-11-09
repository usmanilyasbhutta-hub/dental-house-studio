// Copies the brand fonts (woff2) from @fontsource into public/fonts.
import { copyFileSync, mkdirSync } from "node:fs";
const files = {
  "oswald-latin-600-normal.woff2": "@fontsource/oswald/files/oswald-latin-600-normal.woff2",
  "oswald-latin-700-normal.woff2": "@fontsource/oswald/files/oswald-latin-700-normal.woff2",
  "instrument-serif-latin-400-italic.woff2": "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2",
  "jetbrains-mono-latin-500-normal.woff2": "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2",
};
mkdirSync("public/fonts", { recursive: true });
for (const [out, src] of Object.entries(files)) {
  copyFileSync(`node_modules/${src}`, `public/fonts/${out}`);
  console.log("font", out);
}
