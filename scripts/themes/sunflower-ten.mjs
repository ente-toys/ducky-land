import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {drawArcBench} from '../arc-bench-draw.mjs';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const WORK=fileURLToPath(new URL('../../../concepts/themes/work/sunflower/',import.meta.url));
const A='public/pixi-art/themes/sunflower/',D='assets/world/themes/sunflower/';
const read=p=>JSON.parse(readFileSync(p,'utf8')),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,1)+'\n');
const art=read(WORK+'baseline/art.json'),world=read(WORK+'baseline/world.json'),walk=read(WORK+'baseline/walk-world.json');
const harbor=read(D+'harbor.json'),sizes=sleepHalfWidths();
const originalGeo=geometry(makeMap('sunflower',{world,walk,harbor,sleepers:[]}).baseWalk);
const beds=resolveSleepSpots(world,art.props,originalGeo.walkable,sizes,{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const f=v=>Math.round(v*100)/100;
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)};
const edge=(x,y)=>Math.min(...world.paths.flatMap((p,i)=>p.slice(1).map((b,j)=>seg(x,y,p[j],b)-(world.pathWidths[i]/2))));
const zones=Object.entries(world.zones).filter(([k])=>/activity|stalls/.test(k)).map(([,z])=>z);
const zoneAt=(x,y,pad=0)=>zones.some(z=>z.rx?((x-z.x)/(z.rx+pad))**2+((y-z.y)/(z.ry+pad))**2<1:x>z.x0-pad&&x<z.x1+pad&&y>z.y0-pad&&y<z.y1+pad);
const sleepClear=(x,y,r=35)=>beds.every(b=>Math.hypot(b.x-x,(b.y-y)*1.4)>b.r+r+32);
const landingClear=(x,y,r=40)=>world.walkways.every(w=>seg(x,y,w.a,w.b)>w.w/2+r+100);
function removeFoot(p){for(const data of [world,walk])data.obstacles=data.obstacles.filter(o=>!(o.x===p.x&&Math.abs(o.y-p.y)<=32));}
function foot(o){world.obstacles.push(structuredClone(o));walk.obstacles.push(structuredClone(o));}
const oldBenches=art.props.filter(p=>/^bench-(31|32|33|34|35|36|37)$/.test(p.id));
for(const p of oldBenches)removeFoot(p);
art.props=art.props.filter(p=>!oldBenches.includes(p));
const benchRecords=[];
function arc(id,ring,deg,span){
 const {x,y,rx,ry}=ring,k=ry/rx,ground=(a,s)=>[x+Math.cos(a*Math.PI/180)*s,y+Math.sin(a*Math.PI/180)*s*k];
 const b={deg,span},o={ground,sIn:rx-43,sOut:rx-3,back:rx+1,seat:17,top:47,ink:'#39472D',line:2.2,thin:1.5,spindleDeg:3.2*446/rx};
 const points=(r,n=24)=>Array.from({length:n+1},(_,i)=>ground(deg-span/2+span*i/n,r));
 const footprint=[...points(o.sIn-4),...points(o.back+4).reverse()].map(p=>p.map(f));
 const bounds=[...points(o.sIn-4),...points(o.back+4)],xs=bounds.map(p=>p[0]),ys=bounds.map(p=>p[1]);
 const x0=Math.floor(Math.min(...xs))-5,y0=Math.floor(Math.min(...ys)-52),w=Math.ceil(Math.max(...xs)+5-x0),h=Math.ceil(Math.max(...ys)+5-y0);
 const [ax,ay]=ground(deg,(o.sIn+o.sOut)/2);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"><title>Sunbob Fields ${id}, slatted bench following its own ground ellipse</title><g stroke-linecap="round" stroke-linejoin="round">${drawArcBench(b,o).join('\n')}</g></svg>`;
 writeFileSync(A+`detail/${id}.svg`,svg);
 art.props.push({id,name:'Curved wood bench',src:`detail/${id}.svg`,x:f(ax),y:f(ay),width:w,height:h,scale:1,anchor:{x:(ax-x0)/w,y:(ay-y0)/h},shadow:false,wind:false});
 foot({poly:footprint,name:id});benchRecords.push({id,ring,deg,span,footprint});
}
for(const [id,wanted,span]of [['northwest',-128,14],['northeast',-73,12],['east',-33,12],['south',73,8],['west',173,8],['southwest',141,12]]){
 const ring={x:3880,y:2608.5,rx:1063,ry:610};
 const band=deg=>[ring.rx-47,ring.rx+5].flatMap(r=>Array.from({length:17},(_,i)=>{const a=(deg-span/2+i*span/16)*Math.PI/180;return [ring.x+Math.cos(a)*r,ring.y+Math.sin(a)*r*ring.ry/ring.rx]}));
 let chosen=null;
 for(const offset of [0,...Array.from({length:20},(_,i)=>i*3+3).flatMap(d=>[d,-d])]){
  const deg=wanted+offset,pts=band(deg);
  if(pts.some(([x,y])=>edge(x,y)<24||world.obstacles.some(o=>inShape(x,y,o,16))))continue;
  chosen=deg;break;
 }
 if(chosen===null){console.log('Leaving a clear approach instead of crowded seating:',id);continue;}
 console.log('arc',id,chosen);
 arc(`ten-plaza-bench-${id}`,ring,chosen,span);
}
for(const [key,angles]of [['activity-1',[115,20]],['activity-2',[150,55]],['activity-3',[25,145]]]){
 const z=world.zones[key];
 for(const [i,deg]of angles.entries()){
  const ring={x:z.x,y:z.y,rx:z.rx+95,ry:z.ry+75};
  const x=ring.x+Math.cos(deg*Math.PI/180)*ring.rx,y=ring.y+Math.sin(deg*Math.PI/180)*ring.ry;
  if(edge(x,y)<110||!landingClear(x,y,80)||!sleepClear(x,y,100)||!originalGeo.walkable(x,y))continue;
  if(art.props.some(p=>p.name==='Tree'&&p.y>y-10&&p.y-y<p.height*p.scale&&Math.abs(p.x-x)<p.width*p.scale/2+70))continue;
  arc(`ten-${key}-bench-${i}`,ring,deg,22);
 }
}
const trees=art.props.filter(p=>p.name==='Tree');
const canopy=p=>({x:p.x,y:p.y-p.height*p.scale*.66,rx:p.width*p.scale*.44,ry:p.height*p.scale*.25});
const overlaps=(p,q)=>{const a=canopy(p),b=canopy(q);return ((a.x-b.x)/(a.rx+b.rx+8))**2+((a.y-b.y)/(a.ry+b.ry+8))**2<1};
const nodIds=new Set(world.sleepSpots.nod.map(s=>s[0]));
const moved=[];
for(const t of trees){
 if(nodIds.has(t.id)||!trees.some(q=>q!==t&&overlaps(t,q)))continue;
 const old={...t};
 search:for(let r=70;r<=420;r+=35)for(let d=0;d<360;d+=24){
  const x=f(old.x+Math.cos(d*Math.PI/180)*r),y=f(old.y+Math.sin(d*Math.PI/180)*r);
  const c={...t,x,y};
  if(beds.some(b=>y>b.y-20&&y-b.y<t.height*t.scale*.9&&Math.abs(x-b.x)<t.width*t.scale/2+b.r*.6))continue;
  if(!originalGeo.walkable(x,y)||!originalGeo.walkable(x,y-85)||edge(x,y)<180||zoneAt(x,y,180)||!landingClear(x,y,240)||!sleepClear(x,y,300))continue;
  if(((x-3880)/1330)**2+((y-2608.5)/850)**2<1)continue;
  if(art.props.some(q=>q!==t&&(q.name==='Sunflower row'||/barn|windmill/i.test(q.name))&&Math.hypot(x-q.x,(y-q.y)*1.1)<230))continue;
  if(trees.some(q=>q!==t&&overlaps(c,q)))continue;
  removeFoot(t);Object.assign(t,{x,y});foot({x,y:y-9,rx:31,ry:22});moved.push({id:t.id,from:[old.x,old.y],to:[x,y]});break search;
 }
}
let added=0;
const decor=[];
function addCompanion(x,y,kind,scale=1){
 if(!originalGeo.walkable(x,y)||edge(x,y)<75||zoneAt(x,y,30)||!landingClear(x,y)||!sleepClear(x,y,55))return false;
 if(art.props.some(p=>!p.id.startsWith('centre-')&&p.name!=='Tree'&&Math.hypot(x-p.x,(y-p.y)*1.5)<80))return false;
 const dims=kind==='rock'?[600,373]:kind==='flower'?[48,36]:[130,100];
 const s=kind==='rock'?.09*scale:kind==='flower'?1.5*scale:.7*scale;
 const src=kind==='rock'?'reuse/rock-boulder.svg':kind==='flower'?'reuse/flower-1.svg':'reuse/bush-1.svg';
 const id=`ten-underplant-${added++}`,p={id,name:kind==='rock'?'Garden rock':kind==='flower'?'Flowers':'Bush',src,x:f(x),y:f(y),width:dims[0],height:dims[1],scale:s,anchor:{x:.5,y:1},flip:added%2===0};
 art.props.push(p);decor.push(p);
 if(kind!=='flower')foot({x:p.x,y:p.y-5,rx:kind==='rock'?17:23,ry:12,name:id});return true;
}
for(const [i,t]of trees.entries()){
 for(const [j,dx,dy]of [[0,-100,18],[1,95,35],[2,-135,75]])addCompanion(t.x+dx,t.y+dy,['bush','rock','flower'][(i+j)%3],.85+(i%3)*.12);
}
for(const [key,z]of Object.entries(world.zones).filter(([k])=>k.startsWith('activity'))){
 for(let d=0;d<360;d+=13){
  if([0,90,180,270].some(a=>Math.abs(d-a)<22))continue;
  const a=d*Math.PI/180,x=z.x+Math.cos(a)*(z.rx+45),y=z.y+Math.sin(a)*(z.ry+35);
  addCompanion(x,y,d%3===0?'bush':'flower',.8);
 }
}
for(const z of zones.filter(z=>z.kind==='stalls'))for(const x of [z.x0-75,z.x1+75])for(const y of [z.y0+30,z.y1-20]){
 addCompanion(x,y,'bush',1);addCompanion(x+45,y+60,'flower',1);addCompanion(x-45,y+40,'rock',.9);
}
let seed=1106;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
let flats=0;
for(const z of zones.filter(z=>z.kind==='lawn'))for(let i=0;i<52;i++){
 const x=z.x+(rnd()*2-1)*z.rx*.92,y=z.y+(rnd()*2-1)*z.ry*.92;
 if(((x-z.x)/z.rx)**2+((y-z.y)/z.ry)**2>.9)continue;
 const flower=i%5===0;
 art.flats.push({id:`ten-lawn-detail-${flats++}`,src:`decals/${flower?'flower-dot':'grass-tuft'}-${1+i%3}.svg`,x:f(x),y:f(y),width:flower?25:30,height:flower?18:22});
}
world.props=art.props;
const map=makeMap('sunflower',{world,walk,harbor,sleepers:[]}),resolved=resolveSleepSpots(map.baseWalk,art.props,geometry(map.baseWalk).walkable,sizes,{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
if(resolved.length!==40||resolved.bad.length)throw Error('Sleeper clearance: '+JSON.stringify(resolved.bad));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);
save(D+'sunflower-ten-changes.json',{benches:benchRecords,movedTrees:moved,underplanting:decor.length,lawnDetails:flats,props:art.props.length,sleepers:resolved.length});
console.log({benches:benchRecords.length,movedTrees:moved.length,underplanting:decor.length,lawnDetails:flats,props:art.props.length,sleepers:resolved.length});
