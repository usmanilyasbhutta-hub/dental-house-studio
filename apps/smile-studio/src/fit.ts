// "Fit to teeth" (round 6): place the tooth template from two taps on the canine tips, then refine it with the
// existing-teeth mask. Pure maths, no DOM (unit-tested in tests/fit.test.ts).
//
// Taps: the patient's right canine (image LEFT of a frontal photo) and the left canine. From them:
//   - width: canine-to-canine template width, scaled so the canine boxes of toothBoxes() are centred under the taps;
//   - tilt: slope of the tap line against the reference (pupil / mouth-corner) line;
//   - center: midpoint of the taps, moved along the tooth axis so the canine incisal edges land on the taps (the
//     smile arc lifts the canines relative to the centrals), i.e. center sits on the central incisal line.
// Refinement (only when the mask agrees with the taps): central crown height → design.wl (clamped to the arch's range),
// and a small shift along the incisal line onto a visible central gap. Never more than FIT_TOL from the taps.
import { centralLength, centralWidth, deg, isLower, pupilAngle, toImage, toLocal, toothBoxes } from "./geometry";
import type { Design, Guides, Pt } from "./model";

/** Tilt limits (same as the Teeth step's "Tilt" slider). */
export const FIT_TILT_MAX = 6;
/** W/L ranges accepted from the mask (Teeth step slider ranges; lower: docs/round3-clinical.md A). */
export const FIT_WL = { upper: { min: 0.65, max: 0.95 }, lower: { min: 0.5, max: 0.75 } };
/** Largest midline shift from the mask, as a fraction of the planned central width. */
export const FIT_TOL = 0.3;

/** Canine box centres (local x) of a design, patient's right then left. */
function canineCentres(d: Design): [number, number] | null {
  const b = toothBoxes(d).filter((x) => x.kind === 2);
  const r = b.find((x) => x.side === -1);
  const l = b.find((x) => x.side === 1);
  if (!r || !l) return null;
  return [(r.x0 + r.x1) / 2, (l.x0 + l.x1) / 2];
}

/**
 * design.width / (distance between the canine box centres). Exact for the current arch and proportion
 * (the width spans the canines' distal edges, the taps are their centres). Count does not change it.
 */
export function canineSpanFactor(d: Pick<Design, "arch" | "proportion">): number {
  const probe: Design = { ...(d as Design), center: { x: 0, y: 0 }, width: 1000, count: 6, wl: 0.8, arc: 0, tilt: 0, lateralStep: 0 } as Design;
  const c = canineCentres(probe);
  if (!c) return 1;
  return 1000 / (c[1] - c[0]);
}

/** Sorts two taps into (patient's right, patient's left) using the reference line: the right one is on the image left. */
export function orderTaps(a: Pt, b: Pt, g: Guides): [Pt, Pt] {
  const pa = pupilAngle(g);
  const along = (p: Pt) => p.x * Math.cos(pa) + p.y * Math.sin(pa);
  return along(a) <= along(b) ? [a, b] : [b, a];
}

/**
 * Template placed from the two canine tips. `nudge` (px) moves the design along its incisal line (positive = to the
 * image right). Shape, proportion, count, shade, arc and wl are kept.
 */
export function fitFromCanines(d: Design, g: Guides, tapA: Pt, tapB: Pt, nudge = 0): Design {
  const [R, L] = orderTaps(tapA, tapB, g);
  const span = Math.hypot(L.x - R.x, L.y - R.y);
  if (span < 4) return d;
  const pa = pupilAngle(g);
  let tilt = deg(Math.atan2(L.y - R.y, L.x - R.x) - pa);
  tilt = ((tilt + 540) % 360) - 180;
  tilt = Math.round(Math.max(-FIT_TILT_MAX, Math.min(FIT_TILT_MAX, tilt)) * 10) / 10;
  const width = span * canineSpanFactor(d);
  const angle = pa + (tilt * Math.PI) / 180;
  const base: Design = { ...d, width, tilt, center: { x: 0, y: 0 } };
  // canine incisal edge (local y of the box bottom) relative to the central incisal line, at this size and arc
  const can = toothBoxes(base).filter((x) => x.kind === 2);
  const cy = can.length ? can.reduce((s, x) => s + x.bottom, 0) / can.length : 0;
  const cc = canineCentres(base) ?? [0, 0];
  const cx = (cc[0] + cc[1]) / 2; // 0 for symmetric boxes
  const off = toImage({ x: cx - nudge, y: cy }, base, angle); // where the tap midpoint sits relative to center
  const mid = { x: (R.x + L.x) / 2, y: (R.y + L.y) / 2 };
  return { ...base, center: { x: mid.x - off.x, y: mid.y - off.y } };
}

/** Minimal mask view (0 = not tooth, >0 = tooth) at `w × h`, covering the photo at `w / imgW` px per image px. */
export interface FitMask {
  w: number;
  h: number;
  data: Uint8Array | Uint8ClampedArray;
}

export interface FitRefinement {
  design: Design;
  /** crown height of the centrals measured from the mask (image px), when reliable */
  crownPx?: number;
  /** wl applied from the mask (undefined: kept) */
  wl?: number;
  /** shift along the incisal line applied from the central gap, image px (0: none) */
  nudge: number;
  /** false when the mask could not be used (design = tap result) */
  used: boolean;
  note: string;
}

function pointInPoly(p: Pt, poly: Pt[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 1e-12) + a.x) inside = !inside;
  }
  return inside;
}

const med = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2) : NaN;
};
const pct = (v: number[], q: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] : NaN;
};

/**
 * Refines a tap-fitted design with the existing-teeth mask:
 *  1. Central crown height: per column across both centrals, the run of tooth pixels from the incisal line towards the
 *     gum (lower: down the photo; upper: up). Columns whose run ends at the lip line (gum hidden) are skipped. The
 *     median sets wl = central width / height, clamped to the arch's range. Rejected when fewer than half the columns
 *     agree or the result is far outside the range (mask unreliable).
 *  2. Midline: in the middle of the crowns, the column with clearly fewer tooth pixels within ±FIT_TOL × central width
 *     of the planned contact is the central gap; the design moves there along the incisal line (taps re-applied).
 */
export function refineWithMask(d: Design, g: Guides, tapA: Pt, tapB: Pt, m: FitMask | null, imgW: number, lips?: Pt[]): FitRefinement {
  if (!m || !m.w || !m.h) return { design: d, nudge: 0, used: false, note: "No tooth outline yet: placed from the taps." };
  const k = m.w / imgW;
  const angle = pupilAngle(g) + (d.tilt * Math.PI) / 180;
  const at = (p: Pt) => {
    const x = Math.floor(p.x * k);
    const y = Math.floor(p.y * k);
    return x >= 0 && y >= 0 && x < m.w && y < m.h && m.data[y * m.w + x] > 0;
  };
  const inLips = (p: Pt) => !lips || lips.length < 3 || pointInPoly(p, lips);
  const cw = centralWidth(d);
  const L0 = centralLength(d);
  const lower = isLower(d);
  const range = lower ? FIT_WL.lower : FIT_WL.upper;
  const step = Math.max(0.5, 1 / k) * 0.75; // image px per probe (finer than a mask px)
  const maxH = cw / (range.min * 0.7); // never walk further than a very long crown
  // 1) crown height
  const heights: number[] = [];
  let cols = 0;
  for (let x = -cw * 0.85; x <= cw * 0.85; x += Math.max(step, cw / 24)) {
    if (Math.abs(x) < cw * 0.18) continue; // the contact / gap between the centrals
    cols++;
    // first tooth pixel near the incisal line (the edge may sit in a shadow or a little off)
    let y = L0 * 0.12;
    let found = false;
    for (; y > -L0 * 0.3; y -= step) {
      if (at(toImage({ x, y }, d, angle))) {
        found = true;
        break;
      }
    }
    if (!found) continue;
    const y0 = Math.min(0, y);
    let gap = 0;
    let end = y;
    let cut = false;
    for (; y > -maxH; y -= step) {
      const p = toImage({ x, y }, d, angle);
      if (at(p)) {
        end = y;
        gap = 0;
      } else {
        if (!inLips(p)) {
          cut = true;
          break;
        }
        gap += step;
        // a thin dark line (the shadow under the opposing incisal edge) does not end the crown; the gum does
        if (gap > Math.max(3 / k, L0 * 0.1)) break;
      }
    }
    if (y <= -maxH) cut = true;
    if (cut) continue;
    heights.push(y0 - end);
  }
  let out = d;
  let wl: number | undefined;
  let crownPx: number | undefined;
  const notes: string[] = [];
  if (cols && heights.length >= cols * 0.5) {
    // upper part of the distribution: the gum margin is scalloped, its zenith (the crown height) is the highest point
    const H = pct(heights, 0.75);
    const raw = cw / H;
    if (H > 0 && raw >= range.min * 0.8 && raw <= range.max * 1.25) {
      crownPx = H;
      wl = Math.round(Math.max(range.min, Math.min(range.max, raw)) * 100) / 100;
      out = { ...out, wl };
      notes.push("length from the photo");
    }
  }
  // 2) central gap (visible midline) in the middle of the crowns
  const Lc = centralLength(out);
  const band: [number, number] = [-Lc * 0.65, -Lc * 0.25];
  const prof: { x: number; v: number }[] = [];
  const reach = cw * FIT_TOL;
  for (let x = -reach - cw * 0.15; x <= reach + cw * 0.15; x += step) {
    let n = 0;
    let t = 0;
    for (let y = band[0]; y <= band[1]; y += step) {
      const p = toImage({ x, y }, out, angle);
      if (!inLips(p)) continue;
      n++;
      if (at(p)) t++;
    }
    prof.push({ x, v: n ? t / n : NaN });
  }
  let nudge = 0;
  const vals = prof.filter((p) => p.v === p.v).map((p) => p.v);
  if (vals.length > 4) {
    const base = med(vals);
    let best = -1;
    for (let i = 0; i < prof.length; i++) {
      const p = prof[i];
      if (p.v !== p.v || Math.abs(p.x) > reach) continue;
      if (best < 0 || p.v < prof[best].v || (p.v === prof[best].v && Math.abs(p.x) < Math.abs(prof[best].x))) best = i;
    }
    // a real gap: clearly emptier than the crowns around it, and the crowns are there
    if (best >= 0 && base > 0.6 && prof[best].v < base * 0.6) {
      // centre of the run of columns at (near) the minimum
      const lim = prof[best].v + (base - prof[best].v) * 0.25;
      let a = best;
      let b = best;
      while (a > 0 && prof[a - 1].v === prof[a - 1].v && prof[a - 1].v <= lim) a--;
      while (b < prof.length - 1 && prof[b + 1].v === prof[b + 1].v && prof[b + 1].v <= lim) b++;
      nudge = Math.max(-reach, Math.min(reach, (prof[a].x + prof[b].x) / 2));
      if (Math.abs(nudge) < step) nudge = 0;
    }
  }
  if (nudge) {
    out = fitFromCanines(out, g, tapA, tapB, nudge);
    notes.push("centred on the central gap");
  } else if (wl !== undefined) out = fitFromCanines(out, g, tapA, tapB, 0); // wl changes the canine edge height
  const used = wl !== undefined || nudge !== 0;
  return {
    design: out,
    crownPx,
    wl,
    nudge,
    used,
    note: used ? `Fitted to the canines; ${notes.join(" and ")}.` : "Fitted to the canines. The tooth outline was unclear, so length is unchanged.",
  };
}

/** Both steps: taps → template, then the mask refinement (falls back to the tap result). */
export function fitToTeeth(d: Design, g: Guides, tapA: Pt, tapB: Pt, m: FitMask | null, imgW: number, lips?: Pt[]): FitRefinement {
  const placed = fitFromCanines(d, g, tapA, tapB);
  if (placed === d) return { design: d, nudge: 0, used: false, note: "The two taps are too close together." };
  return refineWithMask(placed, g, tapA, tapB, m, imgW, lips);
}

/** Canine tip positions (box centre, incisal edge) of a design in image px: patient's right, then left. For tests/UI. */
export function canineTips(d: Design, g: Guides): [Pt, Pt] {
  const angle = pupilAngle(g) + (d.tilt * Math.PI) / 180;
  const b = toothBoxes(d).filter((x) => x.kind === 2);
  const r = b.find((x) => x.side === -1)!;
  const l = b.find((x) => x.side === 1)!;
  return [toImage({ x: (r.x0 + r.x1) / 2, y: r.bottom }, d, angle), toImage({ x: (l.x0 + l.x1) / 2, y: l.bottom }, d, angle)];
}

/** Local position of an image point in the design frame (re-export for the UI). */
export const localOf = (p: Pt, d: Design, g: Guides) => toLocal(p, d, pupilAngle(g) + (d.tilt * Math.PI) / 180);
