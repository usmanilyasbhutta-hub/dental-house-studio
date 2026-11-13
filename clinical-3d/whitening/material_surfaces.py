# Runs within build_materials.py (v9). The clinical photographs in the
# SDI-hosted product report guide the look: the barrier is an opaque, lumpy,
# glossy pale-blue band a few millimetres tall that fills the papillae; the gel
# is a clear wet coating that leaves the enamel colour visible.
import random
def xyz(p,z=0):return ((p[0]-285)/380*7-3.5,1.96875-(p[1]-160)/214*3.9375,z)
MM=6*7/380  # scene units per millimetre at the estimated 6 source px/mm
def catmull(pts,closed=False,steps=12):
 out=[];n=len(pts)
 for j in range(n if closed else n-1):
  p0=pts[(j-1)%n] if closed or j else pts[0];p1=pts[j];p2=pts[(j+1)%n];p3=pts[(j+2)%n] if closed or j+2<n else pts[-1]
  for k in range(steps):
   t=k/steps;out.append(tuple(.5*(2*p1[c]+(-p0[c]+p2[c])*t+(2*p0[c]-5*p1[c]+4*p2[c]-p3[c])*t*t+(-p0[c]+3*p1[c]-3*p2[c]+p3[c])*t*t*t) for c in (0,1)))
 return out
def object_mesh(name,verts,faces,material):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.data.materials.append(material)
 for f in mesh.polygons:f.use_smooth=True
 return o
def microtexture(material,scale,strength,distance):
 nt=material.node_tree;noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=scale;noise.inputs['Detail'].default_value=3
 bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=strength;bump.inputs['Distance'].default_value=distance;nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],nt.nodes.get('Principled BSDF').inputs['Normal'])
def blobs(seed,count,xr,yr,rr,ar):
 random.seed(seed);return [(random.uniform(*xr),random.uniform(*yr),random.uniform(*rr),random.uniform(*ar)) for _ in range(count)]
def blob_height(field,x,y):
 h=0
 for bx,by,br,ba in field:
  d=((x-bx)**2+(y-by)**2)/(br*br)
  if d<4:h+=ba*math.exp(-d)
 return h

# --- Gingival barrier: lumpy light-cured resin band ---------------------------
barriermat=mat('SDI light-cured blue barrier resin',(.115,.30,.53),0,.26)
barriermat.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.25
microtexture(barriermat,14,.10,.02)
x0,x1=G.MARGIN[0][0]-1.5,G.MARGIN[-1][0]+1.5;cols=int((x1-x0)/.5)+1;rows=26
xs=[x0+i*(x1-x0)/(cols-1) for i in range(cols)]
edges=[G.barrier_edges(x) for x in xs]
tops=[sum(edges[max(0,min(cols-1,i+d))][1] for d in range(-16,17))/33 for i in range(cols)]
field=blobs(11,150,(x0,x1),(168,230),(3.5,7.5),(-.30,.60))
ridge=blobs(12,60,(x0,x1),(168,230),(7,14),(.1,.50))
H=.95*MM;verts=[];faces=[]
for i,x in enumerate(xs):
 low=edges[i][0];top=tops[i];end=min(1,i/14,(cols-1-i)/14)**.5
 for j in range(rows):
  t=j/(rows-1);y=low+(top-low)*t
  dome=math.sin(math.pi*t)**.5
  # Extruded-bead lumps, slightly fuller near the margin where the bead is laid first.
  lump=1+.6*blob_height(field,x,y)+.5*blob_height(ridge,x,y)
  verts.append(xyz((x,y),H*dome*end*max(.4,lump)*(1.05-.25*t)))
for i in range(cols-1):
 for j in range(rows-1):a=i*rows+j;faces.append((a,a+rows,a+rows+1,a+1))
o=object_mesh('Conforming gingival barrier band',verts,faces,barriermat)
sub=o.modifiers.new('Soft resin surface','SUBSURF');sub.levels=2;sub.render_levels=2
scene.render.filepath=str(P/'barrier_volume.png');bpy.ops.render.render(write_still=True);clean()

# --- Whitening gel: clear wet coating, two passes ------------------------------
# gel_thickness.png: relative film thickness (drives a faint cool tint).
# gel_spec.png: wet surface reflections only (added over the photograph).
# The enamel photograph itself stays visible underneath; nothing recolours it.
GH=.55*MM
def gel_objects(material):
 out=[]
 for n,poly in enumerate(G.CROWNS):
  outline=catmull(poly,True,10);cx=sum(x for x,y in poly)/len(poly);cy=sum(y for x,y in poly)/len(poly);m=len(outline)
  field=blobs(40+n,26,(cx-34,cx+34),(cy-34,cy+34),(5,12),(-.22,.42))
  verts=[xyz((cx,cy),GH*(1+blob_height(field,cx,cy)))];faces=[];R=22
  for ring in range(1,R+1):
   r=ring/R
   for x,y in outline:
    px=cx+(x-cx)*r*.985;py=cy+(y-cy)*r*.985
    edge=(1-r**3.2)**.55  # flat film with a rounded meniscus at the outline
    verts.append(xyz((px,py),GH*edge*(1+blob_height(field,px,py))))
  for j in range(m):faces.append((0,1+j,1+(j+1)%m))
  for ring in range(1,R):
   a=1+(ring-1)*m;b=1+ring*m
   for j in range(m):faces.append((a+j,b+j,b+(j+1)%m,a+(j+1)%m))
  out.append(object_mesh('Clear wet whitening gel coating',verts,faces,material))
 return out
scene.render.film_transparent=False;scene.render.image_settings.color_mode='RGB'
thick=bpy.data.materials.new('Gel thickness readout');thick.use_nodes=True;nt=thick.node_tree;nt.nodes.clear()
geo=nt.nodes.new('ShaderNodeNewGeometry');sep=nt.nodes.new('ShaderNodeSeparateXYZ');mul=nt.nodes.new('ShaderNodeMath');mul.operation='MULTIPLY';mul.inputs[1].default_value=1/(GH*1.5)
em=nt.nodes.new('ShaderNodeEmission');out=nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(geo.outputs['Position'],sep.inputs[0]);nt.links.new(sep.outputs['Z'],mul.inputs[0]);nt.links.new(mul.outputs[0],em.inputs['Color']);nt.links.new(em.outputs[0],out.inputs['Surface'])
WORLD.default_value=(0,0,0,1);scene.view_settings.view_transform='Raw'
gel_objects(thick);scene.cycles.samples=8
scene.render.filepath=str(P/'gel_thickness.png');bpy.ops.render.render(write_still=True);clean()
scene.view_settings.view_transform='Standard';scene.cycles.samples=96;WORLD.default_value=(.035,.04,.045,1)
wet=mat('Clear viscous gel surface reflection',(0,0,0),0,.085)
b=wet.node_tree.nodes.get('Principled BSDF');b.inputs['IOR'].default_value=1.40;b.inputs['Coat Weight'].default_value=.5;b.inputs['Coat Roughness'].default_value=.05
microtexture(wet,5,.12,.02)
gel_objects(wet)
scene.render.filepath=str(P/'gel_spec.png');bpy.ops.render.render(write_still=True);clean()
