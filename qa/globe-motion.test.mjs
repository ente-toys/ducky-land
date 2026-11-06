import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleGlobeSpin, coastGlobeSpin} from '../src/pixi/globe-motion.js';
import {easeCamera} from '../rive/web/island-camera.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('globe flick travels the same distance at 30, 60 and 144 Hz',()=>{
  const coast=hz=>{
    let spin={x:4,y:-2}, x=0,y=0;
    for(let i=0;i<hz;i++) {const next=coastGlobeSpin(spin,1/hz);x+=next.dx;y+=next.dy;spin=next;}
    return {x,y,vx:spin.x,vy:spin.y};
  };
  const reference=coast(60);
  for(const hz of [30,75,144]) for(const key of Object.keys(reference)) close(coast(hz)[key],reference[key]);
});
test('globe velocity filtering depends on elapsed time, not pointer frequency',()=>{
  const sample=hz=>{let spin=null;for(let i=0;i<hz;i++)spin=sampleGlobeSpin(spin,240/hz,-120/hz,1000/hz);return spin;};
  for(const hz of [30,120,240]) {close(sample(hz).x,sample(60).x);close(sample(hz).y,sample(60).y);}
});
test('globe drag eases between pointer events without overshooting or changing with refresh rate',()=>{
  const move=hz=>{const camera={x:0,y:0,zoom:1},target={x:100,y:-50,zoom:1};for(let i=0;i<hz/10;i++)easeCamera(camera,target,1/hz,false,30);return camera;};
  const a=move(60),b=move(120);close(a.x,b.x);close(a.y,b.y);assert.ok(a.x>90&&a.x<100);
  const camera={x:0,y:0,zoom:1};easeCamera(camera,{x:10,y:20,zoom:2},1/60,true,30);assert.deepEqual(camera,{x:10,y:20,zoom:2});
});
