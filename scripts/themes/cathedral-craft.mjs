// Cathedral-only geometry, using HOME's exact curved slat/backrest drawing.
import {writeFileSync} from 'node:fs';
import {drawArcBench} from '../arc-bench-draw.mjs';
const ART='public/pixi-art/themes/cathedral/';
const f=n=>Math.round(n*10)/10;
const poly=p=>'M'+p.map(q=>q.map(f).join(' ')).join('L')+'Z';
export function arcGeometry(z,deg,span=22,offset=85){
 const radius=z.rx+offset,k=z.ry/z.rx;
 const ground=(a,s)=>[z.x+Math.cos(a*Math.PI/180)*s,z.y+Math.sin(a*Math.PI/180)*s*k];
 const cfg={ground,sIn:radius-21,sOut:radius+19,back:radius+23,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5};
 const b={deg,span};const pts=(s)=>Array.from({length:17},(_,i)=>ground(deg-span/2+span*i/16,s));
 return {b,cfg,ground,footprint:[...pts(radius-25),...pts(radius+27).reverse()],radius};
}
export function addArc(z,deg,id,props,obstacles,{span=22,offset=85}={}){
 const {b,cfg,ground,footprint,radius}=arcGeometry(z,deg,span,offset);
 const xx=footprint.map(p=>p[0]),yy=footprint.map(p=>p[1]),x0=Math.floor(Math.min(...xx))-6,y0=Math.floor(Math.min(...yy))-54;
 const w=Math.ceil(Math.max(...xx))-x0+6,h=Math.ceil(Math.max(...yy))-y0+6;
 const [x,y]=ground(deg,radius),src=`detail/arc-${id}.svg`;
 writeFileSync(ART+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"><title>Bellovo ${id}, slatted bench following its own paving ellipse</title><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,cfg).join('')}</g></svg>`);
 props.push({id:'arc-'+id,name:'Curved olivewood bench',src,x:f(x),y:f(y),width:w,height:h,scale:1,anchor:{x:(x-x0)/w,y:(y-y0)/h},shadow:false,wind:false});
 obstacles.push({name:'arc-'+id,poly:footprint.map(p=>p.map(f))});
 return {id,centre:[z.x,z.y],radius,k:z.ry/z.rx,deg,span};
}
export function ring(z,inner,outer,{steps=64,color='#E8D29D',edge='#A58C5B'}={}){
 const k=z.ry/z.rx,point=(a,r)=>[z.x+Math.cos(a)*r,z.y+Math.sin(a)*r*k];let s='';
 for(let i=0;i<steps;i++){const a=i*2*Math.PI/steps,b=(i+1)*2*Math.PI/steps;const p=[];for(let j=0;j<=3;j++)p.push(point(a+(b-a)*j/3,inner));for(let j=3;j>=0;j--)p.push(point(a+(b-a)*j/3,outer));s+=`<path d="${poly(p)}" fill="${i%5===0?'#DDBB7F':i%3===0?'#F5E6B8':color}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>`;}
 return s;
}
export function roseFloor(){
 const z={x:4100,y:2680,rx:1,ry:.766};let s=ring(z,184,204,{steps:48})+ring(z,432,460,{steps:64})+ring(z,544,600,{steps:80});
 // Eight olive/terracotta compass petals echo the cathedral rose window. Flat stone inlay only.
 const p=(a,r)=>[z.x+Math.cos(a)*r,z.y+Math.sin(a)*r*.766];
 for(let i=0;i<8;i++){const a=i*Math.PI/4,pts=[p(a,215),p(a-.13,315),p(a,420),p(a+.13,315)];s+=`<path d="${poly(pts)}" fill="${i%2?'#D8C088':'#A4B46A'}" stroke="#9C9863" stroke-width="2"/>`;}
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="1040" viewBox="3450 2160 1300 1040"><title>Olive cloister rose-window stone inlay</title>${s}</svg>`;
}
