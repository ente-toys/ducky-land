"""Pagepond A: one opaque Home-system surface, fixed props and sailing geometry."""
import json, math, sys, re, heapq, copy
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Point,LineString,Polygon,box
from shapely.ops import unary_union,nearest_points
from shapely.prepared import prep
from shapely import affinity
from fontTools.pens.basePen import BasePen
from fontTools.svgLib.path import parse_path
import xml.etree.ElementTree as ET
S=Path('scripts/pagepond-ground'); A=Path('public/pixi-art/themes/library'); D=Path('rive/web/themes/library')
read=lambda f:json.loads(Path(f).read_text())
def save(f,v):Path(f).write_text(json.dumps(v,separators=(',',':'))+'\n')
source=read(S/'data/source.json');art=read(A/'art.json');world=read(D/'world.json');plan=read('scripts/pagepond-hamlets/placement.json')
class Pen(BasePen):
 def __init__(self):super().__init__(None);self.rings=[];self.p=[]
 def _moveTo(self,p):
  if self.p:self.rings.append(self.p)
  self.p=[p]
 def _lineTo(self,p):self.p.append(p)
 def _curveToOne(self,b,c,d):
  a=self.p[-1];n=max(4,math.ceil((math.dist(a,b)+math.dist(b,c)+math.dist(c,d))/8))
  for i in range(1,n+1):
   t=i/n;u=1-t;self.p.append(tuple(u**3*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t**3*d[k] for k in (0,1)))
 def _closePath(self):self.rings.append(self.p);self.p=[]
 def _endPath(self):self._closePath()
def contours(d):
 p=Pen();parse_path(d,p)
 return p.rings+([p.p] if p.p else [])
def poly(d):
 g=Polygon()
 for r in contours(d):
  if len(r)>2:g=g.symmetric_difference(Polygon(r).buffer(0))
 return g

def svg(g):
 ps=[g] if g.geom_type=='Polygon' else [p for p in getattr(g,'geoms',[]) if p.geom_type=='Polygon']
 return ''.join('M'+'L'.join(f'{x:.2f} {y:.2f}' for x,y in r.coords)+'Z' for p in ps for r in [p.exterior,*p.interiors])
def ellipse(x,y,rx,ry):return affinity.scale(Point(x,y).buffer(1,quad_segs=24),rx,ry)
def shape(o):return Polygon(o['poly']).buffer(0) if o.get('poly') else ellipse(o['x'],o['y'],o.get('rx',1),o.get('ry',1))
dry=poly(source['dry']);courts=[{'id':c['id'],'shape':Polygon(c['poly']).buffer(-12).buffer(12)} for c in source['courts']]
# The literary courts keep their inlays, but their perimeter belongs to the path union.
for name,flat in [('decal-paving.svg',next(f for f in art['flats'] if f['src']=='centre/decal-paving.svg')),('decal-forecourt.svg',next(f for f in art['flats'] if f['src']=='centre/bookstore/decal-forecourt.svg'))]:
 r=ET.parse(S/'data'/name).getroot();vb=list(map(float,r.get('viewBox').split()));scale=flat['width']/vb[2]
 radius=(1150,880.9) if name=='decal-paving.svg' else (1080,827.2)
 courts.append({'id':name,'shape':ellipse(flat['x']+flat['width']/2,flat['y']+flat['height']/2,radius[0]*scale,radius[1]*scale)})
centre=ET.parse(S/'data/centre-ground.svg').getroot();g=list(centre)[-1]
reading=next(e for e in g if e.get('id')=='reading-court');courts.append({'id':'reading-court','shape':poly(list(reading)[0].get('d'))})
# Short beach and pier approaches remain destinations, not invented river bridges.
beach=poly(list(g)[11].get('d'));courts.append({'id':'quiet-beach','shape':beach})
# Physical contacts are immutable. Routes take the entire lane radius around them.
contacts=[shape(o) for o in world['obstacles']]
contacts += [shape(o) for o in plan['shapes'] if not o.get('parent') and not o.get('boat') and not o.get('dock') and not o.get('solid')]
# Flower pockets retain their full visible ground footprint, not just a tiny centre.
for p in art['props']:
 if p['src'].startswith('reuse/flower-'):
  k=p.get('scale',1);w=p['width']*k;h=p['height']*k;contacts.append(ellipse(p['x'],p['y']-h*.35,w*.4,h*.3))
obstacles=unary_union(contacts)
# Sleepers are protected by their existing resolver footprint; no resident is moved.
keep=read(S/'data/keep.json')
beds=read('scripts/pagepond-rework/baseline.json')['sleepers']
# Use current resolved positions exported by the JS build wrapper.
if (S/'data/current-sleepers.json').exists():beds=read(S/'data/current-sleepers.json')
rests=unary_union([ellipse(b['x'],b['y']-6,b.get('r',90)+18,58) for b in beds])
blocked=obstacles.union(rests)
# Smooth the long boxed river shoulders and Paperboat's outer corner inward.
# This only gives land back to water, preserving every existing boat route.
oldDry=dry
regions=unary_union([Point(-2450,2500).buffer(1000),Point(10100,2900).buffer(1000),Point(5920,7400).buffer(900),Point(10100,6400).buffer(700),Point(3980,200).buffer(650)])
oldCentre=unary_union([Polygon(r) for r in read('scripts/bigger-library/original/world.json')['coastRings']])
cut=dry.difference(dry.buffer(-310,quad_segs=24).buffer(310,quad_segs=24)).intersection(regions).difference(oldCentre)
cutParts=[cut] if cut.geom_type=='Polygon' else list(getattr(cut,'geoms',[]))
cut=unary_union([g for g in cutParts if g.geom_type=='Polygon' and g.area>1 and not g.intersects(blocked.buffer(28))])
dry=dry.difference(cut)
save(S/'bank-report.json',{'widenedWaterArea':cut.area,'changedRegions':len([g for g in getattr(cut,'geoms',[cut]) if not g.is_empty]),'narrowedWaterArea':0})

# Fit the physical Home deck to an unobstructed bank throat. Old patches hid
# two bushes at the north crossing; slide the crossing locally rather than moving them.
bridge_changes=[]
for c in source['crossings']:
 oldA=c['bankA'][:];oldB=c['bankB'][:];ns=abs(oldA[0]-oldB[0])<1;origin=[c['x'],c['y']]
 candidates=[]
 for offset in [0,*[v for n in range(1,16) for v in [n*30,-n*30]]]:
  x,y=origin; x+=offset if ns else 0;y+=0 if ns else offset
  def pt(u,v=0):return [x+v,y+u] if ns else [x+u,y+v]
  cuts=[]
  for v in [-56,-28,0,28,56]:
   cut=LineString([pt(-1200,v),pt(1200,v)]).difference(dry)
   gs=[cut] if cut.geom_type=='LineString' else list(getattr(cut,'geoms',[]));gs=[g for g in gs if g.geom_type=='LineString']
   if not gs:break
   seg=min(gs,key=lambda g:g.distance(Point(x,y)));vals=[(q[1]-y if ns else q[0]-x) for q in seg.coords];cuts.append((min(vals),max(vals)))
  if len(cuts)!=5:continue
  lo=min(a for a,b in cuts);hi=max(b for a,b in cuts);aa=pt(lo-24);bb=pt(hi+24)
  approaches=unary_union([Point(aa),Point(bb)]).buffer(68)
  if approaches.intersects(blocked):
   pass
   continue
  candidates.append((abs(offset),aa,bb,x,y));break
 if not candidates:raise RuntimeError('No clear bridge banks '+c['id'])
 _,aa,bb,x,y=candidates[0];c.update(bankA=aa,bankB=bb,x=(aa[0]+bb[0])/2,y=(aa[1]+bb[1])/2,length=math.dist(aa,bb),width=112)
 bridge_changes.append({'id':c['id'],'from':[oldA,oldB],'to':[aa,bb]})
 # Carry the adjacent authored route over to the new throat, easing into it.
 dx=x-origin[0];dy=y-origin[1]
 for r in source['links']:
  if r['kind']=='bridge':continue
  moved=[]
  for q in r['points']:
   along=q[1] if ns else q[0];v0=min(oldA[1 if ns else 0],oldB[1 if ns else 0]);v1=max(oldA[1 if ns else 0],oldB[1 if ns else 0])
   dist=LineString([oldA,oldB]).distance(Point(q));weight=max(0,1-max(v0-along,along-v1,0)/450)
   moved.append([q[0]+dx*weight,q[1]+dy*weight] if dist<180 else q)
  r['points']=moved
save(S/'crossings.json',source['crossings']);save(S/'bridge-bank-report.json',bridge_changes)
ways=[*source['walkways'],*[w for w in world['walkways'] if w.get('id')=='hamlet-paperboat-south-jetty']]+[{ 'a':c['bankA'],'b':c['bankB'],'w':112} for c in source['crossings']]
def extended(w):
 a,b=w['a'],w['b'];v=[b[k]-a[k] for k in (0,1)];l=math.hypot(*v)
 return LineString([[a[k]-v[k]/l*150 for k in (0,1)],[b[k]+v[k]/l*150 for k in (0,1)]])
decks=unary_union([extended(w).buffer(w['w']/2) for w in ways])
land=dry.union(decks)
routes=[]
for r in source['links']:
 if r['kind'] in ['bridge','door'] or 'internal-reading-join' in r['id'] or r['id']=='paperboat-jetty-approach':continue # obsolete aprons and narrow door strips
 if '-entrance-' in r['id']:
  court=next(c['shape'] for c in courts if c['id'].startswith(r['id'].split('-entrance-')[0]+'-'))
  q=nearest_points(Point(r['points'][0]),court)[1];r['points']=[[q.x,q.y],r['points'][-1]]
 width=128 if r['id'] in ['west-spine','east-spine','east-south-return'] else 104
 if r['id']=='west-spine':
  pts=r['points'];index=next(i for i,q in enumerate(pts) if q[1]<-250);routes.append({'id':'west-north-lane','width':104,'samples':pts[:index+1]});routes.append({'id':r['id'],'width':width,'samples':pts[index:]})
 else:routes.append({'id':r['id'],'width':width,'samples':r['points']})
for i,p in enumerate(source['centrePaths']):routes.append({'id':'centre-'+str(i),'width':128 if i in [2,4,7,8,12] else 104,'samples':p})
for p in art['props']:
 if p.get('kind')=='building' and p.get('hamlet'):
  court=next(c['shape'] for c in courts if c['id'].startswith(p['hamlet']+'-'))
  a=[p['x'],p['y']+66];q=nearest_points(Point(a),court)[1]
  routes.append({'id':p['id']+'-door','width':104,'samples':[a,[q.x,q.y]]})
pier=next(w for w in world['walkways'] if w.get('id')=='hamlet-paperboat-south-jetty')
routes.append({'id':'paperboat-jetty-approach','width':104,'samples':[pier['a'],[pier['a'][0],pier['a'][1]-220]]})
for id,courtId in [('west-north-lane','decal-paving.svg'),('east-spine','decal-forecourt.svg')]:
 r=next(r for r in routes if r['id']==id);court=next(c['shape'] for c in courts if c['id']==courtId)
 q=nearest_points(Point(r['samples'][0]),court.buffer(-75))[1]
 r['samples']=[[q.x,q.y],*r['samples']]
# Existing moat crossings with no useful route through their full span get a genuine joined lane.
for c in source['crossings']:
 line=LineString([c['bankA'],c['bankB']]);routes.append({'id':c['id']+'-axis','width':104,'samples':[c['bankA'],c['bankB']]})
# A coarse A* is used only inside an obstructed authored segment. Its output is
# reduced to visibility tangents, then rounded with collision-checked Beziers.
free_cache={}
def free(width):
 if width not in free_cache:free_cache[width]=land.buffer(-width/2-3).union(decks.buffer(-18)).difference(blocked.buffer(width/2+8))
 g=free_cache[width]
 return max(g.geoms,key=lambda p:p.area) if g.geom_type=='MultiPolygon' else g
def move(a,region,maxr=350):
 p=Point(a)
 if region.covers(p):return list(a)
 q=nearest_points(p,region)[1]
 if q.distance(p)>maxr:raise RuntimeError('Unreachable authored route '+str(a)+' gap '+str(q.distance(p)))
 # Pull inward to avoid floating-point tangency at an expanded contact.
 inner=region.buffer(-14);inner=max(inner.geoms,key=lambda g:g.area) if inner.geom_type=="MultiPolygon" else inner;q=nearest_points(p,inner)[1];return [q.x,q.y]
def path(a,b,region):
 pr=prep(region)
 if pr.covers(LineString([a,b])):return [a,b]
 C=12;pad=1500;x0=math.floor((min(a[0],b[0])-pad)/C)*C;y0=math.floor((min(a[1],b[1])-pad)/C)*C
 def key(q):return (round((q[0]-x0)/C),round((q[1]-y0)/C))
 def point(k):return [x0+k[0]*C,y0+k[1]*C]
 start=key(a);end=key(b);Q=[(0,start)];cost={start:0};prev={};seen=set();valid={}
 while Q:
  _,k=heapq.heappop(Q)
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
   c=cost[k]+math.hypot(dx,dy)*C
   if c<cost.get(n,1e99):cost[n]=c;prev[n]=k;heapq.heappush(Q,(c+math.dist(q,b),n))
 else:
  print('REGION',[(x.area,x.distance(Point(a)),x.distance(Point(b))) for x in region.geoms] if hasattr(region,'geoms') else region.geom_type,flush=True)
  raise RuntimeError('No full-width route '+str((a,b)))
 # Furthest visible waypoint creates smooth purposeful detours, no grid elbows.
 result=[out[0]];i=0
 while i<len(out)-1:
  j=len(out)-1
  while j>i+1 and not pr.covers(LineString([out[i],out[j]])):j-=1
  result.append(out[j]);i=j
 return result
def rounded(ps,region):
 if len(ps)<3:return ps
 out=[ps[0]]
 for a,b,c in zip(ps,ps[1:],ps[2:]):
  la=math.dist(a,b);lb=math.dist(b,c)
  if min(la,lb)<.01:continue
  radius=min(140,la*.42,lb*.42)
  while radius>1:
   u=[b[k]+(a[k]-b[k])*radius/la for k in (0,1)];v=[b[k]+(c[k]-b[k])*radius/lb for k in (0,1)]
   arc=[[(1-t)**2*u[k]+2*(1-t)*t*b[k]+t*t*v[k] for k in (0,1)] for t in [j/12 for j in range(13)]]
   if region.covers(LineString(arc)):break
   radius*=.5
  out+=arc
 out.append(ps[-1]);return out
for r in routes:
 region=free(r['width']);samples=r['samples']
 if r['id'].endswith('-door'):
  hamlet=r['id'].split('-')[1];court=next(c['shape'] for c in courts if c['id'].startswith(hamlet+'-'));target=court.buffer(-65).intersection(region.buffer(-14))
  if not target.is_empty:
   q=nearest_points(Point(samples[0]),target)[1];samples=[samples[0],[q.x,q.y]]
 if '-entrance-' in r['id'] or r['id'].endswith('-door') or 'internal-reading' in r['id']:samples=[samples[0],samples[-1]]
 line=LineString(samples).simplify(22)
 anchors=[move(q,region) for q in line.coords];out=[]
 for a,b in zip(anchors,anchors[1:]):
  if math.dist(a,b)<.01:continue
  seg=path(a,b,region);out+=seg if not out else seg[1:]
 r['samples']=rounded(out,region) if out else [anchors[0],anchors[-1]];print('Route',r['id'],len(r['samples']),flush=True)
# Join every route end to a destination or another route. There are no exempt grass tails.
routes=[r for r in routes if len(r['samples'])>1 and LineString(r['samples']).length>8]
connections=[];court=unary_union([c['shape'] for c in courts]);targets=unary_union([court,*[LineString([w['a'],w['b']]).buffer(w['w']/2) for w in ways]])
for r in routes:
 for end in [0,-1]:
  p=Point(r['samples'][end]);others=[LineString(q['samples']).buffer(q['width']/2) for q in routes if q is not r and not q['id'].endswith('-axis')]
  goal=targets.union(unary_union(others));gap=p.distance(goal)
  if gap<=r['width']/2-4:continue
  q=nearest_points(p,goal)[1];a=list(p.coords)[0];b=[q.x,q.y];region=free(r['width'])
  b=move(b,region,600);seg=rounded(path(a,b,region),region)
  r['samples']=(list(reversed(seg))[:-1]+r['samples']) if end==0 else (r['samples']+seg[1:]);connections.append({'id':r['id'],'gap':gap,'target':b})
# A connector joins the first useful trunk it reaches, rather than crossing it
# and leaving a second tail. Shared bridge axes already covered by routes retire.
from shapely.ops import substring
trunks=[r for r in routes if 'spine' in r['id'] or r['id'].startswith('centre-') or '-heart' in r['id'] or r['id']=='east-south-return']
network=unary_union([LineString(r['samples']) for r in trunks])
for r in routes:
 if r in trunks or r['id'].endswith('-axis'):continue
 line=LineString(r['samples']);hit=line.intersection(network)
 pts=[hit] if hit.geom_type=='Point' else [p for p in getattr(hit,'geoms',[]) if p.geom_type=='Point']
 distances=[line.project(p) for p in pts if line.project(p)>65 and line.project(p)<line.length-25]
 if distances:
  r['samples']=[list(p) for p in substring(line,0,min(distances)).coords]
# The east bridge lane terminates at the centre promenade as a T, never
# beyond it as the old grass stub did.
r=next(r for r in routes if r['id']=='east-north-heart');line=LineString(r['samples']);target=LineString(next(q for q in routes if q['id']=='centre-8')['samples']);hit=line.intersection(target)
points=[hit] if hit.geom_type=='Point' else [p for p in getattr(hit,'geoms',[]) if p.geom_type=='Point']
if points:r['samples']=[list(p) for p in substring(line,0,min(line.project(p) for p in points)).coords]
network=unary_union([LineString(r['samples']).buffer(r['width']/2-8) for r in routes if not r['id'].endswith('-axis')])
routes=[r for r in routes if not r['id'].endswith('-axis') or LineString(r['samples']).difference(network).length>20]
# Keep the walking centreline on the same physical deck axis as Home art.
# The older canal routes were drawn across the edge of a much wider custom deck.
axes=[LineString([w['a'],w['b']]) for w in ways];bankLand=prep(dry.buffer(-26))
for r in routes:
 samples=[]
 for a,b in zip(r['samples'],r['samples'][1:]):
  n=max(1,math.ceil(math.dist(a,b)/8))
  for i in range(n):
   q=[a[k]+(b[k]-a[k])*i/n for k in (0,1)];p=Point(q)
   if not bankLand.covers(p):
    axis=min(axes,key=lambda l:l.distance(p))
    if axis.distance(p)<140:
     z=axis.interpolate(axis.project(p));q=[z.x,z.y]
   if not samples or math.dist(q,samples[-1])>.01:samples.append(q)
 samples.append(r['samples'][-1]);r['samples']=samples
# Round the concave forks as Home does. Only add fillets where the full contact
# clearance remains available; never punch path holes around a prop afterward.
parts=[LineString(r['samples']).buffer(r['width']/2,quad_segs=12) for r in routes]
merged=unary_union(parts+[c['shape'] for c in courts]);fillets=merged.buffer(65,quad_segs=12).buffer(-65,quad_segs=12).difference(merged)
surface=merged.union(fillets.difference(blocked.buffer(8))).intersection(dry).simplify(.22,preserve_topology=True)
save(S/'sampled-routes.json',routes);save(S/'surface.json',{'d':svg(surface),'rings':[[list(q) for q in ring.coords] for p in ([surface] if surface.geom_type=='Polygon' else surface.geoms) for ring in [p.exterior,*p.interiors]],'courts':[{'id':c['id'],'d':svg(c['shape'])} for c in courts],'connections':connections})
# Remove historical centre paint while retaining lawn, beach, pond and book medallion.
NS='http://www.w3.org/2000/svg'; ET.register_namespace('',NS)
def tag(e):return e.tag.split('}')[-1]
def strip_centre(root):
 for parent in list(root.iter()):
  for e in list(parent):
   if (tag(e)=='ellipse' and e.get('cx')=='1116' and e.get('rx')=='155') or (tag(e)=='path' and float(e.get('stroke-width','0'))>=180) or e.get('id')=='path-joint-inlays' or e.get('clip-path')=='url(#path-joint-inlays)':parent.remove(e)
   elif e.get('clip-path')=='url(#reading-court)':
    # Preserve every bookplate detail and the complete open-book medallion.
    # Only the broad nested perimeter frames retire.
    for index,child in enumerate(list(e)):
     if 1<=index<=247:child.set('fill','none')
     elif index>=299:pass
     else:e.remove(child)
   elif tag(e)=='path' and e.get('fill')=='#F7E6AF' and e.get('stroke-width')=='8':parent.remove(e)
strip_centre(centre)
outer=ET.parse(S/'data/outer-ground.svg').getroot()
for e in outer.iter():
 if e.get('d')==source['dry']:e.set('d',svg(dry))
for parent in list(outer.iter()):
 for e in list(parent):
  if e.get('id')=='floor' or e.get('data-merged-paths') or e.get('data-bridge-landings') or e.get('clip-path')=='url(#floor)':parent.remove(e)
# The coastline and river widths stay identical to the tested navigable version.
# Replace local boxy outer shoulders by smooth inward coves only, so water never narrows.
# Source banks already have a rounded global contour. Further local shaping is handled
# by the shared shore rings, without changing the paired page-like centre land.
for t in art['ground']['tiles']:
 root=copy.deepcopy(centre if 'original-ground-' in t['src'] else outer)
 root.set('viewBox',f"{t['x']} {t['y']} {t['width']} {t['height']}");root.set('width',str(t['width']/2));root.set('height',str(t['height']/2))
 local=surface.intersection(box(t['x']-8,t['y']-8,t['x']+t['width']+8,t['y']+t['height']+8))
 e=ET.SubElement(root,'{'+NS+'}path',{'data-pagepond-paths':'home-system','fill':'#FFF0C7','fill-rule':'evenodd','d':svg(local)})
 # Destination inlays are composed after the union, while the pond remains above it.
 if 'original-ground-' in t['src']:
  group=list(root)[-2]
  e=root[-1];root.remove(e);group.insert(12,e)
 else:
  root.remove(e);next(g for g in root if g.get('clip-path')=='url(#outside)').append(e)
 Path(A/t['src']).write_text(ET.tostring(root,encoding='unicode'))
# Both master sources display the same path ownership as their tiles.
(A/'pagepond/outer-source.svg').write_text(ET.tostring(outer,encoding='unicode').replace('</svg>',f'<path data-pagepond-paths="home-system" fill="#FFF0C7" fill-rule="evenodd" d="{svg(surface)}"/></svg>'))
(S/'path-surface.svgfrag').write_text(f'<path data-pagepond-paths="home-system" fill="#FFF0C7" fill-rule="evenodd" d="{svg(surface)}"/>')
# Paving flats keep decoration only; opaque destination fill is already in the union.
for name,src in [('decal-paving.svg','centre/decal-paving.svg'),('decal-forecourt.svg','centre/bookstore/decal-forecourt.svg')]:
 r=ET.parse(S/'data'/name).getroot()
 for e in list(r):
  if tag(e)=='ellipse' and e.get('rx') in ['1162','1156','1092','1086','1080','-270.0']:r.remove(e)
  elif e.get('id')=='last-library-ribbon-rim':r.remove(e)
  elif e.get('fill-rule')=='evenodd' and e.get('fill')!='none':r.remove(e)
  elif tag(e)=='ellipse' and e.get('fill-opacity'):r.remove(e)
 # Remove peripheral outline strokes across road mouths; keep interior paving joints.
 for e in list(r):
  if tag(e)=='path' and e.get('stroke-width') in ['5','6'] and e.get('fill-rule')=='evenodd':r.remove(e)
 (A/src).write_text(ET.tostring(r,encoding='unicode'))
# Keep a machine-readable surface for the existing hamlet checker and planting handoff.
ground=read('scripts/pagepond/layout.json');ground.update(dry=svg(dry),floor=svg(surface),floorRings=read(S/'surface.json')['rings'],outerFloorRings=read(S/'surface.json')['rings'],pathSystem={'main':128,'lane':104,'fill':'#FFF0C7','owner':'pagepond-ground'},roads=[{'id':r['id'],'width':r['width'],'points':r['samples']} for r in routes])
save('scripts/pagepond/layout.json',ground);plan.update(floor=ground['floor'],floorRings=ground['floorRings'],outerFloorRings=ground['floorRings'],links=[{'id':r['id'],'width':r['width'],'points':r['samples'],'kind':'home-system'} for r in routes]);save('scripts/pagepond-hamlets/placement.json',plan)
print('One opaque path union',surface.area,flush=True)

# Collision water and animated surf use those exact rounded cut banks too.
extra=[{'name':'Pagepond rounded mouth banks','poly':list(g.exterior.coords)} for g in ([cut] if cut.geom_type=='Polygon' else getattr(cut,'geoms',[])) if not g.is_empty and g.area>1]
for file in ['world.json','walk-world.json']:
 w=read(D/file);w['water']=[q for q in w['water'] if q.get('name')!='Pagepond rounded mouth banks']+extra
 w['boatWater']=[*read(S/'data/keep.json')['boatWater'],*[q['poly'] for q in extra]]
 w['shoreRings']=[list(g.exterior.coords) for g in (list(dry.geoms) if dry.geom_type=='MultiPolygon' else [dry])]
 save(D/file,w)
