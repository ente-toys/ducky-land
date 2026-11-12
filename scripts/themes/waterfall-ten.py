"""Waterfall-only craft pass over the integrated island. Never run the older polish
builder afterwards: its input predates the locked centre integration.
Run with /tmp/waterfall-polish-venv/bin/python, then waterfall-benches.mjs.
"""
import json, math, random, re, copy
from pathlib import Path
from shapely.geometry import Point, Polygon, LineString, box
from shapely.ops import unary_union
from shapely import affinity

R=Path(__file__).resolve().parents[2]; A=R/'public/pixi-art/themes/waterfall'; D=R/'assets/world/themes/waterfall'
snapshot=R/'scripts/themes/waterfall-ten-source.json'
if not snapshot.exists():
 snapshot.write_text(json.dumps({'art':json.loads((A/'art.json').read_text()),'world':json.loads((D/'world.json').read_text()),'walk':json.loads((D/'walk-world.json').read_text()),'centre':json.loads((A/'centre/centre.json').read_text()),'ground':(A/'ground.svg').read_text()}))
source=json.loads(snapshot.read_text())
if 'centreSvg' not in source:
 source['centreSvg']={p.name:p.read_text() for p in (A/'centre').glob('*.svg') if not p.name.startswith('bench-')}
 snapshot.write_text(json.dumps(source))
# The centre is installed at .48 scale. Restore procedural edge weight at that
# size; leave traced silhouettes and the separately drawn world-size benches alone.
for name,text in source['centreSvg'].items():
 def ink(m):
  v=float(m[1]);return f'stroke-width="{v*1.6 if v<=3 else v:g}"'
 (A/'centre'/name).write_text(re.sub(r'stroke-width="([0-9.]+)"',ink,text))
a=source['art'];w=source['world'];walk=source['walk'];s=source['ground'];rng=random.Random(5269)
land=Polygon(w['coast']);paths=unary_union([LineString(p).buffer(153) for p in w['paths']]);wet=unary_union([Polygon(z['poly']) for z in w['water'] if 'poly' in z]);decks=unary_union([LineString([q['a'],q['b']]).buffer(q['w']/2+30) for q in w['walkways']])
def ellipse(x,y,rx,ry):return affinity.scale(Point(x,y).buffer(rx,resolution=32),1,ry/rx,origin=(x,y))
reserved=unary_union([ellipse(z['x'],z['y'],z['rx']+15,z['ry']+15) for z in w['zones'].values()])
beds=json.loads((A/'waterfall-sleepers.json').read_text())
def sleep_clear(x,y,ww,hh):
 return not any(math.hypot(x-b['x'],(y-b['y'])*1.6)<ww*.4+b['r']+18 or (y>b['y']-20 and y-b['y']<hh*.9 and abs(x-b['x'])<ww*.5+b['r']*.6) for b in beds)
def path(g,fill,stroke='none',width=2.2):
 if g.is_empty:return ''
 if g.geom_type=='MultiPolygon':return ''.join(path(q,fill,stroke,width) for q in g.geoms)
 if g.geom_type!='Polygon':return ''
 d='M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in g.exterior.coords)+'Z'
 for h in g.interiors:d+=' M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in h.coords)+'Z'
 return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round" fill-rule="evenodd"/>'
def curve(d,col,width):return f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
def organic(x,y,rx,ry,seed):
 return Polygon([(x+rx*(1+.022*math.sin(t*5+seed)+.035*math.sin(t*3+seed))*math.cos(t),y+ry*(1+.035*math.sin(t*4+seed))*math.sin(t)) for t in [i*math.tau/180 for i in range(180)]])

# Replace the anonymous sand ovals and ruled grid with open meadow markets.
# Slots remain unobstructed; a curved 90-unit promenade runs south of the slots.
s=re.sub(r'<path\b[^>]*fill="#(?:EBD497|F8E5AC)"[^>]*/>','',s)
# Remove the hard oval rims of the three activity greens. Lawn shape is visual only.
s=re.sub(r'<path\b[^>]*fill="#98BE39"[^>]*/>','',s)
decor=[]
for i,(key,z) in enumerate(w['zones'].items()):
 if not key.startswith(('stalls','activity')):continue
 x,y,rx,ry=(z[k] for k in ['x','y','rx','ry'])
 g=organic(x,y,rx,ry,i).intersection(land.buffer(-105))
 decor.append(path(g,'#96BA35'))
 if key.startswith('stalls'):
  # No enclosing pale slab. Individual flagstones sit in a curved grass lane.
  d=f'M{x-rx+65} {y+95} C{x-290} {y+126} {x+220} {y+65} {x+rx-65} {y+100}'
  decor.extend([curve(d,'#7B9037',96),curve(d,'#F8E1A0',90)])
  for j in range(13):
   xx=x-rx+100+j*(2*rx-200)/12; yy=y+96+9*math.sin(j*.55)
   stone=organic(xx,yy,34,22,j).buffer(-2).buffer(2)
   decor.append(path(stone,'#FFECC0','#C9B179',1.8))
  # Two discontinuous low stone kerbs frame the empty seller pitches.
  for side in [-1,1]:
   for j in range(8):
    xx=x+side*(95+j*58);yy=y-ry+22+17*math.cos(j*.35)
    decor.append(path(organic(xx,yy,24,13,j),'#D7DBAD','#7C9053',2))
 else:
  # A mown edge is broken at the east and west entrances, open lawn in the middle.
  for start,end in [(25,150),(207,326)]:
   points=[(x+(rx-18)*math.cos(t),y+(ry-18)*math.sin(t)) for t in [math.radians(start+(end-start)*j/70) for j in range(71)]]
   d='M'+' L'.join(f'{xx:.1f} {yy:.1f}' for xx,yy in points)
   # South lawn is clipped by the real coast, not painted over the beach.
   if key!='activity-3':decor.extend([curve(d,'#799D32',9),curve(d,'#B2CC53',3)])
 # Sparse tiny tufts keep the protected space legible as usable lawn.
 for j in range(75 if key.startswith('activity') else 42):
  xx=rng.uniform(x-rx,x+rx);yy=rng.uniform(y-ry,y+ry)
  if not g.buffer(-22).contains(Point(xx,yy)):continue
  if key.startswith('stalls') and yy>y+48:continue
  decor.append(f'<use href="#grass-tuft-{j%3+1}" x="{xx:.1f}" y="{yy:.1f}" width="27" height="18"/>')
# Insert before water and existing ground tufts, preserving paths and shore finishes.
idx=s.find('<use href=');s=s[:idx]+''.join(decor)+s[idx:]
s=s.replace('stroke="#A28A45" stroke-width="308"','stroke="#897F46" stroke-width="305"')

# Natural canopy spacing, while preserving the five exact sleeper anchor trees.
trees=[p for p in a['props'] if 'tree' in p.get('name','').lower() and not p['src'].startswith('centre/')]
fixed={b[0] for b in w['sleepSpots']['nod']};oldtrees=copy.deepcopy(trees)
def crown(p,x=None,y=None):
 x=p['x'] if x is None else x;y=p['y'] if y is None else y
 return ellipse(x,y-p['height']*.61,p['width']*.43,p['height']*.31)
accepted=[p for p in trees if p['id'] in fixed];moved=[];thinned=[]
for p in sorted([p for p in trees if p['id'] not in fixed],key=lambda p:-p['width']):
 ox,oy=p['x'],p['y'];ww,hh=p['width'],p['height']
 def valid(x,y):
  pt=Point(x,y);cr=crown(p,x,y)
  if not land.buffer(-115).contains(pt) or paths.buffer(ww*.2).contains(pt) or reserved.contains(pt) or wet.buffer(45).contains(pt) or decks.contains(pt):return False
  if cr.intersects(reserved) or cr.intersects(paths) or cr.intersects(wet) or not land.buffer(-25).contains(cr):return False
  if cr.intersects(box(3020,1060,4780,2230)) or cr.intersects(box(3230,3030,4570,3380)):return False
  if any(cr.buffer(8).intersects(crown(q)) for q in accepted):return False
  if not sleep_clear(x,y,ww,hh):return False
  return True
 candidates=[(ox,oy)]+[(ox+rad*math.cos(t),oy+rad*.72*math.sin(t)) for rad in [80,160,240,340,450,580,730,900,1150] for t in [j*math.tau/40 for j in range(40)]]
 spot=next(((x,y) for x,y in candidates if valid(x,y)),None)
 if spot is None:
  # Thin congested crowns first, retaining 60 landscape trees plus centre trees.
  # Never remove a trunk that carries a sleeping Ducky.
  if len(thinned)<9:
   thinned.append(p['id']);a['props'].remove(p)
   w['obstacles']=[o for o in w['obstacles'] if 'poly' in o or not(abs(o.get('x',-999)-ox)<.1 and abs(o.get('y',-999)-oy)<45)]
   continue
  accepted.append(p);continue
 if math.hypot(spot[0]-ox,spot[1]-oy)>1:
  p['x'],p['y']=map(lambda v:round(v,2),spot);moved.append({'id':p['id'],'from':[ox,oy],'to':spot})
  for o in w['obstacles']:
   if 'poly' not in o and abs(o.get('x',-999)-ox)<.1 and abs(o.get('y',-999)-(oy-10))<1:
    o['x']=p['x'];o['y']=p['y']-10
 accepted.append(p)

# Clear inherited fern/rock/lamp bases from the 300-unit trails too.
moved_small=[]
for p in a['props']:
 if p['src'].startswith('centre/') or p in trees or not paths.contains(Point(p['x'],p['y'])):continue
 ox,oy=p['x'],p['y'];ww,hh=p['width'],p['height']
 def safe(x,y):
  q=Point(x,y)
  return land.buffer(-65).contains(q) and not paths.buffer(min(ww*.3,75)).contains(q) and not wet.buffer(40).contains(q) and not reserved.contains(q) and not decks.contains(q) and sleep_clear(x,y,ww,hh)
 spot=next(((ox+rad*math.cos(t),oy+rad*math.sin(t)) for rad in range(60,601,40) for t in [j*math.tau/48 for j in range(48)] if safe(ox+rad*math.cos(t),oy+rad*math.sin(t))),None)
 if spot:
  p['x'],p['y']=map(lambda v:round(v,2),spot)
  for o in w['obstacles']:
   if 'poly' not in o and abs(o.get('x',-999)-ox)<.1 and abs(o.get('y',-999)-oy)<45:o['x']+=p['x']-ox;o['y']+=p['y']-oy
  moved_small.append({'id':p['id'],'from':[ox,oy],'to':spot})
# Every market gets restrained flowers and two lanterns outside the protected slots.
def prop(src,x,y,ww,name):
 text=(A/src).read_text();vb=list(map(float,re.search(r'viewBox="([^"]+)"',text)[1].split()));hh=ww*vb[3]/vb[2]
 if not land.buffer(-40).contains(Point(x,y)) or paths.contains(Point(x,y)) or wet.contains(Point(x,y)):return
 if not sleep_clear(x,y,ww,hh):return
 a['props'].append({'id':f'waterfall-ten-edge-{len(a["props"])}','name':name,'src':src,'x':x,'y':y,'width':ww,'height':hh,'anchor':{'x':.5,'y':1},'scale':1,'shadow':False})
for key,z in w['zones'].items():
 if not key.startswith('stalls'):continue
 for side in [-1,1]:
  for j in range(8):prop('reuse/flower-2.svg',z['x']+side*(110+j*59),z['y']-z['ry']-14+10*math.sin(j),56,'Market rim flowers')
  prop('reuse/street--lamp-lantern.svg',z['x']+side*(z['rx']-70),z['y']-z['ry']+3,53,'Market entry lantern')

for t in a['ground']['tiles']:
 (A/t['src']).write_text(re.sub(r'<svg[^>]+>',f'<svg xmlns="http://www.w3.org/2000/svg" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}">',s,count=1))
(A/'ground.svg').write_text(s)
w['props']=a['props'];walk['obstacles']=w['obstacles']
for f,v in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk),(A/'centre/centre.json',source['centre'])]:f.write_text(json.dumps(v,separators=(',',':')))
(A/'waterfall-ten-layout.json').write_text(json.dumps({'movedTrees':moved,'thinnedTrees':thinned,'movedPathProps':moved_small,'treeCount':len(trees)-len(thinned),'props':len(a['props'])},indent=2))
print('Moved',len(moved),'of',len(trees),'trees; props',len(a['props']))
