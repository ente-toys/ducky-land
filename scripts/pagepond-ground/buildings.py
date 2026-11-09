"""Level Inkleaf front walls, eaves and steps. Preserve book covers and shadows."""
from pathlib import Path
import xml.etree.ElementTree as ET
S=Path('scripts/pagepond-ground/data/inkleaf');A=Path('public/pixi-art/themes/library/hamlets/inkleaf')
ET.register_namespace('','http://www.w3.org/2000/svg')
replace={
'M40 139L239 128V247L45 258Z':'M40 136H239V254H40Z',
'M45 245L239 235V251L45 263Z':'M40 244H239V260H40Z',
'M43 245L238 235V242L44 253Z':'M40 244H239V251H40Z',
'M47 137V239M235 132V234':'M47 137V239M235 137V239',
'M49 146L234 135V149L49 160Z':'M49 146H234V160H49Z',
'M49 160V236M237 151V228':'M49 160V236M237 160V236',
'M116 240L179 237 185 247 121 252Z':'M116 240H179L185 250H110Z',
'M121 252L185 247V255L122 261Z':'M110 250H185V258H110Z',
'M123 259L186 253 194 263 130 270Z':'M110 258H185L194 268H101Z',
'M130 270L194 263V269L131 277Z':'M101 268H194V275H101Z',
'M50 177L493 168V362L451 383 53 382Z':'M50 173H493V382H50Z',
'M460 180L494 168V356L462 373Z':'M460 173H494V382H460Z',
}
for f in S.glob('*.svg'):
 root=ET.parse(f).getroot()
 for e in root.iter():
  d=e.get('d')
  if d in replace:e.set('d',replace[d])
 # The coloured spine pillars keep their curved tops and meet the same base.
 if f.name=='print-hall.svg':
  for e in list(root)[4:22]:
   if e.get('d') and 'Z' in e.get('d'):
    d=e.get('d');import re
    m=re.search(r'V(\d+)Q([\d.]+) (\d+) ([\d.]+) (\d+)Z',d)
    if m:
     e.set('d',d[:m.start()]+f'V370Q{m[2]} 378 {m[4]} 370Z')
 root.set('data-structure','level-fronts')
 (A/f.name).write_text(ET.tostring(root,encoding='unicode'))
