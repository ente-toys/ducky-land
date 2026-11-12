INK='#39472D';CREAM='#FFE9A0';SEA='#6EC9DE'
ld=shp(all_land); interior=all_land.buffer(-95).difference(beach)
groves=[Polygon(ell(p['x'],p['y']-20,195+25*(i%3),115+17*(i%4),24)) for i,p in enumerate(props) if p['name']=='Tree']
grass=unary_union([Polygon(ell(a['x'],a['y'],a['rx']+75,a['ry']+70)) for a in activities]+[Polygon(ell(1900,3180,850,580)),Polygon(ell(1500,1370,480,330)),Polygon(ell(6380,1390,600,320))]+[Polygon(ell(x,y,rx-65,ry-55)) for x,y,rx,ry in islets]+groves).buffer(55).buffer(-55).intersection(interior)
gd=shp(grass)
g=[f'<defs><clipPath id="land"><path d="{ld}"/></clipPath><clipPath id="grass"><path d="{gd}"/></clipPath></defs>']
for dist,width,col,alpha in [(148,9,'#B5E7E5',.28),(106,16,'#92DBE0',.45),(61,9,'#B5E7E5',.65),(24,6,'#FFF0C7',.92)]:
    g.append(f'<path d="{shp(all_land.buffer(dist))}" fill="none" stroke="{col}" stroke-width="{width}" opacity="{alpha}"/>')
g += [f'<path d="{ld}" fill="{CREAM}" stroke="{INK}" stroke-width="3"/>',f'<path d="{shp(interior)}" fill="#DDC083" stroke="#B19A5F" stroke-width="4"/>',f'<path d="{gd}" fill="#99B933" stroke="#7D9F35" stroke-width="4"/>']
yards=[[(2670,1180),(3240,1050),(4040,1020),(4930,1120),(5340,1540),(5140,1850),(4460,1760),(3780,1780),(2850,1710)],[(2390,2630),(2820,2590),(3020,2840),(2820,3070),(2530,3020)],[(5210,3610),(5550,3510),(5850,3770),(5680,4080),(5290,4070)]]
for pts in yards:g.append(f'<path d="{bez(pts,True)}" fill="#D3AD67" stroke="#C49F59" stroke-width="2.5" clip-path="url(#land)"/>')
for i in range(95):
    x,y=rnd.uniform(950,7050),rnd.uniform(1000,4630)
    pt=Point(x,y)
    if not interior.buffer(-35).contains(pt) or grass.contains(pt) or path_geom.buffer(35).contains(pt) or reserved.contains(pt):continue
    pts=[(x+(80+40*math.sin(a*3+i))*math.cos(a),y+(34+10*math.cos(a*4+i))*math.sin(a)) for a in np.linspace(0,math.tau,16,endpoint=False)]
    g.append(f'<path d="{bez(pts,True)}" fill="{["#D6B578","#E2C78C","#E5CB91"][i%3]}"/>')
for i in range(70):
    x,y=rnd.uniform(850,7100),rnd.uniform(900,4700)
    if not grass.contains(Point(x,y)) or path_geom.buffer(80).contains(Point(x,y)) or centre.contains(Point(x,y)):continue
    g.append(f'<path d="{bez(ell(x,y,rnd.uniform(90,220),rnd.uniform(50,100),9),True)}" fill="{["#8CAB2D","#9DBD38","#A0BE39"][i%3]}" clip-path="url(#grass)"/>')
for shape,col in [(path_geom.buffer(5),'#958447'),(path_geom.buffer(2),'#E5C46B'),(path_geom,CREAM)]:
    g.append(f'<path d="{shp(shape)}" fill="{col}" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#land)"/>')
track=LineString(catmull([(2650,1560),(3020,1730),(3440,1810),(4100,1830),(4830,1780),(5180,1660),(5480,1800)]))
yard_track=LineString(catmull([(4100,2875),(4100,3000),(4210,3115),(4440,3165),(4660,3125),(4760,3065)]))
rail_tracks=[track,yard_track]
for route in rail_tracks:
    rail_start=len(g)
    for t in np.arange(0,route.length-10,37):
        p=route.interpolate(t);q=route.interpolate(t+4);dx,dy=q.x-p.x,q.y-p.y;mag=math.hypot(dx,dy);nx,ny=-dy/mag,dx/mag
        g.append(f'<path d="M{p.x-nx*67:.1f} {p.y-ny*67:.1f}L{p.x+nx*67:.1f} {p.y+ny*67:.1f}" stroke="{INK}" stroke-width="14" stroke-linecap="round"/><path d="M{p.x-nx*67:.1f} {p.y-ny*67:.1f}L{p.x+nx*67:.1f} {p.y+ny*67:.1f}" stroke="#B9874D" stroke-width="9" stroke-linecap="round"/>')
    for side in [-1,1]:
        pp=route.offset_curve(side*49)
        d='M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in pp.coords)
        g.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="9"/><path d="{d}" fill="none" stroke="#D5D2A6" stroke-width="4"/>')
    if route is yard_track:
        (ART/'detail/yard-tracks.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="530" viewBox="3960 2780 960 530">'+''.join(g[rail_start:])+'</svg>')
        extra_flats.append(dict(src='detail/yard-tracks.svg',x=3960,y=2780,width=960,height=530,topLeft=True))
for a in activities:
    pts=[(a['x']+(a['rx']+34+12*math.sin(t*5))*math.cos(t),a['y']+(a['ry']+30+8*math.sin(t*5))*math.sin(t)) for t in np.linspace(0,math.tau,60,endpoint=False)]
    g.append(f'<path d="{bez(pts,True)}" fill="#9CBD37" stroke="#709535" stroke-width="5"/>')
for i,r in enumerate(rows):
    z=box(r['x0']-8,r['y0']-8,r['x1']+8,r['y1']+8).buffer(85)
    d=shp(z);g.append(f'<path d="{d}" fill="#F7DB8E" stroke="#9A8B48" stroke-width="4"/>')
    g.append(f'<clipPath id="row{i}"><path d="{d}"/></clipPath><g clip-path="url(#row{i})" stroke="#D8B66D" stroke-width="2" fill="none">')
    for j,y in enumerate(range(r['y0']-100,r['y1']+150,100)):
        pts=[(x,y+12*math.sin(x*.014+j)) for x in range(r['x0']-120,r['x1']+240,110)]
        g.append(f'<path d="{bez(pts)}"/>')
        for x in range(r['x0']-100+(j%2)*80,r['x1']+160,170):g.append(f'<path d="M{x} {y}l{12 if j%2 else -12} 100"/>')
    g.append('</g>')
g.append(f'<path d="{shp(centre)}" fill="#FFE9A0" stroke="#B28F4F" stroke-width="6"/>')
g.append(f'<path d="{shp(pond_poly.buffer(40))}" fill="#FFE9A0" stroke="#667F36" stroke-width="4"/><path d="{shp(pond_poly)}" fill="#7CCDD9" stroke="#4F9FB1" stroke-width="3"/><path d="{shp(pond_poly.buffer(-38))}" fill="#61B8CC"/>')
for i in range(17):
    x=rnd.uniform(1400,2390);y=rnd.uniform(2850,3490)
    if not pond_poly.buffer(-30).contains(Point(x,y)) or abs(y-3180)<90:continue
    g.append(f'<path d="M{x-22:.1f} {y:.1f}q22 9 44 0" fill="none" stroke="#FFF0C7" stroke-width="3"/>')
assets={}
for f in (ROOT/'public/pixi-art/decals').glob('*.svg'):
    if f.stem=='plaza-paving':continue
    text=f.read_text(); m=re.search(r'<svg[^>]*viewBox="([^"]+)"[^>]*>',text)
    if not m:continue
    boxvals=list(map(float,m[1].split())); inner=text[m.end():].rsplit('</svg>',1)[0]
    assets[f.stem]=(boxvals,inner)
g.append('<defs>'+''.join(f'<g id="decal-{key}" fill="none" stroke-linecap="round" stroke-linejoin="round">{inner}</g>' for key,(vb,inner) in assets.items())+'</defs>')
placed=[];cells={}; count=0
for i in range(16000):
    x,y=rnd.uniform(800,7250),rnd.uniform(800,5510);pt=Point(x,y)
    if not all_land.buffer(-28).contains(pt) or pond_poly.buffer(45).contains(pt) or centre.buffer(20).contains(pt):continue
    if path_geom.contains(pt) or any(z.contains(pt) for z in zone_geoms[3:]):continue
    if any(math.hypot(x-p['x'],(y-p['y'])*1.7)<65 for p in props):continue
    cell=(int(x/53),int(y/53))
    if cell in cells:continue
    if any(math.hypot(x-xx,y-yy)<52 for dx in [-1,0,1] for dy in [-1,0,1] for xx,yy in cells.get((cell[0]+dx,cell[1]+dy),[])):continue
    cells.setdefault(cell,[]).append((x,y));sand=not grass.contains(pt)
    choices=['sand-speck-1','sand-speck-2','pebble-1','grass-tuft-2','sand-speck-2','pebble-2'] if sand else ['grass-tuft-1','grass-tuft-2','grass-tuft-3','grass-tuft-1','flower-dot-1','flower-dot-2','pebble-2','flower-dot-3']
    key=rnd.choice(choices);vb,inner=assets[key];s=1.15
    g.append(f'<use href="#decal-{key}" transform="translate({x-vb[2]*s/2:.1f} {y-vb[3]*s:.1f}) scale({s})"/>');count+=1
    if count>=1450:break
print('Home ground decals',count)
for p in [p for p in props if p['name'] in ['Flowers','Wildflower bed']][::7]:
    x,y=p['x']+32,p['y']-38
    g.append(f'<g transform="translate({x:.1f} {y:.1f})" stroke="#39472D" stroke-width="1.8"><path d="M0 0C-30 -28 -34 10 -8 13L0 5C25 -22 34 12 9 13Z" fill="#F5BD4A"/><path d="M0 -2V13"/></g>')
