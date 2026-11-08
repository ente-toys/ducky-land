import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {geometry} from '../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
test('Canal communities preserve the heart, all residents and bounded ground textures',()=>{
 const old=read('scripts/bigger-canal/original-art.json'),art=read('public/pixi-art/themes/canal/art.json'),world=read('rive/web/themes/canal/world.json'),original=read('scripts/bigger-canal/original-world.json');
 assert.deepEqual(art.props.slice(0,old.props.length),old.props);assert.deepEqual(art.flats,old.flats);assert.deepEqual(art.decks.slice(0,old.decks.length),old.decks);assert.deepEqual(world.sleepSpots,original.sleepSpots);assert.equal(mapFor('canal').sleepers.length,40);
 assert.equal(Object.values(world.zones).filter(z=>z.kind==='community').length,4);assert.ok(art.ground.tiles.every(t=>t.width<=1536&&t.height<=1536));
});
test('Canal homes and workplaces connect through real river crossings to the original heart',()=>{
 const m=mapFor('canal'),n=m.nav();for(const z of Object.values(m.world.zones).filter(z=>z.kind==='community')){assert.ok(n.walkable(...z.spawn),z.name);let route=n.route(m.spawn.x,m.spawn.y,...z.spawn);assert.ok(route.length,z.name);assert.deepEqual(route.at(-1),z.spawn);}
 const g=geometry(m.baseWalk);assert.ok(!g.walkable(4000,4500),'the preserved inner canal is water');assert.ok(g.walkable(4150,400),'north crossing carries walkers');assert.ok(!g.walkable(4300,400),'water beside the crossing blocks walkers');
});
