import {acquireArt, recoverArt, artPlaceholder} from './art-recovery.js';
import {mapArtInFrames} from './island-preparation.js';
import {planIslandArt} from './island-budget.js';
import largeArtTiles from './large-art-tiles.json' with {type:'json'};
import {artResolution} from '../../shared/art-resolution.js';
import {propZ} from '../../shared/flat-props.js';
import {Container, Graphics, Sprite} from 'pixi.js';
import {rasterTiles,RASTER_GROUND_TILE_SIZE,RASTER_ART_BUDGET_BYTES,RASTER_ART_UTILIZATION} from './theme-raster.js';
import {createRasterLoader} from './theme-art-stream.js';
import {createIcelandRasterLoader,icelandPieceTile,icelandWarmupTiles} from './iceland-art-stream.js';
import {createGroundPool} from './ground-stream.js';

import {loadPondDuckies} from '../environment/pond-duckies.js';
import {KITE_ASSETS, createHomeKites} from '../environment/home-kites.js';
import {createIcelandLifeLifecycle} from '../environment/iceland-life.js';

const WIND = /tree|reeds|cattails|flower|leaf|bush|flag|bunting|banner|umbrella|sunflower/i;
const NO_SHADOW = /bunting|banner|flag|bridge|blanket|lily|shell|reeds|rug|path|paving/i;

async function buildThemeArt(map, {acquire, release, groundPool, tilt=1, rasterLoaderFactory=createRasterLoader,icelandRasterLoaderFactory=createIcelandRasterLoader, prepare=false, dpr=2, defaultZoom=.65, landingPoint, cancelled=()=>false}) {
  const [manifest, centre] = await Promise.all([
    recoverArt(async()=>{
      const response=await fetch(map.art);
      if(!response.ok)return Promise.reject(Error(`theme art ${map.id}: HTTP ${response.status}`));
      const manifest=await response.json();
      if(!manifest||typeof manifest!=='object')return Promise.reject(Error('Invalid island art manifest'));
      return manifest;
    },{label:`theme ${map.id} manifest`,fallback:()=>({degraded:true})}),
    recoverArt(async()=>{
      const response=await fetch(map.art.replace('art.json','centre/centre.json'));
      return response.ok?response.json():{pieces:[]};
    },{label:`theme ${map.id} centre`,fallback:()=>({pieces:[]})}),
  ]);
  const base = map.art.slice(0, map.art.lastIndexOf('/') + 1);
  const url = src => /^(\/|https?:|data:)/.test(src) ? src : base + src;
  const props = (manifest.props ?? []).filter(p => !(map.id === 'snow' && manifest.icelandFinal && p.finalKind === 'smoke'));
  const tiles = manifest.ground?.tiles ?? [], decks = manifest.decks ?? [], flats = manifest.flats ?? [];
  const floating = manifest.floating ?? [];
  const iceland=!prepare&&map.id==='snow'&&Boolean(manifest.icelandFinal);
  const crisp=!prepare&&manifest.raster?.enabled===true;
  const makeTiles=rasterTiles;
  const raster=iceland?icelandRasterLoaderFactory():crisp?rasterLoaderFactory():null;
  const rasterPool=crisp||iceland?createGroundPool({...raster,budget:RASTER_ART_BUDGET_BYTES,utilization:RASTER_ART_UTILIZATION}):null;
  const tileSet=(p,native)=>!prepare&&largeArtTiles[map.id]?.[[p.src,p.width,p.height,p.resolution??native].join('|')];
  const entries = crisp||iceland?[]:[...decks.filter(p=>!tileSet(p,1.5)).map(d => ({...d, resolution: d.resolution ?? 1.5})),
    ...flats.filter(p=>(prepare||!p.tiles?.length||p.preload)&&!tileSet(p,2)).map(f => ({...f, resolution: f.resolution ?? 2,ground:true})), ...props.filter(p=>prepare||!p.tiles?.length||p.preload).map(p => ({...p, resolution: p.resolution ?? 2})),
    ...floating.map(f => ({...f, resolution: f.resolution ?? 2}))];
  const sources = entries.map(e => url(e.src));
  let resolutions = new Map();
  entries.forEach((entry, i) => resolutions.set(sources[i], Math.max(resolutions.get(sources[i]) ?? 0, artResolution({...entry,src:sources[i]},entry.resolution))));
  if(prepare)for(const p of tiles){const src=url(p.src);resolutions.set(src,Math.max(resolutions.get(src)??0,p.resolution??1));}
  if (manifest.kites?.length) for (const src of KITE_ASSETS) resolutions.set(src, 2);
  const artPlan=prepare?planIslandArt([...entries.map(e=>({...e,src:url(e.src)})),...tiles.map(e=>({...e,src:url(e.src),mipmaps:false})),...(manifest.kites?.length?KITE_ASSETS.map(src=>({src,resolution:2})):[])],{dpr,defaultZoom}):null;
  if(artPlan)resolutions=artPlan.resolutions;
  const uniqueSources = [...new Set([...sources,...(manifest.kites?.length?KITE_ASSETS:[])])];
  if(landingPoint){
    const distances=new Map();
    entries.forEach((entry,i)=>{
      const distance=Math.hypot(entry.x-landingPoint.x,entry.y-landingPoint.y);
      if(Number.isFinite(distance))distances.set(sources[i],Math.min(distance,distances.get(sources[i])??Infinity));
    });
    uniqueSources.sort((a,b)=>(distances.get(a)??Infinity)-(distances.get(b)??Infinity));
  }
  const loaded=new Array(uniqueSources.length),leased=new Set();let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<uniqueSources.length&&!cancelled()){const i=cursor++,src=uniqueSources[i];leased.add(src);
      try{loaded[i]={status:'fulfilled',value:await acquireArt(acquire,release,src,resolutions.get(src))};}
      catch(reason){loaded[i]={status:'rejected',reason};}
    }
  }));
  if(cancelled()){leased.forEach(src=>release(src));rasterPool?.destroy();raster?.destroy();return null;}
  for(let i=0;i<loaded.length;i++)if(loaded[i].status==='rejected'){
    console.warn(`theme ${map.id}: accepting missing picture`,loaded[i].reason);
    loaded[i]={status:'fulfilled',value:artPlaceholder()};
  }
  const bySource = new Map(uniqueSources.map((src, i) => [src, loaded[i].value]));
  const textures = sources.map(src => bySource.get(src));
  let destroyed = false;
  const ground = new Container({label: `Theme ${map.id} - ground`}), deckLayer = new Container({label: `Theme ${map.id} - decks`});
  const shadows = new Container({label: `Theme ${map.id} - shadows`});
  let k = 0;
  const groundStream=crisp?groundPool.create(tiles.flatMap(p=>rasterTiles(p,url(p.src),undefined,RASTER_GROUND_TILE_SIZE).map(({localX,localY,...t})=>t)),
  ground,undefined,raster):groundPool.create(iceland?tiles.map(t=>({...t,priority:-1})):tiles,ground,url),groundStreams=[groundStream];
  const icelandSprite=(p,layer,anchor)=>{
    const node=new Container({label:p.id});node.position.set(p.x,p.y);layer?.addChild(node);
    groundStreams.push(rasterPool.create([icelandPieceTile(p,url(p.src),anchor)],node,undefined,raster));
    return node;
  };
  if(iceland&&!prepare){
    const warmup=new Container({label:'Iceland shared kit warmup'});ground.addChild(warmup);
    groundStreams.push(rasterPool.create(icelandWarmupTiles([...props,...flats],url),warmup,undefined,raster));
  }
  const crispSprite=(p,layer,anchor)=>{
    const container=new Container();container.position.set(p.x,p.y);layer?.addChild(container);
    const pool=p.rasterPool==='ground'?groundPool:rasterPool;
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
  const streamedPiece=(p,layer,anchor)=>{
    if(prepare||!p.tiles?.length||p.preload)return null;
    const node=new Container({label:p.id});node.position.set(p.x,p.y);layer?.addChild(node);
    const stream=groundPool.create(p.tiles.map(t=>({...t,x:p.x-p.width*anchor.x+t.x,y:p.y-p.height*anchor.y+t.y,localX:t.x-p.width*anchor.x,localY:t.y-p.height*anchor.y})),node,url);
    groundStreams.push(stream);return node;
  };
  // The engine owns the temporary preview for prepared boat arrivals.
  if(!prepare||manifest.degraded){
    let terrain;
    terrain=await acquireArt(acquire,release,`/pixi-art/globe/${map.id}-ground.svg`,1);
    const fallback=new Sprite(terrain);fallback.position.set(map.origin.x,map.origin.y);fallback.width=map.width;fallback.height=map.height;ground.addChildAt(fallback,0);
  }
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
    if(iceland){icelandSprite(flat,ground,flat.topLeft?{x:0,y:0}:{x:.5,y:1});continue;}
    if(crisp){crispSprite(flat,ground,flat.topLeft?{x:0,y:0}:{x:.5,y:1});continue;}
    if(streamedPiece(flat,ground,flat.topLeft?{x:0,y:0}:{x:.5,y:1}))continue;
    if(!flat.preload&&tiled(flat,2,ground,flat.topLeft?{x:0,y:0}:{x:.5,y:1}))continue;
    const s = new Sprite(textures[k++]); s.position.set(flat.x, flat.y);
    if (!flat.topLeft) s.anchor.set(.5, 1);
    s.width = flat.width; s.height = flat.height; if (flat.flip) s.scale.x *= -1;
    ground.addChild(s);
  }
  const standing = await mapArtInFrames(props,(prop, i) => {
    const scale = prop.scale ?? 1, anchor = prop.anchor ?? {x: .5, y: 1}, name = prop.name ?? prop.asset ?? prop.src;
    const sprite = iceland?icelandSprite(prop,null,anchor):crisp?crispSprite(prop,null,anchor):(streamedPiece(prop,null,anchor) ?? new Sprite(textures[k++]));
    if(!crisp&&!iceland&&(prepare||!prop.tiles?.length||prop.preload)){
      sprite.anchor.set(anchor.x, anchor.y); sprite.position.set(prop.x, prop.y);
      sprite.width = prop.width * scale; sprite.height = prop.height * scale;
      if (prop.flip) sprite.scale.x *= -1;
    }
    if(!prepare&&!crisp&&!iceland&&prop.tiles?.length&&prop.flip)sprite.scale.x *= -1;
    if (prop.tint) sprite.tint = prop.tint;
    sprite.zIndex = prop.z ?? propZ(prop, (prop.sortY ?? prop.y) + (prop.sortOrder ?? 0) * .00001); sprite.standing = true;
    sprite.themeArt = map.id;
    let shadow = null;
    if (!NO_SHADOW.test(name) && prop.shadow !== false) {
      const [rx, ry] = prop.shadowSize ?? (r => [r, r * .3])(Math.max(8, Math.min(300, prop.width * scale * .36)));
      shadow = new Graphics().ellipse(rx * .06, ry * .1, rx, ry).fill({color: manifest.shadowColor ?? 0x3c5a2a, alpha: manifest.shadowAlpha ?? .15});
      shadow.position.set(prop.x + (prop.shadowOffset?.[0] ?? 0), prop.y + (prop.shadowOffset?.[1] ?? 0)); shadows.addChild(shadow);
    }
    const centrePiece = typeof prop.centrePiece === 'object' ? prop.centrePiece : (centre.pieces??[]).find(p => prop.id?.endsWith(p.id) && prop.src.includes('centre/'));
    return {...prop, centrePiece, id: prop.id ?? `${map.id}-${i}`, name, scale, sprite, shadow, deck: prop.deck ?? /bridge|deck/i.test(name), wind: prop.wind ?? (!prop.src.includes('centre/') && WIND.test(name))};
  });
  const floatLayer = new Container({label: `Theme ${map.id} - floating`});
  const floats = floating.map((item, i) => {
    const anchor = item.anchor ?? {x: .5, y: .5};
    const sprite = iceland?icelandSprite(item,null,anchor):crisp?crispSprite(item,null,anchor):new Sprite(textures[k++]);
    if(!crisp){sprite.anchor.set(anchor.x, anchor.y); sprite.position.set(item.x, item.y); sprite.width = item.width; sprite.height = item.height;
    if (item.flip) sprite.scale.x *= -1;}
    floatLayer.addChild(sprite);
    return {...item, phase: item.phase ?? i * 1.7, sprite};
  });
  const kiteLayer = manifest.kites?.length ? new Container({label: `Theme ${map.id} - kites`}) : null;
  const kites = kiteLayer ? createHomeKites(kiteLayer, Object.fromEntries(KITE_ASSETS.map(src => [src, bySource.get(src)])), manifest.kites) : null;
  const groups = [ground, deckLayer, shadows, floatLayer, overLayer, ...(kiteLayer ? [kiteLayer] : [])];
  const icelandLife = createIcelandLifeLifecycle(map, manifest, {acquire, release, tilt});
  for (const group of groups) group.visible = false;
  const result = {
    id: map.id, map, artPlan, groundStream, groundStreams, rasterPool, ready: !prepare, sea: manifest.sea ?? map.sea ?? null, ground, decks: deckLayer, shadows, props: standing, floatLayer, floating: floats,
    overLayer, bridgeOver, kiteLayer, kites, icelandLife,
    groups,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      icelandLife?.destroy();
      result.pondDuckies?.destroy();
      groundStreams.forEach(s=>s.destroy());
      rasterPool?.destroy();
      raster?.destroy();
      if(!prepare||manifest.degraded)release(`/pixi-art/globe/${map.id}-ground.svg`);
      for (const c of groups) if(!c.destroyed)c.destroy({children: true});
      for (const p of standing) p.sprite.destroy();
      uniqueSources.forEach(src => release(src));
    },
  };
  try {
    await recoverArt(()=>icelandLife?.ensure(null, groups),{label:`theme ${map.id} life`});
    result.pondDuckies=await loadPondDuckies(map.id,{acquire,release,tilt});
    groups.push(result.pondDuckies.root);
  } catch(error) {console.warn(`theme ${map.id}: optional life unavailable`,error);}
  if(prepare) {
    try {await Promise.all(groundStreams.map(stream=>stream.prepare({zoom:1.8,dpr,resolutions,landingPoint,cancelled})));}
    catch(error){console.warn(`theme ${map.id}: ground preparation degraded`,error);}
  }
  return result;
}

// A malformed manifest or an unexpected optional-art failure still leaves a
// real island underlay. Never publish a permanently failed readiness record.
async function previewArt(map, options) {
  const src=`/pixi-art/globe/${map.id}-ground.svg`;
  const texture=await acquireArt(options.acquire,options.release,src,1);
  const ground=new Container(),decks=new Container(),shadows=new Container(),floatLayer=new Container(),overLayer=new Container();
  const sprite=new Sprite(texture);sprite.position.set(map.origin.x,map.origin.y);sprite.width=map.width;sprite.height=map.height;ground.addChild(sprite);
  const pondDuckies={root:new Container(),update(){},destroy(){this.root.destroy({children:true});}};
  const groups=[ground,decks,shadows,floatLayer,overLayer,pondDuckies.root];
  groups.forEach(group=>group.visible=false);
  let destroyed=false;
  return {id:map.id,map,ready:false,degraded:true,ground,decks,shadows,floatLayer,overLayer,pondDuckies,groups,props:[],floating:[],bridgeOver:[],groundStreams:[],
    destroy(){if(destroyed)return;destroyed=true;groups.forEach(g=>{if(!g.destroyed)g.destroy({children:true});});options.release(src);}};
}
export function loadThemeArt(map, options) {
  let pending,abandoned=false;
  const cancelled=()=>abandoned||options.cancelled?.();
  // Bound the whole theme too: hundreds of individually timed-out props must
  // not keep even its ground off the scene for minutes. The preview is authored
  // SVG and works for dynamically registered maps without a prerender tier.
  return recoverArt(()=>pending??=buildThemeArt(map,{...options,cancelled}),{
    label:`theme ${map.id}`,timeoutMs:options.landingPoint?30000:8000,
    cancelled,
    fallback:()=>{if(cancelled())return null;abandoned=true;return previewArt(map,options);},
    late:art=>art?.destroy(),
  });
}
