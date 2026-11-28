#!/usr/bin/env python3
"""Join the tracked pieces of the drive (shared frames → similarity transforms) and place the camera path on the map:
frame 1 at the bust junction end of Commissioner Road, the last straight frames at the clinic, ground plane from the
cameras' mean 'up'. Writes public/footage/realmap/sfm/poses.json: per frame {C (map metres, z up), R (world→cam), f}."""
import json
from pathlib import Path
import numpy as np, pycolmap

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "public/footage/realmap/sfm/model"

def umeyama(src, dst, scale=True):
    mu_s, mu_d = src.mean(0), dst.mean(0); A, B = src - mu_s, dst - mu_d
    U, S, Vt = np.linalg.svd(B.T @ A / len(src)); d = np.sign(np.linalg.det(U @ Vt))
    Dm = np.diag([1] * (src.shape[1] - 1) + [d]); R = U @ Dm @ Vt
    s = (S * np.diag(Dm)).sum() / (A ** 2).sum() * len(src) if scale else 1.0
    return s, R, mu_d - s * R @ mu_s

recs = {k: pycolmap.Reconstruction(D / k) for k in ("3", "2", "1")}
def cams(r):
    out = {}
    for im in r.images.values():
        fr = int(im.name[1:5]); P = im.cam_from_world().matrix(); out[fr] = (np.asarray(im.projection_center()), P[:, :3], r.cameras[im.camera_id].params[0])
    return out
c3, c2, c1 = cams(recs["3"]), cams(recs["2"]), cams(recs["1"])
# bring piece 2 into piece 3's frame, then piece 1 into piece 2's (now merged) frame
def bring(dst, src):
    common = sorted(set(dst) & set(src))
    s, R, t = umeyama(np.array([src[f][0] for f in common]), np.array([dst[f][0] for f in common]))
    out = dict(dst)
    for f, (C, Rw, fl) in src.items():
        if f not in out: out[f] = (s * R @ C + t, Rw @ R.T, fl)
    print("joined", len(common), "shared frames, scale", round(s, 3))
    return out
allc = bring(bring(c3, c2), c1)
frames = sorted(allc); C = np.array([allc[f][0] for f in frames])
# ground plane: camera 'up' (−y image axis) averaged, expressed in world
ups = np.array([-allc[f][1][1] for f in frames]); up = ups.mean(0); up /= np.linalg.norm(up)
# forward direction of travel = principal axis of the path, projected on the ground
P0 = C - C.mean(0); P0 -= np.outer(P0 @ up, up)
_, _, Vt = np.linalg.svd(P0); fwd = Vt[0]; fwd -= up * (fwd @ up); fwd /= np.linalg.norm(fwd)
if (C[-1] - C[0]) @ fwd < 0: fwd = -fwd
right = np.cross(fwd, up)
B = np.stack([right, fwd, up])  # world → (right, forward, up)
L = (C - C[0]) @ B.T            # local path coords
# map: drive heads SOUTH from the junction (−5, 350) to the clinic; the last ~12 frames turn right into the building
straight = [i for i, f in enumerate(frames) if f <= 150]
dist = L[straight[-1], 1]
road_x = 17.6; start, end = np.array([road_x - 3, 350.0]), np.array([road_x - 3, 12.0])
s = np.linalg.norm(end - start) / dist
def to_map(p):  # local (right, fwd, up) → map (x east, y north, z up): forward = south, right = west
    return np.array([start[0] - s * p[0], start[1] - s * p[1], 1.4 + s * p[2]])
out = {}
for i, f in enumerate(frames):
    Cw, Rw, fl = allc[f]
    Mmap = np.stack([-right, -fwd, up])  # world → map axes (x east = −right, y north = −fwd)
    out[f] = {"C": to_map(L[i]).round(3).tolist(), "R": (Rw @ Mmap.T).round(5).tolist(), "f": float(fl)}
(ROOT / "public/footage/realmap/sfm/poses.json").write_text(json.dumps({"scale": s, "frames": out}))
print("frames", len(out), "first", out[frames[0]]["C"], "last straight", out[frames[straight[-1]]]["C"], "last", out[frames[-1]]["C"], "m per unit", round(s, 2))
