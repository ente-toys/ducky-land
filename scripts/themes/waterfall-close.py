"""Close-up Waterfall finish. Inputs and review evidence stay Waterfall-only.

Run with /tmp/waterfall-polish-venv/bin/python scripts/themes/waterfall-close.py
Then run node scripts/themes/waterfall-benches.mjs to install all ten arc benches.
Keeps every centre piece placement, path, zone, coast and sleeping spot locked.
"""
import json, math, re, random
import shutil
from pathlib import Path
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union
from shapely import affinity

R = Path(__file__).resolve().parents[2]
A = R / 'public/pixi-art/themes/waterfall'
D = R / 'assets/world/themes/waterfall'
O = R.parent / 'concepts/themes/work/waterfall'
O.mkdir(parents=True, exist_ok=True)
baseline = O / 'close-waterfall-source.json'
if not baseline.exists():
    baseline.write_text(json.dumps({
        'art': json.loads((A/'art.json').read_text()),
        'world': json.loads((D/'world.json').read_text()),
        'walk': json.loads((D/'walk-world.json').read_text()),
        'ground': (A/'ground.svg').read_text(),
        'paving': (A/'centre/decal-paving.svg').read_text(),
        'centre': json.loads((A/'centre/centre.json').read_text()),
    }))
src = json.loads(baseline.read_text())
shutil.copyfile(R/'public/pixi-art/detail/street--planter-flowers.svg', A/'reuse/street--planter-flowers.svg')
a, w, walk = src['art'], src['world'], src['walk']
INK, CREAM, GOLD, TEAL = '#39472D', '#FFF0C7', '#FDE48C', '#80BBB0'
rng = random.Random(5293)

def path(points, fill='none', stroke=INK, sw=2.2, close=True):
    return '<path d="M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in points)+('Z' if close else '')+f'" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"/>'

def ellipse(x,y,rx,ry,fill='none',stroke=INK,sw=2.2):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'

def arc(x,y,rx,ry,start,end,n=20):
    return [(x+rx*math.cos(t),y+ry*math.sin(t)) for t in [math.radians(start+(end-start)*j/n) for j in range(n+1)]]

def sector(x,y,rx,ry,inner,start,end,fill,sw=1.4):
    return path(arc(x,y,rx,ry,start,end)+arc(x,y,rx*inner,ry*inner,end,start),fill,'#B8A86B',sw)

def svg(body, vb):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{vb[2]}" height="{vb[3]}" viewBox="{" ".join(map(str,vb))}" stroke-linejoin="round" stroke-linecap="round">{body}</svg>'

def ripple_motif(x,y,scale=1):
    # All pieces are flush stone inlay. No new solid object in the crowd space.
    return f'''<g transform="translate({x} {y}) scale({scale})">
      <path d="M0 -68 C-13 -42 -42 -19 -42 4 C-42 52 42 52 42 4 C42 -19 13 -42 0 -68Z" fill="{TEAL}" stroke="#658F74" stroke-width="3"/>
      <path d="M-23 4 Q-29 23 -11 29" fill="none" stroke="#C8E3CB" stroke-width="5"/>
      <path d="M-78 65 Q-52 52 -26 65 T26 65 T78 65 M-61 84 Q-35 71 -9 84 T43 84" fill="none" stroke="#6A9E8B" stroke-width="5"/>
    </g>'''

# Home's paving language, fitted to the locked viewing deck's own ellipse.
K = 360/470
floor = [ellipse(0,16,1150,1150*K,'#C88941',INK,4.6), ellipse(0,0,1150,1150*K,'#F4CF80',INK,4.6)]
palette = [CREAM, GOLD, '#F9E5AB', '#FFF5D5', '#F6DE99']
floor.append(ellipse(0,0,1130,1130*K,CREAM,'#A9985F',3.0))
# Home's actual hand-shaped stone courses carry their small uneven joints and
# shaded tile corners into this floor. These are copied vector paths, not raster.
home_paving = (R/'public/pixi-art/decals/plaza-paving.svg').read_text()
home_body = re.sub(r'^.*?<svg[^>]*>','',home_paving,flags=re.S).rsplit('</svg>',1)[0]
floor.append(f'<g transform="scale(2.4) translate(-2820 -2370)">{home_body}</g>')
# The lookout has a walkable centre instead of Home's fountain. Keep its original
# fitted flagstones in that area, trimmed under the surrounding stone courses.
old_floor = src['paving'].split('<g clip-path="url(#floor)">',1)[1].rsplit('</g>',1)[0]
floor.append('<defs><clipPath id="inner-flags"><ellipse rx="530" ry="405.96"/></clipPath></defs><g clip-path="url(#inner-flags)">'+old_floor+'</g>')
for r in [1130,1082]:
    floor.append(ellipse(0,0,r,r*K,'none','#A9985F',3.0))
    floor.append(ellipse(0,-2,r-6,(r-6)*K,'none','#FFF5D5',3.4))
# Repeating stream-wave tesserae around the inner rim band, inside the rail.
for j in range(28):
    t=j*math.tau/28; x=1105*math.cos(t); y=1105*K*math.sin(t)
    floor.append(f'<g transform="translate({x:.2f} {y:.2f}) rotate({j*360/28})"><path d="M-15 -11 Q0 -23 15 -11 Q0 -1 -15 -11Z" fill="#6DA891" stroke="#678F72" stroke-width="2.4"/></g>')
floor += [ellipse(0,0,230,230*K,'#E5D99C','#AA9D68',3.8),ellipse(0,0,211,211*K,CREAM,'#B5AA74',2.8),ripple_motif(0,-12,1.7)]
(A/'centre/decal-paving.svg').write_text(svg('<title>Waterfall lookout, concentric cut-stone paving and stream inlay</title>'+''.join(floor),[-1155,-885.851,2310,1789.702]))

land=Polygon(w['coast']); grass=land.buffer(-115)
paths=unary_union([LineString(p).buffer(150) for p in w['paths']])
wet=unary_union([Polygon(q['poly']) for q in w['water'] if 'poly' in q])
decks=unary_union([LineString([q['a'],q['b']]).buffer(q['w']/2+35) for q in w['walkways']])
sleepers=json.loads((A/'waterfall-sleepers.json').read_text())

def polygon_svg(poly,fill,stroke='none',sw=2.2):
    if poly.is_empty:return ''
    if poly.geom_type in ('MultiPolygon','GeometryCollection'):
        return ''.join(polygon_svg(q,fill,stroke,sw) for q in poly.geoms)
    if poly.geom_type!='Polygon':return ''
    d='M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in poly.exterior.coords)+'Z'
    for hole in poly.interiors:d+=' M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in hole.coords)+'Z'
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" fill-rule="evenodd" stroke-linejoin="round"/>'

s=src['ground']
# One union for the trails removes the dark overlap seams at branch joins.
pat=r'<path\b[^>]*stroke="#(?:897F46|FFE9A1)"[^>]*stroke-width="(?:305|300)"[^>]*/>'
matches=list(re.finditer(pat,s)); assert len(matches)==10,len(matches)
first=matches[0].start(); s=re.sub(pat,'',s)
s=s[:first]+polygon_svg(paths,'#FFE9A1','#897F46',2.6)+s[first:]

finish=[]
activity_counts={}
for key,z in w['zones'].items():
    if not key.startswith('activity'):continue
    x,y,rx,ry=[z[k] for k in ('x','y','rx','ry')]
    # Open grass field with a crafted stone perimeter. Entrances remain open.
    chunks=[]
    for j in range(64):
        deg=j*360/64
        if min(abs(deg-ang) for ang in [0,180,360])<12:continue
        chunks.append(sector(x,y,rx*.97,ry*.97,.92,deg,deg+360/64,palette[(j//2)%4],1.4))
    for j in range(32):
        t=j*math.tau/32
        xx=x+rx*.944*math.cos(t); yy=y+ry*.944*math.sin(t)
        chunks.append(ellipse(xx,yy,3.7,2.9,'#82A77D','none'))
    # Small water emblem set flush in a central lawn rosette.
    # The south zone reaches the beach. Set the whole rosette on real grass,
    # between the lookout bridge and shore, rather than clipping half of it.
    emblem_y = y-125 if key=='activity-3' else y
    chunks += [ellipse(x,emblem_y,100,76.6,'#D7D5A0','#92A351',2),ellipse(x,emblem_y,87,66.6,CREAM,'#B8A86B',1.5),ripple_motif(x,emblem_y-5,.65)]
    # Clip the south rim to grass, away from the sand and primary jetty.
    clipid=key+'-grass-clip'
    finish += [f'<defs><clipPath id="{clipid}">{polygon_svg(grass,"white")}</clipPath></defs>',f'<g clip-path="url(#{clipid})">'+''.join(chunks)+'</g>']
    activity_counts[key]=len(chunks)

# Market lanes get a fitted double edging and wave stones, never a solid stall.
for key,z in w['zones'].items():
    if not key.startswith('stalls'):continue
    x,y,rx=z['x'],z['y'],z['rx']
    for j in range(19):
        xx=x-rx+92+j*(rx*2-184)/18; yy=y+96+9*math.sin(j*12/18*.55)
        finish.append(ellipse(xx,yy+27,6.5,3.3,'#89AB87','#8B9961',1))
    for side in [-1,1]:
        finish.append(ripple_motif(x+side*(rx-75),y-17,.35))

# Flush roundels turn the broad, softly joined intersections into deliberate places.
for x,y in [(1200,3750),(2600,4000),(5350,4000),(6600,3750),(1100,2850),(6800,2850)]:
    if wet.buffer(25).contains(Point(x,y)):continue
    for j in range(16):finish.append(sector(x,y,90,69,.78,j*22.5,(j+1)*22.5,palette[j%4],1.3))
    finish.append(ripple_motif(x,y-5,.45))

# Ground flecks follow the verge. A fresh seed makes loose groups, not a dotted grid.
verge=paths.buffer(92).difference(paths.buffer(10)).intersection(grass).difference(wet.buffer(25)).difference(decks)
flecks=0
for _ in range(2400):
    x=rng.uniform(600,7200);y=rng.uniform(1100,4740)
    if not verge.contains(Point(x,y)):continue
    if any(math.hypot(x-q['x'],y-q['y'])<q['r']+30 for q in sleepers):continue
    if rng.random()<.56:
        finish.append(f'<use href="#grass-tuft-{rng.randint(1,3)}" x="{x:.1f}" y="{y:.1f}" width="{rng.randint(22,32)}" height="20"/>')
    else:
        finish.append(ellipse(x,y,rng.uniform(5,9),rng.uniform(3,6),'#FFE9A1','#8F9953',1.4))
    flecks+=1
s=s.replace('</svg>',''.join(finish)+'</svg>')

new_props=[]
def put(file,x,y,width,name):
    text=(A/file).read_text();vb=list(map(float,re.search(r'viewBox="([^"]+)"',text)[1].split()));height=width*vb[3]/vb[2]
    pt=Point(x,y)
    if not grass.contains(pt) or paths.buffer(width*.25+8).contains(pt) or wet.buffer(15).contains(pt) or decks.contains(pt):return False
    for q in sleepers:
        if math.hypot(x-q['x'],(y-q['y'])*1.6)<width*.4+q['r']+18:return False
        if y>q['y']-20 and y-q['y']<height*.9 and abs(x-q['x'])<width*.5+q['r']*.6:return False
    if any(math.hypot(x-p['x'],(y-p['y'])*1.2)<max(70,width*.65) for p in a['props']):return False
    if 'lantern' in name.lower() and any('lamp' in p['src'] and math.hypot(x-p['x'],y-p['y'])<175 for p in a['props']):return False
    if any(((x-z['x'])/z['rx'])**2+((y-z['y'])/z['ry'])**2<.7**2 for k,z in w['zones'].items() if k.startswith(('activity','stalls'))):return False
    p=dict(id=f'waterfall-close-rim-{len(new_props)}',name=name,src=file,x=round(x,2),y=round(y,2),width=width,height=height,scale=1,anchor={'x':.5,'y':1},wind=False)
    a['props'].append(p);new_props.append(p)
    w['obstacles'].append(dict(x=p['x'],y=p['y']-5,rx=min(width*.25,28),ry=15,waterfallClose=True))
    return True

for key,z in w['zones'].items():
    if not key.startswith('activity'):continue
    x,y,rx,ry=[z[k] for k in ['x','y','rx','ry']]
    for deg in [-150,-30,32,148]:
        t=math.radians(deg)
        for scale in [1.02,1.09,1.17]:
            if put('reuse/street--lamp-lantern.svg',x+rx*scale*math.cos(t),y+ry*scale*math.sin(t),49,'Activity rim lantern'):break
    for deg in [-139,-41,44,136,65,115]:
        t=math.radians(deg)
        for scale in [1.01,1.1,1.18]:
            if put('reuse/street--planter-flowers.svg',x+rx*scale*math.cos(t),y+ry*scale*math.sin(t),80,'Activity rim flower pot'):break

# The real southeast junction was hidden by crowns, despite clear tree bases.
# Move only the three trees seen in the close-up. Nod sleeper trunks stay fixed.
move_ids={'waterfall-4','waterfall-polish-84','waterfall-polish-119'}
trees=[p for p in a['props'] if 'tree' in p['name'].lower() and not p['src'].startswith('centre/')]
reserved=unary_union([affinity.scale(Point(z['x'],z['y']).buffer(z['rx']+20),1,(z['ry']+20)/(z['rx']+20),origin=(z['x'],z['y'])) for z in w['zones'].values()])
def crown(p,x,y):
    yy=y-p['height']*.62
    return affinity.scale(Point(x,yy).buffer(p['width']*.43),1,p['height']*.33/(p['width']*.43),origin=(x,yy))
tree_moves=[]
for p in [q for q in trees if q['id'] in move_ids]:
    ox,oy=p['x'],p['y'];found=None
    for scale in [1,.9,.8,.7,.6]:
        ww,hh=p['width']*scale,p['height']*scale
        if hh<300:continue
        for rad in range(100,3501,50):
            for j in range(80):
                t=j*math.tau/80;x=ox+rad*math.cos(t);y=oy+rad*.72*math.sin(t);pt=Point(x,y)
                cr=crown({**p,'width':ww,'height':hh},x,y)
                if not grass.contains(pt) or paths.buffer(5).contains(pt) or reserved.contains(pt) or wet.contains(pt) or decks.contains(pt):continue
                if not grass.contains(cr) or paths.buffer(5).intersects(cr) or wet.buffer(25).intersects(cr) or reserved.intersects(cr) or decks.intersects(cr):continue
                if cr.intersects(Polygon([(3020,1060),(4780,1060),(4780,2230),(3020,2230)])) or cr.intersects(Polygon([(3230,3030),(4570,3030),(4570,3380),(3230,3380)])):continue
                if any(q['id'] not in move_ids and cr.intersects(crown(q,q['x'],q['y'])) for q in trees):continue
                if any(math.hypot(x-b['x'],(y-b['y'])*1.6)<ww*.4+b['r']+18 or y>b['y']-20 and y-b['y']<hh*.9 and abs(x-b['x'])<ww*.5+b['r']*.6 for b in sleepers):continue
                found=(round(x,2),round(y,2),scale);break
            if found:break
        if found:break
    assert found, 'No clear tree site for '+p['id']
    p['x'],p['y']=found[:2];p['width']*=found[2];p['height']*=found[2]
    for ob in w['obstacles']:
        if 'poly' not in ob and abs(ob.get('x',-999)-ox)<.1 and abs(ob.get('y',-999)-oy)<45:
            ob['x']+=p['x']-ox;ob['y']+=p['y']-oy;ob['rx']*=found[2];ob['ry']*=found[2]
    tree_moves.append({'id':p['id'],'from':[ox,oy],'to':[p['x'],p['y']],'sizeFactor':found[2]})
    move_ids.remove(p['id'])

for t in a['ground']['tiles']:
    (A/t['src']).write_text(re.sub(r'<svg[^>]+>',f'<svg xmlns="http://www.w3.org/2000/svg" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}">',s,count=1))
(A/'ground.svg').write_text(s)
w['props']=a['props'];walk['obstacles']=w['obstacles']
for file,value in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk)]:file.write_text(json.dumps(value,separators=(',',':')))
(O/'close-waterfall-changes.json').write_text(json.dumps({'activityFloorDetails':activity_counts,'vergeFlecks':flecks,'rimProps':new_props,'treeMoves':tree_moves,'centreMetadataUnchanged':True},indent=2))
print('Patterned centre and 3 activity rims, 3 market lanes, 6 trail roundels;',flecks,'verge details;',len(new_props),'rim props')
