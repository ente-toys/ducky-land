"""Trace real canals outside the protected centre, with matching non-walkable polygons."""
from pathlib import Path
import sys,json,math,os
sys.path.insert(0,os.environ.get('DUCKY_COMMUNITY_PYTHON','/private/tmp/ducky-community-python'))
from shapely.geometry import Polygon,Point,LineString,box
from shapely.ops import unary_union,triangulate
from shapely.affinity import scale
S=Path(__file__).resolve().parent;p=json.loads((S/'plan.json').read_text());old=json.loads((S/'baseline/world.json').read_text())
land=Polygon(old['coast']);islets=[scale(Point(x,y).buffer(1,64),rx,ry) for x,y,rx,ry in old['islets']];protected=unary_union([land,*islets]);outer=Polygon(p['coast'])
canal=land.buffer(245,resolution=12).difference(protected)
def curve(q):
 pts=[]
 for i in range(len(q)-1):
  a=q[max(0,i-1)];b=q[i];c=q[i+1];d=q[min(len(q)-1,i+2)]
  for j in range(24):
   t=j/24;u=1-t;pts.append([u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k] for k in [0,1]])
 return pts+[q[-1]]
streams=[('Willow Brook',[[750,3000],[350,3150],[-150,3240],[-650,3330],[-1120,3400],[-1530,3470]],90),('Lantern Run',[[7330,3300],[7800,3400],[8380,3550],[9050,3750],[9680,3870]],95)]
water=unary_union([canal,*[LineString(curve(q)).buffer(width) for _,q,width in streams],scale(Point(5350,5200).buffer(1,64),250,150)]).difference(protected)
def path(shape):
 gs=list(shape.geoms) if hasattr(shape,'geoms') else [shape];out=''
 for poly in gs:
  if poly.is_empty or poly.geom_type!='Polygon':continue
  for ring in [poly.exterior,*poly.interiors]:out+='M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in ring.coords)+'Z'
 return out
waterpath=path(water)
svg=f'<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="review-water"><path d="{waterpath}" clip-rule="evenodd"/></clipPath><clipPath id="review-island"><path d="{path(outer)}"/></clipPath></defs><g clip-path="url(#review-island)"><path d="{waterpath}" fill="#81A754" stroke="#71894B" stroke-width="38" fill-rule="evenodd"/><path d="{waterpath}" fill="#6DC5D6" stroke="#EBD8A3" stroke-width="15" fill-rule="evenodd"/><path d="{waterpath}" fill="none" stroke="#498F9A" stroke-width="4"/>'
svg+='<g clip-path="url(#review-water)" fill="none" stroke="#C3ECE3" stroke-width="4" stroke-linecap="round">'
for x,y in [(1020,1380),(6840,1400),(7210,3120),(1820,4310),(6180,4330),(4000,500),(3600,5120),(780,2820),(-100,3250),(-820,3370),(7800,3420),(8670,3650),(9290,3810),(5290,5170),(5430,5250),(950,2500),(5640,4480),(3000,4670)]:
 svg+=f'<path d="M{x-34} {y}q25 -8 60 0m15 17q25 -8 48 0"/>'
svg+='</g>'
for x,y in [(680,3090),(-200,3135),(-790,3210),(-1000,3520),(7700,3300),(8080,3370),(8820,3565),(9290,3650),(5170,5070),(5510,5300),(1450,4050),(6410,4180),(7040,3430),(3310,4960)]:
 svg+=f'<g transform="translate({x} {y})"><path d="M-22 10q-5 -28 -17 -34M-9 9q-8 -45 2 -52M3 9q1 -37 18 -48M15 11q12 -21 28 -24" fill="none" stroke="#728D49" stroke-width="6" stroke-linecap="round"/><path d="M-33 15q8 -10 20 0M25 17q12 -10 22 0" fill="none" stroke="#95AF55" stroke-width="5"/><path d="M-55 18q3 -20 19 -15l10 15q-17 11 -29 0Z" fill="#C7BEA0" stroke="#7B826A" stroke-width="3"/></g>'
svg+='</g></svg>'; (S/'fix-ground.svg').write_text(svg)
shapes=[]
for rect in [box(-3000,-3000,4000,2900),box(4000,-3000,13000,2900),box(-3000,2900,4000,12000),box(4000,2900,13000,12000)]:
 cut=water.intersection(rect).intersection(outer.buffer(300)).simplify(.6,preserve_topology=True)
 gs=list(cut.geoms) if hasattr(cut,'geoms') else [cut]
 for g in gs:
  if g.geom_type!='Polygon' or g.area<1:continue
  if g.interiors:
   for tri in triangulate(g):
    for v in [tri.intersection(g)]:
     if v.geom_type=='Polygon' and v.area>1:shapes.append(v)
  else:shapes.append(g)
p['reviewWater']=[dict(id=f'community-review-water-{i}',poly=[[round(x,2),round(y,2)]for x,y in shape.exterior.coords])for i,shape in enumerate(shapes)]
p['reviewBridges']=[]
for i,b in enumerate(old['walkways'][:5]):
 a=b['a'];c=b['b'];count=math.ceil(math.dist(a,c)/28)
 for j in range(count+1):
  t=j/count;p['reviewBridges'].append(dict(x=a[0]+(c[0]-a[0])*t,y=a[1]+(c[1]-a[1])*t,w=b['w']+12,h=b['w']+12))
for d in p['reviewDecks']:
 p['reviewBridges'].append(dict(x=d['x']+d['width']/2,y=d['y']+d['height']/2,w=d['width']-30,h=d['height']-5))
p['reviewRivers']=[dict(name=name,centerline=q,width=width*2)for name,q,width in streams]
(S/'plan.json').write_text(json.dumps(p,indent=2)+'\n');print('Authored',len(shapes),'non-walkable water polygons and',len(p['reviewBridges']),'deck masks.')
