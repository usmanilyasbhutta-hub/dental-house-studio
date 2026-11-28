#!/usr/bin/env python3
"""Sialkot → Dental House in Blender (Cycles), from open 3D data (owner 2026-11-28: "use 3d data of sialkot from some source and
make 3d blender").

Data (all allowed in ads, credited on screen):
  - building footprints: Overture Maps (Google Open Buildings CC BY 4.0 / Microsoft ML Buildings ODbL / OpenStreetMap ODbL)
    public/footage/realmap/3d/buildings.geojson (overturemaps download --bbox=74.530,32.492,74.563,32.519 --type=building)
  - roads: OpenStreetMap (src/data/realroads.json)
  - ground + roof colours: Copernicus Sentinel-2, 22 Nov 2026 (public/footage/realmap/matched/*.jpg)
  - the clinic front: the owner's own drive-by frame, straightened (public/footage/arrival/facade-rect.jpg)
Heights are not in the data for Sialkot: storeys are estimated from footprint size and road frontage (illustrative).

Usage:
  python3 scripts/blender_zoom.py still 0 60 120 ...   # test frames → qc/earth-zoom-3d/still_####.png
  python3 scripts/blender_zoom.py render [start end]    # frames → public/footage/zoom3d/####.png + src/data/zoom3d-overlay.json
"""
import json, math, sys, time
from pathlib import Path

import bpy, bmesh
import numpy as np
from mathutils import Vector, Euler, Matrix
from bpy_extras.object_utils import world_to_camera_view
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LAT0, LON0 = 32.5054616, 74.546536
KX = 111320 * math.cos(math.radians(LAT0)); KY = 110540
FPS, SECONDS = 30, 8.0
N = int(FPS * SECONDS)
W, H = 1080, 1920
RADIUS = 1500  # metres of 3D buildings around the clinic
OUT = ROOT / "public/footage/zoom3d"
QC = ROOT / "qc/earth-zoom-3d"

m = lambda lon, lat: ((lon - LON0) * KX, (lat - LAT0) * KY)  # local metres: x east, y north (Blender: z up)


# ---------- smooth keyframes (monotone cubic, same maths as EarthZoom.tsx) -------------------------------------------------
def mono(xs, ys):
    n = len(xs); d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    mm = [d[0]] + [0 if d[i - 1] * d[i] <= 0 else (d[i - 1] + d[i]) / 2 for i in range(1, n - 1)] + [d[-1]]
    for i in range(n - 1):
        if d[i] == 0: mm[i] = mm[i + 1] = 0; continue
        a, b = mm[i] / d[i], mm[i + 1] / d[i]; h = a * a + b * b
        if h > 9: t = 3 / math.sqrt(h); mm[i] = t * a * d[i]; mm[i + 1] = t * b * d[i]
    def f(x):
        if x <= xs[0]: return ys[0]
        if x >= xs[-1]: return ys[-1]
        i = 0
        while x > xs[i + 1]: i += 1
        h = xs[i + 1] - xs[i]; t = (x - xs[i]) / h; t2, t3 = t * t, t * t * t
        return (2*t3-3*t2+1)*ys[i] + (t3-2*t2+t)*h*mm[i] + (-2*t3+3*t2)*ys[i+1] + (t3-t2)*h*mm[i+1]
    return f


# ---------- data ------------------------------------------------------------------------------------------------------------
def load_buildings():
    gj = json.loads((ROOT / "public/footage/realmap/3d/buildings.geojson").read_text())
    out = []
    for f in gj["features"]:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in polys:
            ring = [m(lo, la) for lo, la in poly[0]][:-1]
            if len(ring) < 3: continue
            cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
            if math.hypot(cx, cy) > RADIUS: continue
            area = 0.5 * abs(sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1] for i in range(len(ring))))
            if area < 12: continue
            out.append({"ring": ring, "c": (cx, cy), "area": area, "h": f["properties"].get("height")})
    return out


def road_segments():
    net = json.loads((ROOT / "src/data/realroads.json").read_text())["ways"]
    return [(w["hw"], w["pts"]) for w in net]


def seg_dist(px, py, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L2))
    return math.hypot(px - a[0] - t * dx, py - a[1] - t * dy)


# ---------- scene -----------------------------------------------------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 20
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 3
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = 75  # 810×1440, upscaled in Remotion (render time on 4 CPU cores)
    sc.render.fps = FPS
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = -1.7
    sc.frame_start, sc.frame_end = 0, N - 1
    return sc


def img_material(name, path, emission=False):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(str(path)); tex.interpolation = "Cubic"
    tex.extension = "CLIP"
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if emission:
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Strength"].default_value = 3.2
        nt.links.new(tex.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], out.inputs[0])
    else:
        bs = nt.nodes.new("ShaderNodeBsdfPrincipled"); bs.inputs["Roughness"].default_value = 0.9
        nt.links.new(tex.outputs[0], bs.inputs["Base Color"]); nt.links.new(bs.outputs[0], out.inputs[0])
    return mat


def plane(name, x0, y0, x1, y1, z, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(); uv.data[0].uv, uv.data[1].uv, uv.data[2].uv, uv.data[3].uv = (0, 0), (1, 0), (1, 1), (0, 1)
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(mat); bpy.context.collection.objects.link(ob)
    return ob


def ground():
    rm = json.loads((ROOT / "src/data/realmap.json").read_text())
    pyr = rm["pyramid"]
    # coarse → fine, each a little higher (no z-fighting); the 12.4 km city level carries most of the zoom
    for i, lvl in enumerate(pyr[1:], 1):
        b = lvl["bounds"]
        mat = img_material(f"sat{i}", ROOT / "public" / lvl["src"])
        # close to the ground the 10 m/px satellite turns to mush: blend into dusty paving by camera distance
        if i == len(pyr) - 1:
            nt = mat.node_tree; bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"); tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
            cam = nt.nodes.new("ShaderNodeCameraData"); mr = nt.nodes.new("ShaderNodeMapRange")
            mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = 120, 900
            noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 0.08
            ramp = nt.nodes.new("ShaderNodeValToRGB"); ramp.color_ramp.elements[0].color = (0.20, 0.18, 0.15, 1); ramp.color_ramp.elements[1].color = (0.30, 0.27, 0.22, 1)
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
            nt.links.new(cam.outputs["View Distance"], mr.inputs["Value"]); nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
            nt.links.new(mr.outputs["Result"], mix.inputs["Factor"]); nt.links.new(ramp.outputs["Color"], mix.inputs[6]); nt.links.new(tex.outputs[0], mix.inputs[7])
            nt.links.new(mix.outputs[2], bs.inputs["Base Color"])
        plane(f"ground{i}", b[0], b[1], b[2], b[3], -0.6 + 0.2 * i, mat)


def roads():
    mat = bpy.data.materials.new("asphalt"); mat.use_nodes = True
    bs = mat.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = (0.045, 0.045, 0.048, 1); bs.inputs["Roughness"].default_value = 0.92
    try: bs.inputs["Specular IOR Level"].default_value = 0.15
    except KeyError: pass
    widths = {"primary": 16, "secondary": 14, "secondary_link": 9, "tertiary": 11, "unclassified": 8, "residential": 6.5, "living_street": 6, "service": 4.5}
    bm = bmesh.new()
    for wi, (hw, pts) in enumerate(road_segments()):
        w = widths.get(hw)
        if not w: continue
        zr = 0.05 + (wi % 37) * 0.004 + (0.2 if hw in ("primary", "secondary") else 0)
        for a, b in zip(pts, pts[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
            nx, ny = -dy / L * w / 2, dx / L * w / 2
            vs = [bm.verts.new((a[0] + nx, a[1] + ny, zr)), bm.verts.new((b[0] + nx, b[1] + ny, zr)),
                  bm.verts.new((b[0] - nx, b[1] - ny, zr)), bm.verts.new((a[0] - nx, a[1] - ny, zr))]
            bm.faces.new(vs)
    me = bpy.data.meshes.new("roads"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("roads", me); ob.data.materials.append(mat); bpy.context.collection.objects.link(ob)


def emissive(name, rgb, strength):
    mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree; nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = rgb + (1,); em.inputs[1].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial"); nt.links.new(em.outputs[0], out.inputs[0]); return mat


def trees(blds, radius=900):
    """Trees only where Sentinel-2 sees vegetation (green > red, not on a building or road)."""
    sat = np.asarray(Image.open(ROOT / "public/footage/realmap/s2-city.jpg").convert("RGB")).astype(np.float32)
    rm = json.loads((ROOT / "src/data/realmap.json").read_text()); b = rm["pyramid"][-1]["bounds"]
    segs = [(a, c, 9) for hw, pts in road_segments() for a, c in zip(pts, pts[1:])]
    occ = set()
    for bd in blds:
        for x, y in bd["ring"]: occ.add((int(x // 8), int(y // 8)))
        occ.add((int(bd["c"][0] // 8), int(bd["c"][1] // 8)))
    rng = np.random.default_rng(5); bm = bmesh.new(); n = 0
    for gx in range(-radius, radius, 9):
        for gy in range(-radius, radius, 9):
            x, y = gx + rng.uniform(-3, 3), gy + rng.uniform(-3, 3)
            u = (x - b[0]) / (b[2] - b[0]); v = 1 - (y - b[1]) / (b[3] - b[1])
            r_, g_, b_ = sat[int(v * (sat.shape[0] - 1)), int(u * (sat.shape[1] - 1))]
            if not (g_ > r_ * 1.04 and g_ > b_ * 1.08): continue
            if (int(x // 8), int(y // 8)) in occ: continue
            if any(seg_dist(x, y, a, c) < 8 for a, c, _ in segs if abs(a[0] - x) < 300 and abs(a[1] - y) < 300): continue
            r = rng.uniform(2.2, 3.8)
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=Matrix.Translation((x, y, r * 1.4 + 1.6)) @ Matrix.Diagonal((1, 1, 0.8, 1)))
            n += 1
    me = bpy.data.meshes.new("trees"); bm.to_mesh(me); bm.free()
    mat = bpy.data.materials.new("leaves"); mat.use_nodes = True
    bs = mat.node_tree.nodes["Principled BSDF"]; bs.inputs["Base Color"].default_value = (0.06, 0.11, 0.04, 1); bs.inputs["Roughness"].default_value = 0.8
    ob = bpy.data.objects.new("trees", me); ob.data.materials.append(mat); bpy.context.collection.objects.link(ob)
    print("trees", n)
    return ob


def hero_road_pts():
    pts = []
    for hw, p in road_segments():
        if hw == "secondary":
            pts += [q for q in p if abs(q[0] - 10.7) < 60 and abs(q[1]) < 1150]
    pts = sorted({(round(x, 1), round(y, 1)) for x, y in pts}, key=lambda q: q[1])
    return [q for i, q in enumerate(pts) if i == 0 or abs(q[1] - pts[i - 1][1]) > 0.5]


def lane_marks_and_route():
    hr = hero_road_pts(); bm = bmesh.new()
    for a, c in zip(hr, hr[1:]):
        L = math.hypot(c[0] - a[0], c[1] - a[1])
        for t in np.arange(2, L - 3, 9):
            p = (a[0] + (c[0] - a[0]) * t / L, a[1] + (c[1] - a[1]) * t / L); q = (a[0] + (c[0] - a[0]) * (t + 3.5) / L, a[1] + (c[1] - a[1]) * (t + 3.5) / L)
            vs = [bm.verts.new((p[0] - 0.12, p[1], 0.33)), bm.verts.new((q[0] - 0.12, q[1], 0.33)), bm.verts.new((q[0] + 0.12, q[1], 0.33)), bm.verts.new((p[0] + 0.12, p[1], 0.33))]
            bm.faces.new(vs)
    me = bpy.data.meshes.new("lanes"); bm.to_mesh(me); bm.free()
    mat = bpy.data.materials.new("paint"); mat.use_nodes = True; mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.8, 0.78, 1)
    ob = bpy.data.objects.new("lanes", me); ob.data.materials.append(mat); bpy.context.collection.objects.link(ob)
    # navigation-style route (owner: "As google navigation"): northbound lane, ending at the clinic front
    cu = bpy.data.curves.new("route", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.55; cu.bevel_resolution = 2
    sp = cu.splines.new("POLY"); pts = [(x - 3.4, y, 0.6) for x, y in hr if -1100 < y < -2] + [(7.3, -1.5, 0.6)]
    sp.points.add(len(pts) - 1)
    for k, p in enumerate(pts): sp.points[k].co = (*p, 1)
    ro = bpy.data.objects.new("route", cu); ro.data.materials.append(emissive("route", (0.25, 0.66, 1.0), 6.0)); bpy.context.collection.objects.link(ro)
    return ro


def building_material():
    """plaster/brick walls with a window grid (procedural, world-aligned), roofs coloured from the satellite (face attribute)"""
    mat = bpy.data.materials.new("buildings"); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear(); L = nt.links.new
    out = nt.nodes.new("ShaderNodeOutputMaterial"); bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    wall = nt.nodes.new("ShaderNodeAttribute"); wall.attribute_name = "wall"
    roof = nt.nodes.new("ShaderNodeAttribute"); roof.attribute_name = "roof"
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sep = nt.nodes.new("ShaderNodeSeparateXYZ"); sepn = nt.nodes.new("ShaderNodeSeparateXYZ")
    L(geo.outputs["Position"], sep.inputs[0]); L(geo.outputs["Normal"], sepn.inputs[0])
    def math_node(op, a=None, b=None, va=None, vb=None):
        n = nt.nodes.new("ShaderNodeMath"); n.operation = op
        if a is not None: L(a, n.inputs[0])
        elif va is not None: n.inputs[0].default_value = va
        if b is not None: L(b, n.inputs[1])
        elif vb is not None: n.inputs[1].default_value = vb
        return n.outputs[0]
    # along-wall coordinate: |ny|*x + |nx|*y
    u = math_node("ADD", math_node("MULTIPLY", math_node("ABSOLUTE", sepn.outputs[1]), sep.outputs[0]),
                  math_node("MULTIPLY", math_node("ABSOLUTE", sepn.outputs[0]), sep.outputs[1]))
    fu = math_node("FRACT", math_node("DIVIDE", u, vb=3.6)); fz = math_node("FRACT", math_node("DIVIDE", sep.outputs[2], vb=3.3))
    win = math_node("MULTIPLY",
                    math_node("MULTIPLY", math_node("GREATER_THAN", fu, vb=0.28), math_node("LESS_THAN", fu, vb=0.74)),
                    math_node("MULTIPLY", math_node("GREATER_THAN", fz, vb=0.32), math_node("LESS_THAN", fz, vb=0.80)))
    side = math_node("LESS_THAN", math_node("ABSOLUTE", sepn.outputs[2]), vb=0.5)
    ground_floor = math_node("GREATER_THAN", sep.outputs[2], vb=3.0)
    winmask = math_node("MULTIPLY", math_node("MULTIPLY", win, side), ground_floor)
    glass = nt.nodes.new("ShaderNodeRGB"); glass.outputs[0].default_value = (0.10, 0.13, 0.15, 1)
    m1 = nt.nodes.new("ShaderNodeMix"); m1.data_type = "RGBA"
    L(side, m1.inputs["Factor"]); L(roof.outputs["Color"], m1.inputs[6]); L(wall.outputs["Color"], m1.inputs[7])
    m2 = nt.nodes.new("ShaderNodeMix"); m2.data_type = "RGBA"
    L(winmask, m2.inputs["Factor"]); L(m1.outputs[2], m2.inputs[6]); L(glass.outputs[0], m2.inputs[7])
    rough = nt.nodes.new("ShaderNodeMapRange"); L(winmask, rough.inputs["Value"]); rough.inputs["To Min"].default_value = 0.85; rough.inputs["To Max"].default_value = 0.15
    L(m2.outputs[2], bs.inputs["Base Color"]); L(rough.outputs["Result"], bs.inputs["Roughness"]); L(bs.outputs[0], out.inputs[0])
    return mat


def buildings(blds, clinic_idx):
    sat = Image.open(ROOT / "public/footage/realmap/matched/s2-city.jpg").convert("RGB"); sa = np.asarray(sat).astype(np.float32) / 255
    rm = json.loads((ROOT / "src/data/realmap.json").read_text()); b = rm["pyramid"][-1]["bounds"]
    segs = [(hw, a, c) for hw, pts in road_segments() for a, c in zip(pts, pts[1:]) if hw in ("primary", "secondary", "tertiary")]
    rng = np.random.default_rng(11)
    walls = [(0.86, 0.80, 0.68), (0.80, 0.72, 0.60), (0.74, 0.66, 0.55), (0.62, 0.38, 0.29), (0.70, 0.45, 0.34), (0.83, 0.81, 0.76), (0.66, 0.62, 0.56)]
    bm = bmesh.new()
    wall_l = bm.loops.layers.float_color.new("wall"); roof_l = bm.loops.layers.float_color.new("roof")
    for i, bd in enumerate(blds):
        if i == clinic_idx: continue
        ring, (cx, cy), area = bd["ring"], bd["c"], bd["area"]
        main = min((seg_dist(cx, cy, a, c) for _, a, c in segs), default=999) < 35
        base = 2 if area < 80 else 3 if area < 300 else 3 if area < 900 else 2
        floors = base + int(rng.integers(0, 2)) + (1 if main else 0)
        h = bd["h"] or floors * 3.3 + 0.6
        u = (cx - b[0]) / (b[2] - b[0]); v = 1 - (cy - b[1]) / (b[3] - b[1])
        rc = sa[int(np.clip(v, 0, 1) * (sa.shape[0] - 1)), int(np.clip(u, 0, 1) * (sa.shape[1] - 1))]
        rc = tuple(float(x) ** 2.2 * 1.15 for x in rc) + (1.0,)  # sRGB → linear
        wc = tuple(x ** 2.2 for x in walls[int(rng.integers(0, len(walls)))]) + (1.0,)
        bot = [bm.verts.new((x, y, 0)) for x, y in ring]; top = [bm.verts.new((x, y, h)) for x, y in ring]
        try:
            faces = [bm.faces.new(top)]
            faces += [bm.faces.new((bot[k], bot[(k + 1) % len(ring)], top[(k + 1) % len(ring)], top[k])) for k in range(len(ring))]
        except ValueError:
            continue
        for f in faces:
            for lp in f.loops: lp[wall_l] = wc; lp[roof_l] = rc
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("buildings"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("buildings", me); ob.data.materials.append(building_material()); bpy.context.collection.objects.link(ob)
    return ob


def clinic(bd):
    """Ahsan Medical Centre: its real footprint, plaster walls, and the owner's straightened front photo on the road side."""
    ring = bd["ring"]
    front_x = max(p[0] for p in ring)  # road (east) side
    h = 15.4
    bm = bmesh.new()
    wall_l = bm.loops.layers.float_color.new("wall"); roof_l = bm.loops.layers.float_color.new("roof")
    bot = [bm.verts.new((x, y, 0)) for x, y in ring]; top = [bm.verts.new((x, y, h)) for x, y in ring]
    fs = [bm.faces.new(top)] + [bm.faces.new((bot[k], bot[(k + 1) % len(ring)], top[(k + 1) % len(ring)], top[k])) for k in range(len(ring))]
    for f in fs:
        for lp in f.loops: lp[wall_l] = (0.80 ** 2.2, 0.72 ** 2.2, 0.56 ** 2.2, 1); lp[roof_l] = (0.45, 0.42, 0.38, 1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("clinic"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("clinic", me); ob.data.materials.append(bpy.data.materials["buildings"]); bpy.context.collection.objects.link(ob)
    # the real front (1160×1990 px), 14 m tall, centred on the pin's latitude, facing east
    fh, fw = 14.0, 14.0 * 1160 / 1990
    fmat = img_material("facade", ROOT / "public/footage/arrival/facade-rect.jpg", emission=True)
    me = bpy.data.meshes.new("facade")
    x = front_x + 0.05
    me.from_pydata([(x, -fw / 2, 0), (x, fw / 2, 0), (x, fw / 2, fh), (x, -fw / 2, fh)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(); uv.data[0].uv, uv.data[1].uv, uv.data[2].uv, uv.data[3].uv = (0, 0), (1, 0), (1, 1), (0, 1)
    fo = bpy.data.objects.new("facade", me); fo.data.materials.append(fmat); bpy.context.collection.objects.link(fo)
    return front_x, fw, fh


def world_and_sun():
    w = bpy.data.worlds.new("sky"); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree; bg = nt.nodes["Background"]
    sky = nt.nodes.new("ShaderNodeTexSky")
    try: sky.sun_elevation = math.radians(32); sky.sun_rotation = math.radians(110)
    except Exception: pass
    nt.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.35
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 3.0; sun.angle = math.radians(1.2); sun.color = (1.0, 0.95, 0.88)
    so = bpy.data.objects.new("sun", sun); bpy.context.collection.objects.link(so)
    # morning, east-south-east (the drive-by facade is sunlit)
    so.rotation_euler = Euler((math.radians(58), 0, math.radians(110)), "XYZ")


# ---------- the camera path (ported from EarthZoom.tsx, s = 0.43..1 for the Sialkot start) -----------------------------------
def camera_path(front_x, rx):
    END = (front_x + 12.0, 1.5, 1.0)          # (x east, height, z south) like the TSX version: mid-road, eye level
    S = [0.43, 0.45, 0.55, 0.64, 0.72, 0.8, 0.88, 0.95, 1]
    logH = mono(S, [math.log10(v) for v in (18000, 12000, 1500, 380, 110, 35, 7, 2.4, END[1])])
    SX = [0.45, 0.55, 0.64, 0.72, 0.8, 0.88, 0.95, 1]
    offX = mono(SX, [0, rx + 40, rx + 15, rx + 5, rx + 3, rx + 5, rx + 5, END[0]])
    offZ = mono(SX, [0, 700, 520, 330, 170, 30, 7, END[2]])
    pitch = mono(SX, [-90, -62, -45, -32, -20, -6, 10, 15])
    yaw = mono([0.45, 0.84, 0.95, 1], [0, 0, 70, 90])
    fov = mono([0.43, 0.84, 1], [40, 52, 64])
    def at(i):
        s = 0.43 + 0.57 * min(1, i / (N - 1))
        h = 10 ** logH(s)
        x, zs = (offX(s), offZ(s)) if s > 0.45 else (0.0, 0.0)
        p, y = math.radians(pitch(s) if s > 0.45 else -90), math.radians(yaw(s) if s > 0.45 else 0)
        # forward in Blender coords (x east, y north, z up): heading y=0 → north, y=90° → west
        f = Vector((-math.sin(y) * math.cos(p), math.cos(y) * math.cos(p), math.sin(p)))
        return s, Vector((x, -zs, h)), f, fov(s)
    return at


def setup_camera():
    cd = bpy.data.cameras.new("cam"); cd.sensor_fit = "VERTICAL"; cd.clip_start = 0.1; cd.clip_end = 200000
    co = bpy.data.objects.new("cam", cd); bpy.context.collection.objects.link(co); bpy.context.scene.camera = co
    return co


def pose(co, at, i, bobj):
    s, pos, f, fov = at(i)
    co.location = pos
    up = Vector((0, 0, 1)) if abs(f.z) < 0.95 else Vector((0, 1, 0))
    co.rotation_euler = f.to_track_quat("-Z", "Y").to_euler() if abs(f.z) < 0.95 else Euler((0, 0, 0))
    co.data.angle = math.radians(fov)
    co.data.clip_start = max(0.1, pos.z * 0.01)
    # buildings grow out of the satellite between ~2.2 km and ~450 m of altitude
    k = max(0.0, min(1.0, (math.log10(2200) - math.log10(max(pos.z, 1))) / (math.log10(2200) - math.log10(450))))
    bobj.scale = (1, 1, max(0.002, k * k * (3 - 2 * k)))
    for name in ("trees",):
        if name in bpy.data.objects: bpy.data.objects[name].scale = (1, 1, max(0.002, k))
    # route visible on the road stretch, gone before the matched cut
    ROUTE.hide_render = not (0.55 < s < 0.9)
    return s


def overlay_points(co, front_x, fw, fh, sc):
    """screen positions (0..1, y down) of the pin, the landmark and the two doctors' panels, for Remotion overlays"""
    pts = {"pin": Vector((front_x - 6, 0, 19.5)), "landmark": Vector((front_x + 40, 2, 16))}
    PANEL_UV = {"ayesha": [[0.0691, 0.5659], [0.1274, 0.5667], [0.132, 0.6066], [0.074, 0.6058]],
                "usman": [[0.1274, 0.5667], [0.1868, 0.5675], [0.1911, 0.6074], [0.132, 0.6066]]}
    out = {}
    for k, v in pts.items():
        q = world_to_camera_view(sc, co, v); out[k] = [round(q.x, 4), round(1 - q.y, 4), round(q.z, 2)]
    for k, uvs in PANEL_UV.items():
        out[k] = []
        for u, v in uvs:
            wp = Vector((front_x + 0.06, -fw / 2 + u * fw, fh * (1 - v)))
            q = world_to_camera_view(sc, co, wp); out[k].append([round(q.x, 4), round(1 - q.y, 4)])
    return out


def build():
    sc = reset()
    blds = load_buildings()
    ci = min(range(len(blds)), key=lambda i: math.hypot(*blds[i]["c"]) if any(abs(p[1]) < 40 for p in blds[i]["ring"]) else 1e9)
    print("buildings", len(blds), "clinic footprint area", round(blds[ci]["area"]), "centre", blds[ci]["c"])
    ground(); roads()
    bobj = buildings(blds, ci)
    front_x, fw, fh = clinic(blds[ci])
    trees(blds); global ROUTE; ROUTE = lane_marks_and_route()
    # OSM's road line sits a few metres off the building data here: shift the road layer so Commissioner Road runs in front
    # of the clinic with a ~2.5 m pavement (front + 2.5 + half of a 14 m road)
    rx = front_x + 2.5 + 7; dx = rx - 10.7
    for name in ("roads", "lanes", "route"): bpy.data.objects[name].location.x += dx
    print("front_x", round(front_x, 1), "road shift", round(dx, 1))
    world_and_sun()
    co = setup_camera()
    return sc, co, camera_path(front_x, rx), bobj, (front_x, fw, fh)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "still"
    sc, co, at, bobj, fac = build()
    if mode == "still":
        QC.mkdir(parents=True, exist_ok=True)
        for fr in map(int, sys.argv[2:] or ["0", "120", "200", "239"]):
            pose(co, at, fr, bobj); sc.frame_set(fr)
            sc.render.filepath = str(QC / f"still_{fr:04d}.png"); t = time.time()
            bpy.ops.render.render(write_still=True); print("frame", fr, "rendered in", round(time.time() - t, 1), "s")
    else:
        a = int(sys.argv[2]) if len(sys.argv) > 2 else 0; b = int(sys.argv[3]) if len(sys.argv) > 3 else N - 1
        OUT.mkdir(parents=True, exist_ok=True)
        ov_path = ROOT / "src/data/zoom3d-overlay.json"
        ov = json.loads(ov_path.read_text()) if ov_path.exists() else {"fps": FPS, "frames": {}}
        for fr in range(a, b + 1):
            pose(co, at, fr, bobj); sc.frame_set(fr)
            ov["frames"][str(fr)] = overlay_points(co, *fac, sc)
            p = OUT / f"{fr:04d}.png"
            if p.exists(): continue
            sc.render.filepath = str(p); t = time.time()
            bpy.ops.render.render(write_still=True); print("frame", fr, round(time.time() - t, 1), "s", flush=True)
            ov_path.write_text(json.dumps(ov))
        ov["n"] = N; ov_path.write_text(json.dumps(ov))
