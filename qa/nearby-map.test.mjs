import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyMapFrame,nearbyHeading} from '../src/app/nearby-map.js';
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
