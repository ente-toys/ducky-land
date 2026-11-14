import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
// Load native canvas through Node, outside Vite's temporary config bundle.
const nativeImport=new Function('specifier','return import(specifier)');
export function groundMesh(){
 let config,manifestURL;
 return {name:'island-ground-mesh',
  configResolved(value){config=value;},
  async buildStart(){
   const {buildGround,ISLANDS}=await nativeImport(new URL('./ground-mesh/build.mjs',import.meta.url).href);
   const manifest={};
   for(const id of [...ISLANDS,'bog-arena']){const mesh=await buildGround(config.root,id);const packed=gzipSync(mesh.bytes);this.emitFile({type:'asset',fileName:mesh.url+'.gz',source:packed});manifest[id]={url:config.base+mesh.url+'.gz',compression:'gzip',bytes:packed.length,gzipBytes:mesh.gzipBytes,raster:mesh.metadata.raster,strokeMaskGPUBytes:mesh.metadata.strokeMask?mesh.metadata.strokeMask.width*mesh.metadata.strokeMask.height:0};config.logger.info(`Ground ${id}: ${mesh.bytes.length} bytes, ${mesh.gzipBytes} gzip, ${mesh.vertices} vertices, ${mesh.metadata.raster.length} raster exceptions`);}
   const {homeWaterMask}=await nativeImport(new URL('./ground-mesh/water-mask.mjs',import.meta.url).href);
   const mask=await homeWaterMask(config.root);this.emitFile({type:'asset',fileName:mask.url,source:mask.bytes});manifest.home.waterMask={url:config.base+mask.url,width:mask.width,height:mask.height,rect:mask.rect};
   const json=JSON.stringify(manifest),fileName=`art-prerender/ground-manifest-${createHash('sha256').update(json).digest('hex').slice(0,20)}.json`;
   this.emitFile({type:'asset',fileName,source:json});manifestURL=config.base+fileName;
  },
  async configureServer(server){
   // Dev uses the same converter and content-addressed bytes, built lazily.
   const pending=new Map(),assets=new Map();
   server.middlewares.use(async(req,res,next)=>{try{
    if(!req.url?.startsWith('/art-prerender/ground-'))return next();
    const {buildGround,groundTiles,ISLANDS}=await nativeImport(new URL('./ground-mesh/build.mjs',import.meta.url).href);
    if(req.url==='/art-prerender/ground-manifest.json'){
     const manifest={};for(const id of [...ISLANDS,'bog-arena'])manifest[id]={url:`/art-prerender/ground-${id}.bin`,raster:(await groundTiles(config.root,id)).filter(t=>!t.src.endsWith('.svg')).map(t=>t.src)};
     const {homeWaterMask}=await nativeImport(new URL('./ground-mesh/water-mask.mjs',import.meta.url).href),mask=await homeWaterMask(config.root);assets.set('/'+mask.url,mask.bytes);manifest.home.waterMask={url:'/'+mask.url,width:mask.width,height:mask.height,rect:mask.rect};
     res.setHeader('Content-Type','application/json');res.end(JSON.stringify(manifest));return;
    }
    const id=req.url.match(/^\/art-prerender\/ground-([a-z-]+)\.bin$/)?.[1];
    if([...ISLANDS,'bog-arena'].includes(id)){if(!pending.has(id))pending.set(id,buildGround(config.root,id));const mesh=await pending.get(id);res.setHeader('Content-Type','application/octet-stream');res.end(mesh.bytes);return;}
    if(assets.has(req.url)){res.setHeader('Content-Type',req.url.endsWith('.png')?'image/png':'application/octet-stream');res.end(assets.get(req.url));return;}next();
   }catch(error){next(error);}});
  },
  transform(code,id){if(id.endsWith('/art/ground-mesh.js'))return {code:code.replaceAll('__GROUND_MESH_MANIFEST__',JSON.stringify(manifestURL??'/art-prerender/ground-manifest.json')),map:null};},
 };
}
