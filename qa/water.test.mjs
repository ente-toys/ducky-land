import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaveField, createWater, maskGrid, shoreDistance, waveHeight, inlandLife, coastDistance} from '../src/pixi/water.js';
const energy = f => f.current.reduce((s, h, i) => s + h * h + (h - f.previous[i]) ** 2, 0);
function field(cols = 65, rows = 49, wet = new Uint8Array(cols * rows).fill(1)) {
  return createWaveField({width: (cols - 1) * 5, height: (rows - 1) * 5, cols, rows, wet});
}
test('a queued impact propagates outward, reflects in the same connected body and decays', () => {
  const f = field(); f.impulse(160, 120, .65, 17);
  assert.equal(energy(f), 0, 'events wait for the fixed step, without rewriting the displayed frame');
  f.step(); const start = energy(f);
  assert.ok(start > 0);
  for (let i = 0; i < 38; i++) f.step();
  assert.ok(Math.abs(f.current[24 * 65 + 44]) > .0001, 'wave reached a point 60 units from the impact');
  for (let i = 0; i < 1560; i++) f.step();
  assert.ok(energy(f) < start * .01, 'energy dies away without residual standing noise');
});
test('a bank reflects without transmitting waves into dry cells or a disconnected pool', () => {
  const cols = 65, rows = 49, wet = new Uint8Array(cols * rows).fill(1);
  for (let y = 0; y < rows; y++) wet[y * cols + 32] = 0;
  const f = field(cols, rows, wet); f.impulse(140, 120, 1, 14);
  for (let i = 0; i < 60; i++) f.step();
  let reflected = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const h = f.current[y * cols + x];
    if (x >= 32) assert.equal(h, 0);
    else reflected += h * h;
  }
  assert.ok(reflected > .001);
});
test('waves reflect at a closed bank and are absorbed at an open ocean boundary', () => {
  const wet = new Uint8Array(65 * 49).fill(1), closed = field(), open = createWaveField({width:320,height:240,cols:65,rows:49,wet,open:true});
  for (const f of [closed, open]) f.impulse(160, 120, 1, 17);
  for (let i = 0; i < 240; i++) {closed.step(); open.step();}
  assert.ok(energy(open) < energy(closed) * .45);
});
test('continuous spills stay finite and clear removes queued forces', () => {
  const f = field();
  for (let i = 0; i < 7200; i++) {if (i % 9 === 0) f.impulse(150, 120, .16, 12); f.step();}
  assert.ok(f.current.every(Number.isFinite));
  assert.ok(Math.max(...f.current.map(Math.abs)) < 3.9, 'does not hit the emergency height clamp');
  assert.equal(f.impulse(NaN, 2), false); assert.equal(f.impulse(1, Infinity), false);
  f.impulse(20, 20); f.clear(); f.step(); assert.equal(energy(f), 0);
});
test('packed 16-bit previous/current heights preserve interpolation through bilinear sampling', () => {
  const f = field(); f.impulse(160, 120, .8, 13); f.step(); f.step();
  const data = f.pack();
  for (const i of f.indices) {
    const a = ((data[i * 4] * 256 + data[i * 4 + 1]) / 65535 - .5) * 8;
    const b = ((data[i * 4 + 2] * 256 + data[i * 4 + 3]) / 65535 - .5) * 8;
    for (const alpha of [0, .25, .5, .75, 1]) assert.ok(Math.abs((a * (1 - alpha) + b * alpha) - (f.previous[i] * (1 - alpha) + f.current[i] * alpha)) < .00007);
  }
});
test('art masks retain the coast and islets, and remove enclosed painted glints from inland physics', () => {
  const width = 21, height = 21, data = new Uint8Array(width * height * 4);
  for (let y = 3; y < 18; y++) for (let x = 3; x < 18; x++) data[(y * width + x) * 4] = 255;
  data[(10 * width + 10) * 4] = 0;
  const inland = maskGrid({width, height, data}, width, height);
  const sea = maskGrid({width, height, data, sea: true}, width, height);
  assert.equal(inland[10 * width + 10], 1); assert.equal(sea[10 * width + 10], 0);
  assert.equal(inland[0], 0); assert.equal(inland[5 * width + 2], 0);
  shoreDistance({width, height, data}, 105, 105);
  assert.equal(data[(10 * width + 10) * 4 + 1], 0);
  assert.ok(data[(10 * width + 11) * 4 + 1] < data[(10 * width + 13) * 4 + 1], 'foam distance grows smoothly away from an island');
});
test('fountain geometry keeps the statue perch and bowl stem dry', () => {
  const width = 21, height = 21, data = new Uint8Array(width * height * 4);
  const wet = maskGrid({width, height, data}, width, height, (u,v) => Math.hypot(u-.5,v-.5) < .45 && Math.hypot(u-.5,v-.5) > .15);
  assert.equal(wet[10 * width + 10], 0);
  assert.equal(wet[10 * width + 15], 1);
  assert.equal(wet[0], 0);
});
test('unavailable WebGL returns a harmless complete API without accessing browser globals', async () => {
  for (const gl of [null, {isContextLost: () => true}]) {
    const water = await createWater({app: {renderer: {gl}}});
    assert.equal(water.active, false); water.update(1, 1); water.edge([]); water.lily({}, {}); water.fountainSplash(0, 0, 1);
    assert.equal(water.splash(0, 0), false); water.pause(); water.dispose(); water.dispose();
  }
});

// boss 5 Nov: plants sample the same interpolated field that is drawn on screen.
test('plant sampling interpolates space and time and stays still after reset', () => {
  const f = field(); f.impulse(160, 120, .8, 17); f.step();
  assert.equal(waveHeight(f, 160, 120, 0), 0);
  assert.ok(waveHeight(f, 160, 120, 1) > 0);
  assert.equal(waveHeight(f, 160, 120, .5), waveHeight(f, 160, 120, 1) / 2);
  const expected = (waveHeight(f, 160, 120) + waveHeight(f, 165, 120)) / 2;
  assert.ok(Math.abs(waveHeight(f, 162.5, 120) - expected) < 1e-8);
  assert.equal(waveHeight(f, -1, 120), 0); assert.equal(waveHeight(f, NaN, 0), 0);
  f.clear(); assert.equal(waveHeight(f, 160, 120), 0);
});
test('wind and occasional fish impacts stay wet, bounded and propagate through the field', () => {
  const wet = new Uint8Array(65 * 49);
  for (let y = 5; y < 44; y++) for (let x = 5; x < 60; x++) wet[y * 65 + x] = 1;
  const f = field(65, 49, wet); let fish = 0, wind = 0;
  for (let tick = 0; tick < 1800; tick++) {
    inlandLife(f, tick / 60, tick, (x,y,s,r) => {
      assert.equal(wet[Math.round(y / f.dy) * f.cols + Math.round(x / f.dx)], 1);
      if (s === .24) fish++; else {wind++; assert.ok(Math.abs(s) <= .025);}
      f.impulse(x,y,s,r);
    });
    f.step();
  }
  assert.equal(fish, 6); assert.equal(wind, 300);
  assert.ok(energy(f) > 0); assert.ok(Math.max(...f.current.map(Math.abs)) < 1);
  inlandLife(field(3,3,new Uint8Array(9)), 0, 97, () => assert.fail('dry body emitted'));
});

// boss 5 Nov: ocean run-up cannot bridge dry land into an inland pond.
test('coast distances cover both shore sides, retain islets and keep remote inland water out of run-up', () => {
  const width = 101, height = 81, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sea = x < 15 || x > 85 || y < 10 || y > 70;
    const islet = x > 4 && x < 9 && y > 28 && y < 36;
    data[(y * width + x) * 4] = sea && !islet ? 255 : 0;
    data[(y * width + x) * 4 + 3] = 255;
  }
  const mask = {width, height, data}, read = (x,y,c) => data[(y * width + x) * 4 + c];
  const coverage = data.filter((_,i) => i % 4 === 0);
  coastDistance(mask, 1010, 810);
  assert.deepEqual(data.filter((_,i) => i % 4 === 0), coverage, 'distance never changes the connected-ocean mask');
  assert.equal(read(14,40,2), 0); assert.ok(read(14,40,1) > 0);
  assert.equal(read(15,40,1), 0); assert.ok(read(15,40,2) > 0);
  assert.ok(read(16,40,2) > read(15,40,2), 'run-up distance increases into sand');
  assert.equal(read(50,40,2), 255, 'inland pond location is beyond maximum surf reach');
  assert.ok(read(6,32,2) > 0); assert.ok(read(4,32,1) > 0, 'islet retains its own shore');
  assert.ok(read(0,0,1) > read(14,40,1), 'shallow band follows the bank');
});
