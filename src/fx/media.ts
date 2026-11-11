/**
 * Drawing media for the `sketch` explainer: one drawing, six materials. Our own "style recipes"
 * (ideas borrowed, no third-party code): each medium sets the paper, the line, how colour goes on,
 * the order of the stages, the drawing tool and how the finished picture keeps moving.
 * Read docs/style-recipes.md for when to use which.
 */
import type { Theme } from "../theme";

export const MEDIA = ["pencil", "watercolour", "chalkboard", "crayon", "ink", "collage"] as const;
export type MediumName = (typeof MEDIA)[number];

export type Medium = {
  /** Page colour and texture (noise frequency "x y", octaves, strength 0–1). */
  paper: (t: Theme) => { bg: string; freq: string; octaves: number; strength: number; tint: [number, number, number]; light?: boolean };
  /** Line colour, accent colour (title underline, highlighted word), text colour. */
  ink: (t: Theme) => { line: string; accent: string; text: string; muted: string };
  line: { width: number; wobble: number; boil: boolean; grain: number; bleed: number };
  /** How colour goes on: marker (offset flat), wash (wet, spreads, dark rim, granulation), hatch (chalk lines),
   * grain (waxy streaks), tone (ink washes in grey), paper (cut-paper pieces with shadow). */
  fill: { mode: "marker" | "wash" | "hatch" | "grain" | "tone" | "paper"; opacity: number; offset: [number, number] };
  /** line-first: outline then colour. colour-first: colour then line on top (watercolour, collage). */
  order: "line-first" | "colour-first";
  tool: "pencil" | "brush" | "chalk" | "crayon" | "scissors";
  /** After the drawing is finished: boil (line jitters like hand animation) and/or sway (gentle floating). */
  motion: { boil: boolean; sway: number };
};

const dark = (t: Theme) => ({ line: t.end.text, accent: t.end.accent, text: t.end.text, muted: t.end.muted });

export const MEDIUM: Record<MediumName, Medium> = {
  pencil: {
    paper: (t) => ({ bg: t.end.top, freq: "0.7", octaves: 3, strength: 0.18, tint: [0.5, 0.47, 0.42] }),
    ink: dark,
    line: { width: 1, wobble: 3.2, boil: true, grain: 0, bleed: 0 },
    fill: { mode: "marker", opacity: 0.9, offset: [5, 6] },
    order: "line-first",
    tool: "pencil",
    motion: { boil: true, sway: 0 },
  },
  watercolour: {
    paper: () => ({ bg: "#FBF8F1", freq: "0.035", octaves: 4, strength: 0.32, tint: [0.55, 0.5, 0.42] }),
    ink: (t) => ({ line: "#4A3B30", accent: t.end.accent, text: "#3A3029", muted: t.end.muted }),
    line: { width: 0.62, wobble: 2.2, boil: false, grain: 0, bleed: 0 },
    fill: { mode: "wash", opacity: 1, offset: [0, 0] },
    order: "colour-first",
    tool: "brush",
    motion: { boil: false, sway: 1 },
  },
  chalkboard: {
    paper: () => ({ bg: "#25322D", freq: "0.9", octaves: 2, strength: 0.16, tint: [1, 1, 1], light: false }),
    ink: (t) => ({ line: "#EFECE4", accent: t.map[t.name === "brand" ? 0 : 2], text: "#F1EEE6", muted: "rgba(241,238,230,0.55)" }),
    line: { width: 1.3, wobble: 2.6, boil: false, grain: 0.55, bleed: 0 },
    fill: { mode: "hatch", opacity: 0.85, offset: [3, 3] },
    order: "line-first",
    tool: "chalk",
    motion: { boil: false, sway: 0.6 },
  },
  crayon: {
    paper: () => ({ bg: "#F3EBDD", freq: "0.6 0.05", octaves: 2, strength: 0.22, tint: [0.55, 0.45, 0.32] }),
    ink: (t) => ({ line: "#3A2E26", accent: t.end.accent, text: "#33291F", muted: t.end.muted }),
    line: { width: 1.7, wobble: 3, boil: true, grain: 0.35, bleed: 0 },
    fill: { mode: "grain", opacity: 0.95, offset: [3, 4] },
    order: "line-first",
    tool: "crayon",
    motion: { boil: true, sway: 0 },
  },
  ink: {
    paper: () => ({ bg: "#F5F1E8", freq: "0.015 0.5", octaves: 3, strength: 0.2, tint: [0.45, 0.42, 0.36] }),
    ink: (t) => ({ line: "#1B1A18", accent: t.map[1], text: "#1F1D1A", muted: t.end.muted }),
    line: { width: 1.9, wobble: 2.4, boil: false, grain: 0.08, bleed: 0.7 },
    fill: { mode: "tone", opacity: 0.5, offset: [0, 0] },
    order: "line-first",
    tool: "brush",
    motion: { boil: false, sway: 0.5 },
  },
  collage: {
    paper: () => ({ bg: "#D9C3A0", freq: "0.5 0.03", octaves: 3, strength: 0.25, tint: [0.45, 0.33, 0.2] }),
    ink: (t) => ({ line: "#2A231C", accent: t.end.accent, text: "#2A231C", muted: "#5E5040" }),
    line: { width: 0.8, wobble: 1.6, boil: false, grain: 0, bleed: 0 },
    fill: { mode: "paper", opacity: 1, offset: [0, 0] },
    order: "colour-first",
    tool: "scissors",
    motion: { boil: false, sway: 1.2 },
  },
};
