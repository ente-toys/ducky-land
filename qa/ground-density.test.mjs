import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {home} from './island-art-fixtures.mjs';
import {planIslandArt,ISLAND_ART_BUDGET,SHARED_TEXTURE_ALLOWANCE} from '../src/rendering/pixi/art/island-budget.js';
import {textureFootprint,walkingZoom} from '../src/rendering/pixi/art/texture-footprint.js';
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import bounds from '../src/rendering/shared/art-visible-bounds.json' with {type:'json'};
import hashes from './art-visible-bounds-hashes.json' with {type:'json'};
import {prerenderSources,collectPlacedArt} from '../scripts/vite-prerender-art.mjs';
import {selectPrerenderTier} from '../src/rendering/pixi/art/whole-svg-loader.js';

const islands=[{id:'home',tiles:home.tiles,entries:home.entries}];
for(const id of new Set(home.WORLD_ISLANDS.map(i=>home.mapFor(i.theme??'home').id))){
  if(id==='home')continue;
  const path=home.mapFor(id).art,art=JSON.parse(readFileSync('public'+path)),base=path.slice(0,path.lastIndexOf('/')+1);
  const url=e=>({...e,src:e.src.startsWith('/')?e.src:base+e.src});
  islands.push({id,tiles:art.ground.tiles.map(url),entries:[...art.decks??[],...(art.flats??[]).map(e=>({...e,ground:true})),...art.props??[],...art.floating??[]].map(url)});
}
const all=await collectPlacedArt(process.cwd());
// Exercise the same tier collector as the production build, or the real build
// manifest when requested after npm run build.
const manifest=process.env.ART_MANIFEST?JSON.parse(readFileSync(process.env.ART_MANIFEST)):
  Object.fromEntries([...prerenderSources(all.filter(e=>sizes[e.src]),sizes)].map(([src,e])=>[src,{...e,tiers:e.scales.map(scale=>({scale,url:src+'.webp'}))}]));
const ratio=e=>Math.max((e.width+(e.mipmaps===false?e.bleed??0:0))/sizes[e.src][0],(e.height+(e.mipmaps===false?e.bleed??0:0))/sizes[e.src][1])*(e.scale??1);

test('all active islands maximize uniform ground density within 350 MiB with props at least 0.9 on DPR 2',t=>{
  for(const island of islands){
    const ground=island.tiles.map(e=>({...e,mipmaps:false})),entries=[...island.entries,...ground];
    const plan=planIslandArt(entries,{dpr:2,defaultZoom:.65});
    let minimum=Infinity,fallbacks=0,sourceMin=Infinity;
    for(const tile of ground){
      const r=plan.resolutions.get(tile.src),density=r/(ratio(tile)*.65*2);
      assert(density+1e-10>=plan.groundDensity,`${island.id}: ${tile.src} density ${density}`);
      minimum=Math.min(minimum,density);
      if(bounds[tile.src]===null)continue;
      const tier=selectPrerenderTier(manifest,tile.src,r);
      if(tier){sourceMin=Math.min(sourceMin,tier.scale/(ratio(tile)*1.3));assert(tier.scale>=r);}
      else fallbacks++; // SVG is decoded once during preparation at the final planned resolution.
    }
    for(const e of island.entries)if(!e.ground&&e.width&&e.height){
      assert(plan.resolutions.get(e.src)/(ratio(e)*1.3)>=.9-1e-10,`${island.id}: low prop density ${e.src}`);
    }
    assert(plan.bytes+SHARED_TEXTURE_ALLOWANCE<=350*1048576);
    if(plan.groundDensity<.75){
      let raised=0;
      const mipmaps=new Set(island.entries.map(e=>e.src)),props=new Set(island.entries.filter(e=>!e.ground).map(e=>e.src));
      for(const [src,r]of plan.resolutions){
        const m=mipmaps.has(src),f=textureFootprint(src,props.has(src)?r:r*(plan.groundDensity+.001)/plan.groundDensity,m?0:2);
        raised+=f.width*f.height*4*(m?4/3:1);
      }
      assert(raised>ISLAND_ART_BUDGET,`${island.id}: ground budget left unused`);
    }
    if(island.id==='home')assert(minimum>.49,'Home exceeds the live 0.35 density with margin');
    if(island.id==='sunflower')assert(minimum>.43,'Blossom ground improves despite the cap');
    t.diagnostic(`${island.id}: density ${minimum.toFixed(4)}, art ${(plan.bytes/1048576).toFixed(3)} MiB + shared 100 MiB; SVG fallbacks ${fallbacks}`);
  }
});

test('native alpha bounds stay synchronized with authored art',()=>{
  assert.deepEqual(Object.keys(bounds),Object.keys(hashes));
  for(const [src,expected]of Object.entries(hashes)){
    assert.equal(createHash('sha256').update(readFileSync('public'+src)).digest('hex'),expected,`${src}: regenerate with node qa/generate-art-visible-bounds.mjs`);
  }
});

test('planning uses the actual responsive walking camera zoom and remains fixed throughout zooming',()=>{
  assert.equal(walkingZoom(1440,650),.65);assert.equal(walkingZoom(1440,900),.9);
  for(const island of islands)for(const defaultZoom of [.6,.65,.9]){
    const plan=planIslandArt([...island.entries,...island.tiles.map(e=>({...e,mipmaps:false}))],{dpr:2,defaultZoom});
    assert(plan.bytes+SHARED_TEXTURE_ALLOWANCE<=350*1048576);
    assert.equal(plan.defaultZoom,defaultZoom);
  }
});
