import assert from 'node:assert/strict';
import test from 'node:test';
import {pickWorldSpawn} from '../src/gameplay/world-spawn.js';
import {isletWalks} from '../src/world/islet-walk.js';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {seeded} from './room-harness.mjs';

test('every playable main island has safe, varied arrival points', () => {
  const random = seeded();
  for (const island of WORLD_ISLANDS) {
    const options = {karma:5, hasRoom:id => id === island.id, random};
    const first = pickWorldSpawn(options), second = pickWorldSpawn(options);
    assert.equal(first?.islandId,island.id);
    assert.equal(second?.islandId,island.id);
    const nav = mapOf(island.id).nav();
    assert.ok(nav.walkable(first.x,first.y));
    assert.ok(nav.walkable(second.x,second.y));
    assert.notDeepEqual(first,second);
  }
  assert.equal(pickWorldSpawn({hasRoom:id => id === 'isle-249',random}),null);
  assert.equal(pickWorldSpawn({hasRoom:() => false,random}),null);
});

test('a detached islet can receive a drop when a boat is available at its dock', () => {
  const islandId = 'home';
  const walk = isletWalks(islandId)[0];
  const random = seeded(12);
  const boats = [{islandId,...walk.water,occupant:null}];
  const options = {boats,hasRoom:id => id === islandId,random};
  const drops = Array.from({length:12}, () => pickWorldSpawn(options));
  assert.ok(drops.some(p => walk.nav.walkable(p.x,p.y)));
  boats[0].occupant = 'another-duck';
  assert.ok(Array.from({length:12}, () => pickWorldSpawn(options))
    .every(p => mapOf(islandId).nav().walkable(p.x,p.y)));
});
