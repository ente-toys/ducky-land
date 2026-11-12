import json, math, os, re
import numpy as np
from scipy.spatial import Voronoi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes/community')
DATA = os.path.join(ROOT, 'assets/world/themes/community')
GEN = os.path.join(ROOT, '..', 'concepts/themes/community-gen')
W, H = 8000, 5800
TW, TH = [1600] * 5, [1450] * 4

INK, CREAM, SEA = '#39472D', '#FFF0C7', '#6EC9DE'
GRASS, LEAF = '#94C978', '#4FA65A'
SAND, SAND_SHADE = '#F7E2B2', '#E3C68B'
PATH, PATH_SHADE = '#D3CEF4', '#A9A2E2'
PAVE, PAVE_JOINT, KERB = '#C4BFF0', '#9C95DC', '#8A82CF'
BLURPLE, LAVENDER, MINT, ONLINE = '#6F78D8', '#C9C3F2', '#8FE0B0', '#5BC48A'
WOOD, DARK_WOOD = '#C88941', '#885931'

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

def ell_pts(cx, cy, rx, ry, n=48): return [(cx + math.cos(2 * math.pi * k / n) * rx, cy + math.sin(2 * math.pi * k / n) * ry) for k in range(n)]

def area_of(p): return abs(sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))) / 2

def towards(p, q, d):
    L = math.hypot(q[0] - p[0], q[1] - p[1]); return (p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d)

CX, CY, RX, RY, NSE = 4000, 2560, 3080, 1880, 2.5
T0 = math.pi / 2 + .085
def coast_line(n=260):
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        x = CX + RX * math.copysign(abs(c) ** (2 / NSE), c)
        y = CY + RY * math.copysign(abs(s) ** (2 / NSE), s)
        w = 1 + .010 * math.sin(5 * t + 1.3) + .007 * math.sin(9 * t + .4)
        x, y = CX + (x - CX) * w, CY + (y - CY) * w
        dt = math.atan2(math.sin(t - T0), math.cos(t - T0))
        tail = 560 * math.exp(-(dt / .11) ** 2)
        y += tail; x += -tail * .28
        pts.append((x, y))
    return pts

COAST = coast_line()
SAND_EDGE = offset(COAST, 78)
WALK_COAST = offset(COAST, 42)

def coast_point(origin, direction):
    ox, oy = origin; dx, dy = direction; L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
    r = 0
    while in_poly(ox + dx * r, oy + dy * r, COAST): r += 4
    return (ox + dx * r, oy + dy * r), (dx, dy)

PLAZA = (4000, 2640, 820, 628)
SQUARE = (1820, 2760, 560, 400)
POND = (1980, 1430, 470, 270)
PLAY = (6080, 1520, 560, 330)
VOICE = (4000, 3780, 330, 250)
BEACH = (6560, 3380, 760, 760)
STAGE_AT = (4000, 1290)
COVE = (900, 3150, 380, 330)
PATH_W, MAIN_W = 160, 190

PIER_RAYS = [('harbor', (3640, 3900), (0, 1), 430), ('nw', (1300, 1500), (-.9, -.44), 380),
             ('ne', (6700, 1500), (.8, -.6), 380), ('e', (6900, 3100), (1, .1), 400)]
PIERS = []
for name, o, d, L in PIER_RAYS:
    (cx, cy), (dx, dy) = coast_point(o, d)
    foot = (cx - dx * 70, cy - dy * 70)
    tip = (foot[0] + dx * L, foot[1] + dy * L)
    PIERS.append({'name': name, 'foot': foot, 'tip': tip, 'dir': (dx, dy), 'length': L, 'width': 104})

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

BRIDGES = [bridge_from_coast((2050, 3900), (-.49, .87), False), bridge_from_coast((5950, 3900), (.49, .87), True)]
ISLETS = []
for br, (rx, ry) in zip(BRIDGES, [(470, 290), (470, 290)]):
    a, b = br['a'], br['b']; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
    ISLETS.append((b[0] + dx * (ry * .55), b[1] + dy * (ry * .62), rx, ry))

hp = PIERS[0]

ACTIVITY = [
    {'id': 'activity-1', 'name': 'Stage lawn', 'kind': 'lawn', 'c': (4000, 1800), 'rx': 640, 'ry': 220},
    {'id': 'activity-2', 'name': 'Game square', 'kind': 'square', 'c': (5800, 2700), 'rx': 470, 'ry': 300},
    {'id': 'activity-3', 'name': 'Meadow lawn', 'kind': 'lawn', 'c': (2700, 1880), 'rx': 430, 'ry': 200},
]
STALLS = [
    {'id': 'stalls-1', 'name': 'Market row', 'c': (2520, 3560), 'len': 820, 'depth': 220, 'ang': .0},
    {'id': 'stalls-2', 'name': 'Beach stalls', 'c': (5420, 3560), 'len': 820, 'depth': 220, 'ang': .0},
]
def stall_poly(s, pad=0):
    (cx, cy), L, Dp, a = s['c'], s['len'] / 2 + pad, s['depth'] / 2 + pad, s['ang']
    ca, sa = math.cos(a), math.sin(a); out = []
    for k in range(40):
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

px, py, prx, pry = PLAZA
def on_plaza(deg, out=-30):
    a = math.radians(deg); return (px + math.cos(a) * (prx + out), py + math.sin(a) * (pry + out))
PATHS = [
    {'pts': [on_plaza(-90), (4000, 1900)], 'w': MAIN_W},
    {'pts': [on_plaza(90), (4000, 3420), (4000, 3560)], 'w': MAIN_W},
    {'pts': [(3980, 4010), (3880, 4180), (hp['foot'][0] + 20, hp['foot'][1] - 260), towards(hp['foot'], (hp['foot'][0], hp['foot'][1] - 300), -40)], 'w': MAIN_W},
    {'pts': [on_plaza(180), (2900, 2700), (SQUARE[0] + SQUARE[2] - 20, SQUARE[1] - 20)], 'w': MAIN_W},
    {'pts': [(SQUARE[0] - 120, SQUARE[1] - SQUARE[3] + 30), (1600, 2100), (1450, 1780), (1350, 1560)] + [towards(PIERS[1]['foot'], (1350, 1560), -40)], 'w': PATH_W},
    {'pts': [on_plaza(0), (5150, 2690), (5340, 2700)], 'w': MAIN_W},
    {'pts': [(6260, 2760), (6500, 2900), (6700, 3050)] + [towards(PIERS[3]['foot'], (6700, 3050), -40)], 'w': PATH_W},
    {'pts': [on_plaza(-135), (3200, 2140), (3020, 1990)], 'w': PATH_W},
    {'pts': [(2400, 1760), (2250, 1640), (POND[0] + 260, POND[1] + POND[3] + 60)], 'w': PATH_W},
    {'pts': [on_plaza(-45), (5000, 2130), (5350, 1880), (PLAY[0] - PLAY[2] + 60, PLAY[1] + 80)], 'w': PATH_W},
    {'pts': [(PLAY[0] + 260, PLAY[1] - PLAY[3] + 40), (6420, 1080)] + [towards(PIERS[2]['foot'], (6420, 1080), -40)], 'w': PATH_W},
    {'pts': [(3370, 1760), (3180, 1560), (2930, 1430)], 'w': PATH_W},
    {'pts': [(4630, 1760), (4820, 1560), (5070, 1430)], 'w': PATH_W},
    {'pts': [(SQUARE[0] + 120, SQUARE[1] + SQUARE[3] - 20), (2000, 3300), (2060, 3560), (BRIDGES[0]['a'][0] + 60, BRIDGES[0]['a'][1] - 140), towards(BRIDGES[0]['a'], (2060, 3560), -30)], 'w': PATH_W},
    {'pts': [(3670, 3800), (3350, 3760), (3010, 3640)], 'w': PATH_W},
    {'pts': [(4330, 3800), (4650, 3760), (4930, 3640)], 'w': PATH_W},
    {'pts': [(5910, 3600), (6000, 3800), (BRIDGES[1]['a'][0] - 60, BRIDGES[1]['a'][1] - 140), towards(BRIDGES[1]['a'], (6000, 3800), -30)], 'w': PATH_W},
    {'pts': [(5800, 3000), (5700, 3260), (5640, 3430)], 'w': PATH_W},
]
for br, isl in zip(BRIDGES, ISLETS):
    PATHS.append({'pts': [towards(br['b'], (isl[0], isl[1]), -20), (isl[0] + (br['b'][0] - isl[0]) * .35, isl[1] + (br['b'][1] - isl[1]) * .35), (isl[0], isl[1] + 20)], 'w': PATH_W - 10})

def path_samples(p, step=20):
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
    best = 1e9
    for s, w in SAMPLES:
        for i in range(len(s) - 1):
            if abs(s[i][0] - x) > 600 or abs(s[i][1] - y) > 600: continue
            d = seg_dist(x, y, s[i], s[i + 1]) - w / 2
            if d < best: best = d
    return best

DECK_LINES = [(towards(b['a'], b['b'], -80), towards(b['b'], b['a'], -80), 42 + 20) for b in BRIDGES] + \
             [(towards(p['foot'], p['tip'], -80), p['tip'], p['width'] / 2 + 20) for p in PIERS]
def hides_deck(x, y, w, h):
    for a, b, hw in DECK_LINES:
        L = math.hypot(b[0] - a[0], b[1] - a[1]); k = max(2, int(L / 20))
        for j in range(k + 1):
            sx, sy = a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k
            for side in (-hw, 0, hw):
                px_, py_ = sx + side * (-(b[1] - a[1]) / L), sy + side * ((b[0] - a[0]) / L)
                if y > py_ - 10 and y - h * .95 < py_ and abs(px_ - x) < w / 2 + 10: return True
    return False

def flagstone_lines(cx, cy, rx, ry, seed, step=118):
    r = rnd(seed); pts = []
    y = cy - ry - step
    row = 0
    while y < cy + ry + step:
        x = cx - rx - step + (step / 2 if row % 2 else 0)
        while x < cx + rx + step:
            pts.append((x + (r() - .5) * step * .55, y + (r() - .5) * step * .45)); x += step
        y += step * .78; row += 1
    vor = Voronoi(np.array(pts)); out = []
    inside = lambda p: ((p[0] - cx) / rx) ** 2 + ((p[1] - cy) / ry) ** 2 < 1
    for (i, j) in vor.ridge_vertices:
        if i < 0 or j < 0: continue
        a, b = vor.vertices[i], vor.vertices[j]
        ia, ib = inside(a), inside(b)
        if not ia and not ib: continue
        if not (ia and ib):
            p, q = (a, b) if ia else (b, a)
            for _ in range(20):
                m = (p + q) / 2
                if inside(m): p = m
                else: q = m
            a, b = (a, p) if ia else (p, b)
        out.append(f'M {f(a[0])} {f(a[1])} L {f(b[0])} {f(b[1])}')
    return ' '.join(out)

def hash_mark(x, y, dx, dy, s=15):
    nx, ny = -dy, dx; d = []
    for k in (-.4, .4):
        a = (x + nx * s * k - dx * s, y + ny * s * k - dy * s); b = (x + nx * s * k + dx * s, y + ny * s * k + dy * s)
        d.append(f'M {f(a[0])} {f(a[1])} L {f(b[0])} {f(b[1])}')
        a = (x + dx * s * k - nx * s, y + dy * s * k - ny * s); b = (x + dx * s * k + nx * s, y + dy * s * k + ny * s)
        d.append(f'M {f(a[0])} {f(a[1])} L {f(b[0])} {f(b[1])}')
    return ' '.join(d)

def paved(name, cx, cy, rx, ry, seed, kerb=KERB):
    g = [f'<g data-name="{name}">',
         f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx + 30)}" ry="{f(ry + 26)}" fill="{LEAF}" fill-opacity="0.32"/>',
         f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}" fill="{kerb}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>',
         f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx - 26)}" ry="{f(ry - 20)}" fill="{PAVE}" stroke="{PAVE_JOINT}" stroke-width="6"/>',
         f'<path d="{flagstone_lines(cx, cy, rx - 30, ry - 24, seed)}" fill="none" stroke="{PAVE_JOINT}" stroke-width="5" stroke-linecap="round"/>',
         f'<ellipse cx="{f(cx - rx * .25)}" cy="{f(cy - ry * .35)}" rx="{f(rx * .42)}" ry="{f(ry * .22)}" fill="#FFFFFF" fill-opacity="0.16"/>', '</g>']
    return g

def ground_svg():
    r = rnd(11); g = []; add = g.append
    ring_out = offset(SAND_EDGE, 260)
    for i in range(340):
        x, y = 150 + halton(i + 1, 2) * (W - 300), 150 + halton(i + 1, 3) * (H - 300)
        if in_poly(x, y, ring_out) or any(in_ell(x, y, c[0], c[1], c[2] + 260, c[3] + 230) for c in ISLETS): continue
        L = 30 + r() * 30; a = (r() - .5) * .3
        add(f'<path d="M {f(x)} {f(y)} q {f(L / 2)} {f(-7 + a * 10)} {f(L)} 0" fill="none" stroke="{CREAM}" stroke-opacity="0.6" stroke-width="2.4" stroke-linecap="round"/>')
    shallow = [SAND_EDGE] + [ell_pts(c[0], c[1], c[2] + 60, c[3] + 60) for c in ISLETS]
    add('<g data-name="Wet coasts">')
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
    add(f'<g data-name="Sandy coast"><path d="{smooth_d(SAND_EDGE)}" fill="{SAND}"/><path d="{smooth_d(SAND_EDGE)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    for k, (cx, cy, rx, ry) in enumerate(ISLETS):
        sb = blob(cx, cy, rx + 62, ry + 56, 40 + k, 16, .05)
        add(f'<g data-name="Islet sand"><path d="{smooth_d(sb)}" fill="{SAND}"/><path d="{smooth_d(sb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    add(f'<g data-name="Island grass"><path d="{smooth_d(COAST)}" fill="{GRASS}"/>')
    for k, (cx, cy, rx, ry) in enumerate(ISLETS):
        add(f'<path d="{smooth_d(blob(cx, cy, rx, ry, 50 + k, 16, .06))}" fill="{GRASS}"/>')
    add('</g>')
    add('<g data-name="Two-tone lawns">')
    inner = offset(COAST, -120)
    for i in range(140):
        x, y = 700 + halton(i + 3, 2) * (W - 1400), 600 + halton(i + 3, 3) * (H - 1200)
        if not in_poly(x, y, inner) or in_open(x, y, 40): continue
        kind = i % 3
        b = blob(x, y, 180 + r() * 260, 110 + r() * 150, 100 + i, 12, .22)
        fill, op = (LEAF, .15) if kind == 0 else (CREAM, .12) if kind == 1 else (LAVENDER, .22)
        add(f'<path d="{smooth_d(b)}" fill="{fill}" fill-opacity="{op}"/>')
    add('</g>')
    bb = blob(*BEACH, 7, 18, .07)
    cb = blob(*COVE, 9, 16, .06)
    add(f'<defs><clipPath id="sand-clip"><path d="{smooth_d(SAND_EDGE)}"/></clipPath></defs>')
    add(f'<g data-name="West cove" clip-path="url(#sand-clip)"><path d="{smooth_d(cb)}" fill="{SAND}"/><path d="{smooth_d(cb)}" fill="none" stroke="{SAND_SHADE}" stroke-width="14"/><path d="{smooth_d(cb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    add(f'<g data-name="Beach" clip-path="url(#sand-clip)"><path d="{smooth_d(bb)}" fill="{SAND}"/>'
        f'<path d="{smooth_d(bb)}" fill="none" stroke="{SAND_SHADE}" stroke-width="14"/><path d="{smooth_d(bb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    for name, (cx, cy, rx, ry), seed in [('Playground sand', PLAY, 21), ('Pond bank', (POND[0], POND[1], POND[2] + 80, POND[3] + 70), 22)]:
        b = blob(cx, cy, rx, ry, seed, 16, .06)
        add(f'<g data-name="{name}"><path d="{smooth_d(b)}" fill="{SAND}"/><path d="{smooth_d(b)}" fill="none" stroke="{SAND_SHADE}" stroke-width="14"/>'
            f'<path d="{smooth_d(b)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    for A in ACTIVITY:
        if A['kind'] != 'lawn': continue
        cx, cy = A['c']; rx, ry = A['rx'], A['ry']
        lb = blob(cx, cy, rx + 30, ry + 24, sum(map(ord, A['id'])) % 97, 18, .05)
        add(f'<g data-name="{A["name"]} (open lawn)"><defs><clipPath id="clip-{A["id"]}"><path d="{smooth_d(lb)}"/></clipPath></defs>')
        add(f'<path d="{smooth_d(lb)}" fill="{LEAF}" fill-opacity="0.2"/>')
        add(f'<g clip-path="url(#clip-{A["id"]})">')
        for k in range(-12, 13, 2):
            x0 = cx + k * 70
            add(f'<path d="M {f(x0 - 120)} {f(cy - ry - 60)} L {f(x0 + 70 - 120)} {f(cy - ry - 60)} L {f(x0 + 70 + 120)} {f(cy + ry + 60)} L {f(x0 + 120)} {f(cy + ry + 60)} Z" fill="{CREAM}" fill-opacity="0.2"/>')
        add('</g>')
        add(f'<path d="{smooth_d(offset(lb, -14))}" fill="none" stroke="{CREAM}" stroke-width="12" stroke-opacity="0.9" stroke-dasharray="1 30" stroke-linecap="round"/>')
        add(f'<path d="{smooth_d(lb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.25"/></g>')
    for col, extra, op in [(LEAF, 34, .35), (INK, 18, .6), (PATH_SHADE, 14, 1), (PATH, 0, 1)]:
        add('<g data-name="Footpaths" fill="none" stroke-linecap="round" stroke-linejoin="round">')
        for p in PATHS:
            add(f'<path d="{smooth_d(p["pts"], p.get("closed", False))}" stroke="{col}" stroke-width="{p["w"] + extra}" stroke-opacity="{op}"/>')
        add('</g>')
    hashes = []
    for p in PATHS:
        s = path_samples(p, 10)
        for i in range(8, len(s) - 8, 17):
            a, b = s[i - 1], s[i + 1]; L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
            x, y = s[i]
            if in_ell(x, y, PLAZA[0], PLAZA[1], PLAZA[2] + 30, PLAZA[3] + 30): continue
            hashes.append(hash_mark(x, y, (b[0] - a[0]) / L, (b[1] - a[1]) / L))
    add(f'<path data-name="Hash path tiles" d="{" ".join(hashes)}" fill="none" stroke="{PATH_SHADE}" stroke-width="4" stroke-linecap="round" stroke-opacity="0.8"/>')
    for A in [A for A in ACTIVITY if A['kind'] == 'square']:
        g.extend(paved(f'{A["name"]} (open paved square)', *A['c'], A['rx'], A['ry'], 5))
        cx, cy = A['c']
        for k in range(4):
            pass
    for s in STALLS:
        add(f'<g data-name="{s["name"]} (open stall row)">')
        add(f'<path d="{smooth_d(stall_poly(s, 22))}" fill="{LEAF}" fill-opacity="0.32"/>')
        add(f'<path d="{smooth_d(stall_poly(s))}" fill="{KERB}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
        add(f'<path d="{smooth_d(stall_poly(s, -18))}" fill="{PAVE}" stroke="{PAVE_JOINT}" stroke-width="8"/>')
        (cx, cy), L, Dp, a = s['c'], s['len'], s['depth'], s['ang']; ca, sa = math.cos(a), math.sin(a)
        n = max(3, round((L - Dp) / 200))
        for k in range(n + 1):
            u = -(L - Dp) / 2 + (L - Dp) * k / n
            v0, v1 = -(Dp / 2 - 22), Dp / 2 - 22
            add(f'<path d="M {f(cx + u * ca - v0 * sa)} {f(cy + u * sa + v0 * ca)} L {f(cx + u * ca - v1 * sa)} {f(cy + u * sa + v1 * ca)}" stroke="{PAVE_JOINT}" stroke-width="6" stroke-linecap="round"/>')
        add(f'<path d="M {f(cx - (L / 2 - 30) * ca)} {f(cy - (L / 2 - 30) * sa)} L {f(cx + (L / 2 - 30) * ca)} {f(cy + (L / 2 - 30) * sa)}" stroke="{PAVE_JOINT}" stroke-width="4" stroke-dasharray="18 22" stroke-linecap="round"/>')
        add('</g>')
    g.extend(paved('Member wall square', *SQUARE, 3))
    g.extend(paved('Campfire commons', *PLAZA, 1))
    cx, cy, rx, ry = PLAZA
    add(f'<ellipse cx="{f(cx)}" cy="{f(cy + 10)}" rx="{f(rx * .5)}" ry="{f(ry * .5)}" fill="none" stroke="{PAVE_JOINT}" stroke-width="7" stroke-opacity="0.8"/>')
    add(f'<ellipse cx="{f(cx)}" cy="{f(cy + 22)}" rx="150" ry="104" fill="{KERB}" fill-opacity="0.35"/>')
    g.extend(paved('Voice circle', *VOICE, 7))
    cx, cy, rx, ry = VOICE
    add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx * .72)}" ry="{f(ry * .72)}" fill="none" stroke="{INK}" stroke-width="24" stroke-opacity="0.55"/>')
    add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx * .72)}" ry="{f(ry * .72)}" fill="none" stroke="{ONLINE}" stroke-width="18"/>')
    add(f'<ellipse cx="{f(cx)}" cy="{f(cy - 3)}" rx="{f(rx * .72)}" ry="{f(ry * .72)}" fill="none" stroke="{MINT}" stroke-width="5"/>')
    cx, cy, rx, ry = POND
    pb = blob(cx, cy, rx, ry, 31, 18, .05)
    add(f'<g data-name="Lake water"><path d="{smooth_d(pb)}" fill="{SEA}"/>'
        f'<path d="{smooth_d(blob(cx + 40, cy + 30, rx * .92, ry * .86, 31, 18, .05))}" fill="{INK}" fill-opacity="0.15"/>'
        f'<path d="{smooth_d(blob(cx - 10, cy - 8, rx * .9, ry * .84, 31, 18, .05))}" fill="{SEA}"/>'
        f'<path d="{smooth_d(offset(pb, -16))}" fill="none" stroke="{CREAM}" stroke-width="2.5"/>'
        f'<path d="{smooth_d(pb)}" fill="none" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/></g>')
    for i in range(7):
        x, y = cx - rx * .6 + halton(i + 1, 2) * rx * 1.2, cy - ry * .5 + halton(i + 1, 3) * ry
        add(f'<path d="M {f(x)} {f(y)} q 14 -6 28 0" fill="none" stroke="{CREAM}" stroke-width="2.4" stroke-opacity="0.7" stroke-linecap="round"/>')
    for k in range(5):
        for sg in (-1, 1):
            x, y = VOICE[0] + sg * (VOICE[2] + 70 + k * 70), VOICE[1] + 150 + k * 22
            add(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="24" ry="15" fill="{PAVE}" stroke="{INK}" stroke-width="2" stroke-opacity="0.5"/>')
    return g

def svg_doc(body, vb, title):
    x, y, w, h = vb
    return (f"<?xml version='1.0' encoding='utf-8'?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{w}\" height=\"{h}\" viewBox=\"{x} {y} {w} {h}\">\n"
            f"<title>{title}</title>\n<desc>Original Ducky Land vector artwork: Campfire Commons ground (scripts/themes/community-build.py).</desc>\n" + '\n'.join(body) + '\n</svg>\n')

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
            px_, py_ = at(wet0 + (L - wet0 - 8) * i / piles, side)
            out.append(f'<ellipse cx="{f(px_)}" cy="{f(py_ + 34)}" rx="12" ry="4.6" fill="{INK}" fill-opacity="0.12"/>')
            out.append(f'<rect x="{f(px_ - 4.5)}" y="{f(py_ - 6)}" width="9" height="40" fill="{DARK_WOOD}" {ol}/>')
            out.append(f'<ellipse cx="{f(px_)}" cy="{f(py_ + 34)}" rx="11" ry="4.2" fill="none" stroke="{CREAM}" stroke-width="1.6" stroke-opacity="0.9"/>')
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
            px_, py_ = at(8 + (railEnd - 8) * k / posts, side)
            out.append(f'<rect x="{f(px_ - 4.5)}" y="{f(py_ - Hh)}" width="9" height="{Hh}" fill="{WOOD}" {ol}/>')
            tops.append((px_, py_ - Hh + 3))
        dd = 'M ' + ' L '.join(f'{f(a)} {f(b)}' for a, b in tops)
        out.append(f'<path d="{dd}" fill="none" stroke="{INK}" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>')
        out.append(f'<path d="{dd}" fill="none" stroke="{WOOD}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>')
        for a, b in tops: out.append(f'<rect x="{f(a - 6.5)}" y="{f(b - 5.5)}" width="13" height="5" rx="1.7" fill="{DARK_WOOD}" {ol}/>')
    for side in (-hw + 6, hw - 6):
        lx, ly = at(L - 10, side)
        out.append(f'<rect x="{f(lx - 3.5)}" y="{f(ly - 52)}" width="7" height="52" fill="#5B6178" {ol}/>')
        out.append(f'<circle cx="{f(lx)}" cy="{f(ly - 60)}" r="20" fill="{CREAM}" fill-opacity="0.45"/>')
        out.append(f'<rect x="{f(lx - 13)}" y="{f(ly - 71)}" width="26" height="20" rx="9" fill="{LAVENDER}" {ol}/>')
        for k in (-7, 0, 7): out.append(f'<circle cx="{f(lx + k)}" cy="{f(ly - 61)}" r="2.6" fill="#FFFFFF"/>')
    for m in moorings:
        along = (m[0] - x) * dx + (m[1] - y) * dy; lat = (m[0] - x) * nx + (m[1] - y) * ny
        if abs(lat) > hw + 260: continue
        tip = along > L - 30; side = (1 if lat >= 0 else -1) * (hw - 10)
        px_, py_ = at(L - 10 if tip else max(wet0 + 10, min(L - 30, along)), side)
        out.append(f'<ellipse cx="{f(px_)}" cy="{f(py_ + 1)}" rx="9" ry="3.5" fill="{INK}" fill-opacity="0.2"/>')
        out.append(f'<rect x="{f(px_ - 6)}" y="{f(py_ - 15)}" width="12" height="16" rx="3" fill="{DARK_WOOD}" {ol}/>')
        out.append(f'<ellipse cx="{f(px_)}" cy="{f(py_ - 15)}" rx="7.5" ry="3.2" fill="{WOOD}" {ol}/>')
    allp = [tuple(map(float, m)) for m in re.findall(r'(-?\d+\.?\d*) (-?\d+\.?\d*)', ' '.join(out))]
    xs = [a for a, b in allp] + [c[0] for c in corners]; ys = [b for a, b in allp] + [c[1] for c in corners]
    x0, y0, x1, y1 = math.floor(min(xs) - 30), math.floor(min(ys) - 90), math.ceil(max(xs) + 30), math.ceil(max(ys) + 50)
    return svg_doc(out, (x0, y0, x1 - x0, y1 - y0), f'Campfire Commons pier {p["name"]}'), (x0, y0, x1 - x0, y1 - y0)

def lights_svg(posts, name, hgt=200, sag=46, bulbs=7):
    """posts: [(x, y)] ground points (world). One wire between each pair of neighbours. Returns svg, box, anchor (the lowest post)."""
    out = []; ol = f'stroke="{INK}" stroke-width="2.6" stroke-linejoin="round"'
    tops = [(x, y - hgt) for x, y in posts]
    wires = []
    for (ax, ay), (bx, by) in zip(tops, tops[1:]):
        pts = [(ax + (bx - ax) * t, ay + (by - ay) * t + sag * 4 * t * (1 - t)) for t in [k / 24 for k in range(25)]]
        wires.append(pts)
    for x, y in posts:
        out.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="20" ry="7" fill="{INK}" fill-opacity="0.18"/>')
    for x, y in posts:
        out.append(f'<rect x="{f(x - 9)}" y="{f(y - hgt)}" width="18" height="{hgt}" rx="4" fill="{WOOD}" {ol}/>')
        out.append(f'<rect x="{f(x + 2)}" y="{f(y - hgt + 6)}" width="5" height="{hgt - 14}" fill="{DARK_WOOD}" fill-opacity="0.45"/>')
        out.append(f'<rect x="{f(x - 13)}" y="{f(y - 14)}" width="26" height="14" rx="4" fill="{WOOD}" {ol}/>')
        for b in (14, 24): out.append(f'<rect x="{f(x - 11)}" y="{f(y - hgt + b)}" width="22" height="7" rx="3" fill="#F2C95A" {ol}/>')
        out.append(f'<ellipse cx="{f(x)}" cy="{f(y - hgt)}" rx="12" ry="9" fill="{WOOD}" {ol}/>')
    for pts in wires:
        out.append('<path d="M ' + ' L '.join(f'{f(a)} {f(b)}' for a, b in pts) + f'" fill="none" stroke="{INK}" stroke-width="3"/>')
        for k in range(1, bulbs + 1):
            a, b = pts[round(24 * k / (bulbs + 1))]
            out.append(f'<circle cx="{f(a)}" cy="{f(b + 15)}" r="21" fill="#FFE9A8" fill-opacity="0.35"/>')
            out.append(f'<rect x="{f(a - 3)}" y="{f(b)}" width="6" height="6" fill="{INK}"/>')
            out.append(f'<circle cx="{f(a)}" cy="{f(b + 14)}" r="9.5" fill="#FFF3C4" {ol}/>')
            out.append(f'<circle cx="{f(a - 3)}" cy="{f(b + 11)}" r="3" fill="#FFFFFF"/>')
    xs = [p[0] for p in posts]; ys = [p[1] for p in posts] + [p[1] - hgt for p in posts]
    x0, y0, x1, y1 = math.floor(min(xs) - 40), math.floor(min(ys) - 30), math.ceil(max(xs) + 40), math.ceil(max(ys) + 14)
    vb = (x0, y0, x1 - x0, y1 - y0)
    doc = (f"<?xml version='1.0' encoding='utf-8'?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{vb[2]}\" height=\"{vb[3]}\" viewBox=\"{x0} {y0} {vb[2]} {vb[3]}\">"
           f"<title>Campfire Commons string lights {name}</title><desc>Original Ducky Land vector artwork (community theme).</desc>" + ''.join(out) + '</svg>\n')
    ax, ay = max(posts, key=lambda p: p[1])
    return doc, vb, (ax, ay)

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

DET = 'detail/'
SIZES = {}
for fn in os.listdir(os.path.join(ART, 'detail')):
    if fn.endswith('.svg'):
        s = open(os.path.join(ART, 'detail', fn)).read(2000)
        m = re.search(r'width="(\d+)" height="(\d+)"', s)
        SIZES[fn[:-4]] = (int(m.group(1)), int(m.group(2)))
HOME_PLANTS = {'tree-1': (260, 360), 'tree-3': (300, 380), 'tree-4': (200, 280), 'bush-2': (168, 110), 'bush-5': (170, 110),
               'bush-1': (130, 100), 'flower-1': (48, 36), 'flower-2': (48, 36), 'flower-3': (44, 36)}

TALL = {'notice-board': 400, 'campfire': 150, 'log-seat': 66, 'lights-span': 230, 'stage': 560, 'pavilion': 470, 'member-wall': 330,
        'bubble-sculpture': 330, 'tree-wisteria': 470, 'tree-lilac': 450, 'cushions': 92, 'game-table': 118, 'lamp-typing': 230,
        'boost-crystal': 190, 'emoji-sign': 170, 'badge-buoy': 110, 'canopy-sofa': 300, 'lavender-stall': 300, 'sofa': 105, 'speaker': 190,
        'bush-lavender': 125, 'flowers-purple': 64, 'bench-lavender': 135, 'signpost': 230, 'parasol': 290, 'lounger': 140,
        'picnic-blanket': 150, 'cocoa-cart': 300, 'gazebo-crystal': 470, 'play-frame': 420, 'swing-set': 290, 'mic-voice': 200}
NAMES = {'notice-board': 'Event notice board', 'campfire': 'Campfire', 'log-seat': 'Log seat', 'lights-span': 'String lights',
         'stage': 'Events stage', 'pavilion': 'Round pavilion', 'member-wall': 'Member wall', 'bubble-sculpture': 'Chat bubble sculpture',
         'tree-wisteria': 'Wisteria tree', 'tree-lilac': 'Lilac tree', 'cushions': 'Floor cushions', 'game-table': 'Game table',
         'lamp-typing': 'Typing lamp', 'boost-crystal': 'Boost crystal', 'emoji-sign': 'Reaction sign', 'badge-buoy': 'Badge buoy',
         'canopy-sofa': 'Hangout canopy', 'lavender-stall': 'Lavender stall', 'sofa': 'Outdoor sofa', 'speaker': 'Speaker',
         'bush-lavender': 'Lavender bush', 'flowers-purple': 'Flowers', 'bench-lavender': 'Bench', 'signpost': 'Signpost',
         'parasol': 'Parasol', 'lounger': 'Sun lounger', 'picnic-blanket': 'Picnic blanket', 'cocoa-cart': 'Cocoa cart',
         'gazebo-crystal': 'Crystal gazebo', 'play-frame': 'Slide tower', 'swing-set': 'Swing set', 'mic-voice': 'Voice mic',
         'tree-1': 'Oak tree', 'tree-3': 'Round tree', 'tree-4': 'Bushy tree', 'bush-1': 'Green bush', 'bush-2': 'Green bush', 'bush-5': 'Green bush',
         'flower-1': 'Flower', 'flower-2': 'Flower', 'flower-3': 'Flower'}
PLANT_SCALE = {'tree': 1.27, 'bush': 1.3, 'flower': 1.6}
BUILDINGS = {'notice-board', 'stage', 'pavilion', 'member-wall', 'lavender-stall', 'cocoa-cart', 'gazebo-crystal', 'play-frame', 'canopy-sofa', 'bubble-sculpture'}

PROPS = []; FOOT = []; WARN = []
def footprint_for(kind, x, y, w):
    if kind.startswith('tree'): return {'x': x, 'y': y - 9, 'rx': 31, 'ry': 22}
    if kind in ('stage',): return {'poly': [[round(x - w * .46), round(y - w * .34)], [round(x + w * .46), round(y - w * .34)], [round(x + w * .46), round(y - 10)], [round(x - w * .46), round(y - 10)]]}
    if kind in ('member-wall', 'notice-board'): return {'poly': [[round(x - w * .45), round(y - 60)], [round(x + w * .45), round(y - 60)], [round(x + w * .45), round(y - 4)], [round(x - w * .45), round(y - 4)]]}
    if kind in ('pavilion', 'gazebo-crystal'): return {'x': x, 'y': round(y - w * .2), 'rx': round(w * .44), 'ry': round(w * .2)}
    if kind == 'bubble-sculpture': return {'x': x, 'y': round(y - w * .1), 'rx': round(w * .4), 'ry': round(w * .12)}
    if kind == 'campfire': return {'x': x, 'y': y - 40, 'rx': round(w * .44), 'ry': 44}
    if kind == 'log-seat': return {'x': x, 'y': y - 14, 'rx': round(w * .46), 'ry': 20}
    if kind == 'swing-set': return None
    if kind == 'play-frame': return {'x': x, 'y': y - 30, 'rx': round(w * .3), 'ry': 40}
    if kind in ('bush-lavender',) or kind.startswith('bush-'): return {'x': x, 'y': y - 12, 'rx': round(w * .36), 'ry': 24}
    if kind in ('bench-lavender', 'sofa'): return {'x': x, 'y': y - 12, 'rx': round(w * .44), 'ry': 22}
    if kind in ('lavender-stall', 'cocoa-cart', 'canopy-sofa'): return {'x': x, 'y': y - 26, 'rx': round(w * .42), 'ry': 38}
    if kind == 'game-table': return {'x': x, 'y': y - 26, 'rx': round(w * .4), 'ry': 34}
    if kind in ('lamp-typing', 'signpost', 'parasol', 'emoji-sign'): return {'x': x, 'y': y - 6, 'rx': 15, 'ry': 12}
    if kind in ('speaker', 'mic-voice', 'boost-crystal'): return {'x': x, 'y': y - 14, 'rx': round(w * .38), 'ry': 22}
    if kind == 'lounger': return {'x': x, 'y': y - 24, 'rx': round(w * .38), 'ry': 28}
    if kind == 'cushions': return {'x': x, 'y': y - 14, 'rx': round(w * .4), 'ry': 22}
    return None

def size_of(kind, scale_k=1):
    if kind in HOME_PLANTS:
        w0, h0 = HOME_PLANTS[kind]; return w0, h0, PLANT_SCALE[kind.split('-')[0]] * scale_k
    w0, h0 = SIZES[kind]; return w0, h0, TALL[kind] / h0 * scale_k

def put(kind, x, y, zone, flip=False, scale_k=1, solid=True, pid=None, quiet=False):
    w0, h0, sc = size_of(kind, scale_k)
    if kind in HOME_PLANTS: src = f'/pixi-art/plants/{kind}.svg'; anchor = {'x': .5, 'y': 1}
    else: src = DET + kind + '.svg'; anchor = {'x': .5, 'y': .99}
    x, y = round(x), round(y)
    if zone != 'sea' and hides_deck(x, y, w0 * sc, h0 * sc):
        if not quiet: WARN.append(f'{pid or kind} at ({x},{y}) would hide a deck: left out')
        return None
    p = {'id': pid or f'{kind}-{len(PROPS)}', 'name': NAMES[kind], 'src': src, 'x': x, 'y': y, 'width': w0, 'height': h0,
         'anchor': anchor, 'scale': round(sc, 4), 'flip': flip, 'zone': zone, 'kind': kind}
    PROPS.append(p)
    if solid:
        fp = footprint_for(kind, x, y, w0 * sc)
        if fp: FOOT.append(fp)
        if kind == 'swing-set':
            for s in (-1, 1): FOOT.append({'x': round(x + s * w0 * sc * .42), 'y': y - 10, 'rx': 26, 'ry': 18})
    return p

def put_raw(pid, name, src, vb, anchor_pt, zone, foot=()):
    """a prop drawn in world coordinates (its viewBox is the world box): sits exactly where it was drawn"""
    x0, y0, w0, h0 = vb; ax, ay = anchor_pt
    p = {'id': pid, 'name': name, 'src': src, 'x': round(ax), 'y': round(ay), 'width': w0, 'height': h0,
         'anchor': {'x': round((ax - x0) / w0, 4), 'y': round((ay - y0) / h0, 4)}, 'scale': 1, 'flip': False, 'zone': zone, 'kind': 'lights'}
    PROPS.append(p); FOOT.extend(foot); return p

pp = lambda u, v: (px + u * prx, py + v * pry)
put('campfire', *pp(0, .02), 'plaza', pid='campfire', scale_k=1.3)
put('log-seat', *pp(-.34, .05), 'plaza', pid='log-west', scale_k=1.25)
put('log-seat', *pp(.34, .05), 'plaza', flip=True, pid='log-east', scale_k=1.25)
put('log-seat', *pp(0, .42), 'plaza', pid='log-south', scale_k=1.25)
put('notice-board', *pp(0, -.80), 'plaza', pid='notice-board', scale_k=1.05)
put('bush-lavender', *pp(-.34, -.83), 'plaza', scale_k=1.0, pid='board-planter-w')
put('bush-lavender', *pp(.34, -.83), 'plaza', scale_k=1.0, flip=True, pid='board-planter-e')
for u, v in [(-.74, -.52), (.74, -.52), (-.86, .44), (.86, .44)]:
    put('lamp-typing', *pp(u, v), 'plaza')
LIGHT_POSTS = [pp(-.55, .22), pp(-.38, -.34), pp(.38, -.34), pp(.55, .22)]
LIGHTS = []
for name, posts in [('back', LIGHT_POSTS[1:3]), ('west', LIGHT_POSTS[0:2]), ('east', LIGHT_POSTS[2:4])]:
    doc, vb, anc = lights_svg(posts, name)
    LIGHTS.append((f'lights-{name}.svg', doc))
    put_raw(f'lights-{name}', 'String lights', f'lights-{name}.svg', vb, anc, 'plaza',
            foot=[{'x': round(x), 'y': round(y - 4), 'rx': 16, 'ry': 12} for x, y in posts if (x, y) == anc] if name == 'back' else
                 [{'x': round(x), 'y': round(y - 4), 'rx': 16, 'ry': 12} for x, y in posts if (x, y) == anc])
for u, v in [(-.18, .62), (.18, .62)]:
    pass

sx, sy = STAGE_AT
put('stage', sx, sy, 'stage', pid='events-stage')
put('speaker', sx - 600, sy + 40, 'stage', pid='speaker-w'); put('speaker', sx + 600, sy + 40, 'stage', flip=True, pid='speaker-e')
put('lights-span', sx - 860, sy + 230, 'stage', scale_k=.9); put('lights-span', sx + 860, sy + 230, 'stage', scale_k=.9, flip=True)
put('emoji-sign', sx - 380, sy + 170, 'stage'); put('emoji-sign', sx + 380, sy + 170, 'stage', flip=True)
for u in (-1, 1): put('lamp-typing', 4000 + u * 720, 1960, 'stage')

put('pavilion', 2860, 1330, 'pavilions', pid='pavilion-west')
put('pavilion', 5140, 1330, 'pavilions', flip=True, pid='pavilion-east')
put('boost-crystal', 2560, 1360, 'pavilions', scale_k=.9); put('boost-crystal', 5440, 1360, 'pavilions', scale_k=.9)

mx, my, mrx, mry = SQUARE
put('member-wall', mx, my - mry * .62, 'member-wall', pid='member-wall', scale_k=1.05)
put('bench-lavender', mx - mrx * .45, my + mry * .55, 'member-wall'); put('bench-lavender', mx + mrx * .45, my + mry * .55, 'member-wall', flip=True)
put('lamp-typing', mx - mrx * .92, my - mry * .3, 'member-wall'); put('lamp-typing', mx + mrx * .92, my - mry * .3, 'member-wall')
put('bush-lavender', mx - mrx * .6, my - mry * .72, 'member-wall', scale_k=.9); put('bush-lavender', mx + mrx * .6, my - mry * .72, 'member-wall', scale_k=.9, flip=True)

pdx, pdy, prx_, pry_ = POND
put('tree-wisteria', pdx + prx_ + 150, pdy - 60, 'pond', pid='pond-wisteria')
put('tree-wisteria', pdx - prx_ - 20, pdy - 170, 'pond', flip=True, scale_k=.88, pid='pond-wisteria-2')
put('picnic-blanket', pdx - 120, pdy + pry_ + 210, 'pond', solid=False, pid='pond-picnic')
put('bench-lavender', pdx + 230, pdy + pry_ + 140, 'pond', flip=True)

plx, ply, plrx, plry = PLAY
put('play-frame', plx + .35 * plrx, ply - .05 * plry, 'playground', pid='slide-tower')
put('swing-set', plx - .35 * plrx, ply - .18 * plry, 'playground', pid='swing-set')
put('bench-lavender', plx - .62 * plrx, ply + .72 * plry, 'playground'); put('bench-lavender', plx + .62 * plrx, ply + .75 * plry, 'playground', flip=True)
put('lamp-typing', plx - .98 * plrx, ply - .2 * plry, 'playground')

gx, gy = ACTIVITY[1]['c']; grx, gry = ACTIVITY[1]['rx'], ACTIVITY[1]['ry']
for u, v in [(-.62, -1.25), (.0, -1.32), (.62, -1.25)]:
    put('game-table', gx + u * grx, gy + v * gry, 'game-square')
put('lamp-typing', gx - grx - 70, gy + 60, 'game-square'); put('lamp-typing', gx + grx + 70, gy - 40, 'game-square')

vx, vy, vrx, vry = VOICE
put('mic-voice', vx, vy + 10, 'voice', pid='voice-mic')
for u, v in [(-.55, -.35), (.55, -.35), (-.62, .42), (.62, .42)]:
    put('cushions', vx + u * vrx, vy + v * vry, 'voice', scale_k=.85, flip=u > 0)

for k, (hx, hy) in enumerate([(3200, 4110), (4800, 4110)]):
    put('canopy-sofa', hx, hy, 'hangout', flip=k == 1, pid=f'hangout-canopy-{k + 1}')
    put('cushions', hx + (200 if k == 0 else -200), hy + 70, 'hangout', scale_k=.85, flip=k == 1)
    put('emoji-sign', hx + (-230 if k == 0 else 230), hy - 20, 'hangout', flip=k == 1)

for x, y in [(6420, 3330), (6900, 3500), (6560, 3760)]:
    put('parasol', x, y, 'beach')
for x, y, fl in [(6520, 3400, False), (6800, 3570, True), (6680, 3830, False)]:
    put('lounger', x, y, 'beach', flip=fl)
put('picnic-blanket', 6280, 3600, 'beach', solid=False)
put('bubble-sculpture', 5260, 3120, 'east', pid='chat-bubble')

(lx, ly, lrx, lry), (ex, ey, erx, ery) = ISLETS
put('gazebo-crystal', lx - 300, ly + 150, 'islets', pid='islet-gazebo')
put('tree-wisteria', lx - 420, ly - 40, 'islets', pid='islet-wisteria-1'); put('bush-lavender', lx + 120, ly + 230, 'islets')
put('bench-lavender', lx + 230, ly + 120, 'islets', flip=True)
put('boost-crystal', ex + 220, ey - 20, 'islets', pid='islet-crystal')
put('picnic-blanket', ex + 40, ey + 170, 'islets', solid=False)
put('tree-lilac', ex + 380, ey - 80, 'islets', flip=True, pid='islet-lilac-1'); put('bush-lavender', ex - 280, ey + 170, 'islets')

put('signpost', hp['foot'][0] + 240, hp['foot'][1] - 330, 'harbor', pid='harbor-signpost')

for s in STALLS:
    (sx_, sy_), L = s['c'], s['len']
    for sg in (-1, 1): put('lamp-typing', sx_ + sg * (L / 2 + 50), sy_ + 10, 'stalls')
for A in ACTIVITY:
    if A['id'] == 'activity-1': continue
    (ax, ay), rx, ry = A['c'], A['rx'], A['ry']
    for sg in (-1, 1): put('lamp-typing', ax + sg * (rx + 60), ay + ry * .25, 'activity', quiet=True)

for bx, by in [(700, 900), (7350, 820), (520, 3500), (7550, 4300), (2600, 5250), (5400, 5300), (1100, 4700), (6900, 5150)]:
    if any(math.hypot(bx - b['x'], by - b['y']) < 420 for b in BOATS) or any(seg_dist(bx, by, p['foot'], p['tip']) < 420 for p in PIERS): continue
    if in_poly(bx, by, offset(SAND_EDGE, 200)) or any(in_ell(bx, by, c[0], c[1], c[2] + 300, c[3] + 300) for c in ISLETS): continue
    put('badge-buoy', bx, by, 'sea', solid=False)

for k, s in enumerate(STALLS):
    (sx_, sy_), L = s['c'], s['len']
    put('lavender-stall' if k == 0 else 'cocoa-cart', sx_ + (L / 2 + 250) * (-1 if k == 0 else 1), sy_ + 30, 'stalls', flip=k == 1, pid=f'stall-cart-{k + 1}')

SLEEP_TREES = [('nod-tree-1', 'tree-lilac', (2750, 4180)), ('nod-tree-2', 'tree-1', (3300, 920)),
               ('nod-tree-3', 'tree-wisteria', (6500, 2200)), ('nod-tree-4', 'tree-3', (4950, 4300)),
               ('nod-tree-5', 'tree-lilac', (1250, 2200)), ('nod-tree-6', 'tree-wisteria', (4700, 920))]
for pid, kind, (x, y) in SLEEP_TREES: put(kind, x, y, 'woods', pid=pid, flip=pid.endswith(('2', '4', '6')))
put('lounger', 6250, 3950, 'beach', pid='lounger-south'); put('lounger', 6960, 3380, 'beach', flip=True, pid='lounger-east'); put('lounger', 6620, 3000, 'beach', flip=True, pid='lounger-north')
put('lounger', 1130, 3060, 'cove', pid='lounger-cove'); put('parasol', 1260, 3330, 'cove')

KEEP_OUT = [(PLAZA[0], PLAZA[1], PLAZA[2] + 100, PLAZA[3] + 90), (SQUARE[0], SQUARE[1], SQUARE[2] + 80, SQUARE[3] + 70),
            (POND[0], POND[1], POND[2] + 170, POND[3] + 170), (PLAY[0], PLAY[1], PLAY[2] + 60, PLAY[3] + 60),
            (BEACH[0] + 100, BEACH[1], BEACH[2], BEACH[3]), (VOICE[0], VOICE[1], VOICE[2] + 120, VOICE[3] + 100),
            (STAGE_AT[0], STAGE_AT[1] - 60, 800, 300)]
def occupied(x, y, r):
    for p in PROPS:
        if p['zone'] == 'sea': continue
        w = p['width'] * p['scale']; pr = max(40, w * .45)
        if math.hypot(x - p['x'], (y - p['y']) * 1.4) < pr + r: return True
    return False
def free(x, y, r, pad=20, coast_in=140, h=0):
    if not in_poly(x, y, COAST_IN[coast_in]): return False
    if any(in_ell(x, y, *k) for k in KEEP_OUT) or in_open(x, y, 90): return False
    for _, _, (nx, ny) in SLEEP_TREES:
        if h and y > ny - 10 and y - h * .95 < ny + 14 and abs(x - nx) < r + 90: return False
    for t in (.35, .7, .95):
        if h and (in_open(x, y - h * t, 30) or any(in_ell(x, y - h * t, *k) for k in KEEP_OUT[:2] + KEEP_OUT[5:6])): return False
    if path_dist(x, y) < r * .5 + pad: return False
    if any(math.hypot(x - p['foot'][0], y - p['foot'][1]) < 320 for p in PIERS): return False
    if any(seg_dist(x, y, b['a'], towards(b['a'], b['b'], -240)) < 220 or math.hypot(x - b['b'][0], y - b['b'][1]) < 260 for b in BRIDGES): return False
    for p in PROPS:
        if p['kind'] in BUILDINGS and 0 < y - p['y'] < 340 and abs(x - p['x']) < p['width'] * p['scale'] * .55 + r * .5: return False
    return not occupied(x, y, r)
COAST_IN = {140: offset(COAST, -140), 90: offset(COAST, -90), 60: offset(COAST, -60)}

kinds_tree = ['tree-lilac', 'tree-1', 'tree-wisteria', 'tree-3', 'tree-lilac', 'tree-4', 'tree-1', 'tree-wisteria']
n_tree = n_bush = n_flower = 0
X0, XW, Y0, YH = 700, W - 1400, 560, H - 1100
for i in range(1, 14000):
    x, y = X0 + halton(i, 2) * XW, Y0 + halton(i, 3) * YH
    d_coast = poly_dist(x, y, COAST)
    if n_tree < 52 and (d_coast < 760 or halton(i, 5) < .16) and free(x, y, 110, 46, h=470) \
            and not any(p['kind'] in BUILDINGS and math.hypot(x - p['x'], (y - p['y']) * 1.3) < 430 for p in PROPS):
        k = kinds_tree[i % len(kinds_tree)]
        if put(k, x, y, 'woods', flip=bool(i % 2), scale_k=.9 + .2 * halton(i, 7), quiet=True): n_tree += 1
for i in range(1, 16000):
    x, y = X0 + halton(i + 17000, 2) * XW, Y0 + halton(i + 17000, 3) * YH
    pd = path_dist(x, y)
    if n_bush < 90 and 40 < pd < 260 and free(x, y, 80, 30, 90, h=150):
        k = ['bush-lavender', 'bush-2', 'bush-lavender', 'bush-5', 'bush-lavender', 'bush-1'][i % 6]
        if put(k, x, y, 'gardens', flip=bool(i % 2), scale_k=.85 + .3 * halton(i, 7), quiet=True): n_bush += 1
for i in range(1, 12000):
    x, y = X0 + halton(i + 20000, 2) * XW, Y0 + halton(i + 20000, 3) * YH
    if n_flower < 120 and free(x, y, 40, 14, 60):
        k = ['flowers-purple', 'flower-1', 'flowers-purple', 'flower-2', 'flower-3'][i % 5]
        if put(k, x, y, 'gardens', flip=bool(i % 2), solid=False, scale_k=.85 + .3 * halton(i, 7), quiet=True): n_flower += 1
for (cx, cy, rx, ry), seed in zip(ISLETS, (3, 9)):
    for k in range(6):
        a = halton(k + seed, 2) * 6.28; x, y = cx + math.cos(a) * rx * .72, cy + math.sin(a) * ry * .64
        if not occupied(x, y, 30): put('flowers-purple' if k % 2 else 'flower-3', x, y, 'islets', solid=False, quiet=True)

DEC = {'grass-tuft-1': (44, 26), 'grass-tuft-2': (34, 22), 'grass-tuft-3': (56, 24), 'flower-dot-1': (20, 18), 'flower-dot-2': (26, 18),
       'flower-dot-3': (22, 16), 'pebble-1': (22, 14), 'pebble-2': (34, 16), 'pebble-3': (28, 18), 'sand-speck-1': (16, 8), 'sand-speck-2': (22, 10)}
def on_sand(x, y):
    return (in_poly(x, y, SAND_EDGE) and not in_poly(x, y, COAST)) or in_ell(x, y, *BEACH) or in_ell(x, y, *PLAY)
PAVED = [PLAZA, SQUARE, VOICE] + [(*A['c'], A['rx'], A['ry']) for A in ACTIVITY if A['kind'] == 'square']
FLATS = []
for i in range(1, 6000):
    x, y = 600 + halton(i + 40000, 2) * (W - 1200), 520 + halton(i + 40000, 3) * (H - 1000)
    if not in_poly(x, y, WALK_COAST) or path_dist(x, y) < 10 or any(in_ell(x, y, c[0], c[1], c[2] + 40, c[3] + 40) for c in PAVED) \
       or in_ell(x, y, POND[0], POND[1], POND[2] + 30, POND[3] + 30) or any(in_stall(x, y, s, 20) for s in STALLS): continue
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

SLEEP_WANT = {'nod': 6, 'hammock': 3, 'rock': 5, 'leaf': 6, 'book': 5, 'chair': 3, 'wing': 7, 'box': 5}
NAP_R = {'nod': 41.8, 'leaf': 73.8, 'wing': 60.0, 'hammock': 70.7, 'rock': 46.6, 'book': 63.9, 'chair': 73.7, 'box': 49.7}
SLEEP_AVOID = [{'x': round(PLAZA[0]), 'y': round(PLAZA[1]), 'rx': PLAZA[2] + 60, 'ry': PLAZA[3] + 50, 'name': 'plaza'},
               {'x': round(SQUARE[0]), 'y': round(SQUARE[1]), 'rx': SQUARE[2] + 50, 'ry': SQUARE[3] + 40, 'name': 'member square'},
               {'x': round(PLAY[0]), 'y': round(PLAY[1]), 'rx': PLAY[2] + 20, 'ry': PLAY[3] + 20, 'name': 'playground'},
               {'x': round(POND[0]), 'y': round(POND[1]), 'rx': POND[2] + 90, 'ry': POND[3] + 80, 'name': 'pond'},
               {'x': round(VOICE[0]), 'y': round(VOICE[1]), 'rx': VOICE[2] + 60, 'ry': VOICE[3] + 50, 'name': 'voice circle'},
               {'x': STAGE_AT[0], 'y': STAGE_AT[1] - 60, 'rx': 520, 'ry': 220, 'name': 'stage'}] + \
              [{'x': round(A['c'][0]), 'y': round(A['c'][1]), 'rx': A['rx'] + 50, 'ry': A['ry'] + 40, 'name': A['id']} for A in ACTIVITY] + \
              [{'x': round(s['c'][0]), 'y': round(s['c'][1]), 'rx': round(s['len'] / 2 + 60), 'ry': round(s['depth'] / 2 + 60), 'name': s['id']} for s in STALLS]
_WCOAST = [(round(x), round(y)) for x, y in WALK_COAST]
_ISLETS = [(round(cx), round(cy), rx + 40, ry + 40) for cx, cy, rx, ry in ISLETS]
def _in_shape(x, y, o, pad):
    if 'poly' in o: return in_poly(x, y, o['poly']) or poly_dist(x, y, o['poly']) < pad
    return in_ell(x, y, o['x'], o['y'], o['rx'] + pad, o['ry'] + pad)
def nap_walkable(x, y):
    if not in_poly(x, y, _WCOAST): return False
    if in_ell(x, y, POND[0], POND[1], POND[2] + 30, POND[3] + 30): return False
    return not any(_in_shape(x, y, o, 16) for o in FOOT if abs(o.get('x', o.get('poly', [[x]])[0][0]) - x) < 700)
def nap_why(x, y, pose, r, placed, props):
    if not nap_walkable(x, y) or not nap_walkable(x - r * .8, y) or not nap_walkable(x + r * .8, y): return 'not ground'
    if any(in_ell(x, y, a[0], a[1], a[2] + 60, a[3] + 60) for a in _ISLETS): return 'islet'
    if any(seg_dist(x, y, a, b) < hw + 90 for a, b, hw in DECK_LINES): return 'deck'
    if path_dist(x, y) < 10 + r * .35 + 20: return 'path'
    if any(in_ell(x, y, o['x'], o['y'], o['rx'], o['ry']) for o in SLEEP_AVOID): return 'avoid'
    if poly_dist(x, y, _WCOAST) < r * .6 + 30 + 20: return 'water'
    for p in props:
        if p['zone'] == 'sea': continue
        half = p['width'] * p['scale'] / 2
        if abs(p['x'] - x) > 900: continue
        if p['kind'] in ('picnic-blanket',): continue
        building = p['kind'] in BUILDINGS or p['kind'] == 'lights'
        if math.hypot(x - p['x'], (y - p['y']) * 1.6) < half * (.35 if building else .8) + r + 12: return 'prop ' + p['id']
        if p['y'] > y - 20 and p['y'] - y < p['height'] * p['scale'] * .9 and abs(x - p['x']) < half + r * .6: return 'behind ' + p['id']
    for s in placed:
        if math.hypot(s['x'] - x, (s['y'] - y) * 1.3) < max(300, s['r'] + r + 100) + 40: return 'near ' + s['pose']
        if s['pose'] == pose and math.hypot(s['x'] - x, s['y'] - y) < (850 if pose == 'chair' else 900) + 40: return 'same ' + pose
    return None

def nap_search(anchor, pose, placed, sides=(1, -1)):
    r = NAP_R[pose]; half = anchor['width'] * anchor['scale'] / 2
    for k in range(16):
        d = half * (.85 if anchor['kind'] in BUILDINGS else 1.0) + r + 30 + k * 22
        for ang in (0, 20, -20, 40, -40, 65, 90, -65, -90):
            for sg in sides:
                a = math.radians(ang); x, y = round(anchor['x'] + sg * d * math.cos(a)), round(anchor['y'] + d * math.sin(a) * .62)
                if not nap_why(x, y, pose, r, placed, PROPS): return round(x), round(y), sg < 0
    return None

def sleep_spots():
    placed = []; spots = {k: [] for k in SLEEP_WANT}
    byid = {p['id']: p for p in PROPS}
    for k, (pid, _, _) in enumerate(SLEEP_TREES):
        t = byid[pid]; spots['nod'].append([pid, 0, k % 2 == 1])
        placed.append({'x': t['x'], 'y': t['y'] + 14, 'pose': 'nod', 'r': NAP_R['nod']})
    want = [('chair', lambda p: p['kind'] == 'lounger', 3),
            ('book', lambda p: p['id'].startswith('stall-cart') or p['kind'] in ('pavilion', 'notice-board', 'member-wall', 'bench-lavender', 'game-table', 'canopy-sofa'), 5),
            ('box', lambda p: p['kind'] in ('pavilion', 'speaker', 'boost-crystal', 'signpost', 'play-frame', 'canopy-sofa', 'emoji-sign'), 5),
            ('hammock', lambda p: p['kind'] in ('tree-wisteria', 'tree-lilac', 'tree-1', 'tree-3') and p['zone'] in ('woods', 'pond') and not p['id'].startswith('nod'), 3),
            ('rock', lambda p: p['kind'] in ('bush-lavender', 'bush-2', 'bush-5', 'bush-1') and p['zone'] == 'gardens', 5),
            ('leaf', lambda p: p['kind'] in ('flowers-purple', 'flower-1', 'flower-2', 'flower-3') and p['zone'] == 'gardens', 6),
            ('wing', lambda p: p['kind'] in ('lamp-typing', 'flowers-purple', 'bush-lavender') and p['zone'] not in ('islets', 'pond', 'plaza'), 7)]
    for pose, ok, n in want:
        cands = [p for p in PROPS if ok(p)]
        cands.sort(key=lambda p: halton(sum(map(ord, p['id'])) + 3, 2))
        for p in cands:
            if len(spots[pose]) >= n: break
            got = nap_search(p, pose, placed)
            if got:
                x, y, fl = got; spots[pose].append([x, y, fl]); placed.append({'x': x, 'y': y, 'pose': pose, 'r': NAP_R[pose], 'by': p['id']})
        if len(spots[pose]) < n: WARN.append(f'sleep {pose}: only {len(spots[pose])} of {n}')
    return spots, placed
SLEEP, SLEEP_PLACED = sleep_spots()

def main():
    os.makedirs(ART, exist_ok=True); os.makedirs(DATA, exist_ok=True)
    body = ground_svg()
    open(os.path.join(ART, 'ground.svg'), 'w').write(svg_doc(body, (0, 0, W, H), 'Campfire Commons ground'))
    tiles = []; y = 0
    for r_, th in enumerate(TH):
        x = 0
        for c, tw in enumerate(TW):
            name = f'ground-r{r_}-c{c}.svg'
            open(os.path.join(ART, name), 'w').write(svg_doc(body, (x, y, tw, th), f'Campfire Commons ground tile {r_ + 1}, {c + 1}'))
            tiles.append({'src': name, 'x': x, 'y': y, 'width': tw, 'height': th}); x += tw
        y += th
    decks = []
    for k, p in enumerate(PIERS):
        moor = [(b['x'], b['y']) for b in (BOATS[:3] if k == 0 else BOATS[2 + k:3 + k])]
        svg, (x0, y0, w0, h0) = jetty_svg(p, moor)
        if k == 0:
            open(os.path.join(GEN, 'harbor-jetty-preview.svg'), 'w').write(svg)
            json.dump({'x': x0, 'y': y0, 'width': w0, 'height': h0}, open(os.path.join(GEN, 'harbor-jetty-preview.json'), 'w')); continue
        fn = f'jetty-{p["name"]}.svg'; open(os.path.join(ART, fn), 'w').write(svg)
        decks.append({'src': fn, 'x': x0, 'y': y0, 'width': w0, 'height': h0})
    home_bridge = open(os.path.join(ROOT, 'public/pixi-art/bridge-jetty-2.svg')).read()
    vx, vy, vw, vh = BR2['vb']
    for k, b in enumerate(BRIDGES):
        inner = home_bridge[home_bridge.index('>', home_bridge.index('<svg')) + 1: home_bridge.rindex('</svg>')]
        tf = f'translate({f(b["x"] - vx)} {f(b["y"] - vy)})' + (f' translate({f(2 * vx + vw)} 0) scale(-1 1)' if b['mirror'] else '')
        fn = f'bridge-islet-{k + 1}.svg'
        open(os.path.join(ART, fn), 'w').write(f'<?xml version=\'1.0\' encoding=\'utf-8\'?>\n<svg xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round" '
            f'viewBox="{f(b["x"])} {f(b["y"])} {f(vw)} {f(vh)}" width="{f(vw)}" height="{f(vh)}"><title>Campfire Commons islet bridge {k + 1} (home footbridge 2{" mirrored" if b["mirror"] else ""})</title><g transform="{tf}">{inner}</g></svg>\n')
        decks.append({'src': fn, 'x': round(b['x'], 2), 'y': round(b['y'], 2), 'width': round(vw, 2), 'height': round(vh, 2)})
    for fn, doc in LIGHTS: open(os.path.join(ART, fn), 'w').write(doc)
    props_out = [{k: v for k, v in p.items() if k not in ('kind',)} for p in PROPS]
    art = {'width': W, 'height': H, 'sea': SEA, 'theme': 'community', 'name': 'Campfire Commons',
           'ground': {'tiles': tiles}, 'decks': decks, 'flats': FLATS, 'props': props_out}
    json.dump(art, open(os.path.join(ART, 'art.json'), 'w'), indent=1)
    R = lambda pts: [[round(x), round(y)] for x, y in pts]
    walkways = [{'a': [round(v) for v in b['a']], 'b': [round(v) for v in b['b']], 'w': 84} for b in BRIDGES]
    for p in PIERS[1:]:
        a = towards(p['foot'], p['tip'], -55); bb = towards(p['tip'], p['foot'], 44)
        walkways.append({'a': [round(a[0]), round(a[1])], 'b': [round(bb[0]), round(bb[1])], 'w': p['width']})
    zones = {
        'plaza': {'name': 'Campfire commons', 'x': round(PLAZA[0]), 'y': round(PLAZA[1]), 'rx': PLAZA[2], 'ry': PLAZA[3], 'spawn': [round(PLAZA[0]), round(PLAZA[1] + 330)]},
        'stage': {'name': 'Events stage', 'x': STAGE_AT[0], 'y': STAGE_AT[1], 'spawn': [4000, 1700]},
        'member-wall': {'name': 'Member wall', 'x': SQUARE[0], 'y': SQUARE[1], 'rx': SQUARE[2], 'ry': SQUARE[3], 'spawn': [SQUARE[0], SQUARE[1] + 60]},
        'voice-circle': {'name': 'Voice circle', 'x': VOICE[0], 'y': VOICE[1], 'rx': VOICE[2], 'ry': VOICE[3], 'spawn': [VOICE[0] - 150, VOICE[1] - 40]},
        'hangouts': {'name': 'Hangout corners', 'x': 3200, 'y': 4110, 'spawn': [3200, 4300]},
        'pond': {'name': 'Lily pond', 'x': POND[0], 'y': POND[1], 'spawn': [POND[0] + 300, POND[1] + POND[3] + 140]},
        'playground': {'name': 'Playground', 'x': PLAY[0], 'y': PLAY[1], 'spawn': [PLAY[0], PLAY[1] + 120]},
        'beach': {'name': 'Beach', 'x': 6560, 'y': 3500, 'spawn': [6620, 3650]},
        'islets': {'name': 'Islets', 'x': round(ISLETS[0][0]), 'y': round(ISLETS[0][1]), 'spawn': [round(ISLETS[0][0]) + 200, round(ISLETS[0][1]) - 120]},
    }
    for A in ACTIVITY:
        zones[A['id']] = {'name': A['name'], 'kind': A['kind'], 'x': round(A['c'][0]), 'y': round(A['c'][1]), 'rx': A['rx'], 'ry': A['ry'],
                          'spawn': [round(A['c'][0]), round(A['c'][1])]}
    for s in STALLS:
        zones[s['id']] = {'name': s['name'], 'kind': 'stall-row', 'x': round(s['c'][0]), 'y': round(s['c'][1]), 'length': s['len'], 'depth': s['depth'],
                          'angle': s['ang'], 'pitches': max(3, round((s['len'] - s['depth']) / 200)), 'spawn': [round(s['c'][0]), round(s['c'][1])]}
    water = [{'x': POND[0], 'y': POND[1], 'rx': POND[2] + 10, 'ry': POND[3] + 10}]
    islets = [[round(cx), round(cy), rx + 40, ry + 40] for cx, cy, rx, ry in ISLETS]
    world = {'width': W, 'height': H, 'theme': 'community', 'name': 'Campfire Commons', 'coast': R(WALK_COAST[::2]), 'water': water, 'bridges': [], 'obstacles': FOOT,
             'islets': islets, 'walkways': walkways, 'zones': zones,
             'arches': [{'a': [round(v, 2) for v in b['a']], 'b': [round(v, 2) for v in b['b']], 'r': ARCH_R, 'w': 84} for b in BRIDGES],
             'paths': [[[round(x), round(y)] for x, y in path_samples(p, 60)] for p in PATHS],
             'pathWidths': [p['w'] for p in PATHS],
             'sleepSpots': SLEEP, 'sleepAvoid': SLEEP_AVOID,
             'props': [{'name': p['name'], 'x': p['x'], 'y': p['y'], 'zone': p['zone']} for p in PROPS if p['zone'] not in ('gardens', 'woods', 'sea')],
             'jetties': [{'name': p['name'], 'foot': [round(v) for v in p['foot']], 'tip': [round(v) for v in p['tip']], 'width': p['width']} for p in PIERS],
             'landArea': round(area_of(SAND_EDGE))}
    json.dump(world, open(os.path.join(DATA, 'world.json'), 'w'))
    walk = {'width': W, 'height': H, 'coast': R(WALK_COAST), 'obstacles': FOOT, 'walkways': walkways, 'bridges': [], 'islets': islets, 'water': water}
    json.dump(walk, open(os.path.join(DATA, 'walk-world.json'), 'w'))
    harbor = {'jetty': {'foot': [round(v) for v in hp['foot']], 'tip': [round(v) for v in hp['tip']], 'width': hp['width']},
              'boats': BOATS, 'spawn': zones['plaza']['spawn']}
    json.dump(harbor, open(os.path.join(DATA, 'harbor.json'), 'w'), indent=1)
    for w_ in WARN: print('WARN', w_)
    for s in SLEEP_PLACED: print('sleep', s['pose'], s['x'], s['y'], s.get('by', ''))
    print(f'props {len(PROPS)} (trees {n_tree}, bushes {n_bush}, flowers {n_flower}), flats {len(FLATS)}, obstacles {len(FOOT)}, boats {len(BOATS)}')
    print('piers', [(p['name'], [round(v) for v in p['foot']], [round(v) for v in p['tip']]) for p in PIERS])
    print('islets', islets, 'bridges', [(b['a'], b['b']) for b in BRIDGES])
    xs = [x for x, y in SAND_EDGE]; ys = [y for x, y in SAND_EDGE]
    print(f'coast (grass) area {area_of(COAST) / 1e6:.2f}M, sand edge {area_of(SAND_EDGE) / 1e6:.2f}M, walk {area_of(WALK_COAST) / 1e6:.2f}M; sand bbox x {min(xs):.0f}-{max(xs):.0f} y {min(ys):.0f}-{max(ys):.0f}; sleepers {sum(len(v) for v in SLEEP.values())}')

if __name__ == '__main__':
    main()
