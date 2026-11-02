import test from 'node:test';
import assert from 'node:assert/strict';
import { fitZoom, zoomAt, easeCamera } from '../rive/web/island-camera.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);
const worldPoint = (camera, x, y, w, h) => [camera.x + (x - w / 2) / camera.zoom, camera.y + (y - h / 2) / camera.zoom];
test('zoom preserves the world point under an off-centre cursor throughout easing', () => {
  const current = { x: 2700, y: 2200, zoom: .2 }, target = { ...current };
  const before = worldPoint(current, 170, 220, 1280, 800);
  zoomAt(target, .8, 170, 220, 1280, 800);
  for (let i = 0; i < 60; i++) {
    easeCamera(current, target, 1 / 60);
    worldPoint(current, 170, 220, 1280, 800).forEach((v, axis) => near(v, before[axis]));
  }
});
test('fit keeps all four world edges inside both portrait and landscape viewports', () => {
  for (const [w, h] of [[390,844],[1440,900],[844,390]]) {
    const scale=fitZoom(w,h,5800,4400);
    assert.ok(5800*scale <= w && 4400*scale <= h);
    assert.ok(scale > 0);
  }
});
test('camera easing is independent of frame rate and honors reduced motion', () => {
  const a={x:100,y:200,zoom:.2},b={...a},target={x:1000,y:900,zoom:1.5};
  for(let i=0;i<30;i++)easeCamera(a,target,1/30);
  for(let i=0;i<60;i++)easeCamera(b,target,1/60);
  for(const key of ['x','y','zoom'])near(a[key],b[key]);
  easeCamera(a,target,1/60,true);
  for(const key of ['x','y','zoom'])near(a[key],target[key]);
});
