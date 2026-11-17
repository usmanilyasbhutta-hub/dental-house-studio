// Preparation guide from a 2D frontal photo: per-tooth OUTLINE differences between the existing teeth (mask) and the
// planned design. Never a depth, prep type or material (docs/round3-clinical.md B). Wording and thresholds follow
// that spec exactly; the reference text there is printed by the UI, never computed per tooth.
import type { Mask, PrepResult, ToothPrep } from "./contracts";
import { centralWidth, designAngle, plannedOutlines, toothLabel, toothSpoken } from "./geometry";
import { analyse, imageToGrid, lipGrid, makeFrame, planInGrid, resampleLab, resampleMask, type EngineScene, type Frame } from "./photoTeeth";

export type { PrepResult, ToothPrep };

/** MANDATORY disclaimer (screen + every export), verbatim from the clinical spec. */
export const PREP_DISCLAIMER =
  "Planning aid only. Measured from a 2D photo: shows outline length and width differences (±0.5 mm), not facial depth or the amount of tooth to remove. Preparation depth must be planned on a mock-up, wax-up or silicone index and decided by the treating dentist. Enamel values are population averages, not this patient's.";

/**
 * Typical labial enamel mm (cervical, middle, incisal). Pei 2025 PMID 40300924; Pahlevan 2014 PMID 25584054 (PMC4283744).
 * Middle interpolated; canine/premolar reuse upper lateral (no data, conservative). Show as "typical values, not this patient".
 */
export const ENAMEL_MM = {
  upperCentral: [0.35, 0.65, 0.95],
  upperLateral: [0.25, 0.6, 0.95],
  lowerIncisor: [0.3, 0.5, 0.75],
  canine: [0.25, 0.6, 0.95],
};

/** Fixed note for lower incisors (spec B). */
export const LOWER_INCISOR_NOTE = "Thin enamel; additive or minimal approaches are usually explored first; clinician to decide.";
/** Clinician sheet note for the lower shade (spec D). */
export const LOWER_SHADE_NOTE = "Take the lower shade separately (cervical/body/incisal), at the same session and light as the upper.";

/** Suppression and warning thresholds, mm (spec B). */
export const PREP_THRESHOLDS = { suppressMm: 0.3, incisalWarnMm: 2.0, proximalWarnMm: 0.5, photoTolMm: 0.5 };

// Extra data kept for drawing (not part of the contract)
interface PrepExtra {
  frame: Frame;
  /** existing teeth within the plan's scope, at mask resolution */
  scope: Mask;
  scale: number;
}
const extras = new WeakMap<PrepResult, PrepExtra>();

let photoReader: ((s: EngineScene) => { data: Uint8ClampedArray; rx: number; ry: number; rw: number; rh: number } | null) | null = null;
/** The browser layer registers how to read photo pixels (keeps this module free of DOM calls in tests). */
export function setPrepPhotoReader(fn: typeof photoReader) {
  photoReader = fn;
}

/**
 * Compares the planned outlines with the existing-teeth mask at mask resolution. Cervical outline differences are
 * ignored (the existing gum line is kept); incisal length and mesial/distal width changes are measured per tooth.
 * px values are IMAGE px (multiply by 1 / pxPerMm for mm).
 */
export function computePrep(scene: EngineScene, existing: Mask, pxPerMm?: number): PrepResult {
  const k = existing.w / scene.imgW;
  const f = makeFrame(scene, k);
  const E = resampleMask(f, existing, scene.imgW, scene.imgH);
  const lip = lipGrid(f, scene.lips);
  let Lg: Float32Array | undefined;
  const px = photoReader?.(scene);
  if (px) Lg = resampleLab(f, px.data, px.rx, px.ry, px.rw, px.rh);
  const plan = planInGrid(f, scene.design);
  const an = analyse(f, plan, E, lip, Lg);
  const { gw, gh } = f;
  const d = scene.design;
  const thrPx = pxPerMm ? PREP_THRESHOLDS.suppressMm * pxPerMm : centralWidth(d) * 0.04;

  // boundaries sorted left → right; teeth sorted the same way
  const sorted = [...plan.teeth].sort((a, b) => a.gx0 - b.gx0);
  const teeth: ToothPrep[] = [];
  for (const t of plan.teeth) {
    const i = sorted.indexOf(t);
    let tArea = 0;
    let eArea = 0;
    let both = 0;
    let addA = 0;
    let redA = 0;
    const h = t.gbottom - t.gtop;
    for (let x = t.c0; x < t.c1; x++) {
      const si = Math.min(gw - 1, Math.max(0, Math.round(an.X[x] - 0.5)));
      const pe = an.pEnd[x];
      const limit = Math.max(pe === pe ? pe : t.gbottom, an.edge[si] && an.eI[si] === an.eI[si] ? an.eI[si] : -Infinity) + 1;
      for (let y = Math.max(0, Math.floor(t.gtop - h * 0.5)); y < Math.min(gh, Math.ceil(limit)); y++) {
        const j = y * gw + x;
        if (lip[j] < 0.5) continue;
        const tt = an.T[j] >= 0.5;
        const ee = E[j] >= 0.5;
        if (tt) tArea++;
        if (ee) eArea++;
        if (tt && ee) both++;
        if (an.add[j] >= 0.5) addA++;
        if (an.reduce[j] >= 0.5) redA++;
      }
    }
    // incisal length: middle half of the tooth, columns with a visible edge (or hidden but longer than the plan)
    const lens: number[] = [];
    const w = t.c1 - t.c0;
    for (let x = Math.floor(t.c0 + w * 0.25); x < Math.ceil(t.c1 - w * 0.25); x++) {
      const si = Math.min(gw - 1, Math.max(0, Math.round(an.X[x] - 0.5)));
      const e = an.eI[si];
      const pe = an.pEnd[x];
      const pb = plan.pBot[x];
      if (e !== e || pe !== pe) continue;
      if (an.edge[si]) lens.push(pb - e);
      else if (an.hidden[si] && pb < e) lens.push(pb - e);
      else if (an.hidden[si]) lens.push(0);
    }
    lens.sort((a, b) => a - b);
    const lengthPx = lens.length ? lens[lens.length >> 1] / k : 0;
    // proximal: planned vs matched existing boundary (positive = plan extends further = add)
    const left = an.bFound[i] ? an.bE[i] - an.bP[i] : 0;
    const right = an.bFound[i + 1] ? an.bP[i + 1] - an.bE[i + 1] : 0;
    const side = t.box.side;
    const mesialPx = (side === 1 ? left : right) / k;
    const distalPx = (side === 1 ? right : left) / k;
    const unknown = tArea === 0 || eArea < tArea * 0.05;
    const overlapPct = eArea ? (100 * both) / eArea : 0;
    const addPct = tArea ? (100 * addA) / tArea : 0;
    const reducePct = eArea ? (100 * redA) / eArea : 0;
    const add = addPct >= 3 || lengthPx > thrPx || mesialPx > thrPx || distalPx > thrPx;
    const red = reducePct >= 3 || lengthPx < -thrPx || mesialPx < -thrPx || distalPx < -thrPx;
    teeth.push({
      kind: t.box.kind,
      side,
      label: toothLabel(d, t.box.kind, side),
      lengthPx: unknown ? 0 : lengthPx,
      mesialPx: unknown ? 0 : mesialPx,
      distalPx: unknown ? 0 : distalPx,
      overlapPct: unknown ? 0 : overlapPct,
      addPct: unknown ? 100 : addPct,
      reducePct: unknown ? 0 : reducePct,
      category: unknown ? "unknown" : add && red ? "mixed" : add ? "additive" : red ? "reduction" : "unchanged",
    });
  }
  // order: patient's right distal → left distal (as seen on the photo, left to right)
  teeth.sort((a, b) => a.side * (a.kind + 0.5) - b.side * (b.kind + 0.5));

  // masks back to mask (image) coordinates
  const add: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
  const reduce: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
  const scope: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
  // scope: existing tooth inside the planned teeth's columns, up to the drawn edge / visible existing edge
  const inScope = new Uint8Array(gw * gh);
  for (let x = plan.x0; x < plan.x1; x++) {
    const pe = an.pEnd[x];
    if (pe !== pe) continue;
    const si = Math.min(gw - 1, Math.max(0, Math.round(an.X[x] - 0.5)));
    const lim = Math.max(pe, an.edge[si] && an.eI[si] === an.eI[si] ? an.eI[si] : pe);
    const top = an.cDst[x] === an.cDst[x] ? an.cDst[x] - 2 : 0;
    for (let y = Math.max(0, Math.floor(top)); y < Math.min(gh, Math.ceil(lim) + 1); y++) inScope[y * gw + x] = 1;
  }
  const q = { x: 0, y: 0 };
  for (let j = 0; j < existing.h; j++) {
    for (let i = 0; i < existing.w; i++) {
      imageToGrid(f, (i + 0.5) / k, (j + 0.5) / k, q);
      const u = Math.floor(q.x);
      const v = Math.floor(q.y);
      if (u < 0 || v < 0 || u >= gw || v >= gh) continue;
      const g = v * gw + u;
      const o = j * existing.w + i;
      if (an.add[g] >= 0.5) add.data[o] = 255;
      if (an.reduce[g] >= 0.5) reduce.data[o] = 255;
      if (inScope[g] && existing.data[o]) scope.data[o] = 255;
    }
  }
  const res: PrepResult = { add, reduce, teeth };
  extras.set(res, { frame: f, scope, scale: k });
  return res;
}

// ---------- wording (spec B and C) ----------
const MINUS = "−";

/** mm value rounded to 0.1, signed, or "≈ 0" below the suppression threshold. */
export function fmtMm(mm: number): string {
  if (Math.abs(mm) < PREP_THRESHOLDS.suppressMm) return "≈ 0";
  const r = Math.round(Math.abs(mm) * 10) / 10;
  return `${mm > 0 ? "+" : MINUS}${r.toFixed(1)} mm`;
}

function describe(px: number, pxPerMm?: number): string {
  if (pxPerMm) {
    const mm = px / pxPerMm;
    const v = fmtMm(mm);
    if (v === "≈ 0") return `≈ 0 (±${PREP_THRESHOLDS.photoTolMm} mm (photo))`;
    return `${v} (${mm > 0 ? "add" : "reduce"}) ±${PREP_THRESHOLDS.photoTolMm} mm (photo)`;
  }
  const r = Math.round(px);
  if (Math.abs(r) < 1) return "≈ 0 (not calibrated)";
  return `${r > 0 ? "+" : MINUS}${Math.abs(r)} px (${r > 0 ? "add" : "reduce"}; calibrate for mm)`;
}

/** Spoken tooth name from a label like "UR1" / "LL3". */
function spokenName(label: string, kind: number, side: -1 | 1) {
  return toothSpoken({ arch: label[0] === "L" ? "lower" : "upper" }, kind, side);
}

/** "about 1 mm" style rounding for patients: nearest 0.5 mm, at least 0.5 mm. */
function aboutMm(mm: number) {
  const r = Math.max(0.5, Math.round(Math.abs(mm) * 2) / 2);
  return `about ${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)} mm`;
}

/**
 * Clinician lines and one patient line for a tooth, per docs/round3-clinical.md B and C. Without a calibration
 * the values are in photo px and the mm thresholds (warnings) are not applied.
 */
export function prepWording(t: ToothPrep, pxPerMm?: number): { clinician: string[]; patient: string } {
  const name = spokenName(t.label, t.kind, t.side);
  const lower = t.label[0] === "L";
  const clinician: string[] = [];
  if (t.category === "unknown") {
    clinician.push("No existing tooth found in the photo for this outline: check the tooth mask.");
    if (lower && t.kind <= 1) clinician.push(LOWER_INCISOR_NOTE);
    return { clinician, patient: `${name}: the design shows a tooth shape where the photo shows none today.` };
  }
  clinician.push(`Incisal length: ${describe(t.lengthPx, pxPerMm)}`);
  clinician.push(`Mesial width: ${describe(t.mesialPx, pxPerMm)}`);
  clinician.push(`Distal width: ${describe(t.distalPx, pxPerMm)}`);
  clinician.push(`Outline overlap: ${Math.round(t.overlapPct)} %`);
  const thr = pxPerMm ? PREP_THRESHOLDS.suppressMm * pxPerMm : 1;
  if (t.category === "additive") clinician.push("Outline is additive in this view.");
  else if (t.category === "mixed") clinician.push("Mixed: additive and reduction areas.");
  else if (t.category === "reduction") {
    const where: string[] = [];
    if (t.lengthPx < -thr) where.push("incisal");
    if (t.mesialPx < -thr) where.push("mesial");
    if (t.distalPx < -thr) where.push("distal");
    if (!where.length) where.push("incisal");
    clinician.push(`Outline reduction: tooth is outside the plan at the ${joinList(where)}.`);
  } else clinician.push("Outline unchanged in this view.");
  if (pxPerMm) {
    if (-t.lengthPx / pxPerMm > PREP_THRESHOLDS.incisalWarnMm) clinician.push("Large incisal change: check occlusion, length and pulp before planning.");
    if (-t.mesialPx / pxPerMm > PREP_THRESHOLDS.proximalWarnMm || -t.distalPx / pxPerMm > PREP_THRESHOLDS.proximalWarnMm)
      clinician.push("Proximal reduction: contact areas involved; consider alignment or IPR alternatives.");
  }
  if (lower && t.kind <= 1) clinician.push(LOWER_INCISOR_NOTE);

  // patient: no preparation words, rounded, plain
  const parts: string[] = [];
  const widthPx = t.mesialPx + t.distalPx;
  if (pxPerMm) {
    const lm = t.lengthPx / pxPerMm;
    const wm = widthPx / pxPerMm;
    if (Math.abs(lm) >= PREP_THRESHOLDS.suppressMm) parts.push(`${lm > 0 ? "longer" : "shorter"} by ${aboutMm(lm)}`);
    if (Math.abs(wm) >= PREP_THRESHOLDS.suppressMm) parts.push(`${wm > 0 ? "wider" : "narrower"} by ${aboutMm(wm)}`);
  } else {
    if (Math.abs(t.lengthPx) >= thr * 2) parts.push(`a little ${t.lengthPx > 0 ? "longer" : "shorter"}`);
    if (Math.abs(widthPx) >= thr * 2) parts.push(`a little ${widthPx > 0 ? "wider" : "narrower"}`);
  }
  const patient = parts.length ? `${name}: design is ${parts.join(" and ")}.` : `${name}: design keeps about the same outline.`;
  return { clinician, patient };
}

function joinList(v: string[]) {
  if (v.length <= 1) return v.join("");
  return v.slice(0, -1).join(", ") + " and " + v[v.length - 1];
}

// ---------- prep map overlay ----------
const mapCache = new WeakMap<PrepResult, HTMLCanvasElement>();
const contourCache = new WeakMap<PrepResult, Float32Array[]>();

/**
 * Overlay in image coordinates (caller sets the transform): green where the design adds to a tooth, red where the
 * tooth lies outside the design, thin white planned outline, dashed existing outline. Line widths stay constant on
 * screen and have a dark under-stroke so they read on light teeth and dark mouths alike.
 */
export function drawPrepMap(ctx: CanvasRenderingContext2D, scene: EngineScene, prep: PrepResult) {
  let cv = mapCache.get(prep);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = prep.add.w;
    cv.height = prep.add.h;
    const c = cv.getContext("2d")!;
    const id = c.createImageData(cv.width, cv.height);
    for (let i = 0; i < prep.add.data.length; i++) {
      const o = i * 4;
      if (prep.add.data[i]) {
        id.data[o] = 40;
        id.data[o + 1] = 200;
        id.data[o + 2] = 110;
        id.data[o + 3] = 125;
      } else if (prep.reduce.data[i]) {
        id.data[o] = 235;
        id.data[o + 1] = 64;
        id.data[o + 2] = 52;
        id.data[o + 3] = 140;
      }
    }
    c.putImageData(id, 0, 0);
    mapCache.set(prep, cv);
  }
  const m = ctx.getTransform();
  const u = 1 / Math.max(1e-6, Math.hypot(m.a, m.b)); // one screen px in image px
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cv, 0, 0, scene.imgW, scene.imgH);
  // existing outline, dashed
  let lines = contourCache.get(prep);
  const ex = extras.get(prep);
  if (!lines && ex) {
    lines = contours(ex.scope, scene.imgW / ex.scope.w);
    contourCache.set(prep, lines);
  }
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (lines) {
    const path = () => {
      ctx.beginPath();
      for (const l of lines!) {
        ctx.moveTo(l[0], l[1]);
        for (let i = 2; i < l.length; i += 2) ctx.lineTo(l[i], l[i + 1]);
      }
    };
    path();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(20,24,22,0.55)";
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    ctx.setLineDash([5 * u, 4 * u]);
    ctx.strokeStyle = "rgba(255,226,140,0.95)";
    ctx.lineWidth = 1.4 * u;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // planned outline, solid white
  const outs = plannedOutlines(scene.design, designAngle(scene.design, scene.guides));
  ctx.beginPath();
  for (const o of outs) {
    o.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.strokeStyle = "rgba(20,24,22,0.6)";
  ctx.lineWidth = 3.2 * u;
  ctx.stroke();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 1.5 * u;
  ctx.stroke();
  ctx.restore();
}

/**
 * Marching-squares contour of a binary mask, chained into polylines (flat x,y arrays in IMAGE px via `scale`).
 * Pure; exported for tests.
 */
export function contours(m: Mask, scale = 1): Float32Array[] {
  const { w, h, data } = m;
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] ? 1 : 0);
  // segments between edge midpoints, keyed by doubled integer coordinates
  const next = new Map<number, number[]>();
  const key = (x2: number, y2: number) => y2 * (2 * w + 4) + x2;
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const ka = key(ax, ay);
    const kb = key(bx, by);
    (next.get(ka) ?? next.set(ka, []).get(ka)!).push(kb);
    (next.get(kb) ?? next.set(kb, []).get(kb)!).push(ka);
  };
  for (let y = -1; y < h; y++) {
    for (let x = -1; x < w; x++) {
      const c = (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
      if (c === 0 || c === 15) continue;
      // edge midpoints in doubled coords (+2 offset so -1 maps to ≥ 0): top, right, bottom, left
      const X = 2 * x + 2;
      const Y = 2 * y + 2;
      const T: [number, number] = [X + 1, Y];
      const R: [number, number] = [X + 2, Y + 1];
      const B: [number, number] = [X + 1, Y + 2];
      const Lp: [number, number] = [X, Y + 1];
      const seg = (p: [number, number], q: [number, number]) => add(p[0], p[1], q[0], q[1]);
      switch (c) {
        case 1:
        case 14:
          seg(Lp, B);
          break;
        case 2:
        case 13:
          seg(B, R);
          break;
        case 3:
        case 12:
          seg(Lp, R);
          break;
        case 4:
        case 11:
          seg(T, R);
          break;
        case 5:
          seg(Lp, T);
          seg(B, R);
          break;
        case 6:
        case 9:
          seg(T, B);
          break;
        case 7:
        case 8:
          seg(Lp, T);
          break;
        case 10:
          seg(T, R);
          seg(Lp, B);
          break;
      }
    }
  }
  const W2 = 2 * w + 4;
  const toXY = (k: number): [number, number] => [((k % W2) - 2) / 2 + 0.5, ((Math.floor(k / W2) - 2) / 2) + 0.5];
  const lines: Float32Array[] = [];
  const used = new Set<string>();
  const ekey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  for (const [start, nbs] of next) {
    for (const n0 of nbs) {
      if (used.has(ekey(start, n0))) continue;
      const pts: number[] = [];
      let prev = start;
      let cur = n0;
      used.add(ekey(start, n0));
      let p = toXY(start);
      pts.push(p[0] * scale, p[1] * scale);
      for (let guard = 0; guard < 1e6; guard++) {
        p = toXY(cur);
        pts.push(p[0] * scale, p[1] * scale);
        const cand = (next.get(cur) ?? []).find((q) => q !== prev && !used.has(ekey(cur, q)));
        if (cand === undefined) break;
        used.add(ekey(cur, cand));
        prev = cur;
        cur = cand;
      }
      if (pts.length >= 6) lines.push(simplify(pts));
    }
  }
  return lines;
}

/** Light smoothing (staircase → smooth) with a 3-tap average, keeping the ends. */
function simplify(p: number[]): Float32Array {
  const n = p.length / 2;
  const o = new Float32Array(p.length);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    o[i * 2] = (p[a * 2] + 2 * p[i * 2] + p[b * 2]) / 4;
    o[i * 2 + 1] = (p[a * 2 + 1] + 2 * p[i * 2 + 1] + p[b * 2 + 1]) / 4;
  }
  return o;
}
