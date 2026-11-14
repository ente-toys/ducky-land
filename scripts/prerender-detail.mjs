import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const hash=value=>createHash('sha256').update(value).digest('hex');

// Main's per-piece density and the worker's packing/trim coordinates are shared.
// Piece rasters are reused across viewport plans, independently of sheet packing.
export async function prerenderDetailSheets(sheets,{root,output,base='/',cache=new Map(),previous=new Map(),emit}){
 const inputs=cache.inputs??=new Map(),rasters=cache.rasters??=new Map();
 const input=src=>{if(!inputs.has(src))inputs.set(src,readFile(path.join(root,src)));return inputs.get(src);};
 const raster=p=>{
  const key=JSON.stringify([p.src,p.scale,p.padding,p.f]);
  if(!rasters.has(key))rasters.set(key,(async()=>{
   const width=Math.ceil(p.w*p.scale),height=Math.ceil(p.h*p.scale),pad=p.padding??0;
   let image=sharp(await input(p.src),{density:Math.max(1,72*p.scale)}).resize(width,height,{fit:'fill'});
   if(pad)image=image.extend({top:pad,bottom:pad,left:pad,right:pad,extendWith:'copy'});
   return sharp(await image.png().toBuffer()).extract({left:p.f.x,top:p.f.y,width:p.f.width,height:p.f.height}).png().toBuffer();
  })());
  return rasters.get(key);
 };
 const results=new Array(sheets.length);let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,sheets.length)},async()=>{
  while(cursor<sheets.length){
   const k=cursor++,sheet=sheets[k],key=hash(JSON.stringify(sheet));
   if(!cache.has(key))cache.set(key,(async()=>{
    const digest=createHash('sha256').update('detail-webp92-fast-v2').update(key);
    for(const p of sheet.frames)if(!p.alias&&!p.f.empty)digest.update(await input(p.src));
    const fileName=`art-prerender/detail-${digest.digest('hex').slice(0,24)}.webp`;
    let bytes;
    try{bytes=previous.get(fileName)??await readFile(path.join(output,fileName));}catch(error){
     if(error.code!=='ENOENT')throw error;
     const composites=[];
     for(const p of sheet.frames){
      if(p.alias||p.f.empty)continue;
      let bytes=await raster(p);
      const gutter=p.x>=2&&p.y>=2&&p.x+p.f.width+2<=sheet.width&&p.y+p.f.height+2<=sheet.height?2:0;
      if(gutter)bytes=await sharp(bytes).extend({top:2,bottom:2,left:2,right:2,extendWith:'copy'}).png().toBuffer();
      composites.push({input:bytes,left:p.x-gutter,top:p.y-gutter});
     }
     bytes=await sharp({create:{width:sheet.width,height:sheet.height,channels:4,background:'#00000000'}}).composite(composites)
       .webp({quality:92,alphaQuality:100,effort:0,lossless:sheet.ground}).toBuffer();
    }
    emit(fileName,bytes);return {url:base+fileName,bytes:bytes.length,body:bytes};
   })());
   results[k]=await cache.get(key);
  }
 }));
 const result={raster:results.map(r=>r.url),rasterBytes:results.reduce((n,r)=>n+r.bytes,0)};
 if(results.length>24){
  const body=Buffer.concat(results.map(r=>r.body)),fileName=`art-prerender/detail-pack-${hash(body).slice(0,24)}.bin`;
  let offset=0;const ranges=results.map(r=>{const pair=[offset,r.bytes];offset+=r.bytes;return pair;});
  emit(fileName,body);result.rasterPack={url:base+fileName,ranges};
 }
 return result;
}
