// Canvas drawing: photo, mockup teeth (clipped to the inner lip contour), guides and handles.
import { DARKEN, designAngle, designHandles, pupilAngle, smoothClosed, toImage, toothBoxes, toothOutline } from "./geometry";
import type { Design, Guides, Pt } from "./model";
import { mix, rgba, shadeById } from "./shades";

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

/** Draws the teeth mockup in image coordinates onto ctx (caller sets the transform). */
export function drawTeeth(ctx: CanvasRenderingContext2D, s: Scene, mode: "mockup" | "outline") {
  const d = s.design;
  const angle = designAngle(d, s.guides);
  const shade = shadeById(d.shade);
  const boxes = toothBoxes(d).sort((a, b) => b.kind - a.kind); // back teeth first
  ctx.save();
  if (mode === "mockup") {
    pathFrom(ctx, smoothClosed(s.lips));
    ctx.clip();
    ctx.globalAlpha = d.opacity;
  }
  for (const box of boxes) {
    const local = toothOutline(box, d.shape);
    const pts = local.map((p) => toImage(p, d, angle));
    if (mode === "outline") {
      pathFrom(ctx, pts);
      ctx.lineWidth = Math.max(1.5, d.width / 260);
      ctx.strokeStyle = C.white;
      ctx.setLineDash([]);
      ctx.stroke();
      continue;
    }
    const dk = DARKEN[box.kind];
    const top = toImage({ x: (box.x0 + box.x1) / 2, y: box.top }, d, angle);
    const bot = toImage({ x: (box.x0 + box.x1) / 2, y: box.bottom }, d, angle);
    const left = toImage({ x: box.x0, y: (box.top + box.bottom) / 2 }, d, angle);
    const right = toImage({ x: box.x1, y: (box.top + box.bottom) / 2 }, d, angle);

    // body: cervical → body → slightly translucent incisal
    const g = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
    g.addColorStop(0, rgba(shade.cervical, 1, dk + 0.04));
    g.addColorStop(0.3, rgba(shade.body, 1, dk));
    g.addColorStop(0.8, rgba(shade.body, 1, dk));
    // incisal translucency: a touch of blue-grey at the edge
    g.addColorStop(1, rgba(mix(shade.body, "#AEB8C2", 0.45), 1, dk));
    pathFrom(ctx, pts);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    pathFrom(ctx, pts);
    ctx.clip();
    // convex curvature: darker towards the mesial/distal edges
    const hg = ctx.createLinearGradient(left.x, left.y, right.x, right.y);
    hg.addColorStop(0, "rgba(60,50,40,0.22)");
    hg.addColorStop(0.22, "rgba(60,50,40,0)");
    hg.addColorStop(0.78, "rgba(60,50,40,0)");
    hg.addColorStop(1, "rgba(60,50,40,0.22)");
    ctx.fillStyle = hg;
    ctx.fill();
    // soft vertical highlight (line angle reflection)
    const w = Math.hypot(right.x - left.x, right.y - left.y);
    const hl = toImage({ x: box.x0 + (box.x1 - box.x0) * (box.side === 1 ? 0.38 : 0.62), y: box.top + (box.bottom - box.top) * 0.45 }, d, angle);
    ctx.translate(hl.x, hl.y);
    ctx.rotate(angle);
    const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.32);
    rg.addColorStop(0, "rgba(255,255,255,0.32)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.scale(0.55, 1.6);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // interproximal line
    pathFrom(ctx, pts);
    ctx.lineWidth = Math.max(1, d.width / 420);
    ctx.strokeStyle = "rgba(110,90,70,0.45)";
    ctx.stroke();
  }
  ctx.restore();
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

/** Renders a finished image (photo + mockup + permanent simulation label) at photo resolution. */
export function exportCanvas(s: Scene, layout: "after" | "side-by-side"): HTMLCanvasElement {
  const pad = Math.round(s.imgW * 0.02);
  const band = Math.round(Math.max(s.imgW, s.imgH) * 0.05);
  const cols = layout === "side-by-side" ? 2 : 1;
  const cv = document.createElement("canvas");
  cv.width = s.imgW * cols + pad * (cols - 1);
  cv.height = s.imgH + band;
  const ctx = cv.getContext("2d")!;
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
  drawTeeth(ctx, s, "mockup");
  ctx.restore();

  const fs = Math.round(band * 0.3);
  ctx.textBaseline = "middle";
  ctx.font = `500 ${fs}px "JetBrains Mono", monospace`;
  ctx.fillStyle = C.bronzeLight;
  ctx.fillText(WATERMARK, pad, s.imgH + band / 2);
  ctx.textAlign = "right";
  ctx.font = `700 ${Math.round(fs * 1.25)}px Oswald, sans-serif`;
  ctx.fillStyle = C.white;
  ctx.fillText("DENTAL HOUSE · SIALKOT", cv.width - pad, s.imgH + band / 2);
  if (cols === 2) {
    ctx.textAlign = "left";
    const tag = (t: string, tx: number) => {
      ctx.font = `600 ${fs}px Oswald, sans-serif`;
      const w = ctx.measureText(t).width + fs;
      ctx.fillStyle = "rgba(28,34,32,0.75)";
      ctx.fillRect(tx + pad, pad, w, fs * 1.8);
      ctx.fillStyle = C.white;
      ctx.fillText(t, tx + pad + fs / 2, pad + fs * 0.9);
    };
    tag("NOW", 0);
    tag("SIMULATION", x);
  }
  return cv;
}
