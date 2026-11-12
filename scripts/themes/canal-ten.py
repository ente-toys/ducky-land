"""Finish the integrated Canal map without resetting its locked centre or sleepers.
Run with /private/tmp/canal-vt/bin/python, then canal-ten-benches.mjs.
Only Canal assets/data are written. Home sources are read-only.
"""
from pathlib import Path
import json, math, random, re
import xml.etree.ElementTree as ET
from shapely.geometry import Point, Polygon, LineString, box
from shapely.affinity import scale, translate
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[2]; A=ROOT/'public/pixi-art/themes/canal'; D=ROOT/'assets/world/themes/canal'
read=lambda p:json.loads(p.read_text())
art=read(A/'art.json');world=read(D/'world.json');walk=read(D/'walk-world.json');rng=random.Random(5268)
def ellipse(x,y,rx,ry):return scale(Point(x,y).buffer(1,quad_segs=48),rx,ry)
land=unary_union([Polygon(world['coast'])]+[ellipse(*v) for v in world['islets']])
paths=unary_union([LineString(p).buffer(w/2+18) for p,w in zip(world['paths'],world['pathWidths'])])
decks=unary_union([LineString([p['a'],p['b']]).buffer(p['w']/2+50) for p in world['walkways']])
zones=[z for n,z in world['zones'].items() if n.startswith(('activity-','stalls-'))]
reserved=unary_union([box(z['x0'],z['y0'],z['x1'],z['y1']) if 'x0' in z else ellipse(z['x'],z['y'],z['rx'],z['ry']) for z in zones])
beds=read(A/'resolved-sleepers.json');sleep=unary_union([ellipse(b['x'],b['y'],b['r']+35,65) for b in beds])

# The paved reservations become useful lawn courts with stone edging and tufts.
# Keep their exact reserved dimensions, entrances and collision-free interiors.
NS='http://www.w3.org/2000/svg'; ET.register_namespace('',NS)
ground=ET.fromstring((A/'ground.svg').read_text())
if True:  # Rebuild this one tagged layer from the unchanged routes.
 # Buffer the smooth centre lines once, so junctions have one continuous edge.
 route=unary_union([LineString(p).buffer(width/2,quad_segs=24) for p,width in zip(world['paths'],world['pathWidths'])]).buffer(45,quad_segs=16).buffer(-45,quad_segs=16).intersection(land)
 def shape(q):
  polys=list(q.geoms) if hasattr(q,'geoms') else [q]
  def line(points):return 'M '+' L '.join(f'{x:.2f} {y:.2f}' for x,y in points)+' Z'
  return ' '.join(line(p.exterior.coords)+' '+' '.join(line(r.coords) for r in p.interiors if Polygon(r).area>16000) for p in polys)
 old=[e for e in ground if e.get('id')=='canal-joined-paths' or (e.get('clip-path')=='url(#land)' and e.get('fill')=='none' and float(e.get('stroke-width','0'))>=210)]
 at=list(ground).index(old[0]) if old else 2
 for e in old:ground.remove(e)
 e=ET.Element('{'+NS+'}path',{'d':shape(route),'fill':'#FFE399','stroke':'#AD963E','stroke-width':'2.5','fill-rule':'evenodd','stroke-linejoin':'round','id':'canal-joined-paths'})
 ground.insert(at,e);ground.set('data-canal-path-union','1')
if ground.get('data-canal-ten')!='1':
 children=list(ground)
 for i,e in enumerate(children):
  if e.tag.endswith('clipPath') and re.fullmatch(r'row[0-2]',e.get('id','')):
   fill,joints,rim=children[i+1:i+4]
   fill.set('fill','#95B936');fill.set('stroke','#718F32');fill.set('stroke-width','4')
   joints.set('stroke','none');rim.set('stroke','#E5CB8C');rim.set('stroke-width','13')
 ground.set('data-canal-ten','1')

# Ground-level ornamental ring separates a generous walk from the fountain.
# It is above the integrated paving decal, and below every standing object.
art['flats']=[p for p in art['flats'] if not p.get('id','').startswith('canal-ten-')]
ring=['<svg xmlns="http://www.w3.org/2000/svg" width="1860" height="1440" viewBox="-930 -720 1860 1440" stroke-linejoin="round">']
for rx,ry in [(480,368),(830,637)]:
 ring += [f'<ellipse rx="{rx}" ry="{ry}" fill="none" stroke="#BD9D7C" stroke-width="48"/>',f'<ellipse rx="{rx}" ry="{ry}" fill="none" stroke="#E8C382" stroke-width="43"/>',f'<ellipse rx="{rx-25}" ry="{ry-19}" fill="none" stroke="#FFF2CE" stroke-width="5"/>']
 for i in range(80 if rx>500 else 48):
  a=i*math.tau/(80 if rx>500 else 48)
  ring.append(f'<path d="M{(rx-20)*math.cos(a):.1f} {(ry-15)*math.sin(a):.1f} L{(rx+20)*math.cos(a):.1f} {(ry+15)*math.sin(a):.1f}" stroke="#AB916D" stroke-width="1.8"/>')
ring.append('</svg>');(A/'detail/fountain-rings.svg').write_text(''.join(ring))
art['flats'].append(dict(id='canal-ten-fountain-rings',src='detail/fountain-rings.svg',x=3070,y=2600,width=1860,height=1440,topLeft=True))

# Grass detail on the formerly empty market lawns. Floor decals never obstruct play.
for j,z in enumerate(zones):
 if 'x0' not in z:continue
 for i in range(80):
  x=rng.uniform(z['x0']+18,z['x1']-18);y=rng.uniform(z['y0']+18,z['y1']-18)
  if paths.contains(Point(x,y)):continue
  name=rng.choice(['grass-tuft-1','grass-tuft-2','flower-dot-1','flower-dot-2','pebble-1'])
  w,h={'grass-tuft-1':(44,26),'grass-tuft-2':(34,22),'flower-dot-1':(20,18),'flower-dot-2':(26,18),'pebble-1':(22,14)}[name]
  art['flats'].append(dict(id=f'canal-ten-lawn-{j}-{i}',src=f'reuse/{name}.svg',x=round(x,1),y=round(y,1),width=w*1.5,height=h*1.5))

# Move physical props out of full-width paths. Preserve the actual obstacle shape.
def footprint(p):
 w=p['width']*p['scale'];h=p['height']*p['scale']
 return box(p['x']-w*.42,p['y']-65,p['x']+w*.42,p['y']+12) if 'townhouse' in p['name'].lower() else ellipse(p['x'],p['y'],min(w*.4,90),max(20,min(h*.2,40)))
def obstacles_for(p):
 out=[]
 for o in world['obstacles']:
  if o.get('centre') or o.get('canalTen'):continue
  if 'poly' in o:
   q=Polygon(o['poly']);c=q.centroid
   if abs(c.x-p['x'])<2 and abs(c.y-(p['y']-42.5))<5:out.append(o)
  elif abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<25:out.append(o)
 return out
# Three duplicated houses stood directly in the route; their neighbours retain
# the terrace rhythm while these gaps become the walking entrances.
duplicates=[p for p in art['props'] if p['id'] in ['canal-1','canal-6','canal-polish-0138']]
for p in duplicates:
 for o in obstacles_for(p):world['obstacles'].remove(o)
 art['props'].remove(p)
changes=[]
for p in art['props']:
 if p['id'].startswith(('integrated','canal-ten')):continue
 f=footprint(p)
 if not paths.intersects(f):continue
 if 'tree' in p['name'].lower() or 'townhouse' in p['name'].lower():continue
 # Low flat shells/towels also stay away from the promenade.
 obs=obstacles_for(p);x0,y0=p['x'],p['y'];found=None
 for radius in range(60,1501,30):
  for i in range(40):
   angle=i*math.tau/40;dx,dy=math.cos(angle)*radius,math.sin(angle)*radius
   candidate=translate(f,dx,dy);x,y=x0+dx,y0+dy
   if any(math.hypot(b['x']-x,(b['y']-y)*1.6)<p['width']*p['scale']*.4+b['r']+20 or (y>b['y']-20 and y-b['y']<p['height']*p['scale']*.9 and abs(b['x']-x)<p['width']*p['scale']/2+b['r']*.6+10) for b in beds if b['pose']!='nod'):continue
   if not land.buffer(-70).contains(candidate) or any(g.intersects(candidate) for g in [paths,decks,reserved.buffer(30),sleep]):continue
   if any(q is not p and math.hypot(x-q['x'],(y-q['y'])*1.3)<(180 if 'townhouse' in p['name'].lower() else 100) for q in art['props']):continue
   found=(dx,dy);break
  if found:break
 if not found:continue
 dx,dy=found;p['x']=round(x0+dx,2);p['y']=round(y0+dy,2)
 for o in obs:
  if 'poly' in o:o['poly']=[[round(x+dx,2),round(y+dy,2)] for x,y in o['poly']]
  else:o['x']+=dx;o['y']+=dy
 changes.append(dict(id=p['id'],name=p['name'],old=[x0,y0],new=[p['x'],p['y']]))

# A finished planted edge, but clear slots and walk-in gaps for future activities.
art['props']=[p for p in art['props'] if not p['id'].startswith('canal-ten-edge-')]
world['obstacles']=[o for o in world['obstacles'] if not o.get('canalTenEdge')]
for j,z in enumerate(zones):
 if 'x0' in z:
  candidates=[(x,z['y0']-100) for x in range(int(z['x0'])+90,int(z['x1']),210)]+[(x,z['y1']+110) for x in range(int(z['x0'])+130,int(z['x1']),230)]
 else:candidates=[(z['x']+(z['rx']+95)*math.cos(i*math.tau/16),z['y']+(z['ry']+95)*math.sin(i*math.tau/16)) for i in range(16)]
 for i,(x,y) in enumerate(candidates):
  f=ellipse(x,y,60,35)
  if not land.buffer(-60).contains(f) or any(g.intersects(f) for g in [paths,decks,reserved,sleep]):continue
  if any(math.hypot(x-p['x'],(y-p['y'])*1.3)<110 for p in art['props']):continue
  src='reuse/street--planter-flowers.svg' if i%4==0 else f'reuse/flower-{i%3+1}.svg'
  doc=ET.fromstring((A/src).read_text());vb=list(map(float,doc.get('viewBox').split()));w,h=vb[2:];k=(85 if i%4==0 else 58)/h
  art['props'].append(dict(id=f'canal-ten-edge-{j}-{i}',name='Lawn edge flower planter',src=src,x=round(x,2),y=round(y,2),width=w,height=h,scale=k,anchor={'x':.5,'y':.98},flip=False))
  if i%4==0:world['obstacles'].append(dict(x=x,y=y-7,rx=36,ry=20,canalTenEdge=True))

body=ET.tostring(ground,encoding='unicode');(A/'ground.svg').write_text(body)
for t in art['ground']['tiles']:
 tile=re.sub(r'<svg\b[^>]*>',f'<svg xmlns="{NS}" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}" stroke-linecap="round" stroke-linejoin="round">',body,count=1)
 (A/t['src']).write_text(tile)
world['props']=art['props'];walk['obstacles']=world['obstacles']
for p,obj in [(A/'art.json',art),(D/'world.json',world),(D/'walk-world.json',walk)]:p.write_text(json.dumps(obj,separators=(',',':')))
metrics=read(A/'ten-metrics.json') if (A/'ten-metrics.json').exists() else {}
metrics['movedOffPaths']=metrics.get('movedOffPaths',[])+changes
metrics.update(lawnCourts=3,newLawnDecals=sum(p.get('id','').startswith('canal-ten-lawn') for p in art['flats']),edgePlanters=sum(p['id'].startswith('canal-ten-edge') for p in art['props']))
(A/'ten-metrics.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics,indent=2))
