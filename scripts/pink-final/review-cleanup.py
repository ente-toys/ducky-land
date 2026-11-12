"""Boss corrections: OG vegetation, retired props, connected roads and open grass."""
from pathlib import Path
import json,re,copy,math,subprocess
A=Path('public/pixi-art/themes/pink');D=Path('assets/world/themes/pink');S=Path('scripts/pink-final')
read=lambda p:json.loads(Path(p).read_text())
def write(p,d):Path(p).write_text(json.dumps(d,indent=1)+'\n')
art=read(A/'art.json');world=read(D/'world.json');walk=read(D/'walk-world.json');layout=read('scripts/bigger-pink/layout.json');og=read('scripts/bigger-pink/original-art.json')
originalProps=copy.deepcopy(art['props']);retired=set(read(S/'retired-props.json'));moved=[];swaps=[]
def retire(p):
 retired.add(p['id']);art['props'].remove(p)
 for d in [world,walk]:d['obstacles']=[o for o in d['obstacles'] if not owns(o,p)]
def owns(o,p):
 return o.get('name')==p['id'] or o.get('name','').startswith(p['id']+'-') or (not o.get('name') and abs(o.get('x',1e9)-p['x'])<2 and abs(o.get('y',1e9)-p['y'])<100)
for p in art['props'][:]:
 if p['src']=='detail/pink-car.svg':retire(p)
art['flats']=[p for p in art['flats'] if p['src'] not in ['detail/pink-close-road.svg','detail/pink-close-market.svg'] and not ('pink-bed-' in p['src'] and (p['y']>3600 or p.get('id')=='pink-garden-bed-3'))]
# Retain the original inner routes, except the obsolete picnic cul-de-sac.
inner=world['paths'][:16];inner=[p[:14] if i==12 else p for i,p in enumerate(inner) if i not in [14,15]]
roads=read(S/'roads.json');world['paths']=inner+[r['sampled'] for r in roads];world['pathWidths']=[160]*len(world['paths'])
for key in ['stalls-1','stalls-3']:world['zones'].pop(key,None)
walk['paths']=world['paths'];walk['pathWidths']=world['pathWidths']
segments=[(a,b) for line in world['paths'] for a,b in zip(line,line[1:])]
bridgeSegments=[(c['a'],c['b']) for c in read('scripts/pink-fix/shore.json')['crossings']]
def closest(x,y,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy or 1)));return (x-a[0]-t*dx,y-a[1]-t*dy)
def pathdist(x,y):return min(math.hypot(*closest(x,y,a,b)) for a,b in segments)
def inpoly(x,y,poly):
 hit=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
 return hit
def water(x,y):
 for s in world['water']:
  if s.get('poly') and inpoly(x,y,s['poly']):return True
  if not s.get('poly') and ((x-s['x'])/s['rx'])**2+((y-s['y'])/s['ry'])**2<1:return True
 return False
def fpof(p):
 if p.get('footprint'):return p['footprint']
 found=[o for o in world['obstacles'] if owns(o,p)]
 if found:return found[0]
 # Non-solid decorative props still have a small ground contact for the visual audit.
 w=p['width']*p.get('scale',1);return dict(x=p['x'],y=p['y']-8,rx=min(32,w*.24),ry=12)
def ellipse(f):
 if f.get('poly'):
  xs=[p[0] for p in f['poly']];ys=[p[1] for p in f['poly']];return [(min(xs)+max(xs))/2,(min(ys)+max(ys))/2,(max(xs)-min(xs))/2,(max(ys)-min(ys))/2]
 return [f.get('x',0),f.get('y',0),f.get('rx',10),f.get('ry',10)]
def roadclear(p,x=None,y=None):
 f=fpof(p);cx,cy,rx,ry=ellipse(f);dx=(x-p['x']) if x is not None else 0;dy=(y-p['y']) if y is not None else 0;cx+=dx;cy+=dy
 for a,b in segments:
  vx,vy=closest(cx,cy,a,b);dist=math.hypot(vx,vy);support=math.hypot(rx*vx,ry*vy)/(dist or 1)
  if dist<89+support+12:return False
 for a,b in bridgeSegments:
  if math.hypot(*closest(cx,cy,a,b))<100+max(rx,ry)+16:return False
 return True
def dry(x,y,margin=50):
 return all(inpoly(x+dx,y+dy,world['coast']) and not water(x+dx,y+dy) for dx,dy in [(0,0),(-margin,0),(margin,0),(0,margin),(0,-margin)])
def shift(p,x,y):
 dx=x-p['x'];dy=y-p['y'];matches=copy.deepcopy([o for o in world['obstacles'] if owns(o,p)])
 for d in [world,walk]:
  for o in d['obstacles']:
   if any(o==m for m in matches):
    if o.get('poly'):o['poly']=[[q[0]+dx,q[1]+dy] for q in o['poly']]
    else:o['x']+=dx;o['y']+=dy
    if not o.get('name'):o['name']=p['id']
 if p.get('footprint'):
  f=p['footprint']
  if f.get('poly'):f['poly']=[[q[0]+dx,q[1]+dy] for q in f['poly']]
  else:f['x']+=dx;f['y']+=dy
 p['x']=round(x,2);p['y']=round(y,2)
 if 'z' in p:p['z']=p['y']
 if p.get('door'):p['door']=[p['door'][0]+dx,p['door'][1]+dy]
def setfp(p,f):
 for d in [world,walk]:
  d['obstacles']=[o for o in d['obstacles'] if not owns(o,p)];d['obstacles'].append(dict(f,name=p['id']))
 p['footprint']=f
# Replace every authored hamlet plant with the existing inner-land library.
vegetation=lambda src:src.startswith('hamlets/') and re.search(r'(?:tree|oak|cherry|blossom|shrub|bush)',Path(src).stem,re.I)
for i,p in enumerate(art['props']):
 if not vegetation(p['src']):continue
 src=p['src'];name=Path(src).stem;tree=bool(re.search(r'tree|oak|cherry|blossom',name));pink=bool(re.search(r'cherry|blossom|flower|bush|shrub',name)) and not name.startswith('oak') and 'tree-green' not in name
 target='detail/tree-cherry.svg' if tree and pink else ['/pixi-art/plants/tree-1.svg','/pixi-art/plants/tree-3.svg','/pixi-art/plants/tree-4.svg'][i%3] if tree else 'detail/bush-pink.svg' if pink else ['/pixi-art/plants/bush-1.svg','/pixi-art/plants/bush-5.svg'][i%2]
 templates=[t for t in og['props'] if t['src']==target];width=p['width']*p.get('scale',1);t=copy.deepcopy(min(templates,key=lambda t:abs(t['width']*t.get('scale',1)-width)))
 for key in ['src','width','height','scale','anchor','shadow','wind']:
  if key in t:p[key]=t[key]
  else:p.pop(key,None)
 p['name']=t['name'];p['asset']=Path(target).stem;p.pop('z',None);p.pop('order',None)
 w=p['width']*p.get('scale',1);f=dict(x=p['x'],y=p['y']-(9 if tree else 12),rx=31 if tree else round(w*.36,2),ry=22 if tree else 24);setfp(p,f)
 swaps.append(dict(id=p['id'],old=src,new=target))
# Preserve one original lounger, now on the sand at Tutu's southeast beach.
p=copy.deepcopy(next(p for p in og['props'] if p['src']=='detail/lounger.svg'));p.update(id='tutu-sand-lounger',x=4500,y=6660,zone='tutu',shadow=True)
art['props'].append(p);setfp(p,dict(x=p['x'],y=p['y']-26,rx=round(p['width']*p['scale']*.38),ry=30))
# Move the picnic blanket out of the old bridge approach and onto grass.
p=next(p for p in art['props'] if p['id']=='picnic-blanket-71');shift(p,2240,4640)
# Existing props must clear the travel lanes, using their actual ground contacts.
# Place buildings first, then move small plants and furniture away from their gates.
def isbuilding(p):return bool(p.get('household') or re.search(r'cottage|house-|cafe|workshop|gazebo|conservatory',p['src']))
def occupied(p,x,y):
 for other in art['props']:
  if other is p:continue
  if not isbuilding(other):continue
  cx,cy,rx,ry=ellipse(fpof(other))
  if ((x-cx)/(rx+60))**2+((y-cy)/(ry+45))**2<1:return True
 return False
for p in sorted(art['props'],key=lambda p:not isbuilding(p)):
 if roadclear(p) and dry(p['x'],p['y'],20):continue
 before=[p['x'],p['y']];found=False
 for r in range(30,1201,30):
  for j in range(48):
   x=round(before[0]+r*math.cos(j*math.pi/24),2);y=round(before[1]+r*math.sin(j*math.pi/24),2)
   if dry(x,y,60) and roadclear(p,x,y) and not occupied(p,x,y):shift(p,x,y);found=True;break
  if found:break
 if not found:raise ValueError('Cannot clear road: '+p['id'])
 moved.append(dict(id=p['id'],fromPoint=before,toPoint=[p['x'],p['y']]))
# Deliberate loose groves on the cleared marina and southern lawns. Only OG assets.
clusters=[(8520,2020),(9290,2170),(9060,3190),(8620,3470),(9400,3440),(3180,4330),(4560,4500),(4880,4900),(2820,4580),(5160,4150),(4360,5110)]
for ci,(cx,cy) in enumerate(clusters):
 for j,(dx,dy) in enumerate([(-120,-100),(90,-140),(0,75),(180,60),(-170,150)]):
  src=['detail/tree-cherry.svg','/pixi-art/plants/tree-1.svg','/pixi-art/plants/tree-3.svg','/pixi-art/plants/tree-4.svg','detail/bush-pink.svg'][j]
  t=copy.deepcopy(next(p for p in og['props'] if p['src']==src));t.update(id=f'og-grove-{ci}-{j}',x=cx+dx,y=cy+dy,zone='restored-grove',hamlet='restored',wind=False)
  t.pop('footprint',None)
  if not dry(t['x'],t['y'],100) or not roadclear(t) or occupied(t,t['x'],t['y']):continue
  if any(math.hypot(p['x']-t['x'],p['y']-t['y'])<115 for p in art['props']):continue
  art['props'].append(t);isTree=j<4;setfp(t,dict(x=t['x'],y=t['y']-(9 if isTree else 12),rx=31 if isTree else round(t['width']*t['scale']*.36),ry=22 if isTree else 24))
  # Small existing flowers follow the outside edge of each group.
  if j in [0,2]:
   f=copy.deepcopy(next(p for p in og['props'] if p['src']=='/pixi-art/plants/flower-3.svg'));f.update(id=f'og-grove-flowers-{ci}-{j}',x=t['x']+80,y=t['y']+50,zone='restored-grove',hamlet='restored',shadow=False)
   if roadclear(f) and dry(f['x'],f['y'],20):art['props'].append(f)
# Keep every prop list, collision list and saved court arrival consistent.
world['props']=art['props'];walk['props']=art['props']
baseids={p['id'] for p in og['props']};layout['props']=[p for p in art['props'] if p['id'] not in baseids]
base=read('scripts/bigger-pink/original-world.json')['obstacles'];layout['baseObstacles']=[o for o in world['obstacles'] if o in base];layout['obstacles']=[o for o in world['obstacles'] if o not in base]
layout['paths']=[r['sampled'] for r in roads];layout['pathWidths']=[160]*len(roads);layout['shoreWalk']=roads[0]['sampled'];layout['coast']=world['coast']
layout['decks']=art['decks'];layout['riverCrossings']=read('scripts/pink-fix/shore.json')['crossings']
# Replaced tree SVGs are not retained as an unused alternative art library.
used={p['src'] for k in ['props','flats','decks'] for p in art.get(k,[])};removed=[]
for f in (A/'hamlets').rglob('*.svg'):
 rel=str(f.relative_to(A))
 if vegetation(rel) and rel not in used:f.unlink();removed.append(rel)
# Remove baked garden beds and stepping stones in the marina/bridge areas; they have no collisions.
art['flats']=[f for f in art['flats'] if not ((8100<f['x']<9700 and 1700<f['y']<3700) and re.search('bed|pebble|stepp|pad',f['src']))]
for f,d in [(A/'art.json',art),(D/'world.json',world),(D/'walk-world.json',walk),(Path('scripts/bigger-pink/layout.json'),layout)]:write(f,d)
previous={p['id']:p for p in originalProps}
moved=[dict(id=p['id'],fromPoint=[previous[p['id']]['x'],previous[p['id']]['y']],toPoint=[p['x'],p['y']]) for p in art['props'] if p['id'] in previous and (p['x'],p['y'])!=(previous[p['id']]['x'],previous[p['id']]['y'])]
write(S/'retired-props.json',sorted(retired));write(S/'review-changes.json',dict(replacedPlants=swaps,movedProps=moved,deletedUnusedPlantSVGs=removed,clusters=clusters))
print('OG plant swaps:',len(swaps),'props cleared from roads:',len(moved),'unused SVGs removed:',len(removed))
