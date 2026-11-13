import {Container, Graphics} from 'pixi.js';
import {PALETTE} from '../../shared/palette.js';
import {JUMP_LAND, RUN_SPEED, WALK_SPEED} from '../../../gameplay/player-motion.js';

const POOL = 48, LIFE = .4, RUN_EVERY = .1;

export function createDust(parent) {
  const puffs = [];
  for (let i = 0; i < POOL; i++) {
    const g = new Graphics({label: 'Dust puff'}).circle(0, 0, 15).fill({color: 0xFFF6DF}).stroke({color: PALETTE.ink, width: 3, alpha: .7});
    g.visible = false; parent.addChild(g);
    puffs.push({g, age: LIFE, x: 0, y: 0, vx: 0, vy: 0, size: 1});
  }
  let next = 0;
  const seen = new WeakMap();

  function puff(x, y, {vx = 0, vy = 0, size = 1, front = false, z = y} = {}) {
    const p = puffs[next]; next = (next + 1) % POOL;
    Object.assign(p, {age: 0, x, y, vx, vy, size});
    p.g.visible = true; p.g.zIndex = z + (front ? 4 : -4);
    place(p);
  }
  function place(p) {
    const k = p.age / LIFE, grow = 1 - (1 - k) ** 2;
    p.g.position.set(p.x + p.vx * grow, p.y + p.vy * grow - 10 * grow * p.size);
    p.g.scale.set((.55 + .75 * grow) * p.size, (.45 + .6 * grow) * p.size);
    p.g.alpha = (1 - k) ** 1.4 * .95;
  }
  function land(x, y, size = 1, z = y) {
    for (let i = 0; i < 6; i++) {
      const a = (i + .5) / 6 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      puff(x + c * 26 * size, y + s * 8 * size, {vx: c * 64 * size, vy: s * 16 * size, size: (.8 + (i % 2) * .25) * size, front: s > 0, z});
    }
  }
  return {
    land,
    puff,
    track(key, {x, y, z = y, jumpLeft = 0, travel = 0, turn = 0, onLand = true, reduced = false, dt = 0}) {
      const last = seen.get(key) ?? {jumpLeft: 0, run: 0};
      if (onLand && !reduced) {
        if (last.jumpLeft > JUMP_LAND && jumpLeft <= JUMP_LAND) land(x, y, 1, z);
        const running = travel > WALK_SPEED * 1.15 && !(jumpLeft > 0);
        last.run = running ? last.run + dt : RUN_EVERY * .7;
        if (running && last.run >= RUN_EVERY) {
          last.run = 0;
          const side = Math.random() < .5 ? -1 : 1, bx = -Math.sin(turn), by = -Math.cos(turn);
          puff(x + bx * 14 + side * 8, y + by * 6, {vx: bx * 34 + side * 10, vy: by * 8, size: .55 + Math.min(1, (travel - WALK_SPEED) / (RUN_SPEED - WALK_SPEED)) * .25, z});
        }
      }
      last.jumpLeft = jumpLeft;
      seen.set(key, last);
    },
    update(dt) {
      for (const p of puffs) {
        if (p.age >= LIFE) continue;
        p.age += dt;
        if (p.age >= LIFE) {p.g.visible = false; continue;}
        place(p);
      }
    },
  };
}
