import bpy, math, sys
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).parent;P=ROOT/'assets';sys.path.insert(0,str(ROOT))
import case_geometry as G
sys.path.insert(0,str(ROOT.parents[1]/'scripts'))
import blender_detail as D
ARGS=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
OUTDIR=Path(next((a.split('=',1)[1] for a in ARGS if a.startswith('--out=')),str(Path(__file__).parent/'assets')));OUTDIR.mkdir(parents=True,exist_ok=True)
RES=next((int(a.split('=')[1]) for a in ARGS if a.startswith('--res=')),2048)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS'
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_adaptive_sampling=True
try:scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE'
except Exception:scene.cycles.use_denoising=False;scene.cycles.samples=96
scene.cycles.max_bounces=6;scene.cycles.transparent_max_bounces=12
scene.render.resolution_x=RES;scene.render.resolution_y=RES;scene.render.resolution_percentage=100;scene.render.film_transparent=True
if scene.world is None:scene.world=bpy.data.worlds.new('Neutral studio')
D.studio_world(scene)
scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
def mat(name,c,metal=0,rough=.25):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*c,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough;return m
steel=mat('Polished surgical stainless steel',(.65,.71,.75),.95,.16);dark=mat('Titanium grip',(.14,.18,.2),.85,.27)
D.polished_metal(steel);D.brushed_metal(dark,(0,1,0),.06,.4)
bpy.ops.object.camera_add(location=(0,0,200));scene.camera=bpy.context.object;scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=G.ASSET_SPAN_MM;scene.camera.data.clip_end=1000
# Operatory-style lighting: three soft panels near the working end plus one
# distant fill, so a 100-200 mm handle does not fall off into dark grey.
for loc,power,size in [((-45,30,90),38000,60),((55,10,70),30000,50),((15,-55,80),16000,45)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='RECTANGLE';o.data.size=size;o.data.size_y=size*.3;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='SUN',location=(0,0,150));o=bpy.context.object;o.data.energy=2.2;o.data.angle=math.radians(25);o.rotation_euler=(math.radians(18),math.radians(-14),0)
keep=set(bpy.data.objects)
def cyl(a,b,r,m,r2=None,bevel=.12):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cone_add(vertices=64,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 bv=o.modifiers.new('Machined bevel','BEVEL');bv.width=bevel;bv.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def curve(coords,r,m):
 c=bpy.data.curves.new('Bent tip','CURVE');c.dimensions='3D';c.resolution_u=24;c.bevel_depth=r;c.bevel_resolution=6;c.use_fill_caps=True;s=c.splines.new('BEZIER');s.bezier_points.add(len(coords)-1)
 for q,p in zip(s.bezier_points,coords):q.co=p;q.handle_left_type='AUTO';q.handle_right_type='AUTO'
 o=bpy.data.objects.new('tip',c);scene.collection.objects.link(o);o.data.materials.append(m);return o
def clean():
 for o in list(bpy.data.objects):
  if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
exec(compile((ROOT/'reference_models.py').read_text(),str(ROOT/'reference_models.py'),'exec'))
