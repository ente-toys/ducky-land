// PACKAGE buildings. Re-runnable, surgical patch: never rebuild paths/trees/centre.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {VILLAGES} from './villages-data.mjs';
import {roofProfile,frontGable,villageDetails} from './round2-buildings.mjs';
import {BUILDING_STYLES} from './buildings-data.mjs';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
const ink='#39472d',cream='#fff0cd',stone='#dbbd85',olive='#839953',deepOlive='#667e42',glass='#a5d3d2',wood='#b98955';
const n=v=>+v.toFixed(2);
const path=(d,fill='none',stroke=ink,w=1.9,attrs='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${attrs}/>`;
const rect=(x,y,w,h,fill,rx=0,stroke=ink,sw=1.9)=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const oval=(x,y,rx,ry,fill,stroke=ink,sw=1.9,attrs='')=>`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${attrs}/>`;
function badge(type,x,y){
 if(type==='bell')return path(`M${x-10} ${y+6}Q${x-6} ${y+3} ${x-6} ${y-5}Q${x} ${y-15} ${x+6} ${y-5}Q${x+6} ${y+3} ${x+10} ${y+6}Z`,'#d5ad58')+oval(x,y+9,2,2,ink,'none');
 if(type==='olive')return path(`M${x-10} ${y+7}Q${x} ${y+1} ${x+10} ${y-10}`, 'none',deepOlive,2.4)+oval(x-4,y-3,7,3.4,olive)+oval(x+5,y+4,6,3,olive)+oval(x,y+4,3,4,deepOlive);
 if(type==='diamond')return path(`M${x} ${y-12}L${x+12} ${y}L${x} ${y+12}L${x-12} ${y}Z`,'#c78055')+path(`M${x} ${y-7}L${x+7} ${y}L${x} ${y+7}L${x-7} ${y}Z`,glass,ink,1.2);
 if(type==='shell')return path(`M${x-12} ${y+2}Q${x-17} ${y-11} ${x-8} ${y-9}Q${x-2} ${y-16} ${x+2} ${y-9}Q${x+14} ${y-12} ${x+12} ${y+1}L${x+3} ${y+10}H${x-3}Z`,'#f1cf8d')+path(`M${x} ${y+7}V${y-7}M${x-2} ${y+6}L${x-8} ${y-5}M${x+2} ${y+6}L${x+8} ${y-5}`,'none','#ae8351',1);
 return oval(x,y,12,12,cream)+oval(x,y,7,7,glass)+path(`M${x-7} ${y}H${x+7}M${x} ${y-7}V${y+7}`,'none',ink,1.2);
}
function windowAt(x,y,kind='pair',style={}){
 const w=kind==='wide'?46:32,h=kind==='wide'?36:44;
 let s=kind==='arch'?path(`M${x-w/2} ${y+h}V${y+12}Q${x} ${y-12} ${x+w/2} ${y+12}V${y+h}Z`,glass):rect(x-w/2,y,w,h,glass,2);
 s+=path(`M${x} ${y+2}V${y+h}M${x-w/2} ${y+h*.57}H${x+w/2}`,'none',ink,1.3);
 for(const side of [-1,1]){const X=side<0?x-w/2-17:x+w/2+3;s+=rect(X,y+2,14,h-2,olive,2);if(style.village==='tessera')s+=path(`M${X+7} ${y+12}l4 7 -4 7 -4 -7Z`,glass,ink,1.2);
  else if(style.village==='olivello')s+=path(`M${X+7} ${y+4}v${h-9}M${X+2} ${y+10}h10M${X+2} ${y+h-8}h10`,'none',deepOlive,1.3);
  else if(style.village==='bellpeep')s+=path(`M${X+3} ${y+8}h8M${X+3} ${y+h-7}h8M${X+7} ${y+4}v${h-9}`,'none',deepOlive,1.5);
  else for(let i=8;i<h-3;i+=7)s+=path(`M${X+3} ${y+i}h8`,'none',deepOlive,1.2);}
 s+=rect(x-w/2-4,y+h,w+8,5,stone,1);
 return s;
}
function door(x,b,work){
 const w=work?68:60,h=92,y=b-h;
 let s=path(`M${x-w/2-6} ${b}V${y+18}Q${x} ${y-23} ${x+w/2+6} ${y+18}V${b}Z`,cream);
 s+=path(`M${x-w/2} ${b}V${y+18}Q${x} ${y-12} ${x+w/2} ${y+18}V${b}Z`,wood);
 s+=path(`M${x-14} ${y+15}V${b-3}M${x+5} ${y+11}V${b-3}M${x+22} ${y+22}V${b-3}`,'none','#986e43',1.1);
 s+=oval(x+17,b-36,3,3,'#dfbd66');
 // The bottom edge is the shared path door anchor, never a raised slab.
 s+=rect(x-w/2-9,b,w+18,8,'#eed6a0',2);
 return `<g data-door-width="${w}" data-door-height="${h}" data-threshold-y="${b+8}">${s}</g>`;
}
function craft(type,x,y){
 if(type==='olive'){
  let b=rect(x-37,y-69,74,62,wood,5)+oval(x,y-68,37,10,'#cfa76b');
  b+=path(`M${x-36} ${y-51}q36 15 72 0M${x-36} ${y-20}q36 15 72 0`,'none',ink,4);
  for(let i=-24;i<31;i+=12)b+=path(`M${x+i} ${y-61}v47`,'none','#926b42',1.1);
  b+=rect(x-49,y-102,98,10,wood,2)+rect(x-44,y-92,7,87,wood,1)+rect(x+37,y-92,7,87,wood,1)+rect(x-5,y-137,10,70,wood,2);
  for(let j=0;j<8;j++)b+=path(`M${x-5} ${y-131+j*7}l10 -3`,'none',ink,1);
  return b+oval(x,y-65,24,5,stone)+rect(x-49,y-7,98,8,wood,1);
 }
 if(type==='bell')return rect(x-37,y-12,74,10,stone,2)+rect(x-32,y-98,6,86,wood,1)+rect(x+26,y-98,6,86,wood,1)+rect(x-39,y-102,78,8,wood,1)+path(`M${x} ${y-94}v13`)+path(`M${x-25} ${y-35}Q${x-17} ${y-41} ${x-17} ${y-62}Q${x} ${y-86} ${x+17} ${y-62}Q${x+17} ${y-41} ${x+25} ${y-35}Z`,'#d2a35c')+oval(x,y-30,5,4,'#a87340');
 if(type==='tile'){
  let b=rect(x-44,y-59,88,12,wood,2)+rect(x-37,y-47,7,43,wood,1)+rect(x+30,y-47,7,43,wood,1);
  for(const [i,c]of ['#c78055','#91a467','#f3d58e'].entries())b+=path(`M${x-36+i*25} ${y-62}v-26h22v26Z`,c)+path(`M${x-25+i*25} ${y-84}l7 10 -7 9 -7 -9Z`,cream,ink,1);
  return b;
 }
 return path(`M${x-46} ${y-9}V${y-61}Q${x} ${y-108} ${x+46} ${y-61}V${y-9}Z`,stone)+path(`M${x-33} ${y-12}V${y-55}Q${x} ${y-85} ${x+33} ${y-55}V${y-12}Z`,'#7a6846')+oval(x,y-22,23,9,'#e0af60')+path(`M${x-13} ${y-26}l3 6M${x} ${y-29}l3 7M${x+12} ${y-26}l3 6`,'none','#9c713e',1.5);
}
export function buildingSVG(id,W,H,s){
 const work=!!s.work,c=W/2,b=H-24,L=work?28:29,R=W-(work?58:53),side=27,wallTop=H-(work?173:169),peak=work?48:39,roofEnd=wallTop+10;
 let body=oval(W/2,H-21,W*.414,8,ink,'none',0,'opacity=".16" data-contact-shadow="true"');
 if(s.chimney){const X=s.chimney==='left'?W*.23:W*.73;body+=rect(X,peak-13,22,roofEnd-peak+13,s.wall,1)+path(`M${X+22} ${peak-13}l8 -5v${roofEnd-peak+13}l-8 5Z`,stone)+rect(X-4,peak-19,34,10,cream,2)+path(`M${X+3} ${peak-15}h19`,'none',ink,2);}
 if(s.chimney){const X=s.chimney==='left'?W*.23:W*.73;
  if(s.village==='bellpeep')body+=rect(X+2,peak-27,7,9,stone,1)+rect(X+14,peak-27,7,9,stone,1)+path(`M${X+1} ${peak+3}h21`,'none',s.roofColor,5);
  if(s.village==='olivello')body+=path(`M${X-4} ${peak-19}l17 -10 21 10Z`,s.roofColor);
  if(s.village==='tessera')body+=path(`M${X+11} ${peak-12}l6 6 -6 6 -6 -6Z`,glass,ink,1);
  if(s.village==='crumbbell')body+=rect(X+3,peak-27,16,9,s.roofColor,1)+path(`M${X+2} ${peak-3}h19m-10 0v8`,'none',s.roofColor,2);
 }
 // The right return is drawn explicitly. Every wall edge remains upright.
 body+=path(`M${R} ${wallTop}L${R+side} ${wallTop-20}V${b-21}L${R} ${b}Z`,'#dfc48f');
 body+=rect(L,wallTop,R-L,b-wallTop,s.wall,2);
 body+=path(`M${L+1} ${b-9}H${R-1}V${b}H${L+1}Z`,'#ecd29b','none');
 body+=path(`M${R+8} ${wallTop+28}l13 -8v30l-13 8Z`,glass,ink,1.3);
 body+=path(`M${R+14} ${wallTop+24}v30`,'none',ink,1.1);

 const front=frontGable(s.roof,{L,R,c,peak,roofEnd});if(front)body+=path(front,s.wall);
 const roof=roofProfile(s.roof,{L,R,c,side,peak,roofEnd});
 body+=`<g data-roof-plane="${s.roof}">${path(roof,s.roofColor)}`;
 if(s.roof==='gable'){
  body+=path(`M${L-11} ${roofEnd+3}L${c} ${peak+18}L${R+7} ${roofEnd-2}L${R+2} ${roofEnd+7}L${c} ${peak+31}L${L-8} ${roofEnd+12}Z`,cream);
  body+=path(`M${L+8} ${roofEnd-7}L${c} ${peak+43}L${R-7} ${roofEnd-6}Z`,s.wall);
  body+=path(`M${c} ${peak+24}L${c+side} ${peak}L${R+side+13} ${roofEnd-24}`,'none','#e5a573',1.3);
  for(const t of [.2,.4,.6,.8,.95]){const X=c+(R+7-c)*t,Y=peak+24+(roofEnd+1-peak-24)*t,xx=c+side+(R+13-c)*t,yy=peak+(roofEnd-24-peak)*t;body+=path(`M${n(X)} ${n(Y)}L${n(xx)} ${n(yy)}`,'none','#965b3e',1);}
 }else{
  // Sparse tile rows, kept in their own roof plane rather than a texture grid.
  body+=`<defs><clipPath id="${id}-roof">${path(roof,'#fff','none')}</clipPath></defs><g clip-path="url(#${id}-roof)">`;
  for(let row=0;row<3;row++){const yy=peak+42+row*23,xx=L+25-row*10,ww=R-xx+row*7;body+=path(`M${xx} ${yy}Q${c} ${yy-4} ${xx+ww} ${yy}`,'none','#975e40',1.2);for(let j=0;j<6;j++){const X=xx+8+j*(ww-12)/6;body+=path(`M${n(X)} ${yy}q4 6 3 15`,'none','#975e40',.9);}}
  body+='</g>';
  body+=path(`M${L-11} ${roofEnd+6}Q${c} ${roofEnd+1} ${R+6} ${roofEnd+7}L${R+3} ${roofEnd+14}H${L-8}Z`,cream);
 }
 body+='</g>';
 if(s.loft==='dormer'){
  const yy=peak+42;body+=rect(c-20,yy,40,38,s.wall,1)+path(`M${c-27} ${yy+2}L${c} ${yy-23}L${c+27} ${yy+2}l-4 6 -23 -20 -23 20Z`,s.roofColor)+rect(c-10,yy+8,20,24,glass,1)+path(`M${c} ${yy+8}v24`,'none',ink,1.1);
 }else body+=badge(s.loft,c,s.roof==='gable'?peak+70:peak+67);
 // Doors are centred on the preserved path anchor; workshop machinery has its own bay.
 body+=door(c,b,work);
 if(work){body+=windowAt(c-112,wallTop+38,'arch',s);body+=craft(s.work,c+112,b-10);body+=rect(c-43,wallTop+5,86,22,cream,3)+badge(s.work==='bread'?'shell':s.work==='tile'?'diamond':s.work,c,wallTop+16);}
 else{
  const yy=wallTop+40;body+=windowAt(c-77,yy,s.windows,s)+windowAt(c+70,yy,s.windows==='wide'?'pair':s.windows,s);
  if(s.canopy)body+=path(`M${c-41} ${b-98}L${c-32} ${b-119}H${c+32}L${c+41} ${b-98}Q${c+23} ${b-87} ${c+9} ${b-98}Q${c-7} ${b-87} ${c-20} ${b-98}Q${c-31} ${b-88} ${c-41} ${b-98}Z`,olive);
 }
 body+=villageDetails(s,{L,R,c,b,wallTop,work});
 if(s.tile)for(const X of [L+9,R-16])body+=path(`M${X} ${b-23}l7 -9 7 9 -7 9Z`,glass,ink,1.1);
 if(s.vine){body+=path(`M${L+9} ${b-14}Q${L+21} ${b-62} ${L+11} ${b-112}`,'none',deepOlive,2);for(let j=0;j<4;j++)body+=oval(L+13+(j%2?5:-4),b-34-j*20,7,3,olive,'none');}
 if(s.harbour)body+=path(`M${R+7} ${b-18}q11 4 17 -3M${R+7} ${b-12}q11 4 17 -3`,'none',wood,2);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" stroke-linecap="round" stroke-linejoin="round"><title>${id}, upright Bellovo Home camera</title><g data-camera="home-front-roof-side">${body}</g></svg>\n`;
}
function pavingSVG(v,o){
 const [w,h]=o.size;let b=path(`M72 22Q${w*.5} 10 ${w-76} 24Q${w-28} 27 ${w-25} 74L${w-15} ${h-75}Q${w-12} ${h-26} ${w-71} ${h-23}Q${w*.5} ${h-10} 70 ${h-25}Q24 ${h-27} 24 ${h-74}L30 73Q30 26 72 22Z`,'#F7DC88','none',0);
 for(let row=0;row<4;row++)for(let col=0;col<5;col++){const x=95+col*(w-190)/4+(row%2?26:0),y=80+row*(h-160)/3;if(x<w-80)b+=path(`M${n(x)} ${n(y)}h28`,'none','#e4c36e',3);}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${v.id} flat village paving</title><g data-flat-paving="true" stroke-linecap="round">${b}</g></svg>\n`;
}
export function applyBuildings(art,world,walk){
 const doors=[];
 // The flower inlay lies in the paving. Preserve its drawing, retire its cast shadow.
 const mosaic=fs.readFileSync('scripts/bigger-cathedral/buildings-source/flower-mosaic.svg','utf8')
  .replace(/<ellipse\b[^>]*opacity="0.24"[^>]*\/>/,'');
 fs.writeFileSync(A+'villages/tessera/flower-mosaic.svg',mosaic);
 for(const v of VILLAGES)for(const o of v.pieces){
  const id=v.id+'-'+o.id,style=BUILDING_STYLES[id];
  if(!style){if(/ground|square-floor/.test(o.role))fs.writeFileSync(A+'villages/'+v.id+'/'+o.file,pavingSVG(v,o));continue;}
  const p=art.props.find(p=>p.id===id);if(!p)throw Error('Missing building '+id);
  const [W,H]=o.size,x=v.square[0]+o.offset[0],y=v.square[1]+o.offset[1]+H/2;
  if(p.x!==x||p.y!==y)throw Error('Door anchor moved for '+id);
  p.src=p.src.replace(/(?:-r2)?\.svg$/,'-r2.svg');
  fs.writeFileSync(A+p.src,buildingSVG(id,W,H,style));
  // Canvas extends 56 units below the old art origin. Threshold is exactly y+40.
  Object.assign(p,{anchor:{x:.5,y:1-56/H},rasterMargin:16,shadow:false,flip:false,wind:false,door:[x,y+40]});
  const solid={id,x,y:y-12,rx:W*.365,ry:32};
  for(const m of [world,walk]){const i=m.obstacles.findIndex(q=>q.id===id);if(i<0)throw Error('Missing collision '+id);m.obstacles[i]={...solid};}
  doors.push({id,src:p.src,door:[x,y+40],width:style.work?68:60,height:92});
 }
 // Only replace the corresponding props in world.props, preserve all other packages.
 if(world.props)for(const p of art.props.filter(p=>BUILDING_STYLES[p.id])){const i=world.props.findIndex(q=>q.id===p.id);if(i>=0)world.props[i]={...p};}
 return doors;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
 const doors=applyBuildings(art,world,walk);
 save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
 save('scripts/bigger-cathedral/buildings-doors.json',doors);
 console.log(`Redrew ${doors.length} distinct Bellovo buildings and four flat village courts; door anchors unchanged.`);
}
