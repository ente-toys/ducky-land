// Allocation estimates derived from authored SVG dimensions, not a GPU reading.
import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
import sizes from '../../src/pixi/art-source-sizes.json' with {type:'json'};
import tiled from '../../src/pixi/large-art-tiles.json' with {type:'json'};
import {artResolution} from '../../src/pixi/art-resolution.js';
import {GROUND_BUDGET_BYTES} from '../../src/pixi/ground-stream.js';
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {homeArtwork} from './snapshot.mjs';
const result={method:'RGBA8 allocation estimate from exact source dimensions and raster scales; not measured GPU memory.',maps:{}};
let previewBytes=0,peopleBytes=0;
for(const island of WORLD_ISLANDS){
 const id=island.theme??'home',map=mapOf(island.id),base=`/pixi-art/themes/${id}/`;
 let entries;
 if(id==='home')entries=homeArtwork().map(p=>({...p,kind:p.kind??'home',resolution:p.resolution??1}));
 else {const a=JSON.parse(readFileSync(`public${base}art.json`));entries=Object.entries({ground:a.ground.tiles,decks:a.decks,flats:a.flats,props:a.props,floating:a.floating}).flatMap(([kind,items])=>(items??[]).map(p=>({...p,originalSrc:p.src,kind,src:p.src.startsWith('/')?p.src:base+p.src,resolution:p.resolution??(kind==='ground'?1:kind==='decks'?1.5:2)})));}
 const before=new Map(),after=new Map();
 for(const p of entries){
  const size=sizes[p.src];if(!size)continue;
  before.set(p.src,Math.max(before.get(p.src)??0,size[0]*size[1]*p.resolution**2*4));
  const streamed=p.kind==='ground'||(id==='home'&&/ground/.test(p.src))||tiled[id]?.[[p.originalSrc,p.width,p.height,p.resolution].join('|')];
  if(!streamed){const r=artResolution(p,p.resolution);after.set(p.src,Math.max(after.get(p.src)??0,Math.ceil(size[0]*r)*Math.ceil(size[1]*r)*4));}
 }
 const preview=await sharp(`public/pixi-art/globe/${id}.png`).metadata();previewBytes+=preview.width*preview.height*4;
 const peopleK=512/Math.max(map.width,map.height);peopleBytes+=Math.ceil(map.width*peopleK)*Math.ceil(map.height*peopleK)*4;
 result.maps[id]={beforeFullArtMiB:[...before.values()].reduce((a,b)=>a+b,0)/1048576,afterNonStreamedMiB:[...after.values()].reduce((a,b)=>a+b,0)/1048576};
}
const theme=[...Object.entries(result.maps)].filter(([id])=>id!=='home').map(([,v])=>v.afterNonStreamedMiB).sort((a,b)=>b-a);
result.allocationEnvelopeMiB={streamPool:GROUND_BUDGET_BYTES/1048576,homePermanent:result.maps.home.afterNonStreamedMiB,
 twoLargestThemes:theme[0]+theme[1],allPreviews:previewBytes/1048576,terrainFallbacksUpperBound:previewBytes/1048576,
 globeAtlas:4096*2048*4/1048576,people:peopleBytes/1048576,sceneAndFramebufferAt1400x1000Dpr2:1400*1000*4*5/1048576};
result.allocationEnvelopeMiB.subtotal=Object.values(result.allocationEnvelopeMiB).reduce((a,b)=>a+b,0);
result.exclusions='Duck/outfit caches, water simulation textures, generated Graphics atlases, browser/driver overhead, and asynchronously retired allocations. This subtotal is not a hard total GPU bound.';
writeFileSync('../concepts/themes/world-map/spread/perf-memory-estimates.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
