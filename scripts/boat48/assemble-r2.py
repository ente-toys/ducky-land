from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parent / 'concepts/boat-turntable'
P = OUT / 'spin48-work/r2'
BG = '#c4e2f5'


def read(name):
    return Image.open(P / f'{name}.png').convert('RGB')


def cell(name, label, size=300):
    im = read(name).crop((40, 40, 440, 440)).resize((size, size), Image.Resampling.LANCZOS)
    ImageDraw.Draw(im).text((8, 6), label, fill='#243520')
    return im


sheet = Image.new('RGB', (240*8, 240*6), BG)
for n in range(48):
    sheet.paste(cell(f'frame-{n:02d}', f'{n:02d}', 240), (n % 8*240, n // 8*240))
sheet.save(OUT / 'spin48-r2.png')

items = [(f'frame-{n:02d}', f'{n:02d}') for n in [18, 19, 20, 21, 43, 44, 45, 46, 33, 34, 35, 36, 37, 38, 39, 40]]
items += [('rear-mid-36', '30 to 31, one outline'), ('rear-mid-37', '37 to 38, one outline')]
details = Image.new('RGB', (300*6, 300*3), BG)
for i, (name, label) in enumerate(items):
    details.paste(cell(name, label), (i % 6*300, i // 6*300))
details.save(OUT / 'spin48-r2-details.png')

frames, durations = [], []
for n in range(0, 480, 2):
    im = read(f'motion-{n:03d}').crop((30, 40, 450, 430))
    label = 'Slow turn, roll + bob ON' if n < 360 else 'Fast 360, roll + bob ON'
    ImageDraw.Draw(im).text((8, 6), label, fill='#243520')
    frames.append(im); durations.append(67 if n < 360 else 33)
for k in range(60):
    im = read(f'settle-{k:02d}').crop((30, 40, 450, 430))
    ImageDraw.Draw(im).text((8, 6), 'Fast turn settles', fill='#243520')
    frames.append(im); durations.append(33)
palette = sheet.quantize(colors=192)
frames = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in frames]
frames[0].save(OUT / 'spin48-r2.gif', save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False, disposal=2)

for title, indices in [('slow', range(0, 360, 30)), ('fast', range(360, 480, 10))]:
    contact = Image.new('RGB', (300*6, 300*2), BG)
    for j, n in enumerate(indices):
        contact.paste(cell(f'motion-{n:03d}', f'{title} {n}'), (j % 6*300, j // 6*300))
    contact.save(P / f'{title}-motion-check.png')
proofs = json.loads((P / 'runtime.json').read_text())
motion = json.loads((P / 'motion.json').read_text())
settling = json.loads((P / 'settling.json').read_text())
checks = {
    'renderer': 'Production rigs, Pixi CanvasRenderer with native Canvas2D',
    'settledViews': len(proofs), 'motionSamples': len(motion),
    'fastSpinDistinctViews': len({v['key'] for p in motion[360:]+settling for v in p['views']}),
    'maxActiveViews': max(len(p['views']) for p in motion),
    'minWeight': min(v['weight'] for p in motion for v in p['views']),
    'maxWeightSumError': max(abs(sum(v['weight'] for v in p['views'])-1) for p in motion),
    'maxHorizontalPinError': max(abs(p['pin'][0]-240) for p in motion),
    'maxRiderPinError': max(max(abs(a-b) for a, b in zip(p['pin'], p['rider'])) for p in motion),
    'rollRange': [min(p['roll'] for p in motion), max(p['roll'] for p in motion)],
    'bobRange': [min(p['bob'] for p in motion), max(p['bob'] for p in motion)],
    'maxFilters': max(p['filters'] + p['frontFilters'] for p in motion),
    'finalView': settling[-1]['views'],
}
(P / 'checks.json').write_text(json.dumps(checks, indent=2)+'\n')
assert checks['maxActiveViews'] == 1
assert checks['maxRiderPinError'] == checks['maxWeightSumError'] == 0
assert checks['fastSpinDistinctViews'] == 48
print(json.dumps(checks, indent=2))
