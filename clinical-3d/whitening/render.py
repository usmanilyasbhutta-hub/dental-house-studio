from PIL import Image,ImageDraw,ImageFilter,ImageOps
from pathlib import Path
import math,subprocess,sys,json,hashlib
P=Path(__file__).parent;A=P/'assets';W,H=1920,1080;FPS=24;DUR=41
import os
# WH_TOOLS: folder of instrument renders (default assets/; assets_generic/ for the unbranded set).
# WH_NAME: output file stem in ../../out/.
TOOLS=Path(os.environ.get('WH_TOOLS',str(A)));NAME=os.environ.get('WH_NAME','DHS_Whitening_Clinical_v9')
sys.path.insert(0,str(P))
import case_geometry as G
# Clinical proportions: central incisor assumed 8.5 mm wide (~51 source px).
# Patient photographs contain no calibration ruler; dimensions are estimates.
PX_PER_MM=32  # on-screen scale shared by every instrument
MODEL={'barrier':'barrier_syringe','gel':'syringe','polish':'polisher','light':'curing_light','suction':'suction'}
old=A
before=Image.open(old/'before.jpg').convert('RGB');after=Image.open(old/'after.jpg').convert('RGB')
C=(285,160,665,374);S=W/(C[2]-C[0])
def crop(im,b):return ImageOps.fit(im.crop(tuple(round(v/960*im.width) for v in b)),(W,H),Image.Resampling.LANCZOS)
initial=crop(before,C);final=crop(after,(190,225,770,550))
def point(p):return ((p[0]-C[0])*S,(p[1]-C[1])*S)
def ease(x):x=max(0,min(1,x));return x*x*(3-2*x)
def smooth(points,closed=False):
 out=[];n=len(points)
 for i in range(n if closed else n-1):
  p0=points[(i-1)%n] if closed or i>0 else points[0];p1=points[i];p2=points[(i+1)%n];p3=points[(i+2)%n] if closed or i+2<n else points[-1]
  for j in range(16):
   t=j/16;out.append(tuple(.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in (0,1)))
 return out
# Crown outlines and gingival margin: traced on an enlargement of the initial
# photograph (case_geometry.py). The barrier follows the same margin.
crowns=G.CROWNS
barrier=smooth(G.MARGIN)
# The pose is rendered in 3D about the contact origin; no screen-space
# rotation of a fixed billboard is used to imply a different working angle.
tools={}
def load(name):return Image.open(TOOLS/name).convert('RGBA')
for i in range(2):tools[f'scaler{i}']=load(f'scaler_pose{i}.png')
for kind in ['light','suction']:
 for i in range(5):tools[f'{kind}{i}']=load(f'{MODEL[kind]}_pose{i}.png')
for kind in ['barrier','gel']:
 for i in range(5):
  for part in ['body','plunger']:tools[f'{kind}{i}_{part}']=load(f'{MODEL[kind]}_pose{i}_{part}.png')
for i in range(5):
 for phase in range(4):tools[f'polish{i}_{phase}']=load(f'polisher_pose{i}_phase{phase}.png')
ASSET=tools['scaler0'].width;HALF=ASSET//2;ASSET_PX_MM=ASSET/G.ASSET_SPAN_MM;FACTOR=PX_PER_MM/ASSET_PX_MM
def make_shadow(v):
 # Soft contact shadow; instruments sit a few millimetres above the enamel.
 sh=Image.new('RGBA',(HALF,HALF),(30,14,18,0));sh.putalpha(v.getchannel('A').resize((HALF,HALF)).point(lambda p:round(p*.20)).filter(ImageFilter.GaussianBlur(7)));return sh
shadow={k:make_shadow(v) for k,v in tools.items() if not k.endswith(('_body','_plunger'))}
masks=[]
for points in crowns:
 m=Image.new('L',(W,H));ImageDraw.Draw(m).polygon([point(p) for p in smooth(points,True)],fill=255);masks.append(m.filter(ImageFilter.GaussianBlur(2)))
def composite_tool(im,v,sh,p,factor):
 # Transform only the visible source window. Large, correctly sized handles
 # naturally leave the frame; they are never shrunk to fit the canvas.
 x,y=point(p);left=x-HALF*factor;top=y-HALF*factor
 sx=max(0,math.floor(-left/factor));sy=max(0,math.floor(-top/factor))
 ex=min(ASSET,math.ceil((W-left)/factor));ey=min(ASSET,math.ceil((H-top)/factor))
 if ex<=sx or ey<=sy:return
 box=(sx,sy,ex,ey);size=(round((ex-sx)*factor),round((ey-sy)*factor))
 xy=(round(left+sx*factor),round(top+sy*factor))
 sv=sh.crop(box).resize(size,Image.Resampling.BICUBIC);vv=v.crop(box).resize(size,Image.Resampling.BICUBIC)
 im.alpha_composite(sv,(xy[0]+7,xy[1]+12));im.alpha_composite(vv,xy)

def tool(im,k,p,t,alpha=1):
 v=tools[k].copy();sh=shadow[k].resize((ASSET,ASSET))
 if alpha<1:v.putalpha(v.getchannel('A').point(lambda a:round(a*alpha)));sh.putalpha(sh.getchannel('A').point(lambda a:round(a*alpha)))
 composite_tool(im,v,sh,p,FACTOR)
def posed_tool(im,kind,p,t,start,end,spin=False):
 # Select a solid 3D depth view, then align its in-plane angle exactly
 # around the model origin. Crossfading displaced silhouettes is forbidden.
 name=MODEL[kind];u=max(0,min(1,(p[0]-390)/240))*4;i=round(u)
 angles=G.POSES[name](i);delta=(u-i)*(G.POSES[name](1)[2]-G.POSES[name](0)[2])
 suffix=f'_{int(t*24)%4}' if spin else ''
 if kind in ['barrier','gel']:
  v=Image.new('RGBA',(ASSET,ASSET));progress=max(0,min(1,(t-start-.36)/(end-start-.72)))
  # The plunger advances along the barrel axis of the exact selected pose.
  x,y,_=G.rotate((0,G.PLUNGER_TRAVEL[name]*progress,0),angles)
  v.alpha_composite(tools[f'{kind}{i}_plunger'],(round(x*ASSET_PX_MM),round(-y*ASSET_PX_MM)))
  v.alpha_composite(tools[f'{kind}{i}_body']);sh=make_shadow(v).resize((ASSET,ASSET))
 else:
  v=tools[f'{kind}{i}{suffix}'].copy();sh=shadow[f'{kind}{i}{suffix}'].resize((ASSET,ASSET))
 if abs(delta)>.01:
  v=v.rotate(delta,Image.Resampling.BICUBIC);sh=sh.rotate(delta,Image.Resampling.BICUBIC)
 entry=ease((t-start)/.36);exit=ease((end-t)/.36);lift=1-entry*exit
 pp=(p[0]+(16 if p[0]>510 else -16)*lift,p[1]+28*lift)
 a=min(entry,exit)
 if a<1:v.putalpha(v.getchannel('A').point(lambda q:round(q*a)));sh.putalpha(sh.getchannel('A').point(lambda q:round(q*a)))
 # Pin the physical contact point of the model (outlet, lens centre, bristle
 # edge), projected through the same rotation Blender used, to the path.
 cx,cy,_=G.rotate(G.CONTACT[name],(angles[0],angles[1],angles[2]+delta))
 pp=(pp[0]-cx*PX_PER_MM/S,pp[1]+cy*PX_PER_MM/S)
 composite_tool(im,v,sh,pp,FACTOR)
barrier3d=Image.open(A/'barrier_volume.png').convert('RGBA')
from PIL import ImageChops
# A spatially deposited film, never a whole-crown opacity entrance.
all_enamel=Image.new('L',(W,H))
for m in masks:all_enamel=ImageChops.lighter(all_enamel,m)
# Clear wet gel: a faint cool film plus surface reflections. The photographed
# enamel colour stays visible; nothing is recoloured or whitened by the gel.
gel_thick=Image.open(A/'gel_thickness.png').convert('L').point(lambda v:round(255*min(1,v/170)**.45)).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(2.5))
gel_tint=Image.new('RGBA',(W,H),(150,198,238,0))  # pale translucent blue, as in the in-use photograph;gel_tint.putalpha(ImageChops.multiply(gel_thick,all_enamel).point(lambda a:round(a*.20)))
gel_spec=Image.open(A/'gel_spec.png').convert('RGB').point(lambda v:max(0,min(255,round((v-24)*.48))))
# The dispensing path covers each crown with overlapping narrow ribbons.
gelp=[];gel_owner=[]
for owner,poly in enumerate(crowns):
 # Scan only through the enamel interior. The nozzle does not paint a bounding
 # rectangle through the gingiva or the interproximal spaces.
 outline=smooth(poly,True);ys=[p[1] for p in outline];top=min(ys)+6;bot=max(ys)-4
 rows=max(4,round((bot-top)/8)+1)
 for j in range(rows):
  y=top+(bot-top)*j/(rows-1);hits=[]
  for a,b in zip(outline,outline[1:]+outline[:1]):
   if (a[1]<=y<b[1]) or (b[1]<=y<a[1]):hits.append(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]))
  if not hits:continue
  lo=min(hits)+3;hi=max(hits)-3
  if lo>hi:lo=hi=(lo+hi)/2
  gelp.extend([(lo,y),(hi,y)] if j%2==0 else [(hi,y),(lo,y)]);gel_owner.extend([owner,owner])
# Arc length parameterization keeps the flow following the nozzle without jumps.
def prepare_path(points):
 lengths=[0.0]
 for a,b in zip(points,points[1:]):lengths.append(lengths[-1]+math.dist(a,b))
 return points,lengths
def resample(points,step):
 data=prepare_path(points);n=max(2,round(data[1][-1]/step));return [walk(data,k/n)[-1] for k in range(n+1)]
gp=prepare_path(smooth(gelp))
def walk(data,amount):
 points,lens=data;target=max(0,min(1,amount))*lens[-1];out=[points[0]]
 for i in range(1,len(points)):
  if lens[i]<=target:out.append(points[i])
  else:
   f=(target-lens[i-1])/max(.0001,lens[i]-lens[i-1]);a=points[i-1];b=points[i];out.append((a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f));break
 return out
# The cannula outlet rides just apical to the margin, inside the band it lays.
bp=prepare_path(resample([(x,y-5) for x,y in barrier],3))

def gel_pose(progress):
 import bisect
 k=max(0,min(len(gp[1])-1,bisect.bisect_left(gp[1],max(0,min(1,progress))*gp[1][-1])))
 owner=gel_owner[min(len(gel_owner)-1,k//16)]
 return 0 if owner<2 else 1 if owner<4 else 2

def water_point(v,pose):
 # Exact projected anchors for the two corresponding Blender pose rotations.
 _,ay,az=G.SCALER_POSES[pose];ay=math.radians(ay);az=math.radians(az)
 x,y,z=[a*10 for a in v];rx=math.cos(ay)*x+math.sin(ay)*z;ry=y
 return ((rx*math.cos(az)-ry*math.sin(az))*PX_PER_MM,-(rx*math.sin(az)+ry*math.cos(az))*PX_PER_MM)

def deposit_mask(data,amount,width):
 # Half-resolution flow mask, soft boundaries; the volume itself remains full-res.
 points=walk(data,amount);m=Image.new('L',(W//2,H//2));d=ImageDraw.Draw(m)
 q=[(point(p)[0]/2,point(p)[1]/2) for p in points]
 d.line(q,fill=255,width=round(width*S/2),joint='curve')
 r=width*S/4
 for x,y in [q[0],q[-1]]:d.ellipse((x-r,y-r,x+r,y+r),fill=255)
 return m.filter(ImageFilter.GaussianBlur(4)).resize((W,H),Image.Resampling.BILINEAR),points[-1]
# Assign barrier pixels to the nearest physical path position. Unlike a round
# reveal brush, this field cannot expose a whole cap ahead of the cannula.
import numpy as np
barrier_arc=np.full((H,W),np.inf,dtype=np.float32)
closest=np.full((H,W),np.inf,dtype=np.float32)
for idx,(a,b) in enumerate(zip(bp[0],bp[0][1:])):
 ax,ay=point(a);bx,by=point(b);vx=bx-ax;vy=by-ay;den=max(.0001,vx*vx+vy*vy)
 x0=max(0,int(min(ax,bx)-230));x1=min(W,int(max(ax,bx)+231));y0=max(0,int(min(ay,by)-230));y1=min(H,int(max(ay,by)+231))
 yy,xx=np.mgrid[y0:y1,x0:x1];raw=((xx-ax)*vx+(yy-ay)*vy)/den
 frac=np.clip(raw,0,1);dist=(xx-ax-frac*vx)**2+(yy-ay-frac*vy)**2
 old=closest[y0:y1,x0:x1];take=dist<old
 # End segments retain signed projection beyond their endpoints; pixels in
 # front of the final outlet keep arc lengths greater than the path length.
 label=raw if idx in [0,len(bp[0])-2] else frac
 arc=bp[1][idx]+label*(bp[1][idx+1]-bp[1][idx])
 old[take]=dist[take];barrier_arc[y0:y1,x0:x1][take]=arc[take]
del closest

def barrier_deposit(amount):
 if amount<=0:return Image.new('L',(W,H))
 cutoff=min(1,amount)*bp[1][-1]
 # Backward-only antialias band: there is no forward blur/reveal radius.
 alpha=np.clip((cutoff-barrier_arc)*S/3,0,1)*255
 return Image.fromarray(alpha.astype(np.uint8),'L')

def apply_film(im,film,mask):
 a=film.copy();a.putalpha(ImageChops.multiply(a.getchannel('A'),mask));im.alpha_composite(a)
def apply_gel(im,mask):
 apply_film(im,gel_tint,mask)
 lit=ImageChops.add(im.convert('RGB'),ImageChops.multiply(gel_spec,Image.merge('RGB',(mask,mask,mask))))
 im.paste(lit)

def scaling_pose(t):
 # Two separate incisors. The short terminal side tracks the labial surface;
 # the free extremity is displaced from the lateral contact origin.
 if t<6.6:
  local=t-2;cx=480;cy=214
 elif t<7.2:
  u=ease((t-6.6)/.6);return (480+68*u,214-10*math.sin(u*math.pi)),False
 else:local=t-7.2;cx=548;cy=212
 entry=ease(local/.5);working=max(0,local-.5)
 x=cx-4+8*min(1,working/3.4);y=cy+2.4*math.sin(working*math.pi*3.0)
 if local<.5:return (x+25*(1-entry),y+20*(1-entry)),False
 if t>11.4:
  v=ease((t-11.4)/.6);return (x+30*v,y+24*v),False
 return (x,y),True

def frame(t):
 im=initial.convert('RGBA')
 if 2<=t<12:
  p,contact=scaling_pose(t);tool(im,'scaler0' if t<7 else 'scaler1',p,t)
  if contact:
   # Fine local irrigant, not a rotating drill or an enlarged vibration.
   layer=Image.new('RGBA',im.size);d=ImageDraw.Draw(layer);xx,yy=point(p)
   # Coherent wet stream along the insert, then atomisation and runoff.
   phase=t*1.7;pose=0 if t<7 else 1
   anchor=[(.34,-1.24,.018),(.42,-.83,.02),(.39,-.53,.02),(.32,-.31,.02),(.17,-.12,.02),(0,0,.015)]
   stream=[]
   for v in anchor:
    dx,dy=water_point(v,pose);stream.append((xx+dx,yy+dy))
   d.line(stream,fill=(166,211,230,125),width=5,joint='curve')
   d.line([(x+2,y) for x,y in stream],fill=(226,242,248,160),width=2,joint='curve')
   for k in range(95):
    f=(t*2.5+k*.087)%1;a=.22+(k%29)/28*2.7
    vx=math.cos(a)*(55+(k%7)*11);vy=math.sin(a)*(45+(k%11)*9)
    dx=vx*f;dy=vy*f+48*f*f;r=1.0+(k%4)*.48
    tail=(xx+dx-vx*.025,yy+dy-vy*.025)
    d.line((tail,(xx+dx,yy+dy)),fill=(222,243,250,round(240*(1-f))),width=round(r*1.9))
    if k%6==0:
     d.ellipse((xx+dx-4,yy+dy-6,xx+dx+4,yy+dy+6),fill=(117,170,184,round(125*(1-f))),outline=(218,246,252,round(240*(1-f))),width=2)
     d.line((xx+dx-1,yy+dy-3,xx+dx+1,yy+dy-1),fill=(245,254,255,round(245*(1-f))),width=2)
   # Surface wetting at contact; a thin transparent water film, not glitter.
   d.ellipse((xx-22,yy-9,xx+22,yy+12),fill=(171,219,234,25))
   im.alpha_composite(layer)
 if 21<=t<33:
  progress=min(1,max(0,(t-21.36)/7.28));mask,gp_now=deposit_mask(gp,progress,19)
  if t>=30:
   removal,suc=deposit_mask(gp,min(1,max(0,(t-30.36)/2.28)),21);mask=ImageChops.subtract(mask,removal)
  apply_gel(im,ImageChops.multiply(mask,all_enamel))
  if 21.36<t<28.64:
   # A small clear bead at the advancing outlet.
   wet=Image.new('RGBA',im.size);d=ImageDraw.Draw(wet);xx,yy=point(gp_now)
   d.ellipse((xx-13,yy-9,xx+13,yy+9),fill=(150,198,238,110))
   d.arc((xx-9,yy-6,xx+9,yy+5),200,320,fill=(250,253,255,170),width=2)
   wet.putalpha(ImageChops.multiply(wet.getchannel('A'),all_enamel));im.alpha_composite(wet)
 if 12<=t<33:
  # The barrier exists only behind the cannula outlet; it overlaps the gel edge.
  amount=min(1,max(0,(t-12.36)/4.28));p=walk(bp,amount)[-1];mask=barrier_deposit(amount);apply_film(im,barrier3d,mask)
  if t<17:posed_tool(im,'barrier',p,t,12,17)
 if 17<=t<21:
  # One slow pass along the band. The lens faces the resin, about 1-2 mm off,
  # so the light is seen as a blue wash on the barrier around the head.
  phase=max(0,min(1,(t-17.36)/3.28));p=walk(bp,ease(phase))[-1];p=(p[0],p[1]-4);xx,yy=point(p)
  activity=ease((t-17.3)/.2)*ease((20.7-t)/.2)
  glow=Image.new('RGBA',im.size);d=ImageDraw.Draw(glow)
  for rr,aa in [(330,46),(240,80),(160,120)]:d.ellipse((xx-rr,yy-rr*.85,xx+rr,yy+rr*.85),fill=(36,92,255,round(aa*activity)))
  glow=glow.filter(ImageFilter.GaussianBlur(26));im.alpha_composite(glow)
  posed_tool(im,'light',p,t,17,21)
  # Faint spill on the underside of the head itself.
  spill=Image.new('RGBA',im.size);ImageDraw.Draw(spill).ellipse((xx-150,yy-130,xx+150,yy+130),fill=(60,120,255,round(46*activity)))
  im.alpha_composite(spill.filter(ImageFilter.GaussianBlur(40)))
 if 21<=t<33:
  if t<29:posed_tool(im,'gel',gp_now,t,21,29)
  if t>=30:posed_tool(im,'suction',suc,t,30,33)
 if 33<=t<37:
  # Two readable contacts with short circular sweeps, a release and reposition.
  local=(t-33)%2;cx=480 if t<35 else 548;cy=239 if t<35 else 237
  active=ease(local/.36)*ease((2-local)/.36)
  ang=max(0,local-.36)*math.tau*1.3
  p=(cx+4*math.cos(ang)*active,cy+3*math.sin(ang)*active)
  # Subtle paste at the bristle/enamel contact, never a bleaching/colour effect.
  paste=Image.new('RGBA',im.size);d=ImageDraw.Draw(paste);xx,yy=point(p)
  for j in range(22):
   a=j*2.4;rr=6+(j%6)*2
   x=xx+math.cos(a)*rr;y=yy+math.sin(a)*rr
   d.ellipse((x-2,y-1,x+3,y+2),fill=(231,225,208,round(100*active)))
  paste.putalpha(ImageChops.multiply(paste.getchannel('A'),all_enamel));im.alpha_composite(paste)
  posed_tool(im,'polish',p,t,33 if t<35 else 35,35 if t<35 else 37,spin=True)
 if t>=37:im=final.convert('RGBA')
 # A close view makes the two individual scaler contacts readable.
 zoom=1+.30*ease((t-2)/.6)*(1-ease((t-11.5)/.5)) if 2<=t<12 else 1.0
 if zoom>1:
  ww=W/zoom;hh=H/zoom;cx=point((510,230))[0];cy=H*.43
  left=max(0,min(W-ww,cx-ww/2));top=max(0,min(H-hh,cy-hh/2));im=im.crop((round(left),round(top),round(left+ww),round(top+hh))).resize((W,H),Image.Resampling.LANCZOS)
 return im.convert('RGB')
def frame_bytes(n):return frame(n/FPS).tobytes()

if __name__=='__main__' and '--timing-check' in sys.argv:
 # The barrier may exist only behind the cannula outlet: report how much resin
 # is visible at each stage and how far any of it leads the outlet.
 resin=np.asarray(barrier3d.getchannel('A'))>8;rows=[]
 for amount in [0,.005,.1,.25,.5,.75,.99,1]:
  vis=(np.asarray(barrier_deposit(amount))>0)&resin;cut=min(1,amount)*bp[1][-1]
  lead=float(max(0,(barrier_arc[vis]-cut).max())) if vis.any() else 0
  rows.append({'progress':amount,'visible_pixels':int(vis.sum()),'front_lead_source_pixels':round(lead,3)})
 (P/'barrier_timing_check.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows))
elif __name__=='__main__' and '--stills' in sys.argv:
 (P/'checks').mkdir(exist_ok=True)
 for t in [1,4,9,13,15.5,17.5,18,19.8,23,26,28.4,29.5,31.2,34,36,39]:frame(t).save(P/'checks'/f'check_{t}.jpg',quality=92)
elif __name__=='__main__':
 OUT=P.parents[1]/'out';OUT.mkdir(exist_ok=True);out=OUT/(f'{NAME}_Proof.mp4' if '--proof' in sys.argv else f'{NAME}.mp4');q=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
 import multiprocessing as mp
 indices=[n for a,b in [(13,15),(17,19),(23,25),(30,32),(33,37)] for n in range(a*FPS,b*FPS)] if '--proof' in sys.argv else list(range(FPS*DUR))
 with mp.get_context('fork').Pool(4) as pool:
  for start in range(0,len(indices),12):
   for data in pool.map(frame_bytes,indices[start:start+12]):q.stdin.write(data)
   if start%120==0:print(start,flush=True)
 q.stdin.close();assert q.wait()==0;print(out)
