import {Container, Graphics} from 'pixi.js';

const INK = 0x232323, SHADE = 0xc9d6e6, PUFF_SECONDS = .85;
const hash = n => {let h = (n | 0) ^ 0x9e3779b9; h = Math.imul(h ^ h >>> 16, 0x45d9f3b); return (Math.imul(h ^ h >>> 16, 0x45d9f3b) ^ h >>> 16) >>> 0;};
export function createSnowCoverState(seed = 0, sleeping = false) {
  const h = hash(seed);
  return {sleeping, buildSeconds: sleeping ? 120 + h % 61 : 60 + h % 31,
    cycleSeconds: 210 + h % 71, phase: (hash(seed + 81) % 10000) / 10000,
    stage: 0, idleSince: null, cycle: null, burstAt: -Infinity, shiver: 0,
    time: 0, lastTime: null, version: undefined, active: false, reduced: false};
}
export function updateSnowCover(s, time, theme, action = 0, speed = 0, reduced = false, version, moving = false) {
  if (theme !== 'snow') {
    s.stage = 0; s.active = false; s.idleSince = null; s.cycle = null;
    s.burstAt = -Infinity; s.shiver = 0; s.lastTime = null; return s;
  }
  s.active = true; s.time = time; s.reduced = reduced;
  const backwards = s.lastTime !== null && time < s.lastTime;
  if (backwards) {s.idleSince = null; s.cycle = null; s.burstAt = -Infinity;}
  const gap = s.lastTime === null ? Infinity : time - s.lastTime;
  if (s.sleeping) {
    const age = time + s.phase * s.cycleSeconds;
    const cycle = Math.floor(age / s.cycleSeconds), elapsed = age - cycle * s.cycleSeconds;
    if (!reduced && s.cycle !== null && cycle !== s.cycle && gap < 1) s.burstAt = time - elapsed;
    s.cycle = cycle;
    s.stage = reduced ? 1 : elapsed < 5 ? 0 : Math.min(4, 1 + Math.floor((elapsed - 5) / (s.buildSeconds / 3)));
  } else {
    const idle = (action === 0 || action === 'idle') && Math.abs(speed) < 1 && !moving
      && (s.version === undefined || version === undefined || s.version === version);
    if (!idle) {
      if (s.stage > 0 && !reduced && gap < 1) s.burstAt = time;
      s.stage = 0; s.idleSince = null;
    } else {
      if (s.idleSince === null) s.idleSince = time;
      const elapsed = time - s.idleSince;
      s.stage = elapsed < 4 ? 0 : reduced ? 1 : Math.min(4, 1 + Math.floor((elapsed - 4) / ((s.buildSeconds - 4) / 3)));
    }
  }
  if (reduced) s.burstAt = -Infinity;
  s.shiver = !reduced && time - s.burstAt < .65 ? (1 - (time - s.burstAt) / .65) * Math.sin((time - s.burstAt) * 36) * .035 : 0;
  s.lastTime = time; s.version = version;
  return s;
}

let geometry = null, owners = 0;
function acquireGeometry() {
  if (!geometry) {
    const caps = [];
    const profile = {points: [[-50, 0], [-25, -2], [0, -3], [25, -2], [50, 0]],
      segments: [[[-50, 0], [-25, -2], [0, -3], [25, -2], [50, 0]]], width: 100};
    for (let stage = 1; stage <= 4; stage++) caps.push(drawSnowCap(profile, stage, 2.8));
    geometry = {caps, flake: new Graphics().circle(0, 0, 1).fill(0xffffff).stroke({color: SHADE, width: .45})};
  }
  owners++; return geometry;
}
function releaseGeometry() {
  if (--owners) return;
  for (const g of geometry.caps) g.destroy(true);
  geometry.flake.destroy(true); geometry = null;
}

export function snowCrownProfile(pixels, w, h, sourceWidth, sourceHeight, region = null) {
  const tops = new Float32Array(w); tops.fill(-1);
  let left = w, right = -1;
  for (let x = 0; x < w; x++) for (let y = Math.max(0, Math.floor((region?.[2] || 0) * h)); y < h; y++) if (pixels[(y * w + x) * 4 + 3] > 96) {
    tops[x] = y / h * sourceHeight; left = Math.min(left, x); right = Math.max(right, x); break;
  }
  if (right - left < 3) return null;
  const x0 = Math.max(left, Math.ceil(region ? region[0] * w : left + (right - left) * .18));
  const x1 = Math.min(right, Math.floor(region ? region[1] * w : right - (right - left) * .18));
  const radius = Math.max(2, Math.round((right - left) * .035)), median = [];
  for (let x = left; x <= right; x++) {
    const values = [];
    for (let j = Math.max(left, x - radius); j <= Math.min(right, x + radius); j++) if (tops[j] >= 0) values.push(tops[j]);
    values.sort((a, b) => a - b); median[x] = values[Math.floor(values.length / 2)];
  }
  const smooth = x => {
    let sum = 0, weight = 0;
    for (let j = Math.max(left, x - radius); j <= Math.min(right, x + radius); j++) {
      const k = radius + 1 - Math.abs(j - x); sum += median[j] * k; weight += k;
    }
    return sum / weight;
  };
  const segments = []; let run = [];
  const finish = () => {
    if (run.length >= 3 && run.at(-1)[0] - run[0][0] >= sourceWidth * .035) segments.push(run);
    run = [];
  };
  const dx = sourceWidth / w, step = Math.max(1, Math.round(w / 96));
  for (let x = x0; x <= x1; x += step) {
    const y = smooth(x), before = smooth(Math.max(left, x - 2)), after = smooth(Math.min(right, x + 2));
    const slope = (after - before) / (Math.min(right, x + 2) - Math.max(left, x - 2)) / dx;
    if (tops[x] < 0 || (region?.[3] && !region[3].some(([a, b]) => x / w >= a && x / w <= b)) || Math.abs(slope) > .95 || (run.length && Math.abs(y - run.at(-1)[1]) > dx * step * 1.4)) {finish(); continue;}
    run.push([x * dx, y + sourceHeight / h * .35]);
  }
  finish();
  if (!segments.length) return null;
  const points = segments.flat(), width = Math.max(...segments.map(p => p.at(-1)[0] - p[0][0]));
  const middle = points[Math.floor(points.length / 2)];
  return {points, segments, width, x: middle[0], y: middle[1]};
}

function surfaceY(points, x) {
  for (let i = 1; i < points.length; i++) if (x <= points[i][0]) {
    const a = points[i - 1], b = points[i], u = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u;
  }
  return points.at(-1)[1];
}
function curve(g, points, move = false) {
  if (move) g.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], prev = points[Math.max(0, i - 2)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0], tangent = (p, q, r) => (q[1] - p[1]) * (r[1] - q[1]) <= 0 ? 0 : (r[1] - p[1]) / (r[0] - p[0]);
    g.bezierCurveTo(a[0] + dx / 3, a[1] + tangent(prev, a, b) * dx / 3,
      b[0] - dx / 3, b[1] - tangent(a, b, next) * dx / 3, ...b);
  }
}
export function drawSnowCap(profile, stage, ink = 8, depthWidth = profile.width) {
  const g = new Graphics(), patches = stage === 1 ? [[.10, .40], [.64, .91]] : stage === 2 ? [[.025, .53], [.57, .98]] : [[0, 1]];
  for (const points of profile.segments || [profile.points]) for (const [from, to] of patches) {
    const span = points.at(-1)[0] - points[0][0], x0 = points[0][0] + span * from, x1 = points[0][0] + span * to;
    if (x1 - x0 < ink * 1.5) continue;
    const depth = Math.max(ink * 1.1, Math.min(depthWidth, span * 1.5) * [0, .08, .145, .235, .32][stage]);
    const width = x1 - x0, base = x => surfaceY(points, x), seat = ink * .42;
    const top = [[0, .38], [.12, .9], [.28, 1.04], [.43, .87], [.60, 1.12], [.78, .94], [.91, .84], [1, .34]]
      .map(([u, rise]) => [x0 + u * width, base(x0 + u * width) - depth * rise]);
    const bottom = [[0, 0], [.12, .02], [.22, .02], [.27, .33], [.32, .04], [.53, .01], [.64, .02], [.70, .23], [.76, .02], [.9, .01], [1, 0]]
      .map(([u, drip]) => [x0 + u * width, base(x0 + u * width) + seat + depth * drip]);
    curve(g, top, true);
    g.bezierCurveTo(x1 + ink * .45, top.at(-1)[1] + depth * .15, x1 + ink * .35, bottom.at(-1)[1], ...bottom.at(-1));
    curve(g, [...bottom].reverse());
    g.bezierCurveTo(x0 - ink * .35, bottom[0][1], x0 - ink * .45, top[0][1] + depth * .15, ...top[0]);
    g.closePath().fill(0xffffff).stroke({color: INK, width: ink, join: 'round', cap: 'round'});
    const shade = bottom.slice(1, -1).map(([x, y]) => [x, y - ink * .85]);
    curve(g, shade, true); g.stroke({color: SHADE, width: ink * .48, cap: 'round', join: 'round'});
  }
  return g;
}
const crownCache = new Map();
function acquireCrown(texture, region = null, key = '', ink = 8, depthWidth) {
  const variants = crownCache.get(texture);
  const existing = variants?.get(key);
  if (existing) {existing.users++; return existing;}
  let profile = null, sampled = false;
  try {
    const resource = texture.source.resource, canvas = document.createElement('canvas');
    canvas.width = canvas.height = 192;
    const ctx = canvas.getContext('2d', {willReadFrequently: true}), f = texture.frame, r = texture.source.resolution;
    ctx.drawImage(resource, f.x * r, f.y * r, f.width * r, f.height * r, 0, 0, 192, 192);
    sampled = texture.width > 2 && texture.height > 2;
    profile = snowCrownProfile(ctx.getImageData(0, 0, 192, 192).data, 192, 192, texture.width, texture.height, region);
  } catch {  }
  const caps = [];
  if (profile) for (let stage = 1; stage <= 4; stage++) caps.push(drawSnowCap(profile, stage, ink, depthWidth));
  const entry = {profile, sampled, caps, users: 1, texture, key};
  const cache = variants || new Map(); cache.set(key, entry); crownCache.set(texture, cache); return entry;
}
function releaseCrown(entry) {
  if (--entry.users) return;
  for (const g of entry.caps) g.destroy(true);
  const variants = crownCache.get(entry.texture); variants.delete(entry.key);
  if (!variants.size) crownCache.delete(entry.texture);
}

export function createSnowCover(seed = 0, sleeping = false) {
  const state = createSnowCoverState(seed, sleeping);
  let visual = null, destroyed = false;
  function clear() {
    if (!visual) return;
    for (const cap of visual.caps) {cap.removeFromParent(); cap.destroy();}
    visual.fx.removeFromParent(); visual.fx.destroy({children: true});
    for (const entry of visual.crowns.values()) releaseCrown(entry);
    visual = null; releaseGeometry();
  }
  function track(time, theme, action, speed, reduced, version, moving) {
    if (destroyed) return;
    updateSnowCover(state, time, theme, action, speed, reduced, version, moving);
    if (!state.active) clear();
  }
  function render(surfaces) {
    if (destroyed || !state.active) return;
    const burst = state.time - state.burstAt;
    if (!visual && (state.stage || burst < PUFF_SECONDS)) {
      const shared = acquireGeometry(), fx = new Container({label: 'Snow settling and shake-off', eventMode: 'none'});
      const caps = Array.from({length: 3}, () => new Graphics(shared.caps[0].context));
      const particles = Array.from({length: 12}, () => {const p = new Graphics(shared.flake.context); fx.addChild(p); return p;});
      visual = {shared, caps, particles, fx, crowns: new Map()};
    }
    if (!visual) return;
    let headCrown = null;
    for (let i = surfaces.length; i < visual.caps.length; i++) visual.caps[i].visible = false;
    for (let i = 0; i < surfaces.length; i++) {
      const at = surfaces[i], cap = visual.caps[i];
      if (cap.parent !== at.parent) at.parent.addChild(cap);
      cap.label = i === 0 ? 'Snow on head or hat' : i === 1 ? 'Snow on back' : 'Snow on bed';
      cap.visible = state.stage > 0 && at.width > 0;
      let crown = null;
      if (at.texture) {
        const key = at.crownKey || at.texture;
        crown = visual.crowns.get(key);
        if (!crown) {crown = acquireCrown(at.texture, at.region, at.crownKey, at.ink, at.depthWidth); visual.crowns.set(key, crown);}
      }
      if (crown?.sampled && !crown.profile) cap.visible = false;
      if (i === 0) headCrown = crown?.profile;
      if (!cap.visible) continue;
      const profiled = Boolean(crown?.profile), context = (profiled ? crown.caps : visual.shared.caps)[state.stage - 1].context;
      if (cap.context !== context) cap.context = context;
      cap.position.set(profiled ? at.spriteX : at.x, profiled ? at.spriteY : at.y);
      cap.scale.set(profiled ? at.sx : at.width / 100, profiled ? at.sy : at.width / 100);
      cap.rotation = at.rotation || 0;
    }
    const head = surfaces[0], fx = visual.fx;
    if (fx.parent !== head.parent) head.parent.addChild(fx);
    fx.position.set(headCrown ? head.spriteX + headCrown.x * head.sx : head.x,
      headCrown ? head.spriteY + headCrown.y * head.sy : head.y);
    fx.scale.set((headCrown ? headCrown.width * head.sx : head.width) / 100); fx.rotation = head.rotation || 0;
    fx.visible = !state.reduced;
    if (!fx.visible) return;
    for (let i = 0; i < visual.particles.length; i++) {
      const p = visual.particles[i];
      if (burst >= 0 && burst < PUFF_SECONDS) {
        const u = burst / PUFF_SECONDS, side = i % 2 ? 1 : -1;
        p.visible = true; p.x = (i % 5 - 2) * 16 + side * u * (22 + i * 3);
        p.y = -4 - (18 + i % 4 * 5) * u + 70 * u * u;
        p.alpha = (1 - u) * .95; p.scale.set(1.2 + i % 3 * .45);
      } else {
        const u = (state.time * .24 + i * .337 + state.phase) % 1;
        p.visible = state.stage > 0 && i < 3;
        if (!p.visible) continue;
        p.x = (i - 1) * 27 + Math.sin(u * 4 + i) * 3; p.y = -26 * (1 - u) - 3;
        p.alpha = Math.sin(Math.PI * u) * .8; p.scale.set(.9);
      }
    }
  }
  function leave() {updateSnowCover(state, state.time, null); clear();}
  function destroy() {if (destroyed) return; leave(); destroyed = true;}
  return {state, track, render, clear: leave, destroy};
}
