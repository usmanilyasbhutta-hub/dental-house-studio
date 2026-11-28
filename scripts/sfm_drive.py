#!/usr/bin/env python3
"""Camera tracking (structure from motion) of the owner's 54 s windscreen drive down Commissioner Road (raw.mov):
frames at 3 fps, dashboard masked, SIFT + sequential matching + incremental mapping (pycolmap, CPU).
Output: public/footage/realmap/sfm/{images,masks,db.db,model/} (gitignored). Used to texture the corridor buildings with the
owner's own footage (owner 2026-11-28: "only commissioner road to ahsan medical centre in detail")."""
import subprocess, sys
from pathlib import Path
import numpy as np, cv2, pycolmap

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "public/footage/realmap/sfm"
IMG, MSK = D / "images", D / "masks"
if "--skip-extract" not in sys.argv:
    IMG.mkdir(parents=True, exist_ok=True); MSK.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ROOT / "public/footage/arrival/raw.mov"), "-vf", "fps=3,scale=1080:-2",
                    "-q:v", "2", str(IMG / "f%04d.jpg")], check=True)
    for p in sorted(IMG.glob("*.jpg")):
        h, w = cv2.imread(str(p)).shape[:2]
        m = np.full((h, w), 255, np.uint8); m[int(h * 0.70):] = 0  # dashboard + bonnet
        cv2.imwrite(str(MSK / (p.name + ".png")), m)
print("frames", len(list(IMG.glob("*.jpg"))), flush=True)
db = D / "db.db"
if db.exists(): db.unlink()
ro = pycolmap.ImageReaderOptions(); ro.mask_path = str(MSK); ro.camera_model = "SIMPLE_RADIAL"
pycolmap.extract_features(db, IMG, camera_mode=pycolmap.CameraMode.SINGLE, reader_options=ro)
print("features done", flush=True)
mo = pycolmap.SequentialPairingOptions(); mo.overlap = 12; mo.quadratic_overlap = True
pycolmap.match_sequential(db, pairing_options=mo)
print("matching done", flush=True)
out = D / "model"; out.mkdir(exist_ok=True)
recs = pycolmap.incremental_mapping(db, IMG, out)
for k, r in recs.items():
    print("model", k, "images", r.num_reg_images(), "points", r.num_points3D(), flush=True)
