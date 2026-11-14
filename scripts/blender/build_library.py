"""Regenerate the 3D model library from scripts/blender/library.txt (models are reproducible, so .glb files are not committed).
Usage: python3 scripts/blender/build_library.py [--samples 48] [--only name]"""
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[2]
samples = sys.argv[sys.argv.index("--samples") + 1] if "--samples" in sys.argv else "48"
only = sys.argv[sys.argv.index("--only") + 1] if "--only" in sys.argv else None
(root / "public/models").mkdir(parents=True, exist_ok=True)
(root / "out/models").mkdir(parents=True, exist_ok=True)
for line in (root / "scripts/blender/library.txt").read_text().splitlines():
    if not line.strip() or line.startswith("#"):
        continue
    name, desc = [x.strip() for x in line.split("|")]
    if only and name != only:
        continue
    subprocess.run([sys.executable, str(root / "scripts/blender/modelgen.py"), desc, "--out", str(root / f"public/models/{name}.glb"),
                    "--preview", str(root / f"out/models/{name}.png"), "--size", "600", "--samples", samples], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("built", name)
