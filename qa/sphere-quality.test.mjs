import {createCanvas,loadImage} from '@napi-rs/canvas';
import {atlasReference,midZoomQuality} from '../scripts/sphere-quality.mjs';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {mapPoint} from '../src/pixi/sphere-coordinates.js';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
test('mid-zoom quality check accepts sharp opaque land and rejects transparency and blur',async()=>{
const images=new Map();for(const i of WORLD_ISLANDS){const theme=i.theme??'home',img=await loadImage(fileURLToPath(new URL('../public/pixi-art/globe/'+theme+'.png',import.meta.url))),c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);images.set(theme,x.getImageData(0,0,img.width,img.height));}
const m=mapOf('isle-249'),point=mapPoint('isle-249','home',{x:m.cx,y:m.cy});
const state={islandId:'home',camera:{...point,zoom:.025},ball:.7},width=512,height=384;
const outputs={};for(const type of ['sharp','washed','blurred']){
 const data=new Uint8ClampedArray(width*height*4);
 for(let y=12;y<height-12;y+=4)for(let x=12;x<width-12;x+=4){
  const r=atlasReference(x+.5,y+.5,state,images,width,height);if(!r)continue;let c=r.colour;
  if(type==='washed')c=c.map((v,k)=>r.sea[k]+(v-r.sea[k])*.5);
  if(type==='blurred'){
   const ns=[[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>atlasReference(x+.5+dx,y+.5+dy,state,images,width,height));
   if(ns.every(Boolean))c=c.map((v,k)=>(v+ns.reduce((a,p)=>a+p.colour[k],0))/5);
  }
  data.set([...c,255],(y*width+x)*4);
 }
 outputs[type]=midZoomQuality({width,height,data},state,images);
}

assert.ok(outputs.sharp.opacityPassed&&outputs.sharp.blurPassed);
assert.equal(outputs.washed.opacityPassed,false);
assert.equal(outputs.blurred.blurPassed,false);
});
