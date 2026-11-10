import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Quaternion,Vector3} from 'three';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/pixi/world-map.js';
import {transport} from '../src/pixi/sphere.js';
import {surfacePoint,focusQuaternion,lockSurfaceAnchor,SURFACE_RADIUS} from '../src/pixi/three-globe-math.js';
import {alignIslandNorth,approachProgress} from '../src/pixi/three-island-approach.js';

test('every island eases upright during approach while the same off-centre ground point stays under the cursor, including both poles',()=>{
 let drift=0;
 for(const frame of WORLD_ISLANDS){
  const camera=new PerspectiveCamera(35,16/9,.001,20);camera.position.z=5.2;camera.updateMatrixWorld(true);
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),1.1).multiply(focusQuaternion(frame));
  const anchor=surfacePoint(frame,350,-150,WORLD_GEO.Rw).normalize();
  let initialHeading;
  for(let step=0;step<=300;step++){
   const altitude=4.2*Math.pow(.04/4.2,step/300);camera.position.z=1+altitude;camera.updateMatrixWorld(true);
   assert.ok(lockSurfaceAnchor(q,anchor,camera,860,420,1600,900));
   initialHeading??=alignIslandNorth(q,frame,anchor,camera,0);
   alignIslandNorth(q,frame,anchor,camera,1-Math.exp(-14/60),2.4/60,initialHeading*(1-approachProgress(4.2,altitude)));
   const p=anchor.clone().multiplyScalar(SURFACE_RADIUS).applyQuaternion(q).project(camera);
   drift=Math.max(drift,Math.hypot((p.x+1)*800-860,(1-p.y)*450-420));
  }
  const normal=anchor.clone().applyQuaternion(q),position=normal.clone().multiplyScalar(SURFACE_RADIUS);
  const north=new Vector3(...transport(frame,anchor.toArray()).north).applyQuaternion(q);
  const a=position.clone().project(camera),b=position.clone().addScaledVector(north,1e-6).project(camera);
  assert.ok(b.y>a.y,'north points toward the top of the screen');
  assert.ok(Math.abs((b.x-a.x)/(b.y-a.y))<.001,'no residual sideways lean on arrival');
 }
 assert.ok(drift<1e-6,`worst anchor drift ${drift}px`);
});

test('alignment takes the short turn, limits angular speed and can be stopped between frames',()=>{
 const frame=WORLD_ISLANDS[0],camera=new PerspectiveCamera(35,1,.001,20);camera.position.z=1.2;
 const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),2.5).multiply(focusQuaternion(frame)),anchor=new Vector3(...frame.center);
 const before=q.clone();alignIslandNorth(q,frame,anchor,camera,1,.025);assert.ok(before.angleTo(q)<=.025+1e-10);
 const stopped=q.clone();alignIslandNorth(q,frame,anchor,camera,0);assert.ok(stopped.angleTo(q)<1e-7);
});

test('upright easing settles equally at 30, 60 and 144 Hz',()=>{
 const frame=WORLD_ISLANDS[0],camera=new PerspectiveCamera(35,1,.001,20);camera.position.z=1.12;
 const results=[30,60,144].map(fps=>{
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.9).multiply(focusQuaternion(frame));
  for(let i=0;i<fps;i++)alignIslandNorth(q,frame,new Vector3(...frame.center),camera,1-Math.exp(-12/fps));
  return q;
 });
 for(const q of results)assert.ok(q.angleTo(results[0])<1e-7);
});

 test('rotation progresses across the entire perceived zoom, with soft starts and stops',()=>{
  const start=4.2,end=.14,p=t=>approachProgress(start,start*Math.pow(end/start,t));
  assert.equal(p(0),0);assert.equal(p(1),1);
  assert.ok(p(.25)>.1&&p(.25)<.2,'turning has already begun in the first quarter');
  assert.ok(Math.abs(p(.5)-.5)<1e-12,'halfway through zoom is halfway through rotation');
  assert.ok(p(.75)>.8&&p(.75)<.9,'the last quarter still has rotation left');
  assert.ok(p(.01)<.0001&&1-p(.99)<.0001,'no sudden angular start or final snap');
 });
