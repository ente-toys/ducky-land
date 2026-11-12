"""Port only the three live centres repaired on 6 November."""
import json
import re
import shutil
import subprocess
from pathlib import Path

SOURCE = 'd365ba4f'
OUT = Path('../concepts/themes/work/live-persp')
FILES = {
    'pink': ['back.svg', 'front-02.svg', 'front-05.svg', 'music-box.svg',
             'wind-key.svg', 'balustrade-left.svg', 'balustrade-right.svg',
             'terrace-heart-lamp.svg'],
    'waterfall': ['decal-paving.svg', 'bridge-west.svg', 'bridge-east.svg', 'bridge-south.svg'],
    'fair': ['floor.svg'],
}

def source(path):
    return subprocess.check_output(['git', 'show', f'{SOURCE}:{path}'])

def read(path):
    return json.loads(Path(path).read_bytes())

def save(path, data):
    old = Path(path).read_text()
    match = re.search(r'\n([ \t]+)"', old)
    indent = match[1] if match else None
    Path(path).write_text(json.dumps(data, indent=indent, ensure_ascii=False,
                                    separators=None if indent else (',', ':'))
                          + ('\n' if old.endswith('\n') else ''))

if (OUT / 'port-files.json').exists():
    raise SystemExit('Port already applied. Keep the original before evidence intact.')
OUT.mkdir(parents=True, exist_ok=True)
changed = []
for theme, svgs in FILES.items():
    base = Path(f'public/pixi-art/themes/{theme}')
    data = Path(f'assets/world/themes/{theme}')
    for path in [base / 'art.json', data / 'world.json', data / 'walk-world.json',
                 *sorted((base / 'centre').glob('*'))]:
        if path.is_file():
            dest = OUT / 'before' / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, dest)
    for file in svgs:
        path = base / 'centre' / file
        path.write_bytes(source(path))
        changed.append(str(path))
    path = base / 'centre/centre.json'
    current, fixed = read(path), json.loads(source(path))
    if theme == 'pink':
        for field in ['pieces', 'depthRatio', 'outerEdge', 'stairs', 'blocked', 'walkable']:
            current[field] = fixed[field]
    else:
        file = svgs[0]
        for i, piece in enumerate(current['pieces']):
            if piece['file'] == file:
                current['pieces'][i] = next(p for p in fixed['pieces'] if p['file'] == file)
    save(path, current)
    changed.append(str(path))
    path = base / 'art.json'
    art, fixed_art = read(path), json.loads(source(path))
    for layer in ['props', 'flats', 'decks']:
        if theme == 'pink':
            art[layer] = [p for p in art[layer] if not p.get('id', '').startswith('centre-')]
            art[layer] += [p for p in fixed_art[layer] if p.get('id', '').startswith('centre-')]
        else:
            for i, piece in enumerate(art[layer]):
                if piece['src'] == 'centre/' + svgs[0]:
                    art[layer][i] = next(p for p in fixed_art[layer] if p['src'] == piece['src'])
    save(path, art)
    changed.append(str(path))
    if theme == 'pink':
        fixed_world = json.loads(source(data / 'world.json'))
        for name in ['world.json', 'walk-world.json']:
            path = data / name
            world = read(path)
            world['obstacles'] = [o for o in world['obstacles'] if o.get('centre') != 'locked']
            world['obstacles'] += [o for o in fixed_world['obstacles'] if o.get('centre') == 'locked']
            if name == 'world.json':
                for field in ['blocked', 'walkable', 'stairs']:
                    world['centrePlacement'][field] = fixed_world['centrePlacement'][field]
            save(path, world)
            changed.append(str(path))

(OUT / 'port-files.json').write_text(json.dumps({'source': SOURCE, 'files': changed}, indent=2) + '\n')
print('\n'.join(changed))
