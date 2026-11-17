import { describe, expect, it } from "vitest";
import { bannedIn, caseCodeProblem, CLINICIAN, fmtDelta, PATIENT, rootLabel } from "../src/sheetCopy";

describe("sheet wording", () => {
  it("patient sheet uses the spec C wording verbatim", () => {
    expect(PATIENT.title).toBe("Your smile design: a simulation");
    expect(PATIENT.subtitle).toBe("A drawing to help us talk about options. It is not a promised result.");
    expect(PATIENT.today).toBe("Today (your photo)");
    expect(PATIENT.design).toBe("Design idea (simulated)");
    expect(PATIENT.footer).toMatch(/^Simulation for discussion\. .*including no treatment\.$/);
    expect(PATIENT.title.endsWith(PATIENT.accent)).toBe(true);
  });
  it("no banned words on the patient sheet", () => {
    for (const t of Object.values(PATIENT)) expect(bannedIn(t)).toEqual([]);
  });
  it("banned-word check catches the spec C list", () => {
    expect(bannedIn("A perfect, painless no-prep smile")).toEqual(["painless", "perfect", "no-prep"]);
    expect(bannedIn("best-looking")).toEqual(["best"]);
    expect(bannedIn("bestow")).toEqual([]);
  });
  it("clinician copy never assigns a prep depth or type per tooth", () => {
    expect(CLINICIAN.tableNote).toMatch(/no facial depth, reduction depth, prep type or material/);
  });
});

describe("sheet helpers", () => {
  it("formats outline deltas per spec B (≈ 0 under 0.3 mm, 0.1 mm steps)", () => {
    expect(fmtDelta(2, 10)).toBe("≈ 0");
    expect(fmtDelta(12, 10)).toBe("+1.2");
    expect(fmtDelta(-8, 10)).toBe("−0.8");
    expect(fmtDelta(12)).toBe("—");
  });
  it("groups copies of a case as the same patient", () => {
    expect(rootLabel("AB 12 · variant · lower")).toBe("AB 12");
    expect(rootLabel("AB 12")).toBe("AB 12");
  });
  it("refuses to print a clinic file ID as the case code", () => {
    expect(caseCodeProblem("DH-0147")).not.toBeNull();
    expect(caseCodeProblem("dh 147 smile")).not.toBeNull();
    expect(caseCodeProblem("AB · 17 Nov")).toBeNull();
  });
});
