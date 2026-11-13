import test from 'node:test';
import assert from 'node:assert/strict';
import {Texture} from 'pixi.js';
import {readFileSync} from 'node:fs';
import {patchGeometry,createLivePatches} from '../src/rendering/pixi/sphere-mesh.js';
import {mapPoint,localPoint} from '../src/world/sphere-coordinates.js';
import {placeRigid,unplaceRigid,flatRigid,polar,shearOf} from '../src/world/rigid.js';
import {rigidLandingBasis,easeLandingBasis,cameraMatrix} from '../src/rendering/shared/sphere-camera.js';
import {isletPlacement} from '../src/rendering/pixi/islet-view.js';
import {ISLETS} from '../src/world/islets.js';
import {mapOf} from '../src/world/island-maps.js';

test('neighbour meshes are rigid: true size, right angles, centre on the sphere',()=>{
 for(const [from,to]of [['home','isle-55'],['isle-55','home'],['sunset','isle-251'],['home','isle-251'],['home','isle-250']]){
  const m=mapOf(to),geometry=patchGeometry(from,to,{...m.origin,width:m.width,height:m.height}),p=geometry.positions;
  const P=k=>({x:p[k*2],y:p[k*2+1]}),[a,b,c,d]=[0,1,2,3].map(P),len=(u,v)=>Math.hypot(u.x-v.x,u.y-v.y);
  assert.ok(Math.abs(len(a,b)-m.width)<.05&&Math.abs(len(d,c)-m.width)<.05,'width kept');
  assert.ok(Math.abs(len(a,d)-m.height)<.05&&Math.abs(len(b,c)-m.height)<.05,'height kept');
  const ex={x:b.x-a.x,y:b.y-a.y},ny={x:d.x-a.x,y:d.y-a.y};
  assert.ok(Math.abs(ex.x*ny.x+ex.y*ny.y)/(m.width*m.height)<1e-5,'no shear');
  assert.ok(ex.x*ny.y-ex.y*ny.x>0,'not mirrored');
  const centre=mapPoint(to,from,{x:m.cx,y:m.cy}),mid={x:(a.x+c.x)/2,y:(a.y+c.y)/2};
  assert.ok(len(centre,mid)<.05,'centre exactly where the sphere puts it');
  assert.ok(Math.abs(placeRigid(from,to,{x:m.cx,y:m.cy}).x-centre.x)<1e-6);
  geometry.destroy();
 }
});
test('rigid placements undo each other both ways and match the chart rotation',()=>{
 for(const [a,b]of [['home','isle-55'],['sunset','isle-251'],['isle-249','isle-250']]){
  const mb=mapOf(b),p={x:mb.cx+900,y:mb.cy-700},there=placeRigid(a,b,p),back=unplaceRigid(a,b,there),round=placeRigid(b,a,there);
  assert.ok(Math.hypot(back.x-p.x,back.y-p.y)<1e-6);
  assert.ok(Math.hypot(round.x-p.x,round.y-p.y)<1e-3,'b in a, then a in b, is the identity');
  const f=flatRigid(a,b),P=(x,y)=>mapPoint(b,a,{x:mb.cx+x,y:mb.cy+y}),e=P(1,0),w=P(-1,0),n=P(0,1),s=P(0,-1);
  const q=polar((e.x-w.x)/2,(e.y-w.y)/2,(n.x-s.x)/2,(n.y-s.y)/2);
  assert.ok(Math.abs(f.a-q.cos)<1e-4&&Math.abs(f.b-q.sin)<1e-4);
  assert.equal(shearOf(f).shearDeg<1e-9,true);
 }
 const sheared=polar(1.2,.3,.1,.9),turn=Math.atan2(.3-.1,1.2+.9);
 assert.ok(Math.abs(sheared.angle-turn)<1e-12);
 assert.ok(shearOf({a:1,b:0,c:.4,d:1}).shearDeg>20,'the shear measure sees a shear');
});
test('islets are rigid stickers centred on the sphere',()=>{
 for(const id of ['home','isle-55','isle-249'])for(const islet of ISLETS.slice(0,8)){
  const r=isletPlacement(id,islet),c=localPoint(id,islet.center);
  assert.ok(Math.hypot(r.x-c.x,r.y-c.y)<1e-6);
  assert.ok(Math.abs(Math.hypot(r.cos,r.sin)-1)<1e-12,'a pure turn, true size');
 }
});
test('sailing onto a rigid copy keeps that island exactly where it was on screen',()=>{
 const from='home',to='isle-251',m=mapOf(to),prior={a:1,b:0,c:0,d:1};
 const camera={...placeRigid(from,to,{x:m.cx+2000,y:m.cy+3000}),zoom:.4};
 const before=cameraMatrix(camera,1440,900),after={...unplaceRigid(from,to,camera),zoom:.4};
 after.basis=easeLandingBasis(rigidLandingBasis(from,to,prior),0);
 const now=cameraMatrix(after,1440,900),screen=(M,p)=>({x:M.a*p.x+M.c*p.y+M.tx,y:M.b*p.x+M.d*p.y+M.ty});
 for(const q of [{x:m.cx,y:m.cy},{x:m.cx+3000,y:m.cy-1000},{x:m.origin.x,y:m.origin.y}]){
  const a=screen(before,placeRigid(from,to,q)),b=screen(now,q);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.01,'no jump at the hop');
 }
 assert.ok(shearOf(after.basis).shearDeg<1e-9,'the leftover is a pure turn');
});
test('the globe shader draws islands and islets as stickers, never through a sphere chart',()=>{
 const code=readFileSync(new URL('../src/rendering/pixi/world-view.js',import.meta.url),'utf8');
 assert.match(code,/uniform vec4 uIsl\[13\]/);
 assert.match(code,/uniform vec4 uIt\[22\]/);
 assert.doesNotMatch(code,/uIsletEasts|uCenters|uEasts/,'no per-island inverse azimuthal lookup left');
 assert.match(code,/autoGenerateMipmaps:true/,'the world atlas is mipmapped so far islands do not shimmer');
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
