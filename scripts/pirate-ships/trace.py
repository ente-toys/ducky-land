"""Trace approved local PNGs, never modify originals. Flat palette, one ink colour."""
from pathlib import Path
import sys,re,tempfile,subprocess,xml.etree.ElementTree as ET
from PIL import Image,ImageFilter
source=Path(sys.argv[1])
out=Path(__file__).resolve().parents[2]/'public/pixi-art/pirate-ships'
palette=([[35,35,35],[174,99,44],[230,157,76],[255,209,40],[255,224,102],[250,234,204],[219,49,54],[255,125,43],[113,199,223],[187,233,247],[255,253,247]])
for name in ['p3_duckhull','p5_raft','p6_treasure']:
 im=Image.open(source/(name+'.png')).convert('RGBA')
 pal=Image.new('P',(1,1));flat=sum(palette,[]);pal.putpalette(flat+palette[-1]*(256-len(palette)))
 labels=im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE).filter(ImageFilter.ModeFilter(3))
 rgba=labels.convert('RGBA');rgba.putalpha(im.getchannel('A').point(lambda v:255 if v>180 else 0))
 with tempfile.TemporaryDirectory(prefix='ducky-pirate-trace-') as tmp:
  png=Path(tmp)/'flat.png';rgba.save(png)
  dst=out/(name+'.svg')
  groups=[]
  for k,color in enumerate(palette):
   mask=labels.point(lambda v:0 if v==k else 255).convert('L')
   mask.paste(255,(0,0),rgba.getchannel('A').point(lambda v:255-v))
   pbm=Path(tmp)/f'{k}.pbm';svg=Path(tmp)/f'{k}.svg';mask.convert('1').save(pbm)
   subprocess.run(['/opt/homebrew/bin/potrace',str(pbm),'-s','-o',str(svg),'--turdsize','16','--opttolerance','.4'],check=True)
   tree=ET.fromstring(svg.read_text());g=tree.find('{http://www.w3.org/2000/svg}g')
   fill='#'+''.join(f'{c:02x}' for c in color)
   paths=''.join('<path d="'+p.attrib['d']+'"/>' for p in g)
   groups.append(f'<g transform="{g.attrib["transform"]}" fill="{fill}" stroke="none">{paths}</g>')
  s='<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>Approved pirate '+name+'</title>'+''.join(groups)+'</svg>\n'
  dst.write_text(s);print(name,len(s),s.count('<path'))
