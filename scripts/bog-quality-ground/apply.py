"""qA: Home ground art transplanted into authored Bog lawns, no random scatter.
Run against the reviewed 5af08976 art. Does not rebuild architecture or bridges.
"""
import sys,json,re,math
from pathlib import Path
from collections import defaultdict
import xml.etree.ElementTree as ET
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Polygon,Point,box
from shapely.ops import unary_union
ROOT=Path('public/pixi-art/themes/bog-arena')
art=json.loads((ROOT/'art.json').read_text())
data=json.loads(Path('src/pixi/bog-environment.json').read_text())
blocks=json.loads(Path('src/pixi/bog-blockers.json').read_text())
ground=(ROOT/'ground.svg').read_text()
ground=re.sub(r'<g id="qa-home-ground"[\s\S]*?</svg><!-- qa-home-ground-end --></g>','',ground)
ground=re.sub(r'<defs id="qa-home-clips">[\s\S]*?</defs>','',ground)
pathD=re.search(r'<path d="([^"]+)" fill="#cea2d0"',ground)[1]
surface=Polygon()
for ring in re.findall(r'M([^MZ]+)Z',pathD):
    points=[tuple(map(float,p.split(','))) for p in ring.split('L')]
    surface=surface.symmetric_difference(Polygon(points).buffer(0))
world=data['world'];land=Polygon(world['coast']).buffer(-72)
wet=unary_union([Polygon(w['poly']) for w in world['water']])
lawn=land.difference(wet.buffer(58)).difference(surface.buffer(24))

def contours(shape):
    if shape.is_empty:return ''
    if shape.geom_type=='MultiPolygon':return ' '.join(contours(p) for p in shape.geoms)
    return ' '.join('M'+'L'.join(f'{x:.2f},{y:.2f}' for x,y in r.coords)+'Z' for r in [shape.exterior,*shape.interiors])

def recolour(s):
    palette={'#4aa539':'#9dbca7','#2b7a37':'#708e82','#89c332':'#c3dac8',
      '#9fbe3d':'#73547a','#89ae2d':'#604163','#a2c13f':'#795780',
      '#a0bf3e':'#705075','#6eac39':'#9dbca7','#69ae39':'#9dbca7','#4e9f38':'#708e82','#3e9d39':'#708e82','#79b638':'#c3dac8','#6aaf39':'#9dbca7','#6cb23a':'#9dbca7','#6ca638':'#708e82','#78b63d':'#9dbca7','#68ac36':'#708e82','#66aa35':'#708e82','#66ae39':'#708e82','#6cad36':'#708e82','#65a03c':'#708e82','#43a137':'#708e82',
      '#f16e4b':'#d9aae7','#f2ae6f':'#bc88ce','#f49a72':'#bc88ce',
      '#232323':'#39472d'}
    return re.sub(r'#[0-9a-fA-F]{6}',lambda m:palette.get(m[0].lower(),m[0]),s)

def nested(src,x,y,w,h,idx):
    s=recolour(Path('public'+src).read_text())
    ids=re.findall(r'\bid="([^"]+)"',s)
    for id in ids:s=s.replace('id="'+id+'"','id="qa'+str(idx)+'-'+id+'"').replace('#'+id, '#qa'+str(idx)+'-'+id)
    start=s.index('<svg');end=s.index('>',start)
    tag=s[start:end]
    tag=re.sub(r'\s(?:width|height|x|y)="[^"]*"','',tag)
    return s[:start]+tag+f' x="{x-w/2:.2f}" y="{y-h:.2f}" width="{w}" height="{h}"'+s[end:]

meadow=recolour(Path('scripts/home-review/outer-meadows.svgfrag').read_text())
layers=[f'<g transform="translate(1700 1800) scale(.84 1.02)">{meadow}</g>']
E=json.loads(Path('src/pixi/home-expansion.json').read_text())
marks=[]
for i,p in enumerate(E['groundDecals']):
    if not any(k in p['src'] for k in ['grass','flower','meadow']):continue
    x=p['x']*.84+1700;y=p['y']*1.02+1800
    w=p['width'];h=p['height']
    if not lawn.contains(box(x-w/2,y-h,x+w/2,y)):continue
    layers.append(nested(p['src'],x,y,w,h,i))
    marks.append(dict(x=round(x,2),y=round(y,2),width=w,height=h,homeSource=p['src']))
clumps=defaultdict(list)
for p in art['props']:
    if not re.match(r'^(tree|bush)-',p['name']):continue
    key=re.sub(r'-(tree|bush)-\d+$','',p['id'])
    if key==p['id']:continue
    clumps[key].append(p)
fixed=unary_union([box(b['x']-22,b['y']-22,b['x']+b['width']+22,b['y']+b['height']+22) for b in blocks if b['kind']!='tree'])
moves=[]
for key,ps in clumps.items():
    trees=[p for p in ps if p['name'].startswith('tree-')]
    if len(trees)<2:continue
    cx=sum(p['x'] for p in trees)/len(trees);cy=sum(p['y'] for p in trees)/len(trees)
    for p in ps:
        x=round(cx+(p['x']-cx)*.78,2);y=round(cy+(p['y']-cy)*.78,2)
        if not lawn.contains(Point(x,y).buffer(22)) or fixed.intersects(Point(x,y).buffer(20)):continue
        if math.hypot(x-p['x'],y-p['y'])<10:continue
        ox,oy=p['x'],p['y'];p['x']=x;p['y']=y
        b=next((b for b in blocks if b['id'] in [p['id']+'-trunk',p['id'].replace('-tree-','-trunk-')]),None)
        if b:
            b['x']=round(b['x']+x-ox,2);b['y']=round(b['y']+y-oy,2)
            ob=next(o for o in world['obstacles'] if o['id']==b['id'])
            ob['poly']=[[b['x'],b['y']],[b['x']+b['width'],b['y']],[b['x']+b['width'],b['y']+b['height']],[b['x'],b['y']+b['height']]]
        moves.append(p['id'])
    for j,(dx,dy,n) in enumerate([[-210,110,1],[-135,170,2],[-45,210,3],[55,235,1],[155,180,2],[220,115,3],[-260,205,2],[110,285,3]]):
        x=cx+dx;y=cy+dy;w=39 if n==1 else 45;h=27 if n==1 else 30
        if not lawn.contains(box(x-w/2,y-h,x+w/2,y)):continue
        src=f'/pixi-art/decals/grass-tuft-{n}.svg'
        layers.append(nested(src,x,y,w,h,10000+len(marks)))
        marks.append(dict(x=round(x,2),y=round(y,2),width=w,height=h,homeSource=src))
bedSrc='/pixi-art/home-hamlets/petalpatch/cottage-flowerbed.svg'
(ROOT/'home/qa-home-planting-bed.svg').write_text(recolour(Path('public'+bedSrc).read_text()))
for p in art['props']:
    if p['name']=='site-bed':
        p.update(name='home-planting-bed',src='home/qa-home-planting-bed.svg',homeSource=bedSrc,height=round(p['width']*124/291,2),shadow=False)
clip=f'<defs id="qa-home-clips"><clipPath id="qa-home-lawn"><path d="{contours(lawn)}" fill-rule="evenodd"/></clipPath></defs>'
layer='<g id="qa-home-ground" clip-path="url(#qa-home-lawn)">'+''.join(layers)+'<svg width="0" height="0"></svg><!-- qa-home-ground-end --></g>'
ground=ground.replace('</svg>',clip+layer+'</svg>')
(ROOT/'ground.svg').write_text(ground)
Path('public/pixi-art/globe/bog-arena-ground.svg').write_text(ground.replace('width="8400" height="8200"','width="1024" height="1000"',1))
(ROOT/'art.json').write_text(json.dumps(art,indent=2)+'\n')
Path('src/pixi/bog-environment.json').write_text(json.dumps(data,separators=(',',':'))+'\n')
Path('src/pixi/bog-blockers.json').write_text(json.dumps(blocks,indent=2)+'\n')
report=dict(bakedHomeMarks=len(marks),homeMeadowPlanes=18,compactedPlants=len(moves),groves=len(clumps),midHomeBeds=4,pathColour='#cea2d0',routeWidths=sorted(set(r['width'] for r in json.loads(Path('scripts/bog-environment/layout.json').read_text())['routes'])),rasterStreaming=art['raster']['enabled'],marks=marks,movedPlants=moves)
Path('scripts/bog-quality-ground/audit.json').write_text(json.dumps(report,indent=2)+'\n')
print({k:v for k,v in report.items() if k not in ['marks','movedPlants']})
