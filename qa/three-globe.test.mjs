import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from '../src/rendering/shared/globe-math.js';
import {Group,Object3D,Vector3 as ReferenceVector} from 'three';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import {ISLETS} from '../src/world/islets.js';
import {focusQuaternion,islandQuaternion,surfacePoint,trackballPoint,visiblePoint} from '../src/rendering/three/three-globe-math.js';

test('all nine island and eleven islet surface patches stay fixed under a shared globe rotation',()=>{
  for(const frame of [...WORLD_ISLANDS,...ISLETS]){
    const w=frame.width,h=frame.height??frame.width;
    const points=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>surfacePoint(frame,x,y,WORLD_GEO.Rw));
    for(const axis of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]){
      const q=new Quaternion().setFromAxisAngle(axis,2.3),rotated=points.map(p=>p.clone().applyQuaternion(q));
      for(let i=0;i<4;i++)for(let j=0;j<4;j++)assert.ok(Math.abs(points[i].distanceTo(points[j])-rotated[i].distanceTo(rotated[j]))<1e-12);
    }
  }
});
test('focusing any island centres its normal and preserves north and east, including both poles',()=>{
  for(const frame of WORLD_ISLANDS){
    const q=focusQuaternion(frame);
    for(const [axis,target]of [[frame.center,[0,0,1]],[frame.east,[1,0,0]],[frame.north,[0,1,0]]])assert.ok(new Vector3(...axis).applyQuaternion(q).distanceTo(new Vector3(...target))<1e-12,frame.id);
    assert.ok(islandQuaternion(frame).multiply(q).angleTo(new Quaternion())<1e-7);
  }
});
test('island patches have one parent transform and no relative movement during rotation',()=>{
  const globe=new Group();
  const patches=WORLD_ISLANDS.map(frame=>{const patch=new Object3D();patch.position.fromArray(frame.center).multiplyScalar(1.007);patch.quaternion.copy(islandQuaternion(frame));globe.add(patch);return patch;});
  const before=patches.map(p=>p.getWorldPosition(new ReferenceVector()));
  globe.quaternion.setFromUnitVectors(trackballPoint(400,300,400,300,250),trackballPoint(540,230,400,300,250));globe.updateMatrixWorld(true);
  const after=patches.map(p=>p.getWorldPosition(new ReferenceVector()));
  for(let i=0;i<patches.length;i++)for(let j=0;j<patches.length;j++)assert.ok(Math.abs(before[i].distanceTo(before[j])-after[i].distanceTo(after[j]))<1e-12);
});
test('far-side heart anchors are occluded by the sphere and front anchors remain visible',()=>{
  const camera=new Vector3(0,0,4.2);
  assert.equal(visiblePoint(new Vector3(0,0,1.007),camera),true);
  assert.equal(visiblePoint(new Vector3(0,0,-1.007),camera),false);
  assert.ok(Math.abs(trackballPoint(900,700,400,300,250).length()-1)<1e-12);
});

test('Earth art coordinates stay on the same sphere and round-trip without changing source maps',async()=>{
  const {surfacePoint,surfaceCoordinates,SURFACE_RADIUS}=await import('../src/rendering/three/three-globe-math.js');
  for(const frame of [...WORLD_ISLANDS,...ISLETS])for(const [x,y]of [[0,0],[1800,-900],[-1800,900]]){
    const point=surfacePoint(frame,x,y,WORLD_GEO.Rw);
    assert.ok(Math.abs(point.length()-SURFACE_RADIUS)<1e-12);
    const local=surfaceCoordinates(frame,point,WORLD_GEO.Rw);
    assert.ok(Math.hypot(local.x-x,local.y-y)<1e-8);
  }
});
test('continuous approach locks the same ground point under the cursor on every island and both poles',async()=>{
  const {PerspectiveCamera}=await import('three');
  const {surfaceUnderPointer,lockSurfaceAnchor,SURFACE_RADIUS}=await import('../src/rendering/three/three-globe-math.js');
  let worst=0;
  for(const frame of WORLD_ISLANDS){
    const camera=new PerspectiveCamera(35,1600/900,.001,20);camera.position.z=5.2;camera.updateMatrixWorld(true);
    const q=focusQuaternion(frame),x=860,y=420;
    const point=surfaceUnderPointer(camera,x,y,1600,900).applyQuaternion(q.clone().invert());
    for(let step=0;step<=240;step++){
      camera.position.z=1+Math.exp(Math.log(4.2)+(Math.log(.018)-Math.log(4.2))*step/240);
      assert.equal(lockSurfaceAnchor(q,point,camera,x,y,1600,900),true);
      const projected=point.clone().multiplyScalar(SURFACE_RADIUS).applyQuaternion(q).project(camera);
      const error=Math.hypot((projected.x+1)*800-x,(1-projected.y)*450-y);worst=Math.max(worst,error);
      assert.ok(error<1e-5,`${frame.id}: ${error}`);
    }
  }
  console.log('Worst Earth zoom-anchor drift:',worst,'px');
});
test('straight zoom introduces no camera roll or heading reset',async()=>{
  const {PerspectiveCamera}=await import('three');
  const {surfaceUnderPointer,lockSurfaceAnchor}=await import('../src/rendering/three/three-globe-math.js');
  for(const frame of WORLD_ISLANDS){
    const camera=new PerspectiveCamera(35,16/9,.001,20);camera.position.z=5.2;
    const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.7).multiply(focusQuaternion(frame)),before=q.clone();
    const point=surfaceUnderPointer(camera,800,450,1600,900).applyQuaternion(q.clone().invert());
    for(const z of [4,3,2,1.7,1.3,1.1,1.02]){camera.position.z=z;lockSurfaceAnchor(q,point,camera,800,450,1600,900);assert.ok(q.angleTo(before)<1e-7);}
  }
});
test('live detail atlas cancels each neighbouring chart rotation without changing the camera angle',async()=>{
  const {atlasUV}=await import('../src/rendering/three/three-globe-math.js');
  const {flatRigid}=await import('../src/world/rigid.js');
  const {cameraMatrix}=await import('../src/rendering/shared/sphere-camera.js');
  for(const island of WORLD_ISLANDS){
    const placement=flatRigid('home',island.id),matrix=cameraMatrix({x:placement.x,y:placement.y,zoom:.2},1280,1280);
    const center=atlasUV(0,0,placement,matrix,1280,1280);assert.ok(Math.hypot(center.u-.5,center.v-.5)<1e-12);
    const e=atlasUV(100,0,placement,matrix,1280,1280),s=atlasUV(0,100,placement,matrix,1280,1280);
    const ex=e.u-center.u,ey=-(e.v-center.v),sx=s.u-center.u,sy=-(s.v-center.v);
    assert.ok(Math.abs(ex*sx+ey*sy)<1e-12);
    assert.ok(Math.abs(Math.hypot(ex,ey)-Math.hypot(sx,sy))<1e-12);
    assert.ok(ex*sy-ey*sx>0);
  }
});
