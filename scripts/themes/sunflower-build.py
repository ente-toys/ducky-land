# Sunflower island (theme `sunflower`): builds the whole island from one layout.
#   ground tiles + jetty decks + art.json   -> public/pixi-art/themes/sunflower/
#   world.json + walk-world.json + harbor.json -> assets/world/themes/sunflower/
#   preview.png (globe) + a full preview beside the concept -> concepts/themes/sunflower-preview.png
# Follows concepts/themes/THEME-CONTRACT.md. Layout is written in the CONCEPT's pixel space (01-sunflower.png,
# 1536x1024) and mapped to world units by T(), so it can be read against the concept image directly.
# venv: python3.11 -m venv vt && vt/bin/pip install vtracer cairosvg pillow numpy scipy shapely
# usage: vt/bin/python scripts/themes/sunflower-build.py [--no-preview]
import json, math, os, sys, io, random, re
import numpy as np
from shapely.geometry import Polygon, Point, LineString, MultiPolygon
from shapely.ops import unary_union

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes/sunflower')
DATA = os.path.join(ROOT, 'assets/world/themes/sunflower')
CONCEPTS = os.path.abspath(os.path.join(ROOT, '..', 'concepts/themes'))
os.makedirs(DATA, exist_ok=True)
WIDTH, HEIGHT = 8000, 5600   # boss 6 Nov: bigger and spacious, ~1.8x home's land
TCOLS, TROWS = 6, 4
TW, TH = 1334, 1400
H = 130   # one standing Ducky

SX, SY, OX, OY = 5.0, 5.55, 120, 0
def T(p): return (round(OX + p[0] * SX, 1), round(OY + p[1] * SY, 1))
def TL(ps): return [T(p) for p in ps]

# ---------------------------------------------------------------- layout (concept pixels)
COAST = [(300,250),(380,232),(470,236),(540,208),(600,196),(670,192),(745,176),(830,140),(930,116),(1030,118),(1100,138),
         (1190,152),(1280,146),(1380,112),(1468,78),(1452,165),(1424,240),(1402,330),(1392,420),(1376,485),(1338,545),(1322,600),
         (1296,655),(1190,668),(1102,684),(1052,712),(1000,738),(940,756),(860,774),(780,800),(700,816),(620,836),(530,856),
         (440,846),(350,812),(250,772),(172,722),(112,662),(82,600),(80,522),(100,452),(130,384),(172,322),(232,282)]
ISLETS_C = [(222,168,112,68), (1122,846,148,76)]
BEACH = [(985,712),(1000,648),(1070,592),(1170,560),(1270,556),(1330,600),(1330,660),(1250,690),(1150,690),(1060,712)]
YARD = [(812,262),(845,205),(930,182),(1060,186),(1180,196),(1238,232),(1226,290),(1120,312),(990,318),(880,306)]
POND = (292,402,94,50)
PLAZA = (752,470,228,120)
# fields: curved bands like the concept. Each field is a spine curve; its rows run parallel to it (offset by ROW_GAP),
# clipped clear of paths, plaza, yard and shore. The bed is the union of its rows.
FIELDS = {
  'north': dict(spine=[(436,384),(510,334),(596,302),(706,290)], rows=5),
  'west':  dict(spine=[(352,496),(446,514),(530,550),(600,602)], rows=4),
  'south': dict(spine=[(570,752),(656,722),(748,676),(846,632)], rows=4),
  'tip':   dict(spine=[(1256,286),(1318,246),(1372,198),(1406,160)], rows=3),
}
MAIN_W, SIDE_W = 210, 165   # path widths in world units (home: 105; boss 6 Nov: at least 1.5x)
PATHS = [   # (points, width)
  ([(738,372),(722,318),(748,268),(800,246),(860,252)], MAIN_W),                                  # plaza -> farm
  ([(884,388),(930,336),(990,306)], SIDE_W),                                                      # plaza -> farm east gate
  ([(944,458),(1020,446),(1110,452),(1200,458),(1290,444),(1350,386),(1402,330)], MAIN_W),        # plaza -> market -> east jetty
  ([(904,556),(950,602),(992,654),(1022,736)], MAIN_W),                                           # plaza -> beach -> SE bridge
  ([(558,452),(482,432),(404,426),(336,456),(232,458),(160,462),(98,466)], MAIN_W),               # plaza -> pond -> west jetty
  ([(296,264),(360,300),(420,352),(470,410),(486,432)], SIDE_W),                                  # NW bridge -> pond path
  ([(360,300),(450,258),(560,240),(660,244),(748,268)], SIDE_W),                                  # top lane over the north field
  ([(642,572),(600,624),(540,668),(460,704),(380,742),(300,772),(276,800)], MAIN_W),              # plaza -> south-west harbor
  ([(850,578),(872,642),(900,700),(960,736),(1022,736)], SIDE_W),                                 # plaza -> south lane
  ([(1180,300),(1250,316),(1302,346),(1340,388)], SIDE_W),                                        # farm -> east
  ([(640,740),(700,790),(702,812)], SIDE_W),                                                      # south jetty spur
  ([(540,668),(640,740)], SIDE_W),
]
# jetties and islet bridges (concept coords): foot on land, tip
DECKS_C = {
  'jetty-sw':  ((276,792),(270,884), 112),   # the harbor
  'jetty-w':   ((106,466),(52,466), 104),
  'jetty-e':   ((1396,330),(1488,330), 104),
  'jetty-s':   ((702,806),(702,872), 104),
  'bridge-nw': ((300,268),(256,224), 112),
  'bridge-se': ((1022,730),(1052,786), 112),
}

# ---------------------------------------------------------------- helpers
def catmull(pts, closed=False, n=10):
    P = list(pts); out = []
    if closed: P = [P[-1]] + P + [P[0], P[1]]
    else: P = [P[0]] + P + [P[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i-1], P[i], P[i+1], P[i+2]))
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t*t, t*t*t
            out.append(tuple(.5 * ((2*p1) + (-p0+p2)*t + (2*p0-5*p1+4*p2-p3)*t2 + (-p0+3*p1-3*p2+p3)*t3)))
    if not closed: out.append(tuple(P[-2]))
    return out

def bez(pts, closed=False):
    """smooth cubic path through points (Catmull-Rom as Bezier)"""
    P = list(pts); n = len(P)
    get = (lambda i: P[i % n]) if closed else (lambda i: P[max(0, min(n-1, i))])
    d = f'M {P[0][0]:.1f} {P[0][1]:.1f}'
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = get(i-1), get(i), get(i+1), get(i+2)
        c1 = (p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6); c2 = (p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6)
        d += f' C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}'
    return d + (' Z' if closed else '')

def polyd(ps): return 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in ps) + ' Z'
def shp_d(g):
    gs = g.geoms if hasattr(g, 'geoms') else [g]; d = ''
    for p in gs:
        if p.is_empty or p.geom_type != 'Polygon': continue
        d += polyd(list(p.exterior.coords)[:-1]) + ' '
        for r in p.interiors: d += polyd(list(r.coords)[:-1]) + ' '
    return d
def ell_pts(cx, cy, rx, ry, n=72): return [(cx + rx*math.cos(t), cy + ry*math.sin(t)) for t in np.linspace(0, 2*math.pi, n, endpoint=False)]

rnd = random.Random(7)

coast_w = TL(COAST)
coast_smooth = catmull(coast_w, closed=True, n=8)
LAND = Polygon(coast_smooth).buffer(0)
islets = [(T((x, y))[0], T((x, y))[1], round(rx*SX), round(ry*SY)) for x, y, rx, ry in ISLETS_C]
ISLET_POLYS = [Polygon(ell_pts(*i)) for i in islets]
ALL_LAND = unary_union([LAND] + ISLET_POLYS)
LB = ALL_LAND.bounds
beach_w = Polygon(catmull(TL(BEACH), True, 8)).intersection(LAND)
yard_w = catmull(TL(YARD), True, 8)
pcx, pcy = T(POND[:2]); pond = dict(x=pcx, y=pcy, rx=round(POND[2]*SX), ry=round(POND[3]*SY))
pond_pts = [(pcx + pond['rx']*math.cos(t)*(1 + .06*math.sin(3*t)), pcy + pond['ry']*math.sin(t)*(1 + .05*math.cos(2*t))) for t in np.linspace(0, 2*math.pi, 64, endpoint=False)]
plx, ply = T(PLAZA[:2]); plaza = dict(x=plx, y=ply, rx=round(PLAZA[2]*SX), ry=round(PLAZA[3]*SY))
paths = [(catmull(TL(p), False, 10), w) for p, w in PATHS]
PATH_GEOM = unary_union([LineString(p).buffer(w/2, cap_style=1) for p, w in paths])
# boss 6 Nov: room for 100 Duckies and for activities later. Three big open areas (lawns, 30+ Duckies each) and two stall
# rows (paved aprons; stalls stand on the back edge, Duckies browse in front), world units. Nothing decorative goes inside.
OPEN_AREAS = [
  dict(id='activity-1', kind='lawn', name='West meadow', x=1180, y=3010, rx=470, ry=330),
  dict(id='activity-2', kind='lawn', name='Windmill green', x=5700, y=2070, rx=560, ry=270),
  dict(id='activity-3', kind='lawn', name='South green', x=2430, y=4430, rx=500, ry=290),
]
STALL_ROWS = [
  dict(id='stalls-1', name='Market row', x0=4960, y0=2700, x1=6560, y1=3060),
  dict(id='stalls-2', name='Farm gate row', x0=3990, y0=1570, x1=4660, y1=1960),
]
def area_poly(a): return Polygon(ell_pts(a['x'], a['y'], a['rx'], a['ry']))
def row_poly(r, pad=0): return Polygon([(r['x0']-pad, r['y0']-pad), (r['x1']+pad, r['y0']-pad), (r['x1']+pad, r['y1']+pad), (r['x0']-pad, r['y1']+pad)]).buffer(40).buffer(-40)
ZONE_GEOM = unary_union([area_poly(a) for a in OPEN_AREAS] + [row_poly(r) for r in STALL_ROWS])
ROW_GAP = 150
_clear = unary_union([PATH_GEOM.buffer(55), ZONE_GEOM.buffer(70), Polygon(ell_pts(plx, ply, plaza['rx'] + 90, plaza['ry'] + 90)), Polygon(yard_w).buffer(80),
                      Polygon(pond_pts).buffer(150)])
_room = LAND.buffer(-150).difference(_clear)
fields = {}
for k, v in FIELDS.items():
    spine = LineString(catmull(TL(v['spine']), False, 16)).simplify(1)
    rows = []
    for i in range(v['rows']):
        o = (i - (v['rows'] - 1) / 2) * ROW_GAP
        line = spine.offset_curve(o, join_style=1) if o else spine
        cut = line.intersection(_room)
        rows += [g for g in (cut.geoms if hasattr(cut, 'geoms') else [cut]) if g.geom_type == 'LineString' and g.length > 260]
    bed = unary_union([r.buffer(ROW_GAP / 2 + 8, cap_style=1) for r in rows]).buffer(18).buffer(-18).intersection(_room.buffer(40))
    fields[k] = dict(poly=bed if bed.geom_type == 'Polygon' else max(bed.geoms, key=lambda g: g.area), rows=rows, spine=spine)
decks = {k: (T(a), T(b), w) for k, (a, b, w) in DECKS_C.items()}
# extend each deck 50 into the land so the plank meets the sand
for k, (a, b, w) in list(decks.items()):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L
    decks[k] = ((round(a[0]-ux*60, 1), round(a[1]-uy*60, 1)), b, w)
# islet bridges land on the islet: tip pushed 40 into it
for k in ('bridge-nw', 'bridge-se'):
    a, b, w = decks[k]; dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy)
    decks[k] = (a, (round(b[0]+dx/L*70, 1), round(b[1]+dy/L*70, 1)), w)

GRASS = LAND.buffer(-105, join_style=1).buffer(20, join_style=1).buffer(-20, join_style=1).difference(beach_w.buffer(10))
GRASS = GRASS.simplify(1.5)

# ---------------------------------------------------------------- props
props = []; obstacles = []
def prop(name, src, x, y, w, h, scale, ax=.5, ay=.97, flip=False, foot=None, pid=None):
    p = dict(id=pid or f'{name.lower().replace(" ", "-")}-{len(props)}', name=name, src=src, x=round(x, 1), y=round(y, 1), width=w, height=h,
             anchor=dict(x=ax, y=ay), scale=round(scale, 3), flip=flip)
    props.append(p)
    if foot == 'trunk': obstacles.append(dict(x=round(x, 1), y=round(y-9, 1), rx=31, ry=22))
    elif foot == 'small': obstacles.append(dict(x=round(x, 1), y=round(y-6, 1), rx=round(w*scale*.32), ry=round(min(30, h*scale*.18))))
    elif foot == 'wide': obstacles.append(dict(x=round(x, 1), y=round(y-12, 1), rx=round(w*scale*.46), ry=round(min(46, h*scale*.2))))
    elif isinstance(foot, dict): obstacles.append(foot)
    return p
SVG = {}   # file -> (w,h)
def svgsize(rel):
    if rel not in SVG:
        s = open(os.path.join(ART, rel)).read(3000); import re
        m = re.search(r'viewBox="([\d.\- ]+)"', s); v = [float(t) for t in m.group(1).split()]; SVG[rel] = (v[2], v[3])
    return SVG[rel]
def put(name, rel, cpt, height_world=None, scale=None, foot='small', ay=.97, flip=False, world=False, **kw):
    w, h = svgsize(rel); x, y = cpt if world else T(cpt)
    s = scale if scale else height_world / h
    return prop(name, rel, x, y, w, h, s, ay=ay, flip=flip, foot=foot, **kw)

# home plants at home's sizes (placements.js: PLANTS x PLANT_SCALE, trees x1.1)
PLANTS = {'tree-1': (260, 360), 'tree-2': (180, 360), 'tree-3': (300, 380), 'tree-4': (200, 280), 'tree-5': (150, 380),
          'bush-1': (130, 100), 'bush-2': (168, 110), 'bush-3': (116, 104), 'bush-4': (140, 100), 'bush-5': (170, 110), 'bush-6': (120, 96),
          'flower-1': (48, 36), 'flower-2': (48, 36), 'flower-3': (44, 36)}
def plant(kind, cpt, world=False, flip=False):
    w, h = PLANTS[kind]; x, y = cpt if world else T(cpt)
    s = {'tree': 1.15 * 1.1, 'bush': 1.3, 'flower': 1.6}[kind.split('-')[0]]
    name = {'tree': 'Tree', 'bush': 'Bush', 'flower': 'Flowers'}[kind.split('-')[0]]
    return prop(name, f'reuse/{kind}.svg', x, y, w, h, s, ay=1, flip=flip, foot='trunk' if name == 'Tree' else ('small' if name == 'Bush' else None))

# landmarks ------------------------------------------------------
put('Sunflower sundial', 'detail/sundial.svg', (plx, ply + 200), scale=1.24, ay=.86, world=True,
    foot=dict(x=plx, y=ply + 20, rx=300, ry=150))
put('Red barn', 'detail/barn.svg', (950, 236), height_world=560, foot=None)
bx, by = T((950, 236)); obstacles.append(dict(poly=[[bx-290, by-150], [bx+290, by-150], [bx+290, by-4], [bx-290, by-4]]))
put('Windmill', 'detail/windmill.svg', (1140, 248), height_world=735, foot=dict(x=T((1140, 248))[0], y=T((1140, 248))[1]-50, rx=200, ry=70))
# farm yard
put('Hay bale', 'detail/hay-round.svg', (1032, 252), height_world=150, foot='wide')
put('Hay stack', 'detail/hay-stack.svg', (1072, 262), height_world=165, foot='wide', flip=True)
put('Seed barrel', 'detail/barrel-seeds.svg', (858, 244), height_world=150, foot='wide')
put('Seed cart', 'detail/seed-cart.svg', (905, 262), height_world=175, foot='wide')
put('Hay bale', 'detail/hay-round.svg', (1205, 262), height_world=140, foot='wide', flip=True)
# fence round the yard's lower rim (each segment ~180 wide)
def fence_run(cpts, gap=None):
    pts = catmull(TL(cpts), False, 30); line = LineString(pts); L = line.length
    seg = 495 * .37; n = max(1, int(L // (seg - 6)))
    for i in range(n):
        if gap and gap[0] <= i < gap[1]: continue
        m = line.interpolate((i + .5) * L / n)
        put('Fence', 'detail/fence.svg', (m.x, m.y), scale=.37, world=True, foot=dict(x=round(m.x, 1), y=round(m.y-8, 1), rx=round(seg/2), ry=14), ay=.95)
fence_run([(1236,236),(1232,290)])
fence_run([(1190,306),(1120,316)])
# market --------------------------------------------------------
_m = STALL_ROWS[0]
put('Honey stall', 'detail/stall-honey.svg', (_m['x1'] - 620, _m['y0'] + 110), height_world=330, foot='wide', world=True, pid='stall-honey')
put('Flower stall', 'detail/stall-flowers.svg', (_m['x1'] - 230, _m['y0'] + 110), height_world=330, foot='wide', world=True, pid='stall-flowers')
put('Seed barrel', 'detail/barrel-seeds.svg', (_m['x1'] + 70, _m['y0'] + 90), height_world=150, foot='wide', flip=True, world=True)
put('Seed cart', 'detail/seed-cart.svg', (6250, 2010), height_world=200, foot='wide', world=True)   # by the windmill green's edge
put('Sunflower planter', 'detail/planter.svg', (_m['x0'] - 70, _m['y0'] + 40), height_world=130, foot='wide', world=True)
# plaza ---------------------------------------------------------
# boss 6 Nov (spacious): every plaza piece stands on the rim of the paving, the middle stays open for a crowd.
# Angles in degrees on screen (0 = east, 90 = south); a piece that would stand on a path into the plaza moves along the rim.
def rim(deg, inset=80):
    t = math.radians(deg); return (plx + (plaza['rx'] - inset) * math.cos(t), ply + (plaza['ry'] - inset * .7) * math.sin(t))
_entries = PATH_GEOM.buffer(70)
def rim_free(deg, inset=80):
    for k in range(0, 40, 3):
        for d in (deg + k, deg - k):
            x, y = rim(d, inset)
            if not _entries.contains(Point(x, y)) and not any(math.hypot(x - q[0], y - q[1]) < 150 for q in _rim_used): _rim_used.append((x, y)); return (x, y), d
    x, y = rim(deg, inset); _rim_used.append((x, y)); return (x, y), deg
_rim_used = []
for deg, fl in [(-140, False), (-40, True), (150, False), (25, True)]:
    (x, y), _ = rim_free(deg, 60)
    put('Sunflower banner', 'detail/banner.svg', (x, y), height_world=280, foot=dict(x=round(x-30, 1), y=round(y-8, 1), rx=24, ry=16), flip=fl, ay=.98, world=True)
for deg in (-165, -15, -115, -65, 115, 65, 165, 10):
    (x, y), _ = rim_free(deg, 50)
    put('Lamp', 'reuse/lamp-lantern.svg', (x, y), scale=.24*.47, foot=dict(x=round(x, 1), y=round(y-6, 1), rx=18, ry=12), ay=.993, world=True)
for deg in (100, 80, -90):
    (x, y), _ = rim_free(deg, 70)
    put('Sunflower planter', 'detail/planter.svg', (x, y), height_world=120, foot='wide', world=True)
for deg in (180, 0, -100, 125, 55, -128, -52):
    (x, y), d = rim_free(deg, 90)
    c = math.cos(math.radians(d)); sn = math.sin(math.radians(d))
    if abs(c) > .8:   # side of the ring: a bench seen side-on, facing the middle
        art = 'reuse/street--bench-wood-right.svg' if c < 0 else 'reuse/street--bench-wood-left.svg'
        put('Bench', art, (x, y), scale=.28, foot=dict(x=round(x, 1), y=round(y-30, 1), rx=30, ry=62), ay=451/463, world=True)
    else:
        art = 'reuse/street--bench-wood.svg' if sn < 0 else 'reuse/street--bench-wood-back.svg'
        put('Bench', art, (x, y), scale=.18, foot=dict(x=round(x, 1), y=round(y-10, 1), rx=70, ry=24), ay=451/463, world=True)
# pond ----------------------------------------------------------
put('Bench', 'reuse/street--bench-wood.svg', (378, 392), scale=.18, foot=dict(x=T((378, 392))[0], y=T((378, 392))[1]-10, rx=70, ry=24), ay=451/463)
for c, k in [((214, 386), 'cattails'), ((362, 380), 'reeds'), ((246, 430), 'reeds')]:
    put('Pond reeds', f'reuse/{k}.svg', c, scale=.24*.6, foot='small', ay=.984)
# garden + picnic (south-west) -----------------------------------
put('Picnic', 'detail/picnic.svg', (236, 664), height_world=160, foot='wide')
put('Garden arch', 'detail/arch.svg', (346, 616), height_world=330, foot=None)
ax_, ay_ = T((346, 616)); obstacles += [dict(x=ax_-118, y=ay_-8, rx=26, ry=18), dict(x=ax_+118, y=ay_-8, rx=26, ry=18)]
put('Bench', 'reuse/street--bench-wood-back.svg', (1180, 3420), scale=.18, foot=dict(x=1180, y=3410, rx=70, ry=24), ay=451/463, world=True)
put('Stump', 'reuse/nature--stump.svg', (330, 690), scale=.24, foot='small')
put('Stump', 'reuse/nature--stump.svg', (352, 700), scale=.2, foot='small')
put('Sunflower banner', 'detail/banner.svg', (690, 2900), height_world=260, foot='small', world=True)
fence_run([(170,700),(232,716)])
# beach ---------------------------------------------------------
put('Beach umbrella', 'reuse/umbrella-garden.svg', (1166, 612), scale=.24*.78, foot=dict(x=T((1166, 612))[0], y=T((1166, 612))[1]-8, rx=22, ry=14), ay=.993)
put('Sandcastle', 'reuse/sandcastle-turrets.svg', (1135, 640), scale=.13, foot='small')
for c, s in [((1286, 574), .24*.65), ((1312, 590), .24*.5), ((1270, 664), .24*.55)]:
    put('Coast rock', 'reuse/rock-boulder.svg', c, scale=s, foot='small')
# islets --------------------------------------------------------
put('Sunflower arch', 'detail/arch.svg', (232, 140), height_world=330, foot=None)
a2 = T((232, 140)); obstacles += [dict(x=a2[0]-118, y=a2[1]-8, rx=26, ry=18), dict(x=a2[0]+118, y=a2[1]-8, rx=26, ry=18)]
put('Bench', 'reuse/street--bench-wood.svg', (236, 196), scale=.18, foot=dict(x=T((236, 196))[0], y=T((236, 196))[1]-10, rx=70, ry=24), ay=451/463)
put('Sunflowers', 'detail/sunflower-tall.svg', (292, 178), height_world=290, foot='small')
put('Sunflowers', 'detail/sunflower-tall.svg', (176, 196), height_world=260, foot='small', flip=True)
put('Sunflower arch', 'detail/arch.svg', (1128, 818), height_world=330, foot=None)
a3 = T((1128, 818)); obstacles += [dict(x=a3[0]-118, y=a3[1]-8, rx=26, ry=18), dict(x=a3[0]+118, y=a3[1]-8, rx=26, ry=18)]
put('Picnic table', 'reuse/picnic-table.svg', (1146, 876), scale=.24*.6, foot='wide')
put('Sunflowers', 'detail/sunflower-tall.svg', (1010, 856), height_world=280, foot='small')
put('Sunflowers', 'detail/sunflower-tall.svg', (1216, 852), height_world=280, foot='small', flip=True)
put('Sunflower planter', 'detail/planter.svg', (1090, 892), height_world=110, foot='wide')
# trees: the island's rim, the lawns
TREES = [((160,166),'tree-3'),((1192,810),'tree-1'),((1060,520),'tree-2'),((1340,300),'tree-4'),((1330,560),'tree-3'),((960,330),'tree-1'),((200,330),'tree-1'),((300,316),'tree-3'),((402,272),'tree-2'),((520,232),'tree-4'),((612,218),'tree-1'),((764,200),'tree-3'),
         ((880,168),'tree-2'),((1094,166),'tree-1'),((1278,186),'tree-4'),((1238,342),'tree-3'),((1320,380),'tree-1'),((1186,360),'tree-2'),
         ((960,588),'tree-3'),((1068,548),'tree-4'),((902,620),'tree-1'),((178,520),'tree-3'),((150,586),'tree-2'),((418,684),'tree-1'),
         ((520,760),'tree-3'),((870,744),'tree-2'),((1030,596),'tree-5'),((180,128),'tree-1'),((1210,808),'tree-3'),((620,644),'tree-5'),
         ((410,470),'tree-4'),((560,420),'tree-5'),((1300,520),'tree-1'),((120,520),'tree-4'),((780,770),'tree-4'),((1376,290),'tree-2')]
for (c, k) in TREES: plant(k, c, flip=rnd.random() > .5)
BUSHES = [(240,350),(452,250),(700,232),(980,160),(1170,380),(1346,460),(1000,560),(360,700),(160,650),(560,730),(840,604),(1010,690),
          (1280,560),(120,470),(470,444),(1290,240),(200,240),(1078,800),(700,600),(940,412)]
for i, c in enumerate(BUSHES): plant(f'bush-{i % 6 + 1}', c, flip=i % 2 == 0)
FLOWERS = [(260,360),(330,440),(620,236),(730,236),(1010,170),(1150,180),(1330,330),(1090,580),(960,620),(200,560),(300,600),
           (400,720),(660,610),(860,600),(1250,500),(1180,420),(250,128),(1190,820),(580,440),(930,440),(1320,640),(840,350)]
for i, c in enumerate(FLOWERS): plant(f'flower-{i % 3 + 1}', c)
TALL = [(340,580),(1046,500),(980,520),(860,322),(1000,330),(1160,320),(590,700),(320,340),(1400,400),(150,420),(700,410),(830,412)]
for i, c in enumerate(TALL): put('Sunflowers', 'detail/sunflower-tall.svg', c, height_world=240 + 30*(i % 3), foot='small', flip=i % 2 == 1)

# clearance: decor never stands on a path, a deck landing, the plaza, a field bed or the shore
LANDINGS = unary_union([Point(a).buffer(170) for a, b, w in decks.values()] + [LineString([a, b]).buffer(190) for k, (a, b, w) in decks.items() if k.startswith('bridge')])
KEEP_OUT = unary_union([PATH_GEOM.buffer(25), LANDINGS, ZONE_GEOM.buffer(40), Polygon(ell_pts(plx, ply, plaza['rx'] + 50, plaza['ry'] + 50))] + [f['poly'].buffer(20) for f in fields.values()])
INNER = unary_union([LAND.buffer(-80)] + [Polygon(ell_pts(x, y, rx - 110, ry - 90)) for x, y, rx, ry in islets])
TALLCLEAR = unary_union([f['poly'].buffer(50) for f in fields.values()] + [Polygon(pond_pts).buffer(180), Polygon(ell_pts(plx, ply, plaza['rx'] + 120, plaza['ry'] + 120)), Polygon(yard_w).buffer(120)])
BRIDGE_CLEAR = unary_union([Point(q).buffer(380) for k, (a, b, w) in decks.items() if k.startswith('bridge') for q in (a, b)])
DECOR = ('Tree', 'Bush', 'Flowers', 'Sunflowers', 'Stump')
dropped = []
for p in list(props):
    if p['name'] not in DECOR: continue
    pt = Point(p['x'], p['y'])
    if KEEP_OUT.contains(pt) or not INNER.contains(pt) or (p['name'] == 'Tree' and (TALLCLEAR.contains(pt) or BRIDGE_CLEAR.contains(pt))):
        props.remove(p); dropped.append(p['id'])
        for o in list(obstacles):
            if 'x' in o and abs(o['x'] - p['x']) < 1 and abs(o['y'] - p['y']) < 20: obstacles.remove(o); break
print('decor dropped (path/shore clearance):', len(dropped))
# fill the open lawns evenly (Halton points, like home's replant): trees first, then bushes, never crowding a prop
def halton(i, b):
    f, r = 1, 0
    while i > 0: f /= b; r += f * (i % b); i //= b
    return r
OPEN = INNER.buffer(-10).difference(unary_union([KEEP_OUT, Polygon(yard_w).buffer(60), Polygon(pond_pts).buffer(120), beach_w.buffer(40)]))
def crowded(x, y, r): return any(math.hypot(q['x'] - x, q['y'] - y) < r for q in props if q['name'] != 'Sunflower row')
want = {'Tree': 39, 'Bush': 30}
for i in range(1, 8000):
    kind = 'Tree' if i < 4000 else 'Bush'
    x, y = LB[0] + halton(i % 4000 + 1, 2 if kind == 'Tree' else 3) * (LB[2] - LB[0]), LB[1] + halton(i % 4000 + 1, 3 if kind == 'Tree' else 5) * (LB[3] - LB[1])
    if sum(1 for q in props if q['name'] == kind) >= want[kind]: continue
    if not OPEN.contains(Point(x, y)) or crowded(x, y, 185 if kind == 'Tree' else 220): continue
    if kind == 'Tree' and (TALLCLEAR.contains(Point(x, y)) or BRIDGE_CLEAR.contains(Point(x, y)) or any(f['poly'].buffer(30).contains(Point(x, y - 200)) for f in fields.values())): continue   # no crown parked over a field
    if kind == 'Tree': plant(['tree-1', 'tree-3', 'tree-2', 'tree-4', 'tree-1', 'tree-5'][i % 6], (x, y), world=True, flip=i % 2 == 0)
    else: plant(f'bush-{i % 6 + 1}', (x, y), world=True, flip=i % 2 == 1)
for i in range(1, 600):
    x, y = LB[0] + halton(i, 5) * (LB[2] - LB[0]), LB[1] + halton(i, 7) * (LB[3] - LB[1])
    if sum(1 for q in props if q['name'] == 'Flowers') > 40: break
    if OPEN.contains(Point(x, y)) and not crowded(x, y, 140): plant(f'flower-{i % 3 + 1}', (x, y), world=True)
for p in props:
    if p['name'] not in ('Honey stall', 'Flower stall') and ZONE_GEOM.contains(Point(p['x'], p['y'])): print('  WARNING prop inside an open zone:', p['id'], p['x'], p['y'])
print('trees', sum(1 for q in props if q['name'] == 'Tree'), 'bushes', sum(1 for q in props if q['name'] == 'Bush'), 'flowers', sum(1 for q in props if q['name'] == 'Flowers'))

# field rows: short row pieces walked along each CURVED row, so the band bends like the concept's -----------------
PIECE = ('detail/field-row-short.svg', 597, 252); PIECE_SCALE = .5; STEP = 108
furrows = []
for fname, f in fields.items():
    for g in (f['poly'].geoms if hasattr(f['poly'], 'geoms') else [f['poly']]):
        obstacles.append(dict(poly=[[round(x, 1), round(y, 1)] for x, y in list(g.buffer(-4).simplify(4).exterior.coords)[:-1]]))
    for r in sorted(f['rows'], key=lambda r: r.centroid.y):
        furrows.append([(pt[0], pt[1]) for pt in r.coords])
        n = max(1, int(r.length // STEP))
        for j in range(n + 1):
            pt = r.interpolate(min(r.length - 40, 40 + j * (r.length - 80) / max(1, n)))
            prop('Sunflower row', PIECE[0], pt.x + rnd.uniform(-6, 6), pt.y + rnd.uniform(-4, 4), PIECE[1], PIECE[2], PIECE_SCALE * rnd.uniform(.94, 1.06), ay=.9, flip=rnd.random() > .5)
    mid = f['rows'][len(f['rows']) // 2] if f['rows'] else None
    if mid is not None:   # one scarecrow standing in each field
        pt = mid.interpolate(.42, normalized=True); put('Scarecrow', 'detail/scarecrow.svg', (pt.x, pt.y + 6), height_world=270, foot=None, world=True, flip=fname in ('west', 'tip'))

# ---------------------------------------------------------------- ground SVG
C = dict(sand='#FDE48C', sandEdge='#E4C567', cream='#FFF0C7', grass='#93B72F', leaf='#4AA539', ink='#39472D', water='#6EC9DE',
         deep='#5FB2C6', bed='#7FA62C', furrow='#5E8E24', dirt='#F0D27E', stone='#FFF3D2', joint='#E9D49A')
g = []
landD = bez(coast_smooth[::2], True)
isleD = ''.join(polyd(ell_pts(*i, 64)) for i in islets)
g.append(f'<defs><clipPath id="land"><path d="{landD} {isleD}"/></clipPath>'
         f'<clipPath id="grass"><path d="{shp_d(GRASS)}"/></clipPath>'
         f'<clipPath id="plaza"><ellipse cx="{plx}" cy="{ply}" rx="{plaza["rx"]}" ry="{plaza["ry"]}"/></clipPath>'
         f'<clipPath id="pond"><path d="{bez(pond_pts, True)}"/></clipPath></defs>')
# sea: shallows and foam round every shore (engine paints the sea itself)
for d in (landD, isleD):
    g.append(f'<path d="{d}" fill="none" stroke="#8FD6E4" stroke-width="190" stroke-opacity=".55" stroke-linejoin="round"/>')
    g.append(f'<path d="{d}" fill="none" stroke="{C["cream"]}" stroke-width="80" stroke-opacity=".14" stroke-linejoin="round"/>')
    g.append(f'<path d="{d}" fill="none" stroke="{C["cream"]}" stroke-width="18" stroke-opacity=".55" stroke-linejoin="round"/>')
# offshore wave ticks
for i in range(140):
    x, y = rnd.uniform(380, WIDTH - 380), rnd.uniform(380, HEIGHT - 380)
    if ALL_LAND.buffer(220).contains(Point(x, y)): continue
    L = rnd.uniform(28, 52); a = rnd.uniform(-.5, .5)
    g.append(f'<path d="M {x:.0f} {y:.0f} L {x+L*math.cos(a):.0f} {y+L*math.sin(a):.0f}" fill="none" stroke="{C["cream"]}" stroke-width="3" stroke-opacity=".45" stroke-linecap="round"/>')
# land = sand
g.append(f'<path d="{landD} {isleD}" fill="{C["sand"]}" stroke="{C["ink"]}" stroke-width="2.4" stroke-opacity=".6"/>')
g.append(f'<g clip-path="url(#land)"><path d="{landD} {isleD}" fill="none" stroke="{C["sandEdge"]}" stroke-width="16"/></g>')
# grass, with the home recipe's darker rim
g.append(f'<path d="{shp_d(GRASS)}" fill="{C["grass"]}" fill-rule="evenodd"/>')
g.append(f'<g clip-path="url(#grass)"><path d="{shp_d(GRASS)}" fill="none" stroke="{C["leaf"]}" stroke-width="30" stroke-opacity=".55"/></g>')
g.append(f'<path d="{shp_d(GRASS)}" fill="none" stroke="{C["ink"]}" stroke-width="2.2" stroke-opacity=".55"/>')
# islet grass
for (x, y, rx, ry) in islets:
    gi = ell_pts(x, y - 6, rx - 70, ry - 56, 48)
    g.append(f'<path d="{bez(gi, True)}" fill="{C["grass"]}" stroke="{C["ink"]}" stroke-width="2.2" stroke-opacity=".55"/>')
# lawn mottling (two tones, like home's Lawn Leaf / Lawn Cream)
mott = []
for i in range(150):
    x, y = rnd.uniform(LB[0], LB[2]), rnd.uniform(LB[1], LB[3])
    if not GRASS.contains(Point(x, y)): continue
    rx, ry = rnd.uniform(70, 240), rnd.uniform(40, 120)
    pts = [(x + rx*math.cos(t)*(1+.18*math.sin(3*t+i)), y + ry*math.sin(t)*(1+.15*math.cos(2*t+i))) for t in np.linspace(0, 2*math.pi, 14, endpoint=False)]
    fill, op = (C['leaf'], .16) if i % 3 else (C['cream'], .12)
    mott.append(f'<path d="{bez(pts, True)}" fill="{fill}" fill-opacity="{op}"/>')
g.append(f'<g clip-path="url(#grass)">{"".join(mott)}</g>')
# farm yard: packed dirt
g.append(f'<path d="{bez(yard_w, True)}" fill="{C["dirt"]}" stroke="{C["sandEdge"]}" stroke-width="14"/>')
g.append(f'<path d="{bez(yard_w, True)}" fill="none" stroke="{C["ink"]}" stroke-width="2.2" stroke-opacity=".5"/>')
# fields: tilled beds with furrows
for f in fields.values():
    d = shp_d(f['poly'].simplify(2))
    g.append(f'<path d="{d}" fill="none" stroke="{C["leaf"]}" stroke-width="34" stroke-opacity=".35" stroke-linejoin="round"/>')
    g.append(f'<path d="{d}" fill="{C["bed"]}" stroke="{C["ink"]}" stroke-width="2.4" stroke-opacity=".55"/>')
g.append('<g fill="none" stroke-linecap="round">' + ''.join(
    f'<path d="{bez(fr[::2] + [fr[-1]])}" stroke="{C["furrow"]}" stroke-width="30" stroke-opacity=".5"/>' for fr in furrows) + '</g>')
# pond
pd = bez(pond_pts, True)
g.append(f'<path d="{pd}" fill="none" stroke="{C["ink"]}" stroke-width="58" stroke-opacity=".5"/><path d="{pd}" fill="none" stroke="{C["sandEdge"]}" stroke-width="54"/><path d="{pd}" fill="none" stroke="{C["sand"]}" stroke-width="40"/>')
g.append(f'<path d="{pd}" fill="{C["water"]}"/>')
g.append(f'<g clip-path="url(#pond)"><ellipse cx="{pcx + pond["rx"]*.55:.0f}" cy="{pcy:.0f}" rx="{pond["rx"]*.75:.0f}" ry="{pond["ry"]*1.3:.0f}" fill="{C["deep"]}" fill-opacity=".55"/></g>')
g.append(f'<path d="{pd}" fill="none" stroke="{C["cream"]}" stroke-width="5" stroke-opacity=".85"/>')
for i in range(6):
    x, y = pcx + rnd.uniform(-.6, .4)*pond['rx'], pcy + rnd.uniform(-.5, .5)*pond['ry']
    g.append(f'<path d="M {x-22:.0f} {y:.0f} Q {x:.0f} {y+5:.0f} {x+22:.0f} {y:.0f}" fill="none" stroke="{C["cream"]}" stroke-width="3" stroke-linecap="round"/>')
# footpaths: home's four-stroke recipe, clipped to land
for wpad, col, op in [(34, C['leaf'], .35), (18, C['ink'], .6), (14, C['sandEdge'], 1), (0, C['sand'], 1)]:
    g.append(f'<g clip-path="url(#land)" fill="none" stroke-linecap="round" stroke-linejoin="round">' + ''.join(
        f'<path d="{bez(p[::2] + [p[-1]])}" stroke="{col}" stroke-opacity="{op}" stroke-width="{w + wpad}"/>' for p, w in paths) + '</g>')
# open areas: a freshly mown lawn (lighter, with mowing stripes) so the space reads as a place, not leftover grass
from scipy.spatial import Voronoi
for i, ar in enumerate(OPEN_AREAS):
    e = f'cx="{ar["x"]}" cy="{ar["y"]}" rx="{ar["rx"]}" ry="{ar["ry"]}"'
    g.append(f'<clipPath id="lawn{i}"><ellipse {e}/></clipPath><g clip-path="url(#grass)">')
    g.append(f'<ellipse {e} fill="#A5C437" stroke="{C["leaf"]}" stroke-width="26" stroke-opacity=".28"/>')
    stripes = ''.join(f'<rect x="{ar["x"] - ar["rx"] + k:.0f}" y="{ar["y"] - ar["ry"]}" width="70" height="{2 * ar["ry"]}" fill="{C["cream"]}" fill-opacity=".09"/>' for k in range(0, 2 * ar['rx'], 140))
    g.append(f'<g clip-path="url(#lawn{i})">{stripes}</g>')
    g.append(f'<ellipse {e} fill="none" stroke="{C["ink"]}" stroke-width="2" stroke-opacity=".25" stroke-dasharray="2 16"/></g>')
# stall rows: a paved apron in the plaza's cream flagstones
def flagstones(poly, n, cid):
    x0, y0, x1, y1 = poly.bounds
    pts = [(rnd.uniform(x0, x1), rnd.uniform(y0, y1)) for _ in range(n)]
    vor = Voronoi(np.array(pts + [((x0+x1)/2 + 4000*math.cos(t), (y0+y1)/2 + 4000*math.sin(t)) for t in np.linspace(0, 6.28, 8)]))
    js = [f'M {vor.vertices[a][0]:.0f} {vor.vertices[a][1]:.0f} L {vor.vertices[b][0]:.0f} {vor.vertices[b][1]:.0f}' for a, b in vor.ridge_vertices if a >= 0 and b >= 0]
    d = polyd(list(poly.exterior.coords)[:-1])
    return (f'<clipPath id="{cid}"><path d="{d}"/></clipPath>'
            f'<path d="{d}" fill="none" stroke="{C["leaf"]}" stroke-width="40" stroke-opacity=".35"/><path d="{d}" fill="none" stroke="{C["ink"]}" stroke-width="26" stroke-opacity=".6"/>'
            f'<path d="{d}" fill="{C["stone"]}" stroke="{C["sandEdge"]}" stroke-width="22"/>'
            f'<g clip-path="url(#{cid})"><path d="{" ".join(js)}" fill="none" stroke="{C["joint"]}" stroke-width="7" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{C["sand"]}" stroke-width="50" stroke-opacity=".5"/></g>')
for i, r in enumerate(STALL_ROWS):
    pr = row_poly(r)
    g.append(flagstones(pr, int(pr.area / 9000), f'row{i}'))
# beach cove: the sand stays (no grass), a darker wet line at the water
# plaza: cream flagstones (voronoi) inside a paved ring
pts = []
for i in range(420):
    t = rnd.uniform(0, 2*math.pi); r = math.sqrt(rnd.uniform(0, 1))
    pts.append((plx + r*plaza['rx']*1.05*math.cos(t), ply + r*plaza['ry']*1.05*math.sin(t)))
vor = Voronoi(np.array(pts + [(plx + 3000*math.cos(t), ply + 3000*math.sin(t)) for t in np.linspace(0, 6.28, 8)]))
joints = []
for (a, b) in vor.ridge_vertices:
    if a < 0 or b < 0: continue
    p, q = vor.vertices[a], vor.vertices[b]
    joints.append(f'M {p[0]:.0f} {p[1]:.0f} L {q[0]:.0f} {q[1]:.0f}')
pe = f'cx="{plx}" cy="{ply}" rx="{plaza["rx"]}" ry="{plaza["ry"]}"'
g.append(f'<ellipse {pe} fill="none" stroke="{C["leaf"]}" stroke-width="40" stroke-opacity=".35"/><ellipse {pe} fill="none" stroke="{C["ink"]}" stroke-width="26" stroke-opacity=".6"/><ellipse {pe} fill="{C["stone"]}" stroke="{C["sandEdge"]}" stroke-width="22"/>')
g.append(f'<g clip-path="url(#plaza)"><path d="{" ".join(joints)}" fill="none" stroke="{C["joint"]}" stroke-width="7" stroke-linejoin="round"/>'
         f'<ellipse cx="{plx}" cy="{ply+20}" rx="{plaza["rx"]*.52:.0f}" ry="{plaza["ry"]*.52:.0f}" fill="{C["cream"]}" stroke="{C["joint"]}" stroke-width="10"/>'
         f'<ellipse {pe} fill="none" stroke="{C["sand"]}" stroke-width="60" stroke-opacity=".5"/></g>')
# beach towels and the picnic rug lie FLAT, so they are painted into the ground (a sprite stands up)
def towel(c, w, h, ang, cols):
    cx, cy = T(c); ca, sa = math.cos(ang), math.sin(ang)
    R = lambda x, y: (cx + x*ca - y*sa, cy + x*sa + y*ca)
    body = [R(-w/2, -h/2), R(w/2, -h/2), R(w/2, h/2), R(-w/2, h/2)]
    out = [f'<path d="{polyd([(x+5, y+6) for x, y in body])}" fill="#C9A85A" fill-opacity=".45"/>', f'<path d="{polyd(body)}" fill="{cols[0]}" stroke="{C["ink"]}" stroke-width="2.6"/>']
    n = 5
    for i in range(1, n, 2):
        x0, x1 = -w/2 + i*w/n, -w/2 + (i+1)*w/n
        out.append(f'<path d="{polyd([R(x0, -h/2+2), R(x1, -h/2+2), R(x1, h/2-2), R(x0, h/2-2)])}" fill="{cols[1]}"/>')
    out.append(f'<path d="{polyd(body)}" fill="none" stroke="{C["ink"]}" stroke-width="2.6"/>')
    for sx in (-1, 1):   # fringe
        for k in np.linspace(-h/2+8, h/2-8, 6):
            p, q = R(sx*w/2, k), R(sx*(w/2+10), k)
            out.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="{cols[0]}" stroke-width="3"/>')
    return ''.join(out)
g.append(towel((1214, 640), 96, 150, -.25, ('#FFF0C7', '#5BA8E0')))
g.append(towel((1258, 630), 96, 150, .18, ('#FFF0C7', '#F07A6A')))
ground_body = '\n'.join(g)

def write_svg(path, vb, w, h, title):
    open(path, 'w').write(f'<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">\n<title>{title}</title>\n{ground_body}\n</svg>\n')
tiles = []
for r in range(TROWS):
    for c in range(TCOLS):
        x, y = c * TW, r * TH
        write_svg(f'{ART}/ground-r{r}-c{c}.svg', f'{x} {y} {TW} {TH}', TW, TH, f'Sunflower island ground tile {r}, {c}')
        tiles.append(dict(src=f'ground-r{r}-c{c}.svg', x=x, y=y, width=TW, height=TH))

# ---------------------------------------------------------------- decks (jetties + islet bridges), drawn in world units
def deck_svg(name, a, b, w, rails):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    hw = w / 2
    corner = lambda t, s: (a[0] + ux*t + nx*s, a[1] + uy*t + ny*s)
    body = [corner(0, -hw), corner(L, -hw), corner(L, hw), corner(0, hw)]
    side = 16   # the deck's visible thickness, dropped straight down (3/4 view)
    xs = [p[0] for p in body]; ys = [p[1] for p in body]
    pad = 40; x0, y0, x1, y1 = min(xs)-pad, min(ys)-pad, max(xs)+pad, max(ys)+pad+side+30
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" stroke-linejoin="round" stroke-linecap="round">',
         f'<title>Sunflower island {name}</title>']
    sh = [(p[0]+14, p[1]+side+22) for p in body]
    s.append(f'<path d="{polyd(sh)}" fill="#2E7F93" fill-opacity=".28"/>')
    low = [(p[0], p[1]+side) for p in body]
    s.append(f'<path d="{polyd(low)}" fill="#8B5A2E" stroke="#39472D" stroke-width="3"/>')
    # posts under the deck
    for t in np.arange(30, L, 150):
        for sgn in (-1, 1):
            px, py = corner(t, sgn*(hw-8))
            s.append(f'<rect x="{px-7:.1f}" y="{py:.1f}" width="14" height="{side+34}" rx="3" fill="#7A4E28" stroke="#39472D" stroke-width="2.5"/>')
            s.append(f'<ellipse cx="{px:.1f}" cy="{py+side+34:.1f}" rx="14" ry="5" fill="none" stroke="#FFF0C7" stroke-width="2.5" stroke-opacity=".8"/>')
    s.append(f'<path d="{polyd(body)}" fill="#C8893F" stroke="#39472D" stroke-width="3.2"/>')
    # planks across the deck
    for t in np.arange(26, L, 26):
        p, q = corner(t, -hw+4), corner(t, hw-4)
        s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#39472D" stroke-width="1.6" stroke-opacity=".55"/>')
    # a lit edge and a few grain ticks
    p, q = corner(4, -hw+6), corner(L-4, -hw+6)
    s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#E9B46A" stroke-width="5" stroke-opacity=".8"/>')
    for i, t in enumerate(np.arange(40, L, 95)):
        p = corner(t + 8, (i % 3 - 1) * hw * .45); q = (p[0] + nx*14, p[1] + ny*14)
        s.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#8B5A2E" stroke-width="2"/>')
    if rails:
        for sgn in (-1, 1):
            tops = []
            for t in np.linspace(20, L-20, max(2, int(L // 110) + 1)):
                px, py = corner(t, sgn*(hw-6)); tops.append((px, py-34))
                s.append(f'<rect x="{px-6:.1f}" y="{py-36:.1f}" width="12" height="38" rx="3" fill="#B97A3A" stroke="#39472D" stroke-width="2.5"/>')
            s.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in tops)}" fill="none" stroke="#39472D" stroke-width="10"/>')
            s.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in tops)}" fill="none" stroke="#C8893F" stroke-width="5"/>')
    else:   # jetties: two mooring bollards at the tip
        for sgn in (-1, 1):
            px, py = corner(L-14, sgn*(hw-10))
            s.append(f'<rect x="{px-9:.1f}" y="{py-30:.1f}" width="18" height="32" rx="6" fill="#7A4E28" stroke="#39472D" stroke-width="2.5"/><ellipse cx="{px:.1f}" cy="{py-30:.1f}" rx="9" ry="4" fill="#B97A3A" stroke="#39472D" stroke-width="2"/>')
    s.append('</svg>')
    open(f'{ART}/{name}.svg', 'w').write('\n'.join(s))
    return dict(src=f'{name}.svg', x=round(x0, 1), y=round(y0, 1), width=round(x1-x0, 1), height=round(y1-y0, 1))
ARCH_RISE = 64   # islet bridges hump like home's footbridges (home R = 70); listed in world.json `arches` for the engine's deckY
def arch_svg(name, a, b, w, R=ARCH_RISE):
    """a humped footbridge in home's look: planked deck rising R at mid-span, side boards, railings on posts, stone footings"""
    dx, dy = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx, dy); ux, uy = dx/L, dy/L; nx, ny = -uy, ux
    hw = w / 2; lift = lambda t: R * 4 * (t/L) * (1 - t/L)
    P = lambda t, sd, extra=0: (a[0] + ux*t + nx*sd, a[1] + uy*t + ny*sd - lift(t) - extra)
    ts = np.linspace(0, L, 28)
    vis = 1 if ny > 0 else -1          # the deck edge nearer the camera (lower on screen) shows its side boards
    left = [P(t, -hw) for t in ts]; right = [P(t, hw) for t in ts]
    deck = left + right[::-1]
    side = 20
    near = [P(t, vis*hw) for t in ts]; band = near + [(x, y + side) for x, y in near[::-1]]
    pts = deck + [(x, y + side + 40) for x, y in near]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    pad = 50; x0, y0, x1, y1 = min(xs)-pad, min(ys)-pad-50, max(xs)+pad, max(ys)+pad+40
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}" width="{x1-x0:.1f}" height="{y1-y0:.1f}" stroke-linejoin="round" stroke-linecap="round">',
         f'<title>Sunflower island {name}, humped footbridge</title>']
    flat = [(a[0] + ux*t + nx*sd + 16, a[1] + uy*t + ny*sd + 34) for t, sd in [(0, -hw), (L, -hw), (L, hw), (0, hw)]]
    o.append(f'<path d="{polyd(flat)}" fill="#2E7F93" fill-opacity=".26"/>')   # shadow on the water
    # the open arch under the span: the side boards hang over a dark gap down to the waterline
    under = [(x, y + side) for x, y in near] + [(a[0] + ux*t + nx*vis*hw, a[1] + uy*t + ny*vis*hw + side + 8) for t in ts[::-1]]
    o.append(f'<path d="{polyd(under)}" fill="#3F8FA0" fill-opacity=".55"/>')
    o.append(f'<path d="{polyd(band)}" fill="#8B5A2E" stroke="#39472D" stroke-width="3"/>')
    o.append(f'<path d="{polyd(deck)}" fill="#C8893F" stroke="#39472D" stroke-width="3"/>')
    for t in np.arange(22, L - 10, 22):
        p, q = P(t, -hw + 4), P(t, hw - 4)
        o.append(f'<path d="M {p[0]:.1f} {p[1]:.1f} L {q[0]:.1f} {q[1]:.1f}" stroke="#39472D" stroke-width="1.5" stroke-opacity=".5"/>')
    lit = [P(t, -vis*(hw - 7)) for t in ts]
    o.append(f'<path d="M {" L ".join(f"{x:.1f} {y:.1f}" for x, y in lit)}" fill="none" stroke="#E9B46A" stroke-width="5" stroke-opacity=".8"/>')
    for t in (6, L - 6):   # cream stone footings where the arch meets land
        for sd in (-hw, hw):
            x, y = P(t, sd); o.append(f'<ellipse cx="{x:.1f}" cy="{y + side + 4:.1f}" rx="16" ry="9" fill="#FFF0C7" stroke="#39472D" stroke-width="2.4"/>')
    for sgn in (-1, 1):   # railings: posts, then a rail that follows the hump
        posts = np.linspace(14, L - 14, max(3, int(L // 70) + 1)); tops = []
        for t in posts:
            x, y = P(t, sgn*(hw - 6)); tops.append((x, y - 36))
            o.append(f'<rect x="{x-6:.1f}" y="{y-38:.1f}" width="12" height="40" rx="3" fill="#B97A3A" stroke="#39472D" stroke-width="2.4"/>')
        rail = [P(t, sgn*(hw - 6), 36) for t in np.linspace(14, L - 14, 24)]
        d = 'M ' + ' L '.join(f'{x:.1f} {y:.1f}' for x, y in rail)
        o.append(f'<path d="{d}" fill="none" stroke="#39472D" stroke-width="10"/><path d="{d}" fill="none" stroke="#C8893F" stroke-width="5"/>')
        for x, y in tops: o.append(f'<rect x="{x-8:.1f}" y="{y-6:.1f}" width="16" height="8" rx="3" fill="#7A4E28" stroke="#39472D" stroke-width="2"/>')
    o.append('</svg>')
    open(f'{ART}/{name}.svg', 'w').write('\n'.join(o))
    return dict(src=f'{name}.svg', x=round(x0, 1), y=round(y0, 1), width=round(x1-x0, 1), height=round(y1-y0, 1))
deck_entries = [arch_svg(k, a, b, w) if k.startswith('bridge') else deck_svg(k, a, b, w, False) for k, (a, b, w) in decks.items()]

# ---------------------------------------------------------------- flats (ground decals)
flats = []
DEC = {'grass-tuft-1': (44, 26), 'grass-tuft-2': (34, 22), 'grass-tuft-3': (56, 24), 'flower-dot-1': (20, 18), 'flower-dot-2': (26, 18),
       'flower-dot-3': (22, 16), 'pebble-1': (22, 14), 'pebble-2': (34, 16), 'sand-speck-1': (16, 8), 'sand-speck-2': (22, 10)}
busy = unary_union([f['poly'] for f in fields.values()] + [row_poly(r, 20) for r in STALL_ROWS] + [PATH_GEOM, Polygon(ell_pts(plx, ply, plaza['rx'] + 30, plaza['ry'] + 30)), Polygon(yard_w), Polygon(pond_pts).buffer(40)])
for i in range(900):
    x, y = rnd.uniform(LB[0], LB[2]), rnd.uniform(LB[1], LB[3])
    pt = Point(x, y)
    if GRASS.contains(pt) and not busy.contains(pt): kind = rnd.choice(['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'grass-tuft-1', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3'])
    elif (beach_w.contains(pt) or (ALL_LAND.contains(pt) and not GRASS.buffer(10).contains(pt))) and not busy.contains(pt): kind = rnd.choice(['sand-speck-1', 'sand-speck-2', 'pebble-1', 'pebble-2'])
    else: continue
    k = 1.5; w, h = DEC[kind]
    flats.append(dict(src=f'decals/{kind}.svg', x=round(x), y=round(y), width=round(w*k), height=round(h*k), flip=rnd.random() > .5))
for c in [(1300, 640), (1110, 690)]:
    x, y = T(c); flats.append(dict(src='reuse/beach--starfish-orange.svg', x=x, y=y, width=round(388*.13), height=round(371*.13), flip=False))
x, y = T((1200, 676)); flats.append(dict(src='reuse/beach--shell-scallop.svg', x=x, y=y, width=round(413*.12), height=round(331*.12), flip=True))
for c, k in [((262, 396), 'lily-pad-flower'), ((316, 414), 'lily-pad-small'), ((300, 388), 'lily-pad-small')]:
    x, y = T(c); w, h = (632, 308) if 'large' in k or 'flower' in k else (396, 199)
    flats.append(dict(src=f'reuse/{k}.svg', x=x, y=y, width=round(w*.24*.6), height=round(h*.24*.6), flip=False))

# ---------------------------------------------------------------- data files
def walkway(a, b, w): return dict(a=[a[0], a[1]], b=[b[0], b[1]], w=w)
walkways = [walkway(a, b, w) for k, (a, b, w) in decks.items()]
zones = {
  'plaza':  dict(x=plx, y=ply, rx=plaza['rx'], ry=plaza['ry'], spawn=[plx, ply + 400]),   # boss 6 Nov: on open paving in front of the sundial, not on its dial
  'farm':   dict(x=T((1020, 270))[0], y=T((1020, 270))[1], spawn=list(T((990, 296)))),
  'market': dict(x=T((1180, 460))[0], y=T((1180, 460))[1], spawn=list(T((1180, 460)))),
  'beach':  dict(x=T((1180, 630))[0], y=T((1180, 630))[1], spawn=list(T((1140, 650)))),
  'pond':   dict(x=pcx, y=pcy, spawn=list(T((300, 456)))),
  'garden': dict(x=T((260, 640))[0], y=T((260, 640))[1], spawn=list(T((290, 640)))),
  'fields': dict(x=T((560, 330))[0], y=T((560, 330))[1], spawn=list(T((560, 245)))),
  'islet-nw': dict(x=islets[0][0], y=islets[0][1], spawn=[islets[0][0], islets[0][1] + 60]),
  'islet-se': dict(x=islets[1][0], y=islets[1][1], spawn=[islets[1][0] - 60, islets[1][1] - 30]),
  'harbor': dict(x=T((276, 792))[0], y=T((276, 792))[1], spawn=list(T((300, 772)))),
}
# boss 6 Nov: the open areas and stall rows, kept free for activities and stalls later (zones activity-n, stalls-n)
for ar in OPEN_AREAS:
    zones[ar['id']] = dict(x=ar['x'], y=ar['y'], rx=ar['rx'], ry=ar['ry'], kind=ar['kind'], name=ar['name'], spawn=[ar['x'], ar['y']])
for r in STALL_ROWS:
    n = int((r['x1'] - r['x0']) // 320)   # stall slots along the back edge, ~320 apart; Duckies browse on the paving in front
    slots = [[round(r['x0'] + (i + .5) * (r['x1'] - r['x0']) / n), r['y0'] + 110] for i in range(n)]
    zones[r['id']] = dict(x=(r['x0'] + r['x1']) / 2, y=(r['y0'] + r['y1']) / 2, x0=r['x0'], y0=r['y0'], x1=r['x1'], y1=r['y1'], kind='stalls', name=r['name'],
                          slots=slots, spawn=[(r['x0'] + r['x1']) / 2, r['y1'] - 90])
coast_out = [[round(x), round(y)] for x, y in coast_smooth[::2]]
world = dict(width=WIDTH, height=HEIGHT, coast=coast_out, water=[dict(pond, poly=[[round(x), round(y)] for x, y in pond_pts])],
             bridges=[], obstacles=obstacles, islets=[list(i) for i in islets], walkways=walkways, zones=zones, theme='sunflower',
             arches=[dict(a=list(a), b=list(b), r=ARCH_RISE, w=w) for k, (a, b, w) in decks.items() if k.startswith('bridge')])
# walk map: coast traced 35 inside the sand edge, every prop footprint
walk_coast = [[round(x), round(y)] for x, y in list(LAND.buffer(-35, join_style=1).simplify(4).exterior.coords)[:-1]]
walk = dict(width=WIDTH, height=HEIGHT, coast=walk_coast, obstacles=obstacles, walkways=walkways, bridges=[], islets=[list(i) for i in islets], water=world['water'])
sw = decks['jetty-sw']
harbor = dict(jetty=dict(foot=list(sw[0]), tip=list(sw[1]), width=104),
              boats=[dict(x=round(sw[1][0] - 160), y=round(sw[1][1] - 60), turn=3.14159), dict(x=round(sw[1][0] + 160), y=round(sw[1][1] - 40), turn=3.14159),
                     dict(x=round(sw[1][0] + 170), y=round(sw[1][1] - 230), turn=1.5708)],
              spawn=zones['plaza']['spawn'])
# the rest of the moorings: by the other jetties, the beach and the islets
for k, off in [('jetty-w', (0, 150)), ('jetty-e', (0, -150)), ('jetty-s', (160, -20))]:
    tip = decks[k][1]; harbor['boats'].append(dict(x=round(tip[0] + off[0]), y=round(tip[1] + off[1]), turn=1.5708 if off[1] else 3.14159))
for c, t in [((1236, 690), 1.5708), ((88, 196), 3.14159), ((1300, 840), 3.14159), ((1398, 506), 3.14159)]:
    x, y = T(c); harbor['boats'].append(dict(x=round(x), y=round(y), turn=t))
json.dump(world, open(f'{DATA}/world.json', 'w'), separators=(',', ':'))
json.dump(walk, open(f'{DATA}/walk-world.json', 'w'), separators=(',', ':'))
json.dump(harbor, open(f'{DATA}/harbor.json', 'w'), indent=1)
art = dict(width=WIDTH, height=HEIGHT, sea='#6EC9DE', ground=dict(tiles=tiles), decks=deck_entries, flats=flats, props=props)
json.dump(art, open(f'{ART}/art.json', 'w'), indent=0, separators=(',', ':'))
print('props', len(props), 'obstacles', len(obstacles), 'flats', len(flats), 'decks', len(deck_entries))

# ---------------------------------------------------------------- validation (same walk rules as island-geometry.mjs)
def in_poly(x, y, p):
    inside = False; j = len(p) - 1
    for i in range(len(p)):
        if (p[i][1] > y) != (p[j][1] > y) and x < (p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1]) + p[i][0]: inside = not inside
        j = i
    return inside
def edge_dist(x, y, p):
    return Polygon(p).exterior.distance(Point(x, y))
obs_shapes = []
for o in obstacles:
    if 'poly' in o: obs_shapes.append(Polygon(o['poly']).buffer(16))
    else: obs_shapes.append(Polygon(ell_pts(o['x'], o['y'], o['rx'] + 16, o['ry'] + 16, 24)))
BLOCK = unary_union(obs_shapes + [Polygon(ell_pts(pond['x'], pond['y'], pond['rx'] + 20, pond['ry'] + 20, 48)).union(Polygon(world['water'][0]['poly']).buffer(20))])
WALKC = Polygon(walk_coast)
boards = [LineString([w['a'], w['b']]).buffer(w['w']/2 - 10, cap_style=2) for w in walkways]
isle_walk = [Polygon(ell_pts(x, y, rx - 20, ry - 20, 48)) for x, y, rx, ry in islets]
OK = unary_union([WALKC] + boards + isle_walk).difference(BLOCK)
step = 20
gx, gy = np.arange(0, WIDTH, step), np.arange(0, HEIGHT, step)
from shapely import contains_xy
XX, YY = np.meshgrid(gx, gy)
grid = contains_xy(OK, XX, YY)
from scipy import ndimage as nd
lab, n = nd.label(grid)
def comp(p): return lab[int(round(p[1] / step)), int(round(p[0] / step))]
root = comp(zones['plaza']['spawn'])
bad = []
for k, z in zones.items():
    c = comp(z['spawn'])
    if c != root: bad.append(f'zone {k} spawn {z["spawn"]} not reachable (comp {c})')
for k, (a, b, w) in decks.items():
    for name, p in [('foot', a), ('tip', b)]:
        q = (a[0] + (b[0]-a[0])*.93, a[1] + (b[1]-a[1])*.93) if name == 'tip' else (a[0] + (b[0]-a[0])*.1, a[1] + (b[1]-a[1])*.1)
        c = comp(q)
        if c != root: bad.append(f'{k} {name} {q} not reachable (comp {c})')
sizes = nd.sum(grid, lab, range(n + 1)); main = sizes[root] * step * step
for i in range(1, n + 1):
    if i != root and sizes[i] > 4:
        ys, xs = np.where(lab == i); print('  pocket', i, int(sizes[i]), 'cells near', int(xs.mean() * step), int(ys.mean() * step))
print('walkable area main component', int(main / 1e6 * 100) / 100, 'M units^2; other components', sorted([int(s) for i, s in enumerate(sizes) if i not in (0, root) and s > 4])[-6:])
# harbor checks
LANDALL = unary_union([LAND] + ISLET_POLYS + [LineString([w['a'], w['b']]).buffer(w['w']/2) for w in walkways])
tip = Point(sw[1]); near = LAND.union(unary_union(ISLET_POLYS)).distance(tip)
print('harbor tip distance to land', round(near))
for bt in harbor['boats']:
    d = LANDALL.distance(Point(bt['x'], bt['y'])); w2 = OK.distance(Point(bt['x'], bt['y']))
    if d < 60 or LANDALL.contains(Point(bt['x'], bt['y'])): bad.append(f'boat {bt} too close to land ({d:.0f})')
    if w2 > 230: bad.append(f'boat {bt} far from walkable ({w2:.0f})')
    if bt['x'] < 60 or bt['x'] > WIDTH - 60 or bt['y'] < 60 or bt['y'] > HEIGHT - 60: bad.append(f'boat {bt} off map')
bs = harbor['boats']
for i in range(len(bs)):
    for j in range(i + 1, len(bs)):
        if i < 3 and j < 3: continue
        if math.hypot(bs[i]['x'] - bs[j]['x'], bs[i]['y'] - bs[j]['y']) < 300: bad.append(f'boats {i},{j} under 300 apart')
minx, miny, maxx, maxy = ALL_LAND.bounds
print('land bounds', [round(v) for v in (minx, miny, maxx, maxy)], 'sea margins', round(minx), round(miny), round(WIDTH - maxx), round(HEIGHT - maxy))
print('VALID' if not bad else 'PROBLEMS:\n  ' + '\n  '.join(bad))
json.dump(dict(grid_step=step), open(os.devnull, 'w'))
np.save('/tmp/sunflower-walkgrid.npy', (lab == root)) if '--grid' in sys.argv else None

# ---------------------------------------------------------------- sleepers (boss 6 Nov): the same 28 as home, by the props they belong to
# Same shape and counts as SLEEP_SPOTS (src/pixi/sleep-spots.js). Each pose has a hand-picked anchor beside its prop; the spot is
# the nearest point to it that passes the game's rules (resolveSleepSpots) plus ours: clear of the path EDGE (paths are 1.5x
# home's width), off the plaza, the open activity areas and the stall rows (they stay free for later).
SLEEP_R = {'nod': 41.8, 'leaf': 73.8, 'wing': 60.0, 'hammock': 70.7, 'rock': 46.6, 'book': 63.8, 'chair': 73.7, 'box': 49.7}
SLEEP_ANCHORS = {
  'hammock': [((2420, 3720), False, 'between two oaks in the south-west wood'), ((6650, 2050), True, 'under the east trees')],
  'rock': [((6600, 3700), False, 'by the beach rocks'), ((980, 2330), True, 'by a bush on the west lawn'), ((3560, 4300), False, 'by a bush at the south shore')],
  'leaf': [((1300, 1500), False, 'north-west lawn, flowers'), ((2950, 3980), True, 'lawn above the south green'), ((4950, 3650), False, 'lawn by the beach path'), ((6950, 1200), True, 'by the tip sunflowers')],
  'book': [((6640, 2800), True, 'beside the flower stall'), ((4400, 1300), False, 'by the red barn'), ((2160, 2080), True, 'by the pond bench'), ((1080, 3760), False, 'by the garden picnic')],
  'chair': [((5480, 3720), True, 'beach sand facing the sea'), ((6650, 3420), True, 'beach sand facing the sea')],
  'wing': [((4400, 3950), True, 'lawn south of the south field'), ((4850, 3300), False, 'lawn by the south lane'), ((6950, 1300), True, 'north-east lawn by the tip field'), ((3500, 3500), False, 'lawn below the plaza'), ((7000, 2250), True, 'east lawn')],
  'box': [((820, 3480), False, 'west shore, by the meadow fence'), ((2150, 1560), True, 'north-west lawn by the bridge lane'), ((3150, 1230), False, 'north lawn by the lane'), ((5250, 1100), True, 'farm yard between the barn and the windmill')],
}
PATH_LINES = [[(round(x), round(y)) for x, y in p[::3] + [p[-1]]] for p, w in paths]
PATH_HALF = [w / 2 for p, w in paths]
def path_edge(x, y): return min(LineString(l).distance(Point(x, y)) - h for l, h in zip(PATH_LINES, PATH_HALF))
SLEEP_AVOID = ([dict(name='plaza', x=plx, y=ply, rx=plaza['rx'] + 80, ry=plaza['ry'] + 70)]
               + [dict(name=a['id'], x=a['x'], y=a['y'], rx=a['rx'] + 60, ry=a['ry'] + 50) for a in OPEN_AREAS]
               + [dict(name=r['id'], x=(r['x0'] + r['x1']) / 2, y=(r['y0'] + r['y1']) / 2, rx=(r['x1'] - r['x0']) / 2 * 1.42 + 40, ry=(r['y1'] - r['y0']) / 2 * 1.42 + 40) for r in STALL_ROWS])
SOLID = [p for p in props if not re.search(r'lily|bunting|boat|flag|grass|tuft|petal|pebble|shell|rug|blanket|paving|path|puddle|shadow|clover|daisy', p['name'], re.I)]
BUILDING = re.compile(r'library|lighthouse|stall|hall|house|barn|windmill|tower|cafe|shop|kiosk|shelf|castle|cottage|museum|bakery|greenhouse', re.I)
WALK_OK = OK.buffer(-6)
COAST_LINE = Polygon(walk_coast).exterior
SOFT = ('Flowers', 'Bush', 'Sunflowers', 'Stump'); soft = []   # small decor that steps aside for a sleeper (keeps it uncluttered)
def sleep_problem(x, y, pose, taken):
    r = SLEEP_R[pose]
    if not all(WALK_OK.contains(Point(x + dx, y)) for dx in (-r * .9, 0, r * .9)): return 'not ground'
    if any(math.hypot((x - i[0]) / (i[2] + 60), (y - i[1]) / (i[3] + 60)) < 1 for i in islets): return 'islet'
    if any(LineString([w_['a'], w_['b']]).distance(Point(x, y)) < w_['w'] / 2 + 110 for w_ in walkways): return 'deck'
    if path_edge(x, y) < r + 30: return 'path'
    if any(((x - a['x']) / a['rx']) ** 2 + ((y - a['y']) / a['ry']) ** 2 < 1 for a in SLEEP_AVOID): return 'zone'
    if COAST_LINE.distance(Point(x, y)) < r * .6 + 60: return 'water'
    if any(math.hypot(x - tx, y - ty) < 150 + r for tx, ty in (T((1214, 640)), T((1258, 630)))): return 'towel'
    for s in taken:
        if math.hypot(s[0] - x, (s[1] - y) * 1.3) < max(320, SLEEP_R[s[2]] + r + 120): return 'near ' + s[2]
        if s[2] == pose and math.hypot(s[0] - x, s[1] - y) < (880 if pose == 'chair' else 930): return 'same pose near'
    soft.clear()
    for p in SOLID:
        hw = p['width'] * p['scale'] / 2
        if math.hypot(x - p['x'], (y - p['y']) * 1.6) < hw * (.35 if BUILDING.search(p['name']) else .8) + r + 30 or \
           (p['y'] > y - 30 and p['y'] - y < p['height'] * p['scale'] * .9 + 20 and abs(x - p['x']) < hw + r * .6 + 20):
            if p['name'] in SOFT and p.get('id', '').find('nod') < 0: soft.append(p); continue
            return 'prop ' + p['id']
    return None
taken = []   # (x, y, pose)
def drop_prop(q):
    if q in props: props.remove(q)
    if q in SOLID: SOLID.remove(q)
    for o in list(obstacles):
        if 'x' in o and abs(o['x'] - q['x']) < 1 and 0 <= q['y'] - o['y'] < 20: obstacles.remove(o); break
    sleep_notes.append(f"   (moved aside: {q['id']})")
sleep_spots = {k: [] for k in ('nod', 'hammock', 'rock', 'leaf', 'book', 'chair', 'wing', 'box')}
sleep_notes = []
# nod: four trees whose trunk front is free, spread over the island
cands = [p for p in props if p['name'] == 'Tree' and LAND.buffer(-120).contains(Point(p['x'], p['y']))]
def nod_ok(t):
    x, y = t['x'], t['y'] + 14
    if path_edge(x, y) < 90 or not WALK_OK.buffer(30).contains(Point(x, y)): return False
    if any(((x - a['x']) / a['rx']) ** 2 + ((y - a['y']) / a['ry']) ** 2 < 1 for a in SLEEP_AVOID): return False
    return not any(q is not t and q['y'] > y - 10 and q['y'] - y < q['height'] * q['scale'] * .9 + 20 and abs(q['x'] - x) < q['width'] * q['scale'] / 2 + 40 for q in SOLID)   # no crown in front of the napper
cands = [t for t in cands if nod_ok(t)]
NOD_AT = [(1200, 1900), (5300, 3300), (3300, 1150), (2200, 4000)]
for i, (ax, ay) in enumerate(NOD_AT):
    best = min((t for t in cands if not any(math.hypot(t['x'] - s[0], (t['y'] + 14 - s[1]) * 1.3) < 340 for s in taken)), key=lambda t: math.hypot(t['x'] - ax, t['y'] - ay))
    best['id'] = f'tree-nod-{i + 1}'; flip = i % 2 == 1
    sleep_spots['nod'].append([best['id'], 0, flip]); taken.append((best['x'], best['y'] + 14, 'nod'))
    sleep_notes.append(f"nod   {best['id']} trunk at {best['x']:.0f},{best['y']:.0f}")
for pose, lst in SLEEP_ANCHORS.items():
    for (ax, ay), flip, note in lst:
        found = None
        for rad in range(0, 700, 20):
            for k in range(max(1, int(2 * math.pi * rad / 40))):
                t = k / max(1, int(2 * math.pi * rad / 40)) * 2 * math.pi
                x, y = round(ax + rad * math.cos(t)), round(ay + rad * .8 * math.sin(t))
                if not sleep_problem(x, y, pose, taken): found = (x, y); break
            if found: break
        if not found: sleep_notes.append(f'{pose} NOT PLACED near {ax},{ay}: {sleep_problem(ax, ay, pose, taken)}'); continue
        sleep_problem(found[0], found[1], pose, taken)
        for q in list(soft): drop_prop(q)
        sleep_spots[pose].append([found[0], found[1], flip]); taken.append((found[0], found[1], pose))
        sleep_notes.append(f'{pose:6s}{found[0]},{found[1]} ({round(math.hypot(found[0] - ax, found[1] - ay))} off anchor) {note}')
print('\n'.join(sleep_notes))
print('sleepers placed', sum(len(v) for v in sleep_spots.values()), 'of 28')
world['sleepSpots'] = sleep_spots
world['sleepAvoid'] = [{k: (round(v) if isinstance(v, float) else v) for k, v in a.items()} for a in SLEEP_AVOID]
world['paths'] = [[list(p) for p in l] for l in PATH_LINES]
world['pathWidths'] = [round(w) for p, w in paths]
json.dump(world, open(f'{DATA}/world.json', 'w'), separators=(',', ':'))
json.dump(walk, open(f'{DATA}/walk-world.json', 'w'), separators=(',', ':'))
art['props'] = props   # nod tree ids renamed
json.dump(art, open(f'{ART}/art.json', 'w'), indent=0, separators=(',', ':'))
if '--sleepmap' in sys.argv:   # debug: where each size of sleeper could still lie (green), with the placed ones (red)
    from PIL import Image, ImageDraw
    base = Image.open(os.path.join(CONCEPTS, 'sunflower-work', 'sunflower-render-walk.png')).convert('RGB'); kk = base.width / WIDTH
    dr = ImageDraw.Draw(base, 'RGBA')
    for gy in range(0, HEIGHT, 50):
        for gx in range(0, WIDTH, 50):
            if not LAND.contains(Point(gx, gy)): continue
            if not sleep_problem(gx, gy, 'leaf', [t for t in taken]): dr.rectangle([gx*kk-2, gy*kk-2, gx*kk+2, gy*kk+2], fill=(0, 255, 0, 200))
    for x, y, pose in taken: dr.ellipse([x*kk-6, y*kk-6, x*kk+6, y*kk+6], fill=(255, 0, 0, 255)); dr.text((x*kk+7, y*kk-6), pose, fill=(120, 0, 0))
    base.save('/private/tmp/claude-501/-Users-pragadees-xd/b23a44ff-1b85-4260-8c84-c6c2b8035916/scratchpad/sunbig/sleepmap.png')

# Apply the locked centre and 40-bed layout after writing the base map.
import subprocess
subprocess.run(['node', 'scripts/themes/sunflower-centres.mjs', 'sunflower'], cwd=ROOT, check=True)
