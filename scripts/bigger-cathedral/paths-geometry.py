"""One opaque union; round organic forks are computed before any tile is cut."""
import json,sys,math,os
sys.path.insert(0,os.environ.get('BELLOVO_PYTHON_DEPS','/private/tmp/ducky-community-python'))
from shapely.geometry import LineString,Point,Polygon,mapping
from shapely.ops import unary_union
from shapely import affinity
from pathlib import Path
p=Path('scripts/bigger-cathedral')
data=json.loads((p/'paths-input.json').read_text())
shapes=[LineString(r['samples']).buffer(r['width']/2,quad_segs=12) for r in data['routes']]
for c in data['courts']:
 shapes.append(affinity.scale(Point(c['x'],c['y']).buffer(1,quad_segs=64),c['rx'],c['ry']))
union=unary_union(shapes).buffer(72,quad_segs=16).buffer(-72,quad_segs=16)
polys=list(union.geoms) if hasattr(union,'geoms') else [union]
union=unary_union([Polygon(q.exterior,[r for r in q.interiors if Polygon(r).area>24000]) for q in polys])
def path(g):
 polys=list(g.geoms) if hasattr(g,'geoms') else [g]
 return ' '.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in r.coords)+'Z' for q in polys for r in [q.exterior,*q.interiors])
(p/'path-surface.svgfrag').write_text(f'<g data-name="Bellovo unified paths"><path d="{path(union)}" fill="#F7DC88" fill-rule="evenodd"/></g>')
(p/'path-surface.json').write_text(json.dumps(mapping(union)))
print('union components',len(list(union.geoms)) if hasattr(union,'geoms') else 1)
