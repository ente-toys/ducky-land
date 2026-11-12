"""Five authored neighbourhoods. Drawing is saved before production manifests change.
Coordinates define homes, gardens, work and civic space. Only surface marks repeat.
"""
from pathlib import Path
import json, copy, math, os
ROOT=Path(__file__).resolve().parents[2];os.chdir(ROOT)
S=Path('scripts/bigger-pink');A=Path('public/pixi-art/themes/pink');X=A/'expansion'
read=lambda p:json.loads(Path(p).read_text())
old=read(S/'original-art.json');w=read(S/'original-world.json');base=read(S/'layout.json')
coast=base['coast'];shore=base['shoreWalk'];props=[];obstacles=[];homes=[]
def curve(p,closed=True):
 n=len(p);get=lambda i:p[i%n] if closed else p[min(n-1,max(0,i))]
 d='M'+','.join(map(str,p[0]))
 for i in range(n if closed else n-1):
  a,b,c,e=[get(j) for j in [i-1,i,i+1,i+2]]
  d+=f' C{b[0]+(c[0]-a[0])/6:.2f},{b[1]+(c[1]-a[1])/6:.2f} {c[0]-(e[0]-b[0])/6:.2f},{c[1]-(e[1]-b[1])/6:.2f} {c[0]},{c[1]}'
 return d+(' Z' if closed else '')
def piece(name,width,height,body):
 (X/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><g stroke="#39472d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">{body}</g></svg>')
def custom(src,x,y,z,width,height,rx=0,ry=0):
 p=dict(id=f'community-pink-{len(props)}',name=src,src=f'expansion/{src}.svg',x=x,y=y,width=width,height=height,anchor=dict(x=.5,y=1),scale=1,zone=z,shadow=False);props.append(p)
 if rx:obstacles.append(dict(x=x,y=y-ry*.3,rx=rx,ry=ry,name=p['id']))
 if src=='washing-line':
  for dx in [-.46,.45]:obstacles.append(dict(x=x+width*dx,y=y-6,rx=10,ry=10,name=p['id']+'-post'))
 return p
def kit(src,x,y,z,scale=1,flip=False,solid=True):
 p=copy.deepcopy(next(p for p in old['props'] if p['src']==f'detail/{src}.svg'))
 p.update(id=f'community-pink-{len(props)}',x=x,y=y,zone=z,flip=flip);p['scale']*=scale;props.append(p)
 dims={'dollhouse-pink':(.43,.18),'dollhouse-lilac':(.43,.18),'cottage-pink':(.43,.18),'teacup-cafe':(.43,.18),'tree-cherry':(.08,.06),'tree-willow':(.08,.06),'lamp-heart':(.12,.08),'bow-bench':(.42,.18),'heart-hedge':(.4,.16),'mailbox':(.18,.13),'parasol':(.08,.06),'candy-cart':(.4,.14),'play-tower':(.22,.15),'sandcastle-pink':(.35,.2),'bush-pink':(.36,.2),'lounger':(.3,.15),'pink-car':(.38,.15)}
 if solid and src in dims:
  width=p['width']*p['scale'];rx,ry=dims[src];obstacles.append(dict(x=x,y=y-width*ry*.5,rx=width*rx,ry=width*ry,name=p['id']))
 return p
piece('garden-fence',290,78,'<path d="M8 40Q145 58 282 40M8 59Q145 77 282 59" fill="none" stroke="#bb8b94" stroke-width="12"/><path d="M8 40Q145 58 282 40M8 59Q145 77 282 59" fill="none" stroke="#fff0c7" stroke-width="7"/>'+''.join(f'<path d="M{x} 20v49" stroke="#39472d" stroke-width="13"/><path d="M{x} 20v49" stroke="#fff0c7" stroke-width="8"/><path d="M{x-7} 15q-8-13 0-15q8-3 10 5q5-10 12-4q6 8-15 19Z" fill="#f5a3c7" stroke-width="2"/>' for x in [16,82,151,216,274]))
piece('washing-line',310,138,'<path d="M12 12v119M296 12v119" stroke="#a37a59" stroke-width="7"/><path d="M12 22Q152 67 296 22" fill="none" stroke="#39472d" stroke-width="2"/><path d="M55 34l27 7 15-8 25 15-12 24-12-8-7 50-45-8 9-47-12 3-5-17Z" fill="#f6d4e2"/><path d="M146 49l46 1 5 70-53-1Z" fill="#fff0c7"/><path d="M217 40l31-4 21 59-43 9Z" fill="#cbb6df"/><path d="M59 34v10m36-2v12m54-6v11m39-12v12m34-20v9m21-13v9" stroke="#a37a59" stroke-width="4"/><path d="M153 68h30m-29 16h30M230 57l15 39" stroke="#e9a9bc" stroke-width="3"/>')
piece('doorstep',130,44,'<path d="M20 8Q66 1 110 8l13 20Q66 43 7 28Z" fill="#e9a9bc"/><path d="M22 5Q66-1 108 5L118 19Q66 32 12 19Z" fill="#fff0c7"/><path d="M27 14l77 2" stroke="#d8b969"/>')
piece('ribbon-sign',170,166,'<path d="M85 47v111" stroke="#a37a59" stroke-width="10"/><path d="M8 20Q85 2 162 20l-9 66Q86 102 17 86Z" fill="#fff0c7"/><path d="M80 47q-36-36-43-9q0 23 43 9q43-37 49-9q0 27-49 9Z" fill="#ec6fa8"/><path d="M75 50l-14 31 21-9 14 11 4-35" fill="#f5a3c7"/><path d="M27 25q58-12 116-1" fill="none" stroke="#e9a9bc"/>')
piece('parcel-stack',170,125,'<path d="M8 67l69-14 39 30-69 20Z" fill="#fcebd6"/><path d="M8 67v36l39 20V103m0 0 69-20v36l-69 4" fill="#e9a9bc"/><path d="M85 29l47-15 30 22-47 15Z" fill="#fff0c7"/><path d="M85 29v40l30 17V51m0 0 47-15v39l-47 11" fill="#f5a3c7"/><path d="M112 21l32 21v38M31 62l41 31v26" stroke="#cbb6df" stroke-width="9"/><path d="M118 25q-22-28-23-10q4 14 23 10q20-28 24-11q0 15-24 11Z" fill="#fff0c7"/>')
piece('potting-bench',260,174,'<path d="M24 111v56m211-56v56" stroke="#a37a59" stroke-width="10"/><path d="M8 93l172-20 70 34-173 23Z" fill="#fcebd6"/><path d="M15 109l62 22 165-20v18L77 150l-62-23Z" fill="#cf9f75"/><path d="M44 67l11 35q21 10 43-3l5-38Z" fill="#e9a9bc"/><ellipse cx="74" cy="65" rx="31" ry="10" fill="#fff0c7"/><path d="M73 62V18m0 27q-35-8-22-26q21 0 22 26m0-10q29 3 29-23q-23-6-29 23" fill="#8fc63c"/><path d="M144 64l8 35 45-7 3-38Z" fill="#f5a3c7"/><ellipse cx="172" cy="55" rx="29" ry="9" fill="#fff0c7"/><path d="M171 54V18" stroke="#699939" stroke-width="5"/><path d="M171 25q-27-5-20-20q14-10 20 5q13-20 25-4q4 15-25 19Z" fill="#ec6fa8"/><path d="M109 99l26-4m-8-7l2 21" stroke="#a37a59" stroke-width="5"/>')
piece('tea-table',170,148,'<path d="M86 75v59m-32 8 32-9 34 5" fill="none" stroke="#a37a59" stroke-width="9"/><ellipse cx="85" cy="69" rx="79" ry="27" fill="#fcebd6"/><ellipse cx="85" cy="63" rx="79" ry="27" fill="#fff0c7"/><path d="M43 42q-1 27 20 25q19-2 17-27Z" fill="#f5a3c7"/><path d="M80 45q25-7 18 9q-4 8-19 4" fill="none"/><ellipse cx="61" cy="42" rx="19" ry="7" fill="#a37a59"/><path d="M112 55q4-31 22-24q13 14-2 29Z" fill="#f5c45b"/><path d="M104 66l40-2" stroke="#e9a9bc" stroke-width="5"/>')
piece('music-rack',205,180,'<path d="M27 48v119m147-119v119M27 58H174" stroke="#a37a59" stroke-width="7"/><path d="M46 64v77q-30-8-23-29q4-13 23-12M132 63v65q-29 13-21 28q10 13 26-3V83l25-9" fill="#cbb6df"/><path d="M68 67l48-8 6 47-48 7Z" fill="#fff0c7"/><path d="M79 77l28-5m-27 13 28-5m-27 13 27-5" stroke="#d0a0b5" stroke-width="2"/><path d="M153 42q-26-36-33-17q-2 22 33 17q33-33 39-12q-1 20-39 12Z" fill="#f5a3c7"/>')
places=[
 dict(id='ribbonwick',name='Ribbonwick Row',x=700,y=570,crop=True,arrival=[700,620],residents='Ribbon tailors and bow makers',work='Ribbon cutting tables and a shared fitting court'),
 dict(id='melody',name='Chirrup Mews',x=6200,y=370,crop=True,arrival=[6200,500],residents='Music-box players and instrument menders',work='Rehearsal bandstand and instrument workshop'),
 dict(id='quay',name='Teacup Quay',x=8650,y=2100,crop=True,arrival=[8650,2100],residents='Tea bakers, parcel boat crews and cafe families',work='Teacup cafe, tea court, packing desk and working marina'),
 dict(id='petalpatch',name='Petalpatch Close',x=-650,y=2700,crop=True,arrival=[-650,2700],residents='Rose growers and nursery families',work='Rose glasshouse, potting yard and flower beds'),
 dict(id='tutu',name='Tutu Tides',x=4000,y=6070,crop=True,arrival=[4000,6110],residents='Ballet dancers and beach costume stitchers',work='Ribbon rehearsal stage and seaside costume table')]
def home(src,x,y,z,scale=1,life='line'):
 p=kit(src,x,y,z,scale);p['household']=True;homes.append(p['id'])
 custom('doorstep',x,y+30,z,130,44)
 kit('mailbox',x-150,y+95,z,.64)
 kit('flowers-pink',x+145,y+85,z,.92,solid=False)
 custom('garden-fence',x-150,y+180,z,220,60,96,13)
 custom('garden-fence',x+153,y+180,z,190,53,84,12)
 if life=='line':custom('washing-line',x+180,y-60,z,240,107,0,0)
 elif life=='parcels':custom('parcel-stack',x+200,y+30,z,130,96,50,18)
 elif life=='music':custom('music-rack',x+220,y+20,z,150,132,54,14)
 elif life=='pot':custom('potting-bench',x+210,y+20,z,185,124,72,19)
 return p
z='ribbonwick'
for src,x,y,sc,life in [('dollhouse-pink',-510,40,.88,'line'),('dollhouse-pink',130,-160,.92,'parcels'),('dollhouse-pink',810,-140,.9,'line'),('dollhouse-lilac',1520,30,.87,'line'),('dollhouse-pink',2190,130,.9,'parcels'),('cottage-pink',-470,980,.85,'line'),('cottage-pink',330,1180,.85,'pot')]:home(src,x,y,z,sc,life)
for x,y in [(550,500),(940,630),(1810,390)]:custom('ribbon-worktable',x,y,z,250,180,103,25)
kit('candy-cart',1050,850,z,.95);kit('pink-car',1850,570,z,.9)
for x,y in [(80,610),(1250,570)]:kit('bow-bench',x,y,z);kit('lamp-heart',x-140,y-40,z,.9)
custom('ribbon-sign',550,850,z,170,166,18,13)
z='melody'
for x,y,sc in [(5210,-30,.9),(5800,-240,.87),(6420,-170,.91),(7010,30,.88),(7460,580,.85)]:home('dollhouse-lilac',x,y,z,sc,'music')
custom('ribbon-stage',6200,380,z,650,420)
for dx in [-255,255]:obstacles.append(dict(x=6200+dx,y=265,rx=14,ry=14,name='melody-stage-post'))
for x,y in [(5800,660),(6520,690)]:kit('bow-bench',x,y,z);kit('lamp-heart',x-120,y-30,z,.9)
kit('picnic-blanket',6860,600,z,1.2,solid=False);custom('music-rack',5430,560,z,205,180,75,18)
z='quay'
for x,y,sc in [(7970,1260,.88),(8600,1510,.9),(9240,1740,.88),(9250,2360,.87),(8830,2890,.9),(8170,2780,.85)]:home('cottage-pink',x,y,z,sc,'parcels')
kit('teacup-cafe',8410,820,z,.98)
for x,y in [(8120,1100),(8580,1140),(8890,970)]:custom('tea-table',x,y,z,170,148,68,22)
kit('parasol',8380,1230,z,.82)
custom('ribbon-worktable',8950,2130,z,250,180,103,25)
custom('parcel-stack',9270,2700,z,170,125,65,20);custom('parcel-stack',9460,2830,z,170,125,65,20)
for x,y in [(8260,2230),(8870,2450)]:kit('bow-bench',x,y,z);kit('lamp-heart',x-120,y-30,z,.9)
custom('ribbon-sign',9500,2840,z,170,166,18,13)
z='petalpatch'
for x,y,sc in [(-1210,2080,.85),(-650,2050,.88),(-60,2160,.86),(-1150,3180,.85),(-480,3370,.86),(120,3220,.82)]:home('cottage-pink',x,y,z,sc,'pot')
custom('rose-glasshouse',-700,2670,z,670,620)
for dx in [-260,260]:obstacles.append(dict(x=-700+dx,y=2605,rx=65,ry=42,name='petalpatch-planter'))
for x,y in [(-1190,2780),(-290,2880)]:custom('potting-bench',x,y,z,260,174,103,25)
kit('play-tower',200,2720,z,.8);kit('picnic-blanket',30,2950,z,1.05,solid=False)
kit('bow-bench',-580,2960,z);kit('lamp-heart',-700,2950,z,.85)
z='tutu'
for src,x,y,sc in [('dollhouse-pink',3090,5600,.78),('dollhouse-pink',3650,5620,.82),('dollhouse-pink',4250,5640,.81),('dollhouse-pink',4810,5520,.8),('cottage-pink',5230,5300,.82)]:home(src,x,y,z,sc,'line')
custom('ribbon-stage',4000,6200,z,650,420)
for dx in [-255,255]:obstacles.append(dict(x=4000+dx,y=6085,rx=14,ry=14,name='tutu-stage-post'))
custom('ribbon-worktable',4520,6100,z,250,180,103,25)
for x,y in [(3520,6150),(4400,6410)]:kit('bow-bench',x,y,z);kit('lamp-heart',x-120,y-20,z,.85)
kit('candy-cart',4890,5800,z,.9);kit('parasol',3820,6470,z,.9);kit('picnic-blanket',4120,6510,z,1.05,solid=False)
kit('sandcastle-pink',3980,6710,z,.85)
planting={
 'ribbonwick':[(-930,180),(-900,700),(2450,-50),(2600,360),(1500,-500),(-100,-500),(620,1100),(2720,450)],
 'melody':[(4900,-190),(5100,470),(5500,-580),(6840,-480),(7670,280),(7340,980),(7000,790)],
 'quay':[(7700,830),(9120,1000),(9480,1510),(9630,2090),(9500,3040),(7990,3260),(8580,3280)],
 'petalpatch':[(-1520,2010),(-1560,2860),(-1220,3480),(-600,3660),(300,3430),(340,2210)],
 'tutu':[(2820,5510),(3020,5930),(3530,6500),(4800,6150),(5100,5830),(5500,5400)]}
for z,coords in planting.items():
 for i,(x,y) in enumerate(coords):kit('tree-willow' if z=='quay' and i in [5,6] else 'tree-cherry',x,y,z,.87 if i%3==0 else 1)
for z,coords in {
 'ribbonwick':[(-690,1060),(1020,1000),(1390,660),(2040,530),(2630,470)],
 'melody':[(5290,590),(5590,610),(6790,860),(7180,700)],
 'quay':[(7890,1570),(9500,2010),(8020,2490),(8610,3130),(9330,3090)],
 'petalpatch':[(-1470,2550),(-1500,3160),(-1000,3520),(-190,3480),(350,3020)],
 'tutu':[(2920,5790),(3360,5920),(4620,5940),(5070,5550),(4460,6620)]}.items():
 for x,y in coords:
  kit('heart-hedge',x,y,z,.85);kit('flowers-pink',x-70,y+30,z,1.05,solid=False);kit('flowers-pink',x+65,y+22,z,1.1,True,solid=False)
for x,y in [(1100,4440),(6900,4590),(2370,-200)]:
 kit('bow-bench',x,y,'commons');kit('lamp-heart',x-120,y-35,'commons',.85)
 kit('tree-cherry',x-260,y-80,'commons',.9);kit('flowers-pink',x+150,y+30,'commons',1,solid=False)
main=[[-350,650],[1100,610],[2600,350],[4000,560],[5750,500],[7100,850],[8360,1780],[8650,2300],[8200,3250],[7170,4100],[5950,4870],[4840,5690],[4000,6100],[2600,5370],[1280,4510],[150,3540],[-650,2820],[-900,1660],[-350,650]]
connections=[[[700,650],[900,1000],[1200,1300]],[[6100,540],[5970,760],[5420,1000]],[[8500,2240],[7740,2500],[7000,2700]],[[4000,6110],[4000,5520],[4000,4900]],[[-650,2700],[0,2800],[900,2780]],[[1400,4580],[1800,4340],[2300,4290]]]
local=[
 [[-580,420],[100,360],[850,390],[1500,390],[2250,460],[2000,900],[1060,820],[200,1360],[-520,1240],[-580,420]],
 [[5200,300],[5740,400],[6200,500],[6920,440],[7470,850],[7100,1080],[6500,840],[5800,870],[5200,300]],
 [[8000,1550],[8400,1800],[8950,2020],[9380,2100],[9250,2700],[8780,3120],[8140,3030],[8000,2600],[8000,1550]],
 [[-1200,2370],[-600,2350],[0,2450],[120,3020],[-440,3530],[-1140,3440],[-1370,2950],[-1200,2370]],
 [[3100,5850],[3650,5920],[4250,5930],[4800,5800],[5250,5500],[4870,6110],[4350,6400],[3780,6420],[3270,6170],[3100,5850]],
 [[8400,1010],[8630,1340],[8500,1800]],
 [[-900,1660],[-1200,1450],[-1360,1310]],
 [[8520,3300],[8850,3500],[9100,3350]],
 [[4000,6420],[4100,6610],[4087,6740]]]
paths=[main]+connections+local
def sample(pts):
 out=[];n=len(pts)
 for i in range(n-1):
  a=pts[max(0,i-1)];b=pts[i];c=pts[i+1];e=pts[min(n-1,i+2)]
  steps=max(4,math.ceil(math.dist(b,c)/55))
  for j in range(steps):
   t=j/steps;u=1-t;out.append([u**3*b[k]+3*u*u*t*(b[k]+(c[k]-a[k])/6)+3*u*t*t*(c[k]-(e[k]-b[k])/6)+t**3*c[k] for k in [0,1]])
 out.append(pts[-1]);return out
def ribbon(pts,width,phase=0,inset=0):
 closed=pts[0]==pts[-1];s=sample(pts);s=s[:-1] if closed else s;left=[];right=[]
 for i,p in enumerate(s):
  a=s[(i-1)%len(s)] if closed else s[max(0,i-1)];b=s[(i+1)%len(s)] if closed else s[min(len(s)-1,i+1)];dx,dy=b[0]-a[0],b[1]-a[1];d=math.hypot(dx,dy) or 1
  t=i/max(1,len(s)-1);half=width*(.50+.105*math.sin(t*math.pi*5+phase)+.045*math.cos(t*math.pi*11))-inset
  scallop=3.5*math.sin(i*2.1+phase)+2*math.sin(i*.77)
  left.append([p[0]-dy/d*(half+scallop),p[1]+dx/d*(half+scallop)])
  right.append([p[0]+dy/d*(half-scallop),p[1]-dx/d*(half-scallop)])
 return (curve(left)+curve(right[::-1]) if closed else curve(left+right[::-1])),s,left,right
texture=''
for x,y in [(44,51),(238,92),(492,38),(743,114),(117,252),(366,201),(628,277),(789,379),(61,479),(279,399),(476,523),(686,493),(385,600),(124,655),(598,685),(783,703)]:texture+=f'<path d="M{x-10} {y}q10-12 20 0m-13-2q1-10 5-12" fill="none" stroke="#669e38" stroke-width="2.4" opacity=".52"/>'
for x,y in [(173,141),(551,177),(312,320),(720,590),(58,603),(498,424)]:texture+=f'<ellipse cx="{x}" cy="{y}" rx="5" ry="2.3" fill="#fce6c7" opacity=".72"/>'
D=curve(coast)
roadsets=[(p,300 if i==0 else 210 if i<7 else 155,i*.9) for i,p in enumerate(paths)]+[(shore+[shore[0]],155,.7)]
roadArt=[ribbon(*r) for r in roadsets]
clip=''.join(f'<path d="{d}"/>' for d,*_ in roadArt)
ground=f'<defs><clipPath id="new-land"><path d="{D}"/></clipPath><clipPath id="pink-roads">{clip}</clipPath><pattern id="rose-grass" width="840" height="760" patternUnits="userSpaceOnUse">{texture}</pattern></defs>'
ground+=f'<path d="{D}" fill="#8fc63c" stroke="#ade0e3" stroke-width="135"/><path d="{D}" fill="#8fc63c" stroke="#f9d3dc" stroke-width="82"/><g clip-path="url(#new-land)">'
for x,y,rx,ry in [(-500,200,650,290),(2050,-350,700,320),(5820,-390,700,280),(8360,580,650,400),(8960,1920,500,410),(8220,3370,510,340),(7080,4250,650,280),(6000,4800,650,290),(4620,5740,630,290),(3370,5740,630,270),(1790,4790,570,260),(500,3890,520,290),(-900,2960,460,350),(-1180,1670,400,300)]:
 pts=[[x-rx,y],[x-rx*.6,y-ry*.8],[x+rx*.2,y-ry],[x+rx,y-ry*.3],[x+rx*.7,y+ry*.7],[x-rx*.2,y+ry]];ground+=f'<path d="{curve(pts)}" fill="#b5d953" opacity=".4"/>'
ground+=f'<path d="{D}" fill="url(#rose-grass)"/>'
for p in [p for p in props if p.get('household')]:
 x,y=p['x'],p['y']
 garden=[[x-245,y+25],[x-180,y-25],[x+170,y-15],[x+250,y+70],[x+205,y+215],[x-205,y+205]]
 ground+=f'<path d="{curve(garden)}" fill="#a4cd4c" stroke="#81ad3c" stroke-width="3"/><path d="M{x-26} {y+15}Q{x+15} {y+100} {x-30} {y+240}l64 0Q{x+60} {y+100} {x+25} {y+15}Z" fill="#e9d1a2"/>'
 for yy,xx in [(70,-5),(118,8),(170,-6),(215,3)]:ground+=f'<ellipse cx="{x+xx}" cy="{y+yy}" rx="24" ry="10" fill="#fcebd6" stroke="#c0aa85" stroke-width="2"/>'
 for dx in [-175,150]:
  ground+=f'<path d="M{x+dx-43} {y+105}q38-24 82 0l-6 50q-35 18-77-1Z" fill="#b9956e" stroke="#8b8052" stroke-width="2"/>'
  for ox,oy in [(-20,118),(7,128),(24,114),(-10,147)]:ground+=f'<path d="M{x+dx+ox} {y+oy}v-10m0 5q-12-7-13-2m13 0q11-9 13-4" stroke="#60843d" stroke-width="2" fill="none"/><circle cx="{x+dx+ox}" cy="{y+oy-11}" r="4" fill="#f5a3c7"/>'

for inset,color,stroke,sw in [(0,'#72993e','#496d31',10),(12,'#b09d68','none',0),(28,'#f3d79f','none',0)]:
 for pts,width,phase in roadsets:
  rd=ribbon(pts,width,phase,inset)[0];ground+=f'<path d="{rd}" fill="{color}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'
ground+='<g clip-path="url(#pink-roads)">'
for ri,(rd,s,left,right) in enumerate(roadArt):
 for i in range(3,len(s)-3,7):
  p=s[i];q=s[min(i+3,len(s)-1)];dx,dy=q[0]-p[0],q[1]-p[1];dist=math.hypot(dx,dy) or 1;nx,ny=-dy/dist,dx/dist
  for off in [-.19,.22]:
   o=roadsets[ri][1]*off;ground+=f'<path d="M{p[0]+nx*o:.1f} {p[1]+ny*o:.1f}q{dx*.8:.1f} {dy*.8:.1f} {dx:.1f} {dy:.1f}" fill="none" stroke="#d1b985" stroke-width="{4 if i%2 else 7}" opacity=".38" stroke-linecap="round"/>'
  ground+=f'<ellipse cx="{p[0]+nx*37:.1f}" cy="{p[1]+ny*37:.1f}" rx="23" ry="9" fill="#fff0cf" opacity=".46"/>'
  edge=left[i] if i%2 else right[i];ex,ey=edge;ex=ex*.92+p[0]*.08;ey=ey*.92+p[1]*.08
  ground+=f'<path d="M{ex-7:.1f} {ey:.1f}q2-9 10-8l6 7-4 6-10 1Z" fill="#b8ad91" stroke="#8f8d6e" stroke-width="1.7"/>'
ground+='</g>'
for ri,(rd,s,left,right) in enumerate(roadArt):
 for side in [left,right]:
  for i in range(2,len(side)-2,5):
   x,y=side[i];ground+=f'<path d="M{x-10:.1f} {y:.1f}q-5-11 0-16q8 2 10 10q0-17 7-19q7 9 3 17q12-9 17-3l-10 12" fill="#8fc63c" stroke="#6d9b3c" stroke-width="1.7"/>'
for p in places:
 x,y=p['x'],p['y'];rx,ry=(400,205) if p['id']!='quay' else (330,190)
 pts=[[x-rx,y],[x-rx*.6,y-ry*.8],[x+rx*.25,y-ry],[x+rx,y-ry*.2],[x+rx*.7,y+ry*.7],[x-rx*.2,y+ry]]
 ground+=f'<path d="{curve(pts)}" fill="#f7dfaf"/>'
 for dy in [-80,15,105]:ground+=f'<path d="M{x-rx*.67} {y+dy}Q{x} {y+dy+25} {x+rx*.7} {y+dy}" fill="none" stroke="#d8bd90" stroke-width="2" opacity=".7"/>'
ground+='</g>'
oldbody=(S/'ground-body.svg').read_text();inner=oldbody[oldbody.index('<ns0:g'):]
combined=ground+inner
(S/'ground-body.svg').write_text(combined)
svg=lambda b:f'<svg xmlns="http://www.w3.org/2000/svg" width="13200" height="9800" viewBox="-2600 -1900 13200 9800">{b}</svg>'
(X/'ground-source.svg').write_text(svg(combined))
art=copy.deepcopy(old);art.update(width=13200,height=9800,origin=dict(x=-2600,y=-1900));art['ground']={'tiles':[dict(src='expansion/ground-source.svg',x=-2600,y=-1900,width=13200,height=9800)]};art['props']+=props
(S/'drawing-art.json').write_text(json.dumps(art,indent=1)+'\n')
layout=dict(origin=dict(x=-2600,y=-1900),width=13200,height=9800,coast=coast,shoreWalk=shore,paths=paths,pathWidths=[360]+[230]*6+[170]*len(local),places=places,props=props,obstacles=obstacles,households=homes,roadArt=dict(style='variable-width worn rose-sand, raised turf lip, ruts, scalloped overhangs, pebbles',routes=len(roadsets)))
(S/'layout.json').write_text(json.dumps(layout,indent=1)+'\n')
print('Drawing ready:',len(places),'communities,',len(homes),'households,',len(props),'props,',len(obstacles),'visible solids')
