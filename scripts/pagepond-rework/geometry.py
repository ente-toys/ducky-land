import json,sys,math,heapq
from shapely.geometry import Polygon,Point,LineString,GeometryCollection,box
from shapely.ops import unary_union,split
from shapely.geometry.polygon import orient
from shapely.prepared import prep
from shapely import set_precision
p=json.load(open(sys.argv[1]));props=p['props'];shapes=p['shapes'];beds=p['beds'];adjustments=[];omitted=[]
def clean(poly):
 g=Polygon(poly);return set_precision(g if g.is_valid else g.buffer(0),.01)
def polygons(g):return [g] if g.geom_type=='Polygon' else [q for q in getattr(g,'geoms',[]) if q.geom_type=='Polygon']
def rings(g):
 out=[]
 for q in polygons(g):
  q=orient(q,1);out.append(list(q.exterior.coords)[:-1]);out.extend(list(i.coords)[:-1] for i in q.interiors)
 return [[[round(x,3),round(y,3)] for x,y in r] for r in out]
def path(g):return ''.join('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in r)+'Z' for r in rings(g))
def ellipse(x,y,rx,ry,n=24):return Polygon([(x+math.cos(i*math.tau/n)*rx,y+math.sin(i*math.tau/n)*ry) for i in range(n)])
def smooth(points,step=12):
 out=[]
 for i in range(len(points)-1):
  a,b,c,d=points[max(0,i-1)],points[i],points[i+1],points[min(i+2,len(points)-1)];n=max(4,math.ceil(math.dist(b,c)/step))
  for j in range(n):
   t=j/n;out.append([.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in range(2)])
 return out+[points[-1]]
old=unary_union([clean(r) for r in p['oldCoast']]);expanded=unary_union([clean(r) for r in p['expandedCoast']])
apron=Polygon([(7040,5300),(9790,5010),(10000,5710),(10000,6510),(9750,6990),(9000,7180),(8100,7080),(7250,6780)]).buffer(130).buffer(-130)
expanded=expanded.union(apron)
shorecut=Polygon(p['shoreLine']+[[11200,8500],[6500,8500]]).buffer(0)
expanded=expanded.difference(shorecut).buffer(-100).buffer(100,quad_segs=12).union(old)
wet=old.buffer(340,quad_segs=12).difference(old)
for ch in p['channels']:
 samples=ch['samples'];parts=[]
 for a,b in zip(samples,samples[1:]):parts.append(LineString([a[:2],b[:2]]).buffer((a[2]+b[2])/4,quad_segs=8))
 wet=wet.union(unary_union(parts))
wet=wet.difference(old).buffer(0)
dry=expanded.difference(wet).buffer(-85).buffer(85,quad_segs=12).union(old).buffer(0)
wet=wet.union(expanded.difference(dry)).difference(old).buffer(0)
crossings=[]
for spec in p['straightBridges']:
 c=dict(spec);ns=c['direction']=='ns';cx,cy=c['x'],c['y']
 def point(u,v):return (cx+v,cy+u) if ns else (cx+u,cy+v)
 def interval(v):
  cut=wet.intersection(LineString([point(-1100,v),point(1100,v)]))
  segs=[cut] if cut.geom_type=='LineString' else [g for g in getattr(cut,'geoms',[]) if g.geom_type=='LineString']
  seg=min(segs,key=lambda g:g.distance(Point(cx,cy)))
  vals=[(y-cy if ns else x-cx) for x,y in seg.coords];return min(vals),max(vals)
 spans=[interval(c['width']/2*j/12) for j in range(-12,13)];lo=min(a for a,b in spans);hi=max(b for a,b in spans)
 A=list(point(lo-20,0));B=list(point(hi+20,0))
 c.update(x=(A[0]+B[0])/2,y=(A[1]+B[1])/2,angle=math.pi/2 if ns else 0,length=math.dist(A,B),bankA=A,bankB=B,waterA=list(point(lo,0)),waterB=list(point(hi,0)),channel='continuous-moat',centreSource='canal-bridge-north.svg',rise=65)
 crossings.append(c)
bridgeKeepOut=unary_union([LineString([c['bankA'],c['bankB']]).buffer(c['width']/2+45) for c in crossings])
byid={q['id']:q for q in props};shape_by={s['id']:s for s in shapes}
def root_id(s):
 r=s.get('parent') or s['id'];seen=set()
 while r in byid and byid[r].get('parent') and r not in seen:seen.add(r);r=byid[r]['parent']
 return r
groups={}
for s in shapes:groups.setdefault(root_id(s),[]).append(s)
for s in shapes:s['poly']=list(clean(s['poly']).simplify(.3).exterior.coords)[:-1] if clean(s['poly']).geom_type=='Polygon' else s['poly']
legacy=[]
for o in p['originalObstacles']:
 legacy.append(clean(o['poly']) if o.get('poly') else ellipse(o['x'],o['y'],o['rx'],o['ry']))
accepted=list(legacy);accepted_ids=['centre']*len(accepted);blocked_beds=[ellipse(b['x'],b['y']-6,93,56) for b in beds]
print('Water geometry ready',flush=True)
valid_dry=prep(dry.buffer(-6));old_prep=prep(old)
def solid_group(ss):return unary_union([clean(s['poly']) for s in ss if s.get('solid')])
def translate_group(ss,dx,dy):
 ids={s['id'] for s in ss}
 for s in ss:s['poly']=[[x+dx,y+dy] for x,y in s['poly']]
 for q in props:
  if q['id'] in ids:
   q['x']+=dx;q['y']+=dy
   if 'z' in q:q['z']+=dy
   if q.get('footprint'):q['footprint']['poly']=[[x+dx,y+dy] for x,y in q['footprint']['poly']]
order=sorted(groups.items(),key=lambda kv:(0 if any(byid.get(s['id'],{}).get('kind')=='building' for s in kv[1]) else 2 if any(s.get('meadow') for s in kv[1]) else 1))
for rid,ss in order:
 if all(s.get('boat') or s.get('dock') for s in ss):continue
 solid=solid_group(ss);meadow=any(s.get('meadow') for s in ss)
 if p.get('lockedContacts'):
  if not solid.is_empty:accepted.append(solid);accepted_ids.append(rid)
  continue
 non_parent=[s for s in ss if not s.get('parent')];contact=unary_union([clean(s['poly']) for s in non_parent])
 if contact.is_empty:continue
 def fits(dx,dy):
  from shapely.affinity import translate
  g=translate(contact,dx,dy);sg=translate(solid,dx,dy)
  if not valid_dry.covers(g) or g.intersection(old).area>.3 or g.intersection(bridgeKeepOut).area>.3:return False
  if not sg.is_empty:
   if any(sg.intersection(t).area>1 for t in accepted if sg.bounds[0]<t.bounds[2] and sg.bounds[2]>t.bounds[0] and sg.bounds[1]<t.bounds[3] and sg.bounds[3]>t.bounds[1]):return False
   if any(sg.intersection(b).area>.5 for b in blocked_beds):return False
   for s in ss:
    q=byid.get(s['id'])
    if not q or q.get('contact') is False or q.get('parent'):continue
    x,y=q['x']+dx,q['y']+dy;w=q['width']*q.get('scale',1);h=q['height']*q.get('scale',1)
    if any(math.hypot(b['x']-x,(b['y']-y)*1.6)<w*.4+94 or (y>b['y']-20 and y-b['y']<h*.9 and abs(b['x']-x)<w/2+50) for b in beds):return False
  return True
 if not fits(0,0):
  if meadow:
   omitted.extend({'id':s['id'],'reason':'authored meadow site intersects water, trunk or resting clearance'} for s in ss);continue
  found=None
  for r in range(12,493,12):
   for n in range(32):
    a=n*math.tau/32;dx,dy=math.cos(a)*r,math.sin(a)*r
    if fits(dx,dy):found=(dx,dy);break
   if found:break
  if not found:
   if solid.is_empty:
    for r in range(12,493,12):
     for n in range(24):
      a=n*math.tau/24;dx,dy=math.cos(a)*r,math.sin(a)*r
      from shapely.affinity import translate
      if valid_dry.covers(translate(contact,dx,dy)) and translate(contact,dx,dy).intersection(old).area<.3:found=(dx,dy);break
     if found:break
   if not found:raise RuntimeError('No safe authored contact '+rid)
  translate_group(ss,*found);adjustments.append({'id':rid,'dx':found[0],'dy':found[1]});solid=solid_group(ss)
 if not solid.is_empty:accepted.append(solid);accepted_ids.append(rid)
print('Contact layout ready',len(adjustments),len(omitted),flush=True)
keep={s['id'] for s in shapes}-{q['id'] for q in omitted};shapes=[s for s in shapes if s['id'] in keep];props=[q for q in props if q['id'] in keep or q['id'] not in shape_by]
byid={q['id']:q for q in props}
for s in shapes:
 if s['id'] in byid:byid[s['id']]['footprint']={'poly':s['poly']}
bridge_surfaces=[LineString([c['bankA'],c['bankB']]).buffer(c['width']/2-13) for c in crossings]
bridge_surfaces.extend(LineString([w['a'],w['b']]).buffer(w['w']/2-12) for w in p['oldWalkways'])
surface=dry.buffer(-25).union(unary_union(bridge_surfaces));forbidden=unary_union(legacy).buffer(17).union(unary_union(accepted[len(legacy):]).buffer(45)).union(unary_union(blocked_beds).buffer(25))
json.dump({'crossings':crossings,'dry':rings(dry),'wet':rings(wet)},open('/tmp/pagepond-geometry-debug.json','w'))
free=prep(surface.difference(forbidden));dryPrep=prep(dry)
def nearest_free(a,rmax=180):
 if free.covers(Point(a)):return list(a)
 for r in range(15,rmax+1,15):
  for n in range(24):
   q=[a[0]+math.cos(n*math.tau/24)*r,a[1]+math.sin(n*math.tau/24)*r]
   if free.covers(Point(q)):return q
 raise RuntimeError('No free route anchor '+str(a))
def route(a,b):
 a,b=nearest_free(a),nearest_free(b);C=30;x0=math.floor((min(a[0],b[0])-750)/C)*C;y0=math.floor((min(a[1],b[1])-750)/C)*C;nx=math.ceil((max(a[0],b[0])+750-x0)/C);ny=math.ceil((max(a[1],b[1])+750-y0)/C)
 def grid(q):return (round((q[0]-x0)/C),round((q[1]-y0)/C))
 def point(k):return [x0+k[0]*C,y0+k[1]*C]
 start,end=grid(a),grid(b);heap=[(0,start)];cost={start:0};prev={};closed=set()
 while heap:
  _,cur=heapq.heappop(heap)
  if cur in closed:continue
  if cur==end:
   out=[b];t=cur
   while t!=start:out.append(point(t));t=prev[t]
   out.append(a);out.reverse();return out
  closed.add(cur)
  for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)]:
   k=(cur[0]+dx,cur[1]+dy)
   if k[0]<0 or k[1]<0 or k[0]>=nx or k[1]>=ny or k in closed:continue
   q=point(k)
   if k!=end and not free.covers(Point(q)):continue
   middle=[(q[0]+point(cur)[0])/2,(q[1]+point(cur)[1])/2]
   if not free.covers(Point(middle)):continue
   g=cost[cur]+math.hypot(dx,dy)*C
   if g<cost.get(k,1e99):cost[k]=g;prev[k]=cur;heapq.heappush(heap,(g+math.dist(q,b),k))
 raise RuntimeError('No path '+str((a,b)))
def soft_line(points):
 simple=[]
 for q in LineString(points).simplify(16).coords:
  if not simple or math.dist(simple[-1],q)>.01:simple.append(q)
 if len(simple)<3:return simple
 out=[simple[0]]
 for i in range(1,len(simple)-1):
  a,b,c=simple[i-1:i+2];la=math.dist(a,b);lb=math.dist(b,c);r=min(180,la*.45,lb*.45)
  for attempt in range(4):
   A=[b[k]+(a[k]-b[k])*r/la for k in range(2)];B=[b[k]+(c[k]-b[k])*r/lb for k in range(2)]
   if all(free.covers(Point([(1-t)**2*A[k]+2*(1-t)*t*b[k]+t*t*B[k] for k in range(2)])) for t in [.125,.25,.375,.5,.625,.75,.875]):break
   r*=.5
  A=[b[k]+(a[k]-b[k])*r/la for k in range(2)];B=[b[k]+(c[k]-b[k])*r/lb for k in range(2)]
  out.append(A)
  for n in range(1,9):
   t=n/8;u=1-t;out.append([u*u*A[k]+2*u*t*b[k]+t*t*B[k] for k in range(2)])
 out.append(simple[-1]);return out
roads=[];floor_parts=[]
for r in p['roads']:
 print('Routing',r['id'],flush=True)
 base=LineString(r['samples']);events=[]
 for c in crossings:
  if c['road']!=r['id']:continue
  ux=(c['bankB'][0]-c['bankA'][0])/c['length'];uy=(c['bankB'][1]-c['bankA'][1])/c['length']
  A=[c['bankA'][0]-ux*350,c['bankA'][1]-uy*350];B=[c['bankB'][0]+ux*350,c['bankB'][1]+uy*350]
  at=base.project(Point(c['x'],c['y']));a=base.interpolate(max(0,at-30));b=base.interpolate(min(base.length,at+30))
  if (b.x-a.x)*ux+(b.y-a.y)*uy<0:A,B=B,A
  events.append((at-300,at+300,A,B))
 events.sort();anchors=[];cursor=-1
 for lo,hi,A,B in events:
  anchors.extend(q for q in r['points'] if cursor<base.project(Point(q))<lo);anchors.extend([A,B]);cursor=hi
 anchors.extend(q for q in r['points'] if base.project(Point(q))>cursor)
 line=[]
 for a,b in zip(anchors,anchors[1:]):
  direct=any(math.dist(a,A)<.01 and math.dist(b,B)<.01 for lo,hi,A,B in events)
  segment=[a,b] if direct else route(a,b);line.extend(segment if not line else segment[1:])
 line=soft_line(line);roads.append({'id':r['id'],'width':r['width'],'points':line});floor_parts.append(LineString(line).buffer(r['width']/2,quad_segs=8,join_style=1))
links=[{'id':r['id'],'points':r['points'],'width':r['width'],'kind':'main-bypass'} for r in roads]
road_union=unary_union([LineString(r['points']) for r in roads]);courts=p['courts']
for c in courts:floor_parts.append(clean(c['poly']) if c['source'] in ['writing-square','printing-square','plaza','workshop-plaza'] else clean(c['poly']).intersection(dry.buffer(-50)))
entranceChecks=[]
for e in p['entrances']:
 requested=e['point'];lane=min((c for c in courts if c['hamlet']==e['hamlet']),key=lambda c:clean(c['poly']).distance(Point(requested)));region=clean(lane['poly']).intersection(dry.buffer(-55)).difference(forbidden)
 from shapely.ops import nearest_points
 start=list(nearest_points(Point(requested),region)[1].coords)[0] if not region.is_empty else requested
 target=road_union.interpolate(road_union.project(Point(start))) if road_union.geom_type=='LineString' else min((g.interpolate(g.project(Point(start))) for g in road_union.geoms),key=lambda q:q.distance(Point(start)))
 if e.get('goal') is not None:target=Point(e['goal'])
 line=soft_line(route(start,[target.x,target.y]));entranceChecks.append({'id':e['id'],'hamlet':e['hamlet'],'requested':requested,'point':line[0],'source':lane['source']});floor_parts.append(LineString(line).buffer(e['width']/2,quad_segs=8));links.append({'id':e['id'],'points':line,'width':e['width'],'kind':'entrance'})
for q in props:
 if q.get('kind')=='building' and q.get('hamlet'):
  court=next(c for c in courts if c['hamlet']==q['hamlet']);g=clean(court['poly']);a=Point(q['x'],q['y']+32);b=g.exterior.interpolate(g.exterior.project(a))
  if a.distance(g)>15:
   line=soft_line(route([a.x,a.y],[b.x,b.y]));floor_parts.append(LineString(line).buffer(38,quad_segs=8));links.append({'id':q['id']+'-door-path','points':line,'width':76,'kind':'door'})
for c in crossings:
 ux=(c['bankB'][0]-c['bankA'][0])/c['length'];uy=(c['bankB'][1]-c['bankA'][1])/c['length']
 for sign,bank in [(-1,c['bankA']),(1,c['bankB'])]:
  end=[bank[0]+sign*ux*180,bank[1]+sign*uy*180];floor_parts.append(LineString([bank,end]).buffer(c['width']/2+4,cap_style=2))
  links.append({'id':c['id']+'-straight-landing-'+str(sign),'points':[bank,end],'width':c['width']+8,'kind':'bridge'})
 for bank in [c['bankA'],c['bankB']]:
  lines=[LineString(r['points']) for r in roads];line=min(lines,key=lambda l:l.distance(Point(bank)));q=line.interpolate(line.project(Point(bank)));pts=[bank,[q.x,q.y]]
  floor_parts.append(LineString(pts).buffer(c['width']/2,quad_segs=8));links.append({'id':c['id']+'-landing-'+str(len(links)),'points':pts,'width':c['width'],'kind':'bridge'})
dock=next(s for s in shapes if s.get('dock'));db=clean(dock['poly']).bounds;a=[(db[0]+db[2])/2,db[1]+14];b=[a[0],a[1]-100];floor_parts.append(LineString([a,b]).buffer(40));links.append({'id':'paperboat-jetty-approach','points':[a,b],'width':80,'kind':'jetty'})
for s in shapes:
 s['poly']=[[round(x,2),round(y,2)] for x,y in s['poly']]
 if s['id'] in byid:byid[s['id']]['footprint']={'poly':s['poly']}
all_contacts=unary_union(legacy+[clean(s['poly']) for s in shapes if not s.get('parent') and not s.get('boat') and not s.get('dock')])
joined_floor=unary_union(floor_parts).buffer(65,quad_segs=10).buffer(-65,quad_segs=10)
floor=joined_floor.intersection(dry).difference(all_contacts.buffer(3,quad_segs=6)).difference(unary_union(blocked_beds)).buffer(0)
centreLandings=floor.intersection(old).intersection(unary_union([LineString([c['bankA'],c['bankB']]).buffer(c['width']/2+2).buffer(270) for c in crossings]))
def noholes(g):
 result=[]
 for poly in polygons(g):
  todo=[poly]
  while todo:
   q=todo.pop()
   if not q.interiors:result.append(q);continue
   hole=Polygon(q.interiors[0]);x=hole.representative_point().x;bounds=q.bounds;parts=split(q,LineString([(x,bounds[1]-10),(x,bounds[3]+10)]));todo.extend(polygons(parts))
 return result
water_polys=[]
for q in noholes(wet.intersection(expanded.buffer(1300))):
 water_polys.extend(noholes(q.buffer(2).intersection(wet)))
boatWater=[list(q.simplify(3,preserve_topology=True).exterior.coords)[:-1] for q in water_polys]
walkWet=wet.difference(old.buffer(21,quad_segs=12)).intersection(expanded.buffer(1300));water=[]
C=512;b=walkWet.bounds
for x in range(math.floor(b[0]/C)*C,math.ceil(b[2]/C)*C,C):
 for y in range(math.floor(b[1]/C)*C,math.ceil(b[3]/C)*C,C):
  patch=walkWet.intersection(box(x,y,x+C,y+C))
  for q in noholes(patch):
   if q.area>.1:water.append({'name':'Pagepond open moats and rivers','poly':list(q.simplify(.1,preserve_topology=True).exterior.coords)[:-1]})
coastRings=[]
for q in sorted(polygons(expanded),key=lambda q:q.centroid.x):
 rr=list(orient(q,1).exterior.coords)[:-1];reference=p['expandedCoast'][len(coastRings)][0];index=min(range(len(rr)),key=lambda i:math.dist(rr[i],reference));rr=rr[index:]+rr[:index];coastRings.append(rr)
coast=[]
for rr in coastRings:coast.extend(rr+[rr[0],coastRings[0][0]])
bridgeRects=[]
for c in crossings+[{'id':'legacy-arch-'+str(i),'bankA':w['a'],'bankB':w['b'],'width':w['w']} for i,w in enumerate(p['oldWalkways'][:5])]:
 A,B=c['bankA'],c['bankB'];dx,dy=B[0]-A[0],B[1]-A[1];L=math.hypot(dx,dy);ux,uy=dx/L,dy/L;nx,ny=-uy,ux;W=c['width']/2
 poly=[(A[0]-ux*12+nx*W,A[1]-uy*12+ny*W),(B[0]+ux*12+nx*W,B[1]+uy*12+ny*W),(B[0]+ux*12-nx*W,B[1]+uy*12-ny*W),(A[0]-ux*12-nx*W,A[1]-uy*12-ny*W)];c['footprint']=poly;shape=LineString([A,B]).buffer(W,quad_segs=12);lo,hi=shape.bounds[1],shape.bounds[3]
 for j in range(math.ceil((hi-lo)/6)):
  y=lo+(j+.5)*6;cut=shape.intersection(LineString([(shape.bounds[0]-5,y),(shape.bounds[2]+5,y)]))
  if not cut.is_empty:
   bounds=cut.bounds;bridgeRects.append({'name':c['id'],'x':(bounds[0]+bounds[2])/2,'y':y,'w':bounds[2]-bounds[0]+16,'h':31})
obstacles=[{'name':s['id'],'poly':s['poly']} for s in shapes if s.get('solid') and not s.get('parent')]
boatTours=[]
for i,r in enumerate(p['oldCoast']):
 q=clean(r).buffer(170,quad_segs=12);coords=list(q.exterior.simplify(12).coords);tour=[]
 for a,b in zip(coords,coords[1:]):
  n=max(1,math.ceil(math.dist(a,b)/100));tour.extend([[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n] for j in range(n)])
 tour.append(tour[0]);boatTours.append({'id':['west-moat','east-moat'][i],'points':tour})
mouths=[[-3100,1900,-2100,2940],[9950,2380,11100,3500],[5300,6980,6350,8200],[3500,-800,4550,750],[3450,5200,4500,6300]]
for r in p['oldCoast']:
 b=clean(r).bounds;mouths.append([b[0]-400,b[1]-400,b[2]+400,b[3]+400])
for ch in p['channels']:
 for x,y,w in ch['samples'][::8]:
  r=w/2+210;mouths.append([x-r,y-r,x+r,y+r])
metrics={'moatWidth':340,'minimumBrookWidth':340,'dryArea':dry.area,'floorComponents':len(polygons(floor)),'newMeadowProps':sum(q.get('zone')=='outer-meadow' for q in props),'meadowResidents':sum(bool(q.get('meadow')) for q in beds),'retainedMeadowSites':len(p['meadowGroups']),'omittedMeadowProps':len(omitted),'valid':dry.is_valid and floor.is_valid and wet.is_valid}
out={'props':props,'shapes':shapes,'beds':beds,'courts':courts,'roads':roads,'links':links,'channels':p['channels'],'crossings':crossings,'bridgeRects':bridgeRects,'obstacles':obstacles,'water':water,'boatWater':boatWater,'coast':coast,'coastRings':coastRings,'shoreRings':[list(q.exterior.coords)[:-1] for q in polygons(dry)],'mouths':mouths,'outsideD':path(box(-3000,-2200,11000,8200).difference(old)),'dryD':path(dry),'floorD':path(floor),'floorRings':rings(floor),'outerFloorRings':rings(floor.difference(old).union(centreLandings)), 'centreLandingD':path(centreLandings), 'centreLandingRings':rings(centreLandings),'entranceChecks':entranceChecks,'meadowGroups':p['meadowGroups'],'metrics':metrics,'adjustments':adjustments,'omitted':omitted,'boatTours':boatTours}
json.dump(out,open(sys.argv[2],'w'),separators=(',',':'));print(json.dumps(metrics))
