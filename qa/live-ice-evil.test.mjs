import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import READY from '../rive/web/themes/index.js';
import {mapFor,themeOfIsland} from '../src/pixi/island-maps.js';
import {WORLD_ISLANDS,FINISHED_THEMES,layoutWorld} from '../src/pixi/world-map.js';
import {checkTheme} from '../scripts/theme-index.mjs';

test('adding two live themes preserves Home and all six earlier island identities',()=>{
  const before=layoutWorld(undefined,11,FINISHED_THEMES.slice(0,6)).islands;
  assert.equal(WORLD_ISLANDS.length,9);
  for(const old of before) {
    const now=WORLD_ISLANDS.find(i=>i.id===old.id);
    assert.deepEqual([now.id,now.theme,now.width,now.height],[old.id,old.theme,old.width,old.height]);
    if(old.id==='home')assert.deepEqual([now.x,now.y],[old.x,old.y]);
  }
  assert.equal(themeOfIsland('isle-249'),'bog');assert.equal(themeOfIsland('isle-55'),'snow');
});

for(const theme of ['bog','snow'])test(`${theme}: full live contract, unique art and onshore residents`,()=>{
  const result=checkTheme(theme);assert.equal(result.ready,true,result.problems.join('\n'));
  // The communities expansion raised the shared live contract to 16000x12000.
  // checkTheme above validates that cap and the origin-aware sea margin.
  const m=mapFor(theme);assert.equal(m.id,theme);
  assert.deepEqual([m.width,m.height],[READY[theme].world.width,READY[theme].world.height]);
  assert.equal(m.sleepers.length,theme==='snow'?60:40);assert.equal(new Set(m.sleepers.map(s=>s.pose)).size,8);
  for(const s of m.sleepers)assert.ok(m.landAt(s.x,s.y));
  const a=JSON.parse(readFileSync(`public/pixi-art/themes/${theme}/art.json`));
  for(const p of [...a.ground.tiles,...a.props,...a.flats,...a.decks]) {
    const file=p.src.startsWith('/')?'public'+p.src:`public/pixi-art/themes/${theme}/`+p.src;
    assert.ok(existsSync(file),file);
    assert.ok(!/shapes21|estate-|background-|build-b\/ground|night-10/.test(p.src),'no continent filler');
  }
  assert.ok(!READY[theme].world.estate21);
});

test('Boo Boxing Ring: walk through the south opening onto the mat, ropes and posts are solid',()=>{
  const m=mapFor('bog'),n=m.nav();
  assert.ok(n.walkable(4000,3100));assert.ok(n.walkable(4000,3572));
  assert.ok(n.route(m.spawn.x,m.spawn.y,4000,3100).length);
  for(const [x,y] of [[4000,2516],[3184,3100],[4816,3100],[3450,3572],[4500,3572],[3184,2516],[4816,3572]])assert.equal(n.walkable(x,y),false,`barrier ${x},${y}`);
  assert.equal(m.world.boxingRing.fightCode,false);
});

test('Iceland B2: connected places, walkable rink and decorated pine replace the retired three centres',()=>{
  assert.ok(!WORLD_ISLANDS.some(i=>i.theme==='frost2'||i.theme==='frost3'));
  const m=mapFor('snow'),n=m.nav();
  for(const z of Object.values(m.world.zones)) {
    const [x,y]=z.spawn;assert.ok(n.walkable(x,y));
    assert.ok(n.route(m.spawn.x,m.spawn.y,x,y).length || n.clearLine([m.spawn.x,m.spawn.y],[x,y]));
  }
  const [x,y]=m.world.zones.rink.spawn;
  assert.equal(m.landAt(x,y),true,'boats stay off the rink');
  assert.ok(m.world.props.some(p=>p.id==='decorated-pine'));
});
