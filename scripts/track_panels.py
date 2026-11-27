#!/usr/bin/env python3
"""Track the two Dental House doctors' panels on the building's board through the owner's drive-by clip (arrival.mp4):
SIFT features of the straightened front (facade-rect.jpg) → homography per frame (the front is a plane) → panel corners in
pixels. Writes src/data/panels-track.json for the overlay. Panel corners on the front: /tmp panels_uv (UV of facade-rect)."""
import json, sys
from pathlib import Path
import cv2, numpy as np

ROOT = Path(__file__).resolve().parent.parent
UV = {"ayesha": [[0.0691, 0.5659], [0.1274, 0.5667], [0.132, 0.6066], [0.074, 0.6058]],
      "usman": [[0.1274, 0.5667], [0.1868, 0.5675], [0.1911, 0.6074], [0.132, 0.6066]]}
ref = cv2.imread(str(ROOT / "public/footage/arrival/facade-rect.jpg"))
gref = cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY)
sift = cv2.SIFT_create(6000)
kr, dr = sift.detectAndCompute(gref, None)
bf = cv2.BFMatcher()
cap = cv2.VideoCapture(str(ROOT / "public/footage/arrival/arrival.mp4"))
frames, i = [], 0
corners = {k: np.float32([[u * ref.shape[1], v * ref.shape[0]] for u, v in q]) for k, q in UV.items()}
while True:
    ok, fr = cap.read()
    if not ok: break
    g = cv2.cvtColor(fr, cv2.COLOR_BGR2GRAY)
    kf, df = sift.detectAndCompute(g, None)
    m = [a for a, b in bf.knnMatch(dr, df, k=2) if a.distance < 0.72 * b.distance]
    rec = {"frame": i, "ok": False}
    if len(m) > 25:
        H, inl = cv2.findHomography(np.float32([kr[a.queryIdx].pt for a in m]), np.float32([kf[a.trainIdx].pt for a in m]), cv2.RANSAC, 4.0)
        if H is not None and inl.sum() > 20:
            rec["ok"] = True; rec["inliers"] = int(inl.sum())
            for k, c in corners.items():
                rec[k] = [[round(float(x), 1), round(float(y), 1)] for x, y in cv2.perspectiveTransform(c[None], H)[0]]
    frames.append(rec); i += 1
(ROOT / "src/data/panels-track.json").write_text(json.dumps({"source": "scripts/track_panels.py", "width": int(cap.get(3)), "height": int(cap.get(4)), "frames": frames}))
print("frames", len(frames), "tracked", sum(f["ok"] for f in frames), "min inliers", min((f.get("inliers", 0) for f in frames)))
