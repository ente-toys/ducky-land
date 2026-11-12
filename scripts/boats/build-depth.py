"""Rebuild boat foregrounds from the near hull band, never from a feet-height cut.
Run with /private/tmp/boat48-311/bin/python scripts/boats/build-depth.py.
"""
import io,json,importlib.util
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from PIL import Image,ImageDraw
import cairosvg
ROOT=Path(__file__).resolve().parents[2]
CONCEPT=ROOT.parent/'concepts/boat-turntable'
SPIN=ROOT/'public/pixi-art/boat/spin'
meta=json.loads((SPIN/'frames.json').read_text())
views=json.loads((SPIN.parent/'views.json').read_text())
spec=importlib.util.spec_from_file_location('front',CONCEPT/'build-front.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
mod.SPIN=str(CONCEPT/'spin48-work/rasters')+'/'
mod.grow=lambda seed,allowed,limit=10**6:ndi.binary_propagation(seed&allowed,mask=allowed)
mod.fill_holes=ndi.binary_fill_holes
targets={27:[-46,-64.4],30:[-34,-48],33:[-16,-25],36:[0,-18],39:[18,-18],42:[37,-32],45:[42,-56],48:[42.9,-59.5]}
for n,f in enumerate(meta['frames']):
 if 27<=n<=47:
  keys=sorted(targets);i=next((j for j in range(len(keys)-1) if keys[j]<=n<=keys[j+1]),len(keys)-2);a,b=keys[i:i+2];u=(n-a)/(b-a)
  f['riderSeat']=[round(targets[a][k]+(targets[b][k]-targets[a][k])*u,1) for k in range(2)]
proof=Image.new('RGB',(8*256,6*224),'#c4e2f5');boundaries=[]
for n,f in enumerate(meta['frames']):
 src=(SPIN/Path(f['file']).name).read_text()
 im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=src.encode()))).convert('RGBA');a=np.array(im).astype(int)
 solid=a[...,3]>127;light=(a[...,0]>215)&(a[...,1]>195)&(a[...,2]>140)&solid
 boundary=np.full(640,560.,dtype=float)
 for x in range(640):
  yy=np.flatnonzero(solid[:,x]);
  if len(yy)==0:continue
  bottom=yy[-1]
  if bottom<350:continue
  runs=ndi.label(light[max(300,bottom-70):bottom+1,x])[0]
  for label in range(runs.max(),0,-1):
   ys=np.flatnonzero(runs==label)
   if len(ys)>=4:
    boundary[x]=max(300,bottom-70)+ys[0]-7;break
 valid=np.flatnonzero(boundary<560)
 boundary=np.interp(np.arange(640),valid,boundary[valid]);boundary=ndi.median_filter(boundary,size=9)
 yy=np.arange(560)[:,None]
 feet_y=meta['anchor'][1]*560+f['riderSeat'][1]*640/meta['drawWidth']
 hull=(yy>=boundary[None,:]) & (yy>=feet_y-16)
 labels,count=ndi.label(hull & solid)
 sizes=np.bincount(labels.ravel());sizes[0]=0
 mask=ndi.binary_fill_holes(labels==sizes.argmax())
 if 5<=n<=19:
  old=mod.front_mask(n,f['riderSeat'][1],meta)
  head=old[::2,::2].copy()
  cutoff=meta['anchor'][1]*560+f['riderSeat'][1]*640/meta['drawWidth']+2
  head[yy.repeat(640,1)>cutoff-3]=False
  mask|=head
 tf,d=mod.potrace_path(mask)
 head,rest=src.split('>',1);inner=rest.rsplit('</svg>',1)[0]
 out=f'{head}><defs><clipPath id="front" clipPathUnits="userSpaceOnUse"><path transform="{tf}" d="{d}"/></clipPath></defs><g clip-path="url(#front)">{inner}</g></svg>'
 (SPIN/'front'/f'boat-{n:02d}.svg').write_text(out)
 view=views['views'][f'f{n:02d}'];view['seat']=f['riderSeat'];view['front']=f'spin/front/boat-{n:02d}.svg'
 boundaries.append({'frame':n,'centreNearRimY':round(float(boundary[320]),1)})
 fg=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=out.encode()))).convert('RGBA').resize((256,224));proof.paste(fg,(n%8*256,n//8*224),fg);ImageDraw.Draw(proof).text((n%8*256+4,n//8*224+4),str(n),fill='black')
meta['note']='48 angles, 7.5 degrees apart. seat retains measured bench coordinates; riderSeat is the clear deck position in front of mast and sail. Boat pivots around the fixed rider. Foregrounds contain only near hull rim and camera-facing bow head.'
views['note']='48-angle SVG spin. Fixed rider pin; per-view clear deck seat. Every foreground contains near hull only, plus the duck-head bow in views 05-19. No mast or sail foreground.'
(SPIN/'frames.json').write_text(json.dumps(meta,indent=1)+'\n');(SPIN.parent/'views.json').write_text(json.dumps(views,indent=1)+'\n')
(CONCEPT/'spin48-work/depth-rims.json').write_text(json.dumps(boundaries,indent=1)+'\n')
proof.save('/private/tmp/boat48-fronts.png')
