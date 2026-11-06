import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyMapFrame} from '../src/pixi/nearby-map.js';
import {WORLD_GEO, offsetOf} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';

const home = mapOf('home');
const centre = {x: home.width / 2, y: home.height / 2};
test('minimap keeps only three nearest islands and moves them opposite the duck', () => {
  const start = nearbyMapFrame('home', centre);
  assert.equal(start.length, 3);
  assert.equal(start[0].id, 'home');
  assert.equal(start[0].x, 0);
  const moved = nearbyMapFrame('home', {x: centre.x + 500, y: centre.y + 300});
  assert.equal(moved[0].x, -500);
  assert.equal(moved[0].y, -300);
  assert.notDeepEqual(nearbyMapFrame('home', {x: centre.x + 10000, y: centre.y}).map(i => i.id), start.map(i => i.id));
});
test('minimap remains continuous across world wrapping and island landing', () => {
  assert.deepEqual(nearbyMapFrame('home', {...centre, x: centre.x + WORLD_GEO.SX}), nearbyMapFrame('home', centre));
  const destination = mapOf('blossom');
  const offset = offsetOf('home', 'blossom');
  const before = nearbyMapFrame('home', {x: centre.x + offset.x, y: centre.y + offset.y});
  const after = nearbyMapFrame('blossom', {x: destination.width / 2, y: destination.height / 2});
  assert.deepEqual(before, after);
});
