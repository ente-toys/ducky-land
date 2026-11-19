import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyMapFrame,nearbyHeading,nearbyTeleporterBearing} from '../src/app/nearby-map.js';
import {mapPoint} from '../src/world/sphere-coordinates.js';
import {mapOf} from '../src/world/island-maps.js';
const m=mapOf('home'),centre={x:m.cx,y:m.cy};
test('minimap keeps three nearest flat, upright islands and moves opposite the duck',()=>{
 const a=nearbyMapFrame('home',centre),b=nearbyMapFrame('home',{x:m.cx+500,y:m.cy+300});
 assert.equal(a.length,3);assert.equal(a[0].id,'home');
 assert.equal(b[0].x,-500);assert.equal(b[0].y,-300);
 for(const i of b)assert.equal(i.bearing,0);
 assert.notDeepEqual(nearbyMapFrame('home',{x:m.cx+17000,y:m.cy}).map(i=>i.id),a.map(i=>i.id));
});
test('minimap positions and headings stay fixed across island frame changes',()=>{
 for(const to of ['blossom','isle-55','isle-251']){
  const m=mapOf(to),p={x:m.cx+300,y:m.cy-200};
  const a=nearbyMapFrame('home',mapPoint(to,'home',p)),b=nearbyMapFrame(to,p);
  assert.deepEqual(a.map(i=>i.id),b.map(i=>i.id));
  for(let k=0;k<a.length;k++){assert.ok(Math.hypot(a[k].x-b[k].x,a[k].y-b[k].y)<1e-8);assert.equal(b[k].bearing,0);}
  assert.equal(nearbyHeading(to,p,1,0),90);assert.equal(nearbyHeading(to,p,0,-1),0);
 }
});

test('minimap shows the nearest islands the short way round the wrapping sea, before and after crossing the edge', async () => {
  const {FLAT_POSITIONS, SEA_WIDTH, wrapSea} = await import('../src/world/flat-layout.js');
  const {mapOf: map} = await import('../src/world/island-maps.js');
  const h = map('home');
  for (const dx of [0, 7500, -30000, -45000, -72000, 45000, 79000]) {
    const p = {x: h.cx + dx, y: h.cy + 3000};
    const truth = ['home', 'blossom', 'isle-251', 'sunset', 'isle-250', 'isle-55', 'isle-249']
      .map(id => {
        const {x,y}=FLAT_POSITIONS[id];
        return Math.min(Math.hypot(wrapSea(x-dx),y-3000),
          Math.hypot(wrapSea(x+SEA_WIDTH/2-dx),SEA_WIDTH/2-y-3000),
          Math.hypot(wrapSea(x+SEA_WIDTH/2-dx),-SEA_WIDTH/2-y-3000));
      }).sort((a, b) => a - b).slice(0, 3);
    const shown = nearbyMapFrame('home', p, null).map(i => Math.hypot(i.x, i.y));
    shown.forEach((d, k) => assert.ok(Math.abs(d - truth[k]) < 1, `x ${dx}: island ${k} at ${d.toFixed(0)}, nearest is ${truth[k].toFixed(0)}`));
  }
});

test('the minimap reflects a coast when sailing on its opposite-meridian image', () => {
 const home=mapOf('home');
 const frame=nearbyMapFrame('home',{x:home.cx+40000,y:home.cy-39000});
 assert.deepEqual(frame[0],{id:'home',x:0,y:-1000,bearing:0,flip:-1});
});

test('the minimap arrow points to the current harbor when the teleporter is unlocked', async () => {
  const {TELEPORTERS} = await import('../src/gameplay/teleport.js');
  const {SEA_WIDTH} = await import('../src/world/flat-layout.js');
  for (const [id, machine] of TELEPORTERS) {
    const east = {x:machine.x + 500, y:machine.y};
    const westAcrossSeam = {x:machine.x - 500 + SEA_WIDTH, y:machine.y};
    assert.equal(nearbyTeleporterBearing(id, east, false), null);
    assert.equal(nearbyTeleporterBearing(id, null, true), null);
    assert.equal(nearbyTeleporterBearing(id, machine, true), null);
    assert.equal(nearbyTeleporterBearing(id, east, true), -90);
    assert.equal(nearbyTeleporterBearing(id, westAcrossSeam, true), 90);
  }
});
