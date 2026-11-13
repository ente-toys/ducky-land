import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_GEO,WORLD_ISLANDS} from '../src/world/world-map.js';
import {mapPoint,spherePoint,localPoint,viewFrame} from '../src/world/sphere-coordinates.js';
import {landingBasis,easeLandingBasis,cameraMatrix,canonicalCamera,turnLongitude,cameraSpan} from '../src/rendering/shared/sphere-camera.js';
import {horizonRatio,lensAngle,spherePixel} from '../src/world/sphere-projection.js';
import {nearbyHeading} from '../src/app/nearby-map.js';
import {dot} from '../src/world/sphere.js';

const R=WORLD_GEO.Rw;
test('landing preserves nearby landmarks through large turns and never collapses during its settle',()=>{
 for(const from of ['isle-251','isle-250','isle-55','home']){
  const to='isle-55',m=mapOf(to),at={...m.HARBOR.water,zoom:.7},old=mapPoint(to,from,at);
  const start=landingBasis(from,to,at),basis=easeLandingBasis(start,0),matrix=cameraMatrix({...at,basis},1440,900);
  for(const [x,y]of [[0,0],[20,0],[0,20],[-20,-20]]){
   const p={x:old.x+x,y:old.y+y},q=mapPoint(from,to,p);
   const before={x:720+(p.x-old.x)*at.zoom,y:450+(p.y-old.y)*at.zoom};
   const after={x:matrix.a*q.x+matrix.c*q.y+matrix.tx,y:matrix.b*q.x+matrix.d*q.y+matrix.ty};
   assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<.06,from);
  }
  for(let i=0;i<=100;i++){const b=easeLandingBasis(start,i/100);assert.ok(b.a*b.d-b.b*b.c>.95,'no mirrored/collapsed frame');}
  assert.deepEqual(easeLandingBasis(start,1),{a:1,b:0,c:0,d:1});
  const span=cameraSpan({...at,basis},1440,900),det=basis.a*basis.d-basis.b*basis.c;
  for(const [x,y]of [[720,450],[-720,450],[720,-450],[-720,-450]]){
    assert.ok(Math.abs((basis.d*x-basis.c*y)/det)<=span.width/2+1e-8);
    assert.ok(Math.abs((-basis.b*x+basis.a*y)/det)<=span.height/2+1e-8,'rotated viewport cannot cull a visible corner');
  }
 }
});
test('flat headings stay north-up on both sides of Iceland',()=>{
 const m=mapOf('isle-55');
 for(const [x,y]of [[0,0],[0,-1],[0,1],[2000,-1800]]){
  const p={x:m.cx+x,y:m.cy+y};
  assert.equal(nearbyHeading('isle-55',p,1,0),90);
  assert.equal(nearbyHeading('isle-55',p,0,-1),0);
 }
});
test('idle longitude spin preserves latitude through a full revolution from every island',()=>{
 for(const i of WORLD_ISLANDS){const m=mapOf(i.id),p={x:m.cx+1200,y:m.cy-800},initial=spherePoint(i.id,p);
  for(let k=0;k<360;k++){turnLongitude(i.id,p,Math.PI/180);assert.ok(Math.abs(spherePoint(i.id,p)[1]-initial[1])<1e-10);}
  assert.ok(Math.hypot(...spherePoint(i.id,p).map((v,k)=>v-initial[k]))<1e-9);
 }
});
test('a drag beyond the antipode canonicalizes to the same sphere point inside the chart',()=>{
 for(const i of WORLD_ISLANDS){const m=mapOf(i.id),c={x:m.cx+R*Math.PI*1.12,y:m.cy+1000,zoom:.4},p=spherePoint(i.id,c);
  canonicalCamera(i.id,c);assert.ok(Math.hypot(c.x-m.cx,c.y-m.cy)<=Math.PI*R+1e-8);
  assert.ok(Math.hypot(...spherePoint(i.id,c).map((v,k)=>v-p[k]))<1e-10);
 }
});
test('zoom lens stays monotone on the front hemisphere with an expanding flat horizon',()=>{
 for(const b of [0,.01,.1,.3,.5,.7,.9,.99,1]){let last=-1;
  for(let k=0;k<=200;k++){const r=horizonRatio(b)*k/200,a=lensAngle(r,b);assert.ok(a>=last-1e-10&&a<=Math.PI/2+1e-10);assert.ok(Math.abs((1-b)*a+b*Math.sin(a)-r)<1e-5);last=a;}
 }
 const m=mapOf('home'),c={x:m.cx,y:m.cy,zoom:.045};
 assert.ok(spherePixel('home',c,719,449,0),'no hard disc cut at the formerly broken flat zoom');
 for(const px of [0,.15,.45,.85].map(f=>f*R*c.zoom)){const p=spherePixel('home',c,px,0,1),v=viewFrame('home',c);assert.ok(p&&dot(p,v.center)>=0);assert.ok(Math.abs(dot(p,v.east)-px/(R*c.zoom))<1e-10);}
 assert.equal(spherePixel('home',c,R*c.zoom+1,0,1),null,'no land outside the full sphere');
 for(const id of ['home','isle-249','isle-55']){const m=mapOf(id),camera={x:m.cx,y:m.cy,zoom:.04},v=viewFrame(id,camera);
  for(const b of [.25,.5,.75,1])for(let k=0;k<24;k++){
    const r=R*camera.zoom*horizonRatio(b)*.999,a=k*Math.PI/12,p=spherePixel(id,camera,r*Math.cos(a),r*Math.sin(a),b);
    assert.ok(dot(p,v.center)>=-1e-10,'curved islands stay on the front hemisphere at the limb');
  }
 }
});
