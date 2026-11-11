import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {focusQuaternion,lockSurfaceAnchor} from '../src/pixi/three-globe-math.js';
import {alignIslandNorth,approachProgress} from '../src/pixi/three-island-approach.js';
import {detailBlend,directDetail} from '../src/pixi/three-detail-view.js';

test('heading gate keeps rapid all-island approaches curved until north is safe for a non-collapsing morph',()=>{
 let cases=0,unsafeWithoutGate=0;
 for(const hz of [60,120])for(const roll of [0,45,90,135,180])for(const start of [4.2,.65,.4])for(const target of [.018,.14])for(const frame of WORLD_ISLANDS){
  const camera=new PerspectiveCamera(35,16/9,.001,20);camera.position.z=1+start;camera.updateMatrixWorld(true);
  const q=focusQuaternion(frame).premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),roll*Math.PI/180));
  const anchor=new Vector3(...frame.center),initial=alignIslandNorth(q,frame,anchor,camera,0);
  let altitude=start,flatFrames=0,entered=false,sawUnsafe=false;
  for(let k=0;k<hz*3;k++){
   altitude=Math.exp(Math.log(altitude)+(Math.log(target)-Math.log(altitude))*(1-Math.exp(-18/hz)));
   camera.position.z=1+altitude;camera.updateMatrixWorld(true);
   assert.ok(lockSurfaceAnchor(q,anchor,camera,960,540,1920,1080));
   alignIslandNorth(q,frame,anchor,camera,1-Math.exp(-14/hz),2.4/hz,initial*(1-approachProgress(start,altitude)));
   const heading=alignIslandNorth(q,frame,anchor,camera,0),blend=detailBlend(altitude,heading);
   if(detailBlend(altitude)>.1&&Math.abs(heading)>Math.PI/2)sawUnsafe=true;
   if(Math.abs(heading)>=70*Math.PI/180)assert.equal(blend,0,'a rotated capture cannot start flattening into its opposite orientation');
   if(blend>0)assert.ok(Math.abs(heading)<70*Math.PI/180,'active morph stays away from the 180-degree singularity');
   flatFrames=blend===1?flatFrames+1:0;
   const direct=directDetail(altitude,false,true)&&flatFrames>=2;
   if(direct){assert.equal(blend,1);assert.ok(Math.abs(heading)<=10*Math.PI/180+1e-12);entered=true;}
  }
  assert.ok(entered,'heading gate eventually yields native ownership without increasing rotation speed');
  if(sawUnsafe)unsafeWithoutGate++;cases++;
 }
 assert.equal(cases,540);assert.ok(unsafeWithoutGate>0,'exercise the rapid-zoom bug rather than only already-upright approaches');
});

test('north gate is smooth, symmetric and cannot expose native detail from invalid heading state',()=>{
 assert.equal(detailBlend(.12,Math.PI),0);assert.equal(detailBlend(.12,70*Math.PI/180),0);
 assert.equal(detailBlend(.12,10*Math.PI/180),1);assert.equal(detailBlend(.12,0),1);
 assert.equal(detailBlend(.12,NaN),0);
 for(const d of [15,30,45,60]){
  const positive=detailBlend(.12,d*Math.PI/180),negative=detailBlend(.12,-d*Math.PI/180);
  assert.ok(positive>0&&positive<1);assert.equal(positive,negative);
 }
 assert.ok(detailBlend(.12,69.9*Math.PI/180)<.000001,'soft start');
 assert.ok(1-detailBlend(.12,10.1*Math.PI/180)<.000001,'soft finish');
});
