"""Sunbob path repair. Geometry functions execute verbatim from Home 5acb0b5d.
No nearest-component connector, second plaza path painter, or old path masks.
"""
import ast,json,math,re,sys,hashlib
from pathlib import Path
import xml.etree.ElementTree as ET
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Polygon,LineString,Point,box,mapping
from shapely.ops import unary_union,triangulate
from shapely import affinity
# Reuse the actual approved Home sampler and union contour writer, not a new spline.
home=Path('scripts/home-review/paths.py').read_text()
for fn in ast.parse(home).body:
 if isinstance(fn,ast.FunctionDef) and fn.name in ('sample','path'):
  exec(ast.get_source_segment(home,fn),globals())
A=Path('public/pixi-art/themes/sunflower');D=Path('rive/web/themes/sunflower')
W=json.loads((D/'world.json').read_text());art=json.loads((A/'art.json').read_text())
data=json.loads(Path('/private/tmp/sunbob-ground-data.json').read_text())
R=json.loads(Path('scripts/sunbob-ground/routes.json').read_text())
residents=json.loads(Path('scripts/sunbob-ground/residents-before.json').read_text())
residentClear=unary_union([affinity.scale(Point(b['x'],b['y']).buffer(1,quad_segs=12),b['r']+38,75) for b in residents])
def poly(p):return Polygon(p).buffer(0)
wet=unary_union([poly(w['poly']) if 'poly' in w else affinity.scale(Point(w['x'],w['y']).buffer(1,quad_segs=60),w['rx'],w['ry']) for w in W['water']])
land=poly(W['coast']);sand=land.difference(wet)
grass=land.buffer(-155,quad_segs=12).difference(wet.buffer(24,quad_segs=12))
# Main=128, every lane=104. Same buffer and fork fillet as Home paths.py.
roads=[LineString(sample(r['points'])).buffer(r['width']/2,quad_segs=10) for r in R]
# Retain destination courts, round any old square tips before they join the union.
courts=[poly(p).buffer(-16,quad_segs=12).buffer(16,quad_segs=12) for p in data['hamlets']]
roads+=courts
barn=poly([[4180,1454],[4260,1220],[4560,1150],[4880,1210],[5180,1420],[5360,1720],[5050,1790],[4700,1580],[4420,1399]]).buffer(-65,quad_segs=12).buffer(65,quad_segs=12)
beach=poly([[5520,3160],[5800,2990],[6190,2980],[6660,3220],[6670,3590],[6360,3770],[5870,3760],[5580,3550]]).buffer(-80,quad_segs=12).buffer(80,quad_segs=12)
roads += [barn,beach]
# Widen only the bridge throats, meeting the exact Home deck endpoints.
bridge_clear=[]
for b in W['arches']:
 axis=LineString([b['a'],b['b']]);vx=b['b'][0]-b['a'][0];vy=b['b'][1]-b['a'][1];length=math.hypot(vx,vy)
 for p,sgn in [(b['a'],-1),(b['b'],1)]:
  q=[p[0]+sgn*vx/length*110,p[1]+sgn*vy/length*110]
  roads.append(LineString([p,q]).buffer(68,quad_segs=10))
 bridge_clear.append(axis.buffer(85,quad_segs=10))
merged=unary_union(roads).buffer(85,quad_segs=12).buffer(-85,quad_segs=12)
surface=merged.difference(wet).intersection(land)
# Home polish-ground.py uses preserve-topology simplification at .5 world units.
surface=surface.simplify(.5,preserve_topology=True)
# Keep the approved bloom paving as a destination. No second lane palette.
ET.register_namespace('','http://www.w3.org/2000/svg')
root=ET.parse('scripts/sunbob-ground/plaza-source.svg').getroot();serial=lambda e:ET.tostring(e,encoding='unicode')
# Old pale lawn smudges read as ghost paths. Home keeps cream at destinations.
for parent in root[46].iter():
 for child in list(parent):
  if child.get('fill','').lower()=='#fff0c7':parent.remove(child)
centre=json.loads((A/'bloom/centre-placements.json').read_text())
# Field edges share the road clearance, so both art and physics use the same cut.
fieldBase=json.loads(Path('scripts/sunbob-ground/field-baseline.json').read_text())
fieldShapes=[];fieldObs=[]
for f in fieldBase:
 g=poly(f['poly']).difference(merged.buffer(32,quad_segs=10)).difference(residentClear)
 for i,p in enumerate([g] if g.geom_type=='Polygon' else g.geoms):
  if p.area<80:continue
  fieldShapes.append(p)
  pieces=[p] if not p.interiors else [t.intersection(p) for t in triangulate(p)]
  for j,t in enumerate(pieces):
   if t.geom_type=='Polygon' and t.area>1:fieldObs.append(dict(name=f['name']+'-trim-'+str(i)+'-'+str(j),poly=list(t.exterior.coords)))
fields=unary_union(fieldShapes)
# Preserve every fence position. Only a bridge landing cuts a gap through it.
fenceMask=unary_union(bridge_clear)
(A/'path-trim').mkdir(exist_ok=True)
trimmed=[];fence=[];fieldVisual=[]
for p in art['props']:
 src=p.get('pathOriginalSrc',p['src'])
 if not re.search(r'detail/field-(row-short|flower)\.svg$',src):continue
 p['src']=src;p.pop('pathOriginalSrc',None)
 s=p.get('scale',1);anchor=p.get('anchor',{'x':.5,'y':1})
 x=p['x']-p['width']*s*anchor['x'];y=p['y']-p['height']*s*anchor['y'];w=p['width']*s;h=p['height']*s
 bounds=box(x,y,x+w,y+h)
 isFence=p['id'].startswith('ring-fence-')
 cut=fenceMask if isFence else merged.buffer(14,quad_segs=10)
 # The bloom's former ellipse is no longer a path surface; preserve its petal floor.
 visible=bounds.difference(cut)
 if not isFence:fieldVisual.append(visible)
 else:fence.append(dict(id=p['id'],x=p['x'],y=p['y'],width=p['width'],height=p['height'],scale=s))
 if bounds.intersection(cut).area<.1:continue
 source=(A/src).read_text();vb=list(map(float,re.search(r'viewBox="([^"]+)"',source)[1].split()))
 local=affinity.translate(affinity.scale(affinity.translate(visible,-x,-y),vb[2]/w,vb[3]/h,origin=(0,0)),vb[0],vb[1])
 inner=source[source.index('>')+1:source.rindex('</svg>')]
 target='path-trim/'+p['id']+'.svg'
 (A/target).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{vb[2]}" height="{vb[3]}" viewBox="{vb[0]} {vb[1]} {vb[2]} {vb[3]}"><defs><clipPath id="lane-clear"><path d="{path(local)}" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#lane-clear)">{inner}</g></svg>')
 p['src']=target;p['pathOriginalSrc']=src;trimmed.append(p['id'])
# No lamp/planter/tree/scarecrow standing in a field, or any solid blocking a lane.
# Retain the scene's existing objects, moving only offending feet to nearby margins.
allCrops=unary_union(fieldVisual).union(fields)
relocated=[]
routeLines=unary_union([LineString(sample(q["points"])) for q in R])
marginSand=sand.buffer(-45)
petal=[]
for b,c,d,e in [([475,-129],[636,-254],[880,-255],[1118,0]),([1118,0],[891,249],[657,260],[475,129]),([475,129],[504.333,43],[504.333,-43],[475,-129])]:
 for j in range(40):
  t=j/40;u=1-t;petal.append([u**3*b[k]+3*u*u*t*c[k]+3*u*t*t*d[k]+t**3*e[k] for k in (0,1)])
paved=[affinity.scale(Point(3880,2608.5).buffer(1,quad_segs=60),480,480*666/1140)]
for angle in range(-90,270,36):paved.append(affinity.translate(affinity.scale(affinity.rotate(poly(petal),angle,origin=(0,0)),1,666/1140,origin=(0,0)),3880,2608.5))
plazaClear=unary_union(paved).buffer(30)
residentProps=residentClear.buffer(35)
doorClear=unary_union([Point(p["x"],p["y"]+34).buffer(125) for p in art["props"] if p.get("communityRole")=="home"])
crop25=allCrops.buffer(25);crop65=allCrops.buffer(65)
corridorCache={}
def owned(o,p):return o.get('name')==p.get('id') or (abs(o.get('x',1e9)-p['x'])<.2 and 0<=p['y']-o.get('y',-1e9)<65)
obstacles=[o for o in W['obstacles'] if not o.get('name','').startswith('centre-field-')]
for p in art['props']:
 if 'field-' in p.get('pathOriginalSrc',p['src']) or p['id'].startswith('ring-fence-'):continue
 if re.search('bloom-(bench)',p['id']):continue # destination seats
 matches=[o for o in obstacles if owned(o,p)]
 isTall=bool(re.search(r'tree|scarecrow|lamp|lantern|planter',p['src']))
 pt=Point(p['x'],p['y']);r=max([o.get('rx',0) for o in matches]+[12])
 key=math.ceil(min(r,100)/10)*10
 if key not in corridorCache:corridorCache[key]=routeLines.buffer(64+key+20,quad_segs=10)
 corridor=corridorCache[key]
 cropHit=isTall and crop25.contains(pt)
 laneHit=bool(matches) and corridor.contains(pt) and not (p.get('communityRole')=='home')
 if not cropHit and not laneHit:continue
 # Local, deterministic nearest margin search, never a scatter/fill operation.
 origin=[p['x'],p['y']];found=None
 pavingMargin=plazaClear.buffer(min(r,110)+25)
 for dist in range(80,2401,40):
  candidates=[]
  for j in range(48):
   q=Point(origin[0]+math.cos(j*math.pi/24)*dist,origin[1]+math.sin(j*math.pi/24)*dist)
   if not marginSand.contains(q) or (crop65 if isTall else crop25).contains(q) or corridor.contains(q) or pavingMargin.contains(q) or doorClear.contains(q) or residentProps.contains(q):continue
   if any((q.x-o.get('x',1e9))**2/max(1,o.get('rx',30)+r+20)**2+(q.y-o.get('y',1e9))**2/max(1,o.get('ry',20)+30)**2<1 for o in obstacles if o not in matches and 'poly' not in o):continue
   candidates.append(q)
  if candidates:found=min(candidates,key=lambda q:q.distance(pt));break
 if found is None:raise ValueError('No field/path margin for '+p['id'])
 dx=round(found.x-p['x'],2);dy=round(found.y-p['y'],2)
 p['x']+=dx;p['y']+=dy
 for o in matches:o['x']+=dx;o['y']+=dy
 relocated.append(dict(id=p['id'],fromPoint=origin,to=[p['x'],p['y']]))
# Ground: only lawns, the new Home surface, water and retained destination details.
defs=f'<defs><clipPath id="sun-dry"><path d="{path(sand)}" fill-rule="evenodd"/></clipPath><clipPath id="sun-grass"><path d="{path(grass)}" fill-rule="evenodd"/></clipPath></defs>'
g=defs+''.join(serial(e) for e in root if e.tag.split('}')[-1]=='defs')
g+=f'<g fill-rule="evenodd"><path d="{path(sand)}" fill="#fde48c"/><path d="{path(grass)}" fill="#93b72f"/></g>'
tones=[(1300,200,1500,680,'#a5bf3e'),(4000,-180,1600,570,'#a6bd37'),(7200,450,1400,750,'#9fb935'),(8450,2600,660,1350,'#a7c344'),(7900,4350,1000,720,'#a3bc38'),(4800,5660,1800,700,'#a7bf41'),(1500,5300,1600,740,'#9dbb38'),(-400,2800,800,1600,'#a4c045')]
g+='<g clip-path="url(#sun-grass)">'+''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}"/>' for x,y,rx,ry,c in tones)+''.join(serial(root[i]) for i in [46,50,52,54,56])+'</g>'
# Exact Home exterior-only lower contact edge. No internal edges or worn lane stripe.
svg=f'<g data-name="Sunbob unified paths" fill-rule="evenodd"><path d="{path(surface)}" fill="#e4c567" transform="translate(0 3)"/><path d="{path(surface)}" fill="#fde48c"/></g>'
g+=f'<g clip-path="url(#sun-dry)">{svg}</g>'
g+=f'<path d="{path(wet.intersection(land))}" fill="{art["sea"]}" fill-rule="evenodd"/>'
g+=''.join(serial(root[i]) for i in [62,64,65,66,67,68,69])
g+=''.join(serial(root[i]) for i in range(80,len(root)))
# Only bloom paving remains: no old ellipse, ghost strips or separate join painter.
for tile in centre['groundTiles']:
 if tile['src']!='plaza-bloom-ground.svg':continue
 e=ET.parse(A/'bloom'/tile['src']).getroot()
 for group in e.iter():
  for child in list(group):
   if child.tag.endswith('ellipse') and child.get('fill')=='#a6ba62' or child.tag.endswith('path') and child.get('stroke')=='#f5dfa1':group.remove(child)
 e.set('x',str(tile['x']));e.set('y',str(tile['y']));e.set('width',str(tile['width']));e.set('height',str(tile['height']));g+=serial(e)
def svgdoc(v,w,h):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{v}">{g}</svg>'
sizes=json.loads(Path('src/pixi/art-source-sizes.json').read_text())
for t in art['ground']['tiles']:
 t['bleed']=4;w=t['width']+4;h=t['height']+4
 sw=w/2 if '/ground-' in t['src'] else w;sh=h/2 if '/ground-' in t['src'] else h
 (A/t['src']).write_text(svgdoc(f'{t["x"]} {t["y"]} {w} {h}',sw,sh));sizes['/pixi-art/themes/sunflower/'+t['src']]=[sw,sh]
fallback=svgdoc('-2000 -1400 12000 8400',1024,768)
Path('public/pixi-art/globe/sunflower-ground.svg').write_text(fallback)
manifestPath=Path('public/pixi-art/globe/manifest.json');manifest=json.loads(manifestPath.read_text());manifest['sunflower']['groundBytes']=len(fallback.encode());manifestPath.write_text(json.dumps(manifest,separators=(',',':'))+'\n')
for p in art['props']:
 if p['src'].startswith('path-trim/'):
  m=ET.parse(A/p['src']).getroot();sizes['/pixi-art/themes/sunflower/'+p['src']]=[float(m.get('width')),float(m.get('height'))]
art['flats']=[p for p in art['flats'] if not (merged.contains(Point(p['x'],p['y'])) and re.search(r'grass|pebble',p['src']))]
(A/'art.json').write_text(json.dumps(art,indent=1)+'\n')
for name in ['world.json','walk-world.json']:
 w=json.loads((D/name).read_text());w['paths']=[r['points'] for r in R];w['pathWidths']=[r['width'] for r in R]
 old=w['obstacles'];w['obstacles']=[o for o in old if not o.get('name','').startswith('centre-field-')]
 for move in relocated:
  for o in w['obstacles']:
   if owned(o,dict(id=move['id'],x=move['fromPoint'][0],y=move['fromPoint'][1])):
    o['x']+=move['to'][0]-move['fromPoint'][0];o['y']+=move['to'][1]-move['fromPoint'][1]
 w['obstacles']+=fieldObs
 if name=='world.json':w['props']=art['props']
 (D/name).write_text(json.dumps(w,indent=1)+'\n')
Path('src/pixi/art-source-sizes.json').write_text(json.dumps(sizes,separators=(',',':'))+'\n')
Path('scripts/sunbob-ground/path-surface.svgfrag').write_text(svg)
Path('scripts/sunbob-ground/path-surface.json').write_text(json.dumps(mapping(surface)))
Path('scripts/sunbob-ground/sampled-routes.json').write_text(json.dumps([dict(r,samples=sample(r['points'])) for r in R]))
reportFile=Path('scripts/sunbob-ground/path-report.json')
previous=json.loads(reportFile.read_text()).get('relocated',[]) if reportFile.exists() else []
combined={m['id']:m for m in previous}
for m in relocated:
 if m['id'] in combined:m['fromPoint']=combined[m['id']]['fromPoint']
 combined[m['id']]=m
relocated=list(combined.values())
Path('scripts/sunbob-ground/path-report.json').write_text(json.dumps(dict(homeSource='5acb0b5d:scripts/home-review/paths.py',homeSha256=hashlib.sha256(home.encode()).hexdigest(),routes=len(R),trimmedFlowers=trimmed,relocated=relocated,fence=fence),indent=2)+'\n')
print('Home geometry:',len(R),'routes;',len(trimmed),'edge clips;',len(relocated),'props moved to margins')
