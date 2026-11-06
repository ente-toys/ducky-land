// Goldmine-only pose placement. Uses the engine's validator, five of each exact Home pose.
import {readFileSync,writeFileSync} from 'node:fs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inShape} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const D='rive/web/themes/blossom/',A='public/pixi-art/themes/blossom/';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const world=read(D+'world.json'),walkRaw=read(D+'walk-world.json'),art=read(A+'art.json');
const walk=makeMap('blossom',{world,walk:walkRaw,harbor:read(D+'harbor.json'),sleepers:[]}).baseWalk;
const geo=geometry(walk),sizes=sleepHalfWidths(),poses=Object.keys(sizes),old=[];
const nearTypes={hammock:/tree/i,rock:/rock|bush/i,leaf:/tree|bush/i,book:/bench|stall|tea|picnic/i,chair:/umbrella|sandcastle|bench|tree|towel/i,wing:/bush|bench|flower/i,box:/basket|stall|tea|gate/i};
let seed=711;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const candidates={};
const segDist=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
for(const pose of poses){
 const raw=[];
 for(const b of old.filter(b=>b.pose===pose))raw.push(b.tree?[b.tree,0,b.flip]:[b.x,b.y,b.flip]);
 if(pose==='nod')for(const p of art.props.filter(p=>/tree/i.test(p.name)))raw.push([p.id,0,rnd()<.5]);
 else for(const p of art.props.filter(p=>nearTypes[pose].test(p.name)))for(let i=0;i<300;i++){
  const a=rnd()*Math.PI*2,r=125+rnd()*410;
  raw.push([Math.round(p.x+Math.cos(a)*r),Math.round(p.y+Math.sin(a)*r*.8),rnd()<.5]);
 }
 const unique=new Set();candidates[pose]=[];
 for(const spot of raw){
  const tree=pose==='nod'?art.props.find(p=>p.id===spot[0]):null;
  if(pose==='nod'&&!tree)continue;
  const [x,y]=tree?[tree.x,tree.y+14]:spot;
  const key=Math.round(x/45)+','+Math.round(y/45);if(unique.has(key))continue;unique.add(key);
  if(world.sleepAvoid.some(a=>inShape(x,y,a,50)))continue;
  if((world.railPaths??[]).some(path=>path.slice(1).some((b,i)=>segDist(x,y,path[i],b)<80+sizes[pose])))continue;
  if(Object.entries(world.zones).some(([name,z])=>name.startsWith('stalls-')&&x>z.x0-sizes[pose]-45&&x<z.x1+sizes[pose]+45&&y>z.y0-sizes[pose]-45&&y<z.y1+sizes[pose]+45))continue;
  if(pose!=='nod'&&world.paths.some((path,i)=>path.some(([px,py])=>Math.hypot(x-px,y-py)<world.pathWidths[i]/2+sizes[pose]*.55)))continue;
  const r=resolveSleepSpots(walk,art.props,geo.walkable,sizes,{spots:{[pose]:[spot]},avoid:world.sleepAvoid,warn:false});
  if(r.length)candidates[pose].push({pose,spot,x,y,r:sizes[pose],old:old.some(b=>b.pose===pose&&Math.hypot(x-b.x,y-b.y)<2)});
 }
}
console.log('Valid candidate counts',Object.fromEntries(poses.map(p=>[p,candidates[p].length])));
const clash=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*1.3)<Math.max(300,a.r+b.r+100)||(a.pose===b.pose&&Math.hypot(a.x-b.x,a.y-b.y)<(a.pose==='chair'?850:900));
let best=[];
for(let attempt=0;attempt<120;attempt++){
 const chosen=[],counts=Object.fromEntries(poses.map(p=>[p,0]));
 while(chosen.length<40){
  const options=poses.filter(p=>counts[p]<5).map(p=>({p,list:candidates[p].filter(c=>!chosen.some(b=>clash(c,b)))}));
  if(options.some(o=>!o.list.length))break;
  options.sort((a,b)=>a.list.length/(5-counts[a.p])-b.list.length/(5-counts[b.p]));
  const {p,list}=options[0];
  const ranked=list.map(c=>({c,score:Math.min(...chosen.map(b=>Math.hypot(c.x-b.x,c.y-b.y)),1000)+rnd()*(attempt?850:50)+(c.old?300:0)})).sort((a,b)=>b.score-a.score);
  chosen.push(ranked[0].c);counts[p]++;
 }
 if(chosen.length>best.length)best=chosen;
 if(best.length===40)break;
}
// Repair the complete arrangement as a constraint problem when a greedy order
// paints itself into a corner. The exact same clearance and pose spread apply.
if(best.length!==40){
 for(let restart=0;restart<24 && best.length!==40;restart++){
  const assigned=poses.flatMap(p=>Array.from({length:5},()=>candidates[p][Math.floor(rnd()*candidates[p].length)]));
  for(let step=0;step<14000;step++){
   const conflicted=assigned.map((a,i)=>({i,n:assigned.reduce((n,b,j)=>n+(i!==j&&clash(a,b)?1:0),0)})).filter(c=>c.n);
   if(!conflicted.length){best=assigned;break;}
   const slot=conflicted[Math.floor(rnd()*conflicted.length)].i,pose=assigned[slot].pose;
   let cost=Infinity,options=[];
   for(const c of candidates[pose]){
    let n=0;for(let j=0;j<40;j++)if(j!==slot&&clash(c,assigned[j]))n++;
    if(n<cost){cost=n;options=[c];}else if(n===cost)options.push(c);
   }
   assigned[slot]=rnd()<.025?candidates[pose][Math.floor(rnd()*candidates[pose].length)]:options[Math.floor(rnd()*options.length)];
  }
 }
}
if(best.length!==40)throw Error(`Only ${best.length}/40 conflict-free sleepers fit. Clear scenery, do not relax Home rules.`);
const spots=Object.fromEntries(poses.map(p=>[p,best.filter(b=>b.pose===p).map(b=>b.spot)]));
const beds=resolveSleepSpots(walk,art.props,geo.walkable,sizes,{spots,avoid:world.sleepAvoid,warn:false});
if(beds.length!==40||beds.bad.length)throw Error(JSON.stringify(beds.bad));
world.sleepSpots=spots;writeFileSync(D+'world.json',JSON.stringify(world)+'\n');
writeFileSync(D+'sleepers-resolved.json',JSON.stringify(beds,null,2)+'\n');
console.log('PASS 40/40 sleepers, five per pose, zero dropped');
