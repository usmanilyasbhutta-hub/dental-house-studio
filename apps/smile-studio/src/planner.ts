// Case planner (round 4): pure logic, unit-tested in tests/planner.test.ts.
// The app never decides clinically. It RECORDS the dentist's plan, MEASURES what a photo can measure (a colour estimate),
// and CHECKS the recorded plan for known conflicts. Every number shown is labelled as a photo estimate or a reference value.
import type { Arch, CasePlan, Coverage, Margin, PrepLevel, ToothPlan, Visibility } from "./model";

export type Lab = [number, number, number];

// ---------- colour ----------

const srgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const WHITE_D65 = [0.95047, 1, 1.08883];
const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);

/** sRGB (0–255, D65) to CIELAB (D65 / 2°). */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = 0.0193339 * R + 0.119192 * G + 0.9503041 * B;
  const fx = f(X / WHITE_D65[0]);
  const fy = f(Y / WHITE_D65[1]);
  const fz = f(Z / WHITE_D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export const hexToLab = (hex: string): Lab => {
  const n = parseInt(hex.slice(1), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
};

/** Specular highlights (L* above this) are not tooth colour. */
export const SPECULAR_L = 93;
/** Very dark pixels (gaps, shadows, the mouth) are not tooth colour either. */
export const DARK_L = 20;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Median CIELAB of the pixels in a disk of radius r (image px) around (x, y), rejecting specular highlights
 * (L* > 93) and very dark pixels (L* < 20). Returns null when nothing usable is under the disk.
 */
export function sampleLab(rgba: ArrayLike<number>, w: number, h: number, x: number, y: number, r: number): Lab | null {
  const L: number[] = [];
  const A: number[] = [];
  const B: number[] = [];
  const rr = Math.max(0.5, r);
  for (let yy = Math.floor(y - rr); yy <= Math.ceil(y + rr); yy++) {
    if (yy < 0 || yy >= h) continue;
    for (let xx = Math.floor(x - rr); xx <= Math.ceil(x + rr); xx++) {
      if (xx < 0 || xx >= w) continue;
      if ((xx - x) ** 2 + (yy - y) ** 2 > rr * rr) continue;
      const i = (yy * w + xx) * 4;
      const lab = rgbToLab(rgba[i], rgba[i + 1], rgba[i + 2]);
      if (lab[0] > SPECULAR_L || lab[0] < DARK_L) continue;
      L.push(lab[0]);
      A.push(lab[1]);
      B.push(lab[2]);
    }
  }
  if (!L.length) return null;
  return [median(L), median(A), median(B)];
}

export function deltaE76(p: Lab, q: Lab) {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

export interface DE00 {
  dE: number;
  /** weighted components ΔL'/SL, ΔC'/SC, ΔH'/SH (signed: second minus first) */
  l: number;
  c: number;
  h: number;
}

/** CIEDE2000 with its weighted components (kL = kC = kH = 1). Sharma, Wu & Dalal 2005 implementation notes. */
export function deltaE00Parts(p: Lab, q: Lab): DE00 {
  const [L1, a1, b1] = p;
  const [L2, a2, b2] = q;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hp = (b: number, a: number) => {
    if (b === 0 && a === 0) return 0;
    const v = Math.atan2(b, a) / rad;
    return v < 0 ? v + 360 : v;
  };
  const h1p = hp(b1, a1p);
  const h2p = hp(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lpm = (L1 + L2) / 2;
  const Cpm = (C1p + C2p) / 2;
  let hpm = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) <= 180) hpm = (h1p + h2p) / 2;
    else hpm = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hpm - 30) * rad) +
    0.24 * Math.cos(2 * hpm * rad) +
    0.32 * Math.cos((3 * hpm + 6) * rad) -
    0.2 * Math.cos((4 * hpm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hpm - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lpm - 50) ** 2) / Math.sqrt(20 + (Lpm - 50) ** 2);
  const SC = 1 + 0.045 * Cpm;
  const SH = 1 + 0.015 * Cpm * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  const l = dLp / SL;
  const c = dCp / SC;
  const h = dHp / SH;
  return { dE: Math.sqrt(l * l + c * c + h * h + RT * c * h), l, c, h };
}

export const deltaE00 = (p: Lab, q: Lab) => deltaE00Parts(p, q).dE;

/** Paravina et al. 2015 (PMID 25740131): 50:50 perceptibility and acceptability thresholds for dental colour, ΔE00. */
export const PERCEPTIBILITY_DE00 = 0.8;
export const ACCEPTABILITY_DE00 = 1.8;

export const PHOTO_NOTE = "Photo estimate: confirm with a shade guide (cross-polarised photo + grey card if possible).";

export interface ShadeGap {
  /** match minus reference */
  dL: number;
  dC: number;
  /** CIE ΔH* (signed by the hue-angle direction) */
  dH: number;
  dE00: number;
  dominant: "value" | "chroma" | "hue";
  /** "below" perceptibility, "perceptible" (under acceptability), "beyond" acceptability */
  band: "below" | "perceptible" | "beyond";
  text: string;
}

/** How the tooth to match differs from the reference (e.g. lower natural teeth vs upper ceramic). Neutral wording. */
export function shadeGap(ref: Lab, match: Lab): ShadeGap {
  const parts = deltaE00Parts(ref, match);
  const C1 = Math.hypot(ref[1], ref[2]);
  const C2 = Math.hypot(match[1], match[2]);
  const dC = C2 - C1;
  const dE = deltaE76(ref, match);
  const dL = match[0] - ref[0];
  const dH2 = Math.max(0, dE * dE - dL * dL - dC * dC);
  const cross = ref[1] * match[2] - ref[2] * match[1];
  const dH = Math.sqrt(dH2) * (cross < 0 ? -1 : 1);
  const w = { value: Math.abs(parts.l), chroma: Math.abs(parts.c), hue: Math.abs(parts.h) };
  const dominant = (Object.keys(w) as (keyof typeof w)[]).reduce((a, b) => (w[b] > w[a] ? b : a), "value");
  const band = parts.dE < PERCEPTIBILITY_DE00 ? "below" : parts.dE < ACCEPTABILITY_DE00 ? "perceptible" : "beyond";
  const lead =
    band === "below"
      ? `Below the perceptibility threshold (ΔE00 ${PERCEPTIBILITY_DE00}): the two areas look alike in this photo.`
      : band === "perceptible"
        ? `Perceptible, within the acceptability threshold (ΔE00 ${ACCEPTABILITY_DE00}).`
        : `Beyond the acceptability threshold (ΔE00 ${ACCEPTABILITY_DE00}).`;
  let why = "";
  if (band !== "below") {
    if (dominant === "chroma")
      why =
        dC > 0
          ? "Mostly yellowness/chroma: whitening usually reduces this; consider whitening first and re-taking the shade after 2 weeks."
          : "Mostly chroma: the tooth to match is less saturated than the reference, so whitening would not close this gap; choose the restoration shade to the reference.";
    else if (dominant === "value")
      why =
        dL > 0
          ? "Mostly value: the tooth to match is lighter than the reference."
          : "Mostly value: the tooth to match is darker than the reference; value differences are the most visible.";
    else why = "Mostly hue: usually handled in the restoration shade and characterisation rather than by whitening.";
  }
  return { dL, dC, dH, dE00: parts.dE, dominant, band, text: [lead, why, PHOTO_NOTE].filter(Boolean).join(" ") };
}

/**
 * Approximate CIELAB of the app's shade tabs (B1…A3.5 rounded from published spectrophotometric ranges for classical
 * tabs; BL1–BL4 extrapolated lighter and less chromatic). Not a measurement of any specific guide: always labelled
 * "approximate" (no single PMID).
 */
export const TAB_LAB: Record<string, Lab> = {
  BL1: [86, -1.2, 5.5],
  BL2: [84.5, -1.0, 7.5],
  BL3: [83, -0.8, 9.5],
  BL4: [81.5, -0.6, 11.5],
  B1: [80.5, -0.6, 11.3],
  A1: [79, 0, 14.8],
  B2: [78.6, -0.3, 19.6],
  A2: [76, 1, 19],
  A3: [74.5, 1.6, 22],
  B3: [74.8, 0.5, 25.3],
  "A3.5": [71.9, 2.4, 24.8],
};

export function nearestTab(lab: Lab): { tab: string; dE00: number; label: string } {
  let tab = "A1";
  let best = Infinity;
  for (const [k, v] of Object.entries(TAB_LAB)) {
    const d = deltaE00(lab, v);
    if (d < best) {
      best = d;
      tab = k;
    }
  }
  return { tab, dE00: best, label: `${tab} (approximate)` };
}

/** Mean Lab of the samples with this role (null when none). */
export function meanLab(samples: { role: string; lab: Lab }[], role: string): Lab | null {
  // L* = 0 marks a pin with no usable tooth colour under it (only shine or shadow)
  const s = samples.filter((x) => x.role === role && x.lab[0] > 0);
  if (!s.length) return null;
  return [0, 1, 2].map((i) => s.reduce((t, x) => t + x.lab[i], 0) / s.length) as Lab;
}

export function planShadeGap(plan: CasePlan): ShadeGap | null {
  const r = meanLab(plan.shade.samples, "reference");
  const m = meanLab(plan.shade.samples, "match");
  return r && m ? shadeGap(r, m) : null;
}

// ---------- materials ----------

export type MaterialCategory = "none" | "whitening" | "composite" | "ceramic-veneer" | "crown" | "other";
export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  pros?: string;
  cons?: string;
  /** added by the clinic on this phone */
  clinic?: boolean;
}

/** Default library. Neutral, generic wording; no brands, no claims. */
export const MATERIALS: Material[] = [
  { id: "none", name: "No treatment", category: "none", pros: "Nothing is done to this tooth.", cons: "Existing colour and shape stay as they are." },
  {
    id: "bleaching",
    name: "Bleaching only",
    category: "whitening",
    pros: "No tooth structure removed; lightens natural teeth.",
    cons: "Does not change crowns, veneers or fillings; the effect varies and can fade; sensitivity is common during treatment.",
  },
  {
    id: "direct-composite",
    name: "Direct composite",
    category: "composite",
    pros: "Usually additive with little or no preparation; repairable; can be done chairside.",
    cons: "Stains and loses gloss over time; needs polishing and maintenance; thin edges can chip.",
  },
  {
    id: "indirect-composite",
    name: "Indirect composite",
    category: "composite",
    pros: "Made on a model; repairable in the mouth; gentle on opposing teeth.",
    cons: "Less colour and gloss stable than ceramic; lab stage needed.",
  },
  {
    id: "feldspathic-veneer",
    name: "Feldspathic veneer",
    category: "ceramic-veneer",
    pros: "Very thin layers possible; high translucency.",
    cons: "Fragile until bonded; relies on enamel bonding; technique and lab sensitive.",
  },
  {
    id: "ld-veneer",
    name: "Lithium disilicate veneer",
    category: "ceramic-veneer",
    pros: "Stronger than feldspathic; pressed or milled; colour stable.",
    cons: "Masking a dark tooth needs more thickness; bonding protocol sensitive.",
  },
  {
    id: "ld-crown",
    name: "Lithium disilicate crown",
    category: "crown",
    pros: "Full coverage with good optics; can be bonded.",
    cons: "Removes more tooth structure than a veneer.",
  },
  {
    id: "zirconia-crown",
    name: "Zirconia crown",
    category: "crown",
    pros: "High strength; an option where load is high.",
    cons: "More opaque; removes more tooth structure; harder to adjust or repair.",
  },
  { id: "other", name: "Other (see notes)", category: "other", pros: "Describe the material in the tooth notes.", cons: "" },
];

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  none: "No treatment",
  whitening: "Whitening",
  composite: "Composite",
  "ceramic-veneer": "Ceramic veneer",
  crown: "Crown",
  other: "Other",
};

export const CLINIC_MATERIALS_KEY = "smile-studio.materials.v1";
type KV = Pick<Storage, "getItem" | "setItem">;
const store = (): KV | null => (typeof localStorage === "undefined" ? null : localStorage);

/** The clinic's own materials (this phone only). Ids are "clinic:<name>" so a deleted entry still reads sensibly. */
export function loadClinicMaterials(kv: KV | null = store()): Material[] {
  try {
    const raw = kv?.getItem(CLINIC_MATERIALS_KEY);
    const list = raw ? (JSON.parse(raw) as Material[]) : [];
    return Array.isArray(list) ? list.filter((m) => m && typeof m.name === "string" && m.id).map((m) => ({ ...m, clinic: true })) : [];
  } catch {
    return [];
  }
}
export function saveClinicMaterials(list: Material[], kv: KV | null = store()) {
  kv?.setItem(CLINIC_MATERIALS_KEY, JSON.stringify(list.map(({ id, name, category, pros, cons }) => ({ id, name, category, pros, cons }))));
}
export function addClinicMaterial(list: Material[], name: string, category: MaterialCategory): Material[] {
  const n = name.trim().slice(0, 60);
  if (!n) return list;
  const id = `clinic:${n}`;
  if (list.some((m) => m.id === id) || MATERIALS.some((m) => m.name.toLowerCase() === n.toLowerCase())) return list;
  return [...list, { id, name: n, category, clinic: true }];
}
export const removeClinicMaterial = (list: Material[], id: string) => list.filter((m) => m.id !== id);
export const materialLibrary = (clinic: Material[] = []) => [...MATERIALS, ...clinic];

export function materialOf(id: string, lib: Material[] = MATERIALS): Material | null {
  if (!id) return null;
  const m = lib.find((x) => x.id === id);
  if (m) return m;
  // a clinic material deleted after it was used: keep its name readable
  return { id, name: id.startsWith("clinic:") ? id.slice(7) : id, category: "other" };
}

// ---------- teeth (FDI) ----------

export type ToothType = "incisor" | "canine" | "premolar" | "molar";
export const quadrant = (fdi: number) => Math.floor(fdi / 10);
export const position = (fdi: number) => fdi % 10;
export const isValidFdi = (fdi: number) => quadrant(fdi) >= 1 && quadrant(fdi) <= 4 && position(fdi) >= 1 && position(fdi) <= 8;
export const archOfFdi = (fdi: number): Arch => (quadrant(fdi) <= 2 ? "upper" : "lower");
export function toothType(fdi: number): ToothType {
  const n = position(fdi);
  return n <= 2 ? "incisor" : n === 3 ? "canine" : n <= 5 ? "premolar" : "molar";
}
export const contralateral = (fdi: number) => ({ 1: 2, 2: 1, 3: 4, 4: 3 })[quadrant(fdi)]! * 10 + position(fdi);
export function neighbours(fdi: number): number[] {
  const q = quadrant(fdi);
  const n = position(fdi);
  const out: number[] = [];
  if (n < 8) out.push(q * 10 + n + 1);
  out.push(n > 1 ? q * 10 + n - 1 : contralateral(fdi));
  return out;
}
/** Chart order, patient's right on the viewer's left. */
export const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const LOWER_INCISORS = [31, 32, 41, 42];
export const LOWER_PREMOLARS = [34, 35, 44, 45];
export const anteriorSix = (arch: Arch) => (arch === "lower" ? [43, 42, 41, 31, 32, 33] : [13, 12, 11, 21, 22, 23]);

const POS_NAME = ["", "central incisor", "lateral incisor", "canine", "first premolar", "second premolar", "first molar", "second molar", "third molar"];
export function toothName(fdi: number) {
  const q = quadrant(fdi);
  return `${q <= 2 ? "upper" : "lower"} ${q === 1 || q === 4 ? "right" : "left"} ${POS_NAME[position(fdi)]}`;
}

/** Coverage options that make sense for the tooth type. */
export function coverageOptions(fdi: number): Coverage[] {
  const t = toothType(fdi);
  if (t === "incisor" || t === "canine") return ["facial", "incisal-butt", "incisal-overlap"];
  if (t === "premolar") return ["facial", "cusp-short", "cusp-full", "onlay"];
  return ["cusp-full", "onlay", "facial"];
}
export function coverageLabel(c: Coverage, arch: Arch = "upper") {
  const side = arch === "lower" ? "lingual" : "palatal";
  return {
    facial: "Facial only",
    "incisal-butt": "Incisal butt",
    "incisal-overlap": `Incisal overlap (${side} wrap)`,
    "cusp-short": "Short of the cusp",
    "cusp-full": "Full cusp coverage",
    onlay: "Onlay / overlay",
  }[c];
}
export const PREP_LABEL: Record<PrepLevel, string> = {
  none: "No prep",
  additive: "Additive",
  minimal: "Minimal",
  conventional: "Conventional",
  crown: "Crown prep",
};
export const MARGIN_LABEL: Record<Margin, string> = {
  supragingival: "Supragingival",
  equigingival: "Equigingival",
  subgingival: "Subgingival",
  "on-root": "On root",
};
export const VISIBLE_LABEL: Record<Visibility, string> = { smile: "In smile", speech: "In speech", no: "Not visible", unknown: "Not recorded" };

export function blankTooth(fdi: number): ToothPlan {
  return {
    fdi,
    include: false,
    visible: "unknown",
    material: "",
    prep: "none",
    coverage: coverageOptions(fdi)[0],
    margin: "supragingival",
  };
}

export const getTooth = (plan: CasePlan, fdi: number): ToothPlan => plan.teeth.find((t) => t.fdi === fdi) ?? blankTooth(fdi);

/** Returns a new plan with the tooth record patched (created when missing). Coverage is kept valid for the tooth type. */
export function setTooth(plan: CasePlan, fdi: number, patch: Partial<ToothPlan>): CasePlan {
  const cur = getTooth(plan, fdi);
  const next = { ...cur, ...patch, fdi };
  if (!coverageOptions(fdi).includes(next.coverage)) next.coverage = coverageOptions(fdi)[0];
  const exists = plan.teeth.some((t) => t.fdi === fdi);
  return { ...plan, teeth: exists ? plan.teeth.map((t) => (t.fdi === fdi ? next : t)) : [...plan.teeth, next] };
}

export const CHECKLIST: { id: string; label: string }[] = [
  { id: "perio", label: "Periodontal health assessed and stable" },
  { id: "hygiene", label: "Oral hygiene adequate" },
  { id: "whitening", label: "Whitening done, 2-week wait before the shade" },
  { id: "shadeGuide", label: "Shade re-taken with a shade guide" },
  { id: "waxup", label: "Wax-up done" },
  { id: "mockup", label: "Mock-up tried and approved by the patient" },
  { id: "function", label: "Phonetics and occlusion checked on the mock-up" },
  { id: "consent", label: "Consent signed" },
  { id: "nightGuard", label: "Night guard planned (bruxism)" },
];

/** A fresh plan: the design arch's anterior six are suggested (included), everything else is for the dentist to record. */
export function defaultPlan(arch: Arch): CasePlan {
  return {
    teeth: anteriorSix(arch).map((fdi) => ({ ...blankTooth(fdi), include: true })),
    shade: { samples: [] },
    flags: {},
    checklist: {},
  };
}

// ---------- warnings ----------

export type WarnLevel = "info" | "caution" | "stop";
export interface PlanWarning {
  /** set when the warning concerns exactly one tooth */
  fdi?: number;
  /** all teeth the warning concerns (merged when several teeth share the same text) */
  teeth?: number[];
  level: WarnLevel;
  text: string;
}

export const W = {
  thinEnamel:
    "Lower incisor: thin labial enamel (about 0.3 mm cervical, 0.5 mm middle, 0.75 mm incisal; Pei 2025, PMID 40300924). Additive or minimal approaches are usually explored first; clinician to decide.",
  crownLowerIncisor:
    "Crown on a lower incisor: crown preps remove about 63–72 % of the crown (Edelhoff 2002, PMID 12070513); lower incisors have small roots and pulps.",
  onRoot:
    "Margin on root: bonding to root dentin is less reliable than to enamel. Consider leaving the exposed root, or a periodontal root-coverage referral.",
  deepBite:
    "Deep bite: lengthening or overlapping the lower incisors increases the overbite and loads the palatal of the upper restorations. Check contacts with articulating paper on the mock-up.",
  premolarFacial:
    "Lower buccal cusps are supporting cusps: end the veneer short of the contact, or plan full cusp coverage designed to the occlusion.",
  asymmetric: "Its twin on the other side is in the plan but this visible tooth is not: a colour/shape difference between sides may show.",
  neighbour: "Visible next to a planned tooth but not in the plan: the colour/shape transition will show.",
  mixedMaterials: "Composite next to ceramic: colour and gloss age differently; plan polishing/maintenance and review the shade over time.",
  whitening:
    "Shade gap is mostly chroma (the tooth to match is more yellow/saturated) and whitening is not marked done: consider whitening first, then re-take the shade after 2 weeks.",
  bruxism: "Bruxism recorded and no night guard planned: plan a night guard and design the occlusion on the mock-up.",
  perio: "Periodontal status not recorded as stable: complete the periodontal assessment and stabilisation before restorations.",
  mockup:
    "Prep beyond additive without an approved mock-up: plan the reduction through an approved mock-up / silicone index, not the existing surface (Magne & Belser, PMID 15259539).",
  noMaterial: "In the plan but no material chosen yet.",
  visibilityUnknown: "Next to a planned tooth, visibility not recorded: mark whether it shows in smile or speech so the transition can be checked.",
};

const visible = (t: ToothPlan) => t.visible === "smile" || t.visible === "speech";
const LENGTHEN = /lengthen|longer|add(ing)? length|incisal (add|build)/i;

/** An included tooth that gets a restoration (material or preparation recorded). */
export function isRestoration(t: ToothPlan, lib: Material[] = MATERIALS) {
  if (!t.include) return false;
  const cat = materialOf(t.material, lib)?.category;
  return (!!cat && cat !== "none" && cat !== "whitening") || t.prep !== "none";
}

export function planWarnings(plan: CasePlan, lib: Material[] = MATERIALS): PlanWarning[] {
  const raw: { fdi: number[]; level: WarnLevel; text: string }[] = [];
  const add = (fdi: number | number[], level: WarnLevel, text: string) => raw.push({ fdi: Array.isArray(fdi) ? fdi : [fdi], level, text });
  const tooth = (fdi: number) => getTooth(plan, fdi);
  const inc = plan.teeth.filter((t) => t.include && isValidFdi(t.fdi));
  const resto = inc.filter((t) => isRestoration(t, lib));
  const cat = (t: ToothPlan) => materialOf(t.material, lib)?.category;

  for (const t of inc) {
    const li = LOWER_INCISORS.includes(t.fdi);
    if (li && (t.prep === "conventional" || t.prep === "crown" || (t.prepMm?.facial ?? 0) > 0.5)) add(t.fdi, "caution", W.thinEnamel);
    if (li && (t.prep === "crown" || cat(t) === "crown")) add(t.fdi, "caution", W.crownLowerIncisor);
    if (t.margin === "on-root") add(t.fdi, "caution", W.onRoot);
    if (plan.flags.deepBite && li && (t.coverage === "incisal-overlap" || LENGTHEN.test(t.notes ?? ""))) add(t.fdi, "caution", W.deepBite);
    if (LOWER_PREMOLARS.includes(t.fdi) && t.coverage === "facial") add(t.fdi, "info", W.premolarFacial);
    if (!t.material) add(t.fdi, "info", W.noMaterial);
  }

  // transitions: visible teeth left out next to (or opposite) planned teeth
  const incSet = new Set(inc.map((t) => t.fdi));
  const asym = new Set<number>();
  for (const t of inc) {
    const twin = tooth(contralateral(t.fdi));
    if (!incSet.has(twin.fdi) && visible(twin)) asym.add(twin.fdi);
  }
  asym.forEach((fdi) => add(fdi, "caution", W.asymmetric));
  const nb = new Set<number>();
  const unknown = new Set<number>();
  for (const t of inc)
    for (const n of neighbours(t.fdi)) {
      if (incSet.has(n)) continue;
      const o = tooth(n);
      if (visible(o) && !asym.has(n)) nb.add(n);
      else if (o.visible === "unknown" && position(n) <= 5) unknown.add(n);
    }
  nb.forEach((fdi) => add(fdi, "caution", W.neighbour));
  if (unknown.size) add([...unknown], "info", W.visibilityUnknown);

  // composite next to ceramic
  const ceramic = (c?: MaterialCategory) => c === "ceramic-veneer" || c === "crown";
  const mixed = new Set<number>();
  for (const t of inc)
    for (const n of neighbours(t.fdi)) {
      if (!incSet.has(n) || n < t.fdi) continue;
      const a = cat(t);
      const b = cat(tooth(n));
      if ((a === "composite" && ceramic(b)) || (b === "composite" && ceramic(a))) {
        mixed.add(t.fdi);
        mixed.add(n);
      }
    }
  if (mixed.size) add([...mixed], "info", W.mixedMaterials);

  const gap = planShadeGap(plan);
  if (resto.length && gap && gap.band !== "below" && gap.dominant === "chroma" && gap.dC > 0 && !plan.shade.whiteningDone)
    add([], "info", W.whitening);
  if (plan.flags.bruxism && !plan.checklist.nightGuard) add([], "caution", W.bruxism);
  if (resto.length && plan.flags.perioStable !== true) add([], "stop", W.perio);
  const deep = inc.filter((t) => t.prep !== "none" && t.prep !== "additive").map((t) => t.fdi);
  if (deep.length && !plan.checklist.mockup) add(deep, "caution", W.mockup);

  // merge the same text across teeth, order stop > caution > info
  const merged = new Map<string, { teeth: number[]; level: WarnLevel; text: string }>();
  for (const r of raw) {
    const m = merged.get(r.text);
    if (m) r.fdi.forEach((x) => !m.teeth.includes(x) && m.teeth.push(x));
    else merged.set(r.text, { teeth: [...r.fdi], level: r.level, text: r.text });
  }
  const rank = { stop: 0, caution: 1, info: 2 };
  return [...merged.values()]
    .sort((a, b) => rank[a.level] - rank[b.level])
    .map((m) => {
      const teeth = sortChart(m.teeth);
      return { level: m.level, text: m.text, ...(teeth.length ? { teeth } : {}), ...(teeth.length === 1 ? { fdi: teeth[0] } : {}) };
    });
}

// ---------- summary ----------

const CHART = [...UPPER_ROW, ...LOWER_ROW];
export const sortChart = (teeth: number[]) => [...teeth].sort((a, b) => CHART.indexOf(a) - CHART.indexOf(b));

/** "33–43, 6 teeth": contiguous runs in chart order, each written low–high. */
export function teethText(teeth: number[]): string {
  const valid = teeth.filter(isValidFdi);
  if (!valid.length) return "no teeth";
  const runs: number[][] = [];
  for (const row of [UPPER_ROW, LOWER_ROW]) {
    let run: number[] = [];
    for (const fdi of row) {
      if (valid.includes(fdi)) run.push(fdi);
      else if (run.length) {
        runs.push(run);
        run = [];
      }
    }
    if (run.length) runs.push(run);
  }
  const txt = runs.map((r) => {
    if (r.length === 1) return String(r[0]);
    const a = Math.min(r[0], r[r.length - 1]);
    const b = Math.max(r[0], r[r.length - 1]);
    return `${a}–${b}`;
  });
  return `${txt.join(", ")}, ${valid.length} ${valid.length === 1 ? "tooth" : "teeth"}`;
}

export interface PlanSummary {
  teeth: number[];
  teethText: string;
  byMaterial: [string, number][];
  byPrep: [PrepLevel, number][];
  text: string;
}

export function planSummary(plan: CasePlan, lib: Material[] = MATERIALS): PlanSummary {
  const inc = sortChart(plan.teeth.filter((t) => t.include && isValidFdi(t.fdi)).map((t) => t.fdi));
  const count = <K extends string>(keys: K[]) => {
    const m = new Map<K, number>();
    keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const teeth = inc.map((fdi) => getTooth(plan, fdi));
  const byMaterial = count(teeth.map((t) => materialOf(t.material, lib)?.name ?? "material not chosen"));
  const byPrep = count(teeth.map((t) => t.prep));
  const tt = teethText(inc);
  const text = inc.length
    ? [tt, byMaterial.map(([k, n]) => `${n} × ${k}`).join(", "), byPrep.map(([k, n]) => `${n} × ${PREP_LABEL[k].toLowerCase()}`).join(", ")].join(" · ")
    : "No teeth in the plan yet.";
  return { teeth: inc, teethText: tt, byMaterial, byPrep, text };
}
