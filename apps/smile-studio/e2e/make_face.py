#!/usr/bin/env python3
"""Draws a SYNTHETIC test face (cartoon shapes only, never a patient photo) for the e2e suite.
Usage: python3 e2e/make_face.py OUT.jpg [W H]"""
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1200
H = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
im = Image.new("RGB", (W, H), (70, 84, 96))
d = ImageDraw.Draw(im)
X = lambda f: int(W * f)
Y = lambda f: int(H * f)
d.ellipse([X(0.18), Y(0.12), X(0.82), Y(0.92)], fill=(214, 170, 140))          # head
d.ellipse([X(0.15), Y(0.08), X(0.85), Y(0.30)], fill=(40, 30, 25))            # hair
for cx in (0.38, 0.62):                                                         # eyes + pupils
    d.ellipse([X(cx - 0.07), Y(0.33), X(cx + 0.07), Y(0.39)], fill=(245, 245, 240))
    d.ellipse([X(cx - 0.022), Y(0.345), X(cx + 0.022), Y(0.375)], fill=(30, 20, 15))
d.polygon([(X(0.5), Y(0.42)), (X(0.46), Y(0.58)), (X(0.54), Y(0.58))], fill=(190, 145, 118))  # nose
d.ellipse([X(0.33), Y(0.66), X(0.67), Y(0.80)], fill=(170, 70, 75))            # lips
d.ellipse([X(0.36), Y(0.685), X(0.64), Y(0.775)], fill=(45, 15, 18))           # mouth opening
d.rectangle([X(0.38), Y(0.69), X(0.62), Y(0.725)], fill=(225, 215, 190))       # existing teeth
d.rectangle([X(0.40), Y(0.738), X(0.60), Y(0.762)], fill=(214, 196, 150))       # lower teeth (a little more yellow)
for i in range(1, 6):
    x = X(0.38 + 0.04 * i)
    d.line([(x, Y(0.69)), (x, Y(0.725))], fill=(150, 140, 120), width=3)
im.save(out, "JPEG", quality=92)
print(out, W, H)
