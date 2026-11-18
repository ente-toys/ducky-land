import assert from 'node:assert/strict';
import test from 'node:test';
import {pickSpawnIsland, pickWorldSpawn} from '../src/gameplay/world-spawn.js';
import {isletWalks} from '../src/world/islet-walk.js';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {seeded} from './room-harness.mjs';

test('Home is used below 15 online players and all five eligible islands are used at 15', () => {
  const samples = [0, 0.2, 0.4, 0.6, 0.8];
  assert.ok(samples.every(value => pickSpawnIsland(14, () => value) === 'home'));
  assert.deepEqual(new Set(samples.map(value => pickSpawnIsland(15, () => value))),
    new Set(['blossom', 'sunset', 'isle-251', 'isle-250', 'isle-55']));
});

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
  const options = {boats,hasRoom:id => id === islandId,random,occupied:Array.from({length:9}, () => ({islandId:'blossom',x:0,y:0}))};
  const drops = Array.from({length:12}, () => pickWorldSpawn(options));
  assert.ok(drops.some(p => walk.nav.walkable(p.x,p.y)));
  boats[0].occupant = 'another-duck';
  assert.ok(Array.from({length:12}, () => pickWorldSpawn(options))
    .every(p => mapOf(islandId).nav().walkable(p.x,p.y)));
});

test('fewer than ten arrivals share a main island even with detached boats available', () => {
  const occupied = [], random = seeded(12), walk = isletWalks('home')[0];
  const boats = [{islandId:'home',...walk.water,occupant:null}];
  for (let count = 1; count < 10; count++) {
    const spawn = pickWorldSpawn({occupied,boats,random});
    assert.equal(spawn.islandId,'home');
    assert.ok(mapOf('home').nav().walkable(spawn.x,spawn.y));
    occupied.push(spawn);
  }
  const destinations = new Set(Array.from({length:30}, () => pickWorldSpawn({occupied,random}).islandId));
  assert.ok(destinations.size > 1,'the tenth arrival can spawn across the world');
});

test('small crowds join the busiest eligible island and respect access and room limits', () => {
  const occupied = ['home','blossom','blossom','isle-249','isle-249','isle-249']
    .map(islandId => ({islandId,x:0,y:0}));
  assert.equal(pickWorldSpawn({occupied,random:seeded()}).islandId,'blossom');
  assert.equal(pickWorldSpawn({occupied,karma:5,random:seeded()}).islandId,'isle-249');
  assert.equal(pickWorldSpawn({occupied,hasRoom:id => id !== 'blossom',random:seeded()}).islandId,'home');
});
