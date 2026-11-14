import {uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';
// Exercise the real upload scheduler with a fake clock and 2 GiB/s uploads.
// Network bodies share one link; decoding/construction allowances are explicit.
async function expectedDetailDelivery(sheets,bytes,decodeMs=300){
 let now=0,frames=0,uploadMs=0;
 await uploadIsland({texture:{bindSource(source){const ms=source.pixelWidth*source.pixelHeight*4/(2*1048576);now+=ms;uploadMs+=ms;}}},[],{
  sources:sheets.map(s=>({pixelWidth:s.width,pixelHeight:s.height})),
  batchSize:32,batchBytes:8*1048576,frameBudgetMs:4,now:()=>now,
  yieldFrame:async()=>{frames++;now+=1000/60;},
 });
 const pieces=sheets.reduce((n,s)=>n+s.frames.length,0);
 const constructionFrames=Math.floor((sheets.length-1)/128)+Math.floor((pieces-1)/128);
 const cpu=decodeMs/1000+.2+(frames+constructionFrames)/60+uploadMs/1000;
 return {local:bytes/125000000+.005+cpu,cell:bytes/2500000+.08+cpu,uploadFrames:frames,constructionFrames};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,unlink,readFile,stat} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {Assets,Texture} from 'pixi.js';
import {loadRasterDetail} from '../src/rendering/pixi/art/raster-detail.js';
import {loadGroundMesh} from '../src/rendering/pixi/art/ground-mesh.js';
import {selectIslandTier} from '../src/app/ducky-prefetch.js';

test('raster detail starts every sheet at high priority and disposes partial failures',async()=>{
 const calls=[],closed=[];
 const spec={plan:'/plan',raster:['/a','/b']};
 await assert.rejects(loadRasterDetail(spec,{fetcher:async(url,options)=>{
  calls.push([url,options.priority]);
  if(url==='/plan')return {ok:true,json:async()=>({sheets:[{},{}]})};
  if(url==='/b')return {ok:false,status:404};
  return {ok:true,blob:async()=>new Blob()};
 },decode:async()=>({close(){closed.push(1);}})}),/404/);
 assert.deepEqual(calls,[['/plan','high'],['/a','high'],['/b','high']]);assert.equal(closed.length,1);
});

test('explicit or host-decoded ground gzip preserves all bytes delivered to the mesh parser',async()=>{
 const original=Buffer.from('same geometry and colours'),packed=gzipSync(original);
 for(const body of [packed,original])await loadGroundMesh({url:'/ground.bin.gz',compression:'gzip'},{fetcher:async()=>new Response(body),parse:async buffer=>{
  assert.deepEqual(Buffer.from(buffer),original);return {chunks:[]};
 }});
});

test('boat frame cache misses emit no Pixi missing-asset warnings',async t=>{
 const warnings=[],prior=console.warn;console.warn=(...args)=>warnings.push(args);t.after(()=>console.warn=prior);
 const oldFetch=globalThis.fetch,oldLoad=Assets.load;
 const file=new URL('./.boat-detail-smoke.mjs',import.meta.url),loaded=[];
 t.after(async()=>{globalThis.fetch=oldFetch;Assets.load=oldLoad;await unlink(file).catch(()=>{});for(const src of loaded)Assets.cache.remove(src);});
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(await readFile('public'+url))});
 Assets.load=async input=>{const src=typeof input==='string'?input:input.src;assert((await stat('public'+src.split('?')[0])).size>0);loaded.push(src);Assets.cache.set(src,Texture.EMPTY);return Texture.EMPTY;};
 const compiled=await build({stdin:{resolveDir:process.cwd(),contents:"export {prepareBoatViews} from './src/rendering/pixi/boat-views.js'"},bundle:true,platform:'node',format:'esm',packages:'external',write:false,plugins:[{name:'manifest-fixture',setup(b){
  b.onResolve({filter:/whole-svg-loader\.js$/},()=>({path:'fixture',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:"export const loadPrerenderManifest=async files=>Object.fromEntries(files.map(src=>[src,{tiers:[{sheet:'/fixture.webp'}]}]));",loader:'js'}));
 }}]});
 await writeFile(file,compiled.outputFiles[0].text);
 const {prepareBoatViews}=await import(file.href);
 const bank=await prepareBoatViews(null);assert.equal(bank.views.length,48);assert(loaded.length>=96);
 assert.deepEqual(warnings,[]);
});

test('built landing and simulated detail delivery meet byte, sharpness and time budgets',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires production build');
 const pointer=JSON.parse(await readFile('dist/art-prerender/islands.json')),index=JSON.parse(await readFile('dist'+pointer.url));
 for(const id of Object.keys(index.islands)){
  const tier=selectIslandTier(index,id,2,1440,900),spec=tier.rasterDetail;
  assert(tier.bytes<=5500000,`${id}: ${tier.bytes} landing bytes`);
  assert(tier.sharpZoom>=tier.zoom*2-1e-8,`${id}: initial sharp range`);
  assert.equal(spec.kind,'webp');assert(!spec.overBudget);
  const plan=JSON.parse(await readFile('dist'+spec.plan)),rasters=spec.raster??plan.raster;
  const bytes=(await Promise.all([...rasters,spec.plan].map(async url=>(await stat('dist'+url)).size))).reduce((a,b)=>a+b,0);
  if(spec.rasterPack){
   assert.equal(spec.raster,undefined,'individual frame URLs stay out of the startup index');
   const body=await readFile('dist'+spec.rasterPack.url);let end=0;
   for(const [offset,length]of spec.rasterPack.ranges){assert.equal(offset,end);assert.equal(body.toString('ascii',offset,offset+4),'RIFF');assert.equal(body.toString('ascii',offset+8,offset+12),'WEBP');end+=length;}
   assert.equal(end,body.length);assert.equal(body.length,bytes-(await stat('dist'+spec.plan)).size);
  }
  const {local,cell}=await expectedDetailDelivery(plan.sheets,bytes);
  assert(local<=1.5,`${id}: local ${local}`);assert(cell<=5,`${id}: 4G ${cell}`);
  t.diagnostic(`${id}: landing ${tier.bytes}, detail ${bytes}, expected local ${local.toFixed(2)}s, 4G ${cell.toFixed(2)}s`);
 }
});

test('opaque legacy Bog tiles use quality 90 and remain close to main pixels; transparency stays lossless',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires production build');
 const {default:sharp}=await import('sharp'),manifest=JSON.parse(await readFile(process.env.ART_MANIFEST));
 let opaque=0,transparent=0,total=0,samples=0,worst=0;
 for(const [src,e]of Object.entries(manifest).filter(([src])=>src.endsWith('.png'))){
  const original=await readFile('public'+src),isOpaque=(await sharp(original).stats()).isOpaque;
  const tier=e.tiers.find(t=>t.scale>=1)??e.tiers.at(-1);
  if(!isOpaque){transparent++;assert(tier.sourceLossless,src);continue;}
  opaque++;assert.equal(tier.sourceQuality,90,src);assert.equal(tier.sourceLossless,false,src);
  const expected=await sharp(original).resize(tier.width,tier.height,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  assert.equal(tier.lossless,false);assert.equal(tier.sheetQuality,90);
  const actual=await sharp(await readFile('dist'+tier.sheet)).extract({left:tier.x+e.padding-tier.offsetX,top:tier.y+e.padding-tier.offsetY,width:tier.width,height:tier.height}).ensureAlpha().raw().toBuffer();
  let error=0;
  for(let i=0;i<expected.length;i+=4){assert.equal(actual[i+3],255);for(let c=0;c<3;c++)error+=Math.abs(expected[i+c]-actual[i+c]);}
  const mean=error/(expected.length/4*3);worst=Math.max(worst,mean);total+=error;samples+=expected.length/4*3;
 }
 assert.equal(opaque,47);assert.equal(transparent,34);assert(total/samples<3);assert(worst<6);
 t.diagnostic(`47 opaque, 34 transparent; RGB mean ${(total/samples).toFixed(3)}, worst tile ${worst.toFixed(3)} /255`);
});

test('cancelling raster detail during decode closes the late bitmap',async()=>{
 const controller=new AbortController();let finish,closed=0;
 const job=loadRasterDetail({plan:'/plan',raster:['/sheet']},{signal:controller.signal,
  fetcher:async url=>url==='/plan'?{ok:true,json:async()=>({sheets:[{}]})}:{ok:true,blob:async()=>new Blob()},
  decode:()=>new Promise(resolve=>{finish=resolve;})});
 await new Promise(resolve=>setImmediate(resolve));controller.abort();finish({close(){closed++;}});
 await assert.rejects(job,{name:'AbortError'});assert.equal(closed,1);
});

test('packed detail downloads one body and decodes each indexed WebP frame',async()=>{
 const calls=[],decoded=[];
 const result=await loadRasterDetail({plan:'/plan',rasterPack:{url:'/pack',ranges:[[0,3],[3,4]]}},{
  fetcher:async(url,options)=>{calls.push([url,options.priority]);if(url==='/plan')return {ok:true,json:async()=>({sheets:[{},{}]})};assert.equal(url,'/pack');return new Response('oneTWO!');},
  decode:async blob=>{decoded.push(await blob.text());return {close(){}};},
 });
 assert.deepEqual(calls,[['/plan','high'],['/pack','high']]);assert.deepEqual(decoded,['one','TWO!']);assert.equal(result.bitmaps.length,2);
});
