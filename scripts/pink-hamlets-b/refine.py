import json,re,shutil
from pathlib import Path
A=Path('public/pixi-art/themes/pink');R=Path('/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/pink-fix/svg')
art=json.load(open(A/'art.json'));world=json.load(open('assets/world/themes/pink/world.json'));walk=json.load(open('assets/world/themes/pink/walk-world.json'))
for name,file in [('teacup','square-and-lane.svg'),('tutu-tides','dance-square.svg')]:
 L=json.load(open(R/name/'layout.json'));o=next(o for o in L['objects'] if o['file']==file);k=1.68 if name=='teacup' else 1.4;at=[6700,4740] if name=='teacup' else [4050,6000];bp=[768,512] if name=='teacup' else [768,530]
 s=(R/name/file).read_text();s=re.sub(r'#ffe9c7|#ffe8c5|#ffe6be|#ffebcc|#ffe9c8','#FBE6C8',s,flags=re.I);(A/'hamlets'/name/file).write_text(s)
 if name=='teacup':s=re.sub(r'<path[^>]*d="M906-10[^"]*"[^>]*/>','',s);(A/'hamlets'/name/file).write_text(s)
 vb=list(map(float,re.search('viewBox="([^"]+)"',s)[1].split()));w=o['width']*k
 art['flats'].insert(2,dict(id='hamlet-'+name+'-court',src=f'hamlets/{name}/{file}',x=at[0]+(o['x']-bp[0])*k,y=at[1]+(o['y']-bp[1])*k,width=w,height=w*vb[3]/vb[2],anchor={'x':.5,'y':1},resolution=1.5))
# The tailor's tools are part of its open stage. Register their SVG pieces inside the stage's vector coordinate system.
L=json.load(open(R/'tutu-tides/layout.json'));stage=next(o for o in L['objects'] if o['id']=='tutu-tailor-workshop');stageSvg=(R/'tutu-tides'/stage['file']).read_text();extras=[];ids=[]
for o in L['objects']:
 if o['id'] not in ['sewing-machine-table','tutu-dress-form','ribbon-spools']:continue
 ids.append('hamlet-tutu-tides-'+o['id']);s=(R/'tutu-tides'/o['file']).read_text();vb=list(map(float,re.search('viewBox="([^"]+)"',s)[1].split()));h=o['width']*vb[3]/vb[2]
 x=o['x']-o['width']/2-(stage['x']-stage['width']/2);y=o['y']-h-(stage['y']-365)
 extras.append(re.sub(r'<svg\b[^>]*>',f'<svg x="{x}" y="{y}" width="{o["width"]}" height="{h}" viewBox="'+ ' '.join(map(str,vb))+'">',s,count=1))
(A/'hamlets/tutu-tides/tutu-tailor-workshop.svg').write_text(stageSvg.replace('</svg>',''.join(extras)+'</svg>'))
for d in [art,world]:d['props']=[p for p in d['props'] if p.get('id') not in ids]
for d in [world,walk]:d['obstacles']=[p for p in d['obstacles'] if p.get('name') not in ids]
# Keep the approved short, south-facing dock registered to the court.
p=next(p for p in art['props'] if p['id']=='hamlet-teacup-quay-dock')
p['shadow']=False
for d in [world,walk]:d['obstacles']=[o for o in d['obstacles'] if o.get('name')!=p['id']]
for f,d in [(A/'art.json',art),(Path('assets/world/themes/pink/world.json'),world),(Path('assets/world/themes/pink/walk-world.json'),walk)]:f.write_text(json.dumps(d,indent=1)+'\n')
