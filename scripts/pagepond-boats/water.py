"""Close sub-pixel export seams between Pagepond's tiled boat-water polygons.

The exported banks round independently to hundredths of a world unit. Their
hairline gaps were solid to a boat's hull despite being invisible in the SVG.
Always start from the preserved mask, so rebuilding never grows the channels.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, '/private/tmp/ducky-community-python')
from shapely.geometry import Polygon

read = lambda path: json.loads(Path(path).read_text())
world = read('assets/world/themes/library/world.json')
source = read('scripts/pagepond-ground/data/keep.json')['boatWater']
source += [w['poly'] for w in world['water'] if w.get('name') == 'Pagepond rounded mouth banks']
polygons = []
for points in source:
    # Five hundredths of a unit closes rounding cracks without a visible bank
    # change. Keep each tile separate so the centre islands remain dry holes.
    shape = Polygon(points).buffer(0).buffer(.05, quad_segs=1, join_style=2)
    for polygon in [shape] if shape.geom_type == 'Polygon' else shape.geoms:
        assert not polygon.interiors, 'Boat-water tile unexpectedly contains land'
        polygons.append(list(polygon.exterior.coords))
print(json.dumps(polygons, separators=(',', ':')))
