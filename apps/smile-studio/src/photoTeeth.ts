// Photo-realistic teeth: the planned teeth are rebuilt FROM THE PATIENT'S OWN TOOTH PIXELS.
//
// Everything happens in a "canonical grid": the photo resampled into the design frame (rotated by the design angle,
// mirrored for the lower arch) so that in every case the gum is at the top and the incisal edges point down, and each
// tooth is a set of columns. The pipeline (pure, no DOM, unit-testable):
//   1. analyse(): per source column, the existing tooth run (cervical start, incisal end, whether the edge is visible
//      or hidden behind the opposing arch); per planned boundary, the matching existing interproximal boundary.
//   2. synthesise(): for every planned-tooth pixel, a source position in the existing teeth (piecewise-linear
//      horizontal map between matched boundaries, then a per-column vertical stretch/compression of the incisal half
//      so the existing incisal edge, with its translucency, lands on the planned edge), sampled and recoloured in Lab
//      toward the target shade (offsets keep texture, highlights and translucency). Where existing tooth lies beyond
//      the planned edge it is replaced by the surrounding background (push-pull inpainting from non-tooth pixels).
//      Grain is matched to the photo; edges are feathered.
// The canvas wrapper (drawPhotoTeeth) only reads the photo once, writes the result into an offscreen canvas and
// composites it clipped to the lip contour: the photo itself and the lips are never modified.
import type { Mask } from "./contracts";
import { archFlip, centralLength, designAngle, isLower, plannedOutlines, smoothClosed, type ToothBox } from "./geometry";
import type { Design, Pt } from "./model";
import { labToRgb, rgbToLab, shadeLab, SRGB_TO_LIN } from "./shades";
import { detectTeeth, maskVersion, rasterPolygon } from "./teethMask";

export interface EngineScene {
  img: CanvasImageSource;
  imgW: number;
  imgH: number;
  guides: { pupilR: Pt; pupilL: Pt; midline: Pt };
  lips: Pt[];
  design: Design;
  /** Existing-teeth mask (clinician-corrected); detected automatically when missing. */
  existing?: Mask;
}

// ---------- canonical frame ----------
export interface Frame {
  angle: number;
  fy: 1 | -1;
  /** grid px per image px */
  k: number;
  ox: number;
  oy: number;
  u0: number;
  v0: number;
  gw: number;
  gh: number;
}

export function imageToGrid(f: Frame, x: number, y: number, out: { x: number; y: number }) {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const dx = x - f.ox;
  const dy = y - f.oy;
  out.x = f.k * (dx * c + dy * s) - f.u0;
  out.y = f.k * f.fy * (-dx * s + dy * c) - f.v0;
  return out;
}

export function gridToImage(f: Frame, u: number, v: number, out: { x: number; y: number }) {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const lx = (u + f.u0) / f.k;
  const ly = ((v + f.v0) / f.k) * f.fy;
  out.x = f.ox + lx * c - ly * s;
  out.y = f.oy + lx * s + ly * c;
  return out;
}

/** Canvas transform (a b c d e f) mapping grid px to image px. */
export function gridMatrix(f: Frame): [number, number, number, number, number, number] {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  const k = f.k;
  const o = gridToImage(f, 0, 0, { x: 0, y: 0 });
  return [c / k, s / k, (-s * f.fy) / k, (c * f.fy) / k, o.x, o.y];
}

/**
 * Frame covering the lip contour (or the design area) at `k` grid px per image px. The origin is the lip bounds
 * centre, so moving or resizing the design never changes the frame (the resampled photo stays cached while dragging).
 */
export function makeFrame(s: Pick<EngineScene, "lips" | "design" | "guides" | "imgW" | "imgH">, k: number): Frame {
  const d = s.design;
  const angle = designAngle(d, s.guides);
  const fy = archFlip(d);
  let pts: Pt[];
  if (s.lips.length >= 3) pts = s.lips;
  else {
    const L = centralLength(d);
    pts = [
      { x: d.center.x - d.width, y: d.center.y - L * 1.8 },
      { x: d.center.x + d.width, y: d.center.y + L * 1.8 },
    ];
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  // round the origin so tiny lip edits don't shift the grid by sub-pixels
  const f: Frame = { angle, fy, k, ox: Math.round((x0 + x1) / 2), oy: Math.round((y0 + y1) / 2), u0: 0, v0: 0, gw: 1, gh: 1 };
  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;
  const q = { x: 0, y: 0 };
  for (const [x, y] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ]) {
    imageToGrid(f, x, y, q);
    u0 = Math.min(u0, q.x);
    u1 = Math.max(u1, q.x);
    v0 = Math.min(v0, q.y);
    v1 = Math.max(v1, q.y);
  }
  f.u0 = Math.floor(u0) - 2;
  f.v0 = Math.floor(v0) - 2;
  f.gw = Math.max(1, Math.ceil(u1 - u0) + 4);
  f.gh = Math.max(1, Math.ceil(v1 - v0) + 4);
  return f;
}

// ---------- resampling into the grid (pure) ----------
/** Bilinear sample of an RGBA region (image px rect rx, ry, rw, rh) into the grid, as Lab (3 floats per px). */
export function resampleLab(f: Frame, rgba: Uint8ClampedArray | Uint8Array, rx: number, ry: number, rw: number, rh: number): Float32Array {
  const out = new Float32Array(f.gw * f.gh * 3);
  const p = { x: 0, y: 0 };
  const lab = new Float32Array(3);
  // incremental affine walk
  gridToImage(f, 0.5, 0.5, p);
  const bx = p.x - rx - 0.5;
  const by = p.y - ry - 0.5;
  const c = Math.cos(f.angle) / f.k;
  const s = Math.sin(f.angle) / f.k;
  const dxu = c;
  const dyu = s;
  const dxv = -s * f.fy;
  const dyv = c * f.fy;
  for (let v = 0; v < f.gh; v++) {
    for (let u = 0; u < f.gw; u++) {
      let x = bx + u * dxu + v * dxv;
      let y = by + u * dyu + v * dyv;
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x > rw - 1.001) x = rw - 1.001;
      if (y > rh - 1.001) y = rh - 1.001;
      const xi = x | 0;
      const yi = y | 0;
      const fx = x - xi;
      const fy2 = y - yi;
      const i00 = (yi * rw + xi) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + rw * 4;
      const i11 = i01 + 4;
      const w00 = (1 - fx) * (1 - fy2);
      const w10 = fx * (1 - fy2);
      const w01 = (1 - fx) * fy2;
      const w11 = fx * fy2;
      // interpolate in linear light, then to Lab
      const r = w00 * SRGB_TO_LIN[rgba[i00]] + w10 * SRGB_TO_LIN[rgba[i10]] + w01 * SRGB_TO_LIN[rgba[i01]] + w11 * SRGB_TO_LIN[rgba[i11]];
      const g =
        w00 * SRGB_TO_LIN[rgba[i00 + 1]] + w10 * SRGB_TO_LIN[rgba[i10 + 1]] + w01 * SRGB_TO_LIN[rgba[i01 + 1]] + w11 * SRGB_TO_LIN[rgba[i11 + 1]];
      const b =
        w00 * SRGB_TO_LIN[rgba[i00 + 2]] + w10 * SRGB_TO_LIN[rgba[i10 + 2]] + w01 * SRGB_TO_LIN[rgba[i01 + 2]] + w11 * SRGB_TO_LIN[rgba[i11 + 2]];
      linToLab(r, g, b, lab);
      const o = (v * f.gw + u) * 3;
      out[o] = lab[0];
      out[o + 1] = lab[1];
      out[o + 2] = lab[2];
    }
  }
  return out;
}

const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
function linToLab(R: number, G: number, B: number, out: Float32Array) {
  const x = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = labF(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  out[0] = 116 * y - 16;
  out[1] = 500 * (x - y);
  out[2] = 200 * (y - z);
}

/** Bilinear sample of a w × h single-channel mask (0..255 or 0..1 via `scale`) into the grid, 0..1. */
export function resampleMask(f: Frame, m: Mask, imgW: number, imgH: number): Float32Array {
  const out = new Float32Array(f.gw * f.gh);
  const sx = m.w / imgW;
  const sy = m.h / imgH;
  const p = { x: 0, y: 0 };
  for (let v = 0; v < f.gh; v++) {
    for (let u = 0; u < f.gw; u++) {
      gridToImage(f, u + 0.5, v + 0.5, p);
      let x = p.x * sx - 0.5;
      let y = p.y * sy - 0.5;
      if (x < 0 || y < 0 || x > m.w - 1 || y > m.h - 1) {
        if (x < -1 || y < -1 || x > m.w || y > m.h) continue;
        x = Math.min(m.w - 1, Math.max(0, x));
        y = Math.min(m.h - 1, Math.max(0, y));
      }
      const xi = Math.min(m.w - 2, x | 0);
      const yi = Math.min(m.h - 2, y | 0);
      const fx = Math.min(1, x - xi);
      const fy2 = Math.min(1, y - yi);
      const i = yi * m.w + xi;
      const d = m.data;
      const val = (1 - fy2) * ((1 - fx) * d[i] + fx * d[i + 1]) + fy2 * ((1 - fx) * d[i + m.w] + fx * d[i + m.w + 1]);
      out[v * f.gw + u] = val / 255;
    }
  }
  return out;
}

/** Lip coverage in the grid (all ones without a contour). */
export function lipGrid(f: Frame, lips: Pt[]): Float32Array {
  const acc = new Float32Array(f.gw * f.gh);
  if (lips.length < 3) return acc.fill(1);
  const q = { x: 0, y: 0 };
  const pts = smoothClosed(lips).map((p) => {
    imageToGrid(f, p.x, p.y, q);
    return { x: q.x, y: q.y };
  });
  rasterPolygon(acc, f.gw, f.gh, pts);
  for (let i = 0; i < acc.length; i++) if (acc[i] > 1) acc[i] = 1;
  return acc;
}

// ---------- plan in the grid ----------
export interface PlanTooth {
  box: ToothBox;
  /** grid columns spanned [c0, c1) */
  c0: number;
  c1: number;
  /** box in grid px */
  gx0: number;
  gx1: number;
  gtop: number;
  gbottom: number;
  poly: Pt[];
}

export interface Plan {
  teeth: PlanTooth[];
  /** columns covered only by the embrasure fill between two outlines */
  joined: Uint8Array;
  /** dentist-set edge of the opposing teeth per grid column (grid y; NaN outside), or null */
  opp: Float32Array | null;
  /** union of the planned outlines per grid column: top / bottom (NaN outside) */
  pTop: Float32Array;
  pBot: Float32Array;
  /** grid columns of the arch [x0, x1) */
  x0: number;
  x1: number;
  /** central length in grid px */
  L: number;
  lower: boolean;
}

/** The dentist's opposing-teeth edge (image polyline) as a grid y per column, interpolated, flat beyond the ends. */
export function opposingInGrid(f: Frame, d: Design): Float32Array | null {
  const pts = d.opposing;
  if (!pts || pts.length < 2) return null;
  const q = { x: 0, y: 0 };
  const g = pts.map((p) => {
    imageToGrid(f, p.x, p.y, q);
    return { x: q.x, y: q.y };
  }).sort((a, b) => a.x - b.x);
  const out = new Float32Array(f.gw).fill(NaN);
  for (let x = 0; x < f.gw; x++) {
    const xc = x + 0.5;
    let y: number;
    if (xc <= g[0].x) y = g[0].y;
    else if (xc >= g[g.length - 1].x) y = g[g.length - 1].y;
    else {
      let i = 0;
      while (i + 1 < g.length && g[i + 1].x < xc) i++;
      const t = (xc - g[i].x) / Math.max(1e-6, g[i + 1].x - g[i].x);
      y = g[i].y + t * (g[i + 1].y - g[i].y);
    }
    out[x] = y;
  }
  return out;
}

export function planInGrid(f: Frame, d: Design): Plan {
  const outlines = plannedOutlines(d, f.angle);
  const q = { x: 0, y: 0 };
  const cg = imageToGrid(f, d.center.x, d.center.y, { x: 0, y: 0 });
  const pTop = new Float32Array(f.gw).fill(NaN);
  const pBot = new Float32Array(f.gw).fill(NaN);
  const teeth: PlanTooth[] = [];
  let ax0 = Infinity;
  let ax1 = -Infinity;
  for (const o of outlines) {
    const poly = o.pts.map((p) => {
      imageToGrid(f, p.x, p.y, q);
      return { x: q.x, y: q.y };
    });
    let mx0 = Infinity;
    let mx1 = -Infinity;
    for (const p of poly) {
      mx0 = Math.min(mx0, p.x);
      mx1 = Math.max(mx1, p.x);
    }
    const c0 = Math.max(0, Math.floor(mx0));
    const c1 = Math.min(f.gw, Math.ceil(mx1));
    ax0 = Math.min(ax0, c0);
    ax1 = Math.max(ax1, c1);
    // vertical extent of the polygon per column (crossings at the column centre)
    const n = poly.length;
    for (let c = c0; c < c1; c++) {
      const xc = c + 0.5;
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < n; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % n];
        if ((a.x <= xc && b.x > xc) || (b.x <= xc && a.x > xc)) {
          const y = a.y + ((xc - a.x) / (b.x - a.x)) * (b.y - a.y);
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
      }
      if (hi > lo) {
        if (!(pTop[c] <= lo)) pTop[c] = lo;
        if (!(pBot[c] >= hi)) pBot[c] = hi;
      }
    }
    const b = o.box;
    teeth.push({
      box: b,
      c0,
      c1,
      gx0: cg.x + f.k * b.x0,
      gx1: cg.x + f.k * b.x1,
      gtop: cg.y + f.k * b.top,
      gbottom: cg.y + f.k * b.bottom,
      poly,
    });
  }
  /** 1 where a column is only covered by the embrasure fill below (not by a planned outline itself) */
  const joined = new Uint8Array(f.gw);
  // columns between two outlines that only touch at the contact: take the shallower neighbour (a tiny embrasure)
  for (let c = Math.max(1, ax0); c < Math.min(f.gw - 1, ax1); c++) {
    if (pBot[c] === pBot[c]) continue;
    let l = c - 1;
    let r = c + 1;
    while (l > ax0 && pBot[l] !== pBot[l]) l--;
    while (r < ax1 - 1 && pBot[r] !== pBot[r]) r++;
    if (pBot[l] === pBot[l] && pBot[r] === pBot[r] && r - l <= 4) {
      pBot[c] = Math.min(pBot[l], pBot[r]);
      pTop[c] = Math.max(pTop[l], pTop[r]);
      joined[c] = 1;
    }
  }
  return { teeth, pTop, pBot, joined, opp: opposingInGrid(f, d), x0: ax0 === Infinity ? 0 : ax0, x1: ax1 === -Infinity ? 0 : ax1, L: centralLength(d) * f.k, lower: isLower(d) };
}

// ---------- column analysis ----------
export interface Analysis {
  plan: Plan;
  /** existing run per SOURCE column: cervical start / incisal end (NaN = no tooth in this column) */
  eC: Float32Array;
  eI: Float32Array;
  /** 1 when the run's incisal end is a visible edge (not hidden behind the opposing arch / cut at the search limit) */
  edge: Uint8Array;
  /** 1 when the run ends at another tooth (opposing arch in front): the planned tooth stops there, never paints over it */
  hidden: Uint8Array;
  /** fitted occlusal curve per grid column (NaN when not found) */
  occl: Float32Array | null;
  /** planned incisal limit actually drawn per destination column (planned edge, or the occluding tooth) */
  pEnd: Float32Array;
  /** horizontal map: destination column → source column (float) */
  X: Float32Array;
  /** planned boundaries and their matched existing boundaries (grid x), sorted left → right */
  bP: number[];
  bE: number[];
  bFound: boolean[];
  /** measured gap edges per boundary (equal to bE for a normal contact): left tooth ends / right tooth starts */
  gEL: number[];
  gER: number[];
  /** planned-tooth coverage T, existing-tooth E, added (T∖E) and reduced (E beyond the planned edge) masks, 0..1 */
  T: Float32Array;
  add: Float32Array;
  reduce: Float32Array;
  /** destination column: cervical line used (existing gum) */
  cDst: Float32Array;
}

function median3(a: Float32Array) {
  const o = a.slice();
  for (let i = 1; i < a.length - 1; i++) {
    const x = a[i - 1];
    const y = a[i];
    const z = a[i + 1];
    if (x !== x || y !== y || z !== z) continue;
    o[i] = Math.max(Math.min(x, y), Math.min(Math.max(x, y), z));
  }
  return o;
}

/** Box smoothing that ignores NaNs (NaN stays NaN). */
function smoothNaN(a: Float32Array, r: number) {
  const o = a.slice();
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== a[i]) continue;
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(a.length - 1, i + r); j++) {
      if (a[j] === a[j]) {
        s += a[j];
        n++;
      }
    }
    o[i] = s / n;
  }
  return o;
}

/** Fills NaNs inside [x0, x1) by linear interpolation between the nearest known values (or nearest one). */
/** True when pixel j sits in a thin (≤ 2 px) vertical gap with existing tooth on both sides in its row. */
function contactLine(E: Float32Array, j: number, x: number, gw: number): boolean {
  if (E[j] >= 0.5) return false; // a pixel the mask calls tooth is not a gap line
  let l = false;
  let r = false;
  for (let d = 1; d <= 3; d++) {
    if (x - d >= 0 && E[j - d] >= 0.5) l = true;
    if (x + d < gw && E[j + d] >= 0.5) r = true;
  }
  if (!l || !r) return false;
  // width of the gap in this row
  let w = 1;
  for (let d = 1; d <= 3 && x - d >= 0 && E[j - d] < 0.5; d++) w++;
  for (let d = 1; d <= 3 && x + d < gw && E[j + d] < 0.5; d++) w++;
  return w <= 2;
}

/** 3-tap moving average that skips NaN. */
function smooth3(a: number[]): number[] {
  return a.map((_v, j) => {
    let s = 0;
    let n = 0;
    for (let q = j - 1; q <= j + 1; q++) if (q >= 0 && q < a.length && a[q] === a[q]) (s += a[q]), n++;
    return n ? s / n : NaN;
  });
}

function fillNaN(a: Float32Array, x0: number, x1: number) {
  let last = -1;
  for (let i = x0; i < x1; i++) {
    if (a[i] === a[i]) {
      if (last >= 0 && i - last > 1) for (let j = last + 1; j < i; j++) a[j] = a[last] + ((a[i] - a[last]) * (j - last)) / (i - last);
      else if (last < 0) for (let j = x0; j < i; j++) a[j] = a[i];
      last = i;
    }
  }
  if (last >= 0) for (let j = last + 1; j < x1; j++) a[j] = a[last];
}

function toothAt(plan: Plan, x: number): PlanTooth | undefined {
  let best: PlanTooth | undefined;
  let bd = Infinity;
  for (const t of plan.teeth) {
    const d = x < t.gx0 ? t.gx0 - x : x > t.gx1 ? x - t.gx1 : 0;
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

/**
 * Column analysis of the existing teeth E (grid, 0..1) against the plan. `Lg` (grid Lab, optional) refines the
 * existing incisal edge at a dark line (e.g. where the upper edge meets the lower teeth) and the interproximal
 * boundaries (darker contact lines).
 */
export function analyse(f: Frame, plan: Plan, E: Float32Array, lip: Float32Array, Lg?: Float32Array): Analysis {
  const { gw, gh } = f;
  const eC = new Float32Array(gw).fill(NaN);
  const eI = new Float32Array(gw).fill(NaN);
  const edge = new Uint8Array(gw);
  const hidden = new Uint8Array(gw);
  const L = plan.L;
  const xa = Math.max(0, plan.x0 - Math.ceil(L * 0.3));
  const xb = Math.min(gw, plan.x1 + Math.ceil(L * 0.3));
  // the dentist's line wins over the automatic occlusal curve (and works without the photo)
  const occl = plan.opp ?? (Lg ? occlusalCurve(f, plan, E, lip, Lg, xa, xb) : null);
  for (let x = xa; x < xb; x++) {
    const t = toothAt(plan, x + 0.5);
    if (!t) continue;
    const h = t.gbottom - t.gtop;
    const yLo = Math.max(0, Math.floor(t.gtop - h * 0.6));
    const limit = t.gbottom + Math.max(3, L * 0.3);
    const yHi = Math.min(gh, Math.ceil(limit + 2));
    // the run with the largest overlap with the planned tooth's band
    let bestS = -1;
    let bestE = -1;
    let bestO = 0;
    let s = -1;
    for (let y = yLo; y <= yHi; y++) {
      const on = y < yHi && E[y * gw + x] >= 0.5 && lip[y * gw + x] > 0.5;
      if (on && s < 0) s = y;
      if (!on && s >= 0) {
        const o = Math.min(y, t.gbottom) - Math.max(s, t.gtop);
        if (o > bestO) {
          bestO = o;
          bestS = s;
          bestE = y;
        }
        s = -1;
      }
    }
    if (bestS < 0 || bestO < Math.max(2, h * 0.12)) continue;
    let end = bestE;
    let occ = NaN;
    if (Lg) {
      // body colour of this column (upper/middle part of the run)
      const yB0 = bestS;
      const yB1 = Math.max(bestS + 1, Math.min(bestE, Math.floor(t.gtop + h * 0.55)));
      let sL = 0;
      let sa = 0;
      let sb = 0;
      let n = 0;
      for (let y = yB0; y < yB1; y++) {
        const j = (y * gw + x) * 3;
        sL += Lg[j];
        sa += Lg[j + 1];
        sb += Lg[j + 2];
        n++;
      }
      const mL = n ? sL / n : 0;
      const yStart = Math.max(bestS, Math.floor(t.gtop + h * 0.5));
      // (a) a dark line inside the run (shadow between the arches) ends the tooth: a visible edge
      for (let y = yStart; y < bestE; y++) {
        if (Lg[(y * gw + x) * 3] < mL * 0.72) {
          end = y;
          break;
        }
      }
      // (b) the run crosses the occlusal curve (where this arch meets the opposing teeth): hidden edge
      const oc = occl ? occl[x] : NaN;
      if (end === bestE && oc === oc && oc > bestS + h * 0.3 && oc < bestE - 1) occ = oc;
      void sa;
      void sb;
    }
    // dentist-set opposing edge: everything beyond it is the opposing teeth, whatever the photo shows
    if (plan.opp) {
      const oc = plan.opp[x];
      if (oc === oc && oc > bestS && oc < end) occ = Math.max(bestS + 1, oc);
    }
    eC[x] = bestS;
    eI[x] = end;
    if (occ === occ && occ < end) {
      eI[x] = occ;
      hidden[x] = 1;
    }
    // the run reaching the search limit means the edge is hidden (behind the opposing arch) or cut by the lips
    const lipCut = end < gh && lip[Math.min(gh - 1, end) * gw + x] <= 0.5;
    edge[x] = end < yHi - 1 && !lipCut && !hidden[x] ? 1 : 0;
  }
  // light cleanup of the per-column lines
  const eCm = median3(eC);
  const eIm = smoothNaN(median3(median3(eI)), Math.max(1, Math.round(L * 0.05)));
  eC.set(eCm);
  for (let x = 0; x < gw; x++) if (eI[x] === eI[x]) eI[x] = eIm[x];

  // ---- interproximal boundaries: planned vs existing ----
  const teeth = [...plan.teeth].sort((a, b) => a.gx0 - b.gx0);
  const bP: number[] = [];
  const bands: [number, number, number][] = []; // y0, y1, search half-width
  const nbw: number[] = []; // width of the narrower planned neighbour at each boundary
  /** detected gaps (photo columns x0..x1, darkness threshold, judged on the photo?) */
  const gaps: [number, number, number, boolean][] = [];
  for (let i = 0; i <= teeth.length; i++) {
    const a = teeth[i - 1];
    const b = teeth[i];
    const x = b ? b.gx0 : a.gx1;
    const nb = [a, b].filter(Boolean) as PlanTooth[];
    const top = Math.max(...nb.map((t) => t.gtop));
    const bot = Math.min(...nb.map((t) => t.gbottom));
    const hw = Math.min(...nb.map((t) => t.gx1 - t.gx0)) * 0.35;
    nbw.push(Math.min(...nb.map((t) => t.gx1 - t.gx0)));
    bP.push(x);
    bands.push([top + (bot - top) * 0.25, top + (bot - top) * 0.75, hw]);
  }
  // column profile: mean lightness of tooth pixels in the band (gaps count as 0)
  const bE: number[] = [];
  const bFound: boolean[] = [];
  /** gap edges per boundary (equal to bE for a normal contact): left tooth ends at bL, right tooth starts at bR */
  const bL: number[] = [];
  const bR: number[] = [];
  /** measured gap edges (no inset): the left tooth ends at gEL, the right tooth starts at gER */
  const gEL: number[] = [];
  const gER: number[] = [];
  for (let i = 0; i < bP.length; i++) {
    const [y0, y1, hw] = bands[i];
    const c0 = Math.max(0, Math.floor(bP[i] - hw));
    const c1 = Math.min(gw - 1, Math.ceil(bP[i] + hw));
    const prof: number[] = [];
    const frac: number[] = []; // share of the band rows that are tooth (a true gap is open over the whole contact)
    const rawL: number[] = []; // photo lightness regardless of the mask (a painted mask may cover a real gap)
    for (let x = c0; x <= c1; x++) {
      let acc = 0;
      let n = 0;
      let t = 0;
      let raw = 0;
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(gh, Math.ceil(y1)); y++) {
        const j = y * gw + x;
        if (lip[j] <= 0.5) continue;
        const e = E[j];
        acc += Lg ? (e >= 0.5 ? Lg[j * 3] : 0) : e * 100;
        if (e >= 0.5) t++;
        if (Lg) raw += Lg[j * 3];
        n++;
      }
      prof.push(n ? acc / n : NaN);
      frac.push(n ? t / n : NaN);
      rawL.push(Lg && n ? raw / n : NaN);
    }
    // smooth (3 px) and find the darkest column; it must be clearly darker than the window's median
    const sm = prof.map((_v, j) => {
      let s = 0;
      let n = 0;
      for (let q = j - 1; q <= j + 1; q++) if (q >= 0 && q < prof.length && prof[q] === prof[q]) (s += prof[q]), n++;
      return n ? s / n : NaN;
    });
    let bi = -1;
    let bv = Infinity;
    sm.forEach((v, j) => {
      // prefer boundaries close to the plan: small distance penalty
      const pen = v + Math.abs(c0 + j + 0.5 - bP[i]) * (8 / Math.max(1, hw));
      if (v === v && pen < bv) {
        bv = pen;
        bi = j;
      }
    });
    const vals = sm.filter((v) => v === v).sort((a, b) => a - b);
    const med = vals.length ? vals[vals.length >> 1] : NaN;
    const ok = bi >= 0 && sm[bi] < med * 0.86 && bi > 0 && bi < sm.length - 1;
    bE.push(ok ? c0 + bi + 0.5 : bP[i]);
    bFound.push(ok);
    // a real gap (diastema / open contact) is a run of dark columns: keep its two edges, so each neighbouring tooth
    // maps to its OWN mesial/distal surface and the planned contact is filled with enamel instead of the gap
    let gl = bE[bE.length - 1];
    let gr = gl;
    let tL = gl; // un-inset gap edges (for measuring), = bE for a normal contact
    let tR = gl;
    // only a clearly dark run counts as a gap (an embrasure or shadow line between touching teeth does not)
    // (between two planned teeth only: the outer ends of the arch border the dark mouth corners, not a gap).
    // With the photo, darkness comes from the photo itself (the mask may have been painted over the gap); without it
    // (mask-only), the mask must be open over the whole contact band.
    const useRaw = rawL.some((v) => v === v);
    const g = useRaw ? smooth3(rawL) : sm;
    const gv = g.filter((v) => v === v).sort((a, b) => a - b);
    const gmed = gv.length ? gv[gv.length >> 1] : NaN;
    let gi = -1;
    g.forEach((v, j) => {
      if (v === v && (gi < 0 || v < g[gi]) && Math.abs(c0 + j + 0.5 - bP[i]) < hw) gi = j;
    });
    if (bFound[bFound.length - 1] && i > 0 && i < teeth.length && gi > 0 && gmed === gmed && g[gi] < gmed * 0.6) {
      const thr = g[gi] + 0.55 * (gmed - g[gi]);
      // width is measured on the unsmoothed profile (smoothing widens a 1–2 px contact line to 3 px)
      const gRaw = useRaw ? rawL : prof;
      const open = (j: number) => gRaw[j] === gRaw[j] && gRaw[j] < thr && (useRaw || frac[j] < 0.2);
      bi = gi;
      let jl = bi;
      while (jl > 0 && open(jl - 1)) jl--;
      let jr = bi;
      while (jr < sm.length - 1 && open(jr + 1)) jr++;
      // a gap is at least ~8 % of the narrower neighbour wide; thinner dark contact lines keep the normal mapping
      const nw = nbw[i];
      if (open(bi) && jr - jl + 1 >= Math.max(3, 0.06 * nw)) {
        // edges of the gap, stepped 2 px into each tooth so the dark, blurred border of the gap is not copied
        gl = c0 + jl - 2; // the left tooth ends here
        gr = c0 + jr + 1 + 2; // the right tooth starts here
        gaps.push([c0 + jl, c0 + jr + 1, thr, useRaw]);
        tL = c0 + jl;
        tR = c0 + jr + 1;
      }
    }
    bL.push(gl);
    bR.push(gr);
    gEL.push(tL);
    gER.push(tR);
  }
  // keep the matched boundaries in order
  for (let i = 1; i < bE.length; i++) if (bE[i] <= bE[i - 1] + 1) bE[i] = bE[i - 1] + 1;
  for (let i = 0; i < bE.length; i++) {
    bL[i] = Math.min(bL[i], bE[i]);
    bR[i] = Math.max(bR[i], bE[i]);
    if (i > 0 && bL[i] <= bR[i - 1] + 1) bL[i] = Math.min(bE[i], bR[i - 1] + 1);
  }

  // ---- horizontal map (destination → source), piecewise linear between boundaries, identity outside ----
  const X = new Float32Array(gw);
  for (let x = 0; x < gw; x++) {
    const xc = x + 0.5;
    let sx = xc;
    if (bP.length >= 2 && xc >= bP[0] && xc <= bP[bP.length - 1]) {
      for (let i = 0; i + 1 < bP.length; i++) {
        if (xc >= bP[i] && xc <= bP[i + 1]) {
          // tooth between boundaries i and i+1: from the right edge of gap i to the left edge of gap i+1
          const t = (xc - bP[i]) / Math.max(1e-6, bP[i + 1] - bP[i]);
          sx = bR[i] + t * (bL[i + 1] - bR[i]);
          break;
        }
      }
    } else if (bP.length >= 1 && xc < bP[0]) sx = xc + (bL[0] - bP[0]);
    else if (bP.length >= 1) sx = xc + (bR[bR.length - 1] - bP[bP.length - 1]);
    X[x] = sx;
  }

  // ---- destination masks ----
  const cSrc = eC.slice();
  fillNaN(cSrc, xa, xb);
  const N = gw * gh;
  const T = new Float32Array(N);
  const add = new Float32Array(N);
  const reduce = new Float32Array(N);
  const cDst = new Float32Array(gw).fill(NaN);
  const pEnd = new Float32Array(gw).fill(NaN);
  for (let x = plan.x0; x < plan.x1; x++) {
    const pb0 = plan.pBot[x];
    if (pb0 !== pb0) continue;
    const sxc = Math.min(gw - 1, Math.max(0, Math.round(X[x] - 0.5)));
    // gum line: this column's own existing tooth when there is one (the texture map may point elsewhere, e.g. across
    // a closed gap); inside a gap, the mapped neighbour's
    let c = eC[x] === eC[x] ? eC[x] : cSrc[sxc];
    if (c !== c) c = plan.pTop[x];
    cDst[x] = c;
    // where this arch disappears behind the opposing teeth, the visible tooth is kept up to that junction (the
    // planned edge there can't be shown on a frontal photo; the prep guide still measures it)
    // the hidden junction is judged at the destination column first (the source map can shift into a gap)
    const hx = hidden[x] === 1 && eI[x] === eI[x] ? x : hidden[sxc] === 1 && eI[sxc] === eI[sxc] ? sxc : -1;
    const hid = hx >= 0;
    const pb = hid ? eI[hx] : pb0;
    pEnd[x] = pb;
    for (let y = Math.max(0, Math.floor(c)); y < Math.min(gh, Math.ceil(pb) + 1); y++) {
      const cov = Math.min(1, Math.max(0, y + 1 - c)) * Math.min(1, Math.max(0, pb - y));
      if (cov <= 0) continue;
      const j = y * gw + x;
      T[j] = cov * (lip[j] > 0 ? 1 : 0);
      // added material: outside today's tooth, ignoring a thin band along the (kept) cervical line
      // (a contact line ≤ 2 px wide with tooth on both sides is a contact, not added material)
      if (E[j] < 0.5 && y > c + Math.max(2, 0.1 * (pb - c)) && !contactLine(E, j, x, gw)) add[j] = T[j];
    }
    // reduction: existing tooth beyond the planned edge, up to its visible edge (or the occluding tooth)
    const lim = eI[sxc];
    if (edge[sxc] && !hid && lim > pb + 0.5) {
      for (let y = Math.max(0, Math.floor(pb)); y < Math.min(gh, Math.ceil(lim)); y++) {
        const j = y * gw + x;
        const r = Math.min(1, Math.max(0, y + 1 - pb)) * Math.min(1, Math.max(0, lim - y)) * Math.min(1, E[j] * 2);
        if (r > 0 && lip[j] > 0.5) reduce[j] = Math.max(reduce[j], r * (1 - T[j]));
      }
    }
  }
  // a gap closed by the plan is added material even where a painted mask wrongly covers it: judged on the photo
  if (Lg) {
    for (const [g0, g1, thr, raw] of gaps) {
      if (!raw) continue;
      for (let x = Math.max(plan.x0, Math.floor(g0)); x < Math.min(plan.x1, Math.ceil(g1)); x++) {
        const c = cDst[x];
        const pb = pEnd[x];
        if (c !== c || pb !== pb) continue;
        for (let y = Math.max(0, Math.floor(c)); y < Math.min(gh, Math.ceil(pb)); y++) {
          const j = y * gw + x;
          if (T[j] > 0 && Lg[j * 3] < thr && !contactLine(E, j, x, gw)) add[j] = Math.max(add[j], T[j]);
        }
      }
    }
  }
  // outer ends of the arch: existing tooth between the planned distal edge and the matched existing boundary is
  // outside the plan (its texture was mapped inside), so it is reduced too
  const ends: [number, number, number][] = [];
  if (bP.length >= 2) {
    if (bFound[0] && bE[0] < bP[0]) ends.push([Math.floor(bE[0]), Math.ceil(bP[0]), 0]);
    const l = bP.length - 1;
    if (bFound[l] && bE[l] > bP[l]) ends.push([Math.floor(bP[l]), Math.ceil(bE[l]), l]);
  }
  for (const [c0, c1, bi] of ends) {
    const tt = bi === 0 ? teeth[0] : teeth[teeth.length - 1];
    for (let x = Math.max(0, c0); x < Math.min(gw, c1); x++) {
      if (plan.pBot[x] === plan.pBot[x] && x >= plan.x0 && x < plan.x1) continue;
      const top = eC[x] === eC[x] ? eC[x] : tt.gtop;
      const bot = eI[x] === eI[x] ? (hidden[x] ? eI[x] : eI[x]) : tt.gbottom;
      for (let y = Math.max(0, Math.floor(top)); y < Math.min(gh, Math.ceil(bot)); y++) {
        const j = y * gw + x;
        if (E[j] >= 0.5 && lip[j] > 0.5) reduce[j] = Math.max(reduce[j], 1 - T[j]);
      }
    }
  }
  return { plan, eC, eI, edge, hidden, occl, pEnd, X, bP, bE, bFound, gEL, gER, T, add, reduce, cDst };
}

/**
 * Occlusal curve: where this arch's teeth meet the opposing arch (or end at the dark mouth), per grid column, as a
 * smooth quadratic (relative to the planned incisal line) fitted to the strongest vertical colour steps near the
 * planned edge, with trimming of outliers. NaN outside the fitted range or when there is too little evidence.
 */
export function occlusalCurve(f: Frame, plan: Plan, E: Float32Array, lip: Float32Array, Lg: Float32Array, xa: number, xb: number): Float32Array {
  const { gw, gh } = f;
  const L = plan.L;
  const r = Math.max(2, Math.round(L * 0.05));
  const out = new Float32Array(gw).fill(NaN);
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  const refY = new Float32Array(gw).fill(NaN);
  for (let x = xa; x < xb; x += 1) {
    const t = toothAt(plan, x + 0.5);
    if (!t) continue;
    refY[x] = t.gbottom;
    const y0 = Math.max(r, Math.floor(t.gbottom - L * 0.35));
    const y1 = Math.min(gh - r, Math.ceil(t.gbottom + L * 0.35));
    // up to 2 strongest local maxima of the step strength in this column
    let b1 = 0;
    let y1b = -1;
    let b2 = 0;
    let y2b = -1;
    let prev = 0;
    let prev2 = 0;
    for (let y = y0; y < y1; y++) {
      if (E[(y - 1) * gw + x] < 0.5 || lip[y * gw + x] < 0.5) {
        prev2 = prev;
        prev = 0;
        continue;
      }
      let d = 0;
      for (let c = 0; c < 3; c++) {
        let up = 0;
        let dn = 0;
        for (let q = 1; q <= r; q++) {
          up += Lg[((y - q) * gw + x) * 3 + c];
          dn += Lg[((y + q - 1) * gw + x) * 3 + c];
        }
        const dd = (up - dn) / r;
        d += c === 0 ? dd * dd : 1.5 * dd * dd;
      }
      // local maximum at y - 1
      if (prev > prev2 && prev >= d) {
        if (prev > b1) {
          b2 = b1;
          y2b = y1b;
          b1 = prev;
          y1b = y - 1;
        } else if (prev > b2) {
          b2 = prev;
          y2b = y - 1;
        }
      }
      prev2 = prev;
      prev = d;
    }
    for (const [bv, yv] of [
      [b1, y1b],
      [b2, y2b],
    ]) {
      if (yv < 0 || bv < 25) continue;
      xs.push(x + 0.5);
      ys.push(yv - t.gbottom);
      ws.push(Math.sqrt(bv));
    }
  }
  if (xs.length < 8) return out;
  // robust quadratic fit of the residual (y - planned edge) over x: start flat at the weighted median, keep the
  // candidate per column closest to the current curve, trim the worst 30 %, refit
  const xm = (xa + xb) / 2;
  const sc = Math.max(1, (xb - xa) / 2);
  let coef = [weightedMedian(ys, ws), 0, 0];
  const ev = (x: number) => {
    const u = (x - xm) / sc;
    return coef[0] + coef[1] * u + coef[2] * u * u;
  };
  for (let it = 0; it < 4; it++) {
    const best = new Map<number, number>();
    for (let i = 0; i < xs.length; i++) {
      const k = Math.floor(xs[i]);
      const j = best.get(k);
      if (j === undefined || Math.abs(ys[i] - ev(xs[i])) < Math.abs(ys[j] - ev(xs[j]))) best.set(k, i);
    }
    const idx = [...best.values()];
    const res = idx.map((i) => Math.abs(ys[i] - ev(xs[i])));
    const lim = [...res].sort((a, b) => a - b)[Math.floor(res.length * 0.7)] ?? Infinity;
    const use = idx.filter((_, n) => res[n] <= Math.max(lim, 1));
    const c = fitQuad(
      use.map((i) => (xs[i] - xm) / sc),
      use.map((i) => ys[i]),
      use.map((i) => ws[i]),
      it < 1 ? 1e3 : 1,
    );
    if (c) coef = c;
  }
  // evidence check: share of columns with a candidate near the curve
  let near = 0;
  let cols = 0;
  const seen = new Set<number>();
  for (let i = 0; i < xs.length; i++) {
    const k = Math.floor(xs[i]);
    if (Math.abs(ys[i] - ev(xs[i])) < Math.max(2, L * 0.06) && !seen.has(k)) {
      near++;
      seen.add(k);
    }
  }
  for (let x = xa; x < xb; x++) if (refY[x] === refY[x]) cols++;
  if (near < cols * 0.25) return out;
  for (let x = xa; x < xb; x++) if (refY[x] === refY[x]) out[x] = refY[x] + ev(x + 0.5);
  // local refinement: the strongest step within ±6 % L of the curve in each column, then a light median
  const rr = Math.max(2, Math.round(L * 0.06));
  const loc = out.slice();
  for (let x = xa; x < xb; x++) {
    const y0 = out[x];
    if (y0 !== y0) continue;
    let best = 0;
    let by = y0;
    for (let y = Math.max(r, Math.round(y0 - rr)); y <= Math.min(gh - r - 1, Math.round(y0 + rr)); y++) {
      let d = 0;
      for (let c = 0; c < 3; c++) {
        let up = 0;
        let dn = 0;
        for (let q = 1; q <= r; q++) {
          up += Lg[((y - q) * gw + x) * 3 + c];
          dn += Lg[((y + q - 1) * gw + x) * 3 + c];
        }
        const dd = (up - dn) / r;
        d += c === 0 ? dd * dd : 1.5 * dd * dd;
      }
      if (d > best) {
        best = d;
        by = y;
      }
    }
    if (best >= 25) loc[x] = by;
  }
  const m1 = median3(median3(loc));
  for (let x = xa; x < xb; x++) if (out[x] === out[x]) out[x] = m1[x];
  return out;
}

function weightedMedian(v: number[], w: number[]) {
  const i = v.map((_, k) => k).sort((a, b) => v[a] - v[b]);
  const tot = w.reduce((a, b) => a + b, 0);
  let c = 0;
  for (const k of i) {
    c += w[k];
    if (c >= tot / 2) return v[k];
  }
  return v[i[i.length >> 1]] ?? 0;
}

/** Weighted least squares y ≈ c0 + c1 u + c2 u², with a ridge on c1/c2 (`ridge`) to keep it near flat. */
function fitQuad(u: number[], y: number[], w: number[], ridge: number): number[] | null {
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const B = [0, 0, 0];
  for (let i = 0; i < u.length; i++) {
    const r = [1, u[i], u[i] * u[i]];
    for (let a = 0; a < 3; a++) {
      B[a] += w[i] * r[a] * y[i];
      for (let b = 0; b < 3; b++) A[a][b] += w[i] * r[a] * r[b];
    }
  }
  const tw = w.reduce((a, b) => a + b, 0) || 1;
  A[1][1] += ridge * tw * 0.01;
  A[2][2] += ridge * tw * 0.01;
  // Gaussian elimination
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    [A[c], A[p]] = [A[p], A[c]];
    [B[c], B[p]] = [B[p], B[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let q = c; q < 3; q++) A[r][q] -= k * A[c][q];
      B[r] -= k * B[c];
    }
  }
  return [B[0] / A[0][0], B[1] / A[1][1], B[2] / A[2][2]];
}

// ---------- push-pull inpainting (pure) ----------
/**
 * Fills unknown pixels (w = 0) of a 3-channel image from the known ones (w = 1) with a smooth membrane
 * (pyramid push-pull). In place on vals.
 */
export function pushPull(vals: Float32Array, wts: Float32Array, w: number, h: number) {
  if (w <= 1 && h <= 1) return;
  const W2 = Math.max(1, (w + 1) >> 1);
  const H2 = Math.max(1, (h + 1) >> 1);
  const v2 = new Float32Array(W2 * H2 * 3);
  const w2 = new Float32Array(W2 * H2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const wt = wts[i];
      if (!wt) continue;
      const j = (y >> 1) * W2 + (x >> 1);
      w2[j] += wt;
      v2[j * 3] += vals[i * 3] * wt;
      v2[j * 3 + 1] += vals[i * 3 + 1] * wt;
      v2[j * 3 + 2] += vals[i * 3 + 2] * wt;
    }
  }
  for (let j = 0; j < W2 * H2; j++) {
    if (w2[j] > 0) {
      v2[j * 3] /= w2[j];
      v2[j * 3 + 1] /= w2[j];
      v2[j * 3 + 2] /= w2[j];
      w2[j] = Math.min(1, w2[j]);
    }
  }
  let any = false;
  for (let j = 0; j < W2 * H2; j++) if (!w2[j]) any = true;
  if (any && (W2 > 1 || H2 > 1)) pushPull(v2, w2, W2, H2);
  // pull: unknown pixels take the bilinear upsample of the coarser level
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (wts[i] >= 1) continue;
      const gx = Math.min(W2 - 1, Math.max(0, (x - 0.5) / 2));
      const gy = Math.min(H2 - 1, Math.max(0, (y - 0.5) / 2));
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = Math.min(W2 - 1, x0 + 1);
      const y1 = Math.min(H2 - 1, y0 + 1);
      const fx = gx - x0;
      const fy = gy - y0;
      const a = wts[i];
      for (let c = 0; c < 3; c++) {
        const v =
          (1 - fy) * ((1 - fx) * v2[(y0 * W2 + x0) * 3 + c] + fx * v2[(y0 * W2 + x1) * 3 + c]) +
          fy * ((1 - fx) * v2[(y1 * W2 + x0) * 3 + c] + fx * v2[(y1 * W2 + x1) * 3 + c]);
        vals[i * 3 + c] = a * vals[i * 3 + c] + (1 - a) * v;
      }
    }
  }
}

// ---------- recolour ----------
export interface ShadeTarget {
  /** body and cervical Lab as they would appear under the photo's light */
  body: [number, number, number];
  cervical: [number, number, number];
}

/**
 * Colour cast and exposure of the photo, estimated from the existing teeth (all arches inside the lips): the least
 * red / least yellow tooth pixels are assumed to be close to a light natural shade (≈ B1). This keeps the new shade
 * in the photo's own white balance, the way a manual photo edit matches the neighbouring teeth.
 */
export function photoCast(Lg: Float32Array, E: Float32Array, lip: Float32Array): { a: number; b: number; L: number } {
  const as: number[] = [];
  const bs: number[] = [];
  const Ls: number[] = [];
  const n = E.length;
  const step = Math.max(1, Math.floor(n / 12000));
  for (let j = 0; j < n; j += step) {
    if (E[j] < 0.9 || lip[j] < 0.9) continue;
    Ls.push(Lg[j * 3]);
    as.push(Lg[j * 3 + 1]);
    bs.push(Lg[j * 3 + 2]);
  }
  if (as.length < 20) return { a: 0, b: 0, L: 0 };
  const q = (v: number[], p: number) => v.sort((x, y) => x - y)[Math.floor((v.length - 1) * p)];
  const ref = shadeLab("B1");
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    a: clamp(q(as, 0.25) - ref.body[1], -4, 10),
    b: clamp(q(bs, 0.25) - ref.body[2], -6, 10),
    // exposure: the brightest teeth vs a light shade, half-way (a dull photo stays a bit dull)
    L: clamp((q(Ls, 0.9) - ref.body[0]) * 0.5, -10, 2),
  };
}

/** Target shade in the photo's light: the tab colour plus the photo's cast and exposure offset. */
export function shadeTarget(shadeId: string, lower: boolean, cast: { a: number; b: number; L: number }): ShadeTarget {
  const t = shadeLab(shadeId, lower ? "lower" : "upper");
  const tint = (lab: [number, number, number]): [number, number, number] => [lab[0] + cast.L, lab[1] + cast.a, lab[2] + cast.b];
  return { body: tint(t.body), cervical: tint(t.cervical) };
}

/** Robust stats (median and spread) of the existing teeth inside the plan's columns. */
function toothStats(Lg: Float32Array, E: Float32Array, T: Float32Array, n: number) {
  const Ls: number[] = [];
  const as: number[] = [];
  const bs: number[] = [];
  // stride sampling (≈ 3000 samples) keeps the sorts cheap while dragging
  let cnt = 0;
  for (let j = 0; j < n; j += 7) if (E[j] >= 0.7 && T[j] >= 0.5) cnt++;
  const step = Math.max(1, Math.floor((n * cnt) / (n / 7) / 3000));
  for (let j = 0; j < n; j += step) {
    if (E[j] < 0.7 || T[j] < 0.5) continue;
    Ls.push(Lg[j * 3]);
    as.push(Lg[j * 3 + 1]);
    bs.push(Lg[j * 3 + 2]);
  }
  const med = (v: number[], q = 0.5) => {
    if (!v.length) return NaN;
    v.sort((x, y) => x - y);
    return v[Math.min(v.length - 1, Math.floor(v.length * q))];
  };
  const Lm = med(Ls);
  const L90 = med(Ls, 0.9);
  const L10 = med(Ls, 0.1);
  return { n: Ls.length, L: Lm, a: med(as), b: med(bs), spread: Math.max(4, (L90 - L10) / 2.56) };
}

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h & 0xffff) / 0xffff) * 2 - 1;
}

export interface SynthOptions {
  /** 0..1 how far existing colour moves to the shade (default 1) */
  strength?: number;
  /** add grain to synthesised (stretched / inpainted) pixels (default true) */
  grain?: boolean;
}

/**
 * Builds the RGBA layer (grid size, straight alpha) from the grid photo (Lab), the existing mask and the analysis.
 * Only planned-tooth pixels (recoloured / reshaped) and reduction pixels (inpainted background) get alpha > 0.
 */
export function synthesise(f: Frame, Lg: Float32Array, E: Float32Array, lip: Float32Array, an: Analysis, target: ShadeTarget, opt: SynthOptions = {}): Uint8ClampedArray {
  const { gw, gh } = f;
  const N = gw * gh;
  const out = new Uint8ClampedArray(N * 4);
  const { T, reduce, X, eC, eI, edge, plan, cDst } = an;
  const st = toothStats(Lg, E, T, N);
  if (!(st.n > 10)) {
    // no existing tooth inside the plan: nothing to build from
    return out;
  }
  const strength = opt.strength ?? 1;
  const grain = opt.grain !== false;
  // grain level of the photo: mean absolute Laplacian of L on existing teeth
  let gs = 0;
  let gn = 0;
  for (let y = 1; y < gh - 1; y += 2) {
    for (let x = plan.x0 + 1; x < plan.x1 - 1; x += 2) {
      const j = y * gw + x;
      if (E[j] < 0.9 || T[j] < 0.9) continue;
      gs += Math.abs(4 * Lg[j * 3] - Lg[(j - 1) * 3] - Lg[(j + 1) * 3] - Lg[(j - gw) * 3] - Lg[(j + gw) * 3]) / 4;
      gn++;
    }
  }
  const grainAmp = gn ? Math.min(3, (gs / gn) * 0.9) : 0.8;

  // nearest existing-tooth pixel to the left / right in the row and above in the column (O(1) gap filling)
  const nearL = new Int32Array(N);
  const nearR = new Int32Array(N);
  const nearU = new Int32Array(N);
  for (let y = 0; y < gh; y++) {
    let last = -1e6;
    for (let x = 0; x < gw; x++) {
      if (E[y * gw + x] >= 0.5) last = x;
      nearL[y * gw + x] = last;
    }
    last = 1e6;
    for (let x = gw - 1; x >= 0; x--) {
      if (E[y * gw + x] >= 0.5) last = x;
      nearR[y * gw + x] = last;
    }
  }
  for (let x = 0; x < gw; x++) {
    let last = -1e6;
    for (let y = 0; y < gh; y++) {
      if (E[y * gw + x] >= 0.5) last = y;
      nearU[y * gw + x] = last;
    }
  }

  // ---- planned teeth ----
  const lab = new Float32Array(3);
  const qRgb = new Float32Array(3);
  const p = new Float32Array(3);
  const sampleLab = (sx: number, sy: number) => {
    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx > gw - 1.001) sx = gw - 1.001;
    if (sy > gh - 1.001) sy = gh - 1.001;
    const xi = sx | 0;
    const yi = sy | 0;
    const fx = sx - xi;
    const fy = sy - yi;
    const i00 = (yi * gw + xi) * 3;
    const i10 = i00 + 3;
    const i01 = i00 + gw * 3;
    const i11 = i01 + 3;
    for (let c = 0; c < 3; c++)
      p[c] = (1 - fy) * ((1 - fx) * Lg[i00 + c] + fx * Lg[i10 + c]) + fy * ((1 - fx) * Lg[i01 + c] + fx * Lg[i11 + c]);
  };
  const Eat = (sx: number, sy: number) => {
    const xi = Math.min(gw - 1, Math.max(0, Math.round(sx - 0.5)));
    const yi = Math.min(gh - 1, Math.max(0, Math.round(sy - 0.5)));
    return E[yi * gw + xi];
  };
  const [Lb, ab, bb] = target.body;
  const [Lc, ac, bc] = target.cervical;
  // lightness moves half way to the shade (texture and the photo's lighting stay); chroma variation (stains,
  // cast gradients) shrinks to ~40 % around the shade colour, like a careful manual edit
  const dLbody = (Lb - st.L) * 0.45 * strength;
  const kChroma = 1 - 0.6 * strength;
  const { hidden, pEnd } = an;
  // planned teeth with almost no existing tooth under them (e.g. premolars lost in the buccal corridor) are not
  // invented from nothing
  const skip = new Uint8Array(gw);
  for (const t of plan.teeth) {
    let have = 0;
    let all = 0;
    for (let x = t.c0; x < t.c1; x++) {
      const pb = pEnd[x];
      const c = cDst[x];
      if (pb !== pb) continue;
      for (let y = Math.max(0, Math.floor(c)); y < Math.min(gh, Math.ceil(pb)); y += 2) {
        const j = y * gw + x;
        if (lip[j] < 0.5) continue;
        all++;
        if (E[j] >= 0.5) have++;
      }
    }
    if (all === 0 || have < all * 0.3) for (let x = t.c0; x < t.c1; x++) skip[x] = 1;
  }

  // planned incisal line smoothed across the arch (embrasure notches don't drive the stretch)
  const pSmooth = new Float32Array(gw).fill(NaN);
  {
    const r = Math.max(2, Math.round(plan.L * 0.12));
    const floorOf = (x: number) => {
      const t = toothAt(plan, x + 0.5);
      return t ? t.gtop + (t.gbottom - t.gtop) * 0.6 : -Infinity;
    };
    for (let x = plan.x0; x < plan.x1; x++) {
      if (pEnd[x] !== pEnd[x]) continue;
      let sum = 0;
      let n = 0;
      for (let q = Math.max(plan.x0, x - r); q <= Math.min(plan.x1 - 1, x + r); q++) {
        if (pEnd[q] === pEnd[q]) {
          sum += Math.max(pEnd[q], floorOf(q));
          n++;
        }
      }
      pSmooth[x] = sum / n;
    }
  }
  // per tooth: stretch ratio = existing edge / planned edge (measured from the anchor), median over the middle
  // columns with a visible (or occluded-but-beyond) existing edge; clamped to a believable range
  const toothRatio = new Float32Array(gw).fill(NaN);
  const centres: [number, number][] = [];
  for (const t of plan.teeth) {
    const rs: number[] = [];
    const w = t.c1 - t.c0;
    for (let x = Math.floor(t.c0 + w * 0.2); x < Math.ceil(t.c1 - w * 0.2); x++) {
      const pbs = pSmooth[x];
      const c = cDst[x];
      if (pbs !== pbs || c !== c) continue;
      const si = Math.min(gw - 1, Math.max(0, Math.round(X[x] - 0.5)));
      const e = eI[si];
      if (e !== e || !edge[si]) continue;
      const anchor = c + 0.5 * (Math.min(e, pbs) - c);
      if (pbs - anchor > 2) rs.push((e - anchor) / (pbs - anchor));
    }
    if (rs.length < 2) continue;
    rs.sort((a, b) => a - b);
    const r = Math.min(1.8, Math.max(0.55, rs[rs.length >> 1]));
    centres.push([(t.gx0 + t.gx1) / 2, r]);
  }
  // interpolate between tooth centres: a gradual change, never a seam inside one existing tooth
  centres.sort((a, b) => a[0] - b[0]);
  if (centres.length) {
    for (let x = plan.x0; x < plan.x1; x++) {
      const xc = x + 0.5;
      let r = centres[0][1];
      if (xc >= centres[centres.length - 1][0]) r = centres[centres.length - 1][1];
      else
        for (let i = 0; i + 1 < centres.length; i++)
          if (xc >= centres[i][0] && xc < centres[i + 1][0]) {
            const u = (xc - centres[i][0]) / (centres[i + 1][0] - centres[i][0]);
            const sm = u * u * (3 - 2 * u);
            r = centres[i][1] + (centres[i + 1][1] - centres[i][1]) * sm;
            break;
          }
      toothRatio[x] = r;
    }
  }

  // local lightness base (normalised box blur of existing-tooth L): shading (buccal corridor, lip shadow) lives here and
  // is kept; only the small-scale deviations from it (stains, texture) are touched
  const base = localMean(Lg, E, gw, gh, Math.max(2, Math.round(plan.L * 0.12)), plan.x0, plan.x1);

  for (let x = plan.x0; x < plan.x1; x++) {
    const pb = pEnd[x];
    if (pb !== pb || skip[x]) continue;
    const c = cDst[x];
    const sxc = X[x];
    const si = Math.min(gw - 1, Math.max(0, Math.round(sxc - 0.5)));
    const ec = eC[si];
    const hasRun = ec === ec;
    // vertical map: the incisal half is stretched / compressed so the existing edge lands on the planned edge
    // the stretch follows a smoothed planned edge so embrasure corners don't shear the texture
    const pbs = pSmooth[x];
    // one stretch per tooth (no shear between columns); the anchor follows the column's own cervical line
    const ratio = toothRatio[x] === toothRatio[x] && !hidden[si] ? toothRatio[x] : 1;
    const anchor = c + 0.5 * (Math.min(pbs, c + (pbs - c) * Math.min(1, ratio)) - c);
    const span = pbs - anchor;
    const se = hasRun ? eI[si] : NaN;
    for (let y = Math.max(0, Math.floor(c)); y < Math.min(gh, Math.ceil(pb) + 1); y++) {
      const j = y * gw + x;
      const t = T[j];
      if (t <= 0) continue;
      const yc = y + 0.5;
      let sy = yc <= anchor ? yc : anchor + (yc - anchor) * ratio;
      let sx = sxc;
      // past the existing edge of this column (rounded corners, embrasures, chips): take the tooth body next to it at
      // the same height (squares the corner with real texture); reflect back into the tooth only if none is close
      if (se === se && sy > se - 0.5 && edge[si]) {
        const yi = Math.min(gh - 1, Math.max(0, Math.round(sy - 0.5)));
        const q = yi * gw + si;
        const dl = si - nearL[q];
        const dr = nearR[q] - si;
        const lim2 = plan.L * 0.2;
        if (Math.min(dl, dr) <= lim2) sx = dl <= dr ? sx - dl - Math.min(dl, 2) : sx + dr + Math.min(dr, 2);
        else sy = Math.max(anchor, 2 * (se - 0.5) - sy);
      }
      let synth = Math.abs(ratio - 1) * Math.max(0, (yc - anchor) / Math.max(1, span)) + Math.abs(sx - (x + 0.5)) / Math.max(4, plan.L * 0.2);
      // no existing tooth at the source (gap, diastema): borrow the nearest tooth texture in the row
      if (Eat(sx, sy) < 0.5) {
        const lim = Math.ceil(plan.L * 0.25);
        const xi = Math.min(gw - 1, Math.max(0, Math.round(sx - 0.5)));
        const yi = Math.min(gh - 1, Math.max(0, Math.round(sy - 0.5)));
        const q = yi * gw + xi;
        const dl = xi - nearL[q];
        const dr = nearR[q] - xi;
        const du = yi - nearU[q];
        const r = Math.min(dl, dr, du);
        if (r > lim) continue;
        if (r === dl) sx = sx - dl - Math.min(dl, plan.L * 0.08);
        else if (r === dr) sx = sx + dr + Math.min(dr, plan.L * 0.08);
        else sy = sy - du - Math.min(du, 3);
        synth = 1;
      }
      sampleLab(sx, sy);
      let L = p[0];
      let a = p[1];
      let b = p[2];
      // where along the tooth: 0 at the cervical line, 1 at the planned edge
      const v = Math.min(1, Math.max(0, (yc - c) / Math.max(1, pb - c)));
      const wc = v < 0.35 ? (1 - v / 0.35) ** 2 : 0;
      const ta = ab + (ac - ab) * wc;
      const tb = bb + (bc - bb) * wc;
      // specular highlights and the brightest enamel keep their own value and chroma
      const hl = Math.min(1, Math.max(0, (L - (st.L + 1.2 * st.spread)) / (1.3 * st.spread)));
      const keep = hl * hl;
      // lightness: shift toward the shade; dark stains lifted a little more; soft roll-off near white
      const bi = Math.min(gh - 1, Math.max(0, sy | 0)) * gw + Math.min(gw - 1, Math.max(0, sx | 0));
      const Lbase = base[bi] > 0 ? base[bi] : st.L;
      const dev = L - Lbase;
      // brighten in proportion (a tooth in shadow stays in shadow), lift dark stains, keep bright texture
      let Ln = Lbase * (1 + dLbody / Math.max(20, st.L)) + (dev < 0 ? dev * (1 - 0.35 * strength) : dev) + (Lc - Lb) * 0.5 * wc * strength;
      if (Ln > 90) Ln = 90 + (Ln - 90) * 0.45;
      Ln = Ln * (1 - keep) + L * keep;
      const an2 = ta + (a - st.a) * kChroma;
      const bn2 = tb + (b - st.b) * kChroma;
      a = (a + (an2 - a) * strength) * (1 - keep) + a * keep;
      b = (b + (bn2 - b) * strength) * (1 - keep) + b * keep;
      L = Ln;
      // incisal translucency: a touch of grey-blue toward the planned edge
      if (v > 0.8) {
        const w = (v - 0.8) / 0.2;
        b -= 2.5 * w * strength;
        L -= 1.5 * w * strength;
      }
      // additive enamel (no tooth here today): a gentle falloff with distance beyond today's edge, so a lengthened
      // tooth keeps the shading of the mouth around it instead of looking pasted on
      if (E[j] < 0.5) {
        const beyond = se === se ? Math.max(0, yc - se) : plan.L * 0.15;
        const fall = Math.min(1, beyond / Math.max(4, plan.L * 0.35));
        L -= (L - Math.min(L, Lg[j * 3] + 25)) * 0.35 * fall + 4 * fall;
      }
      if (grain && synth > 0.05) L += hash(x, y) * grainAmp * Math.min(1, synth * 2);
      // gum-line pixels are part soft tissue: shift them less
      const eHere = E[j];
      const mixW = synth > 0.05 ? 1 : Math.min(1, 0.35 + eHere);
      labToRgb(L, a, b, lab);
      const o = j * 4;
      if (mixW < 1) {
        // blend toward the untouched pixel colour (sampled at the destination)
        labToRgb(Lg[j * 3], Lg[j * 3 + 1], Lg[j * 3 + 2], qRgb);
        for (let k = 0; k < 3; k++) lab[k] = qRgb[k] + (lab[k] - qRgb[k]) * mixW;
      }
      out[o] = lab[0];
      out[o + 1] = lab[1];
      out[o + 2] = lab[2];
      out[o + 3] = Math.round(255 * t);
    }
  }

  // ---- inpaint the reduction areas from surrounding non-tooth background ----
  let rx0 = gw;
  let ry0 = gh;
  let rx1 = -1;
  let ry1 = -1;
  for (let y = 0; y < gh; y++)
    for (let x = plan.x0; x < plan.x1; x++)
      if (reduce[y * gw + x] > 0) {
        if (x < rx0) rx0 = x;
        if (x > rx1) rx1 = x;
        if (y < ry0) ry0 = y;
        if (y > ry1) ry1 = y;
      }
  let fill: Float32Array | null = null;
  const tmpLab = new Float32Array(3);
  let fx0 = 0;
  let fy0 = 0;
  let fw = 0;
  if (rx1 >= 0) {
    const m = Math.ceil(plan.L * 0.35);
    fx0 = Math.max(0, rx0 - m);
    fy0 = Math.max(0, ry0 - m);
    const fx1 = Math.min(gw, rx1 + m + 1);
    const fy1 = Math.min(gh, ry1 + m + 1);
    fw = fx1 - fx0;
    const fh = fy1 - fy0;
    fill = new Float32Array(fw * fh * 3);
    const wts = new Float32Array(fw * fh);
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const j = (y + fy0) * gw + x + fx0;
        const i = y * fw + x;
        fill[i * 3] = Lg[j * 3];
        fill[i * 3 + 1] = Lg[j * 3 + 1];
        fill[i * 3 + 2] = Lg[j * 3 + 2];
        // background: inside the lips, not planned tooth, not reduced, not an existing tooth inside the arch
        const inArch = x + fx0 >= plan.x0 && x + fx0 < plan.x1;
        const isScopeTooth = inArch && E[j] >= 0.35 && (y + fy0 <= (eI[x + fx0] === eI[x + fx0] ? eI[x + fx0] + 1 : -1));
        wts[i] = lip[j] > 0.9 && T[j] < 0.01 && reduce[j] <= 0 && !isScopeTooth ? 1 : 0;
        // the new teeth themselves count a little: narrow embrasures become soft contact shadows, not dark spikes
        if (!wts[i] && out[j * 4 + 3] >= 250 && reduce[j] <= 0) {
          rgbToLab(out[j * 4], out[j * 4 + 1], out[j * 4 + 2], tmpLab);
          fill[i * 3] = tmpLab[0] * 0.8;
          fill[i * 3 + 1] = tmpLab[1];
          fill[i * 3 + 2] = tmpLab[2];
          wts[i] = 0.3;
        }
      }
    }
    pushPull(fill, wts, fw, fh);
  }

  // ---- reduction pixels: background ----
  if (fill) {
    for (let y = 0; y < gh; y++) {
      for (let x = plan.x0; x < plan.x1; x++) {
        const j = y * gw + x;
        const r = reduce[j];
        if (r <= 0) continue;
        const i = (y - fy0) * fw + (x - fx0);
        let L = fill[i * 3];
        if (grain) L += hash(x + 7, y + 3) * grainAmp;
        labToRgb(L, fill[i * 3 + 1], fill[i * 3 + 2], lab);
        const o = j * 4;
        const aT = out[o + 3] / 255;
        const aR = r * (1 - aT);
        const A = aT + aR;
        if (A <= 0) continue;
        for (let k = 0; k < 3; k++) out[o + k] = (out[o + k] * aT + lab[k] * aR) / A;
        out[o + 3] = Math.round(255 * A);
      }
    }
  }
  featherAlpha(out, gw, gh);
  return out;
}

/** Normalised box mean of L over existing-tooth pixels (0 where none), columns [x0, x1) ± r. */
function localMean(Lg: Float32Array, E: Float32Array, w: number, h: number, r: number, x0: number, x1: number): Float32Array {
  const a = Math.max(0, x0 - r * 2);
  const b = Math.min(w, x1 + r * 2);
  const cw = b - a;
  const num = new Float32Array(cw * h);
  const den = new Float32Array(cw * h);
  // horizontal pass
  for (let y = 0; y < h; y++) {
    let sn = 0;
    let sd = 0;
    const row = y * w;
    for (let x = a - r; x < b; x++) {
      const xi = x + r;
      if (xi >= a && xi < b && E[row + xi] >= 0.5) {
        sn += Lg[(row + xi) * 3];
        sd += 1;
      }
      const xo = x - r - 1;
      if (xo >= a && xo < b && E[row + xo] >= 0.5) {
        sn -= Lg[(row + xo) * 3];
        sd -= 1;
      }
      if (x >= a) {
        num[y * cw + x - a] = sn;
        den[y * cw + x - a] = sd;
      }
    }
  }
  const out = new Float32Array(w * h);
  // vertical pass
  for (let x = 0; x < cw; x++) {
    let sn = 0;
    let sd = 0;
    for (let y = -r; y < h; y++) {
      const yi = y + r;
      if (yi < h) {
        sn += num[yi * cw + x];
        sd += den[yi * cw + x];
      }
      const yo = y - r - 1;
      if (yo >= 0) {
        sn -= num[yo * cw + x];
        sd -= den[yo * cw + x];
      }
      if (y >= 0 && sd > 0.5) out[y * w + x + a] = sn / sd;
    }
  }
  return out;
}

/** 3×3 blur of the alpha channel only where it changes (anti-aliased, slightly soft edges like the photo's). */
function featherAlpha(px: Uint8ClampedArray, w: number, h: number) {
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = px[i * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = a[i];
      if (c === 255 && a[i - 1] === 255 && a[i + 1] === 255 && a[i - w] === 255 && a[i + w] === 255) continue;
      if (c === 0 && !a[i - 1] && !a[i + 1] && !a[i - w] && !a[i + w]) continue;
      const s = 4 * c + 2 * (a[i - 1] + a[i + 1] + a[i - w] + a[i + w]) + a[i - w - 1] + a[i - w + 1] + a[i + w - 1] + a[i + w + 1];
      const v = Math.round(s / 16);
      // colour of newly covered pixels: nearest covered neighbour's
      if (!c && v) {
        let best = -1;
        let bv = 0;
        for (const q of [i - 1, i + 1, i - w, i + w]) if (a[q] > bv) (bv = a[q]), (best = q);
        if (best >= 0) for (let k = 0; k < 3; k++) px[i * 4 + k] = px[best * 4 + k];
      }
      px[i * 4 + 3] = v;
    }
  }
}

// ---------- browser: caches and drawing ----------
interface PhotoPixels {
  img: object;
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  data: Uint8ClampedArray;
}
let photoPix: PhotoPixels | null = null;

/** Photo pixels of the lip region (+ margin), read once per photo/region. */
export function photoRegion(s: EngineScene): PhotoPixels | null {
  let x0 = 0;
  let y0 = 0;
  let x1 = s.imgW;
  let y1 = s.imgH;
  if (s.lips.length >= 3) {
    x0 = Infinity;
    y0 = Infinity;
    x1 = -Infinity;
    y1 = -Infinity;
    for (const p of s.lips) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    const m = Math.max(8, (x1 - x0) * 0.08);
    x0 = Math.max(0, Math.floor(x0 - m));
    y0 = Math.max(0, Math.floor(y0 - m));
    x1 = Math.min(s.imgW, Math.ceil(x1 + m));
    y1 = Math.min(s.imgH, Math.ceil(y1 + m));
  }
  const key = s.img as unknown as object;
  const c = photoPix;
  if (c && c.img === key && c.rx <= x0 && c.ry <= y0 && c.rx + c.rw >= x1 && c.ry + c.rh >= y1) return c;
  // read a generous region so small lip edits reuse it
  const m2 = Math.max(16, (x1 - x0) * 0.1);
  x0 = Math.max(0, Math.floor(x0 - m2));
  y0 = Math.max(0, Math.floor(y0 - m2));
  x1 = Math.min(s.imgW, Math.ceil(x1 + m2));
  y1 = Math.min(s.imgH, Math.ceil(y1 + m2));
  const rw = Math.max(1, x1 - x0);
  const rh = Math.max(1, y1 - y0);
  try {
    const cv = document.createElement("canvas");
    cv.width = rw;
    cv.height = rh;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(s.img, -x0, -y0, s.imgW, s.imgH);
    photoPix = { img: key, rx: x0, ry: y0, rw, rh, data: ctx.getImageData(0, 0, rw, rh).data };
    return photoPix;
  } catch {
    return null;
  }
}

/** Grid scale for a quality: full ≈ photo resolution (≤ 0.5 MP grid), fast ≈ half (≤ 80 kP). */
export function gridScale(lipW: number, lipH: number, q: "fast" | "full") {
  const cap = q === "full" ? 5e5 : 5e4;
  let k = q === "full" ? 1 : 0.45;
  const area = Math.max(1, lipW * lipH);
  if (area * k * k > cap) k = Math.sqrt(cap / area);
  return k;
}

interface GridCache {
  key: string;
  f: Frame;
  Lg: Float32Array;
  lip: Float32Array;
  Ekey: string;
  E: Float32Array | null;
  cast: { a: number; b: number; L: number } | null;
}
const gridCaches: Record<"fast" | "full", GridCache | null> = { fast: null, full: null };
let imgIds = new WeakMap<object, number>();
let nextImgId = 1;
function imgId(img: object) {
  let i = imgIds.get(img);
  if (!i) imgIds.set(img, (i = nextImgId++));
  return i;
}

const detectCache: { key: string; mask: Mask | null } = { key: "", mask: null };
let maskIds = new WeakMap<object, number>();
let nextMaskId = 1;
function maskKey(m: Mask) {
  let i = maskIds.get(m);
  if (!i) maskIds.set(m, (i = nextMaskId++));
  return `${i}:${maskVersion(m)}`;
}

/** The scene's existing-teeth mask, or one detected (and cached) from the photo inside the lips. */
export function existingMask(s: EngineScene): Mask {
  if (s.existing) return s.existing;
  const key = `${imgId(s.img as unknown as object)}|${s.lips.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(";")}`;
  if (detectCache.key !== key || !detectCache.mask) {
    detectCache.mask = detectTeeth(s.img, s.imgW, s.imgH, s.lips);
    detectCache.key = key;
  }
  return detectCache.mask;
}

/** Grid, resampled photo (Lab), lip coverage and existing mask for a scene at a quality, cached across frames. */
export function sceneGrid(s: EngineScene, q: "fast" | "full", mask: Mask): GridCache | null {
  const lb = s.lips.length >= 3 ? s.lips : [];
  let w = s.imgW;
  let h = s.imgH;
  if (lb.length) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of lb) {
      x0 = Math.min(x0, p.x);
      x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    w = x1 - x0;
    h = y1 - y0;
  }
  const k = gridScale(w, h, q);
  const f = makeFrame(s, k);
  const key = `${imgId(s.img as unknown as object)}|${f.angle}|${f.fy}|${k}|${f.ox},${f.oy},${f.u0},${f.v0},${f.gw},${f.gh}|${lb
    .map((p) => `${p.x},${p.y}`)
    .join(";")}`;
  let c = gridCaches[q];
  if (!c || c.key !== key) {
    const px = photoRegion(s);
    if (!px) return null;
    c = { key, f, Lg: resampleLab(f, px.data, px.rx, px.ry, px.rw, px.rh), lip: lipGrid(f, s.lips), Ekey: "", E: null, cast: null };
    gridCaches[q] = c;
  }
  const ek = maskKey(mask);
  if (c.Ekey !== ek || !c.E) {
    c.E = resampleMask(c.f, mask, s.imgW, s.imgH);
    c.Ekey = ek;
    c.cast = photoCast(c.Lg, c.E, c.lip);
  }
  return c;
}

interface Out {
  cv: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  key: string;
  f: Frame | null;
  id: ImageData | null;
}
const outs: Record<string, Out> = {};

function designKey(d: Design, extra: string) {
  const opp = (d.opposing ?? []).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(";");
  return [d.center.x, d.center.y, d.width, d.wl, d.arc, d.tilt, d.lateralStep, d.count, d.proportion, d.shape, d.shade, d.arch ?? "upper", opp, extra].join("|");
}

/** Builds (or reuses) the photo-teeth layer for a scene. `slot` separates the screen and export caches. */
export function buildPhotoLayer(s: EngineScene, q: "fast" | "full", slot = "screen"): Out | null {
  const mask = existingMask(s);
  const g = sceneGrid(s, q, mask);
  if (!g || !g.E) return null;
  const o = (outs[slot + q] ??= { cv: null, ctx: null, key: "", f: null, id: null });
  const key = designKey(s.design, g.key + "#" + g.Ekey);
  if (o.key === key && o.cv) return o;
  const f = g.f;
  const plan = planInGrid(f, s.design);
  const an = analyse(f, plan, g.E, g.lip, g.Lg);
  const target = shadeTarget(s.design.shade, isLower(s.design), g.cast ?? photoCast(g.Lg, g.E, g.lip));
  const px = synthesise(f, g.Lg, g.E, g.lip, an, target, { grain: q === "full" });
  if (!o.cv) {
    o.cv = document.createElement("canvas");
    o.ctx = o.cv.getContext("2d")!;
  }
  if (o.cv.width !== f.gw || o.cv.height !== f.gh) {
    o.cv.width = f.gw;
    o.cv.height = f.gh;
    o.id = null;
  }
  if (!o.id || o.id.width !== f.gw || o.id.height !== f.gh) o.id = o.ctx!.createImageData(f.gw, f.gh);
  o.id.data.set(px);
  o.ctx!.putImageData(o.id, 0, 0);
  o.key = key;
  o.f = f;
  return o;
}

function lipClip(ctx: CanvasRenderingContext2D, lips: Pt[]) {
  if (lips.length < 3) return;
  const c = smoothClosed(lips);
  ctx.beginPath();
  c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();
}

/**
 * Draws the photo-realistic teeth in image coordinates (caller sets the transform), clipped to the lip contour.
 * Returns false when the photo can't be read (then the caller may fall back to the drawn mockup).
 */
export function drawPhotoTeeth(ctx: CanvasRenderingContext2D, s: EngineScene, q: "fast" | "full", alpha: number, slot = "screen"): boolean {
  const o = buildPhotoLayer(s, q, slot);
  if (!o || !o.cv || !o.f) return false;
  ctx.save();
  lipClip(ctx, s.lips);
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.transform(...gridMatrix(o.f));
  ctx.drawImage(o.cv, 0, 0);
  ctx.restore();
  return true;
}

/** Test hook: forget cached grids (e.g. after replacing a photo object in place). */
export function resetPhotoCaches() {
  gridCaches.fast = gridCaches.full = null;
  photoPix = null;
  detectCache.key = "";
  detectCache.mask = null;
  imgIds = new WeakMap();
  maskIds = new WeakMap();
  for (const k of Object.keys(outs)) delete outs[k];
}

/**
 * Starting points for the dentist's opposing-teeth edge: the automatic occlusal curve when the photo shows one
 * (5 points across the planned teeth), or null (the caller then uses the template default).
 */
export function autoOpposing(s: EngineScene): Pt[] | null {
  const mask = existingMask(s);
  const g = sceneGrid(s, "fast", mask);
  if (!g || !g.E) return null;
  const f = g.f;
  const plan = planInGrid(f, { ...s.design, opposing: undefined });
  const xa = Math.max(0, plan.x0);
  const xb = Math.min(f.gw, plan.x1);
  if (xb - xa < 5) return null;
  const oc = occlusalCurve(f, plan, g.E, g.lip, g.Lg, xa, xb);
  const out: Pt[] = [];
  const q = { x: 0, y: 0 };
  for (const t of [0.06, 0.28, 0.5, 0.72, 0.94]) {
    const x = Math.round(xa + t * (xb - xa - 1));
    const v = oc[x];
    if (v !== v) return null;
    gridToImage(f, x + 0.5, v, q);
    out.push({ x: q.x, y: q.y });
  }
  return out;
}
