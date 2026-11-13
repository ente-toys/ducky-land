import test from 'node:test';
import assert from 'node:assert/strict';
import {Assets, Container, DOMAdapter, ImageSource, Sprite, Texture} from 'pixi.js';
import {PixiIsland,installBogEnvironment,BOG_MAP_ID,mapFor} from './helpers/pixi-engine.mjs';
import {readFileSync} from 'node:fs';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {finalTextureSource, isArtPlaceholder, ART_TIMEOUT_MS} from '../src/rendering/pixi/art/art-recovery.js';
import {assertFinalTexture, uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';

const flush=()=>new Promise(setImmediate);
const tile=src=>({src,x:0,y:0,width:20,height:10,resolution:1});
const finalTexture=()=>new Texture({source:new ImageSource({width:20,height:10})});
const until=async predicate=>{
  for(let i=0;i<200;i++){if(predicate())return;await flush();}
  assert.fail('expected preparation checkpoint');
};
function nodesOf(roots){
  const nodes=[];
  const visit=node=>{if('texture' in node&&node.renderPipeId!=='graphics')nodes.push(node);for(const c of node.children??[])visit(c);};
  roots.forEach(visit);return nodes;
}
function assertUploaded(uploads,roots){
  const nodes=nodesOf(roots);assert(nodes.length>0);
  for(const node of nodes){
    assertFinalTexture(node.texture,node.label);
    assert(uploads.has(node.texture.source),'every final texture uploaded before artReady');
  }
}
function assertReady(game,id,uploads,roots){
  assert.equal(game.artReady(id),true);
  assert.equal(game.arts.get(id).ready,true);
  assertUploaded(uploads,roots);
}

// Exercise the real loader, pool and engine readiness methods. Only network,
// image decoding, the raster canvas and the GPU are replaced; no browser/port.
function fixture(t,kind,blocked,{prerenderManifest,themeManifest}={}){
  const old={load:Assets.load,unload:Assets.unload,fetch:globalThis.fetch,adapter:DOMAdapter.get()};
  const waiting=new Map(),requests=[],textures=new Map(),uploads=new Set();
  DOMAdapter.set({...old.adapter,createCanvas:(width,height)=>({width,height,getContext:()=>({drawImage(){}})})});
  const decode=async blob=>{
    const src=(await blob.text()).replace(/\.webp$/,'');
    if(blocked(src))await new Promise(resolve=>waiting.set(src,resolve));
    return {width:20,height:10,src:'',close(){}};
  };
  const loader=createWholeSVGLoader({canDecodeBitmap:()=>kind==='webp',
    getManifest:async()=>prerenderManifest??new Proxy({}, {get:(_,src)=>({w:20,h:10,padding:2,tiers:[{scale:4,url:src+'.webp',width:80,height:40}]})}),
    queue:{run:job=>job(),raster:async job=>job()},fetchBlob:async src=>new Blob([src]),decode,
    decodeBitmap:async(blob,options)=>{const image=blob instanceof Blob?await decode(blob):blob;return {...image,width:options.resizeWidth??options.crop[2],height:options.resizeHeight??options.crop[3]};}});
  Assets.load=({src,data})=>{
    requests.push(src);
    if(!textures.has(src))textures.set(src,loader.load(src,{src,data}));
    return textures.get(src);
  };
  Assets.unload=async src=>{const promise=textures.get(src);textures.delete(src);if(promise)loader.unload(await promise);};
  globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('art.json')?(themeManifest??{
    ground:{tiles:[tile('ground-a.svg'),tile('ground-b.svg')]},
    decks:[tile('deck.svg')],props:[{...tile('prop.svg'),shadow:false}],floating:[tile('boat.svg')],
  }):{pieces:[]}});
  const renderer={resolution:2,texture:{bindSource:source=>uploads.add(source)}};
  const pool=createGroundPool({acquire:(src,resolution)=>Assets.load({src,data:{resolution,groundPadding:2}}),release(){}});
  t.after(async()=>{
    pool.destroy();
    for(const promise of textures.values()){const texture=await promise;if(!texture.destroyed)loader.unload(texture);}
    Assets.load=old.load;Assets.unload=old.unload;globalThis.fetch=old.fetch;DOMAdapter.set(old.adapter);
  });
  return {pool,uploads,renderer,requests,waiting,finish:src=>{const resolve=waiting.get(src);assert(resolve,src);waiting.delete(src);resolve();}};
}
function homeGame(f){
  const scene=new Container(),ground=new Container(),decks=new Container();scene.addChild(ground,decks);
  const game=Object.assign(Object.create(PixiIsland.prototype),{scene,homeGround:ground,decks,artShown:'home',loaded:[],props:[],
    arts:new Map([['home',{ready:false,groups:[ground,decks]}]]),homeKites:{entries:[]},groundPool:f.pool,
    app:{renderer:f.renderer},prepareHomeWater:async()=>{},showArt(){},
    homeArtPlan:{resolutions:new Map()},plantReactions:{async register(){},async prepared(){}}});
  let ready;
  Object.defineProperty(game,'homePrepared',{get:()=>ready,set:value=>{
    if(value)assertUploaded(f.uploads,[...game.arts.get('home').groups,...game.props.map(p=>p.sprite)]);
    ready=value;
  }});
  return game;
}
function themeGame(f){
  const scene=new Container(),ground=new Container(),decks=new Container(),objects=new Container();
  scene.addChild(ground,decks,objects);
  return Object.assign(Object.create(PixiIsland.prototype),{scene,ground,decks,objects,
    contactShadows:new Container(),overDecks:new Container(),arts:new Map(),artShown:'pink',
    groundPool:f.pool,app:{renderer:f.renderer},mapSleepers:new Map(),
    plantReactions:{async register(){},sources:()=>[],unregister(){}},
    buildMapAmbience(){},async makeSleepers(){},showArt(){}});
}

for(const kind of ['webp','svg']){
  test(`${kind}: initial Home cannot become ready until its last ground decode and GPU upload finish`,async t=>{
    const last='/pixi-art/home-expansion/ground-r0-c1.svg';
    const f=fixture(t,kind,src=>src===last),game=homeGame(f);
    game.homeGroundStream=f.pool.create([tile('/pixi-art/home-expansion/ground-r0-c0.svg'),tile(last)],game.homeGround);
    const prop=new Sprite(await Assets.load({src:'/home-sign.svg',data:{resolution:1}}));
    game.props.push({sprite:prop});game.scene.addChild(prop);
    const preparing=game.uploadHomeArt();
    await until(()=>f.waiting.has(last));
    assert.equal(game.artReady('home'),undefined);assert.equal(game.arts.get('home').ready,false);
    assert.equal(game.homeGroundStream.entries[1].sprite.texture,Texture.EMPTY);
    assert.equal(f.uploads.size,0,'no partial island is uploaded as prepared');
    f.finish(last);await preparing;
    assertReady(game,'home',f.uploads,[...game.arts.get('home').groups,prop]);
    const before=f.requests.length;
    for(let i=0;i<20;i++)f.pool.update([{stream:game.homeGroundStream,camera:{x:i,y:i,zoom:.1+i/10},width:100,height:100}],2);
    await flush();assert.equal(f.requests.length,before,'walking and zoom never load after reveal');
    game.scene.destroy({children:true});
  });

  test(`${kind}: deferred Home restoration waits for both props and every real HOME_TILES entry`,async t=>{
    const propSrc=`/restore-${kind}.svg`;
    const f=fixture(t,kind,src=>src===propSrc||/home-expansion\/ground-r0-c0\.svg$/.test(src)),game=homeGame(f);
    const placeholder=new Texture({source:Texture.EMPTY.source}),prop=new Sprite(placeholder);
    game.scene.addChild(prop);game.props.push({sprite:prop});
    game.homeRestore=Promise.resolve([{src:propSrc,resolution:1,count:1,nodes:[{node:prop,width:40,height:20}]}]);
    const preparing=game.ensureHomeArt();
    await until(()=>f.waiting.has(propSrc));
    assert(!game.artReady('home'));assert.equal(game.arts.get('home').ready,false);
    f.finish(propSrc);
    await until(()=>[...f.waiting.keys()].some(src=>src.includes('home-expansion/ground-r0-c0.svg')));
    assert(!game.artReady('home'));assert.equal(game.arts.get('home').ready,false);
    f.finish([...f.waiting.keys()][0]);await preparing;
    assert(game.homeGroundStream.entries.length>10,'real Home ground layout restored');
    assertReady(game,'home',f.uploads,[...game.arts.get('home').groups,prop]);
    game.releaseHomeArt();await game.homeRestore;await flush();
    assert.equal(game.artReady('home'),false);assert.equal(game.arts.get('home').ready,false);
    placeholder.destroy();game.scene.destroy({children:true});
  });

  test(`${kind}: themed artReady stays false through delayed props, ground and GPU warmup`,async t=>{
    const f=fixture(t,kind,src=>src.endsWith('/prop.svg')||src.endsWith('/ground-b.svg'));
    const game=themeGame(f);
    const set=game.arts.set.bind(game.arts);
    game.arts.set=(id,art)=>{
      if(art.ready)assertUploaded(f.uploads,[...art.groups,...art.props.map(p=>p.sprite)]);
      return set(id,art);
    };
    const preparing=game.ensureArt('pink');
    await until(()=>[...f.waiting.keys()].some(src=>src.endsWith('/prop.svg')));
    assert.equal(game.artReady('pink'),false);f.finish([...f.waiting.keys()][0]);
    await until(()=>[...f.waiting.keys()].some(src=>src.endsWith('/ground-b.svg')));
    assert.equal(game.artReady('pink'),false);assert.equal(f.uploads.size,0);
    f.finish([...f.waiting.keys()][0]);await preparing;
    const art=game.arts.get('pink');assertReady(game,'pink',f.uploads,[...art.groups,...art.props.map(p=>p.sprite)]);
    game.freeArt('pink');await flush();
    game.scene.destroy({children:true});game.contactShadows.destroy({children:true});game.overDecks.destroy({children:true});
  });
}

test('readiness accepts EMPTY, cloned placeholders and destroyed textures after the deadline',async t=>{
  const warnings=[],warn=console.warn;console.warn=(...args)=>warnings.push(args);t.after(()=>console.warn=warn);
  const placeholder=new Texture({source:Texture.EMPTY.source}),dead=finalTexture();dead.destroy(true);
  for(const texture of [Texture.EMPTY,placeholder,dead]){
    const root=new Container(),node=new Sprite(texture);node.visible=false;root.addChild(node);
    await uploadIsland({texture:{bindSource(){assert.fail('placeholder upload');}}},[root],
      {requiredRoots:[root],yieldFrame:async()=>{},timeoutMs:20});
    root.destroy({children:true});
  }
  placeholder.destroy();
  for(const texture of [Texture.EMPTY,new Texture({source:Texture.EMPTY.source})]){
    let attempts=0;
    const pool=createGroundPool({acquire:async()=>{attempts++;return texture;},release(){}}),root=new Container();
    const stream=pool.create([tile('/empty.svg')],root);
    await stream.prepare({timeoutMs:20});assert(stream.prepared);assert.equal(attempts,2);
    assert(isArtPlaceholder(stream.entries[0].sprite.texture));
    pool.destroy();root.destroy();if(texture!==Texture.EMPTY)texture.destroy();
  }
  assert.equal(warnings.length,5,'one warning per failed piece');
});

test('Home publishes readiness after a placeholder prop times out',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const node=new Sprite(Texture.EMPTY),ground=new Container(),game=Object.assign(Object.create(PixiIsland.prototype),{
    scene:ground,homeGroundStream:{async prepare(){}},app:{renderer:{resolution:2,texture:{bindSource(){}}}},
    arts:new Map([['home',{ready:false,groups:[ground]}]]),props:[{sprite:node}],homeKites:{entries:[]},
  });
  const preparing=game.uploadHomeArt();await flush();
  assert(!game.artReady('home'));
  t.mock.timers.tick(ART_TIMEOUT_MS-1);await flush();assert(!game.artReady('home'));
  t.mock.timers.tick(1);await preparing;
  assert.equal(game.artReady('home'),true);assert.equal(game.arts.get('home').ready,true);
  node.destroy();ground.destroy();
});

test('themed engine reveals available pictures after a placeholder prop times out',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const f=fixture(t,'webp',()=>false),game=themeGame(f),load=Assets.load;
  const placeholder=new Texture({source:Texture.EMPTY.source});
  let attempts=0;
  Assets.load=asset=>asset.src.endsWith('/prop.svg')?(attempts++,Promise.resolve(placeholder)):load(asset);
  const warnings=[],warn=console.warn;console.warn=(...args)=>warnings.push(args);t.after(()=>{console.warn=warn;});
  const preparing=game.ensureArt('pink');await flush();
  assert.equal(game.artReady('pink'),false);
  t.mock.timers.tick(ART_TIMEOUT_MS);
  for(let i=0;i<30;i++){await flush();t.mock.timers.tick(0);}
  await preparing;
  assert.equal(game.artReady('pink'),true);assert.equal(attempts,2);assert(warnings.length>=1);
  placeholder.destroy();game.scene.destroy({children:true});game.contactShadows.destroy({children:true});game.overDecks.destroy({children:true});
});

test('a ground piece that never resolves still reveals Home within the 4 second deadline',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const uploads=new Set(),ground=new Container(),scene=new Container();scene.addChild(ground);
  let attempts=0,released=0;
  const good=finalTexture();
  const pool=createGroundPool({acquire:src=>src==='/stuck.svg'?(attempts++,new Promise(()=>{})):Promise.resolve(good),release(){released++;}});
  const game=Object.assign(Object.create(PixiIsland.prototype),{scene,homeGround:ground,props:[],homeKites:{entries:[]},
    arts:new Map([['home',{ready:false,groups:[ground]}]]),app:{renderer:{resolution:2,texture:{bindSource:s=>uploads.add(s)}}},
    homeGroundStream:pool.create([tile('/good.svg'),tile('/stuck.svg')],ground)});
  const preparing=game.uploadHomeArt();await flush();assert(!game.artReady('home'));
  t.mock.timers.tick(ART_TIMEOUT_MS/2);await flush();assert.equal(attempts,2);assert(!game.artReady('home'));
  t.mock.timers.tick(ART_TIMEOUT_MS/2);
  for(let i=0;i<30;i++){await flush();t.mock.timers.tick(0);}
  await preparing;
  assert.equal(game.artReady('home'),true);assert(game.homeGroundStream.prepared);
  assert(uploads.has(good.source));assert.equal(game.revealArtReady('home'),true);
  assert(isArtPlaceholder(game.homeGroundStream.entries[1].sprite.texture));
  game.artShown='home';game.globeT=0;game.mapSleepers=new Map();game.rigs=[];game.localDucks=[];game.liveRigs=new Map();
  game.showArt('home');const restore=game.applyIslandReveal(0);restore();
  assert.equal(ground.visible,true,'the whole-island reveal starts after degraded readiness');
  pool.destroy();assert.equal(released,3,'retry and both final leases released exactly once');scene.destroy({children:true});good.destroy(true);
});

test('upload gate rechecks final sources after yields and warms replacements before returning',async()=>{
  const first=finalTexture(),last=finalTexture(),node=new Sprite(first),uploads=[];
  await uploadIsland({texture:{bindSource:source=>uploads.push(source)}},[node],
    {requiredRoots:[node],yieldFrame:async()=>{node.texture=last;}});
  assert(uploads.includes(last.source));
  node.texture=first;const replacements=[];
  await uploadIsland({texture:{bindSource:source=>{assert(!source.destroyed);replacements.push(source);}}},[node],
    {requiredRoots:[node],yieldFrame:async()=>{node.texture=last;if(!first.destroyed)first.destroy(true);}});
  assert.deepEqual(replacements,[last.source]);
  const next=finalTexture();
  node.texture=next;
  await uploadIsland({texture:{bindSource(){}}},[node],
    {requiredRoots:[node],timeoutMs:20,yieldFrame:async()=>{node.texture=Texture.EMPTY;}});
  node.destroy();next.destroy(true);last.destroy(true);
});

test('pinning ground fences older camera requests and eviction cannot blank final textures',async()=>{
  const waiting=new Map(),released=[],root=new Container();
  const pool=createGroundPool({acquire:src=>new Promise(resolve=>waiting.set(src,resolve)),release:src=>released.push(src)});
  const stream=pool.create([tile('/handover.svg')],root),view={stream,camera:{x:10,y:5,zoom:1},width:100,height:100};
  pool.update([view]);
  const preparing=stream.prepare(),final=finalTexture(),old=finalTexture();
  waiting.get('/handover.svg')(final);await preparing;
  // Finish the lower-resolution camera request after final preparation.
  waiting.get('/handover.svg?groundScale=1')(old);await flush();
  assert.equal(stream.entries[0].sprite.texture,final);
  pool.update([]);assert.equal(stream.entries[0].sprite.texture,final);
  assert.deepEqual(released,['/handover.svg?groundScale=1']);
  pool.destroy();root.destroy();final.destroy(true);old.destroy(true);
});


test('registered bog-arena prepares and reveals through SVG when prerender manifest has no map',async t=>{
  const installed=installBogEnvironment();t.after(()=>installed.restore());
  const map=mapFor(BOG_MAP_ID),manifest=JSON.parse(readFileSync('public'+map.art));
  const f=fixture(t,'webp',()=>false,{prerenderManifest:{},themeManifest:manifest}),game=themeGame(f);
  game.artShown=BOG_MAP_ID;game.startupPrepared=false;game.rigs=[];game.localDucks=[];game.liveRigs=new Map();
  await game.ensureArt(BOG_MAP_ID);
  assert.equal(game.artReady(BOG_MAP_ID),true);
  const art=game.arts.get(BOG_MAP_ID);
  assert(art.groundStreams[0].entries.length>0);assert(art.props.length>0);
  assert(f.requests.some(src=>src.includes('bog-arena')));
  assert(f.requests.every(src=>!src.endsWith('.webp')),'missing build tiers use authored SVGs');
  assert(Number.isFinite(art.artPlan.bytes));
  const warnings=[],warn=console.warn;console.warn=(...args)=>warnings.push(args);t.after(()=>console.warn=warn);
  t.mock.timers.enable({apis:['setTimeout']});
  const startup=game.prepareStartupArt({steps:[['Bog audio',()=>Promise.reject(Error('audio unavailable'))]]});
  await flush();assert.equal(game.startupPrepared,false);
  t.mock.timers.tick(8000);
  for(let i=0;i<20;i++){await flush();t.mock.timers.tick(0);}
  await startup;
  assert.equal(game.startupPrepared,true);assert(warnings.some(args=>args[0].includes('Bog audio')));
  game.showArt=PixiIsland.prototype.showArt;
  game.showArt(BOG_MAP_ID);game.applyIslandReveal(0)();
  assert.equal(art.ground.visible,true,'Bog arena reveals despite rejected startup step');
  game.freeArt(BOG_MAP_ID);game.scene.destroy({children:true});game.contactShadows.destroy();game.overDecks.destroy();
});

test('shown-map ensureArt retries a rejection once and then reveals available pieces',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const group=new Container(),game=Object.assign(Object.create(PixiIsland.prototype),{
    artShown:BOG_MAP_ID,startupPrepared:true,arts:new Map([[BOG_MAP_ID,{ready:false,groups:[group]}]]),
    rigs:[],localDucks:[],liveRigs:new Map(),mapSleepers:new Map(),props:[],globeT:0,
  });
  let attempts=0;game.ensureArt=async()=>{attempts++;throw Error('Bog decode failed');};
  const preparing=game.ensureMapArt(BOG_MAP_ID);await flush();
  assert.equal(attempts,2);assert.equal(game.revealArtReady(BOG_MAP_ID),false);
  t.mock.timers.tick(8000);await preparing;
  assert.equal(attempts,2);assert.equal(game.revealArtReady(BOG_MAP_ID),true);assert(group.visible);
  group.destroy();
});

test('hard reveal deadline handles hung preparation and resets for the next shown map',t=>{
  const old=globalThis.performance;let now=0;
  globalThis.performance={now:()=>now};t.after(()=>globalThis.performance=old);
  const group=new Container(),game=Object.assign(Object.create(PixiIsland.prototype),{
    artShown:BOG_MAP_ID,startupPrepared:false,arts:new Map([[BOG_MAP_ID,{ready:false,groups:[group]}]]),
    rigs:[],localDucks:[],liveRigs:new Map(),mapSleepers:new Map(),props:[],globeT:0,
  });
  const warnings=[],warn=console.warn;console.warn=(...args)=>warnings.push(args);t.after(()=>console.warn=warn);
  group.visible=false;assert.equal(game.revealArtReady(BOG_MAP_ID),false);now=14999;
  assert.equal(game.revealArtReady(BOG_MAP_ID),false);assert(!group.visible);
  now=15000;assert.equal(game.revealArtReady(BOG_MAP_ID),true);assert(group.visible);
  for(let i=0;i<5;i++)assert(game.revealArtReady(BOG_MAP_ID));assert.equal(warnings.length,1);
  game.artShown='pink';assert.equal(game.revealArtReady('pink'),false);
  now=29999;assert.equal(game.revealArtReady('pink'),false);
  now=30000;assert.equal(game.revealArtReady('pink'),true);assert.equal(warnings.length,2);
  group.destroy();
});

test('a hung startup step completes startup after 8 seconds and ignores disposal',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const game=Object.assign(Object.create(PixiIsland.prototype),{startupPrepared:false,scene:new Container(),
    app:{renderer:{texture:{bindSource(){}}}},showArt(){}});
  let calls=0;
  const startup=game.prepareStartupArt({steps:[['Hung boat views',()=>{calls++;return new Promise(()=>{});}]]});
  await flush();t.mock.timers.tick(7999);await flush();assert.equal(game.startupPrepared,false);
  t.mock.timers.tick(1);await startup;assert.equal(game.startupPrepared,true);assert.equal(calls,1);
  game.startupPrepared=false;game.disposed=true;
  await game.prepareStartupArt({steps:[]});assert.equal(game.startupPrepared,false);game.scene.destroy();
});
