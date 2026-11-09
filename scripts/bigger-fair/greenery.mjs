// Run LAST: boats -> centre -> hamlets-apply -> greenery -> theme-index -> source-sizes.
// Idempotent additions only. Reuse the island's existing SVGs, sort at each foot.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {FIT} from './centre-data.mjs';
import {INNER_GROVES,OUTER_GROVES,BANK_BUSHES} from './greenery-data.mjs';
import {geometry,inPoly,inShape} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
const A='public/pixi-art/themes/fair/',D='rive/web/themes/fair/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
const mine=p=>(p.id??p.name??'').startsWith('fair-green-');
art.props=art.props.filter(p=>!mine(p));world.props=world.props.filter(p=>!mine(p));
for(const w of [world,walk])w.obstacles=w.obstacles.filter(p=>!mine(p));
const base=geometry(walk),models={};
for(const n of [1,2,3,4])models['t'+n]=art.props.find(p=>p.src===`reuse/tree-${n}.svg`);
for(const n of [2,3])models['b'+n]=art.props.find(p=>p.src===`reuse/bush-${n}.svg`);
const P=([x,y])=>[+(FIT.cx+(x-768)*FIT.sx).toFixed(1),+(FIT.cy+(y-520)*FIT.sy).toFixed(1)];
const added=[],problems=[];
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
const roads=world.paths.flatMap(line=>line.slice(1).map((b,i)=>[line[i],b]));
function place(group,list,inner){for(const [i,[model,xx,yy]]of list.entries()){
 const [x,y]=inner?P([xx,yy]):[xx,yy],tree=model[0]==='t',m=models[model];assert(m,model);
 const p={id:`fair-green-${group}-${i}`,name:tree?'Tree':'Bush',src:m.src,x,y,width:m.width,height:m.height,scale:tree?1.12:1.05,anchor:{x:.5,y:1},flip:m.flip??false,wind:true,z:y,grove:group};
 if(!base.walkable(x,y))problems.push(p.id+' foot is blocked');
 assert(inPoly(x,y,world.coast)&&!world.water.some(s=>inShape(x,y,s)),p.id+' wet foot');
 assert(Math.hypot(x-world.zones.plaza.x,y-world.zones.plaza.y)-p.width*p.scale/2>=700,p.id+' plaza clearance');
 if(roads.some(([a,b])=>segmentDistance(x,y,a,b)<110))problems.push(p.id+' road clearance '+[xx,yy]);
 if(inner&&Math.abs(Math.hypot((xx-768)/699,(yy-520)/420)-1)*420*FIT.sy<62)problems.push(p.id+' promenade clearance '+[xx,yy]);
 const fp={name:p.id,x,y:y-9,rx:tree?29:Math.min(48,p.width*.22),ry:tree?20:16};
 p.footprints=[fp];art.props.push(p);added.push(p);
 for(const w of [world,walk])w.obstacles.push({...fp});
 world.props.push({id:p.id,name:p.name,x,y,zone:'greenery'});
}}
for(const [g,p]of Object.entries(INNER_GROVES))place(g,p,true);
for(const [g,p]of Object.entries(OUTER_GROVES))place(g,p,false);
for(const [g,p]of Object.entries(BANK_BUSHES))place('bank-'+g,p,true);
const nav=geometry(walk),beds=resolveSleepSpots(world,art.props,(x,y)=>nav.walkable(x,y),sleepHalfWidths(),{spots:world.sleepSpots,warn:false});
if(beds.length!==40)problems.push(...beds.bad.map(p=>JSON.stringify(p)));
assert.equal(problems.length,0,problems.join('\n'));
save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props);
const trees=p=>/\/tree-/.test(p.src),bushes=p=>/\/bush-/.test(p.src);
console.log(JSON.stringify({addedTrees:added.filter(trees).length,addedBushes:added.filter(bushes).length,totalTrees:art.props.filter(trees).length,totalBushes:art.props.filter(bushes).length,sleepers:beds.length},null,2));
