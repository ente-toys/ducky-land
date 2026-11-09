import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read('public/pixi-art/themes/fair/art.json'),map=mapFor('fair'),nav=map.nav();
const P=([x,y])=>[3570+(x-768)*4.3,2220+(y-520)*3.8];
test('Fair balloon kiosk has a solid base, duck scale, four lamps and two benches',()=>{
 const kiosk=art.props.find(p=>p.id==='ac2-balloon-kiosk');
 assert(Math.abs(kiosk.height*kiosk.scale-481.6)<.01);
 assert.equal(kiosk.shadow,false);
 assert(!nav.walkable(kiosk.x,kiosk.y-20));
 assert.equal(art.props.filter(p=>p.id.startsWith('ac2-plaza-lamp-')).length,4);
 assert.equal(art.props.filter(p=>p.id.startsWith('ac2-plaza-bench-')).length,2);
 assert(!art.props.some(p=>/teapot|^ac2-teacup-(pink-|yellow-)?0/.test(p.id+' '+p.src)));
 for(const q of [[730,825],[806,825],[768,865],[768,925],[768,740]]){
  const p=P(q);assert(nav.walkable(...p),'blocked plaza aisle '+q);
  assert(nav.route(map.spawn.x,map.spawn.y,...p).length||nav.clearLine([map.spawn.x,map.spawn.y],p),'unreachable '+q);
 }
});
test('all Fair residents resolve clear of the kiosk and the new plaza rim and steps',()=>{
 assert.equal(map.sleepers.length,40);
 for(const s of map.sleepers){
  const x=(s.x-3570)/4.3+768,y=(s.y-2220)/3.8+520;
  const r=Math.hypot((x-768)/179,(y-818)/87);
  assert(!(r>.91&&r<1.09),'sleeper on rim '+JSON.stringify(s));
  assert(!(x>726&&x<810&&y>894&&y<930),'sleeper on steps');
 }
});
