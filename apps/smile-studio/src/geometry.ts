// Pure geometry for the smile design: tooth sizes, positions and outlines. No DOM here (unit-tested).
import type { Design, Guides, Proportion, Pt, ToothShape } from "./model";

/** Perceived (frontal) widths relative to the central incisor: central, lateral, canine, PM1, PM2. */
export const PROPORTIONS: Record<Proportion, { label: string; note: string; ratios: number[] }> = {
  golden: {
    label: "Golden",
    note: "Each tooth looks 61.8 % of the one in front (1.618 : 1 : 0.618).",
    ratios: [1, 0.618, 0.382, 0.236, 0.146],
  },
  red: {
    label: "RED 70 %",
    note: "Recurring esthetic dental proportion: each tooth looks 70 % of the one in front.",
    ratios: [1, 0.7, 0.49, 0.343, 0.24],
  },
  natural: {
    label: "Natural",
    note: "Average natural smiles (lateral ≈ 66 % of central, canine ≈ 84 % of lateral).",
    ratios: [1, 0.66, 0.554, 0.42, 0.32],
  },
};

export const TOOTH_NAMES = ["Central", "Lateral", "Canine", "1st premolar", "2nd premolar"];

/** Length of each tooth relative to the central's length. */
const LENGTH = [1, 0.82, 0.94, 0.78, 0.72];
/** Gingival margin drop below the central's margin (fraction of central length). */
const GINGIVA = [0, 0.08, 0, 0.07, 0.1];
/** Perspective darkening per tooth (buccal corridor). */
export const DARKEN = [0, 0.03, 0.08, 0.16, 0.24];

export interface ToothBox {
  /** 0 = central … 4 = 2nd premolar */
  kind: number;
  /** -1 = patient's right (image left), +1 = patient's left (image right) */
  side: -1 | 1;
  /** Local (unrotated) frame, origin at design.center, x to the image right, y down. */
  x0: number;
  x1: number;
  top: number;
  bottom: number;
}

export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;

/** Angle of the inter-pupillary line in radians (0 = level). */
export function pupilAngle(g: Guides) {
  return Math.atan2(g.pupilL.y - g.pupilR.y, g.pupilL.x - g.pupilR.x);
}

export function designAngle(d: Design, g: Guides) {
  return pupilAngle(g) + rad(d.tilt);
}

export function centralWidth(d: Design) {
  const r = PROPORTIONS[d.proportion].ratios;
  // width spans 2 × (central + lateral + canine)
  return d.width / (2 * (r[0] + r[1] + r[2]));
}

export function centralLength(d: Design) {
  return centralWidth(d) / d.wl;
}

/** Tooth boxes in the design's local frame. */
export function toothBoxes(d: Design): ToothBox[] {
  const r = PROPORTIONS[d.proportion].ratios;
  const cw = centralWidth(d);
  const L = centralLength(d);
  const perSide = d.count / 2;
  const half = d.width / 2;
  const boxes: ToothBox[] = [];
  for (const side of [-1, 1] as const) {
    let edge = 0;
    for (let k = 0; k < perSide; k++) {
      const w = cw * r[k];
      const a = edge;
      const b = edge + w;
      edge = b;
      const mid = (a + b) / 2;
      // smile arc: incisal edges rise away from the midline
      const xn = Math.min(mid / half, 1.6);
      const lift = d.arc * 0.35 * L * xn * xn;
      const step = k === 1 ? d.lateralStep * L : k >= 3 ? d.lateralStep * 0.4 * L : 0;
      const top = -L + GINGIVA[k] * L - lift * 0.35;
      const bottom = top + LENGTH[k] * L;
      const incisal = Math.min(bottom, -lift - step + (k === 2 ? 0.02 * L : 0));
      boxes.push({
        kind: k,
        side,
        x0: side === 1 ? a : -b,
        x1: side === 1 ? b : -a,
        top,
        bottom: Math.max(incisal, top + L * 0.4),
      });
    }
  }
  return boxes;
}

/** Shape profile: neck width, where the tooth is widest, incisal width, incisal edge convexity. */
const SHAPES: Record<ToothShape, { neck: number; peak: number; incisal: number; convex: number; label: string }> = {
  square: { neck: 0.8, peak: 0.3, incisal: 1, convex: 0.01, label: "Square" },
  oval: { neck: 0.66, peak: 0.55, incisal: 0.8, convex: 0.06, label: "Oval" },
  triangular: { neck: 0.56, peak: 0.95, incisal: 1, convex: 0.02, label: "Triangular" },
  soft: { neck: 0.72, peak: 0.45, incisal: 0.93, convex: 0.035, label: "Soft square" },
};
export const SHAPE_LABELS = Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.label])) as Record<
  ToothShape,
  string
>;

function halfWidthAt(v: number, s: (typeof SHAPES)[ToothShape]) {
  // v: 0 at the gum, 1 at the incisal edge. Returns half width as a fraction of the tooth width.
  let f: number;
  if (v <= s.peak) {
    const t = v / s.peak;
    f = s.neck + (1 - s.neck) * Math.sin((t * Math.PI) / 2);
  } else {
    const t = (v - s.peak) / (1 - s.peak);
    f = 1 + (s.incisal - 1) * t * t;
  }
  return 0.5 * f;
}

function chaikin(pts: Pt[], iterations: number): Pt[] {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const out: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    p = out;
  }
  return p;
}

/**
 * Closed outline of one tooth in local design coordinates.
 * Canines get a cusp tip; premolars are narrower at the incisal (they are seen at an angle).
 */
export function toothOutline(box: ToothBox, shape: ToothShape): Pt[] {
  const s = { ...SHAPES[shape] };
  if (box.kind === 2) Object.assign(s, { incisal: 0.7, convex: 0.12, peak: 0.45 });
  if (box.kind >= 3) Object.assign(s, { incisal: 0.75, convex: 0.08, neck: 0.75 });
  const w = box.x1 - box.x0;
  const h = box.bottom - box.top;
  const cx = (box.x0 + box.x1) / 2;
  // gingival zenith sits slightly distal on centrals and canines
  const zen = box.kind === 0 || box.kind === 2 ? box.side * w * 0.06 : 0;
  const N = 14;
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const v = 0.08 + (i / N) * 0.92;
    const hw = halfWidthAt(v, s) * w;
    const y = box.top + v * h;
    right.push({ x: cx + hw, y });
    left.push({ x: cx - hw, y });
  }
  const pts: Pt[] = [];
  // gum line: an arch (scallop) from left side up through the zenith to the right side
  const neckHw = halfWidthAt(0.08, s) * w;
  const zt = zen / neckHw;
  for (let i = 0; i <= 8; i++) {
    const t = -1 + (i / 8) * 2;
    const u = t < zt ? (t - zt) / (1 + zt) : (t - zt) / (1 - zt);
    pts.push({ x: cx + t * neckHw, y: box.top + 0.08 * h * u * u });
  }
  pts.push(...right.slice(1));
  // incisal edge, slightly convex (or a cusp for canines)
  const incHw = halfWidthAt(1, s) * w;
  for (let i = 1; i < 8; i++) {
    const t = 1 - (i / 8) * 2;
    pts.push({ x: cx + t * incHw, y: box.bottom + s.convex * h * (1 - t * t) });
  }
  pts.push(...left.slice(1).reverse());
  return chaikin(pts, 2);
}

/** Map a local design point to image coordinates. */
export function toImage(p: Pt, d: Design, angle: number): Pt {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: d.center.x + p.x * c - p.y * s, y: d.center.y + p.x * s + p.y * c };
}

export function toLocal(p: Pt, d: Design, angle: number): Pt {
  const dx = p.x - d.center.x;
  const dy = p.y - d.center.y;
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** Closed Catmull-Rom spline through the points, sampled for drawing / clipping. */
export function smoothClosed(pts: Pt[], samples = 8): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let j = 0; j < samples; j++) {
      const t = j / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, e: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - e) * t2 + (-a + 3 * b - 3 * c + e) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  return out;
}

/** Handles for direct manipulation of the design (image coords). */
export function designHandles(d: Design, angle: number) {
  const L = centralLength(d);
  return {
    move: toImage({ x: 0, y: L * 0.6 }, d, angle),
    widthR: toImage({ x: d.width / 2, y: -L * 0.3 }, d, angle),
    widthL: toImage({ x: -d.width / 2, y: -L * 0.3 }, d, angle),
    length: toImage({ x: 0, y: -L }, d, angle),
  };
}

export interface Measurements {
  centralW: number;
  centralL: number;
  wlPct: number;
  /** degrees between the incisal plane and the pupil line */
  cant: number;
  /** midline deviation of the design from the facial midline, px (signed) */
  midlineDev: number;
  widths: number[];
  pxPerMm?: number;
}

/**
 * Measurements of the design. mm values need a photo calibration: the clinician taps both edges of the patient's
 * existing central (calib) and enters its width measured in the mouth (centralMm).
 */
export function measure(d: Design, g: Guides, centralMm?: number, calib?: { a: Pt; b: Pt }): Measurements {
  const cw = centralWidth(d);
  const cl = centralLength(d);
  const pa = pupilAngle(g);
  // distance of design center from the facial midline (line through g.midline perpendicular to pupil line)
  const dx = d.center.x - g.midline.x;
  const dy = d.center.y - g.midline.y;
  const midlineDev = dx * Math.cos(pa) + dy * Math.sin(pa);
  const r = PROPORTIONS[d.proportion].ratios;
  return {
    centralW: cw,
    centralL: cl,
    wlPct: Math.round(d.wl * 100),
    cant: d.tilt,
    midlineDev,
    widths: r.slice(0, d.count / 2).map((k) => cw * k),
    pxPerMm: centralMm && calib && dist(calib.a, calib.b) > 2 ? dist(calib.a, calib.b) / centralMm : undefined,
  };
}

export function dist(a: Pt, b: Pt) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Smile-arc value that makes the incisal edges follow the lower lip (inner contour).
 * Uses the lower half of the lip points that lie within the design width, fits y = c·x² in the design frame.
 */
export function fitArcToLowerLip(lips: Pt[], d: Design, g: Guides): number {
  const a = designAngle(d, g);
  const half = d.width / 2;
  const local = lips.map((p) => toLocal(p, d, a)).filter((p) => p.y > -centralLength(d) * 0.3 && Math.abs(p.x) <= half * 1.4);
  if (local.length < 3) return d.arc;
  // lowest (largest y) point near the midline is the lip's reference
  const y0 = Math.max(...local.filter((p) => Math.abs(p.x) < half * 0.4).map((p) => p.y), ...local.map((p) => p.y));
  let num = 0;
  let den = 0;
  for (const p of local) {
    const x2 = p.x * p.x;
    num += x2 * (y0 - p.y);
    den += x2 * x2;
  }
  if (den === 0) return d.arc;
  const c = num / den; // rise per x² (px)
  const arc = (c * half * half) / (0.35 * centralLength(d));
  return Math.min(1, Math.max(0, arc));
}
