"""Matched teeth-only crops of the real before/after photographs (owner request, 14 Nov 2026).

Both crops cover the same anterior region (canine to canine, a little gum) at the same scale: the boxes are sized so
the upper central incisor is the same width in both (before ~128 px, after ~135 px in their own files). No warping,
no retouching, no colour change; output is a plain resize of each box to the same frame size.
Usage: python3 crop_results.py <case_folder_in_public>   e.g. ../../public/cases/whitening-v9
"""
import sys
from pathlib import Path
from PIL import Image

case = Path(sys.argv[1])
OUT = (1520, 550)
# (left, top, right, bottom) in each file's own pixels; widths in ratio 128:135 so the incisors match.
BOXES = {"before": (575, 385, 1335, 660), "after": (310, 425, 1111, 715)}
for name, box in BOXES.items():
    im = Image.open(case / f"{name}.jpg").convert("RGB")
    im.crop(box).resize(OUT, Image.Resampling.LANCZOS).save(case / f"{name}_teeth.jpg", quality=95)
    print(name, box, "->", OUT)
