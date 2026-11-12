/**
 * Drawing media for the `sketch` explainer: one drawing, six materials. Our own "style recipes"
 * (ideas borrowed, no third-party code): each medium sets the paper, the line, how colour goes on,
 * the order of the stages, the drawing tool and how the finished picture keeps moving.
 * Read docs/style-recipes.md for when to use which.
 */
import type { Theme } from "../theme";
import type { FillKey } from "./doodles";

export const MEDIA = [
  "pencil", "watercolour", "chalkboard", "crayon", "ink", "collage",
  "risograph", "ukiyoe", "midcentury", "ligneclaire", "thickline", "clay", "greasepencil", "y2k",
] as const;
export type MediumName = (typeof MEDIA)[number];

export type Medium = {
  /** Page colour and texture (noise frequency "x y", octaves, strength 0–1). */
  paper: (t: Theme) => { bg: string; freq: string; octaves: number; strength: number; tint: [number, number, number]; light?: boolean };
  /** Line colour, accent colour (title underline, highlighted word), text colour. */
  ink: (t: Theme) => { line: string; accent: string; text: string; muted: string };
  line: { width: number; wobble: number; boil: boolean; grain: number; bleed: number };
  /** How colour goes on: marker (offset flat), wash (wet, spreads, dark rim, granulation), hatch (chalk lines),
   * grain (waxy streaks), tone (ink washes in grey), paper (cut-paper pieces with shadow). */
  fill: { mode: "marker" | "wash" | "hatch" | "grain" | "tone" | "paper" | "halftone" | "flat" | "woodblock" | "clay" | "gloss"; opacity: number; offset: [number, number] };
  /** Limited palette for the medium (riso inks, woodblock pigments...). Missing keys fall back to the theme. */
  palette?: Partial<Record<FillKey, string>>;
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
  /** Two-ink risograph print: halftone dots, misregistered, blue line. */
  risograph: {
    paper: () => ({ bg: "#F4EFE6", freq: "0.9", octaves: 2, strength: 0.2, tint: [0.4, 0.38, 0.35] }),
    ink: () => ({ line: "#2D4FB0", accent: "#E8457A", text: "#2A3F8F", muted: "#6B7AAE" }),
    line: { width: 0.9, wobble: 1.4, boil: false, grain: 0.15, bleed: 0 },
    fill: { mode: "halftone", opacity: 0.95, offset: [9, 6] },
    palette: { white: "#F4EFE6", coral: "#EF5B8C", pink: "#EF5B8C", blue: "#4E6FD1", green: "#4E6FD1", yellow: "#F5C344", gold: "#F5C344" },
    order: "colour-first",
    tool: "scissors",
    motion: { boil: false, sway: 0.5 },
  },
  /** Woodblock print: indigo key line, flat pigments with a soft gradient (bokashi), wood grain. */
  ukiyoe: {
    paper: () => ({ bg: "#EFE3C8", freq: "0.02 0.6", octaves: 3, strength: 0.22, tint: [0.5, 0.42, 0.3] }),
    ink: () => ({ line: "#1F2A44", accent: "#B5382F", text: "#1F2A44", muted: "#6E6352" }),
    line: { width: 1.25, wobble: 1.2, boil: false, grain: 0.06, bleed: 0 },
    fill: { mode: "woodblock", opacity: 0.95, offset: [0, 0] },
    palette: { white: "#F6EEDC", coral: "#C8553D", pink: "#D99A8B", blue: "#3C5A8A", green: "#6E8B5B", yellow: "#D9A441", gold: "#D9A441" },
    order: "line-first",
    tool: "brush",
    motion: { boil: false, sway: 0.4 },
  },
  /** Mid-century illustration: flat shapes in a limited warm palette, colour knocked off the line, grain. */
  midcentury: {
    paper: () => ({ bg: "#F1E6D0", freq: "0.8", octaves: 2, strength: 0.18, tint: [0.45, 0.38, 0.28] }),
    ink: () => ({ line: "#3B2F25", accent: "#D9623B", text: "#3B2F25", muted: "#7A6A55" }),
    line: { width: 0.7, wobble: 1, boil: false, grain: 0, bleed: 0 },
    fill: { mode: "flat", opacity: 1, offset: [10, 8] },
    palette: { white: "#FBF5E8", coral: "#D9623B", pink: "#E59A86", blue: "#3E6D8E", green: "#2F7F7A", yellow: "#D9A13B", gold: "#D9A13B" },
    order: "colour-first",
    tool: "scissors",
    motion: { boil: false, sway: 0.8 },
  },
  /** Ligne claire: one clean even line, bright flat colour exactly inside it, no texture. */
  ligneclaire: {
    paper: () => ({ bg: "#FFFFFF", freq: "0.9", octaves: 1, strength: 0.02, tint: [0.5, 0.5, 0.5] }),
    ink: (t) => ({ line: "#141414", accent: t.end.accent, text: "#141414", muted: "#6A6A6A" }),
    line: { width: 0.9, wobble: 0, boil: false, grain: 0, bleed: 0 },
    fill: { mode: "flat", opacity: 1, offset: [0, 0] },
    palette: { coral: "#E2553F", pink: "#F08FA6", blue: "#3D7DD8", green: "#4FA35B", yellow: "#F2C230", gold: "#F2C230" },
    order: "line-first",
    tool: "pencil",
    motion: { boil: false, sway: 0 },
  },
  /** Thick-line cartoon: very bold black outline, flat theme colours. */
  thickline: {
    paper: (t) => ({ bg: t.end.top, freq: "0.9", octaves: 1, strength: 0.05, tint: [0.5, 0.5, 0.5] }),
    ink: (t) => ({ line: "#141414", accent: t.end.accent, text: t.end.text, muted: t.end.muted }),
    line: { width: 2.5, wobble: 0.8, boil: true, grain: 0, bleed: 0 },
    fill: { mode: "flat", opacity: 1, offset: [0, 0] },
    order: "line-first",
    tool: "pencil",
    motion: { boil: true, sway: 0.6 },
  },
  /** Claymorphism: soft puffy pastel shapes with highlights and shadows, barely any line; pieces pop in. */
  clay: {
    paper: () => ({ bg: "#EEE8F3", freq: "0.9", octaves: 1, strength: 0.03, tint: [0.5, 0.5, 0.5] }),
    ink: (t) => ({ line: "#5B5266", accent: t.end.accent, text: "#3E3648", muted: "#857B90" }),
    line: { width: 0.45, wobble: 0, boil: false, grain: 0, bleed: 0 },
    fill: { mode: "clay", opacity: 1, offset: [0, 0] },
    palette: { white: "#FFFFFF", coral: "#F5A38A", pink: "#F4A7B9", blue: "#9CC3F0", green: "#A8DDB5", yellow: "#F7D88B", gold: "#F7D88B" },
    order: "colour-first",
    tool: "scissors",
    motion: { boil: false, sway: 1.2 },
  },
  /** Grease pencil: rough waxy dark line on grey paper, light colour scumbled in. */
  greasepencil: {
    paper: () => ({ bg: "#ECE9E2", freq: "0.7 0.2", octaves: 2, strength: 0.2, tint: [0.4, 0.38, 0.35] }),
    ink: (t) => ({ line: "#2A1E1A", accent: t.map[1], text: "#2A1E1A", muted: "#6E655C" }),
    line: { width: 1.5, wobble: 3.4, boil: true, grain: 0.3, bleed: 0.3 },
    fill: { mode: "grain", opacity: 0.6, offset: [4, 5] },
    order: "line-first",
    tool: "crayon",
    motion: { boil: true, sway: 0 },
  },
  /** Y2K glossy: candy colours with shiny highlights, navy line, everything pops in. */
  y2k: {
    paper: () => ({ bg: "#E9ECFF", freq: "0.9", octaves: 1, strength: 0.03, tint: [0.5, 0.5, 0.6] }),
    ink: () => ({ line: "#2B2B6B", accent: "#FF4FB0", text: "#2B2B6B", muted: "#6E6EA8" }),
    line: { width: 0.9, wobble: 0, boil: false, grain: 0, bleed: 0 },
    fill: { mode: "gloss", opacity: 1, offset: [0, 0] },
    palette: { white: "#FFFFFF", coral: "#FF8F70", pink: "#FF7EC8", blue: "#6FA8FF", green: "#7CF0C5", yellow: "#FFE26A", gold: "#FFE26A" },
    order: "colour-first",
    tool: "scissors",
    motion: { boil: false, sway: 1 },
  },
};
