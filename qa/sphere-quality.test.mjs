import {createCanvas,loadImage} from '@napi-rs/canvas';
import {atlasReference,midZoomQuality} from '../scripts/sphere-quality.mjs';
import {WORLD_ISLANDS,WORLD_GEO,worldIsland} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {mapPoint,localPoint} from '../src/pixi/sphere-coordinates.js';
import {expMap,unit,sphereFrame} from '../src/pixi/sphere.js';
import {globeScreen} from '../src/pixi/globe-screen.js';
import {rollBasis} from '../src/pixi/globe-look.js';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
test('mid-zoom quality check accepts sharp opaque land and rejects transparency and blur',async()=>{
const images=new Map();for(const i of WORLD_ISLANDS){const theme=i.theme??'home',img=await loadImage(fileURLToPath(new URL('../public/pixi-art/globe/'+theme+'.svg',import.meta.url))),c=createCanvas(img.width,img.height),x=c.getContext('2d');x.drawImage(img,0,0);images.set(theme,x.getImageData(0,0,img.width,img.height));}
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

test('painted quality reference uses the full curved chart and camera rotation, not the centre matrix',()=>{
 const width=1440,height=900,bog=worldIsland('isle-249'),image={width:64,height:64,data:new Uint8Array(64*64*4)};
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)image.data.set([x*4,y*4,80,255],(y*64+x)*4);
 const images=new Map([['bog',image]]),p=expMap(bog,2600,1300,WORLD_GEO.Rw);
 const camera={...localPoint('home',bog.center),zoom:.04},ball=1;
 const at=basis=>{
  const cam={...camera,basis},G=globeScreen({id:'home',cam,ball,w:width,h:height,basis}),s=G.screenOf(p);
  // A deliberately wrong centre matrix must not affect a fully painted lookup.
  const stickers=[{kind:'island',id:bog.id,mode:'atlas',onBall:1,a:.001,b:0,c:0,d:.001,x:0,y:0}];
  return atlasReference(s.x,s.y,{camera:cam,islandId:'home',ball,stickers},images,width,height);
 };
 const a=at(rollBasis(0)),b=at(rollBasis(.73));assert.ok(a&&b);
 for(let k=0;k<3;k++)assert.ok(Math.abs(a.colour[k]-b.colour[k])<1e-8,'screen rotation preserves the sampled art and lighting');
 // This point is well away from the centre, with a recognisably different colour.
 assert.ok(a.colour[0]>160&&a.colour[1]>145);
});

test('overlapping chart rectangles choose opaque art, then the nearest centre',()=>{
 const a=worldIsland('home'),b=worldIsland('blossom'),width=1440,height=900;
 const image=(r,g,alpha)=>({width:2,height:2,data:new Uint8Array([r,g,0,alpha,r,g,0,alpha,r,g,0,alpha,r,g,0,alpha])});
 // The world layout deliberately has open sea between these islands now.
 // Use an explicit overlapping pair to exercise opacity and nearest-centre selection.
 const original={...b};Object.assign(b,sphereFrame(.2,0));
 try{
 const state=k=>({islandId:'home',ball:1,camera:{...localPoint('home',unit(a.center.map((v,i)=>v*(1-k)+b.center[i]*k))),zoom:.04}});
 const sample=(k,alpha)=>atlasReference(width/2,height/2,state(k),new Map([['home',image(255,0,alpha)],['sunflower',image(0,255,255)]]),width,height).colour;
 assert.deepEqual(sample(.49,255),[255,0,0],'Home is nearest at this shared pixel');
 assert.deepEqual(sample(.51,255),[0,255,0],'later island wins when its centre is nearer');
 assert.deepEqual(sample(.49,2),[0,255,0],'transparent padding cannot cut an opaque neighbour');
 }finally{Object.assign(b,original);}
});
