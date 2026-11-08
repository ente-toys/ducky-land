import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture} from 'pixi.js';
import {patchGeometry,createLivePatches} from '../src/pixi/sphere-mesh.js';
import {mapPoint} from '../src/pixi/sphere-coordinates.js';
import {mapOf} from '../src/pixi/island-maps.js';

test('live neighbour meshes and snapshot meshes use the same exact sphere chart',()=>{
 for(const [from,to]of [['home','isle-55'],['isle-55','home'],['sunset','isle-163']]){
  const m=mapOf(to),steps=12,geometry=patchGeometry(from,to,{...m.origin,width:m.width,height:m.height},steps),p=geometry.positions;
  for(let y=0;y<=steps;y++)for(let x=0;x<=steps;x++){
   const q=mapPoint(to,from,{x:m.origin.x+x/steps*m.width,y:m.origin.y+y/steps*m.height}),k=(y*(steps+1)+x)*2;
   assert.ok(Math.hypot(q.x-p[k],q.y-p[k+1])<.005,'only Float32 rounding separates mesh and navigation');
  }
  geometry.destroy();
 }
});
test('animated neighbour targets are reused, bounded to 1536px and freed when out of view',async()=>{
 const calls=[],renderer={render:options=>calls.push(options)},live=createLivePatches(renderer),m=mapOf('isle-55'),p=mapPoint('isle-55','home',{x:m.cx,y:m.cy}),scene={};
 const camera={...p,zoom:.7};
 live.draw('home','isle-55',scene,camera,1400,1000,1,undefined);
 assert.equal(calls.length,2);const texture=calls[0].target;
 assert.ok(texture.width<=1536&&texture.height<=1536);
 live.draw('home','isle-55',scene,camera,1400,1000,1,undefined);
 assert.equal(calls[2].target,texture,'no allocation every frame');
 live.draw('home','isle-55',scene,{...camera,x:camera.x+100,zoom:camera.zoom*1.15},1400,1000,1,undefined);
 assert.equal(calls[4].target,texture,'small sailing/zoom steps retain the padded patch');
 live.retain(new Set());assert.equal(texture.destroyed,false,'render target survives the current bound pass');
 await new Promise(resolve=>setTimeout(resolve,5));assert.equal(texture.destroyed,true);
 live.destroy();
});
