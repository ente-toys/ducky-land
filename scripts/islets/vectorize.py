#!/usr/bin/env python3
"""Vectorise the 11 approved islet artworks into flat-fill SVGs (boss 8 Nov: "pixel perfect like the homeland centre").

Local fallback tracer: the same border-connected sea removal as cutouts.mjs, then a small colour palette (median cut),
then every colour traced with potrace as stacked layers (lightest first, ink last). Layer k holds every pixel of colours
k..N, so later layers always sit on solid paint: no seams between fills at any zoom. Paths are baked into the same
square framing the old 640px cut-outs used (content 628/640 of the box, centred), viewBox 0 0 1024 1024.

  python3 scripts/islets/vectorize.py            # writes public/pixi-art/islets/<name>.svg
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(os.path.dirname(ROOT), 'concepts/themes/world-map/islets')
OUT = os.path.join(ROOT, 'public/pixi-art/islets')
ART = ['odyssey', 'tree-and-rowboat', 'broken-shipwreck', '04-small-mountain', '05-lighthouse-rock', '06-palm-treasure',
       '07-pink-blossom', '08-snow-igloo', '09-spooky-purple', '11-volcano', '12-coral-atoll']
COLOURS = int(os.environ.get('ISLET_COLOURS', 30))
VIEW = 1024
SHAPES = {}


def sea_mask(rgb):
    h, w, _ = rgb.shape
    pal = []
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            if x < 32 or y < 32 or x >= w - 32 or y >= h - 32:
                c = rgb[y, x].astype(int)
                if not any(all(abs(int(p[k]) - c[k]) < 7 for k in range(3)) for p in pal): pal.append(c)
    f = rgb.astype(np.float32)
    dist = np.full((h, w), 1e9, np.float32)
    for c in pal: dist = np.minimum(dist, np.sqrt(((f - np.array(c, np.float32)) ** 2).sum(2)))
    ok = dist < 25
    sea = np.zeros((h, w), bool)
    sea[0, :] = ok[0, :]; sea[-1, :] = ok[-1, :]; sea[:, 0] = ok[:, 0]; sea[:, -1] = ok[:, -1]
    while True:   # flood fill from the border through sea colours (4-connected)
        grow = sea.copy()
        grow[1:, :] |= sea[:-1, :]; grow[:-1, :] |= sea[1:, :]; grow[:, 1:] |= sea[:, :-1]; grow[:, :-1] |= sea[:, 1:]
        grow &= ok
        if (grow == sea).all(): return sea
        sea = grow


def potrace_paths(mask):
    """Trace a boolean mask; returns potrace's path data in pixel coordinates (y down)."""
    h, w = mask.shape
    with tempfile.TemporaryDirectory() as tmp:
        pbm = os.path.join(tmp, 'm.pbm'); svg = os.path.join(tmp, 'm.svg')
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert('1').save(pbm)
        subprocess.run(['potrace', pbm, '-s', '-o', svg, '-t', '4', '-a', '1.0', '-O', '0.4', '-u', '10'], check=True)
        text = open(svg).read()
    out = []
    for d in re.findall(r'<path d="([^"]+)"', text, re.S):
        out.append(absolute(d))
    # potrace writes transform="translate(0,H) scale(0.1,-0.1)" with -u 10: x/10, H - y/10
    return [[(cmd, [(x / 10, h - y / 10) for x, y in pts]) for cmd, pts in sub] for sub in out]


def absolute(d):
    tokens = re.findall(r'[MmLlCcZz]|-?\d+(?:\.\d+)?', d)
    i, cmd, cur, start, res = 0, None, (0, 0), (0, 0), []
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha(): cmd = t; i += 1
        if cmd in 'Zz': res.append(('Z', [])); cur = start; continue
        n = {'M': 2, 'm': 2, 'L': 2, 'l': 2, 'C': 6, 'c': 6}[cmd]
        v = [float(x) for x in tokens[i:i + n]]; i += n
        pts = [(v[k], v[k + 1]) for k in range(0, n, 2)]
        if cmd.islower(): pts = [(cur[0] + x, cur[1] + y) for x, y in pts]
        up = cmd.upper()
        res.append((up, pts)); cur = pts[-1]
        if up == 'M': start = cur; cmd = 'l' if cmd == 'm' else 'L'   # implicit lineto after moveto
    return res


def polygons(mask, turd=600):
    """Outer contours and holes of a mask as flattened polygons (pixel coords), via potrace."""
    h, w = mask.shape
    with tempfile.TemporaryDirectory() as tmp:
        pbm = os.path.join(tmp, 'm.pbm'); svg = os.path.join(tmp, 'm.svg')
        Image.fromarray(np.where(mask, 0, 255).astype(np.uint8)).convert('1').save(pbm)
        subprocess.run(['potrace', pbm, '-s', '-o', svg, '-t', str(turd), '-a', '1.3', '-O', '1', '-u', '1'], check=True)
        text = open(svg).read()
    rings = []
    for d in re.findall(r'<path d="([^"]+)"', text, re.S):
        ring, cur = [], None
        for cmd, pts in absolute(d):
            if cmd == 'M':
                if len(ring) > 2: rings.append(ring)
                ring = [pts[0]]; cur = pts[0]
            elif cmd == 'L': ring.append(pts[0]); cur = pts[0]
            elif cmd == 'C':
                a, b, c = pts
                for t in (.25, .5, .75, 1):
                    m = 1 - t
                    ring.append((m*m*m*cur[0] + 3*m*m*t*a[0] + 3*m*t*t*b[0] + t*t*t*c[0], m*m*m*cur[1] + 3*m*m*t*a[1] + 3*m*t*t*b[1] + t*t*t*c[1]))
                cur = c
        if len(ring) > 2: rings.append(ring)
    area = lambda r: abs(sum(r[k][0]*r[k-1][1] - r[k-1][0]*r[k][1] for k in range(len(r)))) / 2
    rings = [[(x, h - y) for x, y in r] for r in rings]   # -u 1: unit scale, y flipped
    rings.sort(key=area, reverse=True)
    return rings, area


def simplify(ring, tol):
    """Douglas-Peucker on a closed ring."""
    def dp(pts):
        if len(pts) < 3: return pts
        (ax, ay), (bx, by) = pts[0], pts[-1]
        L = max(1e-9, ((bx - ax) ** 2 + (by - ay) ** 2) ** .5)
        d = [abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / L for x, y in pts[1:-1]]
        k = max(range(len(d)), key=d.__getitem__)
        if d[k] < tol: return [pts[0], pts[-1]]
        return dp(pts[:k + 2])[:-1] + dp(pts[k + 1:])
    far = max(range(len(ring)), key=lambda k: (ring[k][0] - ring[0][0]) ** 2 + (ring[k][1] - ring[0][1]) ** 2)
    return dp(ring[:far + 1])[:-1] + dp(ring[far:] + [ring[0]])[:-1]


def inside(pt, ring):
    x, y = pt; c = False
    for i in range(len(ring)):
        (x1, y1), (x2, y2) = ring[i], ring[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c


def erode(mask, n):
    m = mask.copy()
    for _ in range(n):
        e = m.copy(); e[1:] &= m[:-1]; e[:-1] &= m[1:]; e[:, 1:] &= m[:, :-1]; e[:, :-1] &= m[:, 1:]; m = e
    return m


def land_shape(rgb, sea, s, tx, ty):
    """Where a Ducky can stand: the island's dry land (sand, grass, rock, snow), never the turquoise water ring or a
    lagoon. Returns the outer coast, the lagoons inside it and the whole opaque edge, all in viewBox units."""
    f = rgb.astype(np.float32) / 255
    mx, mn = f.max(2), f.min(2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    water = (sat > .28) & (hue > 165) & (hue < 215) & (b > r + .15)
    foam = (mx > .9) & (sat < .12) & ~erode(~sea, 26)   # the white surf line round the outside
    wet = water | foam
    land = ~sea & ~wet
    # The art is seen from above at an angle, so trees, towers and smoke rise into the sky past the far shore. The
    # island's footing is the ellipse its surf ring traces: fit it to the outline wherever water shows at the edge,
    # then keep only land inside it. Canopies, towers and smoke standing up into the sky fall outside.
    opaque = ~sea
    rim = opaque & ~erode(opaque, 1)
    near_wet = wet.copy()
    for _ in range(8): g2 = near_wet.copy(); g2[1:] |= near_wet[:-1]; g2[:-1] |= near_wet[1:]; g2[:, 1:] |= near_wet[:, :-1]; g2[:, :-1] |= near_wet[:, 1:]; near_wet = g2
    ys, xs = np.nonzero(rim & near_wet)
    X, Y = xs.astype(float), ys.astype(float)
    D = np.stack([X * X, X * Y, Y * Y, X, Y, np.ones_like(X)], 1)
    _, _, vt = np.linalg.svd(D, full_matrices=False)
    A, B, C, Dx, Ey, F = vt[-1]
    if A < 0: A, B, C, Dx, Ey, F = -A, -B, -C, -Dx, -Ey, -F
    yy, xx = np.mgrid[0:land.shape[0], 0:land.shape[1]].astype(float)
    foot = A * xx * xx + B * xx * yy + C * yy * yy + Dx * xx + Ey * yy + F < 0
    for _ in range(24): g2 = foot.copy(); g2[1:] |= foot[:-1]; g2[:-1] |= foot[1:]; g2[:, 1:] |= foot[:, :-1]; g2[:, :-1] |= foot[:, 1:]; foot = g2
    land = land & foot
    # one solid island: close pinholes (stones, shells), then keep the biggest piece
    grow = land.copy()
    for _ in range(4): g2 = grow.copy(); g2[1:] |= grow[:-1]; g2[:-1] |= grow[1:]; g2[:, 1:] |= grow[:, :-1]; g2[:, :-1] |= grow[:, 1:]; grow = g2
    land = erode(grow, 4)
    stand = erode(land, 14)   # keep Duckies a step back from the waterline
    stand = erode(stand, 18)   # open: drop thin slivers (a lava line, a mast) nobody could walk along
    for _ in range(18): g2 = stand.copy(); g2[1:] |= stand[:-1]; g2[:-1] |= stand[1:]; g2[:, 1:] |= stand[:, :-1]; g2[:, :-1] |= stand[:, 1:]; stand = g2
    rings, area = polygons(stand)
    to_view = lambda ring: [[round(x * s + tx, 1), round(y * s + ty, 1)] for x, y in simplify(ring, 2.5)]
    coast = rings[0]
    lakes = [r for r in rings[1:] if area(r) > 2500 and inside(r[0], coast)]
    edge, _ = polygons(~sea, 2000)
    return {'coast': to_view(coast), 'lakes': [to_view(r) for r in lakes], 'edge': to_view(edge[0])}


def split_rings(subs):
    """potrace subpaths -> [(outer, [holes])]: even nesting depth fills, odd depth is a hole of its nearest container."""
    rings = []
    for sub in subs:
        cur = None
        for cmd, pts in sub:
            if cmd == 'M': cur = [(cmd, pts)]; rings.append(cur)
            else: cur.append((cmd, pts))
    polys = []
    for r in rings:
        pts = [p for _, ps in r for p in ps]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        area = abs(sum(pts[k][0] * pts[k - 1][1] - pts[k - 1][0] * pts[k][1] for k in range(len(pts)))) / 2
        polys.append({'pts': pts, 'box': (min(xs), min(ys), max(xs), max(ys)), 'area': area})
    def contains(a, b):
        ax0, ay0, ax1, ay1 = a['box']; bx0, by0, bx1, by1 = b['box']
        if a['area'] <= b['area'] or bx0 < ax0 or by0 < ay0 or bx1 > ax1 or by1 > ay1: return False
        return inside(b['pts'][0], a['pts'])
    parent = []
    for j, b in enumerate(polys):
        cands = [i for i, a in enumerate(polys) if i != j and contains(a, b)]
        parent.append(min(cands, key=lambda i: polys[i]['area']) if cands else None)
    depth = []
    for j in range(len(polys)):
        d, p = 0, parent[j]
        while p is not None: d += 1; p = parent[p]
        depth.append(d)
    out = {j: (rings[j], []) for j in range(len(rings)) if depth[j] % 2 == 0}
    for j in range(len(rings)):
        if depth[j] % 2 == 1 and parent[j] in out: out[parent[j]][1].append(rings[j])
    return list(out.values())


def fmt(v): return ('%.1f' % v).rstrip('0').rstrip('.')


def vectorise(name):
    file = 'odyssey-sunk.png' if name == 'odyssey' and os.path.exists(os.path.join(SOURCE, 'odyssey-sunk.png')) else f'{name}.png'
    rgb = np.array(Image.open(os.path.join(SOURCE, file)).convert('RGB'))
    h, w, _ = rgb.shape
    sea = sea_mask(rgb)
    ys, xs = np.nonzero(~sea)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    s = (628 * VIEW / 640) / max(x1 - x0 + 1, y1 - y0 + 1)
    tx = (VIEW - (x1 - x0 + 1) * s) / 2 - x0 * s; ty = (VIEW - (y1 - y0 + 1) * s) / 2 - y0 * s
    # flat cartoon fills: smooth the paint, then a median-cut palette over the island only
    smooth = Image.fromarray(rgb).filter(ImageFilter.MedianFilter(3))
    land = ~sea
    flat = np.array(smooth)
    q = Image.fromarray(flat[land].reshape(-1, 1, 3)).quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    palette = np.array(q.getpalette()[:COLOURS * 3]).reshape(-1, 3)
    idx = np.full((h, w), 255, np.uint8); idx[land] = np.array(q).reshape(-1)
    idx = np.array(Image.fromarray(idx).filter(ImageFilter.ModeFilter(3)))   # drop single-pixel speckle
    idx[sea] = 255
    used = [k for k in range(len(palette)) if (idx == k).sum() > 40]
    lum = lambda c: .299 * c[0] + .587 * c[1] + .114 * c[2]
    order = sorted(used, key=lambda k: -lum(palette[k]))   # lightest first, ink on top
    paths = []
    for n, k in enumerate(order):
        mask = np.isin(idx, order[n:]) if n else (idx != 255)
        rings = split_rings(potrace_paths(mask))
        if not rings: continue
        colour = '#%02x%02x%02x' % tuple(int(v) for v in palette[k])
        draw = lambda ring: ''.join(cmd + ' '.join(f'{fmt(x * s + tx)} {fmt(y * s + ty)}' for x, y in pts) for cmd, pts in ring)
        # One <path> per filled ring with only its own holes: Pixi's SVG parser fills the biggest subpath of a path and cuts
        # every other one out of it, so several separate shapes in one path would turn into holes.
        for outer, holes in rings:
            paths.append(f'<path fill="{colour}" fill-rule="evenodd" d="{draw(outer)}{"".join(draw(h) for h in holes)}"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{VIEW}" height="{VIEW}" viewBox="0 0 {VIEW} {VIEW}">\n' + '\n'.join(paths) + '\n</svg>\n'
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(svg)
    SHAPES[name] = land_shape(rgb, sea, s, tx, ty)
    return {'name': name, 'source': file, 'size': VIEW, 'layers': len(paths), 'bytes': len(svg), 'bounds': [int(x0), int(y0), int(x1), int(y1)]}


if __name__ == '__main__':
    names = sys.argv[1:] or ART
    meta = []
    for name in names:
        m = vectorise(name); meta.append(m); print(m['name'], m['layers'], 'layers', m['bytes'] // 1024, 'KiB')
    if not sys.argv[1:]:
        json.dump(meta, open(os.path.join(OUT, 'sources.json'), 'w'), indent=2); open(os.path.join(OUT, 'sources.json'), 'a').write('\n')
        json.dump({'view': VIEW, 'shapes': SHAPES}, open(os.path.join(ROOT, 'src/pixi/islet-shapes.json'), 'w'), separators=(',', ':')); open(os.path.join(ROOT, 'src/pixi/islet-shapes.json'), 'a').write('\n')
