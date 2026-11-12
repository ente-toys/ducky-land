"""Reproducible vector repairs, using preserved FIX6 source art. No paid calls.

Run with /private/tmp/boat48-311/bin/python scripts/boat48/repair-r2.py.
"""
import io
import json
import math
import re
import shutil
import subprocess
from pathlib import Path

import cairosvg
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[2]
SPIN = ROOT / 'public/pixi-art/boat/spin'
WORK = ROOT.parent / 'concepts/boat-turntable/spin48-work/r2'
ORIG = WORK / 'originals'
WORK.mkdir(parents=True, exist_ok=True)
if not ORIG.exists():
    shutil.copytree(SPIN, ORIG)
    shutil.copy2(SPIN.parent / 'views.json', WORK / 'views-original.json')


def inner(s):
    return s.split('>', 1)[1].rsplit('</svg>', 1)[0]


def svg(s):
    return '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="560" viewBox="0 0 640 560">' + s + '</svg>'


def pixels(s):
    return np.array(Image.open(io.BytesIO(cairosvg.svg2png(bytestring=s.encode()))).convert('RGBA'))


def trace(mask):
    Image.fromarray(np.where(mask, 0, 255).astype('uint8')).convert('1').save(WORK / 'mask.bmp')
    subprocess.run(['potrace', '-s', '--flat', '-u', '10', '-t', '2', '-o', str(WORK / 'mask.svg'), str(WORK / 'mask.bmp')], check=True)
    s = (WORK / 'mask.svg').read_text()
    transform = re.search(r'<g transform="([^"]+)"', s).group(1)
    paths = ' '.join(re.findall(r'<path d="([^"]+)"', s)).replace('\n', ' ')
    return f'<path transform="{transform}" d="{paths}"/>'


def flag(x, y, width):
    return f'''<path data-part="flag" data-width="{width:.3f}" d="M{x} {y+12}
      C{x+width*.29} {y+5} {x+width*.50} {y+44} {x+width} {y+24}
      Q{x+width*.84} {y+68} {x+width*.40} {y+54}
      Q{x+width*.13} {y+42} {x} {y+48}Z"
      fill="#ff7e32" stroke="#403414" stroke-width="7" stroke-linejoin="round"/>
    '''


repairs = {}
for n in range(33, 41):
    yaw = (n - 36) * math.pi / 24
    hx = 320 + 115 * math.sin(yaw)
    width = -180 * math.sin(yaw)
    mast_x, foot_y = 316, 400
    head = f'''<path d="M{hx-15} 304 Q{hx-8} 289 {hx-14} 273
      C{hx-24} 235 {hx+22} 226 {hx+22} 258
      Q{hx+24} 272 {hx+14} 285 L{hx+19} 304Z" fill="#fff1cc"/>
      <ellipse cx="{hx+10}" cy="258" rx="3" ry="4" fill="#403414" stroke="none"/>'''
    hull = f'''<g stroke="#403414" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
      <path d="M206 357 C207 435 231 498 310 509 C389 523 436 470 440 361Z" fill="#a8692a"/>
      <path d="M209 382 C246 427 391 444 437 384 L432 422 C397 484 262 492 219 425Z" fill="#fff1cc"/>
      <ellipse cx="322" cy="354" rx="116" ry="85" fill="#e9af60"/>
      {head}
      <ellipse cx="322" cy="351" rx="94" ry="65" fill="#a8692a"/>
      <path d="M235 350L410 350M246 379L401 379M268 404L374 404M274 300L255 403M312 291L305 415M352 294L360 410M384 310L397 381" fill="none" stroke="#936028" stroke-width="4"/>
      <path d="M245 329Q244 314 257 312L386 312Q400 315 400 334L399 350Q396 359 389 358L249 355Q239 352 245 329Z" fill="#cb8b42" stroke-width="6"/>
      <path d="M247 327Q245 317 258 315L383 315Q395 317 396 330L394 338L246 337Z" fill="#e9af60" stroke-width="5"/>
    </g>'''
    sail = '' if abs(width) < 1 else f'''<path data-part="sail" d="M320 142
      C{320+width*.44:.3f} 200 {320+width*.89:.3f} 294 {320+width:.3f} 389
      Q{320+width:.3f} 399 {320+width*.91:.3f} 397 L320 376Z"
      fill="#fff1cc" stroke="#403414" stroke-width="7" stroke-linejoin="round"/>'''
    pole = f'''<path data-part="mast" data-top="112" data-foot="400" d="M310 122
      Q307 244 309 385 L308 399 Q316 406 325 399 L324 385 Q328 237 322 122Z"
      fill="#cb8b42" stroke="#403414" stroke-width="7" stroke-linejoin="round"/>
      <path d="M319 135Q323 255 318 380" fill="none" stroke="#e9af60" stroke-width="4"/>
      <ellipse cx="316" cy="386" rx="14" ry="6" fill="#e9af60" stroke="#403414" stroke-width="6"/>
      <ellipse cx="316" cy="112" rx="18" ry="14" fill="#cb8b42" stroke="#403414" stroke-width="7"/>'''
    rig = flag(mast_x, 112, -82) + sail + pole
    (SPIN / f'boat-{n:02d}.svg').write_text(svg(hull + rig))
    (SPIN / f'rig-front/boat-{n:02d}.svg').write_text(svg(rig))
    repairs[n] = {'mastTop': [316, 112], 'mastFoot': [316, foot_y], 'sailWidth': width}

for n, width in {18: 58, 19: 9, 20: -9, 21: -58, 43: -58, 44: -9, 45: 9, 46: 58}.items():
    src = (ORIG / f'boat-{n:02d}.svg').read_text()
    a = pixels(src).astype(int)
    r, g, b, alpha = [a[..., k] for k in range(4)]
    yy = np.arange(560)[:, None]
    orange = (r > 225) & (g < 155) & (r-g > 95) & (b < 100) & (alpha > 100) & (yy < 245)
    dark = (r < 180) & (g < 160) & (alpha > 0)
    cut = ndi.binary_fill_holes(orange | (ndi.binary_dilation(orange, iterations=25) & dark))
    brown = (r > 135) & (r < 225) & (g > 80) & (g < 180) & (b < 100) & (alpha > 100) & (yy < 126)
    labels, _ = ndi.label(brown)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    cy, cx = np.where(labels == sizes.argmax())
    x, y = float(cx.mean()), float(cy.mean())
    xx = np.arange(640)[None, :]
    cut = ndi.binary_dilation(cut, iterations=3)
    cut &= ~(((xx-x)**2/22**2 + (yy-y)**2/19**2) < 1)
    cut &= ~((abs(xx-x) < 11) & (yy > y))
    strip = np.broadcast_to((yy >= y+12) & (yy <= 250), (560, 640)).copy()
    strip &= ~(((xx-x)**2/22**2 + (yy-y)**2/19**2) < 1)
    cut |= strip
    erase = trace(cut)
    defs = f'<defs><mask id="remove-flag" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="560"><rect width="640" height="560" fill="white"/><g fill="black">{erase}</g></mask></defs>'
    side = 1 if n < 24 else -1
    cream = (r > 220) & (g > 200) & (b > 150) & (alpha > 128)
    def band(row):
        xs = np.where(cream[row] & ((np.arange(640)-x)*side > 10))[0]
        pieces = np.split(xs, np.where(np.diff(xs) > 1)[0]+1)
        return max(pieces, key=len)
    def edge(row):
        xs = band(row)
        return float(xs.max() if side > 0 else xs.min())
    end = edge(250) + side*3
    inner_end = float(band(250).min() if side > 0 else band(250).max()) - side*3
    slope = (edge(260)-edge(240))/20
    start = x + side*9
    top = y + 25
    corner = f'''<path d="M{start:.3f} {top:.3f}
      C{start+(end-start)*.35:.3f} {top+35:.3f} {end-slope*35:.3f} 215 {end:.3f} 250
      L{end+side*1.5:.3f} 252 L{inner_end:.3f} 252
      C{inner_end:.3f} 215 {start:.3f} {top+35:.3f} {start:.3f} {top:.3f}Z" fill="#fff1cc"/>
      <path d="M{start:.3f} {top:.3f}
      C{start+(end-start)*.35:.3f} {top+35:.3f} {end-slope*35:.3f} 215 {end:.3f} 250
      M{start:.3f} {top:.3f}C{start:.3f} {top+35:.3f} {inner_end:.3f} 215 {inner_end:.3f} 250"
      fill="none" stroke="#403414" stroke-width="7" stroke-linecap="round"/>'''
    wood = (r > 135) & (r < 225) & (g > 80) & (g < 180) & (b < 100) & (alpha > 128)
    wood_x = np.where(wood[252] & (abs(np.arange(640)-x) < 40))[0]
    left, right = float(wood_x.min()-2), float(wood_x.max()+2)
    pole_top = y+13
    upper_pole = f'''<path d="M{x-10:.3f} {pole_top:.3f}L{left:.3f} 253H{right:.3f}L{x+9:.3f} {pole_top:.3f}Z" fill="#cb8b42"/>
      <path d="M{x-10:.3f} {pole_top:.3f}L{left:.3f} 250M{x+9:.3f} {pole_top:.3f}L{right:.3f} 250"
      fill="none" stroke="#403414" stroke-width="6" stroke-linecap="round"/>
      <path d="M{x+4:.3f} {pole_top+12:.3f}L{right-4:.3f} 250" fill="none" stroke="#e9af60" stroke-width="3"/>'''
    replacement = corner + flag(round(x, 3), round(y, 3), width) + upper_pole
    (SPIN / f'boat-{n:02d}.svg').write_text(svg(defs + '<g mask="url(#remove-flag)">' + inner(src) + '</g>' + replacement))
    if n >= 24:
        old_rig = (ORIG / f'rig-front/boat-{n:02d}.svg').read_text()
        (SPIN / f'rig-front/boat-{n:02d}.svg').write_text(svg(defs + '<g mask="url(#remove-flag)">' + inner(old_rig) + '</g>' + replacement))
    repairs[n] = {'flagWidth': width, 'cap': [x, y]}

manifest = json.loads((WORK / 'views-original.json').read_text())
meta = json.loads((ORIG / 'frames.json').read_text())
for n in range(33, 41):
    u = (n - 32) / 9
    seat = [round(-22 + (30.7+22)*u, 3), round(-30 + 2.7*u, 3)]
    manifest['views'][f'f{n:02d}']['seat'] = seat
    meta['frames'][n]['riderSeat'] = seat

affected = sorted(repairs)
for n in affected:
    src = (SPIN / f'boat-{n:02d}.svg').read_text()
    if 33 <= n <= 40:
        seat_y = manifest['views'][f'f{n:02d}']['seat'][1]
        foot = manifest['anchor'][1]*560 + seat_y*640/manifest['width']
        paths = f'<path d="M0 {foot+5:.3f}H640V560H0Z"/>'
        paths += trace(pixels((SPIN / f'rig-front/boat-{n:02d}.svg').read_text())[..., 3] > 20)
    else:
        old = (ORIG / f'front/boat-{n:02d}.svg').read_text()
        paths = re.search(r'<clipPath[^>]*>(.*?)</clipPath>', old, re.S).group(1)
        if n >= 24:
            paths += trace(pixels((SPIN / f'rig-front/boat-{n:02d}.svg').read_text())[..., 3] > 20)
    front = f'<defs><clipPath id="front" clipPathUnits="userSpaceOnUse">{paths}</clipPath></defs><g clip-path="url(#front)">{inner(src)}</g>'
    (SPIN / f'front/boat-{n:02d}.svg').write_text(svg(front))

manifest['transition'] = 'cut'
manifest['note'] = '48 opaque 7.5-degree views. Seat-pinned roll, per-view hull and rear-rig depth. Clean cuts avoid dissolving mismatched illustrated contours.'
(SPIN.parent / 'views.json').write_text(json.dumps(manifest, indent=1) + '\n')
(SPIN / 'frames.json').write_text(json.dumps(meta, indent=1) + '\n')
(WORK / 'geometry.json').write_text(json.dumps(repairs, indent=2) + '\n')
print('Repaired 33-40 mast/deck projection, narrowing flags and exact foregrounds.')
