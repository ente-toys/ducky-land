"""Ribbonfall Cove. Run with Python 3.11 + shapely. Theme-only deterministic builder."""
import math,json,os,random,shutil,re
from shapely.geometry import Point,Polygon,LineString
from shapely.ops import unary_union
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..')); A=R+'/public/pixi-art/themes/waterfall'; D=R+'/assets/world/themes/waterfall'
os.makedirs(A+'/reuse',exist_ok=True);os.makedirs(D,exist_ok=True)
r=random.Random(81); W,H=7800,5800; ink='#39472D'
def ellipse(x,y,rx,ry,n=100):return [(round(x+rx*math.cos(t*2*math.pi/n),1),round(y+ry*math.sin(t*2*math.pi/n),1)) for t in range(n)]
coast=[(round(3900+3350*math.cos(t)*(1+.027*math.sin(5*t)),1),round(2850+1950*math.sin(t)*(1+.025*math.sin(7*t)),1)) for t in [i*2*math.pi/240 for i in range(240)]]
land=Polygon(coast); grass=land.buffer(-100); lagoon=Polygon(ellipse(3900,2430,1150,620))
obs=[];props=[];flats=[];decks=[];walkways=[];arches=[]
def path(p):return 'M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in p)+' Z'
def poly(p,fill,stroke=ink,sw=4):return f'<path d="{path(p)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'
def ell(x,y,rx,ry,fill,stroke=ink,sw=3):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
def svg(body,w,h,view=None):return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{view or f"0 0 {w} {h}"}">{body}</svg>'
def prop(src,x,y,w,name,solid=True):
 s=open(A+'/'+src).read(); m=re.search(r'viewBox="([^"]+)"',s); vs=list(map(float,m[1].split())) if m else [0,0,100,100]; h=w*vs[3]/vs[2]
 p=dict(id=f'waterfall-{max([int(p["id"].split("-")[-1]) for p in props]+[-1])+1}',name=name,src=src,x=x,y=y,width=round(w,2),height=round(h,2),anchor={'x':.5,'y':1},scale=1,flip=False);props.append(p)
 if solid:obs.append(dict(x=x,y=y-12,rx=min(65,w*.18),ry=26))
 return p

def home(file,x,y,w,name,solid=True):
 dst='reuse/'+file+'.svg'
 if file.startswith('nature--tree-'):
  kind={'nature--tree-willow':'tree-3','nature--tree-oak':'tree-1','nature--tree-round':'tree-4'}[file]
  shutil.copyfile(R+'/public/pixi-art/plants/'+kind+'.svg',A+'/'+dst);w=280
 else:shutil.copyfile(R+'/public/pixi-art/detail/'+file+'.svg',A+'/'+dst)
 return prop(dst,x,y,w,name,solid)
zones={'plaza':dict(x=3900,y=3800,rx=720,ry=560,spawn=[3900,4100]),'centre':dict(x=3900,y=3800,rx=720,ry=560,spawn=[3900,4100],name='Reserved centre plaza')}
for i,(x,y,rx,ry) in enumerate([(1730,2600,580,430),(6100,2600,580,430),(3900,4630,620,260)],1):zones[f'activity-{i}']=dict(x=x,y=y,rx=rx,ry=ry,spawn=[x,y],name=['Fern games lawn','Lagoon gathering lawn','South picnic green'][i-1],kind='activity')
for i,(x,y) in enumerate([(1800,3490),(6000,3490),(2300,1400)],1):zones[f'stalls-{i}']=dict(x=x,y=y,rx=620,ry=170,x0=x-620,x1=x+620,y0=y-170,y1=y+170,spawn=[x,y+80],slots=[[x-440+j*290,y-60] for j in range(4)],kind='stalls')
paths=[[(1100,2850),(1200,3750),(2600,4000),(3900,4100),(5350,4000),(6600,3750),(6800,2850)],[(1200,3750),(1200,1900),(2300,1750),(2850,1650)],[(6600,3750),(6600,1900),(5500,1650),(5000,1600)],[(2600,4000),(2700,3250),(3200,3050),(4600,3050),(5150,3250),(5350,4000)],[(3900,4100),(3900,4840)]]
def smooth(line):
 out=[]
 for i in range(len(line)-1):
  p0=line[max(0,i-1)];p1=line[i];p2=line[i+1];p3=line[min(len(line)-1,i+2)]
  for j in range(14):
   t=j/14
   out.append(tuple(.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t) for k in range(2)))
 return out+[line[-1]]
paths=[smooth(p) for p in paths]
pathgeom=unary_union([LineString(p).buffer(180) for p in paths]); avoid=unary_union([Polygon(ellipse(z['x'],z['y'],z['rx']+90,z['ry']+90)) for z in zones.values()])
body=poly(list(land.buffer(55).exterior.coords),'#DFF3E8','none')+poly(coast,'#EAD2A1',ink,5)+poly(list(grass.exterior.coords),'#A8D39A','#71945B',3)
for p in paths:body+=f'<path d="M '+ ' L '.join(f'{x} {y}' for x,y in p)+'" fill="none" stroke="#F6E8C6" stroke-width="300" stroke-linecap="round" stroke-linejoin="round"/>'
for k,z in zones.items():
 if k=='plaza':continue
 body+=ell(z['x'],z['y'],z['rx'],z['ry'],'#F5E7C8' if k=='centre' or k.startswith('stalls') else '#B7DEA8','#8EAA76',4)
 if k=='centre':
  body+=ell(z['x'],z['y'],z['rx']-32,z['ry']-25,'none','#D2B98B',5)
  for a in range(0,360,30):
   t=a*math.pi/180;body+=f'<path d="M {3900+670*math.cos(t)} {3800+520*math.sin(t)} l {28*math.cos(t)} {22*math.sin(t)}" stroke="#D2B98B" stroke-width="4"/>'
body+=poly(list(lagoon.buffer(45).exterior.coords),'#DFF3E8','#729583',4)+poly(list(lagoon.exterior.coords),'#79D5D7','#448F91',4)
for i in range(38):
 x=r.uniform(2830,4970);y=r.uniform(1950,2970)
 if lagoon.buffer(-50).contains(Point(x,y)):body+=f'<path d="M{x:.1f} {y:.1f} q 40 16 85 0" stroke="#DFF3E8" stroke-width="5" fill="none"/>'
if os.path.exists(A+'/detail/ribbonfall.svg'):
 p=prop('detail/ribbonfall.svg',3900,2240,1700,'Three step waterfall amphitheatre',False)
 obs.append({'poly':[[3060,1250],[4740,1250],[4740,2220],[3060,2220]]})
home('nature--rock-round',3900,3770,120,'Centre placeholder cairn')
fern='<path d="M100 130 Q50 30 15 55 Q35 95 100 130 M100 130 Q70 0 48 15 Q45 70 100 130 M100 130 Q100 -10 115 12 Q137 75 100 130 M100 130 Q160 8 180 40 Q170 85 100 130 M100 130 Q202 65 195 90 Q150 120 100 130" fill="#579858" stroke="#39472D" stroke-width="3" stroke-linejoin="round"/>'
open(A+'/detail/fern-fan.svg','w').write(svg(fern,210,140))
jet=[([2200,1350],[2200,650]),([1050,2850],[340,2850]),([6800,2850],[7460,2850]),([3900,4750],[3900,5320])]
def deck(a,b,w,name,arch=0):
 walkways.append(dict(a=a,b=b,w=w));dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy);nx=-dy/L;ny=dx/L
 pts=[(a[0]+nx*w/2,a[1]+ny*w/2),(b[0]+nx*w/2,b[1]+ny*w/2),(b[0]-nx*w/2,b[1]-ny*w/2),(a[0]-nx*w/2,a[1]-ny*w/2)]
 if arch:
  pts=[(a[0]+dx*t+nx*w/2,a[1]+dy*t+ny*w/2-arch*4*t*(1-t)) for t in [j/24 for j in range(25)]]+[(a[0]+dx*t-nx*w/2,a[1]+dy*t-ny*w/2-arch*4*t*(1-t)) for t in [j/24 for j in range(24,-1,-1)]]
 s=poly(pts,'#DAB478',ink,5)
 for j in range(int(L/45)+1):
  t=j/int(L/45);x=a[0]+dx*t;y=a[1]+dy*t-arch*4*t*(1-t)
  s+=f'<path d="M{x+nx*w/2} {y+ny*w/2} L{x-nx*w/2} {y-ny*w/2}" stroke="#88633F" stroke-width="3"/>'
 for side in [-1,1]:
  line=[]
  for j in range(9):
   t=j/8;x=a[0]+dx*t+nx*(w/2-8)*side;y=a[1]+dy*t+ny*(w/2-8)*side-arch*4*t*(1-t)
   s+=f'<path d="M{x} {y} v-45" stroke="#39472D" stroke-width="12"/><path d="M{x} {y} v-45" stroke="#B98C52" stroke-width="7"/>';line.append((x,y-45))
  s+=f'<path d="M '+ ' L '.join(f'{x} {y}' for x,y in line)+'" stroke="#39472D" stroke-width="10" fill="none"/><path d="M '+' L '.join(f'{x} {y}' for x,y in line)+'" stroke="#DAB478" stroke-width="5" fill="none"/>'
 x0=min(p[0] for p in pts)-30;y0=min(p[1] for p in pts)-arch-65;x1=max(p[0] for p in pts)+30;y1=max(p[1] for p in pts)+15
 open(A+'/'+name+'.svg','w').write(svg(s,x1-x0,y1-y0,f'{x0} {y0} {x1-x0} {y1-y0}'));decks.append(dict(src=name+'.svg',x=x0,y=y0,width=x1-x0,height=y1-y0))
 if arch:arches.append(dict(a=a,b=b,w=w,r=arch))
for i,(a,b) in enumerate(jet):
 if i:deck(a,b,150,f'jetty-{i}')
 else:walkways.append(dict(a=a,b=b,w=150))
islets=[[1450,4780,370,240],[6330,4770,370,240]]
for x,y,rx,ry in islets:body+=poly(ellipse(x,y,rx,ry),'#EAD2A1',ink,4)+poly(ellipse(x,y-20,rx-60,ry-65),'#A8D39A','#71945B',3)
deck([1940,4220],[1550,4650],180,'bridge-west',65);deck([5850,4220],[6240,4640],180,'bridge-east',65)
a=[5000,2030];b=[5000,2850];walkways.append(dict(a=a,b=b,w=170))
stone=''
for i in range(9):
 t=i/8;x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t;stone+=ell(x,y,115,62,'#B3BCAB',ink,4)+ell(x-12,y-10,82,35,'#DFF3E8','none')
open(A+'/stepping-stones.svg','w').write(svg(stone,W,H));decks.append(dict(src='stepping-stones.svg',x=0,y=0,width=W,height=H))
reserved=unary_union([avoid,pathgeom,lagoon.buffer(100),Polygon([[2950,1050],[4850,1050],[4850,2240],[2950,2240]])]+[LineString([a,b]).buffer(220) for a,b in jet])
plantpoints=[]
for _ in range(1400):
 x=r.randint(800,7000);y=r.randint(1100,4650);pt=Point(x,y)
 if not grass.buffer(-140).contains(pt) or reserved.contains(pt) or any(math.hypot(x-q[0],y-q[1])<330 for q in plantpoints):continue
 plantpoints.append((x,y))
 if len(plantpoints)>=47:break
for i,(x,y) in enumerate(plantpoints):
 home('nature--tree-'+('willow' if i%5==0 else 'oak' if i%2 else 'round'),x,y,210 if i%5==0 else 185,'Tree')
 prop('detail/fern-fan.svg',x+135,y+80,115,'Fern fan')
for x,y in [(2720,2400),(5100,2360),(2920,2900),(4920,2970),(1450,4790),(6330,4790)]:
 home('nature--rock-boulder',x,y,160,'Lagoon rock');prop('detail/fern-fan.svg',x-130,y+30,140,'Fern fan')
for x,y in [(3040,3520),(4740,3520),(1500,1910),(6300,1900),(2780,4270),(5180,4270)]:home('street--bench-wood',x,y,220,'Lookout bench')
for x,y in [(3050,3220),(4650,3220),(2750,3940),(5050,3940)]:home('street--lamp-lantern',x,y,70,'Lookout lamp')
for _ in range(650):
 x=r.randint(600,7200);y=r.randint(950,4800)
 if not grass.contains(Point(x,y)) or reserved.contains(Point(x,y)):continue
 body+=f'<path d="M{x-13} {y} l-5 -14 M{x} {y} l3 -20 M{x+13} {y} l7 -12" stroke="#7BAA70" stroke-width="3" stroke-linecap="round"/>'
spots={k:[] for k in ['nod','hammock','rock','leaf','book','chair','wing','box']}; taken=[]
for p in [p for p in props if p['name']=='Tree']:
 if len(spots['nod'])>=5:break
 if any(math.hypot(p['x']-x,p['y']-y)<950 for x,y,_ in taken):continue
 spots['nod'].append([p['id'],0,False]);taken.append((p['x'],p['y']+14,'nod'))
napgrass=grass.buffer(-70); napreserved=unary_union([reserved]+[LineString([q["a"],q["b"]]).buffer(q["w"]/2+110) for q in walkways])
for round_ in range(5):
 for pose in ['hammock','rock','leaf','book','chair','wing','box']:
  for attempt in range(20000):
   x=r.randint(750,7050);y=r.randint(1100,4750);pt=Point(x,y)
   if not napgrass.contains(pt) or napreserved.contains(pt):continue
   if any(math.hypot(x-tx,(y-ty)*1.3)<330 or (pose==p and math.hypot(x-tx,y-ty)<930) for tx,ty,p in taken):continue
   conflicts=[p for p in props if math.hypot(x-p['x'],(y-p['y'])*1.6)<p['width']*.5+140 or (p['y']>y-20 and p['y']-y<p['height']*.95 and abs(x-p['x'])<p['width']/2+80)]
   if any(p['id'] in [q[0] for q in spots['nod']] or p['name']=='Three step waterfall amphitheatre' for p in conflicts):continue
   for p in conflicts:
    props.remove(p)
    obs[:]=[o for o in obs if o.get('x')!=p['x'] or o.get('y')!=p['y']-12]
   spots[pose].append([x,y,round_%2==0]);taken.append((x,y,pose));break
for j in range(4000):
 if sum(p['name']=='Tree' for p in props)>=30:break
 x=r.randint(850,6950);y=r.randint(1120,4700);pt=Point(x,y)
 if not grass.buffer(-60).contains(pt) or napreserved.contains(pt):continue
 if any(math.hypot(x-p['x'],y-p['y'])<290 for p in props):continue
 if any(math.hypot(x-tx,(y-ty)*1.6)<310 or (y>ty-20 and y-ty<420 and abs(x-tx)<220) for tx,ty,_ in taken):continue
 home('nature--tree-oak' if j%2 else 'nature--tree-round',x,y,280,'Tree')
for j in range(600):
 x=r.randint(850,6950);y=r.randint(1120,4700);pt=Point(x,y)
 if not grass.buffer(-45).contains(pt) or napreserved.contains(pt):continue
 if any(math.hypot(x-tx,(y-ty)*1.6)<200 or (y>ty-20 and y-ty<150 and abs(x-tx)<130) for tx,ty,_ in taken):continue
 if any(math.hypot(x-p['x'],y-p['y'])<160 for p in props):continue
 prop('detail/fern-fan.svg',x,y,150,'Fern fan')
 if sum(p['name']=='Fern fan' for p in props)>=40:break
print('sleep counts',{k:len(v) for k,v in spots.items()})
world=dict(width=W,height=H,coast=coast,water=[dict(x=3900,y=2430,rx=1150,ry=620,poly=list(lagoon.exterior.coords)[:-1])],bridges=[],obstacles=obs,islets=islets,walkways=walkways,arches=arches,zones=zones,theme='waterfall',paths=paths,pathWidths=[300]*len(paths),sleepSpots=spots,sleepAvoid=[dict(x=z['x'],y=z['y'],rx=z['rx']+40,ry=z['ry']+40,name=k) for k,z in zones.items()])
walk={k:world[k] for k in ['width','height','water','bridges','obstacles','islets','walkways']};walk['coast']=list(land.buffer(-35).exterior.coords)[:-1]
harbor=dict(jetty=dict(foot=jet[0][0],tip=jet[0][1],width=150),spawn=zones['plaza']['spawn'],boats=[dict(x=2040,y=720,turn=math.pi),dict(x=2360,y=720,turn=math.pi),dict(x=2040,y=1030,turn=math.pi),dict(x=450,y=2690,turn=1.57),dict(x=450,y=3010,turn=1.57),dict(x=7500,y=2690,turn=-1.57),dict(x=7500,y=3010,turn=-1.57),dict(x=3740,y=5200,turn=0),dict(x=4060,y=5200,turn=0)])
open(A+'/ground.svg','w').write(svg(body,W,H));tiles=[]
for row in range(4):
 for col in range(5):
  x=col*1560;y=row*1450;name=f'ground-r{row}-c{col}.svg';open(A+'/'+name,'w').write(svg(body,1560,1450,f'{x} {y} 1560 1450'));tiles.append(dict(src=name,x=x,y=y,width=1560,height=1450))
art=dict(width=W,height=H,sea='#79D5D7',ground=dict(tiles=tiles),decks=decks,flats=flats,props=props)
for name,data in [('world',world),('walk-world',walk),('harbor',harbor)]:json.dump(data,open(D+'/'+name+'.json','w'),separators=(',',':'))
json.dump(art,open(A+'/art.json','w'),separators=(',',':'));print('coast area',land.area,'props',len(props))
