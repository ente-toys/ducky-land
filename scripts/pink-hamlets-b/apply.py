import json,re,shutil
from pathlib import Path
ROOT=Path('/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/pink-fix')
A=Path('public/pixi-art/themes/pink');D=Path('assets/world/themes/pink')
read=lambda p:json.loads(Path(p).read_text())
def write(p,d):Path(p).write_text(json.dumps(d,indent=2)+'\n')
art=read(A/'art.json');world=read(D/'world.json');walk=read(D/'walk-world.json');report={}
for name in ['teacup','tutu-tides']:
 plan=read(ROOT/'plan'/f'{name}.json');L=read(ROOT/'svg'/name/'layout.json');cfg=plan['target']['map'];cfg=dict(cfg,at=[6700,4740]) if name=='teacup' else cfg;k=cfg['k'];W=lambda x,y:[round(cfg['at'][0]+(x-cfg['bp'][0])*k,2),round(cfg['at'][1]+(y-cfg['bp'][1])*k,2)]
 ids=set(plan['remove'].get('propIds',plan['remove'].get('artPropIds',[])))|set(plan['remove'].get('worldPropIds',[]))
 for d in [art,world]:d['props']=[p for p in d['props'] if p.get('id') not in ids and not p.get('id','').startswith('hamlet-'+name+'-')]
 obs=plan['remove'].get('worldObstacles',plan['remove'].get('obstacles',[]));names={o.get('value',o).get('name') for o in obs}
 for d in [world,walk]:d['obstacles']=[o for o in d['obstacles'] if o.get('name') not in names and o.get('name') not in ids]
 flats=plan['remove']['flats'];art['flats']=[f for f in art['flats'] if not any(all(f.get(key)==v for key,v in rm.items() if key!='index') for rm in flats)]
 for r in plan['remove']['paths']:
  for i in reversed(range(len(world['paths']))):
   if world['paths'][i]==r['points'] and 'replacement' not in r:
    world['paths'].pop(i);world['pathWidths'].pop(i)
  if 'replacement' in r:
   for i,p in enumerate(world['paths']):
    for j in range(len(p)-len(r['points'])+1):
     if p[j:j+len(r['points'])]==r['points']:world['paths'][i]=p[:j]+r['replacement']+p[j+len(r['points']):]
 dest=A/'hamlets'/name;dest.mkdir(parents=True,exist_ok=True)
 rejected=[];placed=[]
 for o in sorted(L['objects'],key=lambda o:o['drawOrder']):
  file=o['file'];s=(ROOT/'svg'/name/file).read_text()
  if re.search(r'<image|base64|gradient',s,re.I) or s.count('<path')>600:raise ValueError('Rejected '+file)
  if re.search('shore|lawn|square-and-lane|dance-square',file):continue
  vb=list(map(float,re.search('viewBox="([^"]+)"',s)[1].replace(',',' ').split()));w=o['width']*k;h=w*vb[3]/vb[2];x,y=W(o['x'],o['y'])
  shutil.copyfile(ROOT/'svg'/name/file,dest/file)
  p=dict(id='hamlet-'+name+'-'+o['id'],name=o['id'],asset=o['id'],src=f'hamlets/{name}/{file}',x=x,y=y,width=round(w,2),height=round(h,2),scale=1,anchor={'x':.5,'y':1},zone=plan.get('existingCommunityId','tutu'),resolution=1.5)
  flat=bool(re.search(r'^(grass|pebble|terrace|shell|fallen-petal|tulip)|roses|bunting|blanket|rope-fence',file))
  if flat:art['flats'].append(p);continue
  building=bool(re.search(r'house|cottage|cafe|workshop|cake-stall',file));tree=bool(re.search(r'oak|blossom',file))
  rx=w*(.39 if building else .085 if tree else .27);ry=min(65,w*.13) if building else 13 if tree else min(24,w*.12)
  fp=dict(name=p['id'],x=x,y=round(y-ry-8,2),rx=round(rx,2),ry=round(ry,2))
  p['footprint']=fp
  for d in [world,walk]:d['obstacles'].append(fp)
  art['props'].append(p);world['props'].append(p);placed.append(p)
 shapes=[]
 for path in L['paths']:
  if name=='teacup' and path['id']=='north-lane':continue
  pts=[W(*q) for q in path['polygon']];d='M'+' L'.join(f'{x},{y}' for x,y in pts)+' Z';shapes.append(f'<path d="{d}"/>')
 for join in plan['pathJoins']:
  if name=='tutu-tides' and join['id']=='north-to-centre':continue
  pts=join.get('connectorWorldPoints',join.get('connectorPoints'));pts=[[6700+(q[0]-8480),4740+(q[1]-1840)] for q in pts] if name=='teacup' else pts;width=join.get('width',join.get('widthWorld',160))
  if name=='tutu-tides' and join['id']=='west-to-main-loop':pts=[W(20,415),*pts[1:]]
  if name=='tutu-tides' and join['id']=='north-to-centre':pts=[[4000,4900],[4670,5220],[4800,5580],W(1050,600)]
  if name=='teacup':pts=[W(900,330),[7060,4230],[7100,4070]]
  world['paths'].append(pts);world['pathWidths'].append(width)
  d='M'+' L'.join(f'{x},{y}' for x,y in pts);shapes.append(f'<path d="{d}" fill="none" stroke="#FBE6C8" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>')
 frame=W(0,0)+W(1536,1024);x0,y0,x1,y1=frame
 x0-=500;y0-=500;x1+=500;y1+=500
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1-x0} {y1-y0}"><g fill="#FBE6C8" stroke="#FBE6C8" stroke-width="3" stroke-linejoin="round">'+''.join(shapes)+'</g></svg>'
 (dest/'paths.svg').write_text(svg)
 art['flats'].insert(0,dict(id='hamlet-'+name+'-paths',src=f'hamlets/{name}/paths.svg',x=x0,y=y0,width=x1-x0,height=y1-y0,topLeft=True,resolution=1))
 sx,sy=W(L['sleepers'][0]['x'],L['sleepers'][0]['y']);world['sleepSpots']['wing'][-1 if name=='teacup' else -2]=[sx,sy,False]
 report[name]={'props':len(placed),'sleep':[sx,sy],'map':cfg}
write(A/'art.json',art);write(D/'world.json',world);write(D/'walk-world.json',walk);write('scripts/pink-hamlets-b/placement.json',report)
print(report)
