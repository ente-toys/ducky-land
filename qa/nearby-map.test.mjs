import {angle,dot} from '../src/world/sphere.js';
import {spherePoint,viewFrame} from '../src/world/sphere-coordinates.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyMapFrame} from '../src/app/nearby-map.js';
import {WORLD_GEO, offsetOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';

const home = mapOf('home');
const centre = {x: home.cx, y: home.cy};
test('minimap keeps only three nearest islands and moves them opposite the duck', () => {
  const start = nearbyMapFrame('home', centre);
  assert.equal(start.length, 3);
  assert.equal(start[0].id, 'home');
  assert.equal(start[0].x, 0);
  const moved = nearbyMapFrame('home', {x: centre.x + 500, y: centre.y + 300});
  assert.ok(moved[0].x<0&&moved[0].y<0);
  assert.ok(Math.abs(Math.hypot(moved[0].x,moved[0].y)-Math.hypot(500,300))<1e-8,'geodesic displacement equals walked chart distance');
  assert.notDeepEqual(nearbyMapFrame('home', {x: centre.x + 10000, y: centre.y}).map(i => i.id), start.map(i => i.id));
});
test('minimap remains continuous across world wrapping and island landing', () => {
  const close=(a,b)=>{assert.deepEqual(a.map(i=>i.id),b.map(i=>i.id));for(let k=0;k<a.length;k++)for(const axis of ['x','y'])assert.ok(Math.abs(a[k][axis]-b[k][axis])<1e-8,'same position within floating-point roundoff');};
  close(nearbyMapFrame('home', {...centre, x: centre.x + WORLD_GEO.SX}), nearbyMapFrame('home', centre));
  const destination = mapOf('blossom');
  const offset = offsetOf('home', 'blossom');
  const before = nearbyMapFrame('home', {x: centre.x + offset.x, y: centre.y + offset.y});
  const after = nearbyMapFrame('blossom', {x: destination.cx, y: destination.cy});
  assert.deepEqual(before.map(i=>i.id),after.map(i=>i.id));
  const oldFrame=viewFrame('home',{x:centre.x+offset.x,y:centre.y+offset.y});
  const newFrame=viewFrame('blossom',{x:destination.cx,y:destination.cy});
  for(let k=0;k<after.length;k++){
    const x=after[k].x,y=after[k].y;
    assert.ok(Math.abs(before[k].x-(dot(newFrame.east,oldFrame.east)*x-dot(newFrame.north,oldFrame.east)*y))<1e-8);
    assert.ok(Math.abs(before[k].y-(-dot(newFrame.east,oldFrame.north)*x+dot(newFrame.north,oldFrame.north)*y))<1e-8,'same physical location in the new screen orientation');
  }
});
