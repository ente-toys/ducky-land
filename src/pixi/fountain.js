// Living water for the wishing-bowls fountain (boss 3 Nov). The stone, bowls and statue are one static SVG
// (public/pixi-art/fountain-wishing.svg); this layer animates the water on top of it: highlights running down the three
// spills, rings spreading where they land, a few splash drops, a slow swirl in the upper bowl and glints on the pool.
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
const HI = 0xEAF9FF, RIPPLE = 0xFFFFFF;
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
  // Fixed glint spots on the pool, kept off the spill landings.
  const glints = Array.from({length: 7}, (_, i) => {
    const a = i * 2.39 + .6, r = .45 + .45 * fract(i * .618);
    return {x: POOL.x + Math.cos(a) * POOL.rx * r, y: POOL.y + 8 + Math.sin(a) * POOL.ry * r * .8, phase: i * .37};
  }).filter(p => !SPILLS.some(sp => Math.abs(p.x - sp.x) < 40 && p.y > POOL.y));

  function update(t, reduced, visible) {
    root.visible = visible;
    if (!visible) return;
    g.clear();
    if (reduced) return;
    for (const [k, sp] of SPILLS.entries()) {
      const len = sp.bottom - sp.top;
      // three highlight streaks sliding down the ribbon, accelerating like falling water
      for (let i = 0; i < 3; i++) {
        const u = fract(t * 1.35 + i / 3 + k * .21), y = sp.top + len * u * u, h = 6 + 10 * u;
        const x = sp.x + Math.sin(t * 9 + i + k) * sp.w * .12 - sp.w * .18;
        g.roundRect(x - 1.6, y, 3.2, Math.min(h, sp.bottom - y), 1.6).fill({color: HI, alpha: .85 * (1 - u * .4)});
      }
      // rings spreading where the ribbon lands
      for (let i = 0; i < 2; i++) {
        const u = fract(t * .9 + i / 2 + k * .33), rx = sp.w * .5 + 26 * u;
        g.ellipse(sp.x, sp.bottom + 3, rx, rx * .3).stroke({color: RIPPLE, width: 2.2 * (1 - u) + .6, alpha: .8 * (1 - u)});
      }
      // two small drops hopping out of the splash
      for (let i = 0; i < 2; i++) {
        const u = fract(t * 1.6 + i * .5 + k * .17), side = i ? 1 : -1;
        const x = sp.x + side * (4 + 14 * u), y = sp.bottom - 14 * Math.sin(u * Math.PI);
        g.circle(x, y, 2.4 * (1 - u * .5)).fill({color: HI, alpha: 1 - u});
      }
    }
    // slow swirl in the upper bowl: two arcs travelling round the rim of the water
    for (let i = 0; i < 2; i++) {
      const a = t * .8 + i * Math.PI;
      const x = BOWL.x + Math.cos(a) * BOWL.rx * .62, y = BOWL.y + Math.sin(a) * BOWL.ry * .62;
      g.ellipse(x, y, 16, 3.2).fill({color: HI, alpha: .55 + .25 * Math.sin(a)});
    }
    // glints on the lower pool that fade in and out
    for (const p of glints) {
      const a = Math.max(0, Math.sin(t * 1.4 + p.phase * 6));
      if (a < .05) continue;
      g.roundRect(p.x - 9 * a, p.y - 1.4, 18 * a, 2.8, 1.4).fill({color: RIPPLE, alpha: .8 * a});
    }
  }
  return {root, update};
}
