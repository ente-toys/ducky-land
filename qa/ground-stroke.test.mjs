import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {XMLSerializer} from '@xmldom/xmldom';
import {ISLANDS,buildGround,collectGround,encodeGroundMesh} from '../scripts/ground-mesh/build.mjs';
import {compile,rectClip} from '../scripts/ground-mesh/svg.mjs';
import {rgba} from '../scripts/ground-mesh/tessellate.mjs';
import {decodeGroundMesh} from '../src/rendering/pixi/art/ground-mesh-codec.js';
import {planIslandArt as mainPlan} from '../scripts/ground-mesh/main-art-plan.mjs';
import {collectPlacedArt} from '../scripts/vite-prerender-art.mjs';
import {Path2D} from '@napi-rs/canvas';
import {createStrokeAtlas,darkThinStroke,rasterAlpha,softStrokeMesh,strokeRaster} from '../scripts/ground-mesh/soft-strokes.mjs';
import {decodeStrokeMask,splitGroundMesh} from '../src/rendering/pixi/art/ground-mesh-worker.js';
import {Container} from 'pixi.js';
import {createMeshGroundStream} from '../src/rendering/pixi/art/ground-mesh.js';
{

// Independent reference: render original SVG elements, CSS, patterns, strokes
// and clips with the main texture's per-source size and pixel origin. Do not
// render the compiler's stroke outline to create the reference image.
const serializer=new XMLSerializer();
function childPath(root,node){
 const result=[];
 while(node!==root){assert(node?.parentNode,'stroke source must belong to its SVG');const parent=node.parentNode;result.unshift(Array.from(parent.childNodes).indexOf(node));node=parent;}
 return result;
}
function originalPainting(root,matrix,target,disabled){
 const clone=root.cloneNode(true);
 if(disabled){let node=clone;for(const index of childPath(root,target))node=node.childNodes[index];node.setAttribute('style',(node.getAttribute('style')||'')+';stroke:none!important');}
 const attributes=Array.from(clone.attributes??[]).filter(a=>!['xmlns','xmlns:xlink','width','height','viewBox'].includes(a.name)).map(a=>`${a.name}="${a.value.replaceAll('&','&amp;').replaceAll('"','&quot;')}"`).join(' ');
 return `<g transform="matrix(${matrix.join(' ')})"><g ${attributes}>${Array.from(clone.childNodes).map(n=>serializer.serializeToString(n)).join('')}</g></g>`;
}
async function originalTile(group,tile,width,height,node,disabled){
 const w=tile.width+(tile.bleed??0),h=tile.height+(tile.bleed??0);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${tile.x} ${tile.y} ${w} ${h}">${originalPainting(group.svg,group.matrix,node,disabled)}</svg>`;
 const data=await sharp(Buffer.from(svg)).toColourspace('srgb').ensureAlpha().raw().toBuffer();
 return {data,width,height,x:tile.x,y:tile.y,sx:width/w,sy:height/h};
}
function sample(image,x,y,channel){
 const px=(x-image.x)*image.sx-.5,py=(y-image.y)*image.sy-.5,ix=Math.floor(px),iy=Math.floor(py),u=px-ix,v=py-iy;
 const at=(a,b)=>image.data[(Math.max(0,Math.min(image.height-1,b))*image.width+Math.max(0,Math.min(image.width-1,a)))*4+channel];
 return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
}
function meshCoverage(mesh,record,x,y){
 const {positions:p,indices:ix,colors,uv,mask}=mesh;
 for(let k=record.start;k<record.start+record.count;k+=3){
  const a=ix[k],b=ix[k+1],c=ix[k+2],ax=p[a*2],ay=p[a*2+1],bx=p[b*2],by=p[b*2+1],cx=p[c*2],cy=p[c*2+1];
  if(x<Math.min(ax,bx,cx)-1e-5||x>Math.max(ax,bx,cx)+1e-5||y<Math.min(ay,by,cy)-1e-5||y>Math.max(ay,by,cy)+1e-5)continue;
  const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(!determinant)continue;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/determinant,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/determinant,w=1-u-v;
  if(Math.min(u,v,w)<-1e-5)continue;
  const tx=u*uv[a*2]+v*uv[b*2]+w*uv[c*2],ty=u*uv[a*2+1]+v*uv[b*2+1]+w*uv[c*2+1];
  const coverage=sample(mask,tx,ty,0)/255;
  return coverage*(u*colors[a*4+3]+v*colors[b*4+3]+w*colors[c*4+3])/255;
 }
 return 0;
}
function peakSpots(full,without,bounds,mesh,record,occluded){
 const [x0,y0,x1,y1]=bounds,points=[];
 const left=Math.max(1,Math.floor((x0-full.x)*full.sx)),right=Math.min(full.width-2,Math.ceil((x1-full.x)*full.sx));
 const top=Math.max(1,Math.floor((y0-full.y)*full.sy)),bottom=Math.min(full.height-2,Math.ceil((y1-full.y)*full.sy));
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
  const at=(y*full.width+x)*4;if(without.data[at+3]<250)continue;
  const contrast=Math.max(...[0,1,2].map(c=>Math.abs(full.data[at+c]-without.data[at+c])));
  if(contrast>=8)points.push({x:full.x+(x+.5)/full.sx,y:full.y+(y+.5)/full.sy,contrast});
 }
 // Pick separated peaks along the authored outline. Repeated pattern nodes may
 // affect other cells too; meshCoverage limits candidates to this instance.
 const spots=[];
 for(let band=0;band<3;band++){
  const candidates=points.slice(Math.floor(points.length*band/3),Math.floor(points.length*(band+1)/3)).sort((a,b)=>b.contrast-a.contrast);
  const point=candidates.find(p=>meshCoverage(mesh,record,p.x,p.y)>.04&&!occluded(p));if(point)spots.push(point);
 }
 return spots;
}

let entriesPromise;
for(const id of [...ISLANDS,'bog-arena'])test(`${id}: outline contrast agrees with original source tiles at main DPR 2`,async t=>{
 const root=process.cwd(),built=await buildGround(root,id),mesh=decodeGroundMesh(built.bytes.buffer.slice(built.bytes.byteOffset,built.bytes.byteOffset+built.bytes.byteLength));
 const styles=new Map();for(const stroke of mesh.metadata.softStrokes){const key=[stroke.color.toLowerCase(),stroke.width.toFixed(2),stroke.opacity].join('/');if(!styles.has(key))styles.set(key,stroke);}
 if(!styles.size){t.diagnostic('No qualifying dark thin outlines in this island.');return;}
 const mask=mesh.metadata.strokeMask;
 mesh.mask={data:await sharp(Buffer.from(mask.png,'base64')).toColourspace('srgb').ensureAlpha().raw().toBuffer(),width:mask.width,height:mask.height,x:0,y:0,sx:1,sy:1};
 const {groups,tiles}=await collectGround(root,id),entries=await(entriesPromise??=collectPlacedArt(root));
 const reference=mainPlan([...entries.filter(e=>e.theme===(id==='bog-arena'?'bog':id)),...tiles.map(e=>({...e,mipmaps:false}))],{dpr:2,defaultZoom:.9});
 const recordBounds=mesh.metadata.records.map(record=>{
  let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  for(let v=record.vertexStart;v<record.vertexStart+record.vertices;v++){left=Math.min(left,mesh.positions[v*2]);right=Math.max(right,mesh.positions[v*2]);top=Math.min(top,mesh.positions[v*2+1]);bottom=Math.max(bottom,mesh.positions[v*2+1]);}
  return [left,top,right,bottom];
 });
 const compiled=new Map();let checked=0,worst=0,styleCount=0;
 // Full source renders are intentionally bounded to three distinct styles per
 // island. The separate coverage test checks every style's packing/quantisation.
 const candidates=[...styles.values()].sort((a,b)=>Number(b.color.toLowerCase()==='#39472d')-Number(a.color.toLowerCase()==='#39472d'));
 for(const stroke of candidates){
  if(styleCount===3)break;
  const group=groups[stroke.group];
  if(!compiled.has(stroke.group))compiled.set(stroke.group,compile(group.svg,{matrix:group.matrix,clip:rectClip(group.rects)}));
  const authored=compiled.get(stroke.group)[stroke.record],node=authored.stroke?.sourceNode;
  assert(node,`${id}: original SVG source node is required for independent raster QA`);
  const bounds=stroke.bounds,area=t=>Math.max(0,Math.min(bounds[2],t.x+t.width)-Math.max(bounds[0],t.x))*Math.max(0,Math.min(bounds[3],t.y+t.height)-Math.max(bounds[1],t.y));
  const tile=tiles.filter(e=>group.sources.includes(e.src)).sort((a,b)=>area(b)-area(a))[0];assert(tile);
  const resolution=reference.resolutions.get(tile.src),size=sizes[tile.src]??[tile.width,tile.height];assert(resolution>0);
  const width=Math.max(1,Math.ceil(size[0]*resolution)),height=Math.max(1,Math.ceil(size[1]*resolution));
  const full=await originalTile(group,tile,width,height,node,false),without=await originalTile(group,tile,width,height,node,true);
  const record=mesh.metadata.records[stroke.instance];
  const repeated=compiled.get(stroke.group).filter(r=>r!==authored&&r.stroke?.sourceNode===node);
  const occluded=point=>{
   // The isolated contrast equation is only valid with no later paint. Reject
   // overlap across a source texel, including translucent later decorations.
   const radius=.5/Math.min(full.sx,full.sy);
   const owner=[...stroke.frames].reverse().find(f=>point.x>=f.x&&point.x<=f.x+f.width&&point.y>=f.y&&point.y<=f.y+f.height);
   if(owner&&(owner.x!==tile.x||owner.y!==tile.y))return true;
   // At a clipped brush tip, both the background edge and clip mask change
   // inside one texel. Use clear stroke interiors for isolated line contrast.
   if(authored.stroke.sourceClip)for(const dy of [-radius,0,radius])for(const dx of [-radius,0,radius])if(!authored.stroke.sourceClip.isPointInPath(point.x+dx,point.y+dy))return true;
   for(const r of repeated)if(r.path.isPointInPath(point.x,point.y)&&(r.clips??[]).every(p=>p.isPointInPath(point.x,point.y)))return true;
   for(let index=stroke.instance+1;index<mesh.metadata.records.length;index++){
    const b=recordBounds[index];if(point.x+radius<b[0]||point.x-radius>b[2]||point.y+radius<b[1]||point.y-radius>b[3])continue;
    for(const dy of [-radius,0,radius])for(const dx of [-radius,0,radius])if(meshCoverage(mesh,mesh.metadata.records[index],point.x+dx,point.y+dy)>.01)return true;
   }
   return false;
  };
  const spots=peakSpots(full,without,bounds,mesh,record,occluded);
  if(spots.length<2){t.diagnostic(`${stroke.color}/${stroke.width.toFixed(2)} has no isolated peaks after later-paint overlap rejection; checking another style.`);continue;}
  const ink=rgba(stroke.color,1);styleCount++;
  for(const spot of spots)for(const zoom of [.65,1]){
   const deltas=[0,1,2].map(c=>Math.abs(sample(without,spot.x,spot.y,c)-ink[c])),channel=deltas.indexOf(Math.max(...deltas));
   let sourceContrast=0,actualContrast=0;
   for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const wx=spot.x+((x+.5)/4-.5)/(zoom*2),wy=spot.y+((y+.5)/4-.5)/(zoom*2),base=sample(without,wx,wy,channel);
    sourceContrast+=base-sample(full,wx,wy,channel);
    actualContrast+=(base-ink[channel])*meshCoverage(mesh,record,wx,wy);
   }
   sourceContrast=Math.abs(sourceContrast/16);actualContrast=Math.abs(actualContrast/16);
   assert(sourceContrast>2,`${id}: selected outline must have measurable original contrast`);
   const error=Math.abs(actualContrast-sourceContrast)/sourceContrast;checked++;worst=Math.max(worst,error);
   assert(error<=.15,`${id} original ${tile.src} ${stroke.color}/${stroke.width.toFixed(2)} at ${spot.x.toFixed(2)},${spot.y.toFixed(2)} zoom ${zoom}: contrast error ${(error*100).toFixed(2)}%, source ${sourceContrast.toFixed(2)}, mesh ${actualContrast.toFixed(2)}`);
  }
 }
 assert(styleCount>=1,`${id}: no independently visible source outline style`);
 assert(checked>=4);t.diagnostic(`${styleCount} original SVG styles, ${checked} screen-pixel contrast samples, worst ${(worst*100).toFixed(2)}%`);
});

}
{

function meshAlpha(mesh,record,x,y){
 const {positions:p,indices:ix,colors,uv,maskRaster}=mesh;
 for(let k=record.start;k<record.start+record.count;k+=3){
  const a=ix[k],b=ix[k+1],c=ix[k+2],ax=p[a*2],ay=p[a*2+1],bx=p[b*2],by=p[b*2+1],cx=p[c*2],cy=p[c*2+1];
  if(x<Math.min(ax,bx,cx)-1e-5||x>Math.max(ax,bx,cx)+1e-5||y<Math.min(ay,by,cy)-1e-5||y>Math.max(ay,by,cy)+1e-5)continue;
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(!det)continue;
  const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
  if(Math.min(u,v,w)>=-1e-5){const alpha=(u*colors[a*4+3]+v*colors[b*4+3]+w*colors[c*4+3])/255;
   if(!maskRaster)return alpha;
   const tx=u*uv[a*2]+v*uv[b*2]+w*uv[c*2],ty=u*uv[a*2+1]+v*uv[b*2+1]+w*uv[c*2+1];
   return alpha*rasterAlpha(maskRaster,tx-.5,ty-.5)/255;
  }
 }
 return 0;
}

for(const id of [...ISLANDS,'bog-arena'])test(`${id}: filtered coverage preserves compiled stroke contrast at landing and zoom 1`,async t=>{
 const built=await buildGround(process.cwd(),id),mesh=decodeGroundMesh(built.bytes.buffer.slice(built.bytes.byteOffset,built.bytes.byteOffset+built.bytes.byteLength));
 if(mesh.metadata.strokeMask){const mask=mesh.metadata.strokeMask;const data=await sharp(Buffer.from(mask.png,'base64')).toColourspace('srgb').ensureAlpha().raw().toBuffer();
  // rasterAlpha reads alpha; the production shader reads the grayscale red.
  for(let i=0;i<data.length;i+=4)data[i+3]=data[i];mesh.maskRaster={data,width:mask.width,height:mask.height};}
 const {groups}=await collectGround(process.cwd(),id),styles=new Map(),compiled=new Map();
 // Test three separate authored strokes of EVERY style, not random interiors.
 for(const style of mesh.metadata.softStrokes){const key=[style.color.toLowerCase(),style.width.toFixed(2),style.opacity].join('/');if(!styles.has(key))styles.set(key,[]);if(styles.get(key).length<3)styles.get(key).push(style);}
 let samples=0,worst=0;
 for(const strokes of styles.values())for(const style of strokes){
  if(!compiled.has(style.group)){const g=groups[style.group];compiled.set(style.group,compile(g.svg,{matrix:g.matrix,clip:rectClip(g.rects)}));}
  const source=compiled.get(style.group)[style.record],density=style.density,b=source.path.computeTightBounds();
  assert(darkThinStroke(source,compiled.get(style.group).slice(0,style.record)));
  for(const [frameIndex,frame] of style.frames.slice(0,2).entries()){
  const raster=await strokeRaster(source,density,frame);assert(raster);
  const {x,y,width,height,data,densityX:sx,densityY:sy}=raster;
  const points=[];for(let k=0;k<width*height;k++)if(data[k*4+3]>40){
   const wx=(x+k%width+.5)/sx,wy=(y+Math.floor(k/width)+.5)/sy,pad=1;
   const changesOwner=style.frames.slice(frameIndex+1).some(f=>wx+pad>=f.x&&wx-pad<=f.x+f.width&&wy+pad>=f.y&&wy-pad<=f.y+f.height);
   if(!changesOwner)points.push(k);
  }
  if(!points.length)continue;
  for(const fraction of [.2,.5,.8]){const at=points[Math.floor((points.length-1)*fraction)],px=(x+at%width+.5)/sx,py=(y+Math.floor(at/width)+.5)/sy;
   for(const zoom of [.65,1]){let reference=0,actual=0;
    // Integrate a DPR-2 screen pixel, as the GPU does at both requested zooms.
    for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++){
     const wx=px+((dx+.5)/4-.5)/(zoom*2),wy=py+((dy+.5)/4-.5)/(zoom*2);
     reference+=rasterAlpha(raster,wx*sx-x-.5,wy*sy-y-.5)/255*style.opacity;
     actual+=meshAlpha(mesh,mesh.metadata.records[style.instance],wx,wy);
    }
    reference/=16;actual/=16;
    // On the same neighbouring fill, alpha error equals contrast error.
    const error=Math.abs(actual-reference)/Math.max(reference,.04);worst=Math.max(worst,error);samples++;
    assert(error<=.15,`${id} ${style.color}/${style.width} zoom ${zoom}: contrast error ${(error*100).toFixed(1)}%, source ${reference}, mesh ${actual}`);
   }
  }
 }
 }
 if(['bog','snow'].includes(id))assert.equal(styles.size,0);
 else assert(styles.size>0,`${id}: no outline styles sampled`);
 t.diagnostic(`${styles.size} styles, ${samples} screen-pixel samples, worst contrast error ${(worst*100).toFixed(2)}%, ${built.gzipBytes} gzip bytes`);
});

test('layout 4 keeps mask coordinates through decoding and worker expansion',()=>{
 const metadata={version:1,layout:4,motifs:[[0,3,0,3,32]],instances:[[0,0,0,1,1,57,71,45,128]],maskUV:{0:[1,2,3,4,5,6]}};
 const bytes=encodeGroundMesh(metadata,[0,0,1,0,0,1],new Array(12).fill(255),[0,1,2]);
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),decoded=decodeGroundMesh(buffer),worker=splitGroundMesh(buffer);
 assert.deepEqual([...decoded.uv],[1,2,3,4,5,6]);
 assert.deepEqual([...worker.chunks[0].uv],[...decoded.uv]);
});

test('only thin strokes substantially darker than their fill qualify',()=>{
 const path={computeTightBounds:()=>[0,0,10,10]};
 assert(darkThinStroke({path,fill:'#39472d',stroke:{width:6,fill:'#98b94b'}},[]));
 for(const r of [{fill:'#39472d',stroke:{width:6.01,fill:'#98b94b'}},{fill:'#e7e3ed',stroke:{width:2,fill:'#f8f6fb'}},{fill:'#39472d'}])assert(!darkThinStroke({path,...r},[]));
});

test('no-fill ink samples the contour instead of an unrelated bounding-box centre',()=>{
 const base=new Path2D();base.rect(-10,-10,40,40);
 const darkCentre=new Path2D();darkCentre.rect(4,4,2,2);
 const line=new Path2D('M0 0H10V10').stroke({width:2});
 assert(darkThinStroke({path:line,fill:'#39472d',stroke:{width:2,fill:null}},[
  {path:base,fill:'#fff0c7',opacity:1},{path:darkCentre,fill:'#232323',opacity:1}
 ]));
});

}
{

for(const fail of [false,true])test(`coverage decode extracts red and closes its bitmap, failure=${fail}`,async()=>{
 const oldBitmap=globalThis.createImageBitmap,oldCanvas=globalThis.OffscreenCanvas;let closed=0;
 globalThis.createImageBitmap=async blob=>{assert.equal(blob.type,'image/webp');return {close(){closed++;}};};
 globalThis.OffscreenCanvas=class{constructor(w,h){assert.equal(w,2);assert.equal(h,1);}getContext(){return {drawImage(){if(fail)throw Error('decode failed');},getImageData(){return {data:new Uint8ClampedArray([7,9,11,255,137,99,5,255])};}};}};
 try{
  const request=decodeStrokeMask({png:'AA==',format:'webp',width:2,height:1});
  if(fail)await assert.rejects(request,/decode failed/);else assert.deepEqual([...await request],[7,137]);
  assert.equal(closed,1);
 }finally{globalThis.createImageBitmap=oldBitmap;globalThis.OffscreenCanvas=oldCanvas;}
});

test('destroy during the mask upload yield releases R8 pixels and cannot attach a late root',async()=>{
 let resume,uploaded,resource;const container=new Container();
 const stream=createMeshGroundStream('fixture',container,{entry:{url:'/mask.bin'},
  load:async()=>({metadata:{strokeMask:{width:2,height:1}},strokeMaskPixels:new Uint8Array([255,0]),chunks:[]}),
  renderer:{texture:{initSource(source){uploaded=source;resource=source.resource;assert.equal(source.format,'r8unorm');}}},
  yieldFrame:()=>new Promise(resolve=>resume=resolve),fallback:()=>{throw Error('must not fall back');}});
 const pending=stream.prepare();while(!resume)await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual([...resource],[255,0]);assert(!stream.ready);stream.destroy();resume();await pending;
 assert.equal(container.children.length,0);assert(uploaded.destroyed);assert(!stream.ready);
});

}
{

const band=()=>{const path=new Path2D('M0 4H20V6H0Z');return {path,fill:'#39472d',opacity:.6,stroke:{width:2,sourcePath:path}};};
async function coverage(frames){
 const record=band(),atlas=createStrokeAtlas(),mesh=await softStrokeMesh(record,.7,atlas,frames),mask=await atlas.finish();assert(mask);
 const {data,info}=await sharp(Buffer.from(mask.png,'base64')).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const sample=(x,y)=>{
  x-=.5;y-=.5;const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;
  const at=(a,b)=>data[(Math.max(0,Math.min(info.height-1,b))*info.width+Math.max(0,Math.min(info.width-1,a)))*4];
  return ((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v)/255;
 };
 return {record,mesh,at(x,y){
  const hits=new Map(),p=mesh.positions;
  for(let k=0;k<mesh.indices.length;k+=3){
   const a=mesh.indices[k],b=mesh.indices[k+1],c=mesh.indices[k+2],ax=p[a*2],ay=p[a*2+1],bx=p[b*2],by=p[b*2+1],cx=p[c*2],cy=p[c*2+1];
   const determinant=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(!determinant)continue;
   const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/determinant,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/determinant,w=1-u-v;
   if(Math.min(u,v,w)<-1e-8)continue;
   // Each coverage rectangle is two triangles; their shared diagonal is one
   // owner, while two overlapping frame rectangles must count as two owners.
   const owner=Math.floor(k/6),tx=u*mesh.uv[a*2]+v*mesh.uv[b*2]+w*mesh.uv[c*2],ty=u*mesh.uv[a*2+1]+v*mesh.uv[b*2+1]+w*mesh.uv[c*2+1];
   hits.set(owner,sample(tx,ty));
  }
  return [...hits.values()];
 }};
}
function clampedSource(raster,x,y){
 const px=Math.max(0,Math.min(raster.width-1,x*raster.densityX-raster.x-.5)),py=Math.max(0,Math.min(raster.height-1,y*raster.densityY-raster.y-.5));
 const ix=Math.floor(px),iy=Math.floor(py),u=px-ix,v=py-iy;
 const at=(a,b)=>raster.data[(Math.min(raster.height-1,b)*raster.width+Math.min(raster.width-1,a))*4+3];
 return ((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v)/255;
}

test('abutting source frames retain ink up to both sides of their shared edge',async()=>{
 const frames=[{x:0,y:0,width:10,height:10,pixelsX:7,pixelsY:7},{x:10,y:0,width:10,height:10,pixelsX:7,pixelsY:7}],result=await coverage(frames),y=5.123;
 for(const x of [.001,9.99,9.999,10.001,10.01,19.999]){
  const owners=result.at(x,y);assert.equal(owners.length,1,`x=${x}: exactly one frame must cover the ink`);
  assert(owners[0]>.5,`x=${x}: the half-texel edge must not erase or fade ink`);
 }
 assert(Math.abs(result.at(9.999,y)[0]-result.at(10.001,y)[0])<.04,'matching source grids must remain continuous across their seam');
});

test('overlapping source frames have one owner and preserve the later frame pixel phase',async()=>{
 const frames=[{x:0,y:0,width:12,height:10,pixelsX:9,pixelsY:7},{x:8,y:0,width:12,height:10,pixelsX:8,pixelsY:7}],result=await coverage(frames),raster=await strokeRaster(result.record,.7,frames[1]),y=5.123;
 for(const x of [8.001,8.4,9.123,10.45,11.99]){
  const owners=result.at(x,y);assert.equal(owners.length,1,`x=${x}: overlapping frames must not blend the stroke twice`);
  const expected=clampedSource(raster,x,y);
  assert(Math.abs(owners[0]-expected)<=.04,`x=${x}: later frame coverage ${expected}, mesh ${owners[0]}`);
 }
});

test('true source frame borders clamp their first and last texels',async()=>{
 const frames=[{x:0,y:0,width:20,height:10,pixelsX:13,pixelsY:7}],result=await coverage(frames),raster=await strokeRaster(result.record,.7,frames[0]),y=5.123;
 for(const x of [.001,.1,.3,19.7,19.9,19.999]){
  const owners=result.at(x,y);assert.equal(owners.length,1,`x=${x}: source-border coverage is present`);
  const expected=clampedSource(raster,x,y);
  assert(Math.abs(owners[0]-expected)<=.04,`x=${x}: edge must clamp to ${expected}, got ${owners[0]}`);
 }
});

}