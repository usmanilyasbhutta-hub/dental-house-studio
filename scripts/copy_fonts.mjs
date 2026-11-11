// Copies the brand fonts (woff2) from @fontsource into public/fonts.
import { copyFileSync, mkdirSync } from "node:fs";
const files = {
  "oswald-latin-600-normal.woff2": "@fontsource/oswald/files/oswald-latin-600-normal.woff2",
  "oswald-latin-700-normal.woff2": "@fontsource/oswald/files/oswald-latin-700-normal.woff2",
  "instrument-serif-latin-400-italic.woff2": "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2",
  "jetbrains-mono-latin-500-normal.woff2": "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2",
  // hand-drawn explainer (type: sketch); both SIL Open Font License
  "caveat-latin-700-normal.woff2": "@fontsource/caveat/files/caveat-latin-700-normal.woff2",
  "patrick-hand-latin-400-normal.woff2": "@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2",
  // carousel look (type: promo, look: carousel); Apache License 2.0
  ...Object.fromEntries([400, 500, 700, 900].map((w) => [`roboto-latin-${w}-normal.woff2`, `@fontsource/roboto/files/roboto-latin-${w}-normal.woff2`])),
};
mkdirSync("public/fonts", { recursive: true });
for (const [out, src] of Object.entries(files)) {
  copyFileSync(`node_modules/${src}`, `public/fonts/${out}`);
  console.log("font", out);
}
