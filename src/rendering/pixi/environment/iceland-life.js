import {acquireArt} from '../art/art-recovery.js';
import {Container, Graphics, Sprite} from 'pixi.js';
import {windStrength} from './weather.js';

export const ICELAND_SMOKE = '/pixi-art/themes/snow/final/buildings/smoke.svg';
export const BIRD_FLEE_RADIUS = 120;
const INK = 0x39472d, WARM = 0xffd27a;
const allVisible = () => true;
const FACADES = {
  bakery: {chimney: [.764, .018], windows: [[.37, .69, .22, .09], [.755, .7, .065, .075]]},
  workshop: {chimney: [.59, .018], windows: [[.16, .63, .066, .085], [.565, .63, .066, .085]]},
  lodge: {chimney: [.64, .015], windows: [[.5, .325, .115, .13], [.27, .72, .065, .055], [.72, .72, .065, .055]]},
  gallery: {chimney: [.75, .255], windows: [[.5, .29, .09, .032], [.21, .69, .055, .08], [.8, .69, .055, .08], [.5, .605, .085, .028]]},
  'cocoa-hut': {chimney: [.76, .22], windows: [[.13, .665, .045, .085], [.67, .665, .045, .085], [.845, .7, .045, .075]]},
  'cottage-1': {chimney: [.704, .275], windows: [[.5, .485, .055, .045], [.22, .735, .065, .065], [.785, .735, .065, .065]]},
  'cottage-2': {chimney: [.725, .24], windows: [[.5, .5, .055, .045], [.22, .755, .065, .065], [.785, .755, .065, .065], [.5, .76, .038, .025]]},
  'cottage-3': {chimney: [.725, .235], windows: [[.5, .49, .055, .05], [.2, .755, .065, .065], [.805, .755, .065, .065]]},
  'cottage-4': {chimney: [.72, .235], windows: [[.5, .48, .055, .045], [.2, .755, .065, .065], [.805, .755, .065, .065], [.5, .755, .04, .04]]},
};

function halo(x, y, rx, ry) {
  const g = new Graphics();
  g.ellipse(0, 0, rx * 1.8, ry * 1.8).fill({color: WARM, alpha: .025})
    .ellipse(0, 0, rx * 1.35, ry * 1.35).fill({color: WARM, alpha: .045})
    .ellipse(0, 0, rx, ry).fill({color: WARM, alpha: .075});
  g.position.set(x, y);
  return g;
}

function standingRoot(label, x, y, z, tilt) {
  const root = new Container({label, eventMode: 'none'});
  root.position.set(x, y); root.zIndex = z;
  root.standing = true; root.upright = true; root.scale.y = 1 / tilt;
  return root;
}

function birdFrame(blue, peck) {
  const g = new Graphics(), ink = {color: INK, width: 1.6, join: 'round', cap: 'round'};
  const body = blue ? 0x8cb7c2 : 0x9b8572, wing = blue ? 0x608dba : 0x81766a;
  g.moveTo(-8, -9).lineTo(-17, -14).lineTo(-13, -6).closePath().fill(wing).stroke(ink);
  g.ellipse(0, -10, 10, 8).fill(body).stroke(ink);
  g.ellipse(3, -8, 6.8, 5.5).fill(blue ? 0xf6db7d : 0xd87456);
  g.ellipse(-3, -11, 6, 3.8).fill(wing).stroke({color: INK, width: 1.2});
  const hx = peck ? 10 : 7, hy = peck ? -6 : -18;
  g.circle(hx, hy, 6.2).fill(blue ? 0xfaf3df : 0xdb805d).stroke(ink);
  if (blue) g.moveTo(hx - 5, hy - 3).quadraticCurveTo(hx, hy - 9, hx + 5, hy - 3).fill(0x608dba)
    .moveTo(hx - 3, hy + 1).lineTo(hx + 5, hy + 1).stroke({color: INK, width: 1.8});
  g.poly(peck ? [13, -4, 17, 0, 11, -1] : [12, -19, 17, -16, 12, -15]).fill(0xe5ae51).stroke({color: INK, width: 1.1});
  g.circle(hx + 2, hy - 1, 1.25).fill(INK);
  g.moveTo(-3, -3).lineTo(-3, 1).lineTo(-.5, 1).moveTo(4, -3).lineTo(4, 1).lineTo(7, 1).stroke({color: INK, width: 1.2});
  return g;
}

export function icelandBirdSites(manifest, walkable = allVisible) {
  const yards = manifest.icelandFinal?.yards ?? [], groves = manifest.icelandFinal?.groves ?? [];
  const choices = [yards[0], groves[0], yards[1], groves[3], yards[2], groves[6], yards[4], groves[9]];
  const sites = [];
  for (let i = 0; i < choices.length; i++) {
    const source = choices[i]; if (!source) continue;
    const x = source.door?.[0] ?? source.x, y = source.door?.[1] ?? source.y;
    search: for (const dy of [140, 200, 260, 320, 80]) for (const dx of [-150, 150, -230, 230, 0]) {
      const bx = x + dx, by = y + dy;
      if (walkable(bx, by) && walkable(bx - 28, by) && walkable(bx + 28, by) && walkable(bx, by - 24) && walkable(bx, by + 24)) {
        sites.push({id: source.id, x: bx, y: by, blue: i % 2 === 1, phase: i * 1.731});
        break search;
      }
    }
  }
  return sites;
}

export function createIcelandLife(manifest, texture, {tilt = 1, walkable = allVisible} = {}) {
  const roots = [], chimneys = [], glows = [], birds = [];
  const props = manifest.props ?? [];
  const smokeProps = new Map(props.filter(p => p.finalKind === 'smoke').map(p => [p.id.replace(/-chimney-smoke$/, ''), p]));
  for (const p of props) {
    const role = p.finalRole ?? p.assetKey, facade = FACADES[role];
    if (p.finalKind !== 'building' || !facade) continue;
    const scale = p.scale ?? 1, w = p.width * scale, h = p.height * scale;
    const ax = p.anchor?.x ?? .5, ay = p.anchor?.y ?? 1, flip = p.flip ? -1 : 1;
    const root = standingRoot('Iceland life ' + p.id, p.x, p.y, (p.z ?? p.sortY ?? p.y) + .02, tilt);
    const localX = u => (u - ax) * w * flip, localY = v => (v - ay) * h;
    const existing = smokeProps.get(p.id);
    const sx = existing ? existing.x - p.x : localX(facade.chimney[0]);
    const sy = existing ? existing.y - p.y : localY(facade.chimney[1]);
    const chimney = {root, x: p.x, y: p.y, pad: h + 180, sx, sy, phase: chimneys.length * .713, puffs: []};
    for (let j = 0; j < 3; j++) {
      const puff = new Sprite(texture); puff.anchor.set(.5, 1);
      puff.width = Math.min(64, w * .18); puff.height = puff.width * 48.24 / 72;
      root.addChild(puff); chimney.puffs.push({sprite: puff, width: puff.width, height: puff.height, offset: j / 3});
    }
    chimneys.push(chimney);
    for (const window of facade.windows) {
      const g = halo(localX(window[0]), localY(window[1]), window[2] * w, window[3] * h);
      root.addChild(g); glows.push({root: g, owner: root, phase: glows.length * 1.913});
    }
    roots.push(root);
  }
  for (const p of props) {
    if (!(p.finalRole === 'lamp' || p.assetKey === 'lamp') || !p.src?.includes('final/props/')) continue;
    const scale = p.scale ?? 1, w = p.width * scale, h = p.height * scale;
    const root = standingRoot('Iceland lamp glow ' + p.id, p.x, p.y, (p.z ?? p.sortY ?? p.y) + .02, tilt);
    const g = halo((.5 - (p.anchor?.x ?? .5)) * w, (.38 - (p.anchor?.y ?? 1)) * h, w * .35, h * .125);
    root.addChild(g); roots.push(root);
    glows.push({root: g, owner: root, x: p.x, y: p.y, pad: h + 40, phase: glows.length * 1.913});
  }
  for (const site of icelandBirdSites(manifest, walkable)) {
    const root = standingRoot('Iceland snow bird ' + site.id, site.x, site.y, site.y + 1, tilt), body = new Container();
    const frames = [birdFrame(site.blue, false), birdFrame(site.blue, true)];
    body.addChild(...frames); root.addChild(body); roots.push(root);
    birds.push({root, body, frames, site, x: site.x, y: site.y, fromX: site.x, fromY: site.y,
      toX: site.x, toY: site.y, started: -100, duration: .38, next: site.phase + 1, fleeAfter: 0, fleeing: false, facing: 1});
  }
  let destroyed = false;
  function update(seconds, reduced, visible, shown = true, player = null, ducks = null) {
    if (destroyed) return;
    const breeze = reduced ? 0 : windStrength(seconds);
    for (const c of chimneys) {
      c.root.visible = shown && visible(c.x, c.y, c.pad);
      if (!c.root.visible) continue;
      for (const p of c.puffs) {
        const age = reduced ? .18 + p.offset * .6 : ((seconds / 7.5 + c.phase + p.offset) % 1 + 1) % 1;
        const size = .42 + age * .8;
        p.sprite.position.set(c.sx + age * (22 + breeze * 35) + (reduced ? 0 : Math.sin(seconds * .55 + c.phase) * age * 5), c.sy - age * 100);
        p.sprite.width = p.width * size; p.sprite.height = p.height * size;
        p.sprite.alpha = Math.sin(age * Math.PI) * .34;
      }
    }
    for (const g of glows) {
      if (g.pad) g.owner.visible = shown && visible(g.x, g.y, g.pad);
      if (!g.owner.visible) continue;
      g.root.alpha = reduced ? .85 : .85 + Math.sin(seconds * 1.7 + g.phase) * .07 + Math.sin(seconds * 3.1 + g.phase * .7) * .035;
    }
    for (const b of birds) {
      b.root.visible = shown && visible(reduced ? b.site.x : b.x, reduced ? b.site.y : b.y, 100);
      if (!b.root.visible) continue;
      if (reduced) {
        b.root.position.set(b.site.x, b.site.y); b.root.zIndex = b.site.y + 1;
        b.body.position.set(0, 0); b.body.rotation = 0; b.body.scale.x = 1;
        b.frames[0].visible = true; b.frames[1].visible = false;
        continue;
      }
      let near = null, distance = BIRD_FLEE_RADIUS * BIRD_FLEE_RADIUS;
      if (player && !player.sleeping && player.action !== 7 && player.mode !== 'sailing') {
        const d = (player.x - b.x) ** 2 + (player.y - b.y) ** 2;
        if (d < distance) {near = player; distance = d;}
      }
      if (ducks) for (let i = 0; i < ducks.length; i++) {
        const d = ducks[i]; if (d.sleeping || d.action === 7 || d.mode === 'sailing') continue;
        const sq = (d.x - b.x) ** 2 + (d.y - b.y) ** 2;
        if (sq < distance) {near = d; distance = sq;}
      }
      const landed = seconds - b.started >= b.duration;
      if ((near && landed && seconds >= b.fleeAfter) || (landed && seconds >= b.next)) {
        let dx, dy;
        b.fleeing = Boolean(near);
        if (near) {
          dx = b.x - near.x; dy = b.y - near.y;
          const length = Math.hypot(dx, dy);
          if (length < .01) {dx = Math.cos(b.site.phase); dy = Math.sin(b.site.phase);}
          else {dx /= length; dy /= length;}
          dx *= 165; dy *= 165;
        } else {
          const angle = seconds * 1.37 + b.site.phase;
          dx = Math.cos(angle) * 22 + (b.site.x - b.x) * .18;
          dy = Math.sin(angle) * 14 + (b.site.y - b.y) * .18;
        }
        let found = false;
        for (let turn = 0; turn < 5; turn++) {
          const angle = turn === 0 ? 0 : (turn % 2 ? 1 : -1) * Math.ceil(turn / 2) * .55;
          const tx = dx * Math.cos(angle) - dy * Math.sin(angle), ty = dx * Math.sin(angle) + dy * Math.cos(angle);
          if (!walkable(b.x + tx, b.y + ty) || !walkable(b.x + tx * .5, b.y + ty * .5)) continue;
          b.fromX = b.x; b.fromY = b.y; b.toX = b.x + tx; b.toY = b.y + ty;
          b.started = seconds; b.duration = near ? .72 : .38; b.facing = tx < 0 ? -1 : 1;
          found = true; break;
        }
        b.next = seconds + (found && near ? 2.5 : 1.8 + (Math.sin(seconds + b.site.phase) + 1) * 1.3);
        if (near) b.fleeAfter = seconds + 2.5;
      }
      const u = Math.max(0, Math.min(1, (seconds - b.started) / b.duration)), ease = u * u * (3 - 2 * u);
      b.x = b.fromX + (b.toX - b.fromX) * ease; b.y = b.fromY + (b.toY - b.fromY) * ease;
      b.root.position.set(b.x, b.y); b.root.zIndex = b.y + 1;
      b.body.y = -Math.sin(u * Math.PI) * (b.fleeing ? 48 : 9);
      b.body.rotation = u < 1 && b.fleeing ? Math.sin(u * Math.PI) * -.12 * b.facing : 0;
      b.body.scale.x = b.facing;
      const peck = u === 1 ? Math.sin(seconds * 4 + b.site.phase) > .7 : b.fleeing && Math.floor(u * 8) % 2 === 1;
      b.frames[0].visible = !peck; b.frames[1].visible = peck;
    }
  }
  update(0, true, allVisible);
  return {roots, chimneys, glows, birds, update,
    mount(parent) {if (!destroyed) for (const root of roots) if (root.parent !== parent) parent.addChild(root);},
    destroy() {if (destroyed) return; destroyed = true; for (const root of roots) root.destroy({children: true});},
  };
}

export function createIcelandLifeLifecycle(map, manifest, {acquire, release, tilt = 1}) {
  if (map.id !== 'snow' || !manifest.icelandFinal) return null;
  let current = null, pending = null, generation = 0, disposed = false, ownedGroups = null;
  const walkable = map.nav ? map.nav().walkable : allVisible;
  const lifecycle = {
    get current() {return current;},
    async ensure(parent, groups) {
      if (disposed) return null;
      if (current) {if (parent) current.mount(parent); return current;}
      if (pending) return pending;
      const version = generation;
      const request = (async () => {
        let life, leased = true;
        try {
          const texture = await acquireArt(acquire,release,ICELAND_SMOKE,2);
          if (disposed || version !== generation) {leased = false; release(ICELAND_SMOKE); return null;}
          life = createIcelandLife(manifest, texture, {tilt, walkable});
          if (parent) life.mount(parent);
          for (const root of life.roots) {root.visible = false; groups.push(root);}
          ownedGroups = groups; current = life;
          return life;
        } catch (error) {life?.destroy(); if (leased) release(ICELAND_SMOKE); console.warn('Iceland life unavailable',error);return null;}
      })();
      pending = request;
      try {return await request;} finally {if (pending === request) pending = null;}
    },
    release() {
      generation++; pending = null;
      if (!current) return;
      for (const root of current.roots) {const i = ownedGroups.indexOf(root); if (i >= 0) ownedGroups.splice(i, 1);}
      current.destroy(); current = null; ownedGroups = null; release(ICELAND_SMOKE);
    },
    destroy() {disposed = true; lifecycle.release();},
  };
  return lifecycle;
}
