import {overviewPatch} from './sphere-mesh.js';
import {copyTransform} from './sphere-coordinates.js';
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
  const people = new Container({label: '30,000 Duckies'});
  const peopleTextures = new Map();
  layer.addChildAt(root, 0);   // under the real island's water and ground
  root.addChild(copies, people);
  let destroyed=false;
  let current = 'home', islands = [], bounds = MAP_BOUNDS, version = 0;
  const thumbnails = new Map();
  const radarTextures = new Map();
  const textures = new Map();
  const leasedPreviews=new Set();   // map id -> snapshot of that map's art
  const textureOf = id => textures.get(artOf(id)) ?? textures.get('home');
  const sizeOf = id => mapFor(textures.has(artOf(id)) ? artOf(id) : 'home');
  const sprites = new Map();
  // every island in the current island's local coordinates: the current one sits where the real scene is drawn
  const place = () => {
    const here = worldIsland(current), m = mapOf(current);
    cx = m.cx; cy = m.cy;
    islands = WORLD_ISLANDS.map(island => ({...island, ...copyTransform(current,island.id), from:current,
      scale: 1, flip: 1, rot: 0, home: island.id === current, map: artOf(island.id), localCentre:{x:mapOf(island.id).cx,y:mapOf(island.id).cy}, width: mapOf(island.id).width, height: mapOf(island.id).height}));
    bounds = {x0:cx-SX/2,x1:cx+SX/2,y0:cy-SX/2,y1:cy+SX/2};
  };
  const draw = () => {
    if (!textures.has('home')) return;
    copies.removeChildren().forEach(child => {child.geometry?.destroy();child.destroy();});
    sprites.clear();
    for (const island of islands) if (!island.home) {
      const s=overviewPatch(current,island.id,textureOf(island.id));sprites.set(island.id,s);
      s.tint=island.map==='home'?island.tint:0xffffff;
      copies.addChild(s);
    }
    // Share a small raster of 100 dots instead of uploading 30,000 rectangles.
    people.removeChildren().forEach(child => child.destroy());
    for (const island of islands) {
      const key = `${island.width}x${island.height}`;
      let texture = peopleTextures.get(key);
      if (!texture) {
        const dots = new Graphics();
        let seed = 7;
        const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let k = 0; k < 100; k++) {
          const angle = random() * 6.28, radius = Math.sqrt(random());
          dots.rect(island.width / 2 + Math.cos(angle) * radius * island.width * .36 - 90,
            island.height / 2 + Math.sin(angle) * radius * island.height * .32 - 90, 180, 180);
        }
        dots.fill(0xE8A000);
        texture = app.renderer.generateTexture({target: dots,
          frame: new Rectangle(0, 0, island.width, island.height), resolution: 512 / Math.max(island.width, island.height)});
        dots.destroy();
        peopleTextures.set(key, texture);
      }
      const sprite = new Sprite(texture);
      sprite.anchor.set(.5); sprite.position.set(island.x, island.y);
      sprite.width = island.width; sprite.height = island.height;
      people.addChild(sprite);
    }
  };
  place();
  return {
    async loadPreviews(acquire) {
      // Small authored rasters, never the source maps. Publish all thirteen in
      // one revision so the globe atlas is built once rather than thirteen times.
      const loaded=await Promise.all(WORLD_ISLANDS.map(async island=>{
        const id=artOf(island.id),texture=await acquire(`/pixi-art/globe/${id}.png`);
        return [id,texture];
      }));
      if(destroyed)return;
      for(const [id,texture] of loaded){textures.set(id,texture);radarTextures.set(id,texture);leasedPreviews.add(texture);}
      version++;place();draw();
    },
    get current(){return current;}, get bounds() {return bounds;}, get islands() {return islands;}, count: ISLAND_COUNT, get texture() {return textures.get('home') ?? null;},
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
      const texture = app.renderer.generateTexture({target: scene, frame: new Rectangle(m.origin.x, m.origin.y, m.width, m.height), resolution: Math.min(.4, 1024 / Math.max(m.width, m.height))});
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
          frame: new Rectangle(m.origin.x, m.origin.y, m.width, m.height), resolution: .12});
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
    destroy() {destroyed=true;for (const texture of peopleTextures.values()) texture.destroy(true); peopleTextures.clear(); thumbnails.clear(); root.destroy({children: true}); for (const t of new Set([...textures.values(),...radarTextures.values()])) if(!leasedPreviews.has(t))t.destroy(true);},
  };
}
