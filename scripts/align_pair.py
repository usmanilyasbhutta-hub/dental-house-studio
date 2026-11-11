"""Give a before/after pair the identical crop (owner request, Nov 2026: "crop them identical").

Matches tooth features (SIFT + RANSAC) and solves a similarity transform only: uniform scale, rotation, shift.
Nothing is stretched, warped or recoloured. The after photo is brought onto the before photo's scale, so neither is enlarged.
Both are then cut from the same box, in the video box ratio. Writes before.jpg, after.jpg and alignment.json next to the originals' folder.

  python3 scripts/align_pair.py public/cases/<id>/originals/pre.jpg public/cases/<id>/originals/post.jpg \
      --rotate-before 90 --teeth-before 580,380,1320,680 --teeth-after 440,560,1420,960 --center 975,515 --width 880
"""
import argparse, json
from pathlib import Path
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("before"); ap.add_argument("after")
ap.add_argument("--rotate-before", type=int, default=0, help="degrees counter-clockwise (90 for a sideways photo)")
ap.add_argument("--rotate-after", type=int, default=0)
ap.add_argument("--teeth-before", required=True, help="x0,y0,x1,y1 box around the teeth (after rotation)")
ap.add_argument("--teeth-after", required=True)
ap.add_argument("--center", required=True, help="crop centre in the before photo")
ap.add_argument("--width", type=int, default=880)
ap.add_argument("--ratio", type=float, default=850 / 456, help="video box ratio (promo before/after box)")
a = ap.parse_args()

rot = {0: None, 90: cv2.ROTATE_90_COUNTERCLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_CLOCKWISE}
def load(p, r):
    im = cv2.imread(p)
    return cv2.rotate(im, rot[r]) if rot[r] is not None else im
pre, post = load(a.before, a.rotate_before), load(a.after, a.rotate_after)

def feats(im, box):
    g = cv2.createCLAHE(3.0, (8, 8)).apply(cv2.cvtColor(im, cv2.COLOR_BGR2GRAY))
    m = np.zeros_like(g); x0, y0, x1, y1 = map(int, box.split(",")); m[y0:y1, x0:x1] = 255
    return cv2.SIFT_create(6000).detectAndCompute(g, m)
k1, d1 = feats(pre, a.teeth_before); k2, d2 = feats(post, a.teeth_after)
good = [m for m, n in cv2.BFMatcher().knnMatch(d1, d2, k=2) if m.distance < 0.78 * n.distance]
src = np.float32([k1[g.queryIdx].pt for g in good]); dst = np.float32([k2[g.trainIdx].pt for g in good])
M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=6, maxIters=20000, confidence=0.999)
if M is None or inl.sum() < 8:
    raise SystemExit(f"alignment failed ({0 if inl is None else int(inl.sum())} inliers): adjust the teeth boxes")
Minv = cv2.invertAffineTransform(M)
H, W = pre.shape[:2]
post_in_pre = cv2.warpAffine(post, Minv, (W, H), flags=cv2.INTER_AREA)
cover = cv2.warpAffine(np.full(post.shape[:2], 255, np.uint8), Minv, (W, H))
cw = a.width; ch = round(cw / a.ratio); cx, cy = map(int, a.center.split(","))
x0, y0 = cx - cw // 2, cy - ch // 2
if x0 < 0 or y0 < 0 or x0 + cw > W or y0 + ch > H or cover[y0:y0 + ch, x0:x0 + cw].min() < 255:
    raise SystemExit("crop leaves one of the photos: move --center or reduce --width")
out = Path(a.before).resolve().parent.parent
cv2.imwrite(str(out / "before.jpg"), pre[y0:y0 + ch, x0:x0 + cw], [cv2.IMWRITE_JPEG_QUALITY, 95])
cv2.imwrite(str(out / "after.jpg"), post_in_pre[y0:y0 + ch, x0:x0 + cw], [cv2.IMWRITE_JPEG_QUALITY, 95])
s = float(np.hypot(M[0, 0], M[1, 0])); ang = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
info = {"inliers": int(inl.sum()), "after_scale": round(1 / s, 4), "after_rotation_deg": round(-ang, 2),
        "rotate_before": a.rotate_before, "crop_in_before": [x0, y0, x0 + cw, y0 + ch],
        "method": "SIFT + RANSAC similarity (uniform scale, rotation, shift); no warping, colour untouched"}
(out / "alignment.json").write_text(json.dumps(info, indent=1))
print(json.dumps(info))
