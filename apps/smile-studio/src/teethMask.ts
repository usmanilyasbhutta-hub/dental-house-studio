// Existing-teeth mask: automatic detection inside the lip contour, brush edits, compact PNG storage.
// The pure functions (rasterPolygon, detectTeethRGBA, morphology, paintMask) run without a DOM and are unit-tested;
// detectTeeth / maskFromToothMask / toothMaskFromMask are thin canvas wrappers for the browser.
import type { Mask } from "./contracts";
import { smoothClosed } from "./geometry";
import type { Pt, ToothMask } from "./model";
import { rgbToLab } from "./shades";

export type { Mask };

// ---------- versioning (masks are edited in place by paintMask; caches compare versions) ----------
const versions = new WeakMap<Mask, number>();
/** Monotonic edit counter of a mask (0 for a fresh one). paintMask bumps it; call touchMask after other edits. */
export function maskVersion(m: Mask): number {
  return versions.get(m) ?? 0;
}
export function touchMask(m: Mask) {
  versions.set(m, maskVersion(m) + 1);
}

export function newMask(w: number, h: number): Mask {
  return { w, h, data: new Uint8Array(w * h) };
}

// ---------- polygon rasteriser (anti-aliased scanline, pure) ----------
const SUB = 4;
let xsBuf = new Float64Array(64);

/**
 * Adds the coverage (0..1) of a closed polygon (even-odd) to acc (w × h floats). Points are in raster pixels
 * (pixel (i, j) covers [i, i+1) × [j, j+1)). 4 sub-rows per pixel, exact horizontal coverage at span ends.
 */
export function rasterPolygon(acc: Float32Array, w: number, h: number, pts: readonly Pt[], weight = 1) {
  const n = pts.length;
  if (n < 3) return;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.y < y0) y0 = p.y;
    if (p.y > y1) y1 = p.y;
  }
  const r0 = Math.max(0, Math.floor(y0));
  const r1 = Math.min(h - 1, Math.ceil(y1));
  if (xsBuf.length < n) xsBuf = new Float64Array(n * 2);
  const xs = xsBuf;
  const wsub = weight / SUB;
  for (let row = r0; row <= r1; row++) {
    const base = row * w;
    for (let s = 0; s < SUB; s++) {
      const sy = row + (s + 0.5) / SUB;
      let m = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        if ((a.y <= sy && b.y > sy) || (b.y <= sy && a.y > sy)) {
          xs[m++] = a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x);
        }
      }
      if (m < 2) continue;
      // insertion sort (m is small)
      for (let i = 1; i < m; i++) {
        const v = xs[i];
        let j = i - 1;
        while (j >= 0 && xs[j] > v) {
          xs[j + 1] = xs[j];
          j--;
        }
        xs[j + 1] = v;
      }
      for (let i = 0; i + 1 < m; i += 2) {
        const xa = Math.max(0, xs[i]);
        const xb = Math.min(w, xs[i + 1]);
        if (xb <= xa) continue;
        const ia = Math.floor(xa);
        const ib = Math.floor(xb);
        if (ia === ib) {
          acc[base + ia] += (xb - xa) * wsub;
          continue;
        }
        acc[base + ia] += (ia + 1 - xa) * wsub;
        for (let c = ia + 1; c < ib; c++) acc[base + c] += wsub;
        if (ib < w) acc[base + ib] += (xb - ib) * wsub;
      }
    }
  }
}

/** Coverage of the smoothed lip contour (image px → raster px via scale and offset), 0..1. All ones if no contour. */
export function lipCoverage(lips: Pt[], w: number, h: number, scale: number, ox = 0, oy = 0): Float32Array {
  const acc = new Float32Array(w * h);
  if (lips.length < 3) {
    acc.fill(1);
    return acc;
  }
  const pts = smoothClosed(lips).map((p) => ({ x: (p.x - ox) * scale, y: (p.y - oy) * scale }));
  rasterPolygon(acc, w, h, pts);
  for (let i = 0; i < acc.length; i++) if (acc[i] > 1) acc[i] = 1;
  return acc;
}

// ---------- morphology on binary Uint8 masks (0/255), separable square/diamond approximations ----------
function dilate1D(src: Uint8Array, dst: Uint8Array, w: number, h: number, r: number, horizontal: boolean) {
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      // running count of set pixels in the window
      let cnt = 0;
      for (let x = 0; x < Math.min(r, w); x++) if (src[o + x]) cnt++;
      for (let x = 0; x < w; x++) {
        const add = x + r;
        if (add < w && src[o + add]) cnt++;
        const rem = x - r - 1;
        if (rem >= 0 && src[o + rem]) cnt--;
        dst[o + x] = cnt > 0 ? 255 : 0;
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let cnt = 0;
      for (let y = 0; y < Math.min(r, h); y++) if (src[y * w + x]) cnt++;
      for (let y = 0; y < h; y++) {
        const add = y + r;
        if (add < h && src[add * w + x]) cnt++;
        const rem = y - r - 1;
        if (rem >= 0 && src[rem * w + x]) cnt--;
        dst[y * w + x] = cnt > 0 ? 255 : 0;
      }
    }
  }
}

export function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return m.slice();
  const t = new Uint8Array(w * h);
  const o = new Uint8Array(w * h);
  dilate1D(m, t, w, h, r, true);
  dilate1D(t, o, w, h, r, false);
  return o;
}

export function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 255;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 255;
  return d;
}

/** Connected components (4-neighbour) of a binary mask; returns labels (0 = background) and areas (index = label). */
export function components(m: Uint8Array, w: number, h: number): { labels: Int32Array; areas: number[] } {
  const labels = new Int32Array(w * h);
  const areas = [0];
  const stack = new Int32Array(w * h);
  let next = 1;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || labels[i]) continue;
    let sp = 0;
    stack[sp++] = i;
    labels[i] = next;
    let area = 0;
    while (sp) {
      const p = stack[--sp];
      area++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && m[p - 1] && !labels[p - 1]) (labels[p - 1] = next), (stack[sp++] = p - 1);
      if (x < w - 1 && m[p + 1] && !labels[p + 1]) (labels[p + 1] = next), (stack[sp++] = p + 1);
      if (y > 0 && m[p - w] && !labels[p - w]) (labels[p - w] = next), (stack[sp++] = p - w);
      if (y < h - 1 && m[p + w] && !labels[p + w]) (labels[p + w] = next), (stack[sp++] = p + w);
    }
    areas.push(area);
    next++;
  }
  return { labels, areas };
}

/** Fills holes (background components not touching the border) smaller than maxArea. In place. */
export function fillHoles(m: Uint8Array, w: number, h: number, maxArea: number) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 255;
  const { labels, areas } = components(inv, w, h);
  const border = new Uint8Array(areas.length);
  for (let x = 0; x < w; x++) {
    border[labels[x]] = 1;
    border[labels[(h - 1) * w + x]] = 1;
  }
  for (let y = 0; y < h; y++) {
    border[labels[y * w]] = 1;
    border[labels[y * w + w - 1]] = 1;
  }
  for (let i = 0; i < m.length; i++) {
    const l = labels[i];
    if (l && !border[l] && areas[l] <= maxArea) m[i] = 255;
  }
}

/** p-quantile (0..1) of values where use[i], via a 256-bin histogram over [lo, hi]. */
function percentile(v: Float32Array, use: Uint8Array, p: number, lo: number, hi: number): number {
  const B = 256;
  const hist = new Float64Array(B);
  let n = 0;
  for (let i = 0; i < v.length; i++) {
    if (!use[i]) continue;
    hist[Math.min(B - 1, Math.max(0, Math.floor(((v[i] - lo) / (hi - lo)) * B)))]++;
    n++;
  }
  let c = 0;
  for (let i = 0; i < B; i++) {
    c += hist[i];
    if (c >= p * n) return lo + ((i + 0.5) / B) * (hi - lo);
  }
  return hi;
}

/** Otsu threshold of values (only where weight > 0.5), searched over [lo, hi] in 128 bins. */
function otsu(v: Float32Array, use: Uint8Array, lo: number, hi: number): number {
  const B = 128;
  const hist = new Float64Array(B);
  let n = 0;
  for (let i = 0; i < v.length; i++) {
    if (!use[i]) continue;
    const b = Math.min(B - 1, Math.max(0, Math.floor(((v[i] - lo) / (hi - lo)) * B)));
    hist[b]++;
    n++;
  }
  if (!n) return (lo + hi) / 2;
  let sum = 0;
  for (let i = 0; i < B; i++) sum += i * hist[i];
  let sB = 0;
  let wB = 0;
  let best = 0;
  let bi = B / 2;
  for (let i = 0; i < B; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sB += i * hist[i];
    const mB = sB / wB;
    const mF = (sum - sB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bi = i;
    }
  }
  return lo + ((bi + 1) / B) * (hi - lo);
}

/**
 * Tooth likelihood per pixel from Lab: lightness, minus a strong penalty for redness above `a0` (gums, lips and the
 * mouth are red/pink; enamel is yellow-white whatever the photo's cast). `a0` is adaptive (see detectTeethRGBA).
 */
export function toothScore(L: number, a: number, a0: number): number {
  return L - 4 * Math.max(0, a - a0);
}

export interface DetectOptions {
  /** fraction of the lip area below which components are dropped (default 0.004) */
  minArea?: number;
}

/**
 * Detects the existing teeth in an RGBA buffer (w × h) inside `inside` (lip coverage 0..1, same size).
 * Adaptive: Otsu on the tooth score inside the lips, hysteresis growth, opening (removes wet glints on gums/lips),
 * closing + hole fill (specular highlights, cracks), and drops small components. Returns a 0/255 mask.
 */
export function detectTeethRGBA(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, inside: Float32Array, opt: DetectOptions = {}): Mask {
  const N = w * h;
  const score = new Float32Array(N);
  const A = new Float32Array(N);
  const Ls = new Float32Array(N);
  const use = new Uint8Array(N);
  const lit = new Uint8Array(N);
  const lab = new Float32Array(3);
  let area = 0;
  let x0 = w;
  let x1 = 0;
  for (let i = 0; i < N; i++) {
    if (inside[i] < 0.5) continue;
    use[i] = 1;
    area++;
    const x = i % w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    rgbToLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], lab);
    Ls[i] = lab[0];
    A[i] = lab[1];
    if (lab[0] > 30) lit[i] = 1;
  }
  const out = newMask(w, h);
  if (area < 16) return out;
  // redness split between enamel and soft tissue (photo-adaptive: casts shift both clusters)
  const aT = Math.min(30, Math.max(8, otsu(A, lit, -10, 60)));
  // enamel redness: median a* of the brightest quarter (teeth are the brightest thing inside the lips)
  const lHi = percentile(Ls, use, 0.75, 0, 100);
  const bright = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (use[i] && Ls[i] >= lHi) bright[i] = 1;
  const aTooth = percentile(A, bright, 0.5, -20, 60);
  const a0 = Math.max(2, Math.min(aT, aTooth + 3.5));
  for (let i = 0; i < N; i++) if (use[i]) score[i] = toothScore(Ls[i], A[i], a0);
  const t = Math.max(25, otsu(score, use, -60, 110));
  const tHigh = t + 8;
  const tLow = t - 5;
  if ((globalThis as { DEBUG_DETECT?: boolean }).DEBUG_DETECT) console.log("detect aT", aT, "a0", a0, "t", t);
  // hysteresis: seeds above tHigh, grow through pixels above tLow
  const m = new Uint8Array(N);
  const stack = new Int32Array(N);
  let sp = 0;
  for (let i = 0; i < N; i++) if (use[i] && score[i] > tHigh) (m[i] = 255), (stack[sp++] = i);
  while (sp) {
    const p = stack[--sp];
    const x = p % w;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
    for (const q of nb) {
      if (q < 0 || q >= N || m[q] || !use[q] || score[q] <= tLow) continue;
      m[q] = 255;
      stack[sp++] = q;
    }
  }
  // morphology scaled to the mouth width
  const mouthW = Math.max(8, x1 - x0);
  const r = Math.max(1, Math.round(mouthW * 0.006));
  let k = erode(m, w, h, r);
  k = dilate(k, w, h, r);
  k = dilate(k, w, h, r);
  k = erode(k, w, h, r);
  fillHoles(k, w, h, area * 0.01);
  // morphology works on square windows: give the boundary back to the pixel classification (1 px slack)
  const fine = dilate(m, w, h, 1);
  fillHoles(fine, w, h, area * 0.01);
  for (let i = 0; i < N; i++) if (!fine[i]) k[i] = 0;
  // keep large components only
  const { labels, areas } = components(k, w, h);
  const big = Math.max(...areas.slice(1), 0);
  const minA = Math.max(area * (opt.minArea ?? 0.004), big * 0.04);
  for (let i = 0; i < N; i++) {
    const l = labels[i];
    out.data[i] = l && areas[l] >= minA && use[i] ? 255 : 0;
  }
  return out;
}

// ---------- browser wrappers ----------
/** Mask size for an image: longest side ≤ maxSide (never upscaled). */
export function maskSize(imgW: number, imgH: number, maxSide = 768) {
  const s = Math.min(1, maxSide / Math.max(imgW, imgH));
  return { w: Math.max(1, Math.round(imgW * s)), h: Math.max(1, Math.round(imgH * s)), s };
}

/**
 * Auto-segments the existing teeth inside the lip contour. The mask covers the whole photo at ≤ maxSide px
 * (mask px = image px × mask.w / imgW); outside the lips it is 0.
 */
export function detectTeeth(img: CanvasImageSource, imgW: number, imgH: number, lips: Pt[], maxSide = 768): Mask {
  const { w, h, s } = maskSize(imgW, imgH, maxSide);
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  return detectTeethRGBA(rgba, w, h, lipCoverage(lips, w, h, s));
}

/**
 * Paints a disc into the mask (value 255 = tooth, 0 = not tooth). p and radiusPx are in IMAGE px; the mask may be
 * smaller than the image. Soft brushes are not needed: the renderer feathers mask edges. Bumps maskVersion.
 */
export function paintMask(m: Mask, p: Pt, radiusPx: number, value: 0 | 255, imgW: number, imgH: number): void {
  const sx = m.w / imgW;
  const sy = m.h / imgH;
  const cx = p.x * sx;
  const cy = p.y * sy;
  const rx = Math.max(0.5, radiusPx * sx);
  const ry = Math.max(0.5, radiusPx * sy);
  const j0 = Math.max(0, Math.floor(cy - ry));
  const j1 = Math.min(m.h - 1, Math.ceil(cy + ry));
  const i0 = Math.max(0, Math.floor(cx - rx));
  const i1 = Math.min(m.w - 1, Math.ceil(cx + rx));
  for (let j = j0; j <= j1; j++) {
    const dy = (j + 0.5 - cy) / ry;
    for (let i = i0; i <= i1; i++) {
      const dx = (i + 0.5 - cx) / rx;
      if (dx * dx + dy * dy <= 1) m.data[j * m.w + i] = value;
    }
  }
  touchMask(m);
}

/** Small PNG data URL (white = tooth) for storage in CaseData.toothMask. */
export function toothMaskFromMask(m: Mask): ToothMask {
  const cv = document.createElement("canvas");
  cv.width = m.w;
  cv.height = m.h;
  const ctx = cv.getContext("2d")!;
  const id = ctx.createImageData(m.w, m.h);
  for (let i = 0; i < m.data.length; i++) {
    const v = m.data[i] ? 255 : 0;
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  return { w: m.w, h: m.h, png: cv.toDataURL("image/png") };
}

export async function maskFromToothMask(t: ToothMask): Promise<Mask> {
  const im = new Image();
  im.src = t.png;
  await im.decode();
  const cv = document.createElement("canvas");
  cv.width = t.w;
  cv.height = t.h;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(im, 0, 0, t.w, t.h);
  const d = ctx.getImageData(0, 0, t.w, t.h).data;
  const m = newMask(t.w, t.h);
  for (let i = 0; i < m.data.length; i++) m.data[i] = d[i * 4] >= 128 ? 255 : 0;
  return m;
}
