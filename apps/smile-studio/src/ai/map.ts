// Labs (Auto-detect beta): PURE mapping from MediaPipe outputs to Smile Studio's own data (guides, lip points, masks).
// No DOM and no MediaPipe import here, so it is unit-tested with synthetic landmarks (tests/ai.test.ts).
// Everything returned is a PROPOSAL: the editor shows it as ghost dots / a tint and applies it only after the user confirms.
import { designAngle, toImage, toothBoxes } from "../geometry";
import type { Design, Framing, Guides, Pt } from "../model";
import { components, lipCoverage } from "../teethMask";
import type { Mask } from "../contracts";

/** A MediaPipe normalised landmark (x, y in 0..1 of the image that was analysed). */
export type Lm = { x: number; y: number };

// Face Mesh v2 topology (478 points with irises). Inner lip loop: corner → upper inner lip → other corner, and the
// lower inner lip between the same corners (MediaPipe FACEMESH_LIPS, inner ring).
export const INNER_UPPER = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308];
export const INNER_LOWER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
/** Iris centres (present when the model outputs 478 points). */
export const IRIS = [468, 473];
/** Eye corners, used when there are no iris points: [outer, inner] per eye. */
export const EYES = [
  [33, 133],
  [263, 362],
];
/** Outer mouth corners (commissures). */
export const MOUTH_CORNERS = [61, 291];
/** Landmarks on the facial midline (forehead → chin): their median offset across the pupil line is the midline. */
export const MIDLINE = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 13, 14, 17, 18, 200, 199, 175, 152];
/** Midline points near the mouth (close-ups: the nose and chin are often cut off). */
export const MIDLINE_MOUTH = [2, 164, 0, 13, 14, 17];

const r1 = (v: number) => Math.round(v * 10) / 10;
const rp = (p: Pt): Pt => ({ x: r1(p.x), y: r1(p.y) });
const px = (lms: readonly Lm[], i: number, w: number, h: number): Pt => ({ x: lms[i].x * w, y: lms[i].y * h });
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Points spaced evenly along a polyline (first and last kept). n ≥ 2. */
export function resamplePolyline(pts: readonly Pt[], n: number): Pt[] {
  if (pts.length < 2 || n < 2) return pts.slice(0, n).map((p) => ({ ...p }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1];
  const out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const t = (total * k) / (n - 1);
    while (j < pts.length - 1 && cum[j] < t) j++;
    const seg = cum[j] - cum[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (t - cum[j - 1]) / seg));
    out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * f, y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * f });
  }
  return out;
}

/** Signed area of a closed polygon in image coordinates (y down): positive = clockwise on screen. */
export function signedArea(pts: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * The inner-lip landmark loop as Smile Studio lip points, same convention as defaultLips (model.ts): n points (even),
 * clockwise on screen, starting at the mouth corner on the LEFT of the image, over the upper lip to the right corner,
 * back along the lower lip. Upper and lower lips are each resampled evenly by arc length.
 */
export function lipsFromLandmarks(lms: readonly Lm[], w: number, h: number, n = 12): Pt[] | null {
  if (lms.length < 468 || n < 6 || n % 2) return null;
  let up = INNER_UPPER.map((i) => px(lms, i, w, h));
  let lo = INNER_LOWER.map((i) => px(lms, i, w, h));
  // start on the image-left corner (the patient's right corner in a non-mirrored frontal photo)
  if (up[0].x > up[up.length - 1].x) {
    up = up.reverse();
    lo = lo.reverse();
  }
  // the "upper" chain must be the one higher in the image (an upside-down photo would swap them)
  const meanY = (a: Pt[]) => a.reduce((s, p) => s + p.y, 0) / a.length;
  if (meanY(up) > meanY(lo)) [up, lo] = [lo, up];
  const half = n / 2;
  const top = resamplePolyline(up, half + 1); // left corner … right corner
  const bottom = resamplePolyline([...lo].reverse(), half + 1); // right corner … left corner
  const pts = [...top, ...bottom.slice(1, half)].map(rp);
  return signedArea(pts) < 0 ? null : pts;
}

/** Inner-lip opening at the middle (px): ~0 when the lips are closed (no teeth to design on). */
export function lipOpening(lms: readonly Lm[], w: number, h: number): number {
  if (lms.length < 468) return 0;
  return Math.abs(px(lms, 14, w, h).y - px(lms, 13, w, h).y);
}

export interface GuideProposal {
  guides: Guides;
  /** what the dots were placed on, for the confirm note */
  basis: "irises" | "eye corners" | "mouth corners";
}

/**
 * Face-line dots from landmarks. Full face: the iris centres (eye-corner midpoints without irises), patient's right
 * pupil = the one on the image LEFT (model.ts), and a midline dot at the philtrum shifted onto the median of the facial
 * midline landmarks across the pupil line. Close-up: the two mouth corners and a dental-midline estimate at the upper lip.
 */
export function guidesFromLandmarks(lms: readonly Lm[], w: number, h: number, framing: Framing = "face"): GuideProposal | null {
  if (lms.length < 468) return null;
  let a: Pt;
  let b: Pt;
  let basis: GuideProposal["basis"];
  if (framing === "closeup") {
    a = px(lms, MOUTH_CORNERS[0], w, h);
    b = px(lms, MOUTH_CORNERS[1], w, h);
    basis = "mouth corners";
  } else if (lms.length >= 478) {
    a = px(lms, IRIS[0], w, h);
    b = px(lms, IRIS[1], w, h);
    basis = "irises";
  } else {
    const mid = (e: number[]) => {
      const p = px(lms, e[0], w, h);
      const q = px(lms, e[1], w, h);
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    };
    a = mid(EYES[0]);
    b = mid(EYES[1]);
    basis = "eye corners";
  }
  const [pR, pL] = a.x <= b.x ? [a, b] : [b, a];
  const d = Math.hypot(pL.x - pR.x, pL.y - pR.y);
  if (d < Math.min(w, h) * 0.02) return null; // degenerate: not a usable level line
  const u = { x: (pL.x - pR.x) / d, y: (pL.y - pR.y) / d };
  const c = { x: (pR.x + pL.x) / 2, y: (pR.y + pL.y) / 2 };
  const along = (p: Pt) => (p.x - c.x) * u.x + (p.y - c.y) * u.y;
  const ids = framing === "closeup" ? MIDLINE_MOUTH : MIDLINE;
  const t = median(ids.map((i) => along(px(lms, i, w, h))));
  // anchor: full face, the philtrum (between subnasale 164 and the upper lip 0); close-up, the upper inner lip (13),
  // nudged a little upward (the dental midline dot sits between the upper centrals near the lip)
  const p164 = px(lms, 164, w, h);
  const p0 = px(lms, 0, w, h);
  const p13 = px(lms, 13, w, h);
  const anchor = framing === "closeup" ? { x: p13.x, y: p13.y + (p0.y - p13.y) * 0.25 } : { x: (p164.x + p0.x) / 2, y: (p164.y + p0.y) / 2 };
  const s = t - along(anchor);
  const midline = { x: anchor.x + u.x * s, y: anchor.y + u.y * s };
  return { guides: { pupilR: rp(pR), pupilL: rp(pL), midline: rp(midline) }, basis };
}

// ---------- tap-to-outline: segmentation output → existing-teeth mask ----------

export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Image region around the lip contour (padded by `pad` × its size, clamped to the image, integer px). */
export function cropAroundLips(lips: readonly Pt[], imgW: number, imgH: number, pad = 0.25): Crop {
  if (lips.length < 3) return { x: 0, y: 0, w: imgW, h: imgH };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of lips) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const m = Math.max(x1 - x0, y1 - y0) * pad;
  const X0 = Math.max(0, Math.floor(x0 - m));
  const Y0 = Math.max(0, Math.floor(y0 - m));
  const X1 = Math.min(imgW, Math.ceil(x1 + m));
  const Y1 = Math.min(imgH, Math.ceil(y1 + m));
  return { x: X0, y: Y0, w: Math.max(1, X1 - X0), h: Math.max(1, Y1 - Y0) };
}

/**
 * Square image region centred on a tap, `k` × the expected tooth width on a side (clamped to the image, integer px).
 * A tight crop makes the tapped tooth the main object for the segmenter (on a whole-mouth crop it tends to return the
 * whole mouth opening).
 */
export function cropAroundTap(tap: Pt, toothW: number, imgW: number, imgH: number, k = 2): Crop {
  const side = Math.max(16, Math.min(Math.max(imgW, imgH), Math.round(toothW * k)));
  const x = Math.round(Math.min(Math.max(0, tap.x - side / 2), Math.max(0, imgW - side)));
  const y = Math.round(Math.min(Math.max(0, tap.y - side / 2), Math.max(0, imgH - side)));
  return { x, y, w: Math.min(side, imgW - x), h: Math.min(side, imgH - y) };
}

/**
 * Segmentation confidence (cw × ch over `crop` of the photo, 0..1) → a binary region on the mask raster (mw × mh over
 * the whole photo): thresholded, clipped to the lip contour and reduced to the connected part under the tap (or the
 * part nearest to it within ~3 % of the photo). Empty when nothing usable is under the tap.
 */
export function regionFromConfidence(
  conf: Float32Array | Uint8Array,
  cw: number,
  ch: number,
  crop: Crop,
  imgW: number,
  imgH: number,
  mw: number,
  mh: number,
  tap: Pt,
  lips: Pt[] | null,
  thr = 0.5,
): Uint8Array {
  const out = new Uint8Array(mw * mh);
  const sx = imgW / mw;
  const sy = imgH / mh;
  const scale = conf instanceof Uint8Array ? 1 / 255 : 1;
  const inside = lips && lips.length >= 3 ? lipCoverage(lips, mw, mh, mw / imgW) : null;
  const j0 = Math.max(0, Math.floor(crop.y / sy));
  const j1 = Math.min(mh - 1, Math.ceil((crop.y + crop.h) / sy));
  const i0 = Math.max(0, Math.floor(crop.x / sx));
  const i1 = Math.min(mw - 1, Math.ceil((crop.x + crop.w) / sx));
  for (let j = j0; j <= j1; j++) {
    const v = Math.floor((((j + 0.5) * sy - crop.y) / crop.h) * ch);
    if (v < 0 || v >= ch) continue;
    for (let i = i0; i <= i1; i++) {
      const u = Math.floor((((i + 0.5) * sx - crop.x) / crop.w) * cw);
      if (u < 0 || u >= cw) continue;
      const k = j * mw + i;
      if (conf[v * cw + u] * scale >= thr && (!inside || inside[k] >= 0.5)) out[k] = 255;
    }
  }
  return keepComponentAt(out, mw, mh, { x: tap.x / sx, y: tap.y / sy }, Math.max(mw, mh) * 0.03);
}

/** Keeps only the connected component under p (raster px), or the nearest one within maxDist; else all zero. */
export function keepComponentAt(m: Uint8Array, w: number, h: number, p: Pt, maxDist: number): Uint8Array {
  const { labels } = components(m, w, h);
  const ci = Math.min(w - 1, Math.max(0, Math.floor(p.x)));
  const cj = Math.min(h - 1, Math.max(0, Math.floor(p.y)));
  let lab = labels[cj * w + ci];
  if (lab === 0) {
    let best = maxDist * maxDist;
    const r = Math.ceil(maxDist);
    for (let j = Math.max(0, cj - r); j <= Math.min(h - 1, cj + r); j++)
      for (let i = Math.max(0, ci - r); i <= Math.min(w - 1, ci + r); i++) {
        const l = labels[j * w + i];
        if (l === 0) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d <= best) {
          best = d;
          lab = l;
        }
      }
  }
  const out = new Uint8Array(w * h);
  if (lab === 0) return out;
  for (let k = 0; k < out.length; k++) if (labels[k] === lab) out[k] = 255;
  return out;
}

/**
 * Merges a region into the existing-teeth mask: "add" sets it, "erase" clears it. Always returns a NEW Mask (new identity,
 * so every cache keyed on the mask rebuilds); the input mask is never modified. `changed` = pixels that flipped.
 */
export function mergeRegion(base: Mask, region: Uint8Array, mode: "add" | "erase"): { mask: Mask; changed: number } {
  const data = new Uint8Array(base.data);
  let changed = 0;
  const v = mode === "add" ? 255 : 0;
  for (let k = 0; k < data.length; k++)
    if (region[k] && data[k] !== v) {
      data[k] = v;
      changed++;
    }
  return { mask: { w: base.w, h: base.h, data }, changed };
}

/** How far an area is from one expected tooth area (0 = exact; log ratio, so half and double score the same). Empty = ∞. */
export const toothAreaScore = (area: number, expected: number) => (area > 0 && expected > 0 ? Math.abs(Math.log(area / expected)) : Infinity);

/** Pixels set in a mask. */
export const maskArea = (m: { data: Uint8Array }) => {
  let n = 0;
  for (let k = 0; k < m.data.length; k++) if (m.data[k]) n++;
  return n;
};

/** Centres of the planned front teeth (centrals, laterals, canines) in image px, for "Outline all front teeth". */
export function frontToothCentres(d: Design, g: Guides): Pt[] {
  const a = designAngle(d, g);
  return toothBoxes(d)
    .filter((b) => b.kind <= 2)
    .sort((p, q) => p.x0 - q.x0)
    .map((b) => rp(toImage({ x: (b.x0 + b.x1) / 2, y: b.top + (b.bottom - b.top) * 0.55 }, d, a)));
}

/** Widths and centres (image px, along the pupil line) of separate tooth regions, left to right (round 7 fit hint). */
export function regionSpans(m: Mask, imgW: number, g: Guides, minArea = 12): { c: number; w: number }[] {
  const { labels, areas } = components(m.data, m.w, m.h);
  const s = imgW / m.w;
  const ang = Math.atan2(g.pupilL.y - g.pupilR.y, g.pupilL.x - g.pupilR.x);
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const lo = areas.map(() => Infinity);
  const hi = areas.map(() => -Infinity);
  for (let j = 0; j < m.h; j++)
    for (let i = 0; i < m.w; i++) {
      const l = labels[j * m.w + i];
      if (l === 0 || areas[l] < minArea) continue;
      const t = ((i + 0.5) * cs + (j + 0.5) * sn) * s;
      if (t < lo[l]) lo[l] = t;
      if (t > hi[l]) hi[l] = t;
    }
  return areas
    .map((a, l) => ({ a, c: (lo[l] + hi[l]) / 2, w: hi[l] - lo[l] }))
    .filter((r, l) => l > 0 && r.a >= minArea && Number.isFinite(r.w))
    .sort((p, q) => p.c - q.c)
    .map(({ c, w }) => ({ c: r1(c), w: r1(w) }));
}
