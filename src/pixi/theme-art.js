// boss 6 Nov: a themed island's own art (concepts/themes/THEME-CONTRACT.md, section 4), loaded only when that island or
// its copy comes near (engine.js ensureArt), so start-up stays as fast as before. Builds, in the island map's own local
// coordinates: the ground (tiles + flats), the decks Duckies walk over, the contact shadows, and the standing props (sorted
// with the Duckies by y). Everything starts hidden; the engine shows one island's art at a time (showArt).
import largeArtTiles from './large-art-tiles.json' with {type:'json'};
import {artResolution} from './art-resolution.js';
import {Container, Graphics, Sprite} from 'pixi.js';
import {rasterTiles,RASTER_GROUND_TILE_SIZE,RASTER_ART_BUDGET_BYTES,RASTER_ART_UTILIZATION} from './theme-raster.js';
import {createRasterLoader} from './theme-art-stream.js';
import {fairTiles,FAIR_GROUND_TILE_SIZE,FAIR_ART_BUDGET_BYTES,FAIR_ART_UTILIZATION,FAIR_KITE_RESOLUTION} from './fair-raster.js';
import {createFairRasterLoader} from './fair-art-stream.js';
import {createGroundPool} from './ground-stream.js';

import {createFountainWater} from './fountain.js';
import {createAutumnLeaves} from './autumn-leaves.js';
import {KITE_ASSETS, createHomeKites} from './home-kites.js';

const WIND = /tree|reeds|cattails|flower|leaf|bush|flag|bunting|banner|umbrella|sunflower/i;
const NO_SHADOW = /bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i;

export async function loadThemeArt(map, {acquire, release, groundPool, rasterLoaderFactory=createRasterLoader}) {
  const [manifest, centre] = await Promise.all([
    fetch(map.art).then(response => {
      if (!response.ok) throw Error(`theme art ${map.id}: HTTP ${response.status}`);
      return response.json();
    }),
    fetch(map.art.replace('art.json', 'centre/centre.json'))
      .then(response => response.ok ? response.json() : {pieces: []}),
  ]);
  const base = map.art.slice(0, map.art.lastIndexOf('/') + 1);
  const url = src => /^(\/|https?:|data:)/.test(src) ? src : base + src;
  const tiles = manifest.ground?.tiles ?? [], decks = manifest.decks ?? [], flats = manifest.flats ?? [], props = manifest.props ?? [];
  const floating = manifest.floating ?? [];   // boss 6 Nov: lily pads and other floating things that bob on the water, like home's
  const fair=map.id==='fair',crisp=fair||manifest.raster?.enabled===true;
  const makeTiles=fair?fairTiles:rasterTiles,groundTileSize=fair?FAIR_GROUND_TILE_SIZE:RASTER_GROUND_TILE_SIZE;
  const raster=crisp?(fair?createFairRasterLoader():rasterLoaderFactory()):null;
  const rasterPool=crisp?createGroundPool({...raster,budget:fair?FAIR_ART_BUDGET_BYTES:RASTER_ART_BUDGET_BYTES,utilization:fair?FAIR_ART_UTILIZATION:RASTER_ART_UTILIZATION}):null;
  const tileSet=(p,native)=>largeArtTiles[map.id]?.[[p.src,p.width,p.height,p.resolution??native].join('|')];
  const entries = crisp?[]:[...decks.filter(p=>!tileSet(p,1.5)).map(d => ({...d, resolution: d.resolution ?? 1.5})),
    ...flats.filter(p=>!tileSet(p,2)).map(f => ({...f, resolution: f.resolution ?? 2})), ...props.map(p => ({...p, resolution: p.resolution ?? 2})),
    ...floating.map(f => ({...f, resolution: f.resolution ?? 2}))];
  const sources = entries.map(e => url(e.src));
  // Repeated flowers, tiles and props share one lease per theme, at the highest
  // requested resolution. Fair alone places over 1,900 sprites from 108 sources.
  const resolutions = new Map();
  entries.forEach((entry, i) => resolutions.set(sources[i], Math.max(resolutions.get(sources[i]) ?? 0, artResolution({...entry,src:sources[i]},entry.resolution))));
  const kiteSource=src=>fair?src+'?fairRaster='+FAIR_KITE_RESOLUTION:src;
  if (manifest.kites?.length) for (const src of KITE_ASSETS) resolutions.set(kiteSource(src), fair?FAIR_KITE_RESOLUTION:2);
  for (const src of manifest.autumn?.leaves ?? []) resolutions.set(url(src), crisp?3.625:2);
  const uniqueSources = [...resolutions.keys()];
  const loaded=new Array(uniqueSources.length);let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<uniqueSources.length){const i=cursor++,src=uniqueSources[i];
      try{loaded[i]={status:'fulfilled',value:await acquire(src,resolutions.get(src))};}
      catch(reason){loaded[i]={status:'rejected',reason};}
    }
  }));
  const failed = loaded.find(result => result.status === 'rejected');
  if (failed) {
    uniqueSources.forEach(src => release(src));
    rasterPool?.destroy();raster?.destroy();
    throw failed.reason;
  }
  const bySource = new Map(uniqueSources.map((src, i) => [src, loaded[i].value]));
  const textures = sources.map(src => bySource.get(src));
  let destroyed = false;
  const ground = new Container({label: `Theme ${map.id} - ground`}), deckLayer = new Container({label: `Theme ${map.id} - decks`});
  const shadows = new Container({label: `Theme ${map.id} - shadows`});
  let k = 0;
  const groundStream=crisp?groundPool.create(tiles.flatMap(p=>makeTiles(p,url(p.src),undefined,groundTileSize).map(({localX,localY,...t})=>t)),ground,undefined,raster):groundPool.create(tiles,ground,url),groundStreams=[groundStream];
  const crispSprite=(p,layer,anchor)=>{
    const container=new Container();container.position.set(p.x,p.y);layer?.addChild(container);
    const pool=!fair&&p.rasterPool==='ground'?groundPool:rasterPool;
    groundStreams.push(pool.create(makeTiles(p,url(p.src),anchor).map(t=>({...t,priority:p.rasterPriority??(props.includes(p)?2:0)})),container,undefined,raster));
    return container;
  };
  const tiled=(p,native,layer,anchor)=>{
    const set=tileSet(p,native);if(!set)return false;
    const container=new Container();layer.addChild(container);
    const x=p.x-p.width*anchor.x,y=p.y-p.height*anchor.y;
    groundStreams.push(groundPool.create(set.map(t=>({...t,x:x+(p.flip?p.width-t.x-t.width:t.x),y:t.y+y,flip:p.flip})),container));
    return true;
  };
  let terrain;
  try {terrain=await acquire(`/pixi-art/globe/${map.id}-ground.svg`,1);}
  catch(error){groundStream.destroy();rasterPool?.destroy();raster?.destroy();uniqueSources.forEach(src=>release(src));release(`/pixi-art/globe/${map.id}-ground.svg`);ground.destroy({children:true});deckLayer.destroy();shadows.destroy();throw error;}
  const fallback=new Sprite(terrain);fallback.position.set(map.origin.x,map.origin.y);fallback.width=map.width;fallback.height=map.height;ground.addChildAt(fallback,0);
  // boss 8 Nov (sailable rivers, as home's engine.js bridgeOver): a deck marked overBoats is a river bridge a boat passes under. A copy
  // above the Duckies is shown only while a boat is beneath it, so the deck is drawn over the hull.
  const overLayer = new Container({label: `Theme ${map.id} - bridges over boats`}), bridgeOver = [];
  for (const deck of decks) {
    if(crisp){
      crispSprite(deck,deckLayer,{x:0,y:0});
      if(deck.overBoats){const over=crispSprite(deck,overLayer,{x:0,y:0});over.visible=false;
        bridgeOver.push({sprite:over,x0:deck.x-20,x1:deck.x+deck.width+20,y0:deck.y,y1:deck.y+deck.height+40});}
      continue;
    }
    if(tiled(deck,1.5,deckLayer,{x:0,y:0}))continue;
    const texture = textures[k++], s = new Sprite(texture); s.position.set(deck.x, deck.y); s.width = deck.width; s.height = deck.height; deckLayer.addChild(s);
    if (deck.overBoats) {
      const over = new Sprite(texture); over.position.set(deck.x, deck.y); over.width = deck.width; over.height = deck.height; over.visible = false;
      overLayer.addChild(over);
      bridgeOver.push({sprite: over, x0: deck.x - 20, x1: deck.x + deck.width + 20, y0: deck.y, y1: deck.y + deck.height + 40});
    }
  }
  for (const flat of flats) {
    if(crisp){crispSprite(flat,ground,flat.topLeft?{x:0,y:0}:{x:.5,y:1});continue;}
    if(tiled(flat,2,ground,flat.topLeft?{x:0,y:0}:{x:.5,y:1}))continue;
    const s = new Sprite(textures[k++]); s.position.set(flat.x, flat.y);
    if (!flat.topLeft) s.anchor.set(.5, 1);   // decals sit on their base point, like home's
    s.width = flat.width; s.height = flat.height; if (flat.flip) s.scale.x *= -1;
    ground.addChild(s);
  }
  const standing = props.map((prop, i) => {
    const scale = prop.scale ?? 1, anchor = prop.anchor ?? {x: .5, y: 1}, name = prop.name ?? prop.asset ?? prop.src;
    const sprite = crisp?crispSprite(prop,null,anchor):new Sprite(textures[k++]);
    if(!crisp){
      sprite.anchor.set(anchor.x, anchor.y); sprite.position.set(prop.x, prop.y);
      sprite.width = prop.width * scale; sprite.height = prop.height * scale;
      if (prop.flip) sprite.scale.x *= -1;
    }
    if (prop.tint) sprite.tint = prop.tint;
    sprite.zIndex = prop.z ?? ((prop.sortY ?? prop.y) + (prop.sortOrder ?? 0) * .00001); sprite.standing = true; // Keep authored depth order for overlapping hamlet objects.
    sprite.themeArt = map.id;
    let shadow = null;
    if (!NO_SHADOW.test(name) && prop.shadow !== false) {
      const [rx, ry] = prop.shadowSize ?? (r => [r, r * .3])(Math.max(8, Math.min(300, prop.width * scale * .36)));   // boss 8 Nov: a hamlet building's base shadow fits its footprint
      shadow = new Graphics().ellipse(rx * .06, ry * .1, rx, ry).fill({color: 0x3c5a2a, alpha: .15});
      shadow.position.set(prop.x + (prop.shadowOffset?.[0] ?? 0), prop.y + (prop.shadowOffset?.[1] ?? 0)); shadows.addChild(shadow);
    }
    const centrePiece = typeof prop.centrePiece === 'object' ? prop.centrePiece : centre.pieces.find(p => prop.id?.endsWith(p.id) && prop.src.includes('centre/'));
    return {...prop, centrePiece, id: prop.id ?? `${map.id}-${i}`, name, scale, sprite, shadow, deck: prop.deck ?? /bridge|deck/i.test(name), wind: prop.wind ?? (!prop.src.includes('centre/') && WIND.test(name))};
  });
  // Theme fountains share Home's water ribbons, landing rings and spray.
  const fountainWaters = standing.filter(p=>p.fountainWater).map(p=>{
    const layer=new Container({label:'Theme fountain water'});
    const fx=createFountainWater(p,layer,null,p.fountainWater);
    fx.root.zIndex=(p.sortY??p.y)+.5;
    return {...fx,layer,x:p.x,y:p.y};
  });
  const floatLayer = new Container({label: `Theme ${map.id} - floating`});
  const floats = floating.map((item, i) => {
    const anchor = item.anchor ?? {x: .5, y: .5};
    const sprite = crisp?crispSprite(item,null,anchor):new Sprite(textures[k++]);
    if(!crisp){sprite.anchor.set(anchor.x, anchor.y); sprite.position.set(item.x, item.y); sprite.width = item.width; sprite.height = item.height;
    if (item.flip) sprite.scale.x *= -1;}
    floatLayer.addChild(sprite);
    return {...item, phase: item.phase ?? i * 1.7, sprite};
  });
  const kiteLayer = manifest.kites?.length ? new Container({label: `Theme ${map.id} - kites`}) : null;
  const kites = kiteLayer ? createHomeKites(kiteLayer, Object.fromEntries(KITE_ASSETS.map(src => [src, bySource.get(kiteSource(src))])), manifest.kites) : null;
  const autumnLeaves = manifest.autumn ? createAutumnLeaves(props, manifest.autumn.leaves.map(src => bySource.get(url(src))), manifest.autumn) : null;
  // The loader owns effects even before the engine mounts them. Keeping their
  // roots here also makes show/hide and unload use the same island lifecycle.
  const groups = [ground, deckLayer, shadows, floatLayer, overLayer, ...(kiteLayer ? [kiteLayer] : []), ...(autumnLeaves ? [autumnLeaves.layer] : []), ...fountainWaters.map(f=>f.root)];
  for (const group of groups) group.visible = false;
  return {
    id: map.id, map, groundStream, groundStreams, rasterPool, ready: true, sea: manifest.sea ?? map.sea ?? null, ground, decks: deckLayer, shadows, props: standing, floatLayer, floating: floats,
    overLayer, bridgeOver, kiteLayer, kites, autumnLeaves, fountainWaters,
    groups,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      groundStreams.forEach(s=>s.destroy());
      rasterPool?.destroy();
      raster?.destroy();
      release(`/pixi-art/globe/${map.id}-ground.svg`);
      for (const c of groups) c.destroy({children: true});
      for (const f of fountainWaters) {if(!f.root.destroyed)f.root.destroy({children:true}); f.layer.destroy();}
      for (const p of standing) p.sprite.destroy();
      uniqueSources.forEach(src => release(src));
    },
  };
}
