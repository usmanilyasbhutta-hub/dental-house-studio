import { continueRender, delayRender, staticFile } from "remotion";

const FACES: [family: string, file: string, weight: string, style: string][] = [
  ["Oswald", "oswald-latin-600-normal.woff2", "600", "normal"],
  ["Oswald", "oswald-latin-700-normal.woff2", "700", "normal"],
  ["Instrument Serif", "instrument-serif-latin-400-italic.woff2", "400", "italic"],
  ["JetBrains Mono", "jetbrains-mono-latin-500-normal.woff2", "500", "normal"],
  ["Caveat", "caveat-latin-700-normal.woff2", "700", "normal"],
  ["Patrick Hand", "patrick-hand-latin-400-normal.woff2", "400", "normal"],
  ...(["400", "500", "700", "900"] as const).map((w): [string, string, string, string] => ["Roboto", `roboto-latin-${w}-normal.woff2`, w, "normal"]),
];

let started = false;

/** Blocks rendering until brand fonts are loaded (no fallback-font frames). */
export function loadBrandFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading brand fonts");
  Promise.all(
    FACES.map(async ([family, file, weight, style]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { weight, style });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error("Font loading failed", e);
      continueRender(handle);
    });
}
