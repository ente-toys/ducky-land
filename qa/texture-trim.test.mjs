import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCanvas,Image} from '@napi-rs/canvas';
import {Container,DOMAdapter,Sprite} from 'pixi.js';
import sharp from 'sharp';
import bounds from '../src/rendering/shared/art-visible-bounds.json' with {type:'json'};
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {textureFootprint} from '../src/rendering/pixi/art/texture-footprint.js';
import {createSnowCover} from '../src/rendering/pixi/environment/snow-cover.js';
import {createGroundPool,groundSpriteBounds} from '../src/rendering/pixi/art/ground-stream.js';
import {assertFinalTexture,uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';

DOMAdapter.set({...DOMAdapter.get(),createCanvas});
const decode=async blob=>{const im=new Image();im.src=Buffer.from(await blob.arrayBuffer());await im.decode();return im;};
const bitmap=async(input,o)=>{
  const im=input instanceof Blob?await decode(input):input;
  const crop=o.crop??[0,0,im.width,im.height];
  const canvas=createCanvas(o.resizeWidth??crop[2],o.resizeHeight??crop[3]);
  canvas.getContext('2d').drawImage(im,...crop,0,0,canvas.width,canvas.height);
  canvas.close=()=>{};return canvas;
};
const src=Object.keys(bounds).find(src=>bounds[src]&&src.includes('home-expansion-g/'));

test('trimmed ground keeps authored position, full sprite dimensions, visible pixels and two-pixel bleed',async()=>{
  const [w,h]=sizes[src],r=.6137,f=textureFootprint(src,r,2);
  const loader=createWholeSVGLoader({canDecodeBitmap:()=>false,fetchBlob:async()=>new Blob([readFileSync('public'+src)]),decode});
  const texture=await loader.load(src,{data:{resolution:r,groundPadding:2}});
  assert.deepEqual([texture.source.pixelWidth,texture.source.pixelHeight],[f.width,f.height]);
  const tile={x:100,y:150,width:1375,height:1375,bleed:3};
  const b=groundSpriteBounds(tile,texture),sprite=new Sprite(texture);
  sprite.position.set(b.x,b.y);sprite.width=b.width;sprite.height=b.height;
  assert(Math.abs(sprite.x+texture.groundPadding.pad/r*sprite.scale.x-tile.x)<1e-8);
  assert(Math.abs(sprite.y+texture.groundPadding.pad/r*sprite.scale.y-tile.y)<1e-8);
  assert.equal(texture.trim.x,f.x/r);assert.equal(texture.trim.y,f.y/r);
  assert.equal(texture.orig.width,f.fullWidth/r);assert.equal(texture.orig.height,f.fullHeight/r);
  assert(f.width*f.height<f.fullWidth*f.fullHeight,'transparent margins consume no GPU texels');
  const pixels=texture.source.resource.getContext('2d').getImageData(0,0,f.width,f.height).data;
  assert(pixels.some((v,i)=>i%4===3&&v>0),'trim retains visible ink');
  sprite.destroy();loader.unload(texture);
});

test('bitmap trimming matches SVG fallback geometry and retains the same crop on fractional tiers',async()=>{
  const [w,h]=sizes[src],r=.6137,scale=1;
  const bytes=await sharp('public'+src).resize(Math.ceil(w*scale),Math.ceil(h*scale)).extend({top:2,bottom:2,left:2,right:2,extendWith:'copy'}).png().toBuffer();
  const calls=[],loader=createWholeSVGLoader({getManifest:async()=>({[src]:{w,h,padding:2,tiers:[{scale,url:'/tier.webp',width:Math.ceil(w),height:Math.ceil(h)}]}}),
    canDecodeBitmap:()=>true,fetchBlob:async url=>{assert.equal(url,'/tier.webp');return new Blob([bytes]);},
    decodeBitmap:async(input,o)=>{calls.push(o);return bitmap(input,o);},decode(){assert.fail('sufficient bitmap tier must be used');}});
  const texture=await loader.load(src,{data:{resolution:r,groundPadding:2}}),f=textureFootprint(src,r,2);
  assert.equal(calls.length,2);assert.deepEqual(calls[1].crop,[f.x,f.y,f.width,f.height]);
  assert.equal(texture.orig.width,f.fullWidth/r);assert.equal(texture.trim.width,f.width/r);
  assert.equal(texture.groundPadding.pad,2);
  loader.unload(texture);
});

for(const kind of ['webp','svg'])test(`${kind}: native bounds scale to resized decoded pictures before trimming`,async()=>{
  const src='/pixi-art/home-expansion-g/ground-0-0.svg',resolution=.7,padding=2;
  const image=createCanvas(20,10);image.getContext('2d').fillRect(0,0,20,10);
  const f=textureFootprint(src,resolution,padding,{[src]:[20,10]});
  assert.deepEqual(f,{x:9,y:6,width:9,height:5,fullWidth:18,fullHeight:11});
  const loader=createWholeSVGLoader({canDecodeBitmap:()=>kind==='webp',
    getManifest:async()=>({[src]:{w:20,h:10,padding,tiers:[{scale:1,url:'/resized.webp',width:20,height:10}]}}),
    fetchBlob:async()=>new Blob([image.toBuffer('image/png')]),decode:async()=>image,decodeBitmap:bitmap});
  const texture=await loader.load(src,{src,data:{resolution,groundPadding:padding}});
  assertFinalTexture(texture,src);
  assert.deepEqual([texture.source.pixelWidth,texture.source.pixelHeight],[f.width,f.height]);
  assert.deepEqual([texture.trim.x,texture.trim.y],[f.x/resolution,f.y/resolution]);
  const pixels=texture.source.resource.getContext('2d').getImageData(0,0,f.width,f.height).data;
  assert(pixels.some((v,i)=>i%4===3&&v>0),'resized crop retains visible ink');
  loader.unload(texture);
});

test('empty authored ground is final and uploads before readiness without downloading or decoding a tier',async()=>{
  const empty=Object.keys(bounds).find(src=>bounds[src]===null&&src.includes('home-expansion-g/'));
  const loader=createWholeSVGLoader({fetchBlob(){assert.fail('empty ground must never fetch');},getManifest(){assert.fail('empty ground needs no tier');}});
  const texture=await loader.load(empty,{data:{resolution:.7,groundPadding:2}});
  assert.deepEqual([texture.source.pixelWidth,texture.source.pixelHeight],[1,1]);
  assert.equal(texture.source.resource.getContext('2d').getImageData(0,0,1,1).data[3],0);
  assert(texture.orig.width>1);assertFinalTexture(texture,empty);
  let acquired=0;
  const root=new Container(),pool=createGroundPool({acquire:async()=>{acquired++;return texture;},release(){}});
  try{
    const stream=pool.create([{src:empty,x:0,y:0,width:100,height:100}],root);
    await stream.prepare();assert.equal(stream.prepared,true);
    const uploads=[];
    await uploadIsland({texture:{bindSource:source=>uploads.push(source)}},[root],{requiredRoots:[root],yieldFrame:async()=>{}});
    assert.deepEqual(uploads,[texture.source]);
    for(const zoom of [.1,.7,1.8])pool.update([{stream,camera:{x:50,y:50,zoom},width:100,height:100}],2);
    assert.equal(acquired,1,'empty final ground never reloads while walking or zooming');
  }finally{pool.destroy();root.destroy();loader.unload(texture);}
});


test('snow samples trimmed ink at its full authored position',()=>{
  const previous=globalThis.document,calls=[];
  globalThis.document={createElement:()=>{
    const canvas=createCanvas(192,192),context=canvas.getContext('2d'),draw=context.drawImage.bind(context);
    context.drawImage=(...args)=>{calls.push(args.slice(1));return draw(...args);};
    return canvas;
  }};
  const image=createCanvas(20,40);image.getContext('2d').fillRect(0,0,20,40);
  const texture={source:{resource:image,resolution:1},frame:{x:0,y:0,width:20,height:40},trim:{x:30,y:10,width:20,height:40},width:100,height:100};
  const root=new Container(),cover=createSnowCover(11);
  try{
    cover.track(0,'snow',0,0);cover.track(5,'snow',0,0);
    cover.render([{parent:root,x:0,y:0,width:100,rotation:0,texture,spriteX:0,spriteY:0,sx:1,sy:1}]);
    assert(calls.length>0);
    [0,0,20,40,57.6,19.2,38.4,76.8].forEach((v,i)=>assert(Math.abs(calls[0][i]-v)<1e-8));
  }finally{cover.destroy();root.destroy();globalThis.document=previous;}
});
