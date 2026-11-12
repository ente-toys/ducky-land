"""Fair adaptation of Home's sampled-curve / buffered-union surface recipe.

Only ground SVGs are written here. Props, water physics, bridges and residents
are inputs. All terrain is assembled before slicing, never masked over old art.
"""
import ast, json, math, sys, heapq, os
from pathlib import Path
try:
    import shapely
except ModuleNotFoundError:
    sys.path.insert(0, os.environ.get('DUCKY_GEOMETRY_PYTHON', '/private/tmp/ducky-community-python'))
    import shapely
from shapely.geometry import LineString, Polygon, Point, box, mapping
from shapely.ops import unary_union, nearest_points
from shapely import affinity, contains_xy

source = ast.parse(Path('scripts/home-review/paths.py').read_text())
for node in source.body:
    if isinstance(node, ast.FunctionDef) and node.name in ('sample', 'path'):
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'scripts/home-review/paths.py', 'exec'))

payload=json.load(sys.stdin)
art, world, walk, layout, routes=[payload[k] for k in ('art','world','walk','layout','routes')]
A=Path('public/pixi-art/themes/fair')
def P(q): return [3570+(q[0]-768)*4.3,2220+(q[1]-520)*3.8]
def ellipse(x,y,rx,ry): return affinity.scale(Point(x,y).buffer(1,quad_segs=32),rx,ry)
def shape(s):
    if 'poly' in s:return Polygon(s['poly']).buffer(0)
    if all(k in s for k in ('x','y','rx','ry')):return ellipse(s['x'],s['y'],s['rx'],s['ry'])
    return Polygon()
def polygons(g):
    if g.is_empty:return []
    if g.geom_type=='Polygon':return [g]
    return [p for q in g.geoms for p in polygons(q)]
def svgpath(g):
    pp=polygons(g)
    return path(unary_union(pp)) if pp else ''
coast=Polygon(world['coast']).buffer(0)
wet=unary_union([shape(s) for s in world['water']]).buffer(65,quad_segs=12).buffer(-65,quad_segs=12)
decks=unary_union([LineString([b['a'],b['b']]).buffer(b['w']/2+4,quad_segs=12) for b in world['walkways']])
contacts=[]
for p in art['props']:
    name=p.get('src','').split('/')[-1]
    width=p['width']*p.get('scale',1)
    if name.startswith(('tree-','bush-')):
        f=p.get('footprint') or next(iter(p.get('footprints',[])),None)
        rx=min(width*.22,(f or {}).get('rx',width*.12))
        contacts.append(ellipse(p['x'],p['y']-4,max(12,rx),14))
    elif name.startswith(('flower','flowers','grass-tuft')):
        contacts.append(ellipse(p['x'],p['y']-6,width*.3,14))
solids=unary_union([shape(s) for s in walk['obstacles']]).buffer(0)
plant_contacts=unary_union(contacts)
bench_ids={p['id'] for p in art['props'] if p.get('pavingFeet')}
paint_solids=unary_union([shape(s) for s in walk['obstacles'] if s.get('name',s.get('id')) not in bench_ids]).buffer(0)
paint_obstacles=unary_union([paint_solids,plant_contacts])
obstacles=unary_union([solids,plant_contacts])
route_reserves=unary_union([
    Point(s['x'],s['y']+(6 if s.get('sleeper') else 8)).buffer((s['rx']/.9 if s.get('sleeper') else s['rx'])+100)
    for s in walk['obstacles']
    if str(s.get('name','')).startswith('fair-plant-') or s.get('sleeper')
])
kite_reserves=unary_union([Point(k['x'],k['y']).buffer(165) for k in art.get('kites',[])])
dry=coast.difference(wet.buffer(20)).union(decks)

allowed={}
contact_mode=True
def space(width):
    key=(width,contact_mode)
    if key not in allowed:
        area=dry.buffer(-width/2-3).difference(solids.buffer(width/2+9)).difference(route_reserves).difference(kite_reserves)
        allowed[key]=area.difference(plant_contacts.buffer(10)) if contact_mode else area
        shapely.prepare(allowed[key])
    return allowed[key]
step=12
cache={}
def valid(q,width):
    key=(width,contact_mode,*q)
    if key not in cache:cache[key]=bool(contains_xy(space(width),q[0]*step,q[1]*step))
    return cache[key]
def snap(pt,width):
    q=tuple(round(v/step) for v in pt)
    for radius in range(16):
        cells=[(q[0]+dx,q[1]+dy) for dx in range(-radius,radius+1) for dy in range(-radius,radius+1) if max(abs(dx),abs(dy))==radius]
        cells.sort(key=lambda c:math.dist(pt,[v*step for v in c]))
        for c in cells:
            if valid(c,width):return c
    raise ValueError(f'No full-width landing at {pt}')
def detour(a,b,width):
    area=space(width)
    if area.covers(LineString([a,b])):return [a,b]
    start,end=snap(a,width),snap(b,width)
    todo=[(math.dist(start,end),0,start)];cost={start:0};prev={};seen=set()
    while todo:
        _,g,c=heapq.heappop(todo)
        if c in seen:continue
        seen.add(c)
        if c==end:break
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)):
            n=(c[0]+dx,c[1]+dy)
            if not valid(n,width):continue
            if dx and dy and (not valid((c[0]+dx,c[1]),width) or not valid((c[0],c[1]+dy),width)):continue
            ng=g+math.hypot(dx,dy)
            if ng<cost.get(n,1e20):
                cost[n]=ng;prev[n]=c;heapq.heappush(todo,(ng+math.dist(n,end),ng,n))
        if len(seen)>200000:raise ValueError(f'Unreachable corridor {a} -> {b}')
    if end not in cost:raise ValueError(f'Unreachable corridor {a} -> {b}')
    q=[end]
    while q[-1]!=start:q.append(prev[q[-1]])
    q=[list(map(lambda v:v*step,c)) for c in reversed(q)]
    compact=[q[0]];i=0
    while i<len(q)-1:
        j=len(q)-1
        while j>i+1 and not area.covers(LineString([q[i],q[j]])):j-=1
        compact.append(q[j]);i=j
    return [a,*compact,b]

def fit(points,width):
    points=[list(p) if space(width).covers(Point(p)) else list(nearest_points(space(width),Point(p))[0].coords[0]) for p in points]
    desired=sample(points)
    if space(width).covers(LineString(desired)):return desired
    q=[]
    for a,b in zip(points,points[1:]):
        leg=detour(a,b,width)
        q.extend(leg[:-1])
    q.append(points[-1])
    for _ in range(5):
        trial=sample(q)
        if space(width).covers(LineString(trial)):return trial
        q=[p for a,b in zip(q,q[1:]) for p in [a,[(a[0]+b[0])/2,(a[1]+b[1])/2]]]+[q[-1]]
    return q

def fit_bridged(points,width):
    chunks=[];pending=[]
    def ground(points):return list(LineString(fit(points,width)).simplify(.15).coords)
    for i,p in enumerate(points):
        if not isinstance(p,dict):pending.append(p);continue
        b=next(b for b in world['walkways'] if b['id']==p['bridge'])
        a,z=b['a'],b['b']
        if pending and math.dist(pending[-1],z)<math.dist(pending[-1],a):a,z=z,a
        length=math.dist(a,z);u=[(z[k]-a[k])/length for k in (0,1)]
        def bank(end,sign):
            for length in range(180,-1,-3):
                at=[end[k]+u[k]*sign*length for k in (0,1)]
                if space(width).covers(Point(at)):return at
            return list(nearest_points(space(width),Point(end))[0].coords[0])
        before=bank(a,-1) if pending else a
        after=bank(z,1)
        pending.append(before)
        if len(pending)>1:chunks.extend(ground(pending))
        else:chunks.extend(pending)
        chunks.extend([before,a,z,after]);pending=[after]
    if len(pending)>1:chunks.extend(ground(pending))
    return chunks if chunks else ground(pending)

resolved=[]
for r in routes:
    points=r['points']
    if r.get('attachStart'):
        parent=next(s for s in resolved if s['id']==r['attachStart'])
        line=LineString(parent['samples']);p=line.interpolate(line.project(Point(points[0])))
        points=[[p.x,p.y],*points[1:]]
    if r.get('attachEnd'):
        parent=next(s for s in resolved if s['id']==r['attachEnd'])
        line=LineString(parent['samples']);p=line.interpolate(line.project(Point(points[-1])))
        points=[*points[:-1],[p.x,p.y]]
    if r.get('attach'):
        parent=next(s for s in resolved if s['id']==r['attach'])
        line=LineString(parent['samples']);p=line.interpolate(line.project(Point(points[0])))
        points=[[p.x,p.y],points[0]]
    contact_mode=True
    try:
        fitted=LineString(fit_bridged(points,r['width']))
    except ValueError:
        contact_mode=False
        fitted=LineString(fit_bridged(points,r['width']))
    resolved.append(dict(id=r['id'],width=r['width'],samples=[[round(x,1),round(y,1)] for x,y in fitted.coords]))

pads=[Polygon([P(p) for p in c['points']]).buffer(0) for c in layout['polygons']['clearings']]
pads.append(ellipse(*P([768,840]),780,360))
shapes=[LineString(r['samples']).buffer(r['width']/2,quad_segs=10) for r in resolved]+pads
for b in world['walkways']:
    dx=b['b'][0]-b['a'][0];dy=b['b'][1]-b['a'][1];length=math.hypot(dx,dy)
    for end,sign in ((b['a'],-1),(b['b'],1)):
        beyond=[end[0]+sign*dx/length*100,end[1]+sign*dy/length*100]
        shapes.append(LineString([end,beyond]).buffer(b['w']/2+12,quad_segs=12))
merged=unary_union(shapes).buffer(65,quad_segs=12).buffer(-65,quad_segs=12)
bench_pads=[]
hill_pad=None
for p in art['props']:
    feet=p.get('pavingFeet')
    if not feet:continue
    xs,ys=zip(*feet)
    pad=box(min(xs)-7,min(ys)-7,max(xs)+7,max(ys)+7).buffer(10,quad_segs=8)
    a,b=nearest_points(pad,merged)
    if a.distance(b)>240:raise ValueError('Isolated bench pad '+p['id'])
    if a.distance(b)>0:pad=pad.union(LineString([a,b]).buffer(24,quad_segs=8))
    bench_pads.append(pad)
    if p['id']=='fair-life-hill-bench':hill_pad=pad
merged=unary_union([merged,*bench_pads])
surface=merged.intersection(coast).difference(wet).difference(paint_obstacles.buffer(7))
surface=unary_union([p for p in polygons(surface) if p.area>120])

if hill_pad is not None:
    flat=next(p for p in art['flats'] if p.get('id')=='fair-bench-hill-paving')
    (A/flat['src']).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{flat["width"]}" height="{flat["height"]}" viewBox="{flat["x"]} {flat["y"]} {flat["width"]} {flat["height"]}"><path d="{svgpath(hill_pad.intersection(surface))}" fill="#F6DE95" fill-rule="evenodd"/></svg>')

land=coast.difference(wet)
lawn=coast.buffer(-95).difference(wet.buffer(17))
terrain=f'<defs><pattern id="fair-lawn-grain" width="177" height="139" patternUnits="userSpaceOnUse"><path d="M17 29l4 -7 5 8 M105 101l4 -8 5 7 M149 49l3 -6 5 7" fill="none" stroke="#729F39" stroke-width="2.6" opacity=".5"/><ellipse cx="67" cy="51" rx="10" ry="3" fill="#C3DE65" opacity=".7"/></pattern></defs>'
terrain+=f'<g data-name="Fair continuous terrain"><path d="{svgpath(land.buffer(24).intersection(coast.buffer(24)))}" fill="#A6E3DE"/><path d="{svgpath(land)}" fill="#FFF0AE"/><path d="{svgpath(lawn)}" fill="#9CC63E"/><path d="{svgpath(lawn)}" fill="url(#fair-lawn-grain)"/></g>'
terrain+=f'<g data-name="Fair unified paths"><path d="{svgpath(surface)}" fill="#F6DE95" fill-rule="evenodd"/></g>'
for o in layout['objects']:
    if not any(n in o['file'] for n in ('castle-islet-ground','plaza-ground','lagoon-lily')):continue
    content=(A/'ac2'/o['file']).read_text().split('>',1)[1].rsplit('</svg>',1)[0]
    asset=layout['assets'][o['file']]
    terrain+=f'<g transform="translate(3570 2220) scale(4.3 3.8) translate(-768 -520) translate({o["x"]} {o["y"]}) rotate({o.get("rotation",0)}) translate({-o["width"]/2} {-o["height"]}) scale({o["width"]/asset["width"]} {o["height"]/asset["height"]})">{content}</g>'
terrain=f'<defs><clipPath id="fair-dry-banks"><path d="{svgpath(land)}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#fair-dry-banks)">{terrain}</g>'
for t in art['ground']['tiles']:
    (A/t['src']).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{t["width"]}" height="{t["height"]}" viewBox="{t["x"]} {t["y"]} {t["width"]} {t["height"]}">{terrain}</svg>')
audit={'routes':resolved,'fill':'#F6DE95','widths':[128,104], 'surface':mapping(surface),'water':mapping(wet), 'land':mapping(land), 'tileCount':len(art['ground']['tiles']), 'propOverlapArea':round(surface.intersection(paint_obstacles).area,6)}
json.dump(audit,sys.stdout,separators=(',',':'))
