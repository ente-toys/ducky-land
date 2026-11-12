import sys,json,math,os
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import LineString,Point,Polygon
from shapely.ops import unary_union
from pathlib import Path
O=Path('/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review');E=json.load(open('src/pixi/home-expansion.json'));R=json.load(open('src/pixi/home-routes.json'))
lines=[LineString(r['samples']) for r in R]
courts=[Polygon(r['rings'][0],r['rings'][1:]).buffer(0) for r in E['roads'] if r.get('rings')]
known=[(2820,2370,520,390),(4775,2750,470,600),(2920,1620,150,150),(4130,1537,720,460),(3500,1420,100,100),(4070,5365,150,150)]
ends=[]
for i,r in enumerate(R):
 if lines[i].is_ring:continue
 for p in [r['samples'][0],r['samples'][-1]]:
  q=Point(p);connected=any(j!=i and l.distance(q)<105 for j,l in enumerate(lines))
  court=any(c.distance(q)<65 for c in courts)
  landmark=any(((p[0]-x)/rx)**2+((p[1]-y)/ry)**2<1 for x,y,rx,ry in known)
  prop=any(math.hypot(p[0]-a['x'],(p[1]-a['y'])*1.3)<160 for a in E['props'] if not ('tree' in a.get('asset','') or 'bush' in a.get('asset','') or 'flower' in a.get('asset','')))
  ends.append(dict(route=r['id'],point=p,connected=connected,court=court,landmark=landmark,destinationProp=prop,deadEnd=not(connected or court or landmark or prop)))
auditPath=Path(os.environ.get('HOME_REVIEW_OUT',str(O/'fix')))/'walk-audit.json'
A=json.load(open(auditPath));A.update(deadEnds=sum(e['deadEnd'] for e in ends),endpoints=ends,sampledRoutePoints=sum(len(r['samples']) for r in R),scope='Every authored path centreline, physical obstacles, all named destinations; intentional planting canopy overlap is allowed.')
auditPath.write_text(json.dumps(A,indent=2));print('route samples',A['sampledRoutePoints'],'overlaps',A['overlaps'],'dead ends',A['deadEnds'],'sleepers',A['sleepers']);print([e for e in ends if e['deadEnd']])
