"""Pink's final road and domestic composition pass. No shared runtime changes.

Replays from the committed river-fix drawing, keeping its rivers and bridges.
Shapely is an authoring dependency in /private/tmp/ducky-pink-geometry only.
"""
from pathlib import Path
import ast, copy, json, math, re, subprocess, sys
sys.path.insert(0, '/private/tmp/ducky-pink-geometry')
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union
from shapely.affinity import scale

S = Path('scripts/bigger-pink')
A = Path('public/pixi-art/themes/pink')
X = A / 'expansion'
read = lambda p: json.loads(Path(p).read_text())
baseline = read(S / 'dense-before-layout.json')
layout = copy.deepcopy(baseline)
old = read(S / 'original-art.json')
world = read(S / 'original-world.json')
props, obstacles = layout['props'], layout['obstacles']
before = subprocess.check_output(['git', 'show', 'a9aa0f8a:scripts/bigger-pink/ground-body.svg'], text=True)
inner = before[before.index('<ns0:g'):]
# Reuse the exact proven curve and scalloped road geometry, without executing
# either earlier generator (which would overwrite the retained river data).
tree = ast.parse((S / 'communities.py').read_text())
functions = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('curve', 'sample', 'ribbon')], type_ignores=[])
exec(compile(functions, 'pink-road-functions', 'exec'))

# Move each seven-object household composition together, including its mailbox,
# washing and fence-post collision footprints. Each position is hand-authored.
addresses = {
    'ribbonwick': [(-200, 40), (330, -15), (880, -10), (1430, 50), (1970, 120), (50, 980), (570, 1000)],
    'melody': [(5500, -50), (6020, -150), (6550, -90), (7060, 70), (7340, 660)],
    'quay': [(8240, 1560), (8760, 1590), (9290, 1820), (9250, 2400), (8780, 2790), (8250, 2760)],
    'petalpatch': [(-1160, 2160), (-630, 2110), (-100, 2190), (-1130, 3180), (-600, 3250), (-60, 3200)],
    'tutu': [(3170, 5680), (3690, 5710), (4250, 5750), (4780, 5600), (5290, 5380)],
}
movements = []
for zone, points in addresses.items():
    homes = [p for p in props if p.get('household') and p['zone'] == zone]
    for home, (x, y) in zip(homes, points):
        start = int(home['id'].rsplit('-', 1)[1])
        dx, dy = x-home['x'], y-home['y']
        ids = {f'community-pink-{i}' for i in range(start, start+7)}
        for p in props:
            if p['id'] in ids:
                p['x'] += dx
                p['y'] += dy
        for o in obstacles:
            if any(o['name'] == name or o['name'].startswith(name+'-') for name in ids):
                o['x'] += dx
                o['y'] += dy
        # A larger family house anchors each green, beside the existing cottages.
        if start in (7, 73, 108, 163, 226):
            home['width'] *= 1.12
            home['height'] *= 1.08
            for o in obstacles:
                if o['name'] == home['id']:
                    o['rx'] *= 1.12
                    o['ry'] *= 1.12
        movements.append(dict(id=home['id'], zone=zone, before=[x-dx,y-dy], after=[x,y]))

# One through road. Sand is 160 wide, its raised turf bank takes 192 in total.
# Residential lanes are 72-104 wide including banks, rather than extra circuits.
main = copy.deepcopy(baseline['paths'][0])
main[-4:-1] = [[-450,3690],[-1640,2820],[-1450,1660]]
lanes = [
    [[-200,310],[350,280],[900,300],[1470,330],[1950,380],[2170,470],[2272,568]],
    [[700,650],[650,870],[570,1240],[50,1220]],
    [[1100,610],[1311,809],[1200,1300]],
    [[5500,215],[6020,160],[6550,205],[7060,350],[7340,880],[7100,850]],
    [[5425,553],[5540,430],[5750,500]],
    baseline['paths'][2],
    [[8240,1790],[8660,1850],[9010,1970],[9290,2070],[9250,2640],[8780,3020],[8250,2990],[8200,3250]],
    baseline['paths'][3],
    [[8410,1010],[8530,1340],[8360,1780]],
    [[-1610,2420],[-1160,2390],[-630,2360],[-100,2420],[-280,2640],[-650,2820]],
    [[-1130,3410],[-600,3480],[-60,3430],[150,3540]],
    baseline['paths'][5],
    [[3170,5920],[3690,5950],[4250,5990],[4780,5840],[5290,5620],[4840,5690]],
    baseline['paths'][4],
    baseline['paths'][6],
    [[8650,2300],[9110,2510],[9560,2850]],
]
paths = [main] + lanes
widths = [192] + [104,96,96,104,88,104,104,104,88,96,96,104,96,104,96,96]
roadsets = [(p, width, i*.9) for i,(p,width) in enumerate(zip(paths,widths))]
def denseRibbon(pts,width,phase=0,inset=0):
    d,s,left,right=ribbon(pts,width,phase,inset)
    if pts[0]==pts[-1]:return d,s,left,right
    def cap(center,tangent,a,b,sign):
        dx,dy=tangent; length=math.hypot(dx,dy) or 1; dx/=length;dy/=length
        nx,ny=-dy,dx; radius=(math.dist(center,a)+math.dist(center,b))/2
        return [[center[0]+sign*(nx*math.cos(i*math.pi/7)+dx*math.sin(i*math.pi/7))*radius,
                 center[1]+sign*(ny*math.cos(i*math.pi/7)+dy*math.sin(i*math.pi/7))*radius] for i in range(1,7)]
    end=cap(s[-1],(s[-1][0]-s[-2][0],s[-1][1]-s[-2][1]),left[-1],right[-1],1)
    start=cap(s[0],(s[1][0]-s[0][0],s[1][1]-s[0][1]),left[0],right[0],-1)
    return curve(left+end+right[::-1]+start),s,left,right
roadArt = [denseRibbon(*r) for r in roadsets]
layout['paths'], layout['pathWidths'] = paths, widths

# Existing peripheral river crossings stay in place as pedestrian green paths.
# Short stepping-stone approaches replace the removed continuous shore road.
greenWalks = [
    [[8200,3250],[8550,3710],baseline['riverCrossings'][9]['mid'],[7980,4320],[7680,4470]],
    [[1280,4510],[1020,4950],baseline['riverCrossings'][10]['mid'],[1800,5480],[2200,5560]],
]

def newprop(src, x, y, zone, width, height, rx=0, ry=0):
    p = dict(id=f'dense-pink-{len(props)}', src=src, x=x, y=y, zone=zone,
             width=width, height=height, scale=1, anchor=dict(x=.5,y=1), shadow=False)
    props.append(p)
    if rx:
        obstacles.append(dict(name=p['id'],x=x,y=y-ry*.3,rx=rx,ry=ry))
    return p

def kit(name,x,y,zone,k=1,solid=False):
    p = copy.deepcopy(next(p for p in old['props'] if p['src']==f'detail/{name}.svg'))
    p.update(id=f'dense-pink-{len(props)}',x=x,y=y,zone=zone)
    p['scale'] *= k
    props.append(p)
    if solid:
        obstacles.append(dict(name=p['id'],x=x,y=y-8,rx=16,ry=13))
    return p

# Small shared well, broad rim and heart spindle in Pink's existing drawing kit.
(X/'shared-well.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" width="180" height="190" viewBox="0 0 180 190"><g stroke="#805c72" stroke-width="3" stroke-linejoin="round"><ellipse cx="90" cy="171" rx="75" ry="15" fill="#81ad3c" opacity=".3"/><path d="M22 128V153Q90 190 158 153V128" fill="#e9a9bc"/><path d="M25 140Q90 173 155 140M60 149v23m57-23v23" fill="none"/><ellipse cx="90" cy="125" rx="71" ry="25" fill="#fff0c7"/><ellipse cx="90" cy="125" rx="48" ry="14" fill="#6ec9de"/><path d="M36 116V53M144 116V53" stroke="#a37a59" stroke-width="9"/><path d="M12 54L90 10L168 54Z" fill="#cbb6df"/><path d="M21 54H159M47 38l43-24 43 24" fill="none" stroke="#fff0c7" stroke-width="5"/><path d="M39 80H146M91 80v42" stroke="#a37a59" stroke-width="5"/><path d="M74 117l5 23h24l5-23Z" fill="#f5a3c7"/><path d="M84 8q-15-20-23-6q-6 10 23 24q29-14 23-24q-8-14-23 6Z" fill="#f5a3c7"/></g></svg>''')
newprop('expansion/shared-well.svg',1160,470,'ribbonwick',155,164,48,22)
newprop('expansion/shared-well.svg',-320,3050,'petalpatch',145,153,43,20)
newprop('expansion/washing-line.svg',6650,10,'melody',240,107)
newprop('expansion/washing-line.svg',8870,1610,'quay',240,107)

# Planted edges and shared orchard/work gardens occupy former road shoulders.
# Each tuple is an authored scene placement, not generated land fill.
for name,x,y,zone,k in [
    ('heart-hedge',-50,340,'ribbonwick',.7),('heart-hedge',490,310,'ribbonwick',.7),
    ('heart-hedge',1040,330,'ribbonwick',.7),('heart-hedge',1600,380,'ribbonwick',.7),
    ('tree-cherry',-610,-240,'ribbonwick',1.04),('tree-cherry',-80,-510,'ribbonwick',.86),
    ('tree-cherry',480,-540,'ribbonwick',1.04),('tree-cherry',1010,-560,'ribbonwick',.82),
    ('tree-cherry',1690,-480,'ribbonwick',.87),('flowers-pink',-260,650,'ribbonwick',1.1),
    ('tree-cherry',5700,-560,'melody',.91),('tree-cherry',6210,-600,'melody',1.02),
    ('tree-cherry',6730,-510,'melody',.85),('heart-hedge',5700,260,'melody',.7),
    ('heart-hedge',6250,200,'melody',.7),('heart-hedge',6800,290,'melody',.7),
    ('heart-hedge',8410,1830,'quay',.65),('heart-hedge',8950,1850,'quay',.65),
    ('tree-willow',9400,1300,'quay',.82),('flowers-pink',9060,2790,'quay',1.25),
    ('heart-hedge',-925,2410,'petalpatch',.65),('heart-hedge',-385,2390,'petalpatch',.65),
    ('tree-cherry',-1550,2410,'petalpatch',.85),('tree-cherry',-1550,3100,'petalpatch',.82),
    ('flowers-pink',-1400,2970,'petalpatch',1.25),('flowers-pink',150,3080,'petalpatch',1.1),
    ('heart-hedge',3250,5990,'tutu',.65),('heart-hedge',3800,5970,'tutu',.65),
    ('heart-hedge',4350,5940,'tutu',.65),('tree-cherry',2850,6200,'tutu',.84),
    ('flowers-pink',4650,6380,'tutu',1.2),
]: kit(name,x,y,zone,k)

# Keep all water art byte-for-byte. Only the ground that preceded it changes.
waterStart = re.search(r'<path d="[^"]+" fill="#6ec9de"', before).start()
waterArt = before[waterStart:before.index('<ns0:g')]
assert waterArt.endswith('</g>')
waterArt = waterArt[:-4]
defs = before[:before.index('</defs>')+7]
defs = re.sub(r'<clipPath id="pink-roads">.*?</clipPath>', '', defs)
clip = ''.join(f'<path d="{d}"/>' for d,*_ in roadArt)
defs = defs.replace('</defs>',f'<clipPath id="pink-roads">{clip}</clipPath></defs>')
D = curve(layout['coast'])
ground = defs + f'<path d="{D}" fill="#8fc63c" stroke="#ade0e3" stroke-width="135"/><path d="{D}" fill="#8fc63c" stroke="#f9d3dc" stroke-width="82"/><g clip-path="url(#new-land)">'
# Broad irregular commons and a subtle botanical surface, under every garden.
for x,y,rx,ry in [(-450,300,1100,630),(1230,-70,1200,400),(6160,-250,1200,430),
                  (8860,2030,720,1020),(-790,2700,740,820),(3880,5900,1190,430),
                  (3000,-60,490,230),(6500,4430,700,270),(730,3820,620,430)]:
    pts=[[x-rx,y],[x-rx*.6,y-ry*.8],[x+rx*.25,y-ry],[x+rx,y-ry*.2],[x+rx*.65,y+ry*.7],[x-rx*.2,y+ry]]
    ground += f'<path d="{curve(pts)}" fill="#b5d953" opacity=".35"/>'
ground += f'<path d="{D}" fill="url(#rose-grass)"/>'

gardenArt = ''
for p in [p for p in props if p.get('household')]:
    x,y=p['x'],p['y']
    garden=[[x-258,y+25],[x-210,y-25],[x+205,y-15],[x+270,y+70],[x+255,y+220],[x-245,y+218]]
    gardenArt += f'<path d="{curve(garden)}" fill="#a4cd4c" stroke="#81ad3c" stroke-width="3"/>'
    gardenArt += f'<path d="M{x-26} {y+15}Q{x+15} {y+100} {x-30} {y+240}l64 0Q{x+60} {y+100} {x+25} {y+15}Z" fill="#e9d1a2"/>'
    for yy,xx in [(70,-5),(118,8),(170,-6),(215,3)]:
        gardenArt += f'<ellipse cx="{x+xx}" cy="{y+yy}" rx="24" ry="10" fill="#fcebd6" stroke="#c0aa85" stroke-width="2"/>'
    for dx in [-175,150]:
        gardenArt += f'<path d="M{x+dx-43} {y+105}q38-24 82 0l-6 50q-35 18-77-1Z" fill="#b9956e" stroke="#8b8052" stroke-width="2"/>'
        for ox,oy in [(-20,118),(7,128),(24,114),(-10,147)]:
            gardenArt += f'<path d="M{x+dx+ox} {y+oy}v-10m0 5q-12-7-13-2m13 0q11-9 13-4" stroke="#60843d" stroke-width="2" fill="none"/><circle cx="{x+dx+ox}" cy="{y+oy-11}" r="4" fill="#f5a3c7"/>'
ground += gardenArt

# Work gardens: growing roses for the tailors, herbs for the quay's bakers,
# nursery propagation rows and seaside costume-dye flowers. No new attractions.
for x,y,rx,ry,flower in [(2810,-80,480,220,'#f5a3c7'),(9100,1050,230,170,'#fcebd6'),
                        (-1390,1750,250,200,'#ec6fa8'),(1930,4800,280,170,'#cbb6df'),
                        (4780,6410,330,170,'#f5a3c7')]:
    pts=[[x-rx,y],[x-rx*.7,y-ry],[x+rx*.6,y-ry*.8],[x+rx,y+40],[x+rx*.4,y+ry],[x-rx*.8,y+ry*.6]]
    ground += f'<path d="{curve(pts)}" fill="#accb58" stroke="#7caa43" stroke-width="4"/>'
    for dy in [-70,0,70]:
        ground += f'<path d="M{x-rx*.72} {y+dy}Q{x} {y+dy+25} {x+rx*.72} {y+dy-10}" fill="none" stroke="#bd9d73" stroke-width="25" stroke-linecap="round"/>'
        for t in [-.55,-.28,0,.28,.55]:
            xx=x+rx*t; yy=y+dy
            ground += f'<path d="M{xx} {yy+8}v-22m0 12q-18-12-23-4m23 4q15-14 24-6" fill="none" stroke="#668d3c" stroke-width="3"/><circle cx="{xx}" cy="{yy-17}" r="8" fill="{flower}" stroke="#cd7ca6" stroke-width="2"/>'

# Paint complete layers across the whole network, so junctions merge cleanly.
for inset,color,stroke,sw in [(0,'#72993e','#496d31',6),(7,'#b09d68','none',0),(16,'#f3d79f','none',0)]:
    for pts,width,phase in roadsets:
        rd=denseRibbon(pts,width,phase,inset)[0]
        ground += f'<path d="{rd}" fill="{color}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'
ground += '<g clip-path="url(#pink-roads)">'
for ri,(rd,s,left,right) in enumerate(roadArt):
    for i in range(3,len(s)-3,5):
        p,q=s[i],s[min(i+2,len(s)-1)]; dx,dy=q[0]-p[0],q[1]-p[1]
        dist=math.hypot(dx,dy) or 1; nx,ny=-dy/dist,dx/dist
        for off in [-.17,.19]:
            o=roadsets[ri][1]*off
            ground += f'<path d="M{p[0]+nx*o:.1f} {p[1]+ny*o:.1f}l{dx:.1f} {dy:.1f}" stroke="#b69b70" stroke-width="3" opacity=".38" stroke-linecap="round"/>'
        ground += f'<ellipse cx="{p[0]+nx*12:.1f}" cy="{p[1]+ny*12:.1f}" rx="15" ry="5" fill="#fff0cf" opacity=".55"/>'
        ex,ey=left[i] if i%2 else right[i]
        ground += f'<path d="M{ex-7:.1f} {ey:.1f}q2-8 10-7l6 6-4 5-10 1Z" fill="#b8ad91" stroke="#8f8d6e" stroke-width="1.6"/>'
ground += '</g>'
for rd,s,left,right in roadArt:
    for side in [left,right]:
        for i in range(2,len(side)-2,6):
            x,y=side[i]
            ground += f'<path d="M{x-9:.1f} {y:.1f}q-5-10 0-14q8 2 9 9q0-15 7-17q7 8 3 15q12-8 16-3l-10 11" fill="#8fc63c" stroke="#6d9b3c" stroke-width="1.6"/>'

# Civic greens stay at their existing named centres, with a small paved apron
# beside each workplace and a common lawn rather than a fully paved square.
for p in layout['places']:
    x,y=p['x'],p['y']
    pts=[[x-320,y],[x-200,y-145],[x+160,y-170],[x+350,y+15],[x+130,y+195],[x-230,y+150]]
    ground += f'<path d="{curve(pts)}" fill="#aad24b" stroke="#82ae3f" stroke-width="3"/>'
    apron=[[x-210,y+65],[x-155,y+20],[x+135,y+18],[x+210,y+60],[x+150,y+110],[x-160,y+115]]
    ground += f'<path d="{curve(apron)}" fill="#f7dfaf"/>'

for pts in greenWalks:
    s=sample(pts)
    for i in range(0,len(s),2):
        x,y=s[i]
        ground += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="21" ry="10" fill="#fcebd6" stroke="#b9b78b" stroke-width="2"/>'
ground += waterArt + '</g>'
combined=ground+inner
(S/'ground-body.svg').write_text(combined)
(X/'ground-source.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="13200" height="9800" viewBox="-2600 -1900 13200 9800">{combined}</svg>')

# Area is a geometric union of complete road corridors, including turf banks,
# court aprons and household approaches, clipped to new dry land only.
protected=unary_union([Polygon(world['coast']).buffer(0)]+[scale(Point(x,y).buffer(1,40),rx,ry,origin=(x,y)) for x,y,rx,ry in world['islets']])
water=unary_union([Polygon(o['poly']).buffer(0) for o in layout['water']])
newDry=Polygon(layout['coast']).buffer(0).difference(protected).difference(water)
def areaMetric(data,sets,oldCourts=False):
    corridors=[]
    for r in sets:
        _,_,left,right=ribbon(*r)
        corridors.append(Polygon(left+right[::-1]).buffer(0).buffer(3 if not oldCourts else 5))
        if not oldCourts and r[0][0]!=r[0][-1]:
            # Include rounded lane caps in the conservative corridor measure.
            for point in (r[0][0],r[0][-1]):corridors.append(Point(point).buffer(r[1]*.65+3))
    for p in data['props']:
        if p.get('household'):
            corridors.append(LineString([(p['x'],p['y']+15),(p['x'],p['y']+240)]).buffer(32))
    for p in data['places']:
        x,y=p['x'],p['y']
        if oldCourts:
            rx,ry=(330,190) if p['id']=='quay' else (400,205)
            corridors.append(scale(Point(x,y).buffer(1,40),rx,ry,origin=(x,y)))
        else:
            corridors.append(Polygon([(x-210,y+30),(x+210,y+30),(x+210,y+115),(x-210,y+115)]))
    covered=unary_union(corridors).intersection(newDry)
    return dict(area=round(covered.area),newDryLandArea=round(newDry.area),percent=round(100*covered.area/newDry.area,2))
oldSets=[(p,300 if i==0 else 210 if i<7 else 155,i*.9) for i,p in enumerate(baseline['paths'])]+[(baseline['shoreWalk']+[baseline['shoreWalk'][0]],155,.7)]
metrics=dict(before=areaMetric(baseline,oldSets,True),after=areaMetric(layout,roadsets),
             method='Union of sampled variable-width road silhouettes including raised banks and 3/5-unit outline, household approaches and civic paving, intersected with expanded coast minus original dry land/islets and fixed river polygons. Curved civic paving conservatively bounded. SVG curve sampling ~55 world units.',
             mainRoadSandWidth=160,mainRoadWithBanks=192,laneWithBanks=[88,104],
             householdMoves=movements,retainedRivers=len(layout['water']),retainedNewCrossings=len(layout['riverCrossings']))
metrics['communities'] = []
for place in layout['places']:
    zone=place['id']; x,y=place['x'],place['y']
    def distances(data):
        homes=[p for p in data['props'] if p.get('household') and p['zone']==zone]
        return round(sum(math.dist((p['x'],p['y']),(x,y)) for p in homes)/len(homes),1)
    metrics['communities'].append(dict(id=zone,name=place['name'],households=len(addresses[zone]),meanDistanceToGreenBefore=distances(baseline),meanDistanceToGreenAfter=distances(layout)))
layout['roadArt']=dict(style='single rose-sand road, narrow domestic lanes, raised turf lips, ruts, edge pebbles, planted commons',routes=len(roadsets),densityMetrics=metrics)
layout['greenWalks']=greenWalks
(S/'layout.json').write_text(json.dumps(layout,indent=1)+'\n')
(S/'dense-metrics.json').write_text(json.dumps(metrics,indent=2)+'\n')
assert metrics['after']['percent']<25
for key in ('coast','places','water','bridges','decks','riverCrossings','bridgeAudit','streams'):
    assert layout[key]==baseline[key], 'Preserve '+key
print(json.dumps({k:metrics[k] for k in ('before','after','mainRoadSandWidth')},indent=2))
