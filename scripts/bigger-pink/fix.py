"""Strict Pink review pass. Rebuilds only Pink; Shapely is a build-time tool."""
from pathlib import Path
import sys,runpy,json,math,copy,colorsys
sys.path.insert(0,'/private/tmp/ducky-pink-geometry')
from shapely.geometry import Polygon,LineString,Point,box
from shapely.ops import unary_union,split
p=Path('scripts/bigger-pink/communities.py')
g=runpy.run_path(str(p));S=g['S'];A=g['A'];X=g['X'];old=g['old'];w=g['w'];props=g['props'];obstacles=g['obstacles'];kit=g['kit'];custom=g['custom'];curve=g['curve'];sample=g['sample']
layout=json.loads((S/'layout.json').read_text());ground=g['ground'];inner=g['inner']
styles=[('#cbb6df','#b09ecf',.90,.94,'scallop'),('#f5a3c7','#e18eb2',1.03,.88,'awning'),('#f6d4e2','#cbadcf',.94,1.06,'dormer'),('#fcebd6','#ed9db5',1.08,.95,'porch'),('#e4c9e6','#b7a0cf',.86,1.02,'awning'),('#f9c3d5','#d393ba',1,.93,'scallop')]
for i,h in enumerate(p for p in props if p.get('household')):
 pale,roof,sx,sy,porch=styles[i%len(styles)];text=(A/h['src']).read_text();import xml.etree.ElementTree as ET
 root=ET.fromstring(text);vb=list(map(float,root.attrib.get('viewBox',f'0 0 {h["width"]} {h["height"]}').split()));xx,yy,ww,hh=vb
 replacements={'#f5a3c7':roof,'#f6d4e2':pale,'#ec6fa8':roof,'#cbb6df':pale}
 for el in root.iter():
  for attr in ['fill','stroke']:
   color=el.get(attr,'').lower()
   if color in replacements:el.set(attr,replacements[color])
   elif len(color)==7 and color.startswith('#'):
    r,gg,b=[int(color[k:k+2],16)/255 for k in [1,3,5]];hue,light,sat=colorsys.rgb_to_hls(r,gg,b)
    if r>.56 and b>.3 and sat>.17 and (hue>.74 or hue<.035) and gg<r*.96:
     target=['#b99bd0','#ed9fa8','#f2bb94','#c2a6d4','#d9ace0','#efb3cc'][i%6]
     tr,tg,tb=[int(target[k:k+2],16)/255 for k in [1,3,5]];th,tl,ts=colorsys.rgb_to_hls(tr,tg,tb)
     rgb=colorsys.hls_to_rgb(th,light,max(.16,sat*.74));el.set(attr,'#'+''.join(f'{round(v*255):02x}' for v in rgb))
 ns='{http://www.w3.org/2000/svg}';layer=ET.SubElement(root,ns+'g',{'transform':f'translate({xx+ww*.5} {yy+hh*.78}) scale({ww/500})','stroke':'#805c72','stroke-width':'3','stroke-linejoin':'round'})
 if porch in ['awning','scallop']:
  ET.SubElement(layer,ns+'path',{'d':'M-76 8L-63-32H63L76 8Q57 24 38 8Q19 24 0 8Q-19 24-38 8Q-57 24-76 8Z','fill':roof})
  ET.SubElement(layer,ns+'path',{'d':'M-50 16V83M50 16V83','stroke':'#fff0c7','stroke-width':'8','fill':'none'})
 elif porch=='porch':
  ET.SubElement(layer,ns+'path',{'d':'M-88 15L0-25L88 15ZM-75 18V88M75 18V88M-90 88H90','fill':'#fff0c7','stroke-width':'6'})
 else:
  ET.SubElement(layer,ns+'path',{'d':'M-43-180L0-224L43-180V-128H-43Z','fill':pale})
  ET.SubElement(layer,ns+'path',{'d':'M-20-177H20V-142H-20ZM0-177V-142','fill':'#c7e8da'})
 name=f'expansion/house-{i+1:02}.svg';(A/name).write_text(ET.tostring(root,encoding='unicode').replace('ns0:','').replace('xmlns:ns0=','xmlns='));h['src']=name;h['width']*=sx;h['height']*=sy
 for o in obstacles:
  if o['name']==h['id']:o['rx']*=sx;o['ry']*=sx
 h['variant']=porch
for src,x,y,sc in [('tree-cherry',2880,-90,.78),('tree-cherry',3260,-260,.9),('tree-cherry',3560,-40,.72),('tree-cherry',3030,220,.66),('tree-cherry',430,3530,.8),('tree-cherry',810,3700,.9),('tree-cherry',1640,3960,.72),('tree-willow',7560,3400,.85),('tree-willow',7900,3630,.7),('tree-cherry',6740,4400,.76)]:kit(src,x,y,'commons',sc)
kit('picnic-blanket',600,3910,'commons',1.3,solid=False);custom('tea-table',850,4120,'commons',170,148,68,22)
for x,y in [(2770,120),(3330,170),(970,3510),(1260,3750),(7470,3640),(7770,3860)]:kit('flowers-pink',x,y,'commons',1.3,solid=False)
for x,y in [(390,3340),(590,3480),(790,3600)]:custom('potting-bench',x,y,'commons',185,124,72,19)
ground=ground[:-4]+'<g clip-path="url(#pink-roads)">'
for ri,(points,width,phase) in enumerate(g['roadsets']):
 s=sample(points)
 for side in [-1,1]:
  pts=[]
  for j,(x,y) in enumerate(s):
   a=s[max(0,j-1)];b=s[min(len(s)-1,j+1)];dx,dy=b[0]-a[0],b[1]-a[1];d=math.hypot(dx,dy) or 1
   off=side*width*(.22+.035*math.sin(j*.41));pts.append([x-dy/d*off,y+dx/d*off])
  ground+=f'<path d="{curve(pts,False)}" fill="none" stroke="#c7a975" stroke-width="13" opacity=".32" stroke-dasharray="80 32 130 55 25 35" stroke-linecap="round"/>'
ground+='</g>'
mainland=Polygon(w['coast']).buffer(0)
islets=[Point(x,y).buffer(1,resolution=40) for x,y,rx,ry in []]
from shapely.affinity import scale
islets=[scale(Point(x,y).buffer(1,40),rx,ry,origin=(x,y)) for x,y,rx,ry in w['islets']]
protected=unary_union([mainland]+islets)
canal=mainland.buffer(210,resolution=4).difference(protected.buffer(8))
streams=[('Rosewater Brook',[(900,2600),(650,3050),(800,3450),(1090,3850),(1470,4240),(1660,4660),(1600,5040),(1100,5400)],95),('Willow Ribbon',[(7120,2140),(7570,2420),(7790,2830),(7510,3250),(7590,3620),(7930,3990),(8390,4140)],95)]
streamShapes=[LineString(sample(pts)).buffer(width,resolution=4).difference(protected.buffer(8)) for name,pts,width in streams]
river=unary_union([canal]+streamShapes).intersection(Polygon(layout['coast']).buffer(100)).difference(protected.buffer(8))
def svgPoly(poly):
 coords=lambda ring:'M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in ring.coords)+'Z'
 return coords(poly.exterior)+''.join(coords(r) for r in poly.interiors)
def polys(shape):return [shape] if shape.geom_type=='Polygon' else [p for p in shape.geoms if p.geom_type=='Polygon']
waterArt=''
for shape in polys(river):
 d=svgPoly(shape);waterArt+=f'<path d="{d}" fill="#6ec9de" fill-rule="evenodd" stroke="#659b72" stroke-width="22"/><path d="{d}" fill="none" stroke="#c4e3b3" stroke-width="8"/>'
xmin,ymin,xmax,ymax=river.bounds
pieces=[]
for x in range(math.floor(xmin/512)*512,math.ceil(xmax/512)*512,512):
 for y in range(math.floor(ymin/512)*512,math.ceil(ymax/512)*512,512):
  cell=river.intersection(box(x,y,x+512,y+512))
  pieces.extend(p for p in polys(cell) if p.area>1)
waters=[]
for piece in pieces:
 if piece.interiors:raise RuntimeError('Water polygon still has a hole')
 waters.append(dict(name='Rosybutton canal / streams',poly=[[round(x,2),round(y,2)] for x,y in piece.exterior.coords]))
for cx,cy,rx,ry in [(3240,-80,540,260),(4540,70,300,190),(6350,4350,330,180)]:
 d=curve([[cx-rx,cy],[cx-rx*.7,cy-ry],[cx+rx*.55,cy-ry*.8],[cx+rx,cy+40],[cx+rx*.4,cy+ry],[cx-rx*.8,cy+ry*.6]])
 ground+=f'<path d="{d}" fill="#adcb62" stroke="#7caa43" stroke-width="5"/>'
 for dy in [-90,0,90]:
  ground+=f'<path d="M{cx-rx*.7} {cy+dy}Q{cx} {cy+dy+35} {cx+rx*.7} {cy+dy-15}" fill="none" stroke="#bd9d73" stroke-width="34" stroke-linecap="round"/>'
  for t in [-.58,-.35,-.12,.13,.36,.58]:
   x=cx+rx*t;y=cy+dy+8
   ground+=f'<path d="M{x} {y+12}v-27m0 12q-21-13-28-3m28 3q18-18 28-7" fill="none" stroke="#668d3c" stroke-width="4"/><path d="M{x-12} {y-12}q-12-15 1-19q9-13 19 0q18 3 10 17q-7 13-18 6Z" fill="#f5a3c7" stroke="#cd7ca6" stroke-width="3"/>'
oldAxes=[('jetty-harbor.svg',[1074,1300],[703,1084],104)]+[(d['src'],b['a'],b['b'],b['w']) for d,b in zip([old['decks'][4],old['decks'][5],old['decks'][1],old['decks'][2],old['decks'][3]],w['walkways'])]
bridges=[];decks=[];audit=[]
def support(name,a,b,width):
 length=math.dist(a,b);n=math.ceil(length/(width*.65))
 for i in range(n+1):
  t=i/n;bridges.append(dict(name=name,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,w=width*.75+16,h=width*.75+24))
for name,a,b,width in oldAxes:
 support(name,a,b,width);mid=LineString([a,b]).interpolate(.55,normalized=True)
 audit.append(dict(name=name,before='dry expansion lawn beneath the offshore deck',after='old-shore canal',a=a,b=b,waterUnder=river.intersects(LineString([a,b])),sample=[mid.x,mid.y]))
rack=next(p for p in props if p['id']=='community-pink-100');rack['x']=5530;rack['y']=360
for o in obstacles:
 if o['name']==rack['id']:o['x']=5530;o['y']=354.6
placements={53:(1850,350),95:(5800,400),96:(5680,370),97:(6700,400),98:(6580,370),375:(7290,3400),385:(8080,3860),388:(490,3670)}
for group in [range(287,290),range(290,293),range(293,296),range(296,299),range(299,302),range(302,305),range(305,308)]:
 for i in group:
  prop=next(p for p in props if p['id']==f'community-pink-{i}');placements[i]=(prop['x'],prop['y']-260)
for i,(x,y) in placements.items():
 prop=next(p for p in props if p['id']==f'community-pink-{i}');dx,dy=x-prop['x'],y-prop['y'];prop['x']=x;prop['y']=y
 for o in obstacles:
  if o['name']==prop['id']:o['x']+=dx;o['y']+=dy
newCross=[]
for ri,points in enumerate(layout['paths']+[layout['shoreWalk']+[layout['shoreWalk'][0]]]):
 line=LineString(sample(points));wet=line.intersection(river)
 lines=[wet] if wet.geom_type=='LineString' else [q for q in getattr(wet,'geoms',[]) if q.geom_type=='LineString']
 for segment in lines:
  if segment.length<45:continue
  mid=segment.interpolate(.5,normalized=True)
  if any(LineString([a,b]).distance(mid)<230 for _,a,b,_ in oldAxes):continue
  if any(Point(c['mid']).distance(mid)<220 for c in newCross):continue
  near=line.project(mid);half=segment.length/2+65
  a=list(line.interpolate(max(0,near-half)).coords)[0];b=list(line.interpolate(min(line.length,near+half)).coords)[0]
  if math.dist(a,b)>700:continue
  width=190 if ri==0 else 145 if ri<7 else 125
  pa=line.interpolate(max(0,near-35));pb=line.interpolate(min(line.length,near+35));tx,ty=pb.x-pa.x,pb.y-pa.y;td=math.hypot(tx,ty) or 1
  a=(mid.x-tx/td*half,mid.y-ty/td*half);b=(mid.x+tx/td*half,mid.y+ty/td*half)
  name=f'river-crossing-{len(newCross)+1:02}' 
  dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);angle=math.degrees(math.atan2(dy,dx))
  body=f'<g transform="translate({a[0]} {a[1]}) rotate({angle})"><path d="M0 {-width/2}H{length}V{width/2}H0Z" fill="#ca9a69" stroke="#805c56" stroke-width="5"/>'
  for t in range(10,math.ceil(length),26):body+=f'<path d="M{t} {-width/2+3}V{width/2-3}" stroke="#805c56" stroke-width="3"/><path d="M{t+5} {-width/2+8}v{width-16}" stroke="#fcebd6" stroke-width="2" opacity=".5"/>'
  for side in [-1,1]:
   yy=side*(width/2+2);body+=f'<path d="M0 {yy}Q{length/2} {yy-24} {length} {yy}" fill="none" stroke="#805c56" stroke-width="8"/><path d="M0 {yy-2}Q{length/2} {yy-26} {length} {yy-2}" fill="none" stroke="#fff0c7" stroke-width="4"/>'
  body+='</g>';x0=min(a[0],b[0])-width;y0=min(a[1],b[1])-width;ww=abs(dx)+width*2;hh=abs(dy)+width*2
  (X/(name+'.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{ww}" height="{hh}" viewBox="{x0} {y0} {ww} {hh}">{body}</svg>')
  decks.append(dict(src=f'expansion/{name}.svg',x=x0,y=y0,width=ww,height=hh));support(name,a,b,width)
  newCross.append(dict(name=name,road=ri,mid=[mid.x,mid.y],a=a,b=b,width=width))
for x,y in [(770,3010),(1500,4540),(7610,3500),(7600,2550),(3800,610),(850,2250),(6100,3710)]:
 for dx,dy in [(-28,12),(0,-4),(23,15)]:waterArt+=f'<path d="M{x+dx} {y+dy}q-18-29-12-49m12 49q4-38 15-43m-15 43q-2-45-6-61" fill="none" stroke="#65933f" stroke-width="5" stroke-linecap="round"/>'
 for dx,dy in [(44,45),(61,66)]:waterArt+=f'<ellipse cx="{x+dx}" cy="{y+dy}" rx="16" ry="8" fill="#86b94b" stroke="#659b72" stroke-width="2"/>'
ground+=waterArt+'</g>'
combined=ground+inner;(S/'ground-body.svg').write_text(combined)
(X/'ground-source.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="13200" height="9800" viewBox="-2600 -1900 13200 9800">{combined}</svg>')
layout.update(props=props,obstacles=obstacles,water=waters,bridges=bridges,decks=decks,riverCrossings=newCross,bridgeAudit=audit,streams=[dict(name=name,points=pts,width=width) for name,pts,width in streams])
(S/'layout.json').write_text(json.dumps(layout,indent=1)+'\n')
print('FIX:',len(waters),'water polygons,',len(newCross),'new road crossings,',len(bridges),'deck supports')
for c in newCross:print(c['name'],'road',c['road'],'at',list(map(round,c['mid'])))
