import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMAdapter,Loader} from 'pixi.js';
import {createCanvas,Image} from '@napi-rs/canvas';
import {readFile} from 'node:fs/promises';
import {prerenderSources,collectPlacedArt,addMainDetailTiers,buildIslandIndex} from '../scripts/vite-prerender-art.mjs';
import {mapFor} from '../src/world/island-maps.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {createWholeSVGLoader,selectPrerenderTier,loadedSVGTextures} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {groundSpriteBounds} from '../src/rendering/pixi/art/ground-stream.js';

const manifest={'/fixture.svg':{w:20,h:10,padding:0,tiers:[
  {scale:1,url:'/art-prerender/one.webp',width:20,height:10},
  {scale:2,url:'/art-prerender/two.webp',width:40,height:20},
]}};
const svg=new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#cb7139"/></svg>'],{type:'image/svg+xml'});

test('build collects the active map art paths, including Bog arena, and every prepared source',async()=>{
  const sources=new Set((await collectPlacedArt(process.cwd())).map(e=>e.src));
  for(const id of new Set(WORLD_ISLANDS.map(i=>i.theme??'home'))){
    const map=mapFor(id);if(!map.art)continue;
    const art=JSON.parse(await readFile('public'+map.art,'utf8')),base=map.art.slice(0,map.art.lastIndexOf('/')+1);
    for(const piece of [...art.decks??[],...art.flats??[],...art.props??[],...art.floating??[]]){
      assert(sources.has(piece.src.startsWith('/')?piece.src:base+piece.src),`${id}: missing ${piece.src}`);
    }
  }
  assert(![...sources].some(src=>/\/ground-[^/]+\.svg$/.test(src)), 'Ground SVG tiles use the mesh build');
  assert([...sources].some(src=>src.startsWith('/pixi-art/themes/bog-arena/')));
  assert(sources.has('/pixi-duck/float/parts/f4_ring-duck.svg'));
});

test('manifest selects the smallest sufficient tier and never substitutes unknown, cropped, or undersized art',()=>{
  assert.equal(selectPrerenderTier(manifest,'/fixture.svg',.5).url,'/art-prerender/one.webp');
  assert.equal(selectPrerenderTier(manifest,'/fixture.svg',1).scale,1);
  assert.equal(selectPrerenderTier(manifest,'/fixture.svg',1.01).scale,2);
  assert.equal(selectPrerenderTier(manifest,'/fixture.svg',2).scale,2);
  for(const src of ['/new.svg','blob:generated','/fixture.svg?rasterCrop=0,0,1,1'])assert.equal(selectPrerenderTier(manifest,src),null);
  assert.equal(selectPrerenderTier(manifest,'/fixture.svg',2.01),null);
  assert.equal(selectPrerenderTier({},'/fixture.svg'),null);
});

test('build tiers preserve uniform screen density, repeated placements and ground bleed',()=>{
  const plan=prerenderSources([
    {src:'/fixture.svg',width:5,height:2.5,resolution:2},
    {src:'/fixture.svg',width:10,height:5,scale:2,resolution:1.5},
    {src:'/ground.svg',width:40,height:20,resolution:1,mipmaps:false},
    {src:'/legacy.webp',width:20,height:10},
  ],{'/fixture.svg':[20,10],'/ground.svg':[40,20]});
  assert.deepEqual(plan.get('/fixture.svg').scales,[.25,.5,.75,1,1.5,2,.3,.4]);
  assert.equal(plan.get('/ground.svg').padding,2);
  assert.deepEqual(plan.get('/ground.svg').scales,[.25,.5,.75,1,1.5,2,.3,.4]);
  assert.equal(plan.size,2);
  assert.throws(()=>prerenderSources([{src:'/new.svg'}],{}),/native dimensions/);
});

test('prerender loads only WebP and bitmap-resizes to the fixed budget without any canvas or SVG decode',async()=>{
  const fetched=[],decoded=[];let closed=0;
  const loader=createWholeSVGLoader({getManifest:async()=>manifest,canDecodeBitmap:()=>true,
    queue:{run:job=>job(),raster(){assert.fail('prerender must never rasterize');}},
    fetchBlob:async src=>{fetched.push(src);return new Blob(['fixture']);},
    decode(){assert.fail('prerender must never decode SVG');},
    decodeBitmap:async(blob,options)=>{decoded.push(options);return {width:options.resizeWidth,height:options.resizeHeight,close(){closed++;}};}});
  const texture=await loader.load('https://world.test/fixture.svg',{src:'/fixture.svg',data:{resolution:1.25,autoGenerateMipmaps:true}});
  assert.deepEqual(fetched,['/art-prerender/two.webp']);
  assert.deepEqual([texture.source.pixelWidth,texture.source.pixelHeight],[25,13]);
  assert.equal(texture.source.resolution,1.25);
  assert.equal(texture.source.alphaMode,'premultiplied-alpha');
  assert.equal(texture.source.autoGenerateMipmaps,true);assert.equal(texture.source.autoGarbageCollect,false);
  assert.equal(decoded[0].premultiplyAlpha,'premultiply');
  assert(loadedSVGTextures.has(texture));loader.unload(texture);
  assert.equal(closed,1);assert(!loadedSVGTextures.has(texture));
});

test('padded bitmap decode keeps the inner ground at its authored position and crops shared props',async()=>{
  const padded={'/fixture.svg':{...manifest['/fixture.svg'],padding:2}},options=[];
  const loader=createWholeSVGLoader({getManifest:async()=>padded,canDecodeBitmap:()=>true,
    fetchBlob:async()=>new Blob(['fixture']),decodeBitmap:async(blob,o)=>{options.push(o);return {width:o.resizeWidth,height:o.resizeHeight,close(){}};}});
  const ground=await loader.load('/fixture.svg',{data:{resolution:.75,groundPadding:2}});
  assert.deepEqual([ground.source.pixelWidth,ground.source.pixelHeight],[19,12]);
  const b=groundSpriteBounds({x:100,y:50,width:200,height:100},ground);
  assert.equal(b.x,80);assert.equal(b.y,30);
  assert.equal(b.width,240);assert.equal(b.height,140);
  const prop=await loader.load('/fixture.svg',{data:{resolution:1}});
  assert.deepEqual(options[1].crop,[2,2,20,10]);
  assert.deepEqual([prop.width,prop.height],[20,10]);
  loader.unload(ground);loader.unload(prop);
});

test('Pixi Loader preserves the manifest lookup after converting authored paths to absolute fetch URLs',async t=>{
  const previous=DOMAdapter.get();t.after(()=>DOMAdapter.set(previous));
  DOMAdapter.set({...previous,getBaseUrl:()=> 'https://world.test/'});
  const requested=[],parser=createWholeSVGLoader({getManifest:async()=>manifest,canDecodeBitmap:()=>true,
    fetchBlob:async src=>{requested.push(src);return new Blob(['fixture']);},
    decodeBitmap:async(blob,o)=>({width:o.resizeWidth,height:o.resizeHeight,close(){}}),
    decode(){assert.fail('absolute Pixi URL must use the prerender');}});
  const loader=new Loader();loader.parsers=[parser];
  const texture=await loader.load({src:'/fixture.svg',data:{resolution:1.5}});
  assert.deepEqual(requested,['/art-prerender/two.webp']);
  assert.deepEqual([texture.source.pixelWidth,texture.source.pixelHeight],[30,15]);
  await loader.unload('/fixture.svg');assert(texture.destroyed);
});

test('dev, new art, unavailable bitmaps, and broken generated images retain the SVG fallback',async t=>{
  const previous=DOMAdapter.get();t.after(()=>DOMAdapter.set(previous));DOMAdapter.set({...previous,createCanvas});
  for(const kind of ['dev','new','unsupported','broken']){
    const fetched=[];
    const loader=createWholeSVGLoader({getManifest:async()=>kind==='dev'?{}:manifest,canDecodeBitmap:()=>kind!=='unsupported',
      fetchBlob:async src=>{fetched.push(src);if(src.endsWith('.webp'))throw Error('404');return svg;},
      decode:async blob=>{const image=new Image();image.src=Buffer.from(await blob.arrayBuffer());await image.decode();return image;}});
    const src=kind==='new'?'/new.svg':'/fixture.svg';
    const texture=await loader.load(src,{data:{resolution:1,groundPadding:kind==='new'?2:0}});
    assert.equal(fetched.at(-1),src);
    assert.equal(fetched.length,kind==='broken'?2:1);
    const canvas=texture.source.resource,pad=texture.groundPadding?.pad??0;
    assert.deepEqual([...canvas.getContext('2d').getImageData(pad+10,pad+5,1,1).data],[203,113,57,255]);
    if(pad)assert.deepEqual([...canvas.getContext('2d').getImageData(0,0,1,1).data],[203,113,57,255]);
    loader.unload(texture);
  }
});


test('extra detail tiers cover main at every DPR without changing landing densities',async()=>{
 const entries=[{src:'/fixture.svg',theme:'home',width:10,height:10,resolution:2}],sizes={'/fixture.svg':[10,10]};
 const sources=prerenderSources(entries,sizes),landing=[...sources.get('/fixture.svg').scales];
 addMainDetailTiers(entries,sizes,sources);
 const scales=sources.get('/fixture.svg').scales;
 assert.deepEqual(scales.slice(0,landing.length),landing);
 const {planIslandArt}=await import('../scripts/ground-mesh/main-art-plan.mjs');
 for(const dpr of [1,2,3])for(const defaultZoom of [.26,.9,1.8])
  assert(scales.at(-1)>=planIslandArt(entries,{dpr,defaultZoom,sourceSizes:sizes}).resolutions.get('/fixture.svg'));
});


test('unsupported landing oversampling cannot masquerade as a main-equivalent complete set',()=>{
 const src='/fixture.svg',entries=[{src,theme:'home',width:10,height:10}];
 const manifest={[src]:{w:10,h:10,padding:0,tiers:[1,2].map((scale,i)=>({scale,url:`/${i}.webp`,sheet:`/${i}.webp`,group:`home/props/${i}`,sheetWidth:32,sheetHeight:32}))}};
 const index=buildIslandIndex(entries,manifest,'/main.js');
 const unsupported=index.islands.home[3].views.find(v=>v.zoom===1.8);
 assert(unsupported.limits.every(limit=>limit===0),'every viewport rejects an incomplete landing set');
 assert(unsupported.detail.length,'detail still uses the available top tier instead of dropping art');
});
