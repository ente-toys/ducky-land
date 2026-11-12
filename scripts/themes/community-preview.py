# Campfire Commons: render the whole island from its art.json (ground tiles, decks, flats, props sorted by y, the
# moored boats) the way the engine stacks it, and put it beside the approved concept.
# Needs a python3.11 venv with cairosvg pillow.
#   python scripts/themes/community-preview.py [scale=0.3]
# Writes preview PNGs only to concepts/themes/work/community/.
import io, json, os, sys
import cairosvg
from PIL import Image, ImageOps

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ART = os.path.join(ROOT, 'public/pixi-art/themes/community')
CONCEPT = os.path.join(ROOT, '..', 'concepts/themes/concepts/21-community-discord-d2.png')
OUT = os.path.join(ROOT, '..', 'concepts/themes/work/community/community-preview.png')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
S = float(sys.argv[1]) if len(sys.argv) > 1 else .3

art = json.load(open(os.path.join(ART, 'art.json')))
harbor = json.load(open(os.path.join(ROOT, 'assets/world/themes/community/harbor.json')))
W, H = int(art['width'] * S), int(art['height'] * S)
src = lambda s: s if s.startswith('/Users') else os.path.join(ROOT, 'public', s.lstrip('/')) if s.startswith('/') else os.path.join(ART, s)
cache = {}
def raster(path, w, h, flip=False):
    key = (path, w, h, flip)
    if key not in cache:
        im = Image.open(io.BytesIO(cairosvg.svg2png(url=path, output_width=max(1, w), output_height=max(1, h)))).convert('RGBA')
        cache[key] = ImageOps.mirror(im) if flip else im
    return cache[key]

img = Image.new('RGBA', (W, H), art.get('sea', '#6EC9DE'))
img.alpha_composite(raster(os.path.join(ART, 'ground.svg'), W, H))
hj = os.path.join(ROOT, '..', 'concepts/themes/community-gen/harbor-jetty-preview.json')
decks = list(art['decks']) + ([dict(json.load(open(hj)), src=hj.replace('.json', '.svg'))] if os.path.exists(hj) else [])
for d in decks:
    t = raster(src(d['src']), round(d['width'] * S), round(d['height'] * S)); img.alpha_composite(t, (round(d['x'] * S), round(d['y'] * S)))
for d in art['flats']:
    w, h = max(2, round(d['width'] * S)), max(2, round(d['height'] * S))
    t = raster(src(d['src']), w, h, d.get('flip', False))
    pos = (round(d['x'] * S), round(d['y'] * S)) if d.get('topLeft') else (round(d['x'] * S - w / 2), round(d['y'] * S - h))
    img.alpha_composite(t, (max(0, pos[0]), max(0, pos[1])))
standing = [dict(p) for p in art['props']]
boat = os.path.join(ROOT, 'public/pixi-art/boat-sail.svg')
for b in harbor['boats']:
    standing.append({'src': '/pixi-art/boat-sail.svg', 'x': b['x'], 'y': b['y'], 'width': 188, 'height': 188 * 1.0, 'anchor': {'x': .5, 'y': .82}, 'scale': 1, 'flip': b['turn'] < 0, 'boat': True})
for p in sorted(standing, key=lambda p: p['y']):
    w, h = round(p['width'] * p['scale'] * S), round(p['height'] * p['scale'] * S)
    if p.get('boat'):
        t0 = Image.open(io.BytesIO(cairosvg.svg2png(url=boat))).convert('RGBA'); h = round(w * t0.height / t0.width)
    t = raster(src(p['src']), w, h, p.get('flip', False))
    x, y = round(p['x'] * S - p['anchor']['x'] * w), round(p['y'] * S - p['anchor']['y'] * h)
    if x < 0 or y < 0: continue
    img.alpha_composite(t, (x, y))
rgb = img.convert('RGB')
small = rgb.resize((1160, round(1160 * rgb.height / rgb.width)), Image.LANCZOS); small.save(os.path.join(ROOT, '..', 'concepts/themes/work/community/preview.png'))
concept = Image.open(CONCEPT).convert('RGB'); ch = H; concept = concept.resize((round(concept.width * ch / concept.height), ch), Image.LANCZOS)
side = Image.new('RGB', (W + concept.width + 20, H), 'white'); side.paste(rgb, (0, 0)); side.paste(concept, (W + 20, 0))
side.save(OUT); rgb.save(OUT.replace('.png', '-full.png'))
print('wrote', OUT, side.size, 'props', len(art['props']))
