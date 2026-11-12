"""Authored Nuggetnook community composition. No randomly placed props. Plan precedes build."""
from pathlib import Path
import json, math, re, sys, copy, base64
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union
from shapely.affinity import scale as geomscale
R=Path(__file__).resolve().parents[2]; A=R/'public/pixi-art/themes/goldmine'; D=R/'assets/world/themes/goldmine'; S=Path(__file__).parent
OUT=R.parent/'concepts/themes/world-map/bigger'; OUT.mkdir(parents=True,exist_ok=True)
def load(n):return json.loads((S/'original'/n).read_text())
def write(p,d):p.write_text(json.dumps(d,indent=2)+'\n')
w=load('world.json'); walk=load('walk-world.json'); art=load('art.json'); harbor=load('harbor.json')
OX,OY,W,H=-2300,-2100,12600,9900
INK='#39472D'
def path(g):
 if g.is_empty:return ''
 if g.geom_type=='Polygon':return 'M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in g.exterior.coords)+' Z '+' '.join('M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in r.coords)+' Z' for r in g.interiors)
 return ' '.join(path(p) for p in g.geoms)
def smooth(p,closed=False):
 out=[];n=len(p)
 for i in range(n if closed else n-1):
  a,b,c,d=[p[j%n] if closed else p[max(0,min(n-1,j))] for j in [i-1,i,i+1,i+2]]
  for j in range(12):
   t=j/12;out.append(tuple(.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t) for k in [0,1]))
 if not closed:out.append(p[-1])
 return out
def poly(g):return [[round(x,1),round(y,1)] for x,y in g.exterior.coords[:-1]]
old=Polygon(w['coast']); oldall=unary_union([old]+[Polygon([(x+rx*math.cos(t*math.tau/96),y+ry*math.sin(t*math.tau/96)) for t in range(96)]) for x,y,rx,ry in w['islets']])
land=Polygon(smooth([(-1550,2200),(-1450,600),(-700,-550),(1400,-1330),(3900,-1430),(6100,-1150),(8150,-400),(9250,1000),(9510,3000),(9140,4900),(7950,6320),(5660,6820),(3600,6660),(1400,6390),(-550,5270),(-1550,3900)],True))
inlet=LineString(smooth([(3090,4900),(3090,5600),(2850,6350),(3150,7700)])).buffer(510,cap_style=2)
land=land.difference(inlet)
canal=oldall.buffer(300).difference(oldall.buffer(3)).difference(box(3650,-2000,4550,1300))
canal=canal.union(LineString([(7060,2770),(7400,2770)]).buffer(160)).difference(oldall.buffer(3))
stream=LineString(smooth([(8280,-200),(8110,700),(8450,1600),(8240,2800),(8400,4000),(8050,5200),(7700,7100)])).buffer(115)
water=unary_union([canal,stream]).intersection(land)
baseline_water=water
repairs=unary_union([LineString([(3090,4690),(3090,5150)]).buffer(205),Point(5660,4660).buffer(190),Point(8090,5460).buffer(165)]).difference(oldall.buffer(3))
water=water.union(repairs).intersection(land)
protected=oldall.buffer(1)
new=land.difference(protected)
communities=[
 dict(id='pickaxe',name='Picklepick Row',people='Miners and lamp keepers',point=[-420,2350],crop=[-350,1900],work='tool forge, lamp counter and ore-cart yard'),
 dict(id='assay',name='Gilded Quill Quarter',people='Assayers, mapmakers and their families',point=[3850,-380],crop=[3800,-450],work='assay office, map stall and scales court'),
 dict(id='panners',name='Pebblepan Bend',people='River panners and sluice builders',point=[8850,2900],crop=[8860,2400],work='waterside sluices, wash tables and nugget exchange'),
 dict(id='freight',name='Cratebill Quay',people='Freight boat crews and coopers',point=[6150,5880],crop=[6100,5900],work='cooperage, cargo scales and packing sheds')]
routes=[
 ([(2050,5500),(2050,5675),(2050,5920),(2050,6050),(1700,6050),(700,5100),(-640,3750),(-650,2950),(-660,2530),(-650,1700),(-700,800),(700,-300),(2250,-440),(2730,-50),(3000,-100),(3470,-160),(4070,-170),(4770,-140),(5400,-280),(6200,-440),(7770,400),(7750,950),(8010,1280),(8350,1280),(8850,1280),(8870,1820),(8850,2900),(8840,4350),(8480,5460),(8090,5460),(7700,5500),(7030,5820),(6150,6090),(5800,6000),(5800,5675),(5800,5510)],195),
 ([(-660,2530),(-190,2600),(370,2580)],165),
 ([(7700,2770),(8000,2840),(8060,2850)],160),
 ([(4100,1000),(4070,350),(4000,-145)],180)
]
roads=[];samples=[]
for controls,width in routes:
 pts=smooth(controls);samples.append(pts)
 shapes=[LineString([a,b]).buffer(width*(.5+.025*math.sin(i*.29)+.013*math.cos(i*.71)),quad_segs=8) for i,(a,b) in enumerate(zip(pts,pts[1:]))]
 roads.append(unary_union(shapes))
road=unary_union(roads).buffer(18).buffer(-18).intersection(new).difference(water)
def scene_shape(g,fill,stroke='none',sw=1):return f'<path d="{path(g)}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" fill-rule="evenodd"/>'
plan=[scene_shape(land,'#A8C84B',INK,12),scene_shape(water,'#72C5D6',INK,5),scene_shape(road,'#F3D894','#907744',6),scene_shape(oldall,'#CCDA78',INK,8)]
plan.append('<text x="4100" y="3100" font-size="180" text-anchor="middle" fill="#39472D">NUGGETNOOK HEART</text>')
for c in communities:
 x,y=c['point'];plan.append(f'<circle cx="{x}" cy="{y}" r="440" fill="#F6DF9F" stroke="{INK}" stroke-width="6"/>')
 for dx,dy in [(-500,-550),(80,-600),(530,-310),(-500,450)]:plan.append(f'<path d="M{x+dx-150} {y+dy}v-220l150-130 150 130v220Z" fill="#C78E4C" stroke="{INK}" stroke-width="10"/>')
 plan.append(f'<text x="{x}" y="{y+80}" font-size="130" text-anchor="middle" fill="{INK}">{c["name"]}</text>')
plan.append(f'<text x="-1200" y="7300" font-size="155" fill="{INK}">NUGGETNOOK / four working neighbourhoods / original heart retained</text>')
(OUT/('goldmine-dense-plan.svg' if '--plan' not in sys.argv else 'goldmine-communities.svg')).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1257" viewBox="{OX} {OY} {W} {H}"><rect x="{OX}" y="{OY}" width="{W}" height="{H}" fill="#6EC9DE"/>'+''.join(plan)+'</svg>')
write(S/'plan.json',dict(communities=communities,origin=dict(x=OX,y=OY),width=W,height=H))
if '--plan' in sys.argv:sys.exit()
def svg(name,body,width=420,height=350):
 (A/'community'/f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><g stroke="{INK}" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')
for name,roof,wall,style in [('miner','#866544','#DBB772',0),('assayer','#65816B','#F6DC9C',1),('panner','#A99145','#EAC489',2),('crew','#987342','#D5AD65',3)]:
 body=f'<ellipse cx="210" cy="326" rx="194" ry="19" fill="#7D983A" stroke="none" opacity=".3"/><path d="M48 174H372V310H48Z" fill="{wall}"/><path d="M24 175L96 58H324L396 175Z" fill="{roof}"/><path d="M58 159H361M79 132H345M94 104H329" fill="none" stroke="#C1A263"/><path d="M154 310V213Q210 181 266 213V310" fill="#936A3B"/><path d="M187 310V232H236V310" fill="#5E6040"/><circle cx="226" cy="270" r="4" fill="#FFE9A0"/><path d="M48 310H372V323H48Z" fill="#B39259"/>'
 for x in [83,294]:body+=f'<rect x="{x}" y="202" width="46" height="47" rx="8" fill="#A9D6BD"/><path d="M{x+23} 204v43M{x+2} 225h42" fill="none"/><path d="M{x-9} 254h64v15h-64Z" fill="#AD7848"/><path d="M{x-5} 252l10-20 12 20 13-25 11 25" fill="#76A344"/>'
 if style==0:body+='<path d="M100 42v73h28V42Z" fill="#BC9C6C"/><path d="M316 204v75M294 224h44" stroke="#806A37" stroke-width="8"/>'
 if style==1:body+='<path d="M155 85V35H263V85" fill="#F5E3BC"/><path d="M175 66h68M210 45v39" fill="none"/><path d="M142 180h138v24H142Z" fill="#FFE9A0"/><path d="M165 193h90" stroke="#BD9C50"/>'
 if style==2:body+='<path d="M30 191h360v20H30Z" fill="#E5BA67"/><path d="M40 209v104M380 209v104" fill="none" stroke-width="7"/><ellipse cx="326" cy="306" rx="30" ry="18" fill="#729795"/><ellipse cx="326" cy="300" rx="26" ry="11" fill="#8ED2DC"/>'
 if style==3:body+='<path d="M98 48h225v33H98Z" fill="#B18E53"/><path d="M66 282h56v38H66Z M295 284h58v36h-58Z" fill="#BC8D4D"/><path d="M66 288l56 27M295 289l58 27" fill="none"/>'
 svg(name,body)
svg('forge','<path d="M35 170H385V321H35Z" fill="#D3AE72"/><path d="M20 173L100 65H320L403 173Z" fill="#786D50"/><path d="M115 303V226Q155 174 195 226V303" fill="#66533B"/><path d="M127 288l13-42 17 27 13-37 14 52Z" fill="#E7A145"/><path d="M250 260h120l-25 28h-75Z" fill="#718476"/><path d="M283 285v30h42v-30" fill="#7E7859"/><path d="M285 68V25h52v43" fill="#BD9C6A"/><path d="M39 319h346" fill="none" stroke-width="9"/>')
svg('assay-office','<path d="M35 160h350v163H35Z" fill="#F3D591"/><path d="M16 161L95 48h232l78 113Z" fill="#64765E"/><path d="M166 321V209h90v112" fill="#927340"/><path d="M72 211h56v56H72Z M293 211h56v56h-56Z" fill="#A6D5C9"/><path d="M100 213v52M321 213v52" fill="none"/><path d="M139 174h143v24H139Z" fill="#FFEAA4"/><path d="M150 183h120M210 78v53M165 103h90M175 103l-18 27h36Z M245 103l-18 27h36Z" fill="#F9D45C"/><path d="M33 323h355" stroke-width="9"/>')
svg('cooperage','<path d="M28 162h362v158H28Z" fill="#CEA366"/><path d="M13 162L85 65h250l71 97Z" fill="#7D7451"/><path d="M143 320V210h139v110" fill="#776344"/><path d="M50 194h63M50 218h63M50 243h63M307 194h57M307 218h57" fill="none"/><path d="M50 280q27-21 54 0v40q-27 17-54 0Z M305 280q27-21 54 0v40q-27 17-54 0Z" fill="#BB8C49"/><path d="M50 288h54M50 310h54M305 288h54M305 310h54" fill="none" stroke="#6F7B5A" stroke-width="7"/>')
svg('notice','<path d="M74 45v146M198 45v146" fill="none" stroke="#8A6939" stroke-width="14"/><path d="M32 40H239V123H32Z" fill="#C7A05D"/><path d="M22 41L67 10h133l49 31Z" fill="#8D794C"/><path d="M63 64h44v37H63Z M122 63h83v14h-83Z M122 88h62v12h-62Z" fill="#F7E4AF"/>',270,200)
svg('washing','<path d="M18 20V120M325 15v105" stroke="#8E723F" stroke-width="9"/><path d="M18 31Q164 87 325 28" fill="none"/><path d="M75 49l31 8-7 49-42-7Z" fill="#F4E5BD"/><path d="M145 66l33 1 10 43-44 1Z" fill="#9CC7AB"/><path d="M225 57l37-10 14 41-43 11Z" fill="#E5B962"/>',350,130)
houses=[
 ('miner',-1100,1910),('miner',-40,1220),('miner',-40,1850),('miner',300,2500),('miner',-1120,2510),('miner',-1030,3110),('miner',-40,3150),
 ('assayer',2670,-550),('assayer',3140,-730),('assayer',3580,-690),('assayer',4320,-680),('assayer',4800,-560),('assayer',5110,-40),
 ('panner',9140,1720),('panner',8680,2310),('panner',9230,2290),('panner',9270,2800),('panner',9190,3450),('panner',9130,3910),
 ('crew',5290,6100),('crew',5780,6390),('crew',6320,6370),('crew',6820,6240),('crew',7060,5640),('crew',6490,5670)]
home_sizes=[350,420,335,370,315,395,345, 330,390,345,410,330,365, 340,390,330,325,400,305, 370,330,430,345,380,320]

props=[]; obs=[]
def put(src,x,y,h=300,name=None,foot=True):
 txt=(A/src).read_text(); vb=list(map(float,re.search(r'viewBox="([^"]+)"',txt)[1].split()));ww,hh=vb[2:];sc=h/hh
 p=dict(id=f'community-{len(props)}',name=name or src.split('/')[-1].split('.')[0],src=src,x=x,y=y,width=ww,height=hh,scale=round(sc,6),anchor=dict(x=.5,y=1));props.append(p)
 if foot:obs.append(dict(x=x,y=y-35,rx=ww*sc*.40,ry=min(45,h*.15),community=True))
 return p
for typ,x,y in houses:
 idx=houses.index((typ,x,y));variant=f'{typ}-{idx}';text=(A/'community'/f'{typ}.svg').read_text()
 accents=['#6E7E58','#A27643','#899963','#B69A4E'];text=text.replace('#5E6040',accents[idx%4])
 roof=['#866544','#65816B','#A99145','#987342'][['miner','assayer','panner','crew'].index(typ)]
 walls=['#DBB772','#F6DC9C','#EAC489','#D5AD65'][['miner','assayer','panner','crew'].index(typ)]
 text=text.replace(walls,['#E0BB7D','#EAD6A1','#D4AF78','#F1D394'][idx%4])
 text=text.replace(roof,['#7B704E','#68826A','#A77A44','#857F56'][idx%4])
 if idx%4==0:
  text=text.replace('M24 175L96 58H324L396 175Z','M24 175L210 38L396 175Z')
  extra='<path d="M173 125V93l37-29 37 29v32Z" fill="#EAD6A1"/><path d="M195 92h30v26h-30Z" fill="#A9D6BD"/>'
 elif idx%4==1:
  extra='<path d="M146 60V15h43v45Z" fill="#B09469"/><path d="M137 15h60v12h-60Z" fill="#76684D"/><path d="M143 217h134l-13 19H156Z" fill="#84956A"/><path d="M155 235v75M265 235v75" stroke-width="6"/>'
 elif idx%4==2:
  text=text.replace('M24 175L96 58H324L396 175Z','M24 175L61 84H348L396 175Z')
  extra='<path d="M36 277h102v35H36Z" fill="#B69458"/><path d="M37 282h101M64 279v32M105 279v32" fill="none"/><path d="M282 183h72v14h-72Z" fill="#F5DA8A"/>'
 else:
  extra='<path d="M139 198h142v15H139Z" fill="#CEA569"/><path d="M144 211v99M276 211v99" stroke-width="6"/><path d="M138 307h146v14H138Z" fill="#CFB277"/><path d="M68 188l6-16m270 15-5-15" stroke="#6B8B44" stroke-width="6"/>'
 extra+='<path d="M59 290h64M295 293h62" stroke="#C4A166" stroke-width="2"/>'
 text=text.replace('</g>',extra+'</g>');(A/'community'/f'{variant}.svg').write_text(text)
 home=put(f'community/{variant}.svg',x,y,home_sizes[idx],name=typ+' home')
 home['width']=350 if (x,y)==(8680,2310) else 420*[1,.91,1.08,.96][idx%4]
 obs[-1]['rx']=home['width']*home['scale']*.40
 put('reuse/street--fence-rail.svg',x-188 if (x,y)!=(9270,2800) else 9030,y+180 if (x,y)!=(9270,2800) else 3050,66)
 put('reuse/street--fence-rail.svg',x+188 if (x,y)!=(8680,2310) else 8780,y+180 if (x,y)!=(8680,2310) else 2570,66)
 put('reuse/flower-1.svg',x-202,y+110,48,foot=False)
 put('reuse/bush-1.svg',x+218 if (x,y)!=(8680,2310) else 8770,y+110 if (x,y)!=(7060,5640) else 5850,70)
 put('detail/lantern.svg',x+118,y+120,90)
 if typ in ['miner','panner','crew']:put('community/washing.svg',x-20,y+250,75,foot=False)
put('community/forge.svg',-190,3510,440,name='Picklepick tool forge');put('community/assay-office.svg',3860,-930,470,name='Gilded Quill assay office');put('community/cooperage.svg',7330,6040,460,name='Cratebill cooperage')
for x,y in [(8690,2240),(8750,3500)]:put('detail/sluice.svg',x,y,230,name='Pebblepan sluice')
for src,x,y,h in [('detail/mine-cart.svg',-180,3260,150),('detail/timber-support.svg',-950,3700,300),('detail/ore-rock.svg',-1100,3900,125),('detail/supply-crates.svg',6300,5900,140),('detail/supply-crates.svg',6790,5860,150),('reuse/buildings--stall-bread.svg',430,2850,230),('reuse/buildings--stall-fruit.svg',4630,80,230),('detail/supply-crates.svg',7380,6210,120),('detail/mine-cart.svg',4150,-960,140),('detail/ore-rock.svg',8930,3600,100)]:put(src,x,y,h)
for c in communities:
 x,y=c['point'];label=(A/'community/notice.svg').read_text().replace('</g>',f'<text x="135" y="165" font-size="19" font-family="sans-serif" text-anchor="middle" fill="{INK}" stroke="none">{c["name"]}</text></g>');(A/'community'/f'notice-{c["id"]}.svg').write_text(label);nx,ny={'pickaxe':(-450,2440),'assay':(3510,-240),'panners':(8590,3140),'freight':(5730,6160)}[c['id']];put(f'community/notice-{c["id"]}.svg',nx,ny,160,name=c['name']+' noticeboard');bx,by={'pickaxe':(-170,2560),'assay':(4280,-320),'panners':(9100,3110),'freight':(6600,5960)}[c['id']];put('reuse/street--bench-wood.svg',bx,by,110)
for src,x,y,h in [('detail/ore-rock.svg',-420,3520,95),('detail/ore-rock.svg',-650,3570,115),('detail/supply-crates.svg',-850,2900,100),('detail/mine-cart.svg',-510,3400,160),('detail/lantern.svg',-350,3190,110),('reuse/street--picnic-table.svg',-70,2060,150),('detail/supply-crates.svg',3270,50,120),('detail/ore-rock.svg',4090,-40,90),('reuse/street--picnic-table.svg',3750,-450,125),('detail/lantern.svg',3650,-670,115),('detail/supply-crates.svg',4460,180,95),('detail/ore-rock.svg',8970,2050,110),('detail/ore-rock.svg',9010,3270,90),('detail/supply-crates.svg',9050,3220,110),('reuse/street--picnic-table.svg',9010,2560,150),('detail/mine-cart.svg',9040,2420,135),('detail/lantern.svg',8710,2710,110),('detail/supply-crates.svg',7390,6290,140),('detail/supply-crates.svg',7590,6170,120),('detail/mine-cart.svg',7170,6350,145),('reuse/street--picnic-table.svg',5500,6030,150),('detail/lantern.svg',5600,6100,115)]:put(src,x,y,h)
for x,y in [(-1100,800),(400,700),(-1150,3600),(250,3940),(600,5550),(1400,5670),(1100,-650),(1950,-1000),(5660,-900),(6100,-650),(7100,-250),(7900,100),(8950,650),(9250,3770),(8950,4610),(7700,5700),(7650,6110),(7300,6450),(4750,6450),(4050,6210),(1600,6300),(-200,4600)]:put('reuse/tree-4.svg',x,y,330,name='Tree')
commons=[
 ('Lampkeeper Orchard',[(720,250),(1320,100),(1970,170),(2270,550),(2100,1000),(1380,1110),(690,850)],'#B9CB61'),
 ('Quill Herb Gardens',[(4820,230),(5680,70),(6450,230),(6980,640),(6690,1120),(5830,1190),(5010,940)],'#B7C771'),
 ('Picklepick Kitchen Plots',[(-460,3840),(0,3720),(610,3970),(1160,4400),(1360,4800),(820,5010),(200,4700)],'#C3CB6A'),
 ('Nugget Rest Common',[(6470,4430),(6980,4130),(7580,4260),(7840,4740),(7560,5200),(6900,5320),(6520,4910)],'#B6CA64'),
 ('Tideleaf Green',[(3520,5600),(4080,5430),(4550,5600),(4650,6000),(4210,6380),(3610,6330)],'#B7C974')]
common_shapes=[(name,Polygon(smooth(points,True)).intersection(new).difference(water.buffer(35)).difference(road.buffer(50)),colour) for name,points,colour in commons]
for x,y,src,h in [(910,460,'tree-2',320),(1350,340,'tree-3',300),(1800,420,'tree-5',340),(2100,680,'tree-2',300),(940,900,'tree-5',300),(1350,800,'tree-2',320),(1880,650,'tree-3',290)]:put(f'reuse/{src}.svg',x,y,h*1.45,name='Lampkeeper orchard tree')
for src,x,y,h in [('street--picnic-table',1480,740,160),('street--picnic-basket',1630,820,65),('street--fence-rail',730,1080,90),('street--fence-rail',2040,1130,90),('street--planter-flowers',1110,730,100),('street--bench-wood',2120,500,110)]:put(f'reuse/{src}.svg',x,y,h,name='Orchard '+src)
for src,x,y,h in [('street--picnic-table',5880,740,150),('street--planter-flowers',5330,490,115),('street--planter-flowers',5500,540,115),('street--planter-flowers',6360,510,110),('street--planter-flowers',6490,600,110),('street--bench-wood-left',5200,540,115),('tree-5',6720,1000,330),('tree-3',5000,220,300),('street--fence-rail',5800,1120,90)]:put(f'reuse/{src}.svg',x,y,h,name='Herb garden '+src)
put('detail/supply-crates.svg',6100,550,105,name='Garden watering stores')
for src,x,y,h in [('street--planter-flowers',-170,3970,105),('street--planter-flowers',70,4080,105),('street--planter-flowers',330,4200,105),('street--fence-rail',-320,4250,85),('street--fence-rail',1040,4660,85),('street--picnic-table',460,4600,150),('street--picnic-basket',620,4650,70),('tree-2',-160,4510,330),('tree-5',1010,4900,310),('nature--log',870,4310,100)]:put(f'reuse/{src}.svg',x,y,h,name='Kitchen plots '+src)
put('detail/supply-crates.svg',710,4160,115,name='Kitchen plot tool corner')
for src,x,y,h in [('tree-2',6800,4530,320),('tree-5',7380,4470,340),('nature--rock-flat',7080,4840,110),('nature--rock-round',7360,4960,95),('street--picnic-blanket',6930,5090,150),('street--picnic-basket',7060,5150,70),('street--bench-wood',7600,4790,110),('nature--reeds',7950,4700,120),('nature--cattails',7890,4930,120),('flower-2',6700,4900,65)]:put(f'reuse/{src}.svg',x,y,h,name='Nugget rest '+src,foot=src!='street--picnic-blanket')
for src,x,y,h in [('tree-3',3800,5830,330),('tree-5',4350,5780,320),('street--bench-wood-right',4100,6120,115),('street--picnic-basket',3980,6100,65),('nature--rock-flat',4500,6190,90),('flower-2',3670,6150,65)]:put(f'reuse/{src}.svg',x,y,h,name='Tideleaf green '+src)
for src,x,y,h in [('nature--reeds',8600,1950,125),('nature--cattails',8560,3770,125),('nature--rock-round',8510,4570,100),('nature--reeds',7920,5970,130),('nature--lily-pad-small',8410,2540,45)]:put(f'reuse/{src}.svg',x,y,h,name='Riverbank '+src,foot=src!='nature--lily-pad-small')
greens=[
 ('Picklepick lantern green',[(-470,2060),(-60,2100),(110,2320),(-60,2500),(-480,2460)],'#B6CC63'),
 ('Gilded Quill reading green',[(3400,-390),(3640,-510),(4080,-490),(4320,-310),(4080,-190),(3540,-210)],'#BFD07A'),
 ('Pebblepan pump green',[(9040,2650),(9330,2690),(9380,2990),(9180,3160),(9000,2980)],'#B9CE66'),
 ('Cratebill sailors green',[(5910,5840),(6180,5740),(6540,5880),(6510,6070),(6090,6150),(5870,6060)],'#BCCE72')]
green_shapes=[(name,Polygon(smooth(points,True)).intersection(new).difference(water.buffer(30)),colour) for name,points,colour in greens]
lanes=[]
for typ,x,y in houses:
 pt=Point(x,y+180);nearest=min(samples,key=lambda ps:LineString(ps).distance(pt));ln=LineString(nearest);q=ln.interpolate(ln.project(pt))
 controls=[(x,y+20),(x,y+210),(q.x,q.y)]
 if (x,y)==(-40,3150):controls=[(x,y+20),(x-30,y+230),(-430,3170),(-650,3120)]
 if (x,y)==(9270,2800):controls=[(x,y+20),(x-30,y+210),(9060,3030),(8850,3060)]
 lane=LineString(smooth(controls)).buffer(48,quad_segs=8);lanes.append(lane);road=road.union(lane)
for controls in [[(-610,2300),(-290,2290)],[(3980,-170),(4030,-360)],[(8850,2920),(9140,2900)],[(6290,6100),(6290,5980)]]:
 road=road.union(LineString(smooth(controls)).buffer(45)).union(Point(controls[-1]).buffer(85))
road=road.intersection(new).difference(water)
gardens=[]
for i,(typ,x,y) in enumerate(houses):
 g=Polygon(smooth([(x-247,y+28),(x+243,y+35),(x+265,y+170),(x+220,y+270),(x-230,y+265),(x-265,y+150)],True)).intersection(new).difference(water.buffer(20)).difference(road.buffer(10))
 gardens.append((g,['#BED06D','#B3C45A','#C4CF7C'][i%3]))
common_shapes=[(name,Polygon(smooth(points,True)).intersection(new).difference(water.buffer(35)).difference(road.buffer(35)),colour) for name,points,colour in commons]
svg('shared-well','<ellipse cx="110" cy="150" rx="87" ry="29" fill="#A8AC72"/><path d="M27 126v24q82 55 166 0v-24Z" fill="#C4B77B"/><ellipse cx="110" cy="126" rx="83" ry="27" fill="#778B68"/><ellipse cx="110" cy="126" rx="60" ry="15" fill="#7BC4CF"/><path d="M38 127V36M182 127V36" stroke="#96723F" stroke-width="12"/><path d="M18 38L60 9h100l43 29Z" fill="#997344"/><path d="M110 38v62M103 100h20v21h-20Z" fill="#B49C66"/><path d="M52 154l2 14m46-8v18m47-20-1 15" stroke="#8F9869"/>',220,185)
svg('mailbox','<path d="M40 45v73" stroke="#96723F" stroke-width="10"/><path d="M12 20q0-20 27-20h32q20 0 20 20v34H12Z" fill="#A28D59"/><path d="M14 21q18-16 33 0v31M55 23h22M71 12v-17h16v12" fill="none"/><path d="M21 33h16" stroke="#E8D9A6"/>',105,130)
svg('water-barrel','<ellipse cx="55" cy="100" rx="39" ry="13" fill="#839A47" stroke="none"/><path d="M18 20q37-20 74 0l-6 75q-31 22-62 0Z" fill="#B18A4F"/><path d="M19 34q36 14 71 0M23 79q32 13 64 0" fill="none" stroke="#667B62" stroke-width="7"/><ellipse cx="55" cy="20" rx="36" ry="12" fill="#7BC4CF"/><path d="M38 40v34m27-34v35" fill="none" stroke="#8F703F"/>',110,120)
for x,y in [(-290,2290),(4030,-360),(9140,2900),(6290,5980)]:
 put('community/shared-well.svg',x,y,155,name='Shared neighbourhood well')
 put('detail/lantern.svg',x+155,y+15+(180 if x==9140 else 0),115,name='Green lantern')
for i,(typ,x,y) in enumerate(houses):
 put('community/mailbox.svg',x-241 if (x,y)!=(2670,-550) else 2900,y+172,74,name='Family mailbox')
 if i%2==0:put('community/water-barrel.svg',x+218 if (x,y)!=(8680,2310) else 8690,y+33 if (x,y)!=(8680,2310) else 2370,78,name='Garden rain barrel')
for x,y,src,h in [(-1190,1240,'tree-2',380),(-1170,1000,'tree-3',420),(-350,1240,'tree-5',360),(180,1280,'tree-2',410),(2100,-950,'tree-3',400),(2550,-1060,'tree-5',420),(2990,-1120,'tree-2',370),(4670,-1080,'tree-5',410),(5150,-960,'tree-3',400),(5620,-550,'tree-2',420),(5920,-670,'tree-5',390),(6040,-170,'tree-3',390),(8660,4410,'tree-2',380),(9130,4510,'tree-5',410),(9020,4880,'tree-3',370),(4970,5660,'tree-5',410),(4750,5620,'tree-2',390),(5470,5360,'tree-3',360)]:
 put(f'reuse/{src}.svg',x,y,h,name='Neighbourhood orchard tree')
district_beds=[(-130,1320,260,95),(-820,3580,210,85),(2380,-920,240,90),(5310,-650,240,90),(9030,4230,190,80),(7320,5660,230,80)]
for src,x,y,h in [('reuse/street--planter-flowers.svg',-1220,2810,115),('reuse/street--picnic-table.svg',80,2410,140),('reuse/street--bench-wood-left.svg',-80,2210,110),('reuse/street--bunting.svg',-390,2030,95),('reuse/street--fence-rail.svg',-1080,3520,90),('reuse/street--planter-flowers.svg',3310,-490,105),('reuse/street--bunting.svg',3970,-570,105),('reuse/street--bench-wood-right.svg',9280,3110,110),('community/water-barrel.svg',9340,3150,95),('reuse/street--planter-flowers.svg',8990,3300,105),('reuse/street--picnic-table.svg',6030,5970,150),('reuse/street--bunting.svg',6270,5730,105),('detail/supply-crates.svg',7540,5880,140)]:put(src,x,y,h,name='Shared green '+src.split('/')[-1].split('.')[0])
parts=[f'<defs><clipPath id="new"><path d="{path(new)}" fill-rule="evenodd"/></clipPath><pattern id="meadowTexture" width="227" height="173" patternUnits="userSpaceOnUse"><path d="M31 42l-4-9m4 9 4-12m-1 93 4-10m0 10 5-6M147 61l-5-8m5 8 2-12M196 144l-3-8m3 8 5-11" fill="none" stroke="#7FA33E" stroke-width="2"/><ellipse cx="82" cy="91" rx="2.4" ry="1.4" fill="#E8D17B"/><path d="M151 135q10-4 19 0" fill="none" stroke="#A9C957" stroke-width="3"/></pattern></defs>']
parts += [scene_shape(land.buffer(45),'#9DD9DC'),scene_shape(land,'#F7DF9A',INK,5),scene_shape(land.buffer(-85),'#AEC64C','#8EA342',5),f'<g clip-path="url(#new)">',scene_shape(land,'url(#meadowTexture)')]
for name,g,colour in common_shapes:
 parts += [scene_shape(g.buffer(9),'#91A84C'),scene_shape(g,colour),scene_shape(g,'url(#meadowTexture)')]
for name,g,colour in green_shapes:parts += [scene_shape(g.buffer(9),'#91A84C'),scene_shape(g,colour),scene_shape(g,'url(#meadowTexture)')]
for g,colour in gardens:parts += [scene_shape(g,colour),scene_shape(g,'url(#meadowTexture)')]
for x,y,rx,ry in [(5350,750,190,82),(6380,860,210,85),(120,4360,170,75),(380,4450,170,75)]+district_beds:
 bed=geomscale(Point(x,y).buffer(1,quad_segs=16),rx,ry)
 parts.append(scene_shape(bed,'#B3945D','#71823C',4))
 for dx,dy in [(-90,-15),(-35,12),(25,-8),(90,15)]:
  parts.append(f'<path d="M{x+dx} {y+dy}l-8-19 11 9 9-15-2 25" fill="#72974B" stroke="#5D7938" stroke-width="3"/>')
parts += [scene_shape(road.buffer(16),'#6D8C36',INK,3),scene_shape(road.buffer(7),'#B79C62'),scene_shape(road,'#F1D391')]
for pts in samples:
 ln=LineString(pts)
 for off in [-54,42]:
  l=ln.offset_curve(off);clip=l.intersection(new).difference(water.buffer(10));
  for seg in ([clip] if clip.geom_type=='LineString' else getattr(clip,'geoms',[])):
   if seg.geom_type=='LineString':parts.append('<path d="M '+' L '.join(f'{x:.1f} {y:.1f}' for x,y in seg.coords)+'" fill="none" stroke="#D5B779" stroke-width="5" stroke-dasharray="70 29 18 97" opacity=".65"/>')
for edge in ([road.boundary] if road.boundary.geom_type=='LineString' else road.boundary.geoms):
 for n in range(19,int(edge.length),83):
  p=edge.interpolate(n);q=edge.interpolate(min(n+5,edge.length));dx=q.x-p.x;dy=q.y-p.y;dd=math.hypot(dx,dy) or 1
  nx,ny=-dy/dd,dx/dd
  if road.contains(Point(p.x+nx*12,p.y+ny*12)):nx,ny=-nx,-ny
  x,y=p.x+nx*4,p.y+ny*4
  if not new.buffer(-12).contains(Point(x,y)) or water.buffer(30).contains(Point(x,y)):continue
  parts.append(f'<path d="M{x-12:.1f} {y+2:.1f}q4-8 9-5l-2-14 9 12 5-18 4 17 9-6-4 15" fill="#8EA83F" stroke="#617F35" stroke-width="2.5"/>')
  sx,sy=p.x-nx*22+dx/dd*21,p.y-ny*22+dy/dd*21
  parts.append(f'<ellipse cx="{sx:.1f}" cy="{sy:.1f}" rx="{5+n%4}" ry="3.8" fill="#D4BE88" stroke="#948458" stroke-width="1.7"/>')
for controls,width in routes:
 ln=LineString(smooth(controls))
 for n in range(90,int(ln.length),263):
  p=ln.interpolate(n);q=ln.interpolate(min(n+82,ln.length));dx,dy=q.x-p.x,q.y-p.y;dd=math.hypot(dx,dy) or 1;nx,ny=-dy/dd,dx/dd;rr=10+n%7
  g=Polygon(smooth([(p.x,p.y),(p.x+dx*.3+nx*rr,p.y+dy*.3+ny*rr),(q.x+nx*rr*.5,q.y+ny*rr*.5),(q.x+dx*.1,q.y+dy*.1),(p.x+dx*.5-nx*rr,p.y+dy*.5-ny*rr),(p.x-nx*rr*.4,p.y-ny*rr*.4)],True)).buffer(0).intersection(road.buffer(-24))
  parts.append(scene_shape(g,'#E8CB88'))
parts += [scene_shape(water.buffer(14),'#738D40',INK,3),scene_shape(water,'#74C9D7'),scene_shape(water.buffer(-22),'#63B8CB')]
for x,y in [(8110,680),(8370,1680),(8250,3210),(8170,4370),(7900,5530),(7520,5900),(820,2850),(7350,3000)]:
 parts.append(f'<path d="M{x} {y}q20 8 40 0m-10 23q19 7 38 0" fill="none" stroke="#B8E4DE" stroke-width="3"/><path d="M{x-27} {y-12}l-5-36m5 36 8-29" stroke="#6E8C43" fill="none" stroke-width="4"/>')
parts.append('</g>')
original=(A/'community/original-ground.svg').read_text(); original=re.sub(r'<svg[^>]*>','',original,count=1).rsplit('</svg>',1)[0]
original_uri=base64.b64encode((A/'community/original-ground.svg').read_bytes()).decode()
original_image=f'<image x="0" y="0" width="8000" height="6000" href="data:image/svg+xml;base64,{original_uri}"/>'
parts.append(f'<defs><clipPath id="originalIsland"><path d="{path(protected)}" fill-rule="evenodd"/></clipPath></defs><g clip-path="url(#originalIsland)">{original_image}</g>')
new_bridges=[(8350,1280,680,190),(8090,5460,760,200),(5800,5675,200,330),(2050,5675,200,330)]
for i,(x,y,bw,bh) in enumerate(new_bridges):
 body=f'<path d="M8 36Q{bw/2} -5 {bw-8} 36V{bh-15}Q{bw/2} {bh-51} 8 {bh-15}Z" fill="#C39A5E"/>'
 for xx in range(25,bw-10,38):body+=f'<path d="M{xx} 33v{bh-55}" fill="none" stroke="#8F754A"/>'
 body+=f'<path d="M8 32Q{bw/2} -12 {bw-8} 32M8 {bh-25}Q{bw/2} {bh-65} {bw-8} {bh-25}" fill="none" stroke-width="9" stroke="#8B7849"/>'
 if i>=2:
  body=f'<path d="M18 0H{bw-18}V{bh}H18Z" fill="#C39A5E"/>'
  for yy in range(10,bh,32):body+=f'<path d="M20 {yy}h{bw-40}" fill="none" stroke="#8F754A"/>'
  body+=f'<path d="M10 0V{bh}M{bw-10} 0V{bh}" fill="none" stroke-width="8"/>'
 svg(f'river-bridge-{i}',body,bw,bh)
 art['decks'].append(dict(src=f'community/river-bridge-{i}.svg',x=x-bw/2,y=y-bh/2,width=bw,height=bh))
 w['bridges'].append(dict(x=x,y=y,w=bw,h=bh-30));walk['bridges'].append(dict(x=x,y=y,w=bw,h=bh-30))
 w['walkways'].append(dict(a=[x,y-bh/2] if i>=2 else [x-bw/2,y],b=[x,y+bh/2] if i>=2 else [x+bw/2,y],w=bw-30 if i>=2 else bh-30));walk['walkways'].append(w['walkways'][-1])
all_decks=unary_union([LineString([b['a'],b['b']]).buffer(b['w']/2-10,cap_style=2) for b in w['walkways']])
wet_collision=water.difference(all_decks.buffer(2)).simplify(2,preserve_topology=True)
wetpieces=[wet_collision] if wet_collision.geom_type=='Polygon' else list(wet_collision.geoms)
for target in [w,walk]:
 target.update(width=W,height=H,origin=dict(x=OX,y=OY),coast=poly(land),islets=[])
 target['water'] += [dict(poly=poly(p),communityRiver=True) for p in wetpieces if p.geom_type=='Polygon' and p.area>10]
 target['obstacles']+=obs
 target['paths'] += [[[round(x,1),round(y,1)] for x,y in ps] for ps in samples]
 for c in communities:target['zones'][c['id']]=dict(name=c['name'],x=c['point'][0],y=c['point'][1],rx=360,ry=300,spawn=c['point'])
w['pathWidths'] += [width for _,width in routes];w['props']+=props
art['props']+=props;art.update(width=W,height=H,origin=dict(x=OX,y=OY));art['ground']['tiles']=[]
body=''.join(parts)
(A/'community/expanded-ground.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="{OX} {OY} {W} {H}">{body}</svg>')
for row,y in enumerate(range(OY,OY+H,1500)):
 for col,x in enumerate(range(OX,OX+W,1500)):
  ww=min(1500,OX+W-x);hh=min(1500,OY+H-y);src=f'community/ground-{row}-{col}.svg'
  tile_original=f'<svg xmlns="http://www.w3.org/2000/svg" width="{ww}" height="{hh}" viewBox="{x} {y} {ww} {hh}">{original}</svg>'
  tile_uri=base64.b64encode(tile_original.encode()).decode()
  tile_image=f'<image x="{x}" y="{y}" width="{ww}" height="{hh}" href="data:image/svg+xml;base64,{tile_uri}"/>'
  tile_body=body.replace(original_image,tile_image) if box(x,y,x+ww,y+hh).intersects(protected) else body.replace(original_image,'')
  (A/src).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{ww}" height="{hh}" viewBox="{x} {y} {ww} {hh}">{tile_body}</svg>')
  art['ground']['tiles'].append(dict(src=src,x=x,y=y,width=ww,height=hh,resolution=.6))
harbor['boats']=harbor['boats'][:3]+[dict(x=-1660,y=2420,turn=-math.pi/2),dict(x=-1700,y=2780,turn=-math.pi/2),dict(x=9620,y=2700,turn=math.pi/2),dict(x=9590,y=3080,turn=math.pi/2),dict(x=6120,y=6930,turn=math.pi),dict(x=6500,y=6870,turn=math.pi),dict(x=7100,y=6700,turn=math.pi)]
write(D/'world.json',w);write(D/'walk-world.json',walk);write(D/'harbor.json',harbor);write(A/'art.json',art)
pond=Polygon([(1900+570*math.cos(t*math.tau/96),3180+370*math.sin(t*math.tau/96)) for t in range(96)])
visual_water=unary_union([water,pond,inlet])
audit=[];before_audit=[]
for index,deck in enumerate([art['previewHarbor']]+art['decks']):
 b=w['walkways'][index];ax,ay=b['a'];bx,by=b['b'];dx,dy=bx-ax,by-ay;length=math.hypot(dx,dy)
 cx,cy=(ax+bx)/2,(ay+by)/2;nx,ny=-dy/length,dx/length
 samples9=[Point(cx+dx/length*u+nx*v,cy+dy/length*u+ny*v) for u in [-20,0,20] for v in [-b['w']*.32,0,b['w']*.32]]
 wet=lambda p:visual_water.covers(p) or not land.covers(p)
 before_wet=lambda p:unary_union([baseline_water,pond,inlet]).covers(p) or not land.covers(p)
 before_audit.append(dict(src=deck['src'],waterUnderDeck=all(before_wet(p) for p in samples9),wetSamples=sum(before_wet(p) for p in samples9),sampleCount=9))
 audit.append(dict(src=deck['src'],x=cx,y=cy,waterUnderDeck=all(wet(p) for p in samples9),wetSamples=sum(wet(p) for p in samples9),sampleCount=9,walkAxis=b,kind='harbour' if index==0 else 'bridge or jetty'))
write(S/'bridge-audit-before-fix.json',before_audit)
write(S/'bridge-audit.json',audit)
ground_contacts=[dict(id=p['id'],name=p['name'],dry=land.covers(Point(p['x'],p['y']-10)) and not water.covers(Point(p['x'],p['y']-10))) for p in props if not any(v in p['src'] for v in ['reeds','cattails','lily-pad'])]
write(S/'ground-contact-audit.json',ground_contacts)
write(S/'commons.json',dict(places=[dict(name=name,area=round(g.area),point=[round(g.representative_point().x),round(g.representative_point().y)]) for name,g,colour in common_shapes]))
write(S/'dense-after.json',dict(method=json.loads((S/'dense-before.json').read_text())['method'],newDryLandArea=new.difference(water).area,roadArea=road.area,roadPercent=100*road.area/new.difference(water).area,houses=len(houses),communityProps=len(props),mainRoadWidth=195,laneWidth=96,greens=[dict(name=name,area=round(g.area)) for name,g,colour in green_shapes]))
write(S/'metrics.json',dict(originalLandM=oldall.area/1e6,newLandM=land.area/1e6,ratio=land.area/oldall.area,groundBeforeMB=8000*6000*4/2**20,groundAfterMB=W*H*.6**2*4/2**20,oldProps=len(load('art.json')['props']),newProps=len(props),communities=communities))
print('Built',len(props),'authored props; land',round(land.area/oldall.area,2),'x; ground MB',round(W*H*.6**2*4/2**20,1))
