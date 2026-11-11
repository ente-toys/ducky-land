"""Home path recipe: curve samples, 128/104 buffers, one exterior union.
Geometry only. All plants and architecture have authored placements in build.mjs.
"""
import sys,json,math
from pathlib import Path
sys.path.insert(0,'/private/tmp/ducky-community-python')
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union
from shapely import affinity
from cove_geometry import round_cove
D=json.load(open('scripts/bog-environment/layout.json')); P=D['palette']; W=D['width']; H=D['height']
def smooth(p,closed=False):
    out=[]; q=([p[-1]]+p+[p[0],p[1]]) if closed else ([p[0]]+p+[p[-1]])
    for i in range(1,len(q)-2):
        a,b,c,d=q[i-1:i+3]
        for j in range(16):
            t=j/16
            out.append([round(.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t),2) for k in [0,1]])
    if not closed:out.append(p[-1])
    return out
def path(shape):
    if shape.is_empty:return ''
    if shape.geom_type=='MultiPolygon':return ' '.join(path(g) for g in shape.geoms)
    return ' '.join('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in r.coords)+'Z' for r in [shape.exterior,*shape.interiors])
# Asymmetric organic coastline, with a southern inlet/dock mouth.
coast=smooth([[4200,330],[4950,600],[5520,860],[6400,660],[7100,1010],[7460,1640],[7350,2460],[7760,3100],[7670,3930],[7860,4610],[7670,5390],[7450,6110],[6890,6600],[5910,6740],[5390,7140],[5160,7680],[4670,7900],[4010,8040],[3400,7710],[2970,7050],[2100,6790],[1310,6750],[760,6260],[630,5460],[850,4640],[530,3930],[640,3220],[890,2600],[630,1960],[960,1280],[1610,880],[2370,790],[3050,590]],True)
land=Polygon(coast).buffer(0)
wetShapes=[Polygon(smooth(p['points'],True)).buffer(0) for p in D['pools']]
wet=unary_union(wetShapes)
coast=round_cove(coast,wetShapes[next(i for i,p in enumerate(D['pools']) if p['id']=='cove-pool')])
land=Polygon(coast)
roads=unary_union([LineString(smooth(r['points'])).buffer(r['width']/2,quad_segs=12) for r in D['routes']])
courts=[]
for name,a in D['areas'].items():
    # Calm organic destination courts, not circles, pads or giant paved lawns.
    rx=620 if name not in ['mid','lantern-cove'] else 640; ry=420 if name!='mid' else 480
    if name=='lantern-cove':continue
    rx,ry=a.get('court',[rx,ry])
    x,y=a['x'],a['y'];pts=smooth([[x-rx,y-110],[x-rx*.65,y-ry],[x+rx*.4,y-ry*.9],[x+rx,y-100],[x+rx*.9,y+ry*.6],[x+rx*.2,y+ry],[x-rx*.65,y+ry*.8]],True)
    courts.append(Polygon(pts).buffer(0))
surface=unary_union([roads,*courts]).buffer(32,quad_segs=10).buffer(-32,quad_segs=10).difference(wet.buffer(7))
L=path(land.difference(wet)); R=path(surface)
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs><clipPath id="land"><path d="{L}"/></clipPath><clipPath id="wet"><path d="{path(wet)}"/></clipPath></defs>'
# Identical sea remains outside this transparent ground. Home beach, rim and surf.
svg+=f'<path d="{L}" fill="{P["ground"]}" stroke="#fff0c7" stroke-width="104" stroke-linejoin="round"/><path d="{L}" fill="{P["ground"]}" stroke="#fde48c" stroke-width="73" stroke-linejoin="round"/>'
# fA: the small internal willow pool has a planted bog bank, not an ocean beach.
for i,pool in enumerate(D['pools']):
    if pool['id']=='site-b-willow-pool':
        svg+=f'<path d="{path(wetShapes[i].buffer(55))}" fill="{P["ground"]}"/>'
# One fill over the complete path union. No internal road strokes or layered bars.
svg+=f'<path d="{R}" fill="{P["path"]}" fill-rule="evenodd"/>'
for poly in wetShapes:
    s=path(poly.intersection(land));svg+=f'<path d="{s}" fill="#6ec9de"/>'
svg+='<g fill="none" stroke="#bde8e6" stroke-width="3" stroke-linecap="round" clip-path="url(#wet)">'
for x,y in [[1550,2760],[2010,2710],[2180,2870],[5930,2700],[6350,2660],[6500,2790],[4100,6910],[4340,7130],[4200,7390],[4550,7590]]:svg+=f'<path d="M{x} {y}q20-8 40 0"/>'
svg+='</g>'
# Small ground details are at manually composed grove feet, not scattered over courts.
for x,y,c in D['groves']:
    svg+=f'<ellipse cx="{x}" cy="{y+115}" rx="270" ry="130" fill="#705075" opacity=".48"/>'
    for dx,dy in [[-220,185],[210,160]]:svg+=f'<ellipse cx="{x+dx}" cy="{y+dy}" rx="11" ry="6" fill="#b591c0"/>'
svg+='</svg>'
Path('public/pixi-art/themes/bog-arena/ground.svg').write_text(svg)
Path('public/pixi-art/globe/bog-arena-ground.svg').write_text(svg.replace(f'width="{W}" height="{H}"','width="1024" height="1000"',1))
# Add only semantic shapes to the pure world, shared by movement and the combat port.
obstacles=[dict(id=b['id'],poly=[[b['x'],b['y']],[b['x']+b['width'],b['y']],[b['x']+b['width'],b['y']+b['height']],[b['x'],b['y']+b['height']]]) for b in D['blockers']]
world=dict(width=W,height=H,coast=coast,islets=[],water=[dict(poly=list(p.exterior.coords)) for p in wetShapes],boatWater=[list(p.exterior.coords) for p in wetShapes],obstacles=obstacles,bridges=[dict(x=4300,y=6870,w=1044,h=104)],walkways=[dict(a=[3796,6870],b=[4804,6870],w=104,boatPassUnder=True),dict(a=[4200,7570],b=[4200,7780],w=104)],zones={name:dict(x=a['x'],y=a['y'],spawn=[a['x'],a['y']+70],r=550) for name,a in D['areas'].items()},ambient=dict(birds=[[3600,1800],[4700,2500],[1700,3600],[6600,3600],[3300,5800],[4500,6800]],butterflies=[[1700,2200],[6600,6000]]),arches=[dict(a=[3796,6870],b=[4804,6870],r=24,w=104)])
for lake in world['water']:
    xs=[p[0] for p in lake['poly']];ys=[p[1] for p in lake['poly']]
    lake.update(x=(min(xs)+max(xs))/2,y=(min(ys)+max(ys))/2,rx=(max(xs)-min(xs))/2,ry=(max(ys)-min(ys))/2)
world['bridges'][0]['w']=1080
dockpoly=[[3720+x*800/1450,7350+y*800/1450] for x,y in [[30,50],[1350,30],[1390,236],[871,262],[875,551],[612,571],[596,274],[48,290]]]
world['bridges'].append(dict(poly=dockpoly))
world['walkways'][-1]=dict(a=[3740,7410],b=[4430,7410],w=104)
world['riverMouths']=[[3900,7750,4750,8450]]
world['zones']['lantern-cove'].update(spawn=[3690,7010])
world['sleepTotal']=0
world['zones']['plaza']=dict(x=4200,y=3270,spawn=[4200,3270],r=600)
harbor=dict(jetty=dict(foot=[3740,7410],tip=[4430,7410],width=104,art='home'),spawn=[1900,2090],water=dict(x=4390,y=7560),boats=[dict(x=4390,y=7560,turn=math.pi/2),dict(x=4300,y=7250,turn=math.pi/2),dict(x=4590,y=7560,turn=math.pi/2)])
Path('src/pixi/bog-environment.json').write_text(json.dumps(dict(world=world,harbor=harbor,art='/pixi-art/themes/bog-arena/art.json',sea=P['sea'],centre=dict(x=4200,y=4000),sleepers=[]),separators=(',',':'))+'\n')
Path('src/pixi/bog-blockers.json').write_text(json.dumps(D['blockers'],indent=2)+'\n')
print('Ground coast, pools, united paths and shared collision written')
