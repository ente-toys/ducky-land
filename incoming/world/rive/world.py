"""Native RML island + separate native prop artboards for exact per-frame y sorting.
Only game simulation and renderer transforms live in JS. No scripts or signed build.
"""
import os,json,random,math
import drip_style as D
from drip_style import nid,shape,poly_xml,path_xml,ellipse_pts,fill,stroke,PAL
import gen
with open(os.path.join(os.path.dirname(__file__),'scene.rml')) as f: scene=f.read()
scene=scene.replace('</Rive>','<ComponentAsset name="Drip Ducky" artboardId="0:2"/></Rive>')
open(os.path.join(os.path.dirname(__file__),'scene.rml'),'w').write(scene)
HERE=os.path.dirname(os.path.abspath(__file__))
W,H=5800,4400
R=random.Random(53)
COAST=[(680,1700),(740,1170),(1170,860),(1870,800),(2380,540),(3120,570),(3630,760),(4410,740),(4930,1090),(5100,1660),(5340,2230),(5200,2820),(4870,3190),(4190,3290),(3690,3470),(3150,3310),(2610,3460),(1980,3310),(1290,3200),(870,2800),(620,2280)]
ZONES={
 'plaza':{'x':2820,'y':2410,'spawn':[2820,2640]},
 'pond':{'x':1690,'y':2700,'spawn':[1740,2900]},
 'bread-forest':{'x':1390,'y':1660,'spawn':[1420,1860]},
 'library':{'x':2930,'y':1130,'spawn':[2920,1370]},
 'race-lake':{'x':4120,'y':1600,'spawn':[4140,2020]},
 'lighthouse-beach':{'x':4790,'y':2660,'spawn':[4640,2890]},
 'islets':{'x':3370,'y':3770,'spawn':[3340,3760]}}
# Obstacles mirror actual native ground and foot contacts; broad canopies stay walkable beneath.
waters=[{'x':1640,'y':2630,'rx':420,'ry':250}, {'x':4140,'y':1520,'rx':535,'ry':310}]
bridges=[{'x':1640,'y':2630,'w':920,'h':112}]
props=[]; obs=[]; artboards=[]; components=[]
def place(k,x,y,name='Ground detail'):
    return D.group(name,x,y,k)[1]
def prop(name,x,y,k,rx=0,ry=0,zone='',s=1):
    index=len(props); ab='Prop '+str(index)
    aid=nid(); st=nid(); ca=nid()
    # All prop origins are native ground-contact points; no shape is baked to a bitmap.
    artboards.extend([f'<Artboard name="{ab}" id="{aid}" width="1200" height="1200" x="{6500+(index%12)*1300}" y="{(index//12)*1300}" originX="0.5" originY="0.5" isComponent="true" clip="false" styleId="{st}">',f'<LayoutComponentStyle id="{st}"/>']+k+['</Artboard>'])
    artboards.append(f'<ComponentAsset name="{ab}" artboardId="{aid}"/>')
    components.append((aid,x,y,s))
    props.append({'name':name,'artboard':ab,'x':x,'y':y,'scale':s,'zone':zone,'extent':650})
    if rx: obs.append({'x':x,'y':y-ry*.4,'rx':rx,'ry':ry})
    return index

def inside(x,y):
    odd=False
    for i,p in enumerate(COAST):
        q=COAST[i-1]
        if (p[1]>y)!=(q[1]>y) and x<(q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0]: odd=not odd
    return odd

# Ground TOP FIRST. Paths are drawn from pale fill plus ink edge, no gradients.
ground=[]
walkways=[{'a':[3320,3335],'b':[3320,3710],'w':115},
 {'a':[1130,3080],'b':[950,3400],'w':84},
 {'a':[2320,3280],'b':[2290,3840],'w':84},
 {'a':[3940,3260],'b':[3930,3830],'w':84},
 {'a':[5050,1640],'b':[5450,1680],'w':84}]
for way in walkways[1:]: ground+=D.boardwalk(way['a'],way['b'],way['w'])
# Southern islet boardwalk is native planks and continuous walkable geometry.
for i in range(18):
    yy=3350+i*20
    ground+=place(D.rect('Boardwalk plank',0,0,116,19,'wood',3),3320,yy)
for cx,cy,ww,hh in [(3340,3770,570,350),(3930,3830,300,190),(2290,3840,280,160),(950,3400,250,160),(5450,1680,210,150)]:
    ground+=D.oval('Islet grass',cx,cy,ww*.85,hh*.75,'grass',int(cx))
    ground+=D.oval('Islet sand',cx,cy,ww,hh,'floor',int(cx))
# Pond lily pads and race markings are native shapes on the ground.
for i in range(16):
    a=R.random()*math.tau; rr=R.uniform(.4,.88)
    xx=1640+math.cos(a)*370*rr; yy=2630+math.sin(a)*220*rr
    if abs(yy-2630)>70: ground+=place(D.lily(i,R.uniform(50,80),i%4==0),xx,yy,'Pond lily')
for i in range(10):
    a=i*math.tau/10
    ground+=place(D.buoy('red' if i%2 else 'amber'),4140+math.cos(a)*400,1520+math.sin(a)*205,'Race marker')
for ww in waters:
    for i in range(14):
        xx=ww['x']+R.uniform(-.7,.7)*ww['rx']; yy=ww['y']+R.uniform(-.65,.65)*ww['ry']
        ground+=D.line('Water stroke',[(xx-20,yy),(xx,yy+2),(xx+23,yy)],D.WHITE,2.5)
    ground+=D.oval('Lake water',ww['x'],ww['y'],ww['rx']*2,ww['ry']*2,'water',7,hi=.018)
    ground+=D.oval('Lake bank',ww['x'],ww['y']+7,ww['rx']*2+32,ww['ry']*2+30,'floor',7,hi=.01)
# Race track, concentric ovals tucked outside lake bank.
ground+=D.oval('Race track sand',4140,1520,1340,890,'floor',6,hi=.008)
ground+=D.oval('Race track grassy rim',4140,1520,1410,955,'grass',6,hi=.008)
# plaza centre is broad enough for fountain and market crowd
for i in range(135):
    a=R.random()*math.tau; rr=math.sqrt(R.random())
    ground+=place(D.cobble(R,R.uniform(27,43)),2820+math.cos(a)*650*rr,2390+math.sin(a)*430*rr,'Plaza cobble')
ground+=D.oval('Cream plaza',2820,2390,1450,1010,'floor',11,hi=.012)
# Tree clearing and library hill. Hill contour, stairs and native landing.
for i in range(9): ground+=place(D.rect('Hill stair',0,0,135+i*6,19,'stone',5),2920,1400+i*24)
ground+=D.oval('Library hill top',2910,1120,1020,620,'grass',31,hi=.015)
ground+=D.oval('Library hill side',2930,1170,1090,670,('#6CC24E','#58BF43'),31,hi=.015)
ground+=D.oval('Forest bread crumbs clearing',1400,1770,890,680,('#B5DE82','#8ED66B'),4,hi=.01)
# Paths connect every zone, plus a southern loop. Native broad strokes with round caps.
paths=[[(2820,2460),(2280,2300),(2030,2050),(1490,1890)],[(2810,2220),(2880,1780),(2920,1440)],[(3020,2240),(3370,2030),(3630,2020),(4150,2070)],[(3240,2500),(3780,2720),(4290,2800),(4730,2860)],[(2670,2650),(2290,2880),(1820,2930)],[(1450,1970),(1160,2200),(1130,2650),(1620,2970)],[(1860,2980),(2380,3130),(3050,3080),(3320,3360)],[(3200,3040),(3800,3090),(4310,2890)],[(1680,1760),(2100,1410),(2490,1360)],[(3120,1300),(3480,1160),(3650,1240)]]
for pts in paths:
    ground+=D.line('Footpath',pts,PAL['floor'][0],115)
    ground+=D.line('Footpath ink',pts,D.INK,119)
# Beach shares belly cream with the plaza, with scalloped dry sand.
for i in range(38):
    xx=R.uniform(4360,5120); yy=R.uniform(2330,3060)
    if ((xx-4740)/500)**2+((yy-2660)/510)**2<1:
        ground+=place(D.cobble(R,10),xx,yy,'Beach pebble')
ground+=D.oval('Lighthouse beach',4770,2660,980,1110,'floor',83,hi=.012)
# Grass details stay outside paths' primary axes; deterministic decoration.
for i in range(270):
    x,y=R.uniform(780,5070),R.uniform(850,3270)
    if inside(x,y): ground+=place(D.tuft(R),x,y,'Grass tuft')
for i in range(75):
    x,y=R.uniform(850,5000),R.uniform(900,3200)
    if inside(x,y): ground+=D.oval('Meadow patch',x,y,R.uniform(80,220),R.uniform(25,65),('#8ED66B','#6CC24E'),i,shade=.25,hi=0)
coastgeo=path_xml(COAST)
ground+=[shape('Island ink',0,0,coastgeo,stroke())[1]]
ground+=[shape('Island grass',0,0,coastgeo,fill(PAL['grass'][0]))[1]]
ground+=[shape('Sandy coast',0,32,path_xml([(2800+(x-2800)*1.035,2150+(y-2150)*1.035) for x,y in COAST]),fill(PAL['floor'][0])+stroke())[1]]
ground+=[shape('Shallow coast water',0,50,path_xml([(2800+(x-2800)*1.08,2150+(y-2150)*1.08) for x,y in COAST]),fill('#B5E7F7'))[1]]
for i in range(140):
    x,y=R.uniform(100,5700),R.uniform(100,4300)
    if not inside(x,y): ground+=D.line('Sea ripple',[(x-28,y),(x,y+3),(x+28,y)],'#B5E7F7',2.4)
ground+=[shape('Sea',W/2,H/2,poly_xml([(-W*2,-H*2),(W*2,-H*2),(W*2,H*2),(-W*2,H*2)]),fill('#7FD0F3'))[1]]
# Plaza, faithful to v2: native Drip statue using original vectors.
stone={'#F4D93B':'#E6E2DA','#F2BA3D':'#C7C3BA','#FFF4C5':'#F1EEE8','#FF814A':'#D3CFC7','white':'#FFFFFF','#232323':'#232323'}
items=gen.drawables(gen.svg_file('ducky_base'))[1:]
def recolor(a):
    for it in a:
        if isinstance(it,tuple): recolor(it[1]);recolor(it[2])
        elif it.get('fill') in stone:it.set('fill',stone[it.get('fill')])
recolor(items)
statue=[f'<Node name="Drip fountain statue" id="{nid()}" x="0" y="-45" scaleX="0.3" scaleY="0.3">']+gen.shapes_xml(items,357,776)+['</Node>']
fountain=statue+D.oval('Plinth',0,-28,135,46,'stone2')
for i in range(3): fountain+=D.line('Fountain ripple',[(-130+i*26,-4),(0,20+i*10),(120-i*20,-4)],D.WHITE,2)
fountain+=D.oval('Fountain water',0,-4,370,140,'water')+D.oval('Fountain rim',0,6,420,181,'stone')+D.oval('Fountain basin',0,22,460,205,'stone')
prop('Drip fountain',2820,2350,fountain,245,95,'plaza')
for x,y,col in [(2380,2080,'red'),(2820,1960,'blue'),(3280,2080,'green')]: prop('Market stall',x,y,D.stall(col,285,3),145,60,'plaza')
for x,y in [(2290,2550),(3390,2530),(2730,2810)]: prop('Plaza bench',x,y,D.bench(175),92,23,'plaza')
for x,y in [(2510,2230),(3130,2230),(2440,2770),(3230,2780)]: prop('Plaza lantern',x,y,D.lamp(215),20,18,'plaza')
for x,y in [(2230,2380),(3420,2380),(2650,2050),(3020,2050)]:prop('Flower planter',x,y,D.planter(int(x),85),44,24,'plaza')
# Airborne bunting anchored to market fixtures; all native.
bunt=[]
for i in range(21):
    xx=-320+i*32;yy=-210+40*(1-(xx/320)**2)
    bunt+=place(D.pennant(['red','blue','pink','green','amber'][i%5]),xx,yy)
bunt+=D.line('Market bunting string',[(-320,-210),(0,-170),(320,-210)])
prop('Market bunting',2820,2030,bunt,zone='plaza')
# Pond bridge and marsh, each prop built in style kit.
prop('Lily bridge',1640,2630,D.bridge(920,112),zone='pond')
for x,y in [(1310,2440),(2000,2500),(1460,2870),(1970,2790)]: prop('Pond reeds',x,y,D.reeds(int(x)),zone='pond')
prop('Pond bench',1900,3020,D.bench(175),92,22,'pond')
# Forest alternating bread silhouettes, no ordinary trees disguised as bread.
for i,(x,y) in enumerate([(1020,1460),(1230,1350),(1530,1300),(1770,1460),(1100,1710),(1680,1710),(1000,1990),(1230,2110),(1760,2050),(1910,1800),(1430,1500)]):
    prop('Baguette tree' if i%2 else 'Croissant tree',x,y,D.baguette(i,145) if i%2 else D.croissant(i,190),31,22,'bread-forest')
prop('Forest picnic',1510,2020,D.picnic(),zone='bread-forest')
# Library crowned hill, little reading garden.
prop('Little library',2920,1140,D.library(),245,68,'library')
prop('Outdoor reading',2570,1370,D.picnic(),zone='library')
for x,y in [(2450,1120),(3350,1190)]:prop('Hill tree',x,y,D.tree(int(x),85),30,24,'library')
for x,y in [(2730,1300),(3180,1330)]:prop('Library flowers',x,y,D.planter(int(x),85),42,24,'library')
# Race lake boats, finish gate and boardwalk.
prop('Racing sailboat',4030,1580,D.sailboat('red'),zone='race-lake')
prop('Blue racing sailboat',4410,1470,D.sailboat('blue'),zone='race-lake')
for x in [4050,4260]:prop('Finish pole',x,2070,D.rect('Finish post',0,-94,12,190,'wood',4),18,14,'race-lake')
flags=[]
for i in range(8): flags+=place(D.rect('Finish chequer',0,0,26,24,'white' if i%2 else ('#232323','#232323'),1),-92+i*26,-180)
prop('Race finish banner',4155,2070,flags+D.lettering('WADDLE REGATTA',0,-213,23),zone='race-lake')
prop('Race bench',4610,2000,D.bench(175),92,22,'race-lake')
# Coast, beacon, sand picnic, shells, coast rocks.
prop('Rubber duck lighthouse',4860,2600,D.lighthouse(),105,52,'lighthouse-beach')
for x,y,col in [(4560,2560,'red'),(4960,2920,'blue')]:prop('Beach umbrella',x,y,D.umbrella(col),20,18,'lighthouse-beach')
prop('Beach blanket',4520,2660,D.picnic(),zone='lighthouse-beach')
for i,(x,y) in enumerate([(4380,3020),(5040,2810),(5060,2390),(4650,3060),(4910,3100),(4750,2350)]):prop('Beach shell',x,y,D.shell(i,35),zone='lighthouse-beach')
for x,y in [(5080,2690),(4950,3130),(4420,3150),(5190,2350)]:prop('Coast rock',x,y,D.rock(int(x),100),44,24,'lighthouse-beach')
# Ordinary Drip foliage threads zones together without obscuring paths.
for i,(x,y,r) in enumerate([(2140,1020,75),(2260,1160,60),(840,2320,75),(1070,2900,75),(2110,3130,68),(2550,3260,75),(3520,2890,70),(3880,3230,75),(3760,850,75),(4680,1020,70),(5020,1910,65),(3280,3180,65),(3430,3650,64),(3240,3850,56),(4020,3810,48),(900,3410,45),(5510,1690,36)]):
    prop('Drip tree',x,y,D.tree(i,r),28,20,'islets' if y>3500 else '')
for txt,x,y,z in [('LILY POND',1850,3030,'pond'),('BREAD WOODS',1430,1750,'bread-forest'),('READING HILL',3090,1550,'library'),('DUCKY PLAZA',2810,2910,'plaza'),('BEAK BEACON',4650,2940,'lighthouse-beach'),('LITTLE ISLE',3430,3830,'islets')]:prop('Wayfinding '+txt,x,y,D.sign(txt),15,15,z)
# Export ground and full map artboards. Ground is rendered once per frame behind sorted entities.
gaid=nid();gst=nid()
ground_ab=[f'<Artboard name="Island Ground" id="{gaid}" width="{W}" height="{H}" x="0" y="5000" clip="false" styleId="{gst}">',f'<LayoutComponentStyle id="{gst}"/>']+ground+['</Artboard>']
full=[]
for aid,x,y,s in sorted(components,key=lambda p:-p[2]):
    full.append(f'<NestedArtboard name="Native prop" id="{nid()}" artboardId="{aid}" x="{x}" y="{y}" scaleX="{s}" scaleY="{s}"/>')
# Static overview has Drip residents in every zone too, native stateful components.
for i,(x,y) in enumerate([(2790,2660),(2500,2440),(3200,2390),(1440,1880),(1610,1980),(1810,2920),(1300,2780),(2920,1370),(2650,1450),(4100,2060),(4510,1950),(4700,2860),(4520,2800),(3320,3730)]):
    iid=nid()
    vals={'cap':1+i%13,'shoes':1+i%10,'city':i%4,'action':0,'name':[' pip ',' mo ',' lulu ',' nori '][i%4]}
    inst=[f'<ViewModelInstance name="Resident" id="{iid}" viewModelId="{gen.VM}" exports="true">']+gen.vm_values(vals)+['</ViewModelInstance>']
    full=[f'<NestedArtboard name="Resident" id="{nid()}" artboardId="0:2" isStateful="true" x="{x}" y="{y}" scaleX="0.24" scaleY="0.24">']+inst+['<NestedStateMachine name="Ducky SM" animationId="0:7"/>','</NestedArtboard>']+full
fst=nid();fid=nid()
full_ab=[f'<Artboard name="Island Overview" id="{fid}" width="{W}" height="{H}" x="0" y="10000" clip="true" styleId="{fst}">',f'<LayoutComponentStyle id="{fst}"/>']+full+ground+['</Artboard>']
# Reusing ground lines would duplicate IDs across artboards. Remap every ID declared in clone.
import re
mapping={v:nid() for v in re.findall(r'\bid="([^"]+)"','\n'.join(full_ab))}
joined='\n'.join(full_ab)
# only remap owned ids; references to Ducky/assets/prop ABs stay untouched
for old,new in mapping.items(): joined=joined.replace('"'+old+'"','"'+new+'"')
open(os.path.join(HERE,'island.rml'),'w').write('\n'.join(['<Rive version="1" kind="fragment">']+ground_ab+artboards+[joined,'</Rive>']))
manifest={'width':W,'height':H,'coast':COAST,'water':waters,'bridges':bridges,'obstacles':obs,'props':props,'zones':ZONES,'islets':[[3340,3770,275,164],[3930,3830,140,85],[2290,3840,130,70],[950,3400,115,70],[5450,1680,95,65]],'walkways':walkways,'boardwalk':{'x':3320,'y':3550,'w':115,'h':430}}
open(os.path.join(HERE,'web','world.json'),'w').write(json.dumps(manifest,separators=(',',':')))
print('Built',len(props),'native props;',len(obs),'obstacles; 7 connected zones')
