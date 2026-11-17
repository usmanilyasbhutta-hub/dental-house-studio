// Canvas drawing: photo, mockup teeth (clipped to the inner lip contour), guides and handles.
import { bandLayout, bounds, mockupAlpha, designAngle, designHandles, pupilAngle, smoothClosed, watermarkTiles } from "./geometry";
import type { Design, Guides, Pt } from "./model";
import { blitLayer, drawOutlines, ensureLayer, newEntry } from "./teethLayer";

export const C = {
  slate: "#333C39",
  slateDeep: "#1C2220",
  bronze: "#816951",
  bronzeLight: "#C9AB86",
  mist: "#C4CACA",
  white: "#F7F8F6",
};

export type Step = "guides" | "lips" | "design" | "shade" | "compare";

export interface Scene {
  img: CanvasImageSource;
  imgW: number;
  imgH: number;
  guides: Guides;
  lips: Pt[];
  design: Design;
}

function pathFrom(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

const screenLayer = newEntry();

/**
 * Draws the teeth mockup in image coordinates onto ctx (caller sets the transform).
 * The mockup is one cached offscreen layer (rebuilt only when design, lips, shade, photo or zoom level change),
 * composited once at the design opacity. "fast" skips texture, grain and softening (use while dragging).
 */
export function drawTeeth(ctx: CanvasRenderingContext2D, s: Scene, mode: "mockup" | "outline", quality: "fast" | "full" = "full") {
  if (mode === "outline") return drawOutlines(ctx, s);
  const m = ctx.getTransform();
  const scale = Math.hypot(m.a, m.b);
  const e = ensureLayer(screenLayer, s, quality, scale);
  blitLayer(ctx, e, quality, mockupAlpha(s.design.opacity, s.design.backdrop));
}

export interface Overlay {
  step: Step;
  /** px per image px, used to keep handles a constant on-screen size */
  scale: number;
  activeHandle?: string | null;
}

function handle(ctx: CanvasRenderingContext2D, p: Pt, r: number, active: boolean, color = C.bronzeLight) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = active ? color : "rgba(28,34,32,0.55)";
  ctx.fill();
  ctx.lineWidth = r * 0.28;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Extends the line through p with direction angle a across the whole image. */
function longLine(ctx: CanvasRenderingContext2D, p: Pt, a: number, len: number) {
  ctx.beginPath();
  ctx.moveTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
  ctx.lineTo(p.x + Math.cos(a) * len, p.y + Math.sin(a) * len);
  ctx.stroke();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, s: Scene, o: Overlay) {
  const u = 1 / o.scale; // one screen px in image px
  const r = 11 * u;
  const len = Math.max(s.imgW, s.imgH) * 2;
  const g = s.guides;
  const pa = pupilAngle(g);
  ctx.save();
  ctx.lineCap = "round";

  if (o.step === "guides" || o.step === "design") {
    ctx.lineWidth = 1.5 * u;
    ctx.setLineDash([8 * u, 6 * u]);
    ctx.strokeStyle = "rgba(201,171,134,0.9)";
    longLine(ctx, g.pupilR, pa, len); // inter-pupillary line
    ctx.strokeStyle = "rgba(196,202,202,0.9)";
    longLine(ctx, g.midline, pa + Math.PI / 2, len); // facial midline
    if (o.step === "design") {
      // incisal plane reference, parallel to the pupil line through the design center
      ctx.strokeStyle = "rgba(201,171,134,0.55)";
      longLine(ctx, s.design.center, pa, len);
    }
    ctx.setLineDash([]);
  }

  if (o.step === "guides") {
    handle(ctx, g.pupilR, r, o.activeHandle === "pupilR");
    handle(ctx, g.pupilL, r, o.activeHandle === "pupilL");
    handle(ctx, g.midline, r, o.activeHandle === "midline", C.mist);
  }

  if (o.step === "lips") {
    const curve = smoothClosed(s.lips);
    pathFrom(ctx, curve);
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = C.bronzeLight;
    ctx.stroke();
    s.lips.forEach((p, i) => handle(ctx, p, r * 0.8, o.activeHandle === `lip${i}`));
  }

  if (o.step === "design") {
    const a = designAngle(s.design, g);
    const h = designHandles(s.design, a);
    handle(ctx, h.widthL, r, o.activeHandle === "widthL");
    handle(ctx, h.widthR, r, o.activeHandle === "widthR");
    handle(ctx, h.length, r, o.activeHandle === "length", C.mist);
    // move handle: a cross
    handle(ctx, h.move, r * 1.15, o.activeHandle === "move", C.white);
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = C.white;
    ctx.beginPath();
    ctx.moveTo(h.move.x - r * 0.55, h.move.y);
    ctx.lineTo(h.move.x + r * 0.55, h.move.y);
    ctx.moveTo(h.move.x, h.move.y - r * 0.55);
    ctx.lineTo(h.move.x, h.move.y + r * 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

/** Hit-test handles for the current step; returns the handle id or null. */
export function hitHandle(s: Scene, step: Step, p: Pt, radius: number): string | null {
  const cands: [string, Pt][] = [];
  if (step === "guides") cands.push(["pupilR", s.guides.pupilR], ["pupilL", s.guides.pupilL], ["midline", s.guides.midline]);
  if (step === "lips") s.lips.forEach((q, i) => cands.push([`lip${i}`, q]));
  if (step === "design") {
    const h = designHandles(s.design, designAngle(s.design, s.guides));
    cands.push(["move", h.move], ["widthL", h.widthL], ["widthR", h.widthR], ["length", h.length]);
  }
  let best: string | null = null;
  let bd = radius;
  for (const [id, q] of cands) {
    const dd = Math.hypot(q.x - p.x, q.y - p.y);
    if (dd < bd) {
      bd = dd;
      best = id;
    }
  }
  return best;
}

export const WATERMARK = "SMILE SIMULATION · FOR DISCUSSION ONLY · NOT A TREATMENT RESULT";

/** Faint rotated "SIMULATION" text repeated over a panel, kept off the teeth so it can't be cropped away. */
function panelWatermark(ctx: CanvasRenderingContext2D, s: Scene, x: number) {
  const fs = Math.round(Math.max(s.imgW, s.imgH) * 0.032);
  const angle = -Math.PI / 7;
  ctx.save();
  ctx.font = `600 ${fs}px Oswald, sans-serif`;
  const text = "SIMULATION";
  const tw = ctx.measureText(text).width;
  // keep clear of the lip contour (teeth), with a margin of one text height
  const lb = s.lips.length >= 3 ? bounds(s.lips) : undefined;
  const avoid = lb && { x0: lb.x0 - fs, y0: lb.y0 - fs, x1: lb.x1 + fs, y1: lb.y1 + fs };
  const tiles = watermarkTiles(s.imgW, s.imgH, tw * 1.9, angle, { w: tw, h: fs }, avoid);
  ctx.beginPath();
  ctx.rect(x, 0, s.imgW, s.imgH);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(1, fs * 0.04);
  for (const t of tiles) {
    ctx.setTransform(1, 0, 0, 1, x + t.x, t.y);
    ctx.rotate(angle);
    ctx.strokeStyle = "rgba(28,34,32,0.08)";
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = "rgba(247,248,246,0.12)";
    ctx.fillText(text, 0, 0);
  }
  ctx.restore();
}

const exportLayer = newEntry();
const BRAND = "DENTAL HOUSE · SIALKOT";

/** Renders a finished image (photo + mockup + permanent simulation label) at photo resolution. */
export function exportCanvas(s: Scene, layout: "after" | "side-by-side"): HTMLCanvasElement {
  const cols = layout === "side-by-side" ? 2 : 1;
  const pad = Math.round(s.imgW * 0.02);
  const width = s.imgW * cols + pad * (cols - 1);
  // label band: fixed height (5 % of the photo's long side); text sized from it, then shrunk to the output
  // width, or wrapped to two lines inside the band when one line would get too small
  const band = Math.round(Math.max(s.imgW, s.imgH) * 0.05);
  const fs0 = Math.max(10, Math.round(band * 0.3));
  const labelFont = (f: number) => `500 ${f}px "JetBrains Mono", monospace`;
  const brandFont = (f: number) => `700 ${Math.round(f * 1.25)}px Oswald, sans-serif`;

  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;
  ctx.font = labelFont(fs0);
  const labelW = ctx.measureText(WATERMARK).width;
  ctx.font = brandFont(fs0);
  const brandW = ctx.measureText(BRAND).width;
  const lay = bandLayout(width, pad, labelW, brandW, fs0 * 2);
  // two lines must also fit the band height (label + 1.25× brand, with leading)
  const fs = Math.max(8, Math.floor(fs0 * Math.min(lay.scale, lay.lines === 2 ? band / (fs0 * 2.9) : 1)));

  cv.width = width; // resets the context state
  cv.height = s.imgH + band;
  ctx.fillStyle = C.slateDeep;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // both panels: identical box, same scale, no crop or warp
  ctx.drawImage(s.img, 0, 0, s.imgW, s.imgH);
  let x = 0;
  if (cols === 2) {
    x = s.imgW + pad;
    ctx.drawImage(s.img, x, 0, s.imgW, s.imgH);
  }
  ctx.save();
  ctx.translate(x, 0);
  blitLayer(ctx, ensureLayer(exportLayer, s, "full", 1), "full", mockupAlpha(s.design.opacity, s.design.backdrop));
  ctx.restore();
  panelWatermark(ctx, s, x);

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = labelFont(fs);
  ctx.fillStyle = C.bronzeLight;
  const lineH = fs * 1.35;
  const y1 = lay.lines === 1 ? s.imgH + band / 2 : s.imgH + band / 2 - lineH * 0.55;
  ctx.fillText(WATERMARK, pad, y1);
  ctx.font = brandFont(fs);
  ctx.fillStyle = C.white;
  if (lay.lines === 1) {
    ctx.textAlign = "right";
    ctx.fillText(BRAND, cv.width - pad, y1);
  } else {
    ctx.fillText(BRAND, pad, y1 + lineH * 1.12);
  }
  if (cols === 2) {
    ctx.textAlign = "left";
    const tfs = Math.round(Math.max(s.imgW, s.imgH) * 0.015);
    const tag = (t: string, tx: number) => {
      ctx.font = `600 ${tfs}px Oswald, sans-serif`;
      const w = ctx.measureText(t).width + tfs;
      ctx.fillStyle = "rgba(28,34,32,0.75)";
      ctx.fillRect(tx + pad, pad, w, tfs * 1.8);
      ctx.fillStyle = C.white;
      ctx.fillText(t, tx + pad + tfs / 2, pad + tfs * 0.9);
    };
    tag("NOW", 0);
    tag("SIMULATION", x);
  }
  return cv;
}
