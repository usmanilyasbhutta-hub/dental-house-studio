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
    expect(durationSeconds(demoOffer) - durationSeconds(one)).toBeCloseTo(4);
  });
  it("all examples fit in a reel", () => {
    for (const b of [demoOffer, demoEducation, demoCase]) expect(durationSeconds(b)).toBeLessThan(30);
  });
});
