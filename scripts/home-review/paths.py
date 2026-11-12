"""Authored route remap; polygon union is geometry, never prop scattering."""
import json,sys,math
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import LineString,Polygon,Point
from shapely.ops import unary_union
from pathlib import Path
E=json.load(open('src/world/home/home-expansion.json'))
def road(id,p,main=False,end=None):return dict(id=id,kind='main' if main else 'lane',width=128 if main else 104,points=p,terminal=end)
loop=[[139,656],[900,594],[1700,545],[2220,530],[2380,350],[2850,340],[3839,500],[4190,650],[4640,533],[4830,540],[5100,950],[5330,1405],[5350,1420],[5600,1420],[5660,1650],[5733,1805],[5772,2070],[5680,2350],[5456,2567],[5200,3250],[5130,3950],[5200,4460],[4800,4680],[4020,4590],[3729,4478],[3487,4350],[3320,4240],[2700,4310],[2060,4110],[1661,3933],[990,4040],[820,3930],[400,4083],[-350,4020],[-900,4336],[-1200,4230],[-850,3950],[-760,3650],[-734,3366],[-355,3200],[-360,2950],[-130,2810],[80,2420],[80,2150],[289,1867],[110,1700],[117,1278],[139,656]]
R=[road('home-main-loop',loop,True),
road('butterbill-access',[[117,1278],[-350,1190],[-850,1100],[-950,880],[-900,680]]),
road('lanternleaf-access',[[2850,340],[2860,100],[2860,-160]]),
road('clovercrust-access',[[5010,835],[4920,600],[4910,350],[4980,150]]),
road('reedwhistle-access',[[4020,4590],[3960,4770],[4030,5025],[4065,5270],[4070,5365]],end='harbour'),
road('petalpatch-access',[[-900,4336],[-1000,4170],[-1060,3990]]),
road('west-meadow',[[289,1867],[600,2040],[900,2260],[1188,2630],[2092,2630],[2380,2560],[2480,2420]],end='plaza'),
road('library-walk',[[2820,2035],[2900,1810],[2920,1620]],end='library stair'),
road('plaza-beach',[[3240,2500],[3580,2630],[3950,2750],[4380,2740],[4690,2840],[5060,2870],[5350,2760],[5456,2567]],end='beach'),
road('plaza-lake',[[3130,2100],[3450,1990],[3740,2040],[4130,1970]],end='race lake bank'),
road('pond-south',[[1188,2630],[1230,2800],[1500,2930],[1820,2930],[2260,2850],[2560,2700]],end='plaza'),
road('south-meadow',[[1820,2930],[2100,3080],[2410,3140],[2780,3090],[3050,3080],[3240,3200],[3320,3345],[3060,3780],[3160,4000],[3320,4240]]),
road('makers-crossing',[[2410,3140],[2345,3240],[2322,3345],[1980,3800],[1880,3900],[1661,3933]]),
road('southwest-crossing',[[1500,2930],[1240,2975],[1138,3066],[940,3417],[1020,3640],[1150,3900],[990,4040]]),
road('east-meadow',[[3050,3080],[3500,3110],[3900,3000],[4200,2860],[4380,2740]]),
road('forest-library',[[139,656],[500,900],[1000,1030],[1500,1150],[1850,1300],[2300,1400],[2500,1610],[2640,1780],[2920,1800]]),
road('library-lake',[[2920,1800],[3170,1820],[3410,1640],[3500,1420]],end='race lake bank'),
road('mill-west',[[5100,950],[4950,1240],[4930,1480],[4930,1650],[5450,1690],[5660,1650]]),
road('quay-west',[[4065,5270],[3750,5370],[3420,5290],[3245,5497],[2950,5497],[2670,5440],[2339,5333]],end='Cloverhay work pad'),
road('willowrest',[[5456,2567],[5900,2760],[6428,3011]],end='reading picnic'),
road('seedshare',[[3839,500],[4100,310],[4272,150]],end='seed nursery')]
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
for id,p in [
 ('butterbill-doors',[[-900,680],[-1180,650],[-1230,560]]),
 ('butterbill-east-door',[[-650,590],[-450,590],[-450,450]]),
 ('lanternleaf-west-door',[[2450,-430],[2350,-430]]),
 ('lanternleaf-east-door',[[3270,-430],[3390,-430]]),
 ('clovercrust-mill',[[5300,40],[5320,-180],[5500,-300],[5690,-360],[5766,-496]]),
 ('clovercrust-barn',[[4820,100],[4830,-80],[4970,-220],[5087,-260]]),
 ('petalpatch-shop',[[-1300,3900],[-1420,3950],[-1530,3930],[-1570,3900]]),
 ('reedwhistle-west',[[3600,5290],[3540,5370]])]:
 r=road(id,p,end='doorstep');R.append(r);shapes.append(LineString(sample(p)).buffer(52,quad_segs=10))
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
Path('public/pixi-art/home-review').mkdir(parents=True,exist_ok=True)
Path('public/pixi-art/home-review/path-network.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{E["width"]}" height="{E["height"]}" viewBox="{E["origin"]["x"]} {E["origin"]["y"]} {E["width"]} {E["height"]}">{svg}</svg>')
Path('src/world/home/home-routes.json').write_text(json.dumps([dict(id=r['id'],width=r['width'],samples=sample(r['points'])) for r in R]))
Path('scripts/home-review/sampled-routes.json').write_text(json.dumps([dict(r,samples=sample(r['points'])) for r in R]))
E['roads']=R+squares
E['routeSystem']={'main':128,'lane':104,'surface':'/pixi-art/home-review/path-network.svg','routes':len(R)}
Path('src/world/home/home-expansion.json').write_text(json.dumps(E,indent=2)+'\n')
Path('scripts/home-review/routes.json').write_text(json.dumps(R,indent=2)+'\n')
print([(tuple(round(v) for v in g.bounds),round(g.area)) for g in (merged.geoms if hasattr(merged,'geoms') else [merged])]);print('Routes',len(R),'surface components',len(merged.geoms) if hasattr(merged,'geoms') else 1)
