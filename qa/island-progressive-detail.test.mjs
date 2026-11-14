import {planIslandArt as mainArtPlan,mainWalkingZoomCeiling} from '../scripts/ground-mesh/main-art-plan.mjs';
import {groundTiles} from '../scripts/ground-mesh/build.mjs';
import {WORLD_ISLANDS,offsetOf} from '../src/world/world-map.js';
import {PixiIsland,cameraGame} from './helpers/pixi-engine.mjs';
import {Sprite} from 'pixi.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createWholeSVGLoader,createIslandPreparer} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {activeIslandTiers,planIslandSheets} from '../src/rendering/pixi/art/island-budget.js';
import {swapIslandDetail,detailZoomLimit} from '../src/rendering/pixi/art/island-detail.js';
import {createIslandPrefetch} from '../src/rendering/pixi/art/island-prefetch.js';
import {sliceCentreTexture} from '../src/rendering/pixi/environment/centre-motion.js';
import {selectIslandTier} from '../src/app/ducky-prefetch.js';

const flush=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
const manifest=()=>Object.fromEntries(['/a.svg','/b.svg'].map((src,i)=>[src,{w:10,h:10,padding:0,tiers:[1,2].map(scale=>({
 scale,sheet:`/${scale}.webp`,url:`/${i}-${scale}.webp`,group:`home/props/${scale}`,width:10*scale,height:10*scale,
 x:2+i*24,y:2,frameWidth:10*scale,frameHeight:10*scale,offsetX:0,offsetY:0,sheetWidth:64,sheetHeight:32,
}))}]));

test('landing plans use measured density and the zoom clamp lifts only after the atomic swap',async()=>{
 const m=manifest(),loads=[],closed=[];
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
  fetchBlob:async(url,options)=>{loads.push([url,options.priority]);return new Blob([url]);},
  decodeBitmap:async blob=>{const name=await blob.text();return {width:64,height:32,close(){closed.push(name);}};}});
 const index={version:2,islands:{home:{2:{views:[{zoom:.39,sharpZoom:.5,bytes:100,webp:['/1.webp'],detail:['/2.webp']}]}}}};
 const prepare=createIslandPreparer({getIndex:async()=>index,getManifest:async()=>m,loader,dpr:()=>2});
 const lease=await prepare('home');
 const planned=planIslandSheets({resolutions:new Map([['/a.svg',2],['/b.svg',2]])},m);
 assert.deepEqual([...planned.resolutions.values()],[1,1]);
 const a=await loader.load('/a.svg'),b=await loader.load('/b.svg');
 const slice=sliceCentreTexture(a,.5,.5),old=a.source;
 const sprite=new Sprite(a),sliceSprite=new Sprite(slice);sprite.didViewUpdate=false;sliceSprite.didViewUpdate=false;
 const state={lease,live:false};assert.equal(detailZoomLimit(state),.5);
 let frame=0;const uploads=[];
 const done=await swapIslandDetail(lease,{texture:{bindSource(source){uploads.push([frame,source]);}}},{
  textures:new Set([a,b]),loader,frame:async()=>{
   frame++;assert.equal(a.source,old,'all visible frames stay on landing until the swap');
   assert.equal(b.source,old);assert.equal(detailZoomLimit(state),.5);
  },afterSwap:()=>{state.live=true;},
 });
 assert(done);assert.equal(detailZoomLimit(state),1.8);
 assert.equal(a.source,b.source);assert.notEqual(a.source,old);
 assert(sprite.didViewUpdate,'a real prop sprite invalidates its cached UV and source data');
 assert(sliceSprite.didViewUpdate,'derived centre sprites invalidate too');assert.equal(slice.source,a.source);
 assert.equal(slice.width,10);assert.equal(slice.height,5);assert.equal(slice.frame.height,10);
 assert.equal(uploads.length,1);assert.deepEqual(loads,[['/1.webp','high'],['/2.webp','low']]);
 assert.equal(activeIslandTiers.get(m).get('/a.svg').sheet,'/2.webp');
 lease.releaseLanding();assert(old.destroyed,'landing GPU source freed after the swap');
 sprite.destroy();sliceSprite.destroy();loader.unload(a);loader.unload(b);slice.destroy(false);lease.release();
 assert.deepEqual(closed.sort(),['/1.webp','/2.webp']);assert.equal(activeIslandTiers.has(m),false);
});

test('a cancelled detail upload leaves every landing frame and clamp intact and frees private sheets',async()=>{
 const m=manifest();let cancelled=false,closed=0;
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,fetchBlob:async()=>new Blob(),
 decodeBitmap:async()=>({width:64,height:32,close(){closed++;}})});
 const landing=new Map(Object.entries(m).map(([src,e])=>[src,e.tiers[0]])),detail=new Map(Object.entries(m).map(([src,e])=>[src,e.tiers[1]]));
 const a=await loader.load('/a.svg'),old=a.source;
 const lease={landing,detail,manifest:m,prepareDetail:()=>loader.prepareTiers([...detail.values()]),activate(){assert.fail('cancelled swap cannot activate');}};
 assert.equal(await swapIslandDetail(lease,{}, {textures:new Set([a]),loader,cancelled:()=>cancelled,
  upload:async()=>{cancelled=true;},frame:async()=>{}}),false);
 assert.equal(a.source,old);assert(!old.destroyed);assert.equal(closed,1);
 loader.unload(a);assert.equal(closed,2);
});

test('background warming is idle, nearest first, bytes only, one island at a time, and pauses a voyage',async()=>{
 const idle=[],calls=[];let releaseBody;
 const prefetch=createIslandPrefetch({
  islands:[{id:'home',x:0,y:0},{id:'far',x:10,y:0},{id:'near',x:1,y:0}],
  getIndex:async()=>({}),selectTier:(_index,id)=>({webp:[`/${id}-a`,`/${id}-b`]}),
  idle:fn=>idle.push(fn),fetchBytes:async(url,signal)=>{
   calls.push(url);
   if(url==='/near-b')await new Promise((resolve,reject)=>{
    releaseBody=resolve;signal.addEventListener('abort',()=>reject(Object.assign(Error(),{name:'AbortError'})));
   });
  },
 });
 prefetch.resume('home');assert.equal(calls.length,0);assert.equal(idle.length,1);
 idle.shift()();await flush();assert.deepEqual(calls,['/near-a','/near-b']);assert.equal(idle.length,0);
 prefetch.pause();await flush();assert.equal(idle.length,0);assert.equal(calls.length,2);
 prefetch.resume('home');idle.shift()();await flush();releaseBody();await flush();
 assert.deepEqual(calls,['/near-a','/near-b','/near-a','/near-b']);
 assert.equal(idle.length,1);idle.shift()();await flush();assert.deepEqual(calls.slice(-2),['/far-a','/far-b']);
 assert.equal(idle.length,0);prefetch.destroy();
});

test('landing index stays within its byte budget and every placed piece is sharp through the clamp',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires production build');
 const {collectPlacedArt}=await import('../scripts/vite-prerender-art.mjs');
 const entries=await collectPlacedArt(process.cwd()),m=JSON.parse(await readFile(process.env.ART_MANIFEST));
 const pointer=JSON.parse(await readFile('dist/art-prerender/islands.json'));
 const index=JSON.parse(await readFile('dist'+pointer.url)),legacyGround=new Map();
 for(const island of entries.islands)for(const dpr of [1,2,3]){
  const tier=selectIslandTier(index,island.id,dpr,1440,900);
  assert((tier.sheetBytes??tier.bytes)<=5.5*1000000,`${island.id} DPR ${dpr}: ${tier.bytes} exceeds landing byte budget`);
  assert(tier.sharpZoom>=tier.zoom*2-1e-8);
  assert.equal((await Promise.all([...tier.webp,...tier.ground??[]].map(async url=>(await stat('dist'+url)).size))).reduce((a,b)=>a+b,0),tier.bytes);
  const urls=new Set(tier.webp);
  const svgPlan=tier.rasterDetail?JSON.parse(await readFile('dist'+tier.rasterDetail.plan)):null;
  const svgFrames=new Map(svgPlan?.sheets.flatMap(s=>s.frames).map(f=>[f.src,f]));
  const own=entries.filter(e=>e.theme===island.theme);
  // Landing retains its conservative props-only clamp. Detail sharpness is
  // compared with main's actual renderer, which also held raster ground.
  const main=mainArtPlan(own,{dpr,defaultZoom:.9});
  if(!legacyGround.has(island.theme))legacyGround.set(island.theme,await groundTiles(process.cwd(),island.theme==='bog'?'bog-arena':island.theme));
  const actualMain=mainArtPlan([...own,...legacyGround.get(island.theme).map(e=>({...e,mipmaps:false}))],{dpr,defaultZoom:.9});
  let expectedLimit=mainWalkingZoomCeiling();
  for(const p of entries.filter(e=>e.theme===island.theme&&e.width&&e.height)){
   const e=m[p.src],selected=e?.tiers.find(t=>urls.has(t.sheet??t.url));assert(selected,p.src);
   const ratio=Math.max((p.width+(p.bleed??0))/e.w,(p.height+(p.bleed??0))/e.h)*(p.scale??1);
   if(selected.scale+1e-8<(main.resolutions.get(p.src)??0)){
    expectedLimit=Math.min(expectedLimit,selected.scale/ratio/dpr);
    assert(selected.scale+1e-8>=ratio*tier.sharpZoom*dpr,`${p.src} is softer than main at the clamp`);
   }
   if(tier.rasterDetail){
    const high=svgFrames.get(p.src);
    assert(high,p.src);
    assert(high.scale+1e-8>=actualMain.resolutions.get(p.src),`${p.src} is softer than main's full island plan`);
   }else{
    const high=e.tiers.filter(t=>tier.detail.includes(t.sheet??t.url)).sort((a,b)=>b.scale-a.scale)[0];
    assert(high,p.src);
    assert(high.scale+1e-8>=ratio*tier.detailSharpZoom*dpr,`${p.src} stretches a texel after detail swap`);
   }
  }
  assert(Math.abs(tier.sharpZoom-expectedLimit)<1e-8,`${island.id} DPR ${dpr}: deepest main-equivalent landing limit`);
  t.diagnostic(`${island.id} DPR ${dpr}: zoom ${tier.zoom}, limit ${tier.sharpZoom}, landing ${tier.bytes}, detail ${tier.detailBytes}`);
 }
});


test('a released pending preparation cannot resurrect state or release an immediate fresh preparation',async()=>{
 const game=Object.create(PixiIsland.prototype);game.islandId='home';
 let finish,loads=0,releases=0;
 const load=()=>{loads++;return new Promise(resolve=>{finish=()=>resolve({tier:{sharpZoom:.5},release(){releases++;}});});};
 const stale=game.prepareIsland('home',load);
 game.releasePreparedSheets('home');
 const fresh=game.prepareIsland('home',load);
 assert.notEqual(stale,fresh);assert.equal(loads,1,'new acquisition waits for old retirement');
 finish();await stale;await flush();
 assert.equal(loads,2);assert.equal(game.detailStates?.has('home')??false,false);
 finish();const lease=await fresh;
 assert.equal(game.detailStates.get('home').lease,lease);
 const before=releases;await flush();assert.equal(releases,before,'old completion cannot release the new lease');
 game.releasePreparedSheets('home');await flush();assert.equal(releases,before+1);
});

test('lifting the loading clamp restores main zoom even beyond the detail texel limit',()=>{
 const state={live:false,lease:{tier:{sharpZoom:.5,detailSharpZoom:1}}};
 assert.equal(detailZoomLimit(state),.5);state.live=true;assert.equal(detailZoomLimit(state),1.8);
});


test('prefetch nearest order follows the actual sailing chart rather than globe anchors',async()=>{
 const idle=[],seen=[];
 const prefetch=createIslandPrefetch({islands:WORLD_ISLANDS,idle:fn=>idle.push(fn),
  distance:(a,b)=>{const p=offsetOf(a.id,b.id);return p.x*p.x+p.y*p.y;},
  getIndex:async()=>({}),selectTier:(_data,id)=>({webp:[id]}),fetchBytes:async url=>{seen.push(url);}});
 prefetch.resume('isle-251');
 while(idle.length){idle.shift()();await flush();}
 assert.deepEqual(new Set(seen.slice(0,3)),new Set(['blossom','isle-249','home']));
 assert(seen.indexOf('sunset')<seen.indexOf('isle-55'),'flat chart puts Rosybutton before Iceland from Pagepond');prefetch.destroy();
});

test('detail batches small sources within a frame and swaps per-piece frames atomically too',async()=>{
 const m=manifest();m['/a.svg'].tiers[1].sheet='/high-a.webp';
 const single=m['/b.svg'].tiers[1];delete single.sheet;single.url='/high-b.webp';
 const reads=[],closed=[];let frame=0;
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
  fetchBlob:async url=>{reads.push(url);return new Blob([url]);},
  decodeBitmap:async(blob,o)=>({width:o.resizeWidth??64,height:o.resizeHeight??32,close(){closed.push(1);}})});
 const a=await loader.load('/a.svg'),b=await loader.load('/b.svg'),old=a.source;
 const lease={manifest:m,landing:new Map(Object.entries(m).map(([src,e])=>[src,e.tiers[0]])),
  detail:new Map(Object.entries(m).map(([src,e])=>[src,e.tiers[1]])),activate(){},
  prepareDetail:()=>loader.prepareTiers(Object.values(m).map(e=>e.tiers[1]),{priority:'low'})};
 const uploads=[];
 assert(await swapIslandDetail(lease,{texture:{bindSource(){uploads.push(frame);}}},{loader,textures:new Set([a,b]),
  frame:async()=>{frame++;assert.equal(a.source,old);assert.equal(b.source,old);}}));
 assert.equal(new Set(uploads).size,1,'small GPU sources share one bounded upload turn');
 assert.deepEqual(reads,['/1.webp','/high-a.webp','/high-b.webp'],'oversized piece bytes are prefetched once');
 assert(old.destroyed);assert.equal(a.width,10);assert.equal(b.width,10);
 loader.unload(a);loader.unload(b);assert.equal(closed.length,3);
});


test('a wide landing stays in the walking view even when it is wider than the old fit floor',t=>{
 const prior=globalThis.document;globalThis.document={hidden:false};t.after(()=>globalThis.document=prior);
 const game=cameraGame({id:1,x:2000,y:2000,mode:'walking',islandId:'home'});
 game.minZoom=.3;game.camera.zoom=game.target.zoom=.12;
 game.archipelago={update(){}};
 game.detailStates=new Map([['home',{live:false,job:Promise.resolve(),lease:{tier:{zoom:.12,sharpZoom:.15,detailSharpZoom:1}}}]]);
 assert(game.zoomFloor()<.12);assert.equal(game.zoomCeiling(),.15);
 game.frameAt(16);assert.equal(game.birdEye,false);assert.equal(game.globeT,0);
});


test('all islands and DPRs regain the camera limit from main only after detail activates',()=>{
 for(const island of WORLD_ISLANDS)for(const dpr of [1,2,3]){
  const game=Object.create(PixiIsland.prototype);
  game.islandId=island.id;game.artShown=island.theme??island.id;
  game.app={renderer:{resolution:dpr}};
  const state={live:false,lease:{tier:{sharpZoom:.25,detailSharpZoom:.34}}};
  game.detailStates=new Map([[island.id,state]]);
  assert.equal(game.zoomCeiling(),.25,`${island.id} DPR ${dpr}: landing clamp`);
  state.live=true;
  assert.equal(game.zoomCeiling(),mainWalkingZoomCeiling(),`${island.id} DPR ${dpr}: main range`);
 }
});

test('aborting a background detail fetch frees its pins and foreground can immediately reacquire the sheet',async()=>{
 const m=manifest(),requests=[],decoded=[];
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
  fetchBlob:(url,{priority,signal}={})=>{
   requests.push({url,priority,signal});
   if(priority==='low')return new Promise((resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
   });
   return Promise.resolve(new Blob([url]));
  },decodeBitmap:async blob=>{decoded.push(await blob.text());return {width:64,height:32,close(){}};}});
 const prepare=createIslandPreparer({getIndex:async()=>({version:2,islands:{home:{2:{views:[{zoom:.39,sharpZoom:.5,bytes:1,webp:['/1.webp'],detail:['/2.webp']}]}}}}),getManifest:async()=>m,loader,dpr:()=>2});
 const lease=await prepare('home'),controller=new AbortController();
 const job=lease.prepareDetail({signal:controller.signal});
 await flush();assert.equal(requests.at(-1).priority,'low');
 controller.abort();
 // Reacquire before the old rejection handlers have had their turn.
 const foreground=loader.prepareTiers([m['/a.svg'].tiers[1]],{priority:'high'});
 await assert.rejects(job,{name:'AbortError'});
 const release=await foreground;
 assert.deepEqual(requests.map(r=>[r.url,r.priority]),[['/1.webp','high'],['/2.webp','low'],['/2.webp','high']]);
 assert.deepEqual(decoded,['/1.webp','/2.webp']);
 release();lease.release();
});

test('a voyage cancels detail and prefetch before destination preparation, including a cached destination',async()=>{
 const game=Object.create(PixiIsland.prototype),events=[],controller=new AbortController();
 game.islandId='home';game.detailStates=new Map([['home',{controller,live:false}]]);
 game.islandPrefetch={pause(){events.push('pause');}};
 controller.signal.addEventListener('abort',()=>events.push('abort'));
 const destination=WORLD_ISLANDS.find(i=>i.id!=='home').id;
 const job=game.prepareIsland(destination,async()=>{
  assert(controller.signal.aborted);events.push('destination');return {release(){}};
 });
 await job;assert.deepEqual(events,['pause','abort','destination']);
 // Even a cached destination must stop newly restarted outgoing detail.
 const second=new AbortController();game.detailStates.set('home',{controller:second});
 game.pauseIslandBackground();assert(second.signal.aborted);
 game.releasePreparedSheets();
});


test('landing clamp uses the main-equivalent limit for the selected viewport',()=>{
 const views=[{zoom:.26,sharpZoom:.3,limits:[1.8,.6],bytes:1,webp:['/low'],detail:['/low']},
  {zoom:.9,sharpZoom:1,limits:[1.8,1.8],bytes:6*1048576,webp:['/high'],detail:['/high']}];
 const data={version:2,islands:{home:{2:{views}}}};
 assert.equal(selectIslandTier(data,'home',2,1440,900).sharpZoom,.6);
 assert.equal(selectIslandTier(data,'home',2,390,844).sharpZoom,1.8,'matching main tier can stretch as main does');
});

test('cancelling an oversized piece does not start an SVG fallback request',async()=>{
 const m=manifest();for(const e of Object.values(m))delete e.tiers[1].sheet;
 const calls=[],controller=new AbortController();let started;
 const pending=new Promise(resolve=>{started=resolve;});
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
  fetchBlob:async(url,{signal}={})=>{
   calls.push(url);
   if(url==='/0-2.webp'){
    started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
   }
   return new Blob([url]);
  },decodeBitmap:async()=>({width:64,height:32,close(){}})});
 const a=await loader.load('/a.svg'),old=a.source;
 const lease={manifest:m,landing:new Map([['/a.svg',m['/a.svg'].tiers[0]]]),detail:new Map([['/a.svg',m['/a.svg'].tiers[1]]]),
  prepareDetail:options=>loader.prepareTiers([m['/a.svg'].tiers[1]],{priority:'low',...options}),activate(){assert.fail('aborted detail cannot activate');}};
 const job=swapIslandDetail(lease,{}, {signal:controller.signal,cancelled:()=>controller.signal.aborted,
  loader,textures:new Set([a]),frame:async()=>{}});
 await pending;await flush();controller.abort();
 try{assert.equal(await job,false);}catch(error){assert.equal(error.name,'AbortError');}
 assert.equal(a.source,old);assert.deepEqual(calls,['/1.webp','/0-2.webp']);loader.unload(a);
});

test('SVG detail transfers packed sheets, preserves texture identity, and frees both generations',async()=>{
 const m=manifest(),downloads=[],closed=[];
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
  fetchBlob:async url=>{downloads.push(url);return new Blob();},
  decodeBitmap:async()=>({width:64,height:32,close(){closed.push('landing');}})});
 const prepare=createIslandPreparer({getIndex:async()=>({version:2,islands:{home:{2:{views:[{
  zoom:.39,sharpZoom:.5,bytes:1,webp:['/1.webp'],detail:[],rasterDetail:{url:'/svg-bundle',plan:'/plan'},
 }]}}}}),getManifest:async()=>m,loader,dpr:()=>2,
 renderDetail:async()=>({sheets:[{width:64,height:32,ground:false,frames:['/a.svg','/b.svg'].map((src,i)=>({
  src,w:10,h:10,scale:2,padding:0,x:2+i*24,y:2,f:{x:0,y:0,width:20,height:20},
 }))}],bitmaps:[{width:64,height:32,close(){closed.push('detail');}}]})});
 const lease=await prepare('home'),a=await loader.load('/a.svg'),b=await loader.load('/b.svg'),old=a.source;
 assert(await swapIslandDetail(lease,{}, {loader,textures:new Set([a,b]),frame:async()=>{},upload:async()=>{}}));
 assert.notEqual(a.source,old);assert.equal(a.source,b.source);assert.equal(a.width,10);assert.equal(a.frame.width,20);
 assert.deepEqual(downloads,['/1.webp'],'no detail WebP or tile SVG requests');
 lease.releaseLanding();assert(old.destroyed);loader.unload(a);loader.unload(b);lease.release();
 assert.deepEqual(closed,['landing','detail']);
});

test('releasing an island during SVG generation disposes the returned bitmaps without reviving its lease',async()=>{
 const m=manifest();let finish,closed=0;
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,fetchBlob:async()=>new Blob(),
  decodeBitmap:async()=>({width:64,height:32,close(){closed++;}})});
 const prepare=createIslandPreparer({getIndex:async()=>({version:2,islands:{home:{2:{views:[{
  zoom:.39,sharpZoom:.5,bytes:1,webp:['/1.webp'],detail:[],rasterDetail:{url:'/bundle',plan:'/plan'},
 }]}}}}),getManifest:async()=>m,loader,dpr:()=>2,renderDetail:()=>new Promise(resolve=>{finish=resolve;})});
 const lease=await prepare('home'),job=lease.prepareDetail();
 lease.release();finish({sheets:[],bitmaps:[{close(){closed++;}}]});
 await assert.rejects(job,/released/);assert.equal(closed,2);assert.equal(activeIslandTiers.has(m),false);
});
