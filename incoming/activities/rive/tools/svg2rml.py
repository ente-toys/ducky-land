#!/usr/bin/env python3
"""svg2rml — turn one of our flat SVGs into RML shapes for the Rive CLI.

  python3 svg2rml.py input.svg --name "Ghost" --prefix 5 > ghost.rml.frag

Output is a fragment of RML: one <Node> holding the whole drawing, ready to paste
inside an <Artboard>. Rules:
- Every <g id="..."> becomes a named Node whose origin is the centre of its box,
  so it rotates and scales around itself (Flame, Arm Wag, Eye Left...).
- Every shape becomes a Shape with PointsPath children (one per subpath).
- Transforms are baked in, arcs become cubics, quadratics become cubics.
- Rive paints EARLIER siblings on top, so siblings are written in reverse.
- Fills, strokes (width, cap, join), opacity and linear/radial gradients carry over.
"""
import math, re, sys, argparse
import xml.etree.ElementTree as ET

SVGNS = '{http://www.w3.org/2000/svg}'

# ---------- affine ----------
def mat_mul(a, b):
    return (a[0]*b[0] + a[2]*b[1], a[1]*b[0] + a[3]*b[1],
            a[0]*b[2] + a[2]*b[3], a[1]*b[2] + a[3]*b[3],
            a[0]*b[4] + a[2]*b[5] + a[4], a[1]*b[4] + a[3]*b[5] + a[5])
I = (1, 0, 0, 1, 0, 0)
def apply(m, p):
    return (m[0]*p[0] + m[2]*p[1] + m[4], m[1]*p[0] + m[3]*p[1] + m[5])
def scale_of(m):
    return math.sqrt(abs(m[0]*m[3] - m[1]*m[2]))

def parse_transform(s):
    m = I
    if not s:
        return m
    for name, args in re.findall(r'(\w+)\s*\(([^)]*)\)', s):
        v = [float(x) for x in re.split(r'[\s,]+', args.strip()) if x]
        if name == 'translate':
            t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == 'scale':
            sx = v[0]; sy = v[1] if len(v) > 1 else sx
            t = (sx, 0, 0, sy, 0, 0)
        elif name == 'rotate':
            a = math.radians(v[0]); c, s_ = math.cos(a), math.sin(a)
            r = (c, s_, -s_, c, 0, 0)
            if len(v) == 3:
                t = mat_mul(mat_mul((1, 0, 0, 1, v[1], v[2]), r), (1, 0, 0, 1, -v[1], -v[2]))
            else:
                t = r
        elif name == 'matrix':
            t = tuple(v)
        else:
            continue
        m = mat_mul(m, t)
    return m

# ---------- path parsing to cubic subpaths ----------
TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?')

def arc_to_cubics(p0, rx, ry, phi, fa, fs, p1):
    if rx == 0 or ry == 0:
        return [(p0, p0, p1, p1)]
    x1, y1 = p0; x2, y2 = p1
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p = cp*dx + sp*dy; y1p = -sp*dx + cp*dy
    rx, ry = abs(rx), abs(ry)
    lam = x1p*x1p/(rx*rx) + y1p*y1p/(ry*ry)
    if lam > 1:
        s = math.sqrt(lam); rx *= s; ry *= s
    num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p
    den = rx*rx*y1p*y1p + ry*ry*x1p*x1p
    co = math.sqrt(max(0, num/den)) if den else 0
    if fa == fs:
        co = -co
    cxp = co * rx*y1p/ry; cyp = -co * ry*x1p/rx
    cx = cp*cxp - sp*cyp + (x1 + x2)/2; cy = sp*cxp + cp*cyp + (y1 + y2)/2
    def ang(u, v):
        a = math.atan2(u[0]*v[1] - u[1]*v[0], u[0]*v[0] + u[1]*v[1]); return a
    t1 = ang((1, 0), ((x1p - cxp)/rx, (y1p - cyp)/ry))
    dt = ang(((x1p - cxp)/rx, (y1p - cyp)/ry), ((-x1p - cxp)/rx, (-y1p - cyp)/ry))
    if not fs and dt > 0: dt -= 2*math.pi
    if fs and dt < 0: dt += 2*math.pi
    n = max(1, int(math.ceil(abs(dt) / (math.pi/2))))
    d = dt / n
    k = 4/3 * math.tan(d/4)
    out = []
    def pt(t):
        return (cx + rx*math.cos(t)*cp - ry*math.sin(t)*sp, cy + rx*math.cos(t)*sp + ry*math.sin(t)*cp)
    def dpt(t):
        return (-rx*math.sin(t)*cp - ry*math.cos(t)*sp, -rx*math.sin(t)*sp + ry*math.cos(t)*cp)
    t = t1
    for _ in range(n):
        a, b = pt(t), pt(t + d)
        da, db = dpt(t), dpt(t + d)
        out.append((a, (a[0] + k*da[0], a[1] + k*da[1]), (b[0] - k*db[0], b[1] - k*db[1]), b))
        t += d
    out[-1] = (out[-1][0], out[-1][1], out[-1][2], p1)
    out[0] = (p0, out[0][1], out[0][2], out[0][3])
    return out

def parse_path(d):
    """-> list of (segments, closed); segment = (p0, c1, c2, p1)"""
    toks = TOK.findall(d)
    i = 0; cmd = None
    cur = (0.0, 0.0); start = cur; last_c = None; last_q = None
    subs = []; segs = []
    def num():
        nonlocal i
        v = float(toks[i]); i += 1; return v
    def line(a, b):
        return (a, a, b, b)
    while i < len(toks):
        t = toks[i]
        if re.match(r'[A-Za-z]', t):
            cmd = t; i += 1
            if cmd in 'Zz':
                if segs:
                    if math.dist(cur, start) > 1e-6:
                        segs.append(line(cur, start))
                    subs.append((segs, True)); segs = []
                cur = start; last_c = last_q = None
                continue
        rel = cmd.islower(); C = cmd.upper()
        ox, oy = (cur if rel else (0, 0))
        if C == 'M':
            if segs: subs.append((segs, False)); segs = []
            cur = (num() + ox, num() + oy); start = cur
            cmd = 'l' if rel else 'L'; last_c = last_q = None
        elif C == 'L':
            p = (num() + ox, num() + oy); segs.append(line(cur, p)); cur = p; last_c = last_q = None
        elif C == 'H':
            p = (num() + (cur[0] if rel else 0), cur[1]); segs.append(line(cur, p)); cur = p; last_c = last_q = None
        elif C == 'V':
            p = (cur[0], num() + (cur[1] if rel else 0)); segs.append(line(cur, p)); cur = p; last_c = last_q = None
        elif C == 'C':
            c1 = (num() + ox, num() + oy); c2 = (num() + ox, num() + oy); p = (num() + ox, num() + oy)
            segs.append((cur, c1, c2, p)); last_c = c2; cur = p; last_q = None
        elif C == 'S':
            c1 = (2*cur[0] - last_c[0], 2*cur[1] - last_c[1]) if last_c else cur
            c2 = (num() + ox, num() + oy); p = (num() + ox, num() + oy)
            segs.append((cur, c1, c2, p)); last_c = c2; cur = p; last_q = None
        elif C == 'Q':
            q = (num() + ox, num() + oy); p = (num() + ox, num() + oy)
            c1 = (cur[0] + 2/3*(q[0] - cur[0]), cur[1] + 2/3*(q[1] - cur[1]))
            c2 = (p[0] + 2/3*(q[0] - p[0]), p[1] + 2/3*(q[1] - p[1]))
            segs.append((cur, c1, c2, p)); last_q = q; cur = p; last_c = None
        elif C == 'T':
            q = (2*cur[0] - last_q[0], 2*cur[1] - last_q[1]) if last_q else cur
            p = (num() + ox, num() + oy)
            c1 = (cur[0] + 2/3*(q[0] - cur[0]), cur[1] + 2/3*(q[1] - cur[1]))
            c2 = (p[0] + 2/3*(q[0] - p[0]), p[1] + 2/3*(q[1] - p[1]))
            segs.append((cur, c1, c2, p)); last_q = q; cur = p; last_c = None
        elif C == 'A':
            rx, ry, phi, fa, fs = num(), num(), num(), num(), num()
            p = (num() + ox, num() + oy)
            segs.extend(arc_to_cubics(cur, rx, ry, math.radians(phi), int(fa), int(fs), p)); cur = p; last_c = last_q = None
        else:
            i += 1
    if segs:
        subs.append((segs, False))
    return subs

def ellipse_path(cx, cy, rx, ry):
    k = 0.5522847498
    return (f'M{cx+rx} {cy} C{cx+rx} {cy+k*ry} {cx+k*rx} {cy+ry} {cx} {cy+ry} '
            f'C{cx-k*rx} {cy+ry} {cx-rx} {cy+k*ry} {cx-rx} {cy} C{cx-rx} {cy-k*ry} {cx-k*rx} {cy-ry} {cx} {cy-ry} '
            f'C{cx+k*rx} {cy-ry} {cx+rx} {cy-k*ry} {cx+rx} {cy} Z')

def rect_path(x, y, w, h, rx, ry):
    if rx <= 0 and ry <= 0:
        return f'M{x} {y} H{x+w} V{y+h} H{x} Z'
    rx = min(rx or ry, w/2); ry = min(ry or rx, h/2)
    return (f'M{x+rx} {y} H{x+w-rx} A{rx} {ry} 0 0 1 {x+w} {y+ry} V{y+h-ry} A{rx} {ry} 0 0 1 {x+w-rx} {y+h} '
            f'H{x+rx} A{rx} {ry} 0 0 1 {x} {y+h-ry} V{y+ry} A{rx} {ry} 0 0 1 {x+rx} {y} Z')

# ---------- styles ----------
def style_of(el, inherited):
    st = dict(inherited)
    for k in ('fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity'):
        if el.get(k) is not None:
            st[k] = el.get(k)
    if el.get('style'):
        for part in el.get('style').split(';'):
            if ':' in part:
                k, v = part.split(':', 1); st[k.strip()] = v.strip()
    return st

def hexa(col, alpha):
    col = col.strip()
    if col.startswith('#'):
        h = col[1:]
        if len(h) == 3: h = ''.join(c*2 for c in h)
    elif col.startswith('rgb'):
        n = [int(float(x)) for x in re.findall(r'[\d.]+', col)[:3]]; h = '%02X%02X%02X' % tuple(n)
    else:
        named = {'white': 'FFFFFF', 'black': '000000'}; h = named.get(col, '000000')
    a = max(0, min(255, round(alpha * 255)))
    return '%02X%s' % (a, h.upper())

# ---------- emit ----------
class Out:
    def __init__(self, prefix, pivots=None):
        self.prefix = prefix; self.n = 0; self.grads = {}; self.names = {}; self.pivots = pivots or {}; self.pos = {}; self.scales = {}
    def nid(self, name=None):
        self.n += 1; i = f'{self.prefix}:{self.n}'
        if name and name not in self.names:
            self.names[name] = i
        return i

def fmt(v):
    v = round(v, 3)
    return ('%g' % v) if abs(v) < 1e6 else str(v)

def bbox_of(subs):
    xs, ys = [], []
    for segs, _ in subs:
        for s in segs:
            for p in s:
                xs.append(p[0]); ys.append(p[1])
    if not xs:
        return (0, 0, 0, 0)
    return (min(xs), min(ys), max(xs), max(ys))

def vertices_xml(segs, closed, ox, oy, ind):
    # nodes: start of each seg plus end of last (unless closed)
    pts = [s[0] for s in segs]
    if not closed:
        pts.append(segs[-1][3])
    n = len(pts)
    lines = []
    for k, p in enumerate(pts):
        inh = segs[k-1][2] if (k > 0 or closed) and segs else p
        if k == 0 and not closed: inh = p
        outh = segs[k][1] if k < len(segs) else p
        vx, vy = p[0] - ox, p[1] - oy
        di = math.dist(inh, p); do = math.dist(outh, p)
        if di < 1e-3 and do < 1e-3:
            lines.append(f'{ind}<StraightVertex x="{fmt(vx)}" y="{fmt(vy)}"/>')
        else:
            ri = math.atan2(inh[1] - p[1], inh[0] - p[0]) if di >= 1e-3 else 0
            ro = math.atan2(outh[1] - p[1], outh[0] - p[0]) if do >= 1e-3 else 0
            lines.append(f'{ind}<CubicDetachedVertex x="{fmt(vx)}" y="{fmt(vy)}" inRotation="{fmt(ri)}" inDistance="{fmt(di)}" outRotation="{fmt(ro)}" outDistance="{fmt(do)}"/>')
    return lines

def paint_xml(kind, spec, alpha, bbox, ox, oy, out, ind, extra=''):
    if spec is None or spec == 'none':
        return []
    tag = 'Fill' if kind == 'fill' else 'Stroke'
    if spec.startswith('url('):
        gid = spec[spec.index('#')+1:spec.index(')')]
        g = out.grads.get(gid)
        if g is None:
            return []
        x0, y0, x1, y1 = bbox; w, h = x1 - x0, y1 - y0
        stops = ''.join(f'<GradientStop colorValue="{hexa(c, a*alpha)}" position="{fmt(o)}"/>' for o, c, a in g['stops'])
        if g['type'] == 'linear':
            sx, sy = x0 + g['x1']*w - ox, y0 + g['y1']*h - oy
            ex, ey = x0 + g['x2']*w - ox, y0 + g['y2']*h - oy
            return [f'{ind}<{tag}{extra} name="{tag}"><LinearGradient startX="{fmt(sx)}" startY="{fmt(sy)}" endX="{fmt(ex)}" endY="{fmt(ey)}" name="Gradient">{stops}</LinearGradient></{tag}>']
        cx, cy = x0 + g['cx']*w - ox, y0 + g['cy']*h - oy
        r = g['r'] * max(w, h)
        return [f'{ind}<{tag}{extra} name="{tag}"><RadialGradient startX="{fmt(cx)}" startY="{fmt(cy)}" endX="{fmt(cx + r)}" endY="{fmt(cy)}" name="Gradient">{stops}</RadialGradient></{tag}>']
    return [f'{ind}<{tag}{extra} name="{tag}"><SolidColor colorValue="{hexa(spec, alpha)}" name="Color"/></{tag}>']

def read_grads(root, out):
    for el in root.iter():
        tag = el.tag.replace(SVGNS, '')
        if tag not in ('linearGradient', 'radialGradient'):
            continue
        stops = []
        for s in el:
            if s.tag.replace(SVGNS, '') != 'stop':
                continue
            st = style_of(s, {})
            col = s.get('stop-color') or st.get('stop-color', '#000')
            op = float(s.get('stop-opacity') or st.get('stop-opacity', 1))
            off = s.get('offset', '0'); off = float(off[:-1])/100 if off.endswith('%') else float(off)
            stops.append((off, col, op))
        f = lambda k, d: float(el.get(k, d).rstrip('%')) / (100 if el.get(k, '').endswith('%') else 1)
        if tag == 'linearGradient':
            out.grads[el.get('id')] = {'type': 'linear', 'x1': f('x1', '0'), 'y1': f('y1', '0'), 'x2': f('x2', '1'), 'y2': f('y2', '0'), 'stops': stops}
        else:
            out.grads[el.get('id')] = {'type': 'radial', 'cx': f('cx', '0.5'), 'cy': f('cy', '0.5'), 'r': f('r', '0.5'), 'stops': stops}

def shape_subs(el, m):
    tag = el.tag.replace(SVGNS, '')
    g = lambda k, d=0.0: float(el.get(k, d))
    if tag == 'path':
        d = el.get('d', '')
    elif tag == 'rect':
        d = rect_path(g('x'), g('y'), g('width'), g('height'), g('rx'), g('ry'))
    elif tag == 'circle':
        d = ellipse_path(g('cx'), g('cy'), g('r'), g('r'))
    elif tag == 'ellipse':
        d = ellipse_path(g('cx'), g('cy'), g('rx'), g('ry'))
    elif tag == 'line':
        d = f"M{g('x1')} {g('y1')} L{g('x2')} {g('y2')}"
    elif tag in ('polygon', 'polyline'):
        pts = re.findall(r'[-+]?(?:\d*\.\d+|\d+)', el.get('points', ''))
        pairs = [f'{pts[k]} {pts[k+1]}' for k in range(0, len(pts) - 1, 2)]
        d = 'M' + ' L'.join(pairs) + (' Z' if tag == 'polygon' else '')
    else:
        return None
    subs = parse_path(d)
    return [([tuple(apply(m, p) for p in s) for s in segs], c) for segs, c in subs]

def collect(el, m, st, op):
    """-> tree of dicts: {kind:'group'|'shape', name, children|subs, style, opacity}"""
    tag = el.tag.replace(SVGNS, '')
    m2 = mat_mul(m, parse_transform(el.get('transform')))
    st2 = style_of(el, st)
    op2 = float(el.get('opacity', 1))
    if tag in ('svg', 'g'):
        kids = [collect(c, m2, st2, 1.0) for c in el]
        kids = [k for k in kids if k]
        if not kids:
            return None
        return {'kind': 'group', 'name': el.get('id') or ('Art' if tag == 'svg' else 'Group'), 'children': kids, 'opacity': op2}
    if tag in ('defs', 'linearGradient', 'radialGradient', 'stop', 'title', 'desc'):
        return None
    subs = shape_subs(el, m2)
    if not subs:
        return None
    return {'kind': 'shape', 'name': el.get('id') or 'Path', 'subs': subs, 'style': st2, 'opacity': op2, 'scale': scale_of(m2)}

def all_subs(node):
    if node['kind'] == 'shape':
        return node['subs']
    r = []
    for c in node['children']:
        r += all_subs(c)
    return r

def emit(node, px, py, out, ind, lines, pivot_named):
    bb = bbox_of(all_subs(node))
    if node['kind'] == 'group':
        use_pivot = pivot_named and node['name'] not in ('Group',)
        fx, fy = out.pivots.get(node['name'], (0.5, 0.5))
        cx, cy = (bb[0] + (bb[2] - bb[0]) * fx, bb[1] + (bb[3] - bb[1]) * fy) if use_pivot else (px, py)
        opa = '' if node['opacity'] == 1 else f' opacity="{fmt(node["opacity"])}"'
        nid = out.nid(node['name']); out.pos.setdefault(node['name'], (cx - px, cy - py))
        ns = out.scales.get(node['name'])
        sca = f' scaleX="{fmt(ns)}" scaleY="{fmt(ns)}"' if ns else ''
        lines.append(f'{ind}<Node x="{fmt(cx - px)}" y="{fmt(cy - py)}"{sca}{opa} name="{node["name"]}" id="{nid}">')
        for c in reversed(node['children']):
            emit(c, cx, cy, out, ind + '    ', lines, pivot_named)
        lines.append(f'{ind}</Node>')
        return
    st = node['style']
    cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    opa = '' if node['opacity'] == 1 else f' opacity="{fmt(node["opacity"])}"'
    lines.append(f'{ind}<Shape x="{fmt(cx - px)}" y="{fmt(cy - py)}"{opa} name="{node["name"]}" id="{out.nid(node["name"])}">')
    for segs, closed in node['subs']:
        if not segs:
            continue
        cl = closed
        if not closed and math.dist(segs[0][0], segs[-1][3]) < 1e-3:
            cl = True
        lines.append(f'{ind}    <PointsPath isClosed="{"true" if cl else "false"}" name="Path">')
        lines += vertices_xml(segs, cl, cx, cy, ind + '        ')
        lines.append(f'{ind}    </PointsPath>')
    fill = st.get('fill', '#000000')
    fa = float(st.get('fill-opacity', 1))
    lines += paint_xml('fill', fill, fa, bb, cx, cy, out, ind + '    ')
    stroke = st.get('stroke')
    if stroke and stroke != 'none':
        w = float(st.get('stroke-width', 1)) * node['scale']
        cap = st.get('stroke-linecap', 'butt'); join = st.get('stroke-linejoin', 'miter')
        sa = float(st.get('stroke-opacity', 1))
        lines += paint_xml('stroke', stroke, sa, bb, cx, cy, out, ind + '    ', extra=f' thickness="{fmt(w)}" cap="{cap}" join="{join}"')
    lines.append(f'{ind}</Shape>')

def convert(svg_text, name, prefix, ind='        ', x=0, y=0, scale=1.0, pivots=None, opacity=1.0, want_names=False, scales=None):
    root = ET.fromstring(svg_text)
    out = Out(prefix, pivots)
    out.scales = scales or {}
    read_grads(root, out)
    m0 = I
    vb = root.get('viewBox')
    if vb:
        vx, vy, vw, vh = [float(v) for v in re.split(r'[\s,]+', vb.strip())]
        w = float(re.sub(r'[^0-9.]', '', root.get('width', str(vw))) or vw)
        h = float(re.sub(r'[^0-9.]', '', root.get('height', str(vh))) or vh)
        sx, sy = w / vw, h / vh
        m0 = (sx, 0, 0, sy, -vx * sx, -vy * sy)
    tree = collect(root, m0, {'fill': '#000000'}, 1.0)
    tree['name'] = name
    lines = []
    # top node sits at the drawing's origin so the art keeps its SVG coordinates
    emit_root(tree, out, ind, lines, x, y, scale, opacity)
    if want_names:
        out.names['__pos__'] = out.pos
        return '\n'.join(lines), out.names
    return '\n'.join(lines), out.n

def emit_root(tree, out, ind, lines, x, y, scale=1.0, opacity=1.0):
    sc = '' if scale == 1 else f' scaleX="{fmt(scale)}" scaleY="{fmt(scale)}"'
    op = '' if opacity == 1 else f' opacity="{fmt(opacity)}"'
    lines.append(f'{ind}<Node x="{fmt(x)}" y="{fmt(y)}"{sc}{op} name="{tree["name"]}" id="{out.nid(tree["name"])}">')
    for c in reversed(tree['children']):
        emit(c, 0, 0, out, ind + '    ', lines, True)
    lines.append(f'{ind}</Node>')

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('svg'); ap.add_argument('--name', default='Art'); ap.add_argument('--prefix', default='9')
    ap.add_argument('--x', type=float, default=0); ap.add_argument('--y', type=float, default=0)
    a = ap.parse_args()
    txt, n = convert(open(a.svg).read(), a.name, a.prefix, x=a.x, y=a.y)
    print(txt)
