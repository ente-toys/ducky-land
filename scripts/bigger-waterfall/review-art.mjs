import {inPoly} from '../../assets/world/island-geometry.mjs';
const smooth=p=>{const out=[];for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];for(let j=0;j<12;j++){const t=j/12,u=1-t;out.push([0,1].map(k=>u*u*(a[k]+b[k])/2+2*u*t*b[k]+t*t*(b[k]+c[k])/2));}}return out};
const poly=p=>'M'+p.map(([x,y])=>`${x},${y}`).join(' L')+' Z';

export function roadDetails(roads,ribbon){
 const shapes=roads.map(r=>ribbon(r.p,r.w));let body='';
 for(const [ri,q] of shapes.entries()){
  for(const [side,edge]of [[0,q.l],[1,q.r]])for(let i=3;i<edge.length-2;i+=7){
   const [x,y]=edge[i],a=q.c[i],dx=x-a[0],dy=y-a[1],len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
   if(shapes.some((s,j)=>j!==ri&&inPoly(x,y,s.poly)))continue;
   const turn=`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${Math.atan2(ny,nx)*180/Math.PI-90})`;
   body+=`<g transform="${turn}"><path d="M-25 6q4-11 11-3q-5-19 5-13q6-23 13-3q13-14 13 5q14-6 13 10" fill="#82AB35" stroke="#54772F" stroke-width="3.5"/><path d="M-8 2l-4-11M5 1l3-12" stroke="#BAD05E" stroke-width="3"/></g>`;
   const px=x-nx*23,py=y-ny*23;
   body+=`<ellipse cx="${px}" cy="${py}" rx="${7+(i%3)*2}" ry="5" fill="#D5CC9A" stroke="#718054" stroke-width="2.5"/>`;
   if((i+side+ri)%3===0)body+=`<path d="M${x-nx*44} ${y-ny*44}l19 3m-13 8l25 2" stroke="#C6AA65" stroke-width="3" stroke-linecap="round"/>`;
  }
 }
 return body;
}

export function commonsGround(){
 let s='';
 for(const [p,fill]of [
  [[[-900,510],[-390,140],[300,150],[800,550],[450,1110],[-300,1240],[-870,990]],'#A2BF43'],
  [[[4150,-400],[4860,-450],[5480,-150],[5670,320],[5030,620],[4320,360]],'#A4BC4E'],
  [[[5920,530],[6640,250],[7370,670],[7680,1280],[7200,1640],[6570,1430],[6060,1130]],'#A3C24C'],
  [[[7700,3360],[8210,3450],[8440,3940],[8150,4420],[7640,4600],[7400,4080]],'#9FC044'],
  [[[5750,4940],[6270,4520],[6970,4510],[7170,4950],[6540,5520],[5960,5480]],'#A9C44D'],
  [[[650,5100],[1230,4950],[1990,5250],[2160,5660],[1600,5990],[870,5680]],'#A9C34D'],
  [[[-1200,3680],[-710,3510],[-70,3950],[120,4480],[-330,4750],[-940,4440]],'#9CBD40']
 ])s+=`<path d="${poly(smooth(p))}" fill="${fill}" stroke="#8DAA39" stroke-width="6" stroke-linejoin="round"/>`;
 for(const [x,y,w]of [[4410,-270,620],[4350,-110,790],[4440,55,850],[4630,220,590]])s+=`<path d="M${x} ${y}q${w/2} -40 ${w} 45l-20 70q-${w/2} -40 -${w} -25Z" fill="#C1C367" stroke="#82984A" stroke-width="5"/><path d="M${x+45} ${y+35}q${w/2} -14 ${w-100} 39" stroke="#E2D68A" stroke-width="14" stroke-dasharray="5 20" fill="none"/>`;
 for(const [x,y]of [[-1070,3880],[-620,3950],[-910,4100],[-460,4180]])s+=`<path d="M${x} ${y}h300l40 100h-310Z" fill="#7E8340" stroke="#4F7431" stroke-width="6"/><path d="M${x+30} ${y+30}h235m-215 42h240" stroke="#B4C669" stroke-width="15" stroke-dasharray="8 21"/>`;
 return s;
}

export const commonEntrances=[[-400,850],[4780,420],[6840,1260],[7820,3960],[6300,5190],[1410,5520],[-500,4380]];

export function composeCommons({prop,svg,water,groundPath}){
 const pond=smooth([[6490,780],[6740,630],[7050,720],[7170,950],[7020,1130],[6710,1140],[6490,1010]]);
 water.push({poly:pond,communityWater:'spring-garden-pond'});
 groundPath(`<path d="${poly(pond)}" fill="#6EC9DE" stroke="#5D793B" stroke-width="16"/><path d="M6590 870q80-24 160 0m100 127q65 21 135-2" fill="none" stroke="#BAE6DF" stroke-width="6"/>`);
 const orchard=svg('orchard-tree',290,360,`<path d="M139 333V184m0 80l-51-45m51 64l47-60" fill="none" stroke="#846339" stroke-width="20"/><path d="M50 222q-57-58-2-104q-16-74 61-77q43-67 104-9q79-5 61 78q49 58-11 106q-55 58-114 19q-58 36-99-13Z" fill="#6FA33A"/><path d="M67 115q1-40 48-38m17-11q30-35 56-8" stroke="#A5C951" stroke-width="14" fill="none"/><g fill="#E5BB55" stroke-width="3"><circle cx="80" cy="161" r="13"/><circle cx="163" cy="104" r="13"/><circle cx="221" cy="173" r="14"/><circle cx="141" cy="204" r="12"/></g>`);
 const hive=svg('orchard-hive',180,190,`<path d="M35 164v-25h110v25m-95 0v18m80-18v18" fill="#B79555"/><path d="M30 137q-5-26 18-32q-8-29 17-37q0-34 28-33q32-3 32 33q27 13 16 37q25 17 10 32Z" fill="#E3C46E"/><path d="M50 105h90M65 73h62M39 132h108" stroke="#AF8D44" stroke-width="4"/><ellipse cx="94" cy="126" rx="16" ry="12" fill="#5D6837"/>`);
 const rack=svg('drying-rack',360,210,`<path d="M30 190V35m295 155V35M22 50h310M22 100h310" stroke="#967747" stroke-width="12"/><path d="M53 44l35 118m10-118l36 118m10-118l36 118m10-118l36 118m10-118l36 118" stroke="#BDAC66" stroke-width="13"/><path d="M45 158h260" stroke="#7A8946" stroke-width="8"/>`);
 const picnic=svg('picnic-table',370,240,`<path d="M75 65h235l40 61H36Z" fill="#DCBA75"/><path d="M95 123l-18 80m195-80l25 80" stroke="#9B7C43" stroke-width="16"/><path d="M24 152h120v28H12Zm220 0h112l12 28H244Z" fill="#CDA76B"/><path d="M92 87h214m-197 20h218" stroke="#AE8A51" stroke-width="4"/><path d="M163 72v-25h55v25" fill="#F0DFAC"/><ellipse cx="190" cy="46" rx="28" ry="9" fill="#C9D99A"/>`);
 const pieces=[
  ['orchard',orchard,-650,620,310,385,36],['orchard',orchard,-120,430,300,370,36],['orchard',orchard,420,630,320,395,36],['orchard',orchard,-470,1070,300,370,36],['orchard',orchard,210,1120,310,390,36],
  ['orchard',hive,550,990,160,170,22],['orchard','reuse/street--picnic-basket.svg',-100,860,105,100,0],['orchard','reuse/street--bench-wood.svg',-530,1370,230,155,24],
  ['field','reuse/nature--tree-round.svg',4120,-170,320,385,36],['field','reuse/nature--tree-willow.svg',5570,380,330,410,36],['field',hive,5240,440,145,155,20],['field','reuse/street--picnic-basket.svg',4320,440,105,100,0],
  ['spring','reuse/nature--tree-willow.svg',6240,700,360,450,36],['spring','reuse/nature--tree-round.svg',7370,1130,340,420,36],['spring','reuse/nature--tree-oak.svg',7150,570,340,415,36],['spring','reuse/nature--reeds.svg',6520,1050,160,185,0],['spring','reuse/nature--cattails.svg',7080,1190,150,160,0],['spring','reuse/nature--rock-round.svg',6400,1100,130,90,20],['spring','reuse/street--bench-wood.svg',6820,1380,230,155,24],
  ['reed-green',rack,7950,3750,360,210,25],['reed-green',rack,8170,4120,300,180,25],['reed-green','reuse/nature--tree-willow.svg',7540,3820,345,430,36],['reed-green','reuse/nature--tree-round.svg',7910,4440,320,400,36],['reed-green','reuse/street--picnic-basket.svg',7720,4210,110,100,0],['reed-green','reuse/nature--log.svg',8270,3770,160,100,25],
  ['lookout',picnic,6820,5250,370,240,28],['lookout','reuse/street--picnic-blanket.svg',6040,5230,300,175,0],['lookout','reuse/nature--tree-willow.svg',7000,5200,350,440,36],['lookout','reuse/nature--tree-oak.svg',7180,4750,335,415,36],['lookout','reuse/nature--tree-round.svg',6660,5450,310,390,36],['lookout','reuse/street--picnic-basket.svg',6260,5360,105,100,0],
  ['picnic',picnic,1320,5320,370,240,28],['picnic','reuse/nature--tree-willow.svg',850,5330,350,440,36],['picnic','reuse/nature--tree-oak.svg',1810,5430,335,415,36],['picnic','reuse/nature--tree-round.svg',1340,5890,310,390,36],['picnic','reuse/street--picnic-blanket.svg',1570,5660,300,175,0],['picnic','reuse/street--picnic-basket.svg',1520,5580,105,100,0],
  ['fern-garden','reuse/nature--tree-willow.svg',-1170,3950,340,430,36],['fern-garden','reuse/nature--tree-round.svg',-130,4380,310,390,36],['fern-garden','reuse/street--bench-wood.svg',-700,4530,230,155,24],['fern-garden','reuse/street--planter-flowers.svg',-340,3840,110,160,0],
  ['nursery-green',picnic,-1050,2440,330,210,25],['nursery-green','detail/fern-fan.svg',-1370,2210,190,130,0],['nursery-green','detail/fern-fan.svg',-1390,2380,160,110,0],['nursery-green','detail/fern-fan.svg',-610,2170,180,120,0],['nursery-green','reuse/street--planter-flowers.svg',-680,2440,115,150,0]
 ];
 for(const [i,[c,src,x,y,w,h,solid]]of pieces.entries())prop(`common-${c}-${i}`,src,x,y,w,h,solid,'common-'+c);
 for(const [i,[x,y,size]]of [[-810,800,170],[490,1180,190],[-300,250,150],[4050,380,180],[5410,-200,170],[6180,1100,180],[7380,1360,190],[7190,560,155],[7670,4440,180],[8230,3910,150],[5830,5160,185],[6990,4770,170],[1600,5160,190],[810,5590,170],[-1080,4320,175],[-330,3630,160]].entries()){
  prop('common-border-'+i,'reuse/bush-'+(i%4+1)+'.svg',x,y,size,size*.65,0,'commons');
  prop('common-flower-'+i,'reuse/flower-'+(i%3+1)+'.svg',x+55,y+34,95,70,0,'commons');
 }
 for(const [i,[x,y]]of [[6610,950],[6930,820],[7000,1020]].entries())prop('pond-lily-'+i,'reuse/nature--lily-pad-flower.svg',x,y,95,48,0,'spring-pond');
}

export function varyHome(body,{w,h,i,reed,fish,mill}){
 const walls=['#F8E6B1','#E7D69C','#DBD5AE','#F4D6A1','#D8DFC0'];
 body=body.replaceAll(reed?'#D8C589':mill?'#F5DCA0':'#F8E6B1',walls[i]);
 if(i===0)body+=`<path d="M${w*.58} ${h-161}v-56l35-32 36 32v56Z" fill="#F2DFAD"/><path d="M${w*.58-8} ${h-216}l43-43 45 43" fill="none" stroke="#71884E" stroke-width="13"/><rect x="${w*.58+22}" y="${h-211}" width="27" height="35" rx="8" fill="#B5DFCE"/>`;
 if(i===1)body+=`<path d="M18 ${h-156}l42-46h${w-120}l42 46Z" fill="${reed?'#C8B77B':'#7AAB86'}"/><path d="M48 ${h-153}v116m${w-96}-116v116" stroke="#A38550" stroke-width="9"/><path d="M48 ${h-144}q${w/2-48} 22 ${w-96} 0" fill="none" stroke="#B7C58B" stroke-width="8"/>`;
 if(i===2)body+=`<path d="M58 ${h-159}V94l46-42h${w-190}l38 42v${h-253}Z" fill="${reed?'#ADA36C':'#7C9D73'}"/><path d="M54 94h${w-90}" stroke="#C5CA8D" stroke-width="6"/><circle cx="${w/2}" cy="115" r="23" fill="#D8E9CB"/><path d="M${w/2-21} 115h42m-21-21v42" stroke-width="3"/>`;
 if(i===3)body+=`<path d="M${w-88} ${h-39}v-80h65v80Z" fill="#D4BE82"/><path d="M${w-99} ${h-119}l43-42 43 42Z" fill="#A7B67C"/><path d="M${w-67} ${h-40}v-48h24v48" fill="#9C824E"/>`;
 if(i===4)body+=`<path d="M25 ${h-64}h${w-50}v28H25Z" fill="#C4A46A"/><path d="M32 ${h-37}v-67m${w-64} 67v-67M26 ${h-90}h${w-52}" fill="none" stroke="#9C8451" stroke-width="5"/><path d="M${w*.72} ${h-43}q-19-35-6-48q22 7 27 29" fill="#95B95A"/>`;
 return body;
}
