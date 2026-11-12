"""Place the three approved inland vector kits, preserving shore geometry and centre art.
Run from the repository root. Inputs are checked before any game asset is written.
"""
from pathlib import Path
import json, re, subprocess, math, copy, xml.etree.ElementTree as ET

BASE='183fa3410d9d22b7aafcf15348d4c323216c97e3'
SRC=Path('../concepts/themes/work/pink-fix')
OUT=Path('scripts/pink-hamlets')
ART=Path('public/pixi-art/themes/pink')
HAMLETS=['ribbonwick','chirrup','petalpatch']
NS='http://www.w3.org/2000/svg'
ET.register_namespace('',NS)
q=lambda tag:'{'+NS+'}'+tag
read=lambda p:json.loads(Path(p).read_text())
def base(path):return subprocess.check_output(['git','show',BASE+':'+str(path)],text=True)
def baseline(path):return json.loads(base(path))
def write(path,data):Path(path).write_text(json.dumps(data,indent=1)+'\n')
def curve(pts,closed=True):
    # Catmull-Rom joins keep every authored point, with round continuous edges.
    pts=[list(p) for p in pts]
    if pts[0]==pts[-1]:pts=pts[:-1]
    d=f'M{pts[0][0]:.2f} {pts[0][1]:.2f}'
    for i in range(len(pts) if closed else len(pts)-1):
        a=pts[(i-1)%len(pts)] if closed or i else pts[0]
        b=pts[i];c=pts[(i+1)%len(pts)]
        z=pts[(i+2)%len(pts)] if closed or i+2<len(pts) else pts[-1]
        d+=f'C{b[0]+(c[0]-a[0])/6:.2f} {b[1]+(c[1]-a[1])/6:.2f} {c[0]-(z[0]-b[0])/6:.2f} {c[1]-(z[1]-b[1])/6:.2f} {c[0]:.2f} {c[1]:.2f}'
    return d+('Z' if closed else '')

def inside(x,y,poly):
    hit=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
    return hit

# Gate every individual referenced piece, even terrain pieces we will deliberately omit.
kits={};audit={}
for h in HAMLETS:
    L=read(SRC/'svg'/h/'layout.json');P=read(SRC/'plan'/f'{h}.json')
    worst=0
    for file in {o['file'] for o in L['objects']}:
        s=(SRC/'svg'/h/file).read_text();root=ET.fromstring(s)
        count=len(list(root.iter(q('path'))));worst=max(worst,count)
        assert not re.search(r'<(?:\w+:)?image\b|base64|gradient|(?:href|src)\s*=',s,re.I),f'Rejected embedded/gradient art: {h}/{file}'
        assert count<600 and len(s)<100000,f'Rejected trace-like piece: {h}/{file}'
    audit[h]={'pieces':len({o['file'] for o in L['objects']}),'largestPathCount':worst,'passed':True}
    P['remove']['propIds']=P['remove'].get('propIds',P['remove'].get('artPropIds',[]))
    P.setdefault('existingCommunityId',{'tutu-tides':'tutu'}.get(h,h))
    kits[h]=(L,P)

artpath=ART/'art.json';worldpath=Path('assets/world/themes/pink/world.json');walkpath=Path('assets/world/themes/pink/walk-world.json');layoutpath=Path('scripts/bigger-pink/layout.json')
A=read(artpath);worlds=[read(worldpath),read(walkpath)];D=read(layoutpath)
protectedInputs=copy.deepcopy(worlds)
remove=set().union(*(set(P['remove']['propIds']) for L,P in kits.values()))
owned=lambda p:p.get('hamlet') in HAMLETS or any(str(p.get('id',p.get('name',''))).startswith('hamlet-'+h+'-') for h in HAMLETS)
for data in [A,D,*worlds]:
    data['props']=[p for p in data.get('props',[]) if not owned(p)]
    if 'flats' in data:data['flats']=[p for p in data['flats'] if not owned(p) and not any(str(p.get('src','')).startswith('hamlets/'+h+'/paths-') for h in HAMLETS)]
    if 'obstacles' in data:data['obstacles']=[o for o in data['obstacles'] if not owned(o)]
# Exact IDs only. Centre objects and shore-fixer decks/boats are never rectangle-deleted.
for data in [A,D,*worlds]:
    data['props']=[p for p in data.get('props',[]) if p.get('id') not in remove]
    if 'obstacles' in data:data['obstacles']=[o for o in data['obstacles'] if not any(o.get('name','')==i or o.get('name','').startswith(i+'-') for i in remove)]
for data in [D,*worlds]:
    explicit=[]
    for L,P in kits.values():
        explicit.extend(o.get('value',o) for o in P['remove'].get('obstacles',[]))
    if 'obstacles' in data:data['obstacles']=[o for o in data['obstacles'] if not any(all(o.get(k)==v for k,v in f.items() if k!='index') for f in explicit)]
# Planned obsolete flat decals, matched as complete records rather than shifting indices.
flatkeys={(f['src'],f['x'],f['y']) for L,P in kits.values() for f in P['remove'].get('flats',[])}
A['flats']=[f for f in A['flats'] if (f['src'],f['x'],f['y']) not in flatkeys]
oldpaths=[r['points'] for L,P in kits.values() for r in P['remove']['paths'] if r['action']!='replace subpolyline only']
for data in [D,*worlds]:
    if 'paths' not in data:data['paths']=copy.deepcopy(worlds[0]['paths']);data['pathWidths']=copy.deepcopy(worlds[0]['pathWidths'])
    keep=[i for i,p in enumerate(data['paths']) if p not in oldpaths]
    data['paths']=[data['paths'][i] for i in keep];data['pathWidths']=[data['pathWidths'][i] for i in keep]

omit={'ribbon-square-and-lane','northeast-beach','terrain','square-path','shore-and-lawn','square-and-lane','quay-dock','coast-and-lawn','cream-paths','meadow-shore-and-path'}
flatpattern=re.compile(r'grass|pebble|sand-fleck|tulip|flower-clump|^flowers|flower-square|mat$|cushion|blanket|workshop-apron|dance-square')
buildingpattern=re.compile(r'^(?:house-|cottage-|(?:lilac|pink|buttercream)-rose-cottage$|ribbon-workshop$|dovecote-workplace$|reading-gazebo$|rose-glass-conservatory$)')
treepattern=re.compile(r'^tree|^oak|^cherry|^blossom')
report={'svgGate':audit,'hamlets':{},'base':BASE,'shoreDataUnchanged':True}
pathshapes=[];sleepbeds=[]
for h,(L,P) in kits.items():
    m=P['target']['map'];at,bp,k=m['at'],m['bp'],m['k']
    def W(p):return [round(at[i]+(p[i]-bp[i])*k,2) for i in range(2)]
    frame=[*W([0,0]),*W([1536,1024])]
    dest=ART/'hamlets'/h;dest.mkdir(parents=True,exist_ok=True)
    write(OUT/'hamlets'/f'{h}.json',{'layout':L,'map':m,'communityId':P['existingCommunityId'],'pathJoins':P['pathJoins'],'removedIds':P['remove']['propIds']})
    placed=[];flats=[];footprints=[]
    paths=L.get('paths',[])
    if h=='ribbonwick':paths=paths+[{'id':'workshop-apron','polygon':L['pathPolygons'][2]}]
    for path in paths:
        poly=[W(p) for p in path['polygon']]
        pathshapes.append({'id':h+'-'+path['id'],'poly':poly})
    for join in P['pathJoins']:
        points=join.get('connectorWorldPoints',join.get('connectorPoints'))
        # The optional north approach at Tutu would cross its tailor pavilion.
        # Bend around the eastern wall, then enter the east edge of the square.
        if h=='tutu-tides' and join['id']=='north-to-centre':
            points=[[4000,4900],[4670,5220],[4800,5580],W([1050,600])]
        pathshapes.append({'id':h+'-'+join['id'],'points':points,'width':join.get('width',join.get('widthWorld',160))})
        for data in [D,*worlds]:
            if points not in data['paths']:data['paths'].append(points);data['pathWidths'].append(join.get('width',join.get('widthWorld',160)))
    for o in sorted(L['objects'],key=lambda o:o['drawOrder']):
        if o['id'] in omit:continue
        s=(SRC/'svg'/h/o['file']).read_text();vb=[float(v) for v in re.search(r'viewBox="([^"]+)"',s)[1].split()]
        x,y=W([o['x'],o['y']]);w=round(o['width']*k,2);height=round(w*vb[3]/vb[2],2)
        # Set a real rasterization size, preserving vector viewBox and aspect ratio.
        s=re.sub(r'<svg\b[^>]*>',lambda m: re.sub(r'\s(?:width|height)="[^"]*"','',m[0]).replace('<svg',f'<svg width="{math.ceil(w)}" height="{math.ceil(height)}"'),s,count=1)
        (dest/o['file']).write_text(s)
        p={'id':f'hamlet-{h}-{o["id"]}','name':o['id'],'src':f'hamlets/{h}/{o["file"]}','x':x,'y':y,'width':w,'height':height,'scale':1,'anchor':{'x':.5,'y':1},'resolution':1.5,'zone':P['existingCommunityId'],'hamlet':h,'order':o['drawOrder'],'wind':False}
        isflat=bool(flatpattern.search(o['id'])) and not buildingpattern.search(o['id']) and not re.search(r'pot|shrub|bush|rosebed|flowerbed',o['id'])
        if isflat:
            p['shadow']=False;flats.append(p);continue
        isbuilding=bool(buildingpattern.search(o['id']));istree=bool(treepattern.search(o['id']))
        if isbuilding:
            fp={'x':x,'y':round(y-min(70,w*.14)-12,2),'rx':round(w*.39,2),'ry':round(min(70,max(28,w*.14)),2)}
            p['communityRole']='home' if re.search(r'house|cottage',o['id']) else 'workplace'
            if p['communityRole']=='home':p['household']=True;p['door']=[x,round(y+48,2)]
        elif istree:fp={'x':x,'y':y-8,'rx':round(max(12,w*.075),2),'ry':14}
        elif re.search(r'bunting|ribbon-drying-line',o['id']):fp=None;p['shadow']=False
        elif re.search(r'rosebed|flowerbed|shrub|bush',o['id']):fp={'x':x,'y':round(y-w*.12,2),'rx':round(w*.38,2),'ry':round(max(10,w*.12),2)};p['shadow']=False
        else:fp={'x':x,'y':round(y-min(18,w*.08),2),'rx':round(max(8,w*.30),2),'ry':round(max(7,min(28,w*.12)),2)}
        if fp:
            p['footprint']=fp;footprints.append(dict(fp,name=p['id']))
        # Respect authored order for overlapping upright sprites.
        p['z']=y
        for other in placed:
            if other['z']>=p['z'] and abs(other['x']-x)<(other['width']+w)/2 and y>other['y']-other['height'] and other['y']>y-height:p['z']=round(other['z']+.1,2)
        placed.append(p)
    A['props']+=placed;A['flats']+=flats;D['props']+=placed;D['obstacles']+=footprints
    for data in worlds:
        data['props']+=placed;data['obstacles']+=footprints
    # Use an unobstructed authored court point. Navigation checks it after placement.
    square=[W(v) for v in L['square']]
    candidates=[W([u,v]) for v in range(430,810,15) for u in range(500,1010,15)]
    def clearance(pt):return min(math.hypot(pt[0]-f['x'],(pt[1]-f['y'])*1.8)-f['rx'] for f in footprints)
    arrival=max((pt for pt in candidates if inside(*pt,square)),key=clearance)
    com=next(p for p in D['places'] if p['id']==P['existingCommunityId']);com.update(x=arrival[0],y=arrival[1],arrival=arrival,homes=[p['id'] for p in placed if p.get('communityRole')=='home'],workplaces=[p['id'] for p in placed if p.get('communityRole')=='workplace'])
    for data in worlds:
        if 'zones' in data:data['zones']['bigger-'+P['existingCommunityId']]['spawn']=arrival
    for bed in L['sleepers']:sleepbeds.append({'hamlet':h,'point':W([bed['x'],bed['y']])})
    report['hamlets'][h]={'map':m,'frame':frame,'arrival':arrival,'props':len(placed),'flats':len(flats),'buildings':[p['id'] for p in placed if buildingpattern.search(p['name'])],'sleepers':[W([b['x'],b['y']]) for b in L['sleepers']],'omitted':[o['id'] for o in L['objects'] if o['id'] in omit]}
# Reassign six approved sleeping poses to the six blueprint beds, keeping the existing island total.
slots=[('wing',0),('wing',1),('wing',2),('box',0)]
for bed,(pose,i) in zip(sleepbeds,slots):
    bed.update(pose=pose,slot=i)
    for data in worlds:
        if 'sleepSpots' not in data:data['sleepSpots']=copy.deepcopy(worlds[0]['sleepSpots'])
        data['sleepSpots'][pose][i]=bed['point']+[False]
report['sleepers']=sleepbeds
# Only the hamlets' old decorative ground is removed. Coast outlines, sea, water,
# bridge/deck layers and the original-centre overlay are retained without edits.
frames=[r['frame'] for r in report['hamlets'].values()]
def local(x,y):return any(a-200<x<c+200 and b-150<y<d+150 for a,b,c,d in frames)
def firstpoint(e):
    if e.get('cx') is not None:return float(e.get('cx')),float(e.get('cy'))
    v=re.match(r'\s*M\s*([-\d.]+)[ ,]+([-\d.]+)',e.get('d',''))
    return (float(v[1]),float(v[2])) if v else (1e9,1e9)
changed=0
for tile in A['ground']['tiles']:
    if not re.match(r'expansion/tiles/r\d+-c\d+\.svg$',tile['src']):continue
    f=ART/tile['src'];s=f.read_text();r=ET.fromstring(s);g=next((g for g in r if g.get('clip-path')=='url(#new-land)'),None)
    if g is None:continue
    original=ET.fromstring(base(f));originalGroup=next(g for g in original if g.get('clip-path')=='url(#new-land)')
    oldRoadD=set();counts={color:0 for color in ['#72993e','#b09d68','#f3d79f']}
    for e in originalGroup:
        if e.get('fill') in counts:
            n=counts[e.get('fill')];counts[e.get('fill')]+=1
            if n in {1,2,3,4,5,6,10,11,12}:oldRoadD.add(e.get('d'))
    roadindex={color:0 for color in ['#72993e','#b09d68','#f3d79f']}
    # Ground recipe has the main loop first, followed by the old local routes.
    # Remove only Ribbonwick (1..3), Chirrup (4..6), Petalpatch (10..12).
    for i,e in enumerate(list(g)):
        fill=e.get('fill')
        if fill in roadindex:
            index=roadindex[fill];roadindex[fill]+=1
            if e.get('d') in oldRoadD:g.remove(e)
            continue
        if e.get('clip-path')=='url(#pink-roads)':
            for detail in list(e):
                if local(*firstpoint(detail)):e.remove(detail)
        elif i>=10 and local(*firstpoint(e)):g.remove(e)
    out=ET.tostring(r,encoding='unicode')
    # Unchanged geometry and paint outside the three hamlets stays intact.
    f.write_text(out);changed+=1
decalStart=len(A['flats'])-sum(v['flats'] for v in report['hamlets'].values())
newPathFlats=[]
# Independent, bounded SVG path tiles, composited above ground and below every prop.
# Their land clip prevents path paint touching the sea while preserving the coast data.
coast=worlds[0]['coast'];coastd=curve(coast)
for h,info in report['hamlets'].items():
    shapes=[p for p in pathshapes if p['id'].startswith(h+'-')]
    points=[v for p in shapes for v in p.get('poly',p.get('points',[]))]
    x0=math.floor(min(p[0] for p in points)-100);x1=math.ceil(max(p[0] for p in points)+100);y0=math.floor(min(p[1] for p in points)-100);y1=math.ceil(max(p[1] for p in points)+100)
    body='<defs><clipPath id="dry-land"><path d="'+coastd+'"/></clipPath></defs><g clip-path="url(#dry-land)">'
    for p in shapes:
        if 'poly' in p:body+=f'<path d="{curve(p["poly"])}" fill="#FBE6C8" stroke="#FBE6C8" stroke-width="5" stroke-linejoin="round"/>'
        else:body+=f'<path d="{curve(p["points"],False)}" fill="none" stroke="#FBE6C8" stroke-width="{p["width"]}" stroke-linecap="round" stroke-linejoin="round"/>'
    body+='</g>'
    # Tiles are at most 1200 world units. No enormous textures or rectangular lawn patches.
    for row,y in enumerate(range(y0,y1,1100)):
        for col,x in enumerate(range(x0,x1,1100)):
            w=min(1104,x1-x+2);ht=min(1104,y1-y+2);name=f'hamlets/{h}/paths-{row}-{col}.svg'
            (ART/name).write_text(f'<svg xmlns="{NS}" width="{w}" height="{ht}" viewBox="{x-2} {y-2} {w} {ht}">{body}</svg>')
            newPathFlats.append({'id':f'hamlet-{h}-paths-{row}-{col}','hamlet':h,'src':name,'x':x-2,'y':y-2,'width':w,'height':ht,'topLeft':True,'resolution':1})
A['flats'][decalStart:decalStart]=newPathFlats
# Protect every shore-owned field against accidental changes by the placer.
for path,data,original in zip([worldpath,walkpath],worlds,protectedInputs):
    for key in ['coast','water','bridges','islets','walkways','arches','jetties']:assert data.get(key)==original.get(key),key
    write(path,data)
D['households']=[p['id'] for p in D['props'] if p.get('household')]
write(artpath,A);write(layoutpath,D);write(OUT/'report.json',report)
print(json.dumps({'gate':audit,'hamlets':{h:{k:v for k,v in r.items() if k in ['props','flats','arrival']} for h,r in report['hamlets'].items()},'groundTilesCleaned':changed}))
