import test from 'node:test';
import assert from 'node:assert/strict';
import {globeScreen,globeWeight} from '../src/rendering/shared/globe-screen.js';
import {spherePoint,localPoint,viewFrame} from '../src/world/sphere-coordinates.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {flatRigid,shearOf} from '../src/world/rigid.js';
import {turnLongitude} from '../src/rendering/shared/sphere-camera.js';
import {dot,angle,expMap,sphereFrame} from '../src/world/sphere.js';
import {ISLETS} from '../src/world/islets.js';

const W=1440,H=900,id='home',Rw=WORLD_GEO.Rw,zoom=.0329;
const island=i=>{const m=mapOf(i.id);return (x,y)=>spherePoint(i.id,{x:m.cx+x,y:m.cy+y});};
function drags(){
 const out=[],cam={...localPoint(id,spherePoint(id,{x:mapOf(id).cx,y:mapOf(id).cy})),zoom};
 const tilt=(c,rad)=>{const v=viewFrame(id,c),p=v.center.map((x,k)=>x*Math.cos(rad)+v.north[k]*Math.sin(rad));return Object.assign(c,localPoint(id,p));};
 for(let k=0;k<10;k++){
  out.push({...cam});
  turnLongitude(id,cam,.45);if(k%3===1)tilt(cam,.3);if(k%4===3)tilt(cam,-.5);
 }
 return out;
}
const lensOf=(p,view,ball,Rp)=>{
 const a=angle(p,view.center),e=dot(p,view.east),n=dot(p,view.north),s=Math.hypot(e,n),r=((1-ball)*a+ball*Math.sin(a))*Rp;
 return s<1e-12?{x:W/2,y:H/2,a}:{x:W/2+e/s*r,y:H/2-n/s*r,a};
};

test('dragging the ball: every island centre is the sphere projection of its true centre (within 1px)',()=>{
 let maxErr=0,seen=0;
 for(const ball of [1,.766,.465,.3])for(const cam of drags()){
  const G=globeScreen({id,cam,ball,w:W,h:H}),view=viewFrame(id,cam),Rp=Rw*cam.zoom;
  for(const i of WORLD_ISLANDS){
   const st=G.sticker(island(i),4),truth=lensOf(i.center,view,ball,Rp);
   if(dot(i.center,view.center)<=0){assert.equal(st,null,`${i.id} on the far side is hidden`);continue;}
   if(!st)continue;
   seen++;maxErr=Math.max(maxErr,Math.hypot(st.x-truth.x,st.y-truth.y));
   assert.ok(shearOf({a:st.cos,b:st.sin,c:-st.sin,d:st.cos}).shearDeg<1e-9,'rigid: no shear');
  }
  for(const it of ISLETS){
   const st=G.sticker((x,y)=>expMap(it,x,y,Rw),2);if(!st)continue;
   const truth=lensOf(it.center,view,ball,Rp);maxErr=Math.max(maxErr,Math.hypot(st.x-truth.x,st.y-truth.y));
  }
 }
 assert.ok(seen>100,`checked ${seen} island views`);
 assert.ok(maxErr<1,`max centre error ${maxErr.toFixed(4)}px`);
 console.log(`# globe rotation: ${seen} island views, max centre error ${maxErr.toExponential(2)} px`);
});

test('a turned ball keeps the islands in one rigid layout: unprojected centres give back the true sphere',()=>{
 for(const cam of drags()){
  const G=globeScreen({id,cam,ball:1,w:W,h:H}),view=viewFrame(id,cam),Rp=Rw*cam.zoom,back={};
  for(const i of WORLD_ISLANDS){
   const st=G.sticker(island(i),4);if(!st)continue;
   const x=(st.x-W/2)/Rp,y=-(st.y-H/2)/Rp,z=Math.sqrt(Math.max(0,1-x*x-y*y));
   back[i.id]=view.center.map((v,k)=>v*z+view.east[k]*x+view.north[k]*y);
   assert.ok(angle(back[i.id],i.center)<2e-4,`${i.id} sits where the sphere says`);
  }
  const ids=Object.keys(back),byId=new Map(WORLD_ISLANDS.map(i=>[i.id,i]));
  assert.equal(ids.length,WORLD_ISLANDS.filter(i=>dot(i.center,view.center)>0).length,'all front-facing island centres participate');
  for(const a of ids)for(const b of ids)if(a<b)
   assert.ok(Math.abs(angle(back[a],back[b])-angle(byId.get(a).center,byId.get(b).center))<3e-4,`${a}-${b} angle kept`);
 }
});

test('the same island seen from two turns of the ball moves like a point on a turning sphere',()=>{
 const cam={...localPoint(id,sphereFrame(.2,.1).center),zoom},a=globeScreen({id,cam,ball:1,w:W,h:H});
 const turned=turnLongitude(id,{...cam},.3),b=globeScreen({id,cam:turned,ball:1,w:W,h:H});
 for(const i of WORLD_ISLANDS){
  const p=a.sticker(island(i),4),q=b.sticker(island(i),4);if(!p||!q)continue;
  const vq=viewFrame(id,turned),t=lensOf(i.center,vq,1,Rw*zoom);
  assert.ok(Math.hypot(q.x-t.x,q.y-t.y)<1);
 }
});

test('at ball 0 the stickers keep the exact flat placement; between, they blend smoothly to the sphere',()=>{
 for(const cam of drags()){
  const G=globeScreen({id,cam,ball:0,w:W,h:H});
  for(const i of WORLD_ISLANDS){
   const st=G.sticker(island(i),16);if(!st)continue;
   const F=flatRigid(id,i.id),x=W/2+(F.x-cam.x)*cam.zoom,y=H/2+(F.y-cam.y)*cam.zoom;
   assert.ok(Math.hypot(st.x-x,st.y-y)<1e-6,`${i.id} flat placement unchanged`);
   assert.ok(Math.abs(st.cos-F.a)<1e-3&&Math.abs(st.sin-F.b)<1e-3,'flat turn unchanged');
   assert.ok(Math.abs(st.scale-cam.zoom)<1e-12);
  }
  const ball=.1,B=globeScreen({id,cam,ball,w:W,h:H}),k=B.weight,view=viewFrame(id,cam);
  assert.ok(k>=globeWeight(ball)-1e-12&&k<=1,'the sphere never weighs less than the near-anchor morph');
  for(const i of WORLD_ISLANDS){
   const st=B.sticker(island(i),16);if(!st)continue;
   const F=flatRigid(id,i.id),L=lensOf(i.center,view,ball,Rw*cam.zoom);
   const x=(1-k)*(W/2+(F.x-cam.x)*cam.zoom)+k*L.x,y=(1-k)*(H/2+(F.y-cam.y)*cam.zoom)+k*L.y;
   assert.ok(Math.hypot(st.x-x,st.y-y)<1e-6);
  }
 }
 assert.equal(globeWeight(0),0);assert.equal(globeWeight(0,1),0);assert.equal(globeWeight(.25),1);
 assert.equal(globeScreen({id,cam:{...localPoint(id,spherePoint(id,{x:mapOf(id).cx,y:mapOf(id).cy})),zoom},ball:.1,w:W,h:H}).weight,globeWeight(.1),'at Home the morph is the shader\'s own');
});

test('islands are rigid stickers at the flat end and painted on the ball from ball .6 (boss 8 Nov, "not a 3D globe")',async()=>{
 const {paintWeight}=await import('../src/rendering/shared/globe-screen.js');
 assert.equal(paintWeight(0),0);assert.equal(paintWeight(.1),0);assert.equal(paintWeight(.6),1);assert.equal(paintWeight(1),1);
 const code=(await import('node:fs')).readFileSync(new URL('../src/rendering/pixi/world-view.js',import.meta.url),'utf8');
 assert.match(code,/vec2 chartQ\(vec3 c,vec3 e,vec3 n,vec3 p\)/,'each island is looked up through its own sphere chart');
 assert.match(code,/return mix\(stickQ\(S,X\),b,k\);/,'blended in coordinates, never colours');
});
