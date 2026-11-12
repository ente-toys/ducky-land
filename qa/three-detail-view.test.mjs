import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {surfacePoint,surfaceCoordinates} from '../src/rendering/three/three-globe-math.js';
import {DETAIL_CAPTURE_SCALE,detailBlend,directDetail,detailSize,detailCamera,detailScreen} from '../src/rendering/three/three-detail-view.js';

test('handoff preserves the grabbed world point on desktop and portrait screens, on every island including poles',()=>{
 for(const frame of WORLD_ISLANDS)for(const [width,height]of [[1512,827],[393,852]])for(const altitude of [.36,.23,.16,.12,.05]){
  const map=mapOf(frame.id),size=detailSize(width,height,2),point=surfacePoint(frame,1300,-700,WORLD_GEO.Rw),centre=surfaceCoordinates(frame,surfacePoint(frame,1000,-500,WORLD_GEO.Rw),WORLD_GEO.Rw);
  const anchor={point,x:width*.37,y:height*.61},state={fov:35,altitude,radius:WORLD_GEO.Rw,point:centre,anchor,width,height};
  const camera=detailCamera(frame,map,state,size.width,size.height),pixel=detailScreen(camera,map.cx+1300,map.cy-700,size.width,size.height,width,height);
  assert.ok(Math.hypot(pixel.x-anchor.x,pixel.y-anchor.y)<1e-7,frame.id);
 }
});
test('capture follows screen aspect ratio at bounded resolution instead of uploading a fixed square',()=>{
 for(const [w,h,dpr]of [[1512,827,2],[393,852,3],[3840,2160,2]]){
  const s=detailSize(w,h,dpr);assert.ok(Math.max(s.width,s.height)<=1536);assert.ok(Math.abs(s.width/s.height-w/h)<.003);
 }
 const s=detailSize(1512,827,1);assert.ok(s.width*s.height<1536*1536*.6,'landscape capture avoids the unused square pixels');
});
test('the close approach flattens gradually, and renderer ownership uses hysteresis and waits for live art',()=>{
 assert.equal(detailBlend(.36),0);assert.equal(detailBlend(.16),1);assert.ok(detailBlend(.24)>0&&detailBlend(.24)<1);
 assert.equal(directDetail(.12,false,false),false);assert.equal(directDetail(.12,false,true),true);
 assert.equal(directDetail(.17,true,true),true);assert.equal(directDetail(.17,false,true),false);assert.equal(directDetail(.19,true,true),false);
});
test('releasing a drag preserves the handoff camera offset instead of snapping back to the sphere centre',()=>{
 const frame=WORLD_ISLANDS[0],map=mapOf(frame.id),point=surfacePoint(frame,500,1000,WORLD_GEO.Rw),offset={x:0,y:0};
 const state={fov:35,altitude:.12,radius:WORLD_GEO.Rw,point:{x:300,y:800},anchor:{point,x:440,y:430},width:1000,height:700};
 const before=detailCamera(frame,map,state,1000,700,1,offset),after=detailCamera(frame,map,{...state,anchor:null},1000,700,1,offset);
 assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<1e-12);
});

test('overscan keeps cursor anchors and screen placement unchanged at the same upload budget',()=>{
 for(const frame of WORLD_ISLANDS)for(const [width,height]of [[2560,1080],[393,852]])for(const tilt of [1,.4]){
  const size=detailSize(width,height,2),map=mapOf(frame.id),point=surfacePoint(frame,1300,-700,WORLD_GEO.Rw);
  const state={fov:35,altitude:.23,radius:WORLD_GEO.Rw,point:{x:900,y:-400},anchor:{point,x:width*.14,y:height*.83},width,height};
  const native=detailCamera(frame,map,state,size.width,size.height,tilt,{x:0,y:0});
  const over=detailCamera(frame,map,state,size.width,size.height,tilt,{x:0,y:0},DETAIL_CAPTURE_SCALE);
  assert.ok(Math.abs(native.zoom-over.zoom*DETAIL_CAPTURE_SCALE)<1e-12);
  assert.ok(Math.hypot(native.x-over.x,native.y-over.y)<1e-8,'overscan changes coverage, not the grabbed map point');
  for(const [x,y]of [[1300,-700],[500,1000],[-1000,-2000]]){
   const a=detailScreen(native,map.cx+x,map.cy+y,size.width,size.height,width,height,tilt);
   const b=detailScreen(over,map.cx+x,map.cy+y,size.width,size.height,width,height,tilt,DETAIL_CAPTURE_SCALE);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,'centre cropping restores the original screen placement');
  }
  const anchorPixel=detailScreen(over,map.cx+1300,map.cy-700,size.width,size.height,width,height,tilt,DETAIL_CAPTURE_SCALE);
  assert.ok(Math.hypot(anchorPixel.x-state.anchor.x,anchorPixel.y-state.anchor.y)<1e-7);
  assert.ok(Math.max(size.width,size.height)<=1536,'overscan does not raise upload resolution');
 }
});
