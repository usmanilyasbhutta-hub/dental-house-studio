// Round-3 contract between the photo/prep engine (graphics owner) and the UI (UX owner).
// The engine replaces these stubs with real implementations in src/teethMask.ts, src/photoTeeth.ts and src/prep.ts;
// UI code imports ONLY from this file so both sides can be built in parallel.

/** Single-channel mask: 0 = not tooth, 255 = tooth, row-major, w × h (may be smaller than the photo). */
export interface Mask {
  w: number;
  h: number;
  data: Uint8Array;
}

export type PrepCategory = "additive" | "minimal" | "reduction" | "unchanged" | "unknown";

/** Per-tooth comparison of the EXISTING outline (photo) with the PLANNED outline (design), frontal 2D only. */
export interface ToothPrep {
  /** 0 central … 4 second premolar */
  kind: number;
  side: -1 | 1;
  /** e.g. "UR1" / "LL3" (FDI-like quadrant label with arch letter) */
  label: string;
  /** incisal length change, image px: positive = add, negative = reduce */
  lengthPx: number;
  /** mesiodistal width change, image px: positive = add, negative = reduce */
  widthPx: number;
  /** % of the planned outline area that is added material (outside the existing tooth) */
  addPct: number;
  /** % of the existing tooth area (inside this tooth's box) that lies outside the plan (needs reduction) */
  reducePct: number;
  category: PrepCategory;
}

export interface PrepResult {
  /** masks at `w × h` (same as the existing-teeth mask): 255 where material is added / reduced */
  add: Mask;
  reduce: Mask;
  teeth: ToothPrep[];
}
