import {Graphics} from 'pixi.js';
import {createFountainSurface, WATER_STEP} from './water.js';

const ellipse = (p, x, y) => ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2;

export function basinContains(layout, x, y) {
  if (ellipse(layout.pool, x, y) >= 1) return false;
  const island = layout.island;
  if (!island) return true;
  const u = (x - island.x) / island.rx;
  return ellipse(island, x, y) > 1 && !(Math.abs(u) <= 1 && y >= island.y
    && y <= island.bottom + island.depth * (1 - u * u));
}

export function basinMask(layout) {
  const {width, height} = layout, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    data[i] = basinContains(layout, x * width / (width - 1), y * height / (height - 1)) ? 255 : 0;
    data[i + 3] = 255;
  }
  return {width, height, data};
}

export function basinClip(layout) {
  const {pool, island} = layout;
  const clip = new Graphics({label: 'Fountain basin clip'}).ellipse(pool.x, pool.y, pool.rx, pool.ry).fill(0xffffff);
  if (island) {
    const points = [];
    for (let i = 0; i <= 128; i++) {
      const a = Math.PI + Math.PI * i / 128;
      points.push(island.x + Math.cos(a) * island.rx, island.y + Math.sin(a) * island.ry);
    }
    for (let i = 128; i >= 0; i--) {
      const u = -1 + 2 * i / 128;
      points.push(island.x + u * island.rx, Math.max(island.y + island.ry * Math.sqrt(Math.max(0, 1 - u * u)),
        island.bottom + island.depth * (1 - u * u)));
    }
    clip.poly(points).cut();
  }
  return clip;
}

export function createBasinWater(layout, parent) {
  const body = createFountainSurface({id: 'pool', rect: {x: 0, y: 0, width: layout.width, height: layout.height},
    cols: 81, rows: 65, mask: basinMask(layout), parent, solid: true,
    shape: (u, v) => basinContains(layout, u * layout.width, v * layout.height)});
  let accumulator = 0, time = 0, calm = false, shown = false;
  return {...body, active: true,
    update(dt, reduced, visible) {
      body.mesh.visible = visible;
      shown = visible;
      if (!visible) {accumulator = 0; return;}
      if (calm !== reduced) {calm = reduced; accumulator = 0; body.field.clear(); body.dirty = true;}
      if (!reduced) {
        accumulator += Math.min(.1, Math.max(0, dt));
        let steps = 0;
        while (accumulator + 1e-9 >= WATER_STEP && steps++ < 6) {
          body.field.step(); body.dirty = true; time += WATER_STEP; accumulator -= WATER_STEP;
        }
        if (accumulator >= WATER_STEP) accumulator %= WATER_STEP;
      }
      if (body.dirty) {body.field.pack(); body.heights.update(); body.dirty = false;}
      body.uniforms.uMix = reduced ? 1 : accumulator / WATER_STEP;
      body.uniforms.uTime = reduced ? 0 : time + accumulator;
      body.uniforms.uCalm = Number(reduced);
    },
    fountainSplash(x, y, strength) {
      if (!shown || calm) return;
      const hit = body.field.impulse(x, y, strength, 10); body.dirty ||= hit;
    },
  };
}
