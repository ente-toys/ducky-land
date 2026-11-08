"""Rebuild authored canals and two brooks. Requires shapely (generation only)."""
import json, subprocess
from pathlib import Path
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
B=Path('scripts/bigger-sunflower/baseline')
old=json.loads((B/'world.json').read_text()); walk=json.loads((B/'walk-world.json').read_text())
design=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {coast,lanes} from './scripts/bigger-sunflower/design.mjs';console.log(JSON.stringify({coast,lanes}))"]))
# Protect both the painted shoreline and the original authoritative walking interior.
from shapely.affinity import scale
islets=[scale(Point(x,y).buffer(1,quad_segs=48),rx,ry) for x,y,rx,ry in old['islets']]
dry=unary_union([Polygon(old['coast']),Polygon(walk['coast']),*islets])
canal=Polygon(old['coast']).buffer(205,quad_segs=5).difference(dry.buffer(26,quad_segs=5))
# A broad bend beneath the long old southwest harbour deck.
canal=unary_union([canal,Point(1487,4615).buffer(145,quad_segs=24)]).difference(dry.buffer(26))
# Fixed drawn courses, not generated scenery. Pond/stream -> sea; canal -> sea.
# boss 8 Nov (boats in the centre): both brooks are 180 wide, Willowcup Run now leaves the ring canal (1090,1470) instead of
# starting at the pool, as wide as the ring canal, so a boat sails them from the sea.
courses=[{'id':'millseed','name':'Millseed Brook','points':[[4210,1000],[4240,590],[4320,340],[4250,100],[4200,-160],[4300,-450],[4220,-800],[4160,-1160]],'width':180},
 {'id':'willowcup','name':'Willowcup Run','points':[[1090,1470],[700,1450],[300,1510],[0,1500],[-350,1300],[-700,1280],[-1100,1400],[-1500,1500],[-1850,1550]],'width':180}]
# Densified Catmull-Rom matches the road material's authored centreline.
def sampled(p):
 out=[]
 for i in range(len(p)-1):
  a=p[max(0,i-1)];b=p[i];c=p[i+1];d=p[min(len(p)-1,i+2)]
  n=max(8,int(Point(b).distance(Point(c))/26))
  for j in range(n):
   t=j/n;out.append([.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in [0,1]])
 return out+[p[-1]]
streams=[LineString(sampled(c['points'])).buffer(c['width']/2,quad_segs=8) for c in courses]
streams.append(scale(Point(300,1510).buffer(1,quad_segs=32),195,125))
wet=unary_union([canal,*streams]).difference(dry.buffer(26)).intersection(Polygon(design['coast']).buffer(80))
def polygons(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for x in g.geoms for p in polygons(x)]
def ring(p):return [[round(x,2),round(y,2)] for x,y in p.coords[:-1]]
water=[]
# Cut the ring into bounded polygons, so runtime water does not need hole support.
for x in range(-2000,10000,600):
 for y in range(-1400,7000,600):
  for p in polygons(wet.intersection(box(x,y,x+600,y+600))):
   if p.area>1:
    assert not p.interiors
    q=p.representative_point();r=q.distance(p.boundary)
    water.append({'name':'Sunbob canals and brooks','x':round(q.x,2),'y':round(q.y,2),'rx':round(max(5,min(75,r*.7)),2),'ry':round(max(4,min(45,r*.7)),2),'poly':ring(p.exterior)})
# Each road-water intersection gets a deck. Existing original decks remain untouched.
bridges=[]
for i,p in enumerate(design['lanes']):
 road=LineString(sampled(p))
 hit=road.intersection(wet)
 lines=[]
 def getlines(g):
  if g.is_empty:return
  if g.geom_type=='LineString':lines.append(g)
  elif hasattr(g,'geoms'):
   for x in g.geoms:getlines(x)
 getlines(hit)
 for seg in lines:
  if seg.length<24:continue
  mid=road.project(seg.interpolate(.5,normalized=True)); lo=max(0,road.project(Point(seg.coords[0]))-50);hi=min(road.length,road.project(Point(seg.coords[-1]))+50)
  if lo>hi:lo,hi=hi,lo
  a=list(road.interpolate(lo).coords[0]);b=list(road.interpolate(hi).coords[0]);m=seg.interpolate(.5,normalized=True)
  if any(Point(z['mid']).distance(m)<220 for z in bridges):continue
  width=250 if i==0 else 200 if i<8 else 170
  bridges.append({'id':f'river-crossing-{len(bridges)+1}','road':i,'a':a,'b':b,'w':width,'mid':list(m.coords[0])})
# boss 8 Nov: the crossings are fixed now (boats-data.mjs draws an arched bridge at each); the hamlets' rerouted loop road runs
# close along the north canal bank, which would otherwise read as a new crossing. Keep the committed list.
_prev=Path('scripts/bigger-sunflower/water-geometry.json')
if _prev.exists(): bridges=json.loads(_prev.read_text())['bridges']
# Old original jetties are now canal crossings. Bypass water only in their decks.
oldCrossings=[dict(id=f'original-{i+1}',**b) for i,b in enumerate(old['walkways'])]
coverage=[]
for d in oldCrossings:
 mid=LineString([d['a'],d['b']]).interpolate(.5,normalized=True)
 coverage.append({'id':d['id'],'mid':list(mid.coords[0]),'water':wet.covers(mid)})
# boss 8 Nov (boats in the centre): the same water for boats, in boxes that overlap by 8, so a boat never meets a seam between two
# boxes (water above is cut edge to edge, and a point on a shared edge can fall outside both)
boatWater=[]
for x in range(-2000,10000,600):
 for y in range(-1400,7000,600):
  for p in polygons(wet.intersection(box(x-8,y-8,x+608,y+608))):
   if p.area>1:boatWater.append(ring(p.exterior))
def path(p):
 s='M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in p.exterior.coords)+'Z'
 for h in p.interiors:s+='M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in h.coords)+'Z'
 return s
out={'water':water,'boatWater':boatWater,'path':' '.join(path(p) for p in polygons(wet)),'originalClipPath':' '.join(path(p) for p in polygons(dry.buffer(32))),'bridges':bridges,'originalCrossings':oldCrossings,'courses':courses,'coverage':coverage}
Path('scripts/bigger-sunflower/water-geometry.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print(json.dumps({'waterPolygons':len(water),'crossings':bridges,'oldDeckWater':coverage},indent=2))
