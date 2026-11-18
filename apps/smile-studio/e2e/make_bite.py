#!/usr/bin/env python3
"""Draws a SYNTHETIC retracted-style bite (cartoon shapes only, never a patient photo) for tests and screenshots:
bright restored upper teeth overlapping the incisal third of narrower, yellower lower teeth (normal overbite), pink gums
with lower recession (exposed root band), a shadow under the upper incisal edge and dark retractor-like corners.
Usage: python3 e2e/make_bite.py OUT.jpg [W H]   Prints a JSON line with the ground truth (image px)."""
import json
import math
import sys
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1]
W = int(sys.argv[2]) if len(sys.argv) > 2 else 1200
H = int(sys.argv[3]) if len(sys.argv) > 3 else 800
S = W / 1200.0  # all geometry is designed at 1200 x 800
CX = 600 * S


def P(x, y):
    return (x * S, y * S)


im = Image.new("RGB", (W, H), (196, 150, 128))
d = ImageDraw.Draw(im)
# retractor corners (dark plastic shadow) and stretched lips
for poly in ([(0, 0), (330, 0), (0, 260)], [(1200, 0), (870, 0), (1200, 260)], [(0, 800), (330, 800), (0, 540)], [(1200, 800), (870, 800), (1200, 540)]):
    d.polygon([P(*p) for p in poly], fill=(34, 34, 38))
d.ellipse([P(70, 170), P(1130, 715)], fill=(176, 78, 84))  # lips, pulled wide
d.ellipse([P(105, 200), P(1095, 685)], fill=(52, 20, 24))  # mouth (dark)

# gums: upper band (top) and lower band (bottom), with the lower margin set lower (recession)
d.ellipse([P(150, 205), P(1050, 420)], fill=(206, 116, 124))
d.ellipse([P(170, 500), P(1030, 676)], fill=(204, 112, 120))

# ---------- lower teeth (drawn first: the upper teeth overlap them) ----------
LCW = 80.0  # lower central perceived width (design px at 1200 wide)
LRAT = [1.0, 1.03, 0.8, 0.5, 0.3]
L_INC = 422.0  # lower incisal line (hidden behind the upper teeth: about the incisal third)
UPPER_EDGE = 480.0  # upper central incisal edge
L_GUM = 580.0  # lower gingival margin of the centrals (recession: long clinical crowns)
CAN_TIP_Y = 428.0  # lower canine cusp tips (just visible distal of the upper laterals)


def lower_tooth(x0, x1, top, bottom, cusp=False, col=(212, 192, 140)):
    """Rounded crown from incisal (top) to gum (bottom); canine: pointed cusp at the centre."""
    w = x1 - x0
    pts = []
    n = 16
    for i in range(n + 1):  # incisal edge left -> right
        t = i / n
        x = x0 + w * (0.08 + 0.84 * t)
        if cusp:
            y = top + abs(t - 0.5) * 2 * w * 0.28
        else:
            y = top + (abs(t - 0.5) * 2) ** 4 * 6
        pts.append((x, y))
    for i in range(n + 1):  # right side down to the cervix (narrow neck), gum arch, left side up
        t = i / n
        x = x1 - w * (0.08 + 0.12 * t * t)
        pts.append((x, top + (bottom - top) * (0.15 + 0.85 * t)))
    for i in range(n + 1):
        t = i / n
        x = x1 - w * 0.2 - (w * 0.6) * t
        pts.append((x, bottom + math.sin(math.pi * t) * 10))
    for i in range(n + 1):
        t = 1 - i / n
        x = x0 + w * (0.08 + 0.12 * t * t)
        pts.append((x, top + (bottom - top) * (0.15 + 0.85 * t)))
    d.polygon([P(*p) for p in pts], fill=col)
    # recession: an exposed, darker root band next to the gum
    rb = [(x, y) for (x, y) in pts if y > bottom - 26]
    if len(rb) > 2:
        d.polygon([P(*p) for p in rb], fill=(190, 160, 112))


lower_truth = {}
for side in (-1, 1):
    edge = 0.0
    for k in range(5):
        w = LCW * LRAT[k]
        a, b = edge, edge + w
        edge = b
        xa, xb = (CX / S + a, CX / S + b) if side == 1 else (CX / S - b, CX / S - a)
        if k == 2:
            top = CAN_TIP_Y
            lower_truth["canineR" if side == -1 else "canineL"] = [(xa + xb) / 2 * S, CAN_TIP_Y * S]
        else:
            top = L_INC + [0, 0, 0, 22, 34][k]
        bottom = L_GUM + [0, 0, -6, -18, -30][k]
        lower_tooth(xa, xb, top, bottom, cusp=(k == 2), col=(212, 192, 140) if k < 3 else (196, 176, 128))

# ---------- shadow under the upper incisal edge (on the lower teeth) ----------
def upper_edge(x):
    dx = abs(x - CX / S)
    return UPPER_EDGE - 0.0014 * min(dx, 260.0) ** 2 - 0.0004 * max(0.0, dx - 260.0) ** 2


shadow = [(x, upper_edge(x) + 5) for x in range(330, 871, 10)] + [(x, upper_edge(x) - 2) for x in range(870, 329, -10)]
d.polygon([P(*p) for p in shadow], fill=(70, 52, 46))

# ---------- upper teeth (bright ceramic) ----------
UCW = 130.0
URAT = [1.0, 0.66, 0.554, 0.42, 0.32]
U_GUM = 303.0
for side in (-1, 1):
    edge = 0.0
    for k in range(5):
        w = UCW * URAT[k]
        a, b = edge, edge + w
        edge = b
        xa, xb = (CX / S + a, CX / S + b) if side == 1 else (CX / S - b, CX / S - a)
        gum = U_GUM + [0, 16, 2, 14, 20][k]
        pts = []
        n = 16
        for i in range(n + 1):  # gum arch left -> right
            t = i / n
            pts.append((xa + w * (0.12 + 0.76 * t), gum - math.sin(math.pi * t) * 12))
        for i in range(n + 1):  # right side down to the incisal edge
            t = i / n
            x = xb - w * 0.04 * (1 - t)
            pts.append((x, gum + (upper_edge(x) - gum) * t))
        for i in range(n + 1):  # incisal edge right -> left (follows the smile arc, rounded corners)
            t = i / n
            x = xb - w * t
            r = (abs(t - 0.5) * 2) ** 6 * 8
            if k == 2:
                r = abs(t - 0.5) * 2 * w * 0.22
            pts.append((x, upper_edge(x) - r - (12 if k == 1 else 0)))
        for i in range(n + 1):
            t = 1 - i / n
            x = xa + w * 0.04 * (1 - t)
            pts.append((x, gum + (upper_edge(x) - gum) * t))
        col = (242, 240, 232) if k < 4 else (226, 222, 212)
        d.polygon([P(*p) for p in pts], fill=col)
        # incisal translucency (cool, slightly darker) and a contact line
        inc = [(x, y) for (x, y) in pts if y > upper_edge(x) - 22]
        if len(inc) > 2:
            d.polygon([P(*p) for p in inc], fill=(222, 226, 228))
        d.line([P(xb, gum + 6), P(xb, upper_edge(xb) - 4)], fill=(176, 170, 160), width=max(1, int(3 * S)))
        # specular glint
        d.ellipse([P((xa + xb) / 2 - 6, gum + 40), P((xa + xb) / 2 + 4, gum + 58)], fill=(255, 255, 255))

im = im.filter(ImageFilter.GaussianBlur(0.8 * S))
im.save(out, "JPEG", quality=92)
truth = {
    "w": W,
    "h": H,
    "lowerCanineR": lower_truth["canineR"],
    "lowerCanineL": lower_truth["canineL"],
    "lowerIncisalY": L_INC * S,
    "lowerGumY": L_GUM * S,
    "lowerCentralW": LCW * S,
    "upperEdgeY": UPPER_EDGE * S,
    "midX": CX,
    "gumPinPt": [CX + 40 * S, (L_GUM + 26) * S],
    "toothPinPt": [CX + 40 * S, 515 * S],
    "lips": [[CX + math.cos(a) * 470 * S, 440 * S + math.sin(a) * 205 * S] for a in [i / 16 * 2 * math.pi for i in range(16)]],
}
print(json.dumps(truth))
