# Centre plazas for the three themed islands (boss picks 6 Nov, concepts/themes/centre-variations/PICKS.md).
# Builds every procedural layer (paving decals, step rings, terrace, pool rim, jets, clock hands), measures the traced
# landmark SVGs (scripts/themes/centre-trace.py), and writes public/pixi-art/themes/<theme>/centre/centre.json.
#
# Coordinates: world units (one standing Ducky = 130). Every piece is authored in CENTRE-LOCAL coordinates, origin (0,0)
# = the centre's ground point (sunflower: plaza centre at the top-ring level; pink: lower plaza centre; library: pool
# centre). The engine is a flat 2D walker, so walk coordinates = screen coordinates; raised and sunken levels are drawn
# shifted on screen and the footprints in centre.json are in those same screen coordinates.
# Camera: home's ring projection, ry = rx * 36/47 (fountain-wishing.svg data-depth-ratio 0.765957).
# Style: home's ink #39452F at 2.6, flat fills, one darker band lower-right, one cream highlight upper-left.
#
# venv: python3.11 -m venv vt && vt/bin/pip install vtracer cairosvg pillow numpy scipy shapely scikit-image
# usage: vt/bin/python scripts/themes/centre-build.py
import json, math, os, io, re
import numpy as np
from shapely.geometry import Polygon, Point, box, MultiPolygon, LineString
from shapely.ops import unary_union
from shapely import affinity
from scipy.spatial import Voronoi
import cairosvg
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes')
K = 36 / 47
INK = '#39452F'; SW = 2.6
DUCK_AREA = 80 * 80 * K   # ground one standing Ducky needs in a crowd (80 x 61 on screen)

def ell(cx, cy, rx, ry=None, n=220):
    ry = rx * K if ry is None else ry
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    return Polygon(np.c_[cx + rx * np.cos(t), cy + ry * np.sin(t)])

def polys(g):
    if g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    return [p for p in getattr(g, 'geoms', []) if isinstance(p, Polygon) and p.area > 1]

def ring_d(coords):
    c = list(coords)[:-1]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in c) + 'Z'

def gd(g):
    return ' '.join(ring_d(p.exterior.coords) + ''.join(ring_d(i.coords) for i in p.interiors) for p in polys(g))

def fill(g, col, stroke=INK, sw=SW, op=None, extra=''):
    if g.is_empty: return ''
    s = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ''
    o = f' stroke-opacity="{op}"' if op else ''
    return f'<path d="{gd(g)}" fill="{col}" fill-rule="evenodd"{s}{o}{extra}/>'

def line(pts, col, sw, extra=''):
    return f'<path d="M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + f'" fill="none" stroke="{col}" stroke-width="{sw}"{extra}/>'

def arc(cx, cy, rx, a0, a1, n=60, ry=None):
    ry = rx * K if ry is None else ry
    t = np.radians(np.linspace(a0, a1, n))
    return list(zip(cx + rx * np.cos(t), cy + ry * np.sin(t)))

def wedge(cx, cy, a0, a1, R=4000):
    t = np.radians(np.linspace(a0, a1, 30))
    return Polygon([(cx, cy)] + list(zip(cx + R * np.cos(t), cy + R * np.sin(t))))

class Piece:
    def __init__(s, theme, name, title): s.theme, s.name, s.title, s.els, s.geo = theme, name, title, [], []
    def add(s, el, g=None):
        s.els.append(el)
        if g is not None and not g.is_empty: s.geo.append(g)
    def write(s, pad=6, bounds=None):
        x0, y0, x1, y1 = bounds or unary_union(s.geo).bounds
        x0, y0, x1, y1 = math.floor(x0 - pad), math.floor(y0 - pad), math.ceil(x1 + pad), math.ceil(y1 + pad)
        w, h = x1 - x0, y1 - y0
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x0} {y0} {w} {h}" '
               f'stroke-linecap="round" stroke-linejoin="round"><title>{s.title}</title>'
               f'<desc>Original Ducky Land vector artwork, centre plaza ({s.theme}), drawn in home style.</desc>{"".join(s.els)}</svg>')
        path = os.path.join(ART, s.theme, 'centre', s.name + '.svg')
        os.makedirs(os.path.dirname(path), exist_ok=True); open(path, 'w').write(svg)
        s.box = (x0, y0, w, h)
        return s

def entry(p, layer, **kw):
    x0, y0, w, h = p.box
    e = dict(id=p.name, file=p.name + '.svg', layer=layer, x=x0, y=y0, width=w, height=h, anchor=dict(x=0, y=0), at=[x0, y0])
    e.update(kw); return e

def traced(theme, name):
    path = os.path.join(ART, theme, 'centre', name + '.svg')
    s = open(path).read()
    w, h = (float(v) for v in re.search(r'width="([\d.]+)" height="([\d.]+)"', s).groups())
    im = np.array(Image.open(io.BytesIO(cairosvg.svg2png(url=path, output_width=int(round(w)), output_height=int(round(h))))).convert('RGBA'))
    return w, h, im

def sorted_entry(theme, name, at, ax, ay, layer='sorted', **kw):
    w, h, _ = traced(theme, name)
    e = dict(id=name, file=name + '.svg', layer=layer, x=round(at[0] - ax * w, 1), y=round(at[1] - ay * h, 1), width=round(w, 1),
             height=round(h, 1), anchor=dict(x=round(ax, 4), y=round(ay, 4)), at=[round(at[0], 1), round(at[1], 1)], sortY=round(at[1], 1))
    e.update(kw); return e

def shape_json(g, tol=3):
    out = []
    for p in polys(g.simplify(tol)):
        out.append(dict(poly=[[round(x, 1), round(y, 1)] for x, y in list(p.exterior.coords)[:-1]]))
    return out

def flagstones(region, seed, cell, colfill, coljoint, jw):
    """Irregular flagstones (voronoi) clipped to region: one fill + joint strokes, like home's plaza paving."""
    rnd = np.random.default_rng(seed)
    x0, y0, x1, y1 = region.bounds
    pts = []
    for y in np.arange(y0 - cell, y1 + cell, cell * .82):
        for x in np.arange(x0 - cell, x1 + cell, cell):
            pts.append((x + rnd.uniform(-.32, .32) * cell + (cell / 2 if int((y - y0) / (cell * .82)) % 2 else 0), y + rnd.uniform(-.28, .28) * cell * .82))
    vor = Voronoi(pts); segs = []
    for (a, b) in vor.ridge_vertices:
        if a < 0 or b < 0: continue
        L = LineString([vor.vertices[a], vor.vertices[b]]).intersection(region)
        for g in ([L] if isinstance(L, LineString) else getattr(L, 'geoms', [])):
            if isinstance(g, LineString) and g.length > 2: segs.append(list(g.coords))
    d = ' '.join('M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in s) for s in segs)
    return fill(region, colfill, None) + f'<path d="{d}" fill="none" stroke="{coljoint}" stroke-width="{jw}"/>'

def capacity(walk, blocked):
    a = walk.difference(blocked).area
    return round(a), int(a / DUCK_AREA)

# =============================================================================================== SUNFLOWER
def sunflower():
    T = 'sunflower'
    STONE, JOINT, RISER, RISER_SH, CREAM, EDGE = '#FFF3D2', '#E9D49A', '#EBD49C', '#DCC084', '#FFFBEC', '#E4C567'
    h = 52                                     # one step ring, screen height
    OUT = 1150                                 # plaza outer edge (the island's plaza zone is rx 1140)
    FLOOR_R, FLOOR_DZ = 880, 3 * h             # sunken floor: plan radius 880, drawn 156 lower
    LV = [('s1', 880, 970, 2 * h), ('s2', 970, 1060, h), ('top', 1060, OUT, 0)]   # (name, r_in, r_out, depth)
    SH = 95                                    # stair half width (plan)
    STEPS, DROP = 6, h * 3 / 6                 # 6 steps of 26 drop
    RUN = (OUT - FLOOR_R) / (STEPS - 1)        # the last riser lands exactly on the floor edge
    def chan(dz):                              # the four stair channels, on screen at a level drawn dz lower
        return unary_union([box(-SH, -3000, SH, 0), box(-SH, 0, SH, 3000),
                            box(0, dz - SH * K, 3000, dz + SH * K), box(-3000, dz - SH * K, 0, dz + SH * K)])
    CH = unary_union([chan(dz) for _, _, _, dz in LV])
    CHL = {n: chan(dz) for n, _, _, dz in LV}

    out = dict(theme=T, name='Sunflower clock plaza', concept='concepts/themes/centre-variations/sunflower-combo-a.png',
               origin='plaza centre at the outer (top ring) ground level', depthRatio=round(K, 6), pieces=[])

    # decal: the sunken floor, cream flagstones (the island's own plaza stone and joint colours)
    floor = ell(0, FLOOR_DZ, FLOOR_R)
    d = Piece(T, 'decal-floor', 'Sunflower plaza floor paving')
    d.add(flagstones(floor, 7, 92, STONE, JOINT, 6), floor)
    d.add(fill(ell(0, FLOOR_DZ + 6, FLOOR_R * .985), 'none', EDGE, 10, '.7'))
    d.add(fill(floor, 'none', INK, SW, '.6'))
    d.write()
    out['pieces'].append(entry(d, 'decal', note='flat on the ground, under everything'))

    # back: step rings (risers + faces), the four staircases. Drawn under every Ducky.
    b = Piece(T, 'back', 'Sunflower plaza step rings and stairs')
    faces = {}; face_els = {}
    def stair_treads(axis):
        """treads (screen polygons) and risers for one staircase; axis = 'N','S','E','W'."""
        tr, rs = [], []
        for i in range(STEPS - 1):            # the last step is the floor itself
            ra, rb, z = OUT - RUN * i, OUT - RUN * (i + 1), DROP * (i + 1)
            if axis in 'NS':
                sg = -1 if axis == 'N' else 1
                ya, yb = sg * ra * K + z, sg * rb * K + z
                tr.append(box(-SH, min(ya, yb), SH, max(ya, yb)))
                if axis == 'N':
                    rs.append(box(-SH, -ra * K + z - DROP, SH, -ra * K + z))
                    if i == STEPS - 2: rs.append(box(-SH, -rb * K + z, SH, -rb * K + z + DROP))   # last riser down to the floor
            else:
                sg = 1 if axis == 'E' else -1
                xa, xb = sorted((sg * ra, sg * rb))
                tr.append(box(xa, -SH * K + z, xb, SH * K + z))
        return tr, rs
    # east/west treads first: the ring faces south of the channel overlap them
    for ax in 'EW':
        tr, _ = stair_treads(ax)
        ux0, ux1 = (FLOOR_R - 10, OUT) if ax == 'E' else (-OUT, -FLOOR_R + 10)
        under = box(ux0, -SH * K, ux1, -SH * K + FLOOR_DZ).intersection(ell(0, 0, OUT).union(ell(0, FLOOR_DZ, OUT)))
        b.add(fill(under, RISER, None), under)                               # wall underlay, fills seams between levels
        for i, t in enumerate(tr):
            x0, _, x1, _ = t.bounds; z = DROP * (i + 1)
            for _, ri, ro, dzl in LV:                                       # the channel's north wall, per ring level
                lo, hi = max(abs(x0), ri), min(abs(x1), ro)
                if abs(x0) > abs(x1): lo, hi = max(abs(x1), ri), min(abs(x0), ro)
                if hi - lo > .5 and dzl < z:
                    cx0, cx1 = (lo, hi) if ax == 'E' else (-hi, -lo)
                    cheek = box(cx0, -SH * K + dzl, cx1, -SH * K + z)
                    b.add(fill(cheek, RISER, INK, SW), cheek)
            b.add(fill(t, STONE, INK, SW), t)
            xin = x0 if ax == 'E' else x1                                     # the drop to the next step down
            sh_ = box(min(xin, xin + (10 if ax == 'E' else -10)), -SH * K + z, max(xin, xin + (10 if ax == 'E' else -10)), SH * K + z)
            b.add(fill(sh_, RISER_SH, None))
            b.add(line([(x0 + 4, -SH * K + z + 5), (x1 - 4, -SH * K + z + 5)], CREAM, 3))
    for name, ri, ro, dz in LV:
        dzb = dz + h if name != 's1' else FLOOR_DZ
        riser = ell(0, dz, ri).difference(ell(0, dzb, ri)).difference(unary_union([CHL[name], chan(dzb)]))
        face = ell(0, dz, ro).difference(ell(0, dz, ri)).difference(CHL[name])
        faces[name] = face
        b.add(fill(riser, RISER, INK, SW), riser)
        # block joints on the risers and a darker band on the right
        js = []
        for a in range(184, 360, 8):
            t = math.radians(a); x = ri * math.cos(t); y = ri * K * math.sin(t)
            js.append(f'M{x:.1f} {y + dz:.1f} L{x:.1f} {y + dzb:.1f}')
        b.add(f'<g clip-path="url(#rc-{name})"><clipPath id="rc-{name}"><path d="{gd(riser)}"/></clipPath>'
              f'<path d="{" ".join(js)}" stroke="{RISER_SH}" stroke-width="3" fill="none"/>'
              f'<path d="{gd(riser.intersection(box(ri * .35, -3000, 3000, 3000)))}" fill="{RISER_SH}" fill-opacity=".55"/></g>')
        n0 = len(b.els)
        b.add(fill(face, STONE, INK, SW), face)
        # joints across the faces, a cream lip on the outer edge
        js = []
        for a in range(0, 360, 6 if name == 'top' else 7):
            t = math.radians(a + (3 if name == 's2' else 0))
            js.append(f'M{ri * math.cos(t):.1f} {ri * K * math.sin(t) + dz:.1f} L{ro * math.cos(t):.1f} {ro * K * math.sin(t) + dz:.1f}')
        mid = (ri + ro) / 2 if name == 'top' else None
        b.add(f'<g clip-path="url(#fc-{name})"><clipPath id="fc-{name}"><path d="{gd(face)}"/></clipPath>'
              f'<path d="{" ".join(js)}" stroke="{JOINT}" stroke-width="4" fill="none"/>'
              + (f'<ellipse cx="0" cy="{dz}" rx="{mid}" ry="{mid * K:.1f}" fill="none" stroke="{JOINT}" stroke-width="4"/>' if mid else '')
              + f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x, y in arc(0, dz, ro - 6, 190, 300))}" stroke="{CREAM}" stroke-width="4" fill="none"/>'
              + f'<path d="{gd(face.intersection(ell(0, dz, ro).difference(ell(0, dz - 6, ro - 4))).intersection(box(0, 0, 3000, 3000)))}" fill="{EDGE}" fill-opacity=".5"/></g>')
        b.add(fill(face, 'none', INK, SW))
        face_els[name] = b.els[n0:]
    # outer edge of the plaza against the island ground
    b.add(fill(ell(0, 0, OUT), 'none', INK, SW, '.7'))
    for ax in 'NS':
        tr, rs = stair_treads(ax)
        seq = list(zip(tr, rs[:len(tr)])) if ax == 'N' else list(zip(tr, [None] * len(tr)))[::-1]
        if ax == 'N': b.add(fill(rs[-1], RISER, INK, SW), rs[-1])
        for t, r in seq:
            if r is not None: b.add(fill(r, RISER, INK, SW), r)
            b.add(fill(t, STONE, INK, SW), t)
            x0, y0, x1, y1 = t.bounds
            b.add(line([(x0 + 5, y0 + 4), (x1 - 5, y0 + 4)], CREAM, 3))
    b.write()
    out['pieces'].append(entry(b, 'back', note='behind every Ducky'))

    # front: the inner step lips (s1 + s2 faces, front half) in 20 wedges. sortY = lowest point of the wedge: a Ducky
    # on the floor is always above it (behind), a Ducky on the top ring or outside is below it (in front).
    lip = unary_union([faces['s1'], faces['s2']]).intersection(box(-3000, 0, 3000, 3000))
    for k in range(20):
        a0, a1 = k * 9, (k + 1) * 9
        seg = lip.intersection(wedge(0, 0, a0, a1))
        if seg.is_empty or seg.area < 50: continue
        f = Piece(T, f'front-{k + 1:02d}', f'Sunflower step lip, front {k + 1}')
        f.add(f'<clipPath id="fw"><path d="{gd(seg.buffer(2))}"/></clipPath><g clip-path="url(#fw)">' + ''.join(face_els['s1'] + face_els['s2']) + '</g>', seg)
        f.write()
        out['pieces'].append(entry(f, 'front', sortY=round(seg.bounds[3], 1), note='in front of Duckies on the floor; sort by sortY so Duckies outside pass in front'))

    # landmark: the sunflower clock, planter centred on the floor
    w, hh, im = traced(T, 'clock')
    al = im[..., 3] > 0
    rows = np.where(al.any(1))[0]; bottom = rows.max()
    widths = [np.ptp(np.where(al[y])[0]) for y in range(int(hh * .8), bottom)]
    prx = max(widths) / 2
    brown = al & (im[..., 0] < 140) & (im[..., 0] > 80) & (im[..., 1] < 95) & (im[..., 2] < 60)
    lab = brown[: int(hh * .55)]
    fy, fx = np.where(lab); fcx, fcy = fx.mean(), fy.mean(); fR = math.sqrt(lab.sum() / math.pi)
    pry = prx * K
    base_cy = FLOOR_DZ                             # planter footprint centre = floor centre
    at = (0, base_cy + pry)                        # anchor = front-bottom of the planter
    ay = (bottom + 1) / hh
    e = sorted_entry(T, 'clock', at, (w / 2) / w, ay, note='sort with Duckies by its base y')
    out['pieces'].append(e)
    pivot = (round(e['x'] + fcx, 1), round(e['y'] + fcy, 1))
    # animated: clock hands (pointing to 12, pivot at the clock centre)
    for nm, L, wd in [('hour', fR * .55, 11), ('minute', fR * .8, 8)]:
        p = Piece(T, f'clock-hand-{nm}', f'Sunflower clock {nm} hand')
        tail = L * .18
        shape = Polygon([(-wd / 2, tail), (-wd / 2, -L + wd), (0, -L), (wd / 2, -L + wd), (wd / 2, tail)]).buffer(2.5)
        p.add(fill(shape, '#FFF0C7', INK, SW), shape)
        p.add(line([(-wd / 2 + 2.5, -L * .25), (-wd / 2 + 2.5, -L + wd + 2)], '#FFFFFF', 2))
        if nm == 'minute': p.add(f'<circle cx="0" cy="0" r="7" fill="#E9B23A" stroke="{INK}" stroke-width="{SW}"/>')
        p.write(pad=4)
        x0, y0, pw, ph = p.box
        out['pieces'].append(dict(id=p.name, file=p.name + '.svg', layer='anim', width=pw, height=ph, anchor=dict(x=round(-x0 / pw, 4), y=round(-y0 / ph, 4)),
                                  at=list(pivot), x=round(pivot[0] + x0, 1), y=round(pivot[1] + y0, 1), parent='clock', drawAbove='clock',
                                  animate=dict(kind='rotate', period=43200 if nm == 'hour' else 3600, note='rotate about the anchor; real time or sped up')))

    # footprints (screen = walk coordinates, centre-local)
    planter = ell(0, base_cy, prx + 14)
    stairs_geo = unary_union(sum((stair_treads(a)[0] for a in 'NSEW'), []))
    blocked_rings = unary_union([faces['s1'], faces['s2'],
                                 *[ell(0, dz, ri).difference(ell(0, (dz + h if n != 's1' else FLOOR_DZ), ri)) for n, ri, ro, dz in LV]]).difference(CH)
    walk_floor = ell(0, FLOOR_DZ, FLOOR_R).difference(blocked_rings.buffer(14))
    walk = unary_union([walk_floor, faces['top'], stairs_geo.buffer(-4)])
    blocked = unary_union([blocked_rings, planter])
    area, n = capacity(walk_floor, planter)
    out['outerEdge'] = dict(x=0, y=0, rx=OUT, ry=round(OUT * K, 1), note='plaza outer edge on the island ground; outside it is the island')
    out['walkable'] = shape_json(walk) + [dict(note='floor ellipse before cuts', ellipse=dict(x=0, y=FLOOR_DZ, rx=FLOOR_R, ry=round(FLOOR_R * K, 1)))]
    out['blocked'] = [dict(name='clock planter', ellipse=dict(x=0, y=base_cy, rx=round(prx + 14, 1), ry=round((prx + 14) * K, 1)))] + \
                     [dict(name='step rings', **s) for s in shape_json(blocked_rings)]
    out['stairs'] = []
    for ax, (tx, ty), (bx, by) in [('N', (0, -OUT * K), (0, -(OUT - RUN * 5) * K + DROP * 5 + 30)), ('S', (0, OUT * K), (0, (OUT - RUN * 5) * K + DROP * 5 - 30)),
                                   ('E', (OUT, 0), (OUT - RUN * 5 - 30, DROP * 5)), ('W', (-OUT, 0), (-(OUT - RUN * 5) + 30, DROP * 5))]:
        out['stairs'].append(dict(name=ax, top=[round(tx, 1), round(ty, 1)], bottom=[round(bx, 1), round(by, 1)], width=2 * SH))
    out['spawn'] = [0, round(FLOOR_DZ + FLOOR_R * K * .55, 1)]
    out['capacity'] = dict(floorArea=area, duckies=n, note=f'floor only, at {round(DUCK_AREA)} units per Ducky; the top ring adds more')
    return out

# =============================================================================================== PINK
def pink():
    T = 'pink'
    PINK, HOT, PAVE, JOINT, CREAM, LEAF = '#F5A3C7', '#EC6FA8', '#FCEBD6', '#E9CDA9', '#FFF0C7', '#4AA539'
    WALL, WALL_SH, COPE, COPE_HI = '#F39CC2', '#E07FAA', '#F9C3DA', '#FFE3EF'
    LR = 960                                   # lower plaza radius (plan)
    TR, TC, H, CURB = 680, -800, 150, 12       # terrace radius, screen centre of its floor, wall height, raised coping
    ST0, ST1 = 300, 610                        # grand stair half width at the top and at the bottom
    out = dict(theme=T, name='Music box terrace', concept='concepts/themes/centre-variations/pink-centre-5.png',
               origin='centre of the lower plaza on the ground', depthRatio=round(K, 6), pieces=[])

    # decal: lower plaza, the island's own recipe (scalloped pink kerb, cream paving, ring + radial joints)
    lower = ell(0, 0, LR)
    d = Piece(T, 'decal-plaza', 'Pink lower plaza paving')
    rx, ry = LR, LR * K
    d.add(f'<ellipse cx="0" cy="0" rx="{rx + 30}" ry="{ry + 26}" fill="{LEAF}" fill-opacity="0.35"/>', ell(0, 0, rx + 40, ry + 36))
    d.add(f'<ellipse cx="0" cy="0" rx="{rx}" ry="{ry:.1f}" fill="{PINK}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
    d.add(f'<ellipse cx="0" cy="0" rx="{rx - 30}" ry="{ry - 24:.1f}" fill="{PAVE}" stroke="{INK}" stroke-width="2.22" stroke-opacity="0.6"/>')
    d.add(f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x, y in arc(0, 0, rx - 14, 110, 250, ry=ry - 11))}" stroke="#FFD3E6" stroke-width="5" fill="none"/>')
    for k in range(1, 5):
        q = k / 5
        d.add(f'<ellipse cx="0" cy="0" rx="{(rx - 22) * q:.1f}" ry="{(ry - 18) * q:.1f}" fill="none" stroke="{JOINT}" stroke-width="5"/>')
    js = []
    for ring in range(1, 5):
        cnt = 8 * ring
        for k in range(cnt):
            t = 2 * math.pi * (k + .5 * (ring % 2)) / cnt
            q0, q1 = ring / 5, (ring + 1) / 5
            js.append(f'M{math.cos(t) * (rx - 22) * q0:.1f} {math.sin(t) * (ry - 18) * q0:.1f} L{math.cos(t) * (rx - 22) * q1:.1f} {math.sin(t) * (ry - 18) * q1:.1f}')
    d.add(f'<path d="{" ".join(js)}" stroke="{JOINT}" stroke-width="5" fill="none"/>')
    d.add(f'<ellipse cx="{-rx * .25:.1f}" cy="{-ry * .35:.1f}" rx="{rx * .4:.1f}" ry="{ry * .22:.1f}" fill="#FFFFFF" fill-opacity="0.18"/>')
    d.write()
    out['pieces'].append(entry(d, 'decal'))

    # the grand stair (plan: top edge Y0 at the terrace front, 9 risers, run 34, flares ST0 -> ST1)
    N, RUN, DROP = 9, 34, H / 9
    Y0 = TC + H + TR * K * math.sqrt(1 - (ST0 / TR) ** 2)    # plan y where the stair meets the terrace edge at |x| = ST0
    def hw(Y): return ST0 + (ST1 - ST0) * (Y - Y0) / (RUN * (N - 1))
    treads, risers = [], []
    for i in range(N - 1):
        Ya, Yb = Y0 + RUN * i, Y0 + RUN * (i + 1); zt, zb = H - DROP * i, H - DROP * (i + 1)
        risers.append(Polygon([(-hw(Ya), Ya - zt), (hw(Ya), Ya - zt), (hw(Ya), Ya - zb), (-hw(Ya), Ya - zb)]))
        treads.append(Polygon([(-hw(Ya), Ya - zb), (hw(Ya), Ya - zb), (hw(Yb), Yb - zb), (-hw(Yb), Yb - zb)]))
    Yl = Y0 + RUN * (N - 1)
    risers.append(Polygon([(-hw(Yl), Yl - DROP), (hw(Yl), Yl - DROP), (hw(Yl), Yl), (-hw(Yl), Yl)]))
    stair = unary_union(treads + risers)
    cut = box(-ST0, Y0 - H - 1, ST0, 3000)    # where the stair is cut into the terrace

    # back: terrace floor, coping, wall, stair. Under every Ducky.
    b = Piece(T, 'back', 'Pink terrace, wall and grand stair')
    top_out = ell(0, TC - CURB, TR)                         # coping top
    sweep = unary_union([ell(0, TC - CURB, TR), ell(0, TC + H, TR), box(-TR, TC - CURB, TR, TC + H)])
    wall = sweep.difference(top_out).difference(cut)
    b.add(fill(wall, WALL, INK, SW), wall)
    pil = []
    for a in range(8, 180, 12):
        t = math.radians(a); x = TR * math.cos(t)
        if abs(x) < ST0 + 6: continue
        y = TR * K * math.sin(t)
        pil.append(f'M{x:.1f} {TC - CURB + y + 14:.1f} L{x:.1f} {TC + H + y - 6:.1f}')
    b.add(f'<g clip-path="url(#wl)"><clipPath id="wl"><path d="{gd(wall)}"/></clipPath>'
          f'<path d="{" ".join(pil)}" stroke="{WALL_SH}" stroke-width="5" fill="none"/>'
          f'<path d="{gd(wall.intersection(box(TR * .45, -3000, 3000, 3000)))}" fill="{WALL_SH}" fill-opacity=".55"/>'
          f'<path d="{gd(ell(0, TC - CURB + 16, TR).difference(top_out).difference(cut))}" fill="{COPE}"/>'
          f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x, y in arc(0, TC + 10, TR - 8, 100, 170))}" stroke="{COPE_HI}" stroke-width="5" fill="none"/></g>')
    b.add(fill(wall, 'none', INK, SW))
    floor_t = ell(0, TC, TR - 30).difference(cut)
    coping = top_out.difference(ell(0, TC - CURB, TR - 30)).difference(cut)
    inner_riser = ell(0, TC - CURB, TR - 30).difference(ell(0, TC, TR - 30)).difference(cut)
    b.add(fill(floor_t, PAVE, None), floor_t)
    js = []
    for q in (.25, .5, .75):
        js.append(f'M{(TR - 30) * q:.1f} {TC:.1f} A{(TR - 30) * q:.1f} {(TR - 30) * q * K:.1f} 0 1 0 {-(TR - 30) * q:.1f} {TC:.1f} A{(TR - 30) * q:.1f} {(TR - 30) * q * K:.1f} 0 1 0 {(TR - 30) * q:.1f} {TC:.1f}')
    for k in range(16):
        t = 2 * math.pi * (k + .5) / 16
        js.append(f'M{math.cos(t) * (TR - 30) * .25:.1f} {TC + math.sin(t) * (TR - 30) * .25 * K:.1f} L{math.cos(t) * (TR - 30):.1f} {TC + math.sin(t) * (TR - 30) * K:.1f}')
    b.add(f'<g clip-path="url(#tf)"><clipPath id="tf"><path d="{gd(floor_t)}"/></clipPath><path d="{" ".join(js)}" stroke="{JOINT}" stroke-width="5" fill="none"/></g>')
    b.add(fill(inner_riser, WALL_SH, INK, SW), inner_riser)
    b.add(fill(coping, COPE, INK, SW), coping)
    b.add(fill(coping.intersection(box(-3000, -3000, 3000, TC - 20)), 'none', COPE_HI, 4))
    # stair, top step first so lower ones overlap correctly (they are nearer)
    for t, r in zip(treads, risers):
        b.add(fill(t, '#FFF6EE', INK, SW), t)
        b.add(fill(r, '#F0D3BE', INK, SW), r)
    b.add(fill(risers[-1], '#F0D3BE', INK, SW), risers[-1])
    for t in treads:
        x0, y0, x1, y1 = t.bounds
        b.add(line([(x0 + 26, y0 + 4), (x1 - 26, y0 + 4)], '#FFFFFF', 3))
    b.write()
    out['pieces'].append(entry(b, 'back', note='behind every Ducky'))

    # front: the raised coping in front of the terrace floor, 8 wedges (ducks on the terrace stand behind it)
    cop_front = coping.intersection(box(-3000, TC, 3000, 3000))
    cop_front = unary_union([cop_front, top_out.difference(ell(0, TC - CURB, TR - 30)).intersection(box(-3000, TC, 3000, 3000)).difference(cut)])
    k = 0
    for a0 in range(0, 180, 30):
        seg = cop_front.intersection(wedge(0, TC, a0, a0 + 30))
        if seg.area < 50: continue
        k += 1
        f = Piece(T, f'front-{k:02d}', f'Pink terrace coping, front {k}')
        f.add(fill(seg, COPE, None), seg)
        for r, dz in ((TR, TC - CURB), (TR - 30, TC - CURB)):
            pts = [p for p in arc(0, dz, r, a0, a0 + 30, 40) if not cut.contains(Point(p))]
            if len(pts) > 1: f.add(line(pts, INK, SW))
        f.write()
        out['pieces'].append(entry(f, 'front', sortY=round(seg.bounds[3], 1), note='in front of Duckies on the terrace; sort by sortY'))

    # sorted: music box on the terrace, dancer + key animated, balustrades
    w, hh, im = traced(T, 'music-box')
    al = im[..., 3] > 0; bottom = np.where(al.any(1))[0].max()
    box_at = (0, TC + 80)
    e = sorted_entry(T, 'music-box', box_at, .5, (bottom + 1) / hh)
    out['pieces'].append(e)
    # turntable: the pale disc inside the open box (largest cream blob in the middle band)
    cream = al & (im[..., 0] > 240) & (im[..., 1] > 220) & (im[..., 2] > 180)
    band = np.zeros_like(cream); band[int(hh * .55):int(hh * .72), int(w * .3):int(w * .7)] = True
    from scipy import ndimage as nd
    lab, nb = nd.label(cream & band)
    sizes = nd.sum(cream & band, lab, range(nb + 1)); big = int(np.argmax(sizes))
    ty, tx = np.where(lab == big)
    disc = (e['x'] + tx.mean(), e['y'] + ty.mean())
    dw, dh, _ = traced(T, 'dancer')
    out['pieces'].append(dict(id='dancer', file='dancer.svg', layer='anim', parent='music-box', drawAbove='music-box', width=round(dw, 1), height=round(dh, 1),
                              anchor=dict(x=.5, y=.96), at=[round(disc[0], 1), round(disc[1] + 4, 1)],
                              x=round(disc[0] - dw / 2, 1), y=round(disc[1] + 4 - .96 * dh, 1),
                              animate=dict(kind='spin', note='turn on the spot: scaleX cos(t) with a flip at the back, plus a 4px bob; 2.5 s a turn')))
    kw, kh, kim = traced(T, 'wind-key')
    right = np.where(al.any(0))[0].max()
    mid_y = int(hh * .78)
    side_x = np.where(al[mid_y])[0].max()
    kat = (e['x'] + side_x - 6, e['y'] + mid_y)
    out['pieces'].append(dict(id='wind-key', file='wind-key.svg', layer='anim', parent='music-box', drawAbove='music-box', width=round(kw, 1), height=round(kh, 1),
                              anchor=dict(x=0.05, y=.5), at=[round(kat[0], 1), round(kat[1], 1)], x=round(kat[0] - .05 * kw, 1), y=round(kat[1] - .5 * kh, 1),
                              animate=dict(kind='wind', note='turn about the shaft: scaleY cos(t) on the loop, 1.6 s a turn, only while the music plays')))
    # balustrades: map the art's newel base and top-post base onto the stair's outer corners
    bw, bh, bim = traced(T, 'balustrade-left')
    bal = bim[..., 3] > 0
    cols = np.where(bal.any(0))[0]; rowsb = np.where(bal.any(1))[0]
    newel_x = cols.min() + (cols.max() - cols.min()) * .1; newel_y = rowsb.max()
    topcols = np.where(bal[:, int(bw * .82):].any(0))[0] + int(bw * .82)
    top_x = (topcols.min() + topcols.max()) / 2
    top_y = np.where(bal[:, int(top_x)])[0].max()
    Ytop = Y0
    for side, nm in ((-1, 'balustrade-left'), (1, 'balustrade-right')):
        A = (side * (hw(Yl) + 18), Yl + 4)               # newel base on the ground, outside the bottom step
        B = (side * (ST0 + 14), Ytop - H)               # top post on the terrace edge
        sx = abs(B[0] - A[0]) / abs(top_x - newel_x); sy = abs(A[1] - B[1]) / abs(newel_y - top_y)
        W2, H2 = bw * sx, bh * sy
        ax = (newel_x / bw) if side < 0 else 1 - newel_x / bw
        out['pieces'].append(dict(id=nm, file=nm + '.svg', layer='sorted', width=round(W2, 1), height=round(H2, 1), anchor=dict(x=round(ax, 4), y=round(newel_y / bh, 4)),
                                  at=[round(A[0], 1), round(A[1], 1)], x=round(A[0] - ax * W2, 1), y=round(A[1] - newel_y / bh * H2, 1),
                                  sortY=round((A[1] + B[1]) / 2, 1), stretch=round(sy / sx, 3), note='drawn stretched to width x height; sortY is the middle of the rail'))

    # footprints
    terrace_walk = ell(0, TC, TR - 44)
    stair_walk = unary_union(treads + risers).buffer(-6)
    bal_lines = unary_union([LineString([(s * (hw(Yl) + 10), Yl), (s * (ST0 + 6), Ytop - H)]).buffer(26) for s in (-1, 1)])
    mb_fp = ell(0, box_at[1] - 90, 260)
    blocked_wall = unary_union([wall, coping, inner_riser]).difference(stair.buffer(-2))
    lower_walk = lower.buffer(-24).difference(sweep.buffer(14))
    walk = unary_union([lower_walk, terrace_walk, stair_walk]).difference(bal_lines)
    out['walkable'] = shape_json(walk)
    out['blocked'] = [dict(name='terrace wall + coping', **s) for s in shape_json(blocked_wall)] + \
                     [dict(name='balustrade', **s) for s in shape_json(bal_lines)] + \
                     [dict(name='music box', ellipse=dict(x=0, y=round(box_at[1] - 90, 1), rx=260, ry=round(260 * K, 1)))]
    out['stairs'] = [dict(name='grand stair', top=[0, round(Ytop - H - 20, 1)], bottom=[0, round(Yl + 30, 1)], widthTop=2 * ST0, widthBottom=2 * ST1)]
    out['outerEdge'] = dict(lower=dict(x=0, y=0, rx=LR, ry=round(LR * K, 1)), terrace=dict(x=0, y=TC, rx=TR, ry=round(TR * K, 1), raisedBy=H))
    out['spawn'] = [0, round(LR * K * .5, 1)]
    a1, n1 = capacity(lower_walk, bal_lines); a2, n2 = capacity(terrace_walk, mb_fp)
    out['capacity'] = dict(lowerArea=a1, terraceArea=a2, duckies=n1 + n2, note=f'at {round(DUCK_AREA)} units per Ducky')
    return out

# =============================================================================================== LIBRARY
def library(bookstore=None):
    T = 'library'
    PAVE, LINE, SAND, SHADE, GRASS_D, CREAM = '#F7E6AF', '#E2CC8C', '#FDE48C', '#E4C567', '#7DAE30', '#FFF6DA'
    WATER, WATER_HI, WATER_DK = '#6EC9DE', '#B5E7F7', '#4FB3CC'
    STONE, STONE_SIDE, STONE_SH = '#FBEAC0', '#E8D095', '#D9BC7B'
    PR, RO, RI, RH, WZ = 1150, 540, 452, 40, 16     # paving radius, rim outer/inner, rim height, water drop
    out = dict(theme=T, name='Globe fountain plaza', concept='concepts/themes/centre-variations/library-centre-2.png',
               origin='pool centre on the ground', depthRatio=round(K, 6), pieces=[])

    pave = ell(0, 0, PR)
    d = Piece(T, 'decal-paving', 'Library plaza flagstones')
    d.add(f'<ellipse cx="0" cy="0" rx="{PR + 12}" ry="{PR * K + 12:.1f}" fill="{GRASS_D}"/>', ell(0, 0, PR + 14, PR * K + 14))
    d.add(f'<ellipse cx="0" cy="0" rx="{PR + 6}" ry="{PR * K + 6:.1f}" fill="{SHADE}"/>')
    d.add(flagstones(pave, 11, 96, PAVE, LINE, 5))
    d.add(fill(pave, 'none', LINE, 6))
    d.add(fill(ell(0, 0, PR - 60), 'none', LINE, 5))
    d.write()
    out['pieces'].append(entry(d, 'decal'))

    # compass rose inlay (its own decal, on top of the paving)
    c = Piece(T, 'decal-compass', 'Library compass rose inlay')
    def P(r, deg): t = math.radians(deg); return (r * math.cos(t), r * math.sin(t) * K)
    cols = {'NS': ('#F6A58F', '#E2826A'), 'EW': ('#A9B0E6', '#8790D2'), 'D': ('#F7CF72', '#E6B550')}
    pts = [(-90, PR * .93, 'NS'), (90, PR * .93, 'NS'), (0, PR * .86, 'EW'), (180, PR * .86, 'EW'),
           (-45, PR * .72, 'D'), (45, PR * .72, 'D'), (135, PR * .72, 'D'), (-135, PR * .72, 'D')]
    for deg, L, kind in sorted(pts, key=lambda p: p[2] != 'D'):
        wb, rb = (150, RO + 40) if kind == 'D' else (215, RO + 70)      # half width of the point where it leaves the rim
        t = math.radians(deg); ux, uy = math.cos(t), math.sin(t); vx, vy = -uy, ux
        Q = lambda u, v: (u * ux + v * vx, (u * uy + v * vy) * K)
        tip, l, r, c0 = Q(L, 0), Q(rb, -wb), Q(rb, wb), Q(rb * .55, 0)
        a, bb = cols[kind]
        g1 = Polygon([c0, l, tip]); g2 = Polygon([c0, r, tip])
        c.add(fill(g1, a, INK, 2.2, '.5'), g1); c.add(fill(g2, bb, INK, 2.2, '.5'), g2)
    ring = ell(0, 0, RO + 70).difference(ell(0, 0, RO + 40))
    c.add(fill(ring, '#EAD39A', INK, 2.2, '.45'), ring)
    c.write()
    out['pieces'].append(entry(c, 'decal', note='draw above decal-paving'))

    # pool: water, back inner wall, rim blocks (back half here, front half in front pieces)
    b = Piece(T, 'back', 'Library pool water and back rim')
    inner_wall = ell(0, -RH, RI).difference(ell(0, -WZ, RI))
    water = ell(0, -WZ, RI)
    b.add(fill(water, WATER, None), water)
    b.add(fill(ell(26, -WZ + 26, RI * .9).intersection(water), WATER_DK, None, extra=' fill-opacity=".35"'))
    b.add(f'<ellipse cx="{-RI * .3:.1f}" cy="{-WZ - RI * K * .35:.1f}" rx="{RI * .35:.1f}" ry="{RI * K * .12:.1f}" fill="{WATER_HI}" fill-opacity=".55"/>')
    for (x, y, r) in [(-150, 60, 34), (170, -70, 26), (90, 120, 30), (-210, -60, 22)]:
        b.add(f'<path d="M{x - r} {y - WZ} Q{x} {y - WZ + 7} {x + r} {y - WZ}" stroke="{WATER_HI}" stroke-width="3" fill="none"/>')
    b.add(fill(inner_wall, STONE_SIDE, INK, SW), inner_wall)
    NB, GAP = 16, 1.6
    front_blocks = []
    for i in range(NB):
        a0, a1 = 360 * i / NB + GAP / 2 + 6, 360 * (i + 1) / NB - GAP / 2 + 6
        top = Polygon(arc(0, -RH, RO, a0, a1, 24) + arc(0, -RH, RI, a1, a0, 24))
        side = unary_union([affinity.translate(top, 0, dy) for dy in np.linspace(0, RH, 10)]).difference(top)
        side = side.intersection(box(-3000, -RH, 3000, 3000))
        mid = math.radians((a0 + a1) / 2)
        if math.sin(mid) < 0:
            b.add(fill(top, STONE, INK, SW), top)
            b.add(line(arc(0, -RH, RO - 8, a0 + 1, a1 - 1, 12), CREAM, 3))
        else:
            front_blocks.append((mid, top, side, a0, a1))
    b.write()
    out['pieces'].append(entry(b, 'back', note='behind every Ducky; the globe and jets sort above it'))
    for k, grp in enumerate([[fb for fb in front_blocks if math.cos(fb[0]) > .5], [fb for fb in front_blocks if abs(math.cos(fb[0])) <= .5],
                             [fb for fb in front_blocks if math.cos(fb[0]) < -.5]]):
        if not grp: continue
        f = Piece(T, f'front-{k + 1:02d}', f'Library pool rim, front {k + 1}')
        for mid, top, side, a0, a1 in grp:
            f.add(fill(side, STONE_SIDE, INK, SW), side)
            sh = side.intersection(box(-3000, -3000, 3000, 3000)).intersection(wedge(0, -RH, a0 + (a1 - a0) * .6, a1 + 1))
            f.add(fill(sh, STONE_SH, None, extra=' fill-opacity=".6"'))
            f.add(fill(top, STONE, INK, SW), top)
            f.add(line(arc(0, -RH, RO - 8, a0 + 1, a1 - 1, 12), CREAM, 3))
        f.write()
        out['pieces'].append(entry(f, 'front', sortY=round(unary_union(f.geo).bounds[3], 1), note='front rim; sort by sortY so the globe base sits behind it'))

    # globe, standing in the water
    w, hh, im = traced(T, 'globe')
    al = im[..., 3] > 0; bottom = np.where(al.any(1))[0].max()
    bw = max(np.ptp(np.where(al[y])[0]) for y in range(int(hh * .85), bottom))
    base_ry = bw / 2 * K
    at = (0, -WZ + base_ry)
    out['pieces'].append(sorted_entry(T, 'globe', at, .5, (bottom + 1) / hh, note='base front edge; base centre sits on the water at the pool centre'))

    # water jets: four arcs from round the globe base out into the pool, each its own piece (animate the stream)
    for nm, sgn in (('jet-back', -1), ('jet-front', 1)):
        p = Piece(T, nm, 'Library fountain water jet')
        r0, r1 = 150, 360
        s = (r0 * math.cos(math.radians(45)), sgn * r0 * math.sin(math.radians(45)) * K - WZ)
        e2 = (r1 * math.cos(math.radians(45)), sgn * r1 * math.sin(math.radians(45)) * K - WZ)
        peak = ((s[0] + e2[0]) / 2 - 12, min(s[1], e2[1]) - 190)
        q = [((1 - t) ** 2 * s[0] + 2 * (1 - t) * t * peak[0] + t * t * e2[0], (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * peak[1] + t * t * e2[1]) for t in np.linspace(0, 1, 40)]
        dd = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in q)
        p.add(f'<path d="{dd}" stroke="{INK}" stroke-width="24" fill="none"/>', LineString(q).buffer(13))
        p.add(f'<path d="{dd}" stroke="{WATER_HI}" stroke-width="18.8" fill="none"/>')
        p.add(f'<path d="{dd}" stroke="{WATER}" stroke-width="7" fill="none" transform="translate(2 3)"/>')
        p.add(f'<path d="{dd}" stroke="#FFFFFF" stroke-width="4" fill="none" stroke-dasharray="34 18" transform="translate(-3 -4)"/>')
        for dx, dy, r in ((-14, -4, 5), (12, -10, 4), (2, -16, 3.5)):
            p.add(f'<circle cx="{e2[0] + dx:.1f}" cy="{e2[1] + dy:.1f}" r="{r}" fill="{WATER_HI}" stroke="{INK}" stroke-width="2"/>')
        sp = ell(e2[0], e2[1] + 2, 26)
        p.add(fill(sp.difference(ell(e2[0], e2[1] + 2, 15)), '#FFFFFF', INK, 2), sp)
        p.write(pad=6)
        x0, y0, pw, ph = p.box
        for side in (1, -1):
            sx = side
            sp_ = (s[0] * sx, s[1]); ep = (e2[0] * sx, e2[1])
            out['pieces'].append(dict(id=f'{nm}-{"right" if side > 0 else "left"}', file=nm + '.svg', layer='anim', flip=side < 0,
                                      width=pw, height=ph, anchor=dict(x=round((s[0] - x0) / pw, 4), y=round((s[1] - y0) / ph, 4)),
                                      at=[round(sp_[0], 1), round(sp_[1], 1)], landing=[round(ep[0], 1), round(ep[1], 1)],
                                      x=round(sp_[0] - (s[0] - x0) if side > 0 else sp_[0] - (x0 + pw - s[0]), 1), y=round(sp_[1] - (s[1] - y0), 1),
                                      sortY=round(ep[1] if sgn > 0 else -WZ - 40, 1),
                                      animate=dict(kind='jet', note='scale about the anchor 0.92-1.0 and slide the dash offset; back jets draw behind the globe, front jets in front')))

    # footprints
    pool = ell(0, -RH / 2, RO + 10)
    walk = pave.buffer(-20).difference(pool)
    out['outerEdge'] = dict(x=0, y=0, rx=PR, ry=round(PR * K, 1))
    out['walkable'] = [dict(ellipse=dict(x=0, y=0, rx=PR - 20, ry=round((PR - 20) * K, 1)))]
    out['blocked'] = [dict(name='fountain pool', ellipse=dict(x=0, y=round(-RH / 2, 1), rx=RO + 10, ry=round((RO + 10) * K, 1)))]
    out['stairs'] = []
    out['spawn'] = [0, round(PR * K * .7, 1)]
    a, n = capacity(walk, Polygon())
    out['capacity'] = dict(floorArea=a, duckies=n, note=f'at {round(DUCK_AREA)} units per Ducky')
    if bookstore: out['bookstore'] = bookstore
    return out

if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    for fn in (sunflower, pink):
        o = fn()
        json.dump(o, open(os.path.join(ART, o['theme'], 'centre', 'centre.json'), 'w'), indent=1)
        print(o['theme'], len(o['pieces']), 'pieces', o['capacity'])
    bs = None
    bsp = os.path.join(os.path.dirname(__file__), 'centre-bookstore.py')
    if os.path.exists(bsp) and os.path.exists(os.path.join(ART, 'library/centre/bookstore/tower.svg')):
        import importlib.util
        spec = importlib.util.spec_from_file_location('cb', bsp); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
        bs = m.build(globals())
    o = library(bs)
    json.dump(o, open(os.path.join(ART, 'library', 'centre', 'centre.json'), 'w'), indent=1)
    print('library', len(o['pieces']), 'pieces', o['capacity'], 'bookstore' if bs else '')
