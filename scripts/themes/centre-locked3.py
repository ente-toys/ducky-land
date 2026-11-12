"""Build locked Peaks 2, Snow 2, Candy 3. Only writes centre-locked/.
Run: python3 scripts/themes/centre-locked3.py
Flat original SVG geometry; centre.json uses existing home centre schema.
"""
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'public/pixi-art/themes'
K=.64
INK='#51452D'; CREAM='#FFF4CF'; GOLD='#EAC571'
def path(d,c=CREAM,s=INK,w=3):return f'<path d="{d}" fill="{c}" stroke="{s}" stroke-width="{w}"/>'
def line(d,c=INK,w=3):return path(d,'none',c,w)
def ellipse(x,y,rx,ry,c,s=INK,w=3):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{c}" stroke="{s}" stroke-width="{w}"/>'
def rect(x,y,w,h,c,r=4):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}" stroke="{INK}" stroke-width="3"/>'
def group(s,x=0,y=0,scale=1):return f'<g transform="translate({x} {y}) scale({scale})">{s}</g>'
def arc(r,a,b,y=0,k=K):
 pts=[(r*math.cos(math.radians(a+(b-a)*i/80)),y+r*k*math.sin(math.radians(a+(b-a)*i/80))) for i in range(81)]
 return 'M'+' L'.join(f'{x:.2f} {yy:.2f}' for x,yy in pts)
def poly(pts,c,s=INK,w=3):return path('M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in pts)+'Z',c,s,w)
def star(x,y,r,c,n=5):return poly([(x+math.sin(i*math.pi/n)*(r if i%2==0 else r*.45),y-math.cos(i*math.pi/n)*(r if i%2==0 else r*.45)) for i in range(n*2)],c)
class Build:
 def __init__(self,t,name,pick):
  self.t=t; self.out=ART/t/'centre-locked';self.out.mkdir(exist_ok=True)
  old=json.load(open(ART/t/'centre/centre.json'))
  self.d=dict(theme=t,name=name,concept=f'concepts/themes/next-centres3/{t}-centre-{pick}.png',origin='plaza ground centre',placement=old.get('placement'),depthRatio=K,pieces=[],outerEdge=dict(x=0,y=0,rx=1050,ry=672),walkable=[dict(ellipse=dict(x=0,y=0,rx=1035,ry=662))],blocked=[],stairs=[],spawn=[0,570])
 def add(self,id,s,box,layer='sorted',sort=0,animate=None):
  x,y,w,h=box
  (self.out/(id+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x} {y} {w} {h}" stroke-linecap="round" stroke-linejoin="round"><title>{self.d["name"]}: {id}</title>{s}</svg>')
  p=dict(id=id,file=id+'.svg',layer=layer,x=x,y=y,width=w,height=h,anchor=dict(x=0,y=0),at=[x,y])
  if layer!='decal':p['sortY']=sort
  if animate:p['animate']=animate
  self.d['pieces'].append(p)
 def block(self,n,x,y,rx,ry):self.d['blocked'].append(dict(name=n,ellipse=dict(x=x,y=y,rx=rx,ry=ry)))
 def finish(self):
  self.d['capacity']=dict(note='Crowd estimate excludes physical props; all units are world units.',duckies=int((math.pi*1035*662-sum(math.pi*b['ellipse']['rx']*b['ellipse']['ry'] for b in self.d['blocked']))/4902))
  (self.out/'centre.json').write_text(json.dumps(self.d,indent=2)+'\n')
def floor(b):
 s=ellipse(0,12,1050,672,'#D8B96E')+ellipse(0,0,1050,672,'#FFEAC0')
 for r in [1005,900,760,560,300]:s+=ellipse(0,0,r,r*K,'none','#CBB37C',2.6)
 for r0,r1,num in [(1005,1050,52),(900,1005,44),(760,900,36),(560,760,28),(300,560,20)]:
  for i in range(num):
   a=2*math.pi*(i+.45*(r0%3))/num
   s+=line(f'M{r0*math.cos(a)} {r0*K*math.sin(a)} L{r1*math.cos(a+.018)} {r1*K*math.sin(a+.018)}','#D2B77E',2)
 if b.t=='peaks':
  for i in range(16):
   a=i*math.pi/8; rr=745 if i%2==0 else 510
   tip=(rr*math.sin(a),rr*K*math.cos(a))
   l=(220*math.sin(a-.20),220*K*math.cos(a-.20));r=(220*math.sin(a+.20),220*K*math.cos(a+.20))
   s+=poly([l,tip,(0,0)],'#F8D979','#CBA956',2)+poly([(0,0),tip,r],'#FFF7D3','#CBA956',2)
 elif b.t=='snow':
  for i in range(6):
   a=i*math.pi/3
   shape=[(-22,250),(22,250),(22,480),(130,575),(150,565),(160,615),(115,640),(22,548),(22,760),(-22,760),(-22,548),(-115,640),(-160,615),(-150,565),(-130,575),(-22,480)]
   pts=[(x*math.cos(a)-y*math.sin(a),(x*math.sin(a)+y*math.cos(a))*K) for x,y in shape]
   s+=poly(pts,'#C7E4EE','#ADCFDC',2)
 elif b.t=='candy':
  for i in range(32):
   a=i*math.pi/16;bb=a+math.pi/32
   pts=[(r*math.cos(v),r*K*math.sin(v)) for r,v in [(450,a),(780,a),(780,bb),(450,bb)]]
   s+=poly(pts,'#F89DAD','none')
  s+=ellipse(0,0,780,780*K,'none','#F29BAD',14)
 for a in [0,90,180,270]:
  x=945*math.cos(math.radians(a));y=945*K*math.sin(math.radians(a))
  s+=poly([(x,y-27),(x+30,y),(x,y+27),(x-30,y)],'#F8D97E','#C8A464',2)
 b.add('floor',s,(-1060,-680,2120,1375),'decal')
def bench(b,idx,a):
 r=925; lo=a-13;hi=a+13
 s=''
 for aa in [lo+2,hi-2]:
  x=r*math.cos(math.radians(aa));y=r*K*math.sin(math.radians(aa))
  s+=rect(x-6,y-28,12,63,'#AC7036')
 s+=path(arc(r+25,lo,hi,-20)+arc(r-26,hi,lo,-20).replace('M',' L',1)+'Z','#E8AC58','#72542F',3)
 s+=line(arc(r+25,lo,hi,-16),'#A67135',7)+line(arc(r,lo,hi,-23),'#FFE0A0',3)
 for aa in range(int(lo),int(hi)+1,4):
  x=r*math.cos(math.radians(aa));y=r*K*math.sin(math.radians(aa));s+=line(f'M{x} {y-30} L{x} {y-101}','#8F612E',9)
 s+=line(arc(r,lo,hi,-103),'#5E482C',16)+line(arc(r,lo,hi,-105),'#E9B766',10)
 pts=[(r*math.cos(math.radians(t)),r*K*math.sin(math.radians(t))) for t in [lo,hi,a]]
 x0=min(x for x,y in pts)-25;y0=min(y for x,y in pts)-124;w=max(x for x,y in pts)-x0+25;h=max(y for x,y in pts)-y0+50
 b.add(f'bench-{idx}',s,(x0,y0,w,h),sort=max(y for x,y in pts)+25)
 b.block(f'arc bench {idx}',r*math.cos(math.radians(a)),r*K*math.sin(math.radians(a)),130,47)
def lamp(b,i,x,y):
 s=ellipse(x,y,24,13,'#A57136')+rect(x-9,y-170,18,165,'#C58B42')
 if b.t=='candy':
  for yy in range(-165,-15,36):s+=path(f'M{x-8} {y+yy} l16 -10 v17 l-16 10Z','#FA8FA5','none')
 s+=ellipse(x,y-170,26,10,'#E1AB50')+ellipse(x,y-202,31,32,'#FFF0B2')+ellipse(x-10,y-213,8,9,'#FFFEEC','none')+ellipse(x,y-235,8,6,'#DAA651')
 if b.t=='snow':s+=path(f'M{x-34} {y-218} Q{x-32} {y-243} {x-12} {y-241} Q{x} {y-260} {x+15} {y-242} Q{x+38} {y-242} {x+34} {y-218} Q{x} {y-208} {x-34} {y-218}Z','#FCFFFF','#5D8394',2.8)
 b.add(f'lamp-{i}',s,(x-40,y-265,80,282),sort=y+12);b.block(f'lamp {i}',x,y,24,16)
def flower(b,i,x,y,snow=False):
 s=rect(x-77,y-25,154,50,'#C88D45')+rect(x-84,y-39,168,20,'#E9B969')
 for xx in [-51,-22,12,49]:
  s+=ellipse(x+xx,y-43,30,22,'#3B9B43')
  if snow:s+=path(f'M{x+xx-30} {y-48} q5 -25 22 -22 q16 -18 30 0 q17 -1 14 22 q-30 14 -66 0Z','#F9FEFF','#7399AB',2)
  for j in range(5):s+=ellipse(x+xx+math.sin(j*1.257)*12,y-60+math.cos(j*1.257)*9,8,7,'#ED6554' if snow else '#FFFDE5','none')
  s+=ellipse(x+xx,y-60,5,5,'#FFD054','none')
 b.add(f'planter-{i}',s,(x-90,y-99,180,130),sort=y+28);b.block(f'planter {i}',x,y,80,34)
def furnishings(b):
 for i,a in enumerate([220,320,40,140]):bench(b,i,a)
 for i,a in enumerate([195,245,295,345,15,65,115,165]):lamp(b,i,995*math.cos(math.radians(a)),995*K*math.sin(math.radians(a)))
 for i,a in enumerate([70,110,250,290]):flower(b,i,965*math.cos(math.radians(a)),965*K*math.sin(math.radians(a)),b.t=='snow')
def peaks():
 b=Build('peaks','Summit compass cairn lookout',2);floor(b)
 s=ellipse(0,28,155,77,'#CCAE72')
 for x,y,rx,ry in [(-78,0,74,48),(63,3,79,48),(0,-12,99,54),(0,-76,78,45),(0,-132,56,32),(0,-178,35,23)]:
  s+=path(f'M{x-rx} {y+ry*.25} Q{x-rx} {y-ry*.6} {x-rx*.4} {y-ry} Q{x+rx*.7} {y-ry*1.1} {x+rx} {y} Q{x+rx*.8} {y+ry} {x} {y+ry} Q{x-rx*.8} {y+ry} {x-rx} {y+ry*.25}Z','#C4AD87')
  s+=path(f'M{x-rx*.8} {y-ry*.2} L{x-rx*.3} {y-ry*.8} L{x+rx*.45} {y-ry*.7} L{x+rx*.15} {y-ry*.2}Z','#F5DEB4','none')
  s+=line(f'M{x+rx*.42} {y+ry*.1} l{-rx*.15} {ry*.7}','#A48F6C',3)
 for x in [-145,-120,120,145]:s+=path(f'M{x} 28 q-15 -35 -24 -42 q25 8 25 25 q4 -29 18 -37 q-7 35 -19 54Z','#45953A','#456D2D',2)
 b.add('cairn',s,(-190,-210,380,295),sort=66);b.block('summit cairn',0,12,162,80)
 x,y=130,-490
 tripod=path('M-15 -125 L-76 0 L-57 6 L0 -94 L38 8 L57 1 L14 -130Z','#D7A34D')+line('M-46 -21 L35 -21','#756D58',9)+rect(-17,-143,36,24,'#B18D4D')
 b.add('telescope-tripod',group(tripod,x,y), (x-90,y-160,185,178),sort=y+10)
 tube=group(group(rect(-95,-26,185,52,'#666D69',16)+rect(43,-32,28,64,'#B7B9AC',8)+ellipse(77,0,13,33,'#3F514F')+ellipse(77,-2,8,25,'#A5D9D1')+line('M-80 -13 L34 -13','#DDD8C4',8)+rect(-121,-12,27,23,'#ADA58F'),0,0),x,y-171)
 tube=f'<g transform="rotate(-20 {x} {y-171})">{tube}</g>'
 b.add('telescope',tube,(x-145,y-245,280,145),sort=y+11)
 b.block('telescope stand',x,y,85,40)
 b.add('pennant-pole',line('M-390 -480 V-615','#825B32',6),(-397,-620,14,145),sort=-480)
 flag=path('M0 -132 Q42 -146 78 -124 L65 -91 Q30 -108 0 -94Z','#E78B45')
 b.add('summit-pennant',group(flag,-390,-480),(-395,-630,95,160),'anim',-480,dict(kind='wind',period=4,pivot=[-390,-570]))
 furnishings(b);b.finish()
def snow():
 b=Build('snow','Snowflake evergreen celebration',2);floor(b)
 s=ellipse(0,25,282,180,'#C9AC75')+ellipse(0,0,282,180,'#FFF4D4')+ellipse(0,-10,258,158,'#E5F3F5','#6F98A4')
 b.add('tree-bed',s,(-290,-180,580,395),'decal');b.block('fir and snow bed',0,0,265,165)
 s=rect(-23,-116,46,166,'#AA793E')
 for top,w,base in [(-205,210,0),(-320,175,-102),(-425,132,-225),(-515,85,-350)]:
  s+=path(f'M0 {top} Q{-w*.4} {top+95} {-w} {base-26} Q{-w*1.05} {base+10} {-w*.7} {base+8} Q{-w*.55} {base+43} {-w*.32} {base+22} Q0 {base+55} {w*.32} {base+22} Q{w*.65} {base+40} {w*.75} {base+7} Q{w*1.06} {base+12} {w} {base-26} Q{w*.4} {top+95} 0 {top}Z','#277B46','#294E3E',3.4)
  s+=path(f'M0 {top-5} Q{-w*.3} {top+58} {-w*.79} {base-46} Q{-w*.68} {base-5} {-w*.42} {base-32} Q{-w*.20} {base+8} {w*.04} {base-24} Q{w*.3} {base+5} {w*.5} {base-29} Q{w*.82} {base-8} {w*.81} {base-46} Q{w*.3} {top+58} 0 {top-5}Z','#FAFEFF','#7697A1',2.5)
 for yy,rr in [(-355,79),(-220,132),(-92,185)]:
  s+=line(f'M{-rr} {yy} Q0 {yy+100} {rr} {yy}','#B89439',10)+line(f'M{-rr} {yy} Q0 {yy+100} {rr} {yy}','#FFE298',6)
  for i in range(9):
   xx=-rr+2*rr*i/8;cy=yy+50*(1-(xx/rr)**2)
   s+=ellipse(xx,cy,9,6,'#FFF7C7','#D4AC48',1.5)
 for x,y,c in [(-115,-85,'#F66D5D'),(105,-58,'#F66D5D'),(-69,-245,'#F7CA4F'),(90,-220,'#F7CA4F'),(45,-370,'#F66D5D'),(-8,-140,'#F66D5D')]:s+=ellipse(x,y,20,22,c)+ellipse(x-6,y-9,6,6,'#FFF5CD','none')
 b.add('snow-fir',s,(-245,-540,490,630),sort=98)
 st=star(0,-540,48,'#FFDE70')+star(-3,-544,27,'#FFF3BA')
 b.add('star-glimmer',st,(-55,-595,110,108),'anim',99,dict(kind='foam',period=3.8,phase=.2))
 for i in range(12):
  a=i*math.pi/6;x=239*math.cos(a);y=146*math.sin(a)
  ss=ellipse(x,y,39,21,'#FBFEFF','#7397A1',2)
  for j in [-1,0,1]:ss+=ellipse(x+j*13,y-5-abs(j)*4,7,7,'#EE6A55','#567448',1.5)
  b.add(f'snow-berry-{i}',ss,(x-43,y-28,86,53),sort=y+23)
 furnishings(b);b.finish()
def candy():
 b=Build('candy','Cupcake pavilion chocolate moat',3);floor(b)
 s=ellipse(0,10,470,301,'#C5A166')+ellipse(0,0,470,301,'#FFE5A0')+ellipse(0,-4,446,280,'#885127')+ellipse(0,-9,412,257,'#A46731','none')+ellipse(0,-3,302,190,'#FFE8AD')
 b.add('chocolate-moat',s,(-480,-310,960,632),'decal');b.block('chocolate moat',0,0,455,287)
 for i in range(8):
  a=math.pi*(i+.3)/4;x=375*math.cos(a);y=235*math.sin(a)
  s=line(f'M{x-17} {y+4} q20 -14 42 0','#FFE5AD',3)+line(f'M{x-10} {y+14} q15 -6 25 -1','#DDA05E',2)
  b.add(f'chocolate-current-{i}',s,(x-25,y-14,80,45),'anim',y+8,dict(kind='foam',period=3.6,phase=i/8))
 for i,a in enumerate([.4,1.9,2.8,3.8,5.6]):
  x=380*math.cos(a);y=239*math.sin(a)
  s=ellipse(x,y+3,39,21,'#6C431F')+path(f'M{x-38} {y} q1 -39 38 -39 q37 0 38 39 q-12 12 -22 0 q-12 14 -24 0 q-16 14 -30 0Z','#FFDC8E','#6C492A',2)
  for xx in [-14,8,22]:s+=ellipse(x+xx,y-18+abs(xx)/4,3,2,'#EE8C95','none')
  b.add(f'floating-biscuit-{i}',s,(x-45,y-45,90,75),'anim',y+27,dict(kind='foam',period=4.5,phase=i/5))
 s=ellipse(0,0,286,178,'#D4AE67')+ellipse(0,-18,286,178,'#FFEBC0')
 for r in [265,225]:s+=ellipse(0,-18,r,r*.62,'none','#D0AD6C',2)
 b.add('pavilion-platform',s,(-294,-204,588,392),'decal')
 def col(x,y):
  height=320 if y>0 else 205
  ss=rect(x-14,y-height,28,height,'#FFF0CB',12)
  for yy in range(-height+5,-15,42):ss+=path(f'M{x-13} {y+yy+8} l26 -16 v21 l-26 16Z','#F68EAA','none')
  return ss+ellipse(x,y,26,11,'#FFE3A0')+ellipse(x,y-height,23,9,'#FFF0BF')
 b.add('pavilion-back-pillars',col(-135,-65)+col(135,-65),(-170,-285,340,240),sort=-38)
 for i,a in enumerate([.35,2.8,3.55,5.95]):flower(b,10+i,220*math.cos(a),123*math.sin(a)-18)
 s=''
 for x in [-77,77]:s+=col(x,67)
 b.add('pavilion-front-pillars',s,(-110,-265,220,357),sort=85)
 roof=path('M-190 -253 Q-210 -310 -157 -329 Q-146 -415 0 -422 Q143 -418 156 -330 Q213 -306 190 -253 Q165 -225 136 -249 Q104 -212 69 -240 Q30 -209 0 -237 Q-34 -208 -69 -239 Q-108 -211 -138 -248 Q-173 -226 -190 -253Z','#FFDE88')
 roof+=path('M-171 -294 Q-173 -337 -130 -368 Q-111 -435 0 -444 Q110 -433 133 -368 Q180 -335 171 -294 Q159 -272 133 -286 Q106 -260 77 -281 Q47 -260 20 -280 Q-8 -251 -38 -280 Q-76 -254 -105 -281 Q-144 -264 -151 -285 Q-169 -277 -171 -294Z','#F789A4','#A65365',3)
 for x,y in [(-110,-340),(-70,-389),(-25,-413),(30,-414),(85,-382),(126,-339),(-57,-313),(0,-337),(55,-314)]:roof+=ellipse(x,y,6,4,'#FFF0BA','none')
 roof+=ellipse(0,-462,32,32,'#FFE6A0')+ellipse(-10,-473,10,8,'#FFFFE5','none')
 b.add('cupcake-roof',roof,(-214,-505,428,305),sort=92)
 deck=path('M-88 365 L-88 188 Q0 131 88 188 L88 365Z','#FFEDBA')
 for yy in range(200,365,28):deck+=path(f'M-85 {yy} Q0 {yy-31} 85 {yy} v15 Q0 {yy-16} -85 {yy+15}Z','#F78DA8','none')
 b.add('bridge-deck',deck,(-95,148,190,223),'decal')
 for side in [-1,1]:
  x=side*91;s=line(f'M{x} 350 Q{x*.75} 220 {x} 157','#8D5740',15)+line(f'M{x} 350 Q{x*.75} 220 {x} 157','#FFF0C2',10)
  for yy in [173,330]:s+=rect(x-12,yy-25,24,65,'#F394A7')+ellipse(x,yy-27,22,20,'#FFF1B4')+ellipse(x,yy+41,22,9,'#E9BC6C')
  b.add(f'bridge-rail-{side}',s,(x-28,yy-220,56,300),'front',375)
 b.d['blocked']=[dict(name='chocolate moat west',poly=[[-455,-287],[-302,-190],[-302,190],[-110,287],[-455,287]]),dict(name='chocolate moat east',poly=[[455,-287],[302,-190],[302,190],[110,287],[455,287]]),dict(name='chocolate moat back',poly=[[-455,-287],[455,-287],[302,-190],[-302,-190]])]
 b.d['walkable'].append(dict(poly=[[-88,365],[-88,160],[88,160],[88,365]]))
 furnishings(b)
 for bl in b.d['blocked']:
  if 'ellipse' not in bl:bl['areaNote']='solid chocolate, keep Duckies out'
 b.d['capacity']=dict(duckies=340,note='Main plaza and bridge; chocolate ring excluded.')
 (b.out/'centre.json').write_text(json.dumps(b.d,indent=2)+'\n')
if __name__=='__main__':peaks();snow();candy()
