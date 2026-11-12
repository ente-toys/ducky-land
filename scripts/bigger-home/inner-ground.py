import xml.etree.ElementTree as E
import json
from pathlib import Path
E.register_namespace('','http://www.w3.org/2000/svg')
a=json.loads(Path('src/pixi/art-manifest.json').read_text())
for t in a['ground']['tiles']:
 root=E.parse('public'+t['src']).getroot()
 for c in list(root):
  if c.get('data-name') in ['Sea ripple','Shallow coast water','Round 4 wet coasts']:root.remove(c)
 out=Path('public/pixi-art/home-expansion')/Path(t['src']).name
 E.ElementTree(root).write(out,encoding='unicode')
