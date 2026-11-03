// Living water for the wishing-bowls fountain (boss 3 Nov: "make the fountain water more lively"). The stone, bowls and
// statue are one static SVG (public/pixi-art/fountain-wishing.svg); this layer animates the water on top of it:
// wobbling spills with fast streaks, foam and rings where they land, a bubbling spray round the statue's feet,
// droplets thrown out under gravity, and shimmer travelling round both pools.
import {Container, Graphics} from 'pixi.js';

// Points in the SVG's own units (480 x 339 viewBox, the art is shifted up 50 inside it).
const CENTRE = {x: 240, y: 229};                      // centre of the lower pool, sits on the prop's x, y
const SPILLS = [                                      // top, bottom and width of each falling ribbon
  {x: 147, top: 207, bottom: 252, w: 14},
  {x: 240, top: 221, bottom: 270, w: 26},
  {x: 334, top: 207, bottom: 252, w: 15},
];
const BOWL = {x: 240, y: 194, rx: 100, ry: 23};       // upper bowl water
const POOL = {x: 240, y: 229, rx: 200, ry: 52};       // lower pool water
const SPRAY = {x: 240, y: 186};                        // the bubbler at the statue's feet
const WATER = 0x6CCBF2, HI = 0xEAF9FF, WHITE = 0xFFFFFF, GRAVITY = 520;
const fract = v => v - Math.floor(v);

export function createFountainWater(prop, parent) {
  const root = new Container({label: 'FX - Fountain water'});
  const s = prop.scale;
  root.position.set(prop.x - CENTRE.x * s, prop.y - CENTRE.y * s);
  root.scale.set(s);
  root.zIndex = prop.y + 1;                           // just in front of the fountain sprite
  const g = new Graphics();
  root.addChild(g);
  parent.addChild(root);
  let last = null, seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const drops = [];                                   // {x, y, vx, vy, floor, r, life}
  const spawn = (x, y, vx, vy, floor, r) => {if (drops.length < 90) drops.push({x, y, vx, vy, floor, r, life: 1});};
  const glints = Array.from({length: 9}, (_, i) => {
    const a = i * 2.39 + .6, r = .4 + .5 * fract(i * .618);
    return {x: POOL.x + Math.cos(a) * POOL.rx * r, y: POOL.y + 6 + Math.sin(a) * POOL.ry * r * .8, phase: i * .37};
  }).filter(p => !SPILLS.some(sp => Math.abs(p.x - sp.x) < 36 && p.y > POOL.y));
  let sprayAcc = 0, splashAcc = 0;

  function update(t, reduced, visible) {
    root.visible = visible;
    const dt = last === null ? 0 : Math.min(.05, Math.max(0, t - last)); last = t;
    if (!visible) return;
    g.clear();
    if (reduced) return;

    // pool shimmer: two bright arcs sweeping round the lower pool, one round the upper bowl
    for (let i = 0; i < 2; i++) {
      const a = t * .45 + i * Math.PI;
      const x = POOL.x + Math.cos(a) * POOL.rx * .78, y = POOL.y + 4 + Math.sin(a) * POOL.ry * .7;
      g.ellipse(x, y, 30, 4).fill({color: WHITE, alpha: .35 + .25 * Math.sin(a)});
    }
    for (let i = 0; i < 3; i++) {
      const a = t * 1.1 + i * 2.09;
      g.ellipse(BOWL.x + Math.cos(a) * BOWL.rx * .7, BOWL.y + Math.sin(a) * BOWL.ry * .62, 18, 3.4).fill({color: HI, alpha: .5 + .3 * Math.sin(a)});
    }
    // glints winking on the pool
    for (const p of glints) {
      const a = Math.max(0, Math.sin(t * 2.2 + p.phase * 6));
      if (a < .05) continue;
      g.roundRect(p.x - 11 * a, p.y - 1.6, 22 * a, 3.2, 1.6).fill({color: WHITE, alpha: .85 * a});
    }

    for (const [k, sp] of SPILLS.entries()) {
      const len = sp.bottom - sp.top;
      // the ribbon itself wobbles a little wider and narrower
      const wob = 1 + .14 * Math.sin(t * 11 + k * 1.7);
      g.roundRect(sp.x - sp.w * wob / 2, sp.top + 2, sp.w * wob, len - 2, sp.w * .4).fill({color: WATER, alpha: .55});
      // five streaks racing down, accelerating like falling water
      for (let i = 0; i < 5; i++) {
        const u = fract(t * 2.1 + i / 5 + k * .21), y = sp.top + len * u * u, h = 5 + 12 * u;
        const x = sp.x + (fract(i * .37 + k * .5) - .5) * sp.w * .6 + Math.sin(t * 13 + i) * 1.2;
        g.roundRect(x - 1.5, y, 3, Math.min(h, sp.bottom - y), 1.5).fill({color: i % 2 ? WHITE : HI, alpha: .9 * (1 - u * .35)});
      }
      // foam: a cluster of bubbles churning where the ribbon lands
      for (let i = 0; i < 6; i++) {
        const u = fract(t * 1.8 + i / 6 + k * .13), a = i * 1.05 + t * 2;
        const x = sp.x + Math.cos(a) * sp.w * (.35 + .5 * u), y = sp.bottom + 2 + Math.sin(a) * 4;
        g.circle(x, y, (2.8 + 2.2 * Math.sin(u * Math.PI)) * (1 - u * .4)).fill({color: WHITE, alpha: .9 * (1 - u)});
      }
      // three rings spreading out from the landing
      for (let i = 0; i < 3; i++) {
        const u = fract(t * 1.05 + i / 3 + k * .33), rx = sp.w * .55 + 44 * u;
        g.ellipse(sp.x, sp.bottom + 3, rx, rx * .3).stroke({color: WHITE, width: 2.6 * (1 - u) + .5, alpha: .85 * (1 - u)});
      }
    }

    // particles: the bubbler sprays up round the statue's feet, and every landing throws small splashes
    sprayAcc += dt * 26;
    while (sprayAcc >= 1) {
      sprayAcc--;
      const side = rnd() * 2 - 1;
      spawn(SPRAY.x + side * 38, SPRAY.y + 2, side * (30 + 50 * rnd()), -(120 + 90 * rnd()), BOWL.y + 4 + Math.abs(side) * 6, 1.8 + 1.6 * rnd());
    }
    splashAcc += dt * 30;
    while (splashAcc >= 1) {
      splashAcc--;
      const sp = SPILLS[Math.floor(rnd() * SPILLS.length)], side = rnd() * 2 - 1;
      spawn(sp.x + side * sp.w * .4, sp.bottom, side * (40 + 50 * rnd()), -(60 + 70 * rnd()), sp.bottom + 4, 1.6 + 1.4 * rnd());
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += GRAVITY * dt; d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.vy > 0 && d.y >= d.floor) {drops.splice(i, 1); continue;}
      g.circle(d.x, d.y, d.r).fill({color: HI, alpha: .95});
    }
  }
  return {root, update};
}
