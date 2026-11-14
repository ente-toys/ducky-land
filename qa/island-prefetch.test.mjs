import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import sharp from 'sharp';
import {buildIslandIndex,packArtSheets} from '../scripts/vite-prerender-art.mjs';
import {createWholeSVGLoader,createIslandPreparer} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {plannedSheetTiers,pinnedSheetTiers,planIslandSheets} from '../src/rendering/pixi/art/island-budget.js';
import {uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';

const piece=(sheet,group='home/props/0')=>({w:8,h:8,padding:0,tiers:[{scale:1,url:'/piece.webp',sheet,group,x:2,y:2,width:8,height:8,frameWidth:8,frameHeight:8,sheetWidth:16,sheetHeight:16}]});
const m={'/a.svg':piece('/a.webp'),'/b.svg':piece('/b.webp')};

test('preparation issues all sheet requests before any decode finishes and dedupes frames',async()=>{
 const fetched=[],finish=[];let decoded=0;
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
  fetchBlob:async url=>{fetched.push(url);return new Blob();},
  decodeBitmap:()=>{decoded++;return new Promise(resolve=>finish.push(()=>resolve({width:16,height:16,close(){}})));}});
 const preparing=loader.prepareTiers(Object.values(m).map(e=>({...e,...e.tiers[0]})));
 while(finish.length<2)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(fetched,['/a.webp','/b.webp']);assert.equal(decoded,2);
 finish.forEach(f=>f());const release=await preparing;
 const a=await loader.load('/a.svg'),b=await loader.load('/b.svg');assert.equal(decoded,2);
 release();loader.unload(a);loader.unload(b);
});

test('ready sheets upload in a single budgeted frame',async()=>{
 const fetched=[];const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,
 fetchBlob:async url=>{fetched.push(url);return new Blob([url]);},decodeBitmap:async blob=>{return {width:16,height:16,close(){}};}});
 const a=await loader.load('/a.svg'),b=await loader.load('/b.svg');
 assert.deepEqual(fetched,['/a.webp','/b.webp']);
 let frame=0;const uploads=[];
 await uploadIsland({texture:{bindSource(){uploads.push(frame);}}},[],{sources:[a.source,b.source],yieldFrame:async()=>{frame++;}});
 assert.deepEqual(uploads,[1,1]);loader.unload(a);loader.unload(b);
});

test('pinned plans keep exactly one tier, including early callers with default resolutions',()=>{
 const manifest=structuredClone(m);for(const e of Object.values(manifest))e.tiers.push({...e.tiers[0],scale:2,sheet:'/high.webp',group:'home/props/1'});
 const selected=new Map(Object.keys(manifest).map(src=>[src,manifest[src].tiers[1]]));
 pinnedSheetTiers.set(manifest,selected);plannedSheetTiers.set(manifest,selected);
 const plan=planIslandSheets({resolutions:new Map([['/a.svg',1],['/b.svg',1]]),budget:Infinity},manifest);
 assert.deepEqual([...plan.resolutions.values()],[2,2]);assert.equal(plan.sheetCount,1);
});

test('sheet encoders use lossy props, exact ground pixels, with no extra codec',async()=>{
 const bytes=await sharp('public/pixi-art/water-texture.svg').resize(40,40).webp({lossless:true}).toBuffer();
 const sample=()=>[{src:'/fixture.svg',entry:{w:40,h:40,padding:0},tier:{scale:1,width:40,height:40},bytes}];
 const [ground]=await packArtSheets(sample(),2048,{lossless:true});
 const [prop]=await packArtSheets(sample(),2048,{lossless:false});
 assert(ground.lossless);assert.equal(prop.lossless,false);
 assert(ground.bytes.includes(Buffer.from('VP8L')));assert(prop.bytes.includes(Buffer.from('VP8 ')));
 const original=await sharp(bytes).ensureAlpha().raw().toBuffer();
 const extracted=await sharp(ground.bytes).extract({left:2,top:2,width:40,height:40}).ensureAlpha().raw().toBuffer();
 assert.deepEqual(extracted,original);

});

test('island index maps actual island ids and all DPRs to one sheet tier and a JS entry',()=>{
 const entries=[{src:'/a.svg',theme:'pink',resolution:1},{src:'/b.svg',theme:'startup',resolution:1}];
 Object.defineProperty(entries,'islands',{value:[{id:'sunset',theme:'pink'}]});
 const index=buildIslandIndex(entries,m,'/assets/main-hash.js');assert.equal(index.entry,'/assets/main-hash.js');
 for(const dpr of [1,2,3]){const tier=index.islands.sunset[dpr];assert.deepEqual(tier.webp,['/a.webp','/b.webp']);}
});

test('standalone prefetcher has no imports, is below 2 KB minified, uses low priority and awaits bodies',async t=>{
 const source=await readFile('src/app/ducky-prefetch.js','utf8');
 assert(!/^import\s/m.test(source));const min=await transform(source,{minify:true,format:'esm'});assert(Buffer.byteLength(min.code)<2048);
 const saved=Object.fromEntries(['fetch','document','createImageBitmap','devicePixelRatio'].map(k=>[k,globalThis[k]]));
 t.after(()=>{for(const [k,v]of Object.entries(saved))if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
 for(const support of [false,true]){
  const requests=[],links=[],readers=[];globalThis.devicePixelRatio=support?3:1;
  globalThis.document={querySelector:()=>null,createElement:()=>({}),head:{appendChild:link=>links.push(link)}};

  const index={entry:'/main.js',islands:{home:{1:{webp:['/1.webp']},2:{webp:['/2.webp']},3:{webp:['/3.webp']}}}};
  globalThis.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.endsWith('islands.json')?{url:'/hashed.json'}:index,arrayBuffer:()=>new Promise(resolve=>readers.push(resolve))};};
  const {duckyPrefetch}=await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+support).toString('base64'));
  let done=false;const ready=duckyPrefetch('home').then(()=>{done=true;});assert.equal(duckyPrefetch('home'),duckyPrefetch('home'));
  while(!readers.length)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(done,false);assert.equal(requests.at(-1).url,support?'/2.webp':'/1.webp');assert.deepEqual(requests.at(-1).options,{priority:'low'});
  assert.equal(requests[0].options.cache,'no-cache');assert.equal(links[0].rel,'modulepreload');assert.equal(links[0].href,'/main.js');
  readers.forEach(resolve=>resolve(new ArrayBuffer(0)));await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false,'JS bytes are still pending');links[0].onload();await ready;assert(done);
  await assert.rejects(duckyPrefetch('missing'),/Unknown island/);
 }
});

test('built pointer, cache headers, index and main entry resolve to emitted files',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('run after production build with ART_MANIFEST');
 const {url}=JSON.parse(await readFile('dist/art-prerender/islands.json'));
 assert.match(url,/\/islands-[a-f0-9]+\.json$/);
 const index=JSON.parse(await readFile('dist'+url));await readFile('dist'+index.entry);
 assert.match(await readFile('dist/_headers','utf8'),/\/art-prerender\/islands.json\n  ! Cache-Control\n  Cache-Control: no-cache/);
 for(const [id,tiers]of Object.entries(index.islands))for(const dpr of [1,2,3])for(const type of ['webp']){
  assert(tiers[dpr][type].length,`${id} DPR ${dpr}`);
  await Promise.all(tiers[dpr][type].map(url=>readFile('dist'+url)));
 }
});


test('public preparation dedupes, pins its selected tier and can retry after release or failure',async()=>{
 let loads=0,releases=0;
 const prepare=createIslandPreparer({getIndex:async()=>({islands:{home:{2:{webp:['/a.webp']}}}}),getManifest:async()=>m,dpr:()=>2,
  loader:{async prepareTiers(tiers){loads++;assert.equal(tiers[0].sheet,'/a.webp');return ()=>releases++;}}});
 const a=prepare('home');assert.equal(prepare('home'),a);const lease=await a;
 assert.equal(loads,1);lease.release();lease.release();assert.equal(releases,1);
 await prepare('home');assert.equal(loads,2);
 await assert.rejects(prepare('missing'),/Unknown island/);
 await assert.rejects(prepare('missing'),/Unknown island/);
});


test('build packs the startup duck, sleep, wardrobe and boat sources with no more than ten SVG fallbacks',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('run after production build with ART_MANIFEST');
 const manifest=JSON.parse(await readFile(process.env.ART_MANIFEST));
 const duck=JSON.parse(await readFile('public/pixi-duck/manifest.json'));
 const sleep=JSON.parse(await readFile('src/world/home/sleep-poses.json'));
 const boat=JSON.parse(await readFile('public/pixi-art/boat/views.json'));
 const urls=new Set(['/pixi-art/karma/golden-feather.svg',...duck.views.flatMap(v=>v.parts.map(p=>p.url)),
  '/pixi-duck/sleep/z.svg',...Object.values(sleep.poses).flatMap(p=>p.layers.map(l=>l.src)),
  ...Object.values(boat.views).flatMap(v=>[v.file,v.front,v.rigFront].filter(Boolean).map(f=>'/pixi-art/boat/'+f))]);
 let fallback=0;for(const url of urls)if(!manifest[url]?.tiers.some(t=>t.sheet))fallback++;
 assert(fallback<=10,`${fallback} unpacked startup SVGs`);
 for(const v of duck.views){const body=v.parts.find(p=>p.role==='body');if(body)assert(manifest[body.url].svgText,'morph data must not fetch body SVGs');}
});

test('intro and renderer select the same viewport tier without loading desktop sheets on phones',async()=>{
 const {selectIslandTier}=await import('../src/app/ducky-prefetch.js');
 const index={islands:{home:{2:{manifest:'/home.json',webp:['/default.webp'],views:[{zoom:.39,webp:['/phone.webp']},{zoom:.9,webp:['/desktop.webp']},{zoom:1.8,webp:['/large.webp']}]}}}};
 assert.deepEqual(selectIslandTier(index,'home',2,390,844).webp,['/phone.webp']);
 const desktop=selectIslandTier(index,'home',2,1440,900);
 assert.deepEqual(desktop.webp,['/desktop.webp']);assert.equal(desktop.manifest,'/home.json');
 assert.deepEqual(selectIslandTier(index,'home',2).webp,['/desktop.webp']);
});

test('deferred globe previews never enter an island startup sheet plan',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires the production manifest');
 const m=JSON.parse(await readFile(process.env.ART_MANIFEST));
 const pointer=JSON.parse(await readFile('dist/art-prerender/islands.json'));
 const index=JSON.parse(await readFile('dist'+pointer.url));
 const world=new Set(Object.entries(m).filter(([src])=>src.startsWith('/pixi-art/globe/')).flatMap(([,e])=>e.tiers.map(t=>t.sheet??t.url)));
 for(const tiers of Object.values(index.islands))for(const tier of Object.values(tiers))for(const view of tier.views)
  assert(view.webp.every(url=>!world.has(url)),'globe-only sheets remain demand loaded');
});

test('landing preparation waits for mesh bodies and retries a failed mesh before returning a lease',async()=>{
 let finish,requests=0,sheets=0;
 const index={version:2,islands:{home:{2:{ground:['/mesh.bin'],views:[{zoom:.65,sharpZoom:1.8,bytes:1,webp:['/a.webp']}]}}}};
 const prepare=createIslandPreparer({getIndex:async()=>index,getManifest:async()=>m,dpr:()=>2,
  fetchGround:async url=>{assert.equal(url,'/mesh.bin');if(++requests===1)throw Error('mesh offline');await new Promise(resolve=>{finish=resolve;});},
  loader:{prepareTiers:async()=>{sheets++;return ()=>{};}}});
 await assert.rejects(prepare('home'),/mesh offline/);assert.equal(sheets,1);
 let ready=false;const pending=prepare('home').then(lease=>{ready=true;return lease;});
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(ready,false);finish();const lease=await pending;assert.equal(requests,2);assert.equal(sheets,2);lease.release();
});
