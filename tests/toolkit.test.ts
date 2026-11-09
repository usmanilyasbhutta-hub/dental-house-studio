import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { checkCompliance } from "../src/brief/compliance";
import { brief } from "../src/brief/schema";
import { durationSeconds } from "../src/brief/timing";

const env = { today: "2026-11-09", fileExists: () => true };
const load = (f: string) => brief.parse(parse(readFileSync(f, "utf8")));
const errs = (b: ReturnType<typeof load>) => checkCompliance(b, env).filter((f) => f.level === "error");

describe("procedure briefs", () => {
  it("examples are valid and long enough to read", () => {
    for (const f of ["briefs/examples/procedure-implant.yaml", "briefs/examples/procedure-crown.yaml"]) {
      const b = load(f);
      expect(errs(b)).toEqual([]);
      expect(durationSeconds(b)).toBeGreaterThan(15);
      expect(durationSeconds(b)).toBeLessThan(30);
    }
  });
  it("needs exactly one step per animated stage", () => {
    const b = load("briefs/examples/procedure-implant.yaml");
    const three = { ...b, steps: b.type === "procedure" ? b.steps.slice(0, 3) : [] } as typeof b;
    expect(errs(three).map((e) => e.rule)).toContain("steps");
  });
});

describe("photo-layout briefs", () => {
  it("examples are valid", () => {
    for (const f of ["briefs/examples/photo-annotate.yaml", "briefs/examples/photo-split.yaml"]) expect(errs(load(f))).toEqual([]);
  });
  it("split needs exactly two photos", () => {
    const b = load("briefs/examples/photo-split.yaml");
    const one = { ...b, photos: b.type === "photo-layout" ? b.photos.slice(0, 1) : [] } as typeof b;
    expect(errs(one).map((e) => e.rule)).toContain("layout");
  });
  it("patient photos need consent outside public/", () => {
    const b = { ...load("briefs/examples/photo-annotate.yaml"), demo: false, clinical: true } as ReturnType<typeof load>;
    expect(errs(b).map((e) => e.rule)).toContain("consent");
    const ok = { ...b, consent: { file: "assets/cases/x/consent.pdf", signed_on: "2026-11-01", scope: ["social-media" as const] } } as typeof b;
    expect(errs(ok)).toEqual([]);
    expect(errs({ ...ok, consent: { ...(ok as { consent: { file: string } }).consent, file: "public/consent.pdf" } } as typeof b).map((e) => e.rule)).toContain("consent");
  });
  it("annotation points must be percentages", () => {
    const raw = parse(readFileSync("briefs/examples/photo-annotate.yaml", "utf8"));
    raw.annotations[0].x = 140;
    expect(brief.safeParse(raw).success).toBe(false);
  });
});
