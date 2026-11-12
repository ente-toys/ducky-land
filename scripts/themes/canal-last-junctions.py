"""Last Canal review: local path silhouettes only. Other art and world data stay intact."""
from pathlib import Path
import json,re,xml.etree.ElementTree as ET
from shapely.geometry import Point,Polygon,LineString,box
from shapely.affinity import scale
from shapely.ops import unary_union
R=Path(__file__).resolve().parents[2]; A=R/'public/pixi-art/themes/canal'; W=R.parent/'concepts/themes/work/canal/last-canal'
world=json.loads((R/'assets/world/themes/canal/world.json').read_text()); art=json.loads((A/'art.json').read_text())
NS='http://www.w3.org/2000/svg';ET.register_namespace('',NS)
def ellipse(x,y,rx,ry):return scale(Point(x,y).buffer(1,quad_segs=48),rx,ry)
def shape(q):
 ps=list(q.geoms) if hasattr(q,'geoms') else [q]
 def ring(c):return 'M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in c)+'Z'
 return ' '.join(ring(p.exterior.coords)+' '+ ' '.join(ring(r.coords) for r in p.interiors) for p in ps if p.geom_type=='Polygon')
def parse(d):
 rings=[]
 for s in re.findall(r'M([^M]+)',d):
  nums=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',s)));p=list(zip(nums[::2],nums[1::2]));
  if len(p)>3:rings.append(Polygon(p))
 q=Polygon()
 for p in rings:q=q.symmetric_difference(p)
 return q
# Two almost-parallel north approaches previously widened into one sand apron.
# Feed the main curve into the existing loop at the cross street instead.
paths=world['paths']; widths=world['pathWidths']; revised=[list(p) for p in paths]
p0,p1,p2,p3=(1506.25,2550),(1435,2800),(1200,2790),(1175,3043)
curve=[]
for i in range(49):
 t=i/48;u=1-t;curve.append([u**3*p0[j]+3*u*u*t*p1[j]+3*u*t*t*p2[j]+t**3*p3[j] for j in (0,1)])
revised[0]=list(reversed(curve))+paths[0][9:]
revised[1]=paths[1][16:]
revised[2]=[[1175,3020]]+paths[2][4:]
land=unary_union([Polygon(world['coast'])]+[ellipse(*v) for v in world['islets']])
route=unary_union([LineString(p).buffer(v/2,quad_segs=32) for p,v in zip(revised,widths)]).buffer(65,quad_segs=24).buffer(-65,quad_segs=24)
# The existing round inlays remain compact plazas, with softly joined entries.
for x,y in [(1370,3020)]:route=route.union(ellipse(x,y,195,149.4))
route=route.buffer(28,quad_segs=24).buffer(-28,quad_segs=24).intersection(land)
mask=unary_union([box(850,2050,1920,3550),ellipse(6480,4000,490,420)])
ground=ET.fromstring((W/'ground-before.svg').read_text());joined=next(e for e in ground if e.get('id')=='canal-joined-paths');finish=next(e for e in ground if e.get('id')=='canal-close-finish')
old=parse(joined.get('d'));local=old.difference(mask).union(route.intersection(mask))
joined.set('d',shape(local))
# The top finish repeats the route above lawns. Replace only these same patches.
top=finish[0][0];oldtop=parse(top.get('d'));newtop=oldtop.difference(mask).union(route.intersection(mask));top.set('d',shape(newtop))
edge=finish[1][0];edge.set('d',shape(parse(edge.get('d')).difference(mask).union(route.buffer(9).difference(route).intersection(mask))))
# Home's dark fine ink and cream inner edge, clipped to the reviewed joins.
defs=ground.find('{'+NS+'}defs');clip=ET.SubElement(defs,'{'+NS+'}clipPath',{'id':'canal-last-junction-mask'});ET.SubElement(clip,'{'+NS+'}path',{'d':shape(mask)})
g=ET.SubElement(finish,'{'+NS+'}g',{'clip-path':'url(#canal-last-junction-mask)','id':'canal-last-junction-ink'})
for q,col,sw in [(route,'#424A2D',3),(route.buffer(-5),'#FFF2CE',4)]:
 ET.SubElement(g,'{'+NS+'}path',{'d':shape(q),'fill':'none','stroke':col,'stroke-width':str(sw),'stroke-linejoin':'round','stroke-linecap':'round'})
# All paving remains above the new edge, including the small circular inlay.
body=ET.tostring(ground,encoding='unicode');(A/'ground.svg').write_text(body)
for tile in art['ground']['tiles']:
 text=re.sub(r'<svg\b[^>]*>',f'<svg xmlns="{NS}" width="{tile["width"]}" height="{tile["height"]}" viewBox="{tile["x"]} {tile["y"]} {tile["width"]} {tile["height"]}" stroke-linejoin="round" stroke-linecap="round">',body,count=1)
 (A/tile['src']).write_text(text)
print('Updated Canal ground and 24 tiles only; world, props, sleepers and centre unchanged.')
