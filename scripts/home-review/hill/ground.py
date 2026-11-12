import json,re,sys
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Polygon,LineString
from shapely.ops import unary_union
E=json.loads(Path('src/pixi/home-expansion.json').read_text())
previous=Path('scripts/home-review/path-surface.svgfrag').read_text()
frag=Path('scripts/home-review/hill/base-path.svgfrag').read_text()
d=re.findall(r'<path d="([^"]+)"',frag)[-1]
rings=[]
for part in d.split('M')[1:]:
 pts=[tuple(map(float,q.split(','))) for q in part.rstrip('Z ').split('L')]
 rings.append(Polygon(pts))
base=rings[0]
for p in rings[1:]:base=base.symmetric_difference(p)
def sample(p):
 out=[]
 import math
 for i in range(len(p)-1):
  a=p[max(0,i-1)];b=p[i];c=p[i+1];d=p[min(len(p)-1,i+2)]
  for j in range(max(4,math.ceil(math.dist(b,c)/10))):
   t=j/max(4,math.ceil(math.dist(b,c)/10));u=1-t
   out.append([u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k] for k in (0,1)])
 out.append(p[-1]);return out
routes=[r for r in json.loads(Path('src/pixi/home-routes.json').read_text()) if not r['id'].startswith('stargazing-')]
audit=[r for r in json.loads(Path('scripts/home-review/sampled-routes.json').read_text()) if not r['id'].startswith('stargazing-')]
E['roads']=[r for r in E['roads'] if not r['id'].startswith('stargazing-')]
shapes=[base]
for s in E['stargazingHills']:
 s['trail'][0]=[s['x']+70,s['y']+45]
 if s['id']=='northeast':s['trail']=[[s['x']+70,s['y']+45],[6540,1320],[6480,1350],[6430,1375],[6200,1370],[6100,1470],[6000,1480],[5850,1470],[5740,1540],[5660,1650]]
 if s['id']=='southwest':s['trail']=[[-400,4550],[-450,4510],[-450,4435],[-420,4350],[-150,4300],[50,4260],[200,4066]]
 r={'id':'stargazing-'+s['id'],'width':104,'points':s['trail'],'kind':'lane','terminal':'stargazing hill'};r['samples']=sample(r['points'])
 routes.append({k:r[k] for k in ['id','width','samples']});audit.append(r);E['roads'].append({k:v for k,v in r.items() if k!='samples'})
 shapes.append(LineString(r['samples']).buffer(52,quad_segs=12))
merged=unary_union(shapes).simplify(.15,preserve_topology=True)
def path(g):
 ps=[g] if g.geom_type=='Polygon' else list(g.geoms)
 return ' '.join('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in r.coords)+'Z' for p in ps for r in [p.exterior,*p.interiors])
new=f'<g data-name="Home unified paths"><path d="{path(merged)}" fill="#e4c567" transform="translate(0 3)" fill-rule="evenodd"/><path d="{path(merged)}" fill="#fde48c" fill-rule="evenodd"/></g>'
m=Path('scripts/home-review/hill/mound.svgfrag').read_text()
mounds='<g data-name="Home stargazing hills">'+''.join(f'<g transform="translate({s["x"]-350} {s["y"]-270})">{m}</g>' for s in E['stargazingHills'])+'</g>'
files=set(Path('public/pixi-art').glob('ground-r*-c*.svg'))|set(Path('public/pixi-art/home-expansion').glob('ground-r*-c*.svg'))|set(Path('public/pixi-art/home-expansion-g').glob('ground-*.svg'))|{Path('public/pixi-art/globe/home-ground.svg'),Path('scripts/home-review/continuous-ground.svgfrag')}
for f in files:
 text=f.read_text();assert previous in text,str(f)
 f.write_text(text.replace(mounds+previous,mounds+new) if mounds+previous in text else text.replace(previous,mounds+new))
Path('scripts/home-review/path-surface.svgfrag').write_text(new)
f=Path('public/pixi-art/home-review/path-network.svg');f.write_text(f.read_text().replace(previous,new))
Path('src/pixi/home-routes.json').write_text(json.dumps(routes))
Path('scripts/home-review/sampled-routes.json').write_text(json.dumps(audit))
E['routeSystem']['routes']=len(routes)
from shapely.geometry import Point
E['groundDecals']=[d for d in E['groundDecals'] if not any(((d['x']-s['x'])/340)**2+((d['y']-s['y'])/145)**2<1 for s in E['stargazingHills']) and not any(g.contains(Point(d['x'],d['y'])) for g in shapes[1:])]
Path('src/pixi/home-expansion.json').write_text(json.dumps(E,indent=2)+'\n')
f=Path('public/pixi-art/globe/manifest.json');M=json.loads(f.read_text());M['home']['groundBytes']=Path('public/pixi-art/globe/home-ground.svg').stat().st_size;f.write_text(json.dumps(M,separators=(',',':'))+'\n')
print('Merged two hill trails into Home path contour on',len(files),'ground sources')
