import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Vector2,Matrix3} from 'three';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/pixi/world-map.js';
import {flatRigid} from '../src/pixi/rigid.js';
import {cameraMatrix} from '../src/pixi/sphere-camera.js';
import {atlasTransform,atlasUV,pickSurfacePatch,focusQuaternion} from '../src/pixi/three-globe-math.js';
import {RenderDemand} from '../src/pixi/three-render-demand.js';

test('stationary globe avoids redraws while every camera frame and new texture still draws',()=>{
  const demand=new RenderDemand();assert.equal(demand.consume(),true);
  for(let i=0;i<240;i++)assert.equal(demand.consume(),false);
  for(let i=0;i<120;i++)assert.equal(demand.consume(true),true);
  assert.equal(demand.consume(),false);
  demand.invalidate();assert.equal(demand.consume(),true);assert.equal(demand.consume(),false);
});
test('GPU atlas transform matches the previous per-vertex mapping at every zoom and chart rotation',()=>{
  let worst=0;
  for(const island of WORLD_ISLANDS)for(const zoom of [.08,.5,1.6]){
    const r=flatRigid('home',island.id),angle=.4,m=cameraMatrix({x:r.x+143,y:r.y-267,zoom,basis:{a:Math.cos(angle),b:Math.sin(angle),c:-Math.sin(angle),d:Math.cos(angle)}},1536,1536);
    const t=atlasTransform(island.width,island.height,r,m,1536,1536),gpu=new Matrix3().set(t.a,t.c,t.x,t.b,t.d,t.y,0,0,1);
    for(let a=0;a<=10;a++)for(let b=0;b<=10;b++){
      const u=a/10,v=b/10,p=new Vector2(u,v).applyMatrix3(gpu),expected=atlasUV((u-.5)*island.width,(.5-v)*island.height,r,m,1536,1536);
      const error=Math.hypot(p.x-expected.u,p.y-expected.v);worst=Math.max(worst,error);assert.ok(error<1e-12);
    }
  }
  console.log('Worst GPU atlas mapping delta:',worst);
});
test('analytic picking selects every visible island, including polar islands, and rejects empty space',()=>{
  const camera=new PerspectiveCamera(35,16/9,.2,20);camera.position.z=5.2;camera.updateMatrixWorld(true);
  for(const island of WORLD_ISLANDS){
    const q=focusQuaternion(island),hit=pickSurfacePatch(camera,q,800,450,1600,900,WORLD_ISLANDS,WORLD_GEO.Rw);
    assert.equal(hit?.id,island.id);assert.ok(Math.hypot(hit.x,hit.y)<1e-8);
    assert.equal(pickSurfacePatch(camera,q,0,0,1600,900,WORLD_ISLANDS,WORLD_GEO.Rw),null);
  }
});
