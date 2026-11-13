import bpy, math, sys
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).parent;P=ROOT/'assets';sys.path.insert(0,str(ROOT))
import case_geometry as G
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=64
try:scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE'
except Exception:scene.cycles.use_denoising=False;scene.cycles.samples=160
scene.render.resolution_x=1920;scene.render.resolution_y=1080;scene.render.resolution_percentage=100;scene.render.film_transparent=True
if scene.world is None:scene.world=bpy.data.worlds.new('Operatory')
scene.world.use_nodes=True;WORLD=scene.world.node_tree.nodes['Background'].inputs[0];WORLD.default_value=(.32,.32,.32,1)
scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
def mat(name,c,metal=0,rough=.25):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
# Camera frames exactly the 380x214 source-px crop used by render.py.
bpy.ops.object.camera_add(location=(0,0,12));scene.camera=bpy.context.object;scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=7
for loc,power,size in [((-3,2,7),350,5),((4,1,5),450,3),((1,-4,4),200,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='RECTANGLE';o.data.size=size;o.data.size_y=size*.24;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
keep=set(bpy.data.objects)
def clean():
 for o in list(bpy.data.objects):
  if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
exec(compile((ROOT/'material_surfaces.py').read_text(),str(ROOT/'material_surfaces.py'),'exec'))
