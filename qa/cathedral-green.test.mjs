import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';
import {CLUMPS} from '../scripts/bigger-cathedral/green-data.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',B='scripts/bigger-cathedral/green-source/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),old=read(B+'world.json'),before=read(B+'art.json'),harbor=read(D+'harbor.json');
const map=makeMap('cathedral',{world,walk,harbor});
test('Bellovo green retains the coast, islets and dry residents after the approved centre and population replacement',()=>{
 assert.equal(map.sleepers.length,120);
 for(const k of ['coast','islets'])assert.deepEqual(world[k],old[k],k);
 for(const id of ['cathedral-hall','campanile','cloister-olive-well'])assert.ok(art.props.some(p=>p.id===id));
 assert.equal(art.props.filter(p=>p.id.startsWith('centre-colonnade-')).length,6);
 for(const s of map.sleepers)assert.ok(map.landAt(s.x,s.y));
});
test('Bellovo green uses existing vector art in authored clumps and clears the daisy carpets',()=>{
 assert.equal(art.props.filter(p=>p.name==='Daisy flower border').length,0);
 for(const [id,members]of CLUMPS){const trees=members.filter(p=>p[2]!=='b'),bushes=members.filter(p=>p[2]==='b');assert.ok(trees.length>=2&&trees.length<=7,id);assert.ok(bushes.length>=1&&bushes.length<=3,id);}
 for(const p of art.props.filter(p=>p.id?.startsWith('green-'))){assert.ok(p.src.endsWith('.svg'));assert.ok(fs.existsSync(p.src.startsWith('/')?'public'+p.src:A+p.src));assert.ok(map.landAt(p.x,p.y),p.id+' stays dry');}
 assert.ok(art.ground.tiles.every(p=>p.src.endsWith('.svg')));
 for(const p of art.ground.tiles)assert.doesNotMatch(fs.readFileSync(A+p.src,'utf8'),/<image\b/);
});
test('Bellovo B2 replaces the stone pads with a clipped lawn and preserves the round piazza',()=>{
 const centre=fs.readFileSync(A+art.ground.tiles.find(p=>p.src.includes('preserved-')).src,'utf8');
 assert.match(centre,/data-name="Bellovo unified paths"/);assert.match(centre,/clipPath id="paths-original-land"/);
 assert.doesNotMatch(centre,/<!--b2-garden-->|stroke="#fff0c7" stroke-width="(?:104|128)"/);
 assert.ok(art.flats.some(p=>p.src==='centre-A/paving.svg'));
 assert.ok(!art.props.some(p=>p.id==='cathedral-4'||/^cloister-cloister-(west|east)/.test(p.id)));
});
