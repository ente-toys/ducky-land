// Locked Fair 5: generated/traced teapot and teacups, separate walkable ring and sorted front pieces.
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const D='public/pixi-art/themes/fair/centre/';
const ink='#39472D', cream='#FFF0C7', gold='#E9C16A';
const pieces=[],blocked=[];
const p=(x,y)=>`${x.toFixed(1)} ${y.toFixed(1)}`;
const ellipse=(x,y,rx,ry,fill,stroke=ink,sw=2.6)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
function save(id,body,box,layer,sortY,extra={}){
 const [x,y,width,height]=box;
 writeFileSync(D+id+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.join(' ')}" stroke-linecap="round" stroke-linejoin="round"><title>Waddlewish Fair ${id}</title>${body}</svg>`);
 pieces.push({id,file:id+'.svg',layer,x,y,width,height,anchor:{x:0,y:0},at:[x,y],...(sortY==null?{}:{sortY}),...extra});
}
// Pavement sits on the existing large plaza. The sunken pink floor stays walkable.
let floor=ellipse(0,0,680,405,cream,gold,3)+ellipse(0,12,554,336,'#E5B867')+ellipse(0,28,519,298,'#F4B6AD');
for(let a=0;a<Math.PI*2;a+=Math.PI/12){const x=Math.cos(a),y=Math.sin(a);floor+=`<path d="M${p(x*563,y*340)} L${p(x*675,y*402)}" fill="none" stroke="${gold}" stroke-width="2.2"/>`;}
floor+=ellipse(0,28,490,280,'none','#F8D1B9',2);
save('floor',floor,[-685,-410,1370,825],'decal');
// Back retaining wall, then two front wings. Gates are deliberately open west/east/south.
const arc=(rx,ry,a,b,dy=0)=>Array.from({length:25},(_,i)=>{const t=a+(b-a)*i/24;return [rx*Math.cos(t),ry*Math.sin(t)+dy]});
const walls=[['back',Math.PI+.12,2*Math.PI-.12,-255],['front-right',.18,1.20,320],['front-left',1.94,Math.PI-.18,320]];
for(const [id,a,b,sy] of walls){
 const outer=arc(554,336,a,b,-32),lower=arc(554,336,a,b,24),inner=arc(520,304,a,b,-28);
 let s=`<path d="M${outer.map(q=>p(...q)).join(' L')} L${lower.reverse().map(q=>p(...q)).join(' L')} Z" fill="#E8CD89" stroke="${ink}" stroke-width="2.6"/>`;
 s+=`<path d="M${outer.map(q=>p(...q)).join(' L')} L${inner.reverse().map(q=>p(...q)).join(' L')} Z" fill="${cream}" stroke="${ink}" stroke-width="2.6"/>`;
 for(let t=a+.12;t<b;t+=.20){const x=547*Math.cos(t),y=331*Math.sin(t);s+=`<path d="M${p(x,y-27)} v46" stroke="#C5A56C" stroke-width="1.8"/>`;}
 save(id,s,[-565,-375,1130,750],id==='back'?'back':'front',sy);
 const outerFoot=arc(558,340,a,b),innerFoot=arc(516,300,a,b).reverse();blocked.push({name:id+' retaining wall',poly:[...outerFoot,...innerFoot]});
}
// Three broad cream stair entrances.
let steps='';
for(const [x,y,w,h] of [[0,316,330,72],[-534,0,92,160],[534,0,92,160]]){
 steps+=`<rect x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="7" fill="${cream}" stroke="${gold}" stroke-width="2.6"/>`;
 for(let i=1;i<4;i++)steps+= x===0?`<path d="M${x-w/2} ${y-h/2+h*i/4} h${w}" stroke="${gold}" stroke-width="2.6"/>`:`<path d="M${x-w/2+w*i/4} ${y-h/2} v${h}" stroke="${gold}" stroke-width="2.6"/>`;
}
save('stairs',steps,[-590,-90,1180,455],'decal');
// The generated teapot, at its natural size, sorted at its plinth front edge.
const size=f=>{const s=readFileSync(D+f,'utf8');return [+s.match(/width="([\d.]+)"/)[1],+s.match(/height="([\d.]+)"/)[1]]};
const [tw,th]=size('teapot.svg');
pieces.push({id:'teapot',file:'teapot.svg',layer:'sorted',x:-tw/2,y:-th-8,width:tw,height:th,anchor:{x:.5,y:1},at:[0,-8],sortY:-8});
blocked.push({name:'teapot plinth',ellipse:{x:0,y:-39,rx:126,ry:66}});
// Cup colours reuse the same generated drawing, preserving its ink and cream.
const pink=readFileSync(D+'cup-pink.svg','utf8');
const colours=[...new Set(pink.match(/#[A-Fa-f0-9]{6}/g))];
for(const [name,target] of [['blue',[93,185,208]],['yellow',[248,197,64]]]){
 let svg=pink;for(const c of colours){const rgb=c.slice(1).match(/../g).map(v=>parseInt(v,16));if(rgb[0]>rgb[1]*1.15&&rgb[1]>55&&rgb[2]>rgb[1]*.75&&rgb[2]<rgb[0]*.95){const delta=(rgb[0]-225)*.5;const next='#'+target.map(v=>Math.round(Math.min(255,Math.max(0,v+delta))).toString(16).padStart(2,'0')).join('');svg=svg.replaceAll(c,next);}}
 writeFileSync(D+'cup-'+name+'.svg',svg);
}
const [cw,ch]=size('cup-pink.svg');
for(const [i,[x,y,c]] of [[-300,-145,'pink'],[305,-145,'blue'],[-390,95,'yellow'],[390,95,'yellow'],[-215,235,'blue'],[215,235,'pink']].entries()){
 pieces.push({id:'cup-'+(i+1),file:'cup-'+c+'.svg',layer:'sorted',x:x-cw/2,y:y-ch,width:cw,height:ch,anchor:{x:.5,y:1},at:[x,y],sortY:y});
 blocked.push({name:'teacup ride '+(i+1),ellipse:{x,y:y-20,rx:78,ry:42}});
}
// Basin is offset left of the pot, directly under its spout. Water remains a separate animated piece.
let basin=ellipse(-260,-28,116,64,'#DFB362')+ellipse(-260,-41,116,64,cream)+ellipse(-260,-42,96,48,'#78C9D9')+ellipse(-267,-48,72,31,'#A4E6E7','none');
save('basin',basin,[-380,-110,240,151],'sorted',34);
blocked.push({name:'receiving basin',ellipse:{x:-260,y:-35,rx:113,ry:63}});
const stream='M-170 -276 C-217 -282 -265 -218 -263 -76';
save('water',`<path d="${stream}" fill="none" stroke="${ink}" stroke-width="17"/><path d="${stream}" fill="none" stroke="#84DCE5" stroke-width="12"/><path d="${stream}" fill="none" stroke="#FFF8D8" stroke-width="3" stroke-dasharray="12 19"/>${ellipse(-262,-72,30,10,'none','#FFF8D8',3)}`,[-290,-300,140,252],'anim',36,{animate:{kind:'pour',duration:1.3,source:[-170,-276],control1:[-217,-282],control2:[-265,-218],landing:[-263,-76],reducedMotion:'static stream'}});
// Egg lamps at the six ends of the low walls, individual depth-sorted sprites.
for(const [i,[x,y]] of [[-495,-155],[495,-155],[-480,180],[480,180],[-195,325],[195,325]].entries()){
 const body=`<rect x="${x-18}" y="${y-64}" width="36" height="68" rx="8" fill="#F39E96" stroke="${ink}" stroke-width="2.6"/>${ellipse(x,y-60,24,10,gold)}<path d="M${x-16} ${y-86} C${x-16} ${y-119} ${x+16} ${y-119} ${x+16} ${y-86} Q${x+16} ${y-68} ${x} ${y-68} Q${x-16} ${y-68} ${x-16} ${y-86} Z" fill="#FFF2B2" stroke="${ink}" stroke-width="2.6"/>${ellipse(x-5,y-92,5,8,'#FFFBE9','none')}${ellipse(x+6,y-80,5,6,'#F6D057','none')}`;
 save('egg-post-'+i,body,[x-28,y-116,56,124],'sorted',y>0?370:y+8);blocked.push({name:'egg post '+i,ellipse:{x,y,rx:22,ry:17}});
}
copyFileSync('public/pixi-art/themes/fair/tulip-planter.svg',D+'flowers.svg');
for(const [i,[x,y]] of [[-290,-295],[290,-295],[-345,305],[345,305]].entries()){
 pieces.push({id:'flowers-'+i,file:'flowers.svg',layer:'sorted',x:x-95,y:y-133,width:190,height:133,anchor:{x:.5,y:1},at:[x,y],sortY:y>0?355:y});
 blocked.push({name:'flower bed '+i,ellipse:{x,y:y-15,rx:80,ry:30}});
}
const data={theme:'fair',name:'Waddlewish teapot garden',concept:'concepts/themes/next-centres/fair-centre-5.png',origin:'centre of sunken ride ring',placement:{x:3570,y:2737.5,scale:1},depthRatio:0.61,pieces,outerEdge:{x:0,y:0,rx:680,ry:405},walkable:[{ellipse:{x:0,y:0,rx:670,ry:395}}],blocked,stairs:[{x:0,y:316,w:330,h:72},{x:-534,y:0,w:92,h:160},{x:534,y:0,w:92,h:160}],spawn:[0,450]};
writeFileSync(D+'centre.json',JSON.stringify(data,null,2)+'\n');
console.log('fair centre:',pieces.length,'pieces;',blocked.length,'footprints');
