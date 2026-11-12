import xml.etree.ElementTree as ET
flats=[]; floating=[]; extra_flats=[]
more=['nature--tree-pine','nature--rock-boulder','nature--rock-flat','nature--rock-upright','nature--reeds','nature--cattails','nature--lily-pad-flower','nature--lily-pad-small','nature--lily-pad-large','nature--log','nature--mushroom-cluster','street--picnic-blanket','street--picnic-basket','street--signpost-three-way','beach--towel-striped','beach--towel-sun','beach--shell-conch','beach--starfish-orange','beach--beach-ball','buildings--cottage','buildings--kiosk','street--planter-flowers','street--bunting']
for name in more:shutil.copyfile(ROOT/'public/pixi-art/detail'/f'{name}.svg',ART/'reuse'/f'{name}.svg')
for file in (ART/'reuse').glob('*.svg'):
    txt=file.read_text()
    for m in re.finditer(r'<linearGradient[^>]*id="([^"]+)"[^>]*>(.*?)</linearGradient>',txt,re.S):
        colors=re.findall(r'stop-color="([^"]+)"',m[2])
        if colors:txt=txt.replace('url(#'+m[1]+')',colors[min(1,len(colors)-1)])
    file.write_text(txt)
for name in ['buildings--cottage','buildings--kiosk']:
    file=ART/'reuse'/f'{name}.svg';txt=file.read_text()
    for old,new in {'#f1504a':'#6A813C','#cc3e39':'#465D30','#fff5c8':'#E9BB78','#f6e5ac':'#D49E54','#94d873':'#D5A05B','#74c558':'#B87C3C','#232323':'#39472D','#FFFFFF':'#FFF0C7'}.items():txt=txt.replace(old,new)
    txt=re.sub(r'<path id="032-lettering-HELLO"[^>]*/>', '<g stroke="#39472D" fill="none" stroke-width="19" stroke-linecap="round"><path d="M680 674L842 566M724 565L870 675"/><path d="M783 563Q849 544 903 595M648 597Q705 546 765 568" stroke-width="26"/></g>',txt)
    file.write_text(txt)
removed=[p for p in props if p['id'] in ['egg-mine','centre-placeholder']]
props[:]=[p for p in props if p not in removed]
obstacles[:]=[o for o in obstacles if not (o.get('poly')==[[3630,1400],[4470,1400],[4470,1585],[3630,1585]] or o.get('x')==4100 and o.get('y')==2898)]
snapshot=ART/'centre'
cc=json.loads((snapshot/'centre.json').read_text()); CK=.82; CX,CY=4100,2910
centre_solids=[]
for part in cc['pieces']:
    if part['id'].startswith('bench-'):continue
    x=CX+part['x']*CK;y=CY+part['y']*CK;w=part['width']*CK;h=part['height']*CK
    mine_offset=556 if part['id'] in ['back-cliff','mine-landmark'] or part['id'].startswith(('bank-','cliff-')) else 0
    y+=mine_offset
    if part['layer']=='decal':extra_flats.append(dict(src='centre/'+part['file'],x=x,y=y,width=w,height=h,topLeft=True));continue
    sy=CY+part.get('sortY',part['y']+part['height'])*CK+mine_offset
    if part['id']=='mine-landmark':
        x-=w*.17;y-=h*.34;w*=1.34;h*=1.34
    props.append(dict(id='gold-centre-'+part['id'],name='Mine hall '+part['id'],src='centre/'+part['file'],x=x+w/2,y=sy,width=part['width'],height=part['height'],scale=CK*(1.34 if part['id']=='mine-landmark' else 1),anchor=dict(x=.5,y=(sy-y)/h),shadow=False,wind=False))
for ob in cc['blocked']:
    if ob['name'].startswith('bench-'):continue
    if ob['name']=='quarry ledges':
        for local in [[[-1450,-1080],[1450,-1080],[1450,-990],[-1450,-990]],[[-1450,-830],[-700,-830],[-700,-630],[-1450,-630]],[[700,-830],[1450,-830],[1450,-630],[700,-630]]]:
            poly=[[CX+x*CK,CY+y*CK+556] for x,y in local]
            obstacles.append(dict(poly=poly));centre_solids.append(Polygon(poly))
        continue
    if 'poly' in ob:
        poly=[[CX+x*CK*(1.34 if ob['name']=='mine facade and tracks' else 1),CY+(((y+680)*1.34-680) if ob['name']=='mine facade and tracks' else y)*CK+556] for x,y in ob['poly']];o=dict(poly=poly);centre_solids.append(Polygon(poly))
    else:
        e=ob['ellipse'];o=dict(x=CX+e['x']*CK,y=CY+e['y']*CK+(556 if ob['name'].startswith('bank-') else 0),rx=e['rx']*CK,ry=e['ry']*CK);centre_solids.append(Polygon(ell(**o)))
    obstacles.append(o)
centre_clear=unary_union(centre_solids).buffer(65)
for p in list(props):
    if p['id'].startswith('gold-centre-'):continue
    if centre_clear.contains(Point(p['x'],p['y'])):
        props.remove(p)
        obstacles[:]=[o for o in obstacles if not ('x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<32)]
for name,src,x,y,h in [('Assay cabin','buildings--cottage',2700,1530,490),('Tool workshop','buildings--kiosk',5510,1480,460),('Panning cabin','buildings--cottage',1210,3590,430)]:
    put(name,'reuse/'+src+'.svg',x,y,h,dict(poly=[[x-150,y-145],[x+150,y-145],[x+150,y-12],[x-150,y-12]]))
held_file=ART/'goldmine-original-sleepers.json'
if not held_file.exists():shutil.copyfile(ART/'sleepers-validated.json',held_file)
held_beds=json.loads(held_file.read_text())
sleep_clear=unary_union([Polygon(ell(p['x'],p['y'],155,110)) for p in held_beds])
sleep_canopy=unary_union([Polygon(ell(p['x'],p['y'],60,45)) for p in held_beds if p['pose']!='nod'])
def free(x,y,r=45,gap=95,allow_edge=False):
    pt=Point(x,y)
    if not all_land.buffer(-r).contains(pt) or pond_poly.buffer(r).contains(pt):return False
    if sleep_clear.contains(pt):return False
    if reserved.buffer(r+20).contains(pt) or centre_clear.buffer(r).contains(pt) or path_geom.buffer(r).contains(pt):return False
    if any(LineString([a,b]).buffer(w/2+r).contains(pt) for a,b,w in decks.values()):return False
    return all(math.hypot(x-p['x'],(y-p['y'])*1.25)>gap for p in props)
clusters=[(1500,1280),(2330,1100),(2740,1440),(5210,1220),(5920,1370),(6590,1840),(6800,2350),(6800,3200),(6460,3910),(5260,4100),(4730,4470),(3390,4440),(2640,4380),(1540,4180),(1120,3420),(1070,2840),(2680,2900),(2770,3450),(5080,2160),(5420,3700),(2000,5230),(5840,5260)]
for ci,(cx,cy) in enumerate(clusters):
    if cy>4900:continue
    n=0
    for j in range(180):
        a=rnd.random()*math.tau;r=math.sqrt(rnd.random())*430
        x,y=round(cx+math.cos(a)*r),round(cy+math.sin(a)*r*.72)
        if not free(x,y,48,175):continue
        canopy=Polygon(ell(x,y-250,130,190))
        if canopy.intersects(reserved.buffer(-160)) or canopy.intersects(sleep_canopy):continue
        k=1+(ci+j)%5
        src='reuse/nature--tree-pine.svg' if ci%5==0 and n%2 else f'reuse/tree-{k}.svg'
        put('Tree',src,x,y,rnd.randrange(455,590),'tree',pid=f'gold-grove-{ci}-{n}',flip=n%2==0)
        n+=1
        if n==3:break
for i in range(10000):
    if sum(p['name']=='Tree' for p in props)>=66:break
    x,y=rnd.uniform(750,7250),rnd.uniform(780,4780)
    if not free(x,y,45,185):continue
    canopy=Polygon(ell(x,y-240,110,170))
    if canopy.intersects(reserved.buffer(-160)) or canopy.intersects(sleep_canopy):continue
    if min(math.hypot(x-p['x'],y-p['y']) for p in props if p['name']=='Tree')>520:continue
    put('Tree',f'reuse/tree-{1+i%5}.svg',round(x),round(y),rnd.randrange(460,570),'tree',pid=f'gold-fill-tree-{i}')
for i,p in enumerate(list(props)):
    if p['name']!='Tree':continue
    for j,(dx,dy) in enumerate([(-85,35),(105,50)]):
        x,y=p['x']+dx,p['y']+dy
        if not free(x,y,25,60):continue
        put('Bush',f'reuse/bush-{1+(i+j)%3}.svg',x,y,90+10*(i%3),'small')
        if free(x+52,y+37,12,22):put('Flowers',f'reuse/flower-{1+i%2}.svg',x+52,y+37,55,None)
for zi,z in enumerate(zone_geoms):
    edge=z.buffer(95).exterior
    for j in range(int(edge.length/125)):
        q=edge.interpolate(j*125);x,y=q.x,q.y
        if path_geom.buffer(32).contains(q) or not all_land.buffer(-35).contains(q) or centre_clear.contains(q) or sleep_clear.contains(q):continue
        if any(math.hypot(x-p['x'],y-p['y'])<90 for p in props):continue
        if j%7==0:put('Timber lantern','detail/lantern.svg',x,y,210)
        elif j%7==3:put('Wood bench','reuse/street--bench-wood.svg',x,y,90)
        elif j%2:put('Flowers',f'reuse/flower-{1+j%2}.svg',x,y,65,None)
        else:put('Low hedge',f'reuse/bush-{1+j%3}.svg',x,y,70,'small')
for i,(cx,cy) in enumerate([(2820,1680),(4970,1500),(5400,1750),(2600,2760),(2630,3500),(6600,3670),(3500,4020),(5760,4390)]):
    for j in range(5):
        x=cx+rnd.randint(-200,200);y=cy+rnd.randint(-100,100)
        if free(x,y,40,100):put('Rocky outcrop' if j%2 else 'Gold ore rocks','reuse/nature--rock-boulder.svg' if j%2 else 'detail/ore-rock.svg',x,y,135+j*24)
for x,y in [(2500,1260),(5350,1470),(1420,3970),(5300,4240)]:
    if free(x,y,55,80):put('Picnic blanket','reuse/street--picnic-blanket.svg',x,y,90,None)
for i,(x,y) in enumerate([(6220,3870),(6440,4000),(6720,3680),(6080,4080)]):
    if free(x,y,25,65):put('Beach towel','reuse/beach--towel-'+('striped' if i%2 else 'sun')+'.svg',x,y,95,None)
for x,y in [(1310,2670),(5300,2740),(3030,3970),(5450,1640)]:
    if free(x,y,25,60):put('Mine trail signpost','reuse/street--signpost-three-way.svg',x,y,160)
for i in range(18):
    a=math.tau*i/18;x=pond['x']+math.cos(a)*(pond['rx']+60);y=pond['y']+math.sin(a)*(pond['ry']+65)
    if abs(y-3180)<145:continue
    if not all_land.contains(Point(x,y)) or reserved.buffer(20).contains(Point(x,y)) or sleep_clear.contains(Point(x,y)):continue
    if i%3:put('Pond reeds','reuse/nature--reeds.svg',x,y,95,None)
    else:put('Pond rim rock','reuse/nature--rock-flat.svg',x,y,75)
for i in range(13):
    x=rnd.uniform(1480,2330);y=rnd.choice([rnd.uniform(2920,3035),rnd.uniform(3310,3420)])
    if not pond_poly.buffer(-35).contains(Point(x,y)):continue
    src='reuse/nature--lily-pad-'+('flower' if i%4==0 else 'small')+'.svg'
    floating.append(dict(src=src,x=x,y=y,width=60 if i%4 else 85,height=43 if i%4 else 66,phase=i*1.4))
(ART/'detail/supply-crates.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 130" stroke="#39472D" stroke-width="2.6" stroke-linejoin="round"><ellipse cx="80" cy="119" rx="76" ry="9" fill="#7C8441" opacity=".22"/><path d="M8 55L70 44L78 113L14 121Z" fill="#C88A42"/><path d="M8 55L25 40L85 32L70 44Z" fill="#F4CB7C"/><path d="M70 44L85 32L93 103L78 113Z" fill="#A76731"/><path d="M17 60L65 53L71 107L23 114ZM20 61L69 106M66 54L23 113" fill="none" stroke="#F4CB7C" stroke-width="7"/><path d="M92 45Q115 34 146 44L151 109Q124 128 94 113Z" fill="#BE7D38"/><ellipse cx="119" cy="44" rx="27" ry="11" fill="#E7B669"/><path d="M95 64Q122 76 148 63M96 99Q123 111 150 98" fill="none" stroke="#6A6854" stroke-width="9"/><path d="M106 54L108 115M131 54L134 114" fill="none" stroke="#8F592D" stroke-width="2"/></svg>''')
for x,y in [(3030,1490),(4820,1500),(2750,1790),(5260,1790),(1300,3610),(5540,2990),(6400,3000)]:
    if free(x,y,35,80):put('Supply crates and barrel','detail/supply-crates.svg',x,y,135)
for i,(x,y) in enumerate([(6280,3890),(6530,3870),(6750,3780)]):
    put('Beach towel','reuse/beach--towel-'+('striped' if i%2 else 'sun')+'.svg',x,y,100,None)
for x,y in [(3470,3790),(1650,2750),(5650,4240)]:
    if not reserved.contains(Point(x,y)) and not pond_poly.contains(Point(x,y)):
        put('Picnic blanket','reuse/street--picnic-blanket.svg',x,y,100,None)
for i in range(6000):
    if len(props)>=365:break
    x,y=rnd.uniform(950,7050),rnd.uniform(1000,4600)
    if not free(x,y,25,100):continue
    if min(path_geom.distance(Point(x,y)),min(math.hypot(x-p['x'],y-p['y']) for p in props if p['name']=='Tree'))>240:continue
    if i%6==0:put('Gold ore rocks','detail/ore-rock.svg',x,y,100+rnd.random()*50)
    elif i%6==1:put('Wildflower bed','reuse/flower-2.svg',x,y,65,None)
    elif i%6==2:put('Bush','reuse/bush-1.svg',x,y,100)
    elif i%6==3:put('Mushrooms','reuse/nature--mushroom-cluster.svg',x,y,45,None)
    elif i%6==4:put('Mining timber','reuse/nature--log.svg',x,y,80)
    else:put('Flowers','reuse/flower-1.svg',x,y,60,None)
for p in list(props):
    if p['id'].startswith('gold-centre-'):continue
    if not all_land.buffer(-40).contains(Point(p['x'],p['y'])) or pond_poly.contains(Point(p['x'],p['y'])):
        props.remove(p)
        obstacles[:]=[o for o in obstacles if not ('x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<32)]
for p in list(props):
    if p['id'].startswith('gold-centre-'):continue
    halfw=31 if p['name']=='Tree' else p['width']*p['scale']*.34
    footprint=Polygon(ell(p['x'],p['y']-10,halfw+18,(23 if p['name']=='Tree' else min(38,p['height']*p['scale']*.16))+18))
    if any(z.intersects(footprint) for z in zone_geoms):
        props.remove(p)
        obstacles[:]=[o for o in obstacles if not ('x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<32)]
for p in list(props):
    if p['name']=='Bush' and abs(p['x']-3836)<2 and abs(p['y']-955)<2:
        props.remove(p)
        obstacles[:]=[o for o in obstacles if not ('x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<32)]
for x,y in [(1310,2740),(6870,3000),(3250,4380)]:
    put('Mine trail signpost','reuse/street--signpost-three-way.svg',x,y,160)
for p in list(props):
    if p['name']!='Tree':continue
    W=p['width']*p['scale'];H=p['height']*p['scale']
    crown=box(p['x']-W*.43,p['y']-H*.9,p['x']+W*.43,p['y']-H*.3)
    if not any(crown.intersection(z.buffer(-25)).area/crown.area>.08 for z in zone_geoms[3:]):continue
    props.remove(p)
    obstacles[:]=[o for o in obstacles if not ('x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<32)]
    put('Low hedge','reuse/bush-1.svg',p['x'],p['y'],105,'small',pid=p['id']+'-hedge')
print('Enriched props',len(props),'trees',sum(p['name']=='Tree' for p in props))

shifted=[];removed_on_path=[]
for p in list(props):
    if p['id'].startswith('gold-centre-') or p['name']=='Timber support':continue
    rx=31 if p['name']=='Tree' else p['width']*p['scale']*.34
    ry=min(38,p['height']*p['scale']*.16)
    def footing(x,y):return Polygon(ell(x,y-10,rx,ry))
    if not footing(p['x'],p['y']).intersects(path_geom):continue
    ox,oy=p['x'],p['y'];own=prop_obstacles.get(p['id'],[])
    found=None
    for radius in [90,140,200,270,350,440,540]:
        for j in range(24):
            a=j*math.tau/24;x=ox+math.cos(a)*radius;y=oy+math.sin(a)*radius
            f=footing(x,y).buffer(20)
            if not all_land.buffer(-35).contains(f) or f.intersects(pond_poly) or f.intersects(reserved) or f.intersects(path_geom) or f.intersects(sleep_clear):continue
            if any(math.hypot(x-q['x'],(y-q['y'])*1.3)<max(85,rx+45) for q in props if q is not p):continue
            if any(f.intersects(Polygon(o['poly']) if 'poly' in o else Polygon(ell(o['x'],o['y'],o['rx'],o['ry']))) for o in obstacles if not any(o is v for v in own)):continue
            found=(x,y);break
        if found:break
    if found:
        p['x'],p['y']=found;dx,dy=p['x']-ox,p['y']-oy
        for o in own:
            if 'poly' in o:o['poly']=[[x+dx,y+dy] for x,y in o['poly']]
            else:o['x']+=dx;o['y']+=dy
        shifted.append(p['id'])
    else:
        props.remove(p);obstacles[:]=[o for o in obstacles if not any(o is v for v in own)];removed_on_path.append(p['id'])
print('Path verge correction',len(shifted),'moved',removed_on_path,'removed')

large_ore=0
for p in props:
    if p['name']!='Gold ore rocks':continue
    w=p['width']*p['scale']*1.35;h=p['height']*p['scale']*1.35
    foot=Polygon(ell(p['x'],p['y']-10,w*.34,min(38,h*.16)))
    if foot.buffer(30).intersects(path_geom) or foot.buffer(45).intersects(reserved) or foot.buffer(40).intersects(sleep_clear):continue
    if any(q is not p and math.hypot(p['x']-q['x'],p['y']-q['y'])<w*.55 for q in props):continue
    p['scale']*=1.35
    for o in obstacles:
        if 'x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-(p['y']-10))<1:o.update(rx=round(w*.34),ry=min(38,round(h*.16)))
    large_ore+=1
    if large_ore==8:break
print('Enlarged ore seams',large_ore)

for p in list(props):
    if p['name']=='Wood bench' and centre.buffer(150).contains(Point(p['x'],p['y'])):
        props.remove(p)
        obstacles[:]=[o for o in obstacles if not ('x' in o and abs(o['x']-p['x'])<1 and abs(o['y']-p['y'])<32)]
arc_records=json.loads((ART/'arc-benches.json').read_text())
accepted_arcs=[];arc_positions={}
for rec in arc_records:
    ring=rec['id'].split('arc-')[1].rsplit('-',1)[0].rstrip('-')
    if ring=='plaza' and rec['y']<CY:continue
    if len(arc_positions.get(ring,[])) >= (4 if ring=='plaza' else 2):continue
    if any(math.hypot(rec['x']-x,rec['y']-y)<320 for x,y in arc_positions.get(ring,[])):continue
    footprint=Polygon(rec['footprint']['poly'])
    if footprint.buffer(22).intersects(path_geom) or footprint.intersects(sleep_clear) or not all_land.contains(footprint):continue
    if any(footprint.buffer(12).intersects(z) for z in zone_geoms):continue
    if any(footprint.intersects(Polygon(o['poly']) if 'poly' in o else Polygon(ell(o['x'],o['y'],o['rx'],o['ry']))) for o in obstacles):continue
    ob=rec.pop('footprint');props.append(rec);obstacles.append(ob);accepted_arcs.append(rec['id']);arc_positions.setdefault(ring,[]).append((rec['x'],rec['y']))
print('Accepted curved benches',accepted_arcs)
for i,(x,y) in enumerate([(3460,3080),(4760,3080)]):
    put('Mine cart','detail/mine-cart.svg',x,y,155,flip=bool(i),pid=f'gold-yard-cart-{i}')
for i,(x,y) in enumerate([(3380,2920),(4850,3270)]):
    put('Gold ore rocks','detail/ore-rock.svg',x,y,135,pid=f'gold-yard-ore-{i}')
