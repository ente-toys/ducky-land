"""Author Bellovo's waterways. Optional regeneration: PYTHONPATH=<shapely> python3 this-file.
The checked-in fix-water.json is sufficient for the normal Node build.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString, box
from shapely.affinity import scale
from shapely.ops import unary_union, split

base=Path('scripts/bigger-cathedral')
w=json.loads((base/'baseline/world.json').read_text())
plan=json.loads((base/'plan.json').read_text())
land=Polygon(w['coast'])
islets=unary_union([scale(Point(x,y).buffer(1,quad_segs=40),rx,ry) for x,y,rx,ry in w['islets']])
protected=land.union(islets)
canal=land.buffer(300,quad_segs=12).difference(land)
basins=[(3000,750,260,340),(750,3330,300,230),(7250,3150,315,240),(4100,5300,265,300),(1425,1590,330,260),(6220,4615,330,300)]
canal=unary_union([canal]+[scale(Point(x,y).buffer(1,quad_segs=28),rx,ry) for x,y,rx,ry in basins])
streams=[{'id':'olive-brook','width':132,'points':[[1900,-350],[2010,0],[1880,250],[1710,500],[1800,780],[2000,1000]]},
 {'id':'tessera-brook','width':150,'points':[[7000,3600],[7200,3650],[7350,3950],[7150,4350],[6940,4700],[6800,5100],[6620,5500],[6510,6240]]}]
def smooth(p,n=12):
 out=[]
 for i in range(len(p)-1):
  a,b,c,d=[p[max(0,min(len(p)-1,j))] for j in [i-1,i,i+1,i+2]]
  for j in range(n):
   t=j/n
   out.append([.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in [0,1]])
 return out+[p[-1]]
wet=unary_union([canal]+[LineString(smooth(s['points'])).buffer(s['width']/2,quad_segs=12) for s in streams]).difference(protected)
parts=list(split(wet,LineString([[-3000,2800],[11000,2800]])).geoms)
parts2=[]
for p in parts:
 if p.interiors: parts2.extend(split(p,LineString([[4100,-3000],[4100,9000]])).geoms)
 else: parts2.append(p)
polys=[]
for x in range(-2048,10752,512):
 for y in range(-2048,8192,512):
  clipped=wet.intersection(box(x,y,x+512,y+512))
  pieces=list(clipped.geoms) if hasattr(clipped,'geoms') else [clipped]
  for p in pieces:
   if p.geom_type=='Polygon' and p.area>1:
    assert not p.interiors
    polys.append([[round(x,2),round(y,2)] for x,y in p.exterior.coords])
crossings=[]
old_decks=[LineString([j['foot'],j['tip']]).buffer(j['width']/2) for j in json.loads((base/'baseline/harbor.json').read_text())['jetties']]
for r in plan['roads']:
 line=LineString(smooth(r['points']))
 hit=line.intersection(wet)
 segments=list(hit.geoms) if hasattr(hit,'geoms') else [hit]
 for j,s in enumerate(segments):
  if s.geom_type!='LineString' or s.length<25: continue
  mid=s.interpolate(.5,normalized=True)
  if any(d.buffer(10).covers(s) for d in old_decks): continue
  d0=max(0,line.project(Point(s.coords[0]))-25);d1=min(line.length,line.project(Point(s.coords[-1]))+25)
  pts=[list(line.interpolate(d0+(d1-d0)*i/20).coords[0]) for i in range(21)]
  crossings.append({'id':r['id']+'-'+str(j),'width':(180 if r['id']=='south-main' else min(r['width']+20,240)),'points':pts})
result={'outlines':[[[round(x,2),round(y,2)] for x,y in p.exterior.coords] for p in parts2 if p.area>1],'polys':polys,'streams':streams,'crossings':crossings,'basins':basins,'waterArea':wet.area}
(base/'fix-water.json').write_text(json.dumps(result,indent=2)+'\n')
print('Water polygons:',len(polys),'road crossings:',[(c['id'],round(LineString(c['points']).length)) for c in crossings])
