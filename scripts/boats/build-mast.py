"""Trace the nearer rig from each rear view, retaining the original SVG colours.

Run after build-depth.py with /private/tmp/boat48-311/bin/python.
The rider is on the bow side of the mast. Rear headings therefore put the rig
in front; the depth change occurs at broadside, where it clears the rider.
"""
import io, json, importlib.util
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from PIL import Image, ImageDraw
import cairosvg

ROOT = Path(__file__).resolve().parents[2]
SPIN = ROOT / 'public/pixi-art/boat/spin'
CONCEPT = ROOT.parent / 'concepts/boat-turntable'
spec = importlib.util.spec_from_file_location('front', CONCEPT / 'build-front.py')
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)
manifest = json.loads((SPIN.parent / 'views.json').read_text())
outdir = SPIN / 'rig-front'
outdir.mkdir(exist_ok=True)
proof = Image.new('RGB', (6 * 320, 4 * 280), '#c4e2f5')
for n, view in enumerate(manifest['views'].values()):
    near = 24 <= n <= 47
    if not near:
        view.pop('rigFront', None)
        continue
    src = (SPIN / f'boat-{n:02d}.svg').read_text()
    a = np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=src.encode()))).convert('RGBA'))
    solid = a[..., 3] > 127
    dark = (a[..., 0] < 125) & (a[..., 1] < 100)
    labels, count = ndi.label(solid & ~dark)
    pieces = []
    for label in range(1, count + 1):
        y, x = np.where(labels == label)
        if len(x) > 80:
            pieces.append((label, x.min(), y.min(), x.max(), y.max()))
    upper = [p for p in pieces if p[2] < 220]
    knob = min(upper, key=lambda p: p[2])
    mast_x = (knob[1] + knob[3]) / 2
    chosen = [p[0] for p in upper]
    chosen += [p[0] for p in pieces if p[2] >= 300 and p[4] < 425
               and p[3] - p[1] < 42 and abs((p[1] + p[3]) / 2 - mast_x) < 16]
    fill = np.isin(labels, chosen)
    mask = ndi.binary_fill_holes(ndi.binary_dilation(fill, iterations=6) & solid)
    mask = ndi.binary_dilation(mask, iterations=1)
    transform, path = trace.potrace_path(mask)
    head, rest = src.split('>', 1)
    inner = rest.rsplit('</svg>', 1)[0]
    svg = (f'{head}><defs><clipPath id="rig-front" clipPathUnits="userSpaceOnUse">'
           f'<path transform="{transform}" d="{path}"/></clipPath></defs>'
           f'<g clip-path="url(#rig-front)">{inner}</g></svg>')
    (outdir / f'boat-{n:02d}.svg').write_text(svg)
    view['rigFront'] = f'spin/rig-front/boat-{n:02d}.svg'
    im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode()))).convert('RGBA').resize((320, 280))
    x, y = (n - 24) % 6 * 320, (n - 24) // 6 * 280
    proof.paste(im, (x, y), im)
    ImageDraw.Draw(proof).text((x + 4, y + 4), str(n), fill='black')
manifest['note'] = '48-angle SVG spin. Fixed rider pin and clear deck seats. Hull fronts and bow heads retained. Rear views 24-47 also draw their exact mast, flag and sail cutout above the rider, with matching per-view crossfades.'
(SPIN.parent / 'views.json').write_text(json.dumps(manifest, indent=1) + '\n')
proof.save('/private/tmp/boat48-rig-fronts.png')
