"""Trace anatomy-map regions from the photo itself (no hand-drawn guessing).

Usage: python3 scripts/trace_regions.py <photo> '<json specs>' [--points 26] [--preview out.png]
spec: {"name": "11", "box": [x0, y0, x1, y1], "mode": "tooth" | "dark" | "gum", "cervical": 0.35}
  (upper teeth: crown margin at the top of the box; for lower teeth flip the photo or use a box whose top is the incisal side)
  tooth: enamel/dentin = bright, not red, slightly yellow (Lab a* < 13, L > 150, b* > 9) -> crown incl. cervical margin
         (measured: enamel a* 0–7 / b* 17–25; gingiva a* 22–30; glare on wet gum a* ~10 / b* ~5)
  dark : background/gap = very dark (L < 70)                               -> missing structure, open contacts
  gum  : gingiva = red (a* >= A_MAX)
Prints YAML `points:` lists in photo pixels (units: px) for briefs; optional preview overlays every contour.
Put box edges on the interproximal contacts: neighbouring teeth touch there and would otherwise merge.
Always check the --preview image (zoom the gumline) before using the points.
"""
import json, sys
import cv2
import numpy as np

A_MAX, L_MIN, L_DARK, B_MIN = 13, 150, 70, 9


def mask_for(lab, box, mode, cervical=0.35):
    x0, y0, x1, y1 = box
    L = lab[y0:y1, x0:x1, 0].astype(np.float32)
    a = lab[y0:y1, x0:x1, 1].astype(np.float32) - 128
    b = lab[y0:y1, x0:x1, 2].astype(np.float32) - 128
    if mode == "tooth":
        # enamel is slightly yellow (b* > 9); wet-gum glare is neutral white and would otherwise bleed into the outline.
        # Glare inside the crown is restored by the hole fill below.
        # only in the cervical band (top part of the box), because whiter teeth have low b* further down
        band = np.zeros_like(a, dtype=bool)
        band[: int(band.shape[0] * cervical)] = True
        m = (a < A_MAX) & (L > L_MIN) & (~band | (b > B_MIN))
    elif mode == "dark":
        m = L < L_DARK
    elif mode == "gum":
        m = (a >= A_MAX) & (L > L_DARK)
    else:
        raise SystemExit(f"unknown mode {mode}")
    m = m.astype(np.uint8) * 255
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    n, lab_cc, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    if n < 2:
        raise SystemExit(f"nothing found in box {box} ({mode})")
    keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    m = (lab_cc == keep).astype(np.uint8) * 255
    # fill holes (specular highlights, dark fissures inside the crown)
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    filled = np.zeros_like(m)
    cv2.drawContours(filled, cnts, -1, 255, cv2.FILLED)
    return filled


def contour_points(mask, box, n):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    c = cv2.GaussianBlur(c.reshape(-1, 1, 2), (1, 9), 0).reshape(-1, 2)  # smooth pixel stair-steps
    # resample evenly by arc length -> n points (Catmull-Rom in the template restores the curve)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(np.vstack([c, c[:1]]), axis=0).T))]
    t = np.linspace(0, d[-1], n, endpoint=False)
    xs = np.interp(t, d, np.r_[c[:, 0], c[0, 0]]) + box[0]
    ys = np.interp(t, d, np.r_[c[:, 1], c[0, 1]]) + box[1]
    return [[int(round(x)), int(round(y))] for x, y in zip(xs, ys)]


def main():
    photo, specs = sys.argv[1], json.loads(sys.argv[2])
    n = int(sys.argv[sys.argv.index("--points") + 1]) if "--points" in sys.argv else 26
    preview = sys.argv[sys.argv.index("--preview") + 1] if "--preview" in sys.argv else None
    img = cv2.imread(photo)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    out = img.copy()
    for s in specs:
        m = mask_for(lab, s["box"], s.get("mode", "tooth"), s.get("cervical", 0.35))
        pts = contour_points(m, s["box"], s.get("points", n))
        print(f"# {s['name']} ({s.get('mode', 'tooth')})\npoints: {json.dumps(pts, separators=(', ', ': '))}")
        cv2.polylines(out, [np.array(pts, np.int32)], True, (255, 255, 255), 3)
        cv2.rectangle(out, tuple(s["box"][:2]), tuple(s["box"][2:]), (0, 255, 255), 1)
    if preview:
        cv2.imwrite(preview, out)


if __name__ == "__main__":
    main()
