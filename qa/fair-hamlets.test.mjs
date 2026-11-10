import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {config,objects,A,layouts} from '../scripts/bigger-fair/hamlets.mjs';
import {outer,streams} from '../scripts/bigger-fair/fix-geometry.mjs';
import {inShape} from '../rive/web/island-geometry.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {makeMap} from '../src/pixi/island-maps.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read('rive/web/themes/fair/world.json'),walk=read('rive/web/themes/fair/walk-world.json');
const checked=checkTheme('fair'),map=makeMap('fair',{world,walk,harbor:read('rive/web/themes/fair/harbor.json'),sleepers:checked.sleepers}),nav=map.nav();
const placed=art.props.filter(p=>p.id.startsWith('hamlet-'));
test('Fair uses all four approved SVG hamlets with 17 homes, workplaces, shadows and solid bases',()=>{
 assert.deepEqual(Object.keys(config),['bobbinbell','cloudpop','sugarspoon','waddleshow']);
 assert.equal(placed.length,208);assert.equal(placed.filter(p=>p.role==='home').length,17);
 assert(!art.props.some(p=>/^fair-community-/.test(p.id)&&p.community!=='commons'));
 for(const [h,c]of Object.entries(config)){
  const ps=placed.filter(p=>p.community===h);assert(ps.some(p=>p.role==='workplace'));
  assert(ps.some(p=>p.role==='home'));
  for(const p of ps){
   const svg=fs.readFileSync(p.src.startsWith('/pixi-art/')?'public'+p.src:A+p.src,'utf8');assert(!/<image|gradient/i.test(svg),p.id);
   assert(objects(h).some(o=>p.id===`hamlet-${h}-${o.id}`),'object absent from approved layout');
   if(p.role){assert(p.shadowSize?.[0]>0,p.id+' lacks base shadow');assert(p.footprints.length,p.id+' lacks solid base');assert(nav.walkable(...p.door),p.id+' door blocked');assert(nav.route(map.spawn.x,map.spawn.y,...p.door).length||nav.clearLine([map.spawn.x,map.spawn.y],p.door),p.id+' unreachable');}
   for(const f of p.footprints??[]){assert(walk.obstacles.some(w=>w.name===p.id&&w.x===f.x&&w.y===f.y));assert(!nav.walkable(f.x,f.y),p.id+' nonsolid');}
  }
 }
});
test('Fair hamlet bases have 80 units of grass beside the moat and stand clear of the beach',()=>{
 for(const p of placed){const f=p.footprint,pts=f?[[f.x-f.rx*.8,f.y],[f.x,f.y-f.ry],[f.x+f.rx*.8,f.y],[f.x,f.y+f.ry]]:[[p.x,p.y]];
  for(const [x,y]of pts){assert(inShape(x,y,{poly:world.coast},-240),p.id+' beach');assert(!inShape(x,y,{poly:outer},80),p.id+' moat bank');for(const s of streams)assert(!inShape(x,y,{poly:s.poly},80),p.id+' stream bank');}
 }
});
test('all 90 approved sleepers resolve and each hamlet uses both authored sleeper points',()=>{
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,90);
 for(const [h,c]of Object.entries(config)){assert.equal(c.sleepers.length,2);assert.equal(layouts[h].sleepers.length,2);for(const s of c.sleepers){const spot=world.sleepSpots[s.pose][s.index];assert(checked.sleepers.some(p=>p.pose===s.pose&&Math.abs(p.x-spot[0])<1&&Math.abs(p.y-spot[1])<1));}}
});
