"""Authored vector drawing first. Does not change the game's art/world manifests.
All scene placements are fixed drawing coordinates; no prop scatter or RNG.
"""
import json,math,os,copy,xml.etree.ElementTree as E
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT)
S=Path('scripts/bigger-pink');A=Path('public/pixi-art/themes/pink');X=A/'expansion';X.mkdir(exist_ok=True)
load=lambda p:json.loads(Path(p).read_text())
old=load(S/'original-art.json');world=load(S/'original-world.json')
coast=[[round(4000+(x-4000)*1.75,2),round(2850+(y-2850)*1.75,2)] for x,y in world['coast']]
# Broaden the lower lobes to hold composed gardens with a safe walking margin.
for pt in coast:
 x,y=pt
 if y>1300:pt[0]+=round(950*max(0,math.sin(math.pi*(y-1300)/5800))*(-1 if x<4000 else 1),2)
# Closed hand-drawn perimeter and paths. The extension keeps the heart silhouette.
def curve(p,closed=True):
 n=len(p);get=lambda i:p[i%n] if closed else p[min(n-1,max(0,i))]
 d='M'+','.join(map(str,p[0]))
 for i in range(n if closed else n-1):
  a,b,c,e=[get(j) for j in [i-1,i,i+1,i+2]]
  d+=f' C{b[0]+(c[0]-a[0])/6:.2f},{b[1]+(c[1]-a[1])/6:.2f} {c[0]-(e[0]-b[0])/6:.2f},{c[1]-(e[1]-b[1])/6:.2f} {c[0]},{c[1]}'
 return d+(' Z' if closed else '')
D=curve(coast)
places=[
 dict(id='atelier',name='Ribbon Atelier Court',x=-100,y=650,crop=True),
 dict(id='conservatory',name='Rose Conservatory',x=2100,y=-180,crop=True),
 dict(id='music-garden',name='Music Garden',x=6100,y=-160,crop=True),
 dict(id='tea-terrace',name='Teacup Terrace',x=8250,y=950,crop=True),
 dict(id='marina',name='Bowboat Marina',x=8610,y=2850,crop=True),
 dict(id='ballet',name='Ballet Lawn',x=6800,y=4660,crop=True),
 dict(id='beach-club',name='Ribbon Beach Club',x=4000,y=6070),
 dict(id='cottage-crescent',name='Dollhouse Crescent',x=1050,y=4550),
 dict(id='nursery',name='Petal Nursery',x=-680,y=2700)]
# Outer promenade is a closed loop. Its width is 2.25x the old 160-unit paths.
loop=[[-350,650],[1550,-100],[2550,150],[4000,560],[5850,100],[7950,700],[8580,1600],[8400,2830],[7410,3870],[6410,4630],[5300,5290],[4000,6010],[2600,5370],[1280,4510],[150,3540],[-650,2700],[-900,1660]]
lanes=[loop+[loop[0]], [[-100,950],[500,1100],[1200,1300]],[[2100,100],[2200,500],[2580,1030]],[[6100,180],[5970,650],[5420,1000]],[[8040,1050],[7520,1430],[6970,1700]],[[8420,2850],[7740,3050],[6860,2800]],[[6800,4800],[6220,4250],[5930,3750]],[[4000,6070],[4000,5520],[4000,4900]],[[1050,4550],[1580,4330],[2300,4290]],[[-680,2700],[0,2800],[900,2780]]]
# Ground material: an explicitly drawn botanical tile, reused as a surface texture.
# This is not a placement generator. Flowers/trees/scene objects are authored below.
texture=''
for x,y in [(44,51),(238,92),(492,38),(743,114),(117,252),(366,201),(628,277),(789,379),(61,479),(279,399),(476,523),(686,493),(385,600),(124,655),(598,685),(783,703)]:
 texture+=f'<path d="M{x-10} {y}q10 -12 20 0m-13 -2q1 -10 5 -12" fill="none" stroke="#669e38" stroke-width="2.4" opacity=".52" stroke-linecap="round"/>'
for x,y in [(173,141),(551,177),(312,320),(720,590),(58,603),(498,424)]:
 texture+=f'<ellipse cx="{x}" cy="{y}" rx="5" ry="2.3" fill="#fce6c7" opacity=".72"/>'
for x,y in [(328,44),(657,375),(177,541),(437,668)]:
 texture+=f'<path d="M{x} {y}v-10m-7 6l7 -3 6 4" fill="none" stroke="#64a43b" stroke-width="2"/><circle cx="{x}" cy="{y-13}" r="4" fill="#f5a3c7"/>'
ground=f'<defs><clipPath id="new-land"><path d="{D}"/></clipPath><pattern id="rose-grass" width="840" height="760" patternUnits="userSpaceOnUse">{texture}</pattern></defs>'
ground+=f'<path d="{D}" fill="#8fc63c" stroke="#ade0e3" stroke-width="135"/><path d="{D}" fill="#8fc63c" stroke="#f9d3dc" stroke-width="82"/><g clip-path="url(#new-land)">'
# Soft irregular mowing and garden tonal patches, drawn at each clearing.
patches=[(-500,200,650,290),(600,-100,630,240),(2050,-350,700,320),(2800,-150,480,240),(5820,-390,700,280),(7180,150,630,300),(8360,580,650,400),(8960,1920,500,410),(8220,3370,510,340),(7080,4250,650,280),(6000,4800,650,290),(4620,5740,630,290),(3370,5740,630,270),(1790,4790,570,260),(500,3890,520,290),(-900,2960,460,350),(-1180,1670,400,300)]
for x,y,rx,ry in patches:
 pts=[[x-rx,y],[x-rx*.6,y-ry*.8],[x+rx*.2,y-ry],[x+rx,y-ry*.3],[x+rx*.7,y+ry*.7],[x-rx*.2,y+ry]]
 ground+=f'<path d="{curve(pts)}" fill="#b5d953" opacity=".4"/>'
ground+=f'<path d="{D}" fill="url(#rose-grass)"/>'
for pts in lanes:
 d=curve(pts,False);ground+=f'<path d="{d}" fill="none" stroke="#d5b880" stroke-opacity=".2" stroke-width="394" stroke-linecap="round"/><path d="{d}" fill="none" stroke="#fbe6c8" stroke-width="360" stroke-linecap="round" stroke-linejoin="round"/>'
# Each destination has its own court, garden or sand shape, not a stripe of paving.
for p in places:
 x,y=p['x'],p['y'];kind=p['id'];rx,ry=(700,410) if kind in ['atelier','tea-terrace','ballet'] else (620,350)
 color='#f9d3dc' if kind in ['beach-club','nursery'] else '#fcebd6'
 ground+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{color}" stroke="#e9cda9" stroke-width="8"/>'
 if kind not in ['beach-club','nursery']:
  # Court pavers follow the plane. Irregular spacing, not long road stripes.
  for dy,xx in [(-220,460),(-105,590),(25,610),(165,540),(280,360)]:ground+=f'<path d="M{x-xx} {y+dy}Q{x} {y+dy+36} {x+xx} {y+dy}" fill="none" stroke="#e6c59d" stroke-width="3" opacity=".72"/>'
  for dx in [-390,-130,165,410]:ground+=f'<path d="M{x+dx} {y-260}Q{x+dx-60} {y} {x+dx+15} {y+260}" fill="none" stroke="#e6c59d" stroke-width="3" opacity=".65"/>'
# Broad open ballet lawn in front of a small stage, not a second centre replacement.
ground+='<path d="M6050 4760Q6800 4480 7440 4800L7010 5300Q6610 5510 6250 5160Z" fill="#a8d249"/><path d="M6050 4760Q6800 4480 7440 4800L7010 5300Q6610 5510 6250 5160Z" fill="url(#rose-grass)"/>'
# New south beach apron.
ground+='<path d="M3100 5900Q4000 5620 4900 5900L4250 6690Q4000 6850 3750 6690Z" fill="#f9d3dc"/>'
ground+='</g>'
# All old dry ground stays at the exact coordinates. Remove only former offshore wave/wet-coast decoration.
root=E.parse(A/'ground.svg').getroot();original=[]
for i,e in enumerate(root):
 if i<121:continue
 if e.attrib.get('data-name') in ['Round 4 wet coasts','Offshore wave ticks']:continue
 original.append(E.tostring(e,encoding='unicode'))
# The original SVG defs are kept with their original shape ids.
oldground=''.join(original)
props=[];obstacles=[];flats=[]
def kit(src,x,y,zone,scale=1,flip=False,solid=True):
 p=copy.deepcopy(next(p for p in old['props'] if p['src']=='detail/'+src+'.svg'));p.update(id=f"big-pink-{len(props)}",x=x,y=y,zone=zone,flip=flip);p['scale']*=scale;props.append(p)
 if solid:
  # Footprint fits the visible base of each original asset; same ratios as its old copy.
  dims={'dollhouse-pink':(.43,.18),'dollhouse-lilac':(.43,.18),'cottage-pink':(.43,.18),'teacup-cafe':(.43,.18),'tree-cherry':(.08,.06),'tree-willow':(.08,.06),'lamp-heart':(.12,.08),'bow-bench':(.42,.18),'heart-hedge':(.4,.16),'mailbox':(.18,.13),'parasol':(.08,.06),'candy-cart':(.4,.14),'play-tower':(.22,.15),'sandcastle-pink':(.35,.2),'bush-pink':(.36,.2),'flowers-pink':(.3,.14),'lounger':(.3,.15),'pink-car':(.38,.15)}
  if src in dims:
   w=p['width']*p['scale'];rx,ry=dims[src];obstacles.append(dict(x=x,y=y-w*ry*.5,rx=w*rx,ry=w*ry,name=p['id']))
 return p
# Garden borders are authored little groups with open entrances and planting behind seating.
def bed(x,y,zone,flip=False):
 kit('heart-hedge',x,y,zone,.95,flip)
 kit('flowers-pink',x-58,y+20,zone,.9,solid=False);kit('flowers-pink',x+55,y+24,zone,1.1,True,solid=False)
def seat(x,y,zone,flip=False):
 kit('bow-bench',x,y,zone,1,flip);kit('lamp-heart',x-118 if not flip else x+118,y-25,zone,.9)
def tree(x,y,zone,willow=False,scale=1):kit('tree-willow' if willow else 'tree-cherry',x,y,zone,scale)
# 1. Ribbon atelier: two dollhouses, fitting court, ribbon table, parcels and a car bay.
z='atelier';kit('dollhouse-pink',-390,420,z,.94);kit('dollhouse-lilac',280,365,z,.82);kit('mailbox',-610,610,z);kit('pink-car',475,810,z,.85);kit('candy-cart',-450,920,z,.9);seat(90,970,z);tree(-810,490,z);tree(690,390,z);bed(-680,850,z);bed(520,1080,z);bed(50,1100,z)
# 2. Rose conservatory: domed glasshouse and two curved planted wings.
z='conservatory';tree(1320,-300,z);tree(2800,-400,z);tree(2980,20,z,False,.85)
for x,y in [(1490,-90),(1680,-300),(2460,-310),(2720,-100),(1560,200),(2660,210)]:bed(x,y,z)
seat(1720,200,z);seat(2470,235,z,True);kit('mailbox',2230,-120,z,.8)
# 3. Music garden: gazebo, tea blankets, winding rose beds and two listening terraces.
z='music-garden';kit('gazebo',6100,-380,z,1.15,solid=False);seat(5580,-70,z);seat(6580,-70,z,True);kit('picnic-blanket',5780,310,z,1.2,solid=False);kit('picnic-blanket',6420,370,z,1.1,True,solid=False);tree(5360,-390,z);tree(6850,-300,z);bed(5530,410,z);bed(6730,270,z);bed(5870,-500,z);bed(6380,-490,z)
# 4. Tea terrace: cafe and separate clusters of tables facing a rose courtyard.
z='tea-terrace';kit('teacup-cafe',8170,680,z,.95);kit('candy-cart',8810,950,z,.9);kit('parasol',7900,1110,z,.85);kit('parasol',8440,1250,z,.9);kit('parasol',8090,1380,z,.8);seat(8710,1310,z,True);tree(7490,700,z);tree(8890,660,z);bed(7600,1190,z);bed(8910,1190,z);bed(8540,570,z)
# 5. Marina: pavilion, beach chairs, parcel office and open jetty approach.
z='marina';kit('gazebo',8570,2450,z,.95,solid=False);kit('cottage-pink',9120,2770,z,.8);kit('mailbox',9330,2870,z,.9);kit('lounger',8230,3070,z,1);kit('lounger',8500,3230,z,1,True);kit('parasol',8280,3000,z,.9);seat(8810,3170,z,True);tree(7980,2520,z,True);bed(8970,3250,z);bed(8130,2770,z)
# 6. Ballet lawn: small ribbon stage and semicircular audience, with wide dancing grass.
z='ballet';seat(6560,4770,z);seat(6500,5000,z);seat(7050,5010,z,True);seat(7310,4800,z,True);tree(6550,4330,z);tree(7550,4440,z);bed(6450,4370,z);bed(7240,4360,z);kit('candy-cart',7470,4890,z,.9);kit('picnic-blanket',6780,5310,z,1.2,solid=False)
# 7. Beach club: changing cottage, shell kiosk, sandcastles and parasol lounge.
z='beach-club';kit('cottage-pink',3620,5880,z,.8);kit('candy-cart',4380,5930,z,.9);kit('sandcastle-pink',3980,6340,z,1.1);kit('parasol',3430,6190,z,.9);kit('parasol',4490,6230,z,.9);kit('lounger',3520,6380,z,1,True);kit('lounger',4390,6420,z);kit('swim-ring',4130,6580,z,.9,solid=False);tree(3060,5770,z);tree(4900,5740,z);bed(3270,5980,z);bed(4710,6010,z)
# 8. Crescent: three separate front gardens on a curved village lane.
z='cottage-crescent';kit('dollhouse-lilac',600,4200,z,.86);kit('cottage-pink',1170,4260,z,1);kit('dollhouse-pink',1460,4130,z,.85);kit('mailbox',430,4390,z);kit('mailbox',1550,4650,z);seat(1000,4800,z);tree(130,4320,z);tree(1460,4830,z);bed(440,4680,z);bed(1430,4880,z);bed(1430,4280,z);kit('pink-car',670,4870,z,.8)
# 9. Nursery: miniature playhouse, flower potting area, swing and picnic court.
z='nursery';kit('play-tower',-950,2470,z,.9);kit('swing-set',-350,2420,z,.9,solid=False);kit('cottage-pink',-1160,2980,z,.7);kit('picnic-blanket',-380,2940,z,1.1,solid=False);seat(-580,3150,z);tree(-1400,2420,z);tree(-60,2400,z);bed(-1170,2230,z);bed(-70,2850,z);bed(-960,3220,z);kit('sandcastle-pink',-620,2800,z,.8)
# Fixed garden wings, small tree groves and planted verges, drawn per destination.
# These are scene compositions with named coordinates, not a land-fill algorithm.
garden_wings={
 'atelier':[(-790,1080),(-510,1170),(285,1120),(670,900),(-540,190),(80,140)],
 'conservatory':[(1350,100),(1350,380),(2780,390),(2930,180),(1720,-500),(2470,-520)],
 'music-garden':[(5260,120),(5410,540),(5700,500),(6480,670),(6930,400),(6970,80)],
 'tea-terrace':[(7390,1030),(7520,1430),(7820,1540),(8600,1520),(9120,1310),(9020,430)],
 'marina':[(7940,3000),(8000,3320),(8380,3460),(8860,3500),(9310,3120),(9420,2660)],
 'ballet':[(6000,4850),(6140,5170),(6470,5260),(6880,5170),(7210,4980),(7500,4660)],
 'beach-club':[(3010,6030),(3300,6250),(3590,6420),(4350,6420),(4610,6250),(5010,6030)],
 'cottage-crescent':[(260,4140),(330,4480),(830,4860),(1150,4910),(1640,5010),(2050,4850)],
 'nursery':[(-1500,2700),(-1410,3100),(-1090,3430),(-650,3470),(-160,3230),(0,2650)]}
for zone,coords in garden_wings.items():
 for x,y in coords:bed(x,y,zone)
# Trees frame clearings in asymmetrical groups, leaving the broad loop open.
for zone,coords in {
 'atelier':[(-1050,680),(-920,890),(750,620),(650,150)],
 'conservatory':[(1050,-320),(1240,-580),(3040,-250),(3150,60)],
 'music-garden':[(5050,-120),(5220,-510),(7100,-100),(7280,240)],
 'tea-terrace':[(7280,470),(9150,850),(9180,1090),(7660,290)],
 'marina':[(7800,2320),(7920,2150),(9540,2600),(9600,2910)],
 'ballet':[(6500,5430),(6050,5260),(7650,4350),(7630,4530)],
 'beach-club':[(2850,5690),(2990,5470),(5040,5480),(5190,5680)],
 'cottage-crescent':[(20,4060),(210,3880),(1470,3920),(1370,5020)],
 'nursery':[(-1560,2150),(-1670,2550),(130,2170),(280,2450)]}.items():
 for i,(x,y) in enumerate(coords):tree(x,y,zone,willow=zone=='marina' and i<2,scale=.82 if i%2 else 1)
# Individual low flowers and gravel do not obstruct walking.
for zone,coords in {
 'atelier':[(-300,1040),(-160,1100),(380,1000),(550,1190)],
 'conservatory':[(1460,490),(1610,550),(2530,540),(2690,490)],
 'music-garden':[(5500,600),(5740,560),(6590,740),(6790,630)],
 'tea-terrace':[(7570,1600),(7750,1670),(8690,1660),(8860,1580)],
 'marina':[(8130,3560),(8290,3630),(9080,3500),(9260,3390)],
 'ballet':[(6250,5310),(6410,5380),(6890,5300),(6990,5030)],
 'beach-club':[(3420,6360),(3650,6600),(4290,6580),(4520,6370)],
 'cottage-crescent':[(710,4890),(920,5000),(1620,5130),(1810,5060)],
 'nursery':[(-1260,3530),(-1100,3620),(-230,3480),(-70,3320)]}.items():
 for x,y in coords:kit('flowers-pink',x,y,zone,1.15,solid=False)
# Custom theme-native pieces, all split as standing/deck art where appropriate.
def custom(name,x,y,w,h,body,zone,foot=None):
 # Small authored details use the same cream highlights, dark olive ink,
 # scalloped rose shapes and two-tone sides as the original dollhouse kit.
 detail=''
 if name=='rose-glasshouse':
  detail+='<path d="M46 551Q335 609 624 551M46 565Q335 623 624 565" fill="none" stroke="#fff0c7" stroke-width="5"/><path d="M280 585V436Q335 385 390 436V585M335 412V597" fill="none" stroke="#b36f92" stroke-width="5"/><circle cx="350" cy="498" r="5" fill="#d6b85c"/><path d="M272 607L398 607L420 618L252 618Z" fill="#fff0c7"/>'
  for px,py in [(93,426),(180,465),(482,465),(566,426)]:
   detail+=f'<path d="M{px-26} {py+35}l7 47q19 10 38 0l7-47Z" fill="#d98fa9"/><ellipse cx="{px}" cy="{py+35}" rx="28" ry="9" fill="#fcebd6"/><path d="M{px} {py+33}q-26-25-16-67m17 56q27-22 15-65" fill="none" stroke="#5c8b36" stroke-width="5"/>'
   for dx,dy in [(-16,-38),(15,-42),(0,-9)]:
    detail+=f'<path d="M{px+dx-13} {py+dy}q-6-13 5-17q6-9 14-2q15 0 10 13q5 11-9 14q-13 8-20-8Z" fill="#f5a3c7"/><path d="M{px+dx-6} {py+dy-4}q11-10 12 2q-8 8-12-2Z" fill="#ec6fa8"/>'
  detail+='<path d="M158 205Q335 270 516 205M99 264Q335 333 574 264" fill="none" stroke="#fff0c7" stroke-width="3" opacity=".7"/>'
 if name=='ribbon-stage':
  detail+='<path d="M54 327Q325 402 599 327M54 356Q325 432 599 356" fill="none" stroke="#fff0c7" stroke-width="4"/><path d="M102 137Q134 153 164 142M132 127Q160 139 186 127M508 137Q476 153 446 142M478 127Q450 139 424 127" fill="none" stroke="#fff0c7" stroke-width="4"/><path d="M211 39q19 37 61 23M359 29q-17 36-69 37M275 77l-15 44m36-42l2 43" fill="none" stroke="#d98fa9" stroke-width="4"/>'
  for px in [90,155,220,285,350,415,480,545]:
   yy=354+int(40*(1-((px-325)/300)**2))
   detail+=f'<path d="M{px} {yy-20}v25" stroke="#cb7f9c"/><circle cx="{px+20}" cy="{yy-8}" r="5" fill="#fff0c7" stroke="none"/>'
 if name=='ribbon-worktable':
  detail+='<path d="M33 145l8 23m167-27l-4 26M35 96l29 20m116-23l20 18" stroke="#fff0c7" stroke-width="4"/><path d="M39 106l7 10 7-10m116 6l6 8 6-8" fill="none" stroke="#d6b85c"/><ellipse cx="178" cy="108" rx="10" ry="5" fill="#d6b85c"/><path d="M188 109l24 10m-36-8l-16 13" fill="none"/>'
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><g stroke="#39472d" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">{body}{detail}</g></svg>'
 (X/(name+'.svg')).write_text(svg);props.append(dict(id='big-pink-'+name,name=name,src='expansion/'+name+'.svg',x=x,y=y,width=w,height=h,anchor=dict(x=.5,y=1),scale=1,zone=zone,shadow=False))
 if foot:obstacles.append(dict(x=x,y=y-foot[1]*.6,rx=foot[0],ry=foot[1],name='big-pink-'+name))
custom('ribbon-worktable',-100,730,250,180,'<path d="M30 115v60m188-60v60" stroke-width="10"/><path d="M10 90L180 72L242 115L70 140Z" fill="#fcebd6"/><path d="M73 100q40-40 80 3q-32 31-80-3Z" fill="#f5a3c7"/><path d="M112 99q-45-68-65-21q0 30 65 21q65-50 74-11q3 34-74 11Z" fill="#ec6fa8"/><path d="M105 103l-40 51 38-7 19 18 12-56" fill="#f5a3c7"/><path d="M190 67v35m-17-22h34" stroke="#d6b85c" stroke-width="9"/>','atelier',(103,25))
custom('rose-glasshouse',2100,-180,670,620,'<path d="M30 330Q50 115 335 48Q620 115 640 330V580Q335 640 30 580Z" fill="#f6d4e2"/><path d="M54 324Q76 144 335 76Q591 146 616 324V557Q335 613 54 557Z" fill="#c7e8da"/><path d="M335 76V592M54 324Q335 393 616 324M130 245V574M235 128V589M435 128V589M540 245V574" fill="none" stroke="#ce8eaa" stroke-width="10"/><path d="M260 590V425Q335 352 410 425V590" fill="#fbe6c8" stroke="#ce8eaa" stroke-width="9"/><path d="M335 72V25m-25 10h50" stroke="#d8b969" stroke-width="10"/><path d="M104 337L289 124M400 116L572 312M75 480L190 375M450 494L575 381" stroke="#fff9ec" stroke-width="9" opacity=".8"/><path d="M8 574Q335 650 662 574L660 602Q335 675 10 602Z" fill="#e9a9bc"/>','conservatory')
# Glasshouse is enterable: only the two low planting wings obstruct.
obstacles.extend([dict(x=1840,y=-245,rx=65,ry=42,name='glasshouse-west-planter'),dict(x=2360,y=-245,rx=65,ry=42,name='glasshouse-east-planter')])
custom('ribbon-stage',6800,4560,650,420,'<path d="M30 315Q325 235 620 315V367Q325 450 30 367Z" fill="#e9a9bc"/><path d="M30 315Q325 235 620 315Q325 404 30 315Z" fill="#fcebd6"/><path d="M70 305V105M580 305V105" stroke="#d6b85c" stroke-width="14"/><path d="M38 100Q325-18 612 100L580 130Q325 40 70 130Z" fill="#f5a3c7"/><path d="M75 128Q174 80 250 89Q185 171 95 244Z M575 128Q476 80 400 89Q465 171 555 244Z" fill="#ec6fa8"/><path d="M280 66q-70-78-90-20q5 51 90 20q88-67 95-13q-2 50-95 13Z" fill="#fcebd6"/><path d="M261 69l-25 75 44-18 29 24 8-81" fill="#fcebd6"/><path d="M228 373L422 373L450 398L200 398Z" fill="#fff0c7"/>','ballet')
# Walkable stage deck. Curtain posts block, the audience lawn stays clear.
obstacles.extend([dict(x=6545,y=4445,rx=14,ry=14,name='stage-post-left'),dict(x=7055,y=4445,rx=14,ry=14,name='stage-post-right')])
# Gazebo posts, swings and tower uprights block only their visible supports.
for p in props:
 if p['src']=='detail/gazebo.svg':
  for dx in [-.31,.31]:obstacles.append(dict(x=p['x']+p['width']*p['scale']*dx,y=p['y']-26,rx=14,ry=12,name=p['id']+'-post'))
 if p['src']=='detail/swing-set.svg':
  for dx in [-.43,.43]:obstacles.append(dict(x=p['x']+p['width']*p['scale']*dx,y=p['y']-14,rx=16,ry=14,name=p['id']+'-leg'))
# Shore walk is set just inside the full new coast, connected to the place loop.
shore=[[4000+(x-4000)*.947,2850+(y-2850)*.947] for x,y in coast]
shoreD=curve(shore)
shoreArt=f'<path d="{shoreD}" fill="none" stroke="#e9cda9" stroke-opacity=".25" stroke-width="168"/><path d="{shoreD}" fill="none" stroke="#fbe6c8" stroke-width="140"/>'
# Add coastal walk under original land, so every old ground pixel remains unchanged.
ground=ground.replace('</g>',shoreArt+'</g>',1)
combined=ground+oldground
svg=lambda body,vb,w,h:f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">{body}</svg>'
(X/'ground-source.svg').write_text(svg(combined,'-2600 -1900 13200 9800',13200,9800))
# Design manifest is independent from the game. The game still loads original-art.json.
art=copy.deepcopy(old);art.update(width=13200,height=9800,origin=dict(x=-2600,y=-1900));art['ground']={'tiles':[dict(src='expansion/ground-source.svg',x=-2600,y=-1900,width=13200,height=9800)]};art['props']+=props
(S/'drawing-art.json').write_text(json.dumps(art,indent=1))
layout=dict(origin=dict(x=-2600,y=-1900),width=13200,height=9800,coast=coast,shoreWalk=shore,paths=lanes,places=places,props=props,obstacles=obstacles)
(S/'layout.json').write_text(json.dumps(layout,indent=1));(S/'ground-body.svg').write_text(combined)
print('Authored nine-place drawing:',len(props),'new props,',len(obstacles),'visible footprints. Game manifests unchanged.')
