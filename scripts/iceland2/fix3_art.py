"""FIX3 authored court scenes and baked snow surface. No runtime texture generator."""
SNOW='#fffdf8'; SHADE='#d5c9f2'
def ground_detail(W,H,paths,doors):
 motifs=[]
 pockets=[(2100,2350),(3520,3370),(4800,2060),(7850,2300),(9220,3150),(8830,4720),(3870,5290),(1810,6650),(3910,6880),(5630,7200),(7950,7000),(5430,4000),(1990,4480),(6740,1820),(4150,1870),(8560,6190),(6410,6520),(2980,4700)]
 shapes=['M-30 8q17-21 40-8q18-5 31 9q-33 8-71-1Z','M-24 8q6-21 24-16q21-12 36 17q-28 9-60-1Z','M-38 8q16-10 27-8q20-17 37-2l24 12q-52 8-88-2Z']
 for i,(cx,cy) in enumerate(pockets):
  for j,(dx,dy,size) in enumerate([(0,0,1.0),(94,36,.58),(156,-22,.75),(48,104,.48),(210,94,.9),(276,18,.55),(320,106,.7),(143,152,.45),(375,-34,.6),(415,80,.82),(510,25,.6),(565,125,.9),(600,-40,.5),(645,65,.75),(690,160,.6),(730,-5,.8),(770,100,.5),(40,255,.7),(120,300,.5),(200,235,.8),(270,340,.6),(345,260,.7),(420,350,.5),(500,245,.9),(570,325,.6),(645,265,.75),(720,355,.5),(780,245,.7),(85,430,.8),(250,455,.6),(455,425,.9),(680,450,.55)]):
   x=cx+dx;y=cy+dy
   if any((x-a)**2+(y-b)**2<260**2 for _,a,b in doors):continue
   if any((x-a)**2+(y-b)**2<115**2 for line in paths for a,b in line):continue
   if j in (3,7):
    body='<path d="M-6 2l-4-10m12 10v-13m6 14 6-9" stroke="#bdc8b6" stroke-width="2" fill="none"/>'
   elif j==4 and i%2==0:
    body='<path d="M-19 9q1-24 19-20q19-3 25 20Z" fill="#bfc4c7" stroke="#a4a9ad" stroke-width="2"/><path d="M-17 3q7-17 19-12q15-2 19 12" fill="#fffdf8" stroke="#ded9e6" stroke-width="2"/>'
   else:body=f'<path d="{shapes[(i+j)%3]}" fill="#fffdf8" stroke="#ded8e7" stroke-width="2"/>'
   motifs.append(f'<g data-snow-detail="{i}-{j}" transform="translate({x} {y}) scale({size})">{body}</g>')
 footprints=[]
 for n,line in enumerate(paths):
  for i,(x,y) in enumerate(line[::14]):
   if (n+i)%3:continue
   for dx,dy in [(-88,0),(-77,12)]:footprints.append(f'<ellipse cx="{x+dx:.1f}" cy="{y+dy:.1f}" rx="3" ry="6" fill="#e5def1"/>')
 return '<g id="snow-grain">'+''.join(motifs+footprints)+'</g>'

def courts(doors,pt,S):
 result=[]
 for name,x,y in doors:
  result.append(f'<path d="M{x-220} {y-22}Q{x-250} {y+50} {x-175} {y+90}Q{x} {y+125} {x+205} {y+65}Q{x+250} {y+5} {x+210} {y-22}Z" data-door-court="{name}" fill="#f8f6fb" stroke="#e7e3ed" stroke-width="2"/><path d="M{x-185} {y+20}q28 14 65-2m190 24 72-8" fill="none" stroke="#fffdf8" stroke-width="8"/>')
 return ''.join(result)
def install_scenes(svg,add,props,flats,OUT,pt,S):
 shadow='<ellipse cx="155" cy="185" rx="145" ry="15" fill="#d5c9f2" stroke="none"/>'
 chassis='<path d="M35 95h230v67H35Z" fill="#d8ac66"/><path d="M43 113h214m-214 25h214" fill="none" stroke="#a47c45" stroke-width="3"/><circle cx="70" cy="172" r="18" fill="#997340"/><circle cx="230" cy="172" r="18" fill="#997340"/><path d="M25 92h250v14H25Z" fill="#eac888"/><path d="M48 90V28m210 62V28M30 30q118-46 245 0v20H30Z" fill="#fffdf8"/>'
 svg('bread-cart',310,205,shadow+chassis+'<path d="M67 83V63q0-20 20-20t20 20v20Zm58 0V60q0-25 20-25t20 25v23Zm58 0V63q0-20 20-20t20 20v20Z" fill="#efc56b"/><path d="M78 54l17 8m40-12 17 8m40-5 17 8" fill="none" stroke="#ad7f45" stroke-width="3"/>')
 svg('cocoa-cart',310,205,shadow+chassis+'<path d="M70 88V57h34v31Zm34-26q28-4 18 18h-18M145 40h55v48h-55Z" fill="#fff4dc"/><path d="M150 38q-12-14 0-25m22 25q-12-14 0-25" fill="none" stroke="#b4a4c4" stroke-width="3"/><path d="M210 88V55h30v33" fill="#bb7951"/>')
 logs=shadow+'<path d="M28 165V65h16v100m218 0V65h16v100M32 160h240" stroke="#ae8050" stroke-width="12"/>'
 for x,y in [(70,145),(120,145),(170,145),(220,145),(95,105),(145,105),(195,105)]:logs+=f'<path d="M{x} {y-19}h24v38h-24" fill="#a37144"/><circle cx="{x}" cy="{y}" r="19" fill="#eacb89"/><circle cx="{x}" cy="{y}" r="9" fill="none" stroke="#ac8353" stroke-width="2"/>'
 svg('firewood-stack',310,205,logs+'<path d="M25 63q115-35 255 0v15H25Z" fill="#fffdf8"/>')
 rack=shadow+'<path d="M30 180V35m245 145V35M25 40h255" stroke="#ac8048" stroke-width="13"/><path d="M22 30q120-25 263 0v12H22Z" fill="#fffdf8"/>'
 for x in [65,125,185]:rack+=f'<path d="M{x} 65v82q0 25 30 20m-35-80h45m-45 25h45m-45 25h45" fill="none" stroke="#b77e42" stroke-width="9"/><path d="M{x+20} 65v88q0 20 20 13" fill="none" stroke="#e3b657" stroke-width="8"/>'
 svg('sled-rack',310,205,rack)
 svg('fish-crate',260,180,'<ellipse cx="130" cy="164" rx="115" ry="13" fill="#d5c9f2" stroke="none"/><path d="M20 70l170-25 50 30v80L70 177l-50-32Z" fill="#caa16b"/><path d="M20 70l50 30 170-25M70 100v77m10-52 150-23m-150 45 150-23" fill="none"/><path d="M60 63q40-35 73-8l25-15-5 26-30-1q-35 25-63-2Z" fill="#98c5c8"/><path d="M126 48q35-35 62-15l22-12-5 23-24 2q-28 20-55 2Z" fill="#b1dadd"/>')
 for name,source,x,y,w,h in [('bakery-bread-cart','bread-cart',274,314,205,136),('lodge-firewood','firewood-stack',1145,270,220,145),('workshop-sled-rack','sled-rack',340,754,230,152),('harbour-fish-crate','fish-crate',1130,827,170,118),('rink-cocoa-cart','cocoa-cart',764,645,190,126),('workshop-firewood','firewood-stack',373,754,160,106)]:add(name,source+'.svg',x,y,w,h)
 for i,(x,y) in enumerate([(710,645),(739,645),(788,748),(832,748)]):
  import re
  bw,bh=map(float,re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"',(OUT/'home-bench.svg').read_text()).groups())
  add(f'rink-home-bench-{i}','home-bench.svg',x,y,210,210*bh/bw)
 hill=next(f for f in flats if f['id']=='sled-hill')
 body='<ellipse cx="420" cy="399" rx="390" ry="35" fill="#c9bcde" stroke="none"/><path d="M20 355Q150 320 280 75Q340 20 445 45Q545 85 625 210Q710 320 800 365Q510 465 20 355Z" fill="#ddd2ec"/><path d="M20 347Q150 310 280 65Q340 10 445 35Q500 65 540 130Q380 105 300 275Q210 385 20 347Z" fill="#fffdf8"/><path d="M350 120Q310 240 160 335m235-209Q345 260 210 345" stroke="#d5c9f2" stroke-width="9" fill="none"/><path d="M300 95h260v40H300Z" fill="#b48953"/><path d="M305 89h250v20H305Z" fill="#ecd099"/>'
 for i in range(6):
  x=550+i*28;y=135+i*34
  body+=f'<path d="M{x} {y}h75v23h-75Z" fill="#b68b56"/><path d="M{x-5} {y-8}h85v15h-85Z" fill="#fffdf8"/>'
 body+='<path d="M315 100V35m230 65V35M312 55h237" stroke="#b08b54" stroke-width="12" fill="none"/><path d="M310 30h12m218 0h12" stroke="#fffdf8" stroke-width="12"/>'
 svg('sled-hill',820,440,body)
 sled=next(p for p in props if p['id']=='sled-hill-start');sled['x']=hill['x']+380;sled['y']=hill['y']+100
