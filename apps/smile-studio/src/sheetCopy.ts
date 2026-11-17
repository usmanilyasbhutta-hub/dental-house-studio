// Fixed wording for the printable sheets (docs/round3-clinical.md B, C, D). Pure strings: unit-tested for banned words.

/** Patient illustration sheet, spec C (verbatim). */
export const PATIENT = {
  title: "Your smile design: a simulation",
  /** the one Instrument Serif italic accent word inside the title */
  accent: "simulation",
  subtitle: "A drawing to help us talk about options. It is not a promised result.",
  today: "Today (your photo)",
  design: "Design idea (simulated)",
  diff: "Where the design adds to a tooth (shaded) and where it is smaller than the tooth (outlined)",
  footer:
    "Simulation for discussion. Real results depend on your teeth, gums, bite and the treatment chosen, and can differ. Your dentist will explain the options, including no treatment.",
};

/** Words that must never appear on the patient sheet (spec C) or in UI copy. */
export const BANNED_PATIENT = ["guaranteed", "painless", "permanent", "perfect", "best", "no drilling", "no-prep", "100%", "miracle", "cure", "cheapest"];

export function bannedIn(text: string): string[] {
  const t = text.toLowerCase();
  return BANNED_PATIENT.filter((w) => new RegExp(`(^|[^a-z])${w.replace(/[-%]/g, "\\$&")}([^a-z]|$)`).test(t));
}

/** Clinician prep sheet, spec B (reference text printed as text only, never computed per tooth). */
export const CLINICIAN = {
  title: "Preparation",
  accent: "guide",
  kicker: "Outline comparison from a 2D frontal photo",
  references: [
    "Veneer preps remove ~3–30 % of the crown; crown preps 63–72 %, 0.8–1.4 mm axial (Edelhoff 2002, PMID 12070513).",
    "Veneers bonded to enamel / minimal dentin exposure survive well; severe dentin exposure fails more (PMID 25279393); dentin share and thin veneers raise fracture risk (PMID 31900673).",
    "Prep depth should be guided by an additive mock-up, not the existing surface (Magne & Belser, PMID 15259539).",
    "Typical bands (reference only, not assigned from the photo): minimal ≤0.3–0.5 mm; conventional veneer 0.5–0.7 mm facial, 1.0–1.5 mm incisal; crown-level reduction.",
  ],
  enamelTitle: "Labial enamel, mm · typical values, not this patient",
  enamelSource:
    "Pei 2025 (PMID 40300924); Pahlevan 2014 (PMID 25584054). Middle third interpolated; canine and premolar reuse upper lateral values (no data, conservative).",
  lowerIncisorNote: "Lower incisors: thin enamel; additive or minimal approaches are usually explored first; clinician to decide.",
  labNote: "Take the lower shade separately (cervical/body/incisal), at the same session and light as the upper.",
  shadeNote: "Screen shade is a preview only; match in the chair with a shade guide.",
  tableNote:
    "Δ: + add / − reduce. |Δ| under 0.3 mm shown as ≈ 0; rounded to 0.1 mm; ±0.5 mm (photo). Outline only: no facial depth, reduction depth, prep type or material can be read from a frontal photo.",
  legendAdd: "Added: design outside the tooth",
  legendReduce: "Reduced: tooth outside the design",
};

export const ENAMEL_ROWS = [
  ["upperCentral", "Upper central"],
  ["upperLateral", "Upper lateral"],
  ["lowerIncisor", "Lower incisor"],
  ["canine", "Canine / premolar"],
] as const;

/** mm value for the prep table: "≈ 0" under 0.3 mm, else signed to 0.1 mm. undefined = not calibrated. */
export function fmtDelta(px: number, pxPerMm?: number): string {
  if (!pxPerMm) return "—";
  const v = px / pxPerMm;
  if (Math.abs(v) < 0.3) return "≈ 0";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`;
}

/** The "same patient" key: the case label without the suffixes Home adds to copies. */
export function rootLabel(label: string) {
  return label.replace(/( · (variant|lower))+$/i, "").trim();
}

/** A case code that looks like a clinic file ID (e.g. DH-0147) must never be printed. */
export function caseCodeProblem(label: string): string | null {
  if (/\bDH[-\s]?\d{2,}/i.test(label)) return "This looks like a file ID. Use initials or a short code instead.";
  if (!label.trim()) return "No case code set.";
  return null;
}
