import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container, DOMAdapter, Texture} from 'pixi.js';
import {loadThemeArt} from '../src/pixi/theme-art.js';
import {createGroundPool} from '../src/pixi/ground-stream.js';
import {mapFor} from '../src/pixi/island-maps.js';
import {createFountainSurface} from '../src/pixi/water.js';
import {basinContains} from '../src/pixi/fountain-basin.js';
import {createFountainWater} from '../src/pixi/fountain.js';
import {trackUpright} from '../src/pixi/upright.js';
import {TILT} from '../src/pixi/camera.js';
import {PALETTE} from '../src/pixi/palette.js';

DOMAdapter.set({...DOMAdapter.get(), createCanvas: () => ({getContext: () => null})});
const manifest = JSON.parse(readFileSync('public/pixi-art/themes/cathedral/art.json'));
const prop = manifest.props.find(p => p.id === 'centre-A-fountain');
const layout = prop.fountainWater.surface;
const drawing = g => JSON.stringify(g.context.instructions.map(({action, data}) =>
  ({action, style: {...data.style, texture: undefined}, path: data.path.instructions})));

test('Bellovo mounts one Home fountain effect with the same surface shader, colours and upright registration', async t => {
  const oldFetch = globalThis.fetch; t.after(() => globalThis.fetch = oldFetch);
  globalThis.fetch = async url => ({ok: true, json: async () => JSON.parse(readFileSync('public' + url))});
  const objects = new Container(), pool = createGroundPool({acquire: async () => Texture.EMPTY, release() {}});
  const upright = trackUpright([[objects]], TILT);
  const art = await loadThemeArt(mapFor('cathedral'), {groundPool: pool, acquire: async () => Texture.EMPTY, release() {}});
  const homeParent = new Container();
  const home = createFountainSurface({id: 'pool', rect: {x: 0, y: 0, width: 480, height: 480},
    cols: 81, rows: 81, parent: homeParent, mask: {width: 2, height: 2, data: new Uint8Array(16).fill(255)}});
  const fx = art.fountainWaters[0], surface = fx.surface;
  try {
    assert.equal(art.fountainWaters.length, 1);
    assert.equal(art.groups.filter(group => group === fx.root).length, 1, 'loader owns fountain root exactly once');
    objects.addChild(fx.root); upright.update();
    assert.equal(surface.shader.glProgram, home.shader.glProgram, 'exact Home height-water shader');
    for (const name of ['uWater', 'uCream', 'uInk']) assert.deepEqual(surface.uniforms[name], home.uniforms[name]);
    assert.equal(surface.field.cols, home.field.cols);
    assert.equal(fx.root.parent, objects);
    assert.equal(surface.mesh.parent, fx.root);
    assert.equal(fx.graphics.parent, fx.root);
    assert.equal(fx.root.children.filter(c => c.label === 'Water - pool').length, 1);
    assert.equal(surface.uniforms.uSolid, 1, 'surface supplies the removed blue SVG base');
    assert.ok(fx.graphics.mask, 'jets, splashes and foam share the basin clip');
    assert.deepEqual([fx.root.x, fx.root.y, fx.root.scale.x, fx.root.scale.y], [3620, 2420, 1, 1 / TILT]);
    assert.equal(fx.root.zIndex, prop.sortY + .5);
    const engine = readFileSync('src/pixi/engine.js', 'utf8');
    assert.match(engine, /id===this.artShown&&visible\(fx.x,fx.y,650\)/, 'engine gates the effect by shown island and viewport');
  } finally {
    art.destroy(); home.dispose(); homeParent.destroy(); pool.destroy(); upright.destroy(); objects.destroy();
  }
  assert.equal(surface.mesh.destroyed, true);
  assert.equal(surface.heights.destroyed, true);
  assert.equal(surface.clip.destroyed, true);
  assert.equal(fx.graphics.destroyed, true);
});

test('Bellovo water pixels and simulated cells stay inside the basin and outside the complete raised island', () => {
  const parent = new Container(), fx = createFountainWater(prop, parent, null, prop.fountainWater);
  try {
    const {surface} = fx, mask = surface.clip.resource;
    let wet = 0;
    for (let y = 0; y < layout.height; y++) for (let x = 0; x < layout.width; x++) {
      if (!mask[(y * layout.width + x) * 4]) continue;
      wet++;
      assert.ok(basinContains(layout, x * layout.width / (layout.width - 1), y * layout.height / (layout.height - 1)));
    }
    assert.ok(wet > 240000);
    for (const [x, y] of [[480, 300], [480, 190], [480, 390], [305, 330], [30, 300], [480, 551]]) {
      assert.equal(surface.contains(x, y), false, 'stone, island or outside: ' + [x, y]);
    }
    for (const sp of prop.fountainWater.spills) assert.ok(surface.contains(sp.x, sp.bottom + 3), 'jet lands in live water');
    const field = surface.field;
    for (let y = 0; y < field.rows; y++) for (let x = 0; x < field.cols; x++) {
      assert.equal(Boolean(field.wet[y * field.cols + x]), basinContains(layout, x * field.dx, y * field.dy));
    }
    const svg = readFileSync('public/pixi-art/themes/cathedral/centre-A/fountain.svg', 'utf8');
    assert.match(svg, /rx="415" ry="250" fill="none"/);
    assert.doesNotMatch(svg, /#67bcc3|id="(?:jet|foam)"/i);
    assert.match(svg, /rx="162" ry="85" fill="#a7b65b"/, 'olive lawn art retained');
  } finally {parent.destroy({children: true});}
});

test('Home impacts move Bellovo waves and jets, hidden islands do no work, reduced motion freezes and disposal frees resources', () => {
  const parent = new Container(), fx = createFountainWater(prop, parent, null, prop.fountainWater), surface = fx.surface;
  try {
    let uploads = 0; surface.heights.on('update', () => uploads++);
    fx.update(0, false, true);
    const before = drawing(fx.graphics);
    for (let i = 1; i <= 60; i++) fx.update(i / 60, false, true);
    assert.notEqual(drawing(fx.graphics), before, 'shared flow, landing rings and spray evolve');
    assert.ok(fx.graphics.context.instructions.some(i => i.data.style?.color === PALETTE.water), 'jet ribbons use Home water colour');
    assert.ok(surface.field.current.some(h => Math.abs(h) > .00001), 'Home jet impacts drive the actual height field');
    assert.ok(surface.uniforms.uTime > .99);
    assert.ok(uploads > 0);
    const steps = surface.field.steps, upload = uploads, hidden = drawing(fx.graphics);
    fx.update(2, false, false); fx.update(3, false, false);
    assert.equal(fx.root.visible, false); assert.equal(surface.mesh.visible, false);
    assert.equal(surface.field.steps, steps); assert.equal(uploads, upload);
    assert.equal(drawing(fx.graphics), hidden, 'no hidden redraw');
    fx.update(100, false, true); assert.equal(surface.field.steps, steps, 'no catch-up on returning');
    fx.update(101, true, true);
    const frozen = [...surface.field.packed], reducedSteps = surface.field.steps;
    fx.update(200, true, true);
    assert.deepEqual([...surface.field.packed], frozen);
    assert.equal(surface.field.steps, reducedSteps);
    assert.equal(surface.uniforms.uTime, 0); assert.equal(surface.uniforms.uCalm, 1);
    assert.equal(fx.graphics.context.instructions.length, 0, 'Home suppresses jets and spray with reduced motion');
    fx.update(201, false, true); assert.ok(surface.field.steps > reducedSteps);
  } finally {parent.destroy({children: true});}
});
