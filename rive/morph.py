# morph.py: Ducky turn by vertex morphing between Ente's official 8 views (Figma "Duck Spin 9..16").
# Every part is one native path resampled to a fixed vertex count, so Rive can key and blend its vertices.
# At 0/45/../315 degrees each part is exactly the official drawing; in between it morphs continuously.
# Parts that pass behind the body (wings, tail, far foot) have a front and a back copy that switch where the
# part crosses the silhouette edge. Eyes, belly and the body highlight are clipped by the morphing body.
import math, os, xml.etree.ElementTree as ET
import svg2rml as S

NS = S.SVGNS
VIEW_ANGLE = {9: 0, 10: -45, 11: -90, 12: -135, 13: 180, 14: 135, 15: 90, 16: 45}
K = 0.88
ROOT = (360, 776)
N = {'body': 56, 'hi': 28, 'belly': 32, 'tuft': 36, 'tw': 16, 'wing': 36, 'tail': 32, 'beak': 28, 'eye': 12, 'foot': 28, 'sole': 20}

def wrapd(a):
    return (a + 180) % 360 - 180

# ---------- svg reading ----------
def top_items(path):
    root = ET.parse(path).getroot()
    duck = [g for g in root.iter(NS + 'g') if (g.get('id') or '').startswith('Duck Spin')][0]
    def flat(el, m):
        out = []
        m = S.mat_mul(m, S.parse_transform(el.get('transform')))
        for ch in el:
            t = ch.tag.replace(NS, '')
            if t == 'g': out.append(('g', ch, m))
            elif t not in ('rect', 'defs', 'filter'): out.append(('p', ch, m))
        return out
    items = flat(duck, S.I)
    while len(items) <= 2 and any(i[0] == 'g' for i in items):
        g = [i for i in items if i[0] == 'g'][0]; items = flat(g[1], g[2])
    return items

def paths_of(el, m):
    """[(path_el, matrix)] for every path under el, transforms accumulated"""
    t = el.tag.replace(NS, '')
    if t == 'path':
        return [(el, m)]
    out = []
    if t == 'g':
        m2 = S.mat_mul(m, S.parse_transform(el.get('transform')))
        for ch in el: out += paths_of(ch, m2)
    return out

def bbox_pts(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))

def polylines(path_el, m):
    """every subpath of a path as a dense polyline in canvas coords, largest first"""
    subs = S.shape_subs(path_el, m)
    res = []
    for segs, closed in subs:
        pts = []
        for p0, c1, c2, p1 in segs:
            for k in range(10):
                t = k / 10
                a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; d = t ** 3
                pts.append((a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]))
        if len(pts) < 3: continue
        bb = bbox_pts(pts)
        res.append(((bb[2] - bb[0]) * (bb[3] - bb[1]), pts))
    return [q for _, q in sorted(res, key=lambda r: -r[0])]

def outer_polyline(path_el, m):
    """the largest subpath of a path, as a dense polyline in canvas coords"""
    subs = S.shape_subs(path_el, m)
    best = None
    for segs, closed in subs:
        pts = []
        for p0, c1, c2, p1 in segs:
            for k in range(10):
                t = k / 10
                a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; d = t ** 3
                pts.append((a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0], a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]))
        if len(pts) < 3: continue
        bb = bbox_pts(pts); area = (bb[2] - bb[0]) * (bb[3] - bb[1])
        if best is None or area > best[0]: best = (area, pts)
    return best[1]

def area(pts):
    return 0.5 * sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))

def resample(pts, n):
    """n points, evenly spaced by arc length, clockwise on screen, starting at the topmost point"""
    if area(pts) < 0: pts = pts[::-1]
    top = min(range(len(pts)), key=lambda i: (pts[i][1], pts[i][0]))
    pts = pts[top:] + pts[:top]
    pts = pts + [pts[0]]
    d = [0.0]
    for i in range(1, len(pts)): d.append(d[-1] + math.dist(pts[i - 1], pts[i]))
    L = d[-1]; out = []; j = 0
    for k in range(n):
        s = L * k / n
        while d[j + 1] < s: j += 1
        u = (s - d[j]) / max(1e-9, d[j + 1] - d[j])
        out.append((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u))
    return out

def offset(pts, o):
    """push a closed clockwise polyline outward by o (screen y-down)"""
    n = len(pts); out = []
    for i in range(n):
        ax, ay = pts[i - 1]; bx, by = pts[(i + 1) % n]
        tx, ty = bx - ax, by - ay; l = math.hypot(tx, ty) or 1
        nx, ny = -ty / l, tx / l          # left normal; for clockwise (screen) contours this points outward
        out.append((pts[i][0] + nx * o, pts[i][1] + ny * o))
    return out

# ---------- classify one view ----------
def classify(items):
    inf = []
    for k, el, m in items:
        ps = paths_of(el, m)
        fills = [p.get('fill') for p, _ in ps]
        allpts = []
        for p, pm in ps:
            for segs, _ in (S.shape_subs(p, pm) or []):
                for s_ in segs: allpts += [s_[0], s_[3]]
        inf.append((set(fills), bbox_pts(allpts), ps))
    shadow = [i for i, (f, b, _) in enumerate(inf) if f == {'#232323'} and b[3] - b[1] < 30 and b[1] > 590][0]
    sb = inf[shadow][1]
    body = [i for i, (f, b, _) in enumerate(inf) if b[3] - b[1] > 400][0]
    roles = []
    for i, (f, b, _) in enumerate(inf):
        w, h = b[2] - b[0], b[3] - b[1]
        if i == shadow: r = 'shadow'
        elif i == body: r = 'body'
        elif '#FF814A' in f: r = 'foot' if b[1] > 500 else 'beak'
        elif 'white' in f and b[3] < 140: r = 'tuft'
        elif f == {'#232323'} and w < 45 and h < 45 and b[1] < 320: r = 'eye'
        elif f == {'#232323'} and b[1] > 540: r = 'toe'
        elif '#FFD525' in f and h < 140 and b[1] > 420: r = 'tail'
        elif '#FFD525' in f: r = 'wing'
        else: r = 'other'
        roles.append(r)
    return inf, roles, ((sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2)

def view_parts(path, angle):
    items = top_items(path)
    inf, roles, sc = classify(items)
    M = (K, 0, 0, K, ROOT[0] - K * sc[0], ROOT[1] - K * sc[1])
    def poly(p, pm): return outer_polyline(p, S.mat_mul(M, pm))
    def polys(p, pm): return polylines(p, S.mat_mul(M, pm))
    parts = {}
    th = math.radians(angle); s, c = math.sin(th), math.cos(th)
    wings, feet, eyes, toes, tufts = [], [], [], [], []
    for (f, b, ps), r in zip(inf, roles):
        if r == 'body':
            for p, pm in ps:
                fl = p.get('fill')
                if fl == '#FFD525': parts['body'] = poly(p, pm)
                elif fl == 'white': parts['hi'] = poly(p, pm)
                elif fl == '#FFDF58': parts['belly'] = poly(p, pm)
                elif fl == '#232323':
                    parts['body_ring'] = poly(p, pm)
                    rs = polys(p, pm); parts['body_ink'] = rs[0]; parts['body_fill'] = rs[1] if len(rs) > 1 else rs[0]
        elif r == 'tail':
            parts['tail'] = poly(*[x for x in ps if x[0].get('fill') == '#FFD525'][0])
            parts['tail_ring'] = poly(*[x for x in ps if x[0].get('fill') == '#232323'][0])
            parts['tail_ink'] = parts['tail_ring']
        elif r == 'beak':
            parts['beak'] = poly(*[x for x in ps if x[0].get('fill') == '#FF814A'][0])
            parts['beak_ring'] = poly(*[x for x in ps if x[0].get('fill') == '#232323'][-1])
            parts['beak_ink'] = parts['beak_ring']
        elif r == 'tuft':
            parts['tuft'] = poly(*[x for x in ps if x[0].get('fill') == '#FFD525'][0])
            parts['tuft_ring'] = poly(*[x for x in ps if x[0].get('fill') == '#232323'][-1])
            parts['tuft_ink'] = parts['tuft_ring']
            ws = [poly(*x) for x in ps if x[0].get('fill') == 'white']
            ws.sort(key=lambda q: bbox_pts(q)[0])
            parts['tw1'] = ws[0]; parts['tw2'] = ws[-1]
        elif r == 'wing':
            fill = poly(*[x for x in ps if x[0].get('fill') == '#FFD525'][0])
            ring = poly(*[x for x in ps if x[0].get('fill') == '#232323'][0])
            wings.append((fill, ring))
        elif r == 'foot':
            fill = poly(*[x for x in ps if x[0].get('fill') == '#FF814A'][0])
            darks = [poly(*x) for x in ps if x[0].get('fill') == '#232323']
            darks.sort(key=lambda q: (bbox_pts(q)[2] - bbox_pts(q)[0]) * (bbox_pts(q)[3] - bbox_pts(q)[1]))
            feet.append({'fill': fill, 'ring': darks[-1], 'sole': darks[0] if len(darks) > 1 else None})
        elif r == 'eye':
            eyes.append(poly(*ps[0]))
        elif r == 'toe':
            toes.append(poly(*ps[0]))
    # wings: A sits at phi -90 (screen left at the front), B at +90; match by expected screen x
    exp = {'A': math.sin(th - math.pi / 2), 'B': math.sin(th + math.pi / 2)}
    dep = {'A': math.cos(th - math.pi / 2), 'B': math.cos(th + math.pi / 2)}
    cx = lambda q: (bbox_pts(q)[0] + bbox_pts(q)[2]) / 2
    if len(wings) == 2:
        wings.sort(key=lambda w: cx(w[0]))
        order = sorted('AB', key=lambda k: exp[k])
        for k, w in zip(order, wings): parts['wing' + k] = w[0]; parts['wing' + k + '_ring'] = w[1]; parts['wing' + k + '_ink'] = w[1]
    elif len(wings) == 1:
        k = 'A' if dep['A'] > dep['B'] else 'B'
        parts['wing' + k] = wings[0][0]; parts['wing' + k + '_ring'] = wings[0][1]; parts['wing' + k + '_ink'] = wings[0][1]
    # feet: A lateral -72 (screen left at the front), B +72; match by expected x
    fx = {'A': -72 * c + 20 * s, 'B': 72 * c + 20 * s}
    feet.sort(key=lambda q: cx(q['fill']))
    order = sorted('AB', key=lambda k: fx[k])
    for k, ft in zip(order, feet):
        parts['foot' + k] = ft['fill']; parts['foot' + k + '_ring'] = ft['ring']
        sole = ft['sole']
        if sole is None and toes:
            toes.sort(key=lambda q: abs(cx(q) - cx(ft['fill'])))
            sole = toes.pop(0)
        if sole is not None: parts['sole' + k] = sole
    # eyes: R = anatomical right = screen left at the front; with one eye, it is the near side's eye
    eyes.sort(key=lambda q: cx(q))
    if len(eyes) == 2:
        parts['eyeR'], parts['eyeL'] = eyes
    elif len(eyes) == 1:
        parts['eyeR' if s > 0 else 'eyeL'] = eyes[0]
    return parts

def ring_offset(fill, ring):
    fb, rb = bbox_pts(fill), bbox_pts(ring)
    return max(1.0, ((rb[2] - rb[0]) - (fb[2] - fb[0]) + (rb[3] - rb[1]) - (fb[3] - fb[1])) / 4)

def load(spin_dir):
    V = {}
    for j, a in VIEW_ANGLE.items():
        V[a] = view_parts(os.path.join(spin_dir, f'spin_{j}.svg'), a)
    return V

def vk(a):
    """view key for any angle: -180 and 180 are the same back view"""
    w = wrapd(a)
    return 180 if w == -180 else w
