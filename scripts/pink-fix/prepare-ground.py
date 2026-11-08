"""Package hand SVG drawings, remove superseded moat/road layers. No art generation."""
import xml.etree.ElementTree as E,subprocess,re
from pathlib import Path
E.register_namespace('', 'http://www.w3.org/2000/svg')
A=Path('public/pixi-art/themes/pink'); NS='{http://www.w3.org/2000/svg}'
base=lambda p:subprocess.check_output(['git','show','96f36ed5:'+str(p)],text=True)
coast=E.parse('scripts/pink-fix/art/coast.svg').getroot()[0].get('d')
paths=E.parse('scripts/pink-fix/art/paths.svg').getroot()
for p in (A/'expansion/tiles').glob('r*-c*.svg'):
 text=base(p); i=text.index('fill="#6ec9de"');text=text[:text.rfind('<path',0,i)]+'</g></svg>'
 root=E.fromstring(text)
 old=next(e for e in root.iter(NS+'clipPath') if e.get('id')=='new-land')[0].get('d')
 for e in root.iter(NS+'path'):
  if e.get('d')==old:e.set('d',coast)
 for parent in root.iter():
  for e in list(parent):
   # Retire the road polygon stack, grey ruts, detached shore dots and the old cut-out south apron.
   if (e.get('fill') in ['#72993e','#b09d68','#f3d79f','#e9d1a2'] or e.get('stroke') in ['#b69b70','#c7a975'] or e.get('stroke')=='#b9b78b' or e.get('d','').startswith('M3100 5900')):parent.remove(e)
 # Centre's exact path stack, soft ink and tan shoulders; one 160-wide walking surface everywhere.
 # Paths composite after the retained centre tiles in shore-source.svg.
 coastSand=E.Element(NS+'path',{'d':coast,'fill':'none','stroke':'#FCEBD6','stroke-width':'92','stroke-linejoin':'round'})
 root.insert(3,coastSand)
 # The pink band sits inside the cream sand shoulder.
 root.insert(4,E.Element(NS+'path',{'d':coast,'fill':'#8FC63C','stroke':'#F9D3DC','stroke-width':'78','stroke-linejoin':'round'}))

 # Retire the old empty pads, planting rows and stepping stones from the expansion recipe.
 for parent in root.iter():
  for e in list(parent):
   if e.get('fill','').lower() in ['#a4cd4c','#b5d953','#accb58','#aad24b','#b9956e','#f7dfaf','url(#rose-grass)'] or e.get('stroke','').lower() in ['#60843d','#668d3c','#bd9d73'] or (e.tag==NS+'circle' and (e.get('fill','').lower()=='#f5a3c7' or e.get('stroke','').lower()=='#cd7ca6')) or (e.tag in [NS+'ellipse',NS+'circle'] and e.get('stroke','').lower()=='#c0aa85'):parent.remove(e)
 p.write_text(E.tostring(root,encoding='unicode'))
# Remove only stranded beach/coast art. Keep the centre's gardens and original path stack.
for p in (A/'expansion/tiles').glob('original-*.svg'):
 root=E.fromstring(base(p))
 for parent in root.iter():
  for e in list(parent):
   if e.get('data-name') in ['Sandy coast','Islet sand','Pink beach','Round 4 two-tone lawns','Market row (open stall row)']:parent.remove(e)
   elif e.get('data-name')=='Continuous footpaths':parent.remove(e)
 # New lawn beneath the former beach, whose original grass was clipped out at the V.
 bg=E.Element(NS+'path',{'d':'M2700 3800 C3200 3650 4800 3650 5350 4100 C5400 4500 4900 5050 4200 5320 C3700 5400 2850 4750 2650 4400 C2520 4150 2580 3900 2700 3800 Z','fill':'#8FC63C'})
 root.insert(0,bg)
 p.write_text(E.tostring(root,encoding='unicode'))
