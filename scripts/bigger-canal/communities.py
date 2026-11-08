"""Authored Puddlelace neighbourhoods. No random placement. Requires shapely."""
import json, math, re, sys
from pathlib import Path
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely.affinity import scale
A=Path('public/pixi-art/themes/canal'); S=Path('scripts/bigger-canal'); D=Path('rive/web/themes/canal')
OUT=Path('/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger'); OUT.mkdir(parents=True,exist_ok=True)
E=A/'communities'; E.mkdir(exist_ok=True)
read=lambda p:json.loads(Path(p).read_text())
write=lambda p,d:Path(p).write_text(json.dumps(d,separators=(',',':'))+'\n')
w=read(S/'original-world.json'); walk=read(S/'original-walk.json'); art=read(S/'original-art.json')
old=Polygon(w['coast']); centre=scale(Point(4000,3200).buffer(1,64),1500,1080)
dry=old.union(centre)
# Authored coastline, softly interpolated. The long southern inlet remains open to the sea.
coastPts=[[-2150,1700],[-2050,400],[-1500,-350],[-400,-1050],[1100,-1450],[2800,-1720],[4500,-1650],[6100,-1250],[7450,-600],[8650,200],[9550,1400],[10100,2600],[10200,3800],[9850,5000],[9000,5950],[7800,6700],[6250,7300],[4800,7500],[3550,7200],[2100,7480],[650,6950],[-650,6000],[-1600,4700],[-2150,3200]]
def smooth(pts,closed=False,steps=10):
 out=[];n=len(pts)
 for i in range(n if closed else n-1):
  a=pts[(i-1)%n] if closed or i else pts[0];b=pts[i];c=pts[(i+1)%n];d=pts[(i+2)%n] if closed or i<n-2 else c
  for j in range(steps):
   t=j/steps;out.append([round(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t),2) for k in (0,1)])
 if not closed:out.append(pts[-1])
 return out
coast=Polygon(smooth(coastPts,True))
# Old outer shoreline becomes a watercourse. Nothing is painted over the original dry land.
outerChannel=old.buffer(560).difference(old)
nw=smooth([[-1850,-100],[-1550,100],[-1100,500],[-250,650],[550,1000],[1100,1400]])
se=smooth([[7740,2900],[8300,3250],[8600,4100],[8450,5050],[8750,5850],[9200,6200]])
water=outerChannel.union(LineString(nw).buffer(155)).union(LineString(se).buffer(135)).difference(dry).intersection(coast)
# Preserve the original channel and southern mouth rather than filling its blue artwork with invisible land.
innerSea=Polygon([(3670,4785),(4380,4785),(4470,5400),(4700,6100),(4550,6750),(4800,7800),(3700,7900),(3850,6800),(3970,6100),(3750,5400)]).difference(dry)
water=water.union(innerSea.intersection(coast))
newLand=coast.difference(water).difference(dry)
origin={'x':-3000,'y':-2500};width=14000;height=11000
communities=[
 {'id':'bobbin','name':'Bobbinboat Quay','who':'Boatbuilders and the families who mend sails','cx':-650,'cy':1700,'spawn':[-450,2050],'work':'Hull shed, sail loft, slipway and shared quay'},
 {'id':'petal','name':'Petalpost Terrace','who':'Flower growers and balcony gardeners','cx':4000,'cy':-650,'spawn':[4100,-180],'work':'Potting house, nursery beds and flower exchange'},
 {'id':'shell','name':'Pearlbutton Row','who':'Shell merchants, bakers and visiting traders','cx':8900,'cy':2200,'spawn':[9200,2750],'work':'Shell counting house, bakery and waterside market'},
 {'id':'reed','name':'Reedwhistle Bend','who':'Reed weavers and freshwater fishers','cx':1900,'cy':6300,'spawn':[2100,6730],'work':'Weaving hall, drying racks, fishing steps and green'}]
baselineRoads=[
 ([[-1700,2500],[-1150,2400],[-450,2050],[300,2150],[1250,2600],[1450,3300]],230),
 ([[4150,1250],[4150,300],[4100,-180],[4700,-350],[5450,-200]],250),
 ([[6950,3800],[7350,3600],[8150,3600],[8700,3400],[9200,2750],[9500,2150]],240),
 ([[5400,4800],[5400,5850],[4800,6200]],230),
 ([[2700,5600],[2200,5900],[2100,6730],[1400,6750],[650,6400]],230),
 ([[-450,2050],[-950,1550],[-800,650],[-150,100],[1100,-350],[2450,-700],[4100,-180]],200),
 ([[5450,-200],[6800,150],[7900,900],[8500,1600],[9200,2750]],210),
 ([[9200,2750],[9400,3800],[9100,4700],[8300,5500],[7000,6100],[5400,5850]],200),
 ([[4800,6200],[4400,6900],[4050,6900],[3500,6700],[2100,6730]],180),
 ([[650,6400],[-300,5350],[-1100,4300],[-1450,3400],[-1700,2500]],200),
 # Narrow domestic lanes are still generous enough for several ducks side by side.
 ([[-450,2050],[-850,1900],[-1300,1450],[-1000,950],[-400,1100],[0,1500],[-450,2050]],135),
 ([[4100,-180],[3300,-450],[2900,-900],[3700,-1200],[4500,-1100],[5150,-650],[4700,-350]],140),
 ([[9200,2750],[8500,2450],[8200,1950],[8650,1400],[9300,1500],[9650,2100]],145),
 ([[2100,6730],[1200,6300],[1000,5850],[1900,5750],[2900,6100],[3100,6600],[2100,6730]],140)]
# One continuous town loop, four existing heart approaches, then short domestic lanes.
# No second ring round a neighbourhood: its shared green is the destination.
roads=[
 ([[-450,2050],[-1200,2020],[-1680,1800],[-1620,1150],[-800,650],[-150,100],[1100,-350],[2450,-700],[2800,-50],[3400,90],[4100,-180],[4700,-350],[5450,-200],[6800,150],[7900,900],[8050,1350],[8100,2000],[8150,2700],[8550,2900],[9200,2750],[9400,3800],[9100,4700],[8300,5500],[7000,6100],[5400,5850],[4800,6200],[4700,6900],[3770,6900],[3150,6780],[2100,6730],[1400,6750],[650,6400],[-300,5350],[-1100,4300],[-1450,3400],[-1700,2500],[-1150,2400],[-450,2050]],185),
 ([[-450,2050],[300,2150],[1250,2600],[1450,3300]],185),
 ([[4100,-180],[4150,300],[4150,1250]],185),
 ([[9200,2750],[8700,3400],[8150,3600],[7350,3600],[6950,3800]],185),
 ([[5400,5850],[5400,4800]],185),
 ([[2100,6730],[2200,5900],[2700,5600]],150),
 # Front-door lanes terminate at gardens or workplaces, not parallel through roads.
 ([[-450,2050],[-330,1810],[-500,1580],[-1020,1400]],88),
 ([[-450,2050],[-80,2180],[180,1930]],78),
 ([[4100,-180],[4080,-420],[3650,-500],[3250,-510]],86),
 ([[4080,-420],[4530,-500],[4850,-110]],78),
 ([[9200,2750],[9180,2450],[9380,1910],[8950,1780],[8550,1880]],88),
 ([[9180,2450],[8750,2680],[8500,2700]],78),
 ([[2100,6730],[1900,6430],[1700,6080],[1250,6150]],86),
 ([[1900,6430],[2440,6300],[2870,6500]],78)]
# The plan is saved BEFORE writing production assets.
def dpath(poly):
 if poly.is_empty:return ''
 if poly.geom_type in ('MultiPolygon','GeometryCollection'):return ' '.join(dpath(p) for p in poly.geoms if p.geom_type in ('Polygon','MultiPolygon'))
 return ' '.join('M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in ring.coords)+' Z' for ring in [poly.exterior,*poly.interiors])
def svg(body,box=None,wh=None):
 box=box or [-3000,-2500,14000,11000];wh=wh or [1400,1100]
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{wh[0]}" height="{wh[1]}" viewBox="{" ".join(map(str,box))}" stroke-linecap="round" stroke-linejoin="round">{body}</svg>'
plan=f'<rect x="-3000" y="-2500" width="14000" height="11000" fill="#6ec9de"/><path d="{dpath(coast)}" fill="#9dbd39" stroke="#fde49a" stroke-width="100"/><path d="{dpath(water)}" fill="#6ec9de"/><path d="{dpath(dry)}" fill="#f8e5a4" stroke="#4a7940" stroke-width="12"/>'
for pts,wide in roads:plan+=f'<path d="M'+ ' L'.join(f'{x},{y}' for x,y in smooth(pts))+f'" fill="none" stroke="#f9e6a0" stroke-width="{wide}"/>'
for c in communities:
 x,y=c['cx'],c['cy'];plan+=f'<ellipse cx="{x}" cy="{y}" rx="1150" ry="650" fill="#dfe8a5" fill-opacity=".6" stroke="#587d44" stroke-width="8" stroke-dasharray="25 20"/>'
 for dx,dy in [(-600,-150),(-180,-300),(300,-180),(630,120),(-520,300)]:plan+=f'<path d="M{x+dx-120} {y+dy} v-180 l120 -100 120 100 v180Z" fill="#fff1bd" stroke="#9a693c" stroke-width="10"/>'
 plan+=f'<text x="{x}" y="{y+850}" text-anchor="middle" font-family="sans-serif" font-size="165" font-weight="bold" fill="#314c36">{c["name"]}</text><text x="{x}" y="{y+1040}" text-anchor="middle" font-family="sans-serif" font-size="90" fill="#314c36">{c["work"]}</text>'
plan+='<text x="4000" y="3300" text-anchor="middle" font-family="sans-serif" font-size="170" fill="#715634">Original shell-market heart</text><text x="4000" y="-2070" text-anchor="middle" font-family="sans-serif" font-size="200" fill="#314c36">PUDDLELACE • four neighbourhoods, one canal town</text>'
(OUT/'canal-communities.svg').write_text(svg(plan));write(S/'community-plan.json',communities)
if '--plan' in sys.argv:sys.exit()
# Every house has an individually authored address, orientation, colours and frontage.
props=[];obstacles=[]
def asset(name,body,W,H):
 f=f'communities/{name}.svg';(A/f).write_text(svg(body,[0,0,W,H],[W,H]));return f
INK='#796039'
def custom(name,x,y,W,H,body,rx=0,ry=0):
 src=asset(name,body,W,H);p={'id':'comm-'+name,'name':name.replace('-',' '),'src':src,'x':x,'y':y,'width':W,'height':H,'scale':1,'anchor':{'x':.5,'y':1},'resolution':1.5}
 props.append(p)
 if rx:obstacles.append({'x':x,'y':y-ry,'rx':rx,'ry':ry,'id':p['id']})
 return p
# Same straight-on facade and warm ink as the original townhouses, with varied silhouettes and useful doors.
def house(name,x,y,colour,roof,kind='home',W=330,H=380):
 low=kind in ('reed','boat');wallY=150 if low else 110; roofY=60 if low else 28
 b=f'<g stroke="{INK}" stroke-width="5"><path d="M32 {wallY} L{W/2} {roofY} L{W-27} {wallY}Z" fill="{roof}"/><path d="M46 {wallY} H{W-42} V{H-25} Q{W/2} {H-15} 46 {H-25}Z" fill="{colour}"/><path d="M40 {wallY+8} H{W-35}" fill="none" stroke="#f9df9c" stroke-width="8"/><path d="M{W/2-34} {H-25} V{H-136} Q{W/2} {H-165} {W/2+34} {H-136} V{H-25}" fill="#77aaa0"/><circle cx="{W/2+20}" cy="{H-88}" r="5" fill="#ffe6a4"/>'
 for xx in [60,W-115]:
  b+=f'<rect x="{xx}" y="{wallY+42}" width="55" height="66" rx="12" fill="#7dcbd1"/><path d="M{xx+27} {wallY+45} v60 M{xx+4} {wallY+75}h47" fill="none" stroke="#fff0bf" stroke-width="5"/><path d="M{xx-5} {wallY+115} h66 l-4 22 h-58Z" fill="#e49b69"/>'
  for q in [0,17,36]:b+=f'<circle cx="{xx+10+q}" cy="{wallY+116}" r="11" fill="{["#ffd36d","#f39fa0","#b8ce59"][q%3]}"/>'
 if not low:b+=f'<path d="M80 240 H{W-74} v16 H80Z" fill="#eac47c"/><path d="M89 218v38 m28-38v38 m28-38v38 m28-38v38 m28-38v38 m28-38v38" stroke-width="4"/><path d="M105 57V24h36v52" fill="{colour}"/>'
 else:b+=f'<path d="M90 {wallY-20}H{W-85}M{W*.36} {roofY+55}H{W*.64}" fill="none" stroke="#dba86b" stroke-width="4"/>'
 b+=f'<path d="M47 {H-33}H{W-44}" stroke="#dfbd80" stroke-width="9"/><path d="M{W*.34} {roofY+48}H{W*.66}M{W*.23} {roofY+73}H{W*.77}" fill="none" stroke="#bd875e" stroke-width="3"/><path d="M20 {H-15} Q{W/2} {H-2} {W-15} {H-15}" fill="none" stroke="#d2b66e" stroke-width="10"/></g>'
 # Each address has a different roof line, joinery and entrance, not just a paint swap.
 profiles={'skipper-home':'hip','sailmaker-home':'gable','keel-home':'flat','ropemaker-home':'dormer','tiller-home':'gambrel','primrose-home':'dormer','marigold-home':'hip','violet-home':'gable','daisy-home':'flat','blossom-home':'gambrel','cowrie-home':'gable','pearl-home':'hip','scallop-home':'dormer','conch-home':'flat','button-home':'gambrel','rush-home':'gambrel','willow-home':'gable','osier-home':'hip','basket-home':'dormer','wren-home':'flat'}
 profile=profiles.get(name,'gable')
 roofShapes={
  'hip':f'M24 {wallY} L85 {roofY+15} H{W-90} L{W-20} {wallY}Z',
  'flat':f'M30 {wallY} V{wallY-64} H{W-28} V{wallY}Z',
  'gambrel':f'M25 {wallY} L65 {roofY+38} L{W/2} {roofY} L{W-66} {roofY+38} L{W-23} {wallY}Z'}
 if profile in roofShapes:
  b=re.sub(r'<path d="M32 [^"]+" fill="[^"]+"/>',f'<path d="{roofShapes[profile]}" fill="{roof}"/>',b,count=1)
 detail=f'<g stroke="{INK}" stroke-width="4">'
 if profile=='dormer':
  detail+=f'<path d="M{W*.37} {wallY-12}V{roofY+35}L{W/2} {roofY+4}L{W*.63} {roofY+35}V{wallY-12}Z" fill="{colour}"/><circle cx="{W/2}" cy="{roofY+48}" r="18" fill="#84c9cd"/><path d="M{W/2-14} {roofY+48}h28m-14-14v28" stroke="#fff0bd"/>'
 elif profile=='flat':
  detail+=f'<path d="M25 {wallY-64}H{W-23}" stroke="#ffedba" stroke-width="10"/><path d="M60 {wallY-70}v-22h45v22m55 0v-22h45v22" fill="#d39d6c"/><path d="M70 {wallY-95}q8-22 16 0m82 0q10-25 20 0" stroke="#71934e" stroke-width="9"/>'
 elif profile=='gable':
  detail+=f'<circle cx="{W/2}" cy="{roofY+57}" r="17" fill="#93c5bd"/><path d="M{W/2} {roofY+43}v28m-14-14h28" stroke="#f9eac1"/>'
 # Front-facing porches and striped fabric belong to the canal's established facade language.
 if profile in ('hip','gambrel','gable'):
  yy=H-158;detail+=f'<path d="M{W/2-69} {yy+12}L{W/2-57} {yy-14}H{W/2+57}L{W/2+69} {yy+12}Z" fill="{roof}"/><path d="M{W/2-61} {yy+12}V{H-18}m122-{H-yy-30}V{H-18}" fill="none"/><path d="M{W/2-73} {H-19}H{W/2+73}m-137 9h128" stroke="#c8a570" stroke-width="9"/>'
 if profile=='hip':
  for dx in [-42,-12,18]:detail+=f'<path d="M{W/2+dx} {H-173}l-9 27h18l-9-27Z" fill="#fff1c6" stroke="none"/>'
 detail+='</g>'
 custom(name,x,y,W,H,b+detail,W*.35,42)
 # Deliberate front garden, split fence leaving the front door open.
 for dx in [-W*.55,W*.55]:kit('street--fence-rail',x+dx,y+34,150,55,True)
 kit('flower-2',x-W*.49,y+5,70,52)
 kit('bush-2',x+W*.5,y+8,100,66,True)
 custom(name+'-postbox',x-W*.52,y+100,42,70,f'<g stroke="{INK}" stroke-width="3"><path d="M20 38v30"/><rect x="4" y="7" width="34" height="32" rx="8" fill="{roof}"/><path d="M9 20h23"/></g>',12,10)
def kit(src,x,y,W,H,solid=False):
 text=(A/f'reuse/{src}.svg').read_text();m=re.search(r'viewBox="([^"]+)"',text)
 if m:dim=list(map(float,m[1].split()));iw,ih=dim[2:]
 else:
  iw=float(re.search(r'width="([\d.]+)',text)[1]);ih=float(re.search(r'height="([\d.]+)',text)[1])
 # Art dimensions have the authored aspect; requested W is a visual footprint, H is used where explicitly needed.
 p={'id':f'comm-kit-{len(props)}','name':src,'src':f'reuse/{src}.svg','x':x,'y':y,'width':W,'height':H,'scale':1,'anchor':{'x':.5,'y':1},'resolution':1.5};props.append(p)
 if solid:obstacles.append({'x':x,'y':y-10,'rx':W*.32,'ry':max(12,min(H*.18,40)),'id':p['id']})
# Addresses are fixed compositions, never generated from random coordinates.
homes=[
 ('skipper',-1250,950,'#f6d9a2','#d18b59','boat'),('sailmaker',-450,1150,'#ffe9bb','#82aaa0','boat'),('keel',-150,1030,'#f6c5a2','#b97654','boat'),('ropemaker',100,1640,'#f1e6bb','#c29665','boat'),('tiller',-1100,1860,'#f5dfb0','#cc8362','boat'),
 ('primrose',3000,-850,'#fff0bd','#d99973','home'),('marigold',3550,-1200,'#f8d2a3','#b78569','home'),('violet',4200,-1070,'#ffe3c8','#d99a6d','home'),('daisy',4800,-750,'#f5e7b1','#82a59d','home'),('blossom',3200,-290,'#ffe8ba','#d28d5d','home'),
 ('cowrie',8400,1620,'#ffe6c4','#d58d64','home'),('pearl',8950,1260,'#f6d4aa','#91b5a0','home'),('scallop',9500,1700,'#fff0c4','#cc8263','home'),('conch',9650,2480,'#f6c6a1','#d5aa6c','home'),('button',8300,2600,'#ffe7b0','#ca8e5e','home'),
 ('rush',1050,5800,'#ead7a1','#b79559','reed'),('willow',1600,5660,'#f8e7bf','#c49a62','reed'),('osier',2200,5750,'#eee0ab','#8fa48b','reed'),('basket',2870,6190,'#ffe7b5','#ba8859','reed'),('wren',1200,6630,'#f7d4a0','#caa673','reed')]
addresses={
 'skipper':[-1050,1300], 'sailmaker':[-500,1500], 'keel':[-80,1470],
 'ropemaker':[20,1810], 'tiller':[-950,1820],
 'primrose':[3250,-600], 'marigold':[3650,-780], 'violet':[4100,-840],
 'daisy':[4540,-600], 'blossom':[3500,-170],
 'cowrie':[8550,1790], 'pearl':[8950,1620], 'scallop':[9420,1780],
 'conch':[9580,2220], 'button':[8650,2500],
 'rush':[1250,6050], 'willow':[1700,5950], 'osier':[2160,6010],
 'basket':[2750,6370], 'wren':[1350,6530]}
for i,(n,x,y,c,r,k) in enumerate(homes):
 x,y=addresses[n];W=[335,400,300,365,285][i%5]
 house(n+'-home',x,y,c,r,k,W=W,H=(310 if k=='reed' else 355 if k=='boat' else 435)*(1.1 if i%5==1 else 1))
# Two additional addresses per district close gaps in the street wall. Sizes and uses differ.
for n,x,y,c,r,k,W,H in [
 ('bobbin-corner',-1050,2260,'#f4d9ae','#82a79c','boat',310,335),
 ('button-sail',-230,2380,'#ffe7b5','#d49368','boat',385,400),
 ('rose-window',3930,-430,'#f4d5b5','#a78b64','home',285,355),
 ('seedkeeper',4850,-180,'#fff0bd','#8fa78b','boat',345,315),
 ('shellwright',9000,2400,'#f8ddb4','#ce9166','boat',300,335),
 ('tide-window',9650,2670,'#ffe9bf','#88aca3','home',330,425),
 ('reed-corner',1750,6570,'#eeddad','#8fa48b','reed',290,305),
 ('basketmakers',2690,6780,'#f9e7bc','#bf9261','reed',370,340)]:
 house(n+'-home',x,y,c,r,k,W,H)
# Established balcony homes introduce the ornate original facade language into every district.
for n,x,y,which in [('quay-a',-1380,1580,'cream'),('quay-b',-350,1060,'peach'),('petal-a',2950,-330,'cream'),('petal-b',4650,-1060,'peach'),('pearl-a',8250,2290,'cream'),('pearl-b',9250,1430,'peach'),('reed-a',950,6460,'cream'),('reed-b',2950,5960,'peach')]:
 src=f'detail/balcony-{which}.svg';W,H=(630,926) if which=='cream' else (564,922);sc=.48
 props.append({'id':'comm-'+n,'name':'Canal balcony home '+n,'src':src,'x':x,'y':y,'width':W,'height':H,'scale':sc,'anchor':{'x':.5,'y':.98},'resolution':2})
 obstacles.append({'x':x,'y':y-30,'rx':W*sc*.38,'ry':40,'id':'comm-'+n})
 kit('flower-3',x-180,y+20,75,54);kit('street--fence-rail',x+180,y+30,130,50,True)
# Workplaces each tell a different story. Reusable town kit surrounds custom working details.
house('sail-loft',-800,2630,'#f8e6bb','#7fa69c','boat',470,420)
custom('hull-shed',-1500,2100,470,310,f'<g stroke="{INK}" stroke-width="6"><path d="M20 120L235 20 450 120v175H20Z" fill="#e6bd7a"/><path d="M45 120H425v160H45Z" fill="#b38552"/><path d="M75 223Q235 305 395 223L360 170H110Z" fill="#f3dba0"/><path d="M110 205h250M130 230h210" fill="none"/><path d="M68 120v160m330-160v160" stroke="#f8dfa3" stroke-width="12"/></g>',180,55)
custom('sail-drying-frame',-1450,1350,280,250,f'<g stroke="{INK}" stroke-width="6"><path d="M20 240V20h240v220" fill="none"/><path d="M40 30H230L165 210 45 170Z" fill="#fff0bf"/><path d="M55 50l120 130M75 40l120 130" stroke="#d5b77c" stroke-width="3"/></g>',115,18)
house('potting-house',5140,-550,'#fff0ca','#8fa78b','boat',440,350)
custom('nursery-coldframe',5200,-700,360,185,f'<g stroke="{INK}" stroke-width="5"><path d="M15 95L100 20h240v130H15Z" fill="#a9d1ba"/><path d="M15 95H255L340 20M95 95L155 20M175 95L235 20M255 95v55" fill="none" stroke="#f4e3b0" stroke-width="8"/><path d="M35 130q20-35 40 0m35 0q20-35 40 0m35 0q20-35 40 0" fill="#6ba264"/></g>',145,35)
house('shell-counting-house',8750,2200,'#f6dcaa','#88aca3','home',430,480)
house('little-quay-bakery',9450,3150,'#ffe7b3','#d38a60','boat',420,350)
custom('bread-counter',9440,3310,260,150,f'<g stroke="{INK}" stroke-width="4"><path d="M10 60H250v80H10Z" fill="#d3a264"/><path d="M5 60Q40 8 70 60Q110 8 140 60Q180 8 210 60Q235 12 255 60" fill="#e5b96c"/><path d="M25 35l20 10m55-10 20 10m60-10 20 10" fill="none"/></g>',100,27)
house('weavers-hall',2450,6500,'#f5e1ad','#b28c59','reed',500,390)
custom('reed-drying-rack',3050,5820,350,220,f'<g stroke="{INK}" stroke-width="5"><path d="M20 215V30h310v185M20 140h310" fill="none"/><path d="M55 30l-12 150m34-150L65 185m40-155L92 180m40-150-14 150m43-150-12 160m43-160-12 150m45-150-10 160m43-160-12 145m42-145-12 160m40-160-12 150" stroke="#d1b465" stroke-width="15"/></g>',145,24)
custom('community-loom',2200,6680,200,170,f'<g stroke="{INK}" stroke-width="5"><path d="M10 160V10h180v150M10 120h180" fill="none"/><path d="M35 20H165V115H35Z" fill="#e6c77d"/><path d="M40 40h120M40 65h120M40 90h120" stroke="#97ae7a" stroke-width="10"/></g>',75,24)
# Shared courts: seating, washing lines, equipment, gardens and visible communal work.
for c in communities:
 x,y=c['spawn'];kit('street--bench-wood',x-240,y+15,200,105,True);kit('street--planter-flowers',x+270,y-20,80,100,True);kit('lamp-lantern',x+390,y-100,60,230,True);custom(c['id']+'-name-sign',x-360,y+230,240,144,f'<g transform="scale(.8)" stroke="{INK}" stroke-width="4"><path d="M60 175V20m180 155V20"/><path d="M10 15Q150 0 290 15V100Q150 115 10 100Z" fill="#d4ad71"/><path d="M20 27Q150 14 280 27" stroke="#f5d89a"/><text x="150" y="64" text-anchor="middle" font-family="sans-serif" font-size="23" font-weight="bold" fill="#5b673f" stroke="none">{c["name"]}</text></g>',110,16)
 custom(c['id']+'-washline',x+150,y-530,330,150,f'<g stroke="{INK}" stroke-width="4"><path d="M10 145V10M320 145V10M10 25Q165 65 320 25" fill="none"/><path d="M70 37l-20 20 15 25 15-10v50h65V70l15 10 12-26-25-16Z" fill="#f6e9bd"/><path d="M205 42h65v80h-65Z" fill="#b2c4a0"/></g>',0,0)
 for dx,dy in [(-400,-380),(400,180)]:kit('picnic-table',x+dx,y+dy,220,150,True)
# The greens are domestic meeting places: a hand pump and wash tub, a lamp and a
# shared kitchen garden. Keep their centres and all door approaches clear.
for name,x,y in [('quay-pump',-600,2330),('petal-pump',4270,100),('pearl-pump',9530,2810),('reed-pump',1800,6790)]:
 custom(name,x,y,155,155,f'<g stroke="{INK}" stroke-width="4"><ellipse cx="78" cy="135" rx="65" ry="18" fill="#c9b87d"/><path d="M27 112Q77 94 128 112v24q-50 22-101 0Z" fill="#dab774"/><ellipse cx="77" cy="111" rx="50" ry="15" fill="#8dcfd0"/><path d="M65 108V35q0-14 15-14h17v17H83v70" fill="#81a59a"/><path d="M80 24L119 8l13 32m-48 5h22v14H85" fill="none" stroke-width="7"/></g>',45,20)
 kit('barrel-seeds',x+(-135 if name=='pearl-pump' else 135),y-35,65,80,True)
for x,y in [(-1120,1730),(-640,1320),(-180,1850),(3100,-590),(3850,-500),(4800,-850),(8500,1970),(9250,1880),(9530,2780),(1390,6300),(2030,6060),(2720,6450)]:
 kit('street--planter-flowers',x,y,65,85,True);kit('street--bollard',x+85,y+18,30,65,True);kit('flower-2',x-70,y+23,62,50)
# Kit scales and placements have explicit purpose: shade beside seats and beds along domestic fronts.
plantings=[(-1700,1700),(-1650,2700),(-1300,3000),(-1400,2900),(-1800,750),(-300,200), (200,350),(800,-450),(1650,-750),(2550,-1150),(2850,-300),(2800,-1150),(4950,-1250),(5600,-600),(6100,-750),(6500,-350),(7200,450),(7750,750),(8150,1150),(9900,3200),(9800,4000),(9000,4550),(8000,5200),(7850,5700),(6650,6400),(5800,6900),(5400,6500),(3450,7000),(3150,6350),(2700,7000),(3050,7060),(800,6750),(400,5950),(-250,5500),(-950,4650),(-1500,3900)]
for i,(x,y) in enumerate(plantings):kit('tree-'+str(i%5+1),x,y,260 if i%3 else 310,360 if i%3 else 400,True)
for x,y in [(2900,-1100),(3380,-810),(3900,-850),(4600,-1000),(5100,-370),(5300,-500),(3380,-600),(4850,-500),(1500,6050),(1750,6100),(800,6200),(-800,1200),(-250,1350),(8500,1900),(9000,1750),(9400,1950)]:
 kit('flower-1',x,y,75,55);kit('flower-3',x+70,y+30,64,52);kit('bush-1',x-65,y+18,100,70,True)
for x,y in [(-1320,2250),(-1000,1050),(9000,2450),(9300,3000),(2580,6710),(2910,5850)]:kit('supply-crates',x,y,130,100,True);kit('barrel-seeds',x+110,y-20,90,100,True)
for x,y in [(-1400,4400),(-250,5500),(200,6000),(750,6820),(5900,6650),(6900,6300),(7800,5650),(9250,4350),(9800,3500),(7800,650),(6800,-80),(1700,-550),(700,-40)]:
 kit('street--bench-wood',x,y,185,100,True);kit('tree-3',x+230,y-110,280,365,True);kit('bush-1',x-160,y+40,100,70,True)
# The quiet gaps are useful commons, each an authored scene with open walking space.
commons=[]
def common(name,x,y,rx,ry,kind):
 commons.append({'name':name,'x':x,'y':y,'rx':rx,'ry':ry,'kind':kind})
common('Sailmakers Orchard',1050,-820,1000,300,'orchard')
common('Lemonbell Grove',6750,100,700,380,'orchard')
common('Shell Collectors Green',9440,4510,440,650,'picnic')
common('Reedbasket Picnic',6860,6550,690,330,'picnic')
common('Willow Reading Lawn',-1130,3950,440,570,'reading')
common('Potters Herb Common',400,5150,460,550,'garden')
common('Petalpost Cutting Garden',1850,-500,530,370,'garden')
common('Lockkeepers Garden',450,1150,500,340,'garden')
common('Southbank Allotments',5520,6930,440,310,'garden')
common('Canalkeepers Flower Meadow',2580,-20,700,250,'wildflowers')
common('Pearlbank Pollinator Green',8180,4900,480,480,'wildflowers')
common('Westbank Wildflower Common',-600,4480,470,720,'wildflowers')
common('Reedwhistle Willow Green',7480,5790,620,300,'wildflowers')
# Former neighbourhood ring roads become productive gardens beside the homes.
common('Bobbinboat Kitchen Plots',-400,630,450,210,'garden')
common('Petalpost Back Gardens',3700,-1250,750,200,'garden')
common('Seedkeepers Cutting Rows',5550,-800,430,260,'garden')
common('Pearlbutton Herb Plots',9300,3450,340,230,'garden')
common('Reedwhistle Kitchen Plots',2150,7120,540,170,'garden')
# Fruit trees have different sizes and irregular, hand-drawn crowns; the table fixes every address.
for name,x,y,W,H,fruit in [('orchard-a',350,-900,270,310,'#e8a052'),('orchard-b',850,-1060,300,350,'#f5c25a'),('orchard-c',1420,-1080,265,320,'#e8a052'),('orchard-d',1780,-850,290,330,'#f5c25a'),('lemon-a',6320,-170,270,320,'#f4d56a'),('lemon-b',6790,-250,310,355,'#f4d56a'),('lemon-c',7180,80,275,320,'#f4d56a'),('lemon-d',6610,420,270,330,'#f4d56a')]:
 body=f'<g stroke="{INK}" stroke-width="4"><path d="M{W*.47} {H-10}L{W*.46} {H*.52}H{W*.56}L{W*.57} {H-10}Z" fill="#c79759"/><path d="M{W*.1} {H*.48}Q{-W*.03} {H*.25} {W*.2} {H*.21}Q{W*.19} 2 {W*.42} 22Q{W*.6} -12 {W*.72} {H*.13}Q{W*1.02} {H*.12} {W*.9} {H*.35}Q{W*1.02} {H*.6} {W*.72} {H*.62}Q{W*.54} {H*.76} {W*.34} {H*.62}Q{W*.12} {H*.7} {W*.1} {H*.48}Z" fill="#669849"/><path d="M{W*.2} {H*.3}q30-44 63-19m28 0q27-20 46 4" fill="none" stroke="#91b65b" stroke-width="13"/>'
 for fx,fy in [(.25,.42),(.49,.22),(.69,.46),(.45,.58),(.8,.28)]:body+=f'<circle cx="{W*fx}" cy="{H*fy}" r="13" fill="{fruit}"/><path d="M{W*fx} {H*fy-12}l3-8"/>'
 body+='</g>';custom(name,x,y,W,H,body,38,26)
for name,x,y in [('orchard-basket',1200,-700),('lemon-crate',7000,420)]:
 custom(name,x,y,110,90,f'<g stroke="{INK}" stroke-width="4"><path d="M8 30h94l-13 52H22Z" fill="#dab575"/><path d="M22 27Q55 -5 88 27M20 49h70M28 65h55" fill="none"/><circle cx="38" cy="27" r="16" fill="#f0c564"/><circle cx="67" cy="29" r="17" fill="#df9a54"/></g>',35,18)
for name,x,y in [('shell-picnic',9530,4530),('reed-picnic',6900,6590),('willow-reading',-1120,4070)]:
 custom(name,x,y,270,160,f'<g stroke="{INK}" stroke-width="3"><path d="M20 14L250 8 263 140 8 150Z" fill="#eee0af"/><path d="M25 20l220 115M245 18L25 139M70 13l155 127M20 60l160 85" stroke="#dba888" stroke-width="13" opacity=".65"/><path d="M88 76q35-38 65 0v45q-35-22-65 0Z" fill="#fff0c9"/><path d="M153 76q35-36 65 0v45q-35-20-65 0Z" fill="#f7d890"/></g>')
 kit('picnic-table',x-230,y-160,220,150,True);kit('tree-2',x+200,y-240,290,390,True)
for x,y in [(450,4980),(350,5430),(1650,-550),(2060,-650),(150,1200),(50,1400),(5400,6860),(5700,7080)]:
 kit('flower-1',x-110,y,80,60);kit('flower-3',x+110,y+8,78,64);kit('barrel-seeds',x+210,y+80,70,85,True)
# Worn roads are variable-width polygons with a raised, scalloped grass lip and ruts following their direction.
def road_geometry(network):
 shapes=[];lines=[]
 for pts,wide in network:
  pts=smooth(pts);line=LineString(pts);pieces=[]
  for i in range(len(pts)-1):
   t=i/(len(pts)-1);r=wide/2*(1+.22*math.sin(t*math.pi*5)+.12*math.cos(t*math.pi*9));pieces.append(LineString(pts[i:i+2]).buffer(r,quad_segs=6))
  shapes.append(unary_union(pieces));lines.append((line,wide))
 return unary_union(shapes).intersection(newLand),lines
roadUnion,roadLines=road_geometry(roads)
beforeRoadUnion,_=road_geometry(baselineRoads)
# Measure visible new land, accounting for the unchanged 165-unit heart mask.
visibleLand=newLand.difference(dry.buffer(165))
squares=unary_union([scale(Point(*c['spawn']).buffer(1,64),245,140) for c in communities])
commonApproaches=unary_union([LineString([[c['x']-c['rx']*.7,c['y']+c['ry']*.45],[c['x'],c['y']+c['ry']*.72],[c['x']+c['rx']*.68,c['y']+c['ry']*.15]]).buffer(22.5) for c in commons])
def sand_area(network):
 # Conservative accounting includes banks, all square paving and worn commons approaches.
 return network.buffer(12.5).union(squares).union(commonApproaches).intersection(visibleLand).area
baselineCommons=unary_union([LineString([[c['x']-c['rx']*.7,c['y']+c['ry']*.45],[c['x'],c['y']+c['ry']*.72],[c['x']+c['rx']*.68,c['y']+c['ry']*.15]]).buffer(22.5) for c in commons[:13]])
beforeArea=beforeRoadUnion.buffer(12.5).union(squares).union(baselineCommons).intersection(visibleLand).area
afterArea=sand_area(roadUnion)
write(S/'dense-metrics.json',{'method':'Union of variable-width road polygons with 12.5-unit bank allowance, square paving and 45-unit worn common approaches, clipped to new dry land outside the preserved heart mask. Homes and gardens are not subtracted.', 'newLandArea':visibleLand.area,'roadAreaBefore':beforeArea,'roadAreaAfter':afterArea,'roadPercentBefore':beforeArea/visibleLand.area*100,'roadPercentAfter':afterArea/visibleLand.area*100,'roadReductionPercent':(1-afterArea/beforeArea)*100,'mainWidth':185,'laneWidths':[78,86,88],'originalMainWidths':read(S/'original-world.json')['pathWidths'],'homesBefore':28,'homesAfter':36,'communities':4})
# Ground: all grass details are drawn inside authored meadows and domestic gardens, no prop scattering.
ground=f'<defs><pattern id="meadow-grain" width="340" height="280" patternUnits="userSpaceOnUse"><path d="M23 52l7-17 8 17 12-9m119 25 7-15 7 15m86 144 7-17 8 18 13-9M65 210l4-12 8 9m86-95 10-4m120-88 8-2M35 137l13-4" fill="none" stroke="#799b34" stroke-width="3" opacity=".6"/><path d="M103 63q35-20 65-4m-20 147q30-10 50 2M257 147q25-9 40 1" fill="none" stroke="#b0ca50" stroke-width="8" opacity=".45"/><ellipse cx="92" cy="128" rx="5" ry="3" fill="#d7cc83" opacity=".7"/><circle cx="241" cy="45" r="2.5" fill="#f1dc93"/></pattern><clipPath id="newland"><path d="{dpath(newLand)}"/></clipPath><clipPath id="roads"><path d="{dpath(roadUnion)}"/></clipPath></defs><path d="{dpath(coast)}" fill="#6ec9de" stroke="#a6dfe1" stroke-width="95"/><path d="{dpath(coast)}" fill="#94b634" stroke="#f6dfa0" stroke-width="60"/><path d="{dpath(water)}" fill="#6ec9de" stroke="#f4dda0" stroke-width="32"/><g clip-path="url(#newland)">'
ground+='<path d="'+dpath(newLand)+'" fill="url(#meadow-grain)"/>'
# Authored meadow contour regions use the same olive and lime shades as the heart.
meadows=[(-1300,3600,650,800),(1000,-800,900,300),(6400,300,600,420),(7750,800,500,460),(9200,4500,500,650),(7200,6100,800,350),(5500,6850,450,300),(400,5200,530,660),(500,700,530,440)]
for x,y,rx,ry in meadows:
 shape=scale(Point(x,y).buffer(1,20),rx,ry);ground+=f'<path d="{dpath(shape)}" fill="#a6c244" opacity=".6"/>'
 # Deliberate contour-stroke clusters stay in that meadow; fixed local pattern, not randomly distributed sprites.
 for dx,dy in [(-.6,-.15),(-.25,-.6),(.3,-.5),(.65,-.1),(.3,.45),(-.3,.5),(0,0)]:
  xx=x+dx*rx;yy=y+dy*ry;ground+=f'<path d="M{xx-32} {yy}q13 -12 20 1q9 -20 18 -3m20 35 20-5m-96-26 15-6" fill="none" stroke="#789a32" stroke-width="4" opacity=".6"/>'
for c in commons:
 x,y,rx,ry=c['x'],c['y'],c['rx'],c['ry']
 contour=[(-1,-.1),(-.76,-.65),(-.25,-.92),(.35,-.78),(.85,-.45),(1,.1),(.65,.7),(.12,.93),(-.55,.74),(-.94,.4)]
 shape=Polygon(smooth([[x+dx*rx,y+dy*ry] for dx,dy in contour],True))
 ground+=f'<path d="{dpath(shape)}" fill="#a7c145"/><path d="{dpath(shape.buffer(-40))}" fill="url(#meadow-grain)"/>'
 if c['kind']=='garden':
  for dx,dy,ww in [(-rx*.38,-ry*.25,rx*.45),(rx*.32,-ry*.3,rx*.38),(-rx*.2,ry*.3,rx*.55)]:
   xx,yy=x+dx,y+dy
   ground+=f'<rect x="{xx-ww/2}" y="{yy-50}" width="{ww}" height="100" rx="35" fill="#a78f52" stroke="#697f39" stroke-width="8"/>'
   for off in [-.3,0,.3]:ground+=f'<path d="M{xx+ww*off} {yy+24}v-40m-15 14 15 10 18-14" fill="none" stroke="#78a45a" stroke-width="9"/><circle cx="{xx+ww*off}" cy="{yy-22}" r="12" fill="#f5ce77"/>'
 if c['kind']=='wildflowers':
  # Four flower drifts frame a clear lawn. These are ground art, never blocking props.
  for dx,dy in [(-.48,-.35),(.25,-.48),(.55,.25),(-.35,.5)]:
   xx,yy=x+dx*rx,y+dy*ry
   for fx,fy,col in [(-34,-12,'#f4d379'),(10,-30,'#f1bf9c'),(45,10,'#f7e5ac'),(-5,28,'#d9c68a')]:
    ground+=f'<path d="M{xx+fx} {yy+fy+14}v-25m-12 10 12 5 10-12" stroke="#6e9946" stroke-width="5" fill="none"/><path d="M{xx+fx-9} {yy+fy-12}q-13-11 0-18q9-15 18-1q14 8 0 19q-10 12-18 0Z" fill="{col}" stroke="#9e9455" stroke-width="2"/>'
 # Worn approach through each common leaves a generous clear centre.
 ground+=f'<path d="M{x-rx*.7} {y+ry*.45}Q{x} {y+ry*.72} {x+rx*.68} {y+ry*.15}" fill="none" stroke="#d6cb87" stroke-width="45" opacity=".65"/>'
ground+=f'<path d="{dpath(roadUnion)}" transform="translate(0 8)" fill="#b49861" stroke="#9b8c51" stroke-width="25"/><path d="{dpath(roadUnion)}" fill="#dfc281" stroke="#58743a" stroke-width="17"/><path d="{dpath(roadUnion)}" fill="#f5dfa0" stroke="#c5a665" stroke-width="7"/>'
for c in communities:
 x,y=c['spawn'];ground+=f'<ellipse cx="{x}" cy="{y}" rx="245" ry="140" fill="#f7e6b6" stroke="#dbc58c" stroke-width="3"/>'
 for dx,dy in [(-160,-50),(-90,-80),(0,-90),(90,-75),(165,-35),(-180,25),(-100,40),(-15,30),(70,45),(155,30),(-100,85),(0,90),(95,85)]:
  ground+=f'<path d="M{x+dx-18} {y+dy}l8-14 35 1 8 15-12 12-30-1Z" fill="#f9edcb" stroke="#d8c28d" stroke-width="2"/>'
# Ruts, pale sand patches, stones and overhanging verge tufts follow each authored road.
for line,wide in roadLines:
 for i in range(1,int(line.length/72)):
  p=line.interpolate(i*72);q=line.interpolate(min(line.length,i*72+10));dx=q.x-p.x;dy=q.y-p.y;n=math.hypot(dx,dy) or 1;nx=-dy/n;ny=dx/n;side=1 if i%2 else -1
  from shapely.ops import nearest_points
  edge=nearest_points(roadUnion.boundary,Point(p.x+nx*wide*.53*side,p.y+ny*wide*.53*side))[0]
  xx,yy=edge.x,edge.y
  ground+=f'<path d="M{xx-16} {yy+3}q-5 -20 8-10l4-17 8 18q18-8 17 9" fill="#9db93c" stroke="#718d36" stroke-width="3"/>'
  xx=p.x+nx*wide*.32*side;yy=p.y+ny*wide*.32*side
  ground+=f'<ellipse cx="{xx}" cy="{yy}" rx="{4+i%4}" ry="4" fill="#e3c68a" stroke="#a28e61" stroke-width="1.5"/>'
  if i%4==0:ground+=f'<path d="M{xx+14} {yy+5}q-4-11 6-15l14 6 1 10Z" fill="#aaa180" stroke="#7f815b" stroke-width="2"/><path d="M{xx-20} {yy-9}l7-12 13 5-5 11Z" fill="#d3b168" stroke="#b6995c" stroke-width="2"/>'
 # Two subtle broken ruts, clipped to the sand at junctions.
 for off in [-wide*.16,wide*.18]:
  trace=line.parallel_offset(abs(off),'left' if off>0 else 'right');pts=list(trace.coords) if trace.geom_type=='LineString' else []
  if pts:ground+='<path clip-path="url(#roads)" d="M'+' L'.join(f'{x:.1f},{y:.1f}' for x,y in pts)+'" fill="none" stroke="#c9ac72" stroke-width="7" stroke-dasharray="75 65 110 95" opacity=".6"/>'
 ground+='<path clip-path="url(#roads)" d="M'+' L'.join(f'{x:.1f},{y:.1f}' for x,y in line.coords)+'" fill="none" stroke="#ffedbc" stroke-width="28" stroke-dasharray="130 240 55 170" opacity=".4"/>'
# Flower growers cultivate several beds, reed workers keep drying gardens.
for x,y,rx,ry in [(3000,-1050,170,55),(3450,-970,170,55),(3950,-760,170,55),(4950,-450,190,65),(5100,-950,150,75),(1300,6000,160,75),(1700,5900,160,75)]:
 ground+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#9d8d4a" stroke="#6f8337" stroke-width="9"/>'
 for dx in [-100,-50,0,50,100]:ground+=f'<path d="M{x+dx} {y+20}v-30m-10 12 10 8 12-12" fill="none" stroke="#70a15c" stroke-width="6"/><circle cx="{x+dx}" cy="{y-20}" r="12" fill="#f7ca80"/>'
ground+='</g>'
# Sparse lily groups and moving-water marks are painted in real water, clipped away from every bank.
ground+=f'<defs><clipPath id="river-surface"><path d="{dpath(water)}"/></clipPath></defs><g clip-path="url(#river-surface)">'
for pts in [nw,se]:
 line=LineString(pts)
 for distance in [220,610,1080,1530,2080,2640]:
  p=line.interpolate(min(line.length,distance));xx,yy=p.x,p.y
  ground+=f'<path d="M{xx-55} {yy+30}q40-12 90-4m-48-35q35-10 65-2" fill="none" stroke="#b0e4de" stroke-width="6"/><path d="M{xx-45} {yy-20}a27 17 0 1 0 22-18l-15 18Z" fill="#8eae59" stroke="#658e58" stroke-width="3"/><circle cx="{xx-40}" cy="{yy-26}" r="8" fill="#f4dca3"/>'
ground+='</g>'
# Water bank details at authored fishing and planting spots.
for x,y in [(750,1220),(100,800),(8000,3100),(8400,3850),(8500,4500),(4500,6200),(3920,5900),(3050,5540),(-100,3200)]:
 kit('nature--reeds',x,y,130,150)
# New paint cannot show through a translucent part of the original island.
# The retained original shore is a complete overlay, including its antialiasing and water lip.
page='M-10000,-10000 H20000 V20000 H-10000 Z'
ground=f'<defs><clipPath id="extension-only"><path d="{page} {dpath(dry.buffer(165))}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#extension-only)">{ground}</g>'
# Write bounded tiles with a half-resolution SVG backing. Original tiles remain byte-identical on disk.
tiles=[]
for row in range(8):
 for col in range(10):
  tw=width/10;th=height/8;x=origin['x']+col*tw;y=origin['y']+row*th;name=f'communities/ground-{row}-{col}.svg'
  # Skip completely transparent tiles; keep sea pixels in the runtime background.
  if not coast.buffer(100).intersects(Polygon([(x,y),(x+tw,y),(x+tw,y+th),(x,y+th)])):continue
  (A/name).write_text(svg(ground,[x,y,tw,th],[tw/2,th/2]));tiles.append({'src':name,'x':x,'y':y,'width':tw,'height':th,'resolution':1})
# Keep the original SVG structure and paint order. Remove only detached ocean ripple
# strokes beyond the old island's whole silhouette; no extra clip can alter raster rounding.
keep=old.convex_hull.buffer(165)
for t in art['ground']['tiles']:
 src=(A/t['src']).read_text()
 def oceanRipple(match):
  tag=match.group(0);pt=re.search(r'd="M([\d.-]+) ([\d.-]+)',tag)
  return tag if not pt or keep.contains(Point(float(pt[1]),float(pt[2]))) else ''
 src=re.sub(r'<path[^>]*stroke="#B5E4E6"[^>]*/>',oceanRipple,src)
 name='communities/original-'+Path(t['src']).name
 (A/name).write_text(src)
 tiles.append({**t,'src':name})
# New arched timber crossings align with the water polygon. Rectangular walk bridges are supported by the engine.
bridges=[];decks=[];newWalkways=[]
def bridge(name,a,b,wide=210):
 dx=b[0]-a[0];dy=b[1]-a[1];horizontal=abs(dx)>abs(dy);length=math.hypot(dx,dy);W=length if horizontal else wide;H=wide+95 if horizontal else length
 x=min(a[0],b[0])- (0 if horizontal else wide/2);y=min(a[1],b[1])-(wide/2+60 if horizontal else 0)
 body=f'<g stroke="{INK}" stroke-width="5"><path d="M5 55Q{W/2} -15 {W-5} 55V{H-8}Q{W/2} {H-68} 5 {H-8}Z" fill="#d6a565"/>' if horizontal else f'<g stroke="{INK}" stroke-width="5"><path d="M8 0H{W-8}V{H}H8Z" fill="#d6a565"/>'
 if horizontal:
  for xx in range(20,int(W)-8,24):body+=f'<path d="M{xx} 45V{H-24}" fill="none" stroke="#b1834d" stroke-width="3"/>'
  for yy in [30,H-45]:body+=f'<path d="M5 {yy}Q{W/2} {yy-70} {W-5} {yy}" fill="none" stroke="#f4d291" stroke-width="13"/>'
 else:
  for yy in range(10,int(H)-5,24):body+=f'<path d="M12 {yy}H{W-12}" stroke="#ad814c" stroke-width="3"/>'
  body+=f'<path d="M10 0V{H}M{W-10} 0V{H}" stroke="#f0ce8a" stroke-width="12"/>'
 body+='</g>';body=f'<defs><clipPath id="new-deck-only"><path d="{page} {dpath(dry)}" clip-rule="evenodd" transform="translate({-x} {-y})"/></clipPath></defs><g clip-path="url(#new-deck-only)">{body}</g>';src=asset(name,body,W,H);decks.append({'src':src,'x':x,'y':y,'width':W,'height':H,'resolution':1})
 newWalkways.append({'a':a,'b':b,'w':wide,'name':name})
 bridges.append({'x':(a[0]+b[0])/2,'y':(a[1]+b[1])/2,'w':length+30 if horizontal else wide,'h':wide if horizontal else length+30,'name':name})
bridge('west-bank-bridge',[-15,3300],[700,3300]);bridge('north-bank-bridge',[4150,90],[4150,760]);bridge('east-bank-bridge',[7400,3600],[8150,3600]);bridge('south-bank-bridge',[5400,5020],[5400,5700]);bridge('reed-mouth-bridge',[3770,6900],[4700,6900]);bridge('quay-stream-bridge',[-800,300],[-800,850]);bridge('pearl-stream-bridge',[8150,3600],[8800,3600])
# Outer-coast harbour jetty. Original inland decks retain water underneath.
harbor={'jetty':{'foot':[-2140,2400],'tip':[-2450,2400],'width':128},'spawn':read(S/'original-harbor.json')['spawn'],'water':{'x':-2510,'y':2560},'boats':[{'x':-2390,'y':2580,'turn':1.5708},{'x':-2390,'y':2200,'turn':1.5708},{'x':-2600,'y':2390,'turn':1.5708}]}
bridge('outer-quay-jetty',[-2190,2400],[-2450,2400],160)
# Runtime harbour walkway spans the foot. This decorative deck carries no inland water override.
bridges=bridges[:-1]
# Boats need the real dry-bank outline, while walking uses the outer coast plus
# explicit river collision polygons and timber crossings. Even-odd contours encode holes.
boatLand=coast.difference(water).buffer(3)
contours=[]
for p in (list(boatLand.geoms) if boatLand.geom_type=='MultiPolygon' else [boatLand]):
 contours.append([list(a) for a in p.exterior.coords]);contours.extend([list(a) for a in h.coords] for h in p.interiors)
encoded=contours[0].copy();root=encoded[0]
for ring in contours[1:]:encoded += [root,ring[0],*ring[1:],ring[0],root]
shoreContours=[]
for p in (list(coast.difference(water).geoms) if coast.difference(water).geom_type=='MultiPolygon' else [coast.difference(water)]):
 if not p.equals(centre):shoreContours.append([list(a) for a in p.exterior.coords][:-1])
for data in [w,walk]:
 data.update(width=width,height=height,origin=origin,coast=[list(p) for p in coast.exterior.coords][:-1])
 data['boatCoast']=encoded
 data['coastRings']=shoreContours
 data['water']=[{'poly':[list(p) for p in g.exterior.coords],'name':'canal-community-water'} for g in (list(water.geoms) if water.geom_type=='MultiPolygon' else [water])]
 # Water polygons can have dry holes: split into no-hole pieces through triangulation, preserving original land.
 from shapely.ops import split
 # Collision channels leave clear walking strips on the old diagonal timber decks.
 deckStrips=unary_union([LineString([b['a'],b['b']]).buffer(b['w']/2+22) for b in data['walkways'][:11]])
 collisionWater=water.difference(deckStrips).difference(dry.union(Polygon(read(S/'original-walk.json')['coast'])).buffer(22))
 # Clip river collision shapes into spatial cells: a footstep only tests a short local bank.
 from shapely.geometry import box
 waterPieces=[]
 for gx in range(-3000,11000,1000):
  for gy in range(-2500,8500,1000):
   cell=collisionWater.intersection(box(gx,gy,gx+1000,gy+1000))
   pending=list(cell.geoms) if cell.geom_type in ('MultiPolygon','GeometryCollection') else [cell]
   while pending:
    p=pending.pop()
    if p.geom_type!='Polygon' or p.is_empty or p.area<2:continue
    if p.interiors:
     yy=Polygon(p.interiors[0]).representative_point().y
     pending.extend(q for q in split(p,LineString([(-10000,yy),(20000,yy)])).geoms if q.geom_type=='Polygon')
    else:waterPieces.append({'poly':[list(a) for a in p.simplify(.3,preserve_topology=True).exterior.coords][:-1]})
 data['water']=waterPieces
 data['bridges']+=bridges
 data['walkways']+=newWalkways[:-1]
 data['obstacles']+=obstacles
for c in communities:w['zones']['community-'+c['id']]={'name':c['name'],'kind':'community','x':c['cx'],'y':c['cy'],'spawn':c['spawn']}
for p,v in roads:
 clipped=LineString(smooth(p)).difference(dry.buffer(220))
 for line in (list(clipped.geoms) if clipped.geom_type=='MultiLineString' else [clipped]):
  if line.geom_type=='LineString':w['paths'].append([list(p) for p in line.coords]);w['pathWidths'].append(v)
w['props']+=props
art.update(width=width,height=height);art['ground']['tiles']=tiles;art['props']+=props;art['decks']+=decks
write(D/'world.json',w);write(D/'walk-world.json',walk);write(D/'harbor.json',harbor);write(A/'art.json',art)
write(S/'metrics.json',{'oldDryArea':dry.area,'newDryArea':coast.difference(water).area,'landRatio':coast.difference(water).area/dry.area,'originalProps':501,'newProps':len(props),'communities':communities,'bridges':bridges,'waterPieces':len(walk['water']),'groundMBbefore':8000*6000*4/1e6,'groundMBafter':sum((t['width']*t['height']*(.25 if t['src'].startswith('communities/ground') else 1))*4 for t in tiles)/1e6,'tiles':len(tiles)})
write(S/'fixed-commons.json',commons)
print('Built',len(props),'props;',len(tiles),'bounded tiles;',len(walk['water']),'water polygons')
