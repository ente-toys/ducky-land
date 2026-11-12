import {Assets, Container, Graphics, Sprite} from 'pixi.js';
import data from '../../../world/home/sleep-poses.json';

export const SLEEP_POSES = Object.keys(data.poses);
export const PORTABLE = ['wing', 'nod'];
const MOTION = {
  nod: {tilt: -.5, nod: true, bubble: {tip: [211, 463], dir: [-.97, .24], R: 28}, cap: [325, 78, 0, 450]},
  leaf: {tilt: .5, zAnchor: [120, 120], zDir: -1, blanket: 586},
  wing: {tilt: .4, zAnchor: [150, 150], zDir: -1},
  hammock: {tilt: .4, swing: {knotY: 268}, ownZ: true},
  rock: {tilt: .5, zAnchor: [250, 110], zDir: -1, cap: [372, 83, .06, 440]},
  book: {tilt: .5, zAnchor: [230, 150], zDir: -1},
  chair: {tilt: .5, ownZ: true},
  box: {tilt: .3, zAnchor: [250, 100], zDir: -1, cap: [377, 92, 0, 408]},
};
import {SLEEP_SIZE} from '../../../world/home/sleep-spots.js';
export {SLEEP_SIZE};
export const SLEEP_SNOW_SURFACES = {
  nod: [[342, 79, 290, .03], [594, 382, 165, .75], [338, 950, 0, 0]],
  leaf: [[274, 66, 215, -.2], [680, 265, 190, .8], [630, 171, 300, -.06]],
  wing: [[367, 103, 240, .03], [653, 230, 245, .5], [463, 561, 0, 0]],
  hammock: [[523, 104, 225, -.14], [673, 318, 115, 1.05], [430, 527, 290, -.04]],
  rock: [[373, 83, 255, .05], [535, 405, 145, .9], [673, 352, 130, .28]],
  book: [[429, 104, 300, .18], [764, 273, 200, .65], [465, 530, 730, 0]],
  chair: [[393, 165, 180, -.12], [518, 346, 100, .9], [586, 90, 210, .17]],
  box: [[376, 92, 250, .02], [533, 314, 110, .95], [367, 410, 670, 0]],
};
const POKE = .6, POKE_COOL = .8;
const Z_SRC = '/pixi-duck/sleep/z.svg', Z_H = 105, Z_SIZES = [.72, .86, 1], STAND_HEAD = 285, INK = 0x232323;
export const SLEEP_ASSETS = [Z_SRC, ...Object.values(data.poses).flatMap(p => p.layers.map(l => l.src))];
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp01 = x => Math.min(1, Math.max(0, x)), io = x => .5 - .5 * Math.cos(Math.PI * clamp01(x)), outCubic = x => 1 - (1 - clamp01(x)) ** 3;
const mod = (a, b) => ((a % b) + b) % b;
const hash = n => {let h = (Math.abs(n | 0) + 0x9e3779b9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; return (Math.imul(h ^ (h >>> 16), 0x45d9f3b) ^ (h >>> 16)) >>> 0;};
export function breath(t, P) {
  const u = mod(t, P) / P;
  return u < .42 ? io(u / .42) : u < .5 ? 1 : u < .92 ? 1 - io((u - .5) / .42) : 0;
}
const POP_U = .44, POP_LEN = .3;
export function bubbleState(t, P) {
  const k = mod(Math.floor(t / P), 3), u = mod(t, P) / P, b = breath(t, P);
  if (k === 0) return {s: u < .5 ? b : .4 + .6 * b};
  if (k === 1) return {s: .4 + .6 * b};
  const tu = (u - POP_U) * P;
  if (tu < 0) return {s: .4 + 1.05 * b + .05 * clamp01((u - .42) / .02)};
  return {s: tu < .05 ? 1.5 * (1 + .06 * tu / .05) : 0, pop: tu < POP_LEN ? tu / POP_LEN : null};
}
function droop(t, P) {
  const tc = mod(t, 3 * P), tp = (2 + POP_U) * P;
  return tc < tp ? io(tc / tp) : 1 - outCubic((tc - tp) / .4);
}
export const sleepHalfWidths = rootScale => Object.fromEntries(SLEEP_POSES.map(n => {const p = data.poses[n]; return [n, (p.box[2] - p.box[0]) * p.k * SLEEP_SIZE * rootScale / 3 / 2];}));
export function sleepLook(sleep, seed) {
  const h = hash(seed);
  return {pose: SLEEP_POSES.includes(sleep?.pose) ? sleep.pose : PORTABLE[h % PORTABLE.length], flip: sleep ? !!sleep.flip : (h >> 3) % 2 === 1};
}

export function createSleeper(sleep, seed = 0) {
  const {pose: name, flip} = sleepLook(sleep, seed), pose = data.poses[name], m = MOTION[name], h = hash(seed + 7);
  const P = 3.6 + (h % 8) * .07, off = (h % 8) * .61 + (h >> 4) % 97 * .37, dir = flip ? -1 : 1;
  const root = new Container({label: `Sleeping Ducky (${name})`}), [x0, , x1, y1] = pose.box;
  root.visible = false; root.scale.set(SLEEP_SIZE);
  const shade = new Container({label: 'Shadow'});
  shade.pivot.set((x0 + x1) / 2, y1); shade.scale.set(pose.k * dir, pose.k * .3); shade.position.set(0, 3);
  for (const layer of pose.layers) if (layer.id !== 'zz') {const s = new Sprite(Assets.get(layer.src)); s.scale.set(1 / data.F); s.tint = 0x000000; shade.addChild(s);}
  shade.cacheAsTexture(true); shade.alpha = .07; root.addChild(shade);
  const bed = new Container();
  bed.pivot.set((x0 + x1) / 2, y1); bed.scale.set(pose.k * dir, pose.k); root.addChild(bed);
  const sprite = src => {const s = new Sprite(Assets.get(src)); s.scale.set(1 / data.F); return s;};
  const at = (node, [x, y]) => {node.pivot.set(x, y); node.position.set(x, y); return node;};
  let duck, cloth, zz, prop;
  for (const layer of pose.layers) {
    const node = new Container({label: layer.id});
    node.addChild(sprite(layer.src)); bed.addChild(node);
    if (layer.id === 'duck') duck = at(node, layer.pivot);
    if (layer.id === 'cloth') cloth = at(node, [0, m.swing.knotY]);
    if (layer.id === 'prop') prop = node;
    if (layer.id === 'zz') {zz = at(node, layer.pivot); zz.scale.x = dir;}
  }
  if (m.blanket) at(prop, [duck.pivot.x, m.blanket]);
  const hat = new Container({label: 'Sleep cap'});
  if (m.cap) {hat.position.set(m.cap[0], m.cap[1]); hat.rotation = m.cap[2]; hat.scale.set(m.cap[3] / STAND_HEAD); duck.addChild(hat);}
  const zH = Z_H * data.poses.hammock.k / pose.k, zs = m.zAnchor ? Z_SIZES.map(() => {const z = new Sprite(Assets.get(Z_SRC)); z.anchor.set(.5); bed.addChild(z); return z;}) : [];
  const puffAt = m.zAnchor || (zz && [zz.pivot.x, zz.pivot.y]) || [m.cap[0], m.cap[1] - 40];
  const puff = [0, 1, 2, 3].map(() => {const z = new Sprite(Assets.get(Z_SRC)); z.anchor.set(.5); z.visible = false; bed.addChild(z); return z;});
  let pokedAt = -1e9, now = 0;
  function poke() {if (now - pokedAt < POKE_COOL) return false; pokedAt = now; return true;}
  const bubble = m.bubble ? new Graphics() : null, burst = m.bubble ? new Graphics() : null;
  if (bubble) duck.addChild(bubble, burst);
  let last = null;
  function drawBubble({s, pop}) {
    const B = m.bubble, [tx, ty] = B.tip, [ux, uy] = B.dir;
    bubble.clear(); burst.clear();
    if (s > .02) {
      const R = B.R * s, D = B.R * 1.17 * s, cx = tx + ux * D, cy = ty + uy * D, a0 = Math.atan2(-uy, -ux), half = Math.acos(Math.min(.999, R / D));
      bubble.moveTo(tx, ty).lineTo(cx + R * Math.cos(a0 + half), cy + R * Math.sin(a0 + half)).arc(cx, cy, R, a0 + half, a0 - half + TAU).closePath()
        .fill({color: 0xffffff, alpha: .16}).stroke({color: 0xffffff, width: 6.5 * Math.min(1, .45 + .55 * s), join: 'round'});
      const r2 = R * .56;
      bubble.moveTo(cx + r2 * Math.cos(Math.PI * 1.08), cy + r2 * Math.sin(Math.PI * 1.08)).arc(cx, cy, r2, Math.PI * 1.08, Math.PI * 1.42)
        .stroke({color: 0xffffff, width: Math.max(2.2, 5.5 * Math.min(1, s)), cap: 'round'});
      last = {cx, cy, R};
    }
    if (pop != null && last) {
      const {cx, cy, R} = last, k = outCubic(pop);
      for (let i = 0; i < 4; i++) {const a = -Math.PI * .75 + i * Math.PI / 2 + .2, r0 = R * (1.05 + .35 * k), r1 = R * (1.3 + .5 * k);
        burst.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a)).lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));}
      burst.stroke({color: 0xffffff, width: 5.5, cap: 'round'}); burst.alpha = 1 - pop;
    }
  }
  function update(time, reduced = false, shiver = 0) {
    now = time;
    const t = (reduced ? 1.2 : time) + off, b = breath(t, P), pt = time - pokedAt, on = pt < POKE && !reduced;
    let tilt = m.tilt * breath(t - .35, P);
    if (m.nod) tilt += -1.1 * droop(t, P);
    const damp = on ? Math.exp(-5.5 * pt) : 0, w = damp * Math.cos(TAU * 4.2 * pt);
    duck.rotation = (tilt + 4 * damp * Math.sin(TAU * 4.2 * pt)) * DEG + shiver;
    duck.scale.set(1 + .008 * b + .1 * w, 1 + .025 * b - .16 * w); duck.x = duck.pivot.x;
    puff.forEach((z, k) => {
      const u = (pt - k * .05) / .75; z.visible = !reduced && u >= 0 && u < 1;
      if (!z.visible) return;
      const a = (-115 + k * 22) * DEG, d = zH * (.3 + 1.1 * outCubic(u)), sc = (.35 + .2 * Z_SIZES[k % 3] + .2 * outCubic(u)) * zH / 210;
      z.position.set(puffAt[0] + Math.cos(a) * d, puffAt[1] + Math.sin(a) * d); z.alpha = u < .1 ? u / .1 : 1 - io((u - .4) / .6);
      z.rotation = (-14 + k * 9) * DEG * dir; z.scale.set(sc * dir, sc);
    });
    let sway = 0;
    if (m.swing) {
      sway = 1.1 * Math.sin(TAU * t / 5.4); cloth.skew.x = sway * DEG;
      duck.x += Math.tan(1.1 * Math.sin(TAU * (t - .25) / 5.4) * DEG) * (duck.pivot.y - m.swing.knotY) * .9;
    }
    if (bubble) drawBubble(reduced ? {s: .8} : bubbleState(t, P));
    if (zz) {zz.position.set(zz.pivot.x + (m.swing ? Math.tan(sway * DEG) * 120 : 0), zz.pivot.y - 6 * Math.sin(TAU * t / 3.2)); zz.rotation = 2.5 * DEG * Math.sin(TAU * (t - .4) / 3.2);}
    if (m.blanket) {const bl = breath(t - .05, P); prop.scale.set(1 + .006 * bl, 1 + .026 * bl);}
    zs.forEach((z, k) => {
      const u = reduced ? .3 : mod(t - k * 4.8 / 3, 4.8) / 4.8, sc = (reduced ? 1 : .6 + .4 * io(Math.min(1, u * 1.6))) * Z_SIZES[k] * zH / 210;
      z.visible = !reduced || k === 2;
      z.alpha = reduced ? 1 : u < .15 ? u / .15 : u > .62 ? Math.max(0, 1 - (u - .62) / .38) : 1;
      z.position.set(m.zAnchor[0] + m.zDir * (reduced ? .2 * zH : u * .8 * zH + .08 * zH * Math.sin(TAU * u)), m.zAnchor[1] - (reduced ? .6 * zH : io(u) * 2.1 * zH));
      z.rotation = (reduced ? -4 : -6 + 8 * u) * DEG * dir; z.scale.set(sc * dir, sc);
    });
  }
  function setCap(cap, view) {
    for (const child of hat.removeChildren()) child.destroy();
    if (!cap || !m.cap || !view) return;
    const frame = cap.frames['0'][0], s = new Sprite(Assets.get(frame.url));
    s.position.set(frame.rect[0] - (view.attachments.head[0] + view.attachments.head[1]) / 2, frame.rect[1] - view.attachments.headY);
    hat.addChild(s);
  }
  const snowSurfaces = SLEEP_SNOW_SURFACES[name].map(([x, y, width, rotation], i) => {
    const parent = i < 2 ? duck : prop || cloth || bed;
    const sprite = parent === bed ? null : parent.children[0];
    const region = [(x - width / 2) / pose.W, (x + width / 2) / pose.W, i === 0 ? y / pose.H : 0];
    if (i === 2 && name === 'box') region[3] = [[.04, .29], [.77, .97]];
    if (i === 2 && name === 'book') region[3] = [[.04, .24], [.65, .93]];
    return {parent, x, y, width, rotation: sprite ? 0 : rotation,
      ink: 7.5, depthWidth: width * data.F, texture: sprite?.texture, spriteX: 0, spriteY: 0, sx: 1 / data.F, sy: 1 / data.F,
      region, crownKey: sprite ? `${name}:${i}` : null};
  });
  update(0);
  let devil,privacyShades;
  function setAppearance(appearance=null){
    const replacement=appearance?.textures.get(`${name}-duck.svg`);
    const base=duck.children.find(n=>n instanceof Sprite);
    base.texture=replacement??Assets.get(pose.layers.find(l=>l.id==='duck').src);
    if(replacement&&!devil){
      devil=new Container({label:'Sleeping Google devil parts'});
      const nod=name==='nod',left=new Sprite(appearance.horn),right=new Sprite(appearance.horn),tail=new Sprite(appearance.tail),k=nod?1.35:1.2;
      for(const [i,horn]of [left,right].entries()){horn.anchor.set(.35,.88);horn.position.set((nod?320:320)+(i===0?-145:145),nod?155:142);horn.scale.set((i===0?-1:1)*k,k);}
      tail.anchor.set(8/205,210/232);tail.position.set(nod?620:710,nod?800:390);tail.scale.set(nod?1:1.1);
      devil.addChild(tail,left,right);duck.addChildAt(devil,0);
    }
    if(devil)devil.visible=Boolean(replacement);
    const shades=appearance?.shades?.sleep.get(`${name}-shades.svg`);
    if(shades&&!privacyShades){
      privacyShades=new Sprite({texture:shades,label:'Sleeping Privacy sunglasses'});
      duck.addChild(privacyShades);
    }
    if(privacyShades)privacyShades.visible=Boolean(shades);
  }
  return {root, update, setCap, setAppearance, poke, pose: name, flip, snowSurfaces};
}
