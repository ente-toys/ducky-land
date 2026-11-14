import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {Path2D,createCanvas} from '@napi-rs/canvas';
import {compile,rectClip} from '../scripts/ground-mesh/svg.mjs';
import {inline} from '../scripts/globe-svg/vector.mjs';
import {rgba,triangulate} from '../scripts/ground-mesh/tessellate.mjs';
import {homeWaterMask} from '../scripts/ground-mesh/water-mask.mjs';
import {ISLANDS,buildGround,encodeGroundMesh,groundTiles} from '../scripts/ground-mesh/build.mjs';
import {decodeGroundMesh} from '../src/rendering/pixi/art/ground-mesh-codec.js';
import {splitGroundMesh} from '../src/rendering/pixi/art/ground-mesh-worker.js';
import {createMeshGroundStream,groundMeshEnabled} from '../src/rendering/pixi/art/ground-mesh.js';
import {Container,DOMAdapter,ImageSource,Texture} from 'pixi.js';
import {build} from 'esbuild';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {gunzipSync} from 'node:zlib';
import {readFile,stat} from 'node:fs/promises';
import {collectPlacedArt} from '../scripts/vite-prerender-art.mjs';
import {selectIslandTier} from '../src/app/ducky-prefetch.js';
import {createIslandPrefetch} from '../src/rendering/pixi/art/island-prefetch.js';
{

async function rasterMesh(mesh,rect,width=128,height=128){
 const mask=mesh.metadata.strokeMask?await sharp(Buffer.from(mesh.metadata.strokeMask.png,'base64')).toColourspace('srgb').ensureAlpha().raw().toBuffer():null;
 const softMask=new Uint8Array(width*height);
 const {positions,indices,colors,metadata}=mesh,c=createCanvas(width,height),ctx=c.getContext('2d');
 ctx.scale(width/rect[2],height/rect[3]);ctx.translate(-rect[0],-rect[1]);
 for(const [recordIndex,record] of metadata.records.entries()){
  const motif=metadata.instances?.[recordIndex]?.[0],uv=metadata.maskUV?.[recordIndex];
  if(mask&&uv){
   const image=ctx.getImageData(0,0,width,height),pixels=image.data,mw=metadata.strokeMask.width,mh=metadata.strokeMask.height;
   const sample=(x,y)=>{x-=.5;y-=.5;const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;const at=(a,b)=>a<0||b<0||a>=mw||b>=mh?0:mask[(b*mw+a)*4];return ((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v)/255;};
   // Coverage quads are two affine triangles with identical texture mapping.
   for(let i=record.start;i<record.start+record.count;i+=6){const a=indices[i],b=indices[i+1],d=indices[i+2],local=a-record.vertexStart;
    const x0=(positions[a*2]-rect[0])*width/rect[2],y0=(positions[a*2+1]-rect[1])*height/rect[3],x1=(positions[d*2]-rect[0])*width/rect[2],y1=(positions[d*2+1]-rect[1])*height/rect[3];
    for(let y=Math.max(0,Math.ceil(y0-.5));y<Math.min(height,Math.ceil(y1-.5));y++)for(let x=Math.max(0,Math.ceil(x0-.5));x<Math.min(width,Math.ceil(x1-.5));x++){
     const u=(x+.5-x0)/(x1-x0),v=(y+.5-y0)/(y1-y0),alpha=sample(uv[local*2]+u*(uv[(local+1)*2]-uv[local*2]),uv[local*2+1]+v*(uv[(local+2)*2+1]-uv[local*2+1]))*colors[a*4+3]/255,at=(y*width+x)*4,old=pixels[at+3]/255,out=alpha+old*(1-alpha);
     if(alpha>.001)softMask[y*width+x]=1;
     if(!out)continue;for(let channel=0;channel<3;channel++)pixels[at+channel]=(colors[a*4+channel]*alpha+pixels[at+channel]*old*(1-alpha))/out;pixels[at+3]=out*255;
    }
   }
   ctx.putImageData(image,0,0);continue;
  }
  const p=new Path2D();for(let i=record.start;i<record.start+record.count;i+=3){const a=indices[i]*2,b=indices[i+1]*2,d=indices[i+2]*2;p.moveTo(positions[a],positions[a+1]);p.lineTo(positions[b],positions[b+1]);p.lineTo(positions[d],positions[d+1]);p.closePath();}const color=colors.subarray(indices[record.start]*4,indices[record.start]*4+4);ctx.fillStyle=`rgba(${color[0]},${color[1]},${color[2]},${color[3]/255})`;ctx.fill(p);}
 const pixels=ctx.getImageData(0,0,width,height).data;pixels.softMask=softMask;return pixels;
}
async function sourceRaster(root,tiles,rect,width=128,height=128){
 const parts=[];
 for(const t of tiles){if(t.x>rect[0]+rect[2]||t.y>rect[1]+rect[3]||t.x+t.width+(t.bleed??0)<rect[0]||t.y+t.height+(t.bleed??0)<rect[1])continue;
  if(!t.src.endsWith('.svg'))continue;
  let svg=await fs.readFile(root+'/public'+t.src,'utf8');svg=svg.replace('<svg ',`<svg x="${t.x}" y="${t.y}" `).replace(/width="[^"]*"/,`width="${t.width+(t.bleed??0)}"`).replace(/height="[^"]*"/,`height="${t.height+(t.bleed??0)}"`);parts.push(svg);
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${rect.join(' ')}">${parts.join('')}</svg>`;
 return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}
function compare(a,b,label){let checked=0,bad=0,worst=0;for(let y=2;y<126;y+=3)for(let x=2;x<126;x+=3){const at=(y*128+x)*4;
 // Calibrated thin outlines intentionally differ from sharp source pixels;
 // their coverage and contrast have a dedicated main-density raster test.
 if(b.softMask&&[-129,-128,-127,-1,0,1,127,128,129].some(d=>b.softMask[y*128+x+d]))continue;
 // Edges can move by a fraction of a sample pixel; only compare flat interiors.
 const stable=[-1,1,-128,128].every(d=>[0,1,2,3].every(c=>Math.abs(a[at+c]-a[at+d*4+c])<3));if(!stable)continue;
 const error=Math.max(...[0,1,2,3].map(c=>Math.abs(a[at+c]-b[at+c])));checked++;worst=Math.max(worst,error);if(error>12)bad++;
 }assert(checked>200,`${label}: too few interior samples`);
 assert(bad/checked<.025,`${label}: ${bad}/${checked} mismatches, worst ${worst}`);return {checked,bad};}

test('SVG tessellation preserves holes, transforms, clips, strokes, caps, colours and patterns',async()=>{
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><clipPath id="c"><circle cx="64" cy="64" r="58"/></clipPath><pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M3 3L12 12" stroke="#123456" stroke-width="3" stroke-linecap="round"/></pattern></defs><g clip-path="url(#c)"><path d="M0 0H128V128H0Z M40 40V88H88V40Z" fill="#abcdef" fill-rule="evenodd"/><rect width="128" height="128" fill="url(#p)"/><path d="M10 90Q64 110 118 90" fill="none" stroke="#f18c39" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><g transform="translate(50 20) rotate(12)"><rect width="20" height="15" fill="#aabb00"/></g></g></svg>`;
 const positions=[],colors=[],indices=[],records=[];
 for(const r of compile(inline(svg),{clip:rectClip([[0,0,128,128]])})){const m=triangulate(r.path),offset=positions.length/2,start=indices.length;positions.push(...m.positions);for(let j=0;j<m.positions.length/2;j++)colors.push(...rgba(r.fill,r.opacity));indices.push(...m.indices.map(i=>i+offset));records.push({start,count:indices.length-start});}
 const encoded=encodeGroundMesh({version:1,records},positions,colors,indices);const result=decodeGroundMesh(encoded.buffer.slice(encoded.byteOffset,encoded.byteOffset+encoded.byteLength));
 const original=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();compare(original,await rasterMesh(result,[0,0,128,128]),'fixture');
 assert.deepEqual(new Set(Array.from({length:colors.length/4},(_,i)=>colors.slice(i*4,i*4+3).join(','))),new Set(['171,205,239','18,52,86','241,140,57','170,187,0']));
 assert.throws(()=>decodeGroundMesh(new ArrayBuffer(16)),/Invalid ground mesh/);
});

for(const id of [...ISLANDS,'bog-arena'])test(`${id}: compact valid mesh matches authored tile interiors`,async()=>{
 const root=process.cwd(),built=await buildGround(root,id),bytes=built.bytes;
 const maskBytes=built.metadata.strokeMask?Buffer.from(built.metadata.strokeMask.png,'base64').length:0;
 assert(maskBytes<1000000,`${id}: stroke mask ${maskBytes} bytes`);
 assert(built.gzipBytes-maskBytes<1000000,`${id}: vector payload ${built.gzipBytes-maskBytes} compressed bytes`);
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),m=decodeGroundMesh(buffer);
 assert(m.indices.length>0);assert(m.positions.every(Number.isFinite));assert(m.indices.every(i=>i<m.positions.length/2));
 assert.deepEqual(new Set(m.metadata.paints),new Set(Array.from({length:m.colors.length/4},(_,i)=>Array.from(m.colors.subarray(i*4,i*4+3)).join(','))));
 const tiles=(await groundTiles(root,id)).filter(t=>t.src.endsWith('.svg'));
 // Deterministic crops across distinct tile sources and both landing/full zoom.
 for(const k of [Math.floor(tiles.length*.25),Math.floor(tiles.length*.55),Math.floor(tiles.length*.8)]){const t=tiles[k];for(const span of [300,72]){const rect=[t.x+t.width/2-span/2,t.y+t.height/2-span/2,span,span];compare(await sourceRaster(root,tiles,rect),await rasterMesh(m,rect),`${id} ${k} ${span}`);}}
 const before=performance.now(),chunks=splitGroundMesh(buffer);assert(chunks.chunks.every(c=>c.indices.length<=600000));assert.equal(chunks.chunks.reduce((n,c)=>n+c.indices.length,0),m.indices.length);console.log(`${id}: ${bytes.length} bytes, ${built.gzipBytes} gzip, split ${(performance.now()-before).toFixed(1)}ms, ${chunks.chunks.length} draws`);
 if(id==='bog')assert.equal(built.metadata.raster.length,81);else assert.equal(built.metadata.raster.length,0);
});

test('mesh stream readiness avoids tile requests, falls back on failure and destroys safely',async()=>{
 let requests=0,release=0,resolve;const container=new Container();
 const stream=createMeshGroundStream('fixture',container,{entry:{url:'/fixture.bin'},load:()=>new Promise(r=>resolve=r),makeMesh:()=>new Container(),yieldFrame:async()=>{},fallback:()=>{requests++;return {prepare:async()=>{},destroy:()=>release++};}});
 const pending=stream.prepare();assert(!stream.ready);resolve({chunks:[{positions:new Float32Array(),indices:new Uint16Array(),colors:new Uint8Array()}]});await pending;assert(stream.ready);assert.equal(requests,0);stream.destroy();assert.equal(container.children.length,0);
 const failed=createMeshGroundStream('fixture',container,{entry:{url:'/bad'},load:async()=>{throw Error('corrupt mesh');},fallback:()=>{requests++;return {prepare:async()=>{},destroy:()=>release++};}});await failed.prepare();assert.equal(requests,1);assert(failed.ready);failed.destroy();assert.equal(release,1);
 const late=createMeshGroundStream('fixture',container,{entry:{url:'/late'},load:()=>new Promise(r=>resolve=r),fallback:()=>{throw Error('destroyed stream must not fall back');}});const p=late.prepare();late.destroy();resolve({chunks:[]});await p;assert.equal(container.children.length,0);assert(groundMeshEnabled());
});

test('Home pond mask is baked from the same ground pixels without runtime tile reads',async()=>{
 const root=process.cwd(),mask=await homeWaterMask(root),art=JSON.parse(await fs.readFile('src/world/home/art-manifest.json'));
 const rect=[mask.rect.x,mask.rect.y,mask.rect.width,mask.rect.height];
 const source=await sourceRaster(root,art.ground.tiles,rect,mask.width,mask.height),baked=await sharp(mask.bytes).ensureAlpha().raw().toBuffer();
 let mismatches=0,checked=0;for(let i=0;i<source.length;i+=4*17){const wet=source[i+2]>130&&source[i+2]>source[i]*1.3&&source[i+1]>source[i]*1.2;checked++;if((baked[i]>128)!==wet)mismatches++;}
 assert(mismatches/checked<.001);assert(mask.bytes.length<100000);
});

test('cropped closed strokes retain the round join at their original starting point',async()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M10 10H90V90H10Z" fill="none" stroke="#123456" stroke-width="10" stroke-linejoin="round"/></svg>';
 const records=compile(inline(svg),{clip:rectClip([[0,0,40,40]])}),text='<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">'+records.map(r=>`<path d="${r.path.toSVGString()}" fill="${r.fill}"/>`).join('')+'</svg>';
 const [before,after]=await Promise.all([sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer(),sharp(Buffer.from(text)).ensureAlpha().raw().toBuffer()]);const at=(7*40+7)*4;assert.deepEqual([...after.subarray(at,at+4)],[...before.subarray(at,at+4)]);
});

}
{

test('the prepared theme path downloads a ground mesh and never acquires SVG ground tiles',async t=>{
 const adapter=DOMAdapter.get();DOMAdapter.set({...adapter,createCanvas:()=>({getContext:()=>null})});t.after(()=>DOMAdapter.set(adapter));
 const file=new URL('./.ground-integration.mjs',import.meta.url),original=globalThis.fetch,requests=[],acquired=[],textures=[];
 t.after(async()=>{globalThis.fetch=original;await fs.unlink(file).catch(()=>{});});
 const output=await build({stdin:{contents:"export {loadThemeArt} from './src/rendering/pixi/art/theme-art.js'",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',packages:'external',define:{__GROUND_MESH_MANIFEST__:JSON.stringify('/ground-manifest.json')},write:false});
 await fs.writeFile(file,output.outputFiles[0].text);
 const {loadThemeArt}=await import(file.href+'?test');
 const mesh=encodeGroundMesh({version:1,id:'fixture',records:[]},[0,0,100,0,0,100],[100,200,80,255,100,200,80,255,100,200,80,255],[0,1,2]);
 globalThis.fetch=async src=>{requests.push(src);if(src==='/ground-manifest.json')return {ok:true,json:async()=>({fixture:{url:'/ground.bin',raster:[]}})};if(src==='/ground.bin')return {ok:true,arrayBuffer:async()=>mesh.buffer.slice(mesh.byteOffset,mesh.byteOffset+mesh.byteLength)};if(src==='/fixture/art.json')return {ok:true,json:async()=>({ground:{tiles:[{src:'ground.svg',x:0,y:0,width:100,height:100}]},props:[{src:'tree.svg',x:20,y:20,width:10,height:10,shadow:false}]})};if(src==='/fixture/centre/centre.json')return {ok:true,json:async()=>({pieces:[]})};throw Error(`Unexpected request ${src}`);};
 const acquire=async src=>{acquired.push(src);const texture=new Texture({source:new ImageSource({resource:createCanvas(2,2)})});textures.push(texture);return texture;},release=()=>{},pool=createGroundPool({acquire,release});
 const art=await loadThemeArt({id:'fixture',art:'/fixture/art.json',origin:{x:0,y:0},width:100,height:100},{acquire,release,groundPool:pool,prepare:true});
 assert(requests.includes('/ground.bin'));assert(!requests.some(src=>src.endsWith('ground.svg')));assert(!acquired.some(src=>src.endsWith('ground.svg')));assert(art.groundStream.ready);assert(art.groundStream.mesh);assert.equal(pool.stats().residentTiles,0);assert.equal(art.ground.children[0].label,'fixture vector ground');
 art.destroy();pool.destroy();for(const texture of textures)texture.destroy(true);
});

test('tile fallback stays below decals and receives camera views through its wrapper',async()=>{
 const texture=new Texture({source:new ImageSource({resource:createCanvas(2,2)})}),pool=createGroundPool({acquire:async()=>texture,release:()=>{}}),root=new Container(),decal=new Container({label:'decal'});root.addChild(decal);
 const wrapper=createMeshGroundStream('fixture',root,{entry:{url:'/broken.bin'},load:async()=>{throw Error('intentional failure');},fallback:layer=>pool.create([{src:'/ground.svg',x:0,y:0,width:100,height:100}],layer)});
 await wrapper.prepare();pool.update([{stream:wrapper,camera:{x:50,y:50,zoom:1},width:100,height:100}],1);
 assert.equal(root.children.at(-1),decal);assert(wrapper.fallbackStream.entries[0].sprite.visible);wrapper.destroy();pool.destroy();root.destroy({children:true});texture.destroy(true);
});

test('mixed ground preserves raster base below newer vectors on success and fallback',async()=>{
 for(const fail of [false,true]){const ground=new Container(),raster=new Container({label:'PNG base'}),decal=new Container({label:'decal'});ground.addChild(raster,decal);
  const vector=createMeshGroundStream('bog',ground,{index:1,entry:{url:'/bog.bin'},load:async()=>{if(fail)throw Error('intentional mixed-ground fallback');return {chunks:[{}]};},makeMesh:()=>new Container({label:'SVG terrain'}),yieldFrame:async()=>{},fallback:layer=>{layer.addChild(new Container({label:'SVG fallback'}));return {prepare:async()=>{},destroy(){}};}});
  await vector.prepare();assert.equal(ground.children[0],raster);assert.equal(ground.children[2],decal);assert.equal(ground.children[1].children[0].label,fail?'SVG fallback':'SVG terrain');vector.destroy();ground.destroy({children:true});
 }
});

test('the reveal gate waits for real buffer uploads and resets Pixi geometry state',async t=>{
 const adapter=DOMAdapter.get();DOMAdapter.set({...adapter,createCanvas:()=>({getContext:()=>null})});t.after(()=>DOMAdapter.set(adapter));let uploads=0,resets=0;const root=new Container(),chunk={positions:new Float32Array([0,0,10,0,0,10]),colors:new Uint8Array(12).fill(255),indices:new Uint32Array([0,1,2])};
 const stream=createMeshGroundStream('fixture',root,{entry:{url:'/mesh'},load:async()=>({chunks:[chunk,chunk]}),renderer:{geometry:{bind(geometry){assert(!stream.ready);assert(geometry.buffers.every(buffer=>buffer.data.byteLength>0));uploads++;},resetState(){resets++;}}},yieldFrame:async()=>{},fallback:()=>{throw Error('unexpected upload fallback');}});
 await stream.prepare();assert(stream.ready);assert.equal(uploads,2);assert.equal(resets,2);stream.destroy();root.destroy({children:true});
});

}
{

test('ground is excluded from texture collection while all 81 legacy Bog PNGs remain on sheets',async()=>{
 const entries=await collectPlacedArt(process.cwd()),sources=new Set(entries.map(e=>e.src));
 for(const id of ['home','sunflower','pink','library','community','bog','snow','bog-arena']){
  for(const piece of await groundTiles(process.cwd(),id))
   assert.equal(sources.has(piece.src),piece.src.endsWith('.png'),piece.src);
 }
 assert.equal(entries.filter(e=>e.src.endsWith('.png')).length,81);
});

test('background warming fetches meshes and sheets, without fetching SVG detail',async()=>{
 const fetched=[],idle=[];
 const prefetch=createIslandPrefetch({islands:[{id:'a',x:0,y:0},{id:'b',x:1,y:1}],
  idle:fn=>idle.push(fn),getIndex:async()=>({}),selectTier:()=>({webp:['/props.webp'],ground:['/ground.bin'],rasterDetail:{url:'/detail.json'}}),
  fetchBytes:async url=>{fetched.push(url);}});
 prefetch.resume('a');idle.shift()();
 while(fetched.length<2)await new Promise(resolve=>setImmediate(resolve));
 prefetch.destroy();assert.deepEqual(fetched,['/props.webp','/ground.bin']);
});

test('production landing sets include the correct mesh and every island fits full-zoom detail at DPR 2',async t=>{
 if(!process.env.ART_MANIFEST)return t.skip('requires production build');
 const pointer=JSON.parse(await readFile('dist/art-prerender/islands.json'));
 const index=JSON.parse(await readFile('dist'+pointer.url));
 for(const id of Object.keys(index.islands)){
  for(const dpr of [1,2,3])for(const view of index.islands[id][dpr].views){
   assert.equal(view.rasterDetail.overBudget,false,`${id} DPR ${dpr} viewport zoom ${view.zoom}`);
   assert(view.rasterDetail.gpuBytes<=view.rasterDetail.budget+1e-6);
   assert.equal(view.rasterDetail.gpuBytes,view.rasterDetail.propsGPUBytes+view.rasterDetail.groundGPUBytes);
   assert.equal(view.rasterDetail.groundGPUBytes,index.islands[id][dpr].groundGPUBytes);
  }
  const tier=selectIslandTier(index,id,2,1440,900);
  assert(tier.ground.some(url=>url.endsWith('.bin.gz')),id);
  const total=(await Promise.all([...tier.webp,...tier.ground].map(async url=>(await stat('dist'+url)).size))).reduce((a,b)=>a+b,0);
  assert.equal(tier.bytes,total,id);
  assert.equal(tier.rasterDetail.overBudget,false,id);assert(tier.rasterDetail.gpuBytes<=250*1048576,id);
  assert.equal(tier.detailSharpZoom,1.8,id);
  const plan=JSON.parse(await readFile('dist'+tier.rasterDetail.plan));
  const bundle={pieces:Object.fromEntries(plan.sheets.flatMap(s=>s.frames.map(p=>[p.src,p])))};
  assert(!bundle.pieces['/pixi-art/water-texture.svg'],'the shared ocean keeps its existing density through swaps');
  const meshID=id==='isle-249'?'bog-arena':id==='home'?'home':null;
  if(meshID)assert(tier.ground.some(url=>url.includes('ground-'+meshID+'-')),id);
  const {metadata}=await import('../src/rendering/pixi/art/ground-mesh-codec.js').then(async({decodeGroundMesh})=>{
   const bytes=gunzipSync(await readFile('dist'+tier.ground.find(url=>url.endsWith('.bin.gz'))));
   return decodeGroundMesh(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  });
  assert(!metadata.raster.length,'current playable islands have vector ground');
  assert(!Object.keys(bundle.pieces).some(src=>/\/ground-[^/]+\.svg$/.test(src)),id);
 }
});

}