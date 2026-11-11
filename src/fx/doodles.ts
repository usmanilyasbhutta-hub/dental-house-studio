/**
 * Hand-drawn dental doodles for the `sketch` explainer (reference: "Hand-Drawn Explainer" reel).
 * Drawn in code on a 400×400 box: strokes are drawn in order (pen), then fills fade in underneath.
 * Fill keys map to the theme's harmonised palette (theme.map) so colours stay on-brand.
 * Add a doodle: give it strokes (+ optional fills), then add its name to DOODLES; the schema picks it up.
 */
export type FillKey = "white" | "blue" | "coral" | "pink" | "green" | "yellow" | "gold" | "ink";
export type Doodle = {
  strokes: { d: string; w?: number; accent?: boolean }[];
  fills?: { d: string; fill: FillKey; opacity?: number }[];
};

const circle = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

const MOLAR =
  "M 110 90 C 140 60, 175 70, 200 88 C 225 70, 260 60, 290 90 C 320 120, 318 180, 300 230 C 290 260, 285 300, 278 340 C 274 365, 250 370, 242 345 C 235 320, 225 290, 200 288 C 175 290, 165 320, 158 345 C 150 370, 126 365, 122 340 C 115 300, 110 260, 100 230 C 82 180, 80 120, 110 90 Z";
const DROP = (x: number, y: number, s = 1) =>
  `M ${x} ${y} C ${x - 10 * s} ${y + 20 * s}, ${x - 13 * s} ${y + 33 * s}, ${x} ${y + 38 * s} C ${x + 13 * s} ${y + 33 * s}, ${x + 10 * s} ${y + 20 * s}, ${x} ${y} Z`;

/** Upper gum (scalloped margin: up over each tooth, down to a point between them) with two front teeth. */
const MARGIN = "M 52 156 C 80 104, 186 104, 200 156 C 214 104, 320 104, 348 156";
const TOOTH_L = "M 92 140 L 98 270 Q 101 298 130 300 L 158 300 Q 184 298 186 270 L 192 140";
const TOOTH_R = "M 208 140 L 214 270 Q 216 298 242 300 L 270 300 Q 299 298 302 270 L 308 140";
const GUM_TEETH = {
  strokes: [
    { d: "M 46 62 C 120 50, 280 72, 354 58", w: 4 },
    { d: "M 46 62 L 52 156 M 354 58 L 348 156", w: 4 },
    { d: TOOTH_L, w: 5 },
    { d: TOOTH_R, w: 5 },
    { d: MARGIN, w: 5 },
  ],
  fills: [
    { d: `${TOOTH_L} Z`, fill: "white" as const },
    { d: `${TOOTH_R} Z`, fill: "white" as const },
    { d: "M 46 62 C 120 50, 280 72, 354 58 L 348 156 C 320 104, 214 104, 200 156 C 186 104, 80 104, 52 156 Z", fill: "pink" as const },
  ],
};

const toothFace = {
  happy: [
    { d: ellipse(165, 172, 7, 10), w: 5 },
    { d: ellipse(235, 172, 7, 10), w: 5 },
    { d: "M 168 215 Q 200 244 232 215" },
  ],
  sad: [
    { d: "M 148 142 L 178 152" },
    { d: "M 252 142 L 222 152" },
    { d: ellipse(165, 175, 7, 10), w: 5 },
    { d: ellipse(235, 175, 7, 10), w: 5 },
    { d: "M 172 232 Q 200 210 228 232" },
  ],
};

export const DOODLE_SET = {
  /** Happy molar character. */
  "tooth-happy": {
    strokes: [{ d: MOLAR, w: 6 }, ...toothFace.happy, { d: "M 286 130 L 296 146 M 290 168 L 300 184", w: 3 }],
    fills: [
      { d: MOLAR, fill: "white" },
      { d: circle(138, 205, 14), fill: "pink", opacity: 0.7 },
      { d: circle(262, 205, 14), fill: "pink", opacity: 0.7 },
    ],
  },
  /** Worried molar with a sweat drop. */
  "tooth-sad": {
    strokes: [{ d: MOLAR, w: 6 }, ...toothFace.sad, { d: DROP(312, 70), w: 4 }],
    fills: [
      { d: MOLAR, fill: "white" },
      { d: DROP(312, 70), fill: "blue" },
    ],
  },
  /** Toothbrush (drawn level; rotate it in the brief). */
  toothbrush: {
    strokes: [
      { d: "M 40 230 L 255 230 C 272 230, 272 252, 255 252 L 40 252 C 26 252, 26 230, 40 230 Z", w: 5 },
      { d: "M 255 233 L 362 228 C 374 228, 374 254, 362 254 L 255 249", w: 5 },
      { d: "M 288 192 L 366 192", w: 4 },
      { d: [292, 304, 316, 328, 340, 352, 362].map((x) => `M ${x} 228 L ${x} 194`).join(" "), w: 3 },
    ],
    fills: [
      { d: "M 40 230 L 255 230 C 272 230, 272 252, 255 252 L 40 252 C 26 252, 26 230, 40 230 Z", fill: "blue" },
      { d: "M 288 192 L 366 192 L 366 228 L 288 228 Z", fill: "white" },
    ],
  },
  /** Gum with two front teeth and floss going between them. */
  floss: {
    strokes: [...GUM_TEETH.strokes, { d: "M 40 380 C 120 330, 170 262, 197 200 C 210 168, 222 140, 238 40", w: 4, accent: true }],
    fills: GUM_TEETH.fills,
  },
  /** Gum with two front teeth and a drop of blood at the gum line (bleeding gums). */
  "gums-bleeding": {
    strokes: [...GUM_TEETH.strokes, { d: DROP(200, 158, 1.2), w: 4 }],
    fills: [...GUM_TEETH.fills, { d: DROP(200, 158, 1.2), fill: "coral" }],
  },
  /** Calendar page with one day circled. */
  calendar: {
    strokes: [
      { d: "M 70 92 L 330 92 L 330 340 L 70 340 Z", w: 5 },
      { d: "M 70 142 L 330 142", w: 4 },
      { d: "M 130 66 L 130 112 M 270 66 L 270 112", w: 6 },
      { d: "M 70 192 L 330 192 M 70 242 L 330 242 M 70 292 L 330 292 M 135 142 L 135 340 M 200 142 L 200 340 M 265 142 L 265 340", w: 2 },
      { d: "M 272 268 C 268 238, 330 236, 330 264 C 333 294, 266 296, 266 266 C 266 252, 282 244, 300 246", w: 5, accent: true },
    ],
    fills: [
      { d: "M 70 92 L 330 92 L 330 340 L 70 340 Z", fill: "white" },
      { d: "M 70 92 L 330 92 L 330 142 L 70 142 Z", fill: "coral" },
    ],
  },
  /** Glass of water. */
  water: {
    strokes: [
      { d: "M 120 80 L 280 80 L 256 350 L 144 350 Z", w: 5 },
      { d: "M 129 160 Q 200 178 271 160", w: 3 },
      { d: `${circle(180, 240, 7)} ${circle(222, 290, 5)} ${circle(205, 205, 4)}`, w: 2 },
    ],
    fills: [{ d: "M 129 160 Q 200 178 271 160 L 256 350 L 144 350 Z", fill: "blue", opacity: 0.55 }],
  },
  /** Wrapped sweet (sugar). */
  candy: {
    strokes: [
      { d: "M 140 200 C 140 148, 260 148, 260 200 C 260 252, 140 252, 140 200 Z", w: 5 },
      { d: "M 140 200 L 78 158 L 96 200 L 78 242 Z M 260 200 L 322 158 L 304 200 L 322 242 Z", w: 5 },
      { d: "M 172 160 L 192 242 M 208 157 L 228 243", w: 4 },
    ],
    fills: [
      { d: "M 140 200 C 140 148, 260 148, 260 200 C 260 252, 140 252, 140 200 Z", fill: "pink" },
      { d: "M 140 200 L 78 158 L 96 200 L 78 242 Z M 260 200 L 322 158 L 304 200 L 322 242 Z", fill: "yellow" },
    ],
  },
  /** Clock (time, "2 minutes", "every 6 months"). */
  clock: {
    strokes: [
      { d: circle(200, 205, 135), w: 6 },
      { d: "M 200 205 L 200 118 M 200 205 L 262 238", w: 6 },
      { d: "M 200 78 L 200 96 M 200 314 L 200 332 M 73 205 L 91 205 M 309 205 L 327 205", w: 4 },
    ],
    fills: [{ d: circle(200, 205, 135), fill: "white" }],
  },
  /** Clinic house (generic; not the logo). */
  clinic: {
    strokes: [
      { d: "M 70 196 L 200 82 L 330 196", w: 6 },
      { d: "M 96 176 L 96 340 L 304 340 L 304 176", w: 5 },
      { d: "M 176 340 L 176 268 L 224 268 L 224 340", w: 4 },
      { d: "M 120 214 L 166 214 L 166 252 L 120 252 Z M 234 214 L 280 214 L 280 252 L 234 252 Z", w: 3 },
      { d: "M 200 150 L 200 190 M 180 170 L 220 170", w: 5, accent: true },
    ],
    fills: [
      { d: "M 96 176 L 200 86 L 304 176 L 304 340 L 96 340 Z", fill: "white" },
      { d: "M 176 340 L 176 268 L 224 268 L 224 340 Z", fill: "gold", opacity: 0.8 },
    ],
  },
  /** Big hand-drawn tick. */
  check: { strokes: [{ d: "M 80 214 C 110 240, 140 270, 162 296 C 210 220, 260 160, 332 104", w: 14, accent: true }] },
  /** Big hand-drawn cross. */
  cross: { strokes: [{ d: "M 100 100 C 170 170, 230 240, 300 304", w: 14, accent: true }, { d: "M 300 100 C 230 170, 170 240, 100 304", w: 14, accent: true }] },
  /** Curved arrow pointing up-right. */
  arrow: { strokes: [{ d: "M 60 310 C 140 290, 220 210, 300 112", w: 7 }, { d: "M 246 116 L 302 110 L 296 166", w: 7 }] },
  heart: {
    strokes: [{ d: "M 200 330 C 80 250, 40 160, 110 110 C 150 84, 190 110, 200 142 C 210 110, 250 84, 290 110 C 360 160, 320 250, 200 330 Z", w: 6 }],
    fills: [{ d: "M 200 330 C 80 250, 40 160, 110 110 C 150 84, 190 110, 200 142 C 210 110, 250 84, 290 110 C 360 160, 320 250, 200 330 Z", fill: "coral" }],
  },
} satisfies Record<string, Doodle>;

export const DOODLES = Object.keys(DOODLE_SET) as (keyof typeof DOODLE_SET)[];
export type DoodleName = keyof typeof DOODLE_SET;
