// Labs (Auto-detect beta): lazy entry point. The editor reaches this file only through a dynamic import() after the
// user taps an Auto-detect control with the Labs flag on, so none of it (nor MediaPipe) is in the main bundle.
// Everything here returns PROPOSALS; the editor applies them only after the user confirms (one undo step each).
import { installEgressGuard } from "./guard";
import { faceLandmarks, segmentAt } from "./mediapipe";
import { cropAroundTap, frontToothCentres, toothAreaScore, guidesFromLandmarks, lipOpening, lipsFromLandmarks, maskArea, mergeRegion, regionFromConfidence, type GuideProposal, type Lm } from "./map";
import type { Mask } from "../contracts";
import type { Design, Framing, Guides, Pt } from "../model";
import { centralWidth } from "../geometry";
import { maskSize, newMask } from "../teethMask";

installEgressGuard();

const faces = new WeakMap<object, Promise<Lm[] | null>>();

export interface FaceProposal {
  guides: GuideProposal | null;
  lips: Pt[] | null;
  /** inner-lip opening at the middle, image px (≈ 0: lips closed) */
  opening: number;
}

/** Landmarks once per photo (step 01 and 02 share them). null = no face found in the photo. */
export async function proposeFace(img: ImageBitmap, imgW: number, imgH: number, framing: Framing): Promise<FaceProposal | null> {
  let p = faces.get(img);
  if (!p) {
    p = faceLandmarks(img);
    faces.set(img, p);
    p.catch(() => faces.delete(img)); // a failed load may succeed on "Try again"
  }
  const lms = await p;
  if (!lms) return null;
  return { guides: guidesFromLandmarks(lms, imgW, imgH, framing), lips: lipsFromLandmarks(lms, imgW, imgH, 12), opening: lipOpening(lms, imgW, imgH) };
}

export interface ToothProposal {
  /** the existing-teeth mask with the proposal merged in (a NEW Mask; the current one is untouched) */
  merged: Mask;
  /** the proposed region alone (for the preview tint) */
  region: Mask;
  changed: number;
  /** the region covers more than ~45 % of the lip opening for one tap: probably more than one tooth */
  large: boolean;
}

const cropCanvas = (img: ImageBitmap, c: { x: number; y: number; w: number; h: number }) => {
  const k = Math.min(1, 768 / Math.max(c.w, c.h));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(c.w * k));
  cv.height = Math.max(1, Math.round(c.h * k));
  cv.getContext("2d")!.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, cv.width, cv.height);
  return cv;
};

/**
 * Tap-to-outline: segments the object under each tap (MagicTouch keypoint prompt) on a tight crop around the tap
 * (`toothW` = expected tooth width, image px), clips it to the lip contour and merges it into the existing-teeth mask
 * ("add") or removes it from the mask ("erase").
 */
export async function proposeTooth(img: ImageBitmap, imgW: number, imgH: number, lips: Pt[], base: Mask | null, taps: Pt[], mode: "add" | "erase", toothW: number): Promise<ToothProposal> {
  const sz = maskSize(imgW, imgH);
  const cur = base ?? newMask(sz.w, sz.h);
  const region = new Uint8Array(cur.w * cur.h);
  // expected area of one tooth on the mask raster (width × ~1.25 width)
  const px = (toothW * cur.w) / imgW;
  const expected = px * px * 1.25;
  for (const t of taps) {
    // two crop sizes: the segmenter's idea of "the object" depends on the framing; keep the candidate closest to one tooth
    let best: Uint8Array | null = null;
    let bestScore = Infinity;
    for (const k of [2, 3]) {
      const crop = cropAroundTap(t, toothW, imgW, imgH, k);
      const cv = cropCanvas(img, crop);
      const r = await segmentAt(cv, (t.x - crop.x) / crop.w, (t.y - crop.y) / crop.h);
      cv.width = 0;
      if (!r) continue;
      const part = regionFromConfidence(r.data, r.w, r.h, crop, imgW, imgH, cur.w, cur.h, t, lips);
      const score = toothAreaScore(maskArea({ data: part }), expected);
      if (score < bestScore) {
        bestScore = score;
        best = part;
      }
    }
    if (best) for (let k = 0; k < region.length; k++) if (best[k]) region[k] = 255;
  }
  const { mask, changed } = mergeRegion(cur, region, mode);
  // one tooth is at most ~1.2 × 1.6 tooth widths; much more than that for a single tap is probably several teeth
  const area = maskArea({ data: region });
  return { merged: mask, region: { w: cur.w, h: cur.h, data: region }, changed, large: taps.length === 1 && area > px * px * 2.2 };
}

/** "Outline all front teeth": taps the centres of the planned template's six front teeth, as one proposal. */
export function proposeFrontTeeth(img: ImageBitmap, imgW: number, imgH: number, lips: Pt[], base: Mask | null, d: Design, g: Guides): Promise<ToothProposal> {
  return proposeTooth(img, imgW, imgH, lips, base, frontToothCentres(d, g), "add", centralWidth(d));
}
