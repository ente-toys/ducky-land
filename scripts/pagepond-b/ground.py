exec(open('scripts/pagepond-b/filter.py').read().split('keep=[]')[0])
import xml.etree.ElementTree as ET,copy
A=Path('public/pixi-art/themes/library');S=Path('scripts/pagepond-ground')
def svg(g):
 ps=[g]if g.geom_type=='Polygon'else list(g.geoms)
 return ''.join('M'+'L'.join(f'{x:.2f} {y:.2f}'for x,y in r.coords)+'Z'for p in ps for r in [p.exterior,*p.interiors])
routes=read(S/'sampled-routes.json');routes=[q for q in routes if q['id']!=r['id']]+[{'id':r['id'],'width':104,'samples':r['points']}];s['courts']=[q for q in s['courts']if q['id']!=apron['id']]+[{'id':apron['id'],'d':svg(shape(apron))}];merged=unary_union([LineString(q['samples']).buffer(q['width']/2,quad_segs=12) for q in routes]+[path(c['d']) for c in s['courts']])
fillet=merged.buffer(65,quad_segs=12).buffer(-65,quad_segs=12).difference(merged)
rests=unary_union([affinity.scale(Point(p['x'],p['y']-6).buffer(1,24),p['r']+18,58)for p in read(S/'data/current-sleepers.json')]);contacts=unary_union([shape(o)for o in w['obstacles']]).union(rests)
surface=merged.union(fillet.difference(contacts.buffer(8))).intersection(surface)
ns='http://www.w3.org/2000/svg';ET.register_namespace('',ns)
art=read(A/'art.json');mound=b['hill']['ground'];art['flats']=[p for p in art['flats']if p.get('id')!=mound['id']]
for t in art['ground']['tiles']:
 file=A/t['src'];root=ET.parse(file).getroot()
 for parent in root.iter():
  for child in list(parent):
   if child.get('data-pagepond-terrain')=='stargazing-mound':parent.remove(child)
 for parent in root.iter():
  for e in list(parent):
   if e.get('data-pagepond-paths')=='home-system':
    from shapely.geometry import box
    e.set('d',svg(surface.intersection(box(t['x']-8,t['y']-8,t['x']+t['width']+8,t['y']+t['height']+8))))
    if t['x']<10050 and t['x']+t['width']>9350 and t['y']<3440 and t['y']+t['height']>3030:
     g=ET.Element('{'+ns+'}g',{'data-pagepond-terrain':'stargazing-mound','transform':'translate(9350 3030)'})
     for child in ET.parse('public'+mound['src']).getroot():g.append(copy.deepcopy(child))
     parent.insert(list(parent).index(e),g)
 file.write_text(ET.tostring(root,encoding='unicode'))
file=A/'pagepond/outer-source.svg';root=ET.parse(file).getroot()
for e in root.iter():
 if e.get('data-pagepond-paths'):e.set('d',svg(surface))
file.write_text(ET.tostring(root,encoding='unicode'))
routes=read(S/'sampled-routes.json');routes=[q for q in routes if q['id']!=r['id']];routes.append({'id':r['id'],'width':104,'samples':r['points']});s['d']=svg(surface);s['rings']=[list(r.coords)for p in ([surface]if surface.geom_type=='Polygon'else surface.geoms)for r in [p.exterior,*p.interiors]];s['courts']=[q for q in s['courts']if q['id']!=apron['id']];s['courts'].append({'id':apron['id'],'d':svg(shape(apron))})
for p,j in [(A/'art.json',art),(S/'surface.json',s),(S/'sampled-routes.json',routes)]:p.write_text(json.dumps(j,separators=(',',':'))+'\n')
(S/'path-surface.svgfrag').write_text('<path data-pagepond-paths="home-system" fill="#FFF0C7" fill-rule="evenodd" d="'+svg(surface)+'"/>')
for f in ['scripts/pagepond/layout.json','scripts/pagepond-hamlets/placement.json','scripts/bigger-library/plan.json']:
 j=read(f);j.update(floor=s['d'],floorRings=s['rings'],outerFloorRings=s['rings']);key='links' if 'pagepond-hamlets'in f else 'roads';j[key]=[q for q in j[key]if q['id']!=r['id']];j[key].append({'id':r['id'],'width':104,'points':r['points'],'kind':'home-system'});Path(f).write_text(json.dumps(j,separators=(',',':'))+'\n')
print('Merged hill apron/lane into single path surface; mound below paint')
