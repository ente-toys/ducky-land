"""Optional geometry rebuild: PYTHONPATH=/private/tmp/ducky-community-python python3 scripts/bigger-cathedral/water-coast-geometry.py.
The normal Node art build consumes the checked-in water-coast.json. This joins
sea and all inland water before offsetting the shoreline, with no coast clips.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.affinity import scale
P=Path('scripts/bigger-cathedral')
world=json.loads(Path('rive/web/themes/cathedral/world.json').read_text())
geo=json.loads((P/'water-geometry.json').read_text())
land=Polygon(world['coast']).buffer(0)
wet=unary_union([Polygon(p).buffer(0) for p in geo['polys']])
# Round the four estuary shoulders and any little convex shore spikes. This
# rounds their artwork locally, leaving sailing bounds and anchors intact.
dry=land.difference(wet).buffer(-40,quad_segs=16).buffer(40,quad_segs=16)
# Cover the complete old outer surf (75 units outside the old contour), and
# rebuild sand and foam from the SAME completed dry contour as the waterways.
# Keep Bellovo's generous outer beach, tapering into the narrow river banks.
# Its inner grass edge is also a joined rounded contour, so a leftover beach
# wedge cannot cut across an estuary after its foam has been corrected.
inset=scale(land,.958,.955,origin=(4100,2750))
grass=inset.intersection(dry.buffer(-26)).buffer(-55,quad_segs=16).buffer(55,quad_segs=16)
sand=dry.difference(grass)
sea=land.buffer(92).difference(dry)
foam=dry.buffer(12,quad_segs=16).difference(dry)
coverage=sea.union(sand).union(foam)
def svg(g):
 ps=[g] if g.geom_type=='Polygon' else [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
 return ''.join('M'+'L'.join(f'{x:.3f} {y:.3f}' for x,y in r.coords)+'Z' for p in ps for r in [p.exterior,*p.interiors])
tiles=[]
for r,y in enumerate(range(-2400,8000,1400)):
 for c,x in enumerate(range(-2200,10600,1400)):
  w,h=min(1400,10600-x),min(1400,8000-y)
  bounds=box(x,y,x+w,y+h)
  if coverage.intersection(bounds).area<.1:continue
  tiles.append(dict(src=f'bridges/water-{r}-{c}.svg',x=x,y=y,width=w,height=h))
result=dict(version=1,sea='#6EC9DE',foam='#FFF0C7',sand='#F7DC88',rounding=40,paths=dict(sea=svg(sea),foam=svg(foam),sand=svg(sand)),tiles=tiles)
(P/'water-coast.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('Continuous sea + river shoreline:',len(tiles),'tiles')
