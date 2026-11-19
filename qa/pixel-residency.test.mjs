import assert from 'node:assert/strict';
import test from 'node:test';
import {extensions} from 'pixi.js';

test('WebGL recovery restores healthy textures and unblocks callers when reloads fail or stall', async t => {
  let uploader;
  const add = extensions.add;
  t.mock.method(extensions, 'add', function (...items) {
    uploader ??= items.find(item => item.id === 'cacheBackedImage');
    return add.apply(this, items);
  });
  const {cacheBackedPixels, installPixelRecovery, prepareArtPixels} =
    await import('../src/rendering/pixi/art/pixel-residency.js');
  assert.ok(uploader);
  globalThis.requestAnimationFrame = callback => queueMicrotask(callback);
  t.after(() => {delete globalThis.requestAnimationFrame;});
  const warnings = [];
  t.mock.method(console, 'warn', message => warnings.push(message));
  t.mock.timers.enable({apis: ['setTimeout']});

  const noop = () => {};
  const canvas = new EventTarget();
  const gl = {isContextLost: () => false, getParameter: () => 0, pixelStorei: noop,
    texImage2D: noop, texSubImage2D: noop};
  const uploads = [];
  const renderer = {canvas, gl, texture: {bindSource(source) {
    const texture = {};
    uploader.upload(source, texture, gl, 2);
    uploads.push([source.label, texture.width]);
  }}};
  const events = [];
  let finish;
  let complete = new Promise(resolve => {finish=resolve;});
  const uninstall = installPixelRecovery(renderer, {
    lost: () => events.push('lost'),
    restored: () => {events.push('restored'); finish();},
    failed: error => {events.push(error); finish();},
  });
  t.after(uninstall);
  const resource = () => ({close: noop});
  const source = (label, reload) => {
    const events = new Map();
    const texture = {label, resource: resource(), options: {}, once: (name, fn) => events.set(name, fn),
      pixelWidth: 4096, pixelHeight: 1024, resourceWidth: 4096, resourceHeight: 1024};
    t.after(() => events.get('destroy')?.());
    return cacheBackedPixels(texture, reload);
  };
  let badReloads=0, slowReloads=0, healthyReloads=0, finishStalled;
  const failedTexture = source('missing atlas', async () => {
    if(++badReloads===1)throw new Error('one texture download failed');
    return resource();
  });
  const slowTexture = source('stalled atlas', async () => {
    if(++slowReloads===1)return new Promise(resolve=>{finishStalled=resolve;});
    return resource();
  });
  const healthyTexture = source('healthy atlas', async () => {healthyReloads++; return resource();});
  const otherTexture = source('new atlas', async () => resource());
  for(const texture of [failedTexture,slowTexture,healthyTexture])renderer.texture.bindSource(texture);
  uploads.length=0;

  const lose = () => canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true}));
  const restore = () => canvas.dispatchEvent(new Event('webglcontextrestored'));
  lose();
  otherTexture.resource=null;
  let prepared=false;
  const waiting=prepareArtPixels(otherTexture,renderer).then(()=>{prepared=true;});
  await Promise.resolve();
  assert.equal(prepared,false);
  restore();
  await new Promise(setImmediate);
  assert.ok(finishStalled);
  t.mock.timers.tick(4000);
  await complete;
  await waiting;
  assert.deepEqual(events,['lost','restored']);
  assert.deepEqual(uploads,[['missing atlas',1],['stalled atlas',1],['healthy atlas',4096]]);
  assert.equal(failedTexture.pixelWidth,4096,'placeholder preserves atlas geometry');
  assert.equal(healthyReloads,1);
  assert.equal(warnings.length,1);
  let closed=false;
  finishStalled({close:()=>{closed=true;}});
  await new Promise(setImmediate);
  assert.equal(closed,true,'a bitmap that arrives after the deadline is released');

  uploads.length=0;
  complete=new Promise(resolve=>{finish=resolve;});
  lose();
  restore();
  await complete;
  assert.deepEqual(events,['lost','restored','lost','restored']);
  assert.deepEqual(uploads,[['missing atlas',4096],['stalled atlas',4096],['healthy atlas',4096]]);
});
