import test from 'node:test';
import assert from 'node:assert/strict';
import {Container} from 'pixi.js';
import {createFountainWater, fountainPoint} from '../src/rendering/pixi/environment/fountain.js';
import {createFountainStream} from '../src/rendering/pixi/environment/fountain-stream.js';

function area(points) {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) sum += points[j].x * points[i].y - points[i].x * points[j].y;
  return Math.abs(sum / 2);
}

test('retained ribbons cover the original curved contour without gaps or overlapping triangles', () => {
  const parent = new Container();
  const spills = [
    {start: 158, x: 130, bottom: 358, w: 14},
    {start: 240, x: 240, bottom: 395, w: 26},
    {start: -106.1, x: -254.6, bottom: -155, w: 18.8, jet: {y: -41.2, cx: -168.1, cy: -348.2}},
  ];
  try {
    for (const sp of spills) {
      const ribbon = createFountainStream(parent, !!sp.jet).ribbons[0];
      for (const [from, to, width] of [[0, 1, 1], [.4, .49, .16], [.97, 1, .16]]) {
        ribbon.update(sp, from, to, width, 0xffffff, 1, fountainPoint);
        const contour = [];
        for (let j = 0; j <= 12; j++) contour.push(fountainPoint(sp, from + (to - from) * j / 12, -1, width));
        for (let j = 0; j <= 12; j++) contour.push(fountainPoint(sp, to, -1 + 2 * j / 12, width));
        for (let j = 11; j >= 0; j--) contour.push(fountainPoint(sp, from + (to - from) * j / 12, 1, width));
        for (let j = 11; j >= 0; j--) contour.push(fountainPoint(sp, from, -1 + 2 * j / 12, width));
        const positions = ribbon.positions, indices = ribbon.mesh.geometry.indexBuffer.data;
        const vertex = i => ({x: positions[i * 2], y: positions[i * 2 + 1]});
        let triangles = 0;
        for (let i = 0; i < indices.length; i += 3) triangles += area([vertex(indices[i]), vertex(indices[i + 1]), vertex(indices[i + 2])]);
        assert.ok(Math.abs(triangles - area(contour)) < .01, `ribbon area: ${triangles} vs ${area(contour)}`);
        for (const point of contour) assert.ok(Array.from({length: positions.length / 2}, (_, i) => vertex(i)).some(p => Math.hypot(p.x - point.x, p.y - point.y) < .0001), 'every contour sample is retained');
      }
    }
  } finally {parent.destroy({children: true});}
});

test('fountain animation reuses geometry and buffers, hides cleanly, and releases resources', () => {
  const parent = new Container(), fx = createFountainWater({x: 2820, y: 2370, scale: 1.05}, parent);
  const shapes = fx.streams.flatMap(s => [...s.ribbons, ...s.rings]);
  const geometry = shapes.map(s => s.mesh.geometry), buffers = shapes.map(s => s.positions);
  const foam = fx.streams.flatMap(s => s.foam), contexts = foam.map(g => g.context);
  fx.update(0, false, true);
  const before = Array.from(buffers[0]);
  for (let i = 1; i <= 750; i++) fx.update(i / 75, false, true);
  assert.notDeepEqual(Array.from(buffers[0]), before, 'stream keeps moving');
  shapes.forEach((s, i) => {assert.equal(s.mesh.geometry, geometry[i]); assert.equal(s.positions, buffers[i]);});
  foam.forEach((g, i) => assert.equal(g.context, contexts[i]));
  assert.ok(fx.graphics.context.instructions.length + fx.droplets.context.instructions.length < 40, 'streams, foam and rings do not rebuild Graphics paths');
  let uploads = 0;
  geometry.forEach(g => g.getBuffer('aPosition').on('update', () => uploads++));
  fx.update(20, false, false);
  assert.equal(uploads, 0, 'culled fountain does no geometry upload');
  fx.update(21, true, true);
  assert.equal(fx.flow.visible, false); assert.equal(fx.droplets.context.instructions.length, 0);
  fx.update(22, false, true); assert.equal(fx.flow.visible, true);
  parent.destroy({children: true});
  assert.ok(geometry.every(g => g.buffers === null && g.indexBuffer === null), 'all retained geometry is released');
});
