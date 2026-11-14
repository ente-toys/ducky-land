"""Authored route remap; polygon union is geometry, never prop scattering."""
import json,sys,math,re
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import LineString,Polygon,Point
from shapely.ops import unary_union
from pathlib import Path
E=json.load(open('src/world/home/home-expansion.json'))
def road(id,p,main=False,end=None):return dict(id=id,kind='main' if main else 'lane',width=128 if main else 104,points=p,terminal=end)
R=json.load(open('scripts/home-review/routes.json'))
squares=[r for r in E['roads'] if r.get('rings') and r['id'].endswith('-square')]
def sample(p):
 out=[]
 for i in range(len(p)-1):
  a=p[max(0,i-1)];b=p[i];c=p[i+1];d=p[min(len(p)-1,i+2)]
  n=max(3,math.ceil(math.dist(b,c)/18))
  for j in range(n):
   t=j/n;u=1-t
   out.append([u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k] for k in (0,1)])
 out.append(p[-1]);return out
shapes=[LineString(sample(r['points'])).buffer(r['width']/2,quad_segs=10) for r in R]
for s in squares:
 q=Polygon(s['rings'][0],s['rings'][1:]);shapes.append(q.buffer(0))
from shapely import affinity
for x,y,rx,ry in [(2820,2370,480,365)]:
 shapes.append(affinity.scale(Point(x,y).buffer(1,quad_segs=40),rx,ry))
beach=[[4340,2520],[4440,2290],[4680,2170],[4920,2260],[5100,2470],[5200,2800],[5090,3100],[4810,3260],[4530,3180],[4380,2940]]
shapes.append(Polygon(sample(beach+[beach[0]])).buffer(0))
merged=unary_union(shapes).buffer(85,quad_segs=12).buffer(-85,quad_segs=12)
def path(g):
 polys=[g] if g.geom_type=='Polygon' else list(g.geoms)
 return ' '.join('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in ring.coords)+'Z' for po in polys for ring in [po.exterior,*po.interiors])
svg=f'<g data-name="Home unified paths"><path d="{path(merged)}" fill="#e4c567" transform="translate(0 3)" fill-rule="evenodd"/><path d="{path(merged)}" fill="#fde48c" fill-rule="evenodd"/></g>'
wet=unary_union([Polygon(w['poly']).buffer(0) for w in E['riverWater']]+[Polygon(E['water']['poly']).buffer(0)])
W=json.load(open('assets/world/world.json'))
for w in W['water']:
 if abs(w.get('x',0)-1640)<2:
  wet=wet.union(affinity.scale(Point(w['x'],w['y']).buffer(1,quad_segs=60),w['rx'],w['ry']))
wet=wet.union(Polygon(json.load(open('src/world/home/walk-shapes.json'))['lake']).buffer(0)).buffer(35,quad_segs=12).buffer(-35,quad_segs=12)
def watercurve(g):
 polys=[g] if g.geom_type=='Polygon' else list(g.geoms)
 result=[]
 for po in polys:
  for ring in [po.exterior,*po.interiors]:
   q=list(ring.coords)[:-1];d=f'M{q[0][0]:.1f},{q[0][1]:.1f}'
   for i,b in enumerate(q):
    a=q[(i-1)%len(q)];c=q[(i+1)%len(q)];e=q[(i+2)%len(q)]
    d+=f'C{b[0]+(c[0]-a[0])/6:.1f},{b[1]+(c[1]-a[1])/6:.1f} {c[0]-(e[0]-b[0])/6:.1f},{c[1]-(e[1]-b[1])/6:.1f} {c[0]:.1f},{c[1]:.1f}'
   result.append(d+'Z')
 return ' '.join(result)
waterpath=watercurve(wet)
landpath=path(Polygon(E['coast']).buffer(0))
waves=''.join(f'<path d="M{x-20:.1f} {y:.1f}q20-8 40 0"/>' for r in E['rivers'] for x,y in sample(r['points'])[3:-3:12])
Path('scripts/home-review/water-surface.svgfrag').write_text(f'<g data-name="Home water union"><defs><clipPath id="home-water-land"><path d="{landpath}"/></clipPath><clipPath id="home-water-wet"><path d="{waterpath}"/></clipPath></defs><path d="{waterpath}" fill="#fde48c" stroke="#fde48c" stroke-width="50" stroke-linejoin="round" clip-path="url(#home-water-land)"/><path d="{waterpath}" fill="#6ec9de"/><path d="{waterpath}" fill="none" stroke="#b6ddd8" stroke-width="4" clip-path="url(#home-water-land)"/><g fill="none" stroke="#bde8e6" stroke-width="4" stroke-linecap="round" clip-path="url(#home-water-wet)">{waves}</g></g>')

surface=merged.difference(wet)
svg=f'<g data-name="Home unified paths"><path d="{path(surface)}" fill="#e4c567" transform="translate(0 3)" fill-rule="evenodd"/><path d="{path(surface)}" fill="#fde48c" fill-rule="evenodd"/></g>'
Path('scripts/home-review/path-surface.svgfrag').write_text(svg)
# Home renders paths baked into both original and expansion ground tiles.
# Keep those shared drawings in sync with the authored route network.
for folder in ['home-expansion', 'home-expansion-g']:
 for tile in Path('public/pixi-art',folder).glob('ground-*.svg'):
  source=tile.read_text()
  updated,count=re.subn(r'<g data-name="Home unified paths">.*?</g>',lambda _:svg,source,flags=re.S)
  if count:tile.write_text(updated)
Path('public/pixi-art/home-review').mkdir(parents=True,exist_ok=True)
Path('public/pixi-art/home-review/path-network.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{E["width"]}" height="{E["height"]}" viewBox="{E["origin"]["x"]} {E["origin"]["y"]} {E["width"]} {E["height"]}">{svg}</svg>')
Path('src/world/home/home-routes.json').write_text(json.dumps([dict(id=r['id'],width=r['width'],samples=sample(r['points'])) for r in R]))
Path('scripts/home-review/sampled-routes.json').write_text(json.dumps([dict(r,samples=sample(r['points'])) for r in R]))
E['roads']=R+squares
E['routeSystem']={'main':128,'lane':104,'surface':'/pixi-art/home-review/path-network.svg','routes':len(R)}
Path('src/world/home/home-expansion.json').write_text(json.dumps(E,indent=2)+'\n')
Path('scripts/home-review/routes.json').write_text(json.dumps(R,indent=2)+'\n')
print([(tuple(round(v) for v in g.bounds),round(g.area)) for g in (merged.geoms if hasattr(merged,'geoms') else [merged])]);print('Routes',len(R),'surface components',len(merged.geoms) if hasattr(merged,'geoms') else 1)
