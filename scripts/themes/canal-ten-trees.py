"""Give touching Canal crowns breathing room; preserve all sleeper trees."""
from pathlib import Path
import json,math
from shapely.geometry import Point,Polygon,LineString,box
from shapely.affinity import scale,translate
from shapely.ops import unary_union
R=Path(__file__).resolve().parents[2];A=R/'public/pixi-art/themes/canal';D=R/'assets/world/themes/canal'
read=lambda p:json.loads(p.read_text())
a=read(A/'art.json');w=read(D/'world.json');walk=read(D/'walk-world.json');beds=read(A/'resolved-sleepers.json')
def ell(x,y,rx,ry):return scale(Point(x,y).buffer(1,quad_segs=16),rx,ry)
land=Polygon(w['coast']).buffer(-85)
paths=unary_union([LineString(p).buffer(width/2+65) for p,width in zip(w['paths'],w['pathWidths'])])
decks=unary_union([LineString([d['a'],d['b']]).buffer(d['w']/2+100) for d in w['walkways']])
reserved=unary_union([box(z['x0'],z['y0'],z['x1'],z['y1']) if 'x0'in z else ell(z['x'],z['y'],z['rx'],z['ry']) for n,z in w['zones'].items() if n.startswith(('activity-','stalls-'))])
trees=[p for p in a['props'] if p['name']=='Canal tree'];protected={b.get('tree') for b in beds}
def crown(p):return ell(p['x'],p['y']-p['height']*p['scale']*.68,p['width']*p['scale']*.43,p['height']*p['scale']*.29)
def conflict(p,q):
 x,y=crown(p),crown(q);return x.intersection(y).area/min(x.area,y.area)>.035
moved=[]
for p in sorted(trees,key=lambda p:p['id'].startswith('canal-polish'),reverse=True):
 if p['id'] in protected or not any(q is not p and conflict(p,q) for q in trees):continue
 x0,y0=p['x'],p['y'];found=False
 for r in range(60,781,30):
  for i in range(32):
   t=i*math.tau/32;x=x0+r*math.cos(t);y=y0+r*math.sin(t);foot=ell(x,y,50,30)
   if not land.contains(foot) or any(g.intersects(foot) for g in [paths,decks,reserved.buffer(70)]):continue
   width=p['width']*p['scale'];height=p['height']*p['scale']
   if any(math.hypot(b['x']-x,(b['y']-y)*1.6)<width*.4+b['r']+20 or (y>b['y']-20 and y-b['y']<height*.9 and abs(b['x']-x)<width/2+b['r']*.6+10) for b in beds):continue
   if any(q is not p and 'tree' not in q['name'].lower() and math.hypot(x-q['x'],(y-q['y'])*1.4)<85 for q in a['props']):continue
   p['x'],p['y']=x,y
   if any(q is not p and conflict(p,q) for q in trees):p['x'],p['y']=x0,y0;continue
   if any('townhouse'in q['name'].lower() and crown(p).intersects(box(q['x']-q['width']*q['scale']*.4,q['y']-q['height']*q['scale'],q['x']+q['width']*q['scale']*.4,q['y'])) for q in a['props']):p['x'],p['y']=x0,y0;continue
   found=True;break
  if found:break
 if found:
  for o in w['obstacles']:
   if 'poly'not in o and abs(o['x']-x0)<1 and abs(o['y']-y0)<25:o['x']+=p['x']-x0;o['y']+=p['y']-y0
  moved.append(dict(id=p['id'],old=[x0,y0],new=[p['x'],p['y']]))
# Where the narrow canal bank offers no honest room, thin the duplicated crown.
# Never remove a sleeper's tree or reduce the island below 60 large trees.
thinned=[]
while len(trees)>60:
 choices=[(sum(conflict(p,q) for q in trees if q is not p),p) for p in trees if p['id'] not in protected]
 count,p=max(choices,key=lambda v:v[0])
 if not count:break
 trees.remove(p);a['props'].remove(p);thinned.append(p['id'])
 w['obstacles']=[o for o in w['obstacles'] if 'poly'in o or abs(o['x']-p['x'])>=1 or abs(o['y']-p['y'])>=25]
remaining=sum(conflict(p,q) for i,p in enumerate(trees) for q in trees[i+1:])
w['props']=a['props'];walk['obstacles']=w['obstacles']
for p,obj in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk)]:p.write_text(json.dumps(obj,separators=(',',':')))
m=read(A/'ten-metrics.json');m['treeMoves']=m.get('treeMoves',[])+moved;m['thinnedTrees']=m.get('thinnedTrees',[])+thinned;m['remainingCanopyPairs']=remaining;m['trees']=len(trees);(A/'ten-metrics.json').write_text(json.dumps(m,indent=2))
print(f'{len(moved)} tree crowns spaced; {remaining} remaining pairs above 3.5% overlap; {len(trees)} trees retained')
