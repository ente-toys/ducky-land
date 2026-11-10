"""Round only the two sea-mouth shoulders, retaining all inland bank geometry."""
import json,sys
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import shape,box
p=json.load(sys.stdin)
land=shape(p['land'])
# A convex corner where river and coastline meet needs an actual sand shoulder,
# not an opaque water fan. Cut back the dry bank gently within each mouth only.
rounded=land.buffer(-65,quad_segs=16).buffer(65,quad_segs=16)
for rect in p['mouths']:
    window=box(*rect)
    land=land.difference(window).union(rounded.intersection(window))
polys=[land] if land.geom_type=='Polygon' else list(land.geoms)
print(' '.join('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in r.coords)+'Z' for poly in polys for r in [poly.exterior,*poly.interiors]))
