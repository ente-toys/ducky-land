# drip_style.py: the Drip Ducky art language as a prop kit for Ducky Land.
# Rules measured from drip.ente.com's ducky_base.svg, not guessed:
#   - ink #232323 outline = 7.5 px on the 713 px Ducky canvas -> at plaza scale 0.24 that is 1.8 px. Every prop uses T.
#   - shading: one flat darker side-shape on the RIGHT (Drip body #F2BA3D crescent, ~22% of the width),
#     one white highlight streak on the upper-LEFT edge, no gradients.
#   - silhouettes: chunky rounded blobs, smooth curves with a little hand wobble.
#   - palette: Drip yellows #F4D93B/#F2BA3D, belly #FFF4C5, orange #FF814A, ink #232323, white, plus the
#     colours Drip's own outfits use (greys #C7C3BA #B7B7B7 #727272 #565656, green #58BF43, blue #4794D8,
#     red #F0463F, amber #FFAE2C, purple #8E75DD, pink #FF669D, brown #AF6734).
import math, random

INK = '#232323'
DUCK_SCALE = 0.24
T = round(7.5 * DUCK_SCALE, 2)          # 1.8: the Ducky's own line weight at plaza scale
WHITE = '#FFFFFF'

PAL = {
    'grass': ('#8ED66B', '#6CC24E'), 'leaf': ('#58BF43', '#3E9F2F'),
    'stone': ('#E6E2DA', '#C7C3BA'), 'stone2': ('#C7C3BA', '#B7B7B7'),
    'water': ('#7FD0F3', '#4794D8'), 'wood': ('#D58E50', '#AF6734'),
    'metal': ('#727272', '#565656'), 'glass': ('#FFF4C5', '#F4D93B'),
    'floor': ('#FFF4C5', '#F6E3A7'), 'cobble': ('#F7E6AF', '#EFD58E'),
    'pot': ('#F4764E', '#D9573A'), 'red': ('#F0463F', '#C9332D'), 'blue': ('#4794D8', '#3471B8'),
    'green': ('#58BF43', '#3E9F2F'), 'amber': ('#FFAE2C', '#E38E12'), 'purple': ('#8E75DD', '#6F57C2'),
    'pink': ('#FF669D', '#E04A80'), 'yellow': ('#F4D93B', '#F2BA3D'), 'white': ('#FFFFFF', '#E9E6E0'),
}

_n = [2000]
def nid():
    _n[0] += 1
    return f'5:{_n[0]}'

def c(h):
    h = h.lstrip('#').upper()
    return h if len(h) == 8 else 'FF' + h

def wobble(pts, amt, rng):
    return [(x + rng.uniform(-amt, amt), y + rng.uniform(-amt, amt)) for x, y in pts]

def ellipse_pts(w, h, n=10, rot=0.0):
    return [(w / 2 * math.cos(2 * math.pi * i / n + rot), h / 2 * math.sin(2 * math.pi * i / n + rot)) for i in range(n)]

def path_xml(pts, closed=True, tension=1.0):
    """Smooth path through pts (Catmull-Rom as mirrored cubic vertices)."""
    n = len(pts); v = []
    for i, (x, y) in enumerate(pts):
        if not closed and (i == 0 or i == n - 1):
            v.append(f'<StraightVertex x="{x:.2f}" y="{y:.2f}"/>'); continue
        px, py = pts[i - 1]; nx, ny = pts[(i + 1) % n]
        ang = math.atan2(ny - py, nx - px); d = math.hypot(nx - px, ny - py) / 6 * tension
        v.append(f'<CubicMirroredVertex x="{x:.2f}" y="{y:.2f}" rotation="{ang:.4f}" distance="{d:.2f}"/>')
    return f'<PointsPath isClosed="{"true" if closed else "false"}">' + ''.join(v) + '</PointsPath>'

def poly_xml(pts, closed=True, radius=0):
    r = f' radius="{radius:g}"' if radius else ''
    return f'<PointsPath isClosed="{"true" if closed else "false"}">' + ''.join(f'<StraightVertex x="{x:.2f}" y="{y:.2f}"{r}/>' for x, y in pts) + '</PointsPath>'

def fill(col): return f'<Fill><SolidColor colorValue="{c(col)}"/></Fill>'
def stroke(col=INK, t=T): return f'<Stroke thickness="{t:g}" cap="round" join="round"><SolidColor colorValue="{c(col)}"/></Stroke>'

def shape(name, x, y, geo, paints='', extra='', clips=(), sid=None):
    sid = sid or nid()
    cl = ''.join(f'<ClippingShape sourceId="{k}" name="Clip"/>' for k in clips)
    return sid, f'<Shape name="{name}" id="{sid}" x="{x:.2f}" y="{y:.2f}"{extra}>{geo}{paints}{cl}</Shape>'

def blob(name, x, y, geo, pal, w, shade=0.24, hi=0.07, outline=True, flat=False):
    """One Drip-shaded blob. geo = path xml in local coords, w = its width.
    Layers, bottom to top: dark side colour (the whole blob, also the clipper), white (blob shifted left),
    lit colour (blob shifted right+down, clipped to the blob AND to the shifted-left copy), ink outline.
    Returns xml lines TOP FIRST (Rive paints earlier siblings on top)."""
    base, dark = PAL[pal] if isinstance(pal, str) else pal
    out = []
    if outline:
        out.append(shape(name + ' Ink', x, y, geo, stroke())[1])
    if flat:
        out.append(shape(name, x, y, geo, fill(base))[1])
        return out
    bid = nid(); hid = nid()
    kx = shade * w; hx = hi * w
    lit = shape(name + ' Lit', x + hx, y + hx * 0.9, geo, fill(base), clips=(bid, hid))[1]
    out.append(lit)
    if hi:
        out.append(shape(name + ' Shine', x - kx, y, geo, fill(WHITE), clips=(bid,))[1])
    out.append(shape(name + ' Side Clip', x - kx, y, geo, '', sid=hid)[1])
    out.append(shape(name, x, y, geo, fill(dark), sid=bid)[1])
    return out

def group(name, x, y, kids, extra=''):
    gid = nid()
    return gid, [f'<Node name="{name}" id="{gid}" x="{x:.2f}" y="{y:.2f}"{extra}>'] + kids + ['</Node>']

def ground_shadow(w, h, col='#E9D597'):
    return shape('Shadow', 0, 0, path_xml(ellipse_pts(w, h, 10)), fill(col))[1]

# ---------------- props (all return (lines TOP FIRST), local origin = ground contact point) ----------------
def tree(seed, r=70):
    rng = random.Random(seed)
    k = []
    lobes = [(-0.55, -1.35, 0.62), (0.55, -1.32, 0.6), (0, -1.75, 0.72), (-0.15, -1.1, 0.55)]
    for i, (dx, dy, rr) in enumerate(sorted(lobes, key=lambda l: -l[1])):
        pts = wobble(ellipse_pts(rr * r * 2, rr * r * 1.85, 9, rng.uniform(0, 1)), r * 0.04, rng)
        k = blob('Canopy', dx * r, dy * r, path_xml(pts), 'leaf', rr * r * 2, shade=0.22, hi=0.03) + k
    trunk = [(-0.13 * r, 0), (-0.1 * r, -0.95 * r), (0.1 * r, -0.95 * r), (0.15 * r, 0)]
    k += blob('Trunk', 0, 0, poly_xml(trunk, radius=4), 'wood', 0.3 * r, shade=0.35, hi=0)
    k.append(ground_shadow(r * 1.5, r * 0.36, '#6CC24E'))
    return k

def bush(seed, w=90):
    rng = random.Random(seed)
    k = []
    for dx, dy, s in [(-0.3, -0.35, 0.6), (0.3, -0.38, 0.58), (0, -0.55, 0.7)]:
        pts = wobble(ellipse_pts(w * s, w * s * 0.85, 8, rng.uniform(0, 1)), w * 0.03, rng)
        k = blob('Bush', dx * w, dy * w, path_xml(pts), 'leaf', w * s, shade=0.22, hi=0.03) + k
    return k

def planter(seed, w=96):
    rng = random.Random(seed)
    k = []
    for fx, fy, col in [(-0.25, -0.62, 'pink'), (0.05, -0.78, 'amber'), (0.3, -0.6, 'white'), (-0.05, -0.5, 'pink'), (0.22, -0.42, 'amber')]:
        pts = ellipse_pts(w * 0.16, w * 0.16, 6)
        k += blob('Flower', fx * w, fy * w, path_xml(pts), col, w * 0.16, shade=0.25, hi=0)
    k += bush(seed, w * 0.95)
    pot = [(-0.42 * w, -0.32 * w), (0.42 * w, -0.32 * w), (0.32 * w, 0), (-0.32 * w, 0)]
    k += blob('Pot', 0, 0, poly_xml(pot, radius=8), 'pot', 0.84 * w, shade=0.24, hi=0.06)
    k.append(ground_shadow(w * 0.95, w * 0.22))
    return k

def bench(w=190):
    k = []
    k += blob('Back Rest', 0, -0.52 * w, poly_xml([(-0.5 * w, -0.08 * w), (0.5 * w, -0.08 * w), (0.5 * w, 0.06 * w), (-0.5 * w, 0.06 * w)], radius=7), 'wood', w, shade=0.2, hi=0)
    k += blob('Seat', 0, -0.26 * w, poly_xml([(-0.53 * w, -0.06 * w), (0.53 * w, -0.06 * w), (0.53 * w, 0.06 * w), (-0.53 * w, 0.06 * w)], radius=7), 'wood', 1.06 * w, shade=0.2, hi=0)
    for lx in (-0.4, 0.4):
        k += blob('Leg', lx * w, 0, poly_xml([(-0.035 * w, -0.62 * w), (0.035 * w, -0.62 * w), (0.035 * w, 0), (-0.035 * w, 0)], radius=3), 'metal', 0.07 * w, shade=0.4, hi=0)
    k.append(ground_shadow(w * 1.1, w * 0.13))
    return k

def lamp(h=230):
    k = []
    k += blob('Cap', 0, -h, path_xml([(-0.17 * h, 0.02 * h), (0, -0.09 * h), (0.17 * h, 0.02 * h), (0, 0.05 * h)]), 'metal', 0.34 * h, shade=0.3, hi=0.05)
    k += blob('Glass', 0, -0.9 * h, poly_xml([(-0.1 * h, -0.08 * h), (0.1 * h, -0.08 * h), (0.07 * h, 0.08 * h), (-0.07 * h, 0.08 * h)], radius=5), 'glass', 0.2 * h, shade=0.3, hi=0.08)
    k += blob('Post', 0, 0, poly_xml([(-0.025 * h, -0.82 * h), (0.025 * h, -0.82 * h), (0.035 * h, -0.05 * h), (-0.035 * h, -0.05 * h)], radius=3), 'metal', 0.06 * h, shade=0.4, hi=0)
    k += blob('Foot', 0, 0, path_xml(ellipse_pts(0.18 * h, 0.08 * h, 8)), 'metal', 0.18 * h, shade=0.3, hi=0.05)
    k.append(ground_shadow(0.3 * h, 0.07 * h))
    return k

def stall(a_col, w=290, seed=1):
    k = []
    top, bot = -0.82 * w, -0.62 * w
    n = 8; sw = 1.0 * w / n
    roof_pts = [(-0.5 * w, bot), (-0.44 * w, top), (0.44 * w, top), (0.5 * w, bot)]
    roof_id = nid()
    stripes = []
    for j in range(n):
        x0 = -0.5 * w + j * sw
        col = PAL[a_col][0] if j % 2 == 0 else WHITE
        if j >= n - 2:
            col = PAL[a_col][1] if j % 2 == 0 else '#E9E6E0'
        stripes.append(shape('Stripe', 0, 0, poly_xml([(x0, top - 4), (x0 + sw, top - 4), (x0 + sw, bot + 4), (x0, bot + 4)]), fill(col), clips=(roof_id,))[1])
    scallops = []
    for j in range(n):
        x0 = -0.5 * w + j * sw + sw / 2
        col = PAL[a_col][0] if j % 2 == 0 else WHITE
        if j >= n - 2:
            col = PAL[a_col][1] if j % 2 == 0 else '#E9E6E0'
        scallops.append(shape('Scallop', x0, bot, path_xml(ellipse_pts(sw, sw * 0.8, 8)), fill(col) + stroke())[1])
    k.append(shape('Roof Ink', 0, 0, path_xml(roof_pts, tension=0.25), stroke())[1])
    k += stripes
    k.append(shape('Roof', 0, 0, path_xml(roof_pts, tension=0.25), fill(WHITE), sid=roof_id)[1])
    k += scallops[::-1]
    # produce
    rng = random.Random(seed)
    for j, (fx, col) in enumerate([(-0.3, 'red'), (-0.1, 'amber'), (0.1, 'green'), (0.3, 'pink')]):
        for q in range(3):
            k += blob('Fruit', fx * w + (q - 1) * 0.045 * w, -0.4 * w - (q == 1) * 0.03 * w, path_xml(ellipse_pts(0.06 * w, 0.06 * w, 6)), col, 0.06 * w, shade=0.3, hi=0.1)
        k += blob('Crate', fx * w, -0.33 * w, poly_xml([(-0.085 * w, -0.05 * w), (0.085 * w, -0.05 * w), (0.08 * w, 0.04 * w), (-0.08 * w, 0.04 * w)], radius=4), 'wood', 0.17 * w, shade=0.25, hi=0)
    k += blob('Counter Top', 0, -0.36 * w, poly_xml([(-0.47 * w, -0.03 * w), (0.47 * w, -0.03 * w), (0.47 * w, 0.03 * w), (-0.47 * w, 0.03 * w)], radius=5), 'wood', 0.94 * w, shade=0.2, hi=0)
    k += blob('Counter', 0, 0, poly_xml([(-0.43 * w, -0.34 * w), (0.43 * w, -0.34 * w), (0.43 * w, 0), (-0.43 * w, 0)], radius=10), 'wood', 0.86 * w, shade=0.22, hi=0.015)
    for px in (-0.42, 0.42):
        k += blob('Post', px * w, -0.3 * w, poly_xml([(-0.02 * w, -0.34 * w), (0.02 * w, -0.34 * w), (0.02 * w, 0), (-0.02 * w, 0)], radius=3), 'wood', 0.04 * w, shade=0.4, hi=0)
    k.append(ground_shadow(w * 1.05, w * 0.12))
    return k

def pennant(col):
    w = 22
    return blob('Pennant', 0, 0, path_xml([(-w / 2, 0), (w / 2, 0), (0, w * 1.2)], tension=0.3), col, w, shade=0.3, hi=0)

def cobble(rng, w):
    pts = wobble(ellipse_pts(w, w * 0.5, 7, rng.uniform(0, 1)), w * 0.05, rng)
    return [shape('Cobble', 0, 0, path_xml(pts), fill(PAL['cobble'][0]) + stroke(INK, T))[1]]

def tuft(rng):
    s_ = rng.uniform(0.8, 1.2)
    pts = [(-7 * s_, 0), (-4 * s_, -11 * s_), (0, -2 * s_), (4 * s_, -12 * s_), (7 * s_, 0)]
    return [shape('Tuft', 0, 0, poly_xml(pts, closed=False), stroke(INK, T))[1]]
