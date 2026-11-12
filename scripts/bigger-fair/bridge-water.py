"""Union only the new lagoon outlet with the existing lagoon water contour."""
import json,sys
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Polygon,LineString
from shapely.ops import unary_union
layout=json.load(open('scripts/bigger-fair/centre-source/layout.json'))
P=lambda p:[3570+(p[0]-768)*4.3,2220+(p[1]-520)*3.8]
lagoon=[P(p) for p in layout['polygons']['lagoon']]
islet=[P(p) for p in layout['polygons']['islet']]
# Northeast of the castle, in the open wedge between north and northeast approaches.
line=[[4270,900],[4320,775],[4390,625],[4460,480],[4525.7,358.85]]
channel=LineString(line).buffer(94,quad_segs=12)
wet=unary_union([Polygon(lagoon),channel])
world=json.load(open('assets/world/themes/fair/world.json'))
ring=unary_union([Polygon(w['poly']) for w in world['water'] if w.get('id','').startswith('heart-canal-')])
banks=wet.boundary.difference(ring.buffer(2))
banklines=[list(g.coords) for g in getattr(banks,'geoms',[banks])]
old=json.load(open('scripts/bigger-fair/original-world.json'))
clip=unary_union([Polygon(old['coast']),channel])
print(json.dumps(dict(banklines=banklines,clip=list(clip.exterior.coords),line=line,poly=list(channel.exterior.coords),outline=list(wet.exterior.coords),lagoon=lagoon,islet=islet)))
