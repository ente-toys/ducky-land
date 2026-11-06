"""Cathedral image_gen sheets -> palette-flattened SVGs. Python 3.11 + vtracer, numpy, Pillow.
Uses the same 2x upsample, palette snap, ink thinning and spline tracing as library-trace.py.
"""
from pathlib import Path
import numpy as np, vtracer, re, colorsys
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/pixi-art/themes/cathedral/detail'
WORK=ROOT.parent/'concepts/themes/work/cathedral'
(WORK/'detail').mkdir(parents=True,exist_ok=True)
PAL=np.array([[57,71,45],[255,244,210],[248,222,187],[232,205,170],[206,169,111],[183,135,73],[200,120,69],[230,151,77],[250,186,103],[141,168,95],[104,127,67],[174,186,119],[103,160,132],[62,114,94],[248,195,61],[242,154,108]],dtype=float)
def warm_palette(text,name):
 # Keep the HOME-quality palette when rebuilding from the retained image_gen source sheets.
 def pop(m):
  hx=m.group();rgb=[int(hx[i:i+2],16)/255 for i in (1,3,5)];h,s,v=colorsys.rgb_to_hsv(*rgb)
  if name=='olive-tree' and .16<h<.3 and .1<s<.65 and v>.3:
   h=.23 if v>.6 else .25;s=min(.72,s*1.65);v=min(.8,v*1.07)
  elif name in ['cathedral','bell-tower','arcade','terracotta-pot','cottage','pergola'] and .035<h<.13 and .25<s<.7 and v>.45:
   s=min(.8,s*1.22);v=min(.97,v*1.05)
  else:return hx
  return '#'+''.join(f'{round(c*255):02X}' for c in colorsys.hsv_to_rgb(h,s,v))
 return re.sub(r'#[A-Fa-f0-9]{6}',pop,text)
def trace(src,box,name):
 a=np.array(Image.open(src).crop(box).convert('RGB'))
 m=~((a.min(2)>237)&((a.max(2).astype(int)-a.min(2))<18))
 ys,xs=np.where(m); x0,x1=max(0,xs.min()-5),min(a.shape[1],xs.max()+6); y0,y1=max(0,ys.min()-5),min(a.shape[0],ys.max()+6)
 a=a[y0:y1,x0:x1]; m=m[y0:y1,x0:x1]; h,w=m.shape
 rgb=np.array(Image.fromarray(a).resize((w*2,h*2)).filter(ImageFilter.MedianFilter(3))).astype(float)
 mask=np.array(Image.fromarray(m.astype('uint8')*255).resize((w*2,h*2)))>127
 px=rgb.reshape(-1,3); ids=np.concatenate([np.argmin(((px[i:i+30000,None]-PAL[None])**2).sum(2),1) for i in range(0,len(px),30000)]).reshape(mask.shape)
 ids[rgb.max(2)<105]=0
 # Thin internal ink by 2 source pixels, preserving closed outlines.
 for _ in range(2):
  ink=(ids==0)&mask
  for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
   nb=np.roll(np.roll(ids,dy,0),dx,1); nm=np.roll(np.roll(mask,dy,0),dx,1)
   take=ink&nm&(nb!=0); ids=np.where(take,nb,ids); ink &=~take
 mask=np.array(Image.fromarray(mask.astype('uint8')*255).filter(ImageFilter.MinFilter(3)))>127
 rgba=np.dstack([PAL[ids].astype('uint8'),mask.astype('uint8')*255]); tmp=WORK/'detail'/f'{name}-trace.png'; Image.fromarray(rgba).save(tmp)
 dst=OUT/f'{name}.svg';vtracer.convert_image_to_svg_py(str(tmp),str(dst),colormode='color',hierarchical='stacked',mode='spline',filter_speckle=16,color_precision=8,layer_difference=1,corner_threshold=60,length_threshold=5,max_iterations=10,splice_threshold=45,path_precision=1)
 s=dst.read_text(); body=s[s.index('<path'):s.rindex('</svg>')]
 dst.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w*2} {h*2}"><title>Bellovo Piazza: {name}</title>{body}</svg>')
 dst.write_text(warm_palette(dst.read_text(),name))
 print(name,w,h,round(dst.stat().st_size/1024),'KB')
for sheet,names,cut in [('props-source.png',['cathedral','bell-tower','arcade','olive-tree'],.60),('town-source.png',['stone-bench','terracotta-pot','cottage','pergola'],.49)]:
 src=WORK/sheet; w,h=Image.open(src).size; y=round(h*cut)
 for box,name in zip([(0,0,w//2,y),(w//2,0,w,y),(0,y,w//2,h),(w//2,y,w,h)],names):trace(src,box,name)
