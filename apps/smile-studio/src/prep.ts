// Preparation guide from a 2D frontal photo: per-tooth OUTLINE differences between the existing teeth (mask) and the
// planned design. Never a depth, prep type or material (docs/round3-clinical.md B). Wording and thresholds follow
// that spec exactly; the reference text there is printed by the UI, never computed per tooth.
import type { Mask, PrepResult, ToothPrep } from "./contracts";
import { centralWidth, designAngle, plannedOutlines, toothLabel, toothSpoken } from "./geometry";
import { analyse, imageToGrid, keepShapes, lipGrid, makeFrame, matchOpposing, MATCH_OPPOSING, photoCast, planInGrid, resampleLab, resampleMask, shadeTarget, type EngineScene, type Frame } from "./photoTeeth";
import { deltaE00Parts } from "./planner";
import { isLower } from "./geometry";

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

/** A tooth with more than this % of its planned outline behind the opposing teeth gets no length change (round 6). */
export const HIDDEN_LENGTH_PCT = 20;
/** Clinician / sheet wording for such a tooth, and the map legend (round 6). */
export const HIDDEN_NOTE = "Partly hidden behind the upper teeth: length not measurable from this photo.";
export const HIDDEN_NOTE_UPPER = "Partly hidden behind the lower teeth: length not measurable from this photo.";
export const HIDDEN_LEGEND = "Hidden behind the upper teeth — not measurable";
export const HIDDEN_LEGEND_UPPER = "Hidden behind the lower teeth — not measurable";
export const hiddenNote = (lower: boolean) => (lower ? HIDDEN_NOTE : HIDDEN_NOTE_UPPER);
export const hiddenLegend = (lower: boolean) => (lower ? HIDDEN_LEGEND : HIDDEN_LEGEND_UPPER);

/**
 * Planned-tooth pixels covered by the OPPOSING teeth (grid, 0..1), e.g. the lower incisal third behind the upper
 * incisors in a normal overbite. Per planned column, the opposing teeth start where the existing run of this arch
 * ends and, within a small gap (the shadow line between the arches), tooth again begins: tooth in the mask (an
 * automatic mask holds both arches) or, when the photo is available, a light non-red pixel (a mask painted on the
 * lower teeth only). An open space before the opposing teeth stays measurable. The column analysis' own "hidden
 * edge" (the occlusal curve) also counts. For the upper arch only that last rule applies: in a normal bite the lower
 * teeth sit BEHIND the upper ones, so pixels below the upper edge are visible, not hidden.
 * `junction[x]` = 1 where the existing edge of this column is that boundary (its true length is not visible).
 */
export function hiddenByOpposing(
  f: Frame,
  plan: ReturnType<typeof planInGrid>,
  an: ReturnType<typeof analyse>,
  E: Float32Array,
  lip: Float32Array,
  Lg?: Float32Array,
): { mask: Float32Array; junction: Uint8Array; any: boolean } {
  const { gw, gh } = f;
  const mask = new Float32Array(gw * gh);
  const junction = new Uint8Array(gw);
  const L = plan.L;
  const gapTol = Math.max(2, L * 0.12);
  const opp = (j: number) => {
    if (lip[j] < 0.5) return false;
    if (E[j] >= 0.5) return true;
    if (!Lg) return false;
    const l = Lg[j * 3];
    const a = Lg[j * 3 + 1];
    return l >= 58 && a < 15;
  };
  let any = false;
  const osA = new Float32Array(gw).fill(NaN);
  for (let x = plan.x0; x < plan.x1; x++) {
    const pb = plan.pBot[x];
    if (pb !== pb) continue;
    const si = Math.min(gw - 1, Math.max(0, Math.round(an.X[x] - 0.5)));
    const e = an.eI[si];
    if (e !== e) continue;
    let os = NaN;
    if (an.hidden[si]) os = e;
    else if (plan.lower && e < pb) {
      for (let y = Math.max(0, Math.ceil(e)); y < Math.min(gh - 1, Math.ceil(pb) + 1); y++) {
        if (opp(y * gw + x) && opp((y + 1) * gw + x)) {
          os = y - e <= gapTol ? e : y;
          break;
        }
      }
    }
    if (os !== os) continue;
    if (os <= e + 0.5) junction[x] = 1;
    osA[x] = os;
  }
  // thin columns without a run of their own (a contact or embrasure between two teeth) take their neighbours' value
  const fill = Math.max(2, Math.round(L * 0.06));
  for (let x = plan.x0; x < plan.x1; x++) {
    if (osA[x] === osA[x] || plan.pBot[x] !== plan.pBot[x]) continue;
    for (let dx = 1; dx <= fill; dx++) {
      const l = x - dx >= 0 ? osA[x - dx] : NaN;
      const r = x + dx < gw ? osA[x + dx] : NaN;
      if (l === l || r === r) {
        osA[x] = l === l && r === r ? Math.max(l, r) : l === l ? l : r;
        break;
      }
    }
  }
  for (let x = plan.x0; x < plan.x1; x++) {
    const pb = plan.pBot[x];
    const os = osA[x];
    if (pb !== pb || os !== os) continue;
    const c = an.cDst[x] === an.cDst[x] ? an.cDst[x] : plan.pTop[x];
    for (let y = Math.max(0, Math.floor(Math.max(os, c))); y < Math.min(gh, Math.ceil(pb)); y++) {
      const j = y * gw + x;
      if (lip[j] < 0.5) continue;
      const cov = Math.min(1, Math.max(0, y + 1 - os)) * Math.min(1, Math.max(0, pb - y));
      if (cov > 0) {
        mask[j] = cov;
        any = true;
      }
    }
  }
  return { mask, junction, any };
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
  // shade only: the outline is the patient's own, so nothing is added or reduced (only the colour changes)
  const shadeOnly = scene.design.change === "shade";
  if (shadeOnly) keepShapes(f, plan, an, E, lip);
  // the design's target colour, as the renderer uses it (in the photo's light)
  const target = Lg
    ? ((scene.design.shade === MATCH_OPPOSING ? matchOpposing(f, plan, an, E, lip, Lg) : null) ??
      shadeTarget(scene.design.shade === MATCH_OPPOSING ? "A1" : scene.design.shade, isLower(scene.design), photoCast(Lg, E, lip)))
    : null;
  const { gw, gh } = f;
  const d = scene.design;
  const thrPx = pxPerMm ? PREP_THRESHOLDS.suppressMm * pxPerMm : centralWidth(d) * 0.04;
  const hid = hiddenByOpposing(f, plan, an, E, lip, Lg);
  // hidden pixels are not measurable: never "added" (reduction only exists on visible existing tooth)
  for (let j = 0; j < hid.mask.length; j++) if (hid.mask[j] >= 0.5) an.add[j] = 0;

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
    let hidT = 0;
    let planA = 0;
    let hidA = 0;
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
        if (tt && hid.mask[j] >= 0.5) hidT++;
      }
      // planned area up to the PLANNED edge (also where it runs behind the opposing teeth) and its hidden part
      const pb0 = plan.pBot[x];
      const c0 = an.cDst[x];
      if (pb0 === pb0 && c0 === c0)
        for (let y = Math.max(0, Math.floor(c0)); y < Math.min(gh, Math.ceil(pb0)); y++) {
          const j = y * gw + x;
          if (lip[j] < 0.5) continue;
          planA++;
          if (hid.mask[j] >= 0.5) hidA++;
        }
    }
    const hiddenPct = planA ? (100 * hidA) / planA : 0;
    const lengthHidden = hiddenPct > HIDDEN_LENGTH_PCT;
    // incisal length: middle half of the tooth, columns with a visible edge (or hidden but longer than the plan)
    const lens: number[] = [];
    const w = t.c1 - t.c0;
    for (let x = Math.floor(t.c0 + w * 0.25); x < Math.ceil(t.c1 - w * 0.25); x++) {
      const si = Math.min(gw - 1, Math.max(0, Math.round(an.X[x] - 0.5)));
      const e = an.eI[si];
      const pe = an.pEnd[x];
      const pb = plan.pBot[x];
      if (e !== e || pe !== pe) continue;
      // the existing edge here is where the opposing teeth start: its true length is not visible
      if (hid.junction[x]) continue;
      if (an.edge[si]) lens.push(pb - e);
      else if (an.hidden[si] && pb < e) lens.push(pb - e);
      else if (an.hidden[si]) lens.push(0);
    }
    lens.sort((a, b) => a - b);
    const lengthPx = lens.length && !lengthHidden ? lens[lens.length >> 1] / k : 0;
    // proximal: planned vs matched existing boundary (positive = plan extends further = add)
    // with a gap (diastema) the existing tooth ends at the gap edge, not the gap centre
    const left = an.bFound[i] ? an.gER[i] - an.bP[i] : 0;
    const right = an.bFound[i + 1] ? an.bP[i + 1] - an.gEL[i + 1] : 0;
    const side = t.box.side;
    const mesialPx = (side === 1 ? left : right) / k;
    const distalPx = (side === 1 ? right : left) / k;
    const unknown = tArea === 0 || eArea < tArea * 0.05;
    const overlapPct = eArea ? (100 * both) / eArea : 0;
    const visT = tArea - hidT;
    const addPct = visT > 0 ? (100 * addA) / visT : 0;
    const reducePct = eArea ? (100 * redA) / eArea : 0;
    const add = !shadeOnly && (addPct >= 3 || lengthPx > thrPx || mesialPx > thrPx || distalPx > thrPx);
    const red = !shadeOnly && (reducePct >= 3 || lengthPx < -thrPx || mesialPx < -thrPx || distalPx < -thrPx);
    // today's colour of this tooth: median of its visible enamel (no shine, no shadow)
    let shade: ToothPrep["shade"];
    if (Lg && target) {
      const Ls: number[] = [];
      const as: number[] = [];
      const bs: number[] = [];
      for (let x = t.c0; x < t.c1; x++) {
        const c = an.eC[x];
        const e = an.eI[x];
        if (c !== c || e !== e) continue;
        for (let y = Math.max(0, Math.ceil(c)); y < Math.min(gh, Math.floor(e)); y++) {
          const j = y * gw + x;
          if (E[j] < 0.5 || lip[j] <= 0.5) continue;
          const L = Lg[j * 3];
          if (L > 93 || L < 45) continue;
          Ls.push(L);
          as.push(Lg[j * 3 + 1]);
          bs.push(Lg[j * 3 + 2]);
        }
      }
      if (Ls.length >= 20) {
        const med = (v: number[]) => (v.sort((p, q) => p - q), v[v.length >> 1]);
        const now: [number, number, number] = [med(Ls), med(as), med(bs)];
        const tgt = target.body;
        const r1 = (v: number) => Math.round(v * 10) / 10;
        shade = {
          now: now.map(r1) as [number, number, number],
          target: tgt.map(r1) as [number, number, number],
          dE: r1(deltaE00Parts(now, tgt).dE),
          dL: r1(tgt[0] - now[0]),
          dC: r1(Math.hypot(tgt[1], tgt[2]) - Math.hypot(now[1], now[2])),
          db: r1(tgt[2] - now[2]),
        };
      }
    }
    teeth.push({
      kind: t.box.kind,
      side,
      label: toothLabel(d, t.box.kind, side),
      lengthPx: unknown || shadeOnly ? 0 : lengthPx,
      mesialPx: unknown || shadeOnly ? 0 : mesialPx,
      distalPx: unknown || shadeOnly ? 0 : distalPx,
      overlapPct: unknown ? 0 : overlapPct,
      addPct: unknown ? 100 : addPct,
      reducePct: unknown ? 0 : reducePct,
      category: unknown ? "unknown" : add && red ? "mixed" : add ? "additive" : red ? "reduction" : "unchanged",
      ...(hiddenPct >= 0.5 ? { hiddenPct: Math.round(hiddenPct * 10) / 10 } : {}),
      ...(shade ? { shade } : {}),
    });
  }
  // order: patient's right distal → left distal (as seen on the photo, left to right)
  teeth.sort((a, b) => a.side * (a.kind + 0.5) - b.side * (b.kind + 0.5));

  // masks back to mask (image) coordinates
  const add: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
  const reduce: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
  const scope: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
  const hidden: Mask = { w: existing.w, h: existing.h, data: new Uint8Array(existing.w * existing.h) };
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
      if (hid.mask[g] >= 0.5) hidden.data[o] = 255;
    }
  }
  const res: PrepResult = { add, reduce, teeth, ...(hid.any ? { hidden } : {}) };
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
  const hiddenLen = (t.hiddenPct ?? 0) > HIDDEN_LENGTH_PCT;
  if (hiddenLen) clinician.push(hiddenNote(lower));
  else clinician.push(`Incisal length: ${describe(t.lengthPx, pxPerMm)}`);
  clinician.push(`Mesial width: ${describe(t.mesialPx, pxPerMm)}`);
  clinician.push(`Distal width: ${describe(t.distalPx, pxPerMm)}`);
  clinician.push(`Outline overlap: ${Math.round(t.overlapPct)} %`);
  const thr = pxPerMm ? PREP_THRESHOLDS.suppressMm * pxPerMm : 1;
  if (t.category === "additive") clinician.push("Outline is additive in this view.");
  else if (t.category === "mixed") clinician.push("Mixed: additive and reduction areas.");
  else if (t.category === "reduction") {
    const where: string[] = [];
    if (!hiddenLen && t.lengthPx < -thr) where.push("incisal");
    if (t.mesialPx < -thr) where.push("mesial");
    if (t.distalPx < -thr) where.push("distal");
    if (!where.length) where.push("incisal");
    clinician.push(`Outline reduction: tooth is outside the plan at the ${joinList(where)}.`);
  } else clinician.push("Outline unchanged in this view.");
  const sh = shadeLine(t);
  if (sh) clinician.push(sh);
  if (pxPerMm) {
    if (!hiddenLen && -t.lengthPx / pxPerMm > PREP_THRESHOLDS.incisalWarnMm) clinician.push("Large incisal change: check occlusion, length and pulp before planning.");
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
    if (!hiddenLen && Math.abs(lm) >= PREP_THRESHOLDS.suppressMm) parts.push(`${lm > 0 ? "longer" : "shorter"} by ${aboutMm(lm)}`);
    if (Math.abs(wm) >= PREP_THRESHOLDS.suppressMm) parts.push(`${wm > 0 ? "wider" : "narrower"} by ${aboutMm(wm)}`);
  } else {
    if (!hiddenLen && Math.abs(t.lengthPx) >= thr * 2) parts.push(`a little ${t.lengthPx > 0 ? "longer" : "shorter"}`);
    if (Math.abs(widthPx) >= thr * 2) parts.push(`a little ${widthPx > 0 ? "wider" : "narrower"}`);
  }
  let patient = parts.length ? `${name}: design is ${parts.join(" and ")}.` : `${name}: design keeps about the same outline.`;
  if (t.shade && t.shade.dE >= SHADE_ACCEPT) {
    const c: string[] = [];
    if (t.shade.dL >= 1.5) c.push("lighter");
    else if (t.shade.dL <= -1.5) c.push("a little deeper");
    if (t.shade.db <= -1.5) c.push("less yellow");
    patient += ` Colour: ${c.length ? c.join(" and ") : "adjusted"} in the design.`;
  }
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
/** FDI number for a tooth (e.g. lower right canine → 43). */
export function fdiOf(arch: "upper" | "lower", kind: number, side: -1 | 1) {
  const q = arch === "lower" ? (side === -1 ? 4 : 3) : side === -1 ? 1 : 2;
  return q * 10 + kind + 1;
}

export interface PrepMapOptions {
  /**
   * Line unit in image px. Omit on screen (lines stay a constant screen width). Exports pass a size relative to the
   * teeth (e.g. central width / 40) so the outlines stay visible after the image is cropped and scaled onto a page.
   */
  lineUnit?: number;
  /** Draw FDI numbers on the planned teeth (exports). */
  labels?: boolean;
}

const regionCache = new WeakMap<PrepResult, { add: Float32Array[]; reduce: Float32Array[] }>();

function strokePolys(ctx: CanvasRenderingContext2D, polys: Float32Array[]) {
  ctx.beginPath();
  for (const l of polys) {
    ctx.moveTo(l[0], l[1]);
    for (let i = 2; i < l.length; i += 2) ctx.lineTo(l[i], l[i + 1]);
    ctx.closePath();
  }
}

export function drawPrepMap(ctx: CanvasRenderingContext2D, scene: EngineScene, prep: PrepResult, opts: PrepMapOptions = {}) {
  let cv = mapCache.get(prep);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = prep.add.w;
    cv.height = prep.add.h;
    const c = cv.getContext("2d")!;
    const id = c.createImageData(cv.width, cv.height);
    const hd = prep.hidden?.data;
    const mw = cv.width;
    for (let i = 0; i < prep.add.data.length; i++) {
      const o = i * 4;
      if (hd && hd[i] && !prep.add.data[i] && !prep.reduce.data[i]) {
        // hidden behind the opposing teeth: neutral grey with diagonal hatching (reads as "no data", not a colour)
        const on = ((i % mw) + ((i / mw) | 0)) % 6 < 2;
        id.data[o] = id.data[o + 1] = id.data[o + 2] = on ? 235 : 120;
        id.data[o + 3] = on ? 190 : 110;
        continue;
      }
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
  const u = opts.lineUnit ?? 1 / Math.max(1e-6, Math.hypot(m.a, m.b)); // one screen px in image px
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cv, 0, 0, scene.imgW, scene.imgH);
  // solid outlines around every added (green) and reduced (red) area, so even thin strips stay visible
  let regions = regionCache.get(prep);
  if (!regions) {
    const k = scene.imgW / prep.add.w;
    regions = { add: contours(prep.add, k), reduce: contours(prep.reduce, k) };
    regionCache.set(prep, regions);
  }
  ctx.lineJoin = "round";
  for (const [polys, colour] of [
    [regions.add, "rgb(30,190,100)"],
    [regions.reduce, "rgb(235,64,52)"],
  ] as const) {
    if (!polys.length) continue;
    strokePolys(ctx, polys);
    ctx.fillStyle = colour === "rgb(30,190,100)" ? "rgba(30,190,100,0.28)" : "rgba(235,64,52,0.3)";
    ctx.fill("evenodd");
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2 * u;
    ctx.stroke();
  }
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
  if (opts.labels) {
    const arch = scene.design.arch === "lower" ? "lower" : "upper";
    const base = Math.max(10, centralWidth(scene.design) * 0.32);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const o of outs) {
      // narrow (back) teeth get smaller numbers so neighbours never overlap
      const xs = o.pts.map((p) => p.x);
      const fs = Math.max(8, Math.min(base, (Math.max(...xs) - Math.min(...xs)) * 0.5));
      ctx.font = `600 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      // label just outside the incisal edge, away from the gum
      const cx = o.pts.reduce((a, p) => a + p.x, 0) / o.pts.length;
      const ys = o.pts.map((p) => p.y);
      const y = arch === "lower" ? Math.min(...ys) - fs * 0.75 : Math.max(...ys) + fs * 0.75;
      const t = String(fdiOf(arch, o.box.kind, o.box.side));
      // what this tooth needs: chip colour + a short tag (ΔE for shade, add / reduce for outline)
      const tp = prep.teeth.find((q) => q.kind === o.box.kind && q.side === o.box.side);
      const tag = tp ? changeTag(tp) : { text: "", kind: "none" as const };
      const bg = { shade: "rgba(176,120,30,0.92)", add: "rgba(24,140,80,0.92)", reduce: "rgba(200,52,44,0.92)", mixed: "rgba(120,70,150,0.92)", none: "rgba(20,24,22,0.78)" }[tag.kind];
      const two = !!tag.text;
      const fs2 = fs * 0.62;
      ctx.font = `600 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      let w = ctx.measureText(t).width + fs * 0.5;
      if (two) {
        ctx.font = `600 ${fs2}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        w = Math.max(w, ctx.measureText(tag.text).width + fs * 0.4);
      }
      const hh = two ? fs * 1.95 : fs * 1.24;
      const yy = arch === "lower" ? y - (two ? fs * 0.35 : 0) : y + (two ? fs * 0.35 : 0);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, yy - hh / 2, w, hh, fs * 0.3);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `600 ${fs}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.fillText(t, cx, two ? yy - hh / 2 + fs * 0.62 : yy + fs * 0.04);
      if (two) {
        ctx.font = `600 ${fs2}px -apple-system, "Segoe UI", Roboto, sans-serif`;
        ctx.fillText(tag.text, cx, yy + hh / 2 - fs2 * 0.7);
      }
    }
  }
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

/** ΔE00 acceptability threshold (Paravina 2015, PMID 25740131). */
export const SHADE_ACCEPT = 1.8;

/** Clinician line for the tooth's shade change (photo estimate), or null without photo data. */
export function shadeLine(t: ToothPrep): string | null {
  const s = t.shade;
  if (!s) return null;
  if (s.dE < SHADE_ACCEPT) return `Shade: matches the target (ΔE00 ${s.dE.toFixed(1)}, photo estimate).`;
  const parts: string[] = [];
  if (Math.abs(s.dL) >= 1.5) parts.push(s.dL > 0 ? `lighter by ${s.dL.toFixed(0)} L*` : `darker by ${(-s.dL).toFixed(0)} L*`);
  if (Math.abs(s.db) >= 1.5) parts.push(s.db < 0 ? `less yellow by ${(-s.db).toFixed(0)} b*` : `more yellow by ${s.db.toFixed(0)} b*`);
  else if (Math.abs(s.dC) >= 1.5) parts.push(s.dC < 0 ? `less saturated` : `more saturated`);
  return `Shade change: ${parts.length ? joinList(parts) : "small hue shift"} (ΔE00 ${s.dE.toFixed(1)}, beyond ${SHADE_ACCEPT} acceptability; photo estimate, confirm with a shade guide).`;
}

/** Short tag for the map chip: what this tooth needs. */
export function changeTag(t: ToothPrep): { text: string; kind: "shade" | "add" | "reduce" | "mixed" | "none" } {
  const shade = !!t.shade && t.shade.dE >= SHADE_ACCEPT;
  const kind = t.category === "additive" ? "add" : t.category === "reduction" ? "reduce" : t.category === "mixed" ? "mixed" : shade ? "shade" : "none";
  const bits: string[] = [];
  if (t.category === "additive") bits.push("add");
  if (t.category === "reduction") bits.push("reduce");
  if (t.category === "mixed") bits.push("add+reduce");
  if (shade) bits.push(`ΔE ${t.shade!.dE.toFixed(0)}`);
  return { text: bits.join(" · "), kind };
}
