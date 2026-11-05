// boss 5 Nov: 300 islands (30k stars = 300 islands), every one an exact copy of the home island (world-map.js); themes
// come later. You stand on one island at a time: it is the real, playable scene, and the other 299 are drawn round it as
// copies at their true places, so you can sail across to the next one. The ones on screen up close are the live island
// drawn again (engine.js renderLiveCopies); far away a snapshot of it stands in.
// 30,000 Duckies (100 per island) show as tiny yellow dots once you zoom far out.
import {Container, Graphics, Rectangle, Sprite} from 'pixi.js';
import {MAP_BOUNDS, WORLD_ISLANDS, worldIsland} from './world-map.js';

export const ISLAND_COUNT = WORLD_ISLANDS.length;

export function createArchipelago(app, scene, layer, world) {
  const cx = world.width / 2, cy = world.height / 2, SX = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;
  const wrap = v => v - SX * Math.round(v / SX);
  const root = new Container({label: 'Archipelago'}), copies = new Container({label: 'Island copies'});
  const people = new Graphics({label: '30,000 Duckies'});
  layer.addChildAt(root, 0);   // under the real island's water and ground
  root.addChild(copies, people);
  let texture = null, current = 'home', islands = [], bounds = MAP_BOUNDS;
  const sprites = new Map();
  // every island in the current island's local coordinates: the current one sits where the real scene is drawn
  const place = () => {
    const here = worldIsland(current);
    islands = WORLD_ISLANDS.map(island => ({...island, x: cx + wrap(island.x - here.x), y: cy + island.y - here.y,
      scale: 1, flip: 1, rot: 0, home: island.id === current}));
    bounds = {x0: MAP_BOUNDS.x0 - (here.x - cx), x1: MAP_BOUNDS.x1 - (here.x - cx), y0: MAP_BOUNDS.y0 - (here.y - cy), y1: MAP_BOUNDS.y1 - (here.y - cy)};
  };
  const draw = () => {
    if (!texture) return;
    copies.removeChildren().forEach(child => child.destroy());
    sprites.clear();
    for (const island of islands) if (!island.home) {
      const s = new Sprite(texture); sprites.set(island.id, s);
      s.anchor.set(.5); s.position.set(island.x, island.y);
      s.width = world.width; s.height = world.height; s.tint = island.tint;
      copies.addChild(s);
    }
    // 30,000 Duckies: 100 tiny yellow dots per island, scattered over its land
    let n = 7;
    const r = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
    people.clear();
    for (const island of islands) for (let k = 0; k < 100; k++) {
      const a = r() * 6.28, d = Math.sqrt(r());
      people.rect(island.x + Math.cos(a) * d * world.width * .36 - 90, island.y + Math.sin(a) * d * world.height * .32 - 90, 180, 180);
    }
    people.fill(0xE8A000);
  };
  place();
  return {
    get bounds() {return bounds;}, get islands() {return islands;}, count: ISLAND_COUNT, get texture() {return texture;},
    // snapshot the real island as it is drawn now (ground, props, everything), once, sharp enough not to go blocky
    build() {
      if (texture) return;
      const keep = {x: scene.position.x, y: scene.position.y, sx: scene.scale.x, sy: scene.scale.y};
      scene.position.set(0, 0); scene.scale.set(1, 1); root.visible = false;
      texture = app.renderer.generateTexture({target: scene, frame: new Rectangle(0, 0, world.width, world.height), resolution: .4});
      texture.source.scaleMode = 'linear';
      scene.position.set(keep.x, keep.y); scene.scale.set(keep.sx, keep.sy); root.visible = true;
      draw();
    },
    // arrived on another island by boat: it becomes the real scene, everything else is redrawn round it
    setCurrent(id) {
      if (id === current || !worldIsland(id)) return;
      current = id; place(); draw();
    },
    // the copies drawn live this frame (engine.js) hide their snapshot so it does not show through
    showLive(ids) {for (const [id, s] of sprites) s.visible = !ids.has(id);},
    root,
    // the dots only show when zoomed far out (they would cover the islands up close)
    update(zoom) {
      const far = Math.max(0, Math.min(1, (.012 - zoom) / .006));
      people.alpha = far; people.visible = far > 0;
    },
    destroy() {root.destroy({children: true}); texture?.destroy(true);},
  };
}
