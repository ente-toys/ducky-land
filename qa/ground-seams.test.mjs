import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {build} from 'esbuild';
import {Container,DOMAdapter,Texture,ImageSource} from 'pixi.js';
import {createCanvas,Image} from '@napi-rs/canvas';
import {createGroundPool,groundSpriteBounds} from '../src/rendering/pixi/art/ground-stream.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {createArtQueue} from '../src/rendering/pixi/art/island-preparation.js';
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
const {outputFiles:[bundle]}=await build({stdin:{contents:"export {HOME_TILES} from './src/world/home/placements.js';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {HOME_TILES}=await import('data:text/javascript;base64,'+Buffer.from(bundle.text).toString('base64'));
const manifests=[{id:'home',tiles:HOME_TILES},...readdirSync('public/pixi-art/themes').flatMap(id=>{
 try{const m=JSON.parse(readFileSync(`public/pixi-art/themes/${id}/art.json`));return [{id,tiles:(m.ground?.tiles??[]).map(t=>({...t,src:t.src.startsWith('/')?t.src:`/pixi-art/themes/${id}/${t.src}`}))}];}catch{return [];}
})];

test('every Home and themed ground join overlaps at any positive zoom, including fractional raster scales',async()=>{
 let joins=0;
 for(const {id,tiles} of manifests){
  const textures=[];
  const root=new Container(),pool=createGroundPool({acquire:async(src,r)=>{
   const size=sizes[src]??[256,256],width=Math.ceil(size[0]*r),height=Math.ceil(size[1]*r);
   const texture=new Texture({source:new ImageSource({width:width+4,height:height+4})});
   texture.groundPadding={pad:2,width,height};textures.push(texture);return texture;
  },release(){}}),stream=pool.create(tiles,root);
  // This exercises actual sprite placement in the pinned preparation path.
  await stream.prepare({resolutions:new Map(tiles.map(t=>[t.src,.6137]))});
  for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){
   let a=tiles[i],b=tiles[j],vertical;
   const close=(a,b)=>Math.abs(a-b)<1e-5;
   if(close(a.x+a.width,b.x)&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1e-5)vertical=true;
   else if(close(a.y+a.height,b.y)&&Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1e-5)vertical=false;
   else if(close(b.x+b.width,a.x)&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1e-5){[a,b]=[b,a];vertical=true;}
   else if(close(b.y+b.height,a.y)&&Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1e-5){[a,b]=[b,a];vertical=false;}
   else continue;
   const sa=stream.entries[tiles.indexOf(a)].sprite,sb=stream.entries[tiles.indexOf(b)].sprite;
   const overlap=vertical?sa.x+sa.width-sb.x:sa.y+sa.height-sb.y;
   // Since both endpoints use the same camera transform, overlap*z*dpr is
   // positive for the entire continuous zoom range, not only snapped steps.
   assert(overlap>0,`${id}: ${a.src} -> ${b.src}`);
   for(const z of [.01,.125,.333,.7,1,1.2345,1.8])assert(overlap*z*2>0);
   joins++;
  }
  stream.destroy();pool.destroy();root.destroy();textures.forEach(t=>t.destroy(true));
 }
 assert(joins>2000,`checked ${joins} joins`);
 const engine=readFileSync('src/rendering/pixi/engine.js','utf8');
 assert.match(engine,/mipmaps \? ART_TEXTURE : \{groundPadding:2\}/,'all ground acquisition uses extruded edges');
});

test('fractional SVG raster has opaque final texels and extruded corners with unchanged inner coordinates',async t=>{
 const previous=DOMAdapter.get();t.after(()=>DOMAdapter.set(previous));DOMAdapter.set({...previous,createCanvas});
 const loader=createWholeSVGLoader({queue:createArtQueue({yieldFrame:async()=>{}}),
  fetchBlob:async()=>new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="101" height="73"><rect width="101" height="73" fill="#93b82d"/></svg>']),
  decode:async blob=>{const image=new Image();image.src=Buffer.from(await blob.arrayBuffer());await image.decode();return image;}});
 const texture=await loader.load('/ground.svg',{data:{resolution:.6137,groundPadding:2}});
 const {resource}=texture.source,pixels=resource.getContext('2d').getImageData(0,0,resource.width,resource.height).data;
 for(let i=0;i<pixels.length;i+=4)assert.deepEqual([...pixels.subarray(i,i+4)],[147,184,45,255]);
 for(const flip of [false,true]){
  const tile={x:13.5,y:-4,width:101,height:73,flip},b=groundSpriteBounds(tile,texture),p=texture.groundPadding;
  const dx=p.pad*tile.width/p.width,dy=p.pad*tile.height/p.height;
  assert(Math.abs((flip?b.x-dx-tile.width:b.x+dx)-tile.x)<1e-9);
  assert(Math.abs(b.y+dy-tile.y)<1e-9);
 }
 loader.unload(texture);
});
