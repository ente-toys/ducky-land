import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {homeBench,placeBench,benchFeet,BENCH_COURTS} from './furniture.mjs';
import {FIT} from './centre-data.mjs';
const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,1)+'\n');
export const isBench=p=>/bench/i.test([p.id,p.name,p.asset,p.src].join(' '))||/^fair-life-picnic-seat-/.test(p.id);
export const OUTER_BENCHES={
 'fair-community-180':{at:[1360,-510],look:'back'},
 'fair-community-181':{at:[-1530,4300],look:'right'},
 'hamlet-bobbinbell-bench-honeywood-26':{at:[-1046.4,2002.4],look:'front'},
 'fair-life-hill-bench':{at:[7360,1280],look:'right'},
 'fair-life-picnic-seat-west':{at:[4860,4630],look:'right'},
 'fair-life-picnic-seat-east':{at:[5200,4630],look:'left'},
};
export function applyFairBenches(){
 const art=read(A+'art.json'),layout=read('scripts/bigger-fair/centre-source/layout.json');
 const changed=new Map(),oldFeet=[];
 for(const p of art.props.filter(isBench)){
  oldFeet.push(...(p.footprints??(p.footprint?[p.footprint]:[])));
  const key=p.id.replace(/^ac2-/,''),o=layout.objects.find(o=>o.id===key);
  const next=BENCH_COURTS[key]?placeBench(o,[FIT.cx+(o.x-768)*FIT.sx,FIT.cy+(o.y-520)*FIT.sy]):
   OUTER_BENCHES[p.id]?homeBench(p.id,OUTER_BENCHES[p.id].at,OUTER_BENCHES[p.id].look):null;
  if(!next)throw Error('Unreviewed Fair bench '+p.id);
  const keep=Object.fromEntries(['community','zone','order'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));
  for(const k of Object.keys(p))delete p[k];
  Object.assign(p,keep,next,{pavingFeet:benchFeet(next)});changed.set(p.id,p);
 }
 const sameFoot=(a,b)=>['x','y','rx','ry'].every(k=>a[k]!==undefined&&a[k]===b[k]);
 for(const file of ['world.json','walk-world.json']){
  const world=read(D+file);
  world.obstacles=world.obstacles.filter(o=>!changed.has(o.name??o.id)&&!oldFeet.some(f=>sameFoot(o,f)));
  world.obstacles.push(...[...changed.values()].map(p=>p.footprint));
  if(world.props)for(const p of world.props){const b=changed.get(p.id);if(b)Object.assign(p,{x:b.x,y:b.y});}
  save(D+file,world);
 }
 const hill=changed.get('fair-life-hill-bench');
 art.flats=art.flats.filter(p=>p.id!=='fair-bench-hill-paving');
 if(hill)art.flats.push({id:'fair-bench-hill-paving',src:'bigger/bench-hill-paving.svg',x:hill.x-120,y:hill.y-130,width:400,height:260,topLeft:true,resolution:2});
 save(A+'art.json',art);
 const placements=read(D+'placements.json');save(D+'placements.json',placements.map(p=>changed.get(p.id)??p));
 const expFile='scripts/bigger-fair/expansion.json',exp=read(expFile);
 exp.newProps=exp.newProps.map(p=>changed.get(p.id)??p);save(expFile,exp);
 return changed;
}
if(process.argv[1]===fileURLToPath(import.meta.url))applyFairBenches();
