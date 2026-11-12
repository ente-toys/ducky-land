import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/world/home/sleep-spots.js';
import {PLANT_MODELS,homePlant} from './plant-kit.mjs';
import {OUTER_PLANTING,PLANT_RESERVES} from './plants-data.mjs';

const mine=p=>(p.id??p.name??'').startsWith('fair-plant-');
const round=v=>Math.round(v*10)/10;
export const segmentDistance=(x,y,a,b)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1];
 const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);
};

export function applyPlants(art,world,walk) {
 const order=[art.props,world.props,world.obstacles,walk.obstacles].map(list=>new Map(list.flatMap((p,i)=>[[p,i],...(mine(p)?[[p.id??p.name,i]]:[])])));
 art.props=art.props.filter(p=>!mine(p));
 world.props=world.props.filter(p=>!mine(p));
 for(const w of [world,walk])w.obstacles=w.obstacles.filter(p=>!mine(p));
 let replaced=0;
 for(const p of art.props){const change=homePlant(p);if(change.src){Object.assign(p,change);replaced++;}}
 const base=geometry(walk),before=resolveSleepSpots(world,art.props,base.walkable,sleepHalfWidths(),{spots:world.sleepSpots,warn:false});
 const roads=(world.paths??[]).flatMap(l=>l.slice(1).map((b,i)=>[l[i],b]));
 const coast=world.coast.map((b,i)=>[world.coast[(i+1)%world.coast.length],b]);
 const additions=[],problems=[];
 for(const [grove,plants]of Object.entries(OUTER_PLANTING))for(const [i,[name,x,y,scale]]of plants.entries()){
  const m=PLANT_MODELS[name],tree=name.startsWith('tree-');assert(m,name);
  const p={id:`fair-plant-${grove}-${i}`,name:tree?'Tree':'Bush',...m,x,y,scale,
   anchor:{x:.5,y:1},wind:true,z:y,grove};
  const rx=tree?Math.max(15,m.width*scale*.095):m.width*scale*.37,ry=tree?18:16;
  const f={name:p.id,x,y:y-8,rx:round(rx),ry};p.footprints=[f];
  const complain=why=>problems.push(`${p.id} (${x},${y}): ${why}`);
  if(!base.walkable(x,y)||!base.walkable(x-rx,y)||!base.walkable(x+rx,y))complain('existing solid or water');
  if(world.water.some(w=>inShape(x,y,w,rx+55)))complain('boat-bank clearance');
  if(coast.some(([a,b])=>segmentDistance(x,y,a,b)<rx+75))complain('coast margin');
  if(roads.some(([a,b])=>segmentDistance(x,y,a,b)<90+rx))complain('path clearance');
  if(PLANT_RESERVES.some(r=>x+rx>r.x0&&x-rx<r.x1&&y+ry>r.y0&&y-ry<r.y1))complain('reserved feature/flight site');
  for(const q of art.props){
   if(q.asset==='grass-decal'||/tree-|bush-/.test(q.src))continue;
   const qw=q.width*(q.scale??1),qh=q.height*(q.scale??1);
   if(Math.abs(x-q.x)<(qw+m.width*scale)*.38&&y>q.y-qh*.7&&y-m.height*scale<q.y+60){complain('retained prop '+q.id);break;}
  }
  additions.push(p);art.props.push(p);
  for(const w of [world,walk])w.obstacles.push({...f});
  world.props.push({id:p.id,name:p.name,x,y,zone:'greenery'});
 }
 const nav=geometry(walk),beds=resolveSleepSpots(world,art.props,nav.walkable,sleepHalfWidths(),{spots:world.sleepSpots,warn:false});
 if(beds.length!==before.length||beds.bad.length)problems.push(...beds.bad.map(p=>'sleeper '+JSON.stringify(p)));
 for(const [i,list]of [art.props,world.props,world.obstacles,walk.obstacles].entries())
  list.sort((a,b)=>(order[i].get(a)??order[i].get(a.id??a.name)??1e9)-(order[i].get(b)??order[i].get(b.id??b.name)??1e9));
 return {replaced,added:additions.length,trees:additions.filter(p=>p.name==='Tree').length,
  bushes:additions.filter(p=>p.name==='Bush').length,sleepers:beds.length,problems};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
 const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,1)+'\n');
 const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
 const report=applyPlants(art,world,walk);console.log(JSON.stringify(report,null,2));
 assert.equal(report.problems.length,0,'Vegetation placement audit failed');
 if(!process.argv.includes('--check')){
  save(A+'art.json',art);save(D+'world.json',world);save(D+'walk-world.json',walk);save(D+'placements.json',art.props);
 }
}
