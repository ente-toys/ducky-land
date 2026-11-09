import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../scripts/theme-index.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/community/',art=read(A+'art.json'),world=read('rive/web/themes/community/world.json');
test('Campfire outer gardens reuse coloured centre art with contact shadows and no retired buoy ponds',()=>{
 const originals=new Set(read('scripts/campfire-hamlets/baseline/art.json').props.map(p=>p.src));
 const plants=art.props.filter(p=>p.outerGarden),tiles=art.ground.tiles.map(t=>fs.readFileSync(A+t.src,'utf8')).join('');
 assert(plants.filter(p=>p.kind==='tree').length>=150);
 assert(plants.filter(p=>p.kind==='bush').length>=280);
 assert(plants.filter(p=>p.kind==='table').length>=8);
 assert(plants.filter(p=>p.kind==='sign').length>=8);
 for(const p of plants){if(p.kind!=='detail')assert(originals.has(p.src),p.id+' is existing Campfire art');assert(tiles.includes(`data-prop="${p.id}"`),p.id+' contact shadow');}
 assert(!art.props.some(p=>p.src.includes('badge-buoy')));
 assert(!world.water.some(w=>w.rx===108&&w.ry===54));
 assert(!tiles.includes('cx="700" cy="894"'));
});
test('Campfire keeps all forty centre beds and adds thirty-two approved sleepers on the outer lawn',()=>{
 const old=read('scripts/campfire-hamlets/baseline/world.json');
 for(const [pose,spots]of Object.entries(old.sleepSpots))assert.deepEqual(world.sleepSpots[pose].slice(0,spots.length),spots);
 const checked=checkTheme('community');assert.deepEqual(checked.problems,[]);assert.equal(checked.sleepers.length,72);
 for(const pose of ['book','rock','leaf','wing'])assert.equal(world.sleepSpots[pose].length,old.sleepSpots[pose].length+8);
});
