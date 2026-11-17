// TEMPORARY SHIM for the round-3 engine (teeth mask + prep). The UI imports engine functions ONLY from here.
// When the real modules land, replace this whole file with:
//   export { detectTeeth, maskFromToothMask, toothMaskFromMask, paintMask } from "./teethMask";
//   export { computePrep, prepWording, PREP_DISCLAIMER, ENAMEL_MM, drawPrepMap } from "./prep";
//   export type { Mask, ToothPrep, PrepResult, PrepCategory } from "./contracts";
// Signatures below are the agreed contract; bodies are simple placeholders (good enough to build and test the UI).
import type { Mask, PrepCategory, PrepResult, ToothPrep } from "./contracts";
import { centralLength, designAngle, smoothClosed, toImage, toLocal, toothBoxes, toothOutline } from "./geometry";
import type { Pt, ToothMask } from "./model";
import type { Scene } from "./render";

export type { Mask, PrepCategory, PrepResult, ToothPrep };

/** Scene as the engine sees it (render.ts gains `existing?: Mask`). */
type EScene = Scene & { existing?: Mask };

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// ---------- teethMask ----------

/** Placeholder: bright, low-saturation pixels inside the inner lip line. */
export function detectTeeth(img: CanvasImageSource, imgW: number, imgH: number, lips: Pt[], maxSide = 512): Mask {
  const k = Math.min(1, maxSide / Math.max(imgW, imgH));
  const w = Math.max(1, Math.round(imgW * k));
  const h = Math.max(1, Math.round(imgH * k));
  const cv = canvas(w, h);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  // lip polygon as a mask
  const lc = canvas(w, h);
  const lx = lc.getContext("2d", { willReadFrequently: true })!;
  if (lips.length >= 3) {
    lx.beginPath();
    smoothClosed(lips).forEach((p, i) => (i ? lx.lineTo(p.x * k, p.y * k) : lx.moveTo(p.x * k, p.y * k)));
    lx.closePath();
    lx.fillStyle = "#fff";
    lx.fill();
  }
  const inside = lx.getImageData(0, 0, w, h).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (inside[i * 4 + 3] < 128) continue;
    sum += (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
    n++;
  }
  const mean = n ? sum / n : 128;
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (inside[i * 4 + 3] < 128) continue;
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const lum = (r + g + b) / 3;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx ? (mx - mn) / mx : 0;
    if (lum > Math.max(110, mean) && sat < 0.25) data[i] = 255;
  }
  return { w, h, data };
}

export async function maskFromToothMask(m: ToothMask): Promise<Mask> {
  const im = new Image();
  im.src = m.png;
  await im.decode();
  const cv = canvas(m.w, m.h);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(im, 0, 0, m.w, m.h);
  const px = ctx.getImageData(0, 0, m.w, m.h).data;
  const data = new Uint8Array(m.w * m.h);
  for (let i = 0; i < data.length; i++) data[i] = px[i * 4] > 127 ? 255 : 0;
  return { w: m.w, h: m.h, data };
}

export function toothMaskFromMask(m: Mask): ToothMask {
  const cv = canvas(m.w, m.h);
  const ctx = cv.getContext("2d")!;
  const im = ctx.createImageData(m.w, m.h);
  for (let i = 0; i < m.data.length; i++) {
    const v = m.data[i];
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
    im.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return { w: m.w, h: m.h, png: cv.toDataURL("image/png") };
}

/** Paints (255) or erases (0) a disc at image point p with radius in image px. Mutates m. */
export function paintMask(m: Mask, p: Pt, radiusPx: number, value: 0 | 255, imgW: number, imgH: number): void {
  const kx = m.w / imgW;
  const ky = m.h / imgH;
  const cx = p.x * kx;
  const cy = p.y * ky;
  const r = Math.max(0.5, radiusPx * kx);
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(m.h - 1, Math.ceil(cy + r));
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(m.w - 1, Math.ceil(cx + r));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) m.data[y * m.w + x] = value;
}

// ---------- prep ----------

/** Typical labial enamel mm (cervical, middle, incisal). Pei 2025 PMID 40300924; Pahlevan 2014 PMID 25584054 (PMC4283744). Middle interpolated; canine/premolar reuse upper lateral (no data, conservative). */
export const ENAMEL_MM = {
  upperCentral: [0.35, 0.65, 0.95],
  upperLateral: [0.25, 0.6, 0.95],
  lowerIncisor: [0.3, 0.5, 0.75],
  canine: [0.25, 0.6, 0.95],
};

export const PREP_DISCLAIMER =
  "Planning aid only. Measured from a 2D photo: shows outline length and width differences (±0.5 mm), not facial depth or the amount of tooth to remove. Preparation depth must be planned on a mock-up, wax-up or silicone index and decided by the treating dentist. Enamel values are population averages, not this patient's.";

function inPoly(x: number, y: number, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Placeholder: per-tooth column comparison of the planned outline with the existing-teeth mask. */
export function computePrep(scene: EScene, existing: Mask, _pxPerMm?: number): PrepResult {
  const { w, h } = existing;
  const kx = w / scene.imgW;
  const ky = h / scene.imgH;
  const d = scene.design;
  const lower = d.arch === "lower";
  const a = designAngle(d, scene.guides);
  const L = centralLength(d);
  const add = new Uint8Array(w * h);
  const reduce = new Uint8Array(w * h);
  const teeth: ToothPrep[] = [];
  for (const box of toothBoxes(d)) {
    const poly = toothOutline(box, d.shape).map((p) => toImage(p, d, a));
    const band = [
      { x: box.x0, y: box.top - 0.3 * L },
      { x: box.x1, y: box.top - 0.3 * L },
      { x: box.x1, y: box.bottom + 0.6 * L },
      { x: box.x0, y: box.bottom + 0.6 * L },
    ].map((p) => toImage(p, d, a));
    const xs = band.map((p) => p.x * kx), ys = band.map((p) => p.y * ky);
    const X0 = Math.max(0, Math.floor(Math.min(...xs))), X1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const Y0 = Math.max(0, Math.floor(Math.min(...ys))), Y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
    let P = 0, E = 0, PE = 0;
    let pEdge = -Infinity, eEdge = -Infinity;
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        const ip = { x: (x + 0.5) / kx, y: (y + 0.5) / ky };
        const l = toLocal(ip, d, a);
        if (l.x < box.x0 || l.x > box.x1 || l.y < box.top - 0.3 * L || l.y > box.bottom + 0.6 * L) continue;
        const i = y * w + x;
        const inP = inPoly(ip.x, ip.y, poly);
        const inE = existing.data[i] > 127;
        const edgeY = lower ? -l.y : l.y;
        if (inP) {
          P++;
          pEdge = Math.max(pEdge, edgeY);
        }
        if (inE) {
          E++;
          eEdge = Math.max(eEdge, edgeY);
        }
        if (inP && inE) PE++;
        if (inP && !inE) add[i] = 255;
        if (inE && !inP) reduce[i] = 255;
      }
    const addPct = P ? ((P - PE) / P) * 100 : 0;
    const reducePct = E ? ((E - PE) / E) * 100 : 0;
    let category: PrepCategory = "unknown";
    if (E > 4) category = addPct > 3 && reducePct > 3 ? "mixed" : addPct > 3 ? "additive" : reducePct > 3 ? "reduction" : "unchanged";
    teeth.push({
      kind: box.kind,
      side: box.side,
      label: `${lower ? "L" : "U"}${box.side === -1 ? "R" : "L"}${box.kind + 1}`,
      lengthPx: E && P ? pEdge - eEdge : 0,
      mesialPx: 0,
      distalPx: 0,
      overlapPct: E ? (PE / E) * 100 : 0,
      addPct,
      reducePct,
      category,
    });
  }
  return { add: { w, h, data: add }, reduce: { w, h, data: reduce }, teeth };
}

const KIND = ["central", "lateral", "canine", "first premolar", "second premolar"];
const toothName = (t: ToothPrep) =>
  `${t.label.startsWith("L") ? "Lower" : "Upper"} ${t.side === -1 ? "right" : "left"} ${KIND[t.kind] ?? "tooth"}`;

/** Placeholder wording following docs/round3-clinical.md B and C. */
export function prepWording(t: ToothPrep, pxPerMm?: number): { clinician: string[]; patient: string } {
  const mm = (px: number) => (pxPerMm ? px / pxPerMm : undefined);
  const fmt = (px: number) => {
    const v = mm(px);
    if (v === undefined) return px > 0 ? "add" : px < 0 ? "reduce" : "≈ 0";
    if (Math.abs(v) < 0.3) return "≈ 0";
    return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)} mm`;
  };
  const lines: string[] = [];
  const where: string[] = [];
  if (t.lengthPx < 0) where.push("incisal");
  if (t.mesialPx < 0) where.push("mesial");
  if (t.distalPx < 0) where.push("distal");
  if (t.category === "additive") lines.push("Outline is additive in this view.");
  else if (t.category === "reduction") lines.push(`Outline reduction: tooth is outside the plan at the ${where.length ? where.join(" / ") : "incisal"}.`);
  else if (t.category === "mixed") lines.push("Mixed: additive and reduction areas.");
  else if (t.category === "unchanged") lines.push("Outline about the same in this view.");
  else lines.push("Existing tooth not found in the mask.");
  if (t.category !== "unknown")
    lines.push(`Length ${fmt(t.lengthPx)} · mesial ${fmt(t.mesialPx)} · distal ${fmt(t.distalPx)} · overlap ${Math.round(t.overlapPct)} %${pxPerMm ? " (±0.5 mm, photo)" : ""}`);
  const lm = mm(t.lengthPx);
  if (lm !== undefined && lm < -2) lines.push("Large incisal change: check occlusion, length and pulp before planning.");
  const md = Math.min(mm(t.mesialPx) ?? 0, mm(t.distalPx) ?? 0);
  if (md < -0.5) lines.push("Proximal reduction: contact areas involved; consider alignment or IPR alternatives.");
  let patient = `${toothName(t)}: `;
  if (t.category === "unknown") patient += "not measured in this photo.";
  else if (lm === undefined) patient += t.lengthPx > 0 ? "design is longer." : t.lengthPx < 0 ? "design is shorter." : "design is about the same length.";
  else if (Math.abs(lm) < 0.3) patient += "design is about the same length.";
  else {
    const r = Math.max(0.5, Math.round(Math.abs(lm) * 2) / 2);
    patient += `design is ${lm > 0 ? "longer" : "shorter"} by about ${r % 1 ? r.toFixed(1) : r.toFixed(0)} mm.`;
  }
  return { clinician: lines, patient };
}

/** Green = planned outline adds to the tooth; red = existing tooth outside the plan. Image coords (caller sets transform). */
export function drawPrepMap(ctx: CanvasRenderingContext2D, scene: EScene, prep: PrepResult) {
  const { w, h } = prep.add;
  const cv = canvas(w, h);
  const c2 = cv.getContext("2d")!;
  const im = c2.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (prep.add.data[i]) {
      im.data[o] = 40; im.data[o + 1] = 200; im.data[o + 2] = 110; im.data[o + 3] = 150;
    } else if (prep.reduce.data[i]) {
      im.data[o] = 235; im.data[o + 1] = 60; im.data[o + 2] = 50; im.data[o + 3] = 170;
    }
  }
  c2.putImageData(im, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cv, 0, 0, scene.imgW, scene.imgH);
  ctx.restore();
}
