// boss 5 Nov: 300 islands (30k stars = 300 islands), every one an exact copy of the home island (world-map.js); themes
// come later. You stand on one island at a time: it is the real, playable scene, and the other 299 are drawn round it as
// copies at their true places, so you can sail across to the next one. The ones on screen up close are the live island
// drawn again (engine.js renderLiveCopies); far away a snapshot of it stands in.
// 30,000 Duckies (100 per island) show as tiny yellow dots once you zoom far out.
import {Container, Graphics, Rectangle, Sprite} from 'pixi.js';
import {MAP_BOUNDS, WORLD_ISLANDS, worldIsland} from './world-map.js';
import {artOf, mapFor, mapOf} from './island-maps.js';

export const ISLAND_COUNT = WORLD_ISLANDS.length;

export function createArchipelago(app, scene, layer, world) {
  // boss 6 Nov: every island is drawn by its own map (its theme's art, or home's until that theme is delivered), placed by
  // its centre, so maps of any size line up. cx, cy: the centre of the current island's map in its local coordinates.
  let cx = world.width / 2, cy = world.height / 2;
  const SX = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;
  const wrap = v => v - SX * Math.round(v / SX);
  const root = new Container({label: 'Archipelago'}), copies = new Container({label: 'Island copies'});
  const people = new Graphics({label: '30,000 Duckies'});
  layer.addChildAt(root, 0);   // under the real island's water and ground
  root.addChild(copies, people);
  let current = 'home', islands = [], bounds = MAP_BOUNDS, version = 0;
  const thumbnails = new Map();
  const radarTextures = new Map();
  const textures = new Map();   // map id -> snapshot of that map's art
  const textureOf = id => textures.get(artOf(id)) ?? textures.get('home');
  const sizeOf = id => mapFor(textures.has(artOf(id)) ? artOf(id) : 'home');
  const sprites = new Map();
  // every island in the current island's local coordinates: the current one sits where the real scene is drawn
  const place = () => {
    const here = worldIsland(current), m = mapOf(current);
    cx = m.width / 2; cy = m.height / 2;
    islands = WORLD_ISLANDS.map(island => ({...island, x: cx + wrap(island.x - here.x), y: cy + island.y - here.y,
      scale: 1, flip: 1, rot: 0, home: island.id === current, map: artOf(island.id), width: mapOf(island.id).width, height: mapOf(island.id).height}));
    bounds = {x0: MAP_BOUNDS.x0 - (here.x - cx), x1: MAP_BOUNDS.x1 - (here.x - cx), y0: MAP_BOUNDS.y0 - (here.y - cy), y1: MAP_BOUNDS.y1 - (here.y - cy)};
  };
  const draw = () => {
    if (!textures.has('home')) return;
    copies.removeChildren().forEach(child => child.destroy());
    sprites.clear();
    for (const island of islands) if (!island.home) {
      const s = new Sprite(textureOf(island.id)), size = sizeOf(island.id); sprites.set(island.id, s);
      s.anchor.set(.5); s.position.set(island.x, island.y);
      s.width = size.width; s.height = size.height; s.tint = island.map === 'home' ? island.tint : 0xFFFFFF;
      copies.addChild(s);
    }
    // 30,000 Duckies: 100 tiny yellow dots per island, scattered over its land
    let n = 7;
    const r = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
    people.clear();
    for (const island of islands) for (let k = 0; k < 100; k++) {
      const a = r() * 6.28, d = Math.sqrt(r());
      people.rect(island.x + Math.cos(a) * d * island.width * .36 - 90, island.y + Math.sin(a) * d * island.height * .32 - 90, 180, 180);   // each island's own size
    }
    people.fill(0xE8A000);
  };
  place();
  return {
    get bounds() {return bounds;}, get islands() {return islands;}, count: ISLAND_COUNT, get texture() {return textures.get('home') ?? null;},
    get version() {return version;}, has: mapId => textures.has(mapId), textureOf, sizeOf,
    // Reuse the real island terrain and major landmarks, including delivered themes.
    // Read back a small image once per texture/tint, never once per movement tick.
    thumbnailOf(id) {
      const texture = radarTextures.get(artOf(id)) ?? radarTextures.get('home');
      if (!texture) return null;
      const island = islands.find(item => item.id === id);
      const tint = island.map === 'home' ? island.tint : 0xFFFFFF;
      let variants = thumbnails.get(texture);
      if (!variants) {variants = new Map(); thumbnails.set(texture, variants);}
      if (!variants.has(tint)) {
        const size = sizeOf(id), sprite = new Sprite(texture);
        sprite.width = size.width; sprite.height = size.height; sprite.tint = tint;
        try {
          const canvas = app.renderer.extract.canvas({target: sprite,
            frame: new Rectangle(0, 0, size.width, size.height),
            resolution: Math.min(1, 768 / Math.max(size.width, size.height)), clearColor: 0x00000000});
          variants.set(tint, {src: canvas.toDataURL('image/png'), width: size.width, height: size.height});
        } finally {sprite.destroy();}
      }
      return variants.get(tint);
    },
    // snapshot the real island as it is drawn now (ground, props, everything), once per map, sharp enough not to go blocky.
    // The engine shows that map's art (and only it) in the scene before calling this.
    build(mapId = 'home') {
      if (textures.has(mapId)) return;
      const m = mapFor(mapId), keep = {x: scene.position.x, y: scene.position.y, sx: scene.scale.x, sy: scene.scale.y};
      scene.position.set(0, 0); scene.scale.set(1, 1); root.visible = false;
      const texture = app.renderer.generateTexture({target: scene, frame: new Rectangle(0, 0, m.width, m.height), resolution: .4});
      texture.source.scaleMode = 'linear';
      scene.position.set(keep.x, keep.y); scene.scale.set(keep.sx, keep.sy); root.visible = true;
      textures.set(mapId, texture); version++;
      place(); draw();
    },
    // The radar keeps the real terrain and major landmarks, without the world's
    // small props and animated characters. Capture it separately from world copies.
    buildRadar(mapId) {
      if (radarTextures.has(mapId)) return;
      const m = mapFor(mapId), keep = {x: scene.x, y: scene.y, sx: scene.scale.x, sy: scene.scale.y, visible: root.visible};
      scene.position.set(0, 0); scene.scale.set(1, 1); root.visible = false;
      try {
        const texture = app.renderer.generateTexture({target: scene,
          frame: new Rectangle(0, 0, m.width, m.height), resolution: .12});
        texture.source.scaleMode = 'linear';
        radarTextures.set(mapId, texture);
      } finally {
        scene.position.set(keep.x, keep.y); scene.scale.set(keep.sx, keep.sy); root.visible = keep.visible;
      }
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
    destroy() {thumbnails.clear(); root.destroy({children: true}); for (const t of textures.values()) t.destroy(true); for (const t of radarTextures.values()) t.destroy(true);},
  };
}
