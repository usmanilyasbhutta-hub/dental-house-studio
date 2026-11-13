# Dental House detailing library for Blender 4.x (our own; no third-party add-ons).
# Small, composable helpers that add the surface detail real instruments have:
# moulded plastic, brushed and polished metal, a studio environment for
# believable reflections, edge wear-free bevels and moulding seams.
# Import from a build script:  sys.path.insert(0, <repo>/scripts); import blender_detail as D
import bpy, math


def _principled(material):
    return next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def _bump_chain(material, height_socket, strength, distance):
    nt = material.node_tree; bsdf = _principled(material)
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = strength
    bump.inputs['Distance'].default_value = distance
    prev = bsdf.inputs['Normal'].links[0].from_socket if bsdf.inputs['Normal'].links else None
    if prev is not None: nt.links.new(prev, bump.inputs['Normal'])
    nt.links.new(height_socket, bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])


def studio_world(scene, floor=.22, horizon=.37, top=.56):
    """Soft studio environment: darker below, bright overhead, so metal and
    glossy plastic pick up a graded reflection instead of a flat grey."""
    if scene.world is None: scene.world = bpy.data.worlds.new('Studio')
    w = scene.world; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    coord = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB'); bg = nt.nodes.new('ShaderNodeBackground'); out = nt.nodes.new('ShaderNodeOutputWorld')
    mp = nt.nodes.new('ShaderNodeMapRange'); mp.inputs['From Min'].default_value = -1; mp.inputs['From Max'].default_value = 1
    e = ramp.color_ramp.elements; e[0].position = 0; e[0].color = (floor,) * 3 + (1,); e[1].position = 1; e[1].color = (top,) * 3 + (1,)
    mid = ramp.color_ramp.elements.new(.5); mid.color = (horizon,) * 3 + (1,)
    nt.links.new(coord.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], mp.inputs['Value'])
    nt.links.new(mp.outputs['Result'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs[0], out.inputs['Surface'])


def moulded_plastic(material, translucency=.06, texture=.035, scale=260):
    """Injection-moulded polymer: a little light scatter under the surface, a
    fine spark-eroded texture and a thin clear top gloss."""
    b = _principled(material); nt = material.node_tree
    base = tuple(b.inputs['Base Color'].default_value)
    b.inputs['Subsurface Weight'].default_value = translucency
    b.inputs['Subsurface Radius'].default_value = (.6, .6, .6); b.inputs['Subsurface Scale'].default_value = .6
    b.inputs['Coat Weight'].default_value = .12; b.inputs['Coat Roughness'].default_value = .12
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = scale; noise.inputs['Detail'].default_value = 2
    _bump_chain(material, noise.outputs['Fac'], texture, .02)
    b.inputs['Base Color'].default_value = base
    return material


def brushed_metal(material, direction=(0, 1, 0), streak=.10, anisotropy=.55):
    """Satin, brushed aluminium or steel: stretched highlights along the brush
    direction plus fine streaks in the roughness."""
    b = _principled(material); nt = material.node_tree
    b.inputs['Anisotropic'].default_value = anisotropy
    coord = nt.nodes.new('ShaderNodeTexCoord'); mapping = nt.nodes.new('ShaderNodeMapping')
    stretch = [1 if abs(d) > .5 else 90 for d in direction]; mapping.inputs['Scale'].default_value = stretch
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 3; noise.inputs['Detail'].default_value = 6
    rough = nt.nodes.new('ShaderNodeMapRange'); r0 = b.inputs['Roughness'].default_value
    rough.inputs['To Min'].default_value = max(.02, r0 - streak); rough.inputs['To Max'].default_value = r0 + streak
    nt.links.new(coord.outputs['Object'], mapping.inputs['Vector']); nt.links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], rough.inputs['Value']); nt.links.new(rough.outputs['Result'], b.inputs['Roughness'])
    _bump_chain(material, noise.outputs['Fac'], .04, .01)
    return material


def polished_metal(material, micro=.015):
    """Polished stainless: keeps the mirror finish, adds faint handling marks."""
    nt = material.node_tree
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 40; noise.inputs['Detail'].default_value = 5
    _bump_chain(material, noise.outputs['Fac'], micro, .01)
    return material


def soft_bevel(obj, width=.15, segments=3):
    """Rounded manufactured edge with clean shading (no razor-sharp CG edges)."""
    bv = obj.modifiers.new('Manufactured edge', 'BEVEL'); bv.width = width; bv.segments = segments; bv.limit_method = 'ANGLE'
    obj.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL'); return obj
