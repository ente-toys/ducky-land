import {uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';
import {sliceCentreTexture} from '../src/rendering/pixi/environment/centre-motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {packArtSheets,collectPlacedArt} from '../scripts/vite-prerender-art.mjs';
import {createWholeSVGLoader,selectPrerenderTier} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {planIslandSheets,planIslandArt} from '../src/rendering/pixi/art/island-budget.js';

test('real art sheets preserve decoded pixels exactly and extrude two texels',async()=>{
 const entries=(await collectPlacedArt(process.cwd())).filter(e=>e.src.endsWith('.svg'));
 const pieces=[];
 const samples=[...entries.filter(e=>e.mipmaps===false).slice(0,2),...entries.filter(e=>e.mipmaps!==false).slice(0,2)];
 for(const e of samples){
  const src=e.src,padding=e.mipmaps===false?2:0;
  const {width:w,height:h}=await sharp('public'+src).metadata();
  const width=Math.min(w,128),height=Math.ceil(h*width/w),scale=width/w;
  let image=sharp('public'+src).resize(width,height);
  if(padding)image=image.extend({top:padding,bottom:padding,left:padding,right:padding,extendWith:'copy'});
  const bytes=await image.webp({quality:92,lossless:padding>0}).toBuffer();
  pieces.push({src,entry:{w,h,padding},tier:{scale,width,height},bytes});
 }
 const sheets=await packArtSheets(pieces);
 for(const s of sheets){assert(s.width<=4096&&s.height<=4096);
  for(const f of s.frames){
   const extracted=await sharp(s.bytes).extract({left:f.x,top:f.y,width:f.width,height:f.height}).ensureAlpha().raw().toBuffer();
   const original=await sharp(f.piece.bytes).extract({left:f.offsetX,top:f.offsetY,width:f.width,height:f.height}).ensureAlpha().raw().toBuffer();
   // Lossless encoders can preserve different invisible RGB under alpha zero.
   for(const pixels of [original,extracted])for(let i=0;i<pixels.length;i+=4)if(!pixels[i+3])pixels.fill(0,i,i+3);
   assert.equal(extracted.equals(original),true,'decoded frame pixels match');
   const edge=await sharp(s.bytes).extract({left:f.x-2,top:f.y,width:3,height:f.height}).ensureAlpha().raw().toBuffer();
   for(let y=0;y<f.height;y++)assert.deepEqual(edge.subarray(y*12,y*12+4),edge.subarray(y*12+8,y*12+12));
  }
 }
});
const entry=(x)=>({w:10,h:10,padding:0,tiers:[{scale:1,url:'/piece.webp',sheet:'/sheet.webp',x,y:2,width:10,height:10,frameWidth:10,frameHeight:10,offsetX:0,offsetY:0,sheetWidth:64,sheetHeight:32,group:'home/props/0'}]});
const manifest={'/a.svg':entry(2),'/b.svg':entry(16)};
test('concurrent frames decode once, share GPU source, and free it on final release',async()=>{
 let reads=0,decodes=0,closed=0;
 const loader=createWholeSVGLoader({getManifest:async()=>manifest,canDecodeBitmap:()=>true,
 fetchBlob:async()=>{reads++;return new Blob();},decodeBitmap:async()=>{decodes++;return {width:64,height:32,close(){closed++;}};}});
 const [a,b]=await Promise.all(['/a.svg','/b.svg'].map(src=>loader.load(src,{data:{resolution:1,autoGenerateMipmaps:true}})));
 assert.equal(reads,1);assert.equal(decodes,1);assert.equal(a.source,b.source);assert.equal(a.source.autoGenerateMipmaps,true);
 let uploads=0;await uploadIsland({texture:{bindSource(){uploads++;}}},[{children:[{texture:a},{texture:b}]}],{yieldFrame:async()=>{}});
 assert.equal(uploads,1,'one upload for the shared sheet');
 assert.equal(a.frame.x,2);assert.equal(b.frame.x,16);assert.equal(a.width,10);
 const source=a.source;loader.unload(a);assert(!source.destroyed);assert.equal(closed,0);
 loader.unload(b);assert(source.destroyed);assert.equal(closed,1);
 const c=await loader.load('/a.svg');assert.equal(reads,2);loader.unload(c);
});
test('sharpness wins over the sheet memory target for the entire group',()=>{
 const m=structuredClone(manifest);
 for(const e of Object.values(m))e.tiers.push({...e.tiers[0],scale:2,sheet:'/high.webp',sheetWidth:128,sheetHeight:64,group:'home/props/1'});
 const plan=planIslandSheets({resolutions:new Map([['/a.svg',2],['/b.svg',1]]),budget:64*32*4*4/3},m);
 assert.deepEqual([...plan.resolutions.values()],[2,2]);assert.equal(plan.overBudget,true);
 const degraded=planIslandSheets({...plan,budget:1},m);assert(degraded.overBudget);
});
test('build manifest covers all placed art with bounded sheets without density degradation',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('run with ART_MANIFEST after production build');
 const m=JSON.parse(await readFile(process.env.ART_MANIFEST)),entries=await collectPlacedArt(process.cwd());
 for(const p of entries.filter(e=>e.src.endsWith('.svg'))){
  const e=m[p.src];assert(e, p.src);
  assert(e.tiers.some(f=>f.sheet),p.src);
  for(const f of e.tiers){if(f.atlasFallback==='oversized'){assert(f.width+4>4096||f.height+4>4096);continue;}assert(f.sheet,p.src);assert(f.gutter>=2);assert(f.sheetWidth<=4096&&f.sheetHeight<=4096);assert(f.x>=2&&f.y>=2);}
 }
 for(const theme of ['home','sunflower','pink','library','community','bog','snow'])for(const dpr of [1,2,3]){
  const placed=entries.filter(e=>e.theme===theme||!e.theme||e.theme==='shared');
  const plan=planIslandSheets(planIslandArt(placed,{dpr}),m);
  const sheets=new Set([...plan.resolutions].map(([src,r])=>selectPrerenderTier(m,src,r)?.sheet).filter(Boolean));
  t.diagnostic(`${theme} DPR ${dpr}: ${sheets.size} sheets, planned ${plan.sheetCount}, ${(plan.bytes/1048576).toFixed(1)} MiB`);assert(sheets.size>0);
 }
});

test('a broken sheet falls back to its existing piece WebP',async()=>{
 const fetched=[];
 const loader=createWholeSVGLoader({getManifest:async()=>manifest,canDecodeBitmap:()=>true,
 fetchBlob:async url=>{fetched.push(url);if(url==='/sheet.webp')throw Error('offline');return new Blob();},
 decodeBitmap:async(_blob,o)=>({width:o.resizeWidth,height:o.resizeHeight,close(){}})});
 const texture=await loader.load('/a.svg');
 assert.deepEqual(fetched,['/sheet.webp','/piece.webp']);assert.equal(texture.width,10);loader.unload(texture);
});

test('sheet geometry preserves native trim and ground padding at fractional density',async()=>{
 const m={'/ground.svg':{w:20,h:10,padding:2,tiers:[{scale:.5,width:10,height:5,url:'/piece.webp',sheet:'/sheet.webp',
 x:2,y:2,frameWidth:14,frameHeight:9,offsetX:0,offsetY:0}]}};
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,fetchBlob:async()=>new Blob(),
 decodeBitmap:async()=>({width:32,height:32,close(){}})});
 const texture=await loader.load('/ground.svg',{data:{resolution:.5,groundPadding:2,autoGenerateMipmaps:false}});
 assert.deepEqual([texture.width,texture.height],[28,18]);
 assert.deepEqual([texture.groundPadding.padX,texture.groundPadding.padY,texture.groundPadding.width,texture.groundPadding.height],[4,4,20,10]);
 assert.equal(texture.source.autoGenerateMipmaps,false);loader.unload(texture);
});

test('equal capped scales still follow the tier selected for their sheet group',()=>{
 const m=structuredClone(manifest);
 for(const e of Object.values(m))e.tiers.push({...e.tiers[0],scale:2,sheet:'/high.webp',sheetWidth:128,sheetHeight:64,group:'home/props/1'});
 m['/a.svg'].tiers[1].scale=1;
 const plan=planIslandSheets({resolutions:new Map([['/a.svg',1],['/b.svg',2]]),budget:Infinity},m);
 // The capped piece must not accidentally select its low-group sheet.
 assert.equal(selectPrerenderTier(m,'/a.svg',plan.resolutions.get('/a.svg')).sheet,'/high.webp');
});

test('centre dancer slices keep their authored size when a sheet uses a different density',async()=>{
 const m={'/dancer.svg':{w:20,h:40,padding:0,tiers:[{scale:2,width:40,height:80,url:'/piece.webp',sheet:'/sheet.webp',x:2,y:2,frameWidth:40,frameHeight:80,offsetX:0,offsetY:0}]}};
 const loader=createWholeSVGLoader({getManifest:async()=>m,canDecodeBitmap:()=>true,fetchBlob:async()=>new Blob(),
 decodeBitmap:async()=>({width:128,height:128,close(){}})});
 const texture=await loader.load('/dancer.svg',{data:{resolution:2}}),view=sliceCentreTexture(texture,.75,.25);
 assert.deepEqual([view.width,view.height],[20,10]);assert.deepEqual([view.frame.x,view.frame.y,view.frame.width,view.frame.height],[2,62,40,20]);
 view.destroy();loader.unload(texture);
});

test('placement collection is repeatable without changing island ownership',async()=>{
 const a=await collectPlacedArt(process.cwd()),b=await collectPlacedArt(process.cwd());
 assert.notEqual(a,b);assert.deepEqual(a,b);
});
