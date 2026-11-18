// Data model for a smile design. Everything is in image pixels of the (downscaled) photo.

export type Pt = { x: number; y: number };

export type ToothShape = "oval" | "square" | "triangular" | "soft";
export type Proportion = "golden" | "red" | "natural";
export type ToothCount = 6 | 8 | 10;

/** Full face (eyes visible) or a smile close-up (mouth only, e.g. from the gallery). */
export type Framing = "face" | "closeup";

export interface Guides {
  /**
   * Horizontal reference. Full face: the pupils (patient's right pupil appears on the LEFT of a frontal photo).
   * Close-up: the two mouth corners (commissures), a fallback when the eyes are not in the photo.
   */
  pupilR: Pt;
  pupilL: Pt;
  /** A point on the facial midline (usually the philtrum / nose tip). The line runs perpendicular to the pupil line. */
  midline: Pt;
}

/** Which arch the design is for. */
export type Arch = "upper" | "lower";
/** "photo": simulated teeth are built from the patient's own photographed teeth (realistic). "drawn": illustrated teeth. */
export type RenderMode = "photo" | "drawn";

/** Black/white mask of the patient's EXISTING teeth (white = tooth), stored small as a PNG data URL. */
export interface ToothMask {
  w: number;
  h: number;
  png: string;
}

export interface Design {
  /** Contact point between the two centrals at the incisal edge. */
  center: Pt;
  /** Visible width canine tip to canine tip (6 anterior teeth, frontal view), px. */
  width: number;
  /** Central incisor width / length, e.g. 0.8 = 80 %. */
  wl: number;
  proportion: Proportion;
  shape: ToothShape;
  count: ToothCount;
  /** Smile-arc depth (0 = flat, 1 = strong curve following the lower lip). */
  arc: number;
  /** Extra tilt in degrees on top of the pupil-line angle. */
  tilt: number;
  /** Lateral incisors' incisal edge raised above the centrals (fraction of central length). */
  lateralStep: number;
  shade: string;
  /** 0..1 how strongly the mockup covers the photo. */
  opacity: number;
  /** Draw a mouth/gum backdrop behind the mockup inside the lip line (hides the old teeth there). Default true. */
  backdrop?: boolean;
  /** Default "upper". */
  arch?: Arch;
  /** Default "photo". */
  render?: RenderMode;
}

export interface CaseData {
  id: string;
  /** Clinic's own label. Keep it to initials or a code, never shown in exports. */
  label: string;
  createdAt: number;
  updatedAt: number;
  photo: Blob;
  imgW: number;
  imgH: number;
  guides: Guides;
  /** Photo type; missing on older cases means "face". */
  framing?: Framing;
  /** Inner lip contour (closed), clockwise. Teeth are drawn only inside it. */
  lips: Pt[];
  design: Design;
  /** Optional calibration: width in mm of the patient's EXISTING central, measured in the mouth. */
  centralMm?: number;
  /** Mesial and distal edges of that existing central, tapped on the photo (image px). */
  calib?: { a: Pt; b: Pt };
  /** When the clinician confirmed the patient agreed to the photo / to sharing the simulation. */
  consentPhotoAt?: number;
  consentShareAt?: number;
  thumb?: string;
  /** Clinician-corrected mask of the existing teeth; when missing it is detected automatically from the photo. */
  toothMask?: ToothMask;
  /** Round 4: the dentist's case plan (teeth, materials, prep, shade gap, flags, checklist). Recorded, never decided by the app. */
  plan?: CasePlan;
}

// ---------- case plan (round 4) ----------

export type Visibility = "smile" | "speech" | "no" | "unknown";
export type PrepLevel = "none" | "additive" | "minimal" | "conventional" | "crown";
export type Coverage = "facial" | "incisal-butt" | "incisal-overlap" | "cusp-short" | "cusp-full" | "onlay";
export type Margin = "supragingival" | "equigingival" | "subgingival" | "on-root";

export interface ToothPlan {
  /** FDI number, 11–48 */
  fdi: number;
  include: boolean;
  visible: Visibility;
  /** id from the material library ("" = not chosen yet) */
  material: string;
  prep: PrepLevel;
  coverage: Coverage;
  margin: Margin;
  /** Entered by the dentist from the mock-up / silicone index. Never computed by the app. */
  prepMm?: { facial?: number; incisal?: number };
  notes?: string;
}

export type SampleRole = "reference" | "match";
export interface ShadeSample {
  role: SampleRole;
  pt: Pt;
  /** CIELAB (D65) median of a small disk around pt, from the photo */
  lab: [number, number, number];
  label?: string;
}

export interface CasePlan {
  teeth: ToothPlan[];
  shade: { samples: ShadeSample[]; targetTab?: string; whiteningFirst?: boolean; whiteningDone?: boolean };
  flags: { deepBite?: boolean; bruxism?: boolean; recession?: boolean; perioStable?: boolean };
  checklist: Record<string, boolean>;
}

export const DEFAULT_DESIGN: Omit<Design, "center" | "width"> = {
  wl: 0.78,
  proportion: "natural",
  shape: "soft",
  count: 10,
  arc: 0.35,
  tilt: 0,
  lateralStep: 0.1,
  shade: "A1",
  opacity: 0.92,
};

/** Reasonable starting guides/design/lips for a frontal smile photo of size w×h. */
export function initialLayout(w: number, h: number, framing: Framing = "face") {
  if (framing === "closeup") {
    // the mouth fills the photo: reference dots on the mouth corners, midline between the centrals
    const guides: Guides = {
      pupilR: { x: w * 0.2, y: h * 0.5 },
      pupilL: { x: w * 0.8, y: h * 0.5 },
      midline: { x: w * 0.5, y: h * 0.42 },
    };
    const width = w * 0.48;
    const center = { x: w * 0.5, y: h * 0.58 };
    const design: Design = { ...DEFAULT_DESIGN, center, width };
    return { guides, design, lips: defaultLips(center, width) };
  }
  const guides: Guides = {
    pupilR: { x: w * 0.36, y: h * 0.36 },
    pupilL: { x: w * 0.64, y: h * 0.36 },
    midline: { x: w * 0.5, y: h * 0.5 },
  };
  const width = w * 0.3;
  const center = { x: w * 0.5, y: h * 0.72 };
  const design: Design = { ...DEFAULT_DESIGN, center, width };
  return { guides, design, lips: defaultLips(center, width) };
}

/** An almond-shaped inner-lip contour around the design (12 points, clockwise from the left corner). */
export function defaultLips(center: Pt, width: number): Pt[] {
  const hw = width * 0.78;
  const top = width * 0.26;
  const bottom = width * 0.12;
  const pts: Pt[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / n) * Math.PI * 2; // start at left corner, go over the top
    const c = Math.cos(a);
    const s = Math.sin(a);
    const ry = s < 0 ? top : bottom;
    // corners sit a little higher than the middle (smile shape)
    const y = center.y - width * 0.08 + s * ry - Math.abs(c) ** 3 * width * 0.06;
    pts.push({ x: center.x + c * hw, y });
  }
  return pts;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
