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
  { id: "BL1", label: "Bleach 1", body: "#F4F2EC", cervical: "#ECE6D8" },
  { id: "BL2", label: "Bleach 2", body: "#F0ECE2", cervical: "#E7DFCD" },
  { id: "BL3", label: "Bleach 3", body: "#ECE6D8", cervical: "#E1D6BF" },
  { id: "BL4", label: "Bleach 4", body: "#E8E0CF", cervical: "#DCCFB4" },
  { id: "B1", label: "B1", body: "#E6DCC6", cervical: "#D9CAA8" },
  { id: "A1", label: "A1", body: "#E4D7BC", cervical: "#D6C29C" },
  { id: "B2", label: "B2", body: "#E0D0AE", cervical: "#D0BB8C" },
  { id: "A2", label: "A2", body: "#DDCBA8", cervical: "#CDB385" },
  { id: "A3", label: "A3", body: "#D6C097", cervical: "#C4A673" },
];

export function shadeById(id: string): Shade {
  return SHADES.find((s) => s.id === id) ?? SHADES[2];
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
