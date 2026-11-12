"""Puddlelace. Deterministic canal-only builder; Python 3.11 with numpy/shapely.
Original image_gen props are palette-snapped and vtraced by canal-trace.py.
The basin is outside the coast, so existing boat collision recognises its water.
"""
from pathlib import Path
import json, math, random, re, importlib.util, shutil, sys
sys.dont_write_bytecode=True
import numpy as np
from shapely.geometry import Point, Polygon, LineString, box
from shapely.ops import unary_union
from shapely.affinity import scale
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'public/pixi-art/themes/canal'; DATA=ROOT/'assets/world/themes/canal'
for d in [ART,DATA,ART/'reuse',ART/'detail']: d.mkdir(parents=True,exist_ok=True)
W,H=8000,6000; rng=random.Random(74)
INK='#39472D'; CREAM='#FFF2CE'; SAND='#FFE399'; GROUND='#E8C382'; SEA='#6EC9DE'; GRASS='#92B72F'
def ellipse(x,y,rx,ry): return scale(Point(x,y).buffer(1,quad_segs=64),rx,ry)
def coords(g): return [[round(x,1),round(y,1)] for x,y in list(g.exterior.coords)[:-1]]
def poly(p): return 'M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in p)+' Z'
def path(g):
    gs=g.geoms if hasattr(g,'geoms') else [g]
    return ' '.join(poly(coords(q))+' '+ ' '.join(poly(list(r.coords)) for r in q.interiors) for q in gs if q.geom_type=='Polygon')
def line(p): return 'M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in p)
def svg(file,body,vb,w,h):
    (ART/file).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}" stroke-linecap="round" stroke-linejoin="round">{body}</svg>')
outer=Polygon([(4000+3450*(1+.025*math.cos(5*t)+.015*math.sin(7*t))*math.cos(t),3000+2300*(1+.022*math.sin(4*t))*math.sin(t)) for t in np.linspace(0,math.tau,220,endpoint=False)])
basin=ellipse(4000,3300,2020,1520)
mouth=LineString([(4000,4500),(4070,5150),(4240,6000)]).buffer(360)
land=outer.difference(basin.union(mouth)).buffer(60).buffer(-60).simplify(5)
assert land.geom_type=='Polygon' and not land.interiors
islet=[4000,3200,1500,1080]; market=ellipse(*islet)
allland=unary_union([land,market]); safe=land.buffer(-150)
paths=[([(1450,3000),(1550,2200),(2050,1550),(2900,1220),(4000,1260),(5200,1300),(6100,1840),(6560,2700),(6550,3600),(6070,4400),(5400,4700)],240),
 ([(1570,2200),(1150,2800),(1200,3570),(1950,4300),(2800,4660),(3190,4620)],210),
 ([(1050,3000),(2530,3200),(5450,3200),(6880,3100)],240),
 ([(4000,1200),(4000,2200),(4000,3100)],240),
 ([(5400,4700),(5920,4170),(6450,4150),(6840,4120)],210)]
def smooth_route(points):
    for _ in range(3):
        points=[points[0]]+[q for a,b in zip(points,points[1:]) for q in [(a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25),(a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75)]]+[points[-1]]
    return [[round(x,2),round(y,2)] for x,y in points]
paths=[(smooth_route(p),w) for p,w in paths]
routegeom=unary_union([LineString(p).buffer(w/2+45) for p,w in paths])
activities=[('activity-1','West garden green',1450,3300,460,330),('activity-2','North gathering green',4900,1140,510,270),('activity-3','East gathering green',6500,3800,400,300)]
rows=[('stalls-1','Balcony market row',1630,1720,2650,2070),('stalls-2','East quay row',5850,2190,6770,2550),('stalls-3','South bank row',2300,4760,3150,4950)]
centre=ellipse(4000,3320,1190,820)
reserved=unary_union([ellipse(x,y,rx,ry) for _,_,x,y,rx,ry in activities]+[box(x0,y0,x1,y1) for _,_,x0,y0,x1,y1 in rows])
spec=importlib.util.spec_from_file_location('canaldecks',ROOT/'scripts/themes/canal-decks.py'); ds=importlib.util.module_from_spec(spec); spec.loader.exec_module(ds); ds.ART=str(ART)
bridges=[('bridge-west',(1860,3200),(2600,3200),210),('bridge-east',(5400,3200),(6140,3200),210),('bridge-north',(4000,1660),(4000,2220),210)]
jetties=[('jetty-harbor',(1550,1650),(1020,1210),170),('jetty-east',(7240,2830),(7740,2830),170),('jetty-southwest',(2600,5010),(2440,5530),170),('jetty-basin',(4800,3950),(5050,4300),170)]
jetties[0]=('jetty-harbor',(1650,1680),(1080,1100),128)
decks=[ds.arch_svg(n,a,b,w) for n,a,b,w in bridges]+[ds.deck_svg(n,a,b,w,False) for n,a,b,w in jetties[1:]]
harbor_preview=ds.deck_svg('harbor-preview',jetties[0][1],jetties[0][2],128,False)
walkways=[dict(a=list(a),b=list(b),w=w) for n,a,b,w in bridges+jetties]
reuse=['tree-1','tree-2','tree-3','tree-4','tree-5','bush-1','bush-2','bush-3','bush-4','flower-1','flower-2','flower-3','lamp-lantern','street--bench-wood','street--bench-wood-left','street--bench-wood-right','picnic-table','umbrella-garden','rock-round','rock-boulder','sandcastle-turrets','beach--shell-scallop','beach--starfish-orange']
for n in reuse: shutil.copyfile(ROOT/f'public/pixi-art/themes/sunflower/reuse/{n}.svg',ART/f'reuse/{n}.svg')
for n in ['street--bollard','street--planter-flowers','buildings--gazebo']:
    shutil.copyfile(ROOT/f'public/pixi-art/detail/{n}.svg',ART/f'reuse/{n}.svg')
for copied in (ART/'reuse').glob('*.svg'):
    text=copied.read_text()
    for match in list(re.finditer(r'<(?:linearGradient|radialGradient)\b[^>]*id="([^"]+)"[^>]*>(.*?)</(?:linearGradient|radialGradient)>',text,re.S)):
        ident,body=match.group(1),match.group(2)
        stops=re.findall(r'stop-color="(#[A-Fa-f0-9]+)"',body)
        if stops: text=text.replace('url(#'+ident+')',stops[min(1,len(stops)-1)])
        text=text.replace(match.group(0),'')
    copied.write_text(text)

props=[]; obstacles=[]
def size(src):
    s=(ART/src).read_text(); m=re.search(r'viewBox="([^"]+)"',s)
    if m: return list(map(float,m[1].split()))[2:]
    return [float(re.search(rf'{a}="([\d.]+)',s)[1]) for a in ('width','height')]
def put(name,src,x,y,height,foot='small',pid=None,flip=False):
    w,h=size(src); k=height/h; ww=w*k
    p=dict(id=pid or f'canal-{len(props)}',name=name,src=src,x=round(x,1),y=round(y,1),width=w,height=h,scale=round(k,5),anchor={'x':.5,'y':.98},flip=flip)
    props.append(p)
    if foot=='tree': o=dict(x=x,y=y-9,rx=31,ry=22)
    elif foot=='building': o=dict(poly=[[x-ww*.44,y-90],[x+ww*.44,y-90],[x+ww*.44,y-5],[x-ww*.44,y-5]])
    elif foot=='small': o=dict(x=x,y=y-7,rx=min(ww*.34,70),ry=min(height*.12,30))
    elif isinstance(foot,dict): o=foot
    else: return p
    obstacles.append(o); return p
put('Shell-roof market hall','detail/shell-market.svg',4000,2810,790,'building',pid='canal-market-hall')
for i,(x,y) in enumerate([(2200,1610),(2560,1560),(2930,1550),(5320,1810),(5680,1880),(6040,2030),(1670,3800),(2000,4020)]):
    put('Balcony townhouse','detail/'+('balcony-peach' if i%2==0 else 'balcony-cream')+'.svg',x,y,550,'building')
for x,y in [(3110,2880),(4900,2920),(3130,3740),(4870,3740)]: put('Striped market stall','detail/flower-stall.svg',x,y,240,'building')
svg('detail/centre-placeholder.svg',f'<ellipse cx="90" cy="104" rx="82" ry="33" fill="{GROUND}" stroke="{INK}" stroke-width="3"/><ellipse cx="90" cy="90" rx="82" ry="33" fill="{CREAM}" stroke="{INK}" stroke-width="3"/><path d="M65 80 V45 Q90 8 115 45 V80Z" fill="{SAND}" stroke="{INK}" stroke-width="3"/><path d="M73 52 Q77 31 89 30" fill="none" stroke="#FFF9E6" stroke-width="6"/>','0 0 180 145',180,145)
put('Temporary centre marker','detail/centre-placeholder.svg',4000,3380,130,{'x':4000,'y':3350,'rx':75,'ry':40},pid='canal-centre-placeholder')
svg('detail/mooring-pole.svg',f'<ellipse cx="24" cy="130" rx="20" ry="8" fill="#519D9C"/><path d="M14 126 V20 Q24 9 34 20 V126Z" fill="{GROUND}" stroke="{INK}" stroke-width="3"/><path d="M15 40 L33 29 V49 L15 60Z M15 78 L33 67 V87 L15 98Z" fill="#489F9E"/><ellipse cx="24" cy="20" rx="10" ry="5" fill="{CREAM}" stroke="{INK}" stroke-width="3"/>','0 0 48 140',48,140)
for i,t in enumerate(np.linspace(0,math.tau,24,endpoint=False)):
    x,y=4000+1420*math.cos(t),3200+990*math.sin(t)
    if min(LineString([a,b]).distance(Point(x,y)) for _,a,b,_ in bridges)<190: continue
    put('Canal lamp','reuse/lamp-lantern.svg',x,y,190,'small')
    if i%2==0: put('Mooring pole','detail/mooring-pole.svg',4000+1490*math.cos(t),3200+1070*math.sin(t),118,'small')
for x,y in [(3400,3000),(4600,3000),(3340,3920),(4630,3920),(1770,2270),(6180,2880),(6140,4140),(2590,4150)]:
    put('Quay flower planter','reuse/street--planter-flowers.svg',x,y,110,'small')
for x,y in [(1660,2450),(1270,3890),(2670,1250),(3530,1190),(5940,1630),(6720,3300),(6220,4110),(2850,5070),(3270,4050),(4700,4020)]:
    if allland.buffer(-80).contains(Point(x,y)) and not reserved.buffer(60).contains(Point(x,y)):
        put('Quay bench','reuse/street--bench-wood.svg',x,y,100,'small')
put('Canal garden gazebo','reuse/buildings--gazebo.svg',1520,4100,310,'building')
plantclear=unary_union([reserved.buffer(140),routegeom.buffer(60),market.buffer(80)]+[LineString([a,b]).buffer(200) for _,a,b,_ in jetties+bridges])
existing=[(p['x'],p['y']) for p in props]
for i in range(5000):
    if sum(p['name']=='Canal tree' for p in props)>=62: break
    x,y=rng.uniform(700,7300),rng.uniform(750,5150)
    if not safe.contains(Point(x,y)) or plantclear.contains(Point(x,y)): continue
    if any(math.hypot(x-a,(y-b)*1.25)<330 for a,b in existing):continue
    k=rng.randrange(1,6); put('Canal tree',f'reuse/tree-{k}.svg',x,y,[450,440,470,360,450][k-1],'tree',pid=f'canal-tree-{sum(p["name"]=="Canal tree" for p in props)}'); existing.append((x,y))
for i in range(900):
    x,y=rng.uniform(700,7300),rng.uniform(750,5150)
    if not safe.contains(Point(x,y)) or plantclear.contains(Point(x,y)):continue
    if any(math.hypot(x-a,(y-b)*1.2)<125 for a,b in existing):continue
    if i%3==0: put('Canal bush',f'reuse/bush-{i%4+1}.svg',x,y,110,'small')
    else: put('Garden flowers',f'reuse/flower-{i%3+1}.svg',x,y,53,None)
    existing.append((x,y))
ld=path(land); md=path(market)
g=[f'<defs><clipPath id="land"><path d="{ld} {md}"/></clipPath><clipPath id="main"><path d="{ld}"/></clipPath></defs>']
for geo in [land,market]:
    for pad, col, width in [(115,'#80D3DF',26),(72,'#97DEE4',16),(40,'#C1EBE9',9)]:
        g.append(f'<path d="{path(geo.buffer(pad))}" fill="none" stroke="{col}" stroke-width="{width}"/>')
    g.append(f'<path d="{path(geo.buffer(22))}" fill="none" stroke="#FFF6D6" stroke-width="6" stroke-dasharray="170 45 50 80"/>')
for i in range(2200):
    x,y=rng.uniform(0,W),rng.uniform(0,H)
    if allland.buffer(125).contains(Point(x,y)):continue
    g.append(f'<path d="M{x:.1f} {y:.1f} q8 3 18 0" fill="none" stroke="#B5E4E6" stroke-width="1.5" opacity=".6"/>')
for geo in [land,market]:
    d=path(geo)
    g.extend([f'<path d="{d}" fill="none" stroke="#8ED9E2" stroke-width="100"/>',f'<path d="{d}" fill="none" stroke="#D5F0E4" stroke-width="55"/>',f'<path d="{d}" fill="{GROUND}" stroke="{INK}" stroke-width="3.5"/>',f'<path d="{d}" fill="none" stroke="{SAND}" stroke-width="100"/>',f'<path d="{path(geo.buffer(-54))}" fill="none" stroke="{CREAM}" stroke-width="6"/>'])
g.append(f'<path d="{path(land.buffer(-125))}" fill="{GRASS}" stroke="#6D972C" stroke-width="3"/>')
for i in range(75):
    x,y=rng.uniform(800,7200),rng.uniform(900,5100)
    q=ellipse(x,y,rng.uniform(90,240),rng.uniform(45,110))
    if safe.contains(q) and not reserved.intersects(q):g.append(f'<path d="{path(q)}" fill="{["#9CBE3B","#86AD2A","#95B933"][i%3]}"/>')
quay=land.intersection(basin.buffer(220)).buffer(-15)
g.append(f'<path d="{path(quay)}" fill="{GROUND}" stroke="{CREAM}" stroke-width="8"/>')
for p,w in paths:
    for pad,col in [(16,INK),(10,GROUND),(0,CREAM)]:g.append(f'<path d="{line(p)}" clip-path="url(#land)" fill="none" stroke="{col}" stroke-width="{w+pad}"/>')
from scipy.spatial import Voronoi
def paving(q,ident):
    x0,y0,x1,y1=q.bounds; pts=[(rng.uniform(x0,x1),rng.uniform(y0,y1)) for _ in range(max(35,int(q.area/13000)))]
    v=Voronoi(np.array(pts+[(x0-6000,y0-6000),(x1+6000,y0-6000),(x1+6000,y1+6000),(x0-6000,y1+6000)]))
    ds=' '.join(line([v.vertices[a],v.vertices[b]]) for a,b in v.ridge_vertices if a>=0 and b>=0)
    d=path(q)
    return f'<clipPath id="{ident}"><path d="{d}"/></clipPath><path d="{d}" fill="{CREAM}" stroke="#BD9D7C" stroke-width="14"/><path d="{ds}" clip-path="url(#{ident})" fill="none" stroke="#DEC5A0" stroke-width="4"/><path d="{path(q.buffer(-24))}" fill="none" stroke="{SAND}" stroke-width="18"/>'
g.append(paving(centre,'centre'))
for i,(_,_,x0,y0,x1,y1) in enumerate(rows):
    q=box(x0,y0,x1,y1).buffer(60)
    for j in range(6):
        xx=x0+(x1-x0)*(j+.5)/6
        q=q.union(ellipse(xx,y0+10,150,90+(j%3)*15)).union(ellipse(xx,y1-10,145,90+((j+1)%3)*12))
    g.append(paving(q.buffer(30).buffer(-30),'row'+str(i)))
for i,(_,_,x,y,rx,ry) in enumerate(activities):
    d=path(ellipse(x,y,rx,ry));g.append(f'<path d="{d}" fill="#97BA37" stroke="#89AD2E" stroke-width="4"/><path d="{d}" fill="none" stroke="#A2C345" stroke-width="3" stroke-dasharray="3 28"/>')
beach=land.intersection(ellipse(6650,4480,600,300));g.append(f'<path d="{path(beach)}" fill="{SAND}" stroke="{CREAM}" stroke-width="5"/>')
for i in range(550):
    x,y=rng.uniform(600,7400),rng.uniform(600,5400)
    if not safe.contains(Point(x,y)) or reserved.contains(Point(x,y)) or routegeom.contains(Point(x,y)):continue
    g.append(f'<path d="M{x:.0f} {y:.0f} l-7 -9 m7 9 l8 -13" fill="none" stroke="#567F29" stroke-width="2.2"/>')
body=''.join(g);svg('ground.svg',body,f'0 0 {W} {H}',W,H)
tiles=[]
for row in range(4):
 for col in range(6):
    x=col*W/6;y=row*H/4;tw=W/6;th=H/4;src=f'ground-r{row}-c{col}.svg';svg(src,body,f'{x} {y} {tw} {th}',tw,th);tiles.append(dict(src=src,x=x,y=y,width=tw,height=th))
boats=[]
for i,(_,a,b,w) in enumerate(jetties):
    dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy); ux,uy=dx/L,dy/L
    for j,(t,s) in enumerate(([(-60,-180),(-60,180),(230,0)] if i==0 else [(-80,-180),(-80,180)])):
        boats.append(dict(x=round(b[0]+ux*t-uy*s),y=round(b[1]+uy*t+ux*s),turn=round(math.atan2(-ux,uy),5)))
zones={'plaza':dict(x=4000,y=3320,rx=1190,ry=820,spawn=[4000,3690]),'centre':dict(x=4000,y=3320,rx=1190,ry=820,spawn=[4000,3690],placeholder=True),'market':dict(x=4000,y=2810,spawn=[4000,3010]),'harbor':dict(x=1650,y=1680,spawn=[1650,1680]),'beach':dict(x=6590,y=4380,spawn=[6590,4380])}
for n,name,x,y,rx,ry in activities:zones[n]=dict(name=name,kind='activity',x=x,y=y,rx=rx,ry=ry,spawn=[x,y])
for n,name,x0,y0,x1,y1 in rows:zones[n]=dict(name=name,kind='stalls',x=(x0+x1)/2,y=(y0+y1)/2,x0=x0,y0=y0,x1=x1,y1=y1,slots=[[round(x0+160+i*300),y0+85] for i in range(int((x1-x0)/300))],spawn=[(x0+x1)/2,y1-80])
world=dict(width=W,height=H,coast=coords(land),water=[],bridges=[],obstacles=obstacles,islets=[islet],walkways=walkways,zones=zones,theme='canal',name='Puddlelace',paths=[p for p,w in paths],pathWidths=[w for p,w in paths],arches=[dict(a=list(a),b=list(b),w=w,r=64) for _,a,b,w in bridges],props=props,sleepSpots={},sleepAvoid=[dict(x=x,y=y,rx=rx+100,ry=ry+100,name=n) for n,_,x,y,rx,ry in activities]+[dict(x=(x0+x1)/2,y=(y0+y1)/2,rx=(x1-x0)/2+110,ry=(y1-y0)/2+110,name=n) for n,_,x0,y0,x1,y1 in rows],ambient={'birds':[[2100,1100],[5800,1600],[1300,3400],[5800,4500],[4000,3600],[6600,2800]],'butterflies':[[1500,4100],[6200,4300]]})
walk=dict(width=W,height=H,coast=coords(land.buffer(-35).simplify(4)),water=[],bridges=[],obstacles=obstacles,islets=[islet],walkways=walkways)
harbor=dict(jetty=dict(foot=list(jetties[0][1]),tip=list(jetties[0][2]),width=128),boats=boats,spawn=zones['plaza']['spawn'])
art=dict(width=W,height=H,sea=SEA,ground=dict(tiles=tiles),decks=decks,flats=[],props=props)
for file,obj in [('world.json',world),('walk-world.json',walk),('harbor.json',harbor)]: (DATA/file).write_text(json.dumps(obj,separators=(',',':')))
(ART/'art.json').write_text(json.dumps(art,separators=(',',':')))
metrics=dict(coastArea=land.area,isletArea=market.area,totalLand=allland.area,ratioToOriginalHome=allland.area/11090000,map=[W,H],props=len(props),obstacles=len(obstacles),previewHarbor=harbor_preview)
(ART/'build-metrics.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics,indent=2))
