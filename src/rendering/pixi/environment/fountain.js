import {Container, Graphics, ImageSource, Texture} from 'pixi.js';
import {ART_TEXTURE} from '../art/art-texture.js';
import {PALETTE} from '../../shared/palette.js';
import {basinClip, createBasinWater} from './fountain-basin.js';

const CENTRE = {x: 240, y: 300};
const RIM = {x: 240, y: 223, rx: 112, ry: 85.787234};
const SPILLS = [
  {start: 158, x: 130, bottom: 358, w: 14},
  {start: 240, x: 240, bottom: 395, w: 26},
  {start: 322, x: 350, bottom: 358, w: 14},
];
const rimY = x => RIM.y + RIM.ry * Math.sqrt(Math.max(0, 1 - ((x - RIM.x) / RIM.rx) ** 2));
export const fountainPoint = (sp, u, side = 0, width = 1) => {
  if (sp.jet) {
    const {y, cx, cy} = sp.jet, v = 1 - u;
    const dx = 2 * (v * (cx - sp.start) + u * (sp.x - cx));
    const dy = 2 * (v * (cy - y) + u * (sp.bottom - cy));
    const offset = side * sp.w * width / 2 * (1 - .24 * u), length = Math.hypot(dx, dy) || 1;
    return {x: v * v * sp.start + 2 * v * u * cx + u * u * sp.x - dy / length * offset,
      y: v * v * y + 2 * v * u * cy + u * u * sp.bottom + dx / length * offset};
  }
  const offset = side * sp.w * width / 2, top = rimY(sp.start + offset);
  return {x: sp.start + (sp.x - sp.start) * u + offset * (1 - .24 * u),
    y: top + 14 * u + (sp.bottom - top - 14) * u * u};
};
async function cleanArtwork(prop, root) {
  if (!prop.sprite || typeof document === 'undefined') return;
  let url;
  try {
    const response = await fetch(prop.src); if (!response.ok) throw Error(`Fountain art: ${response.status}`);
    const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    for (const id of ['jet', 'foam']) svg.getElementById(id)?.remove();
    url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type: 'image/svg+xml'}));
    const img = new Image(); img.src = url; await img.decode();
    if (root.destroyed || prop.sprite.destroyed) return;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 960;
    canvas.getContext('2d').drawImage(img, 0, 0, 960, 960);
    const original = prop.sprite.texture, texture = new Texture({source: new ImageSource({resource: canvas, ...ART_TEXTURE})});
    const sx = prop.sprite.scale.x, sy = prop.sprite.scale.y;
    prop.sprite.texture = texture;
    prop.sprite.scale.set(sx * original.width / texture.width, sy * original.height / texture.height);
    root.once('destroyed', () => {if (!prop.sprite.destroyed && prop.sprite.texture === texture) {
      prop.sprite.texture = original; prop.sprite.scale.set(sx, sy);
    } texture.destroy(true);});
  } catch (error) {console.warn('Fountain artwork cleanup failed', error);}
  finally {if (url) URL.revokeObjectURL(url);}
}
const POOL = {x: 240, y: 290, rx: 180, ry: 137.87234};
const SPRAY = {x: 240, y: 213};
const WATER = PALETTE.water, HI = PALETTE.cream, WHITE = PALETTE.cream, GRAVITY = 520;
const fract = v => v - Math.floor(v);

export function createFountainWater(prop, parent, water = null, layout = {}) {
  const centre = layout.centre ?? CENTRE, pool = layout.pool === undefined ? POOL : layout.pool;
  const spills = layout.spills ?? SPILLS, spray = layout.spray === undefined ? SPRAY : layout.spray;
  const minPoolY = layout.minPoolY ?? 335, minDropY = layout.minDropY ?? 310;
  const root = new Container({label: 'FX - Fountain water'});
  const s = prop.scale;
  root.position.set(prop.x - centre.x * s, prop.y - centre.y * s);
  root.scale.set(s);
  root.zIndex = prop.y + 1;
  root.visible = false;
  const surface = layout.surface ? createBasinWater(layout.surface, root) : null;
  water = surface ?? water;
  const g = new Graphics();
  root.addChild(g);
  if (surface) {
    const clip = basinClip(layout.surface); root.addChild(clip); g.mask = clip;
    root.once('destroyed', () => surface.dispose());
  }
  parent.addChild(root);
  if (layout.cleanArtwork !== false) cleanArtwork(prop, root);
  let last = null, seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const drops = [];
  const spawn = (x, y, vx, vy, floor, r) => {if (drops.length < 90) drops.push({x, y, vx, vy, floor, r, life: 1});};
  const glints = Array.from({length: pool ? 9 : 0}, (_, i) => {
    const a = i * 2.39 + .6, r = .4 + .5 * fract(i * .618);
    return {x: pool.x + Math.cos(a) * pool.rx * r, y: pool.y + 6 + Math.sin(a) * pool.ry * r * .8, phase: i * .37};
  }).filter(p => !spills.some(sp => Math.abs(p.x - sp.x) < 36 && p.y > pool.y));
  let splashAcc = 0, impactAcc = 0;

  function update(t, reduced, visible) {
    visible = visible && !(typeof document !== 'undefined' && document.hidden);
    const wasVisible = root.visible;
    root.visible = visible;
    const dt = last === null || !wasVisible ? 0 : Math.min(.05, Math.max(0, t - last)); last = t;
    surface?.update(dt, reduced, visible);
    if (!visible) return;
    g.clear();
    if (reduced) {drops.length = 0; splashAcc = impactAcc = 0; return;}
    t += layout.phase ?? 0;

    impactAcc += dt;
    while (impactAcc >= .14) {
      impactAcc -= .14;
      for (const sp of spills) water?.fountainSplash(sp.x, sp.bottom + 3, .16);
      if (spray) {
        water?.fountainSplash(spray.x - 62, spray.y + 3, .08, 'bowl');
        water?.fountainSplash(spray.x + 62, spray.y + 3, .08, 'bowl');
      }
    }

    for (let i = 0; i < (!pool || water?.active ? 0 : 2); i++) {
      const a = t * .45 + i * Math.PI;
      const x = pool.x + Math.cos(a) * pool.rx * .78, y = pool.y + 4 + Math.sin(a) * pool.ry * .7;
      if (y < minPoolY) continue;
      g.ellipse(x, y, 30, 4).fill({color: WHITE, alpha: .35 + .25 * Math.sin(a)});
    }
    for (const p of water?.active ? [] : glints) {
      const a = Math.max(0, Math.sin(t * 2.2 + p.phase * 6));
      if (a < .05 || p.y < minPoolY) continue;
      g.roundRect(p.x - 11 * a, p.y - 1.6, 22 * a, 3.2, 1.6).fill({color: WHITE, alpha: .85 * a});
    }

    for (const [k, sp] of spills.entries()) {
      const wob = 1 + .035 * Math.sin(t * 5 + k * 1.7);
      const curve = sp.jet ? {...sp, jet: {...sp.jet, cy: sp.jet.cy + Math.sin(t * 3 + k) * 3}} : sp;
      const ribbon = (from, to, width, color, alpha) => {
        const p = fountainPoint(curve, from, -1, width); g.moveTo(p.x, p.y);
        for (let j = 1; j <= 12; j++) {const p = fountainPoint(curve, from + (to - from) * j / 12, -1, width); g.lineTo(p.x, p.y);}
        for (let j = 0; j <= 12; j++) {const p = fountainPoint(curve, to, -1 + 2 * j / 12, width); g.lineTo(p.x, p.y);}
        for (let j = 11; j >= 0; j--) {const p = fountainPoint(curve, from + (to - from) * j / 12, 1, width); g.lineTo(p.x, p.y);}
        for (let j = 11; j >= 0; j--) {const p = fountainPoint(curve, from, -1 + 2 * j / 12, width); g.lineTo(p.x, p.y);}
        g.closePath().fill({color, alpha});
      };
      if (sp.jet) ribbon(0, 1, wob * 1.3, PALETTE.ink, 1);
      ribbon(0, 1, wob, surface ? WATER : sp.jet ? 0xB5E7F7 : WATER, 1);
      ribbon(0, 1, .3 * wob, HI, .48);
      for (let i = 0; i < 3; i++) {
        const u = fract(t * 1.25 + i / 3 + k * .21);
        ribbon(u, Math.min(1, u + .09), .16, HI, .8 * Math.sin(u * Math.PI));
      }
      for (let i = 0; i < 6; i++) {
        const u = fract(t * 1.8 + i / 6 + k * .13), a = i * 1.05 + t * 2;
        const x = sp.x + Math.cos(a) * sp.w * (.35 + .5 * u), y = sp.bottom + 2 + Math.sin(a) * 4;
        g.circle(x, y, (2.8 + 2.2 * Math.sin(u * Math.PI)) * (1 - u * .4)).fill({color: WHITE, alpha: .9 * (1 - u)});
      }
      for (let i = 0; i < 3; i++) {
        const u = fract(t * 1.05 + i / 3 + k * .33), rx = sp.w * .55 + 30 * u;
        g.ellipse(sp.x, sp.bottom + 3, rx, rx * .3).stroke({color: WHITE, width: 2.6 * (1 - u) + .5, alpha: .85 * (1 - u)});
      }
    }

    splashAcc += dt * (spills.length ? layout.sprayRate ?? 30 : 0);
    while (splashAcc >= 1) {
      splashAcc--;
      const sp = spills[Math.floor(rnd() * spills.length)], side = rnd() * 2 - 1;
      spawn(sp.x + side * sp.w * .4, sp.bottom, side * (40 + 50 * rnd()), -(60 + 70 * rnd()), sp.bottom + 4, 1.6 + 1.4 * rnd());
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += GRAVITY * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.vy > 0 && d.y >= d.floor) {water?.fountainSplash(d.x, d.floor, .035, d.floor < 250 ? 'bowl' : 'pool'); drops.splice(i, 1); continue;}
      if (d.y - d.r < minDropY) continue;
      g.circle(d.x, d.y, d.r).fill({color: HI, alpha: .95});
    }
  }
  return {root, update, graphics: g, surface};
}
