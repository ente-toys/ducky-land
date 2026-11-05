// boss 5 Nov: 300 home islands (30k stars = 300 islands), all the same island for now; themes come later.
// One snapshot of the home island is reused for 299 copies laid out round it on a loose grid in the sea,
// and the bird's-eye view zooms the camera out far enough to see the whole archipelago.
import {Container, Rectangle, Sprite} from 'pixi.js';

export const ISLAND_COUNT = 300;
const COLS = 20, ROWS = 15, GAP = {x: 7600, y: 6400};   // island 5800 x 4400 plus open sea between
const hash = i => {const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s);};

// grid cell (col,row) for every island; home sits in the middle cell, so the grid spreads out round it
export function archipelagoLayout(world) {
  const home = {col: Math.floor(COLS / 2), row: Math.floor(ROWS / 2)}, out = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const i = row * COLS + col, isHome = col === home.col && row === home.row;
    const jx = isHome ? 0 : (hash(i * 3.1) - .5) * 1400, jy = isHome ? 0 : (hash(i * 7.7) - .5) * 1200;
    out.push({index: i, home: isHome, x: (col - home.col) * GAP.x + jx, y: (row - home.row) * GAP.y + jy});
  }
  const xs = out.map(p => p.x), ys = out.map(p => p.y);
  return {islands: out, bounds: {x0: Math.min(...xs) - 1500, y0: Math.min(...ys) - 1500, x1: Math.max(...xs) + world.width + 1500, y1: Math.max(...ys) + world.height + 1500}};
}

export function createArchipelago(app, scene, layer, world) {
  const {islands, bounds} = archipelagoLayout(world);
  const root = new Container({label: 'Archipelago'});
  layer.addChildAt(root, 0);   // under the home island's water and ground
  let texture = null;
  return {
    bounds, count: islands.length,
    // snapshot the home island as it is drawn now (ground, props, everything), once, at a small size
    build() {
      if (texture) return;
      const keep = {x: scene.position.x, y: scene.position.y, sx: scene.scale.x, sy: scene.scale.y};
      scene.position.set(0, 0); scene.scale.set(1, 1); root.visible = false;
      texture = app.renderer.generateTexture({target: scene, frame: new Rectangle(0, 0, world.width, world.height), resolution: .14});
      scene.position.set(keep.x, keep.y); scene.scale.set(keep.sx, keep.sy); root.visible = true;
      for (const island of islands) if (!island.home) {
        const s = new Sprite(texture);
        s.position.set(island.x, island.y); s.width = world.width; s.height = world.height;
        root.addChild(s);
      }
    },
    destroy() {root.destroy({children: true}); texture?.destroy(true);},
  };
}
