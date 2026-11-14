"""Creative directions for 3D detailing, rendered in Blender Cycles (headless bpy, our own procedural models).

Usage: python3 scripts/blender/directions.py <A|B|C> <out.png> [--size 540x960] [--samples 96]
  A  Clinical macro   wet natural enamel: mamelons, incisal translucency, perikymata; dark field, rim light, shallow focus
  B  Studio product   implant + abutment + ceramic crown, exploded, brushed titanium and glaze on a cream seamless set
  C  Cutaway lesson   tooth cut in half: enamel / dentin / glowing pulp; deep blue studio for education
Every model is an illustration (keep "Illustration · not to scale"). Tripo-generated meshes, when used, replace the
procedural instruments only, never patient anatomy or results.
"""
import math
import sys

import bpy  # must come first: the bpy wheel provides bmesh and mathutils
import bmesh
from mathutils import Vector

direction = sys.argv[1] if len(sys.argv) > 1 else "A"
FLIP = 1.0  # 1: crowns hang down (upper arch); set per direction before materials are built
out = sys.argv[2] if len(sys.argv) > 2 else "/tmp/dir.png"
size = (540, 960)
samples = 96
for i, a in enumerate(sys.argv):
    if a == "--size":
        size = tuple(int(v) for v in sys.argv[i + 1].split("x"))
    if a == "--samples":
        samples = int(sys.argv[i + 1])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = size
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


# ---- geometry ------------------------------------------------------------------------------------------------
def tooth_mesh(name, root=True, scale=1.0, inner=0.0, down=False):
    """Upper central incisor as a lofted superellipse. v: 0 apex → 1 incisal edge. `inner` shrinks it (dentin/pulp)."""
    nu, nv = 64, 90
    v0 = 0.0 if root else 0.5
    verts, faces = [], []
    cerv = 0.55

    def width(v):
        if v < cerv:
            return 0.08 + (0.34 - 0.08) * (v / cerv) ** 0.7
        k = (v - cerv) / (1 - cerv)
        return 0.34 + 0.12 * math.sin(min(1, k * 1.3) * math.pi / 2) - 0.6 * max(0, k - 0.88) ** 1.5

    def depth(v):
        if v < cerv:
            return 0.1 + (0.36 - 0.1) * (v / cerv) ** 0.7
        k = (v - cerv) / (1 - cerv)
        return 0.36 - 0.3 * k ** 1.2

    H = 2.5
    for j in range(nv + 1):
        v = v0 + (1 - v0) * j / nv
        w, d = width(v) * (1 - inner), depth(v) * (1 - inner)
        z = (v - cerv) * H
        for i in range(nu):
            th = 2 * math.pi * i / nu
            c, s = math.cos(th), math.sin(th)
            n = 2.25
            x = w * math.copysign(abs(c) ** (2 / n), c)
            y = d * math.copysign(abs(s) ** (2 / n), s)
            if y < 0:  # labial face: gentle convexity
                y *= 1.0 + 0.15 * (1 - (x / max(w, 1e-3)) ** 2)
            zz = z
            if v > 0.97 and inner == 0:  # mamelons on the incisal edge
                zz += 0.025 * math.sin(3 * math.pi * (x / max(w, 1e-3) + 1) / 2) * (v - 0.97) / 0.03
            if v > 0.82 and inner > 0:  # dentin core: three mamelon lobes instead of a straight edge
                lobe = abs(math.sin(3 * math.pi * (x / max(w, 1e-3) + 1) / 2))
                zz -= 0.12 * (1 - lobe) * ((v - 0.82) / 0.18) ** 1.5
            verts.append((x * scale, y * scale, -zz * scale if down else zz * scale))
    for j in range(nv):
        for i in range(nu):
            a, b = j * nu + i, j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    for loop_v in ([bm.verts[k] for k in range(nu)], [bm.verts[nv * nu + k] for k in range(nu)]):
        bm.verts.ensure_lookup_table()
        bm.faces.new(loop_v)
    if down:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    for p in me.polygons:
        p.use_smooth = True
    return ob


def gum_band(name, teeth_x, w=0.9, z=0.0):
    """Upper gingiva in front of the cervical third: the margin arcs up over each tooth (zenith) and dips to a
    papilla between teeth. Crowns hang down from z = 0."""
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=200, y_subdivisions=40, size=1)
    ob = bpy.context.active_object
    ob.name = name
    me = ob.data
    for vtx in me.vertices:
        u, t = vtx.co.x + 0.5, vtx.co.y + 0.5  # u across, t 0 margin → 1 up towards the vestibule
        X = (u - 0.5) * 6.0
        mids = [(a + b) / 2 for a, b in zip(teeth_x, teeth_x[1:])]
        papilla = max(math.exp(-((X - m) / 0.11) ** 2) for m in mids)  # pointed wedge between teeth
        near = min(abs(X - tx) for tx in teeth_x)
        margin = z - 0.02 - 0.06 * (near / w) ** 2 - 0.3 * papilla  # flat arc (zenith) over each tooth
        Z = margin + t * 2.2
        Y = -0.72 + 0.09 * X * X - 0.06 * math.sin(min(1, t * 3) * math.pi / 2) + 0.12 * t * t
        vtx.co = Vector((X, Y, Z))
    sol = ob.modifiers.new("solid", "SOLIDIFY")
    sol.thickness = 0.16
    sol.offset = -1
    sol.use_rim = True
    sub = ob.modifiers.new("sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    for p in me.polygons:
        p.use_smooth = True
    return ob


def material(name, base, rough=0.3, sss=0.0, sss_r=(1, 0.5, 0.3), coat=0.0, metal=0.0, trans=0.0, emit=None, bump=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*base, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Subsurface Weight"].default_value = sss
    p.inputs["Subsurface Radius"].default_value = sss_r
    p.inputs["Subsurface Scale"].default_value = 0.15
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.08
    p.inputs["Transmission Weight"].default_value = trans
    if emit:
        p.inputs["Emission Color"].default_value = (*emit[0], 1)
        p.inputs["Emission Strength"].default_value = emit[1]
    if bump:  # fine surface detail: "perikymata" bands (wave) or "skin" (noise) or "brushed" (stretched noise)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        if bump == "perikymata":
            tex = nt.nodes.new("ShaderNodeTexWave")
            tex.wave_type = "BANDS"
            tex.bands_direction = "Z"
            tex.inputs["Scale"].default_value = 60
            tex.inputs["Distortion"].default_value = 3
            strength = 0.22
        elif bump == "brushed":
            tex = nt.nodes.new("ShaderNodeTexNoise")
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (400, 400, 4)
            nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
            nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
            strength = 0.05
        else:
            tex = nt.nodes.new("ShaderNodeTexNoise")
            tex.inputs["Scale"].default_value = 90
            strength = 0.12
        if bump != "brushed":
            nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = strength
        nt.links.new(tex.outputs[0] if bump != "perikymata" else tex.outputs["Color"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], p.inputs["Normal"])
    return m


def incisal_translucency(m):
    """Enamel goes bluish-translucent towards the incisal edge (gradient on object Z)."""
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value = -0.55 * FLIP
    ramp.inputs["From Max"].default_value = -1.12 * FLIP
    ramp.inputs["To Min"].default_value = 0.0
    ramp.inputs["To Max"].default_value = 0.55
    nt.links.new(sep.outputs["Z"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs["Result"], p.inputs["Transmission Weight"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.87, 0.8, 0.66, 1)  # cervical: warmer, more dentin shows through
    mix.inputs[7].default_value = (0.74, 0.8, 0.86, 1)  # incisal: bluish, translucent
    nt.links.new(ramp.outputs["Result"], mix.inputs[0])
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])


def assign(ob, m):
    ob.data.materials.clear()
    ob.data.materials.append(m)


def world(color, strength=1.0):
    w = bpy.data.worlds.new("w")
    scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (*color, 1)
    bg.inputs[1].default_value = strength


def area(name, loc, rot, size, power, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, "AREA")
    l.size = size
    l.energy = power
    l.color = color
    ob = bpy.data.objects.new(name, l)
    ob.location = loc
    ob.rotation_euler = [math.radians(a) for a in rot]
    bpy.context.collection.objects.link(ob)
    return ob


def camera(loc, look, lens=85, fstop=None, focus=None):
    c = bpy.data.cameras.new("cam")
    c.lens = lens
    ob = bpy.data.objects.new("cam", c)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if fstop:
        c.dof.use_dof = True
        c.dof.aperture_fstop = fstop
        c.dof.focus_distance = focus or d.length
    scene.camera = ob


def backdrop(color, rough=0.7):
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, 0))
    ob = bpy.context.active_object
    ob.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -3))
    fl = bpy.context.active_object
    m = material("bd", color, rough)
    assign(ob, m)
    assign(fl, m)


gum = material("gum", (0.6, 0.26, 0.27), rough=0.62, sss=0.7, sss_r=(1.0, 0.3, 0.2), coat=0.18, bump="skin")

if direction != "A":
    FLIP = -1.0
enamel = material("enamel", (0.88, 0.83, 0.72), rough=0.24, sss=0.6, sss_r=(1.0, 0.75, 0.55), coat=0.35, bump="perikymata")
incisal_translucency(enamel)

if direction == "A":
    world((0.004, 0.004, 0.005), 1)
    # layered tooth: translucent enamel shell over a warm dentin core that stops short of the incisal edge
    shell = material("enamel_shell", (0.93, 0.91, 0.87), rough=0.22, sss=0.15, sss_r=(1.0, 0.8, 0.6), coat=0.45, trans=0.55, bump="perikymata")
    shell.node_tree.nodes["Principled BSDF"].inputs["IOR"].default_value = 1.63
    core = material("dentin_core", (0.88, 0.72, 0.5), rough=0.5, sss=1.0, sss_r=(1.0, 0.6, 0.3))
    cx = [-1.36, -0.47, 0.47, 1.36]
    for k, x in enumerate(cx):
        lateral = abs(x) > 1
        sc = 0.84 if lateral else 1.0
        loc = (x, 0.22 if lateral else 0, 0.04 if lateral else 0)
        rot = (math.radians(-6), 0, math.radians((-24 if x < 0 else 24) if lateral else (-4 if x < 0 else 4)))
        t = tooth_mesh(f"t{k}", root=False, down=True, scale=sc)
        d = tooth_mesh(f"d{k}", root=False, down=True, scale=sc, inner=0.2)
        d.scale = (1, 1, 0.84)  # dentin ends above the edge: the incisal third stays translucent
        for ob in (t, d):
            ob.location = loc
            ob.rotation_euler = rot
        assign(t, shell)
        assign(d, core)
    # gum: stippled, matte, lighter coral at the margin, deeper red higher up
    g = gum_band("gum", cx, w=0.47)
    g.location.y = 0.1
    gm = material("gum2", (0.66, 0.3, 0.3), rough=0.78, sss=0.6, sss_r=(1.0, 0.3, 0.2), coat=0.0)
    nt = gm.node_tree
    pb = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 140
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    bn = nt.nodes.new("ShaderNodeBump")
    bn.inputs["Strength"].default_value = 0.08
    nt.links.new(vor.outputs["Distance"], bn.inputs["Height"])
    nt.links.new(bn.outputs["Normal"], pb.inputs["Normal"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.3
    mr.inputs["From Max"].default_value = 1.2
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.78, 0.38, 0.36, 1)  # attached gingiva at the margin: coral
    mix.inputs[7].default_value = (0.5, 0.12, 0.15, 1)  # higher up: deeper red mucosa
    nt.links.new(mr.outputs["Result"], mix.inputs[0])
    nt.links.new(mix.outputs[2], pb.inputs["Base Color"])
    assign(g, gm)
    area("key", (2.0, -5.5, 2.0), (65, 0, 20), 2.5, 480, (1, 0.96, 0.9))
    area("rim", (-3.0, 2.0, 1.0), (70, 0, -130), 1.5, 900, (0.75, 0.85, 1.0))
    area("back", (0.0, 3.5, -2.2), (-115, 0, 0), 3, 700, (1.0, 0.95, 0.88))  # behind/below: lights up the incisal translucency
    area("fill", (-2, -5, -2.5), (110, 0, -15), 4, 60)
    camera((0.3, -6.2, -0.9), (0, 0, -0.62), lens=60, fstop=2.8, focus=5.9)

elif direction == "B":
    world((0.9, 0.86, 0.78), 0.6)
    backdrop((0.93, 0.89, 0.82), 0.8)
    ti = material("titanium", (0.78, 0.79, 0.8), rough=0.28, metal=1.0, bump="brushed")
    ceramic = material("ceramic", (0.94, 0.91, 0.84), rough=0.12, sss=0.25, coat=1.0, bump="perikymata")
    incisal_translucency(ceramic)
    # implant: tapered body + helical thread (a curve with a bevel), rounded apex
    bpy.ops.mesh.primitive_cone_add(vertices=96, radius1=0.3, radius2=0.42, depth=2.4, location=(0, 0, -2.0))
    body = bpy.context.active_object
    assign(body, ti)
    cu = bpy.data.curves.new("thread", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    N = 900
    sp.points.add(N - 1)
    for i in range(N):
        u = i / (N - 1)
        z = -0.95 - u * 2.1
        r = 0.43 - 0.11 * u
        a = u * 2 * math.pi * 10
        sp.points[i].co = (r * math.cos(a), r * math.sin(a), z, 1)
    cu.bevel_depth = 0.055
    cu.bevel_resolution = 3
    thr = bpy.data.objects.new("thread", cu)
    bpy.context.collection.objects.link(thr)
    thr.data.materials.append(ti)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.3, location=(0, 0, -3.2), segments=48, ring_count=24)
    apex = bpy.context.active_object
    assign(apex, ti)
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.4, radius2=0.26, depth=0.9, location=(0, 0, 0.1))
    abut = bpy.context.active_object
    assign(abut, ti)
    crown = tooth_mesh("crown", root=False)
    crown.location = (0, 0, 1.0)
    assign(crown, ceramic)
    for ob in (body, apex, abut, crown):
        for p in ob.data.polygons:
            p.use_smooth = True
    area("key", (4, -5, 5), (50, 0, 40), 5, 1800, (1, 0.97, 0.92))
    area("fill", (-5, -4, 1), (80, 0, -50), 6, 500)
    area("top", (0, 0, 7), (0, 0, 0), 4, 600)
    camera((2.2, -10.5, 0.6), (0, 0, -0.4), lens=60, fstop=5.6)

else:  # C cutaway
    world((0.02, 0.05, 0.14), 1)
    backdrop((0.03, 0.07, 0.18), 0.6)
    dentin = material("dentin", (0.86, 0.72, 0.5), rough=0.45, sss=0.4)
    pulp = material("pulp", (0.8, 0.15, 0.15), rough=0.5, emit=((1.0, 0.25, 0.2), 3.0))
    cut = material("cutface", (0.95, 0.92, 0.85), rough=0.35)
    t = tooth_mesh("enamel", root=True)
    d = tooth_mesh("dentin", root=True, inner=0.12)
    pl = tooth_mesh("pulp", root=True, inner=0.72)
    assign(t, enamel)
    assign(d, dentin)
    assign(pl, pulp)
    for ob in (t, d):
        bpy.ops.mesh.primitive_cube_add(size=6, location=(0, -3.0, 0))
        cutter = bpy.context.active_object
        cutter.hide_render = True
        bo = ob.modifiers.new("cut", "BOOLEAN")
        bo.object = cutter
        bo.operation = "DIFFERENCE"
    for ob in (t, d, pl):
        ob.rotation_euler = (0, 0, math.radians(-18))
    area("key", (-3, -5, 4), (55, 0, -30), 4, 1500, (0.9, 0.95, 1.0))
    area("rim", (4, 3, 3), (60, 0, 135), 3, 1200, (0.6, 0.75, 1.0))
    camera((1.2, -9.5, 0.2), (0, 0, -0.2), lens=60, fstop=5.6)

scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("rendered", direction, "→", out)
