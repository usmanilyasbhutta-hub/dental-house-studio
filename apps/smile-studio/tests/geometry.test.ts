import { describe, expect, it } from "vitest";
import {
  bandLayout,
  mockupAlpha,
  bounds,
  centralLength,
  centralWidth,
  fitArcToLowerLip,
  measure,
  outlineSides,
  PROPORTIONS,
  smoothClosed,
  toImage,
  toLocal,
  toothBoxes,
  toothOutline,
  unitBox,
  watermarkTiles,
} from "../src/geometry";
import { DEFAULT_DESIGN, initialLayout, type Design } from "../src/model";
import { grayWorldGain, SHADES, shadeById } from "../src/shades";
import { layerScale } from "../src/teethLayer";

const base: Design = { ...DEFAULT_DESIGN, center: { x: 500, y: 700 }, width: 300 };

describe("tooth sizes", () => {
  it("six anterior teeth span exactly the design width, for every proportion", () => {
    for (const p of Object.keys(PROPORTIONS) as Design["proportion"][]) {
      const boxes = toothBoxes({ ...base, proportion: p, count: 6 });
      const span = Math.max(...boxes.map((b) => b.x1)) - Math.min(...boxes.map((b) => b.x0));
      expect(span).toBeCloseTo(300, 6);
    }
  });

  it("golden proportion: lateral is 61.8 % of central", () => {
    const b = toothBoxes({ ...base, proportion: "golden", count: 6 }).filter((x) => x.side === 1);
    expect((b[1].x1 - b[1].x0) / (b[0].x1 - b[0].x0)).toBeCloseTo(0.618, 3);
  });

  it("is symmetric about the midline and returns count boxes", () => {
    for (const count of [6, 8, 10] as const) {
      const boxes = toothBoxes({ ...base, count });
      expect(boxes).toHaveLength(count);
      const r = boxes.filter((b) => b.side === 1);
      const l = boxes.filter((b) => b.side === -1);
      r.forEach((b, i) => {
        expect(b.x0).toBeCloseTo(-l[i].x1, 9);
        expect(b.bottom).toBeCloseTo(l[i].bottom, 9);
      });
    }
  });

  it("width/length ratio is respected", () => {
    expect(centralWidth(base) / centralLength(base)).toBeCloseTo(base.wl, 9);
  });

  it("smile arc raises the canine edge above the central edge", () => {
    const flat = toothBoxes({ ...base, arc: 0, lateralStep: 0 });
    const curved = toothBoxes({ ...base, arc: 1, lateralStep: 0 });
    const canine = (bs: typeof flat) => bs.find((b) => b.kind === 2 && b.side === 1)!.bottom;
    expect(canine(curved)).toBeLessThan(canine(flat));
  });
});

describe("outlines and transforms", () => {
  it("tooth outlines stay inside a slightly padded box", () => {
    for (const shape of ["oval", "square", "triangular", "soft"] as const) {
      for (const b of toothBoxes(base)) {
        const pts = toothOutline(b, shape);
        expect(pts.length).toBeGreaterThan(20);
        const pad = (b.bottom - b.top) * 0.15;
        for (const p of pts) {
          expect(p.x).toBeGreaterThanOrEqual(b.x0 - 1e-6);
          expect(p.x).toBeLessThanOrEqual(b.x1 + 1e-6);
          expect(p.y).toBeGreaterThanOrEqual(b.top - 1e-6);
          expect(p.y).toBeLessThanOrEqual(b.bottom + pad);
        }
      }
    }
  });

  it("toLocal inverts toImage", () => {
    const p = { x: 12.5, y: -40 };
    const q = toLocal(toImage(p, base, 0.2), base, 0.2);
    expect(q.x).toBeCloseTo(p.x, 9);
    expect(q.y).toBeCloseTo(p.y, 9);
  });

  it("smoothClosed passes through the control points", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const s = smoothClosed(pts, 4);
    expect(s).toHaveLength(16);
    expect(s[4]).toEqual({ x: 10, y: 0 });
  });
});

describe("measurements and defaults", () => {
  it("reports midline deviation along the pupil line", () => {
    const { guides, design } = initialLayout(1000, 1000);
    expect(measure(design, guides).midlineDev).toBeCloseTo(0, 9);
    expect(measure({ ...design, center: { x: 520, y: 720 } }, guides).midlineDev).toBeCloseTo(20, 9);
  });

  it("calibrates mm from the patient's existing central on the photo, not from the design", () => {
    const g = initialLayout(1000, 1000).guides;
    expect(measure(base, g, 8.5).pxPerMm).toBeUndefined();
    const m = measure(base, g, 8.5, { a: { x: 400, y: 600 }, b: { x: 485, y: 600 } });
    expect(m.pxPerMm).toBeCloseTo(10, 9);
  });

  it("fits the smile arc to a curved lower lip and gives ~0 for a flat one", () => {
    const { guides, design } = initialLayout(1000, 1000);
    const half = design.width / 2;
    const flat = [-1, -0.5, 0, 0.5, 1].map((t) => ({ x: design.center.x + t * half, y: design.center.y + 10 }));
    expect(fitArcToLowerLip(flat, design, guides)).toBeCloseTo(0, 6);
    const curved = [-1, -0.5, 0, 0.5, 1].map((t) => ({ x: design.center.x + t * half, y: design.center.y + 10 - 30 * t * t }));
    expect(fitArcToLowerLip(curved, design, guides)).toBeGreaterThan(0.3);
  });

  it("knows every shade and falls back safely", () => {
    expect(SHADES.length).toBeGreaterThan(5);
    expect(shadeById("A2").id).toBe("A2");
    expect(shadeById("nope").id).toBe("A1");
  });
});

describe("round 2: anatomy corrections", () => {
  type P = { x: number; y: number };
  const top = (pts: P[]) => pts.reduce((a, p) => (p.y < a.y ? p : a));
  const bottom = (pts: P[]) => pts.reduce((a, p) => (p.y > a.y ? p : a));

  it("uses the corrected golden / RED ratios and notes", () => {
    expect(PROPORTIONS.golden.ratios).toEqual([1, 0.618, 0.382, 0.3, 0.22]);
    expect(PROPORTIONS.red.ratios).toEqual([1, 0.7, 0.49, 0.38, 0.28]);
    expect(PROPORTIONS.natural.ratios).toEqual([1, 0.66, 0.554, 0.42, 0.32]);
    expect(PROPORTIONS.golden.note).toContain("Best suited to long teeth");
    expect(PROPORTIONS.red.note).toContain("Ward 2007");
    expect(PROPORTIONS.natural.note.startsWith("Average natural smiles (Preston):")).toBe(true);
  });

  it("gingival zenith: distal on centrals, less on laterals, centred on canines (Chu 2009)", () => {
    for (const side of [-1, 1] as const) {
      const bs = toothBoxes(base).filter((b) => b.side === side);
      const off = (k: number) => {
        const b = bs[k];
        return ((top(toothOutline(b, "soft")).x - (b.x0 + b.x1) / 2) / (b.x1 - b.x0)) * side;
      };
      expect(off(0)).toBeGreaterThan(0.06);
      expect(off(1)).toBeGreaterThan(0.02);
      expect(off(1)).toBeLessThan(off(0));
      expect(Math.abs(off(2))).toBeLessThan(0.02);
    }
  });

  it("canine cusp tip sits mesial of the tooth centre", () => {
    for (const side of [-1, 1] as const) {
      const c = toothBoxes(base).find((b) => b.kind === 2 && b.side === side)!;
      const tip = bottom(toothOutline(c, "soft"));
      expect(Math.abs(tip.x)).toBeLessThan(Math.abs((c.x0 + c.x1) / 2));
    }
  });

  it("lateral gum margin 9.5 % below the central's; canine 97 % of central length", () => {
    const b = toothBoxes({ ...base, arc: 0, lateralStep: 0 }).filter((x) => x.side === 1);
    const L = centralLength(base);
    expect((b[1].top - b[0].top) / L).toBeCloseTo(0.095, 9);
    expect((b[2].bottom - b[2].top) / L).toBeCloseTo(0.97, 9);
  });

  it("outline is affine in the box (the renderer caches unit outlines)", () => {
    for (const b of toothBoxes(base)) {
      const unit = toothOutline(unitBox(b.kind, b.side), "oval");
      const real = toothOutline(b, "oval");
      const w = b.x1 - b.x0;
      const h = b.bottom - b.top;
      expect(real).toHaveLength(unit.length);
      real.forEach((p, i) => {
        expect(p.x).toBeCloseTo(b.x0 + unit[i].x * w, 6);
        expect(p.y).toBeCloseTo(b.top + unit[i].y * h, 6);
      });
    }
  });

  it("outlineSides leaves out exactly the incisal edge", () => {
    for (const b of toothBoxes(base)) {
      const pts = toothOutline(b, "square");
      const { start, end } = outlineSides(pts, b, 0.8);
      const lim = b.top + (b.bottom - b.top) * 0.8;
      expect(end - start).toBeGreaterThan(pts.length / 2);
      expect(end - start).toBeLessThan(pts.length);
      for (let j = start; j < end; j++) expect(pts[j % pts.length].y).toBeLessThanOrEqual(lim);
      // the point just before and just after the range are incisal
      expect(pts[(start - 1 + pts.length) % pts.length].y).toBeGreaterThan(lim);
      expect(pts[end % pts.length].y).toBeGreaterThan(lim);
    }
  });
});

describe("round 2: rendering helpers", () => {
  it("bounds", () => {
    expect(bounds([{ x: 1, y: 5 }, { x: -2, y: 3 }])).toEqual({ x0: -2, y0: 3, x1: 1, y1: 5 });
  });

  it("watermark tiles cover the panel but stay off the teeth", () => {
    const avoid = { x0: 400, y0: 1000, x1: 800, y1: 1200 };
    const t = watermarkTiles(1200, 1600, 380, -Math.PI / 7, { w: 200, h: 40 }, avoid);
    expect(t.length).toBeGreaterThan(8);
    for (const p of t) expect(p.x > avoid.x0 && p.x < avoid.x1 && p.y > avoid.y0 && p.y < avoid.y1).toBe(false);
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]])
      expect(t.some((p) => p.x > 600 === !!qx && p.y > 800 === !!qy)).toBe(true);
  });

  it("export band: label and brand share a line only when they fit with a gap", () => {
    // QA case: portrait 1200 wide, label ~860 px, brand ~330 px → two lines
    // portrait 1200 px: shrinks to one line instead of overlapping
    const p = bandLayout(1200, 24, 907, 330, 48);
    expect(p.lines).toBe(1);
    expect((907 + 48 + 330) * p.scale).toBeLessThanOrEqual(1200 - 48 + 1e-9);
    expect(bandLayout(1200, 24, 860, 330, 40, 1)).toEqual({ lines: 2, scale: 1 });
    expect(bandLayout(2424, 24, 860, 330, 40)).toEqual({ lines: 1, scale: 1 });
    const tiny = bandLayout(600, 12, 860, 330, 40);
    expect(tiny.lines).toBe(2);
    expect(860 * tiny.scale).toBeLessThanOrEqual(600 - 24 + 1e-9);
  });

  it("mockup alpha covers fully at the default opacity with a backdrop, as is without", () => {
    expect(mockupAlpha(0.92, true)).toBe(1);
    expect(mockupAlpha(0.92, undefined)).toBe(1);
    expect(mockupAlpha(0.46, true)).toBeCloseTo(0.5, 9);
    expect(mockupAlpha(0.92, false)).toBe(0.92);
    expect(mockupAlpha(1.5, false)).toBe(1);
  });

  it("gray-world gain is neutral for grey photos and follows the cast at 18 %", () => {
    expect(grayWorldGain([100, 100, 100])).toEqual([1, 1, 1]);
    const g = grayWorldGain([150, 100, 50], 0.18);
    expect(g[0]).toBeCloseTo(1.09, 9);
    expect(g[2]).toBeCloseTo(0.91, 9);
    expect((g[0] + g[1] + g[2]) / 3).toBeCloseTo(1, 9);
    expect(grayWorldGain([0, 0, 0])).toEqual([1, 1, 1]);
  });

  it("layer scale is quantised, bounded and capped", () => {
    expect(layerScale(0.3, "full", 1e5)).toBe(1);
    expect(layerScale(2.1, "full", 1e5)).toBe(2);
    expect(layerScale(9, "full", 1e5)).toBe(3);
    expect(layerScale(9, "fast", 1e5)).toBe(1.5);
    expect(layerScale(3, "full", 2e6)).toBeLessThanOrEqual(Math.sqrt(4e6 / 2e6) + 1e-9);
  });

  it("has A3.5 and B3, bleach labels, and keeps ids", () => {
    expect(shadeById("A3.5").body).toBe("#CFB487");
    expect(shadeById("A3.5").cervical).toBe("#BB9A62");
    expect(shadeById("B3").id).toBe("B3");
    expect(shadeById("BL1").label).toBe("BL1 (bleach)");
    expect(SHADES.map((s) => s.id)).toEqual(["BL1", "BL2", "BL3", "BL4", "B1", "A1", "B2", "A2", "A3", "B3", "A3.5"]);
  });
});

describe("smile close-up framing", () => {
  it("puts the level dots on the mouth corners and a larger design in the frame", () => {
    const face = initialLayout(1000, 800);
    const close = initialLayout(1000, 800, "closeup");
    expect(close.guides.pupilR.y).toBe(close.guides.pupilL.y); // level by default
    expect(close.design.width).toBeGreaterThan(face.design.width);
    expect(measure(close.design, close.guides).midlineDev).toBeCloseTo(0, 9);
  });
});
