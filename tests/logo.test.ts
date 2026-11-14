import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Owner, 14 Nov 2026: "Never white logo". Only the full-colour logo on light surfaces (end card, light pages). */
describe("logo usage", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(f)) files.push(p);
    }
  };
  walk("src");
  it("no template uses a white (recoloured) logo or mark", () => {
    const hits = files.filter((f) => /brand\/(logo|mark)-white/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
