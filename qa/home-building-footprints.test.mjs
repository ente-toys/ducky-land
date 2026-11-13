import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import sharp from 'sharp';
import {HOME_MAP} from '../src/world/island-maps.js';
import routes from '../src/world/home/home-routes.json' with {type:'json'};
import {inShape} from '../assets/world/island-geometry.mjs';
import {atMuseumDoor} from '../src/gameplay/player-motion.js';

const bundle = await build({stdin: {resolveDir: process.cwd(), contents: `export {createPlacements,walkWorld,trimWorld} from './src/world/home/placements.js';`}, bundle: true, platform: 'node', format: 'esm', write: false});
const {createPlacements} = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const props = createPlacements();
// Identify buildings independently of the collision catalogue so a new home or
// a replacement asset cannot silently lose its blocker.
const buildings = props.filter(p => [0,1,2,3,34,46,47,48].includes(p.id) || p.communityRole || /bandstand|garden-shed|grain-silo|windmill|harvest-barn|smokehouse|bread-oven|kiln|pottery-drying-rack|raised-bed|vegetable-bed/.test(p.src));

test('every opaque Home building sample is solid in the shared worker map', async () => {
  const nav = HOME_MAP.nav();
  assert.ok(buildings.length >= 35);
  for (const p of buildings) {
    const {data,info} = await sharp('public' + p.src).resize(64,64,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let samples = 0;
    for (let y=0; y<info.height; y++) for (let x=0; x<info.width; x++) {
      if (data[(y*info.width+x)*4+3] <= 240) continue;
      const u=(x+.5)/info.width, v=(y+.5)/info.height;
      const wx=p.x+(p.flip?p.anchor.x-u:u-p.anchor.x)*p.width*(p.scale??1);
      const wy=p.y+(v-p.anchor.y)*p.height*(p.scale??1);
      for (const dx of [-22,0,22]) assert.equal(nav.walkable(wx+dx,wy),false,`${p.id}: Ducky body can overlap drawn art at ${wx+dx},${wy}`);
      samples++;
    }
    assert.ok(samples>20,`${p.id}: sampled visible art`);
    assert.ok(p.footprint?.building,`${p.id}: explicit shared solid`);
    assert.ok(p.z >= Math.max(...p.footprint.poly.map(v=>v[1])),`${p.id}: foreground sorts in front of its base`);
  }
});

test('museum door and both banks of the removed river bridge stay reachable', () => {
  const n=HOME_MAP.nav();
  for (const point of [[2920,1190],[5520,1690],[4821,1552],[1188,2630],[2092,2630]]) {
    const target=n.nearest(...point,180);
    assert.ok(target,`approach to ${point}`);
    assert.deepEqual(n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...target).at(-1),target,`reachable ${point}`);
  }
  assert.ok(atMuseumDoor(2920,1190));
  assert.ok(n.walkable(2920,1190),'walkable museum trigger');
  assert.equal(n.walkable(1640,2630),false,'removed pond bridge is water');
  assert.equal(n.walkable(5300,1670),false,'removed river bridge is water');
});

test('solid building silhouettes leave authored walking route centres clear', () => {
 for (const p of buildings) for (const r of routes) for (const point of r.samples) {
  assert.equal(inShape(...point,p.footprint,16),false,`${p.id} blocks ${r.id} at ${point}`);
 }
});
