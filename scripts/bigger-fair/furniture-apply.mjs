// Scoped update for review 6/7/11/12. Does not run any terrain/path painter.
// Safe to run again after merging the other Fair work items.
import fs from 'node:fs';
import {BENCH_COURTS,placeBench,fitContact} from './furniture.mjs';
import {FIT} from './centre-data.mjs';
import {applyFairBenches} from './benches.mjs';
const A='public/pixi-art/themes/fair/',D='assets/world/themes/fair/';
const read=f=>JSON.parse(fs.readFileSync(f)),save=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,1)+'\n');
const art=read(A+'art.json'),layout=read('scripts/bigger-fair/centre-source/layout.json');
const inline=f=>fs.readFileSync(f,'utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
const changed=new Map();
for(const p of art.props){
 const before=JSON.stringify(p),id=p.id?.replace(/^ac2-/,'');
 if(BENCH_COURTS[id]){
  const o=layout.objects.find(o=>o.id===id);
  const at=[FIT.cx+(o.x-768)*FIT.sx,FIT.cy+(o.y-520)*FIT.sy];
  for(const k of Object.keys(p))delete p[k];
  Object.assign(p,placeBench(o,at));
 }
 fitContact(p);
 if(p.id==='ac2-balloon-kiosk'){
  const o=layout.objects.find(o=>o.id==='balloon-kiosk');
  fs.writeFileSync(A+p.src,`<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="${-o.width/2} ${-o.height} ${o.width} ${o.height}"><g transform="translate(${-o.width/2} ${-o.height}) scale(${o.width/224} ${o.height/224})">${inline(A+'ac2/balloon-kiosk.svg')}</g></svg>`);
 }
 if(JSON.stringify(p)!==before)changed.set(p.id,p);
}
// Replace only the embedded court asset, retaining every surrounding terrain
// byte. New path authority can freely rebuild these tiles from plaza-ground.svg.
let tiles=0;
const oldCourt=/<title>Checkered balloon plaza and entry steps<\/title>[\s\S]*?<path d="M145 166H215M142 178H218M139 184H221"[^>]*>\s*<\/g>/g;
for(const t of art.ground.tiles){
 const file=A+t.src,before=fs.readFileSync(file,'utf8'),after=before.replace(oldCourt,inline(A+'ac2/plaza-ground.svg'));
 if(after!==before){fs.writeFileSync(file,after);tiles++;}
}
for(const file of [D+'world.json',D+'walk-world.json']){
 const world=read(file);
 for(const obstacle of world.obstacles){
  const id=obstacle.name?.replace(/^ac2-/,''),p=art.props.find(p=>p.id===obstacle.name);
  if(!BENCH_COURTS[id]||!p)continue;
  for(const k of Object.keys(obstacle))delete obstacle[k];
  Object.assign(obstacle,p.footprint);
 }
 save(file,world);
}
save(A+'art.json',art);
const placements=read(D+'placements.json');
save(D+'placements.json',placements.map(p=>changed.get(p.id)??p));
const expFile='scripts/bigger-fair/expansion.json',exp=read(expFile);
exp.newProps=exp.newProps.map(p=>changed.has(p.id)?{...p,...changed.get(p.id)}:p);save(expFile,exp);
applyFairBenches();
console.log(`Fair furniture: ${changed.size} fitted props, ${tiles} embedded flush courts; no path painter run.`);
