"""Inventory every deck and its rail pieces against the authored water geometry.

This also reports original-centre conflicts rather than labelling dry paving water.
Run with the same Shapely environment as communities.py.
"""
import json
from pathlib import Path
from shapely.geometry import Point, LineString

source=Path('scripts/bigger-canal/communities.py').read_text()
scope={}
exec(source.split("origin={'x'")[0],scope)
water,dry,coast=(scope[key] for key in ('water','dry','coast'))
art=json.loads(Path('public/pixi-art/themes/canal/art.json').read_text())
world=json.loads(Path('rive/web/themes/canal/world.json').read_text())
rows=[]
specs=[
 ('West heart bridge','bridge-west.svg',[1860,3200],[2600,3200]),
 ('East heart bridge','bridge-east.svg',[5400,3200],[6140,3200]),
 ('North heart bridge','bridge-north.svg',[4000,1660],[4000,2220]),
 ('East fishing jetty','jetty-east.svg',[7240,2830],[7740,2830]),
 ('Southwest fishing jetty','jetty-southwest.svg',[2600,5010],[2440,5530]),
 ('Basin fishing jetty','jetty-basin.svg',[4800,3950],[5050,4300]),
]
for p in world['walkways']:
 if p.get('name'):specs.append((p['name'],'communities/'+p['name']+'.svg',p['a'],p['b']))
specs.append(('Outer quay jetty','communities/outer-quay-jetty.svg',[-2190,2400],[-2450,2400]))
for label,key,y in [('Northwest','north-west',2844),('Southwest','south-west',3796),('Northeast','north-east',2844),('Southeast','south-east',3796)]:
 x=3150 if 'west' in key else 4850
 specs.append((label+' centre bridge','centre/bridge-'+key+'-deck.svg',[x-212.5,y],[x+212.5,y]))
for name,src,a,b in specs:
 line=LineString([a,b]);points=[line.interpolate(i/100,normalized=True) for i in range(101)]
 wet=[p for p in points if water.contains(p) or not coast.contains(p)]
 rows.append({'name':name,'src':src,'axis':[a,b],'waterSamples':len(wet),'samples':101,
  'before':'over water' if wet else 'dry paving in original centre',
  'after':'over water' if wet else 'preserved original, awaiting conflict decision',
  'waterPoint':list(wet[len(wet)//2].coords)[0] if wet else None,
  'pieces':[p.get('id',p['src']) for group in ('decks','flats','props') for p in art.get(group,[]) if p['src']==src or ('centre/bridge-' in src and p['src'].startswith(src.removesuffix('-deck.svg')))]})
board=next(p for p in art['flats'] if p['src']=='centre/back-boardwalk.svg')
rows.append({'name':'Centre ring boardwalk','src':board['src'],'before':'dry paving in original centre',
 'after':'preserved original, awaiting conflict decision','pieces':[board['id']],
 'note':'Raised timber ring around the original fountain plaza, visibly over paving. No claim of water below it.'})
inventory=[p.get('id',p['src']) for group in ('decks','flats','props') for p in art.get(group,[]) if any(k in p['src'] for k in ('bridge','jetty','boardwalk','pier'))]
covered=[piece for row in rows for piece in row['pieces']]
assert set(inventory)==set(covered),(set(inventory)-set(covered),set(covered)-set(inventory))
result={'structures':len(rows),'sprites':len(inventory),'overWater':sum(r['after']=='over water' for r in rows),'preservationConflicts':sum(r['after']!='over water' for r in rows),'bridges':rows}
Path('scripts/bigger-canal/bridge-audit.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
