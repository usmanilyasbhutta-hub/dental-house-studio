"""Clinical-macro clip (direction A): composite restoration of the mesial cavities on 11 and 21. Illustration only.

  python3 scripts/blender/composite_clip.py out/x.mp4 [--size 405x720] [--samples 32] [--fps 12] [--seconds 6] [--frame N out.png]

Story (t 0→1): prepared cavities, slow push-in → composite placed (grows into each cavity, matte) → blue curing
light → polish (surface turns glossy and blends in). Teeth come from modelgen (layered enamel/dentin); generic
materials, no brands. Keep "Illustration · not to scale" on screen when this is used in a video.
"""
import math
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector

import modelgen as mg

args = sys.argv[1:]
opt = lambda n, d=None: args[args.index(n) + 1] if n in args else d
out = args[0] if args and not args[0].startswith("--") else "out/composite-11-21-macro.mp4"
W, H = (int(v) for v in opt("--size", "405x720").split("x"))
samples, fps, seconds = int(opt("--samples", "32")), int(opt("--fps", "12")), float(opt("--seconds", "6"))

mg.reset()
mats = mg.M()
sc = bpy.context.scene
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
w = bpy.data.worlds.new("w")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.004, 0.005, 1)

# ---- teeth: 12, 11, 21, 22 (viewer's left = patient's right). Mesial of 11 and 21 face the midline. ----
P = mg.TOOTH["incisor"]
CAV = Vector((P["w"] * 0.84, -P["d"] * 0.32, P["h"] * 0.58))  # cavity centre in tooth space (modelgen "mesial")
fills = []
for x, desc in [(-1.36, "upper lateral incisor no root"), (-0.47, "upper central incisor no root with mesial cavity restored"),
                (0.47, "upper central incisor no root with mesial cavity restored"), (1.36, "upper lateral incisor no root")]:
    g = mg.tooth(mg.parse(desc), mats)
    lateral = abs(x) > 1
    g.location = (x, 0.22 if lateral else 0, 0.04 if lateral else 0)
    g.rotation_euler = (math.radians(-6), math.pi, math.radians((24 if x < 0 else -24) if lateral else (4 if x < 0 else -4)))
    if x < 0:
        g.scale = (-1, 1, 1)  # mirror: mesial towards the midline on the patient's right side
    fills += [c for c in g.children if c.name.startswith("restoration")]

# ---- gum (same recipe as direction A) ----
bpy.ops.mesh.primitive_grid_add(x_subdivisions=200, y_subdivisions=40, size=1)
gum = bpy.context.active_object
cx = [-1.36, -0.47, 0.47, 1.36]
mids = [(a + b) / 2 for a, b in zip(cx, cx[1:])]
for v in gum.data.vertices:
    u, t = v.co.x + 0.5, v.co.y + 0.5
    X = (u - 0.5) * 6.0
    papilla = max(math.exp(-((X - m) / 0.11) ** 2) for m in mids)
    near = min(abs(X - tx) for tx in cx)
    Z = -0.14 - 0.06 * (near / 0.47) ** 2 - 0.3 * papilla + t * 2.2  # margin sits over the narrow neck: no gap
    Y = -0.5 + 0.09 * X * X - 0.06 * math.sin(min(1, t * 3) * math.pi / 2) + 0.12 * t * t
    v.co = Vector((X, Y, Z))
sol = gum.modifiers.new("solid", "SOLIDIFY")
sol.thickness, sol.offset = 0.16, -1
sub = gum.modifiers.new("sub", "SUBSURF")
sub.levels = sub.render_levels = 2
for p in gum.data.polygons:
    p.use_smooth = True
gum.data.materials.append(mg.mat("gum", (0.62, 0.24, 0.25), rough=0.75, sss=0.6, sss_r=(1.0, 0.3, 0.2), bump=((140, 140, 140), 0.1)))


def area(loc, rot, size, power, color=(1, 1, 1)):
    l = bpy.data.lights.new("l", "AREA")
    l.size, l.energy, l.color = size, power, color
    o = bpy.data.objects.new("l", l)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    sc.collection.objects.link(o)
    return l


area((2.0, -5.5, 2.0), (65, 0, 20), 2.5, 480, (1, 0.96, 0.9))
area((-3.0, 2.0, 1.0), (70, 0, -130), 1.5, 900, (0.75, 0.85, 1.0))
area((0.0, 3.5, -2.2), (-115, 0, 0), 3, 700, (1.0, 0.95, 0.88))
area((-2, -5, -2.5), (110, 0, -15), 4, 60)
cure = area((0.0, -1.6, -0.75), (100, 0, 0), 0.25, 0, (0.15, 0.35, 1.0))  # curing light: off until its moment

cam = bpy.data.cameras.new("cam")
cob = bpy.data.objects.new("cam", cam)
sc.collection.objects.link(cob)
sc.camera = cob
cam.dof.use_dof = True
cam.dof.aperture_fstop = 2.8

comp = mats["composite"].node_tree.nodes["Principled BSDF"]
smooth = lambda a, b, t: (lambda k: k * k * (3 - 2 * k))(min(1, max(0, (t - a) / (b - a))))


def pose(t):
    """Everything is a function of t (0→1): deterministic, any frame can be rendered alone."""
    e = smooth(0, 1, t)
    pos = Vector((0.3, -7.4, -1.0)).lerp(Vector((0.1, -5.4, -0.8)), e)  # slow push-in on the contact area
    look = Vector((0, 0, -0.5)).lerp(Vector((0, 0, -0.55)), e)
    cob.location = pos
    cob.rotation_euler = (look - pos).to_track_quat("-Z", "Y").to_euler()
    cam.lens = 60
    cam.dof.focus_distance = (look - pos).length - 0.35
    s = smooth(0.22, 0.52, t)  # composite placed
    for f in fills:
        f.scale = (max(s, 1e-4),) * 3
        f.location = CAV * (1 - s)
        f.hide_render = s <= 0.001
    cure.energy = 140 * math.sin(math.pi * min(1, max(0, (t - 0.56) / 0.2)))  # blue light on, then off
    pol = smooth(0.8, 0.96, t)  # polish: matte → glossy, shade settles
    comp.inputs["Roughness"].default_value = 0.62 - 0.4 * pol
    comp.inputs["Coat Weight"].default_value = 0.45 * pol
    comp.inputs["Base Color"].default_value = (0.97 - 0.04 * pol, 0.95 - 0.05 * pol, 0.9 - 0.08 * pol, 1)


if "--frame" in args:
    n = int(opt("--frame"))
    pose(n / max(1, int(seconds * fps) - 1))
    sc.render.filepath = args[args.index("--frame") + 2]
    bpy.ops.render.render(write_still=True)
    print("frame →", sc.render.filepath)
else:
    N = int(seconds * fps)
    tmp = tempfile.mkdtemp(prefix="composite-")
    for n in range(N):
        pose(n / (N - 1))
        sc.render.filepath = os.path.join(tmp, f"{n:04d}.png")
        bpy.ops.render.render(write_still=True)
    subprocess.check_call(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(fps), "-i", os.path.join(tmp, "%04d.png"),
                           "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
    print("clip →", out)
