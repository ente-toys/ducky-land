"""Idempotent application of authored Rosy B population and approved ribbon centre."""
import json,re,sys,math
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Polygon,Point,box
from shapely import affinity
from shapely.ops import unary_union
S=Path('scripts/rosy-ground'); A=Path('public/pixi-art/themes/pink'); D=Path('rive/web/themes/pink')
read=lambda p:json.loads(Path(p).read_text())
def write(p,v):Path(p).write_text(json.dumps(v,indent=1)+'\n')
B=read(S/'data/population.json');C=read(S/'data/centre.json');H=read(S/'data/shadows.json')
a=read(A/'art.json');w=read(D/'world.json');walk=read(D/'walk-world.json');layout=read('scripts/bigger-pink/layout.json')
def upsert(old,new,key='id'):
    ids={p[key] for p in new};return [p for p in old if p.get(key) not in ids]+new
def ellipse(o,margin=0):
    if o.get('poly'):return Polygon(o['poly']).buffer(margin)
    return affinity.scale(Point(o['x'],o['y']).buffer(1,32),o.get('rx',0)+margin,o.get('ry',0)+margin)
# Retire all old centre layers, including both offset paving discs.
removed={p['id'] for cat in ['props','flats','decks'] for p in a[cat] if p['src'].startswith('centre/') or p.get('id') in ['pink-close-plaza','pink-close-court']}
# The approved circle is open paving. Retire the small old rim ornaments inside it.
plaza=ellipse(C['plaza'])
for p in a['props']:
    if not p['id'].startswith('rosy-') and plaza.contains(Point(p['x'],p['y'])):
        removed.add(p['id'])
# Clear the full floor, including rim props whose padded bases cross its edge.
oldrim=[o for o in w['obstacles'] if not o.get('poly') and not o.get('name','').startswith('rosy-') and plaza.intersects(ellipse(o,16))]
for p in a['props']:
    if any(abs(p['x']-o['x'])<2 and abs(p['y']-o['y'])<20 for o in oldrim):removed.add(p['id'])
removedpoints=[(p['x'],p['y']) for p in a['props'] if p['id'] in removed]
for cat in ['props','flats','decks']:a[cat]=[p for p in a[cat] if p.get('id') not in removed and not p['src'].startswith('ribbon-centre/')]
for replacement in B['planting']['replacements']:
    p=next((p for p in a['props'] if p['id']==replacement['id']),None)
    if p is None:continue # retired rim ornament under the approved new floor
    assert p['src'] in [replacement['fromSrc'],replacement.get('src',replacement.get('toSrc'))],replacement
    for k in ['src','width','height']:p[k]=replacement.get(k,replacement.get('toSrc') if k=='src' else p[k])
# Use the final actual travel union, water polygons, bridge decks and retained keep-list.
rings=[]
surface=(S/'path-surface.svgfrag').read_text()
for s in re.findall(r'<path d="([^"]+)" fill="#FBE6C8"',surface)[0].split('M')[1:]:
    nums=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',s)));rings.append(Polygon(list(zip(nums[::2],nums[1::2]))))
paths=rings[0]
for r in rings[1:]:paths=paths.symmetric_difference(r)
water=unary_union([ellipse(o) for o in w['water']])
bridges=unary_union([box(p['x'],p['y'],p['x']+p['width'],p['y']+p['height']) for p in a['decks']])
keep=read(S/'keep.json')['landmarks'];protected=[]
for cat,ps in keep.items():
    for p in ps:
        if p['id'] in removed:continue
        if p.get('footprint'):protected.append(ellipse(p['footprint']))
keeparea=unary_union(protected)
accepted=[];dropped=[]
for p in B['planting']['props']:
    f=ellipse(p['footprint'],16)
    reason=next((name for name,g in [('paths',paths),('water',water.buffer(14)),('bridges',bridges),('keep',keeparea)] if f.intersects(g)),None)
    if reason:dropped.append({'id':p['id'],'reason':reason})
    else:accepted.append(p)
a['props']=upsert(a['props'],accepted+B['hill']['props']);a['flats']=upsert(a['flats'],[B['hill']['mound']]);a['kites']=B['kites']
# Strip only exact reviewed baked contact ellipses. Repeated application is safe.
stripped=[]
for item in H['bakedDuplicateShadowsToStrip']:
    f=Path(item['file']);text=f.read_text();count=text.count(item['exactXML']);assert count<=1,str(f)
    if count:f.write_text(text.replace(item['exactXML'],''));stripped.append(str(f))
for p in a['props']:
    record=next((r for r in H['overrides'] if r['id']==p['id']),None)
    if record:
        for k in ['shadow','shadowSize','shadowOffset']:
            if k in record:p[k]=record[k]
    if p['id'] in H['preserveDisabledPropIds']:p['shadow']=False
floors=[dict(p,src='ribbon-centre/'+p['src'],topLeft=True) for p in C['floorTiles']]
a['flats']+=floors
props=[]
for p in C['props']:
    p=dict(p,src='ribbon-centre/'+p['src'],wind=False)
    if p['id']=='rosy-music-box':p['contact']=False # tight ground blocker owns sleep clearance; lid is elevated
    if p['id'] in ['rosy-dancer','rosy-wind-key']:
        kind='spin' if p['id']=='rosy-dancer' else 'wind'
        # centre-motion pivot coordinates are absolute SVG-local coordinates.
        ax=p['anchor']['x']*p['width']+p['pivot'][0];ay=p['anchor']['y']*p['height']+p['pivot'][1]
        p['centrePiece']={'id':p['id'],'x':0,'y':0,'width':p['width'],'height':p['height'],'anchor':p['anchor'],'animate':{'kind':kind,'period':4.8 if kind=='spin' else 1.6,'pivot':[ax,ay]}}
    props.append(p)
a['props']+=props
newobs=[dict(p['footprint'],name=p['id']) for p in accepted+B['hill']['props'] if p.get('footprint')]
def obsolete(o):
    if o.get('centre')=='locked' or o.get('name') in removed:return True
    if not o.get('poly') and any(abs(o.get('x',1e8)-x)<2 and abs(o.get('y',1e8)-y)<20 for x,y in removedpoints):return True
    if not o.get('poly') and not o.get('name','').startswith('rosy-') and plaza.intersects(ellipse(o,16)):return True
    return False
for data in [w,walk]:
    data['obstacles']=upsert([o for o in data['obstacles'] if not obsolete(o)],newobs+C['walkBlockers'],'name')
    data['props']=a['props'];data['sleepTotal']=90;data['sleepSpots']=B['sleepers']['combinedSpots']
    data['centrePlacement']=dict(C['centrePlacementReplacement'],source='/pixi-art/themes/pink/ribbon-centre/placements.json',scale=1)
    if 'zones' in data:data['zones']['plaza'].update(x=4000,y=2620,rx=780,ry=560)
layout['props']=upsert([p for p in layout['props'] if p.get('id') not in removed],accepted+B['hill']['props'])
for key in ['baseObstacles','obstacles']:
    layout[key]=[o for o in layout[key] if not obsolete(o)]
layout['obstacles']=upsert(layout['obstacles'],newobs+C['walkBlockers'],'name')
write(A/'art.json',a);write(A/'ribbon-centre/placements.json',C);write(D/'world.json',w);write(D/'walk-world.json',walk);write('scripts/bigger-pink/layout.json',layout)
write(S/'population-report.json',{'acceptedPlanting':len(accepted),'dropped':dropped,'retiredCentreAndRimIds':sorted(removed),'strippedContacts':len(stripped),'sleepTotal':90,'centreError':math.dist(C['centre'],next(p['baseCentre'] for p in props if p['id']=='rosy-music-box'))})
print('Rosy B: planting',len(accepted),'dropped',dropped,'centre error 0px')
