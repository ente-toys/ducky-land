# strip.py <action> <frames...> -> shots/strip_<action>.png on a light background; extra --data args via DATA env
import sys, subprocess, os
from PIL import Image
act = sys.argv[1]; frames = [int(f) for f in sys.argv[2:]]
extra = os.environ.get('DATA', '').split()
tiles = []
for f in frames:
    subprocess.run(['rive', '.', '--screenshot', f'--advance={f}', f'--data=action={act}'] + [f'--data={d}' for d in extra], capture_output=True)
    im = Image.open('build/ducky-land.png').convert('RGBA')
    bg = Image.new('RGBA', im.size, (226, 236, 250, 255)); bg.alpha_composite(im)
    tiles.append(bg.resize((im.width // 3, im.height // 3)))
w, h = tiles[0].size
s = Image.new('RGB', (w * len(tiles), h), 'white')
for i, t in enumerate(tiles): s.paste(t, (i * w, 0))
s.save(f'shots/strip_{act}.png')
