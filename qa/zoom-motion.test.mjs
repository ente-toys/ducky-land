import test from 'node:test';
import assert from 'node:assert/strict';
import {easeZoomCamera} from '../src/pixi/zoom-motion.js';
import {zoomAt} from '../rive/web/island-camera.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('zoom is symmetric and frame-rate independent in perceived scale',()=>{
  const sample=(hz,start,end)=>{const camera={x:0,y:0,zoom:start},motion={velocity:0};for(let i=0;i<hz/2;i++)easeZoomCamera(camera,{x:0,y:0,zoom:end},motion,1/hz);return camera.zoom;};
  for(const hz of [30,60,120,144]) {
    close(sample(hz,.1,.2),sample(60,.1,.2));
    close(sample(hz,.1,.2)*sample(hz,.2,.1),.02);
  }
});
test('large zoom gestures have bounded speed and settle without overshoot',()=>{
  for(const [start,end] of [[.015,1.8],[1.8,.015]]) {
    const camera={x:0,y:0,zoom:start},motion={velocity:0};let last=start;
    for(let i=0;i<240;i++) {
      easeZoomCamera(camera,{x:0,y:0,zoom:end},motion,1/60);
      assert.ok(Math.abs(Math.log(camera.zoom/last))<=4.5/60+1e-8);
      assert.ok(camera.zoom>=Math.min(start,end)-1e-8&&camera.zoom<=Math.max(start,end)+1e-8);
      last=camera.zoom;
    }
    close(camera.zoom,end);
  }
});
test('zoom keeps the cursor world point fixed and honors reduced motion',()=>{
  const camera={x:200,y:400,zoom:.1},target={...camera},motion={velocity:0};
  const point={x:camera.x+300/camera.zoom,y:camera.y-100/camera.zoom};
  zoomAt(target,.8,900,300,1200,800);
  for(let i=0;i<60;i++) {
    easeZoomCamera(camera,target,motion,1/60);
    close((point.x-camera.x)*camera.zoom,300);close((point.y-camera.y)*camera.zoom,-100);
  }
  easeZoomCamera(camera,{x:1,y:2,zoom:.02},motion,1/60,true);
  assert.deepEqual(camera,{x:1,y:2,zoom:.02});assert.equal(motion.velocity,0);
});
test('reversing direction responds on the next frame',()=>{
  const camera={x:0,y:0,zoom:.1},motion={velocity:0};
  easeZoomCamera(camera,{x:0,y:0,zoom:1},motion,1/60);
  const before=camera.zoom;
  easeZoomCamera(camera,{x:0,y:0,zoom:.02},motion,1/60);
  assert.ok(camera.zoom<before);
});
