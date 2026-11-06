# Pink Dollhouse Town (theme id `pink`): builds the whole island from one layout, in the home island's formats
# (concepts/themes/THEME-CONTRACT.md).
#   python3 scripts/themes/pink-build.py
# Writes
#   public/pixi-art/themes/pink/ground.svg + ground-rN-cN.svg (5 x 4 tiles of home's tile size), jetty-*.svg, bridge-*.svg, art.json
#   rive/web/themes/pink/world.json, walk-world.json, harbor.json
# The props it places are the traced GPT pieces in public/pixi-art/themes/pink/detail/ (scripts/themes/pink-trace.py) plus
# home's own plants and ground decals, referenced at their home paths. Pure python, no dependencies; deterministic.
import json, math, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes/pink')
DATA = os.path.join(ROOT, 'rive/web/themes/pink')
W, H = 8000, 5800                              # boss 6 Nov: ~1.8x home's land (home is 5800 x 4400)
TW, TH = [1600] * 5, [1450] * 4                # 5 x 4 tiles, each about home's tile size

# ---------------------------------------------------------------- palette (home ink and water, pink sand, cream paths)
INK, CREAM, SEA, LEAF = '#39472D', '#FFF0C7', '#6EC9DE', '#4AA539'
GRASS = '#8FC63C'
SAND, SAND_SHADE = '#F9D3DC', '#E9A9BC'          # pink sand (beaches, banks, islets)
PATH, PATH_SHADE = '#FBE6C8', '#E6C59D'          # cream paths
ROAD, ROAD_SHADE = '#F6BED0', '#DE8FAA'          # the pink road
PAVE, PAVE_JOINT = '#FCEBD6', '#E9CDA9'          # plaza paving
PINK, HOT = '#F5A3C7', '#EC6FA8'

# ---------------------------------------------------------------- helpers
def halton(i, b):
    f, r = 1, 0
    while i > 0:
        f /= b; r += f * (i % b); i //= b
    return r

def rnd(seed):
    s = [seed & 0xffffffff]
    def r():
        s[0] = (s[0] * 1664525 + 1013904223) & 0xffffffff
        return s[0] / 4294967296
    return r

def in_poly(x, y, p):
    inside = False; j = len(p) - 1
    for i in range(len(p)):
        if (p[i][1] > y) != (p[j][1] > y) and x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]:
            inside = not inside
        j = i
    return inside

def seg_dist(x, y, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx * dx + dy * dy or 1
    t = max(0, min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L))
    return math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)

def poly_dist(x, y, p, closed=True):
    n = len(p); rng = range(n) if closed else range(n - 1)
    return min(seg_dist(x, y, p[i], p[(i + 1) % n]) for i in rng)

def in_ell(x, y, cx, cy, rx, ry):
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1

def f(v): return f'{v:.1f}'.rstrip('0').rstrip('.')

def smooth_d(pts, closed=True):
    """Catmull-Rom through the points, as cubic beziers (an SVG path d)."""
    n = len(pts)
    if n < 3: return 'M ' + ' L '.join(f'{f(x)} {f(y)}' for x, y in pts)
    P = (lambda i: pts[i % n]) if closed else (lambda i: pts[max(0, min(n - 1, i))])
    d = [f'M {f(pts[0][0])} {f(pts[0][1])}']
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C {f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}')
    return ' '.join(d) + (' Z' if closed else '')

def offset(pts, dist):
    """Push a closed outline out (dist > 0) or in along its averaged normals."""
    n = len(pts); out = []
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    sgn = 1 if area > 0 else -1
    for i in range(n):
        a, b = pts[i - 1], pts[(i + 1) % n]
        tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty) or 1
        nx, ny = ty / L * sgn, -tx / L * sgn
        out.append((pts[i][0] + nx * dist, pts[i][1] + ny * dist))
    return out

def blob(cx, cy, rx, ry, seed, n=14, wob=.16):
    r = rnd(seed); ph = [r() * 6.28 for _ in range(3)]
    return [(cx + math.cos(t) * rx * (1 + wob * (math.sin(2 * t + ph[0]) * .6 + math.sin(3 * t + ph[1]) * .4)),
             cy + math.sin(t) * ry * (1 + wob * (math.sin(2 * t + ph[2]) * .5 + math.cos(3 * t + ph[0]) * .5)))
            for t in (2 * math.pi * k / n for k in range(n))]

def heart_pts(cx, cy, sx, sy, n=64):
    out = []
    for k in range(n):
        t = 2 * math.pi * k / n
        hx = 16 * math.sin(t) ** 3; hy = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        out.append((cx + sx * hx / 16, cy + sy * (hy + 2) / 15))
    return out

# ---------------------------------------------------------------- the big island (boss 6 Nov: bigger and spacious)
# The approved layout is kept in its DESIGN coordinates (the first 5800 x 4400 island) and spread out by T(): every place
# moves apart (x 1.345, y 1.46, so the land is ~2x the first one and ~1.8x home's) while the art keeps its own size.
# Plazas grow more than that, paths are 1.5x home's width, and the freed land is left open: three activity areas and
# three stall rows (world.json zones) for the activities and stalls that come later.
SX, SY = 1.345, 1.46
CX, CY = 4000, 2657          # where the design centre (2900, 1864) lands
def T(x, y): return (CX + (x - 2900) * SX, CY + (y - 1864) * SY)
def D(*pts): return [T(*p) for p in pts]

# ---------------------------------------------------------------- the island outline: a heart with a soft point
def coast_line(n=220):
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        hx = 16 * math.sin(t) ** 3; hy = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        hy -= 4 * math.exp(-(hx / 4) ** 2) * max(0, math.cos(t)) ** 2       # a shallow notch, not a deep cleft
        hy -= 1.6 * math.exp(-((t - math.pi) / .4) ** 2)                     # the point rounded off into the beach
        w = 1 + .012 * math.sin(5 * t + 1.3) + .008 * math.sin(9 * t)          # a hand-drawn wobble
        pts.append((CX + 150 * SX * hx * w, CY + 112 * SY * hy * w))
    return pts

COAST = coast_line()                 # the grass edge
SAND_EDGE = offset(COAST, 78)        # the sand rim's outer edge (the drawn shoreline)
WALK_COAST = offset(COAST, 42)       # inset ~35 from the sand edge, like home's walk coast

def coast_point(origin, direction):
    """Where a ray from origin leaves the grass coast."""
    ox, oy = origin; dx, dy = direction; L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
    r = 0
    while in_poly(ox + dx * r, oy + dy * r, COAST): r += 4
    return (ox + dx * r, oy + dy * r), (dx, dy)

# ---------------------------------------------------------------- the layout (world coordinates)
PLAZA = (*T(2900, 1985), 780, 560)               # the ribbon square, 1.55x
SQUARE = (*T(1560, 2330), 600, 370)              # cafe square (west)
POND = (*T(4130, 1330), 560, 310)                # the lily pond (north-east)
PLAY = (*T(4330, 2270), 640, 400)                # playground sand pit (east)
GARDEN = T(2900, 1040)                           # heart garden (north, below the notch)
BEACH = (*T(2900, 3080), 900 * SX, 470 * SY)     # pink-sand beach (the heart's point)
PATH_W, ROAD_W = 160, 190                        # home's footpath core is 105: 1.5x

# piers: (name, ray origin, ray direction, length). The first is the harbor jetty in harbor.json.
PIER_RAYS = [('harbor', T(1500, 1350), (-.86, -.5), 430), ('ne', T(4150, 1250), (.62, -.78), 360),
             ('w', T(1500, 1900), (-1, .06), 380), ('e', T(4300, 1900), (1, .06), 380)]
PIERS = []
for name, o, d, L in PIER_RAYS:
    (cx, cy), (dx, dy) = coast_point(o, d)
    foot = (cx - dx * 70, cy - dy * 70)
    tip = (foot[0] + dx * L, foot[1] + dy * L)
    PIERS.append({'name': name, 'foot': foot, 'tip': tip, 'dir': (dx, dy), 'length': L, 'width': 104})

# islet bridges: home's diagonal footbridge (bridge-jetty-2.svg) and its mirror, so the arch art is home's own (R = 70)
BR2 = {'vb': (870.0355, 2996.0389, 337.9679, 475.3502), 'a': (1137.84, 3066.05), 'b': (940.19, 3417.43)}
ARCH_R = 70
def bridge_at(a_world, mirror):
    vx, vy, vw, vh = BR2['vb']
    ax, ay = BR2['a']; bx, by = BR2['b']
    if mirror: ax, bx = 2 * vx + vw - ax, 2 * vx + vw - bx
    dx, dy = a_world[0] - ax, a_world[1] - ay
    return {'x': vx + dx, 'y': vy + dy, 'w': vw, 'h': vh, 'a': a_world, 'b': (bx + dx, by + dy), 'mirror': mirror}

def bridge_from_coast(origin, direction, mirror):
    (cx, cy), (dx, dy) = coast_point(origin, direction)
    return bridge_at((cx - dx * 40, cy - dy * 40), mirror)

BRIDGES = [bridge_from_coast(T(2000, 2300), (-.49, .87), False), bridge_from_coast(T(3800, 2300), (.49, .87), True)]
ISLETS = []
for br, (rx, ry) in zip(BRIDGES, [(440, 270), (440, 270)]):
    a, b = br['a'], br['b']; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
    ISLETS.append((b[0] + dx * (ry * .55), b[1] + dy * (ry * .62), rx, ry))

def ell_pts(cx, cy, rx, ry, n=48): return [(cx + math.cos(2 * math.pi * k / n) * rx, cy + math.sin(2 * math.pi * k / n) * ry) for k in range(n)]

hp = PIERS[0]
def towards(p, q, d):
    L = math.hypot(q[0] - p[0], q[1] - p[1]); return (p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d)

# ---------------------------------------------------------------- open ground for later: activity areas and stall rows
# kind 'lawn' = a mown games lawn, 'square' = a paved square. Each holds 30+ Duckies with room to run.
ACTIVITY = [
    {'id': 'activity-1', 'name': 'Picnic lawn', 'kind': 'lawn', 'c': (2580, 1030), 'rx': 560, 'ry': 220},
    {'id': 'activity-2', 'name': 'Festival square', 'kind': 'square', 'c': (3150, 3730), 'rx': 430, 'ry': 260},
    {'id': 'activity-3', 'name': 'Rose meadow', 'kind': 'lawn', 'c': (5420, 1000), 'rx': 520, 'ry': 230},
]
# stall rows: a paved market strip with empty pitches marked, centre, length, depth, angle (radians)
STALLS = [
    {'id': 'stalls-1', 'name': 'Market row', 'c': (4820, 3730), 'len': 820, 'depth': 220, 'ang': .0},
    {'id': 'stalls-2', 'name': 'Harbour stalls', 'c': (1560, 1660), 'len': 700, 'depth': 210, 'ang': .0},
    {'id': 'stalls-3', 'name': 'Road stalls', 'c': (5800, 2730), 'len': 700, 'depth': 210, 'ang': .0},
]
def stall_poly(s, pad=0):
    (cx, cy), L, Dp, a = s['c'], s['len'] / 2 + pad, s['depth'] / 2 + pad, s['ang']
    ca, sa = math.cos(a), math.sin(a); out = []
    for k in range(40):   # a stadium: straight sides, round ends
        t = 2 * math.pi * k / 40; ex, ey = math.cos(t), math.sin(t)
        x = (L - Dp) * (1 if ex >= 0 else -1) + Dp * ex; y = Dp * ey
        out.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return out
def in_stall(x, y, s, pad=0):
    (cx, cy), a = s['c'], s['ang']; dx, dy = x - cx, y - cy
    u = dx * math.cos(a) + dy * math.sin(a); v = -dx * math.sin(a) + dy * math.cos(a)
    L, Dp = s['len'] / 2 + pad, s['depth'] / 2 + pad
    u = max(0, abs(u) - (L - Dp)); return u * u + v * v < Dp * Dp
def in_open(x, y, pad=0):
    return any(in_ell(x, y, *A['c'], A['rx'] + pad, A['ry'] + pad) for A in ACTIVITY) or any(in_stall(x, y, s, pad) for s in STALLS)

# footpaths: centre lines, smoothed. width = the cream core (home is 105; here 1.5x)
PATHS = [
    # plaza -> heart garden (north)
    {'pts': D((2900, 1660), (2905, 1480), (2900, 1330)), 'w': PATH_W},
    # the heart path round the garden
    {'pts': heart_pts(*GARDEN, 470 * SX, 400 * SY, 44), 'w': PATH_W, 'closed': True},
    # plaza (west) -> dollhouse lane -> harbour stalls -> harbor
    {'pts': D((2420, 1830), (2250, 1640), (2050, 1470), (1720, 1400), (1380, 1300), (1150, 1250)) + [towards(hp['foot'], T(1150, 1250), -40)], 'w': PATH_W},
    # garden -> lane
    {'pts': D((2440, 1180), (2300, 1330), (2150, 1500)), 'w': PATH_W},
    # garden -> picnic lawn
    {'pts': D((2470, 960), (2300, 870)) + [(3060, 1050)], 'w': PATH_W},
    # plaza (south-west) -> cafe square -> west pier
    {'pts': D((2420, 2110), (2150, 2230), (1900, 2310), (1560, 2330), (1150, 2230), (900, 2080)) + [towards(PIERS[2]['foot'], T(900, 2080), -40)], 'w': PATH_W},
    # lane -> cafe square (north-south link through the houses)
    {'pts': D((1380, 1300), (1290, 1640), (1330, 2000), (1460, 2200)), 'w': PATH_W},
    # plaza (east) -> the pink road -> east pier
    {'pts': D((3400, 1900), (3700, 1800), (4050, 1760), (4450, 1790), (4800, 1880)) + [towards(PIERS[3]['foot'], T(4800, 1880), -40)], 'w': ROAD_W, 'road': True},
    # road -> pond stalls -> round the pond (west and north) -> north-east pier
    {'pts': D((3700, 1795), (3660, 1560), (3700, 1250), (3800, 1000), (4100, 940), (4450, 990)) + [towards(PIERS[1]['foot'], T(4450, 990), -40)], 'w': PATH_W},
    # garden -> rose meadow
    {'pts': D((3330, 1000), (3500, 920)) + [(4930, 1120)], 'w': PATH_W},
    # plaza (south-east) -> playground
    {'pts': D((3380, 2130), (3650, 2230), (3950, 2270)), 'w': PATH_W},
    # plaza (south) -> beach
    {'pts': D((2900, 2360), (2895, 2560), (2900, 2720)), 'w': PATH_W},
    # plaza -> festival square -> west islet bridge
    {'pts': D((2160, 2240)) + [(3060, 3360), (3150, 3730), (2700, 3700), (BRIDGES[0]['a'][0] + 40, BRIDGES[0]['a'][1] - 120), towards(BRIDGES[0]['a'], (2700, 3700), -30)], 'w': PATH_W},
    # playground -> east islet bridge (the market row stays open beside it)
    {'pts': [(5420, 3400), (5440, 3620), (BRIDGES[1]['a'][0] - 30, BRIDGES[1]['a'][1] - 130), towards(BRIDGES[1]['a'], (5440, 3620), -30)], 'w': PATH_W},
]
# islet paths (bridge end -> islet middle)
for br, isl in zip(BRIDGES, ISLETS):
    PATHS.append({'pts': [towards(br['b'], (isl[0], isl[1]), -20), (isl[0] + (br['b'][0] - isl[0]) * .35, isl[1] + (br['b'][1] - isl[1]) * .35), (isl[0], isl[1] + 20)], 'w': PATH_W - 10})

def path_samples(p, step=20):
    """Densely sampled centre line of a path (follows the smoothed curve closely enough for distances)."""
    pts = p['pts']; closed = p.get('closed', False); n = len(pts)
    P = (lambda i: pts[i % n]) if closed else (lambda i: pts[max(0, min(n - 1, i))])
    out = []
    for i in range(n if closed else n - 1):
        p0, p1, p2, p3 = P(i - 1), P(i), P(i + 1), P(i + 2)
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6); c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        L = math.hypot(p2[0] - p1[0], p2[1] - p1[1]); k = max(2, int(L / step))
        for j in range(k):
            t = j / k; u = 1 - t
            out.append((u ** 3 * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p2[0],
                        u ** 3 * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p2[1]))
    out.append(P(n if closed else n - 1)); return out

SAMPLES = [(path_samples(p), p['w']) for p in PATHS]
def path_dist(x, y):
    """Distance from a point to the nearest path EDGE (negative = on the path)."""
    best = 1e9
    for s, w in SAMPLES:
        for i in range(len(s) - 1):
            if abs(s[i][0] - x) > 600 or abs(s[i][1] - y) > 600: continue
            d = seg_dist(x, y, s[i], s[i + 1]) - w / 2
            if d < best: best = d
    return best

# every deck a Ducky walks over (islet bridges, piers, the harbor jetty), as centre lines with a half width, plus 80 of
# landing at each end: nothing tall may stand in front of these (it would hide a Ducky on the deck)
DECK_LINES = [(towards(b['a'], b['b'], -80), towards(b['b'], b['a'], -80), 42 + 20) for b in BRIDGES] + \
             [(towards(p['foot'], p['tip'], -80), p['tip'], p['width'] / 2 + 20) for p in PIERS]
def hides_deck(x, y, w, h):
    for a, b, hw in DECK_LINES:
        L = math.hypot(b[0] - a[0], b[1] - a[1]); k = max(2, int(L / 20))
        for j in range(k + 1):
            sx, sy = a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k
            for side in (-hw, 0, hw):
                px = sx + side * (-(b[1] - a[1]) / L); py = sy + side * ((b[0] - a[0]) / L)
                if y > py - 10 and y - h * .95 < py and abs(px - x) < w / 2 + 10: return True
    return False

# ---------------------------------------------------------------- ground SVG
def ground_svg():
    r = rnd(11); g = []
    def heart_path(x, y, s):
        return f'M {f(x)} {f(y + s * .35)} C {f(x - s * .1)} {f(y + s * .2)} {f(x - s * .55)} {f(y)} {f(x - s * .5)} {f(y - s * .3)} C {f(x - s * .45)} {f(y - s * .6)} {f(x - s * .05)} {f(y - s * .55)} {f(x)} {f(y - s * .3)} C {f(x + s * .05)} {f(y - s * .55)} {f(x + s * .45)} {f(y - s * .6)} {f(x + s * .5)} {f(y - s * .3)} C {f(x + s * .55)} {f(y)} {f(x + s * .1)} {f(y + s * .2)} {f(x)} {f(y + s * .35)} Z'
    add = g.append
    # sea ripples and offshore ticks (cream, like home)
    ring_out = offset(SAND_EDGE, 260)
    for i in range(320):
        x, y = 150 + halton(i + 1, 2) * (W - 300), 150 + halton(i + 1, 3) * (H - 300)
        if in_poly(x, y, ring_out) or any(in_ell(x, y, c[0], c[1], c[2] + 260, c[3] + 230) for c in ISLETS): continue
        L = 30 + r() * 30; a = (r() - .5) * .3
        add(f'<path d="M {f(x)} {f(y)} q {f(L / 2)} {f(-7 + a * 10)} {f(L)} 0" fill="none" stroke="{CREAM}" stroke-opacity="0.6" stroke-width="2.4" stroke-linecap="round"/>')
    shallow = [SAND_EDGE] + [ell_pts(c[0], c[1], c[2] + 60, c[3] + 60) for c in ISLETS]
    add('<g data-name="Round 4 wet coasts">')
    for s in shallow:
        add(f'<path data-name="Shallow shore" d="{smooth_d(offset(s, 44))}" fill="none" stroke="{CREAM}" stroke-width="80" stroke-opacity="0.14" stroke-linejoin="round"/>')
        add(f'<path data-name="Shore foam" d="{smooth_d(offset(s, 26))}" fill="none" stroke="{CREAM}" stroke-width="18" stroke-opacity="0.55" stroke-linejoin="round"/>')
    add('</g><g data-name="Offshore wave ticks">')
    for s in shallow:
        o = offset(s, 120)
        for i in range(0, len(o), 3 if s is SAND_EDGE else 6):
            x, y = o[i]; nx, ny = o[(i + 1) % len(o)][0] - x, o[(i + 1) % len(o)][1] - y; L = math.hypot(nx, ny) or 1
            add(f'<path d="M {f(x)} {f(y)} l {f(nx / L * 44)} {f(ny / L * 44)}" fill="none" stroke="{CREAM}" stroke-width="3" stroke-opacity="0.45" stroke-linecap="round"/>')
    add('</g>')
    # pink-sand rim, the islets' sand, then grass
    add(f'<g data-name="Sandy coast"><path d="{smooth_d(SAND_EDGE)}" fill="{SAND}"/><path d="{smooth_d(SAND_EDGE)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    for k, (cx, cy, rx, ry) in enumerate(ISLETS):
        sb = blob(cx, cy, rx + 62, ry + 56, 40 + k, 16, .05)
        add(f'<g data-name="Islet sand"><path d="{smooth_d(sb)}" fill="{SAND}"/><path d="{smooth_d(sb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    add(f'<g data-name="Island grass"><path d="{smooth_d(COAST)}" fill="{GRASS}"/>')
    for k, (cx, cy, rx, ry) in enumerate(ISLETS):
        add(f'<path d="{smooth_d(blob(cx, cy, rx, ry, 50 + k, 16, .06))}" fill="{GRASS}"/>')
    add('</g>')
    # two-tone lawns and meadow patches (home's leaf and cream washes)
    add('<g data-name="Round 4 two-tone lawns">')
    inner = offset(COAST, -120)
    for i in range(130):
        x, y = 700 + halton(i + 3, 2) * (W - 1400), 600 + halton(i + 3, 3) * (H - 1200)
        if not in_poly(x, y, inner) or in_open(x, y, 40): continue
        kind = i % 3
        b = blob(x, y, 180 + r() * 260, 110 + r() * 150, 100 + i, 12, .22)
        fill, op = (LEAF, .16) if kind == 0 else (CREAM, .12) if kind == 1 else (LEAF, .25)
        add(f'<path data-name="{"Lawn Leaf" if kind == 0 else "Lawn Cream" if kind == 1 else "Meadow patch"}" d="{smooth_d(b)}" fill="{fill}" fill-opacity="{op}"/>')
    add('</g>')
    # the pink-sand beach at the heart's point, clipped to the island's sand
    bb = blob(*BEACH, 7, 18, .07)
    add(f'<defs><clipPath id="sand-clip"><path d="{smooth_d(SAND_EDGE)}"/></clipPath></defs>')
    add(f'<g data-name="Pink beach" clip-path="url(#sand-clip)"><path d="{smooth_d(bb)}" fill="{SAND}"/>'
        f'<path d="{smooth_d(bb)}" fill="none" stroke="{SAND_SHADE}" stroke-width="14"/><path d="{smooth_d(bb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    # sand pits: playground and the pond bank
    for name, (cx, cy, rx, ry), seed in [('Playground sand', PLAY, 21), ('Pond bank', (POND[0], POND[1], POND[2] + 80, POND[3] + 70), 22)]:
        b = blob(cx, cy, rx, ry, seed, 16, .06)
        add(f'<g data-name="{name}"><path d="{smooth_d(b)}" fill="{SAND}"/><path d="{smooth_d(b)}" fill="none" stroke="{SAND_SHADE}" stroke-width="14"/>'
            f'<path d="{smooth_d(b)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    # open ground for later (boss 6 Nov): mown games lawns, a paved festival square, paved market rows with empty pitches
    for A in ACTIVITY:
        cx, cy = A['c']; rx, ry = A['rx'], A['ry']
        if A['kind'] == 'lawn':
            lb = blob(cx, cy, rx + 30, ry + 24, sum(map(ord, A['id'])) % 97, 18, .05)
            add(f'<g data-name="{A["name"]} (open lawn)"><defs><clipPath id="clip-{A["id"]}"><path d="{smooth_d(lb)}"/></clipPath></defs>')
            add(f'<path d="{smooth_d(lb)}" fill="{LEAF}" fill-opacity="0.22"/>')
            add(f'<g clip-path="url(#clip-{A["id"]})">')
            for k in range(-12, 13, 2):   # mown stripes, gently diagonal
                x0 = cx + k * 70
                add(f'<path d="M {f(x0 - 120)} {f(cy - ry - 60)} L {f(x0 + 70 - 120)} {f(cy - ry - 60)} L {f(x0 + 70 + 120)} {f(cy + ry + 60)} L {f(x0 + 120)} {f(cy + ry + 60)} Z" fill="{CREAM}" fill-opacity="0.20"/>')
            add('</g>')
            add(f'<path d="{smooth_d(offset(lb, -14))}" fill="none" stroke="{CREAM}" stroke-width="12" stroke-opacity="0.9" stroke-dasharray="1 30" stroke-linecap="round"/>')
            add(f'<path d="{smooth_d(lb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.25"/>')
            add('</g>')
    # footpaths: home's four-stroke recipe (leaf halo, ink, shade, core). The road is pink.
    for layer, (col, extra, op) in enumerate([(LEAF, 34, .35), (INK, 18, .6), ('shade', 14, 1), ('core', 0, 1)]):
        add(f'<g data-name="Continuous footpaths" fill="none" stroke-linecap="round" stroke-linejoin="round">')
        for p in PATHS:
            c = col if col not in ('shade', 'core') else ((ROAD_SHADE if p.get('road') else PATH_SHADE) if col == 'shade' else (ROAD if p.get('road') else PATH))
            add(f'<path d="{smooth_d(p["pts"], p.get("closed", False))}" stroke="{c}" stroke-width="{p["w"] + extra}" stroke-opacity="{op}"/>')
        add('</g>')
    # road dashes (cream) down the pink road
    road = next(p for p in PATHS if p.get('road'))
    s = path_samples(road, 12)
    for i in range(6, len(s) - 8, 9):
        a, b = s[i], s[i + 3]
        add(f'<path d="M {f(a[0])} {f(a[1])} L {f(b[0])} {f(b[1])}" stroke="{CREAM}" stroke-width="9" stroke-linecap="round" stroke-opacity="0.9"/>')
    for A in [A for A in ACTIVITY if A['kind'] == 'square']:
        cx, cy = A['c']; rx, ry = A['rx'], A['ry']
        if True:
            add(f'<g data-name="{A["name"]} (open paved square)">')
            add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{rx + 26}" ry="{ry + 22}" fill="{LEAF}" fill-opacity="0.35"/>')
            add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{rx}" ry="{ry}" fill="{PINK}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
            add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{rx - 20}" ry="{ry - 16}" fill="{PAVE}" stroke="{PAVE_JOINT}" stroke-width="10"/>')
            for k in range(1, 5):
                q = k / 5
                add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f((rx - 20) * q)}" ry="{f((ry - 16) * q)}" fill="none" stroke="{PAVE_JOINT}" stroke-width="5"/>')
            for k in range(28):
                t = 2 * math.pi * k / 28; q0 = .2 * (1 + k % 2)
                add(f'<path d="M {f(cx + math.cos(t) * (rx - 20) * q0)} {f(cy + math.sin(t) * (ry - 16) * q0)} L {f(cx + math.cos(t) * (rx - 24))} {f(cy + math.sin(t) * (ry - 20))}" stroke="{PAVE_JOINT}" stroke-width="5" stroke-linecap="round"/>')
            add(f'<path d="{heart_path(cx, cy + 20, 120)}" fill="{PINK}" fill-opacity="0.55" stroke="{SAND_SHADE}" stroke-width="5"/>')
            add('</g>')
    for s in STALLS:
        add(f'<g data-name="{s["name"]} (open stall row)">')
        add(f'<path d="{smooth_d(stall_poly(s, 22))}" fill="{LEAF}" fill-opacity="0.35"/>')
        add(f'<path d="{smooth_d(stall_poly(s))}" fill="{PINK}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
        add(f'<path d="{smooth_d(stall_poly(s, -18))}" fill="{PAVE}" stroke="{PAVE_JOINT}" stroke-width="8"/>')
        (cx, cy), L, Dp, a = s['c'], s['len'], s['depth'], s['ang']; ca, sa = math.cos(a), math.sin(a)
        n = max(3, round((L - Dp) / 200))
        for k in range(n + 1):   # pitch joints across the row, one pitch per stall
            u = -(L - Dp) / 2 + (L - Dp) * k / n
            for v0, v1 in [(-(Dp / 2 - 22), Dp / 2 - 22)]:
                add(f'<path d="M {f(cx + u * ca - v0 * sa)} {f(cy + u * sa + v0 * ca)} L {f(cx + u * ca - v1 * sa)} {f(cy + u * sa + v1 * ca)}" stroke="{PAVE_JOINT}" stroke-width="6" stroke-linecap="round"/>')
        add(f'<path d="M {f(cx - (L / 2 - 30) * ca)} {f(cy - (L / 2 - 30) * sa)} L {f(cx + (L / 2 - 30) * ca)} {f(cy + (L / 2 - 30) * sa)}" stroke="{PAVE_JOINT}" stroke-width="4" stroke-dasharray="18 22" stroke-linecap="round"/>')
        add('</g>')
    # squares: cream paving with a scalloped pink kerb and stone joints
    for name, (cx, cy, rx, ry) in [('Ribbon plaza', PLAZA), ('Cafe square', SQUARE)]:
        add(f'<g data-name="{name}">')
        add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx + 30}" ry="{ry + 26}" fill="{LEAF}" fill-opacity="0.35"/>')
        n = int(2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) / 70)
        for k in range(n):   # scallops round the edge
            t = 2 * math.pi * k / n
            add(f'<ellipse cx="{f(cx + math.cos(t) * (rx + 4))}" cy="{f(cy + math.sin(t) * (ry + 3))}" rx="40" ry="32" fill="{PINK}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
        add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="{PINK}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
        add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx - 22}" ry="{ry - 18}" fill="{PAVE}" stroke="{PAVE_JOINT}" stroke-width="10"/>')
        for k in range(1, 4):   # rings of flagstones
            q = k / 4
            add(f'<ellipse cx="{cx}" cy="{cy}" rx="{f((rx - 22) * q)}" ry="{f((ry - 18) * q)}" fill="none" stroke="{PAVE_JOINT}" stroke-width="5"/>')
        for k in range(24):
            t = 2 * math.pi * (k + .5 * (k % 2)) / 24; q0 = .25 + .25 * (k % 3 == 0)
            add(f'<path d="M {f(cx + math.cos(t) * (rx - 22) * q0)} {f(cy + math.sin(t) * (ry - 18) * q0)} L {f(cx + math.cos(t) * (rx - 26))} {f(cy + math.sin(t) * (ry - 22))}" stroke="{PAVE_JOINT}" stroke-width="5" stroke-linecap="round"/>')
        add(f'<ellipse cx="{cx - rx * .25}" cy="{cy - ry * .35}" rx="{rx * .4}" ry="{ry * .22}" fill="#FFFFFF" fill-opacity="0.18"/>')
        add('</g>')
    # the lily pond: water, shade, cream edge line (home's lake recipe)
    cx, cy, rx, ry = POND
    pb = blob(cx, cy, rx, ry, 31, 18, .05)
    add(f'<g data-name="Lake water"><path d="{smooth_d(pb)}" fill="{SEA}"/>'
        f'<path d="{smooth_d(blob(cx + 40, cy + 30, rx * .92, ry * .86, 31, 18, .05))}" fill="{INK}" fill-opacity="0.15"/>'
        f'<path d="{smooth_d(blob(cx - 10, cy - 8, rx * .9, ry * .84, 31, 18, .05))}" fill="{SEA}"/>'
        f'<path d="{smooth_d(offset(pb, -16))}" fill="none" stroke="{CREAM}" stroke-width="2.5"/>'
        f'<path d="{smooth_d(pb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    for i in range(7):   # little ripples on the pond
        x, y = cx - rx * .6 + halton(i + 1, 2) * rx * 1.2, cy - ry * .5 + halton(i + 1, 3) * ry
        add(f'<path d="M {f(x)} {f(y)} q 14 -6 28 0" fill="none" stroke="{CREAM}" stroke-width="2.4" stroke-opacity="0.7" stroke-linecap="round"/>')
    # hopscotch hearts in the playground and a heart drawn in the beach sand
    for k, (hx, hy) in enumerate([(PLAY[0] - 300 + 90 * j, PLAY[1] + 230 + 50 * (j % 2)) for j in range(6)]):
        add(f'<path d="{heart_path(hx, hy, 70)}" fill="{PINK if k % 2 else HOT}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
    add(f'<path d="{heart_path(*T(2620, 3180), 170)}" fill="none" stroke="{SAND_SHADE}" stroke-width="9" stroke-linecap="round"/>')
    return g

def svg_doc(body, vb, title):
    x, y, w, h = vb
    return (f"<?xml version='1.0' encoding='utf-8'?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"{x} {y} {w} {h}\">\n"
            f"<title>{title}</title>\n<desc>Original Ducky Land vector artwork: Pink Dollhouse Town ground (scripts/themes/pink-build.py).</desc>\n" + '\n'.join(body) + '\n</svg>\n')

# ---------------------------------------------------------------- jetties (home's drawJetty, src/pixi/harbor.js, as SVG)
WOOD, DARK_WOOD = '#C88941', '#885931'
def jetty_svg(p, moorings=()):
    x, y = p['foot']; L = p['length']; hw = p['width'] / 2; dx, dy = p['dir']; nx, ny = -dy, dx
    at = lambda t, side=0: (x + dx * t + nx * side, y + dy * t + ny * side)
    wet0 = L * .14; railTo = .42; out = []
    poly = lambda pts, extra: out.append(f'<path d="M ' + ' L '.join(f'{f(a)} {f(b)}' for a, b in pts) + f' Z" {extra}/>')
    line = lambda a, b, extra: out.append(f'<path d="M {f(a[0])} {f(a[1])} L {f(b[0])} {f(b[1])}" {extra}/>')
    ol = f'stroke="{INK}" stroke-width="2.22" stroke-linejoin="round"'
    corners = [at(0, -hw), at(L, -hw), at(L, hw), at(0, hw)]
    poly([(a + 7, b + 16) for a, b in [at(wet0, -hw), at(L, -hw), at(L, hw), at(wet0, hw)]], f'fill="{INK}" fill-opacity="0.14"')
    piles = max(1, round((L - wet0) / 72))
    for i in range(piles + 1):
        for side in (-hw + 6, hw - 6):
            px, py = at(wet0 + (L - wet0 - 8) * i / piles, side)
            out.append(f'<ellipse cx="{f(px)}" cy="{f(py + 34)}" rx="12" ry="4.6" fill="{INK}" fill-opacity="0.12"/>')
            out.append(f'<rect x="{f(px - 4.5)}" y="{f(py - 6)}" width="9" height="40" fill="{DARK_WOOD}" {ol}/>')
            out.append(f'<ellipse cx="{f(px)}" cy="{f(py + 34)}" rx="11" ry="4.2" fill="none" stroke="{CREAM}" stroke-width="1.6" stroke-opacity="0.9"/>')
    T = 11
    face = lambda a, b: poly([a, b, (b[0], b[1] + T), (a[0], a[1] + T)], f'fill="{DARK_WOOD}" {ol}')
    if -ny > .05: face(corners[0], corners[1])
    if ny > .05: face(corners[3], corners[2])
    if dy > .05: face(corners[1], corners[2])
    poly(corners, f'fill="{WOOD}" {ol}')
    for side in (-hw + 7, hw - 7): line(at(4, side), at(L - 4, side), f'stroke="{DARK_WOOD}" stroke-width="1.6" stroke-opacity="0.8"')
    t, i = 20, 0
    while t < L - 6:
        line(at(t, -hw + 2), at(t, hw - 2), f'stroke="{INK}" stroke-width="1.11"')
        if i % 3 == 1:
            sd = (-1 if i % 2 else 1) * hw * .3
            line(at(t + 11, sd), at(t + 11, sd + 18), f'stroke="{DARK_WOOD if i % 6 == 1 else INK}" stroke-width="1.11"')
        t += 22; i += 1
    railEnd = L * railTo; posts = max(1, round(railEnd / 66)); Hh = 30
    for side in (-hw + 3, hw - 3):
        tops = []
        for k in range(posts + 1):
            px, py = at(8 + (railEnd - 8) * k / posts, side)
            out.append(f'<rect x="{f(px - 4.5)}" y="{f(py - Hh)}" width="9" height="{Hh}" fill="{WOOD}" {ol}/>')
            tops.append((px, py - Hh + 3))
        dd = 'M ' + ' L '.join(f'{f(a)} {f(b)}' for a, b in tops)
        out.append(f'<path d="{dd}" fill="none" stroke="{INK}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>')
        out.append(f'<path d="{dd}" fill="none" stroke="{WOOD}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>')
        for a, b in tops: out.append(f'<rect x="{f(a - 6.5)}" y="{f(b - 5.5)}" width="13" height="5" rx="1.7" fill="{DARK_WOOD}" {ol}/>')
    for m in moorings:   # a bollard beside each berth
        along = (m[0] - x) * dx + (m[1] - y) * dy; lat = (m[0] - x) * nx + (m[1] - y) * ny
        if abs(lat) > hw + 260: continue
        tip = along > L - 30; side = (1 if lat >= 0 else -1) * (hw - 10)
        px, py = at(L - 10 if tip else max(wet0 + 10, min(L - 30, along)), side)
        out.append(f'<ellipse cx="{f(px)}" cy="{f(py + 1)}" rx="9" ry="3.5" fill="{INK}" fill-opacity="0.2"/>')
        out.append(f'<rect x="{f(px - 6)}" y="{f(py - 15)}" width="12" height="16" rx="3" fill="{DARK_WOOD}" {ol}/>')
        out.append(f'<ellipse cx="{f(px)}" cy="{f(py - 15)}" rx="7.5" ry="3.2" fill="{WOOD}" {ol}/>')
    allp = [tuple(map(float, m)) for m in re.findall(r'(-?\d+\.?\d*) (-?\d+\.?\d*)', ' '.join(out))]
    xs = [a for a, b in allp] + [c[0] for c in corners]; ys = [b for a, b in allp] + [c[1] for c in corners]
    x0, y0, x1, y1 = math.floor(min(xs) - 20), math.floor(min(ys) - 40), math.ceil(max(xs) + 20), math.ceil(max(ys) + 50)
    return svg_doc(out, (x0, y0, x1 - x0, y1 - y0), f'Pink pier {p["name"]}'), (x0, y0, x1 - x0, y1 - y0)

# ---------------------------------------------------------------- boats: three at the harbor, one at each other pier, one off each islet
def berth(p, t, side):
    x, y = p['foot']; dx, dy = p['dir']; return (x + dx * t - dy * side, y + dy * t + dx * side)
BOATS = []
h = PIERS[0]
for t, side in [(h['length'] * .62, 150), (h['length'] * .78, -150), (h['length'] * .95, 155)]:
    bx, by = berth(h, t, side); BOATS.append({'x': round(bx), 'y': round(by), 'turn': 3.14159})
for p in PIERS[1:]:
    bx, by = berth(p, p['length'] * .8, 150 if p['dir'][0] > 0 else -150)
    BOATS.append({'x': round(bx), 'y': round(by), 'turn': 1.5708 if p['dir'][0] > 0 else -1.5708})
for (cx, cy, rx, ry), sgn in zip(ISLETS, (-1, 1)):
    BOATS.append({'x': round(cx + sgn * (rx + 150)), 'y': round(cy + 40), 'turn': sgn * 1.5708})

# ---------------------------------------------------------------- props
DET = 'detail/'
SIZES = {}   # name -> (w, h, anchor y) from the traced SVGs
for fn in os.listdir(os.path.join(ART, 'detail')):
    if fn.endswith('.svg'):
        s = open(os.path.join(ART, 'detail', fn)).read(2000)
        m = re.search(r'width="(\d+)" height="(\d+)"', s)
        SIZES[fn[:-4]] = (int(m.group(1)), int(m.group(2)))
HOME_PLANTS = {'tree-1': (260, 360), 'tree-3': (300, 380), 'tree-4': (200, 280), 'bush-2': (168, 110), 'bush-5': (170, 110),
               'bush-1': (130, 100), 'flower-1': (48, 36), 'flower-2': (48, 36), 'flower-3': (44, 36)}

# world height of each kind, in world units (one Ducky = 130). Width follows the art.
TALL = {'dollhouse-pink': 560, 'dollhouse-lilac': 520, 'cottage-pink': 400, 'teacup-cafe': 470, 'ribbon-plinth': 560, 'gazebo': 470,
        'heart-arch': 400, 'heart-hedge': 150, 'bow-bench': 140, 'parasol': 290, 'tree-cherry': 430, 'tree-willow': 500,
        'play-tower': 420, 'swing-set': 290, 'candy-cart': 310, 'pink-car': 175, 'lamp-heart': 230, 'bush-pink': 125,
        'lounger': 140, 'flowers-pink': 70, 'picnic-blanket': 150, 'sandcastle-pink': 120, 'mailbox': 140, 'swim-ring': 95}
NAMES = {'dollhouse-pink': 'Pink dollhouse', 'dollhouse-lilac': 'Lilac dollhouse', 'cottage-pink': 'Rose cottage', 'teacup-cafe': 'Teacup cafe',
         'ribbon-plinth': 'Ribbon sculpture', 'gazebo': 'Gazebo', 'heart-arch': 'Heart arch swing', 'heart-hedge': 'Heart hedge bush',
         'bow-bench': 'Bow bench', 'parasol': 'Pink parasol', 'tree-cherry': 'Cherry tree', 'tree-willow': 'Pink willow tree',
         'play-tower': 'Slide tower', 'swing-set': 'Swing set', 'candy-cart': 'Candy floss cart', 'pink-car': 'Pink car',
         'lamp-heart': 'Heart lamp', 'bush-pink': 'Rose bush', 'lounger': 'Sun lounger', 'flowers-pink': 'Tulip flowers',
         'picnic-blanket': 'Picnic blanket', 'sandcastle-pink': 'Sandcastle', 'mailbox': 'Heart mailbox', 'swim-ring': 'Swim ring',
         'tree-1': 'Oak tree', 'tree-3': 'Round tree', 'tree-4': 'Bushy tree', 'bush-1': 'Green bush', 'bush-2': 'Green bush', 'bush-5': 'Green bush',
         'flower-1': 'Flower', 'flower-2': 'Flower', 'flower-3': 'Flower'}
PLANT_SCALE = {'tree': 1.27, 'bush': 1.3, 'flower': 1.6}   # home: PLANT_SCALE x the tree row of the scale sheet

PROPS = []; FOOT = []; WARN = []
def footprint_for(kind, x, y, w):
    if kind.startswith('tree'): return {'x': x, 'y': y - 9, 'rx': 31, 'ry': 22}
    if kind in ('dollhouse-pink', 'dollhouse-lilac', 'cottage-pink', 'teacup-cafe'):
        return {'poly': [[round(x - w * .43), round(y - w * .3)], [round(x + w * .43), round(y - w * .3)], [round(x + w * .43), round(y - 6)], [round(x - w * .43), round(y - 6)]]}
    if kind in ('ribbon-plinth', 'gazebo'): return {'x': x, 'y': round(y - w * .17), 'rx': round(w * .42), 'ry': round(w * .17)}
    if kind == 'heart-arch': return None   # the two pots are added below, so Duckies walk under the arch
    if kind == 'swing-set': return None
    if kind == 'play-tower': return {'x': x, 'y': y - 30, 'rx': round(w * .3), 'ry': 40}
    if kind in ('bush-pink', 'heart-hedge') or kind.startswith('bush-'): return {'x': x, 'y': y - 12, 'rx': round(w * .36), 'ry': 24}
    if kind == 'bow-bench': return {'x': x, 'y': y - 10, 'rx': 62, 'ry': 22}
    if kind == 'candy-cart': return {'x': x, 'y': y - 20, 'rx': round(w * .4), 'ry': 34}
    if kind == 'pink-car': return {'x': x, 'y': y - 34, 'rx': round(w * .44), 'ry': 44}
    if kind == 'lamp-heart': return {'x': x, 'y': y - 6, 'rx': 16, 'ry': 14}
    if kind in ('parasol', 'mailbox'): return {'x': x, 'y': y - 6, 'rx': 14, 'ry': 12}
    if kind == 'lounger': return {'x': x, 'y': y - 26, 'rx': round(w * .38), 'ry': 30}
    if kind == 'sandcastle-pink': return {'x': x, 'y': y - 18, 'rx': round(w * .4), 'ry': 26}
    return None

def size_of(kind, scale_k=1):
    if kind in HOME_PLANTS:
        w0, h0 = HOME_PLANTS[kind]; return w0, h0, PLANT_SCALE[kind.split('-')[0]] * scale_k
    w0, h0 = SIZES[kind]; return w0, h0, TALL[kind] / h0 * scale_k

def put(kind, x, y, zone, flip=False, scale_k=1, solid=True, pid=None, quiet=False):
    """Place a prop at WORLD (x, y). A prop that would stand in front of a bridge, pier or jetty is refused."""
    w0, h0, sc = size_of(kind, scale_k)
    if kind in HOME_PLANTS: src = f'/pixi-art/plants/{kind}.svg'; anchor = {'x': .5, 'y': 1}
    else: src = DET + kind + '.svg'; anchor = {'x': .5, 'y': .99}
    x, y = round(x), round(y)
    if hides_deck(x, y, w0 * sc, h0 * sc):
        if not quiet: WARN.append(f'{pid or kind} at ({x},{y}) would hide a deck: left out')
        return None
    p = {'id': pid or f'{kind}-{len(PROPS)}', 'name': NAMES[kind], 'src': src, 'x': x, 'y': y, 'width': w0, 'height': h0,
         'anchor': anchor, 'scale': round(sc, 4), 'flip': flip, 'zone': zone, 'kind': kind}
    PROPS.append(p)
    if solid:
        fp = footprint_for(kind, x, y, w0 * sc)
        if fp: FOOT.append(fp)
        if kind == 'heart-arch':
            for s in (-1, 1): FOOT.append({'x': round(x + s * w0 * sc * .4), 'y': y - 14, 'rx': 30, 'ry': 22})
        if kind == 'swing-set':
            for s in (-1, 1): FOOT.append({'x': round(x + s * w0 * sc * .42), 'y': y - 10, 'rx': 26, 'ry': 18})
    return p
def putd(kind, dx, dy, zone, **kw):   # at a DESIGN point
    return put(kind, *T(dx, dy), zone, **kw)

# landmarks and furniture, by zone. The plaza furniture keeps its share of the (much bigger) plaza.
px_, py_, prx, pry = PLAZA
pp = lambda u, v: (px_ + u * prx, py_ + v * pry)
put('ribbon-plinth', px_, py_ + 40, 'plaza', pid='ribbon-sculpture')
for u, v in [(-.62, -.42), (.62, -.42), (-.74, .38), (.74, .38)]:
    put('lamp-heart', *pp(u, v), 'plaza')
for u, v, fl in [(-.42, .70, False), (.42, .70, True), (-.84, -.02, False), (.84, -.02, True)]:
    put('bow-bench', *pp(u, v), 'plaza', flip=fl)
for u, v in [(-.36, -.66), (.36, -.66)]:
    put('heart-hedge', *pp(u, v), 'plaza', scale_k=.9)
put('candy-cart', *pp(.60, -.80), 'plaza', pid='plaza-candy-cart')

# heart garden: the arch swing in the middle of the heart path, heart hedges round it
gx, gy = GARDEN
put('heart-arch', gx, gy + 40, 'heart-garden', pid='heart-arch')
for dx, dy in [(-260, -120), (260, -120), (-200, 170), (200, 170), (0, 300)]:
    put('heart-hedge', gx + dx * SX, gy + dy * SY, 'heart-garden', scale_k=1.05)
for dx, dy in [(-520, 120), (520, 120), (-430, -250), (430, -250)]:
    put('heart-hedge', gx + dx * SX, gy + dy * SY, 'heart-garden', scale_k=.9)
put('bow-bench', gx - 200, gy + 640, 'heart-garden'); put('bow-bench', gx + 200, gy + 640, 'heart-garden', flip=True)
put('lamp-heart', gx - 200, gy + 860, 'heart-garden'); put('lamp-heart', gx + 200, gy + 860, 'heart-garden')

# dollhouse street: two rows facing the lane
putd('dollhouse-pink', 1520, 1240, 'dollhouses', pid='dollhouse-1')
putd('dollhouse-lilac', 2020, 1290, 'dollhouses', pid='dollhouse-2')
putd('cottage-pink', 1060, 1080, 'dollhouses', flip=True, pid='dollhouse-3')
putd('cottage-pink', 1640, 1760, 'dollhouses', pid='dollhouse-4')
putd('dollhouse-pink', 1000, 1740, 'dollhouses', flip=True, scale_k=.92, pid='dollhouse-5')
putd('dollhouse-lilac', 2160, 1890, 'dollhouses', flip=True, scale_k=.9, pid='dollhouse-6')
for x, y in [(1340, 1320), (1780, 1340), (2260, 1400), (1215, 1830), (1860, 1820)]:
    putd('mailbox', x, y, 'dollhouses')
for x, y in [(1600, 1500), (2400, 1520)]:
    putd('lamp-heart', x, y, 'dollhouses')

# cafe square
cx_, cy_, crx, cry = SQUARE
putd('teacup-cafe', 1400, 2130, 'cafe', pid='teacup-cafe')
for u, v in [(.0, .25), (.5, .02), (.38, .62)]:
    put('parasol', cx_ + u * crx, cy_ + v * cry, 'cafe')
put('candy-cart', cx_ + .78 * crx, cy_ - .55 * cry, 'cafe', pid='cafe-candy-cart')
put('bow-bench', cx_ - .55 * crx, cy_ + .6 * cry, 'cafe'); put('bow-bench', cx_ + .8 * crx, cy_ + .45 * cry, 'cafe', flip=True)
put('lamp-heart', cx_ - .95 * crx, cy_ + .2 * cry, 'cafe'); put('lamp-heart', cx_ + .95 * crx, cy_ - .2 * cry, 'cafe')

# pond: willow, benches on the south bank, the pink car in its own parking bay on the road
pdx, pdy, prx_, pry_ = POND
put('tree-willow', pdx + prx_ + 130, pdy - 40, 'pond', pid='pond-willow')
put('tree-willow', pdx - prx_ - 90, pdy + 190, 'pond', flip=True, scale_k=.85, pid='pond-willow-2')
put('bow-bench', pdx - 200, pdy + pry_ + 150, 'pond'); put('bow-bench', pdx + 200, pdy + pry_ + 150, 'pond', flip=True)
put('lamp-heart', pdx - 360, pdy + pry_ + 130, 'pond'); put('lamp-heart', pdx + 360, pdy + pry_ + 130, 'pond')
road_y = lambda x: min((p for p in path_samples(next(q for q in PATHS if q.get('road')), 10)), key=lambda p: abs(p[0] - x))[1]
CAR_X = T(4700, 0)[0]
put('pink-car', CAR_X, road_y(CAR_X) - ROAD_W / 2 - 60, 'road', pid='pink-car')

# playground
plx, ply, plrx, plry = PLAY
put('play-tower', plx + .35 * plrx, ply - .05 * plry, 'playground', pid='slide-tower')
put('swing-set', plx - .35 * plrx, ply - .18 * plry, 'playground', pid='swing-set')
put('bow-bench', plx - .72 * plrx, ply + .55 * plry, 'playground'); put('bow-bench', plx + .62 * plrx, ply + .62 * plry, 'playground', flip=True)
put('lamp-heart', plx - .95 * plrx, ply - .3 * plry, 'playground')

# beach: parasols, loungers, sandcastle, swim ring
for x, y in [(2560, 2930), (3160, 2880), (2840, 3260), (3380, 3170)]:
    putd('parasol', x, y, 'beach')
for x, y, fl in [(2650, 2990, False), (3060, 2950, True), (2940, 3330, False), (3290, 3240, True)]:
    putd('lounger', x, y, 'beach', flip=fl)
putd('sandcastle-pink', 2700, 3420, 'beach', pid='sandcastle')
putd('swim-ring', 3120, 3440, 'beach', solid=False)
putd('swim-ring', 2420, 3140, 'beach', solid=False, scale_k=.9)

# islets: picnic (west) and the gazebo (east). Trees stand on the far side, never in front of the bridge or its landing.
(lx, ly, lrx, lry), (ex, ey, erx, ery) = ISLETS
put('picnic-blanket', lx - 40, ly + 90, 'islets', solid=False)
put('tree-cherry', lx - 320, ly + 30, 'islets', pid='islet-cherry-1'); put('bush-pink', lx - 110, ly + 250, 'islets')
put('bow-bench', lx + 200, ly + 150, 'islets', flip=True)
put('gazebo', ex + 230, ey + 210, 'islets', pid='islet-gazebo')
put('tree-cherry', ex + 330, ey - 60, 'islets', flip=True, pid='islet-cherry-3'); put('bush-pink', ex - 300, ey + 150, 'islets')
put('bow-bench', ex - 200, ey + 230, 'islets')

# open-ground edges: a lamp at each end of every stall row, nothing inside them
for s in STALLS:
    (sx, sy), L = s['c'], s['len']
    for sg in (-1, 1): put('lamp-heart', sx + sg * (L / 2 + 50), sy + 10, 'stalls')

# ---------------------------------------------------------------- sleeper props (boss 6 Nov: home's 28 sleeping Duckies)
# The four 'nod' trees a Ducky dozes against (sleepSpots.nod names them), hammock trees, a rock bush or two: standing where
# the sleepers lie, away from paths. Placed BEFORE the scatter so the scatter keeps clear of them.
SLEEP_TREES = [('nod-tree-1', 'tree-cherry', (1140, 2160)), ('nod-tree-2', 'tree-1', T(3420, 620)),
               ('nod-tree-3', 'tree-cherry', T(4730, 1560)), ('nod-tree-4', 'tree-3', T(2280, 1960))]
for pid, kind, (x, y) in SLEEP_TREES: put(kind, x, y, 'woods', pid=pid, flip=pid.endswith(('2', '4')))
# a starter stall cart beside each stall row (outside it: the row itself stays open), where a Ducky naps over its book
for k, s in enumerate(STALLS[:2]):   # (the road stalls keep clear of the pink car: no cart there)
    (sx, sy), L = s['c'], s['len']
    put('candy-cart', sx + (L / 2 + 230) * (1 if k == 2 else -1), sy + 60, 'stalls', flip=k != 2, pid=f'stall-cart-{k + 1}')
# two more loungers at the beach ends, so the deck-chair sleepers lie far apart like home's
putd('lounger', 2330, 3010, 'beach', pid='lounger-west'); putd('lounger', 3470, 3010, 'beach', flip=True, pid='lounger-east')

# ---------------------------------------------------------------- scatter: trees, bushes, flowers (spread out, not crowded)
KEEP_OUT = [(PLAZA[0], PLAZA[1], PLAZA[2] + 100, PLAZA[3] + 90), (SQUARE[0], SQUARE[1], SQUARE[2] + 80, SQUARE[3] + 70),
            (POND[0], POND[1], POND[2] + 170, POND[3] + 170), (PLAY[0], PLAY[1], PLAY[2] + 60, PLAY[3] + 60),
            (BEACH[0], BEACH[1], BEACH[2] + 60, BEACH[3] + 60), (GARDEN[0], GARDEN[1] + 60, 740, 640), (CAR_X, road_y(CAR_X) - 170, 300, 170)]
def occupied(x, y, r):
    for p in PROPS:
        w = p['width'] * p['scale']; pr = max(40, w * .45)
        if math.hypot(x - p['x'], (y - p['y']) * 1.4) < pr + r: return True
    return False
def free(x, y, r, pad=20, coast_in=140, h=0):
    if not in_poly(x, y, COAST_IN[coast_in]): return False
    if any(in_ell(x, y, *k) for k in KEEP_OUT) or in_open(x, y, 90): return False
    for _, _, (nx, ny) in SLEEP_TREES:   # nor in front of a nod tree, where a Ducky dozes against the trunk
        if h and y > ny - 10 and y - h * .95 < ny + 14 and abs(x - nx) < r + 90: return False
    for t in (.35, .7, .95):   # the sprite must not stand over open ground or a square either (the camera looks down at 3/4)
        if h and (in_open(x, y - h * t, 30) or any(in_ell(x, y - h * t, *k) for k in KEEP_OUT[:2] + KEEP_OUT[-1:])): return False
    if path_dist(x, y) < r * .5 + pad: return False
    if any(math.hypot(x - p['foot'][0], y - p['foot'][1]) < 300 for p in PIERS): return False
    if any(seg_dist(x, y, b['a'], towards(b['a'], b['b'], -240)) < 220 or math.hypot(x - b['b'][0], y - b['b'][1]) < 260 for b in BRIDGES): return False
    for p in PROPS:   # never stand in front of a building's door side
        if p['kind'] in BUILDINGS and 0 < y - p['y'] < 340 and abs(x - p['x']) < p['width'] * p['scale'] * .55 + r * .5: return False
    return not occupied(x, y, r)
BUILDINGS = {'dollhouse-pink', 'dollhouse-lilac', 'cottage-pink', 'teacup-cafe', 'gazebo', 'play-tower', 'candy-cart'}
COAST_IN = {140: offset(COAST, -140), 90: offset(COAST, -90), 60: offset(COAST, -60)}

kinds_tree = ['tree-cherry', 'tree-1', 'tree-cherry', 'tree-3', 'tree-cherry', 'tree-4', 'tree-1']
n_tree = n_bush = n_flower = 0
X0, XW, Y0, YH = 700, W - 1400, 560, H - 1100
for i in range(1, 14000):
    x, y = X0 + halton(i, 2) * XW, Y0 + halton(i, 3) * YH
    d_coast = poly_dist(x, y, COAST)
    # trees ring the coast (groves, with gaps) and dot the lawns; they need room round them
    if n_tree < 40 and (d_coast < 760 or halton(i, 5) < .16) and free(x, y, 110, 46, h=470) \
            and not any(p['kind'] in BUILDINGS and math.hypot(x - p['x'], (y - p['y']) * 1.3) < 430 for p in PROPS):
        k = kinds_tree[i % len(kinds_tree)]
        if put(k, x, y, 'woods', flip=bool(i % 2), scale_k=.9 + .2 * halton(i, 7), quiet=True): n_tree += 1
for i in range(1, 16000):
    x, y = X0 + halton(i + 17000, 2) * XW, Y0 + halton(i + 17000, 3) * YH
    pd = path_dist(x, y)
    if n_bush < 26 and 40 < pd < 260 and free(x, y, 80, 30, 90, h=150):   # bushes line the paths, in small clumps with gaps
        k = ['bush-pink', 'bush-2', 'bush-pink', 'heart-hedge', 'bush-pink', 'bush-5'][i % 6]
        if put(k, x, y, 'gardens', flip=bool(i % 2), scale_k=.85 + .3 * halton(i, 7), quiet=True): n_bush += 1
for i in range(1, 12000):
    x, y = X0 + halton(i + 20000, 2) * XW, Y0 + halton(i + 20000, 3) * YH
    if n_flower < 130 and free(x, y, 40, 14, 60):
        k = ['flowers-pink', 'flower-1', 'flowers-pink', 'flower-2', 'flower-3'][i % 5]
        if put(k, x, y, 'gardens', flip=bool(i % 2), solid=False, scale_k=.85 + .3 * halton(i, 7), quiet=True): n_flower += 1
# flowers on the islets too
for (cx, cy, rx, ry), seed in zip(ISLETS, (3, 9)):
    for k in range(6):
        a = halton(k + seed, 2) * 6.28; x, y = cx + math.cos(a) * rx * .72, cy + math.sin(a) * ry * .64
        if not occupied(x, y, 30): put('flowers-pink' if k % 2 else 'flower-3', x, y, 'islets', solid=False, quiet=True)

# ---------------------------------------------------------------- ground decals (flats): home's tufts, flower dots, pebbles, sand specks
DEC = {'grass-tuft-1': (44, 26), 'grass-tuft-2': (34, 22), 'grass-tuft-3': (56, 24), 'flower-dot-1': (20, 18), 'flower-dot-2': (26, 18),
       'flower-dot-3': (22, 16), 'pebble-1': (22, 14), 'pebble-2': (34, 16), 'pebble-3': (28, 18), 'sand-speck-1': (16, 8), 'sand-speck-2': (22, 10)}
def on_sand(x, y):
    return (in_poly(x, y, SAND_EDGE) and not in_poly(x, y, COAST)) or in_ell(x, y, *BEACH) or in_ell(x, y, *PLAY)
FLATS = []
for i in range(1, 6000):
    x, y = 600 + halton(i + 40000, 2) * (W - 1200), 520 + halton(i + 40000, 3) * (H - 1000)
    if not in_poly(x, y, WALK_COAST) or path_dist(x, y) < 10 or in_ell(x, y, PLAZA[0], PLAZA[1], PLAZA[2] + 40, PLAZA[3] + 40) \
       or in_ell(x, y, SQUARE[0], SQUARE[1], SQUARE[2] + 40, SQUARE[3] + 40) or in_ell(x, y, POND[0], POND[1], POND[2] + 30, POND[3] + 30) \
       or any(in_ell(x, y, *A['c'], A['rx'] + 20, A['ry'] + 20) for A in ACTIVITY if A['kind'] == 'square') or any(in_stall(x, y, s, 20) for s in STALLS): continue
    pick = halton(i, 7)
    if on_sand(x, y): kind = 'sand-speck-1' if pick < .5 else 'sand-speck-2'
    else: kind = ['grass-tuft-1', 'grass-tuft-2', 'grass-tuft-3', 'flower-dot-1', 'flower-dot-2', 'flower-dot-3', 'pebble-1', 'grass-tuft-1', 'flower-dot-2', 'pebble-2'][int(pick * 10)]
    k = 1.6
    FLATS.append({'src': f'/pixi-art/decals/{kind}.svg', 'x': round(x), 'y': round(y), 'width': round(DEC[kind][0] * k), 'height': round(DEC[kind][1] * k), 'flip': halton(i, 11) > .5})
    if len(FLATS) >= 1000: break
for k in range(10):
    a = halton(k + 1, 2) * 6.28; r_ = .35 + .45 * halton(k + 1, 3)
    x, y = POND[0] + math.cos(a) * POND[2] * r_, POND[1] + math.sin(a) * POND[3] * r_
    vb = re.search(r'viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"', open(os.path.join(ROOT, f'public/pixi-art/lily-0{k % 8}.svg')).read(800)).groups()
    FLATS.append({'src': f'/pixi-art/lily-0{k % 8}.svg', 'x': round(x), 'y': round(y), 'width': round(float(vb[2])), 'height': round(float(vb[3])), 'flip': False})

# ---------------------------------------------------------------- sleeping Duckies (boss 6 Nov: the same 28 as home)
# world.json sleepSpots has EXACTLY home's shape (src/pixi/placements.js SLEEP_SPOTS): nod 4 (tree prop ids), hammock 2,
# rock 3, leaf 4, book 4, chair 2, wing 5, box 4. Each spot lies beside a prop that suits it (hammock between trees, chair by
# the beach loungers, book by a stall cart or the cafe, box by a dollhouse, rock by a bush, leaf by the flowers), found by a
# deterministic search round its anchor with the engine's own sleepSpots rules (why()), plus: off every path and out of the
# plazas, squares and the open activity / stall ground (sleepAvoid). scripts/themes/pink-sleep-check.mjs re-checks them.
NAP_R = {'nod': 41.8, 'leaf': 73.8, 'wing': 60.0, 'hammock': 70.7, 'rock': 46.6, 'book': 63.9, 'chair': 73.7, 'box': 49.7}   # sleepHalfWidths(.6336)
SLEEP_AVOID = [{'x': round(PLAZA[0]), 'y': round(PLAZA[1]), 'rx': PLAZA[2] + 60, 'ry': PLAZA[3] + 50},
               {'x': round(SQUARE[0]), 'y': round(SQUARE[1]), 'rx': SQUARE[2] + 50, 'ry': SQUARE[3] + 40},
               {'x': round(PLAY[0]), 'y': round(PLAY[1]), 'rx': PLAY[2] + 20, 'ry': PLAY[3] + 20},
               {'x': round(POND[0]), 'y': round(POND[1]), 'rx': POND[2] + 90, 'ry': POND[3] + 80}] + \
              [{'x': round(A['c'][0]), 'y': round(A['c'][1]), 'rx': A['rx'] + 50, 'ry': A['ry'] + 40} for A in ACTIVITY] + \
              [{'x': round(s['c'][0]), 'y': round(s['c'][1]), 'rx': round(s['len'] / 2 + 60), 'ry': round(s['depth'] / 2 + 60)} for s in STALLS] + \
              [{'x': round(p['foot'][0]), 'y': round(p['foot'][1]), 'rx': 340, 'ry': 260} for p in PIERS]   # the jetty feet: signpost, flag, the way off the boat
_WCOAST = [(round(x), round(y)) for x, y in WALK_COAST]
_ISLETS = [(round(cx), round(cy), rx + 40, ry + 40) for cx, cy, rx, ry in ISLETS]
def _in_shape(x, y, o, pad):
    if 'poly' in o: return in_poly(x, y, o['poly']) or poly_dist(x, y, o['poly']) < pad
    return in_ell(x, y, o['x'], o['y'], o['rx'] + pad, o['ry'] + pad)
def nap_walkable(x, y):
    if not in_poly(x, y, _WCOAST): return False
    if in_ell(x, y, POND[0], POND[1], POND[2] + 10 + 20, POND[3] + 10 + 20): return False
    return not any(_in_shape(x, y, o, 16) for o in FOOT if abs(o.get('x', o.get('poly', [[x]])[0][0]) - x) < 700)
def nap_why(x, y, pose, r, placed, props):
    if not nap_walkable(x, y) or not nap_walkable(x - r * .8, y) or not nap_walkable(x + r * .8, y): return 'not ground'
    if any(in_ell(x, y, a[0], a[1], a[2] + 60, a[3] + 60) for a in _ISLETS): return 'islet'
    if any(seg_dist(x, y, a, b) < hw + 90 for a, b, hw in DECK_LINES): return 'deck'
    if path_dist(x, y) < 10 + r * .35 + 20: return 'path'
    if any(in_ell(x, y, o['x'], o['y'], o['rx'], o['ry']) for o in SLEEP_AVOID): return 'avoid'
    if poly_dist(x, y, _WCOAST) < r * .6 + 30 + 20: return 'water'
    for p in props:
        half = p['width'] * p['scale'] / 2
        if abs(p['x'] - x) > 900: continue
        building = p['kind'] in BUILDINGS
        if math.hypot(x - p['x'], (y - p['y']) * 1.6) < half * (.35 if building else .8) + r + 12: return 'prop ' + p['id']
        if p['y'] > y - 20 and p['y'] - y < p['height'] * p['scale'] * .9 and abs(x - p['x']) < half + r * .6: return 'behind ' + p['id']
    for s in placed:
        if math.hypot(s['x'] - x, (s['y'] - y) * 1.3) < max(300, s['r'] + r + 100) + 40: return 'near ' + s['pose']
        if s['pose'] == pose and math.hypot(s['x'] - x, s['y'] - y) < (850 if pose == 'chair' else 900) + 40: return 'same ' + pose
    return None

def nap_search(anchor, pose, placed, sides=(1, -1)):
    """the nearest good spot beside the anchor prop: rings out from its base, sideways first, then in front"""
    r = NAP_R[pose]; half = anchor['width'] * anchor['scale'] / 2
    for k in range(16):
        d = half * (.85 if anchor['kind'] in BUILDINGS else 1.0) + r + 30 + k * 22
        for ang in (0, 20, -20, 40, -40, 65, 90, -65, -90):
            for sg in sides:
                a = math.radians(ang); x, y = round(anchor['x'] + sg * d * math.cos(a)), round(anchor['y'] + d * math.sin(a) * .62)
                if not nap_why(x, y, pose, r, placed, PROPS): return round(x), round(y), sg < 0
    return None

def sleep_spots():
    placed = []; spots = {k: [] for k in ('nod', 'hammock', 'rock', 'leaf', 'book', 'chair', 'wing', 'box')}
    byid = {p['id']: p for p in PROPS}
    # nod: in front of the four nod trees' trunks (the engine skips the ground checks for a nod; ours still hold)
    for k, (pid, _, _) in enumerate(SLEEP_TREES):
        t = byid[pid]; spots['nod'].append([pid, 0, k % 2 == 1])
        placed.append({'x': t['x'], 'y': t['y'] + 14, 'pose': 'nod', 'r': NAP_R['nod']})
    want = [('chair', lambda p: p['id'] in ('lounger-west', 'lounger-east'), 2), ('book', lambda p: p['id'].startswith('stall-cart') or p['id'] in ('teacup-cafe',) or p['kind'] == 'mailbox', 4),
            ('box', lambda p: p['id'].startswith('dollhouse') or p['id'] in ('slide-tower',) or (p['zone'] == 'dollhouses' and p['kind'] == 'lamp-heart'), 4),
            ('hammock', lambda p: p['kind'] in ('tree-willow', 'tree-cherry', 'tree-1', 'tree-3') and p['zone'] in ('woods', 'pond') and not p['id'].startswith('nod'), 2),
            ('rock', lambda p: p['kind'] in ('bush-pink', 'bush-2', 'bush-5', 'heart-hedge') and p['zone'] == 'gardens', 3),
            ('leaf', lambda p: p['kind'] in ('flowers-pink', 'flower-1', 'flower-2', 'flower-3') and p['zone'] == 'gardens', 4),
            ('wing', lambda p: p['kind'] in ('lamp-heart', 'flowers-pink', 'bush-pink') and p['zone'] not in ('islets', 'pond', 'plaza'), 5)]
    for pose, ok, n in want:
        cands = [p for p in PROPS if ok(p)]
        # spread them: walk the candidates in a fixed scrambled order so the picks fall all over the island
        cands.sort(key=lambda p: halton(sum(map(ord, p['id'])) + 3, 2))
        # then, if those run out, any lamp or flower bed on quiet ground (never the islets, pond bank or plaza)
        cands += sorted([p for p in PROPS if p not in cands and p['kind'] in ('lamp-heart', 'flowers-pink') and p['zone'] not in ('islets', 'pond', 'plaza', 'beach')],
                        key=lambda p: halton(sum(map(ord, p['id'])) + 5, 3))
        for p in cands:
            if len(spots[pose]) >= n: break
            got = nap_search(p, pose, placed)
            if got:
                x, y, fl = got; spots[pose].append([x, y, fl]); placed.append({'x': x, 'y': y, 'pose': pose, 'r': NAP_R[pose], 'by': p['id']})
        if len(spots[pose]) < n: WARN.append(f'sleep {pose}: only {len(spots[pose])} of {n}')
    return spots, placed
SLEEP, SLEEP_PLACED = sleep_spots()

# ---------------------------------------------------------------- write everything
def main():
    os.makedirs(ART, exist_ok=True); os.makedirs(DATA, exist_ok=True)
    body = ground_svg()
    open(os.path.join(ART, 'ground.svg'), 'w').write(svg_doc(body, (0, 0, W, H), 'Pink Dollhouse Town ground'))
    tiles = []; y = 0
    for r_, th in enumerate(TH):
        x = 0
        for c, tw in enumerate(TW):
            name = f'ground-r{r_}-c{c}.svg'
            open(os.path.join(ART, name), 'w').write(svg_doc(body, (x, y, tw, th), f'Pink Dollhouse Town ground tile {r_ + 1}, {c + 1}'))
            tiles.append({'src': name, 'x': x, 'y': y, 'width': tw, 'height': th}); x += tw
        y += th
    decks = []
    for k, p in enumerate(PIERS):
        moor = [(b['x'], b['y']) for b in (BOATS[:3] if k == 0 else BOATS[2 + k:3 + k])]
        svg, (x0, y0, w0, h0) = jetty_svg(p, moor)
        fn = f'jetty-{p["name"]}.svg'; open(os.path.join(ART, fn), 'w').write(svg)
        decks.append({'src': fn, 'x': x0, 'y': y0, 'width': w0, 'height': h0})
    home_bridge = open(os.path.join(ROOT, 'public/pixi-art/bridge-jetty-2.svg')).read()
    vx, vy, vw, vh = BR2['vb']
    for k, b in enumerate(BRIDGES):
        inner = home_bridge[home_bridge.index('>', home_bridge.index('<svg')) + 1: home_bridge.rindex('</svg>')]
        tf = f'translate({f(b["x"] - vx)} {f(b["y"] - vy)})' + (f' translate({f(2 * vx + vw)} 0) scale(-1 1)' if b['mirror'] else '')
        fn = f'bridge-islet-{k + 1}.svg'
        open(os.path.join(ART, fn), 'w').write(f'<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<svg xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round" '
            f'viewBox="{f(b["x"])} {f(b["y"])} {f(vw)} {f(vh)}" width="{f(vw)}" height="{f(vh)}"><title>Pink islet bridge {k + 1} (home footbridge 2{" mirrored" if b["mirror"] else ""})</title><g transform="{tf}">{inner}</g></svg>\n')
        decks.append({'src': fn, 'x': round(b['x'], 2), 'y': round(b['y'], 2), 'width': round(vw, 2), 'height': round(vh, 2)})
    props_out = [{k: v for k, v in p.items() if k not in ('kind',)} for p in PROPS]
    art = {'width': W, 'height': H, 'sea': SEA, 'theme': 'pink', 'name': 'Pink Dollhouse Town',
           'ground': {'tiles': tiles}, 'decks': decks, 'flats': FLATS, 'props': props_out}
    json.dump(art, open(os.path.join(ART, 'art.json'), 'w'), indent=1)
    R = lambda pts: [[round(x), round(y)] for x, y in pts]
    walkways = [{'a': [round(v) for v in b['a']], 'b': [round(v) for v in b['b']], 'w': 84} for b in BRIDGES]
    for p in PIERS[1:]:
        a = towards(p['foot'], p['tip'], -55); bb = towards(p['tip'], p['foot'], 44)
        walkways.append({'a': [round(a[0]), round(a[1])], 'b': [round(bb[0]), round(bb[1])], 'w': p['width']})
    zones = {
        'plaza': {'x': round(PLAZA[0]), 'y': round(PLAZA[1]), 'rx': PLAZA[2], 'ry': PLAZA[3], 'spawn': [round(PLAZA[0]), round(PLAZA[1] + 380)]},
        'heart-garden': {'x': round(GARDEN[0]), 'y': round(GARDEN[1]), 'spawn': [round(v) for v in T(2900, 1600)]},
        'dollhouses': {'x': round(T(1650, 1450)[0]), 'y': round(T(1650, 1450)[1]), 'spawn': [round(v) for v in T(1720, 1410)]},
        'cafe': {'x': round(SQUARE[0]), 'y': round(SQUARE[1]), 'spawn': [round(SQUARE[0] + 120), round(SQUARE[1] - 60)]},
        'pond': {'x': round(POND[0]), 'y': round(POND[1]), 'spawn': [round(v) for v in T(3950, 1775)]},
        'playground': {'x': round(PLAY[0]), 'y': round(PLAY[1]), 'spawn': [round(PLAY[0]), round(PLAY[1] + 200)]},
        'beach': {'x': round(BEACH[0]), 'y': round(BEACH[1]), 'spawn': [round(BEACH[0]), round(BEACH[1])]},
        'islets': {'x': round(ISLETS[0][0]), 'y': round(ISLETS[0][1]), 'spawn': [round(ISLETS[0][0]) + 120, round(ISLETS[0][1]) - 60]},
    }
    # boss 6 Nov: open ground kept free for the activities and stalls that come later (each holds 30+ Duckies)
    for A in ACTIVITY:
        zones[A['id']] = {'name': A['name'], 'kind': A['kind'], 'x': round(A['c'][0]), 'y': round(A['c'][1]), 'rx': A['rx'], 'ry': A['ry'],
                          'spawn': [round(A['c'][0]), round(A['c'][1])]}
    for s in STALLS:
        zones[s['id']] = {'name': s['name'], 'kind': 'stall-row', 'x': round(s['c'][0]), 'y': round(s['c'][1]), 'length': s['len'], 'depth': s['depth'],
                          'angle': s['ang'], 'pitches': max(3, round((s['len'] - s['depth']) / 200)), 'spawn': [round(s['c'][0]), round(s['c'][1])]}
    water = [{'x': POND[0], 'y': POND[1], 'rx': POND[2] + 10, 'ry': POND[3] + 10}]
    islets = [[round(cx), round(cy), rx + 40, ry + 40] for cx, cy, rx, ry in ISLETS]
    world = {'width': W, 'height': H, 'theme': 'pink', 'coast': R(WALK_COAST[::2]), 'water': water, 'bridges': [], 'obstacles': FOOT,
             'islets': islets, 'walkways': walkways, 'zones': zones,
             'arches': [{'a': [round(v, 2) for v in b['a']], 'b': [round(v, 2) for v in b['b']], 'r': ARCH_R, 'w': 84} for b in BRIDGES],
             'paths': [[[round(x), round(y)] for x, y in path_samples(p, 60)] for p in PATHS],   # footpath centre lines (sleep-spots.js keeps beds off them)
             'pathWidths': [p['w'] for p in PATHS],
             'sleepSpots': SLEEP, 'sleepAvoid': SLEEP_AVOID,
             'props': [{'name': p['name'], 'x': p['x'], 'y': p['y'], 'zone': p['zone']} for p in PROPS if p['zone'] not in ('gardens', 'woods')],
             'jetties': [{'name': p['name'], 'foot': [round(v) for v in p['foot']], 'tip': [round(v) for v in p['tip']], 'width': p['width']} for p in PIERS]}
    json.dump(world, open(os.path.join(DATA, 'world.json'), 'w'))
    walk = {'width': W, 'height': H, 'coast': R(WALK_COAST), 'obstacles': FOOT, 'walkways': walkways, 'bridges': [], 'islets': islets, 'water': water}
    json.dump(walk, open(os.path.join(DATA, 'walk-world.json'), 'w'))
    hp = PIERS[0]
    harbor = {'jetty': {'foot': [round(v) for v in hp['foot']], 'tip': [round(v) for v in hp['tip']], 'width': hp['width']},
              'boats': BOATS, 'spawn': zones['plaza']['spawn']}
    json.dump(harbor, open(os.path.join(DATA, 'harbor.json'), 'w'), indent=1)
    for w_ in WARN: print('WARN', w_)
    for s in SLEEP_PLACED: print('sleep', s['pose'], s['x'], s['y'], s.get('by', ''))
    print(f'props {len(PROPS)} (trees {n_tree}, bushes {n_bush}, flowers {n_flower}), flats {len(FLATS)}, obstacles {len(FOOT)}, boats {len(BOATS)}')
    print('piers', [(p['name'], [round(v) for v in p['foot']], [round(v) for v in p['tip']]) for p in PIERS])
    print('islets', islets, 'bridges', [(b['a'], b['b']) for b in BRIDGES])

if __name__ == '__main__':
    main()
    # The locked terrace and 40-bed layout are the final placement pass.
    import subprocess
    subprocess.run(['node', 'scripts/themes/sunflower-centres.mjs', 'pink'], cwd=ROOT, check=True)
    subprocess.run(['node', 'scripts/themes/pink-polish.mjs', '--from-build'], cwd=ROOT, check=True)
