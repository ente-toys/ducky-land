import assert from 'node:assert/strict';
import test from 'node:test';
import {FINISHED_THEMES, THEME_OF} from '../src/world/island-maps.js';
import {WORLD_ISLANDS, layoutWorld, neighboursOf} from '../src/world/world-map.js';
import {BOAT_CHANNEL, coastGaps} from '../src/world/sphere-shores.js';

test('world: placement preserves all saved IDs and their explicit themes regardless of distance', () => {
  assert.deepEqual(WORLD_ISLANDS.filter(i=>i.theme).map(i=>[i.id,i.theme]),[
    ['blossom','sunflower'],['sunset','pink'],['isle-251','library'],['isle-250','community'],
    ['isle-170','fair'],['isle-176','cathedral'],
    ['isle-249','bog'],['isle-55','snow']]);
  assert.deepEqual([...THEME_OF.values()],FINISHED_THEMES);
  assert.ok(neighboursOf('home').every(n=>n.island.theme),'Home jetty neighbours are finished themes');
});
test('world: only the 9 delivered identities are placed, with no filler or implicit future copies', () => {
  const next=layoutWorld();
  assert.equal(next.islands.length,9);
  assert.throws(()=>layoutWorld(undefined,11,[...FINISHED_THEMES,'future-theme']),/No stable island identity/);
  for(const {a,b,gap} of coastGaps(next.islands,next.Rw)) assert.ok(gap>=BOAT_CHANNEL,`${a}/${b}: ${Math.round(gap)} between coasts`);
});

test('retired islands cannot load maps, appear as travel targets or retain boats', async () => {
  const {HOME_MAP,mapOf,mapFor,readyThemes} = await import('../src/world/island-maps.js');
  const {islandFor,destinationsFor,createBoats,fillMoorings} = await import('../src/gameplay/islands.js');
  const {default:READY} = await import('../assets/world/themes/index.js');
  const {readFileSync} = await import('node:fs');
  const manifest=JSON.parse(readFileSync('public/pixi-art/globe/manifest.json'));
  for(const [id,theme] of [['isle-230','neon'],['isle-93','waterfall'],['isle-56','canal'],['isle-163','goldmine']]) {
    assert.equal(islandFor(id),undefined);
    assert.equal(mapOf(id),HOME_MAP);assert.equal(mapFor(theme),HOME_MAP);
    assert.ok(!READY[theme]&&!manifest[theme]&&!readyThemes().includes(theme));
    for(const island of WORLD_ISLANDS)assert.ok(destinationsFor(island.id).every(d=>d.destination!==id));
    const boats=[{id:id+'-0',islandId:id,departure:id,slot:0,occupant:'retired'},
      {id:'home-0',islandId:id,departure:'home',slot:0,occupant:'retired'}];
    fillMoorings(boats);
    assert.ok(boats.every(b=>b.islandId!==id&&b.departure!==id));
    assert.ok(createBoats().every(b=>b.islandId!==id));
  }
});

test('all nine islands retain their authored globe anchors and globe scale', async () => {
  const {WORLD_GEO} = await import('../src/world/world-map.js');
  const anchors=[[0,0],[60,28],[-140,-22],[105,-23],[-85,29],[164,24],[-57,-24],[0,-90],[0,90]];
  for(const [k,i] of WORLD_ISLANDS.entries()) {
    assert.equal(i.lon,anchors[k][0]*(Math.PI/180));
    assert.equal(i.lat,anchors[k][1]*(Math.PI/180));
  }
  assert.equal(WORLD_GEO.Rw,74000/(2*Math.PI));
});
