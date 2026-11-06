# Renders the Sunflower island from its art.json (ground tiles, decks, flats, props sorted by y) to a PNG,
# and a side-by-side with the concept, all outside public/.
# usage: vt/bin/python scripts/themes/sunflower-preview.py [scale=.3] [--walk] [--crop x0,y0,x1,y1]
import json, os, sys, io
import cairosvg
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes/sunflower')
CONCEPTS = os.path.abspath(os.path.join(ROOT, '..', 'concepts/themes'))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
K = float(args[0]) if args else .3
crop = None
if '--crop' in sys.argv: crop = [int(v) for v in sys.argv[sys.argv.index('--crop') + 1].split(',')]
art = json.load(open(f'{ART}/art.json'))
W, H = art['width'], art['height']
ox, oy = (crop[0], crop[1]) if crop else (0, 0)
cw, ch = (crop[2] - crop[0], crop[3] - crop[1]) if crop else (W, H)
img = Image.new('RGBA', (int(cw * K), int(ch * K)), art.get('sea', '#6EC9DE'))
cache = {}
def raster(src, w, h, flip=False):
    key = (src, int(w), int(h), flip)
    if key not in cache:
        png = cairosvg.svg2png(url=f'{ART}/{src}', output_width=max(1, int(w)), output_height=max(1, int(h)))
        im = Image.open(io.BytesIO(png)).convert('RGBA')
        cache[key] = im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
    return cache[key]
def blit(im, x, y):
    img.alpha_composite(im, (int(round(x)), int(round(y)))) if 0 <= x and 0 <= y and x + im.width <= img.width and y + im.height <= img.height else _clip(im, x, y)
def _clip(im, x, y):
    tmp = Image.new('RGBA', img.size, (0, 0, 0, 0)); tmp.paste(im, (int(round(x)), int(round(y)))); img.alpha_composite(tmp)
for t in art['ground']['tiles']:
    if crop and (t['x'] > crop[2] or t['y'] > crop[3] or t['x'] + t['width'] < crop[0] or t['y'] + t['height'] < crop[1]): continue
    blit(raster(t['src'], t['width'] * K + 1, t['height'] * K + 1), (t['x'] - ox) * K, (t['y'] - oy) * K)
for f in art['flats']:
    w, h = f['width'] * K, f['height'] * K
    if f.get('topLeft'): blit(raster(f['src'], w, h), (f['x'] - ox) * K, (f['y'] - oy) * K)
    else: blit(raster(f['src'], w, h, f.get('flip', False)), (f['x'] - ox) * K - w / 2, (f['y'] - oy) * K - h)
for d in art['decks']:
    blit(raster(d['src'], d['width'] * K, d['height'] * K), (d['x'] - ox) * K, (d['y'] - oy) * K)
for p in sorted(art['props'], key=lambda p: p['y']):
    w, h = p['width'] * p['scale'] * K, p['height'] * p['scale'] * K
    x, y = (p['x'] - ox) * K - p['anchor']['x'] * w, (p['y'] - oy) * K - p['anchor']['y'] * h
    if crop and (x > img.width or y > img.height or x + w < 0 or y + h < 0): continue
    blit(raster(p['src'], w, h, p.get('flip', False)), x, y)
if '--walk' in sys.argv:
    dr = ImageDraw.Draw(img, 'RGBA')
    walk = json.load(open(os.path.join(ROOT, 'rive/web/themes/sunflower/walk-world.json')))
    dr.polygon([((x - ox) * K, (y - oy) * K) for x, y in walk['coast']], outline=(255, 0, 0, 255))
    for o in walk['obstacles']:
        if 'poly' in o: dr.polygon([((x - ox) * K, (y - oy) * K) for x, y in o['poly']], outline=(255, 0, 255, 255))
        else: dr.ellipse([((o['x'] - o['rx']) - ox) * K, ((o['y'] - o['ry']) - oy) * K, ((o['x'] + o['rx']) - ox) * K, ((o['y'] + o['ry']) - oy) * K], outline=(255, 0, 255, 255))
    for w in walk['walkways']: dr.line([((w['a'][0] - ox) * K, (w['a'][1] - oy) * K), ((w['b'][0] - ox) * K, (w['b'][1] - oy) * K)], fill=(255, 0, 0, 255), width=2)
    hb = json.load(open(os.path.join(ROOT, 'rive/web/themes/sunflower/harbor.json')))
    for b in hb['boats']: dr.ellipse([(b['x'] - 46 - ox) * K, (b['y'] - 46 - oy) * K, (b['x'] + 46 - ox) * K, (b['y'] + 46 - oy) * K], outline=(0, 0, 255, 255), width=2)
    wd = json.load(open(os.path.join(ROOT, 'rive/web/themes/sunflower/world.json')))
    for k, z in wd['zones'].items(): s = z['spawn']; dr.ellipse([(s[0] - 25 - ox) * K, (s[1] - 25 - oy) * K, (s[0] + 25 - ox) * K, (s[1] + 25 - oy) * K], fill=(255, 0, 0, 255))
name = 'sunflower-render' + ('-walk' if '--walk' in sys.argv else '') + ('-crop' if crop else '')
out = os.path.join(CONCEPTS, 'work/sunflower', name + '.png'); img.convert('RGB').save(out); print(out)
if not crop and '--walk' not in sys.argv:
    img.convert('RGB').resize((1160, round(1160 * H / W)), Image.LANCZOS).save(os.path.join(CONCEPTS, 'work/sunflower/preview.png'))
    concept = Image.open(os.path.join(CONCEPTS, 'concepts/01-sunflower.png')).convert('RGB')
    hh = 1000; a = concept.resize((int(concept.width * hh / concept.height), hh)); b = img.convert('RGB').resize((int(img.width * hh / img.height), hh))
    side = Image.new('RGB', (a.width + b.width + 30, hh), 'white'); side.paste(a, (0, 0)); side.paste(b, (a.width + 30, 0))
    side.save(os.path.join(CONCEPTS, 'work/sunflower/concept-comparison.png')); print(os.path.join(CONCEPTS, 'work/sunflower/concept-comparison.png'))
