// Fair furniture uses Home bench views. Never rotate or shear a standing seat.
const round=n=>Math.round(n*1000)/1000;
export const BENCH_COURTS={
 'bench-01':[237,518,92,67], 'bench-02':[237,518,92,67],
 'bench-03':[1299,518,92,67], 'bench-04':[1299,518,92,67],
 'bench-05':[768,818,179,87], 'bench-06':[768,818,179,87],
 'plaza-bench-west':[768,818,179,87], 'plaza-bench-east':[768,818,179,87],
};
// Reuse the four approved Home drawings verbatim. Home's placements.js uses
// .18 for front/back and .28 for the narrower side drawings, without rotation.
export const HOME_BENCH_ART={front:'street--bench-wood',back:'street--bench-wood-back',left:'street--bench-wood-left',right:'street--bench-wood-right'};
export const HOME_BENCH_SCALE={front:.18,back:.18,left:.28,right:.28};
export const BENCH_LOOKS={'bench-01':'right','bench-02':'left','bench-03':'right','bench-04':'left','bench-05':'front','bench-06':'front','plaza-bench-west':'right','plaza-bench-east':'left'};
export function homeBench(id,at,look){
 const scale=HOME_BENCH_SCALE[look],side=look==='left'||look==='right';
 const [x,y]=at;
 const footprint={name:id,x,y:y-(side?30:10),rx:side?30:70,ry:side?62:24};
 return {id,name:'Bench',asset:'bench-wood-'+look,src:'/pixi-art/detail/'+HOME_BENCH_ART[look]+'.svg',x,y,width:818,height:463,scale,anchor:{x:.5,y:451/463},resolution:side?1.4:.9,seat:true,wind:false,shadow:true,shadowSize:side?[30,9]:[53,8],shadowOffset:side?[-1.8,-.9]:[-3.18,-.8],look,footprint,footprints:[footprint]};
}
// Actual drawn leg endpoints, relative to Home's foot anchor, in world units.
export function benchFeet(p){
 const feet={front:[[120.5,451],[696.5,451],[134,229],[677,229]],back:[[120.5,451],[696.5,451],[122,350],[690,350]],left:[[310,451],[496,451],[491,155],[491,394]],right:[[508,451],[322,451],[327,155],[327,394]]};
 return feet[p.look].map(([x,y])=>[round(p.x+(x-409)*p.scale),round(p.y+(y-451)*p.scale)]);
}
// Values are world-space radii and offsets, as consumed by loadThemeArt.
// SVGs here contain no baked ground shadow. Existing building fits stay intact.
export function fitContact(p){
 const w=p.width*(p.scale??1),h=p.height*(p.scale??1),src=p.src??'';
 let size,offset;
 if(/balloon-kiosk/.test(src)){size=[w*58/224,h*9/224];offset=[0,-h*4/224];}
 else if(/lamp/.test(src)){size=[w*.23,w*.075];offset=[0,-h*.028];}
 else if(/tea-table/.test(src)){size=[w*.25,h*.055];offset=[0,-h*17/250];}
 else if(/flour-crates/.test(src)){size=[w*.37,h*.075];offset=[-w*.045,-h*32/210];}
 else if(/placed-ac2-carousel/.test(src)){size=[w*.43,h*.085];offset=[0,-h*.055];}
 else if(/placed-ac2-swing-ride/.test(src)){size=[w*.16,h*.035];offset=[0,-h*.11];}
 else if(/placed-ac2-teacup-ride/.test(src)){size=[w*.44,h*.075];offset=[0,-h*.06];}
 else if(/placed-ac2-ferris-wheel/.test(src)){size=[w*.32,h*.035];offset=[0,-h*.035];}
 if(size){p.shadow=true;p.shadowSize=size.map(round);p.shadowOffset=offset.map(round);}
 return p;
}
export function placeBench(o,at){
 return {...homeBench('ac2-'+o.id,at,BENCH_LOOKS[o.id]),court:BENCH_COURTS[o.id]};
}
