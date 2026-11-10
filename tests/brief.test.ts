import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { checkCompliance } from "../src/brief/compliance";
import { loadBrief } from "../src/brief/load";
import { brief, type Brief } from "../src/brief/schema";
import { durationSeconds } from "../src/brief/timing";
import { demoCase, demoEducation, demoOffer } from "../src/demo-briefs";

const env = { today: "2026-11-09", fileExists: () => true };
const errors = (b: Brief, e = env) => checkCompliance(b, e).filter((f) => f.level === "error");
const clone = <T,>(x: T): T => structuredClone(x);

describe("example briefs", () => {
  for (const [file, demo] of [
    ["briefs/examples/offer-implant-consult.yaml", demoOffer],
    ["briefs/examples/education-bleeding-gums.yaml", demoEducation],
    ["briefs/examples/case-demo-spacing.yaml", demoCase],
  ] as const) {
    it(`${file} is valid and matches the Studio default`, () => {
      const b = loadBrief(file);
      expect(b).toEqual(brief.parse(demo));
      expect(errors(b)).toEqual([]);
    });
  }
});

describe("YAML comma guard", () => {
  it("flags unquoted commas inside flow maps", async () => {
    const { findCommaSplits } = await import("../src/brief/load");
    expect(findCommaSplits(parse('steps: [{ title: A, subline: After healing, a connector is attached. }]'))).toHaveLength(1);
    expect(findCommaSplits(parse('steps: [{ title: A, subline: "After healing, a connector is attached." }]'))).toEqual([]);
  });
});

describe("schema", () => {
  it("rejects hook lines that are too long to read", () => {
    const raw = parse(readFileSync("briefs/examples/offer-implant-consult.yaml", "utf8"));
    raw.hook.lines = ["This line is far too long for a reel hook"];
    expect(brief.safeParse(raw).success).toBe(false);
  });
  it("requires sources for education videos", () => {
    expect(brief.safeParse({ ...demoEducation, sources: [] }).success).toBe(false);
  });
  it("rejects asset paths outside public/", () => {
    expect(brief.safeParse({ ...demoCase, before: "../secret/patient.jpg" }).success).toBe(false);
  });
});

describe("compliance", () => {
  it("blocks banned claims", () => {
    const b = clone(demoOffer);
    b.points = ["Painless implants guaranteed"];
    const rules = errors(b).map((f) => f.message);
    expect(rules.some((m) => m.includes("painless"))).toBe(true);
    expect(rules.some((m) => m.includes("guaranteed"))).toBe(true);
  });
  it("allows the technical term light cure but still blocks cure claims", () => {
    const b = clone(demoOffer);
    b.points = ["Light cure each layer"];
    expect(errors(b)).toEqual([]);
    b.points = ["A cure for gum disease"];
    expect(errors(b)[0].rule).toBe("claims");
  });
  it("does not flag words that merely contain a banned word", () => {
    const b = clone(demoOffer);
    b.points = ["Secure your appointment"]; // contains "cure"
    expect(errors(b)).toEqual([]);
  });
  it("blocks patient IDs on screen", () => {
    const b = clone(demoCase);
    b.notes = ["Case DH-0147 bonding"];
    expect(errors(b)[0].rule).toBe("privacy");
  });
  it("blocks unknown phone numbers but allows the clinic's", () => {
    const b = clone(demoOffer);
    b.offer.terms = "Call 0323-7560160 to book";
    expect(errors(b)).toEqual([]);
    b.offer.terms = "Call 0300-1234567 to book";
    expect(errors(b)[0].rule).toBe("contact");
  });
  it("allows only the clinic's Instagram handle", () => {
    const b = clone(demoOffer);
    b.offer.terms = "Follow @dentalhousesktt for updates";
    expect(errors(b)).toEqual([]);
    b.offer.terms = "Follow @dentalhouseskt for updates"; // typo of the real handle
    expect(errors(b)[0].rule).toBe("contact");
  });
  it("fx defaults are calm and unknown transitions are rejected", () => {
    const { fx: _f, ...noFx } = demoCase;
    expect(brief.parse(noFx).fx).toEqual({ transition: "fade", transition_frames: 10, sfx: "none" });
    expect(brief.safeParse({ ...demoCase, fx: { transition: "ripple" } }).success).toBe(false); // WebGL ones are not offered
  });
  it("defaults to the brand theme and accepts editorial", () => {
    const { theme: _omit, ...noTheme } = demoOffer;
    expect(brief.parse(noTheme).theme).toBe("brand");
    expect(brief.parse(demoEducation).theme).toBe("editorial");
    expect(brief.safeParse({ ...demoOffer, theme: "neon" }).success).toBe(false);
  });
  it("blocks expired offers (demo briefs only warn)", () => {
    expect(errors({ ...clone(demoOffer), demo: false }, { ...env, today: "2027-01-01" })[0].rule).toBe("offer");
    expect(errors(demoOffer, { ...env, today: "2027-01-01" })).toEqual([]);
  });
  it("blocks real cases without consent, allows demo cases", () => {
    const real = { ...clone(demoCase), demo: false };
    expect(errors(real).some((f) => f.rule === "consent")).toBe(true);
    expect(errors(demoCase)).toEqual([]);
  });
  it("accepts a real case with social-media consent on file outside public/", () => {
    const real = {
      ...clone(demoCase),
      demo: false,
      consent: { file: "assets/cases/demo-case/consent.pdf", signed_on: "2026-10-01", scope: ["social-media" as const] },
    };
    expect(errors(real)).toEqual([]);
    expect(errors({ ...real, consent: { ...real.consent, file: "public/consent.pdf" } }).length).toBeGreaterThan(0);
    expect(errors({ ...real, consent: { ...real.consent, scope: ["print" as const] } }).length).toBeGreaterThan(0);
  });
  it("warns when not approved by a dentist", () => {
    const real = { ...clone(demoOffer), demo: false };
    expect(checkCompliance(real, env).some((f) => f.rule === "review")).toBe(true);
  });
});

describe("timing", () => {
  it("offer length depends on number of points", () => {
    const one = { ...demoOffer, points: ["One"] };
    // 2 extra points × 2 s, minus 2 extra transition overlaps of 10 frames
    expect(durationSeconds(demoOffer) - durationSeconds(one)).toBeCloseTo(4 - (2 * 10) / 30);
    expect(durationSeconds({ ...demoOffer, fx: { ...demoOffer.fx, transition: "none" } }) - durationSeconds({ ...one, fx: { ...one.fx, transition: "none" } })).toBeCloseTo(4);
  });
  it("all examples fit in a reel", () => {
    for (const b of [demoOffer, demoEducation, demoCase]) expect(durationSeconds(b)).toBeLessThan(30);
  });
});

describe("map route", () => {
  const base = () => loadBrief("briefs/examples/map-route.yaml") as Extract<Brief, { type: "map-route" }>;
  it("example is valid, defaults to the clinic, and fits in a reel", () => {
    const b = base();
    expect(errors(b)).toEqual([]);
    expect(b.destination.label).toBeUndefined(); // template falls back to clinic.name
    expect(durationSeconds(b)).toBeLessThanOrEqual(90);
  });
  it("rejects diagonal steps, repeats and points off the grid", () => {
    const b = clone(base());
    b.route = [[1, 1], [3, 4], [3, 4], [40, 4]];
    const rules = errors(b).map((f) => f.message);
    expect(rules.some((m) => m.includes("share a col or row"))).toBe(true);
    expect(rules.some((m) => m.includes("repeats"))).toBe(true);
    expect(rules.some((m) => m.includes("outside"))).toBe(true);
  });
  it("warns when the chip stops saying the map is illustrative", () => {
    const b = clone(base());
    b.chip = "Route to the clinic";
    expect(checkCompliance(b, env).some((f) => f.rule === "map")).toBe(true);
  });
  it("still applies the claims list to labels", () => {
    const b = clone(base());
    b.streets = [{ at: [2, 2], text: "Best dentist street" }];
    expect(errors(b).some((f) => f.rule === "claims")).toBe(true);
  });
});

describe("blueprint", () => {
  for (const f of ["briefs/examples/blueprint-implant.yaml", "briefs/examples/blueprint-tooth.yaml"])
    it(`${f} is valid with no warnings about dimensions`, () => {
      const b = loadBrief(f);
      expect(errors(b)).toEqual([]);
      expect(checkCompliance(b, env).some((x) => x.rule === "dimensions")).toBe(false);
    });
  it("asks for a 'sizes vary' note when implant dimensions are shown", () => {
    const b = clone(loadBrief("briefs/examples/blueprint-implant.yaml")) as Extract<Brief, { type: "blueprint" }>;
    b.note = ["Crown seats on abutment"];
    expect(checkCompliance(b, env).some((x) => x.rule === "dimensions")).toBe(true);
  });
});
