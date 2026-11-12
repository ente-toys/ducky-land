import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets, Texture, Container} from 'pixi.js';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {createSnowCoverState, updateSnowCover, createSnowCover, snowCrownProfile, drawSnowCap} from '../src/pixi/snow-cover.js';
import {snowPose, createSnowfall, SNOW_POOL_SIZE, SNOW_PHONE_COUNT} from '../src/pixi/snowfall.js';

const {outputFiles: [bundle]} = await build({entryPoints: [fileURLToPath(new URL('../src/pixi/duck.js', import.meta.url))],
  bundle: true, packages: 'external', format: 'esm', write: false});
const code = bundle.text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
const {createDuck, disposeDuckAssets} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const nodes = n => [n, ...n.children.flatMap(nodes)];
const caps = rig => nodes(rig.root).filter(n => n.label?.startsWith('Snow on'));
async function withTextures(fn) {
  const old = {fetch: globalThis.fetch, load: Assets.load, get: Assets.get, unload: Assets.unload};
  globalThis.fetch = async () => ({ok: true, json: async () => JSON.parse(readFileSync('public/pixi-duck/manifest.json'))});
  Assets.load = async () => Texture.EMPTY; Assets.get = () => Texture.EMPTY; Assets.unload = async () => {};
  try {await fn();} finally {await disposeDuckAssets(); globalThis.fetch = old.fetch; Assets.load = old.load; Assets.get = old.get; Assets.unload = old.unload;}
}

test('sleepers build four seeded snow blankets over 2-3 minutes, shiver and start again', () => {
  const phases = new Set(), durations = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const s = createSnowCoverState(seed, true); phases.add(s.phase); durations.add(s.cycleSeconds);
    assert.ok(s.buildSeconds >= 120 && s.buildSeconds <= 180);
    assert.ok(s.cycleSeconds >= 210 && s.cycleSeconds <= 280);
    const start = s.cycleSeconds - s.phase * s.cycleSeconds;
    const stages = new Set();
    for (let t = start + .01; t < start + s.cycleSeconds - .1; t += .1) {
      updateSnowCover(s, t, 'snow', 7); stages.add(s.stage);
    }
    assert.deepEqual([...stages], [0, 1, 2, 3, 4]);
    updateSnowCover(s, start + s.cycleSeconds + .05, 'snow', 7);
    assert.equal(s.stage, 0); assert.ok(s.shiver !== 0); assert.ok(Number.isFinite(s.burstAt));
    updateSnowCover(s, start + s.cycleSeconds + 6, 'snow', 7); assert.equal(s.stage, 1);
  }
  assert.ok(phases.size > 50); assert.ok(durations.size > 25);
});

test('local and remote idle snow starts after four seconds, builds in 60-90s and resets on every activity', () => {
  for (const activity of [{action: 1}, {action: 6}, {speed: 5}, {moving: true}, {version: 2}]) {
    const s = createSnowCoverState(67);
    assert.ok(s.buildSeconds >= 60 && s.buildSeconds <= 90);
    const step = (t, a = {}) => updateSnowCover(s, t, 'snow', a.action ?? 0, a.speed ?? 0, false, a.version ?? 1, a.moving ?? false);
    step(10); step(13.99); assert.equal(s.stage, 0);
    step(14); assert.equal(s.stage, 1);
    step(10 + s.buildSeconds); assert.equal(s.stage, 4);
    step(10 + s.buildSeconds + .01, activity); assert.equal(s.stage, 0);
    assert.equal(s.idleSince, null); assert.ok(Number.isFinite(s.burstAt));
    step(100, {version: activity.version ?? 1}); step(103.99, {version: activity.version ?? 1}); assert.equal(s.stage, 0);
    step(104, {version: activity.version ?? 1}); assert.equal(s.stage, 1);
  }
});

test('only Iceland accumulates snow; reduced motion has a static light cap and no burst', () => {
  for (const sleeping of [false, true]) {
    const s = createSnowCoverState(42, sleeping);
    for (const theme of ['home', 'fair', 'bog', 'sunflower', null]) {
      updateSnowCover(s, 500, theme); assert.equal(s.stage, 0); assert.equal(s.active, false);
    }
    updateSnowCover(s, 0, 'snow', 0, 0, true);
    updateSnowCover(s, 180, 'snow', 0, 0, true); assert.equal(s.stage, 1);
    updateSnowCover(s, 280, 'snow', 0, 0, true); assert.equal(s.stage, 1);
    assert.equal(s.shiver, 0); assert.equal(s.burstAt, -Infinity);
    updateSnowCover(s, 300, 'home'); assert.equal(s.stage, 0); assert.equal(s.idleSince, null);
  }
});

test('snow caps and puffs reuse immutable contexts and fixed children, release on leave and dispose', () => {
  const root = new Container(), cover = createSnowCover(10);
  const surfaces = [{parent: root, x: 0, y: -100, width: 100, rotation: 0}, {parent: root, x: 40, y: -30, width: 60, rotation: .4}];
  cover.track(0, 'snow', 0, 0); cover.track(5, 'snow', 0, 0); cover.render(surfaces);
  const pool = [...root.children], particles = [...pool.find(n => n.label === 'Snow settling and shake-off').children];
  const context = pool[0].context; let redraws = 0; context.on('update', () => redraws++);
  for (let frame = 0; frame < 100; frame++) {cover.track(5 + frame / 60, 'snow', 0, 0); cover.render(surfaces);}
  assert.deepEqual(root.children, pool); assert.equal(redraws, 0);
  cover.track(6.66, 'snow', 1, 165); cover.render(surfaces);
  assert.equal(particles.filter(p => p.visible).length, 12); assert.ok(particles.some(p => p.alpha > 0));
  cover.track(7.66, 'snow', 1, 165); cover.render(surfaces);
  assert.ok(particles.every(p => !p.visible));
  cover.track(8, 'home', 0, 0); assert.equal(root.children.length, 0);
  assert.ok(pool.every(p => p.destroyed)); assert.ok(context.destroyed);
  cover.track(10, 'snow', 0, 0); cover.track(15, 'snow', 0, 0); cover.render(surfaces);
  cover.destroy(); cover.destroy(); assert.equal(root.children.length, 0); root.destroy();
});

test('all eight sleeper poses attach head/back/bed snow to their own moving and mirrored layers', async () => withTextures(async () => {
  for (const pose of ['nod', 'leaf', 'wing', 'hammock', 'rock', 'book', 'chair', 'box']) for (const flip of [false, true]) {
    const rig = await createDuck({sleep: {pose, flip}, seed: 41});
    try {
      rig.trackSnow(80, 'snow', 7, 0, true); rig.update(0, {time: 80, reducedMotion: true});
      const snow = caps(rig); assert.equal(snow.length, 3);
      for(const c of snow)assert.equal(c.visible,c.label!=='Snow on bed'||!['nod','wing'].includes(pose),pose+' '+c.label);
      const head = snow.find(c => c.label === 'Snow on head or hat'), back = snow.find(c => c.label === 'Snow on back'), bed = snow.find(c => c.label === 'Snow on bed');
      assert.equal(head.parent.label, 'duck'); assert.equal(back.parent.label, 'duck');
      assert.notEqual(bed.parent.label, 'duck');
      assert.equal(Math.sign(head.parent.parent.scale.x), flip ? -1 : 1);
      assert.ok(snow.every(c => Number.isFinite(c.x) && c.scale.x > 0));
      rig.clearSnow(); assert.equal(caps(rig).length, 0);
    } finally {rig.dispose();}
  }
}));

test('players snow follows all eight directions and hats, changes outfit safely, and is freed on leave', async () => withTextures(async () => {
  for (const outfit of [{}, {cap: 1}, {cap: 8}, {cap: 12}]) {
    const rig = await createDuck({outfit, seed: 12});
    try {
      const directions = new Set(); let time = 0;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        rig.clearSnow();
        for (let frame = 0; frame < 100; frame++) rig.update(1 / 60, {turn: angle});
        rig.trackSnow(time, 'snow', 0, 0, true); time += 5;
        rig.trackSnow(time, 'snow', 0, 0, true); rig.update(0, {turn: angle, time, reducedMotion: true});
        const snow = caps(rig).filter(c => c.visible); assert.equal(snow.length, 2);
        const head = snow.find(c => c.label === 'Snow on head or hat');
        assert.equal(Boolean(head.parent.label?.startsWith('cap-')), Boolean(outfit.cap));
        let view = head; while (view && !view.label?.startsWith('Direction ')) view = view.parent;
        assert.ok(view); directions.add(view.label);
        assert.ok(Number.isFinite(head.x) && Number.isFinite(head.y));
        if (outfit.cap) {
          const sprite = head.parent.children.find(c => c instanceof Object && c.texture && !c.context && c.visible);
          assert.ok(Math.abs(head.y - sprite.y) < 12, 'snow sits at the hat top: '+JSON.stringify({outfit,angle,headY:head.y,spriteY:sprite.y,scale:sprite.scale.y}));
        }
        const before = head;
        rig.clearSnow(); assert.equal(before.destroyed, true); assert.equal(caps(rig).length, 0);
        time++;
      }
      assert.equal(directions.size, 8);
      rig.trackSnow(500, 'snow', 0, 0); rig.trackSnow(510, 'snow', 0, 0); rig.update(0);
      const prior = caps(rig); await rig.setOutfit({cap: 2});
      assert.ok(prior.every(p => p.destroyed));
    } finally {rig.dispose();}
  }
}));

test('real engine tracks offscreen remote motion and frees local, remote and sleeper cover on leave', async () => withTextures(async () => {
  const {outputFiles: [engineBundle]} = await build({entryPoints: ['src/pixi/engine.js'], bundle: true, packages: 'external',
    platform: 'node', format: 'esm', write: false, define: {'import.meta.env.DEV': 'false',
      'import.meta.url': JSON.stringify(new URL('../src/pixi/engine.js', import.meta.url).href)}});
  let code = engineBundle.text.replaceAll('import.meta.glob(', '(()=>({}))(');
  for (const name of ['pixi.js']) code = code.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
  const {PixiIsland} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const remote = await createDuck({outfit: {}, seed: 31}), local = await createDuck({outfit: {}, seed: 32});
  const sleeper = await createDuck({sleep: {pose: 'wing', flip: false}, seed: 33});
  try {
    const pose = {id: 'abc', x: 100, y: 100, action: 0, turn: 0, travel: 0, emoteVersion: 0, outfit: {}, player: false, mode: 'walking', jumpLeft: 0};
    const entry = {rig: remote, isPlayer: false, outfit: {}, emoteVersion: 0};
    const game = {artShown: 'snow', liveRigs: new Map([['abc', entry]]), rigs: [local],
      mapSleepers: new Map([['snow', [{rig: sleeper}]]]), chatBubbles: new Map(), arts: new Map(), updateBridgeOver() {}};
    for (const t of [0, 90]) PixiIsland.prototype.renderLiveDucks.call(game, [pose], 1 / 60, t, false, () => false);
    assert.equal(remote.snowCover.state.stage, 4); assert.equal(caps(remote).length, 0, 'offscreen does no drawing');
    pose.x += 2;
    PixiIsland.prototype.renderLiveDucks.call(game, [pose], 1 / 60, 90.01, false, () => false);
    assert.equal(remote.snowCover.state.stage, 0, 'position delta resets a remote even if reported speed is zero');
    for (const t of [91, 96]) PixiIsland.prototype.renderLiveDucks.call(game, [pose], 1 / 60, t, false, () => true);
    assert.ok(caps(remote).length);
    local.trackSnow(0, 'snow', 0, 0); local.trackSnow(10, 'snow', 0, 0); local.update(0);
    sleeper.trackSnow(90, 'snow', 7, 0, true); sleeper.update(0, {reducedMotion: true});
    const oldCaps = [...caps(remote), ...caps(local), ...caps(sleeper)]; assert.ok(oldCaps.length >= 7);
    PixiIsland.prototype.showArt.call(game, 'home'); assert.ok(caps(remote).length);
    game.artShown = 'home'; PixiIsland.prototype.showArt.call(game, 'home');
    assert.ok(oldCaps.every(c => c.destroyed));
    assert.equal(caps(remote).length + caps(local).length + caps(sleeper).length, 0);
  } finally {remote.dispose(); local.dispose(); sleeper.dispose();}
}));

test('snow has rounded filled volume that grows, short drips, soft underside shade and Ducky ink', () => {
  const profile = {points: [[0, 20], [25, 14], [50, 12], [75, 14], [100, 20]], width: 100};
  let previousArea = 0;
  for (let stage = 1; stage <= 4; stage++) {
    const cap = drawSnowCap(profile, stage, 2.8);
    try {
      const instructions = cap.context.instructions, fills = instructions.filter(i => i.action === 'fill');
      assert.equal(fills.length, stage <= 2 ? 2 : 1, 'early accumulation is separate patches; mature snow is a continuous cap');
      assert.ok(fills.every(i => i.data.style.color === 0xffffff));
      const ink = instructions.filter(i => i.action === 'stroke' && i.data.style.color === 0x232323);
      assert.ok(ink.every(i => i.data.style.width === 2.8 && i.data.style.join === 'round'));
      assert.ok(instructions.some(i => i.action === 'stroke' && i.data.style.color === 0xc9d6e6 && i.data.style.width < 2.8));
      assert.ok(fills.every(i => !i.data.path.instructions.some(p => p.action === 'lineTo')), 'curved lobes, never a pixel-traced polygon');
      let area = 0;
      for (let x = 0; x <= 100; x++) for (let y = -40; y <= 40; y++) if (cap.containsPoint({x, y})) area++;
      assert.ok(area > previousArea * 1.12, `visible snow area grows at level ${stage}`); previousArea = area;
      assert.ok(cap.bounds.maxY < 30, 'only short overhangs below the surface');
      if (stage === 4) {
        assert.ok(cap.bounds.minY < -20, 'a thick bank stands well above the crown');
        assert.ok(cap.containsPoint({x: 50, y: 0}), 'the cap contains snow volume above the original outline');
      }
    } finally {cap.destroy(true);}
  }
});

test('roof sampling smooths serrations and excludes vertical sides and covered bedding', () => {
  const w = 192, h = 192, pixels = new Uint8Array(w * h * 4);
  for (let x = 8; x < w - 8; x++) {
    const y0 = x < 35 || x > 157 ? 50 + Math.abs(x - 96) * 1.5 : 40 + (x % 2) * 5;
    for (let y = Math.round(y0); y < h; y++) pixels[(y * w + x) * 4 + 3] = 255;
  }
  const roof = snowCrownProfile(pixels, w, h, w, h, [0, 1]);
  assert.ok(roof && roof.segments.length === 1);
  assert.ok(roof.points.every(([x, y]) => x > 30 && x < 163 && y < 53), 'no snow runs down the steep edges');
  for (let i = 1; i < roof.points.length; i++) assert.ok(Math.abs(roof.points[i][1] - roof.points[i - 1][1]) < 1, 'alternating alpha steps become a smooth roof');
  const flaps = snowCrownProfile(pixels, w, h, w, h, [.2, .8, 0, [[.2, .35], [.65, .8]]]);
  assert.equal(flaps.segments.length, 2);
  assert.ok(flaps.points.every(([x]) => x <= w * .35 || x >= w * .65), 'the sleeper stays clear between the exposed flaps');
});

test('smoothed hat roofs ignore transparent padding in all eight directions and share pooled geometry', async () => {
  const sharp = (await import('sharp')).default;
  const {createCanvas, loadImage} = await import('@napi-rs/canvas');
  const data = JSON.parse(readFileSync('public/pixi-duck/manifest.json'));
  for (const hat of data.wardrobe.filter(e => e.slot === 'cap')) for (const [angle, frames] of Object.entries(hat.frames)) {
    if (Number(angle) % 45) continue;
    for (const f of frames.filter(f => f.visible && f.attachment === 'head')) {
      const {data: pixels} = await sharp('public' + f.url).resize(192, 192, {fit: 'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
      const profile = snowCrownProfile(pixels, 192, 192, f.rect[2], f.rect[3]);
      assert.ok(profile && profile.width > 0, hat.id + ' ' + angle);
      for (const [x, y] of profile.points) {
        const px = Math.round(x / f.rect[2] * 192), py = Math.round(y / f.rect[3] * 192);
        let nearest = Infinity;
        for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) {
          if (pixels[((py + dy) * 192 + px + dx) * 4 + 3] > 96) nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
        assert.ok(nearest <= 3, 'smoothed roof stays seated within three sampling pixels of opaque artwork');
      }
    }
  }
  const frame = data.wardrobe.find(e => e.slot === 'cap' && e.index === 1).frames['0'][0];
  const image = await loadImage(await sharp('public' + frame.url).png().toBuffer());
  const texture = {source: {resource: image, resolution: 1}, frame: {x: 0, y: 0, width: image.width, height: image.height}, width: image.width, height: image.height};
  const previous = globalThis.document; globalThis.document = {createElement: () => createCanvas(64, 64)};
  const root = new Container(), covers = [createSnowCover(1), createSnowCover(2)];
  const surface = [{parent: root, x: 0, y: 0, width: 100, rotation: 0, texture, spriteX: 0, spriteY: 0, sx: 1, sy: 1}];
  try {
    for (const c of covers) {c.track(0, 'snow', 0, 0); c.track(5, 'snow', 0, 0); c.render(surface);}
    const snow = root.children.filter(c => c.label === 'Snow on head or hat');
    assert.equal(snow.length, 2); assert.equal(snow[0].context, snow[1].context);
    assert.equal(snow[0].scale.x, 1, 'profile uses decoded texture coordinates');
    const context = snow[1].context; covers[0].destroy(); assert.equal(context.destroyed, false);
    covers[1].destroy(); assert.equal(context.destroyed, true);
  } finally {for (const c of covers) c.destroy(); root.destroy(); globalThis.document = previous;}
});

test('falling snow has solid cool-white bodies and faint offset shadows, with no bubble outlines', () => {
  const stage = new Container(), snow = createSnowfall(stage);
  try {
    const colors = new Set();
    for (const flake of snow.root.children) {
      assert.ok(!flake.filters?.length);
      const instructions = flake.context.instructions;
      assert.ok(instructions.every(i => i.action === 'fill'), 'no outline or crescent strokes');
      const body = instructions.at(-1).data;
      assert.equal(body.style.alpha, 1, 'body is filled through its centre');
      colors.add(body.style.color);
      for (const shadow of instructions.slice(0, 2)) {
        assert.equal(shadow.data.style.color, 0xc9d6e6);
        assert.ok(shadow.data.style.alpha <= .12);
        const firstPoint = path => (path.instructions.find(i => i.action === 'circle') ?? path.instructions[0]).data;
        const [x, y] = firstPoint(shadow.data.path);
        const [bodyX, bodyY] = firstPoint(body.path);
        assert.ok(x > bodyX && y > bodyY, 'shadow is offset down and right');
      }
      const arms = body.path.instructions.filter(i => i.action === 'quadraticCurveTo').length;
      assert.equal(arms, flake.label === 'Six-arm snowflake' ? 6 : 0);
    }
    assert.deepEqual([...colors].sort(), [0xffffff, 0xf5f8fd, 0xedf3fb, 0xe8f0fa].sort());
    for (const [width, count, shapedCount] of [[1440, SNOW_POOL_SIZE, 8], [390, SNOW_PHONE_COUNT, 4]]) {
      snow.update(10, false, 'snow', width, 844, true);
      const visible = snow.root.children.filter(f => f.visible);
      assert.equal(visible.length, count);
      assert.equal(visible.filter(f => f.label === 'Six-arm snowflake').length, shapedCount);
    }
  } finally {snow.destroy(); stage.destroy();}
});

test('far snow is smaller, slower and fainter; only the few near shaped flakes tumble gently', () => {
  const stage = new Container(), snow = createSnowfall(stage);
  try {
    snow.update(0, false, 'snow', 1200, 800, true);
    const near = snow.root.children[0], middle = snow.root.children[1], far = snow.root.children[5];
    assert.ok(far.alpha < middle.alpha && middle.alpha < near.alpha);
    const speed = i => snowPose(i, .1, 1200, 800).y - snowPose(i, 0, 1200, 800).y;
    assert.ok(speed(5) < speed(1) && speed(1) < speed(0));
    assert.ok(far.scale.x < middle.scale.x && middle.scale.x < near.scale.x);
    for (let i = 0; i < SNOW_POOL_SIZE; i++) {
      const a = snowPose(i, 0, 1200, 800), b = snowPose(i, .1, 1200, 800);
      const shaped = snow.root.children[i].label === 'Six-arm snowflake';
      if (shaped) {
        assert.equal(a.size, near.scale.x);
        assert.ok(Math.abs(a.rotation - b.rotation) > 0 && Math.abs(a.rotation - b.rotation) < .02);
      } else assert.equal(b.rotation, 0);
    }
    snow.update(.1, false, 'snow', 1200, 800, true);
    assert.equal(near.rotation, snowPose(0, .1, 1200, 800).rotation);
  } finally {snow.destroy(); stage.destroy();}
});

test('flakes recycle outside the view and reuse the caller pose without visible jumps', () => {
  const out = {};
  for (let i = 0; i < SNOW_POOL_SIZE; i++) for (let t = 0; t < 90; t += .1) {
    const a = snowPose(i, t, 390, 844), b = snowPose(i, t + 1 / 60, 390, 844, out);
    assert.equal(b, out);
    if (Math.abs(a.x - b.x) > 20 || Math.abs(a.y - b.y) > 20) {
      const outside = p => p.x < -p.size || p.x > 390 + p.size || p.y < -p.size || p.y > 844 + p.size;
      assert.ok(outside(a) && outside(b), 'wrap stays beyond the visible edges');
    }
  }
});
