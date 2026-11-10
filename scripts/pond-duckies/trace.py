"""Trace the approved keepers. PNG intermediates stay in /tmp, never the repo."""
from PIL import Image
import numpy as np, pathlib, re, subprocess, xml.etree.ElementTree as ET
source=pathlib.Path('/Users/pragadees.xd/Downloads/Ducky Land/floating-duckies/keep')
out=pathlib.Path('public/pixi-duck/float'); temp=pathlib.Path('/tmp/pond-duckies'); temp.mkdir(exist_ok=True)
for name in ['f4_ring','g1_donut','g4_paperboat','g6_lounger','g3_snorkel_c','g2_padhat','f6_peek']:
 im=Image.open(source/(name+'.png')).convert('RGBA'); alpha=im.getchannel('A').point(lambda v:255 if v>40 else 0); box=alpha.getbbox(); im=im.crop(box)
 a=np.array(im); rgb=a[:,:,:3].astype(float)/255; hi=rgb.max(2);lo=rgb.min(2); sat=(hi-lo)/np.maximum(hi,.001)
 # Deliberately flatten painted lighting into the same small palette as native Duckies.
 pal=['#232323','#ffcf23','#ffdf65','#ff884a','#fafbf7','#bdbfba','#f8293a','#ef83b2','#f3bd48','#689d43','#25d9de','#81cce1','#b3e9f0','#83da57']
 from PIL import ImageColor
 p=np.array([ImageColor.getrgb(c) for c in pal]); d=((a[:,:,:3,None].transpose(0,1,3,2).astype(float)-p)**2).sum(3); idx=d.argmin(2)
 dark=hi<.36; idx[dark]=0
 yellow=(rgb[:,:,0]>.72)&(rgb[:,:,1]>.55)&(rgb[:,:,2]<.55)
 idx[yellow & (sat>.78)]=1;idx[yellow & (sat<=.78)]=2
 a[:,:,:3]=p[idx]; a[:,:,3]=np.where(a[:,:,3]>40,255,0)
 clean=temp/(name+'.png');Image.fromarray(a).save(clean)
 paths=[]
 for k,color in enumerate(pal):
  mask=Image.fromarray(np.where((idx==k)&(a[:,:,3]>0),0,255).astype('uint8')).convert('1')
  pbm=temp/(name+str(k)+'.pbm');mask.save(pbm)
  svg=temp/(name+str(k)+'.svg')
  subprocess.run(['potrace',str(pbm),'-s','-o',str(svg),'--turdsize','28','--opttolerance','.6'],check=True)
  root=ET.parse(svg).getroot()
  for g in root:
   if g.tag.endswith('g'):
    paths.append('<g data-piece="'+('ripple' if k in [11,12] else 'duck')+'" transform="'+g.attrib['transform']+'" fill="'+color+'" stroke="'+color+'" stroke-width="6">'+''.join('<path d="'+n.attrib['d']+'"/>' for n in g if n.tag.endswith('path'))+'</g>')
 s='<svg xmlns="http://www.w3.org/2000/svg" width="'+str(im.width)+'" height="'+str(im.height)+'" viewBox="0 0 '+str(im.width)+' '+str(im.height)+'"><title>'+name+' floating Ducky</title>'+''.join(paths)+'</svg>\n'
 (out/(name+'.svg')).write_text(s)
 parts=out/'parts';parts.mkdir(exist_ok=True)
 for piece in ['duck','ripple']:
  groups=[g for g in paths if 'data-piece="'+piece+'"' in g]
  (parts/(name+'-'+piece+'.svg')).write_text(s[:s.index('<g ')]+''.join(groups)+'</svg>\n')
 print(name,box,len(s))
