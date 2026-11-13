import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Assets, Container, DOMAdapter, ImageSource, Sprite, Texture} from 'pixi.js';
import {createCanvas, Image} from '@napi-rs/canvas';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {createArtQueue, uploadIsland, mapArtInFrames} from '../src/rendering/pixi/art/island-preparation.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {svgLayerContexts} from '../src/rendering/pixi/art/svg-context.js';
import {DOMParser} from '@xmldom/xmldom';
import {PixiIsland, cameraGame} from './helpers/pixi-engine.mjs';
import {RoomClient} from '../src/multiplayer/room-client.js';
import {artOf} from '../src/world/island-maps.js';
const flush=()=>new Promise(setImmediate);

test('Blob SVG loading preserves whole-picture dimensions and pixels without text or data URLs',async t=>{
  const previous=DOMAdapter.get();t.after(()=>DOMAdapter.set(previous));
  DOMAdapter.set({...previous,createCanvas});
  let fetched=0,decoded=0,yields=0;
  const loader=createWholeSVGLoader({queue:createArtQueue({yieldFrame:async()=>{yields++;}}),
    fetchBlob:async()=>{fetched++;return new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10" fill="#cb7139"/></svg>'],{type:'image/svg+xml'});},
    decode:async blob=>{decoded++;const image=new Image();image.src=Buffer.from(await blob.arrayBuffer());await image.decode();return image;}});
  // small SVGs that Vite inlines as data URLs (the Bog ghosts) take the same loader
  assert.ok(loader.test('/whole.svg')&&loader.test('blob:x')&&loader.test("data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'"));
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
      prepareHomeWater:async()=>{},
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
  await Promise.all(work);assert.deepEqual(ran,[1,1,1,1,1,2,2]);
});

test('quiet art work waits for walk/zoom activity to end',async t=>{
  const {markArtActivity,nextArtFrame}=await import('../src/rendering/pixi/art/island-preparation.js');
  const previous=globalThis.requestAnimationFrame,callbacks=[];
  globalThis.requestAnimationFrame=callback=>callbacks.push(callback);
  t.after(()=>globalThis.requestAnimationFrame=previous);
  let finished=false;const pending=nextArtFrame().then(()=>finished=true);
  assert.equal(callbacks.length,1);
  markArtActivity(50);callbacks.shift()();await flush();
  assert.equal(finished,false);
  await new Promise(resolve=>setTimeout(resolve,80));
  assert.equal(callbacks.length,1);callbacks.shift()();await pending;
});

test('ready prepares the standing duck library; unused world pictures stay demand driven',()=>{
  const ready=engine.slice(engine.indexOf('      await this.ensureArt(this.artShown);'),engine.indexOf('      this.ready = true;'));
  assert(ready.includes('await prepareDuckAssets()'));
  assert(ready.includes('sources:duckTextureSources()'));
  const start=engine.slice(engine.indexOf('      this.archipelago ='),engine.indexOf('      this.ready = true;'));
  assert(!start.includes('loadPreviews('));assert(!start.includes('createIsletView('));assert(!start.includes('createWorldView('));
  assert(!ready.includes('loadedSVGTextures'));
});


test('a pending island still renders the ocean and animated player on every native frame',t=>{
  const previous={document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,devicePixelRatio:globalThis.devicePixelRatio};
  let scheduled=0;Object.assign(globalThis,{document:{hidden:false},requestAnimationFrame:()=>++scheduled,devicePixelRatio:1});
  t.after(()=>Object.assign(globalThis,previous));
  const player={id:1,player:true,x:0,y:0,previousX:0,previousY:0,turn:0,action:0,travel:0};
  const game=cameraGame(player),scene=new Container(),ocean=new Sprite(Texture.EMPTY),duck=new Container();
  // Exercise the real tick and renderScreen, replacing only GPU submission.
  const ground=new Container(),decks=new Container(),shadows=new Container(),prop=new Sprite(Texture.EMPTY),sleeper=new Container();
  scene.addChild(ocean,ground,decks,shadows,prop,sleeper,duck);
  const groups=[ground,decks,shadows];
  const art={ready:true,groups,props:[{sprite:prop,x:0,y:0,width:10,height:10,scale:1,name:'house'}]};
  let renders=0,animated=0;
  Object.assign(game,{scene,ocean,homePrepared:false,arts:new Map([['home',art]]),props:art.props,
    gust:0,sim:{time:0,player,ducks:[player],step(dt){this.time+=dt;}},localDucks:[player],
    rigs:[{root:duck,update(){animated++;}}],mapSleepers:new Map(),floating:[],ripples:[],birds:[],crows:[],butterflies:[],leaves:[],droplets:[],splashes:[],
    marker:new Container(),renderPhotoFrame(){},snowfall:{update(){}},audio:{muted:false},canvas:{dataset:{}},
    app:{render(){renders++;assert.equal(scene.visible,true);assert.equal(ocean.visible,true);assert.equal(duck.visible,true);for(const node of [...groups,prop])assert.equal(node.visible,false);}},
  });
  // TilingSprite's scrolling interface, without needing a browser/GPU.
  ocean.tilePosition={set(x,y){this.x=x;this.y=y;}};
  for(const now of [16,32,48])game.tick(now);
  assert.equal(renders,3);assert.equal(animated,3);assert.equal(scheduled,3);
  assert.notEqual(ocean.tilePosition.x,0);assert.equal(game.revealMap,null);
  scene.destroy({children:true});game.marker.destroy();
});

test('prepared island groups, props and sleepers share one 250ms reveal; sea and player keep full alpha',()=>{
  const game=Object.create(PixiIsland.prototype),scene=new Container(),ocean=new Container(),duck=new Container();
  const groups=Array.from({length:5},()=>new Container()),prop=new Sprite(Texture.EMPTY),sleeper=new Container(),nested=new Sprite(Texture.EMPTY);
  groups[0].addChild(nested);scene.addChild(ocean,duck,...groups,prop,sleeper);
  const art={ready:false,groups,props:[{sprite:prop}]};
  Object.assign(game,{globeT:0,rigs:[],localDucks:[],liveRigs:new Map(),artShown:'pink',arts:new Map([['pink',art]]),mapSleepers:new Map([['pink',[{rig:{root:sleeper}}]]])});
  const nodes=[...groups,prop,sleeper];
  game.applyIslandReveal(0)();assert(nodes.every(n=>!n.visible));
  art.ready=true;game.startupPrepared=false;game.showArt('pink');game.applyIslandReveal(50)();
  assert(nodes.every(n=>!n.visible),'shared startup warmup also gates the whole reveal');
  game.startupPrepared=true;game.showArt('pink');prop.visible=sleeper.visible=true;
  prop.alpha=.6;nested.alpha=.4;
  for(const [now,expected]of [[100,0],[225,.875],[350,1],[600,1]]){
    const restore=game.applyIslandReveal(now);
    assert(groups.every(g=>g.visible&&g.alpha===expected));
    assert.equal(prop.alpha,.6*expected);assert.equal(sleeper.alpha,expected);
    assert.equal(nested.alpha,.4,'nested nodes receive the envelope once through their group');
    assert.equal(ocean.alpha,1);assert.equal(duck.alpha,1);
    restore();assert.equal(prop.alpha,.6,'animation-owned alpha is preserved after rendering');
  }
  // A repeat visit must start a fresh fade, without resetting on repeated showArt.
  art.ready=false;game.applyIslandReveal(700)();art.ready=true;game.showArt('pink');
  const restore=game.applyIslandReveal(800);assert.equal(groups[0].alpha,0);restore();
  scene.destroy({children:true});
});

test('startup keeps rendering before the authoritative saved island arrives and never prepares placeholder Home',async()=>{
  const room=new RoomClient(()=>{}),prepared=[];
  let selected=false;
  const start=room.waitForIsland().then(id=>{selected=true;prepared.push(artOf(id));return id;});
  await flush();assert.equal(selected,false);assert.deepEqual(prepared,[]);
  room.id='saved-player';
  room.snapshot({epoch:'saved',tick:1,islandId:'sunset',players:[],boats:[]});
  assert.equal(await start,'sunset');assert.deepEqual(prepared,['pink']);
  assert.equal(await room.waitForIsland(),'sunset');
  // Mount must use that snapshot before it chooses or acquires Home artwork.
  assert(engine.indexOf('await this.room.waitForIsland()')<engine.indexOf('const prepareHome='));
  assert(engine.indexOf('this.renderArrival(this.lastFrame)')<engine.indexOf('await this.room.waitForIsland()'));
  assert(engine.includes('const prepareHome=artOf(startingIsland)'));
  assert(engine.includes('if(prepareHome)await this.prepareHomeWater()'));
  assert(engine.indexOf('this.raf=requestAnimationFrame(time=>this.tick(time))')<engine.indexOf('await this.ensureArt(this.artShown)'));
  room.dispose();
});

test('scene and sleeper construction yields at both count and time budgets',async()=>{
  const visits=[],frames=[];let frame=0,clock=0;
  const values=await mapArtInFrames([1,2,3,4,5],value=>{visits.push(frame);clock+=3;return value*2;},
    {now:()=>clock,yieldFrame:async()=>{frames.push(++frame);},frameBudgetMs:5,batchSize:12});
  assert.deepEqual(visits,[0,0,1,1,2]);assert.deepEqual(frames,[1,2]);assert.deepEqual(values,[2,4,6,8,10]);
  frame=0;visits.length=0;
  await mapArtInFrames([1,2,3,4,5],()=>visits.push(frame),{yieldFrame:async()=>{frame++;},batchSize:2});
  assert.deepEqual(visits,[0,0,1,1,2]);
  let cancelled=false;visits.length=0;
  const partial=await mapArtInFrames([1,2,3,4],value=>{visits.push(value);return value;},
    {batchSize:2,yieldFrame:async()=>{cancelled=true;},cancelled:()=>cancelled});
  assert.deepEqual(partial,[1,2]);assert.deepEqual(visits,[1,2],'a discarded destination stops constructing rigs at the next yield');
});


test('startup renders and scrolls the same ocean and Duck while the first island is unresolved',t=>{
  const previous=globalThis.requestAnimationFrame;let scheduled=0;
  globalThis.requestAnimationFrame=()=>++scheduled;t.after(()=>globalThis.requestAnimationFrame=previous);
  const game=Object.create(PixiIsland.prototype),scene=new Container(),ocean=new Sprite(Texture.EMPTY),root=new Container();
  scene.addChild(ocean,root);ocean.tilePosition={set(x,y){this.x=x;this.y=y;}};
  let rendered=0,animated=0;
  Object.assign(game,{room:{player:{x:-200,y:400,turn:.5}},host:{clientWidth:1440,clientHeight:900},
    arrivalScene:scene,ocean,camera:{x:0,y:0,zoom:.6},lastFrame:0,motion:{matches:false},
    arrivalRig:{root,update(){animated++;}},app:{render(){rendered++;assert(root.visible&&ocean.visible&&scene.visible);}}});
  game.renderArrival(16);const first=ocean.tilePosition.x;game.renderArrival(32);
  assert.equal(rendered,2);assert.equal(animated,2);assert.equal(scheduled,2);assert.notEqual(ocean.tilePosition.x,first);
  assert.equal(root.x,-200);assert.equal(root.y,400);assert.equal(root.alpha,1);scene.destroy({children:true});
});

test('a failed island art load is retried while you stay there, and a failed picture never stays cached',()=>{
  const lease=engine.slice(engine.indexOf('function acquire('),engine.indexOf('const acquireGround'));
  assert.match(lease,/entry\.promise\.catch\(\(\) => \{if \(textureLeases\.get\(src\) === entry\) textureLeases\.delete\(src\);\}\)/);
  const preparation=engine.slice(engine.indexOf('  ensureArt(mapId)'),engine.indexOf('  homeTextureNodes()'));
  const failure=preparation.slice(preparation.indexOf('art did not load'));
  assert.match(failure,/tries<4/);assert.match(failure,/this\.artShown===mapId/);assert.match(failure,/this\.ensureArt\(mapId\)/);
  assert.ok(failure.indexOf('this.ensureArt(mapId)')<failure.indexOf('failed: true'),'retry comes before giving up');
  assert.match(preparation,/this\.arts\.set\(mapId, art\);this\.artRetries\?\.delete\(mapId\)/,'a success resets the retry count');
});
