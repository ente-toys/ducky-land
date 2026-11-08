"""Keep the old two canal islets dry while the former shoreline becomes water."""
import json,sys
from shapely.geometry import Polygon
from shapely.ops import unary_union,triangulate
import math
p=json.load(sys.stdin)
islets=unary_union([Polygon([(x+math.cos(t*math.tau/96)*rx,y+math.sin(t*math.tau/96)*ry) for t in range(96)]) for x,y,rx,ry in p['islets']])
result=[]
for w in p['water']:
 if w.get('communityWater')!='old-shore-canal': result.append(w);continue
 g=Polygon(w['poly']).buffer(0).difference(islets)
 polygons=list(g.geoms) if hasattr(g,'geoms') else [g]
 for poly in polygons:
  if poly.is_empty or poly.area<.01:continue
  pieces=[t for t in triangulate(poly) if poly.covers(t.representative_point())] if len(poly.interiors) else [poly]
  for piece in pieces:result.append({**w,'poly':[[round(x,4),round(y,4)] for x,y in list(piece.exterior.coords)[:-1]]})
json.dump(result,sys.stdout)
