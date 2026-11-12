import {readFileSync,writeFileSync} from 'node:fs';
import {geometry} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/candy/',D='assets/world/themes/candy/';
const world=JSON.parse(readFileSync(D+'world.json')),art=JSON.parse(readFileSync(A+'art.json')),walk=JSON.parse(readFileSync(D+'walk-world.json'));
const land=geometry({...walk,obstacles:[]});
let props=JSON.parse(readFileSync(D+'placements.json'));
let body='';let i=0;
for(const [id,z] of Object.entries(world.zones)){
 if(!/^activity-/.test(id)||!z.rx)continue;
 const {x,y,rx,ry}=z;
 body+=`<defs><clipPath id="rim${i}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/></clipPath></defs>`;
 if(z.kind==='paved'){
 body+=`<ellipse cx="${x}" cy="${y}" rx="${rx-10}" ry="${ry-10}" fill="#FFF1CE" stroke="#D4B079" stroke-width="5"/>`;
 for(const r of [.94,.81,.60,.36])body+=`<ellipse cx="${x}" cy="${y}" rx="${rx*r}" ry="${ry*r}" fill="none" stroke="${r===.81?'#F0A5B8':'#D9BD8D'}" stroke-width="${r===.81?14:3}"/>`;
 for(let j=0;j<32;j++){const a=j*Math.PI/16;body+=`<path d="M${x+Math.cos(a)*rx*.81} ${y+Math.sin(a)*ry*.81} L${x+Math.cos(a)*rx*.94} ${y+Math.sin(a)*ry*.94}" stroke="#C89674" stroke-width="3"/>`;}
 for(let yy=y-ry;yy<y+ry;yy+=59)for(let xx=x-rx;xx<x+rx;xx+=83)body+=`<path d="M${xx} ${yy} h83 l23 59 h-83 Z" fill="none" stroke="#E6CCA2" stroke-width="2" clip-path="url(#rim${i})"/>`;
 }else{
 body+=`<ellipse cx="${x}" cy="${y}" rx="${rx+8}" ry="${ry+8}" fill="none" stroke="#7DAB3A" stroke-width="8"/><ellipse cx="${x}" cy="${y}" rx="${rx-7}" ry="${ry-7}" fill="none" stroke="#C9DC79" stroke-width="7"/>`;
 }
 i++;
}
art.flats=art.flats.filter(p=>!p.src.startsWith('activity-inlay'));
for(const [id,z]of Object.entries(world.zones).filter(([id])=>/^activity-/.test(id))){
 const x=z.x-z.rx-20,y=z.y-z.ry-20,w=z.rx*2+40,h=z.ry*2+40,src='activity-inlay-'+id+'.svg';
 writeFileSync(A+src,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${body}</svg>`);
 art.flats.push({src,x,y,width:w,height:h,topLeft:true});
}
const benches=props.filter(p=>p.asset==='arc-bench');
const box=p=>({l:p.x-p.width*p.scale*p.anchor.x,r:p.x+p.width*p.scale*(1-p.anchor.x),t:p.y-p.height*p.scale*p.anchor.y,b:p.y+p.height*p.scale*(1-p.anchor.y)});
props=props.filter(p=>!/^(stall-|bakery-kiosk)/.test(p.asset)||!benches.some(b=>{const a=box(p),q=box(b);return a.l<q.r+18&&a.r>q.l-18&&a.t<q.b+12&&a.b>q.t-12}));
props=props.filter(p=>p.zone!=='islets'||!/^tree-|bouquets/.test(p.asset));
for(const [i,[cx,cy]]of world.islets.entries())props.push({id:'candy-scoop-'+i,name:i?'Pistachio scoop monument':'Strawberry scoop monument',asset:'scoop-monument',src:'scoop-'+(i?'pistachio':'strawberry')+'.svg',x:cx,y:cy+35,width:360,height:300,anchor:{x:.5,y:.88},scale:1,flip:false,zone:'islets',footprint:{x:cx,y:cy+15,rx:145,ry:46}});
world.zones.islets.spawn=[world.islets[0][0]-255,world.islets[0][1]+5];
props=props.filter(p=>/lily|reeds|cattails/.test(p.asset)||land.walkable(p.x,p.y-4));
const inside=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c};
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const pathGap=(x,y)=>Math.min(...world.paths.map((p,i)=>Math.min(...p.slice(1).map((b,j)=>seg(x,y,p[j],b)))-([0,1,7,8,13].includes(i)?110:93)));
const reserved=(x,y,pad=0)=>Object.entries(world.zones).some(([id,z])=>/^(activity|stalls)-/.test(id)&&(z.poly?inside(x,y,z.poly)||z.line.some(q=>Math.hypot(x-q[0],y-q[1])<100+pad):((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1));
let seed=112611;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const lolly=props.find(p=>p.asset==='lollipop-tree'),gum=props.find(p=>p.asset==='gumdrop-planter');
for(let n=0,tries=0;n<20&&tries<20000;tries++){
 const x=750+rnd()*5700,y=780+rnd()*3020;
 if(!land.walkable(x,y)||reserved(x,y,100)||pathGap(x,y)<190||((x-3570)/1100)**2+((y-2450)/1100)**2<1||walk.walkways.some(w=>seg(x,y,w.a,w.b)<250))continue;
 if(props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.6)<Math.min(150,p.width*p.scale*.45)+115))continue;
 const t=n%3===0?gum:lolly;
 props.push({...t,id:'candy-sweet-grove-'+n,x:Math.round(x),y:Math.round(y),zone:'sweet-grove',scale:t.scale*(n%3===0?.9:1.25)});n++;
}
for(const [id,z]of Object.entries(world.zones).filter(([id])=>/^activity-/.test(id)))for(let j=0;j<12;j++){
 const a=j*Math.PI/6,x=z.x+Math.cos(a)*(z.rx+94),y=z.y+Math.sin(a)*(z.ry+70);
 if(!land.walkable(x,y)||reserved(x,y,28)||pathGap(x,y)<75||props.some(p=>Math.hypot(x-p.x,(y-p.y)*1.6)<130))continue;
 const t=j%3===0?props.find(p=>p.asset==='candy-lamp'):j%3===1?gum:props.find(p=>p.asset==='flower-2');
 props.push({...t,id:'candy-edge-'+id+'-'+j,x,y,zone:id,scale:t.scale*(j%3===0?1:.8)});
}
const q=world.water[0],left=q.x-q.rx-75,right=q.x+q.rx+75,len=right-left,by=q.y+5;
let deck=`<path d="M0 91 Q${len/2} -65 ${len} 91 L${len} 165 Q${len/2} 9 0 165Z" fill="#B9783E" stroke="#39472D" stroke-width="4"/><path d="M0 90 Q${len/2} -66 ${len} 90 L${len} 136 Q${len/2} -20 0 136Z" fill="#E4B56C" stroke="#39472D" stroke-width="3"/>`;
for(let x=0;x<=len;x+=34){let t=x/len,curve=-156*t*(1-t);deck+=`<path d="M${x} ${90+curve} v46" stroke="#9B693A" stroke-width="3"/>`;}
let front='';for(let x=0;x<=len;x+=85){let t=x/len,curve=-156*t*(1-t);deck+=`<path d="M${x} ${90+curve} v-66" stroke="#39472D" stroke-width="9"/><path d="M${x} ${90+curve} v-66" stroke="#D9954F" stroke-width="5"/>`;front+=`<path d="M${x} ${135+curve} v-66" stroke="#39472D" stroke-width="9"/><path d="M${x} ${135+curve} v-66" stroke="#D9954F" stroke-width="5"/>`;}
deck+=`<path d="M0 24 Q${len/2} -132 ${len} 24" fill="none" stroke="#39472D" stroke-width="12"/><path d="M0 24 Q${len/2} -132 ${len} 24" fill="none" stroke="#F1CC8B" stroke-width="7"/>`;
front+=`<path d="M0 69 Q${len/2} -87 ${len} 69" fill="none" stroke="#39472D" stroke-width="12"/><path d="M0 69 Q${len/2} -87 ${len} 69" fill="none" stroke="#F1CC8B" stroke-width="7"/>`;
for(const [n,b]of [['pond-deck',deck],['pond-front',front]])writeFileSync(A+n+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${len+20}" height="240" viewBox="-10 -75 ${len+20} 240" stroke-linejoin="round" stroke-linecap="round"><title>Candy Coast arched pond bridge ${n}</title>${b}</svg>`);
art.decks.push({src:'pond-deck.svg',x:left-10,y:by-170,width:len+20,height:240});
props.push({id:'candy-pond-front',name:'Wafer pond bridge front railing',asset:'bridge-front',src:'pond-front.svg',x:q.x,y:by+42,width:len+20,height:240,anchor:{x:.5,y:212/240},scale:1,flip:false,shadow:false,zone:'pond-garden',wind:false});
world.bridges.push({x:q.x,y:by,w:len,h:100});walk.bridges.push({x:q.x,y:by,w:len,h:100});
world.arches.push({a:[left,by],b:[right,by],r:39,w:100});
world.paths.push([[left-60,by],[right+60,by]]);
writeFileSync(D+'world.json',JSON.stringify(world));writeFileSync(D+'walk-world.json',JSON.stringify(walk));
writeFileSync(A+'art.json',JSON.stringify(art));writeFileSync(D+'placements.json',JSON.stringify(props));
