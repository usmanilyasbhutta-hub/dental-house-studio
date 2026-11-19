// Printable A4 sheets (portrait, 1240 × 1754 px ≈ 150 dpi), drawn on canvas so they work offline and share as PNG.
// Clinician prep sheet and patient illustration sheet. Wording: src/sheetCopy.ts (spec: docs/round3-clinical.md).
// Rules: no patient name or ID on any page (the clinician sheet prints the case code only when asked), every page
// carries the simulation label, before/after images share one box size and are never warped.
import { contours, drawPrepMap, ENAMEL_MM, HIDDEN_LENGTH_PCT, hiddenLegend, PREP_DISCLAIMER, prepWording, type Mask, type PrepResult } from "./engineShim";
import { centralWidth, designAngle, plannedOutlines, TOOTH_NAMES } from "./geometry";
import { C, drawTeeth, exportCanvas, WATERMARK, type Scene } from "./render";
import { CLINICIAN, ENAMEL_ROWS, fmtDelta, PATIENT } from "./sheetCopy";
import { CLINIC } from "./clinic";
import type { CasePlan } from "./model";
import {
  archOfFdi,
  CHECKLIST,
  coverageLabel,
  getTooth,
  MARGIN_LABEL,
  materialOf,
  MATERIALS,
  nearestTab,
  PHOTO_NOTE,
  planShadeGap,
  planSummary,
  planWarnings,
  PREP_LABEL,
  VISIBLE_LABEL,
  type Material,
} from "./planner";

export const A4 = { w: 1240, h: 1754 };
const M = 72; // page margin
const INK = "#1C2220";
const SUB = "#4A524F"; // secondary text on paper: 8.3:1 on #F7F8F6
const BRONZE_TEXT = "#6B5640"; // bronze darkened for small text on paper (6.4:1)
const PAPER = C.white;
const SANS = `"Helvetica Neue", Arial, system-ui, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, monospace`;

export type SheetScene = Scene & { existing?: Mask };

export interface SheetView {
  scene: SheetScene;
  prep?: PrepResult | null;
  pxPerMm?: number;
  /** caption for extra views, e.g. "Lower teeth" */
  title?: string;
}

async function fonts() {
  await Promise.all(
    ['600 20px "Oswald"', '700 20px "Oswald"', 'italic 400 20px "Instrument Serif"', '500 20px "JetBrains Mono"'].map((f) =>
      document.fonts.load(f).catch(() => []),
    ),
  );
}

let logoP: Promise<HTMLImageElement | null> | null = null;
function logo() {
  logoP ??= new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = "./brand/logo-white.png";
  });
  return logoP;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = t;
    }
    out.push(line);
  }
  return out;
}

/** A paginated A4 document: header band on every page, a fixed footer, content flows between them. */
class Doc {
  pages: HTMLCanvasElement[] = [];
  ctx!: CanvasRenderingContext2D;
  y = 0;
  bottom = 0;
  constructor(
    private kicker: string,
    private footer: (ctx: CanvasRenderingContext2D, measureOnly: boolean) => number,
    private mark: HTMLImageElement | null,
  ) {
    this.newPage();
  }
  newPage() {
    const cv = document.createElement("canvas");
    cv.width = A4.w;
    cv.height = A4.h;
    this.pages.push(cv);
    const ctx = cv.getContext("2d")!;
    this.ctx = ctx;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, A4.w, A4.h);
    // header band: white logo on slate (brand rule: white logo over dark)
    ctx.fillStyle = C.slateDeep;
    ctx.fillRect(0, 0, A4.w, 112);
    if (this.mark) {
      const h = 52;
      ctx.drawImage(this.mark, M, 30, (this.mark.width / this.mark.height) * h, h);
    } else {
      ctx.font = `700 34px Oswald, sans-serif`;
      ctx.fillStyle = C.white;
      ctx.textBaseline = "middle";
      ctx.fillText("DENTAL HOUSE", M, 56);
    }
    ctx.font = `500 17px ${MONO}`;
    ctx.fillStyle = C.bronzeLight;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(this.kicker.toUpperCase(), A4.w - M, 56);
    ctx.textAlign = "left";
    ctx.fillStyle = C.bronze;
    ctx.fillRect(0, 112, A4.w, 4);
    this.y = 156;
    this.bottom = A4.h - this.footer(ctx, true) - 24;
  }
  /** Makes room for h px, starting a new page when needed. */
  need(h: number) {
    if (this.y + h > this.bottom) this.newPage();
  }
  finish() {
    const n = this.pages.length;
    this.pages.forEach((cv, i) => {
      const ctx = cv.getContext("2d")!;
      this.footer(ctx, false);
      ctx.font = `500 15px ${MONO}`;
      ctx.fillStyle = SUB;
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${i + 1} / ${n}`, A4.w - M, A4.h - 30);
      ctx.textAlign = "left";
    });
    return this.pages;
  }
  text(t: string, o: { font?: string; color?: string; lh?: number; maxW?: number; x?: number } = {}) {
    this.ctx.font = o.font ?? `400 22px ${SANS}`;
    const lh = o.lh ?? 31;
    const lines = wrap(this.ctx, t, o.maxW ?? A4.w - 2 * M);
    for (const l of lines) {
      this.need(lh);
      const ctx = this.ctx; // need() may have started a new page
      ctx.font = o.font ?? `400 22px ${SANS}`;
      ctx.fillStyle = o.color ?? INK;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(l, o.x ?? M, this.y + lh * 0.75);
      this.y += lh;
    }
  }
  label(t: string, color = BRONZE_TEXT) {
    this.need(30);
    const ctx = this.ctx;
    ctx.font = `500 16px ${MONO}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(spaced(t.toUpperCase()), M, this.y + 18);
    this.y += 30;
  }
  /** Oswald uppercase headline with one Instrument Serif italic accent word. */
  headline(main: string, accent: string, size = 56) {
    const ctx = this.ctx;
    this.need(size * 1.3);
    const base = this.y + size;
    ctx.textBaseline = "alphabetic";
    const i = main.toLowerCase().lastIndexOf(accent.toLowerCase());
    const before = i >= 0 ? main.slice(0, i) : `${main} `;
    const after = i >= 0 ? main.slice(i + accent.length) : "";
    let x = M;
    ctx.font = `700 ${size}px Oswald, sans-serif`;
    ctx.fillStyle = INK;
    ctx.fillText(before.toUpperCase(), x, base);
    x += ctx.measureText(before.toUpperCase()).width;
    ctx.font = `italic 400 ${Math.round(size * 1.12)}px "Instrument Serif", serif`;
    ctx.fillStyle = C.bronze;
    ctx.fillText(accent, x, base);
    x += ctx.measureText(accent).width;
    ctx.font = `700 ${size}px Oswald, sans-serif`;
    ctx.fillStyle = INK;
    ctx.fillText(after.toUpperCase(), x, base);
    this.y += size * 1.3;
  }
  gap(h: number) {
    this.y += h;
  }
}

const spaced = (t: string) => t.split("").join(" ");

function footerBlock(text: string, emphasis: boolean) {
  return (ctx: CanvasRenderingContext2D, measureOnly: boolean) => {
    ctx.font = `${emphasis ? 600 : 400} 18px ${SANS}`;
    const lines = wrap(ctx, text, A4.w - 2 * M - 32);
    const boxH = lines.length * 25 + 28;
    const total = boxH + 64;
    if (measureOnly) return total;
    const top = A4.h - total;
    ctx.fillStyle = emphasis ? "#EFE7DC" : "#ECEEEC";
    ctx.fillRect(M, top, A4.w - 2 * M, boxH);
    ctx.fillStyle = C.bronze;
    ctx.fillRect(M, top, 5, boxH);
    ctx.fillStyle = INK;
    ctx.textBaseline = "alphabetic";
    lines.forEach((l, i) => ctx.fillText(l, M + 22, top + 14 + 19 + i * 25));
    // permanent simulation label + brand on every page
    ctx.font = `500 15px ${MONO}`;
    ctx.fillStyle = BRONZE_TEXT;
    ctx.fillText(WATERMARK, M, A4.h - 30);
    return total;
  };
}

// ---------- image panels ----------

type Src = CanvasImageSource;
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draws src[r] into the box, contained (no warp, no crop beyond r), centred on slate. */
function panel(ctx: CanvasRenderingContext2D, src: Src, r: Rect, box: Rect) {
  ctx.fillStyle = C.slateDeep;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const k = Math.min(box.w / r.w, box.h / r.h);
  const w = r.w * k;
  const h = r.h * k;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, r.x, r.y, r.w, r.h, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  ctx.restore();
}

function caption(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, maxW: number, size = 17): number {
  ctx.font = `500 ${size}px ${MONO}`;
  ctx.fillStyle = BRONZE_TEXT;
  ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, t.toUpperCase(), maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + size + i * (size + 7)));
  return lines.length * (size + 7) + 6;
}

/** The same mouth crop for every panel of a view (image px), aspect w/h, kept inside the photo. */
function mouthCrop(s: Scene, aspect: number): Rect {
  const d = s.design;
  let w = Math.min(s.imgW, d.width * 1.9);
  let h = w / aspect;
  if (h > s.imgH) {
    h = s.imgH;
    w = h * aspect;
  }
  const cy = d.center.y + (d.arch === "lower" ? d.width * 0.12 : -d.width * 0.08);
  const x = Math.min(Math.max(0, d.center.x - w / 2), s.imgW - w);
  const y = Math.min(Math.max(0, cy - h / 2), s.imgH - h);
  return { x, y, w, h };
}

const full = (s: Scene): Rect => ({ x: 0, y: 0, w: s.imgW, h: s.imgH });

function designImage(s: Scene) {
  // the export renderer (same teeth as the app's share image); its label band sits below imgH and is left out
  return exportCanvas(s, "after");
}

function prepImage(s: SheetScene, prep: PrepResult) {
  const cv = document.createElement("canvas");
  cv.width = s.imgW;
  cv.height = s.imgH;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(s.img, 0, 0, s.imgW, s.imgH);
  // lines sized to the teeth, not to screen pixels, so they survive the crop + scale onto the page
  drawPrepMap(ctx, s, prep, { lineUnit: exportUnit(s), labels: true });
  ctx.save();
  ctx.globalAlpha = 0.7;
  drawTeeth(ctx, s, "outline");
  ctx.restore();
  return cv;
}

/** Line unit for exported overlays: a fraction of the planned central width (visible at any page scale). */
function exportUnit(s: Scene) {
  return Math.max(1.5, centralWidth(s.design) / 38);
}

/** Patient diff view: added areas shaded (bronze), areas where the design is smaller outlined (white on a dark halo). */
function diffImage(s: Scene, prep: PrepResult) {
  const u = exportUnit(s);
  const k = s.imgW / prep.add.w;
  const cv = document.createElement("canvas");
  cv.width = s.imgW;
  cv.height = s.imgH;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(s.img, 0, 0, s.imgW, s.imgH);
  ctx.lineJoin = "round";
  const poly = (polys: Float32Array[]) => {
    ctx.beginPath();
    for (const l of polys) {
      ctx.moveTo(l[0], l[1]);
      for (let i = 2; i < l.length; i += 2) ctx.lineTo(l[i], l[i + 1]);
      ctx.closePath();
    }
  };
  // planned outline, thin, so the patient sees the whole design shape
  ctx.beginPath();
  for (const o of plannedOutlines(s.design, designAngle(s.design, s.guides))) {
    o.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.strokeStyle = "rgba(20,24,22,0.55)";
  ctx.lineWidth = 2.4 * u;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1 * u;
  ctx.stroke();
  const add = contours(prep.add, k);
  if (add.length) {
    poly(add);
    ctx.fillStyle = "rgba(201,150,90,0.72)";
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgb(150,100,50)";
    ctx.lineWidth = 1.6 * u;
    ctx.stroke();
  }
  const red = contours(prep.reduce, k);
  if (red.length) {
    poly(red);
    ctx.strokeStyle = "rgba(20,24,22,0.8)";
    ctx.lineWidth = 3.6 * u;
    ctx.stroke();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.8 * u;
    ctx.stroke();
  }
  return cv;
}

function swatch(ctx: CanvasRenderingContext2D, x: number, y: number, fill: string | null, stroke: string | null, text: string, font = `400 19px ${SANS}`) {
  ctx.fillStyle = C.slateDeep;
  ctx.fillRect(x, y, 26, 26);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(x + 3, y + 3, 20, 20);
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, y + 6, 14, 14);
  }
  ctx.font = font;
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 36, y + 14);
  return ctx.measureText(text).width + 36;
}

const archName = (s: Scene) => (s.design.arch === "lower" ? "Lower" : "Upper");

// ---------- clinician prep sheet ----------

export interface ClinicianOpts {
  view: SheetView;
  /** printed only when the clinician chose to (never a name or file ID) */
  caseCode?: string;
  date: Date;
  centralMm?: number;
  /** the dentist's recorded plan (round 4): adds a Plan section */
  plan?: CasePlan;
  lib?: Material[];
}

export async function clinicianSheet(o: ClinicianOpts): Promise<HTMLCanvasElement[]> {
  await fonts();
  const { scene: s, prep, pxPerMm } = o.view;
  const doc = new Doc("Smile Studio · prep guide · clinician", footerBlock(PREP_DISCLAIMER, true), await logo());
  const ctx = () => doc.ctx;
  doc.label(CLINICIAN.kicker);
  doc.headline(`${CLINICIAN.title} ${CLINICIAN.accent}`, CLINICIAN.accent);
  doc.gap(6);

  // meta grid
  const meta: [string, string][] = [
    ["Case code", o.caseCode?.trim() || "________________"],
    ["Date", o.date.toISOString().slice(0, 10)],
    ["Arch", `${archName(s)} · ${s.design.count} teeth`],
    ["Shade", `${s.design.shade} (screen preview)`],
    ["Calibration", pxPerMm && o.centralMm ? `Central ${o.centralMm} mm · ${pxPerMm.toFixed(1)} px/mm` : "Not calibrated: no mm values"],
    ["Teeth view", s.design.render === "drawn" ? "Drawn" : "Photo-real"],
  ];
  const colW = (A4.w - 2 * M) / 3;
  doc.need(140);
  meta.forEach(([k, v], i) => {
    const x = M + (i % 3) * colW;
    const y = doc.y + Math.floor(i / 3) * 66;
    const c = ctx();
    c.font = `500 15px ${MONO}`;
    c.fillStyle = BRONZE_TEXT;
    c.textBaseline = "alphabetic";
    c.fillText(spaced(k.toUpperCase()), x, y + 18);
    c.font = `600 22px ${SANS}`;
    c.fillStyle = INK;
    c.fillText(v, x, y + 48, colW - 16);
  });
  doc.gap(140);

  // panels: Today | Design | Prep map, identical mouth crop and box
  const gapX = 16;
  const pw = (A4.w - 2 * M - 2 * gapX) / 3;
  const ph = Math.round(pw * 0.75);
  const crop = mouthCrop(s, pw / ph);
  doc.need(ph + 130);
  const capH = 34;
  const titles = ["Today", "Design (simulated)", "Prep map"];
  const srcs: Src[] = [s.img, designImage(s)];
  if (prep) srcs.push(prepImage(s, prep));
  titles.forEach((t, i) => {
    const x = M + i * (pw + gapX);
    caption(ctx(), t, x, doc.y, pw);
    const box = { x, y: doc.y + capH, w: pw, h: ph };
    if (srcs[i]) panel(ctx(), srcs[i], crop, box);
    else {
      ctx().fillStyle = "#E4E7E5";
      ctx().fillRect(box.x, box.y, box.w, box.h);
    }
  });
  doc.gap(capH + ph + 12);
  if (prep) {
    // the prep map again, full width, so add / reduce areas and the FDI numbers are readable on paper
    const bw = A4.w - 2 * M;
    const bh = Math.round(bw * 0.46);
    doc.need(bh + capH + 20);
    caption(ctx(), "Prep map · enlarged (FDI numbers)", M, doc.y, bw);
    panel(ctx(), srcs[2], mouthCrop(s, bw / bh), { x: M, y: doc.y + capH, w: bw, h: bh });
    doc.gap(capH + bh + 12);
  }
  let lx = M;
  lx += swatch(ctx(), lx, doc.y, "rgba(40,200,110,0.9)", null, CLINICIAN.legendAdd, `400 18px ${SANS}`) + 28;
  lx += swatch(ctx(), lx, doc.y, "rgba(235,60,50,0.9)", null, CLINICIAN.legendReduce, `400 18px ${SANS}`) + 28;
  swatch(ctx(), lx, doc.y, "rgba(176,120,30,0.92)", null, "Amber chip: shade change (ΔE00)", `400 18px ${SANS}`);
  doc.gap(38);
  if (prep?.hidden) {
    // round 6: planned outline hidden behind the opposing teeth (grey hatch in the map)
    const c = ctx();
    swatch(c, M, doc.y, "rgb(150,150,150)", null, hiddenLegend(prep.teeth[0]?.label[0] === "L"), `400 18px ${SANS}`);
    c.save();
    c.beginPath();
    c.rect(M + 3, doc.y + 3, 20, 20);
    c.clip();
    c.strokeStyle = "rgb(235,235,235)";
    c.lineWidth = 2;
    for (let k = -20; k < 26; k += 6) {
      c.moveTo(M + 3 + k, doc.y + 23);
      c.lineTo(M + 23 + k, doc.y + 3);
    }
    c.stroke();
    c.restore();
    doc.gap(38);
  }
  doc.text("Same crop and scale in all three panels. Outline from the photo; not to scale for depth.", { font: `400 17px ${SANS}`, color: SUB, lh: 24 });
  doc.gap(14);

  // per-tooth table
  doc.need(240); // keep the table header with its first rows
  doc.label(`Per tooth · ${archName(s).toLowerCase()} arch${pxPerMm ? " · mm" : " · calibrate for mm"}`);
  const cols = [
    { t: "Tooth", w: 92 },
    { t: "Length Δ", w: 112 },
    { t: "Mesial Δ", w: 112 },
    { t: "Distal Δ", w: 112 },
    { t: "Overlap", w: 100 },
    { t: "Outline and notes", w: A4.w - 2 * M - 528 },
  ];
  const head = () => {
    doc.need(40);
    const c = ctx();
    c.fillStyle = "#E4E7E5";
    c.fillRect(M, doc.y, A4.w - 2 * M, 34);
    let x = M + 10;
    c.font = `500 14px ${MONO}`;
    c.fillStyle = INK;
    c.textBaseline = "middle";
    for (const col of cols) {
      c.fillText(col.t.toUpperCase(), x, doc.y + 17);
      x += col.w;
    }
    doc.gap(38);
  };
  head();
  const rows = prep?.teeth ?? [];
  if (!rows.length) doc.text("No existing-teeth outline yet: mark the teeth in Lips › Existing teeth.", { color: SUB });
  for (const t of rows) {
    const w = prepWording(t, pxPerMm);
    const notes = w.clinician.filter((l) => !/^Length\b/.test(l));
    const c = ctx();
    c.font = `400 18px ${SANS}`;
    const noteLines = notes.flatMap((l) => wrap(c, l, cols[5].w - 12));
    const rh = Math.max(40, noteLines.length * 24 + 14);
    if (doc.y + rh > doc.bottom) {
      doc.newPage();
      head();
    }
    const cc = ctx();
    const name = `${t.label}`;
    const lenHidden = (t.hiddenPct ?? 0) > HIDDEN_LENGTH_PCT;
    const vals = [name, lenHidden ? "hidden" : fmtDelta(t.lengthPx, pxPerMm), fmtDelta(t.mesialPx, pxPerMm), fmtDelta(t.distalPx, pxPerMm), `${Math.round(t.overlapPct)} %`];
    let x = M + 10;
    cc.textBaseline = "alphabetic";
    vals.forEach((v, i) => {
      cc.font = i === 0 ? `600 19px ${SANS}` : `500 18px ${MONO}`;
      cc.fillStyle = INK;
      cc.fillText(v, x, doc.y + 26);
      if (i === 0) {
        cc.font = `400 13px ${SANS}`;
        cc.fillStyle = SUB;
        cc.fillText(TOOTH_NAMES[t.kind] ?? "", x, doc.y + 44);
      }
      x += cols[i].w;
    });
    cc.font = `400 18px ${SANS}`;
    noteLines.forEach((l, i) => {
      const warn = /^(Large|Proximal)/.test(l) || (i > 0 && /occlusion|contact areas/.test(l));
      cc.fillStyle = warn ? "#8C3B2E" : INK;
      cc.fillText(l, x, doc.y + 26 + i * 24);
    });
    doc.gap(Math.max(rh, t.kind >= 0 ? 52 : 40));
    cc.fillStyle = "#D5DAD8";
    cc.fillRect(M, doc.y - 4, A4.w - 2 * M, 1);
  }
  doc.text(CLINICIAN.tableNote, { font: `400 16px ${SANS}`, color: SUB, lh: 23 });
  doc.gap(18);

  // enamel reference table
  doc.need(250);
  doc.label(CLINICIAN.enamelTitle);
  {
    const c = ctx();
    const cw = [260, 150, 150, 150];
    const hdr = ["", "Cervical", "Middle", "Incisal"];
    let x = M;
    c.font = `500 14px ${MONO}`;
    c.fillStyle = SUB;
    c.textBaseline = "alphabetic";
    hdr.forEach((h, i) => {
      c.fillText(h.toUpperCase(), x, doc.y + 18);
      x += cw[i];
    });
    doc.gap(28);
    for (const [k, name] of ENAMEL_ROWS) {
      const v = ENAMEL_MM[k];
      let xx = M;
      c.font = `400 19px ${SANS}`;
      c.fillStyle = INK;
      c.fillText(name, xx, doc.y + 22);
      xx += cw[0];
      c.font = `500 18px ${MONO}`;
      v.forEach((n, i) => {
        c.fillText(n.toFixed(2), xx, doc.y + 22);
        xx += cw[i + 1];
      });
      doc.gap(30);
    }
  }
  doc.text(CLINICIAN.enamelSource, { font: `400 15px ${SANS}`, color: SUB, lh: 21 });
  doc.text(CLINICIAN.lowerIncisorNote, { font: `400 17px ${SANS}`, color: INK, lh: 24 });
  doc.gap(16);

  doc.label("Reference (text only, not computed for this patient)");
  for (const r of CLINICIAN.references) {
    doc.text(`•  ${r}`, { font: `400 17px ${SANS}`, lh: 24 });
    doc.gap(4);
  }
  doc.gap(12);
  doc.label("Lab and shade note");
  doc.text(CLINICIAN.labNote, { font: `400 18px ${SANS}`, lh: 25 });
  doc.text(CLINICIAN.shadeNote, { font: `400 18px ${SANS}`, lh: 25, color: SUB });
  if (o.plan) {
    doc.gap(24);
    planSection(doc, o.plan, o.lib ?? MATERIALS);
  }
  return doc.finish();
}

// ---------- plan (round 4): shared by the prep sheet and the lab prescription ----------

interface Col {
  t: string;
  w: number;
}

/** A table whose cells wrap; the header repeats on each new page. */
function table(doc: Doc, cols: Col[], rows: string[][], o: { size?: number; first?: (c: CanvasRenderingContext2D, x: number, y: number, v: string) => void } = {}) {
  const size = o.size ?? 17;
  const lh = size + 6;
  const fullW = cols.reduce((t, c) => t + c.w, 0);
  const head = () => {
    doc.need(40 + lh);
    const c = doc.ctx;
    c.fillStyle = "#E4E7E5";
    c.fillRect(M, doc.y, fullW, 32);
    let x = M + 8;
    c.font = `500 13px ${MONO}`;
    c.fillStyle = INK;
    c.textBaseline = "middle";
    for (const col of cols) {
      c.fillText(col.t.toUpperCase(), x, doc.y + 16);
      x += col.w;
    }
    doc.gap(36);
  };
  head();
  for (const r of rows) {
    const c = doc.ctx;
    c.font = `400 ${size}px ${SANS}`;
    const cells = r.map((v, i) => wrap(c, v, cols[i].w - 14));
    const rh = Math.max(...cells.map((l) => l.length)) * lh + 12;
    if (doc.y + rh > doc.bottom) {
      doc.newPage();
      head();
    }
    const cc = doc.ctx;
    let x = M + 8;
    cc.textBaseline = "alphabetic";
    cells.forEach((lines, i) => {
      cc.font = i === 0 ? `600 ${size + 1}px ${SANS}` : `400 ${size}px ${SANS}`;
      cc.fillStyle = INK;
      lines.forEach((l, k) => cc.fillText(l, x, doc.y + lh * 0.8 + 4 + k * lh));
      x += cols[i].w;
    });
    doc.gap(rh);
    cc.fillStyle = "#D5DAD8";
    cc.fillRect(M, doc.y - 2, fullW, 1);
  }
}

const LEVEL_INK = { stop: "#8C3B2E", caution: "#7A5A12", info: SUB } as const;

function planRows(plan: CasePlan, lib: Material[], lab: boolean): string[][] {
  return planSummary(plan, lib).teeth.map((fdi) => {
    const t = getTooth(plan, fdi);
    const mm = [t.prepMm?.facial !== undefined ? `F ${t.prepMm.facial} mm` : "", t.prepMm?.incisal !== undefined ? `I/O ${t.prepMm.incisal} mm` : ""].filter(Boolean).join(", ");
    const prep = `${PREP_LABEL[t.prep]}${mm ? ` (${mm}, from mock-up)` : ""}`;
    const row = [String(fdi), materialOf(t.material, lib)?.name ?? "not chosen", prep, coverageLabel(t.coverage, archOfFdi(fdi)), MARGIN_LABEL[t.margin]];
    return lab ? [...row, t.notes ?? ""] : [...row, VISIBLE_LABEL[t.visible], t.notes ?? ""];
  });
}

function shadeBlock(doc: Doc, plan: CasePlan) {
  const gap = planShadeGap(plan);
  const ref = plan.shade.samples.filter((s) => s.role === "reference" && s.lab[0] > 0);
  const mat = plan.shade.samples.filter((s) => s.role === "match" && s.lab[0] > 0);
  const f1 = (v: number) => v.toFixed(1);
  const line = (name: string, s: typeof ref) =>
    s.length
      ? `${name}: ${s.map((x) => `L ${f1(x.lab[0])} a ${f1(x.lab[1])} b ${f1(x.lab[2])} (nearest tab ${nearestTab(x.lab).tab}, approximate${x.q && !x.q.ok ? "; sample includes gum or shadow, unreliable" : ""})`).join("; ")}`
      : `${name}: not sampled`;
  doc.text(`Target tab (dentist's choice): ${plan.shade.targetTab ?? "________"}`, { font: `600 19px ${SANS}`, lh: 27 });
  doc.text(line("Reference", ref), { font: `400 17px ${SANS}`, lh: 24 });
  doc.text(line("To match", mat), { font: `400 17px ${SANS}`, lh: 24 });
  if (gap)
    doc.text(`ΔE00 ${gap.dE00.toFixed(1)} · ΔL ${f1(gap.dL)} · ΔC ${f1(gap.dC)} · ΔH ${f1(gap.dH)} · mostly ${gap.dominant}. ${gap.text}`, { font: `400 17px ${SANS}`, lh: 24 });
  else doc.text(PHOTO_NOTE, { font: `400 17px ${SANS}`, lh: 24, color: SUB });
  const w = [plan.shade.whiteningFirst ? "whitening planned first" : "", plan.shade.whiteningDone ? "whitening done" : ""].filter(Boolean).join(", ");
  if (w) doc.text(`Whitening: ${w}.`, { font: `400 17px ${SANS}`, lh: 24 });
}

function planSection(doc: Doc, plan: CasePlan, lib: Material[]) {
  doc.need(200);
  doc.label("Plan · recorded by the treating dentist");
  doc.text(planSummary(plan, lib).text, { font: `600 20px ${SANS}`, lh: 28 });
  doc.gap(8);
  const inner = A4.w - 2 * M;
  table(
    doc,
    [
      { t: "Tooth", w: 80 },
      { t: "Material", w: 200 },
      { t: "Prep", w: 200 },
      { t: "Coverage", w: 170 },
      { t: "Margin", w: 140 },
      { t: "Visible", w: 110 },
      { t: "Notes", w: inner - 900 },
    ],
    planRows(plan, lib, false),
  );
  doc.text("Prep mm are entered by the dentist from the mock-up / silicone index; the app does not measure depth.", { font: `400 15px ${SANS}`, color: SUB, lh: 21 });
  doc.gap(14);
  doc.label("Shade gap · photo estimate");
  shadeBlock(doc, plan);
  doc.gap(14);
  const flags = [plan.flags.deepBite && "deep bite", plan.flags.bruxism && "bruxism", plan.flags.recession && "recession", plan.flags.perioStable && "perio stable"].filter(Boolean);
  doc.label("Case flags");
  doc.text(flags.length ? flags.join(" · ") : "None recorded", { font: `400 18px ${SANS}`, lh: 25 });
  doc.gap(14);
  doc.label("Checks on the recorded plan (not an approval)");
  const ws = planWarnings(plan, lib);
  if (!ws.length) doc.text("No conflicts found in what is recorded.", { font: `400 18px ${SANS}`, lh: 25 });
  for (const w of ws) {
    doc.text(`${w.level.toUpperCase()}${w.teeth?.length ? ` · ${w.teeth.join(", ")}` : ""}: ${w.text}`, { font: `400 17px ${SANS}`, lh: 24, color: LEVEL_INK[w.level] });
    doc.gap(4);
  }
  doc.gap(12);
  doc.label("Checklist");
  for (const c of CHECKLIST) {
    const on = c.id === "perio" ? plan.flags.perioStable === true : !!plan.checklist[c.id];
    doc.text(`${on ? "[x]" : "[  ]"}  ${c.label}`, { font: `400 18px ${SANS}`, lh: 26, color: on ? INK : SUB });
  }
}

// ---------- lab prescription ----------

export interface LabOpts {
  view: SheetView;
  plan: CasePlan;
  lib?: Material[];
  /** printed only when the clinician chose to and it passed the ID check */
  caseCode?: string;
  date: Date;
}

export const LAB_FOOTER =
  "Plan recorded by the treating dentist. Photo values are estimates; prep depths were entered from the mock-up, not measured by the app. " +
  PREP_DISCLAIMER;

export async function labSheet(o: LabOpts): Promise<HTMLCanvasElement[]> {
  await fonts();
  const lib = o.lib ?? MATERIALS;
  const { plan } = o;
  const s = o.view.scene;
  const doc = new Doc("Smile Studio · lab prescription", footerBlock(LAB_FOOTER, true), await logo());
  const ctx = () => doc.ctx;
  doc.label(`${CLINIC.name}, ${CLINIC.city} · ${CLINIC.phone} (phone / WhatsApp)`);
  doc.headline("Lab prescription", "prescription");
  doc.gap(4);
  const summary = planSummary(plan, lib);
  const meta: [string, string][] = [
    ["Case code", o.caseCode?.trim() || "________________"],
    ["Date", o.date.toISOString().slice(0, 10)],
    ["Teeth", summary.teethText],
    ["Dentist", "________________"],
    ["Lab", "________________"],
    ["Return by", "________________"],
  ];
  const colW = (A4.w - 2 * M) / 3;
  doc.need(140);
  meta.forEach(([k, v], i) => {
    const x = M + (i % 3) * colW;
    const y = doc.y + Math.floor(i / 3) * 66;
    const c = ctx();
    c.font = `500 15px ${MONO}`;
    c.fillStyle = BRONZE_TEXT;
    c.textBaseline = "alphabetic";
    c.fillText(spaced(k.toUpperCase()), x, y + 18);
    c.font = `600 22px ${SANS}`;
    c.fillStyle = INK;
    c.fillText(v, x, y + 48, colW - 16);
  });
  doc.gap(140);

  doc.label("Teeth and preparation");
  const inner = A4.w - 2 * M;
  if (!summary.teeth.length) doc.text("No teeth in the plan.", { color: SUB });
  else
    table(
      doc,
      [
        { t: "Tooth", w: 80 },
        { t: "Material", w: 220 },
        { t: "Prep (mm entered)", w: 230 },
        { t: "Coverage", w: 190 },
        { t: "Margin", w: 150 },
        { t: "Notes", w: inner - 870 },
      ],
      planRows(plan, lib, true),
      { size: 18 },
    );
  doc.text("Prep mm: entered by the dentist from the mock-up / silicone index. F = facial, I/O = incisal / occlusal.", { font: `400 15px ${SANS}`, color: SUB, lh: 21 });
  doc.gap(16);

  doc.label("Shade");
  shadeBlock(doc, plan);
  if (summary.teeth.some((f) => archOfFdi(f) === "lower")) doc.text(CLINICIAN.labNote, { font: `600 18px ${SANS}`, lh: 25 });
  doc.gap(16);

  const flags = [plan.flags.deepBite && "deep bite", plan.flags.bruxism && "bruxism (night guard planned: " + (plan.checklist.nightGuard ? "yes" : "no") + ")", plan.flags.recession && "recession"].filter(Boolean);
  if (flags.length) {
    doc.label("Occlusion and case notes");
    doc.text(flags.join(" · "), { font: `400 18px ${SANS}`, lh: 25 });
    doc.gap(12);
  }

  doc.label("Mock-up / wax-up reference");
  doc.text(
    `Wax-up: ${plan.checklist.waxup ? "done" : "not yet"} · Mock-up approved by the patient: ${plan.checklist.mockup ? "yes" : "not yet"} · Phonetics/occlusion checked on the mock-up: ${plan.checklist.function ? "yes" : "not yet"}`,
    { font: `400 18px ${SANS}`, lh: 25 },
  );
  doc.text("Reference (model / scan / index no.): ________________________________", { font: `400 18px ${SANS}`, lh: 34 });
  doc.gap(10);

  // small design reference: today and the simulated design, same crop and box (no warp)
  const gapX = 16;
  const pw = (A4.w - 2 * M - gapX) / 2;
  const ph = Math.round(pw * 0.42);
  if (doc.y + ph + 60 <= doc.bottom) {
    const crop = mouthCrop(s, pw / ph);
    caption(ctx(), "Today (photo)", M, doc.y, pw);
    caption(ctx(), "Design idea (simulated, not to scale)", M + pw + gapX, doc.y, pw);
    panel(ctx(), s.img, crop, { x: M, y: doc.y + 34, w: pw, h: ph });
    const d = designImage(s);
    panel(ctx(), d, crop, { x: M + pw + gapX, y: doc.y + 34, w: pw, h: ph });
    d.width = 0;
    doc.gap(34 + ph + 16);
  }

  doc.label("Return instructions");
  for (let i = 0; i < 3; i++) {
    doc.need(40);
    const c = ctx();
    c.fillStyle = "#AEB5B2";
    c.fillRect(M, doc.y + 32, A4.w - 2 * M, 1.5);
    doc.gap(40);
  }
  return doc.finish();
}

// ---------- patient illustration sheet ----------

export interface PatientOpts {
  views: SheetView[];
  showDiff: boolean;
}

export async function patientSheet(o: PatientOpts): Promise<HTMLCanvasElement[]> {
  await fonts();
  const doc = new Doc("Smile Studio · Dental House, Sialkot", footerBlock(PATIENT.footer, false), await logo());
  const ctx = () => doc.ctx;
  doc.headline(PATIENT.title, PATIENT.accent, 54);
  doc.text(PATIENT.subtitle, { font: `400 24px ${SANS}`, color: SUB, lh: 33 });
  doc.gap(18);

  o.views.forEach((v, vi) => {
    const s = v.scene;
    const gapX = 24;
    const pw = (A4.w - 2 * M - gapX) / 2;
    // whole photo, contained in identical boxes (no crop, no warp)
    const ph = Math.min(Math.round((pw * s.imgH) / s.imgW), 500);
    if (vi > 0 || v.title) {
      doc.need(ph + 120);
      doc.label(v.title ?? "Another view");
    }
    doc.need(ph + 80);
    const capH = 36;
    caption(ctx(), PATIENT.today, M, doc.y, pw, 18);
    caption(ctx(), PATIENT.design, M + pw + gapX, doc.y, pw, 18);
    panel(ctx(), s.img, full(s), { x: M, y: doc.y + capH, w: pw, h: ph });
    const dimg = designImage(s);
    panel(ctx(), dimg, full(s), { x: M + pw + gapX, y: doc.y + capH, w: pw, h: ph });
    dimg.width = 0;
    doc.gap(capH + ph + 22);

    if (o.showDiff && v.prep) {
      const dw = A4.w - 2 * M;
      const dh = Math.round(dw * 0.36);
      ctx().font = `500 18px ${MONO}`;
      const capLines = wrap(ctx(), PATIENT.diff.toUpperCase(), dw).length;
      doc.need(dh + capLines * 25 + 70);
      const ch = caption(ctx(), PATIENT.diff, M, doc.y, dw, 18);
      const img = diffImage(s, v.prep);
      panel(ctx(), img, mouthCrop(s, dw / dh), { x: M, y: doc.y + ch, w: dw, h: dh });
      img.width = 0;
      doc.gap(ch + dh + 12);
      let lx = M;
      lx += swatch(ctx(), lx, doc.y, "rgba(201,150,90,0.9)", null, "Design adds (shaded)") + 32;
      swatch(ctx(), lx, doc.y, null, "#FFFFFF", "Design is smaller (outlined)");
      doc.gap(42);
    }
    if (v.prep?.teeth.length) {
      const lines = v.prep.teeth.filter((t) => t.category !== "unknown").map((t) => prepWording(t, v.pxPerMm).patient);
      if (lines.length) {
        if (lines.length * 30 + 40 < doc.bottom - 156) doc.need(lines.length * 30 + 40); // keep the list on one page
        doc.label("Tooth by tooth");
        for (const l of lines) doc.text(l, { font: `400 21px ${SANS}`, lh: 30 });
        doc.gap(14);
      }
    }
  });
  return doc.finish();
}

export function canvasToFile(cv: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(new File([b], name, { type: "image/png" })) : rej(new Error("encode"))), "image/png"),
  );
}
