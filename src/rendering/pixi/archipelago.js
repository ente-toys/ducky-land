import {overviewPatch} from './sphere-mesh.js';
import {flatRigid} from '../../world/rigid.js';
import {Container, Graphics, Rectangle, Sprite, Texture} from 'pixi.js';
import {MAP_BOUNDS, WORLD_ISLANDS, worldIsland} from '../../world/world-map.js';
import {artOf, mapFor, mapOf} from '../../world/island-maps.js';

export const ISLAND_COUNT = WORLD_ISLANDS.length;
const placement=(from,to)=>{const r=flatRigid(from,to);return {a:r.a,b:r.b,c:r.c,d:r.d,x:r.x,y:r.y};};

export function createArchipelago(app, scene, layer, world) {
  let cx = world.width / 2, cy = world.height / 2;
  const SX = MAP_BOUNDS.x1 - MAP_BOUNDS.x0;
  const wrap = v => v - SX * Math.round(v / SX);
  const root = new Container({label: 'Archipelago'}), copies = new Container({label: 'Island copies'});
  const people = new Container({label: '30,000 Duckies'});
  const peopleTextures = new Map();
  layer.addChildAt(root, 0);
  root.addChild(copies, people);
  let destroyed=false;
  let current = 'home', islands = [], bounds = MAP_BOUNDS, version = 0;
  const textures = new Map();
  // Live snapshots can contain streamed water tiles. Only authored transparent
  // previews may define the globe's colour atlas and land ownership mask.
  const previews = new Map();
  const leasedPreviews=new Set();
  const textureOf = id => textures.get(artOf(id)) ?? textures.get('home');
  const sizeOf = id => mapFor(textures.has(artOf(id)) ? artOf(id) : 'home');
  const sprites = new Map();
  const place = () => {
    const here = worldIsland(current), m = mapOf(current);
    cx = m.cx; cy = m.cy;
    islands = WORLD_ISLANDS.map(island => ({...island, ...placement(current,island.id), from:current,
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
      const loaded=await Promise.all(WORLD_ISLANDS.map(async island=>{
        const id=artOf(island.id),texture=await acquire(`/pixi-art/globe/${id}.svg`);
        return [id,texture];
      }));
      if(destroyed)return;
      for(const [id,texture] of loaded){
        const old=textures.get(id);
        if(old&&!leasedPreviews.has(old))old.destroy(true);
        textures.set(id,texture);previews.set(id,texture);leasedPreviews.add(texture);
      }
      version++;place();draw();
    },
    get current(){return current;}, get bounds() {return bounds;}, get islands() {return islands;}, count: ISLAND_COUNT, get texture() {return textures.get('home') ?? null;},
    get version() {return version;}, has: mapId => textures.has(mapId), textureOf, sizeOf,
    globeTextureOf: id => previews.get(artOf(id)) ?? Texture.EMPTY,
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
    setCurrent(id) {
      if (id === current || !worldIsland(id)) return;
      current = id; place(); draw();
    },
    showLive(ids) {for (const [id, s] of sprites) s.visible = !ids.has(id);},
    root,
    update(zoom) {
      const far = Math.max(0, Math.min(1, (.012 - zoom) / .006));
      people.alpha = far; people.visible = far > 0;
    },
    destroy() {destroyed=true;for (const texture of peopleTextures.values()) texture.destroy(true); peopleTextures.clear(); root.destroy({children: true}); for (const t of textures.values()) if(!leasedPreviews.has(t))t.destroy(true);},
  };
}
