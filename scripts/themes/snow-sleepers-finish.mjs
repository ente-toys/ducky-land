import {readFileSync,writeFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const A='public/pixi-art/themes/snow/',D='assets/world/themes/snow/',j=p=>JSON.parse(readFileSync(p)),out=(p,o)=>writeFileSync(p,JSON.stringify(o,null,1)+'\n');
const art=j(A+'art.json'),world=j(D+'world.json'),walk=j(D+'walk-world.json'),harbor=j(D+'harbor.json'),props=j(D+'placements.json');
for(const id of ['snow-113','snow-76','snow-90','snow-91','snow-100','snow-102','snow-78']){
 const p=props.find(p=>p.id===id);if(!p||p.asset==='snow-bush')continue;
 const idx=walk.obstacles.findIndex(o=>o.x===p.footprint?.x&&o.y===p.footprint?.y);
 const footprint={x:p.x,y:p.y-12,rx:46,ry:18};
 Object.assign(p,{name:'snow bush',asset:'snow-bush',src:'detail/snow-bush.svg',width:210,height:130,scale:.62,footprint});
 Object.assign(art.props.find(q=>q.id===id),p);if(idx>=0)walk.obstacles[idx]=footprint;
}
const seg=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)};
const pathDist=(x,y)=>Math.min(...world.paths.flatMap(l=>l.slice(1).map((b,i)=>seg(x,y,l[i],b))));
const base=makeMap('snow',{world,walk,harbor,sleepers:[]}).walk,geo=geometry(base),sizes=sleepHalfWidths();
const spots={...world.sleepSpots,nod:[]};
for(const pose of Object.keys(spots).filter(p=>p!=='nod'))spots[pose]=spots[pose].filter(s=>pathDist(s[0],s[1])>=122+sizes[pose]);
const n=Object.values(spots).flat().length;
const obscured=p=>props.some(q=>q.id!==p.id&&q.y>p.y+4&&q.y-(p.y+14)<q.height*q.scale*.9&&Math.abs(q.x-p.x)<q.width*q.scale*.5+25);
const resolve=s=>resolveSleepSpots(base,art.props,geo.walkable,sizes,{spots:s,avoid:world.sleepAvoid,warn:false});
const candidates=props.filter(p=>p.asset?.startsWith('pine')&&!obscured(p)&&resolve({...spots,nod:[[p.id,0,false]]}).length===n+1);
let seed=64011;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);let best=[];
for(let k=0;k<3000;k++){
 const cs=candidates.map(p=>({p,r:rnd()})).sort((a,b)=>a.r-b.r).map(o=>o.p),list=[];
 for(const p of cs)if(list.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=900))list.push(p);
 if(list.length>best.length)best=list;
}
spots.nod=best.slice(0,40-n).map(p=>[p.id,0,p.x>world.width/2]);
let count=Object.values(spots).flat().length;
for(const pose of ['rock','box','leaf','wing','book','chair','hammock']){
 for(let y=750;y<4400&&count<40;y+=70)for(let x=650;x<6850&&count<40;x+=70){
  if(!geo.walkable(x,y)||pathDist(x,y)<122+sizes[pose]||Math.min(...props.map(p=>Math.hypot(p.x-x,p.y-y)))>365)continue;
  const trial={...spots,[pose]:[...spots[pose],[x,y,false]]};
  if(resolve(trial).length===count+1){spots[pose].push([x,y,false]);count++;}
 }
}
const beds=resolve(spots);if(beds.length!==40)throw Error('Visible sleeper finish has '+beds.length+'/40');
for(const b of beds.filter(b=>b.pose==='nod'))if(obscured(props.find(p=>p.id===b.tree)))throw Error('Occluded tree bed '+b.tree);
world.sleepSpots=spots;world.props=props.map(({id,name,x,y,zone})=>({id,name,x,y,zone}));
out(A+'art.json',art);out(D+'world.json',world);out(D+'walk-world.json',walk);out(D+'placements.json',props);out(D+'sleepers-resolved.json',beds);
const m=j(A+'snow-metrics.json');m.trees=props.filter(p=>p.asset?.startsWith('pine')).length;m.smallProps=props.filter(p=>/snow-bush|snow-rock|winter-berries/.test(p.asset)).length;m.sleepCounts=Object.fromEntries(Object.entries(spots).map(([k,v])=>[k,v.length]));m.mainCoastRatio=m.coastArea/11090000;m.homeRatio=m.totalLandArea/11090000;m.visibleTreeSleepers=beds.filter(b=>b.pose==='nod').length;
out(A+'snow-metrics.json',m);console.log('Visible sleeper finish:',beds.length,'sleepers,',m.trees,'pines,',m.sleepCounts);
