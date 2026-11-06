"""Local preview and geometry validation, using the existing centre preview assembler."""
import importlib.util, pathlib, json, random, math, shutil, os
ROOT=pathlib.Path(__file__).resolve().parents[5]
spec=importlib.util.spec_from_file_location('preview',ROOT/'scripts/themes/centre-preview.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
from PIL import Image, ImageDraw
from shapely.geometry import Point
from shapely.ops import unary_union
p.GRASS.update(cathedral=(137,195,50),canal=(86,192,206))
# Same parabolic bridge lift as src/pixi/placements.js deckY. Shared script stays untouched.
def centre_deck_y(data,x,y):
 for a in data.get('arches',[]):
  ax,ay=a['a'];bx,by=a['b'];dx,dy=bx-ax,by-ay;t=((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)
  side=((x-ax)*dy-(y-ay)*dx)/math.hypot(dx,dy)
  if 0<t<1 and abs(side)<=a['w']/2+12:return y-a['r']*4*t*(1-t)
 return y
import inspect
p.centre_deck_y=centre_deck_y
source=inspect.getsource(p.assemble).replace('int((y - y0) * S - d.height)', 'int((centre_deck_y(data, x, y) - y0) * S - d.height)')
exec(source,p.__dict__)

for theme,ref,duckh in [('cathedral','cathedral-centre-2.png',82),('canal','canal-centre-4.png',100)]:
 folder=ROOT/f'public/pixi-art/themes/{theme}/centre';data=json.loads((folder/'centre.json').read_text())
 img,n=p.assemble(theme,data,str(folder),ducks=100,seed=23)
 img.save(folder/'assembled.png')
 p.duck_sprite(130).save(folder/'source/ducky-scale.png')
 concept=ROOT.parent/'concepts/themes/next-centres'/ref
 shutil.copyfile(concept,folder/'source/locked-concept.png')
 f=65/duckh;con=Image.open(concept).convert('RGBA');con=con.resize((round(con.width*f),round(con.height*f)),Image.Resampling.LANCZOS)
 out=Image.new('RGB',(con.width+img.width+80,max(con.height,img.height)+120),(250,248,240));d=ImageDraw.Draw(out)
 d.text((25,25),f'{theme.title()} | LOCKED concept | same Ducky scale',fill=(40,40,40));d.text((con.width+55,25),f'Built SVG layers | {n} Duckies | 130-unit Ducky',fill=(40,40,40))
 out.paste(con,(25,70),con);out.paste(img,(con.width+55,70),img)
 target=folder/f'{theme}-centre-built.png';out.save(target)
 # Geometry audit plus deterministic crowd positions for the browser proof.
 walk=unary_union([p.shape(s) for s in data['walkable']]);blocked=unary_union([p.shape(s) for s in data['blocked']]);free=walk.difference(blocked.buffer(30))
 assert all(p.shape(s).is_valid for s in data['walkable']+data['blocked'])
 assert free.contains(Point(data['spawn']))
 assert n==100
 rng=random.Random(23);pts=[];x0,y0,x1,y1=free.bounds
 for _ in range(60000):
  if len(pts)==100:break
  q=(rng.uniform(x0,x1),rng.uniform(y0,y1))
  if free.contains(Point(q)) and all((q[0]-r[0])**2+((q[1]-r[1])/p.K)**2>82**2 for r in pts):pts.append(q)
 (folder/'preview-crowd.json').write_text(json.dumps(pts))
 sizes={}
 import xml.etree.ElementTree as ET
 for piece in data['pieces']:
  root=ET.parse(folder/piece['file']).getroot()
  assert abs(float(root.attrib['width'])-piece['width'])<.2
  assert abs(float(root.attrib['height'])-piece['height'])<.2
  assert piece['layer'] not in ['sorted','front'] or isinstance(piece.get('sortY'),(int,float))
  assert not any(el.tag.split('}')[-1] in ['image','linearGradient','radialGradient'] for el in root.iter())
  sizes[piece['file']]=(folder/piece['file']).stat().st_size
 audit=dict(theme=theme,pieces=len(sizes),svgBytes=sum(sizes.values()),crowdPlaced=n,spawnValid=True,allFootprintsValid=True,allPieceDimensionsMatch=True,noRasterOrGradientInSVG=True,freeArea=round(free.area),capacity=data['capacity'])
 (folder/'validation.json').write_text(json.dumps(audit,indent=2)+'\n')
 print(json.dumps(audit))
 dest=ROOT.parent/f'concepts/themes/centre-variations/{theme}-centre-built.png'
 try:shutil.copyfile(target,dest);print('Preview saved',dest)
 except PermissionError:print('Sandbox denied requested preview destination. Saved',target)
