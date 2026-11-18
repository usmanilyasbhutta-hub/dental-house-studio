// The UI imports engine functions only from here (one place to swap implementations).
export { detectTeeth, maskFromToothMask, toothMaskFromMask, paintMask } from "./teethMask";
export { computePrep, prepWording, PREP_DISCLAIMER, ENAMEL_MM, drawPrepMap, hiddenLegend, HIDDEN_LENGTH_PCT, contours } from "./prep";
export type { Mask, ToothPrep, PrepResult, PrepCategory } from "./contracts";
