import json,sys,re
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Point,Polygon,LineString
from shapely import affinity
from shapely.ops import unary_union
read=lambda p:json.loads(Path(p).read_text())
b=read('scripts/pagepond-b/placements.json');w=read('assets/world/themes/library/world.json');s=read('scripts/pagepond-ground/surface.json')
def path(d):
 g=Polygon()
 for part in d.split('M')[1:]:
  nums=list(map(float,re.findall(r'[-+]?(?:\d*\.\d+|\d+)',part)));g=g.symmetric_difference(Polygon(list(zip(nums[::2],nums[1::2]))).buffer(0))
 return g
def shape(o):return Polygon(o['poly']).buffer(0) if o.get('poly') else affinity.scale(Point(o['x'],o['y']).buffer(1,24),o.get('rx',1),o.get('ry',1))
surface=path(s['d']);r=b['hill']['route'];apron=r['destination'];hill=LineString(r['points']).buffer(52).union(shape(apron));surface=surface.union(hill)
bridges=unary_union([LineString([x['a'],x['b']]).buffer(x['w']/2) for x in w['walkways']]);blocked=surface.union(bridges).buffer(16)
keep=[]
for o in w['obstacles']:
 m=next((m for m in b['planting']['moves'] if m['id']==o.get('name')),None)
 if m:
  o=dict(o)
  if 'poly'in o:o['poly']=[[x+m['delta'][0],y+m['delta'][1]]for x,y in o['poly']]
  else:o.update(x=o['x']+m['delta'][0],y=o['y']+m['delta'][1])
 keep.append(shape(o))
keep=unary_union(keep);accepted=[];drops=[]
for p in b['planting']['add']:
 f=shape(p['footprint']);reason='path/bridge' if f.intersects(blocked) else 'keep-contact' if f.intersection(keep).area>.5 else None
 if reason:drops.append({'id':p['id'],'reason':reason})
 else:accepted.append(p['id'])
Path('scripts/pagepond-b/filter.json').write_text(json.dumps({'accepted':accepted,'drops':drops},indent=2)+'\n')
print('accepted',len(accepted),'dropped',len(drops),drops[:12])
