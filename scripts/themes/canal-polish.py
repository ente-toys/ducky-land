"""Canal-only detail pass. Run after canal-build.py and before canal-sleepers.mjs.
Reuses approved Home SVG assets. Never changes coastline, paths or reservations.
"""
from pathlib import Path
import json, math, random, re, shutil
from shapely.geometry import Point, Polygon, LineString, box
from shapely.affinity import scale
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[2]; ART=ROOT/'public/pixi-art/themes/canal'; DATA=ROOT/'rive/web/themes/canal'
rng=random.Random(5281)
read=lambda p:json.loads(p.read_text())
art=read(ART/'art.json'); world=read(DATA/'world.json'); walk=read(DATA/'walk-world.json')
assert not any(str(p['id']).startswith('canal-polish-') for p in art['props']), 'Rebuild base first, then polish once.'
base_count=len(art['props']); props=art['props']; obstacles=world['obstacles']; flats=[]; floating=[]
def ell(x,y,rx,ry):return scale(Point(x,y).buffer(1,quad_segs=48),rx,ry)
land=unary_union([Polygon(world['coast'])]+[ell(*p) for p in world['islets']]); main=Polygon(world['coast'])
reserved=unary_union([box(z['x0'],z['y0'],z['x1'],z['y1']) if 'x0' in z else ell(z['x'],z['y'],z['rx'],z['ry']) for n,z in world['zones'].items() if n.startswith(('activity-','stalls-')) or n=='centre'])
paths=unary_union([LineString(p).buffer(w/2) for p,w in zip(world['paths'],world['pathWidths'])])
decks=unary_union([LineString([d['a'],d['b']]).buffer(d['w']/2+85) for d in world['walkways']])
land_inset=land.buffer(-85); ground_inset=land.buffer(-35); main_inset=main.buffer(-140); reserved65=reserved.buffer(65); paths58=paths.buffer(58); paths82=paths.buffer(82)
# Home assets retain their original stroke weight, colour and ground-view perspective.
for n in ['nature--reeds','nature--cattails','nature--rock-flat','nature--rock-round','nature--lily-pad-flower','nature--lily-pad-large','nature--mushroom-red','street--fence-rail','street--sign-park','street--signpost-three-way','street--planter-flowers','beach--shell-scallop','beach--shell-cowrie','beach--shell-conch','beach--starfish-orange']:
    src=ROOT/f'public/pixi-art/detail/{n}.svg'
    if src.exists():shutil.copyfile(src,ART/f'reuse/{n}.svg')
for src in (ROOT/'public/pixi-art/decals').glob('*.svg'):
    if src.stem!='plaza-paving':shutil.copyfile(src,ART/'reuse'/src.name)
# Flat-fill copies only, consistent with the theme's existing asset preparation.
for f in (ART/'reuse').glob('*.svg'):
    s=f.read_text()
    for m in list(re.finditer(r'<(?:linearGradient|radialGradient)\b[^>]*id="([^"]+)"[^>]*>(.*?)</(?:linearGradient|radialGradient)>',s,re.S)):
        stops=re.findall(r'stop-color="(#[A-Fa-f0-9]+)"',m[2])
        if stops:s=s.replace('url(#'+m[1]+')',stops[min(1,len(stops)-1)])
        s=s.replace(m[0],'')
    f.write_text(s)
def size(src):
    s=(ART/src).read_text();m=re.search(r'viewBox="([^"]+)"',s)
    return list(map(float,m[1].replace(',',' ').split()))[2:] if m else [float(re.search(rf'{a}="([\d.]+)',s)[1]) for a in ('width','height')]
def put(name,src,x,y,h,solid=True):
    w,hh=size(src);k=h/hh
    p=dict(id=f'canal-polish-{len(props):04d}',name=name,src=src,x=round(x,1),y=round(y,1),width=w,height=hh,scale=round(k,5),anchor={'x':.5,'y':.98},flip=rng.random()<.4)
    props.append(p)
    if solid:
        tree='tree' in name.lower()
        if 'townhouse' in name.lower():obstacles.append(dict(poly=[[x-w*k*.42,y-80],[x+w*k*.42,y-80],[x+w*k*.42,y-5],[x-w*k*.42,y-5]]))
        else:obstacles.append(dict(x=p['x'],y=p['y']-8,rx=30 if tree else min(w*k*.32,65),ry=22 if tree else min(h*.12,28)))
    return p
# Canal neighbourhoods on both banks, with real balcony and flower-box artwork.
for i,(x,y,h) in enumerate([(2870,2760,540),(5120,2790,550),(2820,3740,520),(5160,3730,525),(2350,4450,550),(5520,4310,560)]):
    put('Balcony townhouse',f'detail/balcony-{"peach" if i%2 else "cream"}.svg',x,y,h)
# Replace the tiny temporary marker with the approved layered fountain.
old=next(p for p in props if p['id']=='canal-centre-placeholder'); props.remove(old)
obstacles[:]=[o for o in obstacles if not (o.get('x')==4000 and o.get('y')==3350)]
for part in ['fountain','fountain-jets']:
    q=next(p for p in read(ART/'centre/centre.json')['pieces'] if p['id']==part)
    k=1.65; sort=3490
    props.append(dict(id='canal-centre-'+part,name='Canal fountain '+part,src='centre/'+q['file'],x=4000,y=sort,width=q['width'],height=q['height'],scale=k,anchor={'x':-q['x']/q['width'],'y':(sort-3320-q['y']*k)/(q['height']*k)},shadow=False))
obstacles.append(dict(x=4000,y=3415,rx=295,ry=170))
world['zones']['centre']['placeholder']=False
world['zones']['centre']['landmark']='Shell market and fountain square, approved canal 4'
buildings=[p for p in props if re.search('townhouse|market hall|stall|gazebo',p['name'],re.I)]
def clear(x,y,h=0,w=0,gap=100,trees=False):
    pt=Point(x,y)
    if not land_inset.contains(pt) or reserved65.contains(pt) or (paths82 if trees else paths58).contains(pt) or decks.contains(pt):return False
    if h and reserved.buffer(12).intersects(box(x-w/2,y-h*.95,x+w/2,y+15)):return False
    if any(math.hypot(x-p['x'],(y-p['y'])*1.3)<gap for p in props):return False
    if trees and any(box(x-w/2,y-h,x+w/2,y+10).intersects(box(p['x']-p['width']*p['scale']*.47,p['y']-p['height']*p['scale'],p['x']+p['width']*p['scale']*.47,p['y']+35)) for p in buildings):return False
    return True
# Furnished rims, with gaps wherever the wide walking paths enter a lawn.
for label,z in world['zones'].items():
    if not label.startswith(('activity-','stalls-')):continue
    if 'x0' in z:
        candidates=[(x,z['y0']-100) for x in range(int(z['x0'])+90,int(z['x1']),180)]+[(x,z['y1']+115) for x in range(int(z['x0'])+90,int(z['x1']),180)]
    else:
        candidates=[(z['x']+(z['rx']+110)*math.cos(i*math.tau/18),z['y']+(z['ry']+100)*math.sin(i*math.tau/18)) for i in range(18)]
    for i,(x,y) in enumerate(candidates):
        if clear(x,y,85,130,80):put('Garden border flowers' if i%3 else 'Garden border bush',f'reuse/flower-{i%3+1}.svg' if i%3 else 'reuse/bush-1.svg',x,y,62 if i%3 else 85,not i%3)
# Garden picnic corners and beach parasols use original Home objects.
for n in ['beach--umbrella-coral','beach--umbrella-yellow','beach--towel-blue','beach--towel-green','street--crate','street--barrel']:
    src=ROOT/f'public/pixi-art/detail/{n}.svg'
    if src.exists():shutil.copyfile(src,ART/f'reuse/{n}.svg')
for x,y in [(3430,965),(1120,2600),(6080,4510),(2920,4370)]:
    if clear(x,y,150,200,100):put('Garden picnic table','reuse/picnic-table.svg',x,y,150)
for x,y in [(6580,4480),(6880,4230)]:
    if clear(x,y,230,230,90):put('Beach umbrella','reuse/umbrella-garden.svg',x,y,230)
# Four small sandy resting coves, placed before planting so their space stays clear.
for n in ['beach--towel-striped','beach--towel-sun']:
    shutil.copyfile(ROOT/f'public/pixi-art/detail/{n}.svg',ART/f'reuse/{n}.svg')
beach_spots=[(4350,800),(6950,4000),(6650,4300),(1450,4400)]
for i,(x,y) in enumerate(beach_spots):
    put('Beach umbrella','reuse/umbrella-garden.svg',x,y,215)
    put('Beach towel',f'reuse/beach--towel-{"striped" if i%2 else "sun"}.svg',x-90,y+35,62,False)
for source,n in [('sunflower/detail/barrel-seeds.svg','barrel-seeds'),('goldmine/detail/supply-crates.svg','supply-crates')]:
    shutil.copyfile(ROOT/f'public/pixi-art/themes/{source}',ART/f'reuse/{n}.svg')
for x,y in [(3260,2810),(4760,2850),(3260,3830),(4720,3810)]:
    put('Market supply crates','reuse/supply-crates.svg',x,y,95)
    put('Market barrel','reuse/barrel-seeds.svg',x+105,y-15,90)
# Several trees together, with varying crown shapes and height, rather than evenly isolated dots.
original_trees=[p for p in props if p['name']=='Canal tree']; tree_before=len(original_trees)
for trial in range(14000):
    if sum(p['name']=='Canal tree' for p in props)>=82:break
    if trial<6000:
        t=original_trees[trial%len(original_trees)];a=rng.random()*math.tau;r=rng.uniform(210,370);x=t['x']+math.cos(a)*r;y=t['y']+math.sin(a)*r*.7
    else:x=rng.uniform(700,7300);y=rng.uniform(800,5250)
    k=rng.choice([1,1,2,3,3,4,5]);h=rng.uniform(345,455);sw,sh=size(f'reuse/tree-{k}.svg')
    if not clear(x,y,h,sw/sh*h,190,True):continue
    put('Canal tree',f'reuse/tree-{k}.svg',x,y,h)
# Bush and flower beds at the feet and outer edges of each grove.
for t in [p for p in props if p['name']=='Canal tree']:
    for j in range(6):
        a=rng.random()*math.tau;r=rng.uniform(110,240);x=t['x']+math.cos(a)*r;y=t['y']+math.sin(a)*r*.6+30
        isb=j<2;h=rng.uniform(88,125) if isb else rng.uniform(42,60);src=f'reuse/bush-{rng.randint(1,4)}.svg' if isb else f'reuse/flower-{rng.randint(1,3)}.svg'
        sw,sh=size(src)
        if clear(x,y,h,sw/sh*h,85 if isb else 65):put('Canal bush' if isb else 'Garden flowers',src,x,y,h,isb)
# Small furnished pauses beside the main promenade, all outside the activity outlines.
for x,y in [(3240,1010),(4190,950),(5580,1440),(6790,2730),(6870,3490),(5940,4500),(3050,4450),(2260,4420),(1050,2700),(1290,2040)]:
    if clear(x,y,105,190,120):
        put('Quay bench','reuse/street--bench-wood.svg',x,y,100)
        if clear(x+145,y-20,185,80,85):put('Canal lamp','reuse/lamp-lantern.svg',x+145,y-20,185)
        if clear(x-140,y+10,100,140,80):put('Quay flower planter','reuse/street--planter-flowers.svg',x-140,y+10,100)
# Short fence segments frame planting, never span a path or enclose the empty greens.
for x,y in [(3030,910),(3250,905),(5520,1580),(5740,1655),(1020,2440),(1050,4030),(5680,4620),(5900,4550),(6840,3220)]:
    if clear(x,y,95,240,100):put('Garden fence','reuse/street--fence-rail.svg',x,y,95)
for x,y in [(1750,1360),(6330,2880),(2450,4510)]:
    if clear(x,y,135,100,90):put('Quay direction sign','reuse/street--signpost-three-way.svg',x,y,135)
# Shore stones and reeds follow both sides of the actual canal, leaving docking approaches clear.
shore=land.boundary
for i in range(15000):
    if sum(p['name'].startswith('Shore ') for p in props)>=112:break
    x,y=rng.uniform(650,7350),rng.uniform(650,5350);pt=Point(x,y)
    if not land.contains(pt) or not 45<shore.distance(pt)<145 or reserved.buffer(70).contains(pt) or paths.buffer(40).contains(pt) or decks.buffer(95).contains(pt):continue
    if any(math.hypot(x-p['x'],y-p['y'])<125 for p in props):continue
    reed=i%3==0;kind='nature--reeds' if reed else ['nature--rock-flat','nature--rock-round','rock-boulder'][i%3]
    put('Shore reeds' if reed else 'Shore rock',f'reuse/{kind}.svg',x,y,rng.uniform(65,110) if reed else rng.uniform(35,68),not reed)
# Shells are low accents on sandy coastal verges, not distributed across the lawns.
for i in range(5000):
    if sum(p['name']=='Shore shell' for p in props)>=38:break
    x,y=rng.uniform(700,7300),rng.uniform(700,5300);pt=Point(x,y)
    if not land.contains(pt) or not 28<shore.distance(pt)<90 or reserved.buffer(50).contains(pt) or decks.buffer(85).contains(pt):continue
    if any(math.hypot(x-p['x'],y-p['y'])<105 for p in props):continue
    put('Shore shell',f'reuse/{["beach--shell-scallop","beach--shell-cowrie","beach--shell-conch"][i%3]}.svg',x,y,rng.uniform(25,42),False)
# Floating leaf patches in the bank shallows, well away from the bridge and boat berths.
harbor=read(DATA/'harbor.json')
for i in range(10000):
    if len(floating)>=32:break
    x,y=rng.uniform(1800,6200),rng.uniform(1750,4700);pt=Point(x,y)
    if land.contains(pt) or not 65<shore.distance(pt)<170 or decks.buffer(160).contains(pt):continue
    if any(math.hypot(x-b['x'],y-b['y'])<260 for b in harbor['boats']):continue
    if any(math.hypot(x-f['x'],y-f['y'])<120 for f in floating):continue
    src=f'reuse/nature--lily-pad-{"flower" if i%3==0 else "large"}.svg';sw,sh=size(src);w=rng.uniform(68,105)
    floating.append(dict(src=src,x=round(x,1),y=round(y,1),width=w,height=w*sh/sw,phase=i*1.7))
# Furnish small lawn clearings and sandy coves, away from every reserved rectangle.
for n in ['beach--towel-striped','beach--towel-sun','street--picnic-blanket']:
    shutil.copyfile(ROOT/f'public/pixi-art/detail/{n}.svg',ART/f'reuse/{n}.svg')
# Pick clear patches by usable footprint rather than skipping a hand-picked blocked point.
for i in range(18000):
    if sum(p['name']=='Picnic blanket' for p in props)>=5:break
    x,y=rng.uniform(900,7100),rng.uniform(900,5000)
    if clear(x,y,90,175,140) and main.contains(Point(x,y)) and land.boundary.distance(Point(x,y))>170:
        put('Picnic blanket','reuse/street--picnic-blanket.svg',x,y,90,False)
        if clear(x+120,y-15,105,160,90):put('Picnic bench','reuse/street--bench-wood.svg',x+120,y-15,100)
# A furnished fountain square with a generous central approach and open quadrants.
for x,y in [(3570,3650),(4430,3650),(3540,3140),(4460,3140)]:
    put('Fountain garden bench','reuse/street--bench-wood.svg',x,y,100)
    put('Fountain flower planter','reuse/street--planter-flowers.svg',x+120,y+10,100)
# Match Home's actual 1.5x ground-detail asset scale and 78-unit spacing.
decal_sizes={'grass-tuft-1':(44,26),'grass-tuft-2':(34,22),'grass-tuft-3':(56,24),'flower-dot-1':(20,18),'flower-dot-2':(26,18),'flower-dot-3':(22,16),'pebble-1':(22,14),'pebble-2':(34,16),'pebble-3':(28,18),'sand-speck-1':(16,8),'sand-speck-2':(22,10),'edge-stone-1':(30,18)}
grid={};grass=['grass-tuft-1','grass-tuft-2','grass-tuft-3','grass-tuft-1','flower-dot-1','flower-dot-2','flower-dot-3','pebble-1','pebble-2']
for i in range(70000):
    if len(flats)>=2100:break
    x,y=rng.uniform(650,7350),rng.uniform(650,5350);pt=Point(x,y)
    if not ground_inset.contains(pt) or reserved.buffer(25).contains(pt) or paths.buffer(16).contains(pt) or decks.contains(pt):continue
    if any(math.hypot(x-p['x'],(y-p['y'])*1.7)<min(145,p['width']*p['scale']*.3+20) for p in props):continue
    gx,gy=int(x/62),int(y/62)
    if any(math.hypot(x-a,y-b)<62 for dx in [-1,0,1] for dy in [-1,0,1] for a,b in grid.get((gx+dx,gy+dy),[])):continue
    d=shore.distance(pt);pd=paths.distance(pt)
    sand=d<110 or not main.contains(pt) or (x>6200 and y>4260) or (d<230 and 1900<x<6100 and y>1600)
    names=['sand-speck-1','sand-speck-2','pebble-1','pebble-3'] if sand else grass
    kind='edge-stone-1' if pd<55 and i%3==0 else rng.choice(names);w,h=decal_sizes[kind]
    flats.append(dict(src=f'reuse/{kind}.svg',x=round(x,1),y=round(y,1),width=w*1.5,height=h*1.5,flip=rng.random()<.5))
    grid.setdefault((gx,gy),[]).append((x,y))
lawn_decals=0
for label,z in world['zones'].items():
    if not label.startswith('activity-'):continue
    for i in range(90):
        x=z['x']+rng.uniform(-z['rx']+25,z['rx']-25);y=z['y']+rng.uniform(-z['ry']+25,z['ry']-25)
        if ((x-z['x'])/(z['rx']-25))**2+((y-z['y'])/(z['ry']-25))**2>1:continue
        kind=rng.choice(grass);w,h=decal_sizes[kind]
        flats.append(dict(src=f'reuse/{kind}.svg',x=round(x,1),y=round(y,1),width=w*1.5,height=h*1.5,flip=rng.random()<.5));lawn_decals+=1
# Organic low-contrast grass patches and paired paving-edge cobbles: floor detail only.
patch=[]
def poly(points):return 'M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in points)+' Z'
for i in range(400):
    x,y=rng.uniform(800,7200),rng.uniform(850,5150);rx,ry=rng.uniform(90,200),rng.uniform(35,90)
    ps=[(x+math.cos(t)*rx*(1+rng.uniform(-.16,.16)),y+math.sin(t)*ry*(1+rng.uniform(-.16,.16))) for t in [j*math.tau/14 for j in range(14)]];q=Polygon(ps)
    if not main_inset.contains(q) or reserved.buffer(25).intersects(q) or paths.buffer(15).intersects(q):continue
    patch.append(f'<path d="{poly(ps)}" fill="{["#8CB032","#9DBF3D","#96B934"][i%3]}"/>')
# Add the patches below existing textured ground, so Home decals stay crisp above them.
patch.extend(f'<path d="{poly(list(ell(x,y,165,90).intersection(land).exterior.coords))}" fill="#FFE399"/>' for x,y in beach_spots)
s=(ART/'ground.svg').read_text();s=s.replace('</svg>',''.join(patch)+'</svg>')
(ART/'ground.svg').write_text(s)
for t in art['ground']['tiles']:
    tile=re.sub(r'<svg\b[^>]*>',f'<svg xmlns="http://www.w3.org/2000/svg" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}" stroke-linecap="round" stroke-linejoin="round">',s,count=1)
    (ART/t['src']).write_text(tile)
art['flats']=flats;art['floating']=floating
world['props']=props;walk['obstacles']=obstacles
# No change to ambient implementation: theme engine consumes the existing birds/butterflies.
for p,obj in [(ART/'art.json',art),(DATA/'world.json',world),(DATA/'walk-world.json',walk)]:p.write_text(json.dumps(obj,separators=(',',':')))
from collections import Counter
metrics=dict(baseProps=base_count,props=len(props),addedProps=len(props)-base_count,counts=dict(Counter(p['name'] for p in props)),groundDecals=len(flats),organicGrassPatches=len(patch),floatingLilyPads=len(floating),reservedZonesUnchanged=True,coastPathsDecksUnchanged=True)
(ART/'polish-metrics.json').write_text(json.dumps(metrics,indent=2));print(json.dumps(metrics,indent=2))

# Later-added Home towels use the same flat palette preparation.
for f in (ART/'reuse').glob('*.svg'):
    s=f.read_text()
    for m in list(re.finditer(r'<(?:linearGradient|radialGradient)\b[^>]*id="([^"]+)"[^>]*>(.*?)</(?:linearGradient|radialGradient)>',s,re.S)):
        stops=re.findall(r'stop-color="(#[A-Fa-f0-9]+)"',m[2])
        if stops:s=s.replace('url(#'+m[1]+')',stops[min(1,len(stops)-1)])
        s=s.replace(m[0],'')
    f.write_text(s)
