"""Rosybutton ground. Home geometry, one fully opaque cream path surface.

Only authored curves are sampled. No props, residents or planting are generated.
Requires Shapely 2: python3 -m pip install shapely
"""
import json, math, re, sys
from pathlib import Path
import xml.etree.ElementTree as ET
try:
    import shapely
except ImportError:
    sys.path.insert(0, '/private/tmp/ducky-community-python')
from shapely.geometry import Point, LineString, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

S=Path('scripts/rosy-ground'); A=Path('public/pixi-art/themes/pink'); D=Path('rive/web/themes/pink')
read=lambda p:json.loads(Path(p).read_text())
def write(p,v): Path(p).write_text(json.dumps(v,indent=1)+'\n')
art=read(A/'art.json'); world=read(D/'world.json'); walk=read(D/'walk-world.json')
source=read(S/'source-floor.json'); shore=read(S/'source-shore.json')

def curve(d):
    """Sample the absolute SVG pen vocabulary in the retained authored floor kit."""
    ts=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d)
    i=0; p=[0,0]; start=None; control=None; out=[]; cmd=None
    while i<len(ts):
        if ts[i].isalpha():cmd=ts[i];i+=1
        if cmd=='Z':
            if start is not None:out.append(start)
            p=start;cmd=None;continue
        n={'M':2,'L':2,'C':6,'S':4,'Q':4,'H':1,'V':1}[cmd]
        v=list(map(float,ts[i:i+n]));i+=n
        if cmd in ['M','L','H','V']:
            p=v if cmd in ['M','L'] else [v[0],p[1]] if cmd=='H' else [p[0],v[0]]
            out.append(p);control=None
            if cmd=='M':start=p;cmd='L'
            continue
        if cmd=='C': b,c,z=v[:2],v[2:4],v[4:]
        elif cmd=='S':b=[2*p[k]-(control or p)[k] for k in (0,1)];c,z=v[:2],v[2:]
        else:
            q,z=v[:2],v[2:];b=[p[k]+2*(q[k]-p[k])/3 for k in (0,1)];c=[z[k]+2*(q[k]-z[k])/3 for k in (0,1)]
        count=max(3,math.ceil((math.dist(p,b)+math.dist(b,c)+math.dist(c,z))/12))
        for j in range(1,count+1):
            t=j/count;u=1-t;out.append([u**3*p[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t**3*z[k] for k in (0,1)])
        p=z;control=c
    return out

def smooth(p,closed=False):
    if closed and p[0]==p[-1]:p=p[:-1]
    out=[];n=len(p)
    for i in range(n if closed else n-1):
        a=p[(i-1)%n] if closed or i else p[i];b=p[i];c=p[(i+1)%n];z=p[(i+2)%n] if closed or i+2<n else c
        steps=max(3,math.ceil(math.dist(b,c)/12))
        for j in range(steps):
            t=j/steps;u=1-t
            out.append([u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(z[k]-b[k])/6)+t**3*c[k] for k in (0,1)])
    return out+[p[0] if closed else p[-1]]

def svg(g):
    polygons=[g] if g.geom_type=='Polygon' else [p for p in g.geoms if p.geom_type=='Polygon']
    return ' '.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in r.coords)+'Z' for p in polygons for r in [p.exterior,*p.interiors])
def ellipse(x,y,rx,ry):return affinity.scale(Point(x,y).buffer(1,quad_segs=48),rx,ry)
def shape(s):
    if s['kind']=='path':g=Polygon(curve(s['d'])).buffer(0)
    elif s['kind']=='ellipse':g=ellipse(s['cx'],s['cy'],s['rx'],s['ry'])
    else:g=box(s['x'],s['y'],s['x']+s['width'],s['y']+s['height']).buffer(-s.get('rx',0)).buffer(s.get('rx',0),quad_segs=12)
    a,b,c,d,x,y=s['matrix'];return affinity.affine_transform(g,[a,c,b,d,x,y])

# One continuous water contour: generously clear the full 92-unit hull, including bends.
waters=[]; sailing=[]
for b in shore['brooks']:
    p=b['centre'][:]
    # Extend the final centreline through the coast and flare into the sea.
    a,z=p[-2:];v=[z[k]-a[k] for k in (0,1)];l=math.hypot(*v)
    p += [[z[k]+v[k]/l*180 for k in (0,1)],[z[k]+v[k]/l*420 for k in (0,1)]]
    pts=smooth(p);wet=LineString(pts).buffer(94,quad_segs=16)
    wet=wet.union(LineString(pts[-35:]).buffer(135,quad_segs=16))
    waters.append(wet);sailing.append({'id':b['id'],'samples':pts})
for p in shore['ponds']:waters.append(Polygon(smooth(p['poly'],True)).buffer(0))
pond={'x':5654.35,'y':1877.36,'rx':570,'ry':320}
waters.append(ellipse(pond['x'],pond['y'],pond['rx'],pond['ry']))
# An intentional eastern outflow, below the north pond walk, joining Willow Spring.
link=smooth([[6160,1877],[6500,1900],[6790,2000],[7070,2160],[7380,2250]])
waters.append(LineString(link).buffer(94,quad_segs=16));sailing.append({'id':'pond-outflow','samples':link})
wet=unary_union(waters).buffer(35,quad_segs=12).buffer(-35,quad_segs=12)
wetpolys=list(wet.geoms) if hasattr(wet,'geoms') else [wet]
waterdata=[]
for i,p in enumerate(wetpolys):
    x0,y0,x1,y1=p.bounds
    waterdata.append({'name':'Rosy continuous water '+str(i),'x':(x0+x1)/2,'y':(y0+y1)/2,'rx':(x1-x0)/2,'ry':(y1-y0)/2,'poly':list(p.exterior.coords)})
coast=Polygon(world['coast']).buffer(0)

# Retain the authored hamlet courts, replacing every travel corridor at Home widths.
routes=[];courts=[]
for s in source['pieces']:
    if not s.get('stroke'):
        if s['id']=='pink-close-harbor':continue # obsolete isolated oblong pad
        courts.append(shape(s));continue
    if s['role']!='road':
        pts=curve(s['d']);a,b,c,d,x,y=s['matrix'];pts=[[a*q[0]+c*q[1]+x,b*q[0]+d*q[1]+y] for q in pts]
    else:pts=curve(s['d'])
    if s['id'] in ['tutu-west','hamlet-tutu-tides-paths-29','hamlet-teacup-paths-30']:continue # redundant duplicate/stub paint
    if s['id'] in ['centre-0','centre-3']:continue # obsolete rear terrace stub and redundant garden diagonal
    if s['id']=='centre-6':pts=smooth([[1956,1834],[1835,2330],[1780,2670],[1680,2930],[1646,3191]])
    if s['id']=='centre-2':pts=list(reversed(smooth([pts[0],[3440,2720],[3470,2860]])))[:-1]+pts
    if s['id']=='centre-7':pts=list(reversed(smooth([pts[0],[4590,2830],[4520,2930]])))[:-1]+pts
    if s['id']=='willow-centre':pts=smooth([[6865,2778],[7100,2700],[7440,2650],[7840,2430],[8210,2430],[8550,2580]])
    if s['id']=='chirrup-east':pts=smooth([[6362,894],[6650,850],[6904,761]])
    if s['id']=='petalpatch-centre':pts=smooth([[1124,2736],[900,2780]])
    width=128 if s['id']=='promenade' else 104
    routes.append({'id':s['id'],'width':width,'samples':pts})

# Approved ribbon centre replaces the old offset terrace and its road tips.
B=read(S/'data/population.json'); C=read(S/'data/centre.json')
for join in C['pathJoins']:
    if join['id']=='ribbon-join-north-loop':continue
    route=min(routes,key=lambda r:math.dist(r['samples'][0],join['originalPathHead']))
    assert math.dist(route['samples'][0],join['originalPathHead'])<4, join['id']
    route['samples']=join['replacementPath']
hill=B['hill']['route']
routes.append({'id':hill['id'],'width':104,'samples':smooth(hill['points'])})
courts.append(ellipse(4000,2620,780,560))
lines=[LineString(r['samples']).buffer(r['width']/2,quad_segs=12) for r in routes]
for b in shore['crossings']:
    for p in [b['a'],b['b']]:lines.append(ellipse(*p,82,68))
merged=unary_union(lines+courts).buffer(85,quad_segs=12).buffer(-85,quad_segs=12).intersection(coast)
# Keep the existing heart lamps clear without moving or disabling their collisions.
lampcuts=[]
for p in art['props']:
    if False: # old terrace lamps retired by ribbon centre

        f=p.get('footprint') or next((o for o in world['obstacles'] if o.get('name')==p['id'] or abs(o.get('x',1e9)-p['x'])<2 and abs(o.get('y',1e9)-p['y'])<20),None)
        if f and not f.get('poly'):lampcuts.append(ellipse(f['x'],f['y'],f.get('rx',18)+20,f.get('ry',18)+20))
if lampcuts:merged=merged.difference(unary_union(lampcuts))
surface=merged.difference(wet).simplify(.35,preserve_topology=True)
pathfrag=f'<g data-name="Rosy unified paths"><path d="{svg(surface)}" fill="#FBE6C8" fill-rule="evenodd"/></g>'
waterfrag=f'<g data-name="Rosy unified water"><defs><clipPath id="rosy-bank-land"><path d="{svg(coast)}"/></clipPath></defs><path d="{svg(wet)}" fill="#F9D3DC" stroke="#E9A9BC" stroke-width="28" stroke-linejoin="round" clip-path="url(#rosy-bank-land)"/><path d="{svg(wet)}" fill="#6EC9DE"/></g>'
(S/'path-surface.svgfrag').write_text(pathfrag);(S/'water-surface.svgfrag').write_text(waterfrag)
write(S/'sampled-routes.json',routes);write(S/'sailing-routes.json',sailing)
# Exact destination throats, including the actual marina deck, never zone boxes.
court=unary_union(courts);unserved=[];crossings=[];ends=[]
for r in routes:
    line=LineString(r['samples'])
    for pt in [r['samples'][0],r['samples'][-1]]:
        p=Point(pt)
        targets=[(p.distance(LineString(q['samples']))-q['width']/2,q['id']) for q in routes if q is not r]
        targets.append((p.distance(court),'destination court'))
        if r['id']==hill['id']:targets.append((p.distance(Point(hill['points'][-1])),'stargazing south landing'))
        if r['id']=='marina':targets.append((p.distance(Point(9600,2850)),'authored marina deck'))
        distance,target=min(targets)
        if r['samples'][0]==r['samples'][-1]:
            distance,target=min((line.distance(LineString(q['samples']))-q['width']/2,q['id']) for q in routes if q is not r)
        record={'route':r['id'],'point':pt,'destination':target,'gap':max(0,distance-r['width']/2)};ends.append(record)
        if record['gap']>2:unserved.append(dict(record,type='unserved-throat'))
for i,r in enumerate(routes):
    for q in routes[i+1:]:
        hit=LineString(r['samples']).intersection(LineString(q['samples']))
        pts=[hit] if hit.geom_type=='Point' else list(hit.geoms) if hasattr(hit,'geoms') else []
        for p in pts:
            if p.geom_type=='Point' and all(p.distance(Point(e))>100 for e in [r['samples'][0],r['samples'][-1],q['samples'][0],q['samples'][-1]]):
                crossings.append({'type':'interior-X-crossing','routes':[r['id'],q['id']],'point':[p.x,p.y]})
write(S/'throat-report.json',{'unserved':unserved,'crossings':crossings,'ends':ends})

# Strip legacy travel paint, including the old protected centre, before replaying
# the SAME union on all overlapping ground crops. Landmark sprites are untouched.
def remove_groups(text,names):
    pattern=r'<g\b[^>]*data-name="(?:'+'|'.join(re.escape(n) for n in names)+r')"[^>]*>'
    while (m:=re.search(pattern,text)):
        depth=1;end=m.end()
        for g in re.finditer(r'<g\b[^>]*>|</g>',text[m.end():]):
            depth+=-1 if g.group().startswith('</') else 1
            if depth==0:end=m.end()+g.end();break
        text=text[:m.start()]+text[end:]
    return text
names=['Continuous footpaths','Rosy unified paths','Rosy unified water','Pond bank','Lake water','Harbour stalls (open stall row)','Road stalls (open stall row)',
       'Ribbon plaza','Cafe square','Festival square (open paved square)']
beach=(S/'source-shore.svg').read_text().split('<!-- Banks stop')[0]
beach=beach[beach.index('<!-- The old bathing beach'):]
master='<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2600 -1900 13200 9800">'+f'<defs><path id="pink-coast" d="{svg(coast)}"/><clipPath id="beach-land"><use href="#pink-coast"/></clipPath></defs>'+beach+pathfrag+waterfrag+'</svg>'
(A/'expansion/shore/shore-source.svg').write_text(master)
for t in art['ground']['tiles']:
    f=A/t['src'];text=f.read_text();opening=re.search(r'<svg\b[^>]*>',text).group()
    if t['src'].startswith('expansion/shore/'):
        text=opening+f'<defs><path id="pink-coast" d="{svg(coast)}"/><clipPath id="beach-land"><use href="#pink-coast"/></clipPath></defs>'+beach+'</svg>'
    else:
        text=remove_groups(text,names)
        # Legacy cream paint at 12% alpha reads as ghost roads in the grass.
        # Remove that overlay only; retain every green lawn/meadow contour.
        text=re.sub(r'<path\b(?=[^>]*data-name="Lawn Cream")[^>]*/>', '', text)
    # Crop the shared vector to each existing overlap/bleed rectangle. Geometry
    # outside the viewport cannot affect it, and no whole-island path is parsed
    # 176 times at duck zoom. The crop is outside the visible edge.
    crop=box(t['x']-20,t['y']-20,t['x']+t['width']+20,t['y']+t['height']+20)
    localpath=svg(surface.intersection(crop));localwet=svg(wet.intersection(crop))
    pf=f'<g data-name="Rosy unified paths"><path d="{localpath}" fill="#FBE6C8" fill-rule="evenodd"/></g>'
    wf=f'<g data-name="Rosy unified water"><defs><clipPath id="rosy-bank-land"><path d="{svg(coast.intersection(crop))}"/></clipPath></defs><path d="{localwet}" fill="#F9D3DC" stroke="#E9A9BC" stroke-width="28" stroke-linejoin="round" clip-path="url(#rosy-bank-land)"/><path d="{localwet}" fill="#6EC9DE"/></g>' if localwet else ''
    text=text.replace('</svg>',pf+wf+'</svg>')
    f.write_text(text)
(A/'expansion/merged/unified-paths.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2600 -1900 13200 9800">'+pathfrag+'</svg>')
# Remove only the unused floor pad; keep all decorated destination overlays.
retired={'pink-close-harbor','path-joins','hamlet-tutu-tides-court','hamlet-teacup-court','pink-close-cafe','pink-close-festival'}
art['flats']=[p for p in art['flats'] if p.get('id') not in retired]
# The travel union already owns every court and all six plaza throats. Do not
# replay the old yellow join painter or the inset multicolour court duplicates.
C['floorTiles']=[p for p in C['floorTiles'] if p['id']!='path-joins']
write(S/'data/centre.json',C)
write(A/'ribbon-centre/placements.json',C)
(A/'ribbon-centre/path-joins.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="2040" height="1520" viewBox="-1020 -760 2040 1520"><title>Road throats are part of the opaque unified surface</title></svg>')
for p in source['pieces']:
    f=A/('expansion/merged/floor-detail-'+p['id']+'.svg')
    if p['id'] in retired and f.exists():
        opening=re.search(r'<svg\b[^>]*>',f.read_text()).group()
        f.write_text(opening+'<title>Court is part of the opaque unified surface</title></svg>')
# Keep the workshop's authored doorstep silhouette, with no second inset shade.
f=A/'hamlets/ribbonwick/workshop-apron.svg';text=f.read_text()
outer=re.search(r'<path\b[^>]*/>',text).group()
outer=re.sub(r'fill="[^"]+"','fill="#FBE6C8"',outer)
f.write_text(re.search(r'<svg\b[^>]*>',text).group()+outer+'</svg>')
for target in [world,walk]:
    target['water']=waterdata;target['boatWater']=[w['poly'] for w in waterdata]
    target['paths']=[r['samples'] for r in routes];target['pathWidths']=[r['width'] for r in routes]
    target['routeSystem']={'main':128,'lane':104,'palette':{'surface':'#FBE6C8'},'oneUnion':True}
harbor=read(D/'harbor.json');harbor['jetty']['art']='expansion/shore/marina-pier.svg';write(D/'harbor.json',harbor)
write(A/'art.json',art);write(D/'world.json',world);write(D/'walk-world.json',walk)
layout=read('scripts/bigger-pink/layout.json')
layout.update(paths=world['paths'],pathWidths=world['pathWidths'],shoreWalk=next(r['samples'] for r in routes if r['id']=='promenade'),routeSystem=world['routeSystem'],water=waterdata)
layout['streams']=[{'name':b['name'],'points':b['centre'],'width':188} for b in shore['brooks']]
write('scripts/bigger-pink/layout.json',layout)
write(S/'surface-report.json',{'routes':len(routes),'widths':[104,128],'waterComponents':len(wetpolys),'waterBounds':wet.bounds,'pathArea':surface.area,'noInternalOutlines':True,'retainedPalette':['#FBE6C8']})
print('Rosy ground:',len(routes),'routes, one path union,',len(wetpolys),'connected water contours')
