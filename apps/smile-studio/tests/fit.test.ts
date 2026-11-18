// Round 6: "Fit to teeth" (two canine taps + existing-teeth mask). Synthetic masks only (never patient photos).
import { describe, expect, it } from "vitest";
import { canineSpanFactor, canineTips, fitFromCanines, fitToTeeth, FIT_TOL, orderTaps, refineWithMask, type FitMask } from "../src/fit";
import { centralWidth, plannedOutlines, pupilAngle, rad, toothBoxes, widthRatios } from "../src/geometry";
import { DEFAULT_DESIGN, type Design, type Guides, type Pt } from "../src/model";
import { rasterPolygon } from "../src/teethMask";

const W = 600;
const H = 400;
const level: Guides = { pupilR: { x: 150, y: 40 }, pupilL: { x: 450, y: 40 }, midline: { x: 300, y: 40 } };

/** Mask of the planned outlines of `d` (what a perfect tooth detector would return), optional central gap. */
function maskOf(ds: Design[], g: Guides, gapPx = 0, gapAt?: Pt): FitMask {
  const acc = new Float32Array(W * H);
  for (const d of ds) for (const o of plannedOutlines(d, pupilAngle(g) + rad(d.tilt))) rasterPolygon(acc, W, H, o.pts);
  const data = new Uint8Array(W * H);
  for (let i = 0; i < acc.length; i++) data[i] = acc[i] >= 0.5 ? 255 : 0;
  if (gapPx && gapAt) for (let y = 0; y < H; y++) for (let x = Math.round(gapAt.x - gapPx / 2); x < Math.round(gapAt.x + gapPx / 2); x++) data[y * W + x] = 0;
  return { w: W, h: H, data };
}

const lowerTruth: Design = { ...DEFAULT_DESIGN, arch: "lower", center: { x: 304, y: 220 }, width: 230, wl: 0.6, count: 6, arc: 0.3, tilt: 0 };
const upperTruth: Design = { ...DEFAULT_DESIGN, arch: "upper", center: { x: 300, y: 200 }, width: 300, wl: 0.8, count: 6, arc: 0.35, tilt: 2 };

describe("fit to teeth: two canine taps", () => {
  it("span factor makes the canine boxes centred under the taps (derived from toothBoxes)", () => {
    for (const d of [lowerTruth, upperTruth, { ...upperTruth, proportion: "golden" as const }]) {
      const r = widthRatios(d);
      // canine centre at cw·(r0 + r1 + r2/2); width = 2·cw·(r0 + r1 + r2)
      expect(canineSpanFactor(d)).toBeCloseTo((r[0] + r[1] + r[2]) / (r[0] + r[1] + r[2] / 2), 6);
    }
  });

  it("recovers width, centre and tilt of a known design from its canine tips (lower and upper, any start)", () => {
    for (const truth of [lowerTruth, upperTruth, { ...lowerTruth, tilt: -3, count: 10 as const }]) {
      const [R, L] = canineTips(truth, level);
      const start: Design = { ...truth, center: { x: 100, y: 100 }, width: 120, tilt: 0 };
      const d = fitFromCanines(start, level, R, L);
      expect(d.width).toBeCloseTo(truth.width, 6);
      expect(d.tilt).toBeCloseTo(truth.tilt, 6);
      expect(d.center.x).toBeCloseTo(truth.center.x, 6);
      expect(d.center.y).toBeCloseTo(truth.center.y, 6);
      // tap order does not matter; canine boxes sit under the taps
      const d2 = fitFromCanines(start, level, L, R);
      expect(d2.center.x).toBeCloseTo(d.center.x, 9);
      const [R2, L2] = canineTips(d, level);
      expect(Math.hypot(R2.x - R.x, R2.y - R.y)).toBeLessThan(1e-6);
      expect(Math.hypot(L2.x - L.x, L2.y - L.y)).toBeLessThan(1e-6);
    }
  });

  it("tilt is measured against the reference line and clamped to ±6°", () => {
    const tilted: Guides = { pupilR: { x: 150, y: 40 }, pupilL: { x: 450, y: 61 }, midline: { x: 300, y: 50 } }; // ≈ 4°
    const d = fitFromCanines(lowerTruth, tilted, { x: 200, y: 214 }, { x: 400, y: 214 });
    expect(d.tilt).toBeCloseTo(-4, 0);
    const steep = fitFromCanines(lowerTruth, level, { x: 200, y: 180 }, { x: 400, y: 260 });
    expect(steep.tilt).toBe(6);
  });

  it("patient's right is the tap on the image left (pupil frame)", () => {
    const [R, L] = orderTaps({ x: 400, y: 200 }, { x: 200, y: 210 }, level);
    expect(R.x).toBe(200);
    expect(L.x).toBe(400);
  });

  it("taps closer than a few px leave the design unchanged", () => {
    expect(fitToTeeth(lowerTruth, level, { x: 300, y: 200 }, { x: 301, y: 200 }, null, W).design).toBe(lowerTruth);
  });
});

describe("fit to teeth: refinement with the existing-teeth mask", () => {
  it("sets the lower central W/L from the crown height in the mask", () => {
    const [R, L] = canineTips(lowerTruth, level);
    const m = maskOf([lowerTruth], level);
    const res = fitToTeeth({ ...lowerTruth, wl: 0.72, center: { x: 0, y: 0 } }, level, R, L, m, W);
    expect(res.used).toBe(true);
    expect(res.wl).toBeDefined();
    expect(Math.abs(res.design.wl - lowerTruth.wl)).toBeLessThan(0.04);
    expect(Math.abs(res.design.width - lowerTruth.width)).toBeLessThan(0.5);
    expect(Math.hypot(res.design.center.x - lowerTruth.center.x, res.design.center.y - lowerTruth.center.y)).toBeLessThan(2);
  });

  it("upper arch mirrors it (crown grows up the photo)", () => {
    const [R, L] = canineTips(upperTruth, level);
    const res = fitToTeeth({ ...upperTruth, wl: 0.92 }, level, R, L, maskOf([upperTruth], level), W);
    expect(Math.abs(res.design.wl - upperTruth.wl)).toBeLessThan(0.05);
  });

  it("lower crowns overlapped by the upper teeth: the joined mask still gives the lower crown height", () => {
    // upper teeth cover the lower incisal third (normal overbite)
    const Ll = centralWidth(lowerTruth) / lowerTruth.wl;
    const up: Design = { ...upperTruth, tilt: 0, center: { x: 304, y: lowerTruth.center.y + Ll * 0.3 }, width: 290 };
    const [R, L] = canineTips(lowerTruth, level);
    const res = fitToTeeth({ ...lowerTruth, wl: 0.7 }, level, R, L, maskOf([lowerTruth, up], level), W);
    expect(Math.abs(res.design.wl - lowerTruth.wl)).toBeLessThan(0.05);
  });

  it("moves the centrals onto a visible central gap, at most FIT_TOL × central width from the taps", () => {
    const truth = { ...lowerTruth };
    const [R, L] = canineTips(truth, level);
    const cw = centralWidth(truth);
    // the patient's real contact is 0.2 × cw to the image right of the tap midpoint
    const gapX = truth.center.x + cw * 0.2;
    const m = maskOf([truth], level, 3, { x: gapX, y: 0 });
    const res = fitToTeeth(truth, level, R, L, m, W);
    expect(res.nudge).toBeGreaterThan(cw * 0.12);
    expect(Math.abs(res.design.center.x - gapX)).toBeLessThan(2.5);
    // a gap far outside the tolerance is ignored (clamped)
    const far = fitToTeeth(truth, level, R, L, maskOf([truth], level, 3, { x: truth.center.x + cw * 0.9, y: 0 }), W);
    expect(Math.abs(far.nudge)).toBeLessThanOrEqual(cw * FIT_TOL + 1e-9);
  });

  it("an unreliable mask keeps the tap result", () => {
    const [R, L] = canineTips(lowerTruth, level);
    const tap = fitFromCanines(lowerTruth, level, R, L);
    // empty mask
    const empty = refineWithMask(tap, level, R, L, { w: W, h: H, data: new Uint8Array(W * H) }, W);
    expect(empty.used).toBe(false);
    expect(empty.design).toEqual(tap);
    // everything white (lips not traced, mask flooded): crown runs past any plausible length → rejected
    const full = refineWithMask(tap, level, R, L, { w: W, h: H, data: new Uint8Array(W * H).fill(255) }, W);
    expect(full.wl).toBeUndefined();
    expect(Math.abs(full.design.width - tap.width)).toBeLessThan(1e-9);
    // no mask at all
    expect(refineWithMask(tap, level, R, L, null, W).design).toBe(tap);
  });

  it("columns cut by the lip line are not used for length (gum hidden)", () => {
    const [R, L] = canineTips(upperTruth, level);
    const m = maskOf([upperTruth], level);
    // upper lip covers the cervical half: mask stops there and the lip contour runs along it
    const boxes = toothBoxes(upperTruth);
    const cutY = upperTruth.center.y + boxes[0].top * 0.5; // half-way up the central
    for (let y = 0; y < cutY; y++) for (let x = 0; x < W; x++) m.data[y * W + x] = 0;
    const lips = [
      { x: 20, y: cutY },
      { x: 580, y: cutY },
      { x: 580, y: 390 },
      { x: 20, y: 390 },
    ];
    const res = refineWithMask(fitFromCanines(upperTruth, level, R, L), level, R, L, m, W, lips);
    expect(res.wl).toBeUndefined(); // not "short square teeth" from a hidden margin
  });
});
