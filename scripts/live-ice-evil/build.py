"""Port authored set pieces, never the continent terrain or runtime."""
import copy, json, math, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
def source(branch, path):
    return subprocess.check_output(['git', 'show', branch + ':' + path], cwd=ROOT)
def read(branch, path): return json.loads(source(branch, path))
def save(path, value):
    p = ROOT / path; p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, separators=(',', ':')) + '\n')
def copy_asset(branch, path):
    p = ROOT / path
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(source(branch, path))
def port_item(item, branch, theme, scale=1, origin=(0,0), target=(0,0), prefix=''):
    p = copy.deepcopy(item)
    src = p['src']
    path = 'public' + src if src.startswith('/') else f'public/pixi-art/themes/{theme}/{src}'
    copy_asset(branch, path)
    p['src'] = '/' + path.removeprefix('public/')
    p['x'] = round((p['x']-origin[0])*scale+target[0], 3)
    p['y'] = round((p['y']-origin[1])*scale+target[1], 3)
    p['width'] *= scale; p['height'] *= scale
    if p.get('id'): p['id'] = prefix + p['id']
    p.pop('footprint', None); p.pop('centrePiece', None)
    return p
def transform_shape(o, scale, origin=(0,0), target=(0,0)):
    p = copy.deepcopy(o)
    for k,i in [('x',0),('y',1)]:
        if k in p:p[k]=(p[k]-origin[i])*scale+target[i]
    for k in ['rx','ry','w','h']:
        if k in p:p[k]*=scale
    if 'poly' in p:p['poly']=[[(x-origin[0])*scale+target[0],(y-origin[1])*scale+target[1]] for x,y in p['poly']]
    return p

# One calm shoreline per map, authored independently of the discarded cells.
coast = [[600,2400],[760,1500],[1450,850],[2700,580],[4100,650],[5350,580],
         [6700,950],[7350,1800],[7420,3000],[7000,4050],[6200,4870],
         [4900,5210],[4000,5260],[2800,5150],[1650,4700],[850,3700]]
# Periodic Catmull-Rom samples are shared by the drawing and collision outline.
knots=coast;coast=[]
for i,p1 in enumerate(knots):
    p0,p2,p3=knots[i-1],knots[(i+1)%len(knots)],knots[(i+2)%len(knots)]
    for j in range(8):
        u=j/8
        coast.append([round(.5*((2*p1[k])+(-p0[k]+p2[k])*u+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*u*u+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*u*u*u),2) for k in [0,1]])
def outline():return 'M'+'L'.join(f'{x},{y}' for x,y in coast)+'Z'
def ground(theme, snowy, paths):
    # Soft parallel path edges and small, individually placed banks give the set pieces a shared ground.
    land = '#F4FAFC' if snowy else '#B4CC88'; edge='#B8E1EB' if snowy else '#87AA75'
    sand='#D8EEF2' if snowy else '#E2D29D'; lane='#E5EFEA' if snowy else '#DED2AF'
    body=f'<path d="{outline()}" fill="{sand}" stroke="{edge}" stroke-width="65" stroke-linejoin="round"/><path d="{outline()}" fill="{land}" stroke="{sand}" stroke-width="145" stroke-linejoin="round"/>'
    for points in paths:
        d='M'+'L'.join(f'{x},{y}' for x,y in points)
        body+=f'<path d="{d}" fill="none" stroke="{lane}" stroke-width="180" stroke-linecap="round" stroke-linejoin="round"/><path d="{d}" fill="none" stroke="{land}" stroke-opacity=".5" stroke-width="122" stroke-linecap="round"/>'
    patches=[(1220,1850,260,150),(6650,3500,290,180),(2300,4400,340,170),(5800,1250,250,130),(1500,3300,270,150),(5400,4630,310,150)]
    for x,y,rx,ry in patches:
        body+=f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{edge}" opacity=".28"/>'
    if snowy:
        body+='<ellipse cx="4000" cy="2750" rx="1120" ry="760" fill="#92D7EC" stroke="#C9EBF5" stroke-width="70"/><ellipse cx="4000" cy="2750" rx="1020" ry="660" fill="#B9EAF5"/><path d="M3200 2540Q3410 2200 3830 2220M3210 2620Q3450 2330 3750 2330M4270 3170Q4650 3210 4830 2880" fill="none" stroke="#ECFAFF" stroke-width="22" stroke-linecap="round"/>'
    else:
        body+='<ellipse cx="6300" cy="3900" rx="470" ry="300" fill="#82B7A7" stroke="#A8C594" stroke-width="45"/><path d="M5980 3900Q6150 3850 6270 3910M6450 4030L6590 4030" fill="none" stroke="#C7E4C5" stroke-width="14" stroke-linecap="round"/>'
    # Render the same authored vector into modest tiles, with transparent sea.
    tiles=[]
    for row in range(3):
        for col in range(4):
            name=f'live/ground-{row}-{col}.svg';p=ROOT/f'public/pixi-art/themes/{theme}/{name}';p.parent.mkdir(parents=True,exist_ok=True)
            p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="2000" viewBox="{col*2000} {row*2000} 2000 2000">{body}</svg>')
            tiles.append(dict(src=name,x=col*2000,y=row*2000,width=2000,height=2000,resolution=.7))
    return {'tiles':tiles}
def base(theme, name, paths, spawn):
    return dict(width=8000,height=6000,theme=theme,name=name,coast=coast,water=[],bridges=[],obstacles=[],islets=[],walkways=[],paths=paths,zones={'plaza':{'x':spawn[0],'y':spawn[1],'spawn':spawn}},ambient={'birds':[[1700,1700],[6200,1600],[1800,3900],[6100,4100],[3500,1400],[5000,4600]],'butterflies':[[1600,3300],[6100,3600]]})
def finish(theme,w,a,spawn):
    w['props']=a['props']
    save(f'assets/world/themes/{theme}/world.json',w)
    save(f'assets/world/themes/{theme}/walk-world.json',w)
    save(f'assets/world/themes/{theme}/harbor.json',{'jetty':{'foot':[4000,5120],'tip':[4000,5650],'width':120},'spawn':spawn})
    save(f'public/pixi-art/themes/{theme}/art.json',a)
    save(f'public/pixi-art/themes/{theme}/centre/centre.json',{'pieces':[]})

b='build-b-evil'; t='bog';old=read(b,f'public/pixi-art/themes/{t}/art.json');oldw=read(b,f'assets/world/themes/{t}/world.json')
paths=[[[4000,5150],[4000,4150],[4000,3650]],[[1500,3200],[2600,3650],[4000,4150],[6000,4400]],[[1800,2100],[3000,1800],[4000,1850],[6000,2300]]]
w=base(t,'Booquack Bog',paths,[4000,4200]);a=dict(width=8000,height=6000,sea='#6EC9DE',ground=ground(t,False,paths),props=[],flats=[],decks=[])
for p in old['props']:
    if p['id'].startswith(('build-b','boxing')):continue
    q=port_item(p,b,t,.5)
    if 850<q['x']<7100 and 1000<q['y']<4750:a['props'].append(q)
keep={p['id'] for p in a['props']}
for o in oldw['obstacles']:
    if not o.get('buildB') and (o.get('prop') in keep or (o.get('x')==8040 and o.get('y')==2730)):
        w['obstacles'].append(transform_shape(o,.5))
for p in old['props']:
    if p['id'].startswith('boxing'):a['props'].append(port_item(p,b,t,.8,(7830,6180),(4000,3100)))
for p in old['decks']:
    if p.get('id')=='boxing-raised-canvas':a['decks'].append(port_item(p,b,t,.8,(7830,6180),(4000,3100)))
for o in oldw['obstacles']:
    if o.get('prop','').startswith('boxing'):w['obstacles'].append(transform_shape(o,.8,(7830,6180),(4000,3100)))
w['zones'].update({'ring':{'name':'Boo Boxing Ring','x':4000,'y':3100,'spawn':[4000,3100]},'manor':{'name':'Crookbill Manor','x':4020,'y':1900,'spawn':[4020,1900]}})
w['boxingRing']={'floorWalkable':True,'fightCode':False,'centre':[4000,3100],'entrance':[4000,3572],'source':'build-b-evil'}
finish(t,w,a,[4000,4200])

b='build-b-iceland';t='snow';old=read(b,'public/pixi-art/themes/snow/art.json')
paths=[[[4000,5150],[4000,4500],[4000,3600]],[[1850,2500],[2700,2900],[2900,3300],[4000,3600],[5150,3250],[6150,2700]],[[2000,1700],[3200,1550],[4700,1550],[6100,1800]]]
w=base(t,'Iceland',paths,[4000,3750]);a=dict(width=8000,height=6000,sea='#6EC9DE',ground=ground(t,True,paths),props=[],flats=[],decks=[])
areas=[('snow','Snowbob Drift',(1900,2350)),('frost2','Waddlefrost',(6100,2350)),('frost3','Flurryfluff',(4000,4280))]
for district,name,at in areas:
    original=read(b,f'public/pixi-art/themes/{district}/art.json')
    for layer in ['props','flats']:
        for p in original[layer]:
            if p.get('id','').startswith('snow-locked'):
                q=port_item(p,b,district,.78,(3555,2478),at,district+'-')
                a[layer].append(q)
                if layer=='props':
                    # Base ellipses, small lamps and tree trunks, not whole sprite rectangles.
                    if 'snow-fir' in p['id']:rx,ry=82,45
                    elif 'bench' in p['id']:rx,ry=58,25
                    elif 'lamp' in p['id']:rx,ry=15,12
                    elif 'planter' in p['id']:rx,ry=28,20
                    else:continue
                    w['obstacles'].append({'x':q['x'],'y':q['y']-8,'rx':rx,'ry':ry,'prop':q['id']})
    w['zones'][district]={'name':name,'x':at[0],'y':at[1],'spawn':[at[0],at[1]+350]}
# Distinct, explicitly composed neighbourhood landmarks from the chosen B build.
sites=[('lodge',1700,1520,830,560,'Snowbob lodge'),('greenhouse',1240,3600,600,470,'Snow garden greenhouse'),('observatory',6350,1500,720,600,'Waddlefrost observatory'),('market-stall-0',5600,3650,350,310,'Cocoa stall'),('market-stall-1',6150,3800,350,310,'Winter makers stall'),('campfire',5000,4500,380,310,'Flurryfluff campfire')]
for i,(asset,x,y,width,height,name) in enumerate(sites):
    src=f'/pixi-art/iceland/build-b/{asset}.svg';copy_asset(b,'public'+src)
    a['props'].append({'id':f'ice-site-{i}','name':name,'src':src,'x':x,'y':y,'width':width,'height':height,'anchor':{'x':.5,'y':1},'shadow':False})
    w['obstacles'].append({'x':x,'y':y-35,'rx':width*.30,'ry':45,'prop':f'ice-site-{i}'})
# Small authored groves frame the lodges and three courts; no random filler.
groves=[(1100,1550),(1350,1750),(2350,1390),(2550,1620),(1000,2850),(1280,3060),(6750,1650),(6970,1890),(6900,2900),(6600,3100),(2700,4380),(2850,4620),(5400,4500),(5660,4660)]
for i,(x,y) in enumerate(groves):
    src=f'/pixi-art/themes/snow/detail/pine-{i%3+1}.svg';copy_asset(b,'public'+src)
    a['props'].append({'id':f'ice-pine-{i}','name':'Snow fir tree','src':src,'x':x,'y':y,'width':210,'height':330,'anchor':{'x':.5,'y':1},'shadow':False})
    w['obstacles'].append({'x':x,'y':y-8,'rx':26,'ry':20,'prop':f'ice-pine-{i}'})
for i,(x,y) in enumerate([(5700,1250),(6050,1080),(6550,1150)]):
    original=next(p for p in old['props'] if p.get('asset','').startswith('igloo'))
    q=port_item(original,b,'snow',.6,(original['x'],original['y']),(x,y),f'ice-village-{i}-');a['props'].append(q)
    w['obstacles'].append({'x':x,'y':y-30,'rx':q['width']*q.get('scale',1)*.3,'ry':50,'prop':q['id']})
for asset,x,y,width,height in [('iceland-pole-islet',4000,2680,400,307),('iceland-pole-marker',4020,2620,150,210)]:
    src=f'/pixi-art/iceland/{asset}.svg';copy_asset(b,'public'+src)
    p={'id':asset,'name':'North Pole marker' if 'marker' in asset else 'North Pole snow bank','src':src,'x':x,'y':y,'width':width,'height':height,'anchor':{'x':.5,'y':1},'shadow':False}
    a['props' if 'marker' in asset else 'flats'].append(p)
w['obstacles'].append({'x':4020,'y':2610,'rx':20,'ry':16,'prop':'iceland-pole-marker'})
w['zones']['rink']={'name':'Frozen Lake Rink','x':4000,'y':2900,'spawn':[4000,2900],'kind':'ice'}
w['districts']=[{'theme':district,'name':name,'centre':list(at)} for district,name,at in areas]
finish(t,w,a,[4000,3750])
print('Ported two authored islands; ring and three cold centres retained, continent filler excluded.')
