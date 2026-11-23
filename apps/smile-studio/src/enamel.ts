// Typical labial enamel thickness, shared by the photo prep guide (prep.ts) and the 3D reduction estimate (reduction.ts).
/**
 * Typical labial enamel mm (cervical, middle, incisal). Pei 2025 PMID 40300924; Pahlevan 2014 PMID 25584054 (PMC4283744).
 * Middle interpolated; canine/premolar reuse upper lateral (no data, conservative). Show as "typical values, not this patient".
 */
export const ENAMEL_MM = {
  upperCentral: [0.35, 0.65, 0.95],
  upperLateral: [0.25, 0.6, 0.95],
  lowerIncisor: [0.3, 0.5, 0.75],
  canine: [0.25, 0.6, 0.95],
};
