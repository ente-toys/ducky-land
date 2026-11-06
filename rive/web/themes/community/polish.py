"""HOME-quality pass, deterministic from the Community-only polish-source snapshot.
Run from the repo: python3 rive/web/themes/community/polish.py
Never writes shared art, map registrations, or other themes.
"""
from pathlib import Path
import json,re,math,random,copy
D=Path(__file__).resolve().parent; ROOT=D.parents[3]; A=ROOT/'public/pixi-art/themes/community'; S=D/'polish-source'
read=lambda p:json.loads(p.read_text())
save=lambda p,v:p.write_text(json.dumps(v,indent=2)+'\n')
a=read(S/'art.json');w=read(S/'world.json');walk=read(S/'walk-world.json');c=read(S/'centre.json')
sea='#6EC9DE'; grass='#93B72F';ink='#39472D'
colors={'#263957':sea,'#A7B8B0':grass,'#71998D':'#4AA539','#B7B6DC':'#FFE394','#374055':ink,'#9696CD':'#FFE394','#717BB4':'#D5BE83','#BAB5DF':'#F5DCA1','#9690C2':'#C9B27E','#757EAA':'#A89ACF','#F7E2B2':'#FFE394','#E3C68B':'#DAB975'}
def recolor(s):return re.sub(r'#[0-9A-Fa-f]{6}',lambda m:colors.get(m[0].upper(),m[0]),s)
def poly(x,y,p):
 inside=False;j=len(p)-1
 for i in range(len(p)):
  if (p[i][1]>y)!=(p[j][1]>y) and x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0]:inside=not inside
  j=i
 return inside
def distseg(x,y,p,q):
 dx=q[0]-p[0];dy=q[1]-p[1];t=max(0,min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy or 1)))
 return math.hypot(x-p[0]-t*dx,y-p[1]-t*dy)
def distpath(x,y):return min(distseg(x,y,p,q)-width/2 for pts,width in zip(w['paths'],w['pathWidths']) for p,q in zip(pts,pts[1:]))
def coastdist(x,y):return min(distseg(x,y,p,q) for p,q in zip(w['coast'],w['coast'][1:]+w['coast'][:1]))
def inell(x,y,z,pad=0):return ((x-z['x'])/(z['rx']+pad))**2+((y-z['y'])/(z['ry']+pad))**2<1
def shiftpoly(p,amt):
 out=[]
 for i,(x,y) in enumerate(p):
  b=p[(i+1)%len(p)];a0=p[i-1];dx=b[0]-a0[0];dy=b[1]-a0[1];l=math.hypot(dx,dy);out.append([x+dy/l*amt,y-dx/l*amt])
 return out
def path(p):
 out=[f'M {p[0][0]:.2f} {p[0][1]:.2f}'];n=len(p)
 for i in range(n):
  p0,p1,p2,p3=[p[j%n] for j in [i-1,i,i+1,i+2]]
  out.append('C %.2f %.2f %.2f %.2f %.2f %.2f'%(p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6,p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6,*p2))
 return ' '.join(out)+' Z'
ground=recolor((S/'ground.svg').read_text())
# Fine sea texture, clipped naturally by the opaque island paint above it.
sea_pattern='<defs><pattern id="community-sea-ripples" width="170" height="110" patternUnits="userSpaceOnUse"><path d="M8 20q10 -5 20 0m66 32q7 -3 14 0M41 89q15 -5 30 0m64 6q5 -2 10 0" fill="none" stroke="#D4F2E5" stroke-width="1.8" opacity=".55" stroke-linecap="round"/></pattern></defs><path d="M0 0H8000V5800H0Z" fill="url(#community-sea-ripples)"/>'
i=ground.index('>',ground.index('<svg'))+1;ground=ground[:i]+sea_pattern+ground[i:]
# A broad beach without changing physical land, plus HOME-style shallows and broken white surf.
landpath=path(shiftpoly(w['coast'],-90))
ground=re.sub(r'(<g data-name="Island grass"><path d=")[^"]+',lambda m:m[1]+landpath,ground,count=1)
ground=ground.replace('<g data-name="Two-tone lawns">',f'<path d="{landpath}" fill="none" stroke="#619A32" stroke-width="18" stroke-opacity=".4"/><g data-name="Two-tone lawns">')
foam=[]
for distance,width,opacity,col in [(125,36,.20,'#C1F0E6'),(92,18,.45,'#D2F7E9'),(65,7,.9,'#FFF9DD')]:
 foam.append(f'<path d="{path(shiftpoly(w["coast"],distance))}" fill="none" stroke="{col}" stroke-width="{width}" opacity="{opacity}"/>')
foam.append(f'<path d="{path(shiftpoly(w["coast"],150))}" fill="none" stroke="#FFF9DD" stroke-width="5" opacity=".8" stroke-dasharray="90 150 36 210" stroke-linecap="round"/>')
ground=ground.replace('<g data-name="Wet coasts">','<g data-name="HOME surf">'+''.join(foam)+'</g><g data-name="Wet coasts">')
# Replace monochrome mottling with subtle green and warm highlights; keep ground texture.
ground=ground.replace('fill="#C9C3F2" fill-opacity="0.22"','fill="#A8CA48" fill-opacity="0.20"')
ground=ground.replace('stroke-width="2.22" stroke-opacity="0.6"','stroke-width="3" stroke-opacity="0.85"')
paving=recolor((S/'paving.svg').read_text())
# HOME's plaza has a distinct ring of dressed stones, not one unbroken fill.
ring=['<g data-name="Dressed plaza rim" stroke="#A99769" stroke-width="2.5">']
for i in range(32):
 t0=i*math.tau/32+.007;t1=(i+1)*math.tau/32-.007
 points=[(4000+math.cos(t)*rx,2640+math.sin(t)*ry) for rx,ry,t in [(793,606,t0),(793,606,t1),(691,525,t1),(691,525,t0)]]
 col=['#F9E9B7','#EDCF8B','#F7E2AF','#D4C5E6'][i%4]
 ring.append('<path d="M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in points)+f' Z" fill="{col}"/>')
ring.append('</g><ellipse cx="4000" cy="2640" rx="243" ry="174" fill="#D1B579" stroke="#A99769" stroke-width="4"/><ellipse cx="4000" cy="2640" rx="224" ry="158" fill="#E7CC92" stroke="#F9E9B7" stroke-width="8"/>')
paving=paving.replace('</svg>',''.join(ring)+'</svg>')
(A/'centre/decal-paving.svg').write_text(paving)
# Use HOME's actual saturated plants/tufts/pebbles. Purple flowers remain themed accents.
for group in ['props','flats']:
 for p in a[group]:
  src=p['src'];m=re.match(r'detail/community-(plants|decals|pixi-art)-(.+)',src)
  if m:
   rel='/pixi-art/'+('' if m[1]=='pixi-art' else m[1]+'/')+m[2]
   if (ROOT/'public'/rel.lstrip('/')).exists():p['src']=rel
# Restore green portions of theme foliage while keeping the wisteria and lilac blossoms.
for name in ['tree-wisteria','tree-lilac','bush-lavender','flowers-purple']:
 p=A/'detail'/f'{name}.svg';src=S/(name+'.svg')
 if not src.exists():src.write_text(p.read_text())
 s=src.read_text().replace('#374055',ink)
 for old,new in {'#8DB29D':'#75B64D','#71998D':'#4AA539','#547C67':'#368B43','#517964':'#2B7A37','#547D68':'#398C42'}.items():s=s.replace(old,new)
 p.write_text(s)
beds=read(A/'resolved-sleepers.json')
def hidesbed(x,y,width,height,b):
 if b['pose']=='nod':return False
 return math.hypot(b['x']-x,(b['y']-y)*1.6)<width*.4+b['r']+12 or (y>b['y']-20 and y-b['y']<height*.9 and abs(x-b['x'])<width/2+b['r']*.6)
# Trees scale to the stalls; keep root anchors and nod sleepers fixed.
for p in a['props']:
 if 'tree' in p['name'].lower():
  current=p['width']*p['scale'];oldscale=p['scale'];p['scale']*=max(1,min(1.45,390/current))
  if any(hidesbed(p['x'],p['y'],p['width']*p['scale'],p['height']*p['scale'],b) for b in beds):p['scale']=oldscale
# More legible landmark silhouettes, with matching collision footprints.
def enlarge(pid,factor):
 p=next(q for q in a['props'] if q['id']==pid);p['scale']*=factor
 return p
stage=enlarge('events-stage',1.24);fire=enlarge('campfire',1.85)
flame=enlarge('campfire-flame',1.85);flame['y']=fire['y']-(.99-.555)*fire['height']*fire['scale']
for pid in ['log-west','log-east','log-south']:enlarge(pid,1.35)
for data in [w,walk]:
 for o in data['obstacles']:
  if o.get('x')==4000 and o.get('y')==2613:o.update(y=2585,rx=180,ry=72)
  if o.get('x') in [3721,4279,4000] and o.get('y') in [2657,2890]:o['rx']=131
  if o.get('poly')==[[3692,1062],[4308,1062],[4308,1280],[3692,1280]]:o['poly']=[[3618,1007],[4382,1007],[4382,1280],[3618,1280]]
# Placement checks keep planting off paths, sleeping beds, landmark footprints and reserved interiors.
beds=read(A/'resolved-sleepers.json')
def legal(x,y,r=45,tree=False):
 if not poly(x,y,w['coast']) or coastdist(x,y)<110:return False
 if distpath(x,y)<r+18:return False
 if tree and any(hidesbed(x,y,470,560,b) for b in beds):return False
 if any(math.hypot(x-b['x'],y-b['y'])<r+155 for b in beds):return False
 if any(inell(x,y,z,r) for z in w['sleepAvoid']):return False
 if any(distseg(x,y,way['a'],way['b'])<r+way['w'] for way in w['walkways']):return False
 if any(math.hypot(x-z['spawn'][0],y-z['spawn'][1])<r+100 for z in w['zones'].values()):return False
 for q in a['props']:
  if 'Flower' in q['name'] or 'bush' in q['name'].lower():continue
  if math.hypot(x-q['x'],y-q['y'])<(185 if tree else 75):return False
  if tree and q['name'] not in ['Oak tree','Round tree','Bushy tree','Wisteria tree','Lilac tree'] and abs(x-q['x'])<q['width']*q['scale']*.5+160 and y>q['y']-50 and y-460<q['y']:return False
 return True
def put(pid,name,src,x,y,width,height,scale=1,solid=None,zone='garden'):
 p=dict(id=pid,name=name,src=src,x=round(x),y=round(y),width=width,height=height,scale=scale,anchor=dict(x=.5,y=1),zone=zone,flip=False)
 a['props'].append(p)
 if solid:
  o=dict(x=round(x),y=round(y)-8,rx=solid[0],ry=solid[1]);w['obstacles'].append(o);walk['obstacles'].append(copy.deepcopy(o))
 return p
rng=random.Random(5302)
clusters=[(2880,980),(5300,1000),(6600,2150),(1450,2200),(2650,4000),(5250,4200),(5550,2050),(3200,3100),(4650,3400)]
added=[]
for attempt in range(5000):
 if len(added)>=22:break
 cx,cy=clusters[attempt%len(clusters)];x=cx+rng.uniform(-420,420);y=cy+rng.uniform(-280,280)
 if legal(x,y,48,True):
  kind=['tree-1','tree-3','tree-5','tree-2'][len(added)%4]
  svg=(ROOT/'public/pixi-art/plants'/f'{kind}.svg').read_text();vb=re.search(r'viewBox="([^"]+)"',svg)
  dims=list(map(float,vb[1].split()))[2:] if vb else [260,360]
  scale=(470 if kind in ['tree-1','tree-3'] else 520)/dims[1]
  p=put(f'polish-tree-{len(added)+1}','Tall birch tree' if kind in ['tree-2','tree-5'] else 'Grove tree','/pixi-art/plants/'+kind+'.svg',x,y,*dims,scale,(31,22));added.append(p)
  # Bushes sit at the foot of each grove, never in the open centre.
  for dx,dy in [(-105,50),(100,65)]:
   if legal(x+dx,y+dy,20):put(f'polish-root-{len(a["props"])}','Green bush','/pixi-art/plants/bush-2.svg',x+dx,y+dy,168,110,.85,(42,20))
# Soft rim gardens on all three activity areas, both stall rows and the big plaza.
regions=[('plaza',4000,2640,865,665),('activity-1',4000,1800,700,275),('activity-2',5800,2700,535,355),('activity-3',2700,1880,485,255),('stalls-1',2520,3560,475,185),('stalls-2',5420,3560,475,185)]
for label,cx,cy,rx,ry in regions:
 for i in range(30):
  t=i*math.tau/30;x=cx+math.cos(t)*rx;y=cy+math.sin(t)*ry
  # Gate gaps preserve every approach and the broad walking lanes.
  if distpath(x,y)<70 or any(math.hypot(x-b['x'],y-b['y'])<130 for b in beds):continue
  if any(abs(x-q['x'])<90 and abs(y-q['y'])<80 for q in a['props'] if 'Flower' not in q['name']):continue
  name='Flower border';src='/pixi-art/plants/flower-2.svg';ww,hh=65,49
  if i%3==0:name='Low garden hedge';src='/pixi-art/plants/bush-2.svg';ww,hh=120,78
  put(f'polish-border-{label}-{i}',name,src,x,y,ww,hh,zone=label+'-edge')
# Game square and stall row rims get broken lavender flower beds, with entrances free.
for label,cx,cy,rx,ry in regions:
 if label not in ['activity-2','stalls-1','stalls-2']:continue
 for i in range(22):
  t=i*math.tau/22;x=cx+math.cos(t)*(rx+15);y=cy+math.sin(t)*(ry+22)
  if distpath(x,y)<80 or any(math.hypot(x-b['x'],y-b['y'])<150 for b in beds):continue
  if any(math.hypot(x-q['x'],y-q['y'])<80 for q in a['props'] if 'border' not in q['name'].lower()):continue
  put(f'polish-lavender-{label}-{i}','Lavender flower border','detail/flowers-purple.svg',x,y,90,64,zone=label+'-edge')
# Crates and a water barrel sit beside the cocoa cart, clear of the empty stall row.
crate='<svg xmlns="http://www.w3.org/2000/svg" width="90" height="82" viewBox="0 0 90 82"><g stroke="#39472D" stroke-width="2.5" stroke-linejoin="round"><path d="M6 20L22 7H70L84 20V73H6Z" fill="#C88941"/><path d="M6 20H84L70 7H22Z" fill="#EDBE70"/><path d="M13 28H77V65H13Z" fill="#A76F37"/><path d="M12 27L78 65M12 65L78 27" stroke="#EDBE70" stroke-width="8"/><path d="M6 20H84" fill="none"/></g></svg>'
barrel='<svg xmlns="http://www.w3.org/2000/svg" width="72" height="90" viewBox="0 0 72 90"><g stroke="#39472D" stroke-width="2.5"><path d="M13 13Q3 43 13 77Q36 91 59 77Q69 43 59 13Z" fill="#C88941"/><path d="M23 18Q18 47 24 82M48 18Q54 47 48 82M36 20V85" fill="none" stroke="#885931"/><path d="M9 31Q36 41 63 31M9 65Q36 75 63 65" fill="none" stroke="#66677C" stroke-width="8"/><ellipse cx="36" cy="13" rx="23" ry="9" fill="#EDBE70"/></g></svg>'
(A/'detail/community-crate.svg').write_text(crate);(A/'detail/community-barrel.svg').write_text(barrel)
for i,(src,x,y,width,height) in enumerate([('community-crate',6140,3480,90,82),('community-crate',6210,3490,70,64),('community-barrel',6150,3590,72,90)]):
 if not any(hidesbed(x,y,width,height,b) for b in beds):put(f'polish-supply-{i}','Cocoa supplies',f'detail/{src}.svg',x,y,width,height,solid=(width*.35,18),zone='cocoa-cart')
# Small, grounded beach and picnic details use HOME's existing traced props.
for i,(name,src,x,y,width,height) in enumerate([
 ('Beach towel','/pixi-art/detail/beach--towel-striped.svg',6200,3830,165,77),
 ('Beach towel','/pixi-art/detail/beach--towel-sun.svg',6600,3600,150,75),
 ('Beach bucket','/pixi-art/detail/beach--bucket.svg',6825,3265,60,68),
 ('Beach ball','/pixi-art/detail/beach--beach-ball.svg',6460,3140,72,72),
 ('Beach shells','/pixi-art/detail/beach--shell-conch.svg',6900,3370,52,39),
 ('Beach sandcastle','/pixi-art/detail/beach--sandcastle-small.svg',6510,3850,112,87),
 ('Picnic basket','/pixi-art/detail/street--picnic-basket.svg',2065,1900,78,68),
 ('Picnic basket','/pixi-art/detail/street--picnic-basket.svg',6325,4550,78,68)]):
 if any(hidesbed(x,y,width,height,b) for b in beds):continue
 put(f'polish-life-{i}',name,src,x,y,width,height,zone='beach' if i<6 else 'picnic')
# Butterflies are small accents near the flowers, never oversized focal points.
butterfly='<svg xmlns="http://www.w3.org/2000/svg" width="42" height="32" viewBox="0 0 42 32"><g stroke="#39472D" stroke-width="1.6"><path d="M21 17Q4 -4 3 12Q2 24 18 24Q9 33 17 30L21 19Q25 33 32 28L25 22Q42 22 39 9Q35 -3 21 17Z" fill="#E1BEF3"/><path d="M21 13v14m0-14-4-6m4 6 5-7" fill="none"/></g></svg>'
(A/'detail/garden-butterfly.svg').write_text(butterfly)
for i,(x,y) in enumerate([(2350,2300),(3020,3280),(5330,2310),(2950,3900),(4910,3340),(2550,1500)]):put(f'polish-butterfly-{i}','Garden butterfly','detail/garden-butterfly.svg',x,y,42,32,zone='garden')
# Existing benches repeated sparingly around the campfire and activity rims.
bench=next(p for p in a['props'] if p['name']=='Bench')
for i,(x,y) in enumerate([(5450,3040),(6150,3040),(2650,2210),(3510,1500),(4490,1500)]):
 if any(math.hypot(x-b['x'],y-b['y'])<150 for b in beds):continue
 p=copy.deepcopy(bench);p.update(id=f'polish-bench-{i}',x=x,y=y,zone='rim-seating');a['props'].append(p)
 for data in [w,walk]:data['obstacles'].append(dict(x=x,y=y-12,rx=p['width']*p['scale']*.44,ry=22))
# Pond dock, reed beds and rocks borrowed from HOME's vector vocabulary.
dock='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><g stroke="#39472D" stroke-width="3" stroke-linejoin="round"><path d="M20 16H160V170H20Z" fill="#885931"/><path d="M20 10H160V156H20Z" fill="#C88941"/>'
for y in range(12,150,24):dock+=f'<path d="M22 {y}H158" fill="none"/><path d="M37 {y+7}h45" stroke="#EDBE70"/>'
for x in [20,160]:
 for y in [18,144]:dock+=f'<path d="M{x-5} {y-18}h10v40h-10Z" fill="#885931"/><ellipse cx="{x}" cy="{y-18}" rx="8" ry="4" fill="#E6B569"/>'
dock+='</g></svg>'; (A/'detail/pond-dock.svg').write_text(dock)
a['decks'].append(dict(src='detail/pond-dock.svg',x=1875,y=1590,width=180,height=180))
for data in [w,walk]:
 data['walkways'].append(dict(a=[1965,1750],b=[1965,1600],w=140))
 data['bridges'].append(dict(x=1965,y=1680,w=164,h=204))
# Reeds and small shore rocks are flat native SVG, no new image credits.
reeds='<svg xmlns="http://www.w3.org/2000/svg" width="90" height="105" viewBox="0 0 90 105"><g stroke="#39472D" stroke-width="3" stroke-linecap="round"><path d="M42 100Q12 60 8 38Q35 58 42 100M48 100Q71 56 83 49Q68 87 48 100M46 100V14M57 100L65 25M33 100L28 18" fill="#4AA539"/><path d="M45 14v25M65 25v23M28 18v24" stroke="#885931" stroke-width="9"/></g></svg>'
(A/'detail/pond-reeds.svg').write_text(reeds)
rock='<svg xmlns="http://www.w3.org/2000/svg" width="85" height="55" viewBox="0 0 85 55"><path d="M4 41L18 15 43 6 68 18 80 42 57 51 18 49Z" fill="#B9B88A" stroke="#39472D" stroke-width="3"/><path d="M18 15L43 6 68 18 48 30 28 29Z" fill="#E9DDB2"/><path d="M48 30L57 51M28 29L18 49" fill="none" stroke="#7D8860" stroke-width="2"/></svg>'
(A/'detail/shore-rock.svg').write_text(rock)
for i,deg in enumerate([12,35,65,128,153,190,225,280,320]):
 t=math.radians(deg);x=1980+math.cos(t)*510;y=1430+math.sin(t)*310
 put(f'polish-reeds-{i}','Pond reeds','detail/pond-reeds.svg',x,y,90,105,zone='pond')
 put(f'polish-rock-{i}','Shore rock','detail/shore-rock.svg',x+55,y+20,85,55,zone='pond')
# More HOME grass tufts in clear grass gaps, leaving activity centres free.
for i in range(1300):
 x=rng.uniform(1000,7000);y=rng.uniform(800,4500)
 if poly(x,y,w['coast']) and coastdist(x,y)>130 and distpath(x,y)>30 and not any(inell(x,y,z) for z in w['sleepAvoid']) and not inell(x,y,dict(x=6560,y=3380,rx=820,ry=820)) and not inell(x,y,dict(x=900,y=3150,rx=440,ry=390)):
  a['flats'].append(dict(src='/pixi-art/decals/grass-tuft-'+str(i%3+1)+'.svg',x=round(x),y=round(y),width=38+i%22,height=25+i%11,flip=bool(i%2)))
# Preserve the traced hearth and logs. Complete the two side stone crowns that
# were cut by the original flame-separation mask; the live flame remains separate.
source=(A/'detail/campfire.svg').read_text()
inner=source[source.index('>')+1:source.rindex('</svg>')]
head='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="426" viewBox="0 0 960 852">'
back=''.join(f'<ellipse cx="{x}" cy="{y}" rx="88" ry="55" fill="#BDB9CD" stroke="#374055" stroke-width="12"/>' for x,y in [(240,399),(358,359),(600,359),(720,399)])
crowns=''.join(f'<ellipse cx="{x}" cy="498" rx="85" ry="65" fill="#BDB9CD" stroke="#374055" stroke-width="12"/>' for x in [148,812])
(A/'centre/fire-base.svg').write_text(head+'<defs><clipPath id="base"><rect y="458" width="960" height="394"/></clipPath></defs>'+back+crowns+'<g clip-path="url(#base)">'+inner+'</g></svg>')
# Final shared contract data remains aligned with the visible centre pieces.
for piece in c['pieces']:
 p=next((q for q in a['props'] if q['id']==piece['id']),None)
 if p:
  width=p['width']*p['scale'];height=p['height']*p['scale'];at=[p['x']-4000,p['y']-2640];piece.update(width=width,height=height,at=at,x=at[0]-p['anchor']['x']*width,y=at[1]-p['anchor']['y']*height,sortY=p.get('sortY',p['y'])-2640)
c['blocked']=[]
for o in walk['obstacles']:
 xx=sum(p[0] for p in o['poly'])/len(o['poly']) if 'poly' in o else o['x'];yy=sum(p[1] for p in o['poly'])/len(o['poly']) if 'poly' in o else o['y']
 if abs(xx-4000)<820 and abs(yy-2640)<700:c['blocked'].append({'poly':[[x-4000,y-2640] for x,y in o['poly']]} if 'poly' in o else {'ellipse':{**o,'x':xx-4000,'y':yy-2640}})
(A/'ground.svg').write_text(ground)
for tile in a['ground']['tiles']:
 s=re.sub(r'<svg[^>]+>',f'<svg xmlns="http://www.w3.org/2000/svg" width="{tile["width"]}" height="{tile["height"]}" viewBox="{tile["x"]} {tile["y"]} {tile["width"]} {tile["height"]}">',ground,count=1)
 (A/tile['src']).write_text(s)
a.update(sea=sea,paletteVersion=3);w['props']=a['props']
save(A/'art.json',a);save(D/'world.json',w);save(D/'walk-world.json',walk);save(A/'centre/centre.json',c)
save(A/'palette.json',dict(sea=sea,lawn=grass,path='#FFE394',paving='#F5DCA1',shore='#FFE394',ink=ink,cream='#FFF0C7',accent='#A89ACF'))
print('Polished',len(a['props']),'props',len(a['flats']),'flats',sum('tree' in p['name'].lower() for p in a['props']),'trees',len(added),'new trees')
