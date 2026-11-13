import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {Canvas,Image,createCanvas} from '@napi-rs/canvas';
import {Application,Assets,DOMAdapter,GlProgram,Rectangle,RenderGroupSystem,RenderTexture,Sprite,Texture,TexturePool,TextureSource} from 'pixi.js';
import {PixiIsland} from './helpers/pixi-engine.mjs';
import {createResolutionBudget,screenResolution} from '../src/rendering/shared/resolution-budget.js';
import {createManagedPoolBudget,textureSourceBytes} from '../src/rendering/pixi/texture-memory.js';
import {createGroundPool,VIEW_POOL_OPTIONS,tileInView,tileResolution} from '../src/rendering/pixi/art/ground-stream.js';
import {Container} from 'pixi.js';

const flush=()=>new Promise(setImmediate);

// Mount the complete game, using real Pixi scenes, source dimensions, leases,
// render groups and TexturePool. Only image decoding and GPU submission are
// replaced: Node/jsdom has no WebGL context. Unlike the old allocation model,
// this executes engine.mount/tick, sleeper caches and every runtime producer.
async function mountHome(t,dpr=2,height=771,{deferFountainArtwork=false}={}) {
  const dom=new JSDOM('<body><main></main></body>',{url:'http://ducky.test/?qa&cam=2820,2410,0.8',pretendToBeVisual:true});
  const prior={},names=['window','document','HTMLCanvasElement','Image','DOMParser','XMLSerializer','location','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame','matchMedia','ResizeObserver','fetch','performance'];
  for(const name of names)prior[name]=globalThis[name];
  let clockTime=performance.now();
  const adapter=DOMAdapter.get(),assets=new Map(),managed=new Set(),frames=new Map();let nextFrame=0;
  const originals={init:Application.prototype.init,destroy:Application.prototype.destroy,load:Assets.load,get:Assets.get,unload:Assets.unload,compile:GlProgram.from};
  const create=dom.window.document.createElement.bind(dom.window.document);
  let releaseArtwork;
  const artworkGate=new Promise(resolve=>{releaseArtwork=resolve;});
  if(!deferFountainArtwork)releaseArtwork();
  class RasterImage extends Image {
    set src(value){if(String(value).startsWith('blob:'))this.loading=prior.fetch(value).then(r=>r.arrayBuffer()).then(async b=>{await artworkGate;super.src=Buffer.from(b);});else super.src=value;}
    async decode(){await this.loading;return super.decode();}
  }
  Object.assign(globalThis,{performance:{now:()=>clockTime},window:dom.window,HTMLCanvasElement:Canvas,Image:RasterImage,document:dom.window.document,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer,location:dom.window.location,devicePixelRatio:dpr,
    requestAnimationFrame:cb=>{frames.set(++nextFrame,cb);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),
    matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),ResizeObserver:class{observe(){}disconnect(){}},
    fetch:async input=>{const path='public'+new URL(input,location.href).pathname;try{const text=readFileSync(path,'utf8');return {ok:true,status:200,text:async()=>text,json:async()=>JSON.parse(text)};}catch{return {ok:false,status:404,text:async()=>'',json:async()=>({})};}}
  });
  // Native 2D canvases for weather, fountain and surf; DOM canvas for input.
  dom.window.document.createElement=(tag,...args)=>tag==='canvas'?createCanvas(64,64):create(tag,...args);
  DOMAdapter.set({...adapter,createCanvas:(w=64,h=64)=>createCanvas(w,h)});
  GlProgram.from=options=>({...options,destroy(){}});
  const manage=source=>{if(!source||source.destroyed)return;source._gcLastUsed=clockTime;if(managed.has(source))return;managed.add(source);source.once('destroy',()=>managed.delete(source));source.once('unload',()=>managed.delete(source));
    if(source.autoGenerateMipmaps)source.mipLevelCount=Math.floor(Math.log2(Math.max(source.pixelWidth,source.pixelHeight)))+1;
  };
  Assets.load=async request=>{
    if(Array.isArray(request))return Promise.all(request.map(r=>Assets.load(r)));
    const src=typeof request==='string'?request:request.src;
    if(assets.has(src))return assets.get(src);
    const text=readFileSync('public'+new URL(src,location.href).pathname,'utf8');
    const xml=new dom.window.DOMParser().parseFromString(text,'image/svg+xml').documentElement;
    const box=xml.getAttribute('viewBox')?.split(/[ ,]+/).map(Number);
    const w=parseFloat(xml.getAttribute('width'))||box?.[2]||1,h=parseFloat(xml.getAttribute('height'))||box?.[3]||1;
    const data=typeof request==='string'?{}:request.data??{},r=data.resolution??1;
    const source=new TextureSource({width:Math.ceil(w*r)/r,height:Math.ceil(h*r)/r,...data,label:src});
    const texture=new Texture({source,label:src});assets.set(src,texture);return texture;
  };
  Assets.get=src=>assets.get(src);
  Assets.unload=async src=>{const texture=assets.get(src);assets.delete(src);texture?.destroy(true);};
  Application.prototype.init=async function(options){
    this.stage.enableRenderGroup();
    const renderer=this.renderer={canvas:create('canvas'),resolution:options.resolution,screen:new Rectangle(0,0,options.width,options.height),
      view:{resolution:options.resolution,antialias:false},texture:{_managedTextures:{get items(){return Object.fromEntries([...managed].map(s=>[s.uid,s]));}}},
      resize(w,h,r=this.resolution){this.resolution=r;this.view.resolution=r;this.screen.width=w;this.screen.height=h;TexturePool.setScreenSize(1,w*r,h*r);},
      generateTexture({target,resolution=1,frame}={}){const b=frame??target.getLocalBounds();const texture=RenderTexture.create({width:Math.max(1,b.width),height:Math.max(1,b.height),resolution});manage(texture.source);return texture;},
      render:({container,target})=>{
        container.enableRenderGroup();
        const groups=new RenderGroupSystem(renderer);groups._updateCachedRenderGroups(container.renderGroup,null);
        const visit=node=>{
          if(!node.visible||!node.renderable||node.alpha<=0)return;
          const group=node.renderGroup;
          if(group?.isCachedAsTexture){manage(group.texture.source);if(!group.textureNeedsUpdate)return;group.textureNeedsUpdate=false;}
          if(node.texture)manage(node.texture.source);
          for(const child of node.children??[])visit(child);
        };
        visit(container);if(target)manage(target.source);
      }};
    renderer.resize(options.width,options.height,options.resolution);
  };
  Application.prototype.destroy=function(){this.stage.destroy({children:true});};
  const host=create('main');Object.defineProperties(host,{clientWidth:{value:1512},clientHeight:{value:height}});document.body.appendChild(host);
  const errors=[],engine=new PixiIsland({onError:error=>errors.push(error)});
  t.after(async()=>{
    engine.dispose();releaseArtwork();await settleArtwork();await flush();TexturePool.clear(true);TexturePool.removeScreen(1);
    for(const texture of assets.values())texture.destroy(true);
    Application.prototype.init=originals.init;Application.prototype.destroy=originals.destroy;Assets.load=originals.load;Assets.get=originals.get;Assets.unload=originals.unload;GlProgram.from=originals.compile;
    DOMAdapter.set(adapter);Object.assign(globalThis,prior);dom.window.close();
  });
  await engine.mount(host);assert.deepEqual(errors,[]);assert(engine.ready,'the real engine mounts Home');
  let views=[];const updateBudgets=engine.updateRasterBudgets;
  engine.updateRasterBudgets=function(next,...args){views=next;return updateBudgets.call(this,next,...args);};
  let now=performance.now();
  const step=async(ms=16)=>{now+=ms;clockTime=now;const jobs=[...frames.values()];frames.clear();for(const job of jobs)job(now);await flush();assert.deepEqual(errors,[]);};
  const settle=async()=>{for(let i=0;i<120;i++)await step();};
  const settleArtwork=()=>Promise.all([engine.fountainWater,...[...engine.arts.values()].flatMap(a=>a.fountainWaters??[])].filter(Boolean).map(fx=>fx.artworkReady));
  await settle();assert.equal(engine.sceneryPending,false);
  const prepareAssets=()=>{
    // Assets are decoded eagerly but uploaded lazily. Upload every held lease,
    // including the fixed shared actor kit, before measuring. This makes the
    // first stop a conservative GPU baseline, not a partial actor warm-up.
    const root=new Container();for(const texture of assets.values())if(!texture.destroyed)root.addChild(new Sprite(texture));
    engine.app.renderer.render({container:root});root.destroy({children:true});
  };
  return {engine,step,settle,settleArtwork,releaseArtwork,prepareAssets,managed,assets,get views(){return views;},get now(){return now;}};
}

for(const dpr of [1,2])test(`mounted Home DPR${dpr}: real Pixi pool sources return to baseline across resolution cycles`,async t=>{
  const game=await mountHome(t,dpr),{engine,managed}=game,maximum=screenResolution(1512,771,dpr);
  assert.equal(engine.app.renderer.resolution,maximum,'loading starts at the maximum');
  const initial=engine.gpuMemory();assert(initial.bytes<=(dpr===1?150:250)*1e6);
  t.diagnostic(JSON.stringify({dpr,initialMaximum:maximum,initialMB:initial.MB}));
  const baseline=new Map();
  for(const r of [1,1.25,1.5,2,1.5,1.25,1,1.25,1.5,2,1]){
    engine.resolutionBudget=createResolutionBudget({dpr,override:r});engine.resolutionBudget.resize(1512,771);
    await game.settle();
    const memory=engine.gpuMemory(),pool=engine.poolBudget.stats();
    assert.equal(engine.groundPool.stats().missingTiles,0,'all desired Home tiles load');
    assert.equal(engine.groundPool.stats().failedTiles,0);
    assert(pool.bytes<=pool.limit,JSON.stringify(pool));
    const budget=(r===1?150:250)*1e6;
    assert(memory.bytes<=budget,`${r}: ${memory.MB} MB exceeds ${budget/1e6} MB`);
    if(baseline.has(r))assert(memory.bytes<=baseline.get(r),`resolution ${r} returns to baseline without growth`);baseline.set(r,memory.bytes);
    const oldTiles=[...managed].filter(s=>s.label?.includes('groundScale=')&&!s.destroyed);
    const byTile=new Map();for(const source of oldTiles){const url=new URL(source.label,location.href);url.searchParams.delete('groundScale');const key=url.href;assert(!byTile.has(key),'old and new densities coexist for '+key);byTile.set(key,source);}
    assert(oldTiles.length>0,'real Home tiles were submitted');
    const shadowTargets=[];const visit=group=>{if(group.texture)shadowTargets.push(group.texture);for(const c of group.renderGroupChildren)visit(c);};visit(engine.app.stage.renderGroup);
    assert(shadowTargets.length>0,'sleeping Ducky cache targets are actually exercised');
    const fullSize=shadowTargets.filter(t=>{
      const size=TexturePool.getOptimalSize(t.frame.width,t.frame.height,1);
      return size.width===1024&&size.height===1024;
    }).length;
    assert(shadowTargets.every(t=>t.source.pixelWidth<1024&&t.source.pixelHeight<1024),'no full-size sleeper cache');
    t.diagnostic(JSON.stringify({dpr,resolution:r,MB:memory.MB,count:memory.count,poolMB:pool.bytes/1e6,shadowTargets:shadowTargets.length,fullSize1024AtResolution1:fullSize}));
  }
});

for(const dpr of [1,2])test(`mounted Home DPR${dpr}: whole-island camera route stays bounded and returns without growth`,async t=>{
  const game=await mountHome(t,dpr,827,{deferFountainArtwork:true}),{engine,managed,assets}=game;
  let artworkReady=false;engine.fountainWater.artworkReady.then(()=>{artworkReady=true;});
  const maximum=engine.resolutionBudget.maximum,limit=(dpr===1?150:250)*1e6;
  engine.follow=false;engine.fly=null;engine.arrival=null;
  const stops=[[-1293,5017],[2000,3000],[-3000,1000],[500,500],
    // Sweep the other edges and the arrival plaza as well as the reported stops.
    [5500,3000],[2820,2410],[-1293,5017],[2000,3000],[-3000,1000],[500,500],[-1293,5017]];
  const baseline=new Map(),sourceBaseline=new Map(),island='home';
  for(const [x,y]of stops){
    Object.assign(engine.camera,{x,y,zoom:.8});Object.assign(engine.target,engine.camera);
    for(let frame=0;frame<375;frame++)await game.step();
    if(!baseline.size){
      assert.equal(artworkReady,false,'native fountain decode can outlast the old frame-only warm-up');
      game.releaseArtwork();
    }
    // Native image decode completion is asynchronous, independently of the
    // simulated camera clock. Do not accept a blank scene as a memory win.
    let stable=0;
    for(let frame=0;frame<2000&&stable<30;frame++){
      await game.step();
      const arts=[...engine.arts.values()];
      const pools=[engine.groundPool,...arts.map(a=>a.rasterPool)].filter(Boolean);
      const settled=!engine.sceneryPending&&arts.every(a=>a.ready||a.failed)&&!engine.homeArtBudget.pending&&arts.every(a=>!a.artBudget?.pending)&&pools.every(p=>{const s=p.stats();return !s.pendingTiles&&!s.missingTiles&&!s.refiningTiles;});
      if(settled)await game.settleArtwork();
      stable=settled?stable+1:0;
    }
    assert.equal(stable,30,'camera stop fully settles: '+JSON.stringify({island,x,y,ground:engine.groundPool.stats(),rasters:[...engine.arts.values()].map(a=>[a.id,a.rasterPool?.stats()])}));
    game.prepareAssets();
    assert(artworkReady,'fountain replacement is complete before the first residency baseline');
    assert([...engine.arts.values()].every(a=>a.ready), 'all neighboring theme art loaded');
    const memory=engine.gpuMemory(),pool=engine.poolBudget.stats(),label=`DPR${dpr} ${island} (${x},${y})`;
    assert.equal(engine.app.renderer.resolution,maximum,label+' preserves maximum density');
    assert(memory.bytes<=limit,`${label}: ${memory.MB} MB exceeds ${limit/1e6} MB`);
    assert(pool.bytes<=pool.limit,label+' shared ledger fits');
    for(const a of engine.arts.values())if(a.rasterPool){
      const stats=a.rasterPool.stats();assert.equal(stats.failedTiles,0,JSON.stringify(stats));assert.equal(stats.missingTiles,0,JSON.stringify(stats));
    }
    assert.equal(engine.groundPool.stats().missingTiles,0,JSON.stringify(engine.groundPool.stats()));
    let screenTiles=0;
    for(const view of game.views)for(const tile of view.stream.entries){
      if(!tile.screenResolution||!tile.sprite.visible||!tileInView(tile,view.camera,view.width,view.height,view.tilt,0))continue;
      screenTiles++;
      assert(tile.sprite.texture.source.resolution>=tileResolution(tile,view.camera.zoom,maximum),label+' keeps on-screen crops at device density: '+tile.src+' '+JSON.stringify({actual:tile.sprite.texture.source.resolution,required:tileResolution(tile,view.camera.zoom,maximum),shared:pool,ground:engine.groundPool.stats()}));
    }
    assert(screenTiles>0,label+' checks actual on-screen ground crops');
    for(const source of managed)if(source.label?.includes('artScale=')||source.resource&&source.resolution>1){
      assert(source.pixelWidth*source.pixelHeight<=4_000_000,label+' no oversized static raster');
    }
    assert(![...assets.keys()].some(src=>/^\/pixi-art\/globe\/[^/]+\.svg(?:\?|$)/.test(src)&&!src.includes('-ground.svg')),label+' releases authored globe previews');
    const key=island+':'+x+','+y;
    const histogram=()=>{const h={};for(const s of managed){const k=(s.label??'unlabelled')+':'+s.pixelWidth+'x'+s.pixelHeight;h[k]=(h[k]??0)+textureSourceBytes(s);}return h;};
    if(baseline.has(key)&&memory.bytes>baseline.get(key)+1024){const h=histogram(),old=sourceBaseline.get(key);t.diagnostic(JSON.stringify({growth:Object.entries(h).filter(([k,b])=>b>(old[k]??0)).sort((a,b)=>b[1]-a[1]).slice(0,20)}));}
    sourceBaseline.set(key,histogram());
    if(baseline.has(key))assert(memory.bytes<=baseline.get(key)+1024,`${label}: grew from ${baseline.get(key)/1e6} to ${memory.MB} MB`);
    else baseline.set(key,memory.bytes);
    t.diagnostic(JSON.stringify({route:true,dpr,island,x,y,resolution:maximum,MB:memory.MB,count:memory.count,poolMB:pool.bytes/1e6,screenTiles,themes:[...engine.arts.keys()]}));
  }
});

for(const dpr of [1,2])test(`mounted cathedral DPR${dpr}: piazza crops retain device density`,async t=>{
  const game=await mountHome(t,dpr,827),{engine}=game;
  engine.switchIsland('isle-176');engine.follow=false;engine.fly=null;engine.arrival=null;engine.landingView=null;delete engine.camera.basis;
  Object.assign(engine.camera,{x:4100,y:2490,zoom:.8});Object.assign(engine.target,engine.camera);
  let stable=0;
  for(let i=0;i<2400&&stable<30;i++){
    await game.step();const art=engine.arts.get('cathedral');
    const settled=art?.ready&&!engine.sceneryPending&&!engine.homeArtBudget.pending&&[engine.groundPool,art.rasterPool].every(p=>{const s=p.stats();return !s.pendingTiles&&!s.missingTiles&&!s.refiningTiles;});
    stable=settled?stable+1:0;
  }
  const art=engine.arts.get('cathedral'),r=engine.app.renderer.resolution;
  t.diagnostic(JSON.stringify({cathedral:true,dpr,resolution:r,MB:engine.gpuMemory().MB,ground:engine.groundPool.stats(),raster:art.rasterPool.stats(),shared:engine.poolBudget.stats()}));
  assert.equal(stable,30,'piazza settles with every crop loaded');
  assert.equal(r,engine.resolutionBudget.maximum,'piazza preserves maximum renderer density');
  assert(engine.gpuMemory().bytes<=(dpr===1?150:250)*1e6,'full-density piazza fits the total GPU target');
  assert(engine.poolBudget.bytes<=engine.poolBudget.limit,'full-density pools fit their shared ledger');
  let checked=0;
  for(const view of game.views)for(const tile of view.stream.entries){
    if(!tile.screenResolution||!tile.sprite.visible||!tileInView(tile,view.camera,view.width,view.height,view.tilt,0))continue;
    const source=tile.sprite.texture.source;
    checked++;assert(source.resolution>=tileResolution(tile,.8,r),`${tile.src}: ${source.resolution} < ${tileResolution(tile,.8,r)}`);
    assert(source.pixelWidth*source.pixelHeight<=4_000_000,'visible art is tiled, not one oversized raster');
  }
  assert(checked>0,'actual on-screen cathedral tiles were checked');
});

test('culled cache targets retire, then Pixi rebakes them at the same density on return',()=>{
  const stage=new Container({isRenderGroup:true}),rig=new Container(),shadow=new Container();stage.addChild(rig);rig.addChild(shadow);
  shadow.addChild(new Sprite(Texture.WHITE));shadow.cacheAsTexture({resolution:.25,antialias:false});
  const renderer={view:{resolution:2,antialias:true}},groups=new RenderGroupSystem(renderer),budget=createManagedPoolBudget();
  try{
    budget.configure(1512,827,1,1,stage);
    groups._updateCachedRenderGroups(stage.renderGroup,null);
    const first=shadow.renderGroup.texture;shadow.renderGroup.textureNeedsUpdate=false;
    budget.trim(stage);assert(!first.destroyed,'visible caches survive');
    first.source._gcLastUsed=performance.now();rig.visible=false;budget.trim(stage);
    assert(!first.destroyed,'a recently used neighbour-pass cache has one second of grace');
    first.source._gcLastUsed=-1;budget.trim(stage);
    assert(first.destroyed,'a culled ancestor releases its checked-out GPU source');
    assert.equal(shadow.renderGroup.texture,null);assert(shadow.renderGroup.textureNeedsUpdate);
    groups._updateCachedRenderGroups(stage.renderGroup,null);
    const fresh=shadow.renderGroup.texture;assert.notEqual(fresh,first);assert.equal(fresh.source.resolution,.25);
    rig.visible=true;budget.trim(stage);assert(!fresh.destroyed,'return retains a live target at the original density');
  }finally{stage.destroy({children:true});TexturePool.clear(true);}
});

test('mounted engine excludes scenery, art streaming, arrival, switching, globe and tab-return frames',async t=>{
  const {engine,step,now}=await mountHome(t,2),maximum=engine.resolutionBudget.maximum;
  const slow=async()=>{for(let i=0;i<200;i++)await step(50);assert.equal(engine.resolutionBudget.resolution,maximum);};
  engine.sceneryPending=true;await slow();engine.sceneryPending=false;
  const saved=engine.homeArtBudget;engine.homeArtBudget={pending:1,update(){},destroy(){}};await slow();engine.homeArtBudget=saved;
  engine.arrival={id:engine.player.id,name:'Home'};
  // Exercise the sampling gate directly so arrival animation completion does not
  // clear its flag, then exercise actual tick sampling for the scenery case.
  for(let time=now;time<now+10000;time+=50)engine.resolutionBudget.sample(time,50,engine.resolutionSampleReady(time));
  assert.equal(engine.resolutionBudget.resolution,maximum);engine.arrival=null;
  for(const flag of ['globeT','fly']){
    const old=engine[flag];engine[flag]=flag==='globeT'?.5:{};
    assert.equal(engine.resolutionSampleReady(now+20000),false);engine[flag]=old;
  }
  engine.resolutionIsland='previous-island';assert.equal(engine.resolutionSampleReady(now+30000),false);
  assert.equal(engine.resolutionSampleReady(now+34000),false);assert.equal(engine.resolutionSampleReady(now+35001),true);
  document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(engine.resolutionSampleReady(performance.now()+4000),false,'tab return gets five seconds');
});

test('all tile pools share actual-source admission and Pixi idle targets are destroyed',async()=>{
  const budget=createManagedPoolBudget(),root=new Container();budget.configure(512,512,1,2,root,0,true);
  const pools=[0,1].map(index=>createGroundPool({...VIEW_POOL_OPTIONS,poolBudget:budget,
    acquire:async()=>new Texture({source:new TextureSource({width:1024,height:1024})}),release(){},}));
  const streams=pools.map((p,i)=>p.create([{src:`/pool${i}.svg`,x:0,y:0,width:512,height:512,screenResolution:true}],root));
  for(let i=0;i<2;i++)pools[i].update([{stream:streams[i],camera:{x:256,y:256,zoom:1},width:512,height:512}]);
  for(let i=0;i<20;i++)await flush();
  assert(budget.bytes<=budget.limit,'actual dimensions, not the smaller estimate, are admitted');
  const idle=TexturePool.getOptimalTexture({width:2048,height:2048});TexturePool.returnTexture(idle);
  assert(textureSourceBytes(idle.source)>budget.limit);budget.trim(root);assert(idle.destroyed);
  pools.forEach(p=>p.destroy());assert.equal(budget.bytes,0);root.destroy({children:true});
});
