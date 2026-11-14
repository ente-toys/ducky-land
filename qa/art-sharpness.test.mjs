import {selectIslandTier} from '../src/app/ducky-prefetch.js';
import sharp from 'sharp';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {home} from './island-art-fixtures.mjs';
import {planIslandArt as mainPlan} from '../scripts/ground-mesh/main-art-plan.mjs';
import {planIslandArt,planIslandSheets,pinnedSheetTiers} from '../src/rendering/pixi/art/island-budget.js';
import {selectPrerenderTier} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {buildIslandIndex,collectPlacedArt} from '../scripts/vite-prerender-art.mjs';
import {groundTiles} from '../scripts/ground-mesh/build.mjs';

const sources=async()=>{
 const entries=await collectPlacedArt(process.cwd()),themes=new Map();
 for(const theme of ['home','sunflower','pink','library','community','bog','snow']){
  const ground=await groundTiles(process.cwd(),theme==='bog'?'bog-arena':theme);
  themes.set(theme,[...entries.filter(e=>e.theme===theme),...ground.map(e=>({...e,mipmaps:false}))]);
 }
 return themes;
};

test('detail pieces retain at least main density throughout main zoom range',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires the production manifest');
 const manifest=JSON.parse(await readFile(process.env.ART_MANIFEST));const failures=[];
 const entries=await collectPlacedArt(process.cwd());
 const pointer=JSON.parse(await readFile('dist/art-prerender/islands.json'));
 const index=JSON.parse(await readFile('dist'+pointer.url));
 for(const [theme,placed]of await sources())for(const dpr of [1,2,3]){
  const id=entries.islands.find(i=>i.theme===theme).id;
  const vectorGround=new Set((await groundTiles(process.cwd(),theme==='bog'?'bog-arena':theme)).filter(e=>e.src.endsWith('.svg')).map(e=>e.src));
  for(const defaultZoom of [.26,.39,.65,.784,.9,1.08,1.44,1.8]){
  const view=selectIslandTier(index,id,dpr,defaultZoom*1500,defaultZoom*1000);
  const urls=new Set(view.detail??view.webp);
  const svgPlan=view.rasterDetail?JSON.parse(await readFile('dist'+view.rasterDetail.plan)):null;
  const svgFrames=new Map(svgPlan?.sheets.flatMap(s=>s.frames).map(f=>[f.src,f]));
  const pins=new Map(Object.entries(manifest).flatMap(([src,e])=>{const tier=e.tiers.filter(t=>urls.has(t.sheet??t.url)).sort((a,b)=>b.scale-a.scale)[0];return tier?[[src,tier]]:[];}));
  pinnedSheetTiers.set(manifest,pins);
   const supportedZoom=defaultZoom;
   const expected=mainPlan(placed,{dpr,defaultZoom:supportedZoom,maxZoom:1.8});
   const actual=planIslandSheets(planIslandArt(placed,{dpr,defaultZoom:supportedZoom,maxZoom:1.8}),manifest);
   for(const [src,plannedResolution]of expected.resolutions){
    if(vectorGround.has(src)){assert(!manifest[src],'vector ground has no texture tier');continue;}
    // The ocean is acquired at 1 before the island plan and reused by acquireHome.
    const resolution=src==='/pixi-art/water-texture.svg'?1:plannedResolution;
    const ocean=src==='/pixi-art/water-texture.svg';
    const selected=view.rasterDetail&&!ocean?svgFrames.get(src):manifest[src]?.tiers.filter(t=>(ocean?new Set(view.webp):urls).has(t.sheet??t.url)).sort((a,b)=>b.scale-a.scale)[0];
    if(view.rasterDetail&&!ocean)assert(selected,src);
    if(!selected){assert(actual.resolutions.get(src)+1e-10>=resolution,'SVG fallback retains main raster density');continue;}
    if(selected.scale+1e-10<resolution)failures.push(`${theme} @${dpr} zoom ${defaultZoom}: ${src}: ${selected.scale} < main ${resolution}`);
   }
  }
 }
 assert.equal(failures.length,0,failures.slice(0,30).join('\n'));
});

test('an early low-density pin cannot override a sharper island request',()=>{
 const m={'/a.svg':{w:10,h:10,tiers:[1,2].map(scale=>({scale,url:`/${scale}.webp`,sheet:`/${scale}.webp`,group:`home/props/${scale}`,sheetWidth:16,sheetHeight:16}))}};
 pinnedSheetTiers.set(m,new Map([['/a.svg',m['/a.svg'].tiers[0]]]));
 const plan=planIslandSheets({resolutions:new Map([['/a.svg',2]]),budget:1},m);
 assert.equal(selectPrerenderTier(m,'/a.svg',plan.resolutions.get('/a.svg')).scale,2);
});


test('an insufficient atlas tier preserves requested SVG resolution instead of downgrading',()=>{
 const m={'/a.svg':{w:10,h:10,tiers:[{scale:2,url:'/a.webp',sheet:'/a.webp',group:'home/props/0',sheetWidth:32,sheetHeight:32}]}};
 pinnedSheetTiers.set(m,new Map([['/a.svg',m['/a.svg'].tiers[0]]]));
 const plan=planIslandSheets({resolutions:new Map([['/a.svg',3]]),budget:1},m);
 assert.equal(plan.resolutions.get('/a.svg'),3);
 assert.equal(selectPrerenderTier(m,'/a.svg',3),null,'the loader must rasterize the SVG at the requested density');
});

test('Sunbob continuous deck and ground tiles share density and exact sheet pixels',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires the production manifest');
 const manifest=JSON.parse(await readFile(process.env.ART_MANIFEST));
 const art=JSON.parse(await readFile('public/pixi-art/themes/sunflower/art.json'));
 // Sunbob's painted wooden deck is part of these continuous ground tiles.
 // Separate arched bridge drawings do not continue the ground's plank pixels.
 const placed=art.ground.tiles.map(p=>({...p,mipmaps:false}))
  .map(p=>({...p,src:'/pixi-art/themes/sunflower/'+p.src}));
 pinnedSheetTiers.delete(manifest);
 for(const dpr of [1,2,3]){
  const plan=planIslandSheets(planIslandArt(placed,{dpr,defaultZoom:.9}),manifest);
  const groups=new Set(),densities=[];
  for(const p of placed){
   const e=manifest[p.src],tier=selectPrerenderTier(manifest,p.src,plan.resolutions.get(p.src));
   if(!tier)continue;
   groups.add(tier.group);
   if(tier.sheet)assert.equal(tier.lossless,true);
   if(dpr===2&&tier.sheet&&art.ground.tiles.slice(0,2).some(sample=>'/pixi-art/themes/sunflower/'+sample.src===p.src)){
    const rect={left:tier.x,top:tier.y,width:tier.frameWidth,height:tier.frameHeight};
    const actual=await sharp('dist'+tier.sheet).extract(rect).ensureAlpha().raw().toBuffer();
    const reference=await sharp('dist'+tier.url).extract({...rect,left:tier.offsetX,top:tier.offsetY}).ensureAlpha().raw().toBuffer();
    for(const pixels of [actual,reference])for(let i=0;i<pixels.length;i+=4)if(!pixels[i+3])pixels.fill(0,i,i+3);
    assert.deepEqual(actual,reference,`${p.src}: sheet adds no compression error at the join`);
   }
   densities.push(tier.scale/Math.max((p.width+(p.bleed??0))/e.w,(p.height+(p.bleed??0))/e.h));
  }
  if(!groups.size){assert(placed.every(p=>!manifest[p.src]),'vector ground is absent from the texture manifest');continue;}
  assert.equal(groups.size,1,'continuous ground and decks choose one nominal density tier');
  assert(Math.max(...densities)-Math.min(...densities)<1e-8,'sheet density is uniform at adjoining pieces');
 }
});

test('Sunbob wooden landing deck adds no sheet compression or boundary error',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires the production manifest');
 const m=JSON.parse(await readFile(process.env.ART_MANIFEST));
 const e=m['/pixi-art/themes/sunflower/bigger/landing-pier.svg'];
 const tier=e.tiers.find(t=>t.sheet&&t.scale>=1);assert(tier);assert(tier.lossless);
 const rect={width:tier.frameWidth,height:tier.frameHeight};
 const actual=await sharp('dist'+tier.sheet).extract({...rect,left:tier.x,top:tier.y}).ensureAlpha().raw().toBuffer();
 const expected=await sharp('dist'+tier.url).extract({...rect,left:tier.offsetX,top:tier.offsetY}).ensureAlpha().raw().toBuffer();
 for(const pixels of [actual,expected])for(let i=0;i<pixels.length;i+=4)if(!pixels[i+3])pixels.fill(0,i,i+3);
 assert.deepEqual(actual,expected);
});

test('emitted main-detail tiers remain last in nominal density order',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires the production manifest');
 const manifest=JSON.parse(await readFile(process.env.ART_MANIFEST));
 for(const [src,e]of Object.entries(manifest))for(let i=1;i<e.tiers.length;i++)
  assert(e.tiers[i].scale+1e-10>=e.tiers[i-1].scale,`${src}: a detail tier cannot sort ahead of landing`);
});
