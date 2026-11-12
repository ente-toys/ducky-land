"""Close-community. Home stone courses, dressed lawn rims, open crowd floors.

Only reads the close-source snapshot and writes Community-owned assets/data.
"""
from pathlib import Path
import json, math, random, xml.etree.ElementTree as E

R = Path(__file__).resolve().parents[2]
A = R / 'public/pixi-art/themes/community'
D = R / 'assets/world/themes/community'
S = R.parent / 'concepts/themes/work/community/close-source'
N = '{http://www.w3.org/2000/svg}'
E.register_namespace('', N[1:-1])
read = lambda p: json.loads(p.read_text())
a, w, walk = [read(S / n) for n in ['art.json', 'world.json', 'walk-world.json']]
root = E.parse(S / 'ground.svg').getroot()

def element(tag, **attrs):
    return E.Element(N + tag, {k.replace('_', '-'): str(v) for k, v in attrs.items()})

def ellipse(g, x, y, rx, ry, **attrs):
    g.append(element('ellipse', cx=x, cy=y, rx=rx, ry=ry, **attrs))

def path(g, d, **attrs):
    g.append(element('path', d=d, **attrs))

def point(cx, cy, radius, ratio, angle):
    return cx + radius * math.cos(angle), cy + radius * ratio * math.sin(angle)

def sector(g, cx, cy, ratio, inner, outer, t0, t1, fill, ink='#8C8461', line=1.2):
    p = [point(cx, cy, outer, ratio, t0 + (t1-t0)*i/12) for i in range(13)]
    p += [point(cx, cy, inner, ratio, t1 - (t1-t0)*i/12) for i in range(13)]
    path(g, 'M ' + ' L '.join(f'{x:.2f} {y:.2f}' for x,y in p) + ' Z',
         fill=fill, stroke=ink, stroke_width=line, stroke_linejoin='round')

def courses(g, cx, cy, ratio, radii, count, lavender=False):
    """Thin ink joints, alternating cream faces, warm narrow bevels, like Home."""
    colors = ['#FFE394', '#FFF0C7', '#F9E4AC', '#FDE48C', '#FFF0C7', '#F4D884']
    for row, (inner, outer) in enumerate(zip(radii, radii[1:])):
        n = max(12, round(count * outer/radii[-1]))
        shift = (row % 2) * .5
        for i in range(n):
            t0 = math.tau*(i+shift)/n
            t1 = math.tau*(i+1+shift)/n
            color = '#D7CAE8' if lavender and row == len(radii)-2 and i%8 == 3 else colors[(i+row*2)%6]
            sector(g,cx,cy,ratio,inner,outer,t0,t1,color)
            if (i+row)%3==0:
                sector(g,cx,cy,ratio,inner+1,min(inner+8,outer-1),t0+.004,t1-.004,'#DDBD70',ink='none',line=0)

def lozenge(g,x,y,rx,ry,fill):
    path(g,f'M{x-rx:.1f} {y:.1f}L{x:.1f} {y-ry:.1f}L{x+rx:.1f} {y:.1f}L{x:.1f} {y+ry:.1f}Z',
         fill=fill,stroke='#857B60',stroke_width=1.2)

def lights(g,cx,cy,rx,ratio,angles):
    for deg in angles:
        x,y=point(cx,cy,rx,ratio,math.radians(deg))
        ellipse(g,round(x,1),round(y,1),8,6.3,fill='#8D7B59',stroke='#39472D',stroke_width=1.4)
        ellipse(g,round(x,1),round(y-1,1),5.3,3.8,fill='#FFE394')
        ellipse(g,round(x-1.8,1),round(y-2.1,1),1.6,1.2,fill='#FFF9DC')

def lawn_marks(g,cx,cy,rx,ry,seed,count):
    rng=random.Random(seed)
    for i in range(count):
        x=cx+rng.uniform(-rx+16,rx-16);y=cy+rng.uniform(-ry+12,ry-12)
        if ((x-cx)/(rx-16))**2+((y-cy)/(ry-12))**2>.97:continue
        if i%4==0:
            path(g,f'M{x:.1f} {y:.1f}q-5 -8 -9 -7m9 7q0 -12 4 -13m-4 13q7 -6 11 -5',
                 fill='none',stroke='#6F9F3D',stroke_width=2,stroke_linecap='round')
        elif i%5==0:
            ellipse(g,round(x,1),round(y,1),3.2,1.8,fill='#FFF0C7')
            ellipse(g,round(x+4,1),round(y-2,1),2.3,1.6,fill='#D7CAE8')
        else:ellipse(g,round(x,1),round(y,1),3.5,1.6,fill='#B9CF59')

for g in root:
    name=g.get('data-name','')
    if name=='Game lawn with dressed stone rim':
        rim=element('g',data_name='Home stone courses around game lawn')
        courses(rim,5800,2700,305/479,[425,451,479],40,True)
        lights(rim,5800,2700,466,305/479,[-155,-105,-55,25,75,125])
        g.append(rim)
        lawn_marks(g,5800,2700,410,252,91,100)
    elif name=='Member wall square':
        g.clear();g.set('data-name','Member wall square')
        ellipse(g,1820,2760,560,400,fill='#B7A1D8',stroke='#39472D',stroke_width=2.2)
        rim=element('g',data_name='Concentric member promenade')
        courses(rim,1820,2760,400/560,[0,280,355,410,475,544],44,True)
        lights(rim,1820,2760,529,400/560,[-135,-95,-45,20,75,110,160])
        g.append(rim)
        ellipse(g,1820,2785,340,207,fill='#FFF0C7',stroke='#8C8461',stroke_width=1.2)
        ellipse(g,1820,2785,333,200,fill='#93B72F',stroke='#6C9435',stroke_width=2)
        lawn_marks(g,1820,2785,325,193,1820,100)
    elif name=='Voice circle':
        paving=element('g',data_name='Voice circle stone rings')
        courses(paving,4000,3780,250/330,[0,125,205,270,317],32,True)
        lights(paving,4000,3780,308,250/330,[-160,-110,-70,-20,30,150])
        g.append(paving)
    elif name in ['Stage lawn (open lawn)','Meadow lawn (open lawn)']:
        cx,cy,rx,ry=(4000,1800,640,220) if name.startswith('Stage') else (2700,1880,430,200)
        for c in list(g):
            if c.get('clip-path'):g.remove(c)
        rim=element('g',data_name='Dressed open lawn edge')
        courses(rim,cx,cy,ry/rx,[rx+18,rx+38],48,True)
        lawn_marks(rim,cx,cy,rx-14,ry-12,cx,135)
        g.append(rim)
    elif name in ['Market row (open grass pitches)','Beach stalls (open grass pitches)']:
        cx=2520 if name.startswith('Market') else 5420
        for side in [-1,1]:
            for i in range(20):
                x=cx-300+i*30
                path(g,f'M{x} {3560+side*122-7}v14',fill='none',stroke='#948A63',stroke_width=1)
        lawn_marks(g,cx,3560,355,84,cx+1,60)
    elif name=='Hash path tiles':
        g.set('d','');g.set('data-name','Soft path sand grain')

grain=element('g',data_name='Community path-edge craft')
for i,(pts,width) in enumerate(zip(w['paths'],w['pathWidths'])):
    for j in range(8,len(pts)-2,20):
        x,y=pts[j]
        ellipse(grain,round(x+width*.15,1),round(y+3,1),3.8,2,fill='#D7B967',fill_opacity='.6')
        ellipse(grain,round(x+width*.15+7,1),round(y,1),1.6,1,fill='#FFF0C7')
root.insert(next(i for i,g in enumerate(root) if g.get('data-name')=='Game lawn with dressed stone rim'),grain)

floor=E.parse(S/'decal-paving.svg').getroot();floor.clear()
floor.attrib.update({'width':'1800','height':'1440','viewBox':'3100 1920 1800 1440'})
g=element('g',data_name='Campfire commons Home stone ring pattern')
floor.append(g)
ellipse(g,4000,2640,850,654,fill='#4AA539',fill_opacity='.24')
ellipse(g,4000,2640,820,628,fill='#B7A1D8',stroke='#39472D',stroke_width=2.2)
courses(g,4000,2640,628/820,[0,240,350,470,590,710,796],48,True)
ellipse(g,4000,2640,240,240*628/820,fill='#E9CD8C',stroke='#8D8057',stroke_width=1.8)
ellipse(g,4000,2640,233,233*628/820,fill='none',stroke='#FFF0C7',stroke_width=4)
ellipse(g,4000,2640,804,804*628/820,fill='none',stroke='#FFF0C7',stroke_width=3)
lights(g,4000,2640,810,628/820,[-165,-135,-105,-75,-45,-15,15,45,75,105,135,165])
for deg in [62,118,242,298]:
    x,y=point(4000,2640,535,628/820,math.radians(deg))
    lozenge(g,x,y,16,12,'#B7A1D8')
    lozenge(g,x,y-27,6,5,'#FFF0C7')
(A/'centre/decal-paving.svg').write_text(E.tostring(floor,encoding='unicode'))

pot=(R/'public/pixi-art/detail/street--planter-flowers.svg').read_text()
pot=pot.replace('#F27E45','#AE8ED5').replace('#F9AC55','#D7CAE8').replace('#ED6A43','#B7A1D8')
(A/'detail/community-rim-planter.svg').write_text(pot)
added=[]
locations=[('campfire-w',3697,3164),('campfire-e',4303,3164),
           ('member-w',1313,2892),('member-e',2327,2892),
           ('game-nw',5363,2538),
           ('market-w',2150,3410),('market-e',2890,3710),
           ('beach-row-w',5050,3410),('beach-row-e',5790,3710)]
def seg(x,y,p,q):
    dx=q[0]-p[0];dy=q[1]-p[1];t=max(0,min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy or 1)))
    return math.hypot(x-p[0]-t*dx,y-p[1]-t*dy)
def pathdist(x,y):
    return min(seg(x,y,p,q)-ww/2 for pts,ww in zip(w['paths'],w['pathWidths']) for p,q in zip(pts,pts[1:]))
beds=read(A/'resolved-sleepers.json')
for label,x,y in locations:
    if pathdist(x,y)<36:continue
    if any(math.hypot(x-b['x'],y-b['y'])<180 or
           (abs(x-b['x'])<95 and y-155<b['y']<y+50) for b in beds):continue
    if any(math.hypot(x-p['x'],y-p['y'])<65 for p in a['props']):continue
    p=dict(id='close-planter-'+label,name='Flower rim planter',src='detail/community-rim-planter.svg',
           x=x,y=y,width=534,height=795,scale=.175,anchor=dict(x=.5,y=1),flip=False,zone='rim',sortY=y)
    a['props'].append(p);added.append(label)
    for data in [w,walk]:data['obstacles'].append(dict(x=x,y=y-5,rx=36,ry=17,communityClose=p['id']))
    if label.startswith('campfire'):
        centre=read(S/'centre.json') if 'centre' not in globals() else centre
        centre['blocked'].append({'ellipse':{'x':x-4000,'y':y-2640-5,'rx':36,'ry':17}})
if 'centre' in globals():(A/'centre/centre.json').write_text(json.dumps(centre,indent=2)+'\n')

for pid,x,y in [('lamp-typing-80',5480,2438),('lamp-typing-81',6120,2438)]:
    p=next(p for p in a['props'] if p['id']==pid);ox,oy=p['x'],p['y']
    for data in [w,walk]:
        for o in data['obstacles']:
            if o.get('x')==ox and abs(o.get('y',0)-oy)<24:
                o['x']=x;o['y']+=y-oy
    p.update(x=x,y=y,sortY=y)

w['props']=a['props']
(A/'ground.svg').write_text(E.tostring(root,encoding='unicode'))
for tile in a['ground']['tiles']:
    root.set('width',str(tile['width']));root.set('height',str(tile['height']))
    root.set('viewBox',f"{tile['x']} {tile['y']} {tile['width']} {tile['height']}")
    (A/tile['src']).write_text(E.tostring(root,encoding='unicode'))
for p,data in [(A/'art.json',a),(D/'world.json',w),(D/'walk-world.json',walk)]:p.write_text(json.dumps(data,indent=2)+'\n')
print('Home stone courses, inset rim lights, lawn texture, path grain, planters:',added)
