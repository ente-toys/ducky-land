"""Author the new community commons; preserve every original dry pixel under its exact coast mask."""
from pathlib import Path
import json,math,copy,sys,os,base64,xml.etree.ElementTree as E
if os.path.isdir(os.environ.get("DUCKY_COMMUNITY_PYTHON","/private/tmp/ducky-community-python")):
 sys.path.insert(0,os.environ.get("DUCKY_COMMUNITY_PYTHON","/private/tmp/ducky-community-python"))
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely.affinity import scale
R=Path(__file__).resolve().parents[2]; A=R/'public/pixi-art/themes/community'; S=R/'scripts/bigger-community';B=S/'baseline'
p=json.loads((S/'plan.json').read_text());w=json.loads((B/'world.json').read_text());a=json.loads((B/'art.json').read_text())
ns='http://www.w3.org/2000/svg';E.register_namespace('',ns)
def node(tag,**kw):return E.Element('{'+ns+'}'+tag,{k.replace('_','-'):str(v) for k,v in kw.items()})
def sub(parent,tag,**kw):e=node(tag,**kw);parent.append(e);return e
def dpoly(points):return 'M '+'L '.join(f'{x:.2f} {y:.2f}' for x,y in points)+'Z'
def smooth(points,closed=False):
 q=points[:-1] if closed and points[0]==points[-1] else points
 d=f'M{q[0][0]} {q[0][1]}'
 for i in range(len(q) if closed else len(q)-1):
  b=q[i];c=q[(i+1)%len(q)];aa=q[(i-1)%len(q)] if i or closed else b;dd=q[(i+2)%len(q)] if i+2<len(q) or closed else c
  d+=f'C{b[0]+(c[0]-aa[0])/6:.2f} {b[1]+(c[1]-aa[1])/6:.2f} {c[0]-(dd[0]-b[0])/6:.2f} {c[1]-(dd[1]-b[1])/6:.2f} {c[0]} {c[1]}'
 return d+('Z' if closed else '')
outline=[[-1400,2600],[-1100,800],[0,-300],[1700,-900],[4000,-1100],[6500,-850],[8300,-100],[9250,1450],[9500,3200],[9350,4800],[8500,6000],[6800,6660],[4600,6800],[2600,6900],[700,6500],[-600,5700],[-1300,4300]]
coast=[]
for i,b in enumerate(outline):
 aa=outline[i-1];c=outline[(i+1)%len(outline)];dd=outline[(i+2)%len(outline)]
 for j in range(10):
  t=j/10;u=1-t;coast.append([round(u*u*u*b[k]+3*u*u*t*(b[k]+(c[k]-aa[k])/6)+3*u*t*t*(c[k]-(dd[k]-b[k])/6)+t*t*t*c[k],2)for k in [0,1]])
p['coast']=coast;p['markerBasins']=[]
root=node('svg',width=p['width'],height=p['height'],viewBox=f"{p['origin']['x']} {p['origin']['y']} {p['width']} {p['height']}")
defs=sub(root,'defs');clip=sub(defs,'clipPath',id='new-coast');sub(clip,'path',d=dpoly(coast))
oldclip=sub(defs,'clipPath',id='preserved-dry');sub(oldclip,'path',d=dpoly(w['coast']))
for x,y,rx,ry in w['islets']:sub(oldclip,'ellipse',cx=x,cy=y,rx=rx,ry=ry)
pat=sub(defs,'pattern',id='lawn-grain',width=493,height=367,patternUnits='userSpaceOnUse')
for x,y,size in [(28,42,1),(161,89,.8),(353,36,1.2),(443,185,.9),(297,275,1),(98,304,1.15),(217,189,.7),(39,201,.65)]:
 g=sub(pat,'g',transform=f'translate({x} {y}) scale({size})',opacity='.55');sub(g,'path',d='M-10 0q-4 -10 -10 -10M0 0q-1 -18 7 -19M4 0q10 -10 16 -7',fill='none',stroke='#6D9838',stroke_width=2.4,stroke_linecap='round');sub(g,'ellipse',cx=22,cy=9,rx=4,ry=2,fill='#C3D46A');sub(g,'ellipse',cx=-22,cy=15,rx=3,ry=1.8,fill='#C3D46A')
for width,color,dy in [(96,'#A9DFDA',18),(64,'#FFF0C7',12),(15,'#D5B87B',0)]:sub(root,'path',d=dpoly(coast),fill='none',stroke=color,stroke_width=width,stroke_linejoin='round',transform=f'translate(0 {dy})')
sub(root,'path',d=dpoly(coast),fill='#F7E2AF')
inner=[[4000+(x-4000)*.965,2900+(y-2900)*.95]for x,y in coast]
sub(root,'path',d=dpoly(inner),fill='#A7C653',stroke='#819F3E',stroke_width=5)
g=sub(root,'g',clip_path='url(#new-coast)')
for x,y,rx,ry in [(-600,1700,550,380),(250,700,600,280),(2100,220,600,340),(5400,10,630,300),(7840,1100,600,460),(8390,3910,600,400),(6100,5160,650,320),(2470,5130,720,360),(-100,4100,550,400),(4400,5300,900,360)]:
 dd=f'M{x-rx} {y}C{x-rx-70} {y-ry} {x-rx*.3} {y-ry*.7} {x} {y-ry}C{x+rx*.6} {y-ry*1.2} {x+rx} {y-ry*.6} {x+rx} {y}C{x+rx*.9} {y+ry} {x+rx*.2} {y+ry*.7} {x} {y+ry}C{x-rx*.6} {y+ry*.8} {x-rx*.8} {y+ry*.6} {x-rx} {y}Z'
 sub(g,'path',d=dd,fill='#99BA48',opacity='.68')
sub(g,'path',d=dpoly(inner),fill='url(#lawn-grain)')
for garden in p.get('denseGardens',[]):
 sub(g,'path',d=smooth(garden['points'],True),fill='#96B64C',stroke='#7B9542',stroke_width=4)
 sub(g,'path',d=smooth(garden['points'],True),fill='url(#lawn-grain)')
 if garden['zone'].endswith('field'):
  for yy in [5740,5830,5920,6010,6100,6190]:
   sub(g,'path',d=f'M1660 {yy}Q2000 {yy-25} 2320 {yy+5}',fill='none',stroke='#C2B182',stroke_width=12,stroke_linecap='round')
def sample(q,closed=False):
 if closed and q[0]!=q[-1]:q=q+[q[0]]
 result=[]
 for i in range(len(q)-1):
  a=q[i-1] if i else q[0];b=q[i];c=q[i+1];d=q[i+2] if i+2<len(q) else c
  for j in range(max(8,int(math.dist(b,c)/38))):
   t=j/max(8,int(math.dist(b,c)/38));u=1-t
   result.append([u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(d[k]-b[k])/6)+t**3*c[k]for k in [0,1]])
 result.append(q[-1]);return result
road_shapes=[];road_marks=node("g");road_tufts=node("g")
def road(parent,q,width,closed=False):
 points=sample(q,closed);left=[];right=[];norms=[];widths=[]
 for i,(x,y) in enumerate(points):
  a=points[-2] if closed and i==0 else points[max(0,i-1)];b=points[1] if closed and i==len(points)-1 else points[min(len(points)-1,i+1)];dx=b[0]-a[0];dy=b[1]-a[1];ll=max(1,math.hypot(dx,dy));nx=-dy/ll;ny=dx/ll
  t=i/max(1,len(points)-1);w=width*(1+.20*math.sin(t*math.tau*2.3)+.11*math.cos(t*math.tau*5.7))
  scallop=6*math.sin(i*1.63)+4*math.cos(i*.87);norms.append((nx,ny));widths.append(w)
  left.append([x+nx*(w/2+scallop),y+ny*(w/2+scallop)]);right.append([x-nx*(w/2-scallop),y-ny*(w/2-scallop)])
 road_shapes.append(Polygon(left+right[::-1]).buffer(0))
 for side in [-.23,.17]:
  for st in range(5,len(points)-7,19):
   mark=[[points[i][0]+norms[i][0]*widths[i]*side,points[i][1]+norms[i][1]*widths[i]*side]for i in range(st,min(st+9,len(points)))]
   sub(road_marks,'path',d=smooth(mark),fill='none',stroke='#DCC48A',stroke_width=6,opacity='.72',stroke_linecap='round')
 for i in range(6,len(points)-3,11):
  x,y=points[i];nx,ny=norms[i];w=widths[i];side=-1 if i%2 else 1;xx=x+nx*w*.41*side;yy=y+ny*w*.41*side
  sub(road_marks,'path',d=f'M{xx-10:.1f} {yy:.1f}q4 -8 12 -4l6 6q-6 5 -18 1Z',fill='#CAB78D',stroke='#9A9574',stroke_width=1.8)
  sub(road_marks,'path',d=f'M{x-20:.1f} {y+13:.1f}q17 -10 43 -5',fill='none',stroke='#FFF0C7',stroke_width=5,opacity='.65')
 for i in range(2,len(points)-2,4):
  x,y=points[i];nx,ny=norms[i];w=widths[i]
  for side in [-1,1]:
   xx=x+nx*(w/2+6)*side;yy=y+ny*(w/2+6)*side
   tuft=sub(road_tufts,'path',d=f'M{xx-10:.1f} {yy+2:.1f}q-8 -10 -3 -19l9 12q0 -16 7 -20l2 15l12 -7l-7 19Z',fill='#98B94B',stroke='#6F8B3E',stroke_width=1.8);tuft.set('data-edge',f'{xx} {yy}')
 if not closed:
  for x,y in [points[0],points[-1]]:road_shapes.append(scale(Point(x,y).buffer(1),width*.47,width*.39,origin=(x,y)))
for site in p['places']:
 x,y=site['x'],site['y'];rx=405;ry=210
 dd=f'M{x-rx} {y}Q{x-rx-40} {y-ry} {x} {y-ry}Q{x+rx+80} {y-ry+10} {x+rx} {y+40}Q{x+rx-30} {y+ry+60} {x-30} {y+ry}Q{x-rx-40} {y+ry-20} {x-rx} {y}Z'
 sub(g,'path',d=dd,fill='#93B72F',stroke='#798F42',stroke_width=7)
 sub(g,'path',d=dd,fill='url(#lawn-grain)')
road(g,p['loop'],p.get('roadWidths',{}).get('main',335),True)
for q in p['links']:road(g,q,p.get('roadWidths',{}).get('link',285))
for q in p['lanes']:road(g,q,p.get('roadWidths',{}).get('lane',195),not p.get('dense',False))
for home in p['homes']:
 x,y=home['x'],home['y'];road(g,[[x,y+5],[x+7,y+170],[x+35,y+260]],p.get('roadWidths',{}).get('door',92))
shore=[[4000+(x-4000)*.91,2900+(y-2900)*.90]for x,y in outline]
if not p.get('dense',False):road(g,shore,145,True)
if not p.get('dense',False):
 for q in [[[-300,1230],[-600,1650],[-850,2500]],[[8930,1400],[8960,2200],[8720,2800]],[[1480,6000],[1900,6120],[2700,6100]],[[6950,5910],[6220,6000],[5600,6010]],[[4000,6140],[4000,6500]]]:road(g,q,185)
def polygon_d(geom):
 geoms=list(geom.geoms) if hasattr(geom,'geoms') else [geom]
 return ''.join(dpoly(list(poly.exterior.coords))+''.join(dpoly(list(r.coords))for r in poly.interiors)for poly in geoms if hasattr(poly,'exterior'))
joined=unary_union(road_shapes).buffer(5).buffer(-5)
original_land=unary_union([Polygon(w['coast']),*[scale(Point(x,y).buffer(1,64),rx,ry) for x,y,rx,ry in w['islets']]])
water=unary_union([Polygon(o['poly']) for o in p.get('reviewWater',[])])
new_land=Polygon(coast).difference(original_land).difference(water)
road_area=joined.intersection(new_land).area
metrics={'newDryLandArea':new_land.area,'roadArea':road_area,'roadPercent':100*road_area/new_land.area,'roadAndBankPercent':100*joined.buffer(12).intersection(new_land).area/new_land.area,'mainWidth':p.get('roadWidths',{}).get('main',335),'links':len(p['links']),'lanes':len(p['lanes']),'coastLoop':not p.get('dense',False)}
(S/('dense-road-after.json' if p.get('dense',False) else 'dense-road-before.json')).write_text(json.dumps(metrics,indent=2)+'\n')
if '--metrics-only' in sys.argv:
 print(metrics);sys.exit(0)
rd=polygon_d(joined)
sub(g,'path',d=rd,fill='#687C3F',stroke='#687C3F',stroke_width=24,fill_rule='evenodd',transform='translate(0 11)',opacity='.40')
sub(g,'path',d=rd,fill='#F7E2AF',stroke='#687B3F',stroke_width=9,fill_rule='evenodd',stroke_linejoin='round')
sub(g,'path',d=polygon_d(joined.difference(joined.buffer(-10))),fill='#C8B987',fill_rule='evenodd',opacity='.65')
roadclip=sub(defs,'clipPath',id='roads-union');sub(roadclip,'path',d=rd,clip_rule='evenodd')
for tuft in list(road_tufts):
 xx,yy=map(float,tuft.attrib.pop('data-edge').split())
 if joined.boundary.distance(Point(xx,yy))>19:road_tufts.remove(tuft)
road_marks.set('clip-path','url(#roads-union)');g.append(road_marks);g.append(road_tufts)
review=S/'fix-ground.svg'
if review.exists():
 for child in E.fromstring(review.read_text()):root.append(copy.deepcopy(child))
for b in a['props']:
 if 'buoy' not in b['name'].lower():continue
 x,y=b['x'],b['y']
 sub(root,'ellipse',cx=x,cy=y-6,rx=130,ry=72,fill='#F7E2AF',stroke='#819F3E',stroke_width=4)
 sub(root,'ellipse',cx=x,cy=y-6,rx=108,ry=54,fill='#6EC9DE',stroke='#FFF0C7',stroke_width=5)
 sub(root,'path',d=f'M{x-70} {y+13}q14 -6 28 0M{x+30} {y-34}q14 -6 28 0',fill='none',stroke='#FFF0C7',stroke_width=3)
 p.setdefault('markerBasins',[]).append(dict(x=x,y=y-6,rx=108,ry=54))
oldg=sub(root,'g',clip_path='url(#preserved-dry)',data_name='Unchanged original tile sources')
sub(oldg,'rect',x=0,y=0,width=w['width'],height=w['height'],fill=a['sea'])
original_tiles=[]
for tile in a['ground']['tiles']:
 src='data:image/svg+xml;base64,'+base64.b64encode((A/tile['src']).read_bytes()).decode()
 image=node('image',x=tile['x'],y=tile['y'],width=tile['width'],height=tile['height'],href=src)
 original_tiles.append((tile,image));oldg.append(image)
(A/'expansion/ground-composed.svg').write_text(E.tostring(root,encoding='unicode'))
tiles=[]
for y in range(-1200,7200,1400):
 for x in range(-1600,9600,1400):
  tw=1400;th=1400;
  for child in list(oldg)[1:]:oldg.remove(child)
  for tile,image in original_tiles:
   if tile['x']<x+tw and tile['x']+tile['width']>x and tile['y']<y+th and tile['y']+tile['height']>y:oldg.append(copy.deepcopy(image))
  src=f'expansion/ground-{y}-{x}.svg';root.set('width',str(tw));root.set('height',str(th));root.set('viewBox',f'{x} {y} {tw} {th}');(A/src).write_text(E.tostring(root,encoding='unicode'));tiles.append(dict(src=src,x=x,y=y,width=tw,height=th))
a.update(width=p['width'],height=p['height'],origin=p['origin']);a['ground']['tiles']=tiles;a['props']+=p['props']
foot=[4000,6640];tip=[4000,7240];p['harbor']={'jetty':{'foot':foot,'tip':tip,'width':120},'spawn':[4000,2970],'boats':[{'x':3830,'y':7140,'turn':3.14159},{'x':4170,'y':7140,'turn':3.14159},{'x':3830,'y':7300,'turn':3.14159},{'x':4170,'y':7300,'turn':3.14159}]}
deck=node('svg',width=180,height=650,viewBox='0 0 180 650');sub(deck,'path',d='M20 20H160V625H20Z',fill='#B98750',stroke='#725736',stroke_width=6)
for y in range(25,625,25):sub(deck,'path',d=f'M22 {y}H158',stroke='#785B3A',stroke_width=3)
for x in [10,150]:
 for y in [20,220,420,610]:sub(deck,'path',d=f'M{x} {y}v30h20v-30Z',fill='#D9B477',stroke='#725736',stroke_width=3)
(A/'expansion/jetty.svg').write_text(E.tostring(deck,encoding='unicode'))
a['decks'].append(dict(src='expansion/jetty.svg',x=3910,y=6605,width=180,height=650))
a['decks'].extend({k:v for k,v in d.items() if k not in ['name','axis']} for d in p.get('reviewDecks',[]))
(S/'design-art.json').write_text(json.dumps(a,indent=2)+'\n');(S/'plan.json').write_text(json.dumps(p,indent=2)+'\n')
print('Staged',len(tiles),'tiles; original ground is clipped only outside its walking coast.')
