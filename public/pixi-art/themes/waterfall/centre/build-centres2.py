"""Rebuild centres2 only. Python 3.11 + Pillow + numpy + vtracer.
Procedural pieces follow scripts/themes/centre-build.py; locked mine is palette-flattened and traced.
Run from repository root. Does not change island manifests or shared code.
"""
from pathlib import Path
import math,json,random,re
from PIL import Image,ImageDraw,ImageFilter
import numpy as np,vtracer
ROOT=Path.cwd(); ART=ROOT/'public/pixi-art/themes'; K=36/47; INK='#39452F'
def path(d,c,stroke=INK,sw=2.6,extra=''):return f'<path d="{d}" fill="{c}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'
def ell(x,y,rx,ry,c,stroke=INK,sw=2.6):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" stroke="{stroke}" stroke-width="{sw}"/>'
def rect(x,y,w,h,c,r=0):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}" stroke="{INK}" stroke-width="2.6"/>'
def line(ps,c=INK,w=2.6):return path('M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in ps),'none',c,w)
def poly(ps,c,stroke=INK,sw=2.6):return path('M'+' L'.join(f'{x:.1f} {y:.1f}' for x,y in ps)+'Z',c,stroke,sw)
def arc(rx,ry,a,b,y=0,n=40):return [(rx*math.cos(t),y+ry*math.sin(t)) for t in np.linspace(a,b,n)]
def eshape(x,y,rx,ry):return {'ellipse':dict(x=x,y=y,rx=rx,ry=ry)}
class Centre:
 def __init__(self,t,name):
  self.t=t;self.dir=ART/t/'centre';self.dir.mkdir(exist_ok=True);self.p=[];self.block=[];self.walk=[eshape(0,0,1128,1128*K)];self.water=[]
  self.data=dict(theme=t,name=name,concept=f'concepts/themes/next-centres/{t}-centre-{3 if t=="waterfall" else 1}.png',origin='plaza centre on the walking surface',depthRatio=K,pieces=self.p,outerEdge=dict(x=0,y=0,rx=1150,ry=1150*K),walkable=self.walk,blocked=self.block,stairs=[],spawn=[0,420],water=self.water)
 def add(self,id,body,box,layer='sorted',sort=None,**kw):
  x,y,w,h=map(lambda v:round(v,3),box)
  (self.dir/(id+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x} {y} {w} {h}" stroke-linecap="round" stroke-linejoin="round"><title>{self.data["name"]}: {id}</title><desc>Flat vector artwork for Ducky Land. Home ink weight 2.6 world units.</desc>{body}</svg>')
  p=dict(id=id,file=id+'.svg',layer=layer,x=x,y=y,width=w,height=h,anchor=dict(x=0,y=0),at=[x,y],**kw)
  if sort is not None:p['sortY']=sort
  self.p.append(p);return p
 def save(self):
  # Conservative usable crowd estimate: paving minus furnishings and 80-unit perimeter clearance.
  area=math.pi*1070*(1070*K)-sum(math.pi*b['ellipse']['rx']*b['ellipse']['ry'] for b in self.block if 'ellipse'in b)
  self.data['capacity']=dict(floorArea=round(area),duckies=int(area/(80*80*K)),note='Conservative paving capacity, excludes perimeter clearance and solid furnishings.')
  self.data['integration']={'coordinates':'Centre-local. Translate every x/y, at, sortY and footprint by the island placement origin.','layers':'decal/back below characters; sorted/front/anim interleave by sortY. Preserve piece array order for ties.','animationModule':'animate.mjs' if self.t=='waterfall' else None,'sharedCodeChanged':False}
  (self.dir/'centre.json').write_text(json.dumps(self.data,indent=2)+'\n')

def paving(c):
 r=1150;ry=r*K
 body=ell(0,16,r,ry,'#C88941')+ell(0,0,r,ry,'#F4CF80')+ell(0,0,r-38,ry-29,'#FFF0C7')
 # Voronoi-style irregular flagstones, clipped to the floor ellipse.
 rng=random.Random(24);seeds=[(x+rng.uniform(-50,50),y+rng.uniform(-40,40)) for y in range(-1100,1101,150) for x in range(-1300,1301,180)]
 body+=f'<defs><clipPath id="floor"><ellipse rx="{r-38}" ry="{ry-29}"/></clipPath></defs><g clip-path="url(#floor)">'
 for i,(sx,sy) in enumerate(seeds):
  pts=[(sx-250,sy-250),(sx+250,sy-250),(sx+250,sy+250),(sx-250,sy+250)]
  for tx,ty in seeds:
   if (tx,ty)==(sx,sy) or abs(tx-sx)>450 or abs(ty-sy)>450:continue
   a,b=tx-sx,ty-sy;d=(tx*tx+ty*ty-sx*sx-sy*sy)/2;out=[]
   for u,v in zip(pts,pts[1:]+pts[:1]):
    fu=a*u[0]+b*u[1]-d;fv=a*v[0]+b*v[1]-d
    if fu<=0:out.append(u)
    if (fu<0)!=(fv<0):
     t=fu/(fu-fv);out.append((u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1])))
   pts=out
   if not pts:break
  if pts:body+=poly(pts,['#FFF0C7','#FFEDBF','#FCE7B3','#FFF2CF'][i%4],'#E6C68E',3)
 body+='</g>'+ell(0,0,r-38,ry-29,'none','#D8AD63',2.6)
 c.add('decal-paving',body,(-1155,-ry-5,2310,ry*2+28),'decal')

def bench(c,id,x,y,flip=False):
 # High camera: visible slat tops, four feet and a small backrest.
 b=''
 for xx in [-96,89]:b+=rect(xx, -20,14,53,'#885931',4)
 b+=rect(-118,-56,236,39,'#C88941',5)+rect(-122,-67,244,22,'#E9B56A',4)
 for yy in [-112,-87]:b+=rect(-111,yy,222,22,'#DCA14D',3)+line([(-105,yy+4),(105,yy+4)],'#FFF0C7',3)
 for xx in [-103,98]:b+=rect(xx,-104,9,72,'#A26B31',2)
 b+=line([(-115,-51),(113,-51)],'#FFF0C7',3)
 c.add(id,f'<g transform="translate({x} {y})">{b}</g>',(x-129,y-120,258,161),'sorted',y+33)
 c.block.append(dict(name=id,**eshape(x,y-25,124,52)))
def lamp(c,id,x,y,gold=False):
 b=ell(0,0,19,11,'#A76A2F')+rect(-7,-177,14,174,'#C88941',4)+line([(-3,-166),(-3,-12)],'#F9D38B',3)
 if gold:
  b+=path('M-25 -216 L25 -216 L18 -168 Q0 -156 -18 -168Z','#FFD44B')+rect(-7,-210,14,37,'#FFF5C1',5)+path('M-29 -216 Q-22 -229 0 -238 Q22 -229 29 -216Z','#92744D')+ell(0,-239,5,4,'#F4CF80')
 else:b+=rect(-15,-180,30,24,'#E9B56A',3)+ell(0,-200,27,29,'#FFF0C7')+ell(-8,-209,8,9,'#FFFCED','none')
 c.add(id,f'<g transform="translate({x} {y})">{b}</g>',(x-35,y-249,70,265),'sorted',y+9)
 c.block.append(dict(name=id,**eshape(x,y,22,14)))
def planter(c,id,x,y):
 rng=random.Random(id);b=path('M-53 -42 L53 -42 L43 8 Q0 20 -43 8Z','#C88941')+rect(-59,-54,118,22,'#E9B56A',3)
 for xx,yy,r in [(-35,-60,28),(0,-73,35),(35,-61,28)]:b+=ell(xx,yy,r,r*.7,'#4AA539')
 for xx,yy in [(-29,-73),(24,-71),(0,-95),(2,-49)]:
  for a in range(0,360,72):b+=ell(xx+math.cos(math.radians(a))*12,yy+math.sin(math.radians(a))*10,9,8,'#FFF0C7','none')
  b+=ell(xx,yy,6,6,'#FFB937','none')
 c.add(id,f'<g transform="translate({x} {y})">{b}</g>',(x-69,y-115,138,140),'sorted',y+18)
 c.block.append(dict(name=id,**eshape(x,y,65,33)))

def cliff(c,gold=False):
 if gold:
  b='';rng=random.Random(87)
  # Broad stepped quarry ledges, rather than the waterfall's vertical cliff.
  for tier,xs,yt,yb,w in [(0,range(-1170,1171,260),-1380,-1040,310),(1,[-1320,-1020,-720,600,900,1200],-1130,-850,350),(2,[-1320,-1000,910,1230],-900,-650,330)]:
   for x in xs:
    top=yt+rng.randint(-30,30)+abs(x)*.055;bottom=yb+rng.randint(-10,20)
    pts=[(x-w/2,top+70),(x-w*.30,top),(x+w*.27,top-12),(x+w/2,top+58),(x+w*.46,bottom),(x-w*.48,bottom+10)]
    b+=poly(pts,'#E9A03D')
    b+=poly(pts[:4]+[(x+w*.23,top+94),(x-w*.27,top+106)],'#FFD270')
    b+=poly([pts[3],pts[4],(x+w*.2,bottom-10),(x+w*.23,top+94)],'#D78C35','none')
    b+=line([(x-w*.27,top+107),(x-w*.33,bottom-28)],'#B67B32',3)
  c.add('back-cliff',b,(-1500,-1490,3000,900),'back')
  c.block.append(dict(name='quarry ledges',poly=[[-1500,-1400],[1500,-1400],[1500,-630],[700,-630],[700,-780],[-700,-780],[-700,-630],[-1500,-630]]))
  return
 rng=random.Random(44);bottom=-1080 if not gold else -800;top=-1480 if not gold else -1350
 b=poly([(-1340,bottom-70),(0,bottom-100),(1370,bottom-70),(1370,bottom+190),(800,bottom+110),(0,bottom+10),(-800,bottom+110),(-1340,bottom+190)], '#DB9F55' if not gold else '#E9A03D')
 # Chunked, staggered sandstone columns give a finite silhouette, with cap planes and fissures.
 for i in range(13):
  x=-1320+i*205;yt=top+abs(i-6)*46+rng.randint(-45,25);yb=bottom+abs(i-6)*24
  pts=[(x,yt+70),(x+36,yt),(x+163,yt-15),(x+218,yt+57),(x+223,yb),(x-8,yb+20)]
  b+=poly(pts,'#DB9F55' if not gold else '#E9A03D')
  b+=poly([pts[0],pts[1],pts[2],pts[3],(x+153,yt+92),(x+53,yt+106)],'#F7CD83' if not gold else '#FFD270')
  b+=poly([(x+153,yt+92),pts[3],pts[4],(x+138,yb-20)],'#BD8448' if not gold else '#D68C32','none')
  b+=line([(x+57,yt+109),(x+40,yt+210),(x+75,yt+300)],'#A87845',3)
  if not gold:
   b+=path(f'M{x-4} {yt+70} Q{x-16} {yt+30} {x+40} {yt+18} Q{x+56} {yt-18} {x+100} {yt} Q{x+166} {yt-35} {x+192} {yt+16} Q{x+250} {yt+27} {x+214} {yt+65} Q{x+130} {yt+100} {x+70} {yt+72} Q{x+33} {yt+96} {x-4} {yt+70}Z','#89C332')
   b+=line([(x+48,yt+39),(x+86,yt+27)],'#CDE675',6)
 c.add('back-cliff',b,(-1360,-1580,2800,1000),'back')
 c.block.append(dict(name='cliff base',poly=[[-1340,-1480],[1340,-1480],[1340,-870],[0,-1020],[-1340,-870]] if not gold else [[-1340,-1400],[1340,-1400],[1340,-650],[-1340,-650]]))

def nature(c):
 # Reuse the game's existing tree silhouettes, embedded in the owned centre SVGs.
 for j,(x,y) in enumerate([(-1210,-810),(1210,-810)]):
  src=(ART/'goldmine/reuse/tree-2.svg').read_text();body=src[src.index('>')+1:src.rindex('</svg>')]
  sc=1.15;w=180*sc;h=360*sc
  c.add(f'bank-tree-{j}',f'<g transform="translate({x-w/2} {y-h}) scale({sc})">{body}</g>',(x-w/2-5,y-h-5,w+10,h+10),'sorted',y)
  c.block.append(dict(name=f'bank-tree-{j}',**eshape(x,y,34,26)))
 for j,(x,y) in enumerate([(-1070,-850),(1070,-850),(-1320,-530),(1320,-530)]):
  b=ell(0,0,87,30,'#4AA539')
  for k,ang in enumerate([-155,-130,-105,-75,-50,-25]):
   t=math.radians(ang);ex=math.cos(t)*140;ey=math.sin(t)*170
   b+=path(f'M0 0 Q{ex*.1-35} {ey*.6} {ex} {ey} Q{ex*.9+38} {ey*.4} 0 0Z', '#A9D23B' if k%2 else '#70B83B')
   b+=line([(0,-3),(ex*.83,ey*.82)],'#3D8034',2.6)
  c.add(f'bank-fern-{j}',f'<g transform="translate({x} {y})">{b}</g>',(x-170,y-190,340,230),'sorted',y+12)
  c.block.append(dict(name=f'bank-fern-{j}',**eshape(x,y,75,30)))

def bridge_rails(c):
 pairs=[]
 for side in [-1,1]:
  for yy in [-120,120]:
   for i in range(3):pairs.append(((side*(1150+i*143),yy),(side*(1150+(i+1)*143),yy)))
  for i in range(3):pairs.append(((side*145,900+i*130),(side*145,900+(i+1)*130)))
 for j,((x,y),(xx,yy)) in enumerate(pairs):
  b=line([(x,y-83),(xx,yy-83)],INK,14)+line([(x,y-83),(xx,yy-83)],'#E9B56A',9)
  b+=line([(x,y-33),(xx,yy-33)],'#885931',8)
  for u,v in [(x,y),(xx,yy)]:b+=rect(u-9,v-95,18,100,'#DCA14D',5)+ell(u,v-96,13,10,'#F9D38B')
  c.add(f'bridge-rail-{j:02}',b,(min(x,xx)-18,min(y,yy)-110,abs(xx-x)+36,abs(yy-y)+130),'front',max(y,yy)+6)
  c.block.append(dict(name=f'bridge-rail-{j:02}',poly=[[min(x,xx)-10,min(y,yy)-9],[max(x,xx)+10,min(y,yy)-9],[max(x,xx)+10,max(y,yy)+9],[min(x,xx)-10,max(y,yy)+9]]))

def water_collision(c):
 def cut(poly,a,b,d,keep=True):
  out=[]
  for u,v in zip(poly,poly[1:]+poly[:1]):
   fu=a*u[0]+b*u[1]-d;fv=a*v[0]+b*v[1]-d
   if (fu<=0)==keep:out.append(u)
   if (fu<0)!=(fv<0):
    t=fu/(fu-fv);out.append((u[0]+t*(v[0]-u[0]),u[1]+t*(v[1]-u[1])))
  return out
 def subtract(poly,rect):
  x0,y0,x1,y1=rect;remaining=poly;out=[]
  for a,b,d in [(-1,0,-x0),(1,0,x1),(0,-1,-y0),(0,1,y1)]:
   outside=cut(remaining,a,b,d,False)
   if len(outside)>2:out.append(outside)
   remaining=cut(remaining,a,b,d)
   if not remaining:break
  return out
 for i in range(72):
  a=i*math.tau/72;b=(i+1)*math.tau/72
  polys=[arc(1480,1480*K,a,b,n=3)+arc(1150,1150*K,b,a,n=3)]
  for r in [(-1600,-120,-1090,120),(1090,-120,1600,120),(-145,810,145,1310)]:polys=[q for p in polys for q in subtract(p,r)]
  c.water.extend({'poly':[[round(x,2),round(y,2)]for x,y in p]} for p in polys)
 c.data['waterNote']='Actual water sectors exclude the circular deck and all three access bridges. Copy these polygons, not the visual full-pool ellipse, to both world and walk-world water arrays.'

def waterfall():
 c=Centre('waterfall','Waterfall viewing circle');R=1480
 c.add('decal-water',ell(0,0,R,R*K,'#11B9C3')+ell(0,-80,R-35,R*K-38,'none','#75DEE0',8),(-1485,-1220,2970,2420),'decal')
 cliff(c)
 # One broad fall, exactly as locked, flowing into the pool behind the circular deck.
 d='M-210 -1390 Q0 -1432 210 -1390 L220 -930 Q0 -870 -220 -930Z'
 c.add('water-sheet',path(d,'#43D0DF')+path('M-196 -1380 Q-180 -1210 -205 -950 L-163 -931 Q-139 -1200 -155 -1388Z','#85EBED','none')+path('M162 -1390 Q180 -1200 170 -944 L204 -946 L200 -1382Z','#A0F1EE','none')+path('M-208 -1384 Q-168 -1420 -130 -1388 Q-80 -1408 -42 -1389 Q0 -1415 45 -1388 Q100 -1410 137 -1388 Q184 -1415 210 -1386','none','#FFFBE9',12),(-227,-1430,454,540),'back')
 for j in range(7):
  x=-175+j*56;y=-1350+(j%3)*46
  c.add(f'flow-{j}',path(f'M{x} {y} Q{x-7} {y+55} {x} {y+108}','none','#DFFFF1',7), (x-13,y-7,26,125),'anim',-920,animate=dict(kind='flow',period=1.25+j*.07,travel=200,phase=j*.137))
 for j in range(3):
  c.add(f'impact-ripple-{j}',ell(0,-910,260,47,'none','#E3FFF1',5),(-266,-963,532,106),'anim',-900,animate=dict(kind='ripple',period=2.1,phase=j/3,pivot=[0,-910]))
 b=''
 for i in range(10):b+=ell(-212+i*47,-937+(i%3)*8,34,28,'#F5FFF0','none')
 c.add('foam',b,(-252,-975,510,83),'anim',-890,animate=dict(kind='foam',period=1.8,phase=0))
 # Deck supports below the slab; pool ripples stay behind the paving.
 for j,a in enumerate([.17,.45,.78,1.08,1.92,2.25,2.65,2.97]):
  x=1100*math.cos(a);y=1100*K*math.sin(a)
  c.add(f'support-{j}',rect(x-19,y,38,120,'#BA813D',5)+line([(x-11,y+4),(x-11,y+110)],'#E9B56A',5),(x-25,y-6,50,135),'back')
  c.add(f'pool-ripple-{j}',ell(x,y+122,45,18,'none','#C6F7E9',4),(x-51,y+98,102,48),'anim',y-1,animate=dict(kind='ripple',period=2.6,phase=j*.17,pivot=[x,y+122]))
 paving(c)
 # Three level access bridges. Their full walking polygons are supplied separately.
 for name,pts in [('west',[(-1580,-120),(-1090,-120),(-1090,120),(-1580,120)]),('east',[(1090,-120),(1580,-120),(1580,120),(1090,120)]),('south',[(-145,810),(145,810),(145,1290),(-145,1290)])]:
  b=poly(pts,'#F6D899')
  if name=='south':
   for y in range(850,1290,82):b+=line([(-140,y),(140,y)],'#D9AE66',3)
  else:
   for x in range(int(pts[0][0])+50,int(pts[1][0]),85):b+=line([(x,-115),(x,115)],'#D9AE66',3)
  c.add(f'bridge-{name}',b,(-1585,-125,3170,1420),'decal');c.walk.append(dict(poly=pts))
 # Rail sections follow the deck ellipse, leaving three wide openings.
 for j in range(36):
  a=j*math.tau/36;b=(j+1)*math.tau/36;mid=(a+b)/2
  if abs(math.sin(mid))<.17 or abs(mid-math.pi/2)<.19:continue
  pts=arc(1138,1138*K,a,b);x,y=pts[0];xx,yy=pts[-1]
  body=line([(u,v-90)for u,v in pts],'#39452F',15)+line([(u,v-90)for u,v in pts],'#E9B56A',10)+line([(u,v-38)for u,v in pts],'#885931',10)+line([(u,v-38)for u,v in pts],'#DCA14D',6)
  body+=rect(x-11,y-99,22,105,'#DCA14D',6)+ell(x,y-100,15,11,'#F9D38B')
  body+=rect(xx-11,yy-99,22,105,'#DCA14D',6)+ell(xx,yy-100,15,11,'#F9D38B')
  c.add(f'rail-{j:02}',body,(min(x,xx)-20,min(y,yy)-117,abs(xx-x)+40,abs(yy-y)+134),'front' if math.sin(mid)>0 else 'sorted',max(y,yy)+8)
  c.block.append(dict(name=f'rail-{j:02}',poly=[(u,v-8)for u,v in pts]+[(u,v+14)for u,v in reversed(pts)]))
 for j,(x,y)in enumerate([(-410,-640),(410,-640),(-760,460),(760,460)]):bench(c,f'bench-{j}',x,y)
 for j,(x,y)in enumerate([(-570,-700),(570,-700),(-980,140),(980,140),(-260,770),(260,770)]):lamp(c,f'lamp-{j}',x,y)
 for j,(x,y)in enumerate([(-905,-360),(905,-360),(-390,700),(390,700)]):planter(c,f'planter-{j}',x,y)
 nature(c);bridge_rails(c);water_collision(c)
 # Move the fall and impact foam back from the viewing rail so the whole splash reads clearly.
 for p in c.p:
  if p['id'] in ['water-sheet','foam'] or p['id'].startswith(('flow-','impact-ripple-')):
   f=c.dir/p['file'];svg=f.read_text();svg=svg.replace(f'viewBox=\"{p["x"]} {p["y"]} ',f'viewBox=\"{p["x"]} {p["y"]-70} ')
   body_start=svg.index('</desc>')+7;svg=svg[:body_start]+'<g transform=\"translate(0 -70)\">'+svg[body_start:svg.rindex('</svg>')]+'</g></svg>';f.write_text(svg)
   p['y']-=70;p['at'][1]-=70
   if 'sortY'in p:p['sortY']-=70
   if p.get('animate',{}).get('pivot'):p['animate']['pivot'][1]-=70
 c.data['access']=[dict(name=n,point=p,width=240)for n,p in [('west',[-1580,0]),('east',[1580,0]),('south',[0,1290])]]
 c.data['animation']={'module':'animate.mjs','export':'animateCentre','note':'SVG textures are static in Pixi. Call the supplied module every frame for the flow, foam and ripple pieces. Never animate the stone or rails.'}
 c.save()

def trace_mine(c):
 src=ROOT.parent/'concepts/themes/next-centres/goldmine-centre-1.png';im=Image.open(src).convert('RGB')
 # Author-selected silhouette from the LOCKED image. No generated replacement landmark.
 pts=[(383,339),(386,315),(401,298),(425,287),(449,301),(450,159),(450,139),(460,135),(459,108),(510,99),(514,38),(522,32),(531,39),(531,54),(580,65),(562,82),(533,83),(533,98),(608,108),(608,137),(615,142),(615,157),(605,161),(610,242),(621,242),(612,218),(611,186),(626,174),(641,129),(673,78),(713,35),(754,12),(784,6),(817,11),(847,29),(878,63),(903,111),(925,170),(929,186),(943,211),(938,150),(934,141),(934,115),(980,101),(986,41),(994,37),(1001,44),(1000,55),(1041,66),(1024,81),(1001,82),(1000,99),(1071,110),(1070,137),(1078,141),(1078,164),(1141,130),(1151,128),(1161,137),(1156,151),(1151,155),(1172,209),(1183,217),(1179,240),(1164,251),(1133,253),(1119,244),(1110,217),(1120,211),(1138,159),(1074,199),(1074,265),(1049,278),(1045,310),(1058,333),(1045,356),(1011,359),(973,358),(959,352),(944,360),(903,355),(887,359),(868,354),(866,361),(811,360),(811,390),(728,390),(731,361),(673,361),(657,364),(645,364),(620,363),(587,365),(574,357),(531,355),(515,346),(484,354),(451,350),(414,353),(390,345)]
 mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(pts,fill=255)
 box=(378,0,1190,398);im=im.crop(box).filter(ImageFilter.MedianFilter(3));mask=mask.crop(box)
 # Flat 24-colour palette, no gradients or raster payload in the final SVG.
 q=im.quantize(colors=24,method=Image.Quantize.MEDIANCUT).convert('RGB');a=np.array(q);dark=(a.astype(int).sum(2)<260);a[dark]=[57,69,47]
 rgba=Image.fromarray(a).convert('RGBA');rgba.putalpha(mask)
 tmp=Path('/private/tmp/centres2-mine-trace.png');rgba.save(tmp);out=c.dir/'mine-landmark.svg'
 vtracer.convert_image_to_svg_py(str(tmp),str(out),colormode='color',hierarchical='stacked',mode='spline',filter_speckle=5,color_precision=8,layer_difference=12,corner_threshold=60,length_threshold=4,max_iterations=10,splice_threshold=45,path_precision=1)
 s=out.read_text();body=s[s.index('<path'):s.rindex('</svg>')];scale=1.65;x=-670;y=-1335;w=812*scale;h=398*scale
 c.add('mine-landmark',f'<g transform="translate({x} {y}) scale({scale})">{body}</g>',(x,y,w,h),'sorted',-679,provenance='Vector trace of the locked goldmine-centre-1.png, 24 flat colours.')
 c.block.append(dict(name='mine facade and tracks',poly=[[-670,-830],[670,-830],[670,-680],[-670,-680]]))

def goldmine():
 c=Centre('goldmine','Golden egg mine plaza');paving(c);cliff(c,True);trace_mine(c)
 for j,(x,y)in enumerate([(-845,-440),(845,-440),(-875,490),(875,490),(0,825)]):bench(c,f'bench-{j}',x,y)
 for j,(x,y)in enumerate([(-1005,-280),(1005,-280),(-690,-630),(690,-630),(-1050,400),(1050,400),(-335,820),(335,820)]):lamp(c,f'lantern-{j}',x,y,True)
 for j,(x,y)in enumerate([(-1020,-550),(1020,-550),(-555,730),(555,730)]):planter(c,f'flowers-{j}',x,y)
 nature(c)
 c.data['door']=dict(point=[0,-650],facing='south',note='Mine doorway approach, the landmark stays solid until a separate interior is provided.')
 c.save()
if __name__=='__main__':
 waterfall();goldmine()
 for t in ['waterfall','goldmine']:
  d=json.loads((ART/t/'centre/centre.json').read_text());print(t,len(d['pieces']),'pieces',d['capacity'])
