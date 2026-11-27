#!/usr/bin/env python3
"""Real clinic front for the Earth zoom (owner T31: "same as video but made by code"): one sharp 4K frame of the owner's
drive-by (raw.mov at 51.6 s), straightened with a homography on the right glass bay (a real rectangle), cropped to the
building. No stitching (seams doubled the sign text), no retouching. Output: public/footage/arrival/facade-rect.jpg (gitignored).
Usage: python3 scripts/make_facade.py"""
import subprocess
from pathlib import Path
import cv2, numpy as np

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "public/footage/arrival"
frame = A / "facade-frame.jpg"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "51.6", "-i", str(A / "raw.mov"), "-frames:v", "1", "-q:v", "2", str(frame)], check=True)
im = cv2.imread(str(frame))  # 2160×3840 portrait
src = np.float32([[630, 95], [965, 92], [960, 848], [602, 856]]) * 2  # right glass bay corners (picked on a 1080-wide grid)
ppm, bw, bh, ox, oy = 100, 440, 960, 1200, 400                          # bay as 4.4 × 9.6 units, 100 px per unit
H = cv2.getPerspectiveTransform(src, np.float32([[ox, oy], [ox + bw, oy], [ox + bw, oy + bh], [ox, oy + bh]]))
rect = cv2.warpPerspective(im, H, (1800, 3000), flags=cv2.INTER_CUBIC)
cv2.imwrite(str(A / "facade-rect.jpg"), rect[270:2260, 640:1800], [cv2.IMWRITE_JPEG_QUALITY, 93])
print("wrote", A / "facade-rect.jpg")
