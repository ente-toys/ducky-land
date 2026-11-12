"""Package the integrated shore kits, centre-material paths and quay landing."""
from pathlib import Path
import json,math,re,xml.etree.ElementTree as E
A=Path('public/pixi-art/themes/pink');D=Path('assets/world/themes/pink');S=Path('scripts/bigger-pink')
read=lambda p:json.loads(Path(p).read_text())
def write(p,d):Path(p).write_text(json.dumps(d,indent=1)+'\n')
art=read(A/'art.json');world=read(D/'world.json');walk=read(D/'walk-world.json');layout=read(S/'layout.json');old=read(S/'original-art.json')
# Retire the previous bathing furniture and garden props superseded by Teacup.
retired={p['id'] for p in art['props'] if ((5200<p['x']<8100 and 3800<p['y']<5900 and not p.get('id','').startswith('hamlet-') and (re.search(r'parasol|lounger|sandcastle|swim-ring|gazebo|bow-bench|community-pink',p.get('id','')))) or p.get('id') in ['lounger-east','lounger-west'])}
retiredpoints=[(p['x'],p['y']) for p in art['props'] if p.get('id') in retired]
for d in [art,world]:d['props']=[p for p in d['props'] if p.get('id') not in retired]
for d in [world,walk]:d['obstacles']=[o for o in d['obstacles'] if not any(o.get('name','')==i or o.get('name','').startswith(i+'-') for i in retired) and not (not o.get('name') and any(abs(o.get('x',1e9)-x)<4 and abs(o.get('y',1e9)-y)<40 for x,y in retiredpoints))]
# Retire the earlier unlabelled lounger contact left behind by the shore relocation.
for d in [world,walk]:d['obstacles']=[o for o in d['obstacles'] if o!={'x':5510,'y':6004,'rx':57,'ry':30}]
# Nudge the three imported fringe trees onto grass, with their real collisions.
from subprocess import check_output
from math import hypot
def inside(x,y,poly):
 hit=False
 for a,b in zip(poly,poly[1:]+poly[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
 return hit
for p in art['props']:
 if p.get('name')=='quay-dock' or not p.get('id','').startswith('hamlet-') or inside(p['x'],p['y'],world['coast']):continue
 ox,oy=p['x'],p['y'];best=None
 for radius in range(30,601,30):
  for i in range(32):
   x=ox+radius*math.cos(i*math.pi/16);y=oy+radius*math.sin(i*math.pi/16)
   if all(inside(x+dx,y+dy,world['coast']) for dx,dy in [(0,0),(-80,0),(80,0),(0,50)]):best=(x,y);break
  if best:break
 if not best:raise ValueError('Offshore '+p['id'])
 p['x'],p['y']=map(lambda n:round(n,2),best)
 if 'z' in p:p['z']+=p['y']-oy
 for d in [world,walk]:
  for o in d['obstacles']:
   if o.get('name')==p['id']:o['x']+=p['x']-ox;o['y']+=p['y']-oy
 if p.get('footprint'):p['footprint']['x']+=p['x']-ox;p['footprint']['y']+=p['y']-oy
# Decals follow the same dry boundary as the upright pieces.
art['flats']=[p for p in art['flats'] if 'paths' in p.get('src','') or p.get('id','').endswith('-court') or inside(p['x'],p['y'],world['coast'])]
write('scripts/pink-final/retired-props.json',sorted(retired))
# Consolidate both placers into the saved expansion source and collision manifest.
baseids={p['id'] for p in old['props']};layout['props']=[p for p in art['props'] if p.get('id') not in baseids]
# Only original-centre obstacles are outside expansion ownership.
centre=read(S/'original-world.json')['obstacles']
layout['baseObstacles']=[o for o in world['obstacles'] if o in centre]
layout['obstacles']=[o for o in world['obstacles'] if o not in centre]
# Imported shore homes use the same household/workplace metadata as the inland kits.
for p in art['props']:
 if not p.get('id','').startswith('hamlet-'):continue
 p['hamlet']=p['id'].split('-')[1]
 if re.search(r'^(house-|cottage-)',p['name']):p.update(household=True,communityRole='home',door=[p['x'],p['y']+48])
 elif re.search(r'cafe|workshop',p['name']):p['communityRole']='workplace'
 if p['id'].startswith('hamlet-teacup-'):p['zone']='quay'
 if p['id'].startswith('hamlet-tutu-tides-'):p['zone']='tutu'
layout['props']=[p for p in art['props'] if p.get('id') not in baseids]
# Put the dock into the deck pass. Its upper planks meet the cafe court, its lower posts sit in sea.
p=next(p for p in art['props'] if p.get('id')=='hamlet-teacup-quay-dock');w,h=p['width'],p['height'];x,y=p['x'],p['y']
art['decks'].append(dict(id=p['id'],src=p['src'],x=x-w/2,y=y-h,width=w,height=h))
art['props'].remove(p);layout['props']=[q for q in layout['props'] if q['id']!=p['id']]
landing=dict(name='teacup-quay',a=[x,y-h+15],b=[x,y-35],w=105)
for d in [world,walk]:
 d['walkways'].append(landing)
 for side in [-1,1]:d['obstacles'].append(dict(name='hamlet-teacup-quay-dock-post',x=x+side*w*.3,y=y-20,rx=9,ry=9))
world.setdefault('jetties',[]).append(dict(name='teacup-quay',foot=landing['a'],tip=landing['b'],width=landing['w']))
# One approved duck sailboat beside this short jetty. No boat illustration is imported.
harbor=read(D/'harbor.json');harbor['boats'].append(dict(x=x+215,y=y+55,turn=0))
# Source paths use the exact centre paint stack, with rounded authored curves.
ns='http://www.w3.org/2000/svg';E.register_namespace('',ns);q=lambda s:'{'+ns+'}'+s
for f in (A/'hamlets').glob('*/paths*.svg'):
 root=E.parse(f).getroot()
 for parent in list(root.iter()):
  for e in list(parent):
   if e.tag!=q('path') or not (e.get('stroke')=='#FBE6C8' or e.get('fill')=='#FBE6C8'):continue
   i=list(parent).index(e);parent.remove(e)
   if e.get('fill')=='none':
    width=float(e.get('stroke-width','160'))
    for c,extra,opacity in [('#4AA539',34,'.35'),('#39472d',18,'.6'),('#E6C59D',14,'1'),('#FBE6C8',0,'1')]:
     a=dict(e.attrib,stroke=c,**{'stroke-width':str(width+extra),'stroke-opacity':opacity,'stroke-linejoin':'round','stroke-linecap':'round'})
     parent.insert(i,E.Element(q('path'),a));i+=1
   else:
    for c,width,opacity in [('#39472d','18','.6'),('#E6C59D','14','1'),('#FBE6C8','0','1')]:
     parent.insert(i,E.Element(q('path'),dict(e.attrib,fill='#FBE6C8',stroke=c,**{'stroke-width':width,'stroke-opacity':opacity,'stroke-linejoin':'round'})));i+=1
 root.set('width',root.get('width','1400'));root.set('height',root.get('height','1400'));f.write_text(E.tostring(root,encoding='unicode'))
# Keep every new arrival on its unobstructed court. Source place IDs remain stable.
for ident,centrepoint in [('quay',[6700,4740]),('tutu',[4050,6000])]:
 place=next(p for p in layout['places'] if p['id']==ident)
 place.update(x=centrepoint[0],y=centrepoint[1],arrival=centrepoint)
 place['homes']=[p['id'] for p in layout['props'] if p.get('zone')==ident and p.get('household')]
 place['workplaces']=[p['id'] for p in layout['props'] if p.get('zone')==ident and p.get('communityRole')=='workplace']
 world['zones']['bigger-'+ident].update(x=centrepoint[0],y=centrepoint[1],spawn=centrepoint)
# Rebuild props and obstacles consistently in all three production manifests.
world['props']=art['props'];world['pathWidths']=[160]*len(world['paths'])
layout.update(coast=world['coast'],paths=world['paths'][len(read(S/'original-world.json')['paths']):],pathWidths=[160]*max(0,len(world['paths'])-len(read(S/'original-world.json')['paths'])))
layout['baseObstacles']=[o for o in world['obstacles'] if o in centre]
layout['obstacles']=[o for o in world['obstacles'] if o not in centre]
layout['shoreWalk']=layout['paths'][0]
layout['households']=[p['id'] for p in layout['props'] if p.get('household')]
# Both new wing sleepers come from the approved in-game rigs, following their kit transform.
for name,slot in [('teacup',-1),('tutu-tides',-2)]:
 bed=read('scripts/pink-hamlets-b/placement.json')[name]['sleep'];world['sleepSpots']['wing'][slot]=bed+[False]
for f,d in [(A/'art.json',art),(D/'world.json',world),(D/'walk-world.json',walk),(D/'harbor.json',harbor),(S/'layout.json',layout)]:write(f,d)
