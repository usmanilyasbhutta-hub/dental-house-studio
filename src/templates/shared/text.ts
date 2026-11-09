import type { CSSProperties } from "react";
import { fonts } from "../../brand";

export const headline = (size: number, color?: string): CSSProperties => ({
  fontFamily: fonts.headline,
  fontWeight: 700,
  fontSize: size,
  lineHeight: 0.98,
  textTransform: "uppercase",
  letterSpacing: "0.01em",
  color,
});

export const serif = (size: number, color?: string): CSSProperties => ({
  fontFamily: fonts.accent,
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1.08,
  color,
});

export const mono = (size: number, color?: string): CSSProperties => ({
  fontFamily: fonts.mono,
  fontWeight: 500,
  fontSize: size,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color,
});

/**
 * Font size so the longest line fits `width` px. Oswald 700 uppercase averages
 * ~0.53em per character (0.56 leaves a margin); visual QC confirms nothing overflows.
 */
export function fitSize(lines: string[], width: number, max: number, min = 56): number {
  const longest = Math.max(...lines.map((l) => l.length), 1);
  return Math.round(Math.max(min, Math.min(max, width / (longest * 0.56))));
}
