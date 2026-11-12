"""Refine the two market aprons and plaza joints without regenerating locked art."""
from pathlib import Path
import xml.etree.ElementTree as ET
import random
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'public/pixi-art/themes/sunflower'
BASE=ROOT.parent/'concepts/themes/work/sunflower/baseline/ground'
NS='http://www.w3.org/2000/svg'
ET.register_namespace('',NS)
def node(tag,**attrs):return ET.Element('{'+NS+'}'+tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
for path in sorted(BASE.glob('ground-*.svg')):
 root=ET.parse(path).getroot()
 for i,(x,y,w,h) in enumerate([(4960,2700,1600,360),(3990,1570,670,390)]):
  children=list(root);start=next(n for n,e in enumerate(children) if e.get('id')==f'row{i}')
  for e in children[start:start+5]:root.remove(e)
  group=node('g',id=f'ten-market-{i}',stroke_linejoin='round')
  clip=node('clipPath',id=f'row{i}');clip.append(node('rect',x=x,y=y,width=w,height=h,rx=42));group.append(clip)
  group.append(node('rect',x=x,y=y,width=w,height=h,rx=42,fill='#F1D987',stroke='#39472D',stroke_width=2.4))
  inner=node('g',clip_path=f'url(#row{i})');group.append(inner)
  rng=random.Random(913+i)
  for row,yy in enumerate(range(y+24,y+h-20,66)):
   for xx in range(x-70+(row%2)*54,x+w,108):
    inner.append(node('path',d=f'M {xx+3} {yy+2} L {xx+104} {yy+1} L {xx+107} {yy+62} L {xx+1} {yy+64} Z',
      fill=rng.choice(['#FFF0C7','#FFE7A3','#FFF2D0','#F7E3AE']),stroke='#AF975A',stroke_width=1.35))
  for xx in range(x+45,x+w-40,57):
   for yy in [y,y+h-22]:inner.append(node('path',d=f'M {xx} {yy} l 0 22',fill='none',stroke='#AE975E',stroke_width=1.6))
  for yy in range(y+50,y+h-35,48):
   for xx in [x,x+w-22]:inner.append(node('path',d=f'M {xx} {yy} l 22 0',fill='none',stroke='#AE975E',stroke_width=1.6))
  group.append(node('rect',x=x+23,y=y+23,width=w-46,height=h-46,rx=25,fill='none',stroke='#B49A5D',stroke_width=2))
  root.insert(start,group)
 for e in root.iter():
  if e.get('clip-path')=='url(#plaza)':
   for p in list(e):
    if p.get('stroke-width')=='7':p.set('stroke-width','2.2');p.set('stroke','#B29A62')
 ET.ElementTree(root).write(ART/path.name,encoding='unicode',xml_declaration=True)
print('Finished 24 SVG tiles: two warm coursed markets, soft corners, plaza ink joints')
