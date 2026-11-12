"""Reproducible B2 trace. Coordinates are hand-authored in the approved 1448x1086 painting."""
import json, math, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/pixi-art/themes/snow/v2'; OUT.mkdir(parents=True,exist_ok=True)
def dump(p,v): p.write_text(json.dumps(v,indent=1)+'\n')
def area(c): return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(c,c[1:]+c[:1]))/2)
# Coast: coves on west, deep harbour bay southeast, uneven northern snowbanks.
anchors=[(33,278),(64,218),(132,166),(167,110),(265,68),(341,64),(393,80),(465,49),(519,70),(574,110),(650,110),(711,81),(802,66),(885,66),(973,90),(1050,70),(1118,87),(1170,126),(1250,151),(1321,195),(1340,260),(1410,307),(1425,379),(1398,453),(1350,505),(1276,522),(1208,569),(1182,626),(1200,682),(1283,725),(1322,779),(1281,826),(1182,847),(1110,866),(1026,868),(924,868),(877,904),(859,951),(877,1005),(828,1044),(754,1058),(686,1048),(623,1019),(540,1032),(457,1020),(384,1036),(322,1014),(267,981),(195,990),(116,969),(58,935),(29,891),(49,842),(56,793),(19,757),(38,706),(77,667),(60,625),(28,591),(44,542),(101,505),(109,468),(54,451),(34,415),(66,365),(102,338),(79,315)]
# Closed Catmull-Rom contour, shared exactly by walking, boats and painting.
curve=[]
for i,b in enumerate(anchors):
 a=anchors[i-1]; c=anchors[(i+1)%len(anchors)]; d=anchors[(i+2)%len(anchors)]
 for k in range(6):
  t=k/6
  curve.append([.5*((2*b[j])+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t*t+(-a[j]+3*b[j]-3*c[j]+d[j])*t*t*t) for j in (0,1)])
home=json.loads((ROOT/'assets/world/world.json').read_text()); S=math.sqrt(area(home['coast'])/area(curve))
def pt(x,y):return [round(600+x*S,2),round(600+y*S,2)]
coast=[pt(400+(p[0]-400)*math.sqrt(1.18),543+(p[1]-543)*math.sqrt(1.18)) for p in curve]; W=math.ceil((1448*S+1200)/256)*256; H=math.ceil((1086*S+1200)/256)*256
props=[]; obstacles=[]; doors=[]
INK='#39472d'; SNOW='#fffdf8'; SHADE='#d5c9f2'
def svg(name,w,h,body):
 text=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" stroke="{INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><title>{name}</title>{body}</svg>'
 (OUT/(name+'.svg')).write_text(text);return name+'.svg'
def window(x,y,w=72,h=85):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#ffdf77"/><path d="M{x+w/2} {y}v{h}M{x} {y+h/2}h{w}" fill="none"/>'
def roof(w,y=250):
 # Visible rear roof plane, thick snowy eaves, upright front gable.
 return f'<path d="M28 {y+30}L{w/2-40} 65L{w/2+38} 28L{w-26} {y-18}L{w-26} {y+30}L{w/2-40} 108Z" fill="{SHADE}"/><path d="M28 {y+8}L{w/2-40} 48L{w/2+38} 18L{w-26} {y-38}Q{w-8} {y-3} {w-38} {y+10}L{w/2+24} 72L{w/2-40} 88L52 {y+30}Q24 {y+35} 28 {y+8}Z" fill="{SNOW}"/><path d="M{w/2-40} 48L{w/2+24} 72L{w-38} {y+10}M70 {y-10}q28 28 58-18M{w-140} {y-55}q28 28 55 5" fill="none" stroke="{SHADE}" stroke-width="6"/>'

def building(name,kind,w=800,h=660):
 placedW,placedH=w,h;w,h=800,660
 wall={'bakery':'#e9b76a','lodge':'#cc995a','workshop':'#9bbd95','fishing':'#83c0c5','gallery':'#8dd6db','cocoa':'#e8b375','cottage':'#c6b49a'}[kind]
 b=f'<ellipse cx="{w/2}" cy="{h-18}" rx="{w*.44}" ry="17" fill="{SHADE}" stroke="none"/>'
 b+=f'<path d="M740 240L782 212V598L740 625Z" fill="#899b91"/>'
 if kind=='workshop':
  b+=f'<path d="M45 260H{w-45}V{h-35}H45Z" fill="{wall}"/>'
  for x in [35,275,515]:b+=f'<path d="M{x} 270V145L{x+240} 70V270Z" fill="#7da477"/>{window(x+45,180,150,65)}<path d="M{x-8} 148L{x+212} 30L{x+248} 58v32L{x+3} 175Z" fill="{SNOW}"/>'
  b+=f'<rect x="280" y="350" width="240" height="275" fill="#68998b"/><path d="M280 350L520 625M520 350L280 625M400 350V625" fill="none"/><rect x="555" y="430" width="185" height="30" rx="15" fill="#e3af4d"/><path d="M570 480h160m-160 45h160m-145-90v-65m125 65v-65" fill="none" stroke-width="8"/>'
 elif kind=='fishing':
  for x,top in [(40,270),(w-230,270),(w/2-140,130)]:
   bw=200 if x in (40,w-230) else 280
   b+=f'<path d="M{x} {top+65}L{x+bw/2} {top-70}L{x+bw} {top+65}V{h-35}H{x}Z" fill="{wall}"/><path d="M{x-12} {top+65}L{x+bw/2-22} {top-88}L{x+bw/2+16} {top-112}L{x+bw+12} {top+38}L{x+bw+12} {top+65}L{x+bw-5} {top+85}L{x+bw/2} {top-35}L{x+5} {top+85}Z" fill="{SNOW}"/>'
   b+=window(x+bw/2-30,top+85,60,85)
  b+=f'<path d="M315 435Q400 600 485 435M315 435Q400 540 485 435M335 455l50 85m-20-100 50 100m-10-100 35 75m30-75-40 95m0-95-40 95" fill="none" stroke="#fff0c7" stroke-width="7"/>'
  b+='<rect x="355" y="510" width="90" height="115" rx="12" fill="#387d82"/><path d="M386 560h12" stroke="#f9d66e" stroke-width="9"/>'
 else:
  top=220
  b+=f'<path d="M60 245L{w/2} 65L{w-60} 245V{h-35}H60Z" fill="{wall}"/><path d="M{w-60} 245L{w-30} 265V{h-52}L{w-60} {h-35}Z" fill="#a58064"/><path d="M{w-145} 130V40h60v135" fill="#d6a25f"/><path d="M{w-155} 45q30-35 80 0v22h-80Z" fill="{SNOW}"/>'+roof(w)
  b+=f'<path d="M85 300H{w-85}M85 430H{w-85}M85 560H{w-85}" stroke="#ae8658" fill="none"/>'
  b+=window(110,380)+window(w-182,380)
  b+=f'<path d="M{w/2-65} {h-35}V{h-185}a65 65 0 0 1 130 0V{h-35}Z" fill="#4e8b81"/><path d="M{w/2} {h-170}v135" fill="none"/><circle cx="{w/2-20}" cy="{h-105}" r="6" fill="#ffdf77"/><circle cx="{w/2+20}" cy="{h-105}" r="6" fill="#ffdf77"/>'
  if kind in ('bakery','cocoa'):
   b+=f'<path d="M90 315H{w-90}L{w-70} 375H70Z" fill="#fff4da"/>'
   for x in range(90,w-90,100): b+=f'<path d="M{x} 315h48l12 60h-60Z" fill="#d76b59" stroke="none"/>'
   b+=f'<ellipse cx="{w/2}" cy="230" rx="100" ry="48" fill="#f6d777"/>'
   b+=('<path d="M340 234q50-60 120 0m-90-20 15 22m10-28 15 22m10-25 15 22" fill="none"/>' if kind=='bakery' else '<path d="M365 200h60v55h-60Zm60 8q45-8 30 28h-30m-48-55q-15-15 0-30m28 30q-15-15 0-30" fill="#fff4da"/>')
  elif kind=='lodge':b+=window(w/2-85,140,170,175)+window(240,385,90,115)+window(470,385,90,115)+'<path d="M60 530h680M80 300v330m640-330v330M235 330v300m330-300v300" fill="none" stroke="#8c693e" stroke-width="14"/>'+f'<path d="M{w/2} 72v70M{w/2-100} 140l100-65 100 65" fill="none" stroke-width="8"/>'
  elif kind=='gallery':b+=f'<path d="M400 130v95m-48-72 96 48m-96 0 96-48m-48 0-18-18m18 18 18-18" fill="none" stroke="#fffdf8" stroke-width="9"/>'
 # Scale a complete authored facade, including details, to the placed box.
 b=f'<g transform="scale({placedW/800} {placedH/660})">{b}</g>'
 return svg(name,placedW,placedH,b)
def add(name,src,x,y,w,h,solid=True):
 X,Y=pt(x,y);p=dict(id=name,name=name,src='v2/'+src,x=X,y=Y,width=w,height=h,resolution=4,shadow=False,wind=False)
 props.append(p)
 if solid:obstacles.append(dict(x=X,y=Y-28,rx=w*.39,ry=38,prop=name))
 return p
# Place landmarks by the painting, all upright with a doorway centred on their base.
for name,kind,x,y,w,h in [('bakery','bakery',310,312,496,394),('lodge','lodge',1100,267,510,470),('sled-workshop','workshop',290,751,525,390),('fishing-hall','fishing',1090,826,480,415),('cocoa-hut','cocoa',724,510,360,360),('ice-duck-gallery','gallery',950,535,440,400)]:
 add(name,building(name,kind,w,h),x,y,w,h);doors.append([name,*pt(x,y+4)])
# Cottages are distinct satellites, not one repeated hamlet stamp.
for name,kind,x,y,w,h in [('bakery-oven','bakery',202,305,390,410),('bakery-store','cottage',419,312,390,400),('lodge-west','cottage',992,266,430,380),('lodge-east','cottage',1200,270,430,380),('workshop-store','cottage',143,745,390,410),('tool-shed','workshop',431,752,400,350),('fishing-west','fishing',955,821,360,440),('fishing-east','fishing',1212,824,360,440)]:
 add(name,building(name,kind,w,h),x,y,w,h);doors.append([name,*pt(x,y+4)])
# Home plants preserved verbatim under a cap overlay in their own viewBox.
for family,count in [('tree',5),('bush',4)]:
 for i in range(1,count+1):
  src=(ROOT/f'public/pixi-art/plants/{family}-{i}.svg').read_text(); box=list(map(float,re.search(r'viewBox="([^"]+)"',src)[1].split()));w,h=box[2:];
  cap=''
  for ci,d in enumerate(re.findall(r'<path fill="#4AA539" d="([^"]+)"',src)):
   nums=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',d)));xs=nums[::2];ys=nums[1::2];left,right=min(xs),max(xs);top,bottom=min(ys),max(ys);yy=top+(bottom-top)*.36;ww=right-left
   cap+=f'<defs><clipPath id="snow-{family}-{i}-{ci}"><path d="{d}"/></clipPath></defs><g clip-path="url(#snow-{family}-{i}-{ci})"><path d="M{left-5} {top-5}H{right+5}V{yy}Q{left+ww*.85} {yy+12} {left+ww*.7} {yy-3}Q{left+ww*.55} {yy+14} {left+ww*.4} {yy-1}Q{left+ww*.2} {yy+14} {left-5} {yy}Z" fill="{SNOW}" stroke="{SHADE}" stroke-width="2"/></g>'
  (OUT/f'{family}-{i}.svg').write_text(src.replace('</svg>',cap+'</svg>'))

# Explicit grove composition. Each tuple is a tree position in the approved overview.
groves=[[(194,135),(239,151),(291,118),(369,154),(337,133)],[(99,268),(118,223),(159,256),(134,306),(68,290)],[(792,146),(840,109),(874,160),(931,129),(972,109),(919,192),(862,224)],[(1209,234),(1243,266),(1300,284),(1335,308)],[(1366,405),(1400,439),(1329,447)],[(741,292),(814,350),(808,278),(719,315)],[(550,307),(610,329),(642,301),(675,337)],[(447,386),(485,409),(526,391),(562,350)],[(112,446),(158,466),(188,421),(223,450),(182,515)],[(84,605),(123,601),(59,574)],[(306,570),(354,610),(404,556),(469,595),(541,558),(452,537)],[(1133,399),(1170,386),(1150,450),(1110,462)],[(1206,518),(1258,516),(1293,489),(1230,537)],[(1093,582),(1146,616),(1090,631)],[(1063,688),(1110,698),(1047,664)],[(593,687),(640,724),(557,744),(619,763),(675,725)],[(888,799),(925,776),(861,840)],[(112,858),(146,843),(75,900)],[(450,903),(486,934),(427,957)],[(382,1007),(421,1005)],[(781,1005),(819,1030),(846,987)]]
for gi,g in enumerate(groves):
 for ti,(x,y) in enumerate(g):
  n=(gi+ti)%5+1;src=OUT/f'tree-{n}.svg';bw,bh=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',src.read_text()).groups());h=410+(ti%3)*25;w=h*bw/bh
  add(f'grove-{gi}-tree-{ti}',src.name,x,y,w,h)
# Bush clusters are also authored as groups, never spread over every empty field.
for i,(x,y) in enumerate([(162,336),(267,318),(370,292),(405,376),(678,354),(704,467),(590,482),(938,311),(1032,456),(1066,452),(1261,288),(1300,467),(1306,503),(1060,592),(1074,639),(566,563),(512,610),(482,758),(680,740),(563,847),(621,853),(667,847),(815,955),(731,1044),(1248,819),(898,850),(148,625),(58,776),(122,970),(165,981),(126,839),(351,994),(853,818)]):
 n=i%4+1;src=OUT/f'bush-{n}.svg';bw,bh=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',src.read_text()).groups());add(f'bush-clump-{i}',src.name,x,y,165,165*bh/bw)
# Rink and a decorated evergreen, independent pieces so Duckies sort correctly.
rinkX,rinkY=pt(831,588);rw,rh=144*S,90*S
rink=svg('rink',rw,rh,f'<rect x="8" y="8" width="{rw-16}" height="{rh-16}" rx="{rh*.34}" fill="#a6deec" stroke="#86bccf" stroke-width="8"/><path d="M{rw*.16} {rh*.2}C{rw*.8} {rh*.28} {rw*.12} {rh*.48} {rw*.75} {rh*.61}M{rw*.25} {rh*.8}C{rw*.9} {rh*.6} {rw*.75} {rh*.3} {rw*.6} {rh*.15}" fill="none" stroke="#eefcff" stroke-width="6"/>')
flats=[dict(preload=True,id='rink',src='v2/'+rink,x=rinkX-rw/2,y=rinkY-rh/2,width=rw,height=rh,topLeft=True,resolution=3.625)]
b='<ellipse cx="220" cy="520" rx="200" ry="48" fill="#fffdf8"/><path d="M200 420h40v80h-40Z" fill="#bb8945"/>'
for y,w in [(435,200),(335,160),(245,120),(165,75)]:
 b+=f'<path d="M{220-w} {y}Q{220-w*.65} {y-80} 220 {y-180}Q{220+w*.65} {y-80} {220+w} {y}Q220 {y+80} {220-w} {y}Z" fill="#608b46"/><path d="M{220-w} {y}Q{220-w*.65} {y-80} 220 {y-180}Q{220+w*.65} {y-80} {220+w} {y}Q220 {y+20} {220-w} {y}Z" fill="#fffdf8"/>'
 for x in [220-w*.6,220,220+w*.6]:b+=f'<circle cx="{x}" cy="{y+17}" r="12" fill="'+('#e48159' if x<220 else '#f9d263')+'"/>'
b+='<path d="M220 15l15 30 35 4-26 24 7 35-31-16-31 16 7-35-26-24 35-4Z" fill="#f9d263"/>'
add('decorated-pine',svg('decorated-pine',260,360,f'<g transform="scale({260/440} {360/580})">{b}</g>'),831,600,260,360)
# Rim is the exact rounded rectangle used by the ice SVG. Arc-length sampling
# keeps the posts evenly spaced, including along the rounded corners.
left,top=8,8;right,bottom=rw-8,rh-8;radius=rh*.34
straightX=right-left-2*radius;straightY=bottom-top-2*radius
perimeter=2*(straightX+straightY)+2*math.pi*radius
def rim(t):
 t=t%perimeter
 segments=[(straightX,lambda d:(left+radius+d,top)),(math.pi*radius/2,lambda d:(right-radius+radius*math.sin(d/radius),top+radius-radius*math.cos(d/radius))),(straightY,lambda d:(right,top+radius+d)),(math.pi*radius/2,lambda d:(right-radius+radius*math.cos(d/radius),bottom-radius+radius*math.sin(d/radius))),(straightX,lambda d:(right-radius-d,bottom)),(math.pi*radius/2,lambda d:(left+radius-radius*math.sin(d/radius),bottom-radius+radius*math.cos(d/radius))),(straightY,lambda d:(left,bottom-radius-d)),(math.pi*radius/2,lambda d:(left+radius-radius*math.cos(d/radius),top+radius-radius*math.sin(d/radius)))]
 for length,fn in segments:
  if t<=length:return fn(t)
  t-=length
 return (left+radius,top)
gateT={'north-gate':straightX/2,'south-gate':perimeter/2+straightX/2,'west-gate':perimeter-straightY/2-math.pi*radius/2}
gateWidth=160
fencePosts=[];fenceRuns=[]
# Split runs at all three gate openings. Each rail curves along the ice rim.
cuts=sorted([(t-gateWidth/2,t+gateWidth/2) for t in gateT.values()])
for run,(start,end) in enumerate([(cuts[i][1],cuts[(i+1)%3][0]+(perimeter if i==2 else 0)) for i in range(3)]):
 count=math.ceil((end-start)/155)
 for j in range(count):
  t1=start+(end-start)*j/count;t2=start+(end-start)*(j+1)/count
  pts=[rim(t1+(t2-t1)*k/12) for k in range(13)]
  bases=[[rinkX-rw/2+x,rinkY-rh/2+y] for x,y in pts];fenceRuns.append(bases)
  for base in [bases[0],bases[-1]]:
   if base not in fencePosts:fencePosts.append(base)
  minx=min(x for x,y in bases)-25;maxx=max(x for x,y in bases)+25;miny=min(y for x,y in bases)-70;maxy=max(y for x,y in bases)+4
  d='M'+' L'.join(f'{x-minx} {y-miny-32}' for x,y in bases)
  body=f'<path d="{d}" fill="none" stroke="#c18c43" stroke-width="18"/>'
  for x,y in [bases[0],bases[-1]]:
   x-=minx;y-=miny
   body+=f'<rect x="{x-12}" y="{y-57}" width="24" height="57" rx="6" fill="#edc778"/><ellipse cx="{x}" cy="{y-57}" rx="18" ry="9" fill="{SNOW}"/>'
  name=f'rink-fence-{run}-{j}';fw,fh=maxx-minx,maxy-miny
  props.append(dict(id=name,name=name,src='v2/'+svg(name,fw,fh,body),x=(minx+maxx)/2,y=maxy,width=fw,height=fh,resolution=4,shadow=False,wind=False))
  # Small rim colliders follow the curve rather than bounding whole diagonal rails.
  for x,y in bases:obstacles.append(dict(x=x,y=y,rx=10,ry=10,prop=name))
# Sculptural ice duck, a carved object (the residents use the real Ducky rigs).
b='<ellipse cx="190" cy="450" rx="175" ry="40" fill="#d5c9f2" stroke="none"/><path d="M35 395h310v55H35Z" fill="#83c8d6"/><path d="M50 350h280v55H50Z" fill="#c4f0f3"/><path d="M88 295Q35 230 95 214L175 235Q128 205 140 157Q145 95 206 104Q268 113 258 172L287 185L250 207Q310 250 277 302Q207 360 118 316Z" fill="#a0e3ee"/><path d="M96 245Q150 340 265 278M178 132l-12 32m-15 130 87 8M65 417h240" fill="none" stroke="#efffff" stroke-width="9"/><circle cx="224" cy="155" r="8" fill="#39472d"/>'
add('ice-duck-sculpture',svg('ice-duck-sculpture',150,195,f'<g transform="scale({150/380} {195/490})">{b}</g>'),985,540,150,195)
# Snowman yard and sled hill.
for i,(x,y) in enumerate([(236,907),(254,912),(272,906)]):
 b='<ellipse cx="100" cy="230" rx="88" ry="15" fill="#d5c9f2" stroke="none"/><circle cx="100" cy="167" r="65" fill="#fffdf8"/><circle cx="100" cy="75" r="45" fill="#fffdf8"/><circle cx="87" cy="68" r="4" fill="#39472d"/><circle cx="113" cy="68" r="4" fill="#39472d"/><path d="M100 79l28 7-28 6" fill="#ec9b4c"/><path d="M61 114q40 22 81 0l-10 25-18 60-22-7 7-57-36-1Z" fill="#c86355"/><circle cx="100" cy="160" r="5"/><circle cx="100" cy="184" r="5"/>'
 add(f'snowman-{i}',svg(f'snowman-{i}',115,145,f'<g transform="scale({115/200} {145/250})">{b}</g>'),x,y,115,145)
b='<path d="M20 230Q220 70 430 230" fill="#fffdf8" stroke="#d5c9f2" stroke-width="9"/><path d="M85 215l250-55m-250 80 260-55" fill="none" stroke="#ba8546" stroke-width="16"/><path d="M115 190l7 60m160-100 7 60" stroke-width="9"/><path d="M77 182l245-55" stroke="#f4ca64" stroke-width="28"/>'
add('sled-hill-start',svg('sled-hill-start',210,130,f'<g transform="scale({210/450} {130/280})">{b}</g>'),476,170,210,130,False)
# A low sculpted snow hill, with a summit and a shaded sloping front.
hillW,hillH=820,440
hill=svg('sled-hill',hillW,hillH,'<path d="M15 365Q85 315 175 160Q280 20 430 45Q560 45 625 175Q680 300 805 355Q695 435 420 430Q130 445 15 365Z" fill="#d5c9f2" stroke="#b7a9d6"/><path d="M15 355Q100 310 175 150Q280 15 430 35Q560 40 625 165Q560 125 480 145Q360 180 290 295Q160 410 15 355Z" fill="#fffdf8" stroke="none"/><path d="M405 150Q385 260 255 345M450 160Q430 275 300 365" fill="none" stroke="#ece5f7" stroke-width="12"/>')
flats.append(dict(id='sled-hill',src='v2/'+hill,x=pt(476,184)[0]-410,y=pt(476,184)[1]-150,width=hillW,height=hillH,topLeft=True,resolution=4))
# Small cocoa stand and unrotated, exact Home bench SVG.
b='<ellipse cx="210" cy="340" rx="195" ry="18" fill="#d5c9f2" stroke="none"/><path d="M55 100h310v225H55Z" fill="#d7a357"/><path d="M25 90Q210-30 395 90v55H25Z" fill="#fff4da"/><path d="M100 48l60-20v117h-60m120-117 60 20v97h-60" fill="#d96a5b"/><path d="M85 250h250v70H85Z" fill="#c68c45"/><path d="M130 195h45v50h-45m45-40q30-10 23 20h-23m55-30h45v50h-45" fill="#fffdf8"/>'
add('cocoa-stall',svg('cocoa-stall',420,360,b),634,958,420,360)
bench=ROOT/'public/pixi-art/home-review/hill/bench.svg'; (OUT/'home-bench.svg').write_text(bench.read_text());bw,bh=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',bench.read_text()).groups())
for i,(x,y) in enumerate([(548,954),(723,954),(594,495),(738,489)]):add(f'home-bench-{i}','home-bench.svg',x,y,210,210*bh/bw)
# Path graph: one painter, one fill colour, exact Home lane widths. Cubic curves, no edge band.
# Named nodes make every branch's actual endpoint reviewable. No anonymous snow stubs.
nodes={'harbour':(1090,866),'harbour-court':(1090,850),'south':(773,880),'plaza':(831,725),'south-gate':(831,588+(rh/2-8)/S),'west-gate':(831-(rw/2-8)/S,588),'north-gate':(831,588-(rh/2-8)/S),'gallery-court':(950,575),'bakery-court':(310,345),'lodge-court':(1100,300),'workshop-court':(290,785),'yard':(254,925),'sled':(476,184),'stall':(634,966)}
# The east rink entrance is open as well as the three original gates.
pathspec=[('arrival',128,'harbour','south',[(1090,850),(1010,830),(940,825),(860,840),(800,855)]),('square',128,'south','plaza',[(749,778)]),('rink-approach',128,'plaza','south-gate',[]),('west',128,'south-gate','workshop-court',[(700,672),(584,669),(515,749),(409,790)]),('bakery',128,'west-gate','bakery-court',[(650,575),(581,557),(531,434),(442,414),(344,394)]),('lodge',128,'north-gate','lodge-court',[(802,430),(865,315),(1030,315)]),('yard',104,'workshop-court','yard',[(355,830),(395,950),(360,970)]),('sled',104,'bakery-court','sled',[(365,340),(405,260)]),('stall',104,'south','stall',[(750,965),(695,990)]),('fishing',104,'harbour-court','harbour',[]),('gallery-lane',104,'gallery-court','plaza',[(980,635),(960,710)])]
paths=[]; pathpaint=''; routes=[]
def paint_route(name,width,line,ends):
 global pathpaint
 coords=[pt(*p) for p in line]
 # Sample the painted quadratic itself, so clearance and no-stub checks see the real corridor.
 samples=[coords[0]];d=f'M{coords[0][0]} {coords[0][1]}'
 for i in range(1,len(coords)-1):
  a=coords[i];b=coords[i+1];e=[(a[0]+b[0])/2,(a[1]+b[1])/2];o=samples[-1]
  d+=f' Q{a[0]} {a[1]} {e[0]} {e[1]}'
  for k in range(1,13):
   t=k/12;samples.append([(1-t)**2*o[j]+2*(1-t)*t*a[j]+t*t*e[j] for j in (0,1)])
 d+=f' L{coords[-1][0]} {coords[-1][1]}';samples.append(coords[-1]);paths.append(samples)
 routes.append(dict(id=name,width=width,ends=ends,samples=samples))
 pathpaint+=f'<path d="{d}" fill="none" stroke="#a6deec" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
for name,width,a,b,via in pathspec:paint_route(name,width,[nodes[a],*via,nodes[b]],[a,b])
for name,x,y in doors:
 source=((x-600)/S,(y-600)/S)
 court=next((t for token,t in [('bakery','bakery-court'),('lodge','lodge-court'),('workshop','workshop-court'),('tool','workshop-court'),('fishing','harbour-court')] if token in name),None)
 if court is None:
  court='west-gate' if name=='cocoa-hut' else 'gallery-court'
 nodes[name]=source
 paint_route('door-'+name,104,[source,(source[0],source[1]+6),*(([(source[0],830),(1150,832)] if name=='fishing-east' else [])),nodes[court]],[name,court])
yard=pt(*nodes['yard']) # The lane's round cap is the yard landing, no oversized blue blob.
# Trim round path caps exactly at the outside of the gate rim.
# A shared snow apron masks any curve overshoot, preserving only gate landings.
rx0=rinkX-rw/2+8;ry0=rinkY-rh/2+8
apron=f'<rect x="{rx0-35}" y="{ry0-35}" width="{rw-16+70}" height="{rh-16+70}" rx="{radius+35}" fill="#fbf8ff"/>'
pathpaint+=apron
for name,(x,y) in [(n,pt(*nodes[n])) for n in gateT]:
 if name=='west-gate':pathpaint+=f'<path d="M{x-110} {y}H{x}" stroke="#a6deec" stroke-width="104" fill="none"/>'
 else:
  sign=-1 if name=='north-gate' else 1
  pathpaint+=f'<path d="M{x} {y+sign*110}V{y}" stroke="#a6deec" stroke-width="128" fill="none"/>'
# Hand-composed additional groves occupy the former oversized-building margins and snow expanses.
extraGroves=[[(420,140),(445,170),(470,135),(498,163),(523,135)],[(570,185),(595,211),(620,176),(646,205),(670,177)],[(715,144),(738,170),(764,141),(786,181)],[(1030,157),(1055,183),(1080,154),(1107,184),(1133,153)],[(1215,363),(1243,391),(1266,358),(1292,391)],[(916,384),(941,410),(965,376),(990,410),(1015,380)],[(414,478),(440,503),(466,475),(491,510)],[(204,563),(229,594),(253,560),(278,595)],[(84,704),(108,733),(133,700),(158,736)],[(215,690),(240,716),(264,682),(289,711)],[(362,685),(387,710),(412,677),(436,710)],[(500,630),(525,660),(551,626),(575,651)],[(692,796),(717,824),(740,791),(766,821)],[(888,700),(912,731),(936,695),(961,726)],[(1006,757),(1032,786),(1055,750),(1081,780)],[(1178,730),(1203,758),(1225,722),(1246,752)],[(518,860),(542,887),(566,854),(589,886)],[(378,945),(401,973),(427,941),(451,972)],[(717,1010),(742,1033),(767,1004),(792,1033)],[(610,899),(637,922),(660,890),(684,922)]]
extraGroves+=[[(80, 220), (110, 190), (140, 160), (175, 125), (215, 100), (250, 75)], [(300, 90), (335, 80), (370, 90), (410, 70), (450, 60), (490, 75)], [(585, 130), (620, 120), (655, 120), (690, 100), (725, 85), (760, 90)], [(835, 60), (875, 65), (915, 80), (950, 85), (990, 75), (1025, 65)], [(1145, 65), (1180, 80), (1210, 105), (1240, 115), (1270, 135), (1305, 155)], [(1380, 230), (1405, 260), (1430, 300), (1460, 335), (1465, 375), (1445, 405)], [(1270, 465), (1230, 490), (1200, 510), (1180, 545), (1170, 580), (1200, 610)], [(1320, 730), (1325, 765), (1295, 800), (1250, 825), (1210, 850), (1170, 870)], [(900, 875), (860, 885), (825, 915), (810, 950), (815, 990), (780, 1025)], [(690, 1045), (650, 1025), (610, 1030), (570, 1035), (530, 1035), (490, 1025)], [(335, 1010), (295, 990), (250, 995), (210, 1000), (170, 985), (130, 970)], [(70, 950), (45, 915), (50, 865), (60, 825), (25, 780), (35, 740)], [(70, 640), (55, 600), (75, 550), (110, 520), (115, 480), (110, 435)], [(325, 520), (350, 545), (375, 515), (400, 530), (425, 550), (450, 570)], [(600, 395), (625, 410), (650, 390), (675, 415), (695, 385), (710, 420)], [(1015, 480), (1040, 500), (1065, 475), (1090, 500), (1115, 520), (1140, 540)], [(450, 850), (475, 875), (495, 840), (520, 820), (545, 810), (570, 830)], [(790, 920), (815, 940), (840, 915), (865, 940), (885, 915), (870, 970)]]
for gi,g in enumerate(extraGroves):
 if 20<=gi:
  cx,cy=g[len(g)//2]
  if gi==24:cy+=35
  if gi in (29,30):cy-=30
  g=[(cx+dx,cy+dy) for dx,dy in [(-24,-18),(0,-30),(24,-12),(-22,14),(5,10),(28,22)]][:len(g)]
  extraGroves[gi]=g
 for ti,(x,y) in enumerate(g):
  n=(gi+ti)%5+1;src=OUT/f'tree-{n}.svg';bw,bh=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',src.read_text()).groups());h=410+ti%3*25
  add(f'grove-extra-{gi}-tree-{ti}',src.name,x,y,h*bw/bh,h)
# Shrubs form the low edges of these authored groves.
for gi,g in enumerate(extraGroves):
 for ti,(x,y) in enumerate(g):
  if 20<=gi<36 and ti%2==0:continue
  n=(gi+ti)%4+1;src=OUT/f'bush-{n}.svg';bw,bh=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',src.read_text()).groups())
  add(f'bush-extra-{gi}-{ti}',src.name,x-14,y+20,160,160*bh/bw)
# Useful little scenes, placed at hamlet margins rather than scattered across the fields.
svg('snow-lantern',100,190,'<ellipse cx="50" cy="180" rx="40" ry="9" fill="#d5c9f2" stroke="none"/><path d="M45 165V75h10v90" fill="#bb894a"/><rect x="22" y="30" width="56" height="65" rx="8" fill="#ffdf77"/><path d="M15 30Q50-8 85 30Z" fill="#fffdf8"/><path d="M50 35v55M24 65h52" fill="none"/>')
svg('snow-crates',170,120,'<ellipse cx="85" cy="108" rx="80" ry="10" fill="#d5c9f2" stroke="none"/><path d="M10 40h85v65H10Zm85-20h65v85H95Z" fill="#cea061"/><path d="M15 45l75 55m0-55-75 55m85-75 55 75m0-75-55 75" fill="none"/><path d="M5 40q40-25 95 0m-10-20q40-24 75 0" fill="#fffdf8" stroke="#d5c9f2" stroke-width="12"/>')
svg('snow-pile',210,90,'<path d="M8 75Q20 25 65 40Q85-10 130 20Q170 20 202 75Q100 95 8 75Z" fill="#fffdf8" stroke="#d5c9f2"/>')
svg('snow-fence',280,130,'<path d="M20 55h240M20 90h240" stroke="#bd8e50" stroke-width="15"/><path d="M25 22v90m115-90v90m115-90v90" stroke="#dab16f" stroke-width="20"/><path d="M15 22h20m95 0h20m95 0h20" stroke="#fffdf8" stroke-width="16"/>')
for i,(x,y) in enumerate([(282,349),(351,350),(1060,301),(1140,303),(253,790),(333,790),(1055,853),(1124,853),(602,970)]):
 add(f'snow-lantern-{i}','snow-lantern.svg',x,y,100,190)
# Authored occupational scenes, beside doors rather than on walking lanes.
from fix3_art import install_scenes, ground_detail, courts
install_scenes(svg,add,props,flats,OUT,pt,S)
# Remove authored plant bases that would crowd a new walking corridor.
def distance(p,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((p['x']-a[0])*dx+(p['y']-a[1])*dy)/(dx*dx+dy*dy or 1)));return math.hypot(p['x']-a[0]-t*dx,p['y']-a[1]-t*dy)
removed={p['id'] for p in props if ('grove' in p['id'] or 'bush' in p['id']) and any(distance(p,a,b)<105 for line in paths for a,b in zip(line,line[1:]))}
hill=next(f for f in flats if f['id']=='sled-hill')
removed.update(p['id'] for p in props if ('grove' in p['id'] or 'bush' in p['id']) and hill['x']-70<p['x']<hill['x']+hill['width']+70 and hill['y']-80<p['y']<hill['y']+hill['height']+100)
props[:]=[p for p in props if p['id'] not in removed];obstacles[:]=[o for o in obstacles if o['prop'] not in removed]
# Land SVG tiled at 256 world units, streamed at up to 4x. No huge static snow texture.
poly=' '.join(f'{x},{y}' for x,y in coast)
# Canopies, not just trunks, must clear the yard and its approach.
yardRoute=next(r for r in routes if r['id']=='yard')
x0,y0=pt(160,880);x1,y1=pt(355,951)
def crowds_yard(p):
 if not ('grove' in p['id'] or 'bush' in p['id']):return False
 left,right=p['x']-p['width']/2,p['x']+p['width']/2
 top,bottom=p['y']-p['height'],p['y']
 return (left<x1 and right>x0 and top<y1 and bottom>y0) or any(left<x+85 and right>x-85 and top<y+85 and bottom>y-85 for x,y in yardRoute['samples'])
# Re-home the encroaching small grove to a named northern grove behind the lodge.
relocations=[(1080,123),(1110,140),(1140,115),(1165,150),(1190,130),(1095,185),(1125,200),(1158,188),(1190,210),(1220,195),(1240,230),(1205,250),(1275,230),(1320,220),(1300,255),(1340,270),(1050,115),(1020,100),(990,130),(950,140),(1010,180),(980,210),(1045,215),(1140,225),(1175,260),(1240,270),(1280,290),(1300,320),(1330,340),(1350,365)]
for p,(x,y) in zip([p for p in props if crowds_yard(p)],relocations):
 p['x'],p['y']=pt(x,y)
 for o in obstacles:
  if o['prop']==p['id']:o['x']=p['x'];o['y']=p['y']-28
removed={p['id'] for p in props if crowds_yard(p) or (('grove' in p['id'] or 'bush' in p['id']) and any(distance(p,a,b)<105 for line in paths for a,b in zip(line,line[1:])))}
props[:]=[p for p in props if p['id'] not in removed];obstacles[:]=[o for o in obstacles if o['prop'] not in removed]
# The pine, rim and seating are modest static textures, ready before the island
# is shown. They must never wait behind terrain crops in the shared decode queue.
for p in props:
 if p['id']=='decorated-pine' or p['id'].startswith(('rink-fence-','rink-home-bench-','rink-cocoa-cart')):p['preload']=True
detail=ground_detail(W,H,paths,doors)
courtpaint=courts(doors,pt,S)
terrain=f'<defs><clipPath id="snow-coast"><polygon points="{poly}"/></clipPath></defs><polygon points="{poly}" fill="#fbf8ff" stroke="#d5c9f2" stroke-width="24" stroke-linejoin="round"/><g clip-path="url(#snow-coast)">{detail}{courtpaint}{pathpaint}</g>'
tiles=[]
def point_inside(p,poly):
 inside=False;x,y=p
 for (ax,ay),(bx,by) in zip(poly,poly[1:]+poly[:1]):
  if (ay>y)!=(by>y) and x<(bx-ax)*(y-ay)/(by-ay)+ax:inside=not inside
 return inside
def segment_distance(p,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy or 1)));return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
for y in range(0,H,256):
 for x in range(0,W,256):
  center=(x+128,y+128)
  # Homogeneous snow uses the flat fallback, with sharp tiles only near edges and paths.
  if not any(abs(center[0]-cx)<400 and abs(center[1]-cy)<400 for cx,cy in coast) and not point_inside(center,coast):continue
  # Keep coast-adjacent tiles too; transparent sea stays transparent.
  localmarks=[]
  for mark in re.findall(r'<g data-snow-detail=.*?</g>|<ellipse[^>]+/>',detail):
   xy=re.search(r'translate\(([-\d.]+) ([-\d.]+)\)',mark)
   if xy:mx,my=map(float,xy.groups())
   else:
    mx=float(re.search(r'cx="([^"]+)"',mark)[1]);my=float(re.search(r'cy="([^"]+)"',mark)[1])
   if x-90<mx<x+346 and y-50<my<y+306:localmarks.append(mark)
  tileterrain=terrain.replace(detail,'<g id="snow-grain">'+''.join(localmarks)+'</g>')
  name=f'ground-{x}-{y}.svg';(OUT/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="{x} {y} 256 256">{tileterrain}</svg>');tiles.append(dict(src='v2/'+name,x=x,y=y,width=256,height=256,resolution=4,margin=32))
(OUT/'terrain.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">{terrain}</svg>')
# All standing art uses small streamed SVG crops in the same bounded texture pool as ground.
for p in props+flats:
 text=(OUT/Path(p['src']).name).read_text();root=text[:text.index('>')+1];attrs=re.sub(r'\s(?:width|height|viewBox)="[^"]*"','',root).replace('<svg','').rstrip('>');vb=re.search(r'viewBox="([^"]+)"',text)[1];body=text[text.index('>')+1:text.rfind('</svg>')];w=p['width'];h=p['height'];arr=[]
 for yy in range(0,math.ceil(h),256):
  for xx in range(0,math.ceil(w),256):
   tw=min(256,w-xx);th=min(256,h-yy);name=f"{p['id']}-tile-{xx}-{yy}.svg"
   (OUT/name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{tw}" height="{th}" viewBox="{xx} {yy} {tw} {th}"><svg {attrs} width="{w}" height="{h}" viewBox="{vb}">{body}</svg></svg>');arr.append(dict(src='v2/'+name,x=xx,y=yy,width=tw,height=th,resolution=4,margin=32))
 p['tiles']=arr
world=dict(width=W,height=H,coast=coast,water=[],bridges=[],obstacles=obstacles,islets=[],walkways=[],paths=paths,props=props,zones={name:dict(x=pt(x,y)[0],y=pt(x,y)[1],spawn=pt(x,y)) for name,x,y in [('plaza',831,725),('rink',800,585),('bakery',310,345),('lodge',1100,300),('workshop',290,785),('harbour',1090,868),('snowman',254,940),('sledHill',476,184)]},sleepTotal=60,sleepSpots={},sleepAvoid=[dict(x=rinkX,y=rinkY,rx=rw*.6,ry=rh*.6,name='rink')],iceland2=dict(rink=dict(x=rx0,y=ry0,width=rw-16,height=rh-16,radius=radius,posts=fencePosts,rails=fenceRuns,gateWidth=gateWidth),traceScale=S,nodes={name:pt(*p) for name,p in nodes.items()},routes=routes,gates={name:pt(*nodes[name]) for name in ['north-gate','west-gate','south-gate']},doors=doors,reference='B2 whole-source.png',pathWidths=[128,104],snowfall=True))
harbor=dict(jetty=dict(foot=pt(1090,866),tip=pt(1090,1010),width=140),spawn=pt(831,725),boats=[dict(x=pt(1090,960)[0]+170,y=pt(1090,960)[1],turn=math.pi),dict(x=pt(1090,990)[0]-170,y=pt(1090,990)[1],turn=math.pi),dict(x=pt(1090,1020)[0]+170,y=pt(1090,1020)[1],turn=math.pi)])
base=ROOT/'assets/world/themes/snow';dump(base/'world.json',world);dump(base/'walk-world.json',world);dump(base/'harbor.json',harbor)
art=dict(raster=dict(enabled=False),width=W,height=H,sea='#6EC9DE',ground=dict(tiles=tiles,vector='v2/terrain.svg'),props=props,flats=flats,decks=[],floating=[]);dump(OUT.parent/'art.json',art)
# Low-resolution globe fallback contains the same coast and path graph.
(ROOT/'public/pixi-art/globe/snow-ground.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="{1024*H/W}" viewBox="0 0 {W} {H}">{terrain}</svg>')
print('B2 scale',S,'area',area(coast),'Home',area(home['coast']),'props',len(props),'map',W,H)
