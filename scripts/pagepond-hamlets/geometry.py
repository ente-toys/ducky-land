"""Resolve the floor at millimetre precision, preserving holes and merged joins.
Build dependency: Shapely 2 (pip install -r scripts/pagepond-hamlets/requirements.txt).
Tests consume the generated vector geometry, without a Python dependency.
"""
import json,sys
from shapely.geometry import Polygon, GeometryCollection
from shapely.ops import unary_union
from shapely import set_precision
from shapely.geometry.polygon import orient

def clean(points):
    p=Polygon(points)
    return set_precision(p if p.is_valid else p.buffer(0), .01)
def odd(rings):
    result=GeometryCollection()
    for ring in rings:
        if len(ring)>2: result=result.symmetric_difference(clean(ring))
    return result
p=json.load(open(sys.argv[1]))
floor=odd(p['floor']).intersection(odd(p['dry']))
contacts=unary_union([clean(s['poly']) for s in p['shapes'] if not s.get('parent') and not s.get('dock') and not s.get('boat')])
rests=unary_union([clean(s) for s in p['rests']])
floor=floor.difference(contacts).difference(rests)
if not floor.is_valid: floor=floor.buffer(0)
polygons=[floor] if floor.geom_type=='Polygon' else [g for g in floor.geoms if g.geom_type=='Polygon']
rings=[]
for polygon in polygons:
    polygon=orient(polygon,1)
    rings.append(list(polygon.exterior.coords)[:-1])
    rings.extend(list(r.coords)[:-1] for r in polygon.interiors)
svg=''.join('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in r)+'Z' for r in rings)
json.dump({'d':svg,'rings':rings,'valid':floor.is_valid,'components':len(polygons),'area':floor.area},open(sys.argv[2],'w'),separators=(',',':'))
