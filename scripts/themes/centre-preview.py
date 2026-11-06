# Same-zoom preview of each centre plaza: the assembled SVG pieces (from centre.json) with 100 Duckies standing on the
# walkable ground, beside the locked concept scaled so its Duckies are the same height.
# writes concepts/themes/centre-variations/<theme>-centre-built.png
# usage: vt/bin/python scripts/themes/centre-preview.py [theme ...]
import json, os, io, re, sys, math, random
import numpy as np, cairosvg
from PIL import Image, ImageDraw
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes')
CV = os.path.abspath(os.path.join(ROOT, '..', 'concepts/themes/centre-variations'))
DUCK_DIR = os.path.join(ROOT, 'public/pixi-duck')
K = 36 / 47
S = 0.5                                   # preview pixels per world unit
CONCEPTS = {'sunflower': ('sunflower-combo-a.png', 70), 'pink': ('pink-centre-5.png', 66), 'library': ('library-centre-2.png', 68)}  # concept Ducky height px
GRASS = {'sunflower': (147, 183, 47), 'pink': (137, 195, 50), 'library': (147, 183, 47)}

def duck_sprite(h):
    parts = ['shadow-0', 'tail-0', 'foot-0', 'foot-1', 'toe-0', 'toe-1', 'body-0', 'eye-0', 'eye-1', 'beak-0']
    c = Image.new('RGBA', (900, 900))
    for p in parts:
        f = os.path.join(DUCK_DIR, f'view-10-{p}.svg'); s = open(f).read()
        x, y, w, hh = map(float, re.search(r'viewBox="([^"]+)"', s).group(1).split())
        c.alpha_composite(Image.open(io.BytesIO(cairosvg.svg2png(url=f))).convert('RGBA'), (int(x) + 100, int(y) + 100))
    c = c.crop(c.getbbox())
    return c.resize((round(c.width * h / c.height), round(h)), Image.LANCZOS)

_cache = {}
def render(path, w, h, flip=False):
    key = (path, round(w), round(h), flip)
    if key not in _cache:
        im = Image.open(io.BytesIO(cairosvg.svg2png(url=path, output_width=max(1, round(w)), output_height=max(1, round(h))))).convert('RGBA')
        _cache[key] = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
    return _cache[key]

def shape(s):
    if 'ellipse' in s:
        e = s['ellipse']; t = np.linspace(0, 2 * math.pi, 120)
        return Polygon(np.c_[e['x'] + e['rx'] * np.cos(t), e['y'] + e['ry'] * np.sin(t)])
    return Polygon(s['poly'])

def assemble(theme, data, folder, extra_pieces=(), ducks=100, seed=3):
    pcs = list(data['pieces']) + list(extra_pieces)
    xs = [p['x'] for p in pcs] + [p['x'] + p['width'] for p in pcs]
    ys = [p['y'] for p in pcs] + [p['y'] + p['height'] for p in pcs]
    x0, y0, x1, y1 = min(xs) - 60, min(ys) - 60, max(xs) + 60, max(ys) + 60
    W, H = int((x1 - x0) * S), int((y1 - y0) * S)
    img = Image.new('RGBA', (W, H), GRASS[theme] + (255,))
    def put(p):
        im = render(os.path.join(folder, p['file']), p['width'] * S, p['height'] * S, p.get('flip', False))
        img.alpha_composite(im, (int((p['x'] - x0) * S), int((p['y'] - y0) * S)))
    for p in pcs:
        if p['layer'] == 'decal': put(p)
    for p in pcs:
        if p['layer'] == 'back': put(p)
    # Duckies on walkable ground, spaced like a crowd
    walk = unary_union([shape(s) for s in data.get('walkable', [])])
    blocked = unary_union([shape(s) for s in data.get('blocked', [])])
    free = walk.difference(blocked.buffer(30))
    rnd = random.Random(seed); pts = []
    bx0, by0, bx1, by1 = free.bounds
    tries = 0
    while len(pts) < ducks and tries < 60000:
        tries += 1
        p = (rnd.uniform(bx0, bx1), rnd.uniform(by0, by1))
        if free.contains(Point(p)) and all((p[0] - q[0]) ** 2 + ((p[1] - q[1]) / K) ** 2 > 82 ** 2 for q in pts): pts.append(p)
    duck = duck_sprite(130 * S)
    items = [(p.get('sortY', p['at'][1]), 1, p) for p in pcs if p['layer'] in ('front', 'sorted')]
    items += [(y, 0, ('duck', x, y)) for x, y in pts]
    items.sort(key=lambda t: (t[0], t[1]))
    anim = [p for p in pcs if p['layer'] == 'anim']
    for _, _, it in items:
        if isinstance(it, tuple):
            _, x, y = it; d = duck if rnd.random() < .5 else duck.transpose(Image.FLIP_LEFT_RIGHT)
            img.alpha_composite(d, (int((x - x0) * S - d.width / 2), int((y - y0) * S - d.height)))
        else:
            put(it)
            for a in anim:
                if a.get('parent') == it['id'].replace('bookstore-', ''): put(a)
            if it['id'] == 'globe':
                for a in anim:
                    if a['id'].startswith('jet-front'): put(a)
        if isinstance(it, dict) and it['id'] == 'globe': pass
    for a in anim:                                         # anything not drawn with a parent (back jets drawn early)
        pass
    return img, len(pts)

def main(themes):
    for theme in themes:
        folder = os.path.join(ART, theme, 'centre')
        data = json.load(open(os.path.join(folder, 'centre.json')))
        if theme == 'library':   # back jets sort just above the water, before the globe
            for p in data['pieces']:
                if p['id'].startswith('jet-back'): p['layer'] = 'sorted'
        img, n = assemble(theme, data, folder)
        panels = [img]
        if theme == 'library' and 'bookstore' in data:
            bimg, _ = assemble(theme, data['bookstore'], folder, ducks=40, seed=5)
            panels.append(bimg)
        cfile, duck_px = CONCEPTS[theme]
        con = Image.open(os.path.join(CV, cfile)).convert('RGBA')
        f = (130 * S) / duck_px
        con = con.resize((round(con.width * f), round(con.height * f)), Image.LANCZOS)
        panels = [con] + panels
        if theme == 'library':
            tw = Image.open(os.path.join(CV, '..', 'library-base', 'library-two-isles-3.png')).convert('RGBA')
            tw = tw.crop((860, 20, 1460, 440)); tf = (130 * S) / 34
            panels.insert(2, tw.resize((round(tw.width * tf), round(tw.height * tf)), Image.LANCZOS))
        gap = 40
        W = sum(p.width for p in panels) + gap * (len(panels) + 1); H = max(p.height for p in panels) + 2 * gap + 50
        out = Image.new('RGB', (W, H), (250, 248, 240))
        dr = ImageDraw.Draw(out); x = gap
        labels = ['concept (locked), same Ducky size', f'built SVG pieces, {n} Duckies'] + (['tower concept, same Ducky size', 'built bookstore'] if theme == 'library' else [])
        for p, lb in zip(panels, labels):
            out.paste(p, (x, gap + 50), p); dr.text((x, gap + 10), lb, fill=(40, 40, 40)); x += p.width + gap
        dst = os.path.join(CV, f'{theme}-centre-built.png')
        out.save(dst); print(dst, out.size, n, 'duckies')

if __name__ == '__main__':
    main(sys.argv[1:] or ['sunflower', 'pink', 'library'])
