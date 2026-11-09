exec(open('scripts/pagepond-b/filter.py').read().split('surface=path')[0])
import xml.etree.ElementTree as ET
surface=path(s['d']);issues=[];art=read('public/pixi-art/themes/library/art.json');bodies=read('scripts/pagepond-ground/data/current-sleepers.json')
for p in art['props']:
 if p['id'].startswith('page-b-') and p.get('footprint') and shape(p['footprint']).intersects(surface.buffer(16)):issues.append({'type':'new-contact-path','id':p['id']})
for i,p in enumerate(bodies):
 rest=affinity.scale(Point(p['x'],p['y']-6).buffer(1,48),p['r']*.9,min(34,max(22,p['r']*.42)))
 if rest.intersects(surface.buffer(16)) and p not in b['sleepers']['keepResolved']:issues.append({'type':'sleeper-path','bed':i,'pose':p['pose']})
colours=set()
for t in art['ground']['tiles']:
 root=ET.parse('public/pixi-art/themes/library/'+t['src']).getroot();pa=[e for e in root.iter()if e.get('data-pagepond-paths')];assert len(pa)==1
 for e in pa:colours.add(e.get('fill'));assert not any(k in e.attrib for k in ['stroke','opacity','fill-opacity'])
assert len(colours)==1
out={'issues':issues,'pathColours':list(colours),'pathColourCount':len(colours),'sleepers':len(bodies),'plantsAdded':len([p for p in art['props']if p.get('zone')=='pagepond-outer-planting']),'kites':len(art['kites'])}
Path('scripts/pagepond-b/verification.json').write_text(json.dumps(out,indent=2)+'\n');print(out)
if issues:raise SystemExit(1)
