const ink='#39472d',stone='#dbbd85',cream='#fff0cd',olive='#839953';
const P=(d,fill='none',stroke=ink,w=1.8)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const rect=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${ink}" stroke-width="1.8"/>`;
export const IDENTITIES={
 bellpeep:{name:'Bellfounders',roofs:['forge-hip','split-gable','clipped-gable','bell-gable'],shutters:'arched-board',porches:'stone-bracket',sign:'bell'},
 olivello:{name:'Olive growers',roofs:['low-hip','olive-saltbox','garden-hip','press-shed'],shutters:'plank',porches:'timber-pergola',sign:'olive'},
 tessera:{name:'Tile makers',roofs:['tile-gable','stepped-gable','tile-pavilion','sawtooth'],shutters:'diamond',porches:'tile-lintel',sign:'diamond'},
 crumbbell:{name:'Harbour bakers',roofs:['gambrel','sail-gable','half-hip','bakehouse'],shutters:'louver',porches:'striped-awning',sign:'shell'},
};
export function roofProfile(type,{L,R,c,side,peak:p,roofEnd:e}){
 const l=L-15,r=R+8,back=side;
 const profiles={
 'forge-hip':`M${l} ${e+5}L${L+35} ${p+27}H${R-31}L${R+back+13} ${e-20}L${r} ${e+5}Z`,
 'split-gable':`M${l} ${e+5}L${c-35} ${p+15}L${c+4} ${p+46}L${c+49} ${p+2}L${R+back+13} ${e-21}L${r} ${e+5}L${c+38} ${p+29}L${c+3} ${p+70}L${c-37} ${p+42}Z`,
 'clipped-gable':`M${l} ${e+6}L${c-36} ${p+24}H${c+18}L${R+back+12} ${e-22}L${r} ${e+6}L${c+9} ${p+47}H${c-28}Z`,
 'bell-gable':`M${l} ${e+4}L${c-10} ${p+22}Q${c+12} ${p+1} ${c+29} ${p+22}L${R+back+11} ${e-20}L${r} ${e+5}L${c+4} ${p+44}Z`,
 'low-hip':`M${l} ${e+5}L${L+43} ${p+64}H${R-30}L${R+back+13} ${e-20}L${r} ${e+5}Z`,
 'olive-saltbox':`M${l} ${e+7}L${c-39} ${p+34}L${c-12} ${p+10}L${R+back+12} ${e-21}L${r} ${e+7}L${c-39} ${p+53}Z`,
 'garden-hip':`M${l} ${e+7}Q${L} ${p+63} ${L+50} ${p+48}H${R-40}Q${R+24} ${p+65} ${R+back+10} ${e-17}L${r} ${e+7}Z`,
 'press-shed':`M${l} ${e+4}L${L+13} ${p+50}L${R+back+10} ${p+31}V${e-20}L${r} ${e+6}Z`,
 'tile-gable':`M${l} ${e+5}L${c+back} ${p+6}L${R+back+13} ${e-23}L${r} ${e+5}L${c} ${p+33}Z`,
 'stepped-gable':`M${l} ${e+5}L${L+16} ${p+65}V${p+47}H${c-25}V${p+25}H${c+2}V${p+6}H${c+back+4}L${R+back+12} ${e-21}L${r} ${e+5}L${c+4} ${p+37}H${c-17}V${p+60}H${L+37}V${p+81}Z`,
 'tile-pavilion':`M${l} ${e+6}L${c-24} ${p+38}L${c+back} ${p+17}L${R+back+12} ${e-19}L${r} ${e+6}L${c-24} ${p+64}Z`,
 'sawtooth':`M${l} ${e+6}L${L+28} ${p+53}L${c-31} ${p+28}V${p+58}L${c+54} ${p+17}L${R+back+12} ${e-22}L${r} ${e+6}L${c+32} ${p+47}L${c-50} ${p+84}V${p+55}Z`,
 gambrel:`M${l} ${e+5}L${L+17} ${p+55}L${c-13} ${p+20}L${c+back} ${p+3}L${R+back-9} ${p+43}L${R+back+12} ${e-21}L${r} ${e+5}L${R-15} ${p+69}L${c-13} ${p+46}L${L+37} ${p+79}Z`,
 'sail-gable':`M${l} ${e+7}L${c-14} ${p+29}L${c+back} ${p+2}Q${c+53} ${p+61} ${R+back+12} ${e-21}L${r} ${e+7}Q${c+37} ${p+74} ${c-14} ${p+48}Z`,
 'half-hip':`M${l} ${e+6}L${c-45} ${p+51}L${c-8} ${p+23}H${c+34}L${R+back+13} ${e-20}L${r} ${e+6}L${c+16} ${p+49}H${c-13}L${c-30} ${p+67}Z`,
 bakehouse:`M${l} ${e+6}Q${L+2} ${p+49} ${L+55} ${p+41}H${R-37}Q${R+17} ${p+48} ${R+back+12} ${e-20}L${r} ${e+7}Q${c} ${e-4} ${l} ${e+6}Z`,
 };
 return profiles[type];
}
export function villageDetails(s,{L,R,c,b,wallTop:t,work}){
 const width=work?130:s.porchWidth??108,y=b-116,sign=s.sign??s.identity.sign;
 let out=`<g data-village-vocabulary="${s.village}" data-porch="${s.identity.porches}" data-shutters="${s.identity.shutters}">`;
 if(s.village==='bellpeep'){
  out+=P(`M${c-width/2} ${y+16}L${c-width/2+13} ${y-3}H${c+width/2-13}L${c+width/2} ${y+16}Z`,s.roofColor);
  for(const x of [c-width/2+9,c+width/2-9])out+=P(`M${x-5} ${y+17}v20h10v-20Z`,stone);
  out+=P(`M${L+13} ${b-17}v-42m0 12h12m-12 12h9`,'none','#836b43',2);
  out+=rect(R-28,t+28,17,34,'#d9ba7c');
 }else if(s.village==='olivello'){
  out+=P(`M${c-width/2-9} ${y+15}l18 -20h${width-18}l17 20Z`,'#bb9258');
  for(const x of [c-width/2,c+width/2])out+=rect(x-3,y+14,6,104,'#b98955');
  for(let i=0;i<5;i++)out+=P(`M${c-width/2+10+i*(width-20)/4} ${y+14}l8 -17`,'none',ink,2);
  out+=P(`M${c-width/2-3} ${y+10}q20 -20 42 -9m-4 -2q22 -11 44 4`,'none','#667e42',3);
  for(const [x,yy]of [[c-width/2+10,y],[c-width/2+26,y-6],[c+width/2-15,y+1]])out+=P(`M${x-5} ${yy}q4 -9 11 -5q-1 9 -11 5Z`,olive,ink,1);
 }else if(s.village==='tessera'){
  out+=rect(c-width/2,y+4,width,15,cream);
  for(let x=c-width/2+9;x<c+width/2-4;x+=16)out+=P(`M${x} ${y+5}l6 6 -6 6 -6 -6Z`,x%3?'#a5d3d2':s.roofColor,ink,1);
  for(const x of [L+12,R-18])for(let j=0;j<3;j++)out+=P(`M${x} ${b-32-j*18}l6 -6 6 6 -6 6Z`,j%2?olive:'#a5d3d2',ink,1);
 }else{
  out+=P(`M${c-width/2-6} ${y+20}l16 -28h${width-20}l16 28Z`,cream);
  for(let i=0;i<5;i++){const x=c-width/2+2+i*(width-4)/5;out+=P(`M${x+6} ${y-7}h10l5 27h-18Z`,s.roofColor,ink,.7);}
  out+=P(`M${c-width/2-6} ${y+20}q${width/2+6} 14 ${width+12} 0`,'none',ink,2);
  for(const x of [c-width/2,c+width/2])out+=P(`M${x} ${y+23}v13`,'none',ink,2);
  out+=P(`M${R+8} ${b-20}q14 -5 14 -18q0 -9 -7 -10q-11 5 -5 17q14 12 7 20`,'none','#b98955',3);
 }
 const x=s.signSide==='left'?L+23:R-30,sy=t+12+(s.signDrop??0);
 out+=P(`M${x-10} ${sy-13}v-9h26v15`,'none',ink,2.5);
 const shape=s.signShape??'board';
 out+=`<g data-trade-sign="${sign}" data-sign-shape="${shape}">`;
 out+=shape==='pennant'?P(`M${x-15} ${sy}h30v27l-15 -7 -15 7Z`,cream):shape==='diamond'?P(`M${x} ${sy-5}l19 18 -19 18 -19 -18Z`,cream):P(`M${x-18} ${sy}q18 -9 36 0v23q-18 8 -36 0Z`,cream);
 if(sign==='bell')out+=P(`M${x-8} ${sy+17}q4 -3 3 -9q5 -8 10 0q-1 6 3 9Z`,'#d5ad58')+P(`M${x} ${sy+19}v3`,'none',ink,2);
 else if(sign==='olive')out+=P(`M${x-9} ${sy+20}l17 -16m-11 11q-11 -9 -4 -11q10 0 9 6m0 -1q6 -8 10 -2q-1 8 -9 7`,'none',olive,3);
 else if(sign==='diamond')out+=P(`M${x} ${sy+4}l9 9 -9 9 -9 -9Z`,'#a5d3d2',ink,1.3);
 else out+=P(`M${x-10} ${sy+14}q0 -14 7 -8q5 -8 9 0q8 -4 4 9l-10 6Z`,'#dfba76',ink,1.2);
 return out+'</g></g>';
}
export function frontGable(type,{L,R,c,peak:p,roofEnd:e}){
 const l=L-15,r=R+8;
 const tops={
 'split-gable':[[l,e+5],[c-37,p+42],[c+3,p+70],[c+38,p+29],[r,e+5]],
 'clipped-gable':[[l,e+6],[c-28,p+47],[c+9,p+47],[r,e+6]],
 'bell-gable':[[l,e+4],[c+4,p+44],[r,e+5]],
 'olive-saltbox':[[l,e+7],[c-39,p+53],[r,e+7]],
 'tile-gable':[[l,e+5],[c,p+33],[r,e+5]],
 'stepped-gable':[[l,e+5],[L+37,p+81],[L+37,p+60],[c-17,p+60],[c-17,p+37],[c+4,p+37],[r,e+5]],
 'tile-pavilion':[[l,e+6],[c-24,p+64],[r,e+6]],
 sawtooth:[[l,e+6],[c-50,p+55],[c-50,p+84],[c+32,p+47],[r,e+6]],
 gambrel:[[l,e+5],[L+37,p+79],[c-13,p+46],[R-15,p+69],[r,e+5]],
 'sail-gable':[[l,e+7],[c-14,p+48],[c+37,p+74],[r,e+7]],
 'half-hip':[[l,e+6],[c-30,p+67],[c-13,p+49],[c+16,p+49],[r,e+6]],
 };
 const points=tops[type];return points?'M'+points.map(p=>p.join(' ')).join('L')+'Z':null;
}
