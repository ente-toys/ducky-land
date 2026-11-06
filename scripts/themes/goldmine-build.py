"""Nuggetnook. Python 3.11 + numpy/shapely. Geometry and home-weight deck recipes follow sunflower-build.py.
Only writes the goldmine theme. Run goldmine-sleepers.mjs, goldmine-preview.mjs, goldmine-check.mjs afterward.
"""
from pathlib import Path
import json, math, random, re, shutil
import numpy as np
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely.affinity import scale as scale_geom

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / 'public/pixi-art/themes/goldmine'
DATA = ROOT / 'rive/web/themes/goldmine'
WIDTH, HEIGHT = 8000, 6000
for p in [ART, DATA, ART/'reuse', ART/'detail']: p.mkdir(parents=True, exist_ok=True)
rnd = random.Random(109)

def polyd(ps): return 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x,y in ps) + ' Z'
def ell(x,y,rx,ry,n=80): return [(x+rx*math.cos(t),y+ry*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)]
def shp(g):
    return ' '.join(polyd(p.exterior.coords) + ' ' + ' '.join(polyd(r.coords) for r in p.interiors) for p in (g.geoms if hasattr(g,'geoms') else [g]) if p.geom_type=='Polygon')
def bez(pts, closed=False):
    n=len(pts); at=lambda i:pts[i%n] if closed else pts[max(0,min(n-1,i))]
    d=f'M {pts[0][0]:.1f} {pts[0][1]:.1f}'
    for i in range(n if closed else n-1):
        p0,p1,p2,p3=[at(j) for j in [i-1,i,i+1,i+2]]
        d+=f' C {p1[0]+(p2[0]-p0[0])/6:.1f} {p1[1]+(p2[1]-p0[1])/6:.1f} {p2[0]-(p3[0]-p1[0])/6:.1f} {p2[1]-(p3[1]-p1[1])/6:.1f} {p2[0]:.1f} {p2[1]:.1f}'
    return d+(' Z' if closed else '')
def catmull(pts,closed=False):
    P=list(pts); P=([P[-1]]+P+[P[0],P[1]]) if closed else [P[0]]+P+[P[-1]]; out=[]
    for i in range(1,len(P)-2):
        a,b,c,d=map(np.array,P[i-1:i+3])
        for t in np.linspace(0,1,12,endpoint=False):out.append(tuple(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)))
    if not closed:out.append(tuple(P[-2]))
    return out
def rounded(g):return [[round(x,1),round(y,1)] for x,y in g.exterior.coords[:-1]]

# A broad rocky cove, with beaches, not a literal egg-shaped island.
raw=[(790,1780),(1170,1120),(2220,900),(3010,680),(4000,710),(4850,730),(5660,930),(6530,1050),(7060,1530),(7250,2210),(7120,2860),(7300,3400),(6850,3970),(5900,4270),(5200,4690),(4140,4780),(3290,4640),(2560,4750),(1740,4440),(1050,4000),(680,3330),(820,2580)]
land=Polygon(catmull(raw,True))
land=scale_geom(land,xfact=math.sqrt(19_450_000/land.area),yfact=math.sqrt(19_450_000/land.area),origin=(4000,2800))
coast=rounded(land)
islets=[[2050,5220,435,300],[5800,5230,440,290]]
all_land=unary_union([land]+[Polygon(ell(*i)) for i in islets])
pond=dict(x=1900,y=3180,rx=570,ry=370)
pond_poly=Polygon(ell(**pond))
plaza=dict(x=4100,y=2910,rx=960,ry=710)
centre=Polygon(ell(**plaza))
activities=[dict(id='activity-1',name='Prospectors green',x=1930,y=1900,rx=560,ry=390),dict(id='activity-2',name='Discovery yard',x=6020,y=2180,rx=580,ry=420),dict(id='activity-3',name='Golden picnic lawn',x=4050,y=4230,rx=650,ry=330)]
rows=[dict(id='stalls-1',name='Nugget market row',x0=5400,y0=3100,x1=6550,y1=3510),dict(id='stalls-2',name='Miners exchange row',x0=2650,y0=2010,x1=3480,y1=2370),dict(id='stalls-3',name='Panning supplies row',x0=1900,y0=3920,x1=2660,y1=4190)]
zone_geoms=[Polygon(ell(a['x'],a['y'],a['rx'],a['ry'])) for a in activities]+[box(r['x0'],r['y0'],r['x1'],r['y1']) for r in rows]
reserved=unary_union(zone_geoms+[centre])
path_defs=[
 ([(4930,2790),(5440,2640),(5570,2180),(5500,1790),(5340,1580)],270),
 ([(3350,2640),(2820,2550),(2280,2510),(1720,2485),(1280,2560),(780,2580)],250),
 ([(4930,2790),(5480,2750),(6040,2840),(6520,2760),(7070,2770)],250),
 ([(4650,3400),(4970,3830),(5590,4000),(6170,3930),(6850,3680)],240),
 ([(3510,3420),(3090,3800),(2830,4180),(3050,4590),(3090,5330)],250),
 ([(3110,3780),(2540,3760),(1940,3840),(1190,3710),(1140,3230),(1280,2560),(1290,2240)],230),
 ([(1290,2240),(1210,1680),(2110,1330),(3040,1390),(4020,1660),(4930,1630),(5340,1580),(6440,1680),(6760,2180),(6740,2770),(6770,3310)],230),
 ([(2840,4200),(2200,4660),(2050,4940)],225),
 ([(5590,4000),(5720,4660),(5800,4950)],225),
 ([(4050,3620),(4050,3900),(4050,4200)],230),
 ([(1280,3180),(2550,3180),(2900,3030),(3200,2910)],210),
 ([(6030,2740),(6030,3090)],210),
 ([(2990,2510),(3000,2370)],210),
]
paths=[(catmull(p),w) for p,w in path_defs]
path_geom=unary_union([LineString(p).buffer(w/2) for p,w in paths])
# A single union removes stroke seams. Closing rounds the inside of each Y junction.
path_geom=path_geom.buffer(95,quad_segs=12).buffer(-95,quad_segs=12)
beach=Polygon(catmull([(6280,3530),(6980,3240),(7160,3520),(6770,3990),(6050,4250),(5970,3900)],True)).intersection(land)
green=land.buffer(-115).difference(beach)
decks={
 'jetty-s':([3090,4380],[3090,5330],128),
 'jetty-w':([1250,2580],[370,2580],160),
 'jetty-e':([6740,2770],[7700,2770],160),
 'jetty-se':([6380,3720],[7140,4400],160),
 'bridge-west':([2330,4370],[2110,5050],190),
 'bridge-east':([5560,4280],[5760,5040],190),
 'bridge-pond':([1260,3180],[2540,3180],190),
}

# Reuse the exact home assets and their normal world sizes.
copies={}
for kind in ['tree-1','tree-2','tree-3','tree-4','tree-5','bush-1','bush-2','bush-3','flower-1','flower-2']:
    copies[kind]=f'plants/{kind}.svg'
for kind in ['street--bench-wood','street--bench-wood-left','street--bench-wood-right','street--picnic-table','street--planter-flowers','street--umbrella-garden','buildings--stall-bread','buildings--stall-fruit','street--fence-rail','nature--rock-round','beach--sandcastle-small','beach--shell-scallop']:
    copies[kind]=f'detail/{kind}.svg'
for name,src in copies.items():shutil.copyfile(ROOT/'public/pixi-art'/src,ART/'reuse'/f'{name}.svg')
props=[]; obstacles=[]; prop_obstacles={}
def put(name,src,x,y,h,foot='small',pid=None,flip=False):
    txt=(ART/src).read_text(); m=re.search(r'viewBox="([^"]+)"',txt)
    v=list(map(float,m[1].split())); w0,h0=v[2:]; s=h/h0; w=w0*s
    p=dict(id=pid or f'goldmine-{len(props)}',name=name,src=src,x=x,y=y,width=w0,height=h0,scale=round(s,5),anchor=dict(x=.5,y=.97),flip=flip)
    props.append(p)
    ob_start=len(obstacles)
    if foot=='tree': obstacles.append(dict(x=x,y=y-8,rx=31,ry=23))
    elif foot=='small': obstacles.append(dict(x=x,y=y-10,rx=round(w*.34),ry=min(38,round(h*.16))))
    elif isinstance(foot,dict):obstacles.append(foot)
    prop_obstacles[p['id']]=obstacles[ob_start:]
    return p
put('Golden egg mine hall','detail/egg-mine.svg',4050,1670,960,dict(poly=[[3630,1400],[4470,1400],[4470,1585],[3630,1585]]),pid='egg-mine')
# Placeholder stays intentionally small; the real centre is a later choice.
(ART/'detail/centre-placeholder.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="100" viewBox="0 0 180 100"><ellipse cx="90" cy="72" rx="84" ry="24" fill="#C99B53" stroke="#39472D" stroke-width="2.6"/><path d="M6 52V72Q90 106 174 72V52" fill="#D9B578" stroke="#39472D" stroke-width="2.6"/><ellipse cx="90" cy="52" rx="84" ry="24" fill="#F5E3BC" stroke="#39472D" stroke-width="2.6"/><path d="M62 52L72 29L101 23L121 42L113 60L79 65Z" fill="#F6C53F" stroke="#39472D" stroke-width="2.6"/><path d="M72 29L79 47L62 52M79 47L101 23M79 47L113 60" fill="none" stroke="#FFF0C7" stroke-width="3"/></svg>')
put('Temporary nugget plinth','detail/centre-placeholder.svg',4100,2910,100,dict(x=4100,y=2898,rx=80,ry=27),pid='centre-placeholder')

trees=[(1080,1920),(1550,1270),(2470,1130),(3200,1060),(4780,1120),(5550,1260),(6440,1390),(6940,1990),(6870,2410),(6850,3040),(6890,3450),(6490,3900),(5790,4330),(5020,4440),(4610,4550),(3410,4460),(2610,4460),(1540,3940),(1100,3510),(1030,2980),(1360,2800),(2670,2990),(2790,3470),(3100,1640),(4910,2170),(5230,3130),(5510,3750),(4970,3710),(3230,3990),(2960,2740),(1520,2230),(2300,1450),(6620,2340),(1920,5140),(5930,5180),(2040,4620),(5900,4180),(1430,3640),(2910,1250),(5360,1910),(4720,1850),(1470,4000)]
trees += [(1780,1200),(2670,1160),(3450,1130),(5040,1160),(5880,1340),(6600,1640),(1010,2370),(1220,2040),(2950,3600),(2910,4010),(5200,3970),(5630,4270),(4790,4430),(1690,4190),(2360,4510),(6690,3290),(5640,1730),(2380,2680),(3060,2850),(5280,2510)]
for i,(x,y) in enumerate(trees):
    if reserved.buffer(70).contains(Point(x,y)) or path_geom.buffer(90).contains(Point(x,y)) or pond_poly.buffer(120).contains(Point(x,y)):continue
    k=1+i%5; h=[455,455,480,355,480][k-1]
    put('Tree',f'reuse/tree-{k}.svg',x,y,h,'tree',pid=f'gold-tree-{i}',flip=i%3==0)
ore=[(1600,1470),(2870,1160),(3450,1480),(4690,1530),(4960,1330),(5520,1400),(6730,1860),(6680,2950),(5410,3640),(5800,4010),(4820,4210),(3350,4280),(2720,4500),(1450,3750),(1040,2790),(2510,3430),(1800,5210),(5570,5270)]
for i,(x,y) in enumerate(ore):
    if reserved.contains(Point(x,y)):continue
    put('Gold ore rocks','detail/ore-rock.svg',x,y,160+i%3*18,flip=i%2==0)
for i,(x,y) in enumerate([(3520,1830),(4620,1800),(5160,1700),(2810,1850),(6640,2640),(2680,3660),(1340,3890),(5260,4020)]):
    put('Mine cart','detail/mine-cart.svg',x,y,170,flip=i%2==0)
for x,y in [(1580,3660),(2270,3660),(2620,2770)]:put('Gold panning sluice','detail/sluice.svg',x,y,170)
for x,y in [(3400,1710),(4780,1660),(2460,1500)]:
    put('Timber support','detail/timber-support.svg',x,y,285,foot=None)
    obstacles.extend([dict(x=x-180,y=y-12,rx=35,ry=30),dict(x=x+180,y=y-12,rx=35,ry=30)])
for i,(x,y) in enumerate([(3530,2480),(4840,2420),(3160,3160),(5080,3180),(3570,3580),(4630,3590),(1230,2430),(2810,2570),(1270,3420),(2790,3970),(6340,2800),(6650,3700),(3680,1780),(4380,1780),(3100,4370),(5350,3900)]):put('Timber lantern','detail/lantern.svg',x,y,220)
for i,(x,y) in enumerate([(3550,2340),(4520,2310),(3300,3310),(4880,3290),(1720,2370),(2270,2380),(5550,2690),(6380,2680),(3600,3810),(4510,3820),(1520,3900),(2450,3900)]):
    put('Wood bench','reuse/street--bench-wood.svg',x,y,84)
for x,y in [(5700,3030),(6180,3030)]:put('Nugget market stall','reuse/buildings--stall-fruit.svg',x,y,290)
for x,y in [(1800,3830),(2880,1910)]:put('Supply stall','reuse/buildings--stall-bread.svg',x,y,285)
for x,y in [(3580,3910),(4550,3910)]:put('Picnic table','reuse/street--picnic-table.svg',x,y,160)
for x,y in [(6340,3740),(6570,3640)]:put('Beach umbrella','reuse/street--umbrella-garden.svg',x,y,260)
put('Sandcastle','reuse/beach--sandcastle-small.svg',6500,3750,105)
# Clustered planting beside furniture, leaving the activity interiors empty.
for i,(x,y) in enumerate([(1200,1820),(1660,1210),(2560,1130),(3260,1120),(4830,1180),(5500,1270),(6490,1510),(6800,2120),(6780,3030),(6780,3410),(5690,4400),(5130,4360),(4640,4460),(2650,4360),(1430,3800),(1090,3100),(2850,3430),(3140,1560),(4810,2100),(5250,3730),(3160,3890),(1540,2290),(6520,2520),(1840,5170),(6040,5230)]):
    if reserved.buffer(40).contains(Point(x,y)) or path_geom.buffer(40).contains(Point(x,y)) or pond_poly.buffer(60).contains(Point(x,y)):continue
    put('Bush',f'reuse/bush-{1+i%3}.svg',x,y,105,foot='small')
    put('Flowers',f'reuse/flower-{1+i%2}.svg',x+80,y+35,45,foot=None)

# Home-quality planting, mining village and approved centre. This file only writes goldmine.
exec((ROOT/'scripts/themes/goldmine-enrich.py').read_text())

# Ground: home-style flat ochre, cream paths, restrained green patches, pale shallows.
INK='#39472D'; CREAM='#F5E3BC'; SEA='#8FCAC7'
ld=shp(all_land); gd=shp(green)
g=[f'<defs><clipPath id="land"><path d="{ld}"/></clipPath><clipPath id="grass"><path d="{gd}"/></clipPath></defs>']
g+=[f'<path d="{ld}" fill="none" stroke="#B9E0D6" stroke-width="175" opacity=".7"/>',f'<path d="{ld}" fill="#F5E3BC" stroke="{INK}" stroke-width="2.6"/>',f'<path d="{gd}" fill="#D9B578" stroke="#B98F53" stroke-width="10"/>']
for x,y,rx,ry in islets:g.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx-65}" ry="{ry-55}" fill="#D9B578" stroke="#B98F53" stroke-width="4"/>')
for i in range(100):
    x,y=rnd.uniform(900,7100),rnd.uniform(900,4700)
    if not green.contains(Point(x,y)) or reserved.buffer(70).contains(Point(x,y)) or path_geom.buffer(100).contains(Point(x,y)):continue
    rx,ry=rnd.uniform(100,250),rnd.uniform(45,100)
    d=bez(ell(x,y,rx,ry,12),True)
    g.append(f'<path d="{d}" fill="{"#CFA669" if i%3 else "#E3C58D"}" clip-path="url(#grass)"/>')
for p in props:
    if p['name']=='Tree':g.append(f'<ellipse cx="{p["x"]}" cy="{p["y"]-15}" rx="185" ry="100" fill="#B3C579" clip-path="url(#land)"/>')
for pad,col in [(18,'#B98F53'),(12,INK),(8,'#E5C98F'),(0,CREAM)]:
    for p,w in paths:g.append(f'<path d="{bez(p[::3]+[p[-1]])}" fill="none" stroke="{col}" stroke-width="{w+pad}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#land)"/>')
# A simple visible rail spur in the mine forecourt, entirely walkable.
for x in [3985,4115]:g.append(f'<path d="M{x} 1630L{x+90} 2020" stroke="#39472D" stroke-width="12"/><path d="M{x-2} 1630L{x+88} 2020" stroke="#D0CEC0" stroke-width="5"/>')
for t in range(0,390,35):g.append(f'<path d="M{3960+t*.23} {1640+t}h180" stroke="#936538" stroke-width="10"/>')
for i,a in enumerate(activities):
    g.append(f'<ellipse cx="{a["x"]}" cy="{a["y"]}" rx="{a["rx"]}" ry="{a["ry"]}" fill="#B8CA85" stroke="#9CA966" stroke-width="8"/>')
    g.append(f'<ellipse cx="{a["x"]}" cy="{a["y"]}" rx="{a["rx"]-20}" ry="{a["ry"]-20}" fill="none" stroke="#F5E3BC" stroke-width="3" opacity=".65"/>')
def paved(poly,key):
    d=shp(poly); x0,y0,x1,y1=poly.bounds
    out=[f'<clipPath id="{key}"><path d="{d}"/></clipPath><path d="{d}" fill="#F5E3BC" stroke="#B98F53" stroke-width="18"/><path d="{d}" fill="none" stroke="{INK}" stroke-width="2.6"/>',f'<g clip-path="url(#{key})" stroke="#DDC395" stroke-width="3" fill="none">']
    for j,y in enumerate(range(int(y0),int(y1)+130,125)):
        out.append(f'<path d="M{x0} {y}H{x1}"/>')
        for x in range(int(x0)-(90 if j%2 else 0),int(x1),180):out.append(f'<path d="M{x} {y}v125"/>')
    return ''.join(out)+ '</g>'
for i,r in enumerate(rows):g.append(paved(box(r['x0'],r['y0'],r['x1'],r['y1']).buffer(30),f'row{i}'))
g.append(paved(centre,'plaza'))
g.append(f'<ellipse cx="4100" cy="2910" rx="895" ry="645" fill="none" stroke="#D9B578" stroke-width="12"/><ellipse cx="4100" cy="2910" rx="260" ry="190" fill="#F5E3BC" stroke="#D9B578" stroke-width="5"/>')
g.append(f'<path d="{shp(pond_poly)}" fill="#80BEBB" stroke="#B98F53" stroke-width="30"/><path d="{shp(pond_poly)}" fill="none" stroke="#F5E3BC" stroke-width="8"/>')
for x,y in [(1630,3020),(1910,2920),(2160,3050),(2180,3340),(1700,3410)]:g.append(f'<path d="M{x-30} {y}q30 12 60 0" fill="none" stroke="#F5E3BC" stroke-width="4"/>')
# Tiny home-scale pebbles and tufts, never filling a plaza.
for i in range(500):
    x,y=rnd.uniform(750,7300),rnd.uniform(800,4800)
    if not green.contains(Point(x,y)) or reserved.buffer(40).contains(Point(x,y)) or pond_poly.buffer(50).contains(Point(x,y)) or path_geom.contains(Point(x,y)):continue
    g.append(f'<path d="M{x:.0f} {y:.0f}l4 -7m2 8l5 -5" fill="none" stroke="#A88752" stroke-width="2.3" opacity=".65"/>')
exec((ROOT/'scripts/themes/goldmine-ground.py').read_text())
body='\n'.join(g)
def svg(vb,w,h):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{body}</svg>'
(ART/'ground.svg').write_text(svg('0 0 8000 6000',8000,6000))
tiles=[]
for r in range(4):
    for c in range(5):
        name=f'ground-r{r}-c{c}.svg'; x,y=c*1600,r*1500
        (ART/name).write_text(svg(f'{x} {y} 1600 1500',1600,1500));tiles.append(dict(src=name,x=x,y=y,width=1600,height=1500))

# DECK_HELPERS inserted below from the already approved sunflower builder.

def deck_svg(name, a, b, w, rails):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    hw = w / 2
    corner = lambda t, s: (a[0] + ux*t + nx*s, a[1] + uy*t + ny*s)
    body = [corner(0, -hw), corner(L, -hw), corner(L, hw), corner(0, hw)]
    side = 16   # the deck's visible thickness, dropped straight down (3/4 view)
    xs = [p[0] for p in body]; ys = [p[1] for p in body]
    pad = 40; x0, y0, x1, y1 = min(xs)-pad, min(ys)-pad, max(xs)+pad, max(ys)+pad+side+30
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" stroke-linejoin="round" stroke-linecap="round">',
         f'<title>Nuggetnook {name}</title>']
    sh = [(p[0]+14, p[1]+side+22) for p in body]
    s.append(f'<path d="{polyd(sh)}" fill="#2E7F93" fill-opacity=".28"/>')
    low = [(p[0], p[1]+side) for p in body]
    s.append(f'<path d="{polyd(low)}" fill="#8B5A2E" stroke="#39472D" stroke-width="3"/>')
    # posts under the deck
    for t in np.arange(30, L, 150):
        for sgn in (-1, 1):
            px, py = corner(t, sgn*(hw-8))
            s.append(f'<rect x="{px-7:.1f}" y="{py:.1f}" width="14" height="{side+34}" rx="3" fill="#7A4E28" stroke="#39472D" stroke-width="2.5"/>')
            s.append(f'<ellipse cx="{px:.1f}" cy="{py+side+34:.1f}" rx="14" ry="5" fill="none" stroke="#FFF0C7" stroke-width="2.5" stroke-opacity=".8"/>')
    s.append(f'<path d="{polyd(body)}" fill="#C8893F" stroke="#39472D" stroke-width="3.2"/>')
    # planks across the deck
    for t in np.arange(26, L, 26):
        p, q = corner(t, -hw+4), corner(t, hw-4)
        s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#39472D" stroke-width="1.6" stroke-opacity=".55"/>')
    # a lit edge and a few grain ticks
    p, q = corner(4, -hw+6), corner(L-4, -hw+6)
    s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#E9B46A" stroke-width="5" stroke-opacity=".8"/>')
    for i, t in enumerate(np.arange(40, L, 95)):
        p = corner(t + 8, (i % 3 - 1) * hw * .45); q = (p[0] + nx*14, p[1] + ny*14)
        s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#8B5A2E" stroke-width="2"/>')
    if rails:
        for sgn in (-1, 1):
            tops = []
            for t in np.linspace(20, L-20, max(2, int(L // 110) + 1)):
                px, py = corner(t, sgn*(hw-6)); tops.append((px, py-34))
                s.append(f'<rect x="{px-6:.1f}" y="{py-36:.1f}" width="12" height="38" rx="3" fill="#B97A3A" stroke="#39472D" stroke-width="2.5"/>')
            s.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in tops)}" fill="none" stroke="#39472D" stroke-width="10"/>')
            s.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in tops)}" fill="none" stroke="#C8893F" stroke-width="5"/>')
    else:   # jetties: two mooring bollards at the tip
        for sgn in (-1, 1):
            px, py = corner(L-14, sgn*(hw-10))
            s.append(f'<rect x="{px-9:.1f}" y="{py-30:.1f}" width="18" height="32" rx="6" fill="#7A4E28" stroke="#39472D" stroke-width="2.5"/><ellipse cx="{px:.1f}" cy="{py-30:.1f}" rx="9" ry="4" fill="#B97A3A" stroke="#39472D" stroke-width="2"/>')
    s.append('</svg>')
    open(f'{ART}/{name}.svg', 'w').write('\n'.join(s))
    return dict(src=f'{name}.svg', x=round(x0, 1), y=round(y0, 1), width=round(x1-x0, 1), height=round(y1-y0, 1))
ARCH_RISE = 64   # islet bridges hump like home's footbridges (home R = 70); listed in world.json `arches` for the engine's deckY
def arch_svg(name, a, b, w, R=ARCH_RISE):
    """a humped footbridge in home's look: planked deck rising R at mid-span, side boards, railings on posts, stone footings"""
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    hw = w / 2; lift = lambda t: R * 4 * (t/L) * (1 - t/L)
    P = lambda t, sd, extra=0: (a[0] + ux*t + nx*sd, a[1] + uy*t + ny*sd - lift(t) - extra)
    ts = np.linspace(0, L, 28)
    vis = 1 if ny > 0 else -1          # the deck edge nearer the camera (lower on screen) shows its side boards
    left = [P(t, -hw) for t in ts]; right = [P(t, hw) for t in ts]
    deck = left + right[::-1]
    side = 20
    near = [P(t, vis*hw) for t in ts]; band = near + [(x, y + side) for x, y in near[::-1]]
    pts = deck + [(x, y + side + 40) for x, y in near]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    pad = 50; x0, y0, x1, y1 = min(xs)-pad, min(ys)-pad-50, max(xs)+pad, max(ys)+pad+40
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" stroke-linejoin="round" stroke-linecap="round">',
         f'<title>Nuggetnook {name}, humped footbridge</title>']
    flat = [(a[0] + ux*t + nx*sd + 16, a[1] + uy*t + ny*sd + 34) for t, sd in [(0, -hw), (L, -hw), (L, hw), (0, hw)]]
    o.append(f'<path d="{polyd(flat)}" fill="#2E7F93" fill-opacity=".26"/>')   # shadow on the water
    # the open arch under the span: the side boards hang over a dark gap down to the waterline
    under = [(x, y + side) for x, y in near] + [(a[0] + ux*t + nx*vis*hw, a[1] + uy*t + ny*vis*hw + side + 8) for t in ts[::-1]]
    o.append(f'<path d="{polyd(under)}" fill="#3F8FA0" fill-opacity=".55"/>')
    o.append(f'<path d="{polyd(band)}" fill="#8B5A2E" stroke="#39472D" stroke-width="3"/>')
    o.append(f'<path d="{polyd(deck)}" fill="#C8893F" stroke="#39472D" stroke-width="3"/>')
    for t in np.arange(22, L - 10, 22):
        p, q = P(t, -hw + 4), P(t, hw - 4)
        o.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#39472D" stroke-width="1.5" stroke-opacity=".5"/>')
    lit = [P(t, -vis*(hw - 7)) for t in ts]
    o.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in lit)}" fill="none" stroke="#E9B46A" stroke-width="5" stroke-opacity=".8"/>')
    for t in (6, L - 6):   # cream stone footings where the arch meets land
        for sd in (-hw, hw):
            x, y = P(t, sd); o.append(f'<ellipse cx="{x:.1f}" cy="{y + side + 4:.1f}" rx="16" ry="9" fill="#FFF0C7" stroke="#39472D" stroke-width="2.4"/>')
    for sgn in (-1, 1):   # railings: posts, then a rail that follows the hump
        posts = np.linspace(14, L - 14, max(3, int(L // 70) + 1)); tops = []
        for t in posts:
            x, y = P(t, sgn*(hw - 6)); tops.append((x, y - 36))
            o.append(f'<rect x="{x-6:.1f}" y="{y-38:.1f}" width="12" height="40" rx="3" fill="#B97A3A" stroke="#39472D" stroke-width="2.4"/>')
        rail = [P(t, sgn*(hw - 6), 36) for t in np.linspace(14, L - 14, 24)]
        d = 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in rail)
        o.append(f'<path d="{d}" fill="none" stroke="#39472D" stroke-width="10"/><path d="{d}" fill="none" stroke="#C8893F" stroke-width="5"/>')
        for x, y in tops: o.append(f'<rect x="{x-8:.1f}" y="{y-6:.1f}" width="16" height="8" rx="3" fill="#7A4E28" stroke="#39472D" stroke-width="2"/>')
    o.append('</svg>')
    open(f'{ART}/{name}.svg', 'w').write('\n'.join(o))
    return dict(src=f'{name}.svg', x=round(x0, 1), y=round(y0, 1), width=round(x1-x0, 1), height=round(y1-y0, 1))
# The main south harbor is drawn by the engine. Other piers and all bridges are theme art.
deck_entries=[arch_svg(k,a,b,w,70) if k.startswith('bridge') else deck_svg(k,a,b,w,False) for k,(a,b,w) in decks.items() if k!='jetty-s']
preview_harbor=deck_svg('harbor-preview',*decks['jetty-s'],False)
walkways=[dict(a=a,b=b,w=w) for a,b,w in decks.values()]
arches=[dict(a=a,b=b,w=w,r=70) for k,(a,b,w) in decks.items() if k.startswith('bridge')]
zones={'plaza':dict(**plaza,name='Nugget circle',spawn=[4100,3280]),'centre':dict(**plaza,name='Golden egg mine yard',placeholder=False,spawn=[4100,3280]),'mine':dict(x=4100,y=2910,spawn=[4100,3060]),'pond':dict(x=1900,y=3180,spawn=[1900,3760]),'beach':dict(x=6500,y=3790,spawn=[6500,3790]),'harbor':dict(x=3090,y=4530,spawn=[3090,4580])}
for a in activities:zones[a['id']]={k:v for k,v in a.items() if k!='id'}|dict(kind='open-activity',spawn=[a['x'],a['y']])
for r in rows:
    x,y=(r['x0']+r['x1'])/2,(r['y0']+r['y1'])/2
    zones[r['id']]={k:v for k,v in r.items() if k!='id'}|dict(x=x,y=y,kind='reserved-stall-row',spawn=[x,y],slots=[[r['x0']+150+i*300,r['y0']+110] for i in range(int((r['x1']-r['x0'])/300))])
for i,isl in enumerate(islets):zones[f'islet-{i+1}']=dict(x=isl[0],y=isl[1],spawn=[isl[0],isl[1]+100])
# Boats are beside piers, never on the land or under the timber decks.
boats=[dict(x=2930,y=5020,turn=0),dict(x=3250,y=5260,turn=0),dict(x=2930,y=5380,turn=0),dict(x=520,y=2420,turn=-math.pi/2),dict(x=520,y=2740,turn=-math.pi/2),dict(x=7510,y=2610,turn=math.pi/2),dict(x=7510,y=2930,turn=math.pi/2),dict(x=6900,y=4370,turn=2.3),dict(x=7260,y=4270,turn=2.3),dict(x=6370,y=5230,turn=math.pi/2)]
# An engine berth need not be on the coast if it is within stepping distance of a pier.
harbor=dict(jetty=dict(foot=decks['jetty-s'][0],tip=decks['jetty-s'][1],width=128),boats=boats,spawn=[4100,3280])
water=[pond]
world=dict(width=WIDTH,height=HEIGHT,coast=coast,islets=islets,water=water,walkways=walkways,bridges=[dict(x=1900,y=3180,w=1280,h=190)],arches=arches,obstacles=obstacles,zones=zones,paths=[[[round(x,1),round(y,1)] for x,y in p] for p,w in paths],pathWidths=[w for p,w in paths],props=props,sleepSpots={},sleepAvoid=[dict(**plaza,name='centre plaza')]+[{k:a[k] for k in ['x','y','rx','ry']} for a in activities]+[dict(x=(r['x0']+r['x1'])/2,y=(r['y0']+r['y1'])/2,rx=(r['x1']-r['x0'])/2+40,ry=(r['y1']-r['y0'])/2+40,name=r['id']) for r in rows],ambient=dict(birds=[[1950,1800],[5800,2500],[4100,4200]],butterflies=[[1930,1900],[6020,2180],[4050,4230]]))
world['railPaths']=[[[round(x,1),round(y,1)] for x,y in route.coords] for route in rail_tracks]
world['centrePlacement']=dict(origin=[4100,2910],scale=.82,landmarkScale=1.34,landmarkOffsetY=556,access=[dict(name='mine threshold',point=[4100,3060])])
# Walking is inset from the drawn sand by 35, with full solid prop footprints.
walk={k:world[k] for k in ['width','height','islets','water','walkways','bridges','arches','obstacles','paths','zones']};walk['coast']=rounded(land.buffer(-35))
art=dict(previewHarbor=preview_harbor,width=WIDTH,height=HEIGHT,sea=SEA,ground=dict(tiles=tiles),decks=deck_entries,flats=extra_flats,props=props,floating=floating)
for path,value in [(DATA/'world.json',world),(DATA/'walk-world.json',walk),(DATA/'harbor.json',harbor),(ART/'art.json',art)]:path.write_text(json.dumps(value,separators=(',',':'))+'\n')
metrics=dict(coastArea=round(land.area),isletArea=round(all_land.area-land.area),totalLandArea=round(all_land.area),homeBaseline=11090000,coastRatio=round(land.area/11090000,3),totalLandRatio=round(all_land.area/11090000,3),map=[WIDTH,HEIGHT],pathWidths=sorted(set(w for p,w in paths)),props=len(props),trees=sum(p['name']=='Tree' for p in props),zones=list(zones),jetties=4,arches=len(arches),generatedAssets=6)
(ART/'build-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
print(json.dumps(metrics,indent=2))
