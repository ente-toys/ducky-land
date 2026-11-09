import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container, Graphics, Sprite, Texture} from 'pixi.js';
import {attachCentreMotion} from '../src/pixi/centre-motion.js';
import {libraryFountainLayout} from '../src/pixi/centre-motion/library.js';
import {fountainPoint, createFountainWater} from '../src/pixi/fountain.js';
import {trackUpright} from '../src/pixi/upright.js';
import {TILT} from '../src/pixi/camera.js';

const manifest = JSON.parse(readFileSync('public/pixi-art/themes/library/art.json'));
const centre = JSON.parse(readFileSync('public/pixi-art/themes/library/centre/centre.json'));
function fixture() {
  const objects = new Container(), ground = new Container();
  const props = manifest.props.filter(p => /centre\/(?:globe|jet-)/.test(p.src)).map(p => {
    const piece = centre.pieces.find(c => p.id.endsWith(c.id));
    const sprite = new Sprite(Texture.EMPTY);
    sprite.position.set(p.x, p.y); sprite.anchor.set(p.anchor.x, p.anchor.y);
    sprite.width = p.width * p.scale; sprite.height = p.height * p.scale;
    sprite.zIndex = p.y; objects.addChild(sprite);
    return {...p, centrePiece: piece, sprite};
  });
  return {objects, art: {id: 'library', props, ground, groups: [ground], destroy() {
    for (const g of this.groups) if (!g.destroyed) g.destroy({children: true});
    for (const p of props) p.sprite.destroy();
  }}};
}
const drawing = root => JSON.stringify(root.children[0].context.instructions.map(({action, data}) =>
  ({action, style: {...data.style, texture: undefined}, path: data.path.instructions})));

test('all Pagepond fountain jets reuse Home flow with fixed mouths, landings and correct upright depth', async () => {
  const {art, objects} = fixture(), layout = libraryFountainLayout(art.props);
  assert.equal(layout.jets.length, 4);
  assert.ok(Math.abs(layout.origin.x - 2412) < 1e-9);
  assert.ok(Math.abs(layout.origin.y - 2566) < 1e-9);
  const upright = trackUpright([[objects]], TILT);
  await attachCentreMotion(art, {Graphics, Container}, objects);
  upright.update(); art.updateCentre(.3, false);
  const roots = art.groups.slice(1);
  assert.equal(roots.length, 4);
  for (const [i, {prop, sortY, spill}] of layout.jets.entries()) {
    const root = roots[i];
    for (const u of [0, 1]) {
      const p = fountainPoint(spill, u), authored = u ? prop.centrePiece.landing : prop.centrePiece.at;
      assert.ok(Math.abs(root.x + p.x * root.scale.x - (layout.origin.x + authored[0] * layout.scale)) < 1e-7);
      assert.ok(Math.abs(root.y + p.y * root.scale.y - (prop.y + (authored[1] - sortY) * layout.scale / TILT)) < 1e-7);
    }
    assert.equal(root.zIndex, prop.sprite.zIndex + .000001);
    assert.equal(prop.sprite.alpha, 0, 'no static jet drawn over the flowing replacement');
    assert.ok(root.children[0].context.instructions.length >= 15, 'flow, highlights, foam and landing rings');
    assert.equal(root.zIndex < art.props.find(p => p.centrePiece.id === 'globe').sprite.zIndex, prop.centrePiece.id.includes('back'));
  }
  const before = roots.map(drawing), shimmer = drawing(art.ground.children[0]);
  for (let i = 1; i <= 60; i++) art.updateCentre(.3 + i / 60, false);
  assert.notDeepEqual(roots.map(drawing), before, 'flow and spray evolve');
  assert.notEqual(drawing(art.ground.children[0]), shimmer, 'Home pool shimmer evolves beneath the globe');
  art.destroy(); upright.destroy(); objects.destroy();
});

test('Pagepond reduced motion restores still SVG jets, clears spray, hides with the island and releases every FX root', async () => {
  const {art, objects} = fixture();
  await attachCentreMotion(art, {Graphics, Container}, objects);
  const roots = art.groups.slice(1), jets = art.props.filter(p => p.centrePiece.animate?.kind === 'jet');
  art.updateCentre(.2, false); art.updateCentre(.3, true);
  const still = roots.map(drawing);
  art.updateCentre(123, true);
  assert.deepEqual(roots.map(drawing), still);
  assert.ok(roots.every(r => r.children[0].context.instructions.length === 0));
  assert.ok(jets.every(p => p.sprite.alpha === 1));
  art.ground.visible = false; art.updateCentre(124, false);
  assert.ok(roots.every(r => !r.visible));
  art.ground.visible = true; jets[0].sprite.visible = false; art.updateCentre(125, false);
  assert.equal(roots[0].visible, false, 'culled jets do no draw work');
  assert.equal(roots[1].visible, true);
  art.destroy(); assert.ok(roots.every(r => r.destroyed));
  assert.equal(objects.children.length, 0); objects.destroy();
});

test('Home fountain still uses its bowl lips and suppresses all moving water with reduced motion', () => {
  const parent = new Container(), fx = createFountainWater({x: 2820, y: 2370, scale: 1.05}, parent);
  const spill = {start: 240, x: 240, bottom: 395, w: 26};
  assert.deepEqual(fountainPoint(spill, 0), {x: 240, y: 308.787234});
  assert.deepEqual(fountainPoint(spill, 1), {x: 240, y: 395});
  assert.deepEqual([fx.root.x, fx.root.y], [2568, 2055]);
  fx.update(.2, false, true); assert.ok(fx.root.children[0].context.instructions.length > 0);
  fx.update(.3, true, true); assert.equal(fx.root.children[0].context.instructions.length, 0);
  parent.destroy({children: true});
});
