"""Fit approved Honeywood spans by editing longitudinal stations, never SVG transforms.
Posts are rigid translated source rectangles. Cross-deck coordinates and all
vertical heights stay at source scale. The only wrapper transform is translation.
"""
import json, math, re, sys, copy, heapq
from pathlib import Path
import xml.etree.ElementTree as ET
sys.path.insert(0, '/private/tmp/ducky-community-python')
from shapely.geometry import Point, Polygon, LineString, box
from shapely.ops import unary_union, nearest_points
from shapely import affinity
S=Path('scripts/pagepond-bridges'); A=Path('public/pixi-art/themes/library'); D=Path('assets/world/themes/library')
read=lambda p:json.loads(Path(p).read_text())
def save(p,v):Path(p).write_text(json.dumps(v,separators=(',',':'))+'\n')
def path(d):
 g=Polygon()
 for p in d.split('M')[1:]:
  n=list(map(float,re.findall(r'[-+]?(?:\d*\.\d+|\d+)',p)));g=g.symmetric_difference(Polygon(list(zip(n[::2],n[1::2]))).buffer(0))
 return g

def svg(g):
 ps=[g] if g.geom_type=='Polygon' else [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
 return ''.join('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in r.coords)+'Z' for p in ps for r in [p.exterior,*p.interiors])
def shape(o):return Polygon(o['poly']).buffer(0) if o.get('poly') else affinity.scale(Point(o['x'],o['y']).buffer(1,24),o.get('rx',1),o.get('ry',1))
art=read(A/'art.json');world=read(D/'world.json');ground=read('scripts/pagepond/layout.json');dry=path(ground['dry'])
source=read('scripts/pagepond-ground/data/source.json');crossings=read('scripts/pagepond-ground/crossings.json')
bridges=[{'id':c['id'],'a':c['bankA'],'b':c['bankB'],'src':'pagepond/'+c['id']+'-home.svg'}for c in crossings]
for i,w in enumerate(source['walkways'][:5]):
 name=['pagepond-canal-0','pagepond-canal-1','pagepond-west','pagepond-east','pagepond-south'][i]
 bridges.append(dict(w,id=name,src=('pagepond/'+name+'-home.svg' if i<2 else ['jetty-west.svg','jetty-east.svg','jetty-south.svg'][i-2])))
# The south oblique bank uses the matching authored NW source.
# The east crossing sits above the river fork, on its straight reach.
# Fit the whole width, including both rail feet, to the actual dry-bank contour.
for c in bridges:
 if c['id']=='pagepond-south':c['a'][0]=c['b'][0]=6932
 ns=abs(c['b'][1]-c['a'][1])>abs(c['b'][0]-c['a'][0]);cx,cy=[sum(q[k] for q in [c['a'],c['b']])/2 for k in (0,1)]
 if c['id']=='bridge-7':cy=2200
 direction={'bridge-4':'nw'}.get(c['id'],'ns'if ns else'ew')
 diag=direction in ['ne','nw']
 u=([-297,-184]if direction=='nw'else[297,-184])if diag else([0,1]if ns else[1,0]);norm=math.hypot(*u);u=[v/norm for v in u]
 cross=([-85,52]if direction=='nw'else[85,52])if diag else([1,0]if ns else[0,1]);norm=math.hypot(*cross);cross=[v/norm for v in cross]
 def point(t,v=0):return [cx+u[0]*t+cross[0]*v,cy+u[1]*t+cross[1]*v]
 cuts=[]
 for v in [-64,-48,-32,-16,0,16,32,48,64]:
  wet=LineString([point(-1500,v),point(1500,v)]).difference(dry)
  gs=[wet] if wet.geom_type=='LineString' else list(wet.geoms)
  seg=min(gs,key=lambda g:g.distance(Point(point(0,v))));vals=[(q[0]-cx-cross[0]*v)*u[0]+(q[1]-cy-cross[1]*v)*u[1]for q in seg.coords];cuts.append((min(vals),max(vals)))
 lo=min(q[0]for q in cuts)-30;hi=max(q[1]for q in cuts)+30
 c.update(a=point(lo),b=point(hi),w=112,direction=direction,r=24,length=hi-lo)
 if direction=='ew':c['squash']=.62
# Throats join a real existing path, with a straight approach out of each end.
routes=read('scripts/pagepond-ground/sampled-routes.json');baseRoutes=[r for r in routes if not r['id'].startswith('honeywood-')]
baseNetwork=unary_union([LineString(r['samples']).buffer(r['width']/2-12)for r in baseRoutes])
# Route new approaches around fixed contacts and resolved sleepers. Landscape
# can be cleared locally, but residents and functional objects stay fixed.
from shapely.prepared import prep
beds=read('scripts/pagepond-ground/data/current-sleepers.json')
def landscape(p):return bool(re.search(r'tree|bush|flower|grass|reeds|pebble|rock|mushroom',p.get('kind','')+' '+p['src'],re.I))
allProps=[*read('scripts/pagepond-ground/data/keep.json')['props'],*art['props']]
def landscapeObstacle(o):
 p=next((p for p in allProps if p['id']==o.get('name')),None)
 if p is None and not o.get('name') and 'poly'not in o:
  p=next((p for p in allProps if abs(p['x']-o['x'])<2 and abs(p['y']-o['y'])<40),None)
 return p is not None and landscape(p)
hard=unary_union([shape(o) for o in world['obstacles']if not landscapeObstacle(o)]+[affinity.scale(Point(b['x'],b['y']-6).buffer(1,24),b['r']+18,58)for b in beds])
region=dry.buffer(-55).difference(hard.buffer(57));pr=prep(region)
def safe(p):
 if pr.covers(Point(p)):return list(p)
 q=nearest_points(Point(p),region.buffer(-2))[1];return [q.x,q.y]
def route(a,b):
 if pr.covers(LineString([a,b])):return [a,b]
 C=12;pad=1000;x0=math.floor((min(a[0],b[0])-pad)/C)*C;y0=math.floor((min(a[1],b[1])-pad)/C)*C
 key=lambda q:(round((q[0]-x0)/C),round((q[1]-y0)/C))
 point=lambda k:[x0+k[0]*C,y0+k[1]*C]
 start=key(a);queue=[(0,start)];cost={start:0};prev={};seen=set();valid={}
 while queue:
  _,k=heapq.heappop(queue)
  if k in seen:continue
  seen.add(k);p=a if k==start else point(k)
  if math.dist(p,b)<C*2 and pr.covers(LineString([p,b])):
   out=[b,p]
   while k!=start:k=prev[k];out.append(point(k))
   out.append(a);out.reverse();break
  for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)]:
   n=(k[0]+dx,k[1]+dy);q=point(n)
   if n in seen or abs(q[0]-a[0])>abs(b[0]-a[0])+pad or abs(q[1]-a[1])>abs(b[1]-a[1])+pad:continue
   if n not in valid:valid[n]=pr.covers(Point(q))
   if not valid[n] or not pr.covers(LineString([p,q])):continue
   g=cost[k]+math.hypot(dx,dy)*C
   if g<cost.get(n,1e99):cost[n]=g;prev[n]=k;heapq.heappush(queue,(g+math.dist(q,b),n))
 else:raise RuntimeError('No clear landing route '+str((a,b)))
 out2=[out[0]];i=0
 while i<len(out)-1:
  j=len(out)-1
  while j>i+1 and not pr.covers(LineString([out[i],out[j]])):j-=1
  out2.append(out[j]);i=j
 return out2
# The old west-south bridge sat behind the cottage roof. Its new approach
# reaches the same trunk destinations from the open south side of that house.
retired=next(r for r in baseRoutes if r['id']=='west-south-heart')
priorReport=read(S/'report.json')if (S/'report.json').exists()else{}
retired=priorReport.get('retiredRoute',retired)
c=next(c for c in bridges if c['id']=='bridge-10')
r=next(r for r in baseRoutes if r['id']=='west-south-heart')
a,b=c['a'],c['b'];r['samples']=route(safe(retired['samples'][0]),safe(a))+[b]+route(safe(b),safe(retired['samples'][-1]))[1:]
retiredCentre=priorReport.get('retiredCentreRoute',copy.deepcopy(next(r for r in baseRoutes if r['id']=='centre-11')))
centre=next(r for r in baseRoutes if r['id']=='centre-11');ps=retiredCentre['samples']
ii=[i for i,p in enumerate(ps)if p[1]>4250 and p[0]<950];lo=max(0,min(ii)-1);hi=min(len(ps)-1,max(ii)+1)
centre['samples']=ps[:lo]+route(safe(ps[lo]),safe(a))+[b]+route(safe(b),safe(ps[hi]))[1:]+ps[hi+1:]
originalById={r['id']:r for r in copy.deepcopy(baseRoutes)}
originalById.update({r['id']:r for r in priorReport.get('originalRoutes',priorReport.get('diagonalRoutes',[]))})
originalRoutes=list(originalById.values());affectedRouteIds=set();changedPieces=[]
for c in bridges:
 if c['id'] not in ['bridge-4','bridge-7']:continue
 old=next(q for q in source['crossings']if q['id']==c['id']);axis=LineString([old['bankA'],old['bankB']]);mid=axis.interpolate(.5,normalized=True)
 for original in originalRoutes:
  ps=original['samples'];ii=[i for i,p in enumerate(ps)if axis.distance(Point(p))<160 and mid.distance(Point(p))<1000 and not dry.buffer(-55).covers(Point(p))]
  if not ii:continue
  affectedRouteIds.add(original['id'])
  r=next(r for r in baseRoutes if r['id']==original['id']);lo=max(0,min(ii)-1);hi=min(len(ps)-1,max(ii)+1)
  while lo>0 and not pr.covers(Point(ps[lo])):lo-=1
  while hi<len(ps)-1 and not pr.covers(Point(ps[hi])):hi+=1
  a,b=c['a'],c['b']
  if math.dist(ps[lo],a)>math.dist(ps[lo],b):a,b=b,a
  piece=route(safe(ps[lo]),safe(a))+[b]+route(safe(b),safe(ps[hi]))[1:]
  r['samples']=ps[:lo]+piece+ps[hi+1:];changedPieces.append(LineString(piece).buffer(r['width']/2))
baseNetwork=unary_union([LineString(r['samples']).buffer(r['width']/2-12)for r in baseRoutes])
landings=[];extra=[]
for c in bridges:
 u=[(c['b'][k]-c['a'][k])/c['length'] for k in (0,1)]
 for side,p in [(-1,c['a']),(1,c['b'])]:
  q=safe([p[k]+side*u[k]*100 for k in (0,1)])
  # Connect on the same bank, avoiding a false nearest point across the river.
  local=baseNetwork.intersection(region).intersection(Point(q).buffer(650)).difference(LineString([c['a'],c['b']]).buffer(10))
  target=nearest_points(Point(q),local)[1] if not local.is_empty else nearest_points(Point(q),baseNetwork)[1]
  pts=[p,*route(q,[target.x,target.y])]
  throat=LineString(pts).buffer(52,quad_segs=16).union(Point(p).buffer(64,quad_segs=16)).intersection(dry)
  extra.append(throat);landings.append({'id':c['id'],'end':'a'if side<0 else'b','point':p,'shape':svg(throat),'route':pts})
  routesId='honeywood-'+c['id']+('-a'if side<0 else'-b')
  baseRoutes.append({'id':routesId,'width':104,'samples':pts})
# Clear the landing and its sightline. Only landscape props may be lifted out;
# a building, sleeper or functional prop in a throat is a failing build.
throats=unary_union(extra+changedPieces+[LineString(r['samples']).buffer(r['width']/2)for r in baseRoutes if r['id'] in ['west-south-heart','centre-11']]);beds=read('scripts/pagepond-ground/data/current-sleepers.json')
removed=[];remaining=[]
prior=read(S/'report.json') if (S/'report.json').exists() else {}
retiredBridgeParts=sorted(set(prior.get('retiredBridgeParts',[])+[p['id']for p in art['props']if re.search(r'canal-bridge-(north|south)-front\.svg$',p['src'])]))
for p in art['props']:
 if p['id'] in retiredBridgeParts:continue
 k=p.get('scale',1);w=p['width']*k;h=p['height']*k;a=p.get('anchor',{'x':.5,'y':1})
 landscape=bool(re.search(r'tree|bush|flower|grass|reeds|pebble|rock|mushroom',p.get('kind','')+' '+p['src'],re.I))
 # Full plant silhouette near deck landings, so canopies cannot cover the rails.
 visible=box(p['x']-w*a['x'],p['y']-h*a['y'],p['x']+w*(1-a['x']),p['y']+h*(1-a['y']))
 contact=shape(p['footprint']) if p.get('footprint') else Point(p['x'],p['y']).buffer(min(20,w*.15))
 hit=contact.intersects(throats.buffer(16)) or (landscape and visible.intersects(unary_union([Point(l['point']).buffer(70)for l in landings])))
 if hit and landscape:
  if any(b.get('tree')==p['id'] for b in beds):raise RuntimeError('Sleeping tree on landing '+p['id'])
  removed.append(p['id'])
 else:remaining.append(p)
art['props']=remaining
clearedIds=set(removed+prior.get('clearedLandscape',[])+retiredBridgeParts)
knownProps={p['id']:p for p in [*read('scripts/pagepond-ground/data/keep.json')['props'],*prior.get('clearedProps',[]),*art['props']]}
clearedProps=[knownProps[id]for id in sorted(clearedIds)if id in knownProps]
def clearedObstacle(o):
 if o.get('name') in clearedIds:return True
 if o.get('name') or 'poly'in o:return False
 return any(abs(o['x']-p['x'])<2 and abs(o['y']-p['y'])<40 for p in clearedProps)
world['obstacles']=[o for o in world['obstacles']if not clearedObstacle(o)]
# Widen the existing single opaque painter, preserving inlays and terrain ordering.
courts=[path(c['d'])for c in read('scripts/pagepond-ground/surface.json')['courts']]
merged=unary_union([throats,*courts,*[LineString(r['samples']).buffer(r['width']/2,quad_segs=12)for r in baseRoutes]])
contacts=unary_union([shape(o)for o in world['obstacles']]).union(hard)
fillets=merged.buffer(65,quad_segs=12).buffer(-65,quad_segs=12).difference(merged).difference(contacts.buffer(8))
surface=merged.union(fillets).intersection(dry).simplify(.08,preserve_topology=True)
NS='http://www.w3.org/2000/svg';ET.register_namespace('',NS)
for t in art['ground']['tiles']:
 f=A/t['src'];root=ET.parse(f).getroot()
 for e in root.iter():
  if e.get('data-pagepond-paths')=='home-system':e.set('d',svg(surface.intersection(box(t['x']-8,t['y']-8,t['x']+t['width']+8,t['y']+t['height']+8))))
 f.write_text(ET.tostring(root,encoding='unicode'))
f=A/'pagepond/outer-source.svg';root=ET.parse(f).getroot()
for e in root.iter():
 if e.get('data-pagepond-paths')=='home-system':e.set('d',svg(surface))
f.write_text(ET.tostring(root,encoding='unicode'))
s=read('scripts/pagepond-ground/surface.json');s.update(d=svg(surface),rings=[list(r.coords)for p in ([surface]if surface.geom_type=='Polygon'else surface.geoms)for r in [p.exterior,*p.interiors]])
save('scripts/pagepond-ground/surface.json',s);save('scripts/pagepond-ground/sampled-routes.json',baseRoutes)
Path('scripts/pagepond-ground/path-surface.svgfrag').write_text('<path data-pagepond-paths="home-system" fill="#FFF0C7" fill-rule="evenodd" d="'+s['d']+'"/>')
# Absolute M/L/Q/Z are the complete vocabulary of these approved source paths.
def commands(d):
 tokens=re.findall(r'[MLQZ]|[-+]?(?:\d*\.\d+|\d+)',d);out=[];i=0
 while i<len(tokens):
  op=tokens[i];i+=1;n={'M':2,'L':2,'Q':4,'Z':0}[op];out.append([op,list(map(float,tokens[i:i+n]))]);i+=n
 return out
def stations(d):return re.findall(r'M[^M]+',d)
def fmt(v):return f'{v:.4f}'.rstrip('0').rstrip('.') or '0'
for c in bridges:
 ns=c['direction']=='ns';diag=c['direction'] in ['ne','nw'];root=ET.parse('public/pixi-art/home-expansion-c/bridges/bridge-'+c['direction']+'.svg').getroot();g=next(e for e in root if e.tag.endswith('g'));paths=[e for e in g.iter()if e.tag.endswith('path')]
 # Retire the source wrapper's end sills, leaving no slab over the path join.
 for e in paths[:2]:g.remove(e)
 L=c['length'];delta=L-(math.hypot(297,184)if diag else 260 if ns else 420);allpoints=[]
 for idx,e in enumerate(paths[2:],2):
  ds=[]
  for subIndex,d in enumerate(stations(e.get('d'))):
   cmds=commands(d);coords=[v for op,vs in cmds for v in zip(vs[::2],vs[1::2])];xs=[p[0]for p in coords]
   post=(diag and idx in [2,13])or(ns and idx in [8,9]) or (not ns and not diag and len(cmds)==5 and max(xs)-min(xs)<=6.1 and any(op=='Z'for op,vs in cmds))
   out=[]
   for j,(op,vs)in enumerate(cmds):
    new=[]
    for pair,(x,y) in enumerate(zip(vs[::2],vs[1::2])):
     if diag:
      if post:t=subIndex/5
      elif idx in [3,4,6,9,10,14,15]:t=0 if op=='M'else 1 if op=='L'else(.5 if pair==0 else(1 if j==1 else 0))
      elif idx==5:t=0 if op=='M'or j==5 else 1 if op=='L'else(.5 if pair==0 else(1 if j==1 else 0))
      elif idx==7:t=(subIndex+1)/15
      elif idx==8:t=(subIndex+.5)/6
      elif idx in [11,12]:t=0
      else:t=subIndex/5
      ux=(-297 if c['direction']=='nw'else 297)/math.hypot(297,184);uy=-184/math.hypot(297,184)
      x+=delta*t*ux;y+=delta*t*uy
     elif not ns:
      center=(min(xs)+max(xs))/2
      x=30+(x-30)*L/420 if not post else 30+(center-30)*L/420+(x-center)
     else:
      if post:t=subIndex/5
      elif idx==2:t=[0,1,1,0,0][j]
      elif idx==3:t=0 if op=='M' else (1 if op=='L' else (.5 if pair==0 else (1 if j==1 else 0)))
      elif idx==4:t=(66-min(xs))/6
      elif idx==5:
       yy=coords[0][1];t=(-(260-96)+math.sqrt((260-96)**2+384*(yy-50)))/192
      elif idx in [6,7]:t=1
      elif idx in [10,11]:t=0 if op=='M' else (1 if op=='L' else (.5 if pair==0 else (1 if j==1 else 0)))
      else:t=(66-x)/6 if x<120 else (x-174)/6
      y+=delta*t
      # Keep rail ribbons and deck edge on the same 24-unit source crown as
      # the boards/post stations. The old NS control was 12 units too flat.
      if idx in [3,10,11] and op=='Q' and pair==0:y-=24
     new.extend([x,y]);allpoints.append([x,y])
    out.append(op+' '.join(fmt(v)for v in new))
   ds.append(' '.join(out))
  e.set('d',' '.join(ds))
 x0=min(p[0]for p in allpoints)-3;y0=min(p[1]for p in allpoints)-3;x1=max(p[0]for p in allpoints)+3;y1=max(p[1]for p in allpoints)+3
 sx,sy=([388.5,292]if c['direction']=='nw'else[91.5,292])if diag else([120,50]if ns else[30,169.2])
 tx=c['a'][0]-sx;ty=c['a'][1]-sy
 # Art is one source unit per world unit, translation only, in both renderer
 # placement and SVG wrapper. Span changes are already in path coordinates.
 root=ET.Element('{'+NS+'}svg',{'data-home-source':'/pixi-art/home-expansion-c/bridges/bridge-'+c['direction']+'.svg','width':fmt(x1-x0),'height':fmt(y1-y0),'viewBox':' '.join(map(fmt,[x0,y0,x1-x0,y1-y0]))})
 root.append(g);(A/c['src']).write_text('\n'.join(line.rstrip()for line in ET.tostring(root,encoding='unicode').splitlines())+'\n')
 d=next((d for d in art['decks']if d.get('id')==c['id'] or d['src']==c['src']),None)
 if d is None:d={};art['decks'].append(d)
 d.update(id=c['id'],bridgeId=c['id'],src=c['src'],homeSource=root.get('data-home-source'),a=c['a'],b=c['b'],x=x0+tx,y=y0+ty,width=x1-x0,height=y1-y0,resolution=1.5,overBoats=True)
 c['transform']=[1,0,0,1,tx,ty];c['crossDeckScale']=1
# Retain only the two genuine docks. All 17 crossings now share art + physics.
retained=source['walkways'][5:];pier=next(w for w in world['walkways']if w.get('id')=='hamlet-paperboat-south-jetty')
arches=[{k:c[k]for k in ['id','a','b','w','r',*(['squash']if 'squash'in c else[])]}for c in bridges]
rects=[]
for w in [*arches,*retained,pier]:
 dx=w['b'][0]-w['a'][0];dy=w['b'][1]-w['a'][1];L=math.hypot(dx,dy);half=(w['w']/2-10)/(abs(dx/L)+abs(dy/L));n=math.ceil(L/10)
 for i in range(n+1):rects.append({'name':w.get('id','reading-dock'),'x':w['a'][0]+dx*i/n,'y':w['a'][1]+dy*i/n,'w':half*2+16,'h':half*2+24})
world.update(arches=arches+source['arches'][5:],walkways=[{k:w[k]for k in ['id','a','b','w']}|{'boatPassUnder':True}for w in arches]+retained+[pier],bridges=rects,props=art['props'])
for f in ['world.json','walk-world.json']:
 w=world if f=='world.json'else read(D/f)
 for k in ['arches','walkways','bridges','obstacles']:w[k]=world[k]
 save(D/f,w)
for c in ground['crossings']:
 a=next(b for b in bridges if b['id']==c['id']);c.update(bankA=a['a'],bankB=a['b'],length=a['length'],x=(a['a'][0]+a['b'][0])/2,y=(a['a'][1]+a['b'][1])/2,rise=24,width=112,homeSource='/pixi-art/home-expansion-c/bridges/bridge-'+a['direction']+'.svg')
for f in ['scripts/pagepond/layout.json','scripts/pagepond-hamlets/placement.json','scripts/bigger-library/plan.json']:
 o=ground if 'pagepond/layout'in f else read(f);o.update(floor=s['d'],floorRings=s['rings'],outerFloorRings=s['rings'])
 key='links'if 'pagepond-hamlets'in f else'roads';o[key]=[{'id':r['id'],'width':r['width'],'points':r['samples'],**({'kind':'home-system'}if key=='links'else{})}for r in baseRoutes]
 if 'bigger-library'in f:o['crossings']=ground['crossings']
 save(f,o)
for f in ['art.json']:save(A/f,art)
benchFile=Path('scripts/pagepond-benches/placement.json');benches=read(benchFile)
for b in benches:
 b.setdefault('originalObstacleIndex',b['obstacleIndex']);b['obstacleIndex']=next(i for i,o in enumerate(world['obstacles'])if o.get('name')==b['id'])
benchFile.write_text(json.dumps(benches,indent=2)+'\n')
save(D/'placements.json',art['props'])
sizes=read('src/pixi/art-source-sizes.json')
for c in bridges:
 d=next(d for d in art['decks']if d.get('id')==c['id']);sizes['/pixi-art/themes/library/'+d['src']]=[d['width'],d['height']]
save('src/pixi/art-source-sizes.json',sizes)
removed=sorted(set(removed+prior.get('clearedLandscape',[])))
save(S/'report.json',{'bridges':bridges,'landings':landings,'clearedLandscape':removed,'retiredBridgeParts':retiredBridgeParts,'clearedProps':clearedProps,'retiredRoute':retired,'retiredCentreRoute':retiredCentre,'originalRoutes':[r for r in originalRoutes if r['id'] in affectedRouteIds]})
print('Honeywood:',len(bridges),'unsheared spans,',len(landings),'joined throats,',len(removed),'landscape props cleared')
