"""Footage clean-up (idea from "miracle clean up" tools, our own code, runs locally; nothing is uploaded).

Remove or hide something in a box of the frame:
  --mode plate    rebuild the background from the clip itself (median of all frames): for a static camera and something
                  that moves through the box (a person walking past, a cable swinging). Best quality.
  --mode inpaint  fill the box from its surroundings, frame by frame (OpenCV Telea): small static things (a sticker,
                  a logo on a wall, a sign).
  --mode blur     privacy blur (a patient's face or name in clinic b-roll, a screen with records). Use this, never
                  "remove", for anything that is about patient privacy.

Usage:
  python3 scripts/cleanup.py <in.mp4> <out.mp4> --box x,y,w,h [--box …] [--mode plate|inpaint|blur] [--from s] [--to s]
Boxes are in pixels of the source video. Audio is copied. Honesty rule: never use this on clinical photos or videos
of treatment results (no retouching of results, CLAUDE.md golden rule 3).
"""
import argparse
import subprocess
import sys

import cv2
import numpy as np


def feather_mask(h, w, boxes, feather):
    m = np.zeros((h, w), np.float32)
    for x, y, bw, bh in boxes:
        m[max(0, y):y + bh, max(0, x):x + bw] = 1
    if feather > 0:
        m = cv2.GaussianBlur(m, (0, 0), feather)
    return m[..., None]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--box", action="append", required=True, help="x,y,w,h in source pixels (repeatable)")
    ap.add_argument("--mode", choices=["plate", "inpaint", "blur"], default="plate")
    ap.add_argument("--from", dest="t0", type=float, default=0.0)
    ap.add_argument("--to", dest="t1", type=float, default=1e9)
    ap.add_argument("--feather", type=float, default=6.0)
    ap.add_argument("--samples", type=int, default=60, help="frames sampled for the background plate")
    a = ap.parse_args()
    if a.inp == a.out:
        sys.exit("output must differ from input")
    boxes = [tuple(int(v) for v in b.split(",")) for b in a.box]

    cap = cv2.VideoCapture(a.inp)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    mask = feather_mask(h, w, boxes, a.feather)
    hard = (feather_mask(h, w, boxes, 0)[..., 0] > 0).astype(np.uint8) * 255

    plate = None
    if a.mode == "plate":
        idx = np.linspace(0, max(0, n - 1), min(a.samples, max(1, n))).astype(int)
        frames = []
        for i in idx:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
            ok, f = cap.read()
            if ok:
                frames.append(f)
        plate = np.median(np.stack(frames), axis=0).astype(np.uint8)
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    enc = subprocess.Popen(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
         "-i", a.inp, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy",
         "-shortest", "-movflags", "+faststart", a.out],
        stdin=subprocess.PIPE,
    )
    k = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        t = k / fps
        if a.t0 <= t <= a.t1:
            if a.mode == "plate":
                fill = plate
            elif a.mode == "inpaint":
                fill = cv2.inpaint(f, hard, 5, cv2.INPAINT_TELEA)
            else:
                fill = cv2.GaussianBlur(f, (0, 0), 28)
                fill = cv2.resize(cv2.resize(fill, (max(1, w // 24), max(1, h // 24))), (w, h), interpolation=cv2.INTER_NEAREST) if a.mode == "blur" else fill
            f = (f * (1 - mask) + fill * mask).astype(np.uint8)
        enc.stdin.write(f.tobytes())
        k += 1
    enc.stdin.close()
    enc.wait()
    print(f"cleaned {k} frames ({a.mode}, {len(boxes)} box(es)) → {a.out}")


if __name__ == "__main__":
    main()
