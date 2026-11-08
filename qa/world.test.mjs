import assert from 'node:assert/strict';
import test from 'node:test';
import {FINISHED_THEMES, THEME_OF} from '../src/pixi/island-maps.js';
import {WORLD_ISLANDS, layoutWorld, neighboursOf} from '../src/pixi/world-map.js';
import {BOAT_CHANNEL, coastGaps} from '../src/pixi/sphere-shores.js';

test('world: placement preserves all saved IDs and their explicit themes regardless of distance', () => {
  assert.deepEqual(WORLD_ISLANDS.filter(i=>i.theme).map(i=>[i.id,i.theme]),[
    ['blossom','sunflower'],['sunset','pink'],['isle-251','library'],['isle-250','community'],
    ['isle-170','fair'],['isle-230','neon'],['isle-176','cathedral'],['isle-56','canal'],
    ['isle-93','waterfall'],['isle-163','goldmine'],['isle-249','bog'],['isle-55','snow']]);
  assert.deepEqual([...THEME_OF.values()],FINISHED_THEMES);
  assert.ok(neighboursOf('home').every(n=>n.island.theme),'Home jetty neighbours are finished themes');
});
test('world: only the 13 delivered identities are placed, with no filler or implicit future copies', () => {
  const next=layoutWorld();
  assert.equal(next.islands.length,13);
  assert.throws(()=>layoutWorld(undefined,11,[...FINISHED_THEMES,'future-theme']),/No stable island identity/);
  for(const {a,b,gap} of coastGaps(next.islands,next.Rw)) assert.ok(gap>=BOAT_CHANNEL,`${a}/${b}: ${Math.round(gap)} between coasts`);
});
