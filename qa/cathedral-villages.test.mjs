import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap} from '../src/world/island-maps.js';
import {VILLAGES,GROVES} from '../scripts/bigger-cathedral/villages-data.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',S='scripts/bigger-cathedral/villages-source/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),before=read(S+'world.json'),oldArt=read(S+'art.json'),map=makeMap('cathedral',{world,walk,harbor:read(D+'harbor.json')});
test('Village replacement preserves water, crossing and arrival-port geometry exactly',()=>{
 for(const k of ['coast','water','boatWater','riverMouths','walkways','bridges','islets'])assert.deepEqual(world[k],before[k],k);
 assert.deepEqual(world.arches,before.arches.map(a=>({...a,r:24})),'Home crown replaces legacy rise; all bridge anchors and widths stay exact');
 const crossing=d=>({id:d.id,src:d.src,overBoats:d.overBoats,homeBridge:d.homeBridge});
 assert.deepEqual(art.decks.map(crossing),oldArt.decks.map(crossing));
 assert.deepEqual(art.decks.filter(d=>d.id.startsWith('bellovo-port-')),oldArt.decks.filter(d=>d.id.startsWith('bellovo-port-')));
 assert.deepEqual(art.props.filter(p=>p.id.startsWith('bellovo-port-')),oldArt.props.filter(p=>p.id.startsWith('bellovo-port-')));
 assert.ok(!art.props.some(p=>/^b2-balustrade-|^junction-sign-/.test(p.id)));
 assert.ok(!world.paths.some(p=>JSON.stringify(p)===JSON.stringify(before.paths[30])),'west dead end removed');
});
test('Village assets use supplied unit sizes, contact shadows and three dry Home plant clumps',()=>{
 for(const v of VILLAGES){
  for(const o of v.pieces){const p=[...art.props,...art.flats].find(p=>p.id===v.id+'-'+o.id);assert.ok(p,p?.id??o.id);if(!/bench/.test(o.id))assert.deepEqual([p.width,p.height],o.size);const svg=fs.readFileSync(A+p.src,'utf8');assert.doesNotMatch(svg,/<image\b|data:image|<(?:linear|radial)Gradient\b/i);}
  assert.equal(GROVES[v.id].length,3);
  for(const p of art.props.filter(p=>p.id.startsWith(v.id+'-grove-'))){assert.match(p.src,/^autumn\/(tree-[1-5]|bush-[1-4])-(amber|rust|mustard|green)\.svg$/);assert.ok(map.landAt(p.x,p.y));assert.ok(art.flats.some(f=>f.id==='life-'+p.id+'-shadow'));}
 }
});
test('All new village path samples and doors have clear walking ground',()=>{
 const nav=map.nav();for(const [i,line]of world.paths.entries())if(i>=24)for(const [x,y]of line)assert.ok(nav.walkable(x,y),`village lane ${i} at ${x},${y}`);
 for(const v of VILLAGES)for(const p of art.props.filter(p=>p.id.startsWith(v.id+'-')&&/-house-|foundry|olive-workshop|mosaic-workshop|bakery/.test(p.id))){const door=[p.x,p.y+40];assert.ok(nav.walkable(...door));assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...door).at(-1),door);}
});
