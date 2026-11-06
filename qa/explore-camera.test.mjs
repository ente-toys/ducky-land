import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainExploreCamera,zoomToWorldPoint,islandArrow} from '../src/pixi/explore-camera.js';
const bounds={x0:-100000,x1:100000,y0:-70000,y1:70000};
test('exploring another island stays there at every zoom level',()=>{
  for(const zoom of [.015,.1,.5,1.8]) {
    const camera={x:32000,y:16000,zoom};constrainExploreCamera(camera,bounds);
    assert.equal(camera.x,32000);assert.equal(camera.y,16000);
  }
  const camera={x:400000,y:100000,zoom:1};constrainExploreCamera(camera,bounds);
  assert.equal(camera.x,400000);assert.ok(camera.y<40000);
});
test('zoom follows the chosen world point and preserves the flat cursor anchor',()=>{
  const camera={x:30000,y:-10000,zoom:.1}, point={x:32000,y:-9000};
  const offset={x:(point.x-camera.x)*camera.zoom,y:(point.y-camera.y)*camera.zoom};
  zoomToWorldPoint(camera,.5,point);
  assert.equal((point.x-camera.x)*camera.zoom,offset.x);assert.equal((point.y-camera.y)*camera.zoom,offset.y);
  assert.ok(camera.x>30000);assert.ok(camera.y>-10000);
});
test('island arrow stays on screen and points to offscreen or hidden islands',()=>{
  const right=islandArrow({x:5000,y:300,face:1},1000,600);
  assert.equal(right.x,930);assert.equal(right.angle,0);
  const back=islandArrow({x:0,y:0,face:-1},1000,600,{x:200,y:300});
  assert.equal(back.x,70);assert.equal(back.angle,Math.PI);
  const visible=islandArrow({x:600,y:350,face:1},1000,600);
  assert.deepEqual(visible,{x:555,y:350,angle:0});
});
