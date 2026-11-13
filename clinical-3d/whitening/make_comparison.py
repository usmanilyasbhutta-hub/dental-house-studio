# Private review sheet: reference photograph (left) beside the v9 reconstruction
# (right). Uses reference_photos/ when fetch_references.py could download them;
# otherwise re-uses the reference crops embedded in the v8 sheet.
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import numpy as np
P=Path(__file__).parent
(P/'checks').mkdir(exist_ok=True)
need=[17.5,29.5]
if any(not (P/'checks'/f'check_{t}.jpg').exists() for t in need):
 import importlib.util
 spec=importlib.util.spec_from_file_location('case_render',P/'render.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
 for t in need:r.frame(t).save(P/'checks'/f'check_{t}.jpg',quality=92)
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',23)
SM=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
V8=P/'Reference_vs_Model_v8.jpg';v8=Image.open(V8) if V8.exists() else None
items=[('SDI Gingival Barrier','barrier.jpg','barrier_syringe',0,(300,85,440,425)),
       ('SDI Pola Office+ — assembled working nozzle','pola.jpg','syringe',0,(305,485,430,825)),
       ('NSK FX57 + soft screw-in brush','fx57.png','polisher',90,(60,960,680,1150)),
       ('SDI Radii-Cal CX — handpiece, stand omitted','light.jpg','curing_light',180,(280,1285,460,1625)),
       ('COLTENE ROEKO Surgitip','suction.jpg','suction',115,(170,1685,570,2025))]
clinical=[('Clinical barrier appearance — SDI-hosted report',(270,2180,470,2315),17.5),('Clinical gel appearance — SDI-hosted report',(270,2580,470,2715),29.5)]
sheet=Image.new('RGB',(1500,2900),'#f5f5f5');d=ImageDraw.Draw(sheet)
d.text((25,12),'REFERENCE PHOTOGRAPH                       CODE-BUILT RECONSTRUCTION (v9)',font=F,fill='#142b3e')
def fit(im,box,rotate=0):
 im=im.convert('RGBA')
 if im.getchannel('A').getextrema()==(255,255):
  ar=np.asarray(im)[:,:,:3];ys,xs=np.where(ar.min(2)<237)
  if len(xs):im=im.crop((max(0,xs.min()-8),max(0,ys.min()-8),min(im.width,xs.max()+9),min(im.height,ys.max()+9)))
 else:
  bb=im.getchannel('A').getbbox()
  if bb:im=im.crop(bb)
 if rotate:im=im.rotate(rotate,expand=True)
 im.thumbnail((box[2],box[3]),Image.Resampling.LANCZOS);bg=Image.new('RGBA',im.size,'#f5f5f5');bg.alpha_composite(im)
 sheet.paste(bg.convert('RGB'),(box[0]+(box[2]-im.width)//2,box[1]+(box[3]-im.height)//2))
def reference(name,crop):
 f=P/'reference_photos'/name
 if f.exists():return Image.open(f)
 if v8 is None:raise SystemExit('Run fetch_references.py or keep Reference_vs_Model_v8.jpg for the reference crops')
 return v8.crop(crop)
for i,(label,photo,model,rot,crop) in enumerate(items):
 y=52+i*400;d.text((25,y),label,font=F,fill='#142b3e')
 fit(reference(photo,crop),(25,y+36,690,335))
 fit(Image.open(P/'assets'/f'{model}_comparison.png'),(770,y+36,690,335),rot)
 d.line((25,y+394,1475,y+394),fill='#c9d1d8',width=1)
pdf=P/'reference_photos'/'clinical.pdf'
if pdf.exists():
 import fitz
 page=fitz.open(pdf)[1];pix=page.get_pixmap(matrix=fitz.Matrix(1.2,1.2));pageim=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
for i,(label,crop,t) in enumerate(clinical):
 y=2055+i*400;d.text((25,y),label,font=F,fill='#142b3e')
 im=pageim.crop([(474,368,668,501),(270,552,459,684)][i]) if pdf.exists() else v8.crop(crop)
 fit(im,(25,y+45,690,300))
 own=Image.open(P/'checks'/f'check_{t}.jpg').crop((390,80,1870,650));fit(own,(770,y+45,690,300))
 d.text((780,y+350),'Synthetic material on the supplied case photograph',font=SM,fill='#405564')
d.text((25,2875),'Sources: sdi.com.au | nskdental.com | products.coltene.com | sdiodonto.com.br — URLs in REFERENCES.md',font=SM,fill='#405564')
sheet.save(P/'Reference_vs_Model_v9.jpg',quality=94)
