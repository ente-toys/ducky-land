import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets, Container, DOMAdapter, ImageSource, Sprite, Texture} from 'pixi.js';
import {createCanvas, Image} from '@napi-rs/canvas';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {createArtQueue, uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {svgLayerContexts} from '../src/rendering/pixi/art/svg-context.js';
import {DOMParser} from '@xmldom/xmldom';
import {PixiIsland} from './helpers/pixi-engine.mjs';
const flush=()=>new Promise(setImmediate);

test('Blob SVG loading preserves whole-picture dimensions and pixels without text or data URLs',async t=>{
  const previous=DOMAdapter.get();t.after(()=>DOMAdapter.set(previous));
  DOMAdapter.set({...previous,createCanvas});
  let fetched=0,decoded=0,yields=0;
  const loader=createWholeSVGLoader({queue:createArtQueue({yieldFrame:async()=>{yields++;}}),
    fetchBlob:async()=>{fetched++;return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#cb7139"/></svg>'],{type:'image/svg+xml'});},
    decode:async blob=>{decoded++;const image=new Image();image.src=Buffer.from(await blob.arrayBuffer());await image.decode();return image;}});
  const texture=await loader.load('/whole.svg',{data:{resolution:2,autoGenerateMipmaps:true}});
  assert.deepEqual([fetched,decoded,yields],[1,1,1]);
  assert.deepEqual([texture.width,texture.height,texture.source.pixelWidth,texture.source.pixelHeight],[20,10,40,20]);
  assert.deepEqual([...texture.source.resource.getContext('2d').getImageData(20,10,1,1).data],[203,113,57,255]);
  assert.equal(texture.source.autoGenerateMipmaps,true);assert.equal(texture.source.autoGarbageCollect,false);
  loader.unload(texture);assert(texture.destroyed);
  for(const file of ['whole-svg-loader','theme-art-stream'])assert(!readFileSync(`src/rendering/pixi/art/${file}.js`,'utf8').includes('data:image/svg'));
});

test('art queue bounds decode concurrency and serializes raster work across frame yields',async()=>{
  const waiting=[],raster=[],frames=[];let active=0,peak=0;
  const queue=createArtQueue({concurrency:4,yieldFrame:()=>new Promise(resolve=>frames.push(resolve))});
  const jobs=Array.from({length:9},(_,i)=>queue.run(async()=>{
    active++;peak=Math.max(peak,active);await new Promise(resolve=>waiting.push(resolve));
    await queue.raster(()=>raster.push(i));active--;
  }));
  await flush();assert.equal(waiting.length,4);assert.equal(peak,4);
  for(let i=0;i<30;i++){waiting.splice(0).forEach(resolve=>resolve());await flush();assert(frames.length<=1);frames.splice(0).forEach(resolve=>resolve());await flush();}
  await Promise.all(jobs);assert.equal(peak,4);assert.equal(raster.length,9);
});

test('prepared island performs zero acquisitions, rasters or GPU uploads throughout walk and zoom',async()=>{
  const requests=[],released=[],uploads=[];let rasters=0;
  const textures=new Map();
  const pool=createGroundPool({acquire:async(src,resolution)=>{
    requests.push([src,resolution]);rasters++;
    const t=new Texture({source:new ImageSource({width:100,height:100,resolution})});textures.set(src,t);return t;
  },release:src=>{released.push(src);textures.get(src).destroy(true);}});
  const root=new Container();
  const stream=pool.create([{src:'/one.svg',x:0,y:0,width:100,height:100,resolution:1},
    {src:'/one.svg',x:500,y:500,width:100,height:100,resolution:1},
    {src:'/two.svg',x:10000,y:10000,width:100,height:100,resolution:2}],root);
  await stream.prepare({dpr:2});
  assert.equal(requests.length,2,'all pictures, including distant ones, acquired once per source');
  let frame=0;
  const renderer={texture:{bindSource:source=>uploads.push([source,frame])}};
  await uploadIsland(renderer,[root],{batchSize:1,yieldFrame:async()=>{frame++;}});
  assert.equal(uploads.length,2);assert.equal(new Set(uploads.map(u=>u[1])).size,2);
  const before=[requests.length,rasters,uploads.length];
  for(let i=0;i<180;i++){
    pool.update([{stream,camera:{x:i*100,y:i*100,zoom:.1+(i%18)/10},width:1440,height:900}],2,true);
    assert(stream.entries.every(e=>e.sprite.texture!==Texture.EMPTY));
  }
  await flush();assert.deepEqual([requests.length,rasters,uploads.length],before);
  assert.equal(new Set(requests.map(([src])=>src)).size,requests.length);
  stream.destroy();await flush();assert.deepEqual(released.sort(),['/one.svg','/two.svg']);assert.equal(pool.stats().reservedBytes,0);
  pool.destroy();root.destroy();
});

test('prepared theme shares ground/prop resolution, holds pond and life ownership until destruction',async t=>{
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('art.json')?{
    ground:{tiles:[{src:'shared.svg',x:0,y:0,width:100,height:100,resolution:1}]},
    props:[{src:'shared.svg',x:50,y:50,width:50,height:50,resolution:2,shadow:false}]}:{pieces:[]}});
  const requested=[],released=[],root=new Container();
  const acquire=async(src,r)=>{requested.push([src,r]);return Texture.EMPTY;},release=src=>released.push(src);
  const pool=createGroundPool({acquire,release});
  const art=await loadThemeArt({id:'test',art:'/test/art.json',origin:{x:0,y:0},width:100,height:100},
    {acquire,release,groundPool:pool,prepare:true});
  assert(requested.filter(([src])=>src==='/test/shared.svg').every(([,r])=>r===2));
  assert(art.groundStream.pinned);assert(art.pondDuckies);assert.equal(released.length,0);
  art.destroy();assert.equal(released.length,requested.length);pool.destroy();root.destroy();
});

test('islet layer preparation parses each source XML only once',()=>{
  let parses=0;
  const contexts=svgLayerContexts('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><g data-piece="a"><circle r="2"/></g><g data-piece="b"><circle r="3"/></g></svg>',text=>{
    parses++;return new DOMParser().parseFromString(text,'image/svg+xml');
  });
  assert.equal(parses,1);assert.equal(contexts.pieces.size,2);
  for(const c of [contexts.full,contexts.ground,...contexts.pieces.values()])c.destroy();
});

const engine=readFileSync('src/rendering/pixi/engine.js','utf8');
test('landing releases the previous island only after destination preparation and GPU warmup finish',async()=>{
  let finish;const events=[];
  const landing=Object.create(PixiIsland.prototype);
  Object.assign(landing,{islandId:'sunset',artShown:'pink',arts:new Map([['pink',{}],['library',{}]]),liveRigs:new Map(),props:[],camera:{},target:{},
    ensureArt:()=>new Promise(resolve=>{finish=resolve;}),artReady:()=>true,
    showArt:id=>events.push('show '+id),freeArt:id=>{events.push('release '+id);landing.arts.delete(id);},
    releaseHomeArt:()=>events.push('release home'),applyMapAmbience(){},stopInput(){},clearChat(){}});
  landing.switchIsland('isle-251');assert(!events.includes('release pink'));
  finish();await flush();assert(events.indexOf('show library')<events.indexOf('release pink'));assert(events.includes('release pink'));
  landing.artShown='home';landing.switchIsland('sunset');finish();await flush();assert(events.includes('release home'));
});

test('destination preloading cannot be driven by walking or zoom and reveal follows warmup',()=>{
  assert(!engine.includes('loadScenery('));assert(!engine.includes('this.buildCopies();'));
  assert(engine.includes("if(actor?.mode==='sailing')"));
  const preparation=engine.slice(engine.indexOf('  ensureArt(mapId)'),engine.indexOf('  releaseHomeArt()'));
  assert(preparation.indexOf('await uploadIsland(')<preparation.indexOf('this.arts.set(mapId, art)'));
  assert(!preparation.includes('releasePondDuckies(mapId)'));
  assert(!preparation.includes('icelandLife?.release()'));
});


test('Home departure releases its leases while another prepared scene keeps shared pictures alive; returning restores exact sizes',async t=>{
  const oldLoad=Assets.load,oldUnload=Assets.unload,loads=[],unloads=[],textures=new Map();
  Assets.load=async({src})=>{loads.push(src);const texture=new Texture({source:new ImageSource({width:10,height:10})});textures.set(src,texture);return texture;};
  Assets.unload=async src=>{unloads.push(src);textures.get(src).destroy(true);};
  t.after(()=>{Assets.load=oldLoad;Assets.unload=oldUnload;});
  const makeGame=count=>{
    const scene=new Container(),ground=new Container(),decks=new Container(),sprite=new Sprite(Texture.EMPTY);
    ground.addChild(sprite);scene.addChild(ground,decks);
    const game=Object.assign(Object.create(PixiIsland.prototype),{scene,homeGround:ground,decks,
      artShown:'home',loaded:[],arts:new Map([['home',{groups:[ground]}]]),props:[],homeKites:{entries:[]},
      app:{renderer:{resolution:2,texture:{bindSource(){}}}},
      groundPool:{create:()=>({async prepare(){},destroy(){}})},showArt(){},
      homeRestore:Promise.resolve([{src:'/home-lifecycle.svg',resolution:2,count,nodes:[{node:sprite,width:20,height:30}]}])});
    return {game,sprite};
  };
  const a=makeGame(2),b=makeGame(1);
  await a.game.ensureHomeArt();await b.game.ensureHomeArt();
  const shared=a.sprite.texture;
  assert.equal(shared,b.sprite.texture);assert.equal(loads.filter(src=>src==='/home-lifecycle.svg').length,1);
  assert.equal(shared.source.autoGarbageCollect,false);
  a.game.releaseHomeArt();await a.game.homeRestore;await flush();
  assert.equal(a.sprite.texture,Texture.EMPTY);assert.equal(b.sprite.texture,shared);
  assert(!shared.destroyed);assert(!unloads.includes('/home-lifecycle.svg'));assert.equal(a.game.loaded.length,0);
  await a.game.ensureHomeArt();assert.equal(a.sprite.texture,shared);assert.deepEqual([a.sprite.width,a.sprite.height],[20,30]);
  a.game.releaseHomeArt();b.game.releaseHomeArt();await Promise.all([a.game.homeRestore,b.game.homeRestore]);await flush();
  assert(shared.destroyed);assert.equal(unloads.filter(src=>src==='/home-lifecycle.svg').length,1);
  for(const {game}of [a,b])game.scene.destroy({children:true});
});

test('disposing pinned preparation releases pending ownership exactly once without writing destroyed sprites',async()=>{
  let finish,releases=0;
  const pool=createGroundPool({acquire:()=>new Promise(resolve=>{finish=resolve;}),release:()=>releases++});
  const root=new Container(),stream=pool.create([{src:'/pending.svg',x:0,y:0,width:10,height:10}],root);
  const pending=stream.prepare();stream.destroy();
  finish(Texture.EMPTY);await pending;
  assert.equal(releases,1);assert.equal(pool.stats().reservedBytes,0);pool.destroy();root.destroy();
});


test('raster turns share small work but yield once the synchronous frame budget is consumed',async()=>{
  const frames=[],ran=[];let cost=0,frame=0;
  const queue=createArtQueue({yieldFrame:()=>new Promise(resolve=>frames.push(resolve)),now:()=>cost});
  const work=Array.from({length:7},()=>queue.raster(()=>{ran.push(frame);cost+=3;}));
  for(let i=0;i<4;i++){await flush();cost=0;frame++;frames.splice(0).forEach(resolve=>resolve());await flush();}
  await Promise.all(work);assert.deepEqual(ran,[1,1,2,2,3,3,4]);
});
