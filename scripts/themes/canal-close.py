"""Close-up craft pass. Only Canal files, deterministic and repeatable from saved intake."""
from pathlib import Path
import json,math,random,re
import xml.etree.ElementTree as ET
from shapely.geometry import Point,Polygon,LineString,box
from shapely.affinity import scale
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[2]; A=ROOT/'public/pixi-art/themes/canal'; D=ROOT/'assets/world/themes/canal'; W=ROOT.parent/'concepts/themes/work/canal'
read=lambda p:json.loads(p.read_text())
a=read(W/'close-start-art.json');w=read(W/'close-start-world.json');walk=read(W/'close-start-walk-world.json');rng=random.Random(5292)
def ellipse(x,y,rx,ry):return scale(Point(x,y).buffer(1,quad_segs=48),rx,ry)
land=unary_union([Polygon(w['coast'])]+[ellipse(*v) for v in w['islets']])
route=unary_union([LineString(p).buffer(v/2,quad_segs=24) for p,v in zip(w['paths'],w['pathWidths'])]).buffer(40).buffer(-40)
decks=unary_union([LineString([p['a'],p['b']]).buffer(p['w']/2+50) for p in w['walkways']])
zones={n:z for n,z in w['zones'].items() if n.startswith(('activity-','stalls-'))}
def zone(z,margin=0):return box(z['x0']-margin,z['y0']-margin,z['x1']+margin,z['y1']+margin) if 'x0' in z else ellipse(z['x'],z['y'],z['rx']+margin,z['ry']+margin)
reserve=unary_union([zone(z) for z in zones.values()]);beds=read(A/'resolved-sleepers.json')
sleep=unary_union([ellipse(b['x'],b['y'],b['r']+65,110) for b in beds])
def dshape(g):
 ps=list(g.geoms) if hasattr(g,'geoms') else [g]
 def line(p):return 'M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in p)+'Z'
 return ' '.join(line(p.exterior.coords)+' '+' '.join(line(i.coords) for i in p.interiors) for p in ps if p.geom_type=='Polygon')
def path(g,fill,stroke='none',sw=1):return f'<path d="{dshape(g)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" fill-rule="evenodd"/>'
def svg(body,vb):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{vb[2]}" height="{vb[3]}" viewBox="'+ ' '.join(map(str,vb))+'" stroke-linejoin="round" stroke-linecap="round">'+''.join(body)+'</svg>'
def sector(r0,r1,start,end,k=.766):
 pts=[(r1*math.cos(start+(end-start)*i/12),r1*k*math.sin(start+(end-start)*i/12)) for i in range(13)]
 pts += [(r0*math.cos(start+(end-start)*i/12),r0*k*math.sin(start+(end-start)*i/12)) for i in range(12,-1,-1)]
 return Polygon(pts)
# Alternate large warm limestone voussoirs, with staggered radial joints like Home.
floor=[f'<ellipse rx="914" ry="700.1" fill="#FFF0C7" stroke="#AB916D" stroke-width="3"/>']
for j,(r0,r1,n) in enumerate([(0,295,24),(295,455,28),(455,600,36),(600,735,44),(735,900,52),(900,914,76)]):
 for i in range(n):
  start=(i+j*.5)*math.tau/n; end=start+math.tau/n
  fill=['#FFE598','#FFF1CA','#FCE5A4','#FFF1CA'][(i+2*j)%4]
  floor.append(path(sector(r0,r1,start,end),fill,'#B7A16E',.85))
  if i%4==0 and j<5:floor.append(path(sector(r0,r1,start,start+.013),'#E9CE87'))
# Thin teal-and-cream shell mosaic bands support the fountain, leaving the walking ring clear.
for r,sw in [(291,10),(303,4),(600,8),(735,10),(899,9)]:
 floor += [f'<ellipse rx="{r}" ry="{r*.766:.2f}" fill="none" stroke="#B89C69" stroke-width="{sw+3}"/>',f'<ellipse rx="{r}" ry="{r*.766:.2f}" fill="none" stroke="{"#86BBB1" if r in [291,735] else "#FFF6D9"}" stroke-width="{sw}"/>']
# Eight shell medallions in the generous outer walking band.
for i in range(8):
 ang=(i+.5)*math.tau/8;x=665*math.cos(ang);y=665*.766*math.sin(ang)
 floor.append(f'<g transform="translate({x:.2f} {y:.2f}) scale(1 .766)"><path d="M-38 21 Q-58-3-36-27 Q-20-43-7-31 Q0-48 10-31 Q30-41 43-20 Q56 4 33 23 L10 35 L-10 35Z" fill="#C3D8BD" stroke="#A58D62" stroke-width="1.5"/><path d="M-8 29 L-31-18 M0 28 L-6-27 M8 29 L29-21 M-29 26 L29 26" fill="none" stroke="#9DAD8D" stroke-width="2"/></g>')
# Existing Home arc benches sit on these two seating bands.
for r in [480,830]:
 floor += [f'<ellipse rx="{r}" ry="{r*.766:.2f}" fill="none" stroke="#B29968" stroke-width="44"/>',f'<ellipse rx="{r}" ry="{r*.766:.2f}" fill="none" stroke="#E4C381" stroke-width="40"/>']
 for i in range(80 if r>500 else 48):
  t=i*math.tau/(80 if r>500 else 48)
  floor.append(f'<path d="M{(r-20)*math.cos(t):.1f} {(r-20)*.766*math.sin(t):.1f} L{(r+20)*math.cos(t):.1f} {(r+20)*.766*math.sin(t):.1f}" stroke="#AC9467" stroke-width="1.4"/>')
(A/'detail/fountain-rings.svg').write_text(svg(floor,[-930,-720,1860,1440]))
# Same locked fountain art and water animation, enlarged as one assembly around its ground origin.
for p in a['props']:
 if p['id'] in ['integrated-centre-fountain','integrated-centre-fountain-jets']:
  factor=1.45;p['x']=4000+(p['x']-4000)*factor;p['y']=3320+(p['y']-3320)*factor
  p['sortY']=p['y'];p['width']*=factor;p['height']*=factor
for o in w['obstacles']:
 if not o.get('centre') or 'poly' not in o:continue
 q=Polygon(o['poly'])
 if abs(q.centroid.x-4000)<2 and abs(q.centroid.y-3320)<2 and 340<q.bounds[2]-q.bounds[0]<350:
  o['poly']=[[4000+(x-4000)*1.45,3320+(y-3320)*1.45] for x,y in o['poly']]
# Keep a full Ducky lane between the larger basin and the north seating corners.
for p in a['props']:
 if p['id'] in ['canal-ten-planter-1','canal-ten-planter-2']:
  oldy=p['y'];p['y']=3000
  for o in w['obstacles']:
   if o.get('canalTenPlanter') and abs(o['x']-p['x'])<1 and abs(o['y']-(oldy-8))<1:o['y']=2992
# Ground detail follows every curved route, plus stone-edged lawn courts.
edge=[]
edge.append(path(route.buffer(9).difference(route).intersection(land).difference(ellipse(4000,3320,1020,800)),'#87AB31'))
for name,z in zones.items():
 outer=zone(z,12);inner=zone(z,-12);rim=outer.difference(inner).difference(route.buffer(5)).intersection(land)
 edge.append(path(rim,'#F6E5B5','#BAA474',1.5))
 if 'x0' not in z:
  for i in range(64):
   t=i*math.tau/64;x=z['x']+z['rx']*math.cos(t);y=z['y']+z['ry']*math.sin(t)
   joint=LineString([(x-15*math.cos(t),y-15*math.sin(t)),(x+15*math.cos(t),y+15*math.sin(t))]).buffer(.65)
   edge.append(path(joint.intersection(rim),'#A78E60'))
 else:
  for x in range(z['x0']+35,z['x1'],58):
   for y in [z['y0'],z['y1']]:edge.append(path(box(x-1,y-13,x+1,y+13).intersection(rim),'#A78E60'))
# Three broad joins get fan-laid limestone, clipped to the existing path. The
# fan follows the turn rather than leaving a flat sand bulb or a square patch.
for cx,cy,turn in [(1370,3020,20),(6480,4000,-35),(1600,2200,35)]:
 for row in range(5):
  r0=35+row*32;r1=r0+32;n=10+row*4
  for i in range(n):
   start=(i+(row%2)*.5)*math.tau/n+math.radians(turn)
   q=sector(r0,r1,start,start+math.tau/n)
   from shapely.affinity import translate
   q=translate(q,cx,cy).intersection(route.buffer(-10))
   if not q.is_empty:edge.append(path(q,['#FFE59B','#FFF0BF','#F8DF9B'][(i+row)%3],'#C1AA70',1.0))
# Worn little stone sets on junction aprons, each cluster reads as a join, never another sand disc.
for p in w['paths']:
 for x,y in [p[0],p[-1]]:
  for j in range(2):
   for i in range(-1,2):
    xx=x+i*43+rng.uniform(-12,12);yy=y+(j-.5)*53+rng.uniform(-8,8)
    stone=ellipse(xx,yy,rng.uniform(3,7),rng.uniform(2,4))
    if route.buffer(-20).contains(stone) and not ellipse(4000,3320,1050,830).intersects(stone):edge.append(path(stone,'#ECCB7C','none',.8))
# Put the joined paths above the lawn fills. They were previously painted over by
# the courts, leaving hidden route fragments and green cuts through the junctions.
NS='http://www.w3.org/2000/svg';ET.register_namespace('',NS)
ground=ET.fromstring((A/'ground.svg').read_text())
for e in list(ground):
 if e.get('id')=='canal-close-finish':ground.remove(e)
finish=ET.Element('{'+NS+'}g',{'id':'canal-close-finish'})
finish.append(ET.fromstring('<g xmlns="'+NS+'">'+path(route.intersection(land).difference(ellipse(4000,3320,1000,780)),'#FFE399','#AD963E',2.5)+'</g>'))
finish.append(ET.fromstring('<g xmlns="'+NS+'">'+''.join(edge)+'</g>'));ground.append(finish)
body=ET.tostring(ground,encoding='unicode');(A/'ground.svg').write_text(body)
for t in a['ground']['tiles']:
 tile=re.sub(r'<svg\b[^>]*>',f'<svg xmlns="{NS}" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}" stroke-linecap="round" stroke-linejoin="round">',body,count=1)
 (A/t['src']).write_text(tile)
# Tufts and little stones outside full-width paths. Home's actual reusable assets.
edgeDetail=0
for p,v in zip(w['paths'],w['pathWidths']):
 line=LineString(p)
 for dist in range(25,int(line.length),65):
  q=line.interpolate(dist);q0=line.interpolate(max(0,dist-5));q1=line.interpolate(min(line.length,dist+5));dx=q1.x-q0.x;dy=q1.y-q0.y;length=math.hypot(dx,dy)
  for side in [-1,1]:
   r=v/2+rng.uniform(24,58);x=q.x-side*dy/length*r;y=q.y+side*dx/length*r;pt=Point(x,y)
   if not land.buffer(-45).contains(pt) or route.buffer(15).contains(pt) or decks.contains(pt) or ellipse(4000,3320,1080,850).contains(pt):continue
   if any(math.hypot(x-b['x'],y-b['y'])<80 for b in beds):continue
   src,ww,hh=rng.choice([('grass-tuft-1',44,26),('grass-tuft-2',34,22),('pebble-1',22,14),('flower-dot-1',20,18)])
   a['flats'].append(dict(id=f'canal-close-edge-{edgeDetail}',src=f'reuse/{src}.svg',x=round(x,1),y=round(y,1),width=ww*1.35,height=hh*1.35));edgeDetail+=1
# Floor plants follow the visible grass after the paths are restored above the lawns.
a['flats']=[p for p in a['flats'] if not ('reuse/' in p['src'] and any(t in p['src'] for t in ['grass-tuft','flower-dot','pebble','edge-stone']) and route.buffer(8).contains(Point(p['x'],p['y'])))]
# Rim furnishings are outside all play reservations and full-width paths.
newprops=[]
def safe(x,y,rx=45,ry=25):
 f=ellipse(x,y,rx+8,ry+8)
 if not land.buffer(-35).contains(f) or any(f.intersects(g) for g in [route.buffer(18),decks,reserve.buffer(8),sleep]):return False
 for p in a['props']+newprops:
  width=p['width']*p.get('scale',1);r=width*.43 if 'tree' in p.get('name','').lower() else min(120,width*.45)
  if math.hypot(x-p['x'],(y-p['y'])*1.25)<r+rx+30:return False
 return True
for j,(name,z) in enumerate(zones.items()):
 if 'x0' in z:
  candidates=[(x,z['y0']-65) for x in range(z['x0']+40,z['x1'],155)]+[(x,z['y1']+65) for x in range(z['x0']+100,z['x1'],180)]
 else:candidates=[(z['x']+(z['rx']+68)*math.cos(i*math.tau/20),z['y']+(z['ry']+68)*math.sin(i*math.tau/20)) for i in range(20)]
 for i,(x,y) in enumerate(candidates):
  if not safe(x,y):continue
  src='reuse/lamp-lantern.svg' if i%3==0 else 'reuse/street--planter-flowers.svg';template=next(p for p in a['props'] if p['src']==src);h=180 if i%3==0 else 100
  p={**template,'id':f'canal-close-rim-{j}-{i}','name':'Court rim lantern' if i%3==0 else 'Court rim flower planter','x':round(x,2),'y':round(y,2),'scale':h/template['height'],'flip':False};newprops.append(p)
  w['obstacles'].append(dict(x=p['x'],y=p['y']-8,rx=16 if i%3==0 else 36,ry=14 if i%3==0 else 22,canalClose=True))
# Upgrade the already-authored border flowers in place, keeping the same safe anchors.
upgraded=0
for p in a['props']:
 if p.get('name')!='Garden border flowers':continue
 x,y=p['x'],p['y'];f=ellipse(x,y,38,24)
 if any(f.intersects(g) for g in [reserve,route.buffer(10),sleep]):continue
 src='reuse/lamp-lantern.svg' if upgraded%3==0 else 'reuse/street--planter-flowers.svg'
 template=next(q for q in a['props'] if q['src']==src)
 p.update(src=src,width=template['width'],height=template['height'],scale=(175 if upgraded%3==0 else 92)/template['height'],anchor=template['anchor'],name='Court rim lantern' if upgraded%3==0 else 'Court rim flower planter')
 w['obstacles'].append(dict(x=x,y=y-8,rx=14 if upgraded%3==0 else 32,ry=12 if upgraded%3==0 else 20,canalClose=True));upgraded+=1
# Long lawn courts have room for furniture at the short ends and the outside edge.
for j,(name,z) in enumerate(zones.items()):
 candidates=[]
 if 'x0' in z:
  candidates=[(z['x0']-85,z['y']),(z['x1']+85,z['y'])]
  candidates += [(x,z['y0']-145) for x in range(z['x0']+80,z['x1']-60,200)]
  candidates += [(x,z['y1']+145) for x in range(z['x0']+80,z['x1']-60,200)]
 for i,(x,y) in enumerate(candidates):
  if not safe(x,y,30,20):continue
  template=next(p for p in a['props'] if p['src']=='reuse/lamp-lantern.svg');p={**template,'id':f'canal-close-court-{j}-{i}','name':'Market court rim lantern','x':x,'y':y,'scale':175/template['height']};newprops.append(p)
  w['obstacles'].append(dict(x=x,y=y-8,rx=14,ry=12,canalClose=True))
a['props']+=newprops
# Find genuine curved seating positions outside each activity reservation. Reject paths,
# sleeper silhouettes, buildings and tree crowns; draw them with Home's bench function.
benchSpecs=[]
for name,z in zones.items():
 if 'x0' in z:continue
 count=0
 for deg in [90,60,120,-90,-60,-120,0,180,30,150,-30,-150]+list(range(-175,180,5)):
  rx=z['rx']+42;ry=z['ry']+42;span=20
  def pt(t,r):return (z['x']+r*math.cos(t),(z['y']+(ry/rx)*r*math.sin(t)))
  footprint=Polygon([pt(math.radians(deg-span/2+i*span/24),rx-24) for i in range(25)]+[pt(math.radians(deg-span/2+i*span/24),rx+28) for i in range(24,-1,-1)])
  if not land.contains(footprint) or any(footprint.intersects(g) for g in [reserve,route.buffer(15),decks,sleep]):continue
  x,y=pt(math.radians(deg),rx)
  nearby=[]
  for p in a['props']:
   if math.hypot(p['x']-x,(p['y']-y)*1.25)<(210 if 'tree' in p.get('name','').lower() else 135):nearby.append(p)
  # Nearby low flowers can sit behind the seat. Keep every solid footprint,
  # tree crown, lamp and sleeping Ducky out of the bench silhouette.
  solid=[p for p in nearby if any(v in p.get('name','').lower() for v in ['tree','house','lamp','lantern','bench','planter','bush','rock'])]
  if solid or any(Polygon(b['footprint']).distance(footprint)<50 for b in benchSpecs):continue
  benchSpecs.append(dict(zone=name,deg=deg,r=rx,ratio=ry/rx,span=span,cx=z['x'],cy=z['y'],footprint=list(footprint.exterior.coords)));count+=1
  if count==2:break
(A/'close-bench-specs.json').write_text(json.dumps(benchSpecs,indent=2))
w['props']=a['props'];walk['obstacles']=w['obstacles']
for p,obj in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk)]:p.write_text(json.dumps(obj,separators=(',',':')))
metrics=dict(fountainScale=1.45,fountainWidth=500.395,lockedCentreSourceUnchanged=True,pavingRings=6,shellMedallions=8,finishedCourtEdges=len(zones),fanPavingJoins=3,pathEdgeDecals=edgeDetail,newRimFurnishings=len(newprops),upgradedRimFurnishings=upgraded,activityCurvedBenches=len(benchSpecs))
(A/'close-metrics.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics,indent=2))
