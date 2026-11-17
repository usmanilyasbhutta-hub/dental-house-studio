// Pure geometry for the smile design: tooth sizes, positions and outlines. No DOM here (unit-tested).
import type { Design, Guides, Proportion, Pt, ToothShape } from "./model";

/**
 * Perceived (frontal) widths relative to the central incisor: central, lateral, canine, PM1, PM2.
 * The premolar values (index 3, 4) are display approximations: the proportion rules are defined for the six
 * anterior teeth only, premolars just need to keep shrinking plausibly into the buccal corridor.
 */
export const PROPORTIONS: Record<Proportion, { label: string; note: string; ratios: number[] }> = {
  golden: {
    label: "Golden",
    note: "Each tooth looks 61.8 % of the one in front (1.618 : 1 : 0.618). Best suited to long teeth; often looks narrow on normal-length teeth.",
    ratios: [1, 0.618, 0.382, 0.3, 0.22],
  },
  red: {
    label: "RED 70 %",
    note: "Recurring esthetic dental proportion: each tooth looks 70 % of the one in front. Preferred by most dentists for normal-length teeth (Ward 2007).",
    ratios: [1, 0.7, 0.49, 0.38, 0.28],
  },
  natural: {
    label: "Natural",
    note: "Average natural smiles (Preston): lateral ≈ 66 % of central, canine ≈ 84 % of lateral.",
    ratios: [1, 0.66, 0.554, 0.42, 0.32],
  },
};

export const TOOTH_NAMES = ["Central", "Lateral", "Canine", "1st premolar", "2nd premolar"];

/** Length of each tooth relative to the central's length. */
const LENGTH = [1, 0.82, 0.97, 0.78, 0.72];
/** Gingival margin drop below the central's margin (fraction of central length). */
const GINGIVA = [0, 0.095, 0, 0.07, 0.1];
/**
 * Perspective darkening per tooth (buccal corridor). The renderer now uses one warm radial over the whole arch;
 * kept for callers that want a per-tooth value.
 */
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

/** Distal offset of the gingival zenith per tooth kind, fraction of tooth width (Chu 2009, PMID 19368601). */
const ZENITH = [0.12, 0.06, 0, 0, 0];
/** Where the straight sides of the outline start (fraction of length below the zenith). */
const NECK_V = 0.1;

/**
 * Closed outline of one tooth in local design coordinates.
 * Canines get a cusp tip (mesial of centre); premolars are narrower at the incisal (they are seen at an angle).
 * The outline is affine in the box: scaling/translating the box scales/translates the outline the same way.
 */
export function toothOutline(box: ToothBox, shape: ToothShape): Pt[] {
  const s = { ...SHAPES[shape] };
  if (box.kind === 2) Object.assign(s, { incisal: 0.72, convex: 0.1, peak: 0.45 });
  if (box.kind >= 3) Object.assign(s, { incisal: 0.75, convex: 0.08, neck: 0.75 });
  const w = box.x1 - box.x0;
  const h = box.bottom - box.top;
  const cx = (box.x0 + box.x1) / 2;
  // gingival zenith sits distal of the tooth axis
  const zen = box.side * w * ZENITH[box.kind];
  const N = 14;
  const right: Pt[] = [];
  const left: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const v = NECK_V + (i / N) * (1 - NECK_V);
    const hw = halfWidthAt(v, s) * w;
    const y = box.top + v * h;
    right.push({ x: cx + hw, y });
    left.push({ x: cx - hw, y });
  }
  const pts: Pt[] = [];
  // gum line: a round arch (scallop) from the left side up through the zenith to the right side
  const neckHw = halfWidthAt(NECK_V, s) * w;
  const zt = zen / neckHw;
  for (let i = 0; i <= 10; i++) {
    const t = -1 + (i / 10) * 2;
    const u = t < zt ? (t - zt) / (1 + zt) : (t - zt) / (1 - zt);
    // blend of a circular and a parabolic arch: round at the zenith, no corner where it meets the sides
    const arch = 0.5 * (1 - Math.sqrt(Math.max(0, 1 - u * u))) + 0.5 * u * u;
    pts.push({ x: cx + t * neckHw, y: box.top + NECK_V * h * arch });
  }
  pts.push(...right.slice(1));
  // incisal edge, slightly convex (or a cusp for canines, its tip mesial of centre)
  const incHw = halfWidthAt(1, s) * w;
  const tip = box.kind === 2 ? -box.side * 0.15 : 0;
  for (let i = 1; i < 8; i++) {
    const t = 1 - (i / 8) * 2;
    const y = box.bottom + s.convex * h * (1 - ((t - tip) / (1 + Math.abs(tip))) ** 2);
    pts.push({ x: cx + t * incHw, y });
  }
  pts.push(...left.slice(1).reverse());
  return chaikin(pts, 3);
}

/** Unit box used to cache outlines: toothOutline(box) == mapUnit(toothOutline(unitBox(kind, side)), box). */
export function unitBox(kind: number, side: -1 | 1): ToothBox {
  return { kind, side, x0: 0, x1: 1, top: 0, bottom: 1 };
}

/**
 * Index range [start, end) (wrapping, end may exceed length) of the outline points that are NOT the incisal
 * edge, i.e. the gum arch and both sides. Used to draw contact shadows without a line on the incisal edge.
 * `frac` is the fraction of the length (from the top) where the incisal part starts.
 */
export function outlineSides(pts: Pt[], box: ToothBox, frac = 0.82): { start: number; end: number } {
  const lim = box.top + (box.bottom - box.top) * frac;
  const n = pts.length;
  // first incisal point, then the first non-incisal point after it: the sides run from there around
  let i0 = -1;
  for (let i = 0; i < n; i++) if (pts[i].y > lim && pts[(i - 1 + n) % n].y <= lim) i0 = i;
  if (i0 < 0) return { start: 0, end: n };
  let j = i0;
  while (pts[j % n].y > lim && j < i0 + n) j++;
  const start = j % n;
  return { start, end: start + n - (j - i0) };
}

/** Axis-aligned bounds of points. */
export function bounds(pts: Pt[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/**
 * Centres of a rotated, repeated watermark grid over a w×h panel, skipping tiles whose (tw×th, unrotated
 * approximation) box overlaps the `avoid` rectangle (the teeth). `step` is the grid spacing, `angle` in radians.
 */
export function watermarkTiles(
  w: number,
  h: number,
  step: number,
  angle: number,
  tile: { w: number; h: number },
  avoid?: { x0: number; y0: number; x1: number; y1: number },
): Pt[] {
  const out: Pt[] = [];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const R = Math.hypot(w, h);
  // rotated tile extent in image axes
  const ex = (Math.abs(c) * tile.w + Math.abs(s) * tile.h) / 2;
  const ey = (Math.abs(s) * tile.w + Math.abs(c) * tile.h) / 2;
  for (let j = -Math.ceil(R / step); j <= Math.ceil(R / step); j++) {
    for (let i = -Math.ceil(R / step); i <= Math.ceil(R / step); i++) {
      // grid in rotated space, every other row offset by half a step
      const gx = (i + (j & 1 ? 0.5 : 0)) * step;
      const gy = j * step * 0.6;
      const x = w / 2 + gx * c - gy * s;
      const y = h / 2 + gx * s + gy * c;
      if (x < -ex * 0.5 || x > w + ex * 0.5 || y < -ey * 0.5 || y > h + ey * 0.5) continue;
      if (avoid && x + ex > avoid.x0 && x - ex < avoid.x1 && y + ey > avoid.y0 && y - ey < avoid.y1) continue;
      out.push({ x, y });
    }
  }
  return out;
}

/**
 * Layout of the export label band: one line (label left, brand right) when both fit with a gap, shrinking
 * both down to `minOne` if needed; otherwise two lines (label, then brand). Widths are measured at the base
 * font size; returns the scale to apply to both so nothing overlaps or runs off the edge.
 */
export function bandLayout(width: number, pad: number, labelW: number, brandW: number, gap: number, minOne = 0.8) {
  const avail = width - 2 * pad;
  const one = avail / (labelW + gap + brandW);
  if (one >= 1) return { lines: 1 as const, scale: 1 };
  if (one >= minOne) return { lines: 1 as const, scale: one };
  const widest = Math.max(labelW, brandW);
  return { lines: 2 as const, scale: Math.min(1, avail / widest) };
}

/**
 * Alpha used to composite the mockup layer. With the mouth/gum backdrop on, the default opacity (0.92) already
 * covers fully so the old teeth never ghost through the dark mouth; lower values still fade it out. Without a
 * backdrop the opacity is used as is (see-through over the patient's own teeth).
 */
export function mockupAlpha(opacity: number, backdrop: boolean | undefined) {
  const o = Math.max(0, Math.min(1, opacity));
  return backdrop === false ? o : Math.min(1, o / 0.92);
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
