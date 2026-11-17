# Round 3 clinical spec (smile-clinician agent, evidence from PubMed)

Values marked "no PMID" are textbook figures, conventions or geometric estimates; keep that note in code comments.

## A) Lower arch (frontal view)
```ts
/** Mean mesiodistal widths, mm (textbook norms, no PMID; South Asian samples slightly smaller, PMID 38298295). */
export const WIDTH_MM_LOWER = [5.3, 5.8, 6.8, 7.0, 7.2];
/** Perceived frontal width relative to the lower central (geometric estimate: real width × cos(arch angle) ≈ 0°, 20°, 50°, 68°, 78°; not literature). */
export const PROPORTIONS_LOWER = [1, 1.03, 0.8, 0.5, 0.3];
/** Lower canine-to-canine perceived span ≈ 0.79 × upper span (derived). */
export const LOWER_SPAN_FACTOR = 0.79;
/** Crown length relative to lower central (textbook 9.0/9.5/11/8.5/8.0 mm; no PMID). */
const LENGTH_LOWER = [1, 1.05, 1.15, 0.9, 0.85];
/** Mirrored frame: + = margin more coronal than the central's (convention; no PMID). */
const GINGIVA_LOWER = [0, 0, -0.03, 0.05, 0.08];
/** Distal zenith offset (fraction of width); lower incisors ≈ centred (convention; no PMID). */
const ZENITH_LOWER = [0, 0, 0.06, 0.03, 0.03];
/** Lower central W/L ≈ 5.3 / 8.5 mm. */
export const WL_LOWER = { default: 0.62, min: 0.5, max: 0.75 };
/** Frontal incisal curve (fraction of lower central length): canine ≈ level, premolar cusps progressively gingival. */
const INCISAL_DROP_LOWER = [0, 0, -0.02, 0.06, 0.12];
export const OVERBITE_MM_DEFAULT = 2.5; // normal 2–3 mm, textbook
```
- Lower arch is mirrored: crowns grow DOWN from the incisal edge toward the gum (gum at the bottom).
- No lateral step on lower incisors (ignore lateralStep). Keep the canine cusp; no extra premolar narrowing.
- With normal overbite the lower incisal edges sit behind the upper incisal third; upper drawn over lower.
- Display: upper display at rest falls with age, lower rises (Vig & Brundo, PMID 349139).

## B) Prep guide (2D frontal photo)
May show per tooth, in mm after calibration: incisal length change (+add / −reduce); mesial and distal width change (add/reduce, separately); outline overlap % = (planned ∩ existing) / existing. Suppress |Δ| < 0.3 mm as "≈ 0"; round to 0.1 mm; label "±0.5 mm (photo)".
Must NEVER show: facial depth, reduction depth, prep type or material (a frontal photo cannot measure labio-lingual).

Per-tooth wording:
- plan contains tooth: "Outline is additive in this view."
- tooth outside plan: "Outline reduction: tooth is outside the plan at the [incisal / mesial / distal]."
- both: "Mixed: additive and reduction areas."
- incisal reduction > 2.0 mm: "Large incisal change: check occlusion, length and pulp before planning."
- any mesial/distal reduction > 0.5 mm: "Proximal reduction: contact areas involved; consider alignment or IPR alternatives."

Reference text (printed as text only, never computed per tooth):
- Veneer preps remove ~3–30 % of the crown; crown preps 63–72 %, 0.8–1.4 mm axial (Edelhoff 2002, PMID 12070513).
- Veneers bonded to enamel / minimal dentin exposure survive well; severe dentin exposure fails more (PMID 25279393); dentin share and thin veneers raise fracture risk (PMID 31900673).
- Prep depth should be guided by an additive mock-up, not the existing surface (Magne & Belser, PMID 15259539).
- Typical bands (reference only, not assigned from the photo): minimal ≤0.3–0.5 mm; conventional veneer 0.5–0.7 mm facial, 1.0–1.5 mm incisal; crown-level reduction.

```ts
/** Typical labial enamel mm (cervical, middle, incisal). Pei 2025 PMID 40300924; Pahlevan 2014 PMID 25584054 (PMC4283744). Middle interpolated; canine/premolar reuse upper lateral (no data, conservative). */
export const ENAMEL_MM = {
  upperCentral: [0.35, 0.65, 0.95],
  upperLateral: [0.25, 0.6, 0.95],
  lowerIncisor: [0.3, 0.5, 0.75],
  canine:       [0.25, 0.6, 0.95],
};
```
Show as "typical values, not this patient". Lower incisor fixed note: "Thin enamel; additive or minimal approaches are usually explored first; clinician to decide."

MANDATORY disclaimer (screen + every export):
> Planning aid only. Measured from a 2D photo: shows outline length and width differences (±0.5 mm), not facial depth or the amount of tooth to remove. Preparation depth must be planned on a mock-up, wax-up or silicone index and decided by the treating dentist. Enamel values are population averages, not this patient's.

## C) Patient illustration sheet
- Title "Your smile design: a simulation"; subtitle "A drawing to help us talk about options. It is not a promised result."
- Captions: "Today (your photo)" · "Design idea (simulated)" · "Where the design adds to a tooth (shaded) and where it is smaller than the tooth (outlined)".
- Per-tooth line (no prep words): "Upper right central: design is longer by about 1 mm."
- Fixed footer: "Simulation for discussion. Real results depend on your teeth, gums, bite and the treatment chosen, and can differ. Your dentist will explain the options, including no treatment."
- Banned here: guaranteed, painless, permanent, perfect, best, "no drilling", "no-prep". No patient name or ID.

## D) Lower shade
Own lower shade, linked to upper by default; rendering offset ≈ L* −2, b* +1 and slightly more incisal translucency (clinical convention; Eiffler 2009 PMID 19688229 found upper/lower canine differences; thinner lower enamel PMID 40300924). Clinician sheet note: "Take the lower shade separately (cervical/body/incisal), at the same session and light as the upper."
