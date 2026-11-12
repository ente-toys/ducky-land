"""Ten-community: deterministic lawn/paving craft pass, no shared writes."""
from pathlib import Path
import json,math,random,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'assets/world/themes/community';A=ROOT/'public/pixi-art/themes/community';S=D/'ten-source'
E.register_namespace('', 'http://www.w3.org/2000/svg');ns='{http://www.w3.org/2000/svg}'
a=json.loads((S/'art.json').read_text());w=json.loads((S/'world.json').read_text());walk=json.loads((S/'walk-world.json').read_text());root=E.fromstring((S/'ground.svg').read_text())
def el(tag,**attrs):return E.Element(ns+tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
def ellipse(g,cx,cy,rx,ry,**attrs):g.append(el('ellipse',cx=cx,cy=cy,rx=rx,ry=ry,**attrs))
def path(g,d,**attrs):g.append(el('path',d=d,**attrs))
def ring(g,cx,cy,rx,ry,depth,count):
 for i in range(count):
  t0=math.tau*i/count+.004;t1=math.tau*(i+1)/count-.004
  pts=[(cx+math.cos(t)*r,cy+math.sin(t)*r*ry/rx) for r,t in [(rx,t0),(rx,t1),(rx-depth,t1),(rx-depth,t0)]]
  path(g,'M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in pts)+' Z',fill=['#F7E2AF','#D6C5E6','#EDCF8B','#F9E9B7'][i%4],stroke='#9D946A',stroke_width=2.2,stroke_linejoin='round')
def lawn(g,cx,cy,rx,ry,seed):
 ellipse(g,cx,cy,rx,ry,fill='#93B72F',stroke='#6C9435',stroke_width=3)
 # Broken small clover / grass marks, no synthetic mowing stripes.
 rng=random.Random(seed)
 for i in range(95):
  x=cx+rng.uniform(-rx+15,rx-15);y=cy+rng.uniform(-ry+12,ry-12)
  if ((x-cx)/(rx-15))**2+((y-cy)/(ry-12))**2>1:continue
  if i%3==0:path(g,f'M{x:.1f} {y:.1f}q-5 -9 -10 -8m10 8q0 -13 5 -15m-5 15q8 -7 12 -5',fill='none',stroke='#6D9D36',stroke_width=2,stroke_linecap='round')
  else:ellipse(g,round(x,1),round(y,1),3+i%3,1.6,fill='#B5CA50')
for g in root:
 name=g.get('data-name','')
 if 'open lawn' in name:
  for child in g:
   if child.tag==ns+'g' and child.get('clip-path'):child.set('opacity','.24')
 if name=='Game square (open paved square)':
  g.clear();g.set('data-name','Game lawn with dressed stone rim')
  ellipse(g,5800,2700,505,332,fill='#699B3A',fill_opacity='.26')
  ellipse(g,5800,2700,488,313,fill='#A89ACF',stroke='#39472D',stroke_width=3)
  ring(g,5800,2700,479,305,57,36);lawn(g,5800,2700,420,265,7)
 if name=='Member wall square':
  # Keep the original paving as the broad promenade; fit a planted centre into it.
  ring(g,1820,2760,544,385,60,40)
  lawn(g,1820,2785,333,200,31)
  ellipse(g,1820,2785,346,211,fill='none',stroke='#FFF0C7',stroke_width=8)
 if name=='Voice circle':ring(g,4000,3780,317,239,43,28)
 if name in ['Market row (open stall row)','Beach stalls (open stall row)']:
  cx=2520 if name.startswith('Market') else 5420;cy=3560
  g.clear();g.set('data-name',name.replace('open stall row','open grass pitches'))
  # Soft lawn, dressed stone end aprons and subtle markers for the future stalls.
  path(g,f'M{cx-300} {cy-118}Q{cx-440} {cy-118} {cx-440} {cy}Q{cx-440} {cy+118} {cx-300} {cy+118}H{cx+300}Q{cx+440} {cy+118} {cx+440} {cy}Q{cx+440} {cy-118} {cx+300} {cy-118}Z',fill='#A8BF49',stroke='#6C9435',stroke_width=3)
  for side in [-1,1]:
   path(g,f'M{cx-305} {cy+side*122}Q{cx} {cy+side*139} {cx+305} {cy+side*122}',fill='none',stroke='#F9E9B7',stroke_width=18,stroke_linecap='round')
   for dx in [-290,-98,98,290]:
    path(g,f'M{cx+dx-10} {cy+side*122-4}h20v8h-20Z',fill='#A89ACF',stroke='#6D6953',stroke_width=1.5)
  rng=random.Random(cx)
  for i in range(40):
   x=cx+rng.uniform(-350,350);y=cy+rng.uniform(-88,88)
   path(g,f'M{x:.1f} {y:.1f}l-4 -7m4 7 5 -9',fill='none',stroke='#7B9E39',stroke_width=2,stroke_linecap='round')
 # Pale white ellipse highlights are a cheap plastic sheen. Keep only stone texture.
 if name in ['Member wall square','Voice circle']:
  for e in list(g):
   if e.get('fill')=='#FFFFFF':g.remove(e)
 # Home ink edge: thin, visible, without widening the existing walking surface.
 if name=='Footpaths':
  for e in g:
   if e.get('stroke')=='#39472D':e.set('stroke-opacity','.85')
# Small path-edge cobbles use the real HOME SVGs, clear lane is unchanged.
def distseg(x,y,p,q):
 dx=q[0]-p[0];dy=q[1]-p[1];t=max(0,min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy or 1)));return math.hypot(x-p[0]-t*dx,y-p[1]-t*dy)
def pathdist(x,y):return min(distseg(x,y,p,q)-ww/2 for pts,ww in zip(w['paths'],w['pathWidths']) for p,q in zip(pts,pts[1:]))
for i,(pts,ww) in enumerate(zip(w['paths'],w['pathWidths'])):
 for j in range(4,len(pts)-2,11):
  p,q=pts[j-1],pts[j+1];dx=q[0]-p[0];dy=q[1]-p[1];L=math.hypot(dx,dy)or 1;side=1 if j%2 else -1
  x=pts[j][0]-dy/L*(ww/2+22)*side;y=pts[j][1]+dx/L*(ww/2+22)*side
  if pathdist(x,y)<14:continue
  if any(((x-z['x'])/z.get('rx',1))**2+((y-z['y'])/z.get('ry',1))**2<1 for z in w['zones'].values() if 'rx' in z):continue
  a['flats'].append(dict(src='/pixi-art/decals/pebble-1.svg',x=round(x),y=round(y),width=32,height=20))
# Paving-free activity interiors are grass, but retain all original zone contracts.
ground=E.tostring(root,encoding='unicode');(A/'ground.svg').write_text(ground)
for t in a['ground']['tiles']:
 root.set('width',str(t['width']));root.set('height',str(t['height']));root.set('viewBox',f"{t['x']} {t['y']} {t['width']} {t['height']}")
 (A/t['src']).write_text(E.tostring(root,encoding='unicode'))
w['props']=a['props']
for p,v in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk)]:p.write_text(json.dumps(v,indent=2)+'\n')
print('Finished lawn interiors, stone rims, grass stall pitches and path edges')
