"""modelgen: our own text → 3D generator for dental objects (headless Blender, pure code, no AI service, no uploads).

  python3 scripts/blender/modelgen.py "<description>" [--out public/models/x.glb] [--preview out/x.png] [--size 800] [--samples 64] [--view auto|occlusal|front|lingual]
      [--look default|chrome|crystal|lowpoly|toy|hologram|particles]
      [--clip out/x.mp4 --move orbit|dolly_in|dolly_out|low_arc|crane|tilt|pendulum|ground_skim|close_up|snap_zoom|fpv|static --frames 36 --fps 12]
  python3 scripts/blender/modelgen.py --list

Understands (keywords, any order):
  teeth        incisor (central/lateral) · canine · premolar · molar   + upper/lower
               + cavity/decay at occlusal | mesial | distal | cervical | incisal, small/large/deep
               + "prepared" (clean cavity) or "restored"/"filling" (composite in place) · "deep fissures" · "no root"
  implant      "implant 4 x 10" (diameter × length, mm) + "with abutment" + "with crown"
  instruments  handpiece · curing light · composite syringe (+ "with paste") · mouth mirror · probe/explorer
Everything is generic (no brands) and an illustration: not to scale, not a patient's anatomy.
Units: 1 = 1 cm. Crown up (+z), buccal/labial towards −y. Output: .glb (Blender + three.js) and a preview still.
"""
import math
import re
import sys

import bpy  # first: the bpy wheel provides bmesh / mathutils
import bmesh
from mathutils import Euler, Matrix, Vector

# ---------------------------------------------------------------------------------------------- parser

KINDS = {
    "handpiece": ["handpiece", "turbine", "drill"],
    "curing_light": ["curing light", "light cure", "curing-light", "cure light"],
    "syringe": ["syringe", "composite tube", "compule"],
    "mirror": ["mirror"],
    "probe": ["probe", "explorer"],
    "implant": ["implant"],
    "molar": ["molar"],
    "premolar": ["premolar", "bicuspid"],
    "canine": ["canine", "cuspid"],
    "incisor": ["incisor", "central", "lateral", "front tooth"],
}


def parse(text):
    t = " " + text.lower().replace("-", " ") + " "
    has = lambda *ws: any(w in t for w in ws)
    kind = None
    # "premolar" contains "molar": check premolar first; instruments before teeth ("composite syringe")
    for k in ["handpiece", "curing_light", "syringe", "mirror", "probe", "implant", "premolar", "molar", "canine", "incisor"]:
        if any(w in t for w in KINDS[k]):
            kind = k
            break
    if not kind:
        raise SystemExit(f"modelgen: I don't know how to build '{text}'. Try --list.")
    spec = {"kind": kind, "text": text}
    if kind in ("molar", "premolar", "canine", "incisor"):
        spec["arch"] = "lower" if has("lower", "mandibular") else "upper"
        spec["lateral"] = has("lateral")
        spec["root"] = not has("no root", "crown only")
        spec["fissures"] = 1.7 if has("deep fissure", "deep groove") else 1.0
        if has("cavity", "caries", "decay", "lesion", "prepared", "prep ", "restored", "filling", "restoration"):
            loc = next((l for l in ["occlusal", "mesial", "distal", "cervical", "incisal"] if l in t), "occlusal" if kind in ("molar", "premolar") else "mesial")
            size = 1.45 if has("large", "deep cavity", "big") else 0.7 if has("small") else 1.0
            state = "restored" if has("restored", "filling", "restoration") else "prepared" if has("prepared", "prep ") else "decay"
            spec["cavity"] = {"at": loc, "size": size, "state": state}
    if kind == "implant":
        m = re.search(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)", t)
        spec["diameter"], spec["length"] = (float(m.group(1)), float(m.group(2))) if m else (4.0, 10.0)
        spec["abutment"] = has("abutment", "crown")
        spec["crown"] = has("crown")
    if kind == "syringe":
        spec["paste"] = has("paste", "extrud")
    return spec


# ---------------------------------------------------------------------------------------------- helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, base, rough=0.3, sss=0.0, sss_r=(1, 0.6, 0.4), coat=0.0, metal=0.0, trans=0.0, emit=None, ior=None, bump=None):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Subsurface Weight"].default_value = sss
    p.inputs["Subsurface Radius"].default_value = sss_r
    p.inputs["Subsurface Scale"].default_value = 0.12
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Transmission Weight"].default_value = trans
    if ior:
        p.inputs["IOR"].default_value = ior
    if emit:
        p.inputs["Emission Color"].default_value = (*emit[0], 1)
        p.inputs["Emission Strength"].default_value = emit[1]
    if bump:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        tex = nt.nodes.new("ShaderNodeTexNoise")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = bump[0]
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump[1]
        nt.links.new(tex.outputs[0], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], p.inputs["Normal"])
    return m


def M():
    """Material library (generic, no brands)."""
    return {
        # layered tooth (direction A): a translucent enamel shell over a warm dentin core; perikymata as fine horizontal bands
        "enamel": mat("enamel", (0.93, 0.91, 0.87), rough=0.22, sss=0.12, sss_r=(1.0, 0.8, 0.6), coat=0.45, trans=0.68, ior=1.63, bump=((2, 2, 170), 0.1)),
        "enamel_post": mat("enamel_post", (0.92, 0.9, 0.85), rough=0.24, sss=0.25, sss_r=(1.0, 0.8, 0.6), coat=0.4, trans=0.38, ior=1.63, bump=((2, 2, 170), 0.08)),
        "core": mat("dentin_core", (0.86, 0.66, 0.4), rough=0.5, sss=1.0, sss_r=(1.0, 0.6, 0.3)),
        "root": mat("root", (0.86, 0.74, 0.55), rough=0.55, sss=0.4, bump=((60, 60, 60), 0.1)),
        "dentin": mat("dentin", (0.87, 0.72, 0.5), rough=0.5, sss=0.5),
        "decay": mat("decay", (0.16, 0.09, 0.05), rough=0.8, bump=((120, 120, 120), 0.5)),
        "composite": mat("composite", (0.93, 0.9, 0.82), rough=0.3, sss=0.3, coat=0.3),
        "steel": mat("steel", (0.76, 0.77, 0.79), rough=0.24, metal=1.0, bump=((300, 300, 3), 0.04)),
        "steel_dark": mat("steel_dark", (0.3, 0.31, 0.33), rough=0.35, metal=1.0),
        "titanium": mat("titanium", (0.7, 0.7, 0.72), rough=0.38, metal=1.0, bump=((250, 250, 250), 0.08)),
        "mirror": mat("mirror", (0.95, 0.95, 0.96), rough=0.02, metal=1.0),
        "diamond": mat("diamond", (0.62, 0.58, 0.48), rough=0.7, metal=0.6, bump=((500, 500, 500), 0.6)),
        "plastic": mat("plastic", (0.9, 0.9, 0.88), rough=0.35, coat=0.3),
        "plastic_dark": mat("plastic_dark", (0.05, 0.05, 0.055), rough=0.3, coat=0.4),
        "band": mat("band", (0.5, 0.41, 0.32), rough=0.4),  # brand bronze, colour band only (no text, no logo)
        "guide": mat("guide", (0.02, 0.02, 0.025), rough=0.08, coat=1.0),
        "blue": mat("blue", (0.1, 0.3, 1.0), rough=0.3, emit=((0.15, 0.35, 1.0), 6.0)),
        "ceramic": mat("ceramic", (0.93, 0.9, 0.83), rough=0.14, sss=0.3, coat=0.9),
    }


def new_obj(name, verts, faces, material=None, smooth=True, split=None, subsurf=0):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for p in me.polygons:
        p.use_smooth = smooth
    if subsurf:
        s = ob.modifiers.new("sub", "SUBSURF")
        s.levels = s.render_levels = subsurf
    if split:
        e = ob.modifiers.new("split", "EDGE_SPLIT")
        e.split_angle = math.radians(split)
    if material:
        ob.data.materials.append(material)
    return ob


def lathe(name, profile, material, n=64, split=38):
    """Revolve [(r, z), …] around z. Ends with r > 0 are capped."""
    verts, faces = [], []
    for r, z in profile:
        for i in range(n):
            a = 2 * math.pi * i / n
            verts.append((r * math.cos(a), r * math.sin(a), z))
    for j in range(len(profile) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    if profile[0][0] > 1e-6:
        faces.append(tuple(range(n - 1, -1, -1)))
    if profile[-1][0] > 1e-6:
        faces.append(tuple(range((len(profile) - 1) * n, len(profile) * n)))
    return new_obj(name, verts, faces, material, split=split)


def tube(name, pts, radius, material, res=4):
    """A rod along 3D points (curve with a round bevel), converted to a mesh so it exports."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("NURBS" if len(pts) > 3 else "POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    if len(pts) > 3:
        sp.use_endpoint_u = True
        sp.order_u = 3
    cu.resolution_u = 16
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    mo = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(mo)
    for p in me.polygons:
        p.use_smooth = True
    return mo


def place(ob, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    ob.location = loc
    ob.rotation_euler = [math.radians(a) for a in rot]
    ob.scale = scale
    return ob


def group(name, objs):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    for o in objs:
        if o.parent is None:
            o.parent = e
    return e


def boolean(ob, cutter, op="DIFFERENCE"):
    b = ob.modifiers.new("bool", "BOOLEAN")
    b.object = cutter
    b.operation = op
    try:
        b.solver = "EXACT"
        b.material_mode = "TRANSFER"
    except Exception:
        pass
    # booleans must come before subdivision to stay crisp: move to the top
    while ob.modifiers[0] != b:
        with bpy.context.temp_override(object=ob):
            bpy.ops.object.modifier_move_up(modifier=b.name)


def bake(ob):
    """Apply modifiers (so later booleans see the smooth surface)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)
    return ob


# ---------------------------------------------------------------------------------------------- teeth

TOOTH = {  # half mesio-distal width w, half bucco-lingual depth d, crown height h, root length (cm)
    "incisor": dict(w=0.43, d=0.35, h=1.05, root=1.3),
    "canine": dict(w=0.39, d=0.4, h=1.1, root=1.7),
    "premolar": dict(w=0.36, d=0.45, h=0.8, root=1.4),
    "molar": dict(w=0.52, d=0.55, h=0.75, root=1.25),
}


def sellipse(w, d, th, n=2.4):
    c, s = math.cos(th), math.sin(th)
    return w * math.copysign(abs(c) ** (2 / n), c), d * math.copysign(abs(s) ** (2 / n), s)


def anterior_crown(kind, P, mats):
    """Incisor/canine crown: narrow neck, cingulum and lingual fossa, labial lobes, sharp mesial and rounded distal
    corner (incisor: mamelons; canine: one cusp tip). Mesial = +x, labial = −y."""
    nu, nv = 96, 72
    w, d, h = P["w"], P["d"], P["h"]
    verts, faces = [], []
    for j in range(nv + 1):
        v = j / nv
        ww = w * (0.64 + 0.36 * math.sin(min(1, v * 1.25) * math.pi / 2))
        dd = d * (1 - 0.86 * v ** 1.25)
        if kind == "canine":
            ww = w * (0.62 + 0.38 * math.sin(min(1, v * 1.6) * math.pi / 2)) * (1 - 0.6 * max(0, (v - 0.62) / 0.38) ** 1.5)
            dd = d * (1 - 0.8 * v ** 1.6)
        for i in range(nu):
            x, y = sellipse(ww, dd, 2 * math.pi * i / nu, 2.0)
            u = x / max(ww, 1e-3)  # −1 distal … +1 mesial
            if y < 0:  # labial: convex, with two faint developmental grooves between three lobes
                y *= 1.0 + 0.16 * (1 - u * u)
                y += 0.012 * (math.exp(-((u - 0.38) / 0.1) ** 2) + math.exp(-((u + 0.38) / 0.1) ** 2)) * math.sin(min(1, v * 1.4) * math.pi)
            else:  # lingual: cingulum bulge near the neck, then a scooped fossa between marginal ridges
                y *= 1.0 + 0.3 * math.exp(-((v - 0.22) / 0.16) ** 2) * (1 - u * u)
                y -= 0.5 * dd * math.exp(-((v - 0.62) / 0.22) ** 2) * (1 - u * u) ** 2
            z = v * h
            if kind == "incisor":
                # incisal corners: mesial stays almost square, distal is rounded off
                corner = max(0, u - 0.75) / 0.25 * 0.012 + max(0, -u - 0.6) / 0.4 * 0.06
                z -= corner * max(0, (v - 0.7) / 0.3) ** 2 * h
                if v > 0.96:
                    z += 0.022 * math.sin(3 * math.pi * (u + 1) / 2) * (v - 0.96) / 0.04
            if kind == "canine" and v > 0.6:
                z += 0.16 * (1 - abs(u)) * ((v - 0.6) / 0.4) ** 1.5
            verts.append((x, y, z))
    for j in range(nv):
        for i in range(nu):
            a, b = j * nu + i, j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    faces.append(tuple(range(nu - 1, -1, -1)))
    faces.append(tuple(range(nv * nu, (nv + 1) * nu)))
    return new_obj("crown", verts, faces, mats["enamel"], subsurf=1)


def occlusal(kind, arch, w, d, fissure):
    """Height field of the chewing surface: cusps (bumps) minus fissures (grooves) and a central fossa."""
    ridges = []
    if kind == "premolar":
        cusps = [(0, -0.55 * d, 0.2), (0, 0.5 * d, 0.14 if arch == "upper" else 0.08)]
        grooves = [((-0.75 * w, 0), (0.75 * w, 0))]
    elif arch == "upper":
        # 4 cusps: mesiobuccal, distobuccal, mesiopalatal (largest), distopalatal (smallest). An oblique ridge joins
        # MP to DB and separates the central fossa (with the buccal groove) from the distal fossa (distopalatal groove).
        cusps = [(0.5 * w, -0.52 * d, 0.19), (-0.48 * w, -0.5 * d, 0.17), (0.38 * w, 0.48 * d, 0.2), (-0.55 * w, 0.5 * d, 0.11)]
        grooves = [((0.78 * w, -0.05 * d), (0.2 * w, -0.12 * d)), ((0.2 * w, -0.12 * d), (0.02 * w, -0.9 * d)),
                   ((-0.82 * w, 0.12 * d), (-0.5 * w, 0.2 * d)), ((-0.5 * w, 0.2 * d), (-0.28 * w, 0.92 * d))]
        ridges = [((0.3 * w, 0.4 * d), (-0.38 * w, -0.4 * d))]
    else:  # lower molar: 5 cusps (3 buccal, 2 lingual), + shaped fissures with a distal fork
        cusps = [(0.6 * w, -0.5 * d, 0.18), (0.0, -0.55 * d, 0.17), (-0.62 * w, -0.4 * d, 0.12), (0.5 * w, 0.5 * d, 0.2), (-0.45 * w, 0.5 * d, 0.19)]
        grooves = [((0.85 * w, 0), (-0.85 * w, 0)), ((0.3 * w, -0.9 * d), (0.3 * w, 0)), ((-0.32 * w, -0.9 * d), (-0.3 * w, 0)), ((0.02 * w, 0), (0.02 * w, 0.9 * d))]

    def seg(px, py, a, b):
        ax, ay = a
        bx, by = b
        t = max(0, min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 + 1e-9)))
        return math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay))

    def f(x, y):
        z = sum(a * math.exp(-(((x - cx) / (0.42 * w)) ** 2 + ((y - cy) / (0.42 * d)) ** 2)) for cx, cy, a in cusps)
        g = min(seg(x, y, a, b) for a, b in grooves)
        z -= 0.085 * fissure * math.exp(-((g / 0.028) ** 2))  # sharp fissure
        z -= 0.05 * math.exp(-((g / 0.13) ** 2))  # the valley it runs in
        for a, b in ridges:
            z += 0.05 * math.exp(-((seg(x, y, a, b) / 0.12) ** 2))
        if not ridges:
            z -= 0.06 * math.exp(-((x / (0.5 * w)) ** 2 + (y / (0.5 * d)) ** 2))  # central fossa
        else:  # upper molar: a central fossa and a smaller distal fossa, either side of the oblique ridge
            z -= 0.06 * math.exp(-(((x - 0.2 * w) / (0.36 * w)) ** 2 + ((y + 0.12 * d) / (0.36 * d)) ** 2))
            z -= 0.04 * math.exp(-(((x + 0.5 * w) / (0.26 * w)) ** 2 + ((y - 0.2 * d) / (0.26 * d)) ** 2))
        return z

    return f


def posterior_crown(kind, arch, P, mats, fissure):
    nu, nv, nc = 128, 30, 40
    shear = 0.16 if (kind == "molar" and arch == "upper") else 0.0  # upper molars are rhomboid, not square
    w, d, h = P["w"], P["d"], P["h"]
    occ = occlusal(kind, arch, w, d, fissure)
    verts, faces = [], []
    wall = h * 0.82
    for j in range(nv + 1):  # side walls: cervical → occlusal rim, bulging at the height of contour
        v = j / nv
        k = 0.8 + 0.22 * math.sin(min(1, v * 1.25) * math.pi * 0.62) - 0.1 * max(0, v - 0.75) / 0.25
        for i in range(nu):
            x, y = sellipse(w * k, d * k, 2 * math.pi * i / nu, 2.9 if kind == "molar" else 2.4)
            verts.append((x + shear * y * (0.4 + 0.6 * v), y, v * wall))
    rim_k = 0.8 + 0.22 * math.sin(math.pi * 0.62) - 0.1
    for j in range(nv):
        for i in range(nu):
            a, b = j * nu + i, j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    base = len(verts)
    for c in range(1, nc):  # occlusal table: rings shrinking to the centre, displaced by the height field
        r = 1 - c / nc
        for i in range(nu):
            x, y = sellipse(w * rim_k * r, d * rim_k * r, 2 * math.pi * i / nu, 2.9 if kind == "molar" else 2.4)
            edge = 1 - r ** 5  # 0 at the rim (meets the wall), 1 inside
            verts.append((x + shear * y, y, wall + (0.02 + occ(x, y)) * edge))
    for c in range(nc - 1):
        r0 = nv * nu if c == 0 else base + (c - 1) * nu
        r1 = base + c * nu
        for i in range(nu):
            faces.append((r0 + i, r0 + (i + 1) % nu, r1 + (i + 1) % nu, r1 + i))
    centre = len(verts)
    verts.append((0, 0, wall + 0.02 + occ(0, 0)))
    last = base + (nc - 2) * nu
    for i in range(nu):
        faces.append((last + i, last + (i + 1) % nu, centre))
    faces.append(tuple(range(nu - 1, -1, -1)))
    return new_obj("crown", verts, faces, mats["enamel_post"], subsurf=1)


def root(name, w, d, length, mats, offset=(0, 0), lean=(0, 0), top=0.0):
    nu, nv = 40, 24
    verts, faces = [], []
    for j in range(nv + 1):
        v = j / nv
        k = max(0.0, 1 - v ** 2.4) ** 0.62 * (1 - 0.25 * v) + 0.015
        for i in range(nu):
            x, y = sellipse(w * k, d * k, 2 * math.pi * i / nu, 2.2)
            verts.append((offset[0] + x + lean[0] * v ** 2, offset[1] + y + lean[1] * v ** 2, top - v * length))
    for j in range(nv):
        for i in range(nu):
            a, b = j * nu + i, j * nu + (i + 1) % nu
            faces.append((a + nu, b + nu, b, a))
    faces.append(tuple(range(nv * nu, (nv + 1) * nu)))
    faces.append(tuple(range(nu)))
    return new_obj(name, verts, faces, mats["root"], subsurf=1)


def tooth(spec, mats):
    kind, arch = spec["kind"], spec["arch"]
    P = dict(TOOTH[kind])
    if spec.get("lateral"):
        P = {k: v * (0.82 if k != "root" else 0.95) for k, v in P.items()}
    if kind == "molar" and arch == "lower":
        P["w"], P["d"] = 0.56, 0.5
    if kind == "molar" and arch == "upper":
        P["w"], P["d"] = 0.5, 0.57  # wider bucco-palatally
    crown = anterior_crown(kind, P, mats) if kind in ("incisor", "canine") else posterior_crown(kind, arch, P, mats, spec["fissures"])
    # dentin core inside the enamel shell: stops short of the edge so the incisal / cusp tips stay translucent
    core = crown.copy()
    core.data = crown.data.copy()
    core.name = "dentin"
    bpy.context.collection.objects.link(core)
    core.data.materials.clear()
    core.data.materials.append(mats["core"])
    ant = kind in ("incisor", "canine")
    for vt in core.data.vertices:
        x, y, z = vt.co
        zk = z / P["h"]
        if ant and kind == "incisor" and zk > 0.8:  # three mamelon lobes at the top of the core
            lobe = abs(math.sin(3 * math.pi * (x / P["w"] + 1) / 2))
            z -= 0.1 * (1 - lobe) * ((zk - 0.8) / 0.2) ** 1.5
        vt.co = (x * 0.8, y * (0.72 if ant else 0.8), 0.02 + z * (0.84 if ant else 0.8))
    parts = [crown, core]
    w, d, L = P["w"], P["d"], P["root"]
    if spec["root"]:
        if kind == "molar" and arch == "upper":  # two buccal roots + one palatal
            parts += [root("root_mb", w * 0.36, d * 0.34, L, mats, (w * 0.42, -d * 0.42), (0.08, -0.03), -0.1),
                      root("root_db", w * 0.33, d * 0.32, L * 0.95, mats, (-w * 0.42, -d * 0.42), (-0.06, -0.03), -0.1),
                      root("root_p", w * 0.42, d * 0.36, L * 1.05, mats, (0, d * 0.42), (0, 0.22), -0.1)]
            parts.append(root("trunk", w * 0.8, d * 0.8, 0.5, mats, top=0.08))
        elif kind == "molar":  # mesial + distal
            parts += [root("root_m", w * 0.38, d * 0.62, L, mats, (w * 0.45, 0), (-0.1, 0), -0.1),
                      root("root_d", w * 0.36, d * 0.58, L * 0.93, mats, (-w * 0.45, 0), (-0.12, 0), -0.1)]
            parts.append(root("trunk", w * 0.8, d * 0.78, 0.5, mats, top=0.08))
        else:
            parts.append(root("root", w * 0.74 * (0.8 if kind == "premolar" else 0.76), d * 0.78, L, mats, lean=(-0.08, 0), top=0.06))
    cav = spec.get("cavity")
    if cav:
        h = P["h"]
        s = cav["size"]
        at = {
            "occlusal": ((0, 0, h * 0.97), (0.36 * w * s, 0.3 * d * s, 0.17 * s)),
            "mesial": ((w * 0.86, 0, h * 0.58), (0.24 * s, 0.26 * s, 0.26 * s)),
            "distal": ((-w * 0.86, 0, h * 0.58), (0.24 * s, 0.26 * s, 0.26 * s)),
            "cervical": ((0, -d * 0.82, h * 0.2), (0.3 * s, 0.16 * s, 0.14 * s)),
            "incisal": ((w * 0.62, 0, h * 0.93), (0.22 * s, 0.3 * s, 0.2 * s)),
        }[cav["at"]]
        bake(crown)
        bake(core)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1, location=at[0])
        cutter = bpy.context.active_object
        cutter.name = "cutter"
        cutter.scale = at[1]
        cutter.data.materials.append(mats["decay"] if cav["state"] == "decay" else mats["dentin"])
        for p in cutter.data.polygons:
            p.use_smooth = True
        crown.data.materials.append(cutter.data.materials[0])
        if cav["state"] == "restored":
            fill = crown.copy()
            fill.data = crown.data.copy()
            fill.name = "restoration"
            bpy.context.collection.objects.link(fill)
            fill.data.materials.clear()
            fill.data.materials.append(mats["composite"])
            boolean(fill, cutter, "INTERSECT")
            bake(fill)
            for p in fill.data.polygons:
                p.material_index = 0
            parts.append(fill)
        for layer in (crown, core):
            if layer is core:
                core.data.materials.append(cutter.data.materials[0])
            boolean(layer, cutter, "DIFFERENCE")
            bake(layer)
        bpy.data.objects.remove(cutter)
    g = group(spec["kind"], parts)
    if arch == "upper":
        g.rotation_euler = (0, math.radians(180), 0)  # crown hangs down; buccal/labial stays towards −y
    return g


# ---------------------------------------------------------------------------------------------- implant


def implant(spec, mats):
    r, L = spec["diameter"] / 20, spec["length"] / 10  # mm → cm (radius)
    body = lathe("fixture", [(r * 0.55, -L), (r * 0.72, -L + 0.06), (r * 0.98, -L * 0.25), (r, -0.12), (r * 1.04, -0.06), (r * 1.04, 0), (r * 0.5, 0), (r * 0.45, -0.25), (0.0001, -0.25)], mats["titanium"], split=50)
    N = 700
    pts = []
    for i in range(N):
        u = i / (N - 1)
        z = -0.2 - u * (L - 0.32)
        rr = r * (1.02 - 0.3 * u ** 2)
        a = u * 2 * math.pi * (L / 0.085)
        pts.append((rr * math.cos(a), rr * math.sin(a), z))
    cu = bpy.data.curves.new("thread", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(N - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
    cu.bevel_depth = 0.028
    cu.bevel_resolution = 2
    tmp = bpy.data.objects.new("thread", cu)
    bpy.context.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    thr = bpy.data.objects.new("thread", me)
    bpy.context.collection.objects.link(thr)
    thr.data.materials.append(mats["titanium"])
    for p in me.polygons:
        p.use_smooth = True
    parts = [body, thr]
    if spec["abutment"]:
        ab = lathe("abutment", [(r * 0.5, -0.2), (r * 0.5, 0.0), (r * 1.02, 0.02), (r * 1.08, 0.1), (r * 0.82, 0.2), (r * 0.6, 0.62), (r * 0.52, 0.66), (0.07, 0.66), (0.07, 0.5), (0.0001, 0.5)], mats["steel"], split=45)
        ab.location.z = 0.9 if not spec["crown"] else 0.55
        parts.append(ab)
    if spec["crown"]:
        cr = posterior_crown("premolar", "upper", TOOTH["premolar"], mats, 1.0)
        cr.name = "crown"
        cr.data.materials.clear()
        cr.data.materials.append(mats["ceramic"])
        cr.location.z = 1.75
        parts.append(cr)
    return group("implant", parts)


# ---------------------------------------------------------------------------------------------- instruments


def knurl(z0, z1, r, step=0.11, depth=0.018):
    out, z, k = [], z0, 0
    while z < z1:
        out.append((r - (depth if k % 2 else 0), z))
        out.append((r - (depth if k % 2 else 0), min(z1, z + step * 0.5)))
        z += step * 0.5
        k += 1
    return out


def handpiece(spec, mats):
    S = mats["steel"]
    prof = [(0.36, 0), (0.5, 0.05), (0.5, 0.5), (0.44, 0.55), (0.44, 0.75), (0.52, 0.8), (0.52, 1.3), (0.49, 1.4)]
    prof += [(0.49, 3.0)] + knurl(3.0, 6.6, 0.49) + [(0.47, 6.7), (0.4, 8.2), (0.3, 9.4), (0.27, 9.6)]
    body = lathe("body", prof, S)
    ang = 20
    neck = place(lathe("neck", [(0.27, -0.05), (0.27, 1.2), (0.3, 1.8), (0.34, 2.15)], S), (0, 0, 9.55), (ang, 0, 0))
    R = Euler((math.radians(ang), 0, 0)).to_matrix()
    hp = Vector((0, 0, 9.55)) + R @ Vector((0, 0, 2.2))
    head = lathe("head", [(0.3, -0.62), (0.5, -0.56), (0.54, -0.2), (0.54, 0.42), (0.5, 0.56), (0.36, 0.62), (0.3, 0.7), (0.0001, 0.72)], S)
    place(head, hp, (ang + 90, 0, 0))
    Rh = Euler((math.radians(ang + 90), 0, 0)).to_matrix()
    chuck = place(lathe("chuck", [(0.16, 0), (0.16, 0.18), (0.11, 0.22)], mats["steel_dark"]), hp + Rh @ Vector((0, 0, -0.84)), (ang + 90, 0, 0))
    bur = place(lathe("bur", [(0.0001, 0), (0.045, 0.03), (0.075, 0.42), (0.06, 0.5), (0.05, 0.56), (0.05, 1.0)], mats["diamond"], n=24), hp + Rh @ Vector((0, 0, -1.72)), (ang + 90, 0, 0))
    for o in (chuck, bur):
        o.name = o.name
    spray = [place(lathe(f"port{i}", [(0.035, 0), (0.035, 0.03)], mats["steel_dark"], n=12), hp + Rh @ Vector((0.3 * math.cos(a), 0.3 * math.sin(a), -0.63)), (ang + 90, 0, 0)) for i, a in enumerate([0.6, 2.5, 4.4])]
    coupling = lathe("coupling", [(0.3, -0.5), (0.3, -0.05), (0.36, 0)], mats["steel_dark"])
    g = group("handpiece", [body, neck, head, chuck, bur, coupling, *spray])
    g.rotation_euler = (math.radians(-90), 0, math.radians(-35))
    return g


def curing_light(spec, mats):
    body = lathe("body", [(0.0001, 0), (0.6, 0.1), (0.85, 1.2), (0.9, 4.5), (0.8, 8.5), (0.62, 11.0), (0.55, 11.6)], mats["plastic"], split=60)
    band = lathe("band", [(0.905, 4.6), (0.915, 4.7), (0.9, 5.6), (0.885, 5.7)], mats["band"])
    collar = lathe("collar", [(0.56, 11.55), (0.6, 11.6), (0.6, 12.0), (0.48, 12.1)], mats["steel"])
    pts = [(0, 0, 12.0), (0, 0, 13.6), (0, 0, 15.2), (0, -0.5, 16.3), (0, -1.5, 16.9), (0, -2.3, 16.95)]
    guide = tube("guide", pts, 0.4, mats["guide"])
    tip = place(lathe("tip", [(0.0001, 0), (0.36, 0), (0.36, 0.04)], mats["blue"], n=32), (0, -2.33, 16.95), (90, 0, 0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, -0.86, 7.4), segments=32, ring_count=16)
    btn = bpy.context.active_object
    btn.name = "button"
    btn.scale = (1, 0.35, 1.6)
    btn.data.materials.append(mats["band"])
    for p in btn.data.polygons:
        p.use_smooth = True
    g = group("curing_light", [body, band, collar, guide, tip, btn])
    g.rotation_euler = (math.radians(-90), 0, math.radians(-35))
    return g


def syringe(spec, mats):
    barrel = lathe("barrel", [(0.42, 0), (0.45, 0.05), (0.45, 5.6), (0.36, 5.9), (0.22, 6.5), (0.2, 7.0), (0.14, 7.05), (0.14, 6.6), (0.0001, 6.6)], mats["plastic_dark"])
    band = lathe("band", [(0.455, 3.9), (0.46, 3.95), (0.46, 5.0), (0.455, 5.05)], mats["band"])
    flange = lathe("flange", [(0.45, 0), (1.05, 0.02), (1.08, 0.1), (1.05, 0.2), (0.45, 0.22)], mats["plastic_dark"])
    flange.scale = (1, 0.55, 1)
    rod = lathe("plunger", [(0.7, -3.3), (0.72, -3.2), (0.72, -3.05), (0.22, -3.0), (0.22, 0.3)], mats["plastic"])
    parts = [barrel, band, flange, rod]
    if spec.get("paste"):
        parts.append(tube("paste", [(0, 0, 7.0), (0, 0, 7.3), (0.02, 0.05, 7.6), (0.1, 0.15, 7.85), (0.22, 0.2, 7.95)], 0.13, mats["composite"]))
    else:
        parts.append(lathe("cap", [(0.24, 6.55), (0.26, 6.6), (0.26, 7.3), (0.2, 7.4), (0.0001, 7.42)], mats["plastic"]))
    g = group("syringe", parts)
    g.rotation_euler = (math.radians(-90), 0, math.radians(-35))
    return g


def handle(mats, length=11.0, r=0.26):
    prof = [(0.0001, 0), (r * 0.8, 0.05), (r, 0.3), (r, 2.0)] + knurl(2.0, 5.5, r) + [(r, 5.6), (r, length - 1.6)] + knurl(length - 1.6, length - 0.6, r, 0.14) + [(r * 0.7, length - 0.2), (0.1, length)]
    return lathe("handle", prof, mats["steel"])


def mirror(spec, mats):
    h = handle(mats)
    neck = tube("neck", [(0, 0, 11.0), (0, 0, 12.0), (0, 0, 13.0), (0, -0.4, 13.8), (0, -0.9, 14.3)], 0.085, mats["steel"])
    rim = place(lathe("rim", [(0.0001, -0.07), (1.06, -0.07), (1.12, -0.02), (1.12, 0.05), (1.04, 0.07), (1.04, 0.045)], mats["steel"]), (0, -1.75, 14.95), (-52, 0, 0))
    face = place(lathe("glass", [(0.0001, 0.045), (1.04, 0.045)], mats["mirror"], n=64), (0, -1.75, 14.95), (-52, 0, 0))
    g = group("mirror", [h, neck, rim, face])
    g.rotation_euler = (math.radians(-90), 0, math.radians(-35))
    return g


def probe(spec, mats):
    h = handle(mats)
    tip = tube("tip", [(0, 0, 11.0), (0, 0, 11.8), (0, 0, 12.6), (0, -0.25, 13.3), (0, -0.2, 13.9), (0, 0.25, 14.3), (0, 0.6, 14.25)], 0.055, mats["steel"], res=3)
    end = place(lathe("point", [(0.055, 0), (0.0001, 0.35)], mats["steel"], n=16), (0, 0.6, 14.25), (-100, 0, 0))
    g = group("probe", [h, tip, end])
    g.rotation_euler = (math.radians(-90), 0, math.radians(-35))
    return g


BUILD = {"handpiece": handpiece, "curing_light": curing_light, "syringe": syringe, "mirror": mirror, "probe": probe, "implant": implant,
         "molar": tooth, "premolar": tooth, "canine": tooth, "incisor": tooth}

# ---------------------------------------------------------------------------------------------- output


def bounds():
    dg = bpy.context.evaluated_depsgraph_get()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        ev = ob.evaluated_get(dg)
        for c in ev.bound_box:
            p = ev.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


LOOKS = ["default", "chrome", "crystal", "lowpoly", "toy", "hologram", "particles", "fur"]
MOVES = ["static", "dolly_in", "dolly_out", "orbit", "low_arc", "crane", "tilt", "pendulum", "ground_skim", "close_up", "snap_zoom", "fpv"]


def apply_look(look):
    """Restyle every mesh (our own "animation styles" for 3D): chrome, crystal, low poly, toy, hologram, particles."""
    if look == "default":
        return
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

    def override(o, m):
        o.data.materials.clear()
        o.data.materials.append(m)

    def faces_of(o):
        dg = bpy.context.evaluated_depsgraph_get()
        return max(1, len(o.evaluated_get(dg).data.polygons))

    def facet(o, target):
        """Decimate to about `target` faces (density-independent), flat shaded."""
        dm = o.modifiers.new("dec", "DECIMATE")
        dm.ratio = min(1.0, target / faces_of(o))
        bake(o)
        for p in o.data.polygons:
            p.use_smooth = False

    if look == "chrome":
        m = mat("look_chrome", (0.92, 0.93, 0.96), rough=0.04, metal=1.0)
        for o in meshes:
            override(o, m)
    elif look == "crystal":
        m = mat("look_crystal", (1, 1, 1), rough=0.0, trans=1.0, ior=1.9)
        for o in meshes:
            facet(o, 260)
            override(o, m)
    elif look == "lowpoly":
        for o in meshes:
            base = o.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value[:3] if o.data.materials else (0.8, 0.8, 0.8)
            metal = o.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value if o.data.materials else 0
            facet(o, 70)
            override(o, mat("lp_" + o.name, (0.62, 0.66, 0.72) if metal > 0.5 else base, rough=0.75))
    elif look == "toy":
        for o in meshes:
            src = o.data.materials[0].node_tree.nodes["Principled BSDF"] if o.data.materials else None
            base = src.inputs["Base Color"].default_value[:3] if src else (0.9, 0.9, 0.9)
            metal = src.inputs["Metallic"].default_value if src else 0
            override(o, mat("toy_" + o.name, (0.55, 0.68, 0.9) if metal > 0.5 else base, rough=0.28, coat=1.0, sss=0.2))
    elif look == "hologram":
        m = mat("look_holo", (0.0, 0.02, 0.03), rough=0.4, emit=((0.15, 0.8, 1.0), 5.0))
        for o in meshes:
            dm = o.modifiers.new("dec", "DECIMATE")
            dm.ratio = min(1.0, 420 / faces_of(o))
            wf = o.modifiers.new("wire", "WIREFRAME")
            wf.thickness = 0.008
            bake(o)
            override(o, m)
    elif look == "fur":  # soft plush fur (a playful "fluffy tooth" mascot look; never for clinical explanation)
        fur = mat("look_fur", (0.96, 0.93, 0.88), rough=0.6, sss=0.3)
        for o in meshes:
            if o.name.startswith(("dentin", "root", "trunk")):
                continue
            override(o, fur)
            ps = o.modifiers.new("fur", "PARTICLE_SYSTEM").particle_system.settings
            ps.type = "HAIR"
            ps.count = 9000
            ps.hair_length = 0.24
            ps.child_type = "INTERPOLATED"
            ps.rendered_child_count = 12
            ps.child_length = 0.9
            ps.roughness_2 = 0.15
            ps.kink = "CURL"
            ps.kink_amplitude = 0.03
            ps.root_radius = 0.012
            ps.tip_radius = 0.0
            ps.material = 1
            o.data.materials.append(mat("look_fur_hair", (0.97, 0.94, 0.9), rough=0.5))
        bpy.context.scene.render.hair_type = "STRIP"
        bpy.context.scene.cycles_curves.shape = "THICK" if hasattr(bpy.context.scene, "cycles_curves") else None
    elif look == "particles":
        m = mat("look_particles", (0.0, 0.0, 0.0), emit=((1.0, 0.75, 0.45), 6.0))
        pts = []
        dg = bpy.context.evaluated_depsgraph_get()
        for o in meshes:
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            step = max(1, len(me.vertices) // 900)
            pts += [ev.matrix_world @ me.vertices[i].co for i in range(0, len(me.vertices), step)]
            ev.to_mesh_clear()
        for o in meshes:
            bpy.data.objects.remove(o)
        verts, faces = [], []
        r = 0.008
        import random
        rnd = random.Random(3)
        for k, p in enumerate(pts):
            p = p + Vector((rnd.gauss(0, 0.02), rnd.gauss(0, 0.02), rnd.gauss(0, 0.02)))
            b = len(verts)
            verts += [(p.x + r, p.y, p.z), (p.x - r, p.y, p.z), (p.x, p.y + r, p.z), (p.x, p.y - r, p.z), (p.x, p.y, p.z + r), (p.x, p.y, p.z - r)]
            faces += [(b, b + 2, b + 4), (b + 2, b + 1, b + 4), (b + 1, b + 3, b + 4), (b + 3, b, b + 4), (b + 2, b, b + 5), (b + 1, b + 2, b + 5), (b + 3, b + 1, b + 5), (b, b + 3, b + 5)]
        new_obj("particles", verts, faces, m, smooth=False)


def camera_move(move, t, c, d, dist, R, up):
    """Camera moves (names from film grammar). t 0→1. Returns (position, look-at point, lens mm)."""
    e = t * t * (3 - 2 * t)  # ease in-out
    side = Vector((-d.y, d.x, 0)).normalized()
    Z = Vector((0, 0, 1))

    def orbit(a, elev=0.0, k=1.0):
        q = Matrix.Rotation(a, 4, "Z") @ d
        q = (q + Z * elev).normalized()
        return c + q * dist * k

    if move == "dolly_in":
        return c + d * dist * (1.35 - 0.6 * e), c, 85
    if move == "dolly_out":
        return c + d * dist * (0.75 + 0.6 * e), c, 85
    if move == "orbit":
        return orbit(math.radians(-50 + 100 * e)), c, 85
    flat = Vector((d.x, d.y, 0)).normalized()
    if move == "low_arc":  # low, just above the subject's centre, sweeping round it
        q = (Matrix.Rotation(math.radians(-45 + 90 * e), 4, "Z") @ flat + Z * 0.12 * up).normalized()
        return c + q * dist * 0.9, c, 60
    if move == "crane":  # rises from eye level to looking down
        return c + (flat + Z * (0.05 + 1.4 * e) * up).normalized() * dist, c, 85
    if move == "tilt":
        return c + d * dist * 0.8, c + Z * R * (-0.9 + 1.8 * e) * up, 85
    if move == "pendulum":
        return orbit(math.radians(28 * math.sin(t * math.pi * 2))), c, 85
    if move == "ground_skim":
        return c + (flat + Z * 0.2 * up) * dist * 0.8 + side * R * (-0.9 + 1.8 * e), c + side * R * (-0.4 + 0.8 * e), 50
    if move == "close_up":
        return c + d * dist * 0.5 + side * R * 0.05 * math.sin(t * math.pi * 2), c + Z * R * 0.2 * up, 110
    if move == "snap_zoom":
        k = 0 if t < 0.45 else min(1, (t - 0.45) / 0.12)
        return c + d * dist, c, 60 + 90 * (1 - (1 - k) ** 3)
    if move == "fpv":
        a = math.radians(-70 + 150 * e)
        return orbit(a, elev=0.35 * math.sin(t * math.pi) * up, k=0.85 - 0.35 * math.sin(t * math.pi)), c, 40
    return c + d * dist, c, 85  # static


def preview(spec, path, size, samples, view="auto", look="default", move=None, frames=36, fps=12):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    bg = {"toy": (0.2, 0.32, 0.5), "chrome": (0.03, 0.035, 0.05), "hologram": (0.0, 0.004, 0.01), "particles": (0.004, 0.003, 0.002)}.get(look, (0.012, 0.014, 0.016))
    w.node_tree.nodes["Background"].inputs[0].default_value = (*bg, 1)
    if look in ("chrome", "crystal"):  # something to reflect and refract: a studio gradient instead of black
        nt = w.node_tree
        grad = nt.nodes.new("ShaderNodeTexGradient")
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        el = ramp.color_ramp.elements
        el[0].color, el[0].position = (0.22, 0.23, 0.26, 1), 0.0  # floor bounce
        el[1].color, el[1].position = (0.95, 0.96, 1.0, 1), 1.0  # bright sky
        mid = el.new(0.5)
        mid.color = (0.01, 0.012, 0.02, 1)  # dark horizon band: gives chrome its contrast line
        hi = el.new(0.62)
        hi.color = (0.6, 0.62, 0.7, 1)
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = -1.0
        mr.inputs["From Max"].default_value = 1.0
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], nt.nodes["Background"].inputs[0])
        nt.nodes["Background"].inputs[1].default_value = 1.2
        del grad
    apply_look(look)
    lo, hi = bounds()
    c = (lo + hi) / 2
    R = (hi - lo).length / 2
    is_tooth = spec["kind"] in TOOTH
    if not is_tooth or look == "toy":  # floor for a soft contact shadow
        bpy.ops.mesh.primitive_plane_add(size=R * 40, location=(c.x, c.y, lo.z - 0.02))
        bpy.context.active_object.data.materials.append(mat("floor", (0.3, 0.42, 0.6) if look == "toy" else (0.004, 0.005, 0.005), rough=0.9))
    upper = spec.get("arch") == "upper"
    up = -1 if upper else 1
    d = Vector((0.55, -1, 0.5 if not is_tooth else 0.68 * up)).normalized()
    if view == "occlusal":
        d = Vector((0.12, -0.35, 1.0 * up)).normalized()
    elif view == "front":
        d = Vector((0.1, -1, 0.12 * up)).normalized()
    elif view == "lingual":
        d = Vector((-0.35, 1, 0.3 * up)).normalized()
    cam = bpy.data.cameras.new("cam")
    cam.lens = 85
    ob = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(ob)
    dist = R / math.tan(math.atan(18 / 85)) * 1.12
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = 1.2 if look == "toy" else (8 if not is_tooth else 5.6)  # toy: miniature tilt-shift feel
    sc.camera = ob

    def aim(pos, look_at, lens):
        ob.location = pos
        ob.rotation_euler = (look_at - pos).to_track_quat("-Z", "Y").to_euler()
        cam.lens = lens
        cam.dof.focus_distance = (c - pos).length

    def area(loc, power, color, sz):
        l = bpy.data.lights.new("l", "AREA")
        l.size = sz * R
        l.energy = power * R * R
        l.color = color
        o = bpy.data.objects.new("l", l)
        sc.collection.objects.link(o)
        o.location = c + Vector(loc) * R
        o.rotation_euler = (c - o.location).to_track_quat("-Z", "Y").to_euler()

    if look not in ("hologram", "particles"):
        area((2.2, -3.2, 2.6 * up), 420, (1, 0.96, 0.9), 2.2)  # warm key (from the crown side)
        area((-3.0, 2.2, 1.4 * up), 650, (0.75, 0.85, 1.0), 1.4)  # cool rim
        area((-2.0, -3.0, -0.6 * up), 60, (1, 1, 1), 3.0)  # fill
    if is_tooth and look == "default":
        area((0.0, 3.4, 2.0 * up), 380, (1.0, 0.95, 0.88), 2.0)  # behind the edge: shows the translucent enamel
    if look in ("crystal", "chrome"):  # coloured strips: rainbow glints in the facets / reflections
        for k, col in enumerate([(1, 0.2, 0.2), (1, 0.8, 0.1), (0.2, 1, 0.4), (0.2, 0.5, 1), (0.8, 0.3, 1)]):
            a = -1.2 + k * 0.6
            area((3.2 * math.sin(a), 3.2 * math.cos(a), (0.6 + 0.5 * k) * up), 260, col, 0.5)
    if not move:
        aim(c + d * dist, c, 85)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        return
    import os
    import subprocess
    import tempfile
    tmp = tempfile.mkdtemp(prefix="modelgen-")
    for f in range(frames):
        aim(*camera_move(move, f / max(1, frames - 1), c, d, dist, R, up))
        sc.render.filepath = os.path.join(tmp, f"{f:04d}.png")
        bpy.ops.render.render(write_still=True)
    subprocess.check_call(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-framerate", str(fps), "-i", os.path.join(tmp, "%04d.png"),
                           "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path])


def selftest():
    a = parse("lower first molar with deep fissures")
    assert a["kind"] == "molar" and a["arch"] == "lower" and a["fissures"] > 1 and "cavity" not in a
    b = parse("upper premolar, small mesial cavity, prepared")
    assert b["kind"] == "premolar" and b["cavity"] == {"at": "mesial", "size": 0.7, "state": "prepared"}
    c = parse("Implant 3.5 x 11.5 with crown")
    assert c["kind"] == "implant" and c["diameter"] == 3.5 and c["length"] == 11.5 and c["abutment"] and c["crown"]
    assert parse("composite syringe with paste")["kind"] == "syringe" and parse("light-cure unit, curing light")["kind"] == "curing_light"
    assert parse("central incisor with composite filling")["cavity"]["state"] == "restored"
    print("modelgen selftest ok")


def main():
    args = sys.argv[1:]
    if "--selftest" in args:
        return selftest()
    if "--list" in args or not args:
        print(__doc__)
        return
    opt = lambda n, d=None: args[args.index(n) + 1] if n in args else d
    text = args[0]
    spec = parse(text)
    print("spec:", {k: v for k, v in spec.items() if k != "text"})
    reset()
    BUILD[spec["kind"]](spec, M())
    out = opt("--out")
    if out:
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_apply=True, use_visible=True)
        print("model →", out)
    pv = opt("--preview")
    if pv:
        preview(spec, pv, int(opt("--size", "800")), int(opt("--samples", "64")), opt("--view", "auto"), opt("--look", "default"))
        print("preview →", pv)
    clip = opt("--clip")
    if clip:  # animated camera move → mp4 (run without --preview, or the look is applied twice)
        preview(spec, clip, int(opt("--size", "540")), int(opt("--samples", "24")), opt("--view", "auto"), opt("--look", "default") if not pv else "default",
                opt("--move", "orbit"), int(opt("--frames", "36")), int(opt("--fps", "12")))
        print("clip →", clip)


if __name__ == "__main__":
    main()
