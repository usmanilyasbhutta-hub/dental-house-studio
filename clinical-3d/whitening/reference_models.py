# Millimetre-scale reconstruction from the inspected reference photographs (v9).
# Runs inside build_reference_models.py. Every model has its working end at the
# origin and its handle along -Y; the tooth surface is the plane z = 0 and the
# camera looks down -Z. Poses come from case_geometry.POSES.
import random
black=mat('SDI black syringe polymer',(.012,.015,.018),0,.30)
pearl=mat('Pearl white handpiece polymer',(.80,.82,.81),0,.30)
mint=mat('SDI pale mint wrap label',(.62,.74,.70),0,.42)
labelwhite=mat('Pola white wrap label',(.86,.88,.88),0,.40)
aluminium=mat('NSK satin aluminium reference',(.60,.62,.63),.92,.34)
navy=mat('SDI cobalt blue polymer',(.012,.11,.42),0,.27)
skyblue=mat('Radii blue activation button',(.10,.42,.80),0,.25)
orange=mat('Orange-red static mixer',(.80,.045,.012),0,.35)
green=mat('ROEKO green tip',(.03,.24,.07),0,.33)
nylon=mat('Young soft white nylon',(.86,.87,.84),0,.50)
printmat=mat('Printed graphite',(.012,.018,.022),0,.65)
printwhite=mat('Printed white',(.85,.86,.86),0,.6)
gelblue=mat('Pola chamber contents',(.012,.10,.42),0,.22)
# Surface detail from scripts/blender_detail.py (moulded texture, brushed metal).
for m in (black,pearl,navy,green,skyblue,labelwhite):D.moulded_plastic(m)
D.moulded_plastic(mint,0,.02,180);D.brushed_metal(aluminium,(0,1,0),.09,.6)
def clear_polymer(name,tint,body=.13,edge=.85):
 # Clear moulded polypropylene: see-through face-on, bright and opaque at the
 # grazing edges. v8 used one flat 24 % mix, which read as a ghosted overlay.
 m=mat(name,tint,0,.10);nt=m.node_tree;bs=nt.nodes.get('Principled BSDF');out=nt.nodes.get('Material Output')
 lw=nt.nodes.new('ShaderNodeLayerWeight');lw.inputs['Blend'].default_value=.38
 ramp=nt.nodes.new('ShaderNodeMapRange');ramp.inputs['From Min'].default_value=.05;ramp.inputs['From Max'].default_value=.85;ramp.inputs['To Min'].default_value=body;ramp.inputs['To Max'].default_value=edge
 tr=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader')
 nt.links.new(lw.outputs['Facing'],ramp.inputs['Value']);nt.links.new(ramp.outputs['Result'],mix.inputs[0]);nt.links.new(tr.outputs[0],mix.inputs[1]);nt.links.new(bs.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],out.inputs['Surface'])
 return m
clear=clear_polymer('Clear moulded polypropylene',(.80,.88,.92))
clearthin=clear_polymer('Thin clear mixer housing',(.85,.90,.93),.04,.70)

def text(s,loc,size,material=printmat,rot=0,bold=False):
 # --generic: no brand or product names (taste T06: generic labels in procedure animations).
 # An empty object keeps the call sites working.
 if '--generic' in ARGS:
  o=bpy.data.objects.new('Generic: label omitted',None);scene.collection.objects.link(o);return o
 c=bpy.data.curves.new('Reference label','FONT');c.body=s;c.size=size;c.extrude=.004;c.align_x='CENTER';c.align_y='CENTER'
 if bold:c.offset=size*.022
 o=bpy.data.objects.new('Printed product identification',c);scene.collection.objects.link(o);o.location=loc;o.rotation_euler.z=rot;o.data.materials.append(material)
 return o

def sweep(points,radii,material,wall=None,name='Swept section',steps=10,sides=48):
 # Round section swept along a smooth path with a varying radius. wall=None is
 # a capped solid; a wall thickness leaves a genuinely open lumen at both ends.
 pts=[Vector(p) for p in points];path=[];rad=[];n=len(pts)
 for i in range(n-1):
  p0=pts[max(i-1,0)];p1=pts[i];p2=pts[i+1];p3=pts[min(i+2,n-1)]
  for j in range(steps):
   t=j/steps;path.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t));rad.append(radii[i]*(1-t)+radii[i+1]*t)
 path.append(pts[-1]);rad.append(radii[-1])
 tangents=[(path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized() for i in range(len(path))]
 ref=Vector((1,0,0)) if abs(tangents[0].x)<.9 else Vector((0,0,1));a=tangents[0].cross(ref).normalized()
 v=[];faces=[];rings=2 if wall else 1
 for p,r,tg in zip(path,rad,tangents):
  a=(a-tg*a.dot(tg)).normalized();b=tg.cross(a)
  for rr in ([r,max(.02,r-wall)] if wall else [r]):
   for k in range(sides):v.append(tuple(p+(a*math.cos(k*math.tau/sides)+b*math.sin(k*math.tau/sides))*rr))
 per=sides*rings
 for j in range(len(path)-1):
  for k in range(sides):
   q=(k+1)%sides
   for ring in range(rings):
    s0=j*per+ring*sides;s1=(j+1)*per+ring*sides;f=(s0+k,s0+q,s1+q,s1+k);faces.append(f if ring==0 else f[::-1])
 for j,flip in [(0,True),(len(path)-1,False)]:
  s0=j*per
  if wall:
   for k in range(sides):
    q=(k+1)%sides;f=(s0+k,s0+sides+k,s0+sides+q,s0+q);faces.append(f if flip else f[::-1])
  else:
   f=tuple(s0+k for k in range(sides));faces.append(f[::-1] if flip else f)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.data.materials.append(material)
 for f in mesh.polygons:f.use_smooth=True
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 return o

def loft(sections,material,name='Lofted flattened section',power=.65,caps=True):
 # Rounded-rectangular sections: (y, centre x, centre z, half width, half height).
 v=[];faces=[];n=40
 for y,cx,cz,rx,rz in sections:
  for k in range(n):
   a=k*math.tau/n;x=math.copysign(abs(math.cos(a))**power,math.cos(a));z=math.copysign(abs(math.sin(a))**power,math.sin(a));v.append((cx+x*rx,y,cz+z*rz))
 for j in range(len(sections)-1):
  for k in range(n):a=j*n+k;faces.append((a,j*n+(k+1)%n,(j+1)*n+(k+1)%n,a+n))
 if caps:faces.extend([tuple(range(n-1,-1,-1)),tuple((len(sections)-1)*n+k for k in range(n))])
 m=bpy.data.meshes.new(name);m.from_pydata(v,[],faces);m.update();o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.data.materials.append(material)
 for f in m.polygons:f.use_smooth=True
 sub=o.modifiers.new('Smooth traced contours','SUBSURF');sub.levels=2;sub.render_levels=2;return o

def dome(centre,r,height,material,name='Domed cap'):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=1,location=centre);o=bpy.context.object;o.name=name;o.scale=(r,r,height);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o

def group_new(snapshot,name):
 root=bpy.data.objects.new(name,None);scene.collection.objects.link(root)
 for o in set(bpy.data.objects)-snapshot-{root}:o.parent=root
 return root

ONLY=[a.split('=')[1] for a in ARGS if a.startswith('--only=')]
def render_set(name,rotor=None,plunger=None,compare_roll=0):
 if ONLY and name not in ONLY:clean();return
 root=bpy.data.objects.new('Working end pivot',None);scene.collection.objects.link(root)
 for o in list(bpy.data.objects):
  if o not in keep and o!=root and o.parent is None:o.parent=root
 # Neutral complete model for direct photograph comparison.
 root.rotation_euler.y=math.radians(compare_roll);bpy.context.view_layer.update()
 box=[o.matrix_world@Vector(c) for o in bpy.data.objects if o not in keep and o.type in ('MESH','CURVE','FONT') for c in o.bound_box]
 lo=[min(v[i] for v in box) for i in (0,1)];hi=[max(v[i] for v in box) for i in (0,1)]
 scene.camera.location=((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,400);scene.camera.data.ortho_scale=max(hi[0]-lo[0],hi[1]-lo[1])*1.06
 if '--save-models' in ARGS:
  root.rotation_euler.y=0
  model_dir=ROOT/('models_generic' if '--generic' in ARGS else 'models');model_dir.mkdir(exist_ok=True)
  bpy.ops.wm.save_as_mainfile(filepath=str(model_dir/f'{name}.blend'),compress=True)
 if '--glb' in ARGS:
  # GLB for three.js: 1 unit = 1 mm (the exporter ignores the scene unit scale), Y-up, working end at the origin, handle along -Y.
  glb_dir=ROOT/'glb';glb_dir.mkdir(exist_ok=True)
  root.rotation_euler=(0,0,0);bpy.context.view_layer.update()
  for o in bpy.data.objects:o.select_set(o not in keep)
  bpy.ops.export_scene.gltf(filepath=str(glb_dir/f'{name}.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False,export_extras=False,export_animations=False)
  scene.camera.location=(0,0,200);scene.camera.data.ortho_scale=G.ASSET_SPAN_MM;clean();return
 if '--save-models' in ARGS:
  scene.camera.location=(0,0,200);scene.camera.data.ortho_scale=G.ASSET_SPAN_MM;clean();return
 scene.render.resolution_x=scene.render.resolution_y=1400
 scene.render.filepath=str(OUTDIR/f'{name}_comparison.png');bpy.ops.render.render(write_still=True)
 scene.render.resolution_x=scene.render.resolution_y=RES
 root.rotation_euler=(0,0,0);scene.camera.location=(0,0,200);scene.camera.data.ortho_scale=G.ASSET_SPAN_MM
 if '--compare-only' in ARGS:clean();return
 poses=G.SCALER_POSES if name=='scaler' else [G.POSES[name](i) for i in range(5)]
 for idx,angles in enumerate(poses):
  if any(a.startswith('--pose=') for a in ARGS) and f'--pose={idx}' not in ARGS:continue
  root.rotation_euler=tuple(math.radians(x) for x in angles)
  if plunger:
   descendants=set(plunger.children_recursive);geom=[o for o in bpy.data.objects if o not in keep and o.type!='EMPTY']
   for o in descendants:o.hide_render=True
   scene.render.filepath=str(OUTDIR/f'{name}_pose{idx}_body.png');bpy.ops.render.render(write_still=True)
   for o in geom:o.hide_render=o not in descendants
   scene.render.filepath=str(OUTDIR/f'{name}_pose{idx}_plunger.png');bpy.ops.render.render(write_still=True)
   for o in geom:o.hide_render=False
  else:
   for phase in range(4 if rotor else 1):
    if rotor:rotor.rotation_euler.z=phase*math.tau/4/3  # bristle field repeats every 120 degrees
    suffix=f'_phase{phase}' if rotor else ''
    scene.render.filepath=str(OUTDIR/f'{name}_pose{idx}{suffix}.png');bpy.ops.render.render(write_still=True)
 clean()

# --- SDI Gingival Barrier -------------------------------------------------
# Reference: black barrel ends, pale mint wrap label with bold lettering, black
# SDI block, broad flange, push rod about 60 % of the barrel width, flat thumb
# rest. The reference photograph is capped; the bent metal working cannula in a
# black luer hub is the clinical dispensing tip and remains an approximation.
sweep([(0,0,.15),(0,-1.6,.75),(0,-3.6,2.2),(0,-5.4,3.6),(0,-8,4),(0,-15,4)],[.42]*6,steel,.11,'Bent 20G working cannula')
cyl((0,-13.5,4),(0,-17,4),1.25,black,1.9);cyl((0,-17,4),(0,-22,4),2.9,black,3.1)
for k in range(10):
 a=k*math.tau/10;cyl((3.0*math.cos(a),-17.4,4+3.0*math.sin(a)),(3.15*math.cos(a),-21.6,4+3.15*math.sin(a)),.32,black,bevel=.05)
cyl((0,-22,4),(0,-65,4),3.25,black)
cyl((0,-27,4),(0,-55,4),3.30,mint,bevel=.01)
text('GINGIVAL BARRIER',(.15,-41.2,7.31),2.75,printmat,math.pi/2,bold=True)
text('FOR PROTECTION OF GINGIVA',(2.15,-41.2,6.78),.82,printmat,math.pi/2)
text('SDI',(0,-58.3,7.26),2.3,printwhite,math.pi/2,bold=True)
loft([(-65,0,4,5.6,4.4),(-66.6,0,4,5.6,4.4)],black,'Finger flange',.8)
snap=set(bpy.data.objects);cyl((0,-66,4),(0,-100,4),2.0,black);cyl((0,-100,4),(0,-101.6,4),5.0,black);plunger=group_new(snap,'SDI single plunger')
render_set('barrier_syringe',plunger=plunger)

# --- SDI Pola Office+ -----------------------------------------------------
# Reference: clear twin barrel with a white label half (SDI / POLA / OFFICE+)
# and a blue chamber, clear joined plunger, ribbed blue conical hub, clear
# mixer with red element, short fine delivery end bent about 55 degrees.
BX,BZ=-5.2,6.4  # mixer axis; the delivery end bends down to the outlet at the origin
sweep([(0,0,.15),(-1.5,-1.8,1.9),(-3.3,-3.9,4.2),(BX+.5,-5.6,5.9),(BX,-7.5,BZ),(BX,-12,BZ)],[.48,.52,.6,.72,.95,1.5],clear,.16,'Angled fine delivery end')
sweep([(BX,-12,BZ),(BX,-36,BZ)],[2.0,2.25],clearthin,.2,'Clear mixer housing',steps=2)
cyl((BX,-11.2,BZ),(BX,-13.2,BZ),2.0,clear,2.75)  # flared clear collar under the bent end
# Static mixer as photographed: a stack of alternating crossed red baffles on a
# central spine (v9 first pass drew a helix).
for k in range(11):
 o=dome((BX,-14-k*2.05,BZ),1.55,.24,orange,'Red static mixer baffle');o.scale=(1.55,1.75,.24)
 o.rotation_euler=(math.radians(52 if k%2 else -52),math.radians(90 if k%4>1 else 0),0)
cyl((BX,-13,BZ),(BX,-35,BZ),.5,orange)
cyl((BX,-36,BZ),(BX,-49,BZ),3.0,navy,5.6)
for k in range(18):
 a=k*math.tau/18;cyl((BX+3.25*math.cos(a),-37.5,BZ+3.25*math.sin(a)),(BX+5.7*math.cos(a),-48.6,BZ+5.7*math.sin(a)),.42,navy,bevel=.05)
cyl((BX,-49,BZ),(BX,-52.5,BZ),6.1,clear)
for x in [BX-3.15,BX+3.15]:cyl((x,-52.5,BZ),(x,-104,BZ),3.1,clear)
cyl((BX+3.15,-54,BZ),(BX+3.15,-101,BZ),2.7,gelblue,bevel=.3)
cyl((BX-3.15,-54,BZ),(BX-3.15,-96,BZ),2.7,labelwhite,bevel=.3)
loft([(-57,BX-3.15,BZ+3.02,2.3,.12),(-93,BX-3.15,BZ+3.02,2.3,.12)],labelwhite,'White label half',.9)
for j,ch in enumerate('POLA'):text(ch,(BX-3.15,-70-j*5.6,BZ+3.2),4.2,printmat,0,bold=True)
text('SDI',(BX-3.15,-61.5,BZ+3.2),1.7,printmat,0,bold=True);text('OFFICE+',(BX-3.15,-94.6,BZ+3.2),1.05,navy,0,bold=True)
for y in range(-62,-99,-9):cyl((BX+1.6,y,BZ+2.75),(BX+4.3,y,BZ+2.55),.07,printmat,bevel=.01)
loft([(-104,BX,BZ,9.4,3.9),(-106,BX,BZ,9.4,3.9)],clear,'Clear finger flange',.8)
snap=set(bpy.data.objects)
for x in [BX-3.15,BX+3.15]:
 cyl((x,-103,BZ),(x,-142,BZ),1.75,clear);cyl((x,-99.5,BZ),(x,-103,BZ),2.68,dark,bevel=.2)
loft([(-142,BX,BZ,8.2,3.2),(-144,BX,BZ,8.2,3.2)],clear,'Joined clear thumb plate',.8);plunger=group_new(snap,'Pola joined clear plunger')
render_set('syringe',plunger=plunger)

# --- NSK FX57 with soft white screw-in brush -------------------------------
# Reference: domed compact head, flattened neck rising about 20 degrees from
# the body (contra-angle: the head sits off the body axis, away from the
# working side), body flaring from about 12 to 16 mm, lettering on the side.
cyl((0,0,6.4),(0,0,14.6),4.0,aluminium,bevel=.5);dome((0,0,14.5),3.95,2.3,aluminium,'Domed head cap')
cyl((0,0,16.55),(0,0,16.95),1.9,aluminium,bevel=.1)
cyl((0,0,4.5),(0,0,6.6),1.75,steel,2.6)
loft([(-2.6,0,11.3,3.05,3.2),(-7,0,11.0,3.1,2.9),(-15,0,9.9,3.3,2.8),(-25,0,8.1,4.2,3.6),(-32,0,6.8,5.0,4.9),(-37,0,6.0,4.9,4.9),(-42,0,5.8,4.6,4.6)],aluminium,'FX57 flattened tapered neck',caps=False)
sweep([(0,-36,6.0),(0,-45,5.7),(0,-62,5.5),(0,-78,5.5),(0,-82,5.5)],[6.05,6.2,6.8,7.75,8.0],aluminium,None,'FX57 flared body')
cyl((0,-82,5.5),(0,-84,5.5),7.2,dark)
text('NSK  FX57  4:1',(6.75,-60,6.2),2.3,printmat,0).rotation_euler=(math.radians(90),0,math.radians(90))
rotor=bpy.data.objects.new('Only screw-in brush rotates',None);scene.collection.objects.link(rotor)
random.seed(71);c=bpy.data.curves.new('Dense soft nylon reference brush','CURVE');c.dimensions='3D';c.resolution_u=3;c.bevel_depth=.04;c.bevel_resolution=1
for k in range(1500):
 a=random.random()*math.tau;r=2.2*math.sqrt(random.random());dx=math.cos(a);dy=math.sin(a);s=c.splines.new('BEZIER');s.bezier_points.add(2)
 tuft=1+.06*math.sin(a*3)  # three soft tufts so rotation is visible between phases
 for bp,pt in zip(s.bezier_points,[(dx*r*.62,dy*r*.62,4.6),(dx*r*.88*tuft,dy*r*.88*tuft,2.4),(dx*(r+.4)*tuft,dy*(r+.4)*tuft,.12+random.random()*.22)]):bp.co=pt;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
o=bpy.data.objects.new('Young white soft screw-in brush profile',c);scene.collection.objects.link(o);o.data.materials.append(nylon);o.parent=rotor
render_set('polisher',rotor=rotor,compare_roll=90)

# --- SDI Radii-Cal CX ------------------------------------------------------
# Reference: slim head angled about 40 degrees from a long white body that
# widens to about 22 mm, blue side button, silver collar. v8 was drawn at
# roughly half this body diameter; the slim head and neck are what enter frame.
bd=Vector((0,-math.sin(math.radians(40)),math.cos(math.radians(40))));e=Vector((0,-2.2,15.5))
pts=[(0,0,1.0),(0,0,7),(0,-.6,12),tuple(e)]+[tuple(e+bd*d) for d in (10,30,58,84,112,150,206)]
# Owner request: drawn slightly slimmer than the ~22 mm product body (about 17 mm) so more of the barrier stays visible.
sweep(pts,[4.8,4.9,5.0,5.3,5.6,6.2,7.4,8.4,8.6,8.6,8.4],pearl,None,'Integrated curved handpiece body')
cyl((0,0,.25),(0,0,1.3),4.95,steel,bevel=.2);cyl((0,0,.18),(0,0,.5),4.1,dark,bevel=.05)
led=mat('Radii curing window',(.06,.10,.22),0,.12);b=led.node_tree.nodes.get('Principled BSDF');b.inputs['Emission Color'].default_value=(.02,.10,.75,1);b.inputs['Emission Strength'].default_value=.8
cyl((0,0,.1),(0,0,.2),3.75,led,bevel=.02)
ring=e+bd*112;cyl(tuple(ring),tuple(ring+bd*2.6),8.75,steel,bevel=.2)
side=Vector((1,0,0));btn=e+bd*84
o=dome(tuple(btn+side*8.05),2.6,5.2,skyblue,'Blue side activation button');o.rotation_euler=bd.to_track_quat('Z','Y').to_euler();o.scale=(1.0,2.3,4.6)
up=bd.cross(side).normalized()
t=text('RADII-CAL CX',tuple(e+bd*62+up*-7.72),2.3,printmat);t.rotation_euler=(-up).to_track_quat('Z','Y').to_euler();t.rotation_euler.rotate_axis('Z',math.radians(90))
render_set('curing_light',compare_roll=90)

# --- COLTENE ROEKO Surgitip -------------------------------------------------
# Reference: thick white cannula with ONE smooth elbow of about 40 degrees,
# short white sleeve cut over a tapered green insert, open 2.8 mm lumen.
# v8 had a double dog-leg and a thin, over-long green insert.
# Second pass from the full-resolution photograph: insert about 20 mm, almost
# flush with the cannula at its base; ~12 mm straight sleeve; tight ~45 degree elbow.
ax1=Vector((0,-20.5,3.0)).normalized()
sweep([(0,0,.15),tuple(ax1*20.5+Vector((0,0,.15)))],[1.8,3.05],green,.4,'Green tapered insert, 2.8 mm lumen',steps=2)
cyl(tuple(ax1*.05+Vector((0,0,.15))),tuple(ax1*.9+Vector((0,0,.15))),1.86,green,1.9,bevel=.12)  # rolled rim of the opening
el=math.radians(45);side2=Vector((.94,0,.34)).normalized();d2=(ax1*math.cos(el)+side2*math.sin(el)).normalized()
p1=ax1*19+Vector((0,0,.15));k0=p1+ax1*13.5;mid=(ax1+d2).normalized()
sweep([tuple(p1),tuple(p1+ax1*7),tuple(k0),tuple(k0+mid*5),tuple(k0+mid*5+d2*6),tuple(k0+d2*40),tuple(k0+d2*112)],[3.3]*7,pearl,.55,'White cannula with single elbow')
cyl(tuple(p1-ax1*.2),tuple(p1+ax1*1.6),3.42,pearl,bevel=.2)  # sleeve lip over the insert
render_set('suction')

# --- ACTEON original No.1 on a white handpiece ------------------------------
# Working-blade profile retained from the previously inspected tip photographs.
centres=[(-.070,.062,0),(0,0,0),(.17,-.12,0),(.32,-.31,0),(.39,-.53,0),(.42,-.83,0),(.42,-1.31,0)]
widths=[.010,.014,.022,.031,.039,.045,.080]
verts=[];faces=[];rings=120;sides=12
for j in range(rings):
 pos=j/(rings-1)*(len(centres)-1);i=min(len(centres)-2,int(pos));t=pos-i
 p0=Vector(centres[max(0,i-1)]);p1=Vector(centres[i]);p2=Vector(centres[i+1]);p3=Vector(centres[min(len(centres)-1,i+2)])
 co=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
 tangent=(p2-p1).normalized();across=Vector((-tangent.y,tangent.x,0));w=widths[i]*(1-t)+widths[i+1]*t;thick=w*.36
 for k in range(sides):
  a=k*math.tau/sides;v=co+across*(math.cos(a)*w)+Vector((0,0,math.sin(a)*thick));verts.append(tuple(v))
for j in range(rings-1):
 for k in range(sides):a=j*sides+k;faces.append((a,j*sides+(k+1)%sides,(j+1)*sides+(k+1)%sides,a+sides))
faces.append(tuple(range(sides-1,-1,-1)));faces.append(tuple((rings-1)*sides+k for k in range(sides)))
m=bpy.data.meshes.new('No1 tapered flattened original-profile insert');m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new('No1 working blade',m);scene.collection.objects.link(o);o.data.materials.append(steel)
for f in m.polygons:f.use_smooth=True
o.scale=(10,10,10)
cyl((4.2,-12.9,0),(4.2,-19.5,0),.92,steel,1.1);cyl((4.2,-17.4,0),(4.2,-18.3,0),1.12,navy)
cyl((4.2,-19.5,0),(4.2,-30,0),2.2,dark,5.7);cyl((4.2,-30,0),(4.2,-114,0),5.7,pearl,6.2)
text('NEWTRON SLIM',(4.2,-66,6.05),2.2,printmat,math.pi/2)
render_set('scaler')
