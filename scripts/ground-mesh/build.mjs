import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {decodeGroundMesh} from '../../src/rendering/pixi/art/ground-mesh-codec.js';
import {fileURLToPath} from 'node:url';
import sizes from '../../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {XMLSerializer} from '@xmldom/xmldom';
import {inline} from '../globe-svg/vector.mjs';
import {compile,rectClip} from './svg.mjs';
import {darkThinStroke,softStrokeMesh,createStrokeAtlas} from './soft-strokes.mjs';
import {planIslandArt as mainPlan} from './main-art-plan.mjs';
import {collectPlacedArt} from '../vite-prerender-art.mjs';
import {canonicalMesh} from './canonical.mjs';
import {clipTriangles} from './clip.mjs';
import {triangulate,rgba,TOLERANCE} from './tessellate.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
export const ISLANDS=['home','sunflower','pink','library','community','bog','snow'];
export async function groundTiles(root,id){
 if(id==='home'){
  const expansion=JSON.parse(await fs.readFile(path.join(root,'src/world/home/home-expansion.json'))),original=JSON.parse(await fs.readFile(path.join(root,'src/world/home/art-manifest.json')));
  return [...expansion.tiles,...original.ground.tiles.map(t=>({...t,src:t.src.replace('/pixi-art/','/pixi-art/home-expansion/')}))];
 }
 const art=JSON.parse(await fs.readFile(path.join(root,`public/pixi-art/themes/${id}/art.json`)));
 return art.ground.tiles.map(t=>({...t,src:t.src.startsWith('/')?t.src:`/pixi-art/themes/${id}/${t.src}`}));
}
export async function collectGround(root,id){
 const groups=[],raster=[],tiles=await groundTiles(root,id),serializer=new XMLSerializer();
 for(const t of tiles){
  if(!t.src.endsWith('.svg')){raster.push(t);continue;}
  const source=await fs.readFile(path.join(root,'public',t.src),'utf8'),svg=inline(source),vb=svg.getAttribute('viewBox').split(/[ ,]+/).map(Number);
  const sx=(t.width+(t.bleed??0))/vb[2],sy=(t.height+(t.bleed??0))/vb[3],matrix=[sx,0,0,sy,t.x-vb[0]*sx,t.y-vb[1]*sy];
  for(const key of ['width','height','viewBox'])svg.removeAttribute(key);
  const hash=digest(serializer.serializeToString(svg)+JSON.stringify(matrix));
  // Only coalesce consecutive identical paintings, keeping tile/overlay order.
  let g=groups.at(-1);if(g?.hash!==hash){g={hash,svg,matrix,rects:[],sources:[]};groups.push(g);}
  g.rects.push([t.x,t.y,t.width+(t.bleed??0),t.height+(t.bleed??0)]);g.sources.push(t.src);
 }
 return {groups,raster,tiles};
}
export function encodeGroundMesh(metadata,positions,colors,indices){
 const put=(bytes,value)=>{let v=value>>>0;while(v>127){bytes.push((v&127)|128);v>>>=7;}bytes.push(v);};
 let xy;
 if(metadata.layout===4){const bytes=[];for(const m of metadata.motifs){const [vertex,n,,,quant0]=m,quant=quant0||32;m[4]=bytes.length;m[5]=quant;const previous=[0,0];for(let j=0;j<n*2;j++){const v=Math.round(positions[vertex*2+j]*quant),d=v-previous[j%2];put(bytes,(d<<1)^(d>>31));previous[j%2]=v;}}metadata.positionBytes=Math.ceil(bytes.length/4)*4;metadata.positionEncoding='delta-varint';xy=Buffer.alloc(metadata.positionBytes);Buffer.from(bytes).copy(xy);}else xy=Buffer.from(new Float32Array(positions).buffer);
 const encoded=[];let previous=0;for(const v of indices){const d=v-previous;put(encoded,(d<<1)^(d>>31));previous=v;}metadata.indexBytes=Math.ceil(encoded.length/4)*4;metadata.indexEncoding='delta-varint';
 const json=Buffer.from(JSON.stringify(metadata)),size=Math.ceil(json.length/4)*4,buffer=Buffer.alloc(16+size+xy.length+colors.length+metadata.indexBytes,32);
 buffer.writeUInt32LE(0x31444e47,0);buffer.writeUInt32LE(size,4);buffer.writeUInt32LE(positions.length/2,8);buffer.writeUInt32LE(indices.length,12);json.copy(buffer,16);
 let offset=16+size;xy.copy(buffer,offset);offset+=xy.length;Buffer.from(colors).copy(buffer,offset);offset+=colors.length;Buffer.from(encoded).copy(buffer,offset);return buffer;
}

export async function buildGround(root,id){
 const {groups,raster,tiles}=await collectGround(root,id);
 const entries=await collectPlacedArt(root);
 const reference=mainPlan([...entries.filter(e=>e.theme===(id==='bog-arena'?'bog':id)),...tiles.map(t=>({...t,mipmaps:false}))],{dpr:2,defaultZoom:.9});
 // Canonical desktop: 1440x900 at DPR 2, matching the live planner.
 const density=.9*2*reference.groundDensity;
 // Cache by every converter input, never by tile name or modification time.
 const implementation=await Promise.all(['build.mjs','svg.mjs','tessellate.mjs','clip.mjs','canonical.mjs','soft-strokes.mjs','main-art-plan.mjs'].map(file=>fs.readFile(new URL(file,import.meta.url))));
 const key=digest(Buffer.concat([...implementation,Buffer.from(JSON.stringify({groups:groups.map(g=>[g.hash,g.rects]),raster,tiles,density,sourceRasterFrames:tiles.map(t=>[t.src,sizes[t.src],reference.resolutions.get(t.src)])})),await fs.readFile(path.join(root,'package-lock.json'))]));
 const directory=path.join(tmpdir(),'ducky-ground-mesh-cache',digest(root)),cache=path.join(directory,`${id}-${key}.bin`);
 try{const bytes=await fs.readFile(cache),decoded=decodeGroundMesh(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));return {bytes,metadata:decoded.metadata,gzipBytes:gzipSync(bytes).length,url:`art-prerender/ground-${id}-${digest(bytes)}.bin`,vertices:decoded.positions.length/2,triangles:decoded.indices.length/3};}catch(error){if(error.code!=='ENOENT')throw error;}
 const positions=[],colors=[],indices=[],paints=new Set(),softStrokes=[],strokeAtlas=createStrokeAtlas(),maskUV={};
 const records=[],tessCache=new Map(),motifs=[],motifMap=new Map(),instances=[],canonicalCache=new Map();
 const tess=path=>{const key=path.toSVGString();if(!tessCache.has(key))tessCache.set(key,triangulate(path));return tessCache.get(key);};
 for(const [groupIndex,g] of groups.entries()){
  const frames=g.rects.map(([x,y,width,height],i)=>{const src=g.sources[i],native=sizes[src]??[width,height],resolution=reference.resolutions.get(src);return {x,y,width,height,pixelsX:Math.ceil(native[0]*resolution),pixelsY:Math.ceil(native[1]*resolution)};});
  const clipped=compile(g.svg,{matrix:g.matrix,clip:rectClip(g.rects),minSize:0,minStroke:0});
  for(const [recordIndex,r] of clipped.entries()){
   const soft=darkThinStroke(r,clipped,recordIndex);
   let mesh=soft?await softStrokeMesh(r,density,strokeAtlas,frames):tess(r.path);if(!soft)for(const clip of r.clips??[])mesh=clipTriangles(mesh,tess(clip));if(!mesh.indices.length)continue;const color=rgba(r.fill,r.opacity);paints.add(color.slice(0,3).join(','));
   let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(let j=0;j<mesh.positions.length;j+=2){minX=Math.min(minX,mesh.positions[j]);maxX=Math.max(maxX,mesh.positions[j]);minY=Math.min(minY,mesh.positions[j+1]);maxY=Math.max(maxY,mesh.positions[j+1]);}
   const ox=minX,oy=minY,normalize=Math.max(maxX-minX,maxY-minY)<1000,sx=normalize?Math.max(.00001,maxX-minX):1,sy=normalize?Math.max(.00001,maxY-minY):1,quantum=normalize?2**Math.ceil(Math.log2(Math.max(sx,sy)/.125)):32,local=mesh.positions.map((v,i)=>Math.round((v-(i%2?oy:ox))/(i%2?sy:sx)*quantum)/quantum);
   const canonical=soft?{positions:local,indices:mesh.indices}:canonicalMesh(local,mesh.indices,canonicalCache);
   if(soft)softStrokes.push({color:r.fill,width:r.stroke.width,opacity:r.opacity,density,frames:mesh.frames,peakAlpha:mesh.peak/255*r.opacity,group:groupIndex,record:recordIndex,instance:instances.length,bounds:r.path.computeTightBounds()});
   const signature=digest(Buffer.concat([Buffer.from(new Float32Array(canonical.positions).buffer),Buffer.from(new Uint32Array(canonical.indices).buffer)]));let motif=motifMap.get(signature);
   if(motif===undefined){motif=motifs.length;motifMap.set(signature,motif);const vertexStart=positions.length/2,indexStart=indices.length;for(const v of canonical.positions)positions.push(v);for(let j=0;j<canonical.positions.length/2;j++)colors.push(255,255,255,255);for(const i of canonical.indices)indices.push(i);motifs.push([vertexStart,canonical.positions.length/2,indexStart,canonical.indices.length,normalize&&quantum<=65535?quantum:0]);}
   if(soft)maskUV[instances.length]=mesh.uv;
   instances.push([motif,ox,oy,sx,sy,...color]);

  }
 }
 const metadata={version:1,id,tolerance:TOLERANCE,paints:[...paints].sort(),raster:raster.map(t=>t.src),tileCount:tiles.length,sourceGroups:groups.length,softStrokes,strokeDensity:density,strokeMask:await strokeAtlas.finish(),maskUV,records,motifs,instances,layout:4};
 const bytes=encodeGroundMesh(metadata,positions,colors,indices),gzipBytes=gzipSync(bytes).length;

 const maskBytes=metadata.strokeMask?Buffer.from(metadata.strokeMask.png,'base64').length:0;
 // The original vector allowance is unchanged. Filtered outline coverage has
 // its own bounded payload, carried inside this same request.
 if(maskBytes>=1000000||gzipBytes-maskBytes>=1000000)throw Error(`${id}: ground geometry or stroke coverage exceeds 1 MB (${gzipBytes}, mask ${maskBytes})`);
 await fs.mkdir(directory,{recursive:true});const temporary=cache+'.'+process.pid+'.tmp';await fs.writeFile(temporary,bytes);await fs.rename(temporary,cache);
 return {bytes,metadata,gzipBytes,url:`art-prerender/ground-${id}-${digest(bytes)}.bin`,vertices:positions.length/2,triangles:indices.length/3};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=process.cwd(),out=process.argv[2]??'/tmp/ducky-ground-mesh';await fs.mkdir(out,{recursive:true});const manifest={};
 for(const id of ISLANDS){const start=performance.now(),mesh=await buildGround(root,id);await fs.writeFile(path.join(out,path.basename(mesh.url)),mesh.bytes);manifest[id]={url:'/'+mesh.url,bytes:mesh.bytes.length,gzipBytes:mesh.gzipBytes,vertices:mesh.vertices,triangles:mesh.triangles,raster:mesh.metadata.raster};console.log(id,mesh.bytes.length,mesh.gzipBytes,mesh.vertices,mesh.triangles,`${((performance.now()-start)/1000).toFixed(1)}s`);}
 await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
}
