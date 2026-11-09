"""Optional regeneration, using shapely. Node build consumes the checked-in JSON."""
import json
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import scale
from shapely.ops import unary_union, split
P=Path('scripts/bigger-cathedral')
w=json.loads((P/'water-source/world.json').read_text())
data=json.loads((P/'water-input.json').read_text())
def smooth(p,n=12):
 out=[]
 for i in range(len(p)-1):
  a,b,c,d=[p[max(0,min(len(p)-1,j))] for j in [i-1,i,i+1,i+2]]
  for j in range(n):
   t=j/n;out.append([.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in [0,1]])
 return out+[p[-1]]
old=[Polygon(x['poly']) for x in w['water'] if 'poly' in x]
wet=unary_union(old+[LineString(smooth(c['points'])).buffer(c['width']/2,quad_segs=16) for c in data['channels']])
# Connect the pond to the ring at its west edge, reusing its existing water colour.
pond=scale(Point(1770,3310).buffer(1,quad_segs=64),430,310)
wet=unary_union([wet,pond,LineString(smooth([[1510,3160],[1360,2960],[1060,2800]])).buffer(115,quad_segs=16)])
# A hole-free partition for the engine. Overlap cuts by 0.05 to avoid dry seams.
parts=[]
for p in (list(wet.geoms) if hasattr(wet,'geoms') else [wet]):
 for piece in split(p,LineString([[-4000,2800],[12000,2800]])).geoms:
  parts.append(piece.buffer(.05))
def coords(p):return [[round(x,3),round(y,3)] for x,y in p.exterior.coords]
bridges=[]
oldgeo=json.loads((P/'fix-water.json').read_text())
for b in data['retained']+[{'id':c['id'],'a':c['points'][0],'b':c['points'][-1],'w':128} for c in oldgeo['crossings'] if c['id'] not in data['redundant']]:
 if b['id'] in data.get('crossingOffsets',{}):
  offset=data['crossingOffsets'][b['id']];b['a']=[v+offset[k] for k,v in enumerate(b['a'])];b['b']=[v+offset[k] for k,v in enumerate(b['b'])]
 # Trim the approved art to the wet span, plus a 22-unit landing at each bank.
 dx=b['b'][0]-b['a'][0];dy=b['b'][1]-b['a'][1];length=(dx*dx+dy*dy)**.5
 line=LineString([[b['a'][0]-dx/length*850,b['a'][1]-dy/length*850],[b['b'][0]+dx/length*850,b['b'][1]+dy/length*850]])
 hit=line.intersection(wet)
 if hit.is_empty:continue
 mid=Point([(b['a'][k]+b['b'][k])/2 for k in [0,1]])
 segments=[g for g in (list(hit.geoms) if hasattr(hit,'geoms') else [hit]) if g.geom_type=='LineString']
 if not segments:continue
 hit=min(segments,key=lambda g:g.distance(mid))
 pts=[]
 for g in [hit]:
  if g.geom_type=='LineString':pts.extend(g.coords)
 if not pts:continue
 ts=[line.project(Point(p)) for p in pts];a=max(0,min(ts)-25);z=min(line.length,max(ts)+25)
 b.update(a=list(line.interpolate(a).coords[0]),b=list(line.interpolate(z).coords[0]));bridges.append(b)
# Fixed ring survey points, inset 145 units out from the original island bank.
base=json.loads((P/'baseline/world.json').read_text())
ring=Polygon(base['coast']).buffer(145,quad_segs=12).exterior
ringpts=[list(ring.interpolate(i*ring.length/64).coords[0]) for i in range(65)]
collision=[]
for x in range(-2560,11000,512):
 for y in range(-2560,8500,512):
  clipped=wet.intersection(box(x,y,x+512,y+512))
  for p in (list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]):
   if p.geom_type=='Polygon' and p.area>1:collision.append(coords(p))
result={'collisionPolys':collision,'polys':[coords(p) for p in parts],'bridges':bridges,'ring':ringpts,'channels':[smooth(c['points']) for c in data['channels']]}
(P/'water-geometry.json').write_text(json.dumps(result,indent=1)+'\n')
print('Network components',len(list(wet.geoms)) if hasattr(wet,'geoms') else 1,'bridges',len(bridges))
