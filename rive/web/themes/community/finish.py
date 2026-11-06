"""Community-only finishing pass. Input is a snapshot of the started Community theme.
Run: python3 rive/web/themes/community/finish.py /tmp/community-original
Reuses the original image-generated, traced SVG props. Writes no shared files.
"""
from pathlib import Path
import json,re,sys,colorsys,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'public/pixi-art/themes/community'; DATA=Path(__file__).parent
SOURCE=Path(sys.argv[1]); BASE=SOURCE/'art'
read=lambda p:json.loads(p.read_text())
save=lambda p,d:p.write_text(json.dumps(d,indent=2)+'\n')
a=read(BASE/'art.json'); w=read(SOURCE/'data/world.json'); walk=read(SOURCE/'data/walk-world.json')
C=ART/'centre'; C.mkdir(exist_ok=True)
palette={'#94C978':'#A7B8B0','#4FA65A':'#71998D','#6EC9DE':'#263957','#D3CEF4':'#9696CD','#A9A2E2':'#717BB4','#C4BFF0':'#BAB5DF','#9C95DC':'#9690C2','#8A82CF':'#757EAA','#39472D':'#374055'}
def replace(s,mp):
 return re.sub(r'#[0-9A-Fa-f]{6}',lambda m:mp.get(m[0].upper(),m[0]),s)
def mellow(s):
 def colour(m):
  x=m[0];r,g,b=[int(x[i:i+2],16)/255 for i in (1,3,5)]
  h,l,s=colorsys.rgb_to_hls(r,g,b)
  if g>r*1.09 and g>b*1.05 and s>.23:
   nr,ng,nb=colorsys.hls_to_rgb(.405,max(.23,min(.74,l*.94)),min(.25,s*.42))
   return '#%02X%02X%02X'%(round(nr*255),round(ng*255),round(nb*255))
  return palette.get(x.upper(),x)
 return re.sub(r'#[0-9A-Fa-f]{6}',colour,s)
# Muted sage land, lavender promenade and shore edge, navy ocean. Beaches stay cream.
for p in BASE.glob('*.svg'):
 s=replace(p.read_text(),palette)
 s=re.sub(r'<g data-name="Footpaths".*?</g>',lambda m:re.sub(r'stroke-width="(150|164|168|184)"',lambda q:'stroke-width="'+str(int(q[1])+10)+'"',m[0]),s,flags=re.S)
 s=re.sub(r'(<g data-name="(?:Sandy coast|Islet sand)">)(.*?)(</g>)',lambda m:m[1]+m[2].replace('#F7E2B2','#B7B6DC')+m[3],s,flags=re.S)
 (ART/p.name).write_text(s)
for p in (BASE/'detail').glob('*.svg'):(ART/'detail'/p.name).write_text(mellow(p.read_text()))
# The traced screen speech bubble was transparent, exposing green ground. Restore its white fill and three dots.
p=ART/'detail/stage.svg';s=p.read_text();i=s.index('>')+1
bubble='<g><ellipse cx="824" cy="554" rx="223" ry="151" fill="#F4EEFF"/><path d="M702 661 L673 727 L761 675Z" fill="#F4EEFF"/></g>'
s=s[:i]+bubble+s[i:];s=s.replace('</svg>','<g fill="#817BD0"><circle cx="751" cy="555" r="19"/><circle cx="824" cy="555" r="19"/><circle cx="897" cy="555" r="19"/></g></svg>');p.write_text(s)
# Theme-local variants of all shared green plants/decals. Home is untouched.
for group in ('props','flats'):
 for item in a[group]:
  if not item['src'].startswith('/pixi-art/'):continue
  original=ROOT/'public'/item['src'].lstrip('/')
  if not original.exists():continue
  dest=ART/'detail'/('community-'+original.parent.name+'-'+original.name)
  dest.write_text(mellow(original.read_text()))
  item['src']='detail/'+dest.name
# Central plaza is an actual separate decal, shared by the manifest and centre.json.
s=(ART/'ground.svg').read_text();m=re.search(r'<g data-name="Campfire commons">.*?</g>',s,re.S)
assert m,'Missing plaza paving group'
paving=m[0]
header='<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1440" viewBox="3100 1920 1800 1440">'
(C/'decal-paving.svg').write_text(header+paving+'</svg>')
for p in [ART/'ground.svg',*ART.glob('ground-r*-c*.svg')]:p.write_text(p.read_text().replace(paving,''))
a['flats'].insert(0,dict(src='centre/decal-paving.svg',x=3100,y=1920,width=1800,height=1440,topLeft=True))
# Separate stones/logs from the flame so the hearth never scales with the fire.
source=(ART/'detail/campfire.svg').read_text();root=ET.fromstring(source);paths=list(root)
flames=[e for e in paths if e.attrib.get('fill') in ('#FB9333','#FCF98D')]
assert len(flames)==2
flame=''.join(ET.tostring(e,encoding='unicode').replace('ns0:','').replace(':ns0','') for e in flames)
# Dark contour follows the orange flame rather than the whole hearth silhouette.
flame=flame.replace('fill="#FB9333"','fill="#FB9333" stroke="#374055" stroke-width="12" stroke-linejoin="round"')
head='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="426" viewBox="0 0 960 852">'
(C/'fire-flame.svg').write_text(head+flame+'</svg>')
inner=source[source.index('>')+1:source.rindex('</svg>')]
back=''.join(f'<ellipse cx="{x}" cy="{y}" rx="88" ry="55" fill="#BDB9CD" stroke="#374055" stroke-width="12"/>' for x,y in [(240,399),(358,359),(600,359),(720,399)])
(C/'fire-base.svg').write_text(head+'<defs><clipPath id="base"><rect y="458" width="960" height="394"/></clipPath></defs>'+back+'<g clip-path="url(#base)">'+inner+'</g></svg>')
# Each existing centre piece gets its own SVG and relative placement/sortY contract.
pieces=[dict(id='decal-paving',file='decal-paving.svg',layer='decal',x=-900,y=-720,width=1800,height=1440,anchor=dict(x=0,y=0),at=[-900,-720])]
for prop in a['props']:
 if prop['zone']!='plaza':continue
 old=prop['src'];name=prop['id']+'.svg'
 if prop['id']=='campfire':name='fire-base.svg'
 else:(C/name).write_text((ART/old).read_text())
 prop['src']='centre/'+name;prop['sortY']=prop['y'];prop['shadow']=False
 width=prop['width']*prop['scale'];height=prop['height']*prop['scale'];at=[prop['x']-4000,prop['y']-2640]
 pieces.append(dict(id=prop['id'],file=name,layer='front' if prop['id']=='log-south' or prop['id'] in ['lights-west','lights-east'] else 'sorted',width=width,height=height,anchor=prop['anchor'],at=at,x=at[0]-prop['anchor']['x']*width,y=at[1]-prop['anchor']['y']*height,sortY=at[1],flip=prop.get('flip',False)))
fire=next(p for p in a['props'] if p['id']=='campfire');scale=fire['scale'];width=fire['width']*scale;height=fire['height']*scale
flameProp={**fire,'id':'campfire-flame','name':'Campfire flame','src':'centre/fire-flame.svg','anchor':{'x':.5,'y':.555},'y':fire['y']-(.99-.555)*height,'sortY':fire['y']+.1,'animate':{'kind':'fire','amplitude':.045}}
a['props'].append(flameProp)
pieces.append(dict(id='campfire-flame',file='fire-flame.svg',layer='anim',width=width,height=height,anchor=flameProp['anchor'],at=[0,flameProp['y']-2640],x=-width/2,y=flameProp['y']-2640-.555*height,sortY=13.1,animate={'kind':'fire','amplitude':.045,'module':'animate.js'}))
centre=dict(theme='community',name='Community campfire circle',concept='concepts/themes/community-centre/community-centre-3.png',origin='campfire plaza centre on the ground',placement=[4000,2640],depthRatio=.765957,pieces=pieces,outerEdge=dict(x=0,y=0,rx=820,ry=628),walkable=[{'ellipse':dict(x=0,y=0,rx=800,ry=608)}],blocked=[],spawn=[0,330],stairs=[])
post={'x':4312,'y':2422,'rx':16,'ry':12}
for data in (w,walk):
 if post not in data['obstacles']:data['obstacles'].append(post)
# Match real collision shapes in the centre contract, expressed relative to its origin.
for o in walk['obstacles']:
 if 'poly' in o:
  xx=sum(p[0] for p in o['poly'])/len(o['poly']);yy=sum(p[1] for p in o['poly'])/len(o['poly'])
 else:xx,yy=o['x'],o['y']
 if abs(xx-4000)<820 and abs(yy-2640)<700:
  if 'poly' in o:centre['blocked'].append({'poly':[[x-4000,y-2640] for x,y in o['poly']]})
  else:centre['blocked'].append({'ellipse':{**o,'x':xx-4000,'y':yy-2640}})
save(C/'centre.json',centre)
a.update(sea='#263957',name='Community Island',paletteVersion=2,centre={'src':'centre/centre.json','x':4000,'y':2640,'scale':1})
w['pathWidths']=[max(160,n) for n in w['pathWidths']]
w['zones']['pond']['spawn']=[2294,1848]
w['name']='Community Island';w['zones']['centre']={**w['zones']['plaza'],'name':'Campfire circle','src':'centre/centre.json'}
w['props']=a['props']
# The only rejected sleeper was hidden by the east pavilion. Its final site is resolved by verify.mjs.
w['sleepSpots']['wing']=[([5373,1619,s[2]] if s[:2]==[5271,1395] else s) for s in w['sleepSpots']['wing']]
save(ART/'art.json',a);save(DATA/'world.json',w);save(DATA/'walk-world.json',walk)
save(ART/'palette.json',dict(sea='#263957',lawn='#A7B8B0',path='#9696CD',paving='#BAB5DF',shore='#B7B6DC',ink='#374055',cream='#FFF0C7'))
print('Finished palette, local foliage, repaired screen, layered centre:',len(pieces),'pieces')
