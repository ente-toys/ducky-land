import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';
import {CLUMPS} from '../scripts/bigger-cathedral/green-data.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/',B='scripts/bigger-cathedral/green-source/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),old=read(B+'world.json'),before=read(B+'art.json'),harbor=read(D+'harbor.json');
const map=makeMap('cathedral',{world,walk,harbor});
test('Bellovo green keeps the exact forty approved sleepers and protected buildings',()=>{
 const previous=makeMap('cathedral',{world:old,walk:read(B+'walk-world.json'),harbor});
 assert.equal(map.sleepers.length,40);assert.deepEqual(map.sleepers.map(s=>[s.pose,s.flip,s.tree]).sort(),previous.sleepers.map(s=>[s.pose,s.flip,s.tree]).sort());
 // Water, bridges and decks belong to the water lane (qa/bellovo-rivers-sail.test.mjs); green keeps everything else.
 for(const k of ['coast','islets'])assert.deepEqual(world[k],old[k],k);
 for(const p of before.props.filter(p=>['cathedral-hall','campanile','cathedral-2','cathedral-3','cloister-olive-well'].includes(p.id)||/^cloister-(cloister-back|roof-roses|bench-[1-4]$)/.test(p.id)))assert.deepEqual(art.props.find(q=>q.id===p.id),p,p.id);
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
 assert.match(centre,/<!--b2-garden-->/);assert.match(centre,/clipPath id="b2-inner"/);
 assert.ok(art.flats.some(p=>p.src==='detail/piazza-mosaic.svg'));
 assert.ok(!art.props.some(p=>p.id==='cathedral-4'||/^cloister-cloister-(west|east)/.test(p.id)));
});
