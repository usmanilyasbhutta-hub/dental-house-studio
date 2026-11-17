import { describe, expect, it } from "vitest";
import {
  centralLength,
  centralWidth,
  measure,
  PROPORTIONS,
  smoothClosed,
  toImage,
  toLocal,
  toothBoxes,
  toothOutline,
} from "../src/geometry";
import { DEFAULT_DESIGN, initialLayout, type Design } from "../src/model";
import { SHADES, shadeById } from "../src/shades";

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

  it("converts to mm when calibrated", () => {
    const m = measure(base, initialLayout(1000, 1000).guides, 8.5);
    expect(m.centralW / m.pxPerMm!).toBeCloseTo(8.5, 9);
  });

  it("knows every shade and falls back safely", () => {
    expect(SHADES.length).toBeGreaterThan(5);
    expect(shadeById("A2").id).toBe("A2");
    expect(shadeById("nope").id).toBe("BL3");
  });
});
