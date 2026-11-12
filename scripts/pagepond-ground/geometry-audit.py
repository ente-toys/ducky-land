import json,sys,math
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Point,Polygon,LineString
from shapely import affinity
from shapely.ops import unary_union
S=Path('scripts/pagepond-ground');read=lambda p:json.loads(Path(p).read_text())
world=read('assets/world/themes/library/world.json');routes=read(S/'sampled-routes.json');surface=read(S/'surface.json');keep=read(S/'data/keep.json')
def shape(o):return Polygon(o['poly']).buffer(0) if o.get('poly') else affinity.scale(Point(o['x'],o['y']).buffer(1,24),o.get('rx',0),o.get('ry',0))
contactShapes=[shape(o) for o in world['obstacles']]
for p in read('public/pixi-art/themes/library/art.json')['props']:
 if p['src'].startswith('reuse/flower-'):
  k=p.get('scale',1);w=p['width']*k;h=p['height']*k;contactShapes.append(affinity.scale(Point(p['x'],p['y']-h*.35).buffer(1,24),w*.4,h*.3))
contacts=unary_union(contactShapes);issues=[]
for r in routes:
 lane=LineString(r['samples']).buffer(r['width']/2)
 hit=lane.intersection(contacts)
 if hit.area>.5:issues.append({'type':'full-lane-prop-overlap','id':r['id'],'area':round(hit.area,2)})
rests=unary_union([affinity.scale(Point(b['x'],b['y']-6).buffer(1,24),b.get('r',90),40) for b in read(S/'data/current-sleepers.json')])
for r in routes:
 if LineString(r['samples']).buffer(r['width']/2).intersection(rests).area>.5:issues.append({'type':'full-lane-sleeper-overlap','id':r['id']})
for i,r in enumerate(routes):
 a=LineString(r['samples'])
 for q in routes[i+1:]:
  b=LineString(q['samples']);hit=a.intersection(b)
  ps=[hit] if hit.geom_type=='Point' else [p for p in getattr(hit,'geoms',[]) if p.geom_type=='Point']
  for p in ps:
   if min(p.distance(Point(v)) for t in [r,q] for v in [t['samples'][0],t['samples'][-1]])<100:continue
   if a.intersection(p.buffer(100)).buffer(16).intersection(b.intersection(p.buffer(100)).buffer(16)).area>3500:continue
   if any(LineString([w['a'],w['b']]).distance(p)<w['w']/2 for w in world['walkways']):continue
   issues.append({'type':'interior-X','routes':[r['id'],q['id']],'point':[p.x,p.y]})
report={'issues':issues,'fullLaneRadius':True,'routeWidths':sorted(set(r['width'] for r in routes)),'routes':len(routes)}
(S/'geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(report)
import re
courts=[]
for c in surface['courts']:
 for d in c['d'].split('M')[1:]:
  nums=list(map(float,re.findall(r'[-+]?(?:\d*\.\d+|\d+)',d)));courts.append(Polygon(list(zip(nums[::2],nums[1::2]))))
court=unary_union(courts);ends=[]
for r in routes:
 for end,p in [('start',r['samples'][0]),('end',r['samples'][-1])]:
  q=Point(p);other=min(q.distance(LineString(t['samples']))-t['width']/2 for t in routes if t is not r)
  pier=min(q.distance(LineString([w['a'],w['b']]))-w['w']/2 for w in world['walkways'])
  gap=max(0,min(other,pier,q.distance(court))-r['width']/2)
  doorway=r['id'].endswith('-door') and end=='start'
  ends.append({'id':r['id'],'end':end,'gap':round(gap,3),'doorway':doorway})
  if gap>3 and not doorway:issues.append({'type':'unserved-route-end','id':r['id'],'end':end,'gap':round(gap,3)})
report.update(issues=issues,ends=ends,unservedEnds=sum(i['type']=='unserved-route-end' for i in issues))
(S/'geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n');print('Unserved route ends',report['unservedEnds'])
if issues:raise SystemExit(1)
