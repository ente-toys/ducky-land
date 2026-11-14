import {ART_TIMEOUT_MS} from '../src/rendering/pixi/art/art-recovery.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container, Texture} from 'pixi.js';
import {mapFor} from '../src/world/island-maps.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {createIcelandLife, createIcelandLifeLifecycle, ICELAND_SMOKE, BIRD_FLEE_RADIUS} from '../src/rendering/pixi/environment/iceland-life.js';

const manifest = JSON.parse(readFileSync(new URL('../public/pixi-art/themes/snow/art.json', import.meta.url)));
const snow = mapFor('snow'), visible = () => true, tilt = .72;
const make = () => createIcelandLife(manifest, Texture.WHITE, {tilt, walkable: snow.nav().walkable});
const pose = life => life.roots.flatMap(r => [r.x, r.y, r.zIndex, ...r.children.flatMap(c => [c.x, c.y, c.alpha, c.width, c.height, c.rotation, c.visible])]);

test('every approved building chimney, facade window and lamp gets pooled Iceland life at its authored depth', () => {
  const life = make(), parent = new Container({sortableChildren: true});
  try {
    life.mount(parent);
    const buildings = manifest.props.filter(p => p.finalKind === 'building');
    const lamps = manifest.props.filter(p => p.finalRole === 'lamp');
    assert.equal(life.chimneys.length, buildings.length);
    assert.equal(life.chimneys.length, 14);
    assert.equal(life.glows.filter(g => g.pad).length, lamps.length);
    for (const p of buildings) {
      const c = life.chimneys.find(c => c.root.label === 'Iceland life ' + p.id);
      assert.equal(c.root.x, p.x); assert.equal(c.root.y, p.y);
      assert.equal(c.root.zIndex, (p.z ?? p.sortY ?? p.y) + .02);
      assert.equal(c.puffs.length, 3);
      assert.equal(new Set(c.puffs.map(p => p.offset)).size, 3);
      assert.ok(life.glows.filter(g => g.owner === c.root).length >= 2);
      const authored = manifest.props.find(s => s.id === p.id + '-chimney-smoke');
      if (authored) {assert.equal(c.sx, authored.x - p.x); assert.equal(c.sy, authored.y - p.y);}
    }
    for (const root of life.roots) {
      assert.equal(root.parent, parent); assert.equal(root.scale.y, 1 / tilt);
      assert.equal(root.upright, true); assert.equal(root.eventMode, 'none');
      assert.ok(!root.filters?.length);
    }
    for (const g of life.glows) {
      const fills = g.root.context.instructions.filter(i => i.action === 'fill');
      assert.equal(fills.length, 3);
      assert.ok(fills.every(i => i.data.style.color === 0xffd27a && i.data.style.alpha < .08));
      assert.ok(!g.root.filters?.length);
    }
  } finally {life.destroy(); parent.destroy();}
});

test('smoke rises, drifts and fades in staggered cycles; glow gently flickers without geometry changes', () => {
  const life = make();
  try {
    const c = life.chimneys[0], p = c.puffs[0].sprite, g = life.glows[0].root;
    const geometry = g.context.instructions, children = c.root.children.slice();
    life.update(1, false, visible); const a = {x:p.x, y:p.y, alpha:p.alpha, glow:g.alpha};
    life.update(3, false, visible); const b = {x:p.x, y:p.y, alpha:p.alpha};
    assert.ok(b.y < a.y); assert.ok(b.x > a.x); assert.ok(b.alpha > a.alpha);
    life.update(7.49, false, visible); assert.ok(p.alpha < .003);
    assert.notEqual(g.alpha, a.glow);
    assert.equal(g.context.instructions, geometry); assert.deepEqual(c.root.children, children);
    assert.equal(new Set(c.puffs.map(p => p.sprite.y)).size, 3);
    assert.ok(g.alpha >= .745 && g.alpha <= .955);
  } finally {life.destroy();}
});

test('eight two-frame robins and blue tits occupy clear snow beside current yards and groves', () => {
  const life = make();
  try {
    assert.equal(life.birds.length, 8);
    assert.equal(life.birds.filter(b => b.site.blue).length, 4);
    assert.ok(life.birds.some(b => b.site.id.startsWith('yard-')));
    assert.ok(life.birds.some(b => b.site.id.startsWith('grove-')));
    const walkable = snow.nav().walkable;
    for (const b of life.birds) {assert.ok(walkable(b.x, b.y), b.site.id); assert.equal(b.frames.length, 2);}
    let hopping = false, pecking = false;
    const roots = life.roots.slice(), frames = life.birds.map(b => b.frames.slice());
    for (let t = 0; t < 25; t += .08) {
      life.update(t, false, visible);
      for (const b of life.birds) {
        hopping ||= b.body.y < -1; pecking ||= b.frames[1].visible;
        assert.ok(walkable(b.x, b.y), b.site.id + ' stays on snow');
        assert.notEqual(b.frames[0].visible, b.frames[1].visible);
      }
    }
    assert.ok(hopping && pecking); assert.deepEqual(life.roots, roots);
    life.birds.forEach((b, i) => assert.deepEqual(b.frames, frames[i]));
  } finally {life.destroy();}
});

test('nearby local or remote Duckies trigger a short flight away at about 120px, with a cooldown', () => {
  for (const remote of [false, true]) {
    const life = createIcelandLife(manifest, Texture.WHITE);
    try {
      const b = life.birds.at(-1), duck = {x:b.x - 100, y:b.y, mode:'walking'};
      assert.equal(BIRD_FLEE_RADIUS, 120);
      life.update(.1, false, visible, true, remote ? null : duck, remote ? [duck] : null);
      assert.equal(b.fleeing, true); assert.ok(b.toX > b.fromX);
      assert.ok(Math.abs(Math.hypot(b.toX - b.fromX, b.toY - b.fromY) - 165) < 1e-6);
      life.update(.46, false, visible, true, remote ? null : duck, remote ? [duck] : null);
      assert.ok(b.body.y < -40);
      life.update(.83, false, visible); assert.ok(Math.abs(b.body.y) < 1e-6);
      assert.ok(b.x - duck.x > BIRD_FLEE_RADIUS);
      const started = b.started;
      duck.x = b.x - 60;
      life.update(.9, false, visible, true, duck);
      assert.equal(b.started, started, 'does not constantly retrigger');
    } finally {life.destroy();}
  }
});

test('offscreen and hidden effects skip pose work, while reduced motion is completely static', () => {
  const life = make();
  try {
    life.update(4, false, visible); const before = pose(life);
    life.update(8, false, () => false); assert.deepEqual(pose(life), before);
    assert.ok(life.roots.every(r => !r.visible));
    life.update(9, false, visible, false); assert.deepEqual(pose(life), before);
    life.update(10, true, visible); const still = pose(life);
    life.update(1000, true, visible, true, {x:life.birds[0].site.x, y:life.birds[0].site.y});
    assert.deepEqual(pose(life), still);
    assert.ok(life.birds.every(b => b.body.y === 0 && b.body.rotation === 0));
  } finally {life.destroy();}
});

test('loader lifecycle leases once, releases on leave, remounts on re-entry and destroys idempotently', async () => {
  const acquired = [], released = [], groups = [], parent = new Container();
  const options = {tilt, acquire:async src => {acquired.push(src); return Texture.WHITE;}, release:src => released.push(src)};
  assert.equal(createIcelandLifeLifecycle({id:'home'}, manifest, options), null);
  assert.equal(createIcelandLifeLifecycle({id:'snow'}, {}, options), null);
  const owner = createIcelandLifeLifecycle(snow, manifest, options);
  try {
    const [a, b] = await Promise.all([owner.ensure(parent, groups), owner.ensure(parent, groups)]);
    assert.equal(a, b); assert.equal(acquired.length, 1); assert.equal(groups.length, a.roots.length);
    assert.ok(a.roots.every(r => !r.visible && r.parent === parent));
    owner.release(); assert.equal(owner.current, null); assert.equal(groups.length, 0); assert.equal(parent.children.length, 0);
    assert.ok(a.roots.every(r => r.destroyed)); assert.deepEqual(released, [ICELAND_SMOKE]);
    const c = await owner.ensure(parent, groups); assert.notEqual(c, a); assert.equal(acquired.length, 2);
    owner.destroy(); owner.destroy(); assert.equal(released.length, 2); assert.equal(groups.length, 0);
    assert.equal(await owner.ensure(parent, groups), null);
    assert.equal(Texture.WHITE.destroyed, false, 'shared texture is released, never destroyed by sprites');
  } finally {owner.destroy(); parent.destroy();}
});

test('leaving during an acquire never mounts stale life or steals the new visit lease', async () => {
  const waits = [], released = [], groups = [], parent = new Container();
  const owner = createIcelandLifeLifecycle(snow, manifest, {
    acquire:() => new Promise(resolve => waits.push(resolve)), release:src => released.push(src),
  });
  try {
    const old = owner.ensure(parent, groups); owner.release();
    const fresh = owner.ensure(parent, groups);
    waits[0](Texture.WHITE); assert.equal(await old, null); assert.equal(groups.length, 0);
    waits[1](Texture.WHITE); const life = await fresh; assert.equal(owner.current, life);
    assert.equal(released.length, 1); assert.ok(groups.length > 0);
    owner.destroy(); assert.equal(released.length, 2); assert.equal(parent.children.length, 0);
  } finally {owner.destroy(); parent.destroy();}
});

test('theme loader owns Iceland life and its smoke lease, including failed acquisitions', async t => {
  const fetchBefore = globalThis.fetch, acquired = [], released = [];
  const small = {...manifest, ground:{tiles:[]}, flats:[], decks:[], props:manifest.props.filter(p => p.finalKind === 'building' || p.finalKind === 'smoke')};
  globalThis.fetch = async src => ({ok:true, json:async () => String(src).endsWith('art.json') ? small : {pieces:[]}});
  const groundPool = {create:() => ({destroy(){}})};
  let art;
  try {
    art = await loadThemeArt(snow, {groundPool, tilt, acquire:async src => {acquired.push(src); return Texture.WHITE;}, release:src => released.push(src)});
    assert.ok(art.icelandLife.current); assert.equal(art.icelandLife.current.chimneys.length, 14);
    assert.equal(acquired.filter(src => src === ICELAND_SMOKE).length, 1);
    assert.ok(art.props.every(p => p.finalKind !== 'smoke'), 'static smoke stamp is replaced by the puff pool');
    const life = art.icelandLife.current;
    art.destroy(); art.destroy();
    assert.ok(life.roots.every(r => r.destroyed)); assert.equal(released.filter(src => src === ICELAND_SMOKE).length, 1);
    assert.deepEqual(acquired.slice().sort(), released.slice().sort());
    const failed = createIcelandLifeLifecycle(snow, manifest, {acquire:async () => {throw Error('smoke unavailable');}, release:src => released.push(src)});
    t.mock.timers.enable({apis:['setTimeout']});
    const pending=failed.ensure(null, []);await new Promise(setImmediate);
    t.mock.timers.tick(ART_TIMEOUT_MS);
    const degraded=await pending;assert.ok(degraded);assert.equal(failed.current,degraded);failed.destroy();
  } finally {art?.destroy(); globalThis.fetch = fetchBefore;}
});
