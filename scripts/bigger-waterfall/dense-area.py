"""Reproducible union-area measurement in world units, counting the raised road bank too."""
import json
from pathlib import Path
from shapely.geometry import Polygon
from shapely.ops import unary_union
root=Path('scripts/bigger-waterfall')
before=json.loads((root/'dense-baseline.json').read_text())
after=json.loads((root/'plan.json').read_text())
original=json.loads((root/'original/world.json').read_text())
land=Polygon(after['coast']).buffer(0).difference(Polygon(original['coast']).buffer(0))
water=unary_union([Polygon(w['poly']).buffer(0) for w in after['water'] if 'poly' in w])
land=land.difference(water)
# The two original canal islets were already there, so do not call them new land.
from shapely.geometry import Point
from shapely.affinity import scale
for x,y,rx,ry in original['islets']:
 land=land.difference(scale(Point(x,y).buffer(1,quad_segs=96),rx,ry))

def area(plan,extra=False):
 shapes=[Polygon(r['poly']).buffer(0).buffer(18) for r in plan['roads']]
 if extra:
  # Sand at each front gate. The rectangular envelope deliberately overcounts
  # the curved 50-80 unit footpath, so the final percentage is conservative.
  for c in plan['communities']:
   for x,y,_ in c['homes']:
    shapes.append(Polygon([(x-50,y+20),(x+55,y+20),(x+55,y+180),(x-50,y+180)]))
 return unary_union(shapes).intersection(land).area
b=area(before);a=area(after,True)
result={'method':'Union of authored sand road polygons plus 18-unit raised-bank envelope, clipped to expanded dry land outside original coast and islets; after also includes conservative front-gate footpath envelopes. Sea beach and bridge decks excluded.','newDryLandArea':land.area,'before':{'roadArea':b,'percent':b/land.area*100,'roadRecords':len(before['roads'])},'after':{'roadArea':a,'percent':a/land.area*100,'roadRecords':len(after['roads'])},'roadAreaReductionPercent':(b-a)/b*100,'homeClusterEnvelope':[]}
for bc,ac in zip(before['communities'],after['communities']):
 def box(c):
  xs=[p[0] for p in c['homes']];ys=[p[1] for p in c['homes']]
  return (max(xs)-min(xs)+500)*(max(ys)-min(ys)+520)
 result['homeClusterEnvelope'].append({'id':ac['id'],'before':box(bc),'after':box(ac),'reductionPercent':(1-box(ac)/box(bc))*100})
print(json.dumps(result,indent=2))
