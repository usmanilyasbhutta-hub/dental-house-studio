// Labs (Auto-detect beta): landmark → guides / lips mapping and mask merging, on SYNTHETIC data (mocked MediaPipe output).
import { describe, expect, it } from "vitest";
import {
  cropAroundLips,
  frontToothCentres,
  guidesFromLandmarks,
  INNER_LOWER,
  INNER_UPPER,
  IRIS,
  keepComponentAt,
  lipsFromLandmarks,
  maskArea,
  mergeRegion,
  MIDLINE,
  MOUTH_CORNERS,
  regionFromConfidence,
  resamplePolyline,
  signedArea,
  toothAreaScore,
  type Lm,
} from "../src/ai/map";
import { DEFAULT_DESIGN, defaultLips, type Design, type Guides } from "../src/model";
import { LABS_KEY, labsOn, setLabs } from "../src/labs";
import { pupilAngle } from "../src/geometry";

const W = 1000;
const H = 1200;

/** A synthetic 478-point face: eyes at y 0.4, midline x 0.5, mouth centred at (0.5, 0.7), optionally rotated. */
function face({ n = 478, deg = 0, mirror = false, midX = 0.5, open = 0.03 } = {}): Lm[] {
  const lms: Lm[] = Array.from({ length: n }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => (lms[i] = { x, y });
  // inner lips: 11 points corner→corner, upper arc above y 0.7, lower arc below
  const k = INNER_UPPER.length - 1;
  for (let j = 0; j <= k; j++) {
    const t = j / k; // 0..1 from landmark-78 side to the 308 side
    const x = mirror ? 0.6 - 0.2 * t : 0.4 + 0.2 * t;
    const bump = Math.sin(Math.PI * t);
    set(INNER_UPPER[j], x, 0.7 - open * bump);
    set(INNER_LOWER[j], x, 0.7 + open * 1.3 * bump);
  }
  set(MOUTH_CORNERS[0], mirror ? 0.62 : 0.38, 0.7);
  set(MOUTH_CORNERS[1], mirror ? 0.38 : 0.62, 0.7);
  if (n >= 478) {
    set(IRIS[0], mirror ? 0.62 : 0.38, 0.4);
    set(IRIS[1], mirror ? 0.38 : 0.62, 0.4);
  }
  // eye corners (outer / inner)
  set(33, 0.33, 0.4);
  set(133, 0.43, 0.4);
  set(263, 0.67, 0.4);
  set(362, 0.57, 0.4);
  MIDLINE.forEach((i, j) => {
    if (i === 13 || i === 14) return; // keep the inner lip points
    set(i, midX, 0.2 + (0.7 * j) / MIDLINE.length);
  });
  set(164, midX, 0.62);
  set(0, midX, 0.66);
  set(13, 0.5, 0.7 - open);
  set(14, 0.5, 0.7 + open * 1.3);
  if (!deg) return lms;
  // rotate about the image centre in PIXEL space (normalised coords are anisotropic)
  const a = (deg * Math.PI) / 180;
  return lms.map((p) => {
    const x = (p.x - 0.5) * W;
    const y = (p.y - 0.5) * H;
    return { x: (x * Math.cos(a) - y * Math.sin(a)) / W + 0.5, y: (x * Math.sin(a) + y * Math.cos(a)) / H + 0.5 };
  });
}

describe("lipsFromLandmarks (inner lip loop → 12 lip points)", () => {
  it("follows the defaultLips convention: left corner first, over the top, clockwise on screen", () => {
    const lips = lipsFromLandmarks(face(), W, H, 12)!;
    expect(lips).toHaveLength(12);
    expect(lips[0].x).toBeCloseTo(400, 0);
    expect(lips[6].x).toBeCloseTo(600, 0);
    for (let i = 1; i < 6; i++) {
      expect(lips[i].y).toBeLessThan(lips[0].y); // upper lip above the corners
      expect(lips[i].x).toBeGreaterThan(lips[i - 1].x);
    }
    for (let i = 7; i < 12; i++) {
      expect(lips[i].y).toBeGreaterThan(lips[0].y); // lower lip below
      expect(lips[i].x).toBeLessThan(lips[i - 1].x);
    }
    expect(signedArea(lips)).toBeGreaterThan(0);
    // same orientation as the app's own default lip line
    expect(Math.sign(signedArea(defaultLips({ x: 500, y: 800 }, 300)))).toBe(1);
  });
  it("starts on the image-left corner even when the landmark loop is mirrored", () => {
    const lips = lipsFromLandmarks(face({ mirror: true }), W, H, 12)!;
    expect(lips[0].x).toBeLessThan(lips[6].x);
    expect(signedArea(lips)).toBeGreaterThan(0);
  });
  it("resamples evenly and supports other even counts; rejects too few landmarks", () => {
    expect(lipsFromLandmarks(face(), W, H, 16)).toHaveLength(16);
    expect(lipsFromLandmarks(face({ n: 100 }), W, H)).toBeNull();
    const line = resamplePolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 5);
    expect(line.map((p) => [p.x, p.y])).toEqual([[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
  });
});

describe("guidesFromLandmarks", () => {
  it("full face: pupils on the iris centres, patient's right pupil on the image LEFT", () => {
    for (const mirror of [false, true]) {
      const g = guidesFromLandmarks(face({ mirror }), W, H, "face")!;
      expect(g.basis).toBe("irises");
      expect(g.guides.pupilR.x).toBeCloseTo(380, 0);
      expect(g.guides.pupilL.x).toBeCloseTo(620, 0);
      expect(g.guides.pupilR.y).toBeCloseTo(480, 0);
    }
  });
  it("midline dot sits at the philtrum on the median midline, also off-centre", () => {
    const g = guidesFromLandmarks(face({ midX: 0.52 }), W, H, "face")!.guides;
    expect(g.midline.x).toBeCloseTo(520, 0);
    expect(g.midline.y).toBeCloseTo(0.64 * H, 0);
  });
  it("tilted head: the pupil line follows the tilt and the midline dot stays on the rotated midline", () => {
    const g = guidesFromLandmarks(face({ deg: 8 }), W, H, "face")!.guides;
    expect((pupilAngle(g) * 180) / Math.PI).toBeCloseTo(8, 1);
    // the midline axis is perpendicular to the pupil line through the rotated (0.5, ·) column: offset along the
    // pupil direction from the image centre must be ~0
    const u = { x: Math.cos((8 * Math.PI) / 180), y: Math.sin((8 * Math.PI) / 180) };
    expect(Math.abs((g.midline.x - W / 2) * u.x + (g.midline.y - H / 2) * u.y)).toBeLessThan(1);
  });
  it("without iris points it falls back to the eye-corner midpoints", () => {
    const g = guidesFromLandmarks(face({ n: 468 }), W, H, "face")!;
    expect(g.basis).toBe("eye corners");
    expect(g.guides.pupilR.x).toBeCloseTo(380, 0);
    expect(g.guides.pupilL.x).toBeCloseTo(620, 0);
  });
  it("close-up: dots on the mouth corners and a dental-midline estimate at the upper lip", () => {
    const g = guidesFromLandmarks(face(), W, H, "closeup")!;
    expect(g.basis).toBe("mouth corners");
    expect(g.guides.pupilR.x).toBeCloseTo(380, 0);
    expect(g.guides.pupilL.x).toBeCloseTo(620, 0);
    expect(g.guides.midline.x).toBeCloseTo(500, 0);
    expect(g.guides.midline.y).toBeLessThan(0.7 * H);
    expect(g.guides.midline.y).toBeGreaterThan(0.66 * H);
  });
  it("degenerate landmarks give no proposal", () => {
    const lms = face().map(() => ({ x: 0.5, y: 0.5 }));
    expect(guidesFromLandmarks(lms, W, H)).toBeNull();
  });
});

describe("tap-to-outline: segmentation → mask", () => {
  const mw = 200;
  const mh = 240;
  const lips = defaultLips({ x: 500, y: 800 }, 400); // image px (W × H), mask is W/5
  const crop = cropAroundLips(lips, W, H, 0.25);
  /** confidence over the crop with discs at image points (radius in image px) */
  const conf = (discs: { x: number; y: number; r: number }[], cw = 128, ch = 96) => {
    const c = new Float32Array(cw * ch);
    for (let v = 0; v < ch; v++)
      for (let u = 0; u < cw; u++) {
        const x = crop.x + ((u + 0.5) / cw) * crop.w;
        const y = crop.y + ((v + 0.5) / ch) * crop.h;
        if (discs.some((d) => Math.hypot(x - d.x, y - d.y) < d.r)) c[v * cw + u] = 0.9;
      }
    return { c, cw, ch };
  };

  it("crop covers the lips with padding and stays inside the image", () => {
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.w).toBeLessThanOrEqual(W);
    for (const p of lips) {
      expect(p.x).toBeGreaterThan(crop.x);
      expect(p.x).toBeLessThan(crop.x + crop.w);
    }
  });
  it("keeps only the part under the tap, clipped to the lip contour", () => {
    const { c, cw, ch } = conf([
      { x: 480, y: 780, r: 30 },
      { x: 600, y: 780, r: 30 },
      { x: 480, y: 600, r: 30 }, // outside the lips
    ]);
    const r = regionFromConfidence(c, cw, ch, crop, W, H, mw, mh, { x: 480, y: 780 }, lips);
    const n = maskArea({ data: r });
    expect(n).toBeGreaterThan(80);
    expect(r[Math.round(780 / 5) * mw + Math.round(600 / 5)]).toBe(0); // the other blob is not taken
    expect(r[Math.round(600 / 5) * mw + Math.round(480 / 5)]).toBe(0);
    // disc area in mask px is ~π·6² ≈ 113
    expect(n).toBeLessThan(160);
  });
  it("a tap just beside a region picks the nearest one; far away gives nothing", () => {
    const { c, cw, ch } = conf([{ x: 500, y: 790, r: 25 }]);
    const near = regionFromConfidence(c, cw, ch, crop, W, H, mw, mh, { x: 535, y: 790 }, lips);
    expect(maskArea({ data: near })).toBeGreaterThan(40);
    const far = regionFromConfidence(c, cw, ch, crop, W, H, mw, mh, { x: 680, y: 790 }, lips);
    expect(maskArea({ data: far })).toBe(0);
  });
  it("accepts uint8 confidence (0..255) too", () => {
    const { c, cw, ch } = conf([{ x: 500, y: 790, r: 25 }]);
    const u8 = Uint8Array.from(c, (v) => Math.round(v * 255));
    expect(maskArea({ data: regionFromConfidence(u8, cw, ch, crop, W, H, mw, mh, { x: 500, y: 790 }, lips) })).toBeGreaterThan(40);
  });
  it("keepComponentAt keeps exactly one connected part", () => {
    const m = new Uint8Array(10 * 4);
    m[11] = m[12] = 255; // row 1, x 1–2
    m[17] = 255; // row 1, x 7
    expect(maskArea({ data: keepComponentAt(m, 10, 4, { x: 1.5, y: 1.5 }, 2) })).toBe(2);
    expect(maskArea({ data: keepComponentAt(m, 10, 4, { x: 8.5, y: 2.5 }, 2) })).toBe(1);
    expect(maskArea({ data: keepComponentAt(m, 10, 4, { x: 4.5, y: 3.5 }, 1) })).toBe(0);
  });
  it("mergeRegion adds / erases into a NEW mask and leaves the current one untouched", () => {
    const base = { w: 4, h: 1, data: Uint8Array.from([255, 0, 0, 255]) };
    const region = Uint8Array.from([255, 255, 0, 0]);
    const add = mergeRegion(base, region, "add");
    expect([...add.mask.data]).toEqual([255, 255, 0, 255]);
    expect(add.changed).toBe(1);
    expect(add.mask).not.toBe(base);
    expect(add.mask.data).not.toBe(base.data);
    expect([...base.data]).toEqual([255, 0, 0, 255]);
    const er = mergeRegion(base, region, "erase");
    expect([...er.mask.data]).toEqual([0, 0, 0, 255]);
    expect(er.changed).toBe(1);
    expect(mergeRegion(base, new Uint8Array(4), "add").changed).toBe(0);
  });
});

describe("toothAreaScore", () => {
  it("prefers the candidate nearest one tooth; half and double are equally far; empty never wins", () => {
    expect(toothAreaScore(100, 100)).toBe(0);
    expect(toothAreaScore(50, 100)).toBeCloseTo(toothAreaScore(200, 100), 10);
    expect(toothAreaScore(120, 100)).toBeLessThan(toothAreaScore(300, 100));
    expect(toothAreaScore(0, 100)).toBe(Infinity);
  });
});

describe("frontToothCentres", () => {
  it("six centres, left to right, symmetric about the design centre and level with the pupils", () => {
    const g: Guides = { pupilR: { x: 300, y: 400 }, pupilL: { x: 700, y: 400 }, midline: { x: 500, y: 600 } };
    const d: Design = { ...DEFAULT_DESIGN, center: { x: 500, y: 800 }, width: 300 };
    const c = frontToothCentres(d, g);
    expect(c).toHaveLength(6);
    for (let i = 1; i < 6; i++) expect(c[i].x).toBeGreaterThan(c[i - 1].x);
    for (let i = 0; i < 3; i++) {
      expect(c[i].x - 500).toBeCloseTo(500 - c[5 - i].x, 0);
      expect(c[i].y).toBeCloseTo(c[5 - i].y, 0);
    }
    expect(c[2].y).toBeLessThan(800); // upper teeth: centres above the incisal edge
  });
});

describe("Labs flag", () => {
  it("is OFF by default and only '1' turns it on", () => {
    const store = new Map<string, string>();
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const g = globalThis as { localStorage?: unknown };
    const prev = g.localStorage;
    try {
      delete g.localStorage;
      expect(labsOn()).toBe(false); // no storage at all (private mode): off
      g.localStorage = ls;
      expect(labsOn()).toBe(false);
      setLabs(true);
      expect(store.get(LABS_KEY)).toBe("1");
      expect(labsOn()).toBe(true);
      setLabs(false);
      expect(store.has(LABS_KEY)).toBe(false);
      expect(labsOn()).toBe(false);
    } finally {
      g.localStorage = prev;
    }
  });
});
