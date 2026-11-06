"""Build only the two locked centre folders. Run from the repository root with the centre-trace Python venv.
Landmarks: built-in imagegen -> scripts/themes/centre-trace.py. Ground and split props: centre-build.py helpers.
No island, engine, world, or shared script writes.
"""
import importlib.util, pathlib, json, math, re, random, shutil
ROOT=pathlib.Path(__file__).resolve().parents[5]
spec=importlib.util.spec_from_file_location('centre',ROOT/'scripts/themes/centre-build.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
K=m.K; INK=m.INK; SW=2.6
CREAM='#FFF0C7'; STONE='#F3E3B5'; JOINT='#DECA96'; WOOD='#C88941'; GOLD='#E9B23A'; LEAF='#4AA539'

def path(d,f='none',s=INK,w=SW): return f'<path d="{d}" fill="{f}" stroke="{s}" stroke-width="{w}"/>'
def ellipse(x,y,rx,ry,f,s=INK,w=SW):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{f}" stroke="{s}" stroke-width="{w}"/>'
def rect(x,y,w,h,f,s=INK,sw=SW,r=0):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{f}" stroke="{s}" stroke-width="{sw}"/>'
def group(el,x=0,y=0,scale=1):return f'<g transform="translate({x} {y}) scale({scale})">{el}</g>'

def blossom(x,y,c,r=9):
 el=''
 for a in range(0,360,72):
  t=math.radians(a);el+=ellipse(x+math.cos(t)*r*.75,y+math.sin(t)*r*.75,r*.65,r*.65,c,'none')
 return el+ellipse(x,y,r*.36,r*.36,'#FFCF44','none')

def flowers(seed=1):
 rng=random.Random(seed);el=''
 for i in range(13):
  x,y=rng.uniform(-43,43),rng.uniform(-25,5)
  el+=ellipse(x,y,13,10,LEAF,INK,1.8)
 for i in range(11):el+=blossom(rng.uniform(-39,39),rng.uniform(-30,1),['#F4A3C0','#FFF9DF','#FFCD49'][i%3],8)
 return el

def pot(seed=1):return path('M-34 -22 L-27 25 Q0 47 27 25 L34 -22Z','#DFA052')+ellipse(0,-22,35,13,WOOD)+group(flowers(seed),0,-18)

def bench():
 el=''
 for x in [-70,62]:el+=rect(x,-25,11,54,'#657548',r=3)
 for y in [-66,-46]:el+=rect(-86,y,172,17,'#DFA052',r=4)+path(f'M-80 {y+4} H78','none',CREAM,2)
 el+=path('M-88 -22 L-73 -35 L76 -35 L88 -22 L82 -8 L-84 -8Z','#E6AE62')
 return el+path('M-84 -19 H82','none',CREAM,2.5)

def lamp():
 return ellipse(0,0,16,7,WOOD)+rect(-5,-150,10,147,WOOD,r=4)+ellipse(0,-147,9,5,WOOD)+path('M-17 -190 L-13 -154 Q0 -143 13 -154 L17 -190Z','#FFF6D5')+path('M-15 -188 L-10 -156','none','#FFFFFF',3)+ellipse(0,-190,20,9,WOOD)+ellipse(0,-202,4,6,GOLD)

def stall(color,seed):
 el=rect(-91,-133,182,115,'#AA743C')
 for x in [-91,79]:el+=rect(x,-204,12,211,WOOD,r=2)+path(f'M{x+3} -196 V-3','none',CREAM,2)
 el+=path('M-95 -69 L-80 -91 L80 -91 L95 -69 L90 5 L-90 5Z','#E6AC60')
 for x in [-61,-20,21,62]:el+=path(f'M{x} -62 V-1','none','#AE793C',2)
 el+=rect(-93,-71,186,14,GOLD,r=2)
 if seed%2:el+=group(flowers(seed),-45,-79,.83)+group(flowers(seed+1),45,-79,.83)
 else:
  for j in range(10):
   x=-73+(j%5)*36;y=-82-(j//5)*19
   el+=ellipse(x,y,13,11,['#A4CA42','#F16E4B','#FFCE4D'][j%3])+path(f'M{x} {y-10} l3 -7','none',LEAF,3)
 for j in range(8):
  a=-110+j*27.5;b=a+27.5;at=-91+j*22.75;bt=at+22.75;c=color if j%2==0 else '#FFF8DF'
  el+=path(f'M{at} -217 L{bt} -217 L{b} -163 L{a} -163Z',c,'none')
  el+=path(f'M{a} -163 H{b} V-152 Q{(a+b)/2} -137 {a} -152Z',c,INK,1.7)
 el+=path('M-110 -163 L-91 -217 H91 L110 -163','none',INK,SW)
 return el

class Centre:
 def __init__(s,t,name,concept):
  s.t=t;s.folder=pathlib.Path(m.ART)/t/'centre';s.pieces=[];s.ob=[];s.walk=[]
  s.data=dict(theme=t,name=name,concept=concept,origin='plaza ground centre; x right, y down; all geometry centre-local',depthRatio=round(K,6),pieces=s.pieces)
 def add(s,id,el,bounds,layer='sorted',sort=None,note=None):
  p=m.Piece(s.t,id,id.replace('-',' '));p.add(el);p.write(bounds=bounds,pad=4)
  e=m.entry(p,layer)
  if layer in ['sorted','front']:e['sortY']=round(sort if sort is not None else bounds[3],2)
  if note:e['note']=note
  s.pieces.append(e);return e
 def prop(s,id,el,x,y,bounds,foot):
  x0,y0,x1,y1=bounds
  s.add(id,group(el,x,y),(x+x0,y+y0,x+x1,y+y1),sort=y+foot[1])
  s.ob.append((id,m.ell(x,y,foot[0],foot[1])))
 def trace(s,id,x,y,rx,ry):
  e=m.sorted_entry(s.t,id,(x,y),.5,1);s.pieces.append(e)
  s.ob.append((id,m.ell(x,y-ry,rx,ry)))
 def finish(s):
  free=unary_union(s.walk).difference(unary_union([g for _,g in s.ob]));area,n=m.capacity(free,Polygon())
  # Keep polygon holes explicit; world integration must subtract blocked footprints.
  s.data['walkable']=sum((m.shape_json(g) for g in s.walk),[])
  s.data['blocked']=[dict(name=name,**p) for name,g in s.ob for p in m.shape_json(g)]
  s.data['capacity']=dict(floorArea=area,duckies=n,perDuckyArea=round(m.DUCK_AREA),note='geometric standing capacity; walkable minus all blocked footprints')
  s.data['spawn']=[0,430]
  s.data['integration']=dict(status='assets only; island files deliberately untouched',coordinates='translate every piece and footprint by the island plaza centre',drawOrder=['decal','back','front and sorted interleaved with Duckies by sortY'],collision='union walkable, then subtract blocked; preserve island connectivity',duckHeight=130)
  (s.folder/'centre.json').write_text(json.dumps(s.data,indent=2)+'\n')
  print(s.t,len(s.pieces),'pieces',n,'standing capacity')

# U-shaped terracotta cloister. Roof, arches, columns use the home camera.
def rear_arcade_bay():
 el=rect(-106,-229,212,229,'#DFC894')
 el+=path('M-86 0 V-105 C-86 -225 86 -225 86 -105 V0Z','#BEA273')
 el+=path('M-102 -97 V-223 H102 V-97 H86 V-110 C86 -221 -86 -221 -86 -110 V-97Z',CREAM)
 for x in [-106,83]:
  el+=rect(x,-106,23,106,CREAM)+rect(x-5,-119,33,17,'#FFF6DB',r=3)+rect(x-5,-9,33,15,STONE,r=2)
 el+=path('M-121 -227 L-105 -298 H105 L121 -227Z','#ECA259')
 for j in range(9):
  x=-105+j*26.25
  el+=path(f'M{x} -297 Q{x-5} -266 {x-8} -229','none','#995D30',2)
 for y in [-274,-250]:el+=path(f'M{-105-(y+298)*.22} {y} H{105+(y+298)*.22}','none','#B87538',1.8)
 el+=path('M-115 -230 H115','none',CREAM,4)
 el+=group(lamp(),0,-117,.38)
 return el

def cathedral():
 c=Centre('cathedral','Olive cloister courtyard','concepts/themes/next-centres/cathedral-centre-2.png')
 floor=box(-1090,-720,1090,790).buffer(90,join_style=1).intersection(box(-1140,-770,1140,850))
 c.add('decal-paving',m.flagstones(floor,31,140,'#F8E8BD','#DEC699',3)+m.fill(floor,'none',INK,SW),floor.bounds,'decal')
 inner=box(-1010,-650,1010,740)
 c.add('decal-border',m.fill(floor.difference(inner),'#EBD49C',None)+m.fill(inner,'none','#D2B77F',3),floor.bounds,'decal')
 c.walk=[Polygon([(-940,-600),(940,-600),(1030,400),(1030,820),(-1030,820),(-1030,400)])]
 for i in range(9):
  x=(i-4)*211;y=-620
  c.add(f'cloister-back-{i+1:02}',group(rear_arcade_bay(),x,y),(x-126,y-301,x+126,y+10),sort=y+8)
  c.ob.append((f'back-wall-{i}',box(x-108,y-68,x+108,y+8)))
 # Splayed side colonnades, each bay is independently sorted at its front column.
 for sign,label in [(-1,'west'),(1,'east')]:
  for i in range(4):
   a=(-620+i*242);b=a+242;x0=sign*(953+i*33);x1=sign*(953+(i+1)*33)
   el=path(f'M{x0} {a-222} L{x1} {b-222} L{x1+sign*126} {b-244} L{x0+sign*126} {a-244}Z','#ECA259')
   for j in range(10):
    t=j/10;xx=x0+(x1-x0)*t;yy=a+(b-a)*t
    el+=path(f'M{xx} {yy-222} l{sign*126} -22','none','#A36532',1.8)
   el+=path(f'M{x0} {a-222} L{x1} {b-222} L{x1} {b-173} Q{(x0+x1)/2} {(a+b)/2-260} {x0} {a-173}Z',CREAM)
   for x,y in [(x0,a),(x1,b)]:
    el+=rect(x-17,y-182,34,182,CREAM)+rect(x-24,y-197,48,20,STONE,r=3)+rect(x-25,y-14,50,22,STONE,r=3)
   c.add(f'cloister-{label}-{i+1}',el,(min(x0,x1)-150,a-250,max(x0,x1)+150,b+12),sort=b+12)
   c.ob.append((f'{label}-colonnade-{i}',box(min(x0,x1)-25,a-36,max(x0,x1)+25,b+15)))
   c.prop(f'rose-planter-{label}-{i}',pot(i+5),x1-sign*35,b-8,(-60,-70,60,43),(40,28))
 # Rose garlands across alternate rear arches, kept with the roof depth.
 for i,x in enumerate([-615,0,615]):
  el=path('M-85 20 Q0 -35 85 20','none','#518B3D',12)
  for j in range(9):
   xx=-84+j*21;yy=-12+32*(xx/84)**2
   el+=ellipse(xx,yy,15,9,LEAF,INK,1.5)+blossom(xx,yy-4,'#F4A3C0',10)
  c.add(f'roof-roses-{i+1}',group(el,x,-846),(x-106,-885,x+106,-807),sort=-610)
 c.trace('olive-well',0,170,255,150)
 # Deliberate seats and lamps, clear central paths and southern entry.
 for i,(x,y) in enumerate([(-825,-320),(825,-320),(-740,660),(740,660)]):c.prop(f'bench-{i+1}',bench(),x,y,(-94,-73,94,32),(92,25))
 for i,(x,y) in enumerate([(-790,-520),(790,-520),(-960,120),(960,120),(-950,685),(950,685)]):c.prop(f'lamp-{i+1}',lamp(),x,y,(-24,-213,24,10),(19,12))
 for i,(x,y) in enumerate([(-610,697),(610,697),(-850,-520),(850,-520)]):c.prop(f'flower-pot-{i+1}',pot(i+12),x,y,(-60,-70,60,45),(39,28))
 c.data['outerEdge']=dict(x=0,y=40,rx=1140,ry=810,note='courtyard paving; rear arcade artwork rises above this footprint')
 c.data['entries']=[dict(name='south',at=[0,820],width=950)]
 c.data['placementHint']=dict(x=4100,y=2680,scale=1,clearOtherPropsWithin=[-1160,-940,1160,860])
 c.finish()

def fountain():
 el=ellipse(0,14,193,147,'#D6BD7F')+ellipse(0,-7,193,147,CREAM)+ellipse(0,-7,171,128,'#60C8D4')
 for a in range(0,181,18):
  t=math.radians(a);x=193*math.cos(t);y=147*math.sin(t)
  el+=path(f'M{x} {y-7} v21','none','#B69A65',2)
 el+=ellipse(0,-12,162,118,'#67D4DA','none')
 for x,y in [(-115,-20),(102,45),(-45,76),(65,-61)]:el+=ellipse(x,y,23,4,'#B2EFF0','none')
 el+=ellipse(0,10,48,30,CREAM)+path('M-24 -128 Q-16 -63 -35 -4 Q0 17 35 -4 Q16 -63 24 -128Z','#F2D58E')
 el+=ellipse(0,-126,63,30,CREAM)+ellipse(0,-131,48,20,'#59C7D5')
 for x,y in [(-116,-74),(116,-74),(-100,96),(100,96)]:el+=ellipse(x,y,24,18,LEAF)+blossom(x,y-10,'#F49CB4',9)
 return el

def jets():
 el=''
 for x,dx,y,dy in [(-12,-44,-140,-185),(12,44,-140,-185),(-45,-95,-124,-40),(45,95,-124,-40)]:
  d=f'M{x} {y} C{x} {y-100} {dx} {y-100} {dx} {dy}' if abs(dx)<50 else f'M{x} {y} C{dx} {y-70} {dx*1.3} {y-60} {dx*1.3} {dy}'
  el+=path(d,'none','#329EAE',9)+path(d,'none','#E0FFFF',5)
  if abs(dx)>50:el+=ellipse(dx*1.3,dy,15,5,'#CCFFFF','none')
 return el

def canal():
 c=Centre('canal','Shell market and fountain square','concepts/themes/next-centres/canal-centre-4.png')
 R=1080;floor=m.ell(0,0,R);deck=m.ell(0,0,1170)
 el=m.fill(m.ell(0,26,1170),'#AE7538')+m.fill(deck,'#E5AD5E')
 for x in range(-1150,1151,60):
  line=box(x,-1300,x+2,1300).intersection(deck.difference(floor))
  el+=m.fill(line,'#BE8845',None)
 el+=m.fill(m.ell(0,0,1158),'none',CREAM,5)
 c.add('back-boardwalk',el,(-1175,-900,1175,930),'decal')
 c.add('decal-paving',m.flagstones(floor,42,128,'#F9E9BC','#E3CD93',3.5)+m.fill(floor,'none',INK,SW),floor.bounds,'decal')
 c.walk=[deck]
 # Boardwalk pilings and rope rail bays split individually for Ducky sorting.
 for i in range(30):
  a0=i*12;a1=(i+1)*12;am=(a0+a1)/2
  # Open bridge gates at the diagonal corners.
  if any(abs((am-a+180)%360-180)<14 for a in [42,138,222,318]):continue
  pts=m.arc(0,0,1144,a0,a1,12);x0,y0=pts[0];x1,y1=pts[-1]
  rail=path(f'M{x0} {y0-75} Q{(x0+x1)/2} {(y0+y1)/2-45} {x1} {y1-75}','none',WOOD,10)+path(f'M{x0} {y0-78} Q{(x0+x1)/2} {(y0+y1)/2-48} {x1} {y1-78}','none',CREAM,5)
  for x,y in [(x0,y0),(x1,y1)]:
   rail+=rect(x-10,y-90,20,130,WOOD,r=5)+ellipse(x,y-90,13,8,'#FFE4A3')
  c.add(f'rail-{i+1:02}',rail,(min(x0,x1)-16,min(y0,y1)-101,max(x0,x1)+16,max(y0,y1)+45),'front',max(y0,y1)+8)
  c.ob.append((f'rail-{i+1}',m.LineString(pts).buffer(12)))
 c.trace('shell-pavilion',0,-555,227,83)
 for i,(x,y,color) in enumerate([(-925,-240,'#F16E4B'),(925,-240,'#48B9DD'),(-932,410,'#FFCE36'),(932,410,'#F16E4B'),(-420,746,'#48B9DD'),(420,746,'#FFCE36')]):c.prop(f'market-stall-{i+1}',stall(color,i+3),x,y,(-116,-225,116,12),(106,48))
 for i,(x,y) in enumerate([(-390,-596),(390,-596),(-180,790),(180,790)]):c.prop(f'bench-{i+1}',bench(),x,y,(-94,-73,94,32),(92,25))
 for i,a in enumerate([195,230,260,280,310,345,25,65,115,155]):
  x=1114*math.cos(math.radians(a));y=1114*K*math.sin(math.radians(a))
  c.prop(f'lamp-{i+1:02}',lamp(),x,y,(-24,-213,24,10),(18,12))
 for i,(x,y) in enumerate([(-650,-590),(650,-590),(-600,690),(600,690),(-1035,100),(1035,100),(0,810)]):c.prop(f'flower-pot-{i+1}',pot(i+20),x,y,(-60,-70,60,45),(40,28))
 c.add('fountain',fountain(),(-199,-163,199,166),sort=150)
 c.add('fountain-jets',jets(),(-146,-255,146,-25),'sorted',150.01,'separate water overlay; draw immediately above fountain at the same depth')
 c.ob.append(('fountain',m.ell(0,0,203,158)))
 # Four short arched landing bridges. Keep water/coastline in the owning island.
 bridges=[]
 for sx,label in [(-1,'west'),(1,'east')]:
  for sy,row in [(-1,'north'),(1,'south')]:
   cx=sx*1000;cy=sy*560+65;L=500;D=130;x0=cx-L/2;x1=cx+L/2
   # Both ends at ground height, central crown rises 62. No opaque canal water is painted.
   upper=f'M{x0} {cy-D} Q{cx} {cy-D-124} {x1} {cy-D}';lower=f'Q{cx} {cy-124} {x0} {cy}'
   el=path(upper+f'L{x1} {cy} '+lower+'Z','#E2A75A')
   for j in range(13):
    t=j/12;x=x0+L*t;rise=248*t*(1-t)
    el+=path(f'M{x} {cy-D-rise} v{D}','none','#AB773B',2)
   c.add(f'bridge-{row}-{label}-deck',el,(x0-4,cy-D-65,x1+4,cy+5),'back')
   for side,yy in [('back',cy-D),('front',cy)]:
    railing=path(f'M{x0} {yy-72} Q{cx} {yy-196} {x1} {yy-72}','none',INK,15)+path(f'M{x0} {yy-72} Q{cx} {yy-196} {x1} {yy-72}','none',CREAM,10)
    for j in range(9):
     t=j/8;x=x0+L*t;rise=248*t*(1-t)
     railing+=path(f'M{x} {yy-rise} v-70','none',WOOD,8)+path(f'M{x-2} {yy-rise-5} v-59','none',CREAM,2)
    for x in [x0,x1]:railing+=rect(x-11,yy-82,22,109,WOOD,r=4)+ellipse(x,yy-82,13,7,CREAM)
    c.add(f'bridge-{row}-{label}-{side}',railing,(x0-16,yy-144,x1+16,yy+30),'front',yy+5)
   g=box(x0,cy-D,x1,cy);c.walk.append(g)
   bridges.append(dict(name=f'{row}-{label}',fromPoint=[x0,cy-D/2],toPoint=[x1,cy-D/2],width=D,height=62,note='arched landing; connect outer end to island path, apply bridge lift in renderer'))
 c.data['bridges']=bridges
 c.data['arches']=[dict(a=b['fromPoint'],b=b['toPoint'],r=b['height'],w=b['width']) for b in bridges]
 c.data['outerEdge']=dict(x=0,y=0,rx=1170,ry=round(1170*K,1),note='wooden plaza deck; four landing bridges extend to x +/-1250')
 c.data['placementHint']=dict(x=4000,y=3320,scale=1,clearOtherPropsWithin=[-1275,-1015,1275,950])
 c.finish()

if __name__=='__main__':cathedral();canal()
