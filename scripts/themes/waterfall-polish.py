"""Reproducible detail pass. Existing Home art, original reserved geometry and all 40 beds."""
import json, math, random, re, shutil
from pathlib import Path
from shapely.geometry import Point, Polygon, LineString, box
from shapely.ops import unary_union
from shapely import affinity
R=Path(__file__).resolve().parents[2]; A=R/'public/pixi-art/themes/waterfall'; D=R/'rive/web/themes/waterfall'
r=random.Random(5253)
read=lambda f:json.loads((A/f).read_text())
a=read('waterfall-base-art.json'); w=read('waterfall-base-world.json'); walk=read('waterfall-base-walk.json'); beds=read('waterfall-sleepers.json')
land=Polygon(w['coast']); grass=land.buffer(-108); lake=Polygon(w['water'][0]['poly'])
def ellipse(z,pad=0):return Polygon([(z['x']+(z['rx']+pad)*math.cos(i*math.tau/100),z['y']+(z['ry']+pad)*math.sin(i*math.tau/100)) for i in range(100)])
reserved=unary_union([ellipse(z,20) for z in w['zones'].values()])
paths=unary_union([LineString(p).buffer(166) for p in w['paths']]); decks=unary_union([LineString([q['a'],q['b']]).buffer(q['w']/2+45) for q in w['walkways']]); cliff=box(3030,1070,4770,2240)
# Smooth stream connects the lagoon to the northeast coast without entering reserved fields.
control=[(4880,2290),(5120,2260),(5140,1940),(5400,1750),(5940,1730),(6490,1800),(7200,1870)]
riverpoints=[]
for i in range(len(control)-1):
 p0=control[max(0,i-1)];p1=control[i];p2=control[i+1];p3=control[min(len(control)-1,i+2)]
 for j in range(20):
  t=j/20;riverpoints.append(tuple(.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(2)))
riverpoints.append(control[-1]);riverline=LineString(riverpoints);river=riverline.buffer(92)
w['water'].append({'x':5960,'y':1730,'rx':990,'ry':100,'poly':list(river.exterior.coords)[:-1]})
no=unary_union([reserved,paths,decks,lake.buffer(36),river.buffer(65),cliff])
# Move the old shore furniture only when the new stream occupies its footprint.
a['props']=[p for p in a['props'] if not river.buffer(60).contains(Point(p['x'],p['y']))]
w['obstacles']=[o for o in w['obstacles'] if 'poly' in o or not river.buffer(60).contains(Point(o['x'],o['y']))]

# The centre is entirely reserved. Remove the old temporary cairn and its footprint.
a['props']=[p for p in a['props'] if p['name']!='Centre placeholder cairn']
w['obstacles']=[o for o in w['obstacles'] if not(o.get('x')==3900 and o.get('y')==3758)]
# Silhouettes may grow behind sleepers but cannot cover them, and bases keep the resolver's real radius.
def sleep_clear(x,y,ww,hh):
 for b in beds:
  if math.hypot(x-b['x'],(y-b['y'])*1.6)<ww*.4+b['r']+18:return False
  if y>b['y']-20 and y-b['y']<hh*.9 and abs(x-b['x'])<ww/2+b['r']*.6:return False
 return True
count={}; cache={}
def source(file):
 if file not in cache:
  src=R/'public/pixi-art'/file; dst=A/'reuse'/Path(file).name; shutil.copyfile(src,dst)
  s=src.read_text(); v=list(map(float,re.search(r'viewBox="([^"]+)"',s)[1].split()));cache[file]=('reuse/'+dst.name,v[3]/v[2])
 return cache[file]
def put(file,x,y,ww,name,solid=True,spacing=55,shore=False):
 src,ratio=source(file);hh=ww*ratio;pt=Point(x,y)
 if not (land.buffer(-25) if shore else grass).contains(pt) or no.contains(pt):return None
 if reserved.intersects(box(x-ww*.43,y-hh*.32,x+ww*.43,y+12)):return None
 if not sleep_clear(x,y,ww,hh):return None
 if any(math.hypot(x-p['x'],(y-p['y'])*1.3)<spacing for p in a['props'] if p['width']>90 or ww<100):return None
 p=dict(id=f'waterfall-polish-{len(a["props"])}',name=name,src=src,x=round(x,2),y=round(y,2),width=round(ww,2),height=round(hh,2),anchor={'x':.5,'y':1},scale=1,flip=r.random()<.5)
 a['props'].append(p);count[name]=count.get(name,0)+1
 if solid:w['obstacles'].append(dict(x=p['x'],y=p['y']-10,rx=min(ww*.22,70),ry=22 if 'tree' in name.lower() else min(26,hh*.17)))
 return p
# Grove centres are deliberately irregular, with openings to each activity field.
groves=[(2640,1200),(2880,1010),(4800,1120),(5300,1350),(5840,1570),(1740,1820),(2410,2040),(2770,2610),(5470,2150),(5470,2800),(990,2260),(800,3100),(7000,3120),(6980,2450),(1500,3150),(2310,3130),(5680,3120),(6340,3170),(2700,3630),(4900,3660),(1620,3920),(2340,4340),(3150,4390),(4660,4430),(5570,4380),(6230,3980)]
for cx,cy in groves:
 for j in range(38):
  x=cx+r.gauss(0,210);y=cy+r.gauss(0,140)
  kind=r.choice([1,2,3,4,5]);ww={1:370,2:210,3:390,4:300,5:200}[kind]*r.uniform(.88,1.1)
  p=put(f'plants/tree-{kind}.svg',x,y,ww,'Grove tree',spacing=175)
  if p and sum(math.hypot(q['x']-cx,q['y']-cy)<330 for q in a['props'] if 'tree' in q['name'].lower())>=4:break
# Home-size trees. Fill the remaining woodland pockets, preserve all sleeping silhouettes.
for i in range(9500):
 if sum('tree' in p['name'].lower() for p in a['props'])>=78:break
 x=r.uniform(700,7100);y=r.uniform(1030,4690)
 kind=r.choice([1,1,3,4,2,5]);ww={1:370,2:210,3:380,4:310,5:205}[kind]*r.uniform(.93,1.1)
 put(f'plants/tree-{kind}.svg',x,y,ww,'Canopy tree',spacing=150)
# Understory grows in different-sized pockets rather than single identical plants.
for tree in list(a['props']):
 if 'tree' not in tree['name'].lower():continue
 for j in range(4):
  theta=r.uniform(0,math.tau);dist=r.uniform(90,205)
  put(f'plants/bush-{r.randint(1,6)}.svg',tree['x']+math.cos(theta)*dist,tree['y']+math.sin(theta)*dist*.55,r.uniform(110,170),'Grove bush',spacing=75)
for i in range(2300):
 x=r.uniform(650,7150);y=r.uniform(980,4740)
 nearby=any(math.hypot(x-p['x'],y-p['y'])<210 for p in a['props'] if 'tree' in p['name'].lower() or 'bush' in p['name'].lower())
 if nearby:
  put(f'plants/flower-{r.randint(1,3)}.svg',x,y,r.uniform(55,82),'Wildflowers',False,spacing=45)
 elif i%6==0:put(f'plants/bush-{r.randint(1,6)}.svg',x,y,r.uniform(120,165),'Meadow bush',spacing=110)
# Banks alternate reed beds, smooth rocks, ferns and shells.
for i in range(190):
 q=land.buffer(-r.uniform(28,100)).exterior.interpolate(i/190,normalized=True);x,y=q.x,q.y
 file,name,ww=r.choice([('nature--reeds','Shore reeds',100),('nature--rock-flat','Shore rock',95),('beach--shell-scallop','Shore shell',40),('beach--shell-conch','Shore shell',48),('nature--rock-round','Shore rock',75)])
 put('detail/'+file+'.svg',x,y,ww,name,'rock' in name,spacing=70,shore=True)
for i in range(55):
 t=i/55*math.tau;x=3900+1225*math.cos(t);y=2430+690*math.sin(t)
 file,name,ww=r.choice([('nature--reeds','Lagoon reeds',125),('nature--cattails','Lagoon cattails',115),('nature--rock-flat','Lagoon rock',145)])
 put('detail/'+file+'.svg',x,y,ww,name,spacing=90)
# Purposeful furniture beside paths, facing the lagoon or groves. Never inside zones.
for x,y in [(2470,1870),(5420,1900),(2580,2910),(5200,2900),(1500,3850),(6200,3850),(3020,4200),(4770,4200),(1010,2080),(6820,2100),(3350,3270),(4550,3280)]:
 put('detail/street--bench-wood.svg',x,y,165,'Garden bench',spacing=85)
for line in w['paths']:
 for i in range(4,len(line)-1,12):
  x,y=line[i];x0,y0=line[i-1];x1,y1=line[i+1];dx=x1-x0;dy=y1-y0;L=math.hypot(dx,dy);sgn=-1 if i%24 else 1
  put('detail/street--lamp-lantern.svg',x-dy/L*215*sgn,y+dx/L*215*sgn,49,'Path lantern',spacing=110)
for x,y in [(1400,2130),(5760,2080),(2480,3830),(5560,3840),(2830,1270),(4920,1330)]:
 put('detail/street--signpost-three-way.svg',x,y,105,'Trail sign',spacing=90)
for x,y in [(1860,2040),(5700,1990),(5570,4120),(2180,4180),(2910,3360),(4820,3350)]:
 put('detail/street--fence-rail.svg',x,y,230,'Lookout fence',spacing=80)
for i in range(150):
 tree=r.choice([p for p in a['props'] if 'tree' in p['name'].lower()]);x=tree['x']+r.uniform(-170,170);y=tree['y']+r.uniform(-70,140)
 file,name,ww=r.choice([('nature--mushroom-cluster','Grove mushrooms',66),('nature--log','Mossy log',130),('nature--stump','Woodland stump',85)])
 put('detail/'+file+'.svg',x,y,ww,name,spacing=95)
# Floating plants gather at the lagoon's edges, retaining open swimming water.
a['floating']=[]
for i in range(24):
 t=r.uniform(.15,math.pi-.15);x=3900+r.uniform(940,1040)*math.cos(t);y=2430+r.uniform(470,540)*math.sin(t)
 if x>4830:continue
 src,rat=source('detail/nature--lily-pad-flower.svg' if i%4==0 else 'detail/nature--lily-pad-large.svg');ww=r.uniform(60,100)
 a['floating'].append(dict(src=src,x=x,y=y,width=ww,height=ww*rat,anchor={'x':.5,'y':.5},phase=i*1.7))
w['ambient']={'birds':[[2500,1920],[5300,2000],[3020,3150],[4830,3210],[2000,4150],[5850,4140]],'butterflies':[[2420,2130],[5570,3050]]}
# Extra ferns and moss rocks anchor the waterfall to the landscape, outside the cliff footprint.
for cx,cy in [(2910,1570),(2820,1940),(4890,1490),(5100,1250),(4690,1050),(3160,1020)]:
 for j in range(18):
  x=cx+r.uniform(-170,170);y=cy+r.uniform(-140,160)
  if j%3:put('plants/bush-3.svg',x,y,r.uniform(120,180),'Cliff fern bush',spacing=65)
  else:put('detail/nature--rock-boulder.svg',x,y,r.uniform(180,250),'Mossy cliff boulder',spacing=100)
# A low planted rim frames each activity lawn and empty stall row. Gaps align with walk-in access.
for key,z in w['zones'].items():
 if not key.startswith(('activity','stalls')):continue
 for i in range(40):
  t=i*math.tau/40
  if abs(math.sin(t))<.18:continue
  x=z['x']+(z['rx']+75)*math.cos(t);y=z['y']+(z['ry']+65)*math.sin(t)
  put(f'plants/flower-{i%3+1}.svg',x,y,70,'Lawn flower border',False,spacing=40)
 for t in [math.pi*.28,math.pi*.72,math.pi*1.28,math.pi*1.72]:
  x=z['x']+(z['rx']+120)*math.cos(t);y=z['y']+(z['ry']+125)*math.sin(t)
  put('detail/street--bench-wood.svg',x,y,185,'Lawn bench',spacing=60)
  put('detail/street--lamp-lantern.svg',x+90,y-20,62,'Lawn lantern',spacing=45)
# A curated picnic or beach pocket wherever two neighbouring objects fit together.
for cx,cy in [(2040,2190),(5840,3170),(1760,4140),(5580,4310),(2580,1090),(6620,3210),(1310,3090),(4660,4580)]:
 for file,dx,dy,ww,name in [('street--picnic-blanket',0,0,215,'Picnic blanket'),('street--picnic-basket',90,-40,70,'Picnic basket'),('street--umbrella-garden',-135,-40,220,'Picnic umbrella')]:
  put('detail/'+file+'.svg',cx+dx,cy+dy,ww,name,False,spacing=40)
# Beaches have wider sand coves and real home umbrellas and towels.
for cx,cy in [(1090,3270),(6720,3300),(2410,4370),(5330,4330)]:
 put('detail/street--umbrella-cafe.svg',cx,cy,240,'Beach umbrella',False,spacing=50)
 put('detail/beach--towel-striped.svg',cx+140,cy+65,160,'Beach towel',False,spacing=45)
# Border furniture on the central meeting plaza, leaving its broad interior walkable.
for i,t in enumerate([.2,.8,1.3,1.85,2.4,2.95,3.6,4.2,4.85,5.45]):
 x=3900+795*math.cos(t);y=3800+615*math.sin(t)
 put('detail/street--lamp-lantern.svg',x,y,65,'Plaza lantern',spacing=40)
# Hand-placed furniture follows the plaza rim, rather than random scatter.
def direct(file,x,y,ww,name,solid=True):
 src,ratio=source(file);hh=ww*ratio
 if not sleep_clear(x,y,ww,hh):return
 a['props'].append(dict(id=f'waterfall-composed-{len(a["props"])}',name=name,src=src,x=x,y=y,width=ww,height=ww*ratio,anchor={'x':.5,'y':1},scale=1))
 if solid:w['obstacles'].append(dict(x=x,y=y-8,rx=ww*.36,ry=22))
for x,y in [(3500,3380),(4300,3380),(3360,4090),(4440,4090)]:
 direct('detail/street--bench-wood.svg',x,y,220,'Plaza bench')
 direct('detail/street--lamp-lantern.svg',x-145,y+5,64,'Plaza lantern')
# Rounded stone shoulders extend the illustrated falls into the fern forest.
for x,y,ww in [(3050,1430,330),(2960,1600,300),(3070,1760,340),(4760,1410,350),(4830,1600,330)]:
 direct('detail/nature--rock-boulder.svg',x,y,ww,'Cliff ridge rock')
 direct('plants/bush-3.svg',x-70,y-15,150,'Ridge fern bush',False)
# Two wooden arched river bridges. Their visible decks and collision corridors share endpoints.
def bridge(a0,b0,ww,name):
 dx=b0[0]-a0[0];dy=b0[1]-a0[1];L=math.hypot(dx,dy);nx=-dy/L;ny=dx/L;arch=48
 def xy(t,side=0):return (a0[0]+dx*t+nx*ww*.5*side,a0[1]+dy*t+ny*ww*.5*side-arch*4*t*(1-t))
 pts=[xy(j/30,1) for j in range(31)]+[xy(j/30,-1) for j in range(30,-1,-1)]
 def points(q):return 'M '+' L '.join(f'{x:.1f},{y:.1f}' for x,y in q)
 body=f'<path d="{points(pts)} Z" fill="#D9A452" stroke="#39472D" stroke-width="5"/>'
 for j in range(17):
  body+=f'<path d="{points([xy(j/16,1),xy(j/16,-1)])}" fill="none" stroke="#885931" stroke-width="3"/>'
 for side in [-1,1]:
  rail=[]
  for j in range(9):
   x,y=xy(j/8,side);rail.append((x,y-58));body+=f'<path d="M{x} {y} v-62" stroke="#39472D" stroke-width="13"/><path d="M{x} {y-2} v-58" stroke="#C88941" stroke-width="8"/>'
  body+=f'<path d="{points(rail)}" fill="none" stroke="#39472D" stroke-width="12"/><path d="{points(rail)}" fill="none" stroke="#F4D180" stroke-width="7"/>'
 x0=min(x for x,y in pts)-15;y0=min(y for x,y in pts)-75;x1=max(x for x,y in pts)+15;y1=max(y for x,y in pts)+15
 src=name+'.svg';(A/src).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{x1-x0}" height="{y1-y0}" viewBox="{x0} {y0} {x1-x0} {y1-y0}">{body}</svg>')
 a['decks'].append(dict(src=src,x=x0,y=y0,width=x1-x0,height=y1-y0))
 w['walkways'].append(dict(a=a0,b=b0,w=ww));w['arches'].append(dict(a=a0,b=b0,w=ww,r=arch))
bridge([5030,2040],[5350,1880],180,'waterfall-river-bridge-1')
bridge([6600,1600],[6500,2070],220,'waterfall-river-bridge-2')
bridgeguards=unary_union([LineString([q['a'],q['b']]).buffer(q['w']/2+25) for q in w['walkways'][-2:]])
a['props']=[p for p in a['props'] if not bridgeguards.contains(Point(p['x'],p['y']))]
w['obstacles']=[o for o in w['obstacles'] if 'poly' in o or not bridgeguards.contains(Point(o['x'],o['y']))]
# Bake ground in the Home palette, using actual Home grass/flower/pebble drawings.
ink='#39472D';a['sea']='#6EC9DE';body=[]
for j in range(1600):
 x=r.uniform(0,7800);y=r.uniform(0,5800)
 if land.buffer(100).contains(Point(x,y)):continue
 body.append(f'<path d="M{x:.1f},{y:.1f} q14 -7 29 0 t29 0" fill="none" stroke="#C0E9E6" stroke-opacity=".3" stroke-width="1.5"/>')
def poly(g,fill,stroke='none',sw=3):
 if g.is_empty:return ''
 if g.geom_type=='MultiPolygon':return ''.join(poly(q,fill,stroke,sw) for q in g.geoms)
 if g.geom_type!='Polygon':return ''
 d='M '+' L '.join(f'{x:.1f},{y:.1f}' for x,y in g.exterior.coords)+' Z'
 for hole in g.interiors:d+=' M '+' L '.join(f'{x:.1f},{y:.1f}' for x,y in hole.coords)+' Z'
 return f'<path d="{d}" fill="{fill}" fill-rule="evenodd" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'
def el(x,y,rx,ry,fill,stroke='none',sw=3):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
# Shore foam and a shallow-water halo, matched to the real coastline, with broken outer crests.
for shape in [land]+[affinity.scale(Point(x,y).buffer(rx,resolution=60),1,ry/rx,origin=(x,y)) for x,y,rx,ry in w['islets']]:
 for pad,col,sw in [(155,'#94D8E2',18),(100,'#B1E5E4',11),(54,'#FFF4CB',6)]:body.append(poly(shape.buffer(pad),'none',col,sw))
 body.append(poly(shape,'#FDE48C',ink,4))
 body.append(poly(shape.buffer(-102),'#91B72E','#71952C',3))
# Wide beach coves occur only outside the protected lawns, paths and sleep spots.
beaches=unary_union([affinity.scale(Point(x,y).buffer(300),1,.6,origin=(x,y)) for x,y in [(1030,3260),(6820,3290),(2550,4450),(5330,4500)]]).intersection(land).difference(reserved)
body.append(poly(beaches,'#FDE48C','#D0B65D',3))
# Dark grass at the rim, light patches inside, both organic and broken up.
for i in range(170):
 x=r.uniform(650,7100);y=r.uniform(1000,4700);g=affinity.scale(Point(x,y).buffer(r.uniform(90,240),resolution=9),1,.55,origin=(x,y)).intersection(grass).difference(lake.union(river).union(paths).union(beaches))
 body.append(poly(g,r.choice(['#94BB32','#98BD37','#88AD2E'])))
for line in w['paths']:
 d='M '+' L '.join(f'{x:.1f},{y:.1f}' for x,y in line)
 body.append(f'<path d="{d}" fill="none" stroke="#A28A45" stroke-width="308" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" fill="none" stroke="#FFE9A1" stroke-width="300" stroke-linecap="round" stroke-linejoin="round"/>')
for key,z in w['zones'].items():
 if key=='plaza':continue
 g=ellipse(z)
 if key.startswith('activity'):body.append(poly(g,'#98BE39','#7F9E2E',4))
 elif key.startswith('stalls'):
  body.append(poly(g,'#EBD497','#A28A45',4))
  # Warm cobbled market lanes, deliberately without occupied stall footprints.
  for y in range(int(z['y']-z['ry']),int(z['y']+z['ry']),42):
   for x in range(int(z['x']-z['rx']),int(z['x']+z['rx']),68):
    tile=box(x+(y%3)*8,y,x+57+(y%3)*8,y+31).buffer(6).intersection(g.buffer(-10))
    if not tile.is_empty:body.append(poly(tile,'#F8E5AC','#D4BB7D',1.5))
 else:
  body.append(poly(g,'#FFE9A1',ink,4))
  for rad in [210,420,630,695]:body.append(el(3900,3800,rad,rad*.777,'none','#CEB16F',3))
  for j in range(28):
   t=j*math.tau/28
   body.append(f'<path d="M{3900+210*math.cos(t)} {3800+163*math.sin(t)} L{3900+695*math.cos(t)} {3800+540*math.sin(t)}" stroke="#D5B974" stroke-width="3"/>')
  body.append(el(3900,3800,195,151,'#91B72E','#6F9130',4))
# Creek and lagoon share the Home water, sand banks, edge depth and foam.
water=lake.union(river)
body.append(poly(water.buffer(35).intersection(land),'#FFE9A1',ink,4));body.append(poly(water.intersection(land),'#62BDD1','#429AAF',4));body.append(poly(water.buffer(-27).intersection(land),'#6EC9DE'))
for i in range(190):
 x=r.uniform(2730,7150);y=r.uniform(1620,3040)
 if water.buffer(-25).contains(Point(x,y)):
  body.append(f'<path d="M{x:.1f},{y:.1f} q23 9 55 0" fill="none" stroke="#BDE9EB" stroke-width="3" stroke-linecap="round"/>')
# Import exact Home tuft/flower/pebble artwork as small reusable SVG symbols.
defs=[]
for family,nn in [('grass-tuft',3),('flower-dot',3),('pebble',3),('sand-speck',2)]:
 for j in range(1,nn+1):
  key=f'{family}-{j}';s=(R/f'public/pixi-art/decals/{key}.svg').read_text();vb=re.search(r'viewBox="([^"]+)"',s)[1];content=re.sub(r'^.*?<svg[^>]*>','',s,flags=re.S).rsplit('</svg>',1)[0]
  defs.append(f'<symbol id="{key}" viewBox="{vb}" fill="none" stroke-linecap="round" stroke-linejoin="round">{content}</symbol>')
marks=0
for i in range(5800):
 x=r.uniform(600,7200);y=r.uniform(900,4830);pt=Point(x,y)
 if not land.contains(pt) or water.buffer(38).contains(pt) or cliff.contains(pt):continue
 if paths.contains(pt) or any(ellipse(z).contains(pt) for k,z in w['zones'].items() if k=='centre' or k.startswith('stalls')):
  if i%10:continue
  kind='pebble';ww=16
 elif grass.contains(pt) and not beaches.contains(pt):kind=r.choices(['grass-tuft','flower-dot','pebble'],[.64,.22,.14])[0];ww={'grass-tuft':34,'flower-dot':25,'pebble':22}[kind]*r.uniform(.7,1.2)
 else:kind='sand-speck';ww=18
 j=r.randint(1,2 if kind=='sand-speck' else 3);body.append(f'<use href="#{kind}-{j}" x="{x:.1f}" y="{y:.1f}" width="{ww:.1f}" height="{ww*.68:.1f}"/>');marks+=1
# Tiny foam bursts and spray at the bottom of each fall, behind all standing artwork.
for cx,cy,rx in [(3900,2200,450),(3900,2050,350),(3900,1780,290)]:
 for j in range(16):
  x=cx+r.uniform(-rx,rx);y=cy+r.uniform(-30,24);body.append(el(x,y,r.uniform(10,30),r.uniform(4,12),'#FFF5D8'))
# Central garden island: a themed fern knot with tall stone, deliberately less than a Ducky circle.
body.append(el(3900,3800,130,95,'#6F9A29'))
# Sprite placements on the small centre garden are outside the open usable ring.
for j in range(9):
 t=j*math.tau/9;src,rat=source('plants/bush-3.svg');ww=100
 a['props'].append(dict(id=f'waterfall-centre-fern-{j}',name='Centre fern garden',src=src,x=3900+110*math.cos(t),y=3800+72*math.sin(t),width=ww,height=ww*rat,anchor={'x':.5,'y':1},scale=1))
w['obstacles'].append(dict(x=3900,y=3800,rx=155,ry=113))
s=f'<svg xmlns="http://www.w3.org/2000/svg" width="7800" height="5800" viewBox="0 0 7800 5800"><defs>{"".join(defs)}</defs>{"".join(body)}</svg>'
(A/'ground.svg').write_text(s)
for t in a['ground']['tiles']:
 st=re.sub(r'<svg[^>]+>',f'<svg xmlns="http://www.w3.org/2000/svg" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}">',s,count=1);(A/t['src']).write_text(st)
# This engine's walkways do not override inland water. Cut precisely the deck corridor
# from the water collision polygon; visual water stays continuous beneath the bridge.
wet=river.difference(unary_union([LineString([q['a'],q['b']]).buffer(q['w']/2+10) for q in w['walkways'][-2:]]))
segments=list(wet.geoms) if wet.geom_type=='MultiPolygon' else [wet]
w['water']=w['water'][:1]+[dict(x=q.centroid.x,y=q.centroid.y,rx=(q.bounds[2]-q.bounds[0])/2,ry=(q.bounds[3]-q.bounds[1])/2,poly=list(q.exterior.coords)[:-1]) for q in segments]
for key in ['obstacles','water','walkways']:walk[key]=w[key]
for f,v in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk)]:f.write_text(json.dumps(v,separators=(',',':')))
print(json.dumps({'added':count,'props':len(a['props']),'trees':sum('tree' in p['name'].lower() for p in a['props']),'floating':len(a['floating']),'groundMarks':marks},indent=2))
