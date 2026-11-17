// Cached offscreen teeth layer: backdrop (mouth + gum), teeth, buccal corridor, lip shadow, texture and grain,
// rendered once into a canvas covering the lip contour and composited onto the photo at the design opacity.
// The patient photo itself is never modified: it is only sampled (mean colour) for white balance.
import {
  centralLength,
  centralWidth,
  designAngle,
  outlineSides,
  toothBoxes,
  toothOutline,
  unitBox,
  type ToothBox,
} from "./geometry";
import type { Design, Pt, ToothShape } from "./model";
import { css, grayWorldGain, mix, shadeById, tinted, type RGB } from "./shades";

export type Quality = "fast" | "full";

export interface LayerScene {
  img: CanvasImageSource;
  imgW: number;
  imgH: number;
  guides: { pupilR: Pt; pupilL: Pt; midline: Pt };
  lips: Pt[];
  design: Design;
}

type Ctx = CanvasRenderingContext2D;

// ---------- unit outlines (cached per shape / kind / side) ----------
interface Unit {
  xy: Float64Array; // x0,y0,x1,y1… in the unit box
  n: number;
  sides: { start: number; end: number };
}
const SHAPE_ORDER: ToothShape[] = ["square", "oval", "triangular", "soft"];
const unitCache: (Unit | undefined)[] = [];
function unitOutline(shape: ToothShape, kind: number, side: -1 | 1): Unit {
  const i = SHAPE_ORDER.indexOf(shape) * 10 + kind * 2 + (side === 1 ? 1 : 0);
  let u = unitCache[i];
  if (!u) {
    const box = unitBox(kind, side);
    const pts = toothOutline(box, shape);
    const xy = new Float64Array(pts.length * 2);
    pts.forEach((p, j) => {
      xy[j * 2] = p.x;
      xy[j * 2 + 1] = p.y;
    });
    // incisal part starts lower on canines (cusp) and posteriors (seen at an angle)
    u = { xy, n: pts.length, sides: outlineSides(pts, box, kind <= 1 ? 0.8 : 0.86) };
    unitCache[i] = u;
  }
  return u;
}

function unitPath(ctx: Ctx, u: Unit) {
  ctx.beginPath();
  ctx.moveTo(u.xy[0], u.xy[1]);
  for (let j = 1; j < u.n; j++) ctx.lineTo(u.xy[j * 2], u.xy[j * 2 + 1]);
  ctx.closePath();
}

function unitOpenPath(ctx: Ctx, u: Unit, start: number, end: number) {
  ctx.beginPath();
  for (let j = start; j <= end; j++) {
    const m = (j % u.n) * 2;
    if (j === start) ctx.moveTo(u.xy[m], u.xy[m + 1]);
    else ctx.lineTo(u.xy[m], u.xy[m + 1]);
  }
}

// ---------- shared textures ----------
let noiseTile: HTMLCanvasElement | null = null;
/** 64² tile, each pixel black or white with a random alpha: painted source-atop it adds zero-mean grain. */
function noise(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const id = x.createImageData(64, 64);
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = rnd() + rnd() - 1; // triangular −1..1
    const c8 = v > 0 ? 255 : 0;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = c8;
    id.data[i + 3] = Math.round(Math.abs(v) * 255);
  }
  x.putImageData(id, 0, 0);
  return (noiseTile = c);
}

// ---------- photo match ----------
const gainCache = new WeakMap<object, RGB>();
/** Gray-world white balance of the photo (18 % of its colour cast), sampled once per photo. */
export function photoGain(img: CanvasImageSource): RGB {
  const key = img as unknown as object;
  const hit = gainCache.get(key);
  if (hit) return hit;
  let g: RGB = [1, 1, 1];
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 24;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data;
    let r = 0;
    let gg = 0;
    let b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      gg += d[i + 1];
      b += d[i + 2];
    }
    g = grayWorldGain([r, gg, b], 0.18);
  } catch {
    /* tainted or not decodable: neutral */
  }
  gainCache.set(key, g);
  return g;
}

// ---------- cache entry ----------
const KEY_LEN = 64;
interface Paints {
  shade: string;
  gain: RGB;
  body: CanvasGradient[]; // per variant: 0 incisor, 1 canine, 2 posterior (unit box, vertical)
  convex: CanvasGradient; // unit box, horizontal
  neck: CanvasGradient; // unit box, cervical margin shade
  spot: CanvasGradient; // unit radial white
  lobe: CanvasGradient[]; // unit radial, body colour, per variant
  rim: string;
  gum: CanvasGradient; // vertical, in central-length units
  cavity: CanvasGradient; // vertical, in central-length units
  corridor: CanvasGradient; // radial, in design-width units
  lipShadow: CanvasGradient; // vertical, in central-length units
  contact: string;
}
export interface LayerEntry {
  cv: HTMLCanvasElement;
  ctx: Ctx;
  out: HTMLCanvasElement | null;
  outCtx: Ctx | null;
  key: Float64Array;
  keyLen: number;
  img: object | null;
  shade: string;
  shape: string;
  paints: Paints | null;
  pattern: { tex: CanvasPattern; grain: CanvasPattern } | null;
  // placement of the result (image px) and its pixel size
  ox: number;
  oy: number;
  lw: number;
  lh: number;
  pw: number;
  ph: number;
  lip: Float64Array;
  lipN: number;
  valid: boolean;
}

export function newEntry(): LayerEntry {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  return {
    cv,
    ctx: cv.getContext("2d")!,
    out: null,
    outCtx: null,
    key: new Float64Array(KEY_LEN),
    keyLen: 0,
    img: null,
    shade: "",
    shape: "",
    paints: null,
    pattern: null,
    ox: 0,
    oy: 0,
    lw: 0,
    lh: 0,
    pw: 0,
    ph: 0,
    lip: new Float64Array(256),
    lipN: 0,
    valid: false,
  };
}

const PROP_IDX = { golden: 0, red: 1, natural: 2 } as const;
const scratchKey = new Float64Array(KEY_LEN);

/** Fills scratchKey with every number the layer depends on; returns its length (no allocation). */
function fillKey(s: LayerScene, k: number, q: Quality): number {
  const d = s.design;
  const K = scratchKey;
  let i = 0;
  K[i++] = d.center.x;
  K[i++] = d.center.y;
  K[i++] = d.width;
  K[i++] = d.wl;
  K[i++] = d.arc;
  K[i++] = d.tilt;
  K[i++] = d.lateralStep;
  K[i++] = d.count;
  K[i++] = PROP_IDX[d.proportion] ?? 0;
  K[i++] = SHAPE_ORDER.indexOf(d.shape);
  K[i++] = d.backdrop === false ? 0 : 1;
  K[i++] = k;
  K[i++] = q === "full" ? 1 : 0;
  K[i++] = s.guides.pupilR.x;
  K[i++] = s.guides.pupilR.y;
  K[i++] = s.guides.pupilL.x;
  K[i++] = s.guides.pupilL.y;
  const n = Math.min(s.lips.length, (KEY_LEN - i) >> 1);
  K[i++] = n;
  for (let j = 0; j < n; j++) {
    K[i++] = s.lips[j].x;
    K[i++] = s.lips[j].y;
  }
  return i;
}

/** Catmull-Rom smoothing of the lip contour into e.lip (same curve as geometry.smoothClosed, no allocation). */
function smoothLips(e: LayerEntry, lips: Pt[], samples = 8) {
  const n = lips.length;
  const need = n * samples * 2;
  if (e.lip.length < need) e.lip = new Float64Array(need * 2);
  let o = 0;
  for (let i = 0; i < n; i++) {
    const p0 = lips[(i - 1 + n) % n];
    const p1 = lips[i];
    const p2 = lips[(i + 1) % n];
    const p3 = lips[(i + 2) % n];
    for (let j = 0; j < samples; j++) {
      const t = j / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      e.lip[o++] =
        0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      e.lip[o++] =
        0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    }
  }
  e.lipN = n * samples;
}

function lipPath(ctx: Ctx, e: LayerEntry) {
  ctx.beginPath();
  for (let j = 0; j < e.lipN; j++) {
    if (j) ctx.lineTo(e.lip[j * 2], e.lip[j * 2 + 1]);
    else ctx.moveTo(e.lip[0], e.lip[1]);
  }
  ctx.closePath();
}

const GREY_BLUE = "#A9B4C0";

function makePaints(ctx: Ctx, shadeId: string, gain: RGB): Paints {
  const sh = shadeById(shadeId);
  const T = (hex: string, k = 1) => tinted(hex, gain, k);
  const cerv = sh.cervical;
  const body = sh.body;
  const lin = (stops: [number, string][], x1: number, y1: number) => {
    const g = ctx.createLinearGradient(0, 0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  // value/chroma: chroma at the neck, value in the middle third, translucent grey-blue incisal (smooth stops)
  const bodyFor = (trans: number) =>
    lin(
      [
        [0, css(T(cerv, 0.9))],
        [0.16, css(T(mix(cerv, body, 0.45), 0.97))],
        [0.4, css(T(body))],
        [0.64, css(T(body))],
        [0.78, css(T(mix(body, GREY_BLUE, 0.16 * trans)), 1 - 0.06 * trans)],
        [0.9, css(T(mix(body, GREY_BLUE, 0.3 * trans), 0.97), 1 - 0.2 * trans)],
        [1, css(T(mix(body, GREY_BLUE, 0.4 * trans), 0.95), 1 - 0.32 * trans)],
      ],
      0,
      1,
    );
  const linY = (y0: number, y1: number, stops: [number, string][]) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  const radial = (stops: [number, string][]) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  };
  const shadow = "60,38,30";
  return {
    shade: shadeId,
    gain,
    body: [bodyFor(1), bodyFor(0.55), bodyFor(0.2)],
    convex: lin(
      [
        [0, `rgba(${shadow},0.34)`],
        [0.1, `rgba(${shadow},0.16)`],
        [0.28, `rgba(${shadow},0.02)`],
        [0.5, `rgba(${shadow},0)`],
        [0.72, `rgba(${shadow},0.02)`],
        [0.9, `rgba(${shadow},0.16)`],
        [1, `rgba(${shadow},0.34)`],
      ],
      1,
      0,
    ),
    neck: lin(
      [
        [0, `rgba(${shadow},0.3)`],
        [0.08, `rgba(${shadow},0.1)`],
        [0.2, `rgba(${shadow},0)`],
      ],
      0,
      1,
    ),
    spot: radial([
      [0, "rgba(255,255,255,1)"],
      [0.45, "rgba(255,255,255,0.45)"],
      [1, "rgba(255,255,255,0)"],
    ]),
    lobe: [1, 0.55, 0.2].map((t) =>
      radial([
        [0, css(T(body), 0.5 * t)],
        [1, css(T(body), 0)],
      ]),
    ),
    rim: css(T("#FBFAF6"), 0.5),
    // gum: vertical in central-length units, y = -1.4 L (under the lip) … -0.25 L (papilla tips)
    gum: linY(-1.4, -0.25, [
      [0, css(T("#7A3236"))],
      [0.35, css(T("#A14A4F"))],
      [0.7, css(T("#BD6467"))],
      [1, css(T("#C87371"))],
    ]),
    cavity: linY(-0.7, 0.7, [
      [0, css(T("#4C1E21"))],
      [0.45, css(T("#2A1012"))],
      [0.75, css(T("#180809"))],
      [1, css(T("#120606"))],
    ]),
    corridor: radial([
      [0, "rgba(38,20,16,0)"],
      [0.42, "rgba(38,20,16,0)"],
      [0.62, "rgba(38,20,16,0.1)"],
      [0.82, "rgba(38,20,16,0.34)"],
      [1, "rgba(38,20,16,0.55)"],
    ]),
    lipShadow: linY(-1.35, -0.15, [
      [0, "rgba(46,20,18,0.5)"],
      [0.55, "rgba(46,20,18,0.18)"],
      [1, "rgba(46,20,18,0)"],
    ]),
    contact: `rgba(${shadow},0.16)`,
  };
}

/**
 * Device-space shift used for blurred strokes: the path is built FAR px to the left of the layer and only its
 * shadow (offset back by FAR, Gaussian-blurred) lands on the layer. shadowBlur works on every browser, unlike
 * ctx.filter (missing on older iOS Safari).
 */
const FAR = 16384;
let DX = 0;

/** Soft line: call `begin()` to set DX, build the path (with setLocal / setImage), then `blurStroke`. */
function blurStroke(ctx: Ctx, width: number, style: string | CanvasGradient, color: string, blur: number) {
  ctx.strokeStyle = style;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = FAR;
  ctx.shadowOffsetY = 0;
  ctx.stroke();
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  DX = 0;
}

/**
 * Layer scale (layer px per image px) for a target transform scale `s`: sharp on zoomed-in screens, cheaper while
 * dragging, quantised so small zoom changes reuse the cache. Pure.
 */
export function layerScale(s: number, q: Quality, imgPx: number): number {
  const max = q === "full" ? 3 : 1.5;
  let k = Math.min(max, Math.max(q === "full" ? 1 : 0.5, s));
  k = Math.round(k * 4) / 4;
  // cap the layer at ~4 MP (full) / 1 MP (fast)
  const cap = q === "full" ? 4e6 : 1e6;
  if (imgPx * k * k > cap) k = Math.sqrt(cap / imgPx);
  return k;
}

/** Builds (or reuses) the layer for this scene. Returns the entry ready to blit. */
export function ensureLayer(e: LayerEntry, s: LayerScene, q: Quality, targetScale: number): LayerEntry {
  const d = s.design;
  const lips = s.lips;
  // bounds: lip contour (or the design area when there is no contour)
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  if (lips.length >= 3) {
    smoothLips(e, lips);
    for (let j = 0; j < e.lipN; j++) {
      const x = e.lip[j * 2];
      const y = e.lip[j * 2 + 1];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  } else {
    e.lipN = 0;
    const L = centralLength(d);
    x0 = d.center.x - d.width;
    x1 = d.center.x + d.width;
    y0 = d.center.y - L * 1.6;
    y1 = d.center.y + L * 0.6;
  }
  x0 = Math.max(0, Math.floor(x0) - 2);
  y0 = Math.max(0, Math.floor(y0) - 2);
  x1 = Math.min(s.imgW, Math.ceil(x1) + 2);
  y1 = Math.min(s.imgH, Math.ceil(y1) + 2);
  const lw = Math.max(1, x1 - x0);
  const lh = Math.max(1, y1 - y0);
  const k = layerScale(targetScale, q, lw * lh);

  const kl = fillKey(s, k, q);
  const imgKey = s.img as unknown as object;
  let same = e.valid && kl === e.keyLen && e.img === imgKey && e.shade === d.shade;
  for (let i = 0; same && i < kl; i++) if (scratchKey[i] !== e.key[i]) same = false;
  if (same) return e;
  e.key.set(scratchKey.subarray(0, kl));
  e.keyLen = kl;
  e.img = imgKey;
  e.shade = d.shade;
  e.ox = x0;
  e.oy = y0;
  e.lw = lw;
  e.lh = lh;
  e.pw = Math.max(1, Math.ceil(lw * k));
  e.ph = Math.max(1, Math.ceil(lh * k));
  // grow-only backing store (resizing clears and is slow)
  if (e.cv.width < e.pw || e.cv.height < e.ph) {
    e.cv.width = Math.max(e.cv.width, e.pw);
    e.cv.height = Math.max(e.cv.height, e.ph);
  }
  const ctx = e.ctx;
  const gain = photoGain(s.img);
  if (!e.paints || e.paints.shade !== d.shade || e.paints.gain !== gain) {
    e.paints = makePaints(ctx, d.shade, gain);
  }
  build(e, s, q, k);
  if (q === "full") soften(e, k);
  e.valid = true;
  return e;
}

/** Slight optical softening (and lip-edge feather): average of 4 sub-pixel shifted copies, additive = exact mean. */
function soften(e: LayerEntry, k: number) {
  if (!e.out) {
    e.out = document.createElement("canvas");
    e.out.width = e.out.height = 1;
    e.outCtx = e.out.getContext("2d")!;
  }
  if (e.out.width < e.pw + 2 || e.out.height < e.ph + 2) {
    e.out.width = Math.max(e.out.width, e.pw + 2);
    e.out.height = Math.max(e.out.height, e.ph + 2);
  }
  const c = e.outCtx!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.clearRect(0, 0, e.pw + 2, e.ph + 2);
  c.globalCompositeOperation = "lighter";
  c.globalAlpha = 0.25;
  const r = 0.38 * k;
  c.drawImage(e.cv, 0, 0, e.pw, e.ph, -r, -r, e.pw, e.ph);
  c.drawImage(e.cv, 0, 0, e.pw, e.ph, r, -r, e.pw, e.ph);
  c.drawImage(e.cv, 0, 0, e.pw, e.ph, -r, r, e.pw, e.ph);
  c.drawImage(e.cv, 0, 0, e.pw, e.ph, r, r, e.pw, e.ph);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
}

/** Blits the built layer under the caller's transform (image coordinates). */
export function blitLayer(ctx: Ctx, e: LayerEntry, q: Quality, opacity: number) {
  const src = q === "full" && e.out ? e.out : e.cv;
  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, e.pw, e.ph, e.ox, e.oy, e.lw, e.lh);
  ctx.restore();
}

// local design frame → layer pixels: [a b c d e f]
const M = new Float64Array(6);

function setLocal(ctx: Ctx, sx = 1, sy = 1, tx = 0, ty = 0) {
  // M · translate(tx,ty) · scale(sx,sy)
  ctx.setTransform(M[0] * sx, M[1] * sx, M[2] * sy, M[3] * sy, M[0] * tx + M[2] * ty + M[4] - DX, M[1] * tx + M[3] * ty + M[5]);
}

/** Image coordinates → layer pixels. */
function setImage(ctx: Ctx, e: LayerEntry, k: number) {
  ctx.setTransform(k, 0, 0, k, -e.ox * k - DX, -e.oy * k);
}

function build(e: LayerEntry, s: LayerScene, q: Quality, k: number) {
  const ctx = e.ctx;
  const d = s.design;
  const p = e.paints!;
  const angle = designAngle(d, s.guides);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  M[0] = k * ca;
  M[1] = k * sa;
  M[2] = -k * sa;
  M[3] = k * ca;
  M[4] = k * (d.center.x - e.ox);
  M[5] = k * (d.center.y - e.oy);
  const L = centralLength(d);
  const cw = centralWidth(d);
  const W = d.width;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, e.pw + 1, e.ph + 1);
  ctx.save();
  // clip to the inner lip contour (image coordinates)
  if (e.lipN) {
    ctx.setTransform(k, 0, 0, k, -e.ox * k, -e.oy * k);
    lipPath(ctx, e);
    ctx.clip();
  }

  const boxes = toothBoxes(d);
  // ---- backdrop: dark oral cavity, gum band with papillae between the necks ----
  if (d.backdrop !== false) {
    setLocal(ctx, L, L);
    ctx.fillStyle = p.cavity;
    ctx.fillRect(-W * 3 / L, -4, (W * 6) / L, 8);
    // gum: everything above a scalloped line through the papilla tips (teeth cover the rest)
    setLocal(ctx);
    ctx.beginPath();
    const far = W * 2;
    const hiY = -L * 4;
    // boxes come per side in kind order: walk left side outward→in, then right side in→out
    const n = boxes.length / 2;
    let first = true;
    for (let i = n - 1; i >= -n; i--) {
      const b = i >= 0 ? boxes[i] : boxes[n + (-i - 1)];
      const h = b.bottom - b.top;
      const pap = b.top + h * (b.kind <= 2 ? 0.4 : 0.32);
      const bx0 = b.x0;
      const bx1 = b.x1;
      if (first) {
        ctx.moveTo(-far, hiY);
        ctx.lineTo(-far, b.top + h * 0.25);
        ctx.lineTo(bx0, pap);
        first = false;
      } else ctx.lineTo(bx0, pap);
      ctx.quadraticCurveTo((bx0 + bx1) / 2, b.top - h * 0.05, bx1, pap);
      if (i === -n) {
        ctx.lineTo(far, b.top + h * 0.25);
        ctx.lineTo(far, hiY);
      }
    }
    ctx.closePath();
    setLocal(ctx, L, L);
    ctx.fillStyle = p.gum;
    ctx.fill();
  }

  // ---- teeth, back to front ----
  const shape = d.shape;
  for (let kind = 4; kind >= 0; kind--) {
    for (let side = -1; side <= 1; side += 2) {
      const b = findBox(boxes, kind, side as -1 | 1);
      if (b) drawTooth(ctx, e, b, shape);
    }
  }

  // ---- buccal corridor: one warm radial over the arch (source-atop keeps alpha when there is no backdrop) ----
  ctx.globalCompositeOperation = "source-atop";
  setLocal(ctx, W * 0.82, W * 0.82, 0, -L * 0.45);
  ctx.fillStyle = p.corridor;
  ctx.fillRect(-3, -3, 6, 6);

  // ---- upper-lip shadow: soft stroke along the contour, fading out below the gum line ----
  if (e.lipN) {
    ctx.setTransform(k, 0, 0, k, -e.ox * k, -e.oy * k);
    lipPath(ctx, e);
    setLocal(ctx, L, L);
    softStroke(ctx, 0.75, p.lipShadow, 0.45);
  }

  // ---- texture (perikymata, horizontal) + grain matching the photo (full only) ----
  if (q === "full") {
    if (!e.pattern) {
      const tex = ctx.createPattern(noise(), "repeat")!;
      const grain = ctx.createPattern(noise(), "repeat")!;
      e.pattern = { tex, grain };
    }
    // texture in the design frame: texels cw/40 wide and cw/260 tall
    setLocal(ctx);
    e.pattern.tex.setTransform(new DOMMatrix([cw / 40, 0, 0, cw / 260, 0, 0]));
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = e.pattern.tex;
    ctx.fillRect(-W * 2, -L * 3, W * 4, L * 6);
    // grain: one texel per photo pixel
    ctx.setTransform(k, 0, 0, k, -e.ox * k, -e.oy * k);
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = e.pattern.grain;
    ctx.fillRect(e.ox, e.oy, e.lw, e.lh);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

function findBox(boxes: ToothBox[], kind: number, side: -1 | 1) {
  for (const b of boxes) if (b.kind === kind && b.side === side) return b;
  return undefined;
}

function drawTooth(ctx: Ctx, e: LayerEntry, b: ToothBox, shape: ToothShape) {
  const p = e.paints!;
  const u = unitOutline(shape, b.kind, b.side);
  const w = b.x1 - b.x0;
  const h = b.bottom - b.top;
  const variant = b.kind <= 1 ? 0 : b.kind === 2 ? 1 : 2;
  const back = b.kind >= 3 ? 0.6 : b.kind === 2 ? 0.85 : 1;

  // contact / embrasure shadow cast on the tooth behind and the papilla (sides only: no line on the incisal edge)
  setLocal(ctx, w, h, b.x0, b.top);
  unitOpenPath(ctx, u, u.sides.start, u.sides.end);
  setLocal(ctx);
  softStroke(ctx, Math.max(0.6, w * 0.13), p.contact, 1);

  ctx.save();
  setLocal(ctx, w, h, b.x0, b.top);
  unitPath(ctx, u);
  // body (alpha < 1 at the incisal edge: the mouth shows through)
  ctx.fillStyle = p.body[variant];
  ctx.fill();
  ctx.clip();
  ctx.globalCompositeOperation = "source-atop";
  // curvature: darker towards the mesial/distal line angles, and a touch at the gum margin
  ctx.fillStyle = p.convex;
  ctx.fillRect(0, 0, 1, 1.2);
  ctx.fillStyle = p.neck;
  ctx.fillRect(0, 0, 1, 1.2);
  ctx.globalCompositeOperation = "source-over";
  // mamelon lobes: three slightly more opaque vertical lobes in the incisal third (incisors)
  if (b.kind <= 1) {
    ctx.fillStyle = p.lobe[0];
    for (let i = 0; i < 3; i++) {
      setLocal(ctx, w * 0.1, h * 0.16, b.x0 + w * (0.27 + 0.23 * i), b.top + h * 0.8);
      ctx.fillRect(-1, -1, 2, 2);
    }
  }
  // specular: narrow line-angle highlights (mesial stronger) and a faint broad sheen
  ctx.fillStyle = p.spot;
  const mes = b.side === 1 ? 0.25 : 0.75;
  ctx.globalAlpha = 0.3 * back;
  setLocal(ctx, w * 0.045, h * 0.3, b.x0 + w * mes, b.top + h * 0.44);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.globalAlpha = 0.14 * back;
  setLocal(ctx, w * 0.04, h * 0.26, b.x0 + w * (1 - mes), b.top + h * 0.46);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.globalAlpha = 0.07 * back;
  setLocal(ctx, w * 0.3, h * 0.32, b.x0 + w * 0.5, b.top + h * 0.38);
  ctx.fillRect(-1, -1, 2, 2);
  ctx.globalAlpha = 1;
  // bright incisal rim (the halo just inside the translucent edge)
  if (b.kind <= 2) {
    setLocal(ctx, w, h, b.x0, b.top);
    unitOpenPath(ctx, u, u.sides.end, u.sides.start + u.n);
    setLocal(ctx);
    ctx.strokeStyle = p.rim;
    ctx.lineWidth = Math.max(0.5, h * 0.035);
    ctx.globalAlpha = b.kind === 2 ? 0.5 : 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Plain outline view (wax-up template), drawn straight onto the caller's context. */
export function drawOutlines(ctx: Ctx, s: LayerScene) {
  const d = s.design;
  const a = designAngle(d, s.guides);
  ctx.save();
  ctx.transform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), d.center.x, d.center.y);
  ctx.lineWidth = Math.max(1.5, d.width / 260);
  ctx.strokeStyle = "#F7F8F6";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  for (const b of toothBoxes(d)) {
    const u = unitOutline(d.shape, b.kind, b.side);
    const w = b.x1 - b.x0;
    const h = b.bottom - b.top;
    ctx.beginPath();
    for (let j = 0; j < u.n; j++) {
      const x = b.x0 + u.xy[j * 2] * w;
      const y = b.top + u.xy[j * 2 + 1] * h;
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
