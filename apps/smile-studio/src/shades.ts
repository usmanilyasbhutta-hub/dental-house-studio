// Approximate on-screen colours for common shade-guide tabs (screens are not calibrated:
// this is for discussion, the clinical shade is always taken in the chair).
export interface Shade {
  id: string;
  label: string;
  /** body colour (middle third) */
  body: string;
  /** cervical third, a little more chroma */
  cervical: string;
}

export const SHADES: Shade[] = [
  { id: "BL1", label: "BL1 (bleach)", body: "#F4F2EC", cervical: "#ECE6D8" },
  { id: "BL2", label: "BL2 (bleach)", body: "#F0ECE2", cervical: "#E7DFCD" },
  { id: "BL3", label: "BL3 (bleach)", body: "#ECE6D8", cervical: "#E1D6BF" },
  { id: "BL4", label: "BL4 (bleach)", body: "#E8E0CF", cervical: "#DCCFB4" },
  { id: "B1", label: "B1", body: "#E6DCC6", cervical: "#D9CAA8" },
  { id: "A1", label: "A1", body: "#E4D7BC", cervical: "#D6C29C" },
  { id: "B2", label: "B2", body: "#E0D0AE", cervical: "#D0BB8C" },
  { id: "A2", label: "A2", body: "#DDCBA8", cervical: "#CDB385" },
  { id: "A3", label: "A3", body: "#D6C097", cervical: "#C4A673" },
  { id: "B3", label: "B3", body: "#D5BF8C", cervical: "#C2A262" },
  { id: "A3.5", label: "A3.5", body: "#CFB487", cervical: "#BB9A62" },
];

export function shadeById(id: string): Shade {
  return SHADES.find((s) => s.id === id) ?? SHADES.find((s) => s.id === "A1")!;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number, darken = 0) {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * (1 - darken)));
  return `rgba(${r},${g},${b},${a})`;
}

/** Linear mix of two hex colours (t = 0 → a, 1 → b), returned as hex. */
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export type RGB = [number, number, number];

/**
 * Gray-world white balance: given the photo's mean colour, the per-channel gain that moves a neutral colour
 * `strength` of the way towards the scene's cast (0 = none, 1 = full cast). Gains average to 1.
 */
export function grayWorldGain(mean: RGB, strength = 0.18): RGB {
  const m = (mean[0] + mean[1] + mean[2]) / 3;
  if (!(m > 0)) return [1, 1, 1];
  return mean.map((v) => 1 + (v / m - 1) * strength) as RGB;
}

/** hex × gain × k, clamped, as [r, g, b] 0..255. */
export function tinted(hex: string, gain: RGB, k = 1): RGB {
  const c = hexToRgb(hex);
  return [0, 1, 2].map((i) => Math.max(0, Math.min(255, Math.round(c[i] * gain[i] * k)))) as RGB;
}

export function css(c: RGB, a = 1) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// ---------- CIE Lab (D65) helpers, used by the photo engine (pure, allocation-free in the per-pixel paths) ----------

/** sRGB 8-bit → linear, as a 256-entry table. */
export const SRGB_TO_LIN = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return t;
})();

const LIN_LUT_N = 4096;
/** linear 0..1 → sRGB 0..255 (float), 4096-entry table. */
const LIN_TO_SRGB = (() => {
  const t = new Float32Array(LIN_LUT_N + 1);
  for (let i = 0; i <= LIN_LUT_N; i++) {
    const c = i / LIN_LUT_N;
    t[i] = 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  }
  return t;
})();

export function linToSrgb8(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  const f = v * LIN_LUT_N;
  const i = f | 0;
  return LIN_TO_SRGB[i] + (LIN_TO_SRGB[i + 1] - LIN_TO_SRGB[i]) * (f - i);
}

const XN = 0.95047;
const ZN = 1.08883;
const labF = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const labFi = (t: number) => (t > 0.206893 ? t * t * t : (t - 16 / 116) / 7.787);

/** 8-bit sRGB → Lab, written into out[o..o+2]. */
export function rgbToLab(r: number, g: number, b: number, out: Float32Array | number[], o = 0) {
  const R = SRGB_TO_LIN[r | 0];
  const G = SRGB_TO_LIN[g | 0];
  const B = SRGB_TO_LIN[b | 0];
  const x = labF((0.4124 * R + 0.3576 * G + 0.1805 * B) / XN);
  const y = labF(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = labF((0.0193 * R + 0.1192 * G + 0.9505 * B) / ZN);
  out[o] = 116 * y - 16;
  out[o + 1] = 500 * (x - y);
  out[o + 2] = 200 * (y - z);
}

/** Lab → 8-bit sRGB floats (unclamped to integers, clamped to 0..255), written into out[o..o+2]. */
export function labToRgb(L: number, a: number, b: number, out: Float32Array | number[] | Uint8ClampedArray, o = 0) {
  const fy = (L + 16) / 116;
  const X = labFi(fy + a / 500) * XN;
  const Y = labFi(fy);
  const Z = labFi(fy - b / 200) * ZN;
  out[o] = linToSrgb8(3.2406 * X - 1.5372 * Y - 0.4986 * Z);
  out[o + 1] = linToSrgb8(-0.9689 * X + 1.8758 * Y + 0.0415 * Z);
  out[o + 2] = linToSrgb8(0.0557 * X - 0.204 * Y + 1.057 * Z);
}

export function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  const o = [0, 0, 0];
  rgbToLab(r, g, b, o);
  return o as [number, number, number];
}

/** Lower-arch rendering offset (docs/round3-clinical.md D: clinical convention, Eiffler 2009 PMID 19688229). */
export const LOWER_SHADE_OFFSET = { L: -2, a: 0, b: 1 };

/** Shade targets in Lab for an arch: body and cervical (lower arch gets the L and b offset). */
export function shadeLab(id: string, arch: "upper" | "lower" = "upper") {
  const sh = shadeById(id);
  const body = hexToLab(sh.body);
  const cervical = hexToLab(sh.cervical);
  if (arch === "lower") {
    for (const c of [body, cervical]) {
      c[0] += LOWER_SHADE_OFFSET.L;
      c[1] += LOWER_SHADE_OFFSET.a;
      c[2] += LOWER_SHADE_OFFSET.b;
    }
  }
  return { body, cervical };
}

/** Hex of a Lab colour (clamped). */
export function labToHex(L: number, a: number, b: number) {
  const o = [0, 0, 0];
  labToRgb(L, a, b, o);
  return "#" + o.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** The shade's hex colours as rendered for an arch (lower: offset applied). */
export function archShade(id: string, arch: "upper" | "lower"): Shade {
  const sh = shadeById(id);
  if (arch === "upper") return sh;
  const t = shadeLab(id, arch);
  return { ...sh, body: labToHex(t.body[0], t.body[1], t.body[2]), cervical: labToHex(t.cervical[0], t.cervical[1], t.cervical[2]) };
}
