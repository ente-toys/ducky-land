"""Read existing definitions/artwork; never imports or runs the legacy generator."""
import ast
import json
import xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
source = ast.parse((ROOT / 'rive/world.py').read_text())
paths = next(ast.literal_eval(n.value) for n in source.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'paths' for t in n.targets))
ground = ET.parse(ROOT / 'rive/island.rml').find(".//Artboard[@name='Island Ground']")
names = {'Pond lily', 'Race marker', 'Plaza cobble', 'Beach pebble', 'Grass tuft', 'Meadow patch'}
decor = []
for n in ground:
    if n.get('name') not in names:
        continue
    item = {'kind': n.get('name'), 'x': float(n.get('x', 0)), 'y': float(n.get('y', 0))}
    if item['kind'] == 'Pond lily':
        item['flower'] = any('Lotus' in c.get('name', '') for c in n)
    if item['kind'] == 'Meadow patch':
        vertices = list(n.find('PointsPath'))
        item['rx'] = max(abs(float(v.get('x', 0))) for v in vertices)
        item['ry'] = max(abs(float(v.get('y', 0))) for v in vertices)
    decor.append(item)
data = {
    'source': ['rive/world.py', 'rive/island.rml#Island Ground'],
    'paths': paths,
    'hill': {'x': 2910, 'y': 1120, 'rx': 510, 'ry': 310, 'height': .65},
    'stairs': {'x': 2920, 'y': 1400, 'count': 9, 'step': 24},
    'beach': {'x': 4770, 'y': 2660, 'rx': 490, 'ry': 555},
    'plaza': {'x': 2820, 'y': 2390, 'rx': 725, 'ry': 505},
    'raceTrack': {'x': 4140, 'y': 1520, 'rx': 670, 'ry': 445},
    'clearing': {'x': 1400, 'y': 1770, 'rx': 445, 'ry': 340},
    'decorations': decor,
}
(ROOT / 'src/three/scene-manifest.json').write_text(json.dumps(data, indent=2) + '\n')
print(f'Extracted {len(paths)} paths and {len(decor)} existing decorations')
