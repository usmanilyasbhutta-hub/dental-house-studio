/**
 * Blueprint drawings (frame coordinates, 1080×1920). Each stroke has a start/end as a FRACTION of the drawing time,
 * so a brief's `seconds` stretches the whole drawing. Illustrations only: not to scale, no clinical claims.
 *
 * To add a subject: list its strokes (solid ones are drawn along the path; dashed ones are wiped top→bottom between
 * y0 and y1), dimensions, labels and hatch areas, then add its name to `blueprintBrief.subject` in schema.ts.
 */
export type Stroke = { d: string; t: [number, number]; w?: number; dash?: boolean; wipe?: [number, number]; group?: "move" };
export type Dim = { a: [number, number]; b: [number, number]; side: number; key: "length" | "diameter"; t: [number, number] };
export type Label = { text: string; at: [number, number]; y: number; t: number; group?: "move" };
export type Subject = {
  figure: string;
  strokes: Stroke[];
  /** Cross-section hatch: clip path (evenodd) and reveal window. */
  hatch?: { clip: string; t: [number, number]; box: [number, number, number, number] };
  dims: Dim[];
  labels: Label[];
  /** Exploded → assembled: strokes/labels in group "move" start `lift` px higher and seat during `seat`. */
  move?: { lift: number; seat: [number, number] };
  /** A scan line sweeping down the drawing. */
  scan?: [number, number];
};

const CX = 540;

// ---- implant (section) ------------------------------------------------------------------------------
const threadSide = (side: -1 | 1) => {
  // body edge tapers from 64 px (platform) to 54 px (apex) from the axis; V-threads stick out 13 px
  const edge = (y: number) => 64 - ((y - 980) / 280) * 10;
  let d = "";
  for (let y = 998, k = 0; y <= 1250; y += 11, k++) {
    const x = CX + side * (edge(y) + (k % 2 ? 13 : 0));
    d += `${k ? "L" : "M"} ${x.toFixed(1)} ${y}`;
  }
  return d;
};

const CROWN =
  "M 470 930 C 430 900, 392 830, 392 760 C 392 700, 405 665, 428 650 C 450 636, 470 655, 482 664 C 500 646, 522 636, 540 648 C 558 636, 580 646, 598 664 C 610 655, 630 636, 652 650 C 675 665, 688 700, 688 760 C 688 830, 650 900, 610 930 Z";
const IMPLANT = "M 476 980 L 604 980 L 594 1260 Q 590 1302 540 1304 Q 490 1302 486 1260 Z";
const BONE_BOX = "M 290 980 L 790 980 L 790 1340 L 290 1340 Z";

export const implant: Subject = {
  figure: "FIG. 1 — DENTAL IMPLANT",
  strokes: [
    { d: "M 540 600 L 540 1380", t: [0.03, 0.12], w: 1.2, dash: true, wipe: [600, 1380] }, // axis
    { d: "M 290 1340 L 290 980 L 790 980 L 790 1340", t: [0.06, 0.18] }, // bone section
    { d: "M 290 1340 C 330 1322, 370 1358, 415 1340 C 460 1322, 500 1358, 540 1340 C 580 1322, 620 1358, 665 1340 C 710 1322, 750 1358, 790 1340", t: [0.14, 0.2], w: 1.6 }, // break line
    { d: "M 290 905 C 360 900, 430 905, 472 930", t: [0.18, 0.24], w: 2.2 }, // gum
    { d: "M 608 930 C 650 905, 720 900, 790 905", t: [0.2, 0.26], w: 2.2 },
    { d: "M 290 905 L 290 980 M 790 905 L 790 980", t: [0.22, 0.26], w: 1.6 },
    { d: IMPLANT, t: [0.22, 0.34] },
    { d: threadSide(-1), t: [0.28, 0.4], w: 2 },
    { d: threadSide(1), t: [0.3, 0.42], w: 2 },
    { d: "M 526 830 L 526 1120 M 554 830 L 554 1120", t: [0.36, 0.42], w: 1.4, dash: true, wipe: [830, 1120] }, // screw channel (hidden)
    { d: "M 480 980 L 472 930 L 498 822 Q 500 816 508 816 L 572 816 Q 580 816 582 822 L 608 930 L 600 980", t: [0.38, 0.48] }, // abutment
    { d: CROWN, t: [0.46, 0.58], group: "move" },
    { d: "M 474 928 L 500 820 L 580 820 L 606 928", t: [0.55, 0.6], w: 1.4, dash: true, wipe: [800, 935], group: "move" }, // crown inner fit (hidden)
  ],
  hatch: { clip: `${BONE_BOX} ${IMPLANT}`, t: [0.12, 0.26], box: [290, 980, 500, 360] },
  dims: [
    { a: [476, 980], b: [476, 1304], side: -1, key: "length", t: [0.56, 0.64] },
    { a: [476, 1310], b: [604, 1310], side: 1, key: "diameter", t: [0.6, 0.68] },
  ],
  labels: [
    { text: "Crown", at: [684, 740], y: 700, t: 0.6, group: "move" },
    { text: "Abutment", at: [596, 880], y: 860, t: 0.63 },
    { text: "Gum", at: [720, 906], y: 935, t: 0.66 },
    { text: "Implant", at: [600, 1110], y: 1100, t: 0.69 },
    { text: "Bone", at: [740, 1230], y: 1240, t: 0.72 },
  ],
  move: { lift: 85, seat: [0.78, 0.88] },
};

// ---- molar (longitudinal section) ---------------------------------------------------------------------
const TOOTH =
  "M 425 930 C 400 880, 392 820, 392 760 C 392 700, 405 665, 428 650 C 450 636, 470 655, 482 664 C 500 646, 522 636, 540 648 C 558 636, 580 646, 598 664 C 610 655, 630 636, 652 650 C 675 665, 688 700, 688 760 C 688 820, 680 880, 655 930 C 650 1050, 660 1200, 630 1310 Q 615 1332 600 1310 C 585 1220, 575 1120, 545 1060 Q 540 1050 535 1060 C 505 1120, 495 1220, 480 1310 Q 465 1332 450 1310 C 420 1200, 430 1050, 425 930 Z";
const PULP =
  "M 482 830 C 492 795, 520 792, 540 805 C 560 792, 588 795, 598 830 L 600 930 C 604 1050, 612 1180, 612 1290 L 606 1290 C 600 1180, 585 1060, 560 1000 Q 540 975 520 1000 C 495 1060, 480 1180, 474 1290 L 468 1290 C 468 1180, 476 1050, 480 930 Z";

export const tooth: Subject = {
  figure: "FIG. 1 — MOLAR, SECTION",
  strokes: [
    { d: "M 540 600 L 540 1380", t: [0.03, 0.12], w: 1.2, dash: true, wipe: [600, 1380] },
    { d: TOOTH, t: [0.06, 0.28] },
    { d: "M 440 920 C 420 870, 415 815, 416 765 C 418 715, 430 690, 448 680 C 470 672, 500 670, 540 676 C 580 670, 610 672, 632 680 C 650 690, 662 715, 664 765 C 665 815, 660 870, 640 920", t: [0.26, 0.38], w: 2 }, // enamel–dentin junction
    { d: PULP, t: [0.36, 0.48], w: 2.2 },
    { d: "M 290 905 C 360 900, 400 915, 427 940", t: [0.46, 0.5], w: 2.2 }, // gum
    { d: "M 653 940 C 680 915, 720 900, 790 905", t: [0.47, 0.51], w: 2.2 },
    { d: "M 290 1340 L 290 990 L 432 990 M 648 990 L 790 990 L 790 1340", t: [0.5, 0.58] }, // bone
    { d: "M 290 1340 C 330 1322, 370 1358, 415 1340 C 460 1322, 500 1358, 540 1340 C 580 1322, 620 1358, 665 1340 C 710 1322, 750 1358, 790 1340", t: [0.56, 0.6], w: 1.6 },
  ],
  hatch: { clip: `M 290 990 L 790 990 L 790 1340 L 290 1340 Z ${TOOTH}`, t: [0.54, 0.64], box: [290, 990, 500, 350] },
  dims: [],
  labels: [
    { text: "Enamel", at: [684, 740], y: 700, t: 0.62 },
    { text: "Dentin", at: [640, 860], y: 790, t: 0.65 },
    { text: "Pulp", at: [592, 845], y: 870, t: 0.68 },
    { text: "Gum", at: [720, 908], y: 950, t: 0.71 },
    { text: "Root canal", at: [609, 1180], y: 1110, t: 0.74 },
    { text: "Bone", at: [740, 1240], y: 1250, t: 0.77 },
  ],
  scan: [0.82, 0.97],
};

export const SUBJECTS = { implant, tooth } as const;
