import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_ISLANDS,WORLD_GEO,worldIsland,SPHERE_CIRCUMFERENCE} from '../src/pixi/world-map.js';
import {sphereFrame,expMap,logMap,dot,angle,cross,transport,arcDistance} from '../src/pixi/sphere.js';
import {mapPoint,spherePoint,localPoint,viewFrame} from '../src/pixi/sphere-coordinates.js';
import {placeRigid} from '../src/pixi/rigid.js';
import {sphereShores,sphereShoreGap,coastGaps,BOAT_CHANNEL} from '../src/pixi/sphere-shores.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {canSail,landingSpot,landingApproach,sailRoute,sailStep,SAIL_SPEED,destinationsFor,crossIsland} from '../src/pixi/islands.js';
import {readFileSync} from 'node:fs';

test('same small sphere, orthonormal patch frames and the North Pole on Iceland alone',()=>{
 assert.equal(WORLD_GEO.SX,SPHERE_CIRCUMFERENCE);
 assert.deepEqual(worldIsland('isle-55').center,[0,1,0]);
 for(const i of WORLD_ISLANDS){
  for(const v of [i.center,i.east,i.north])assert.ok(Math.abs(Math.hypot(...v)-1)<1e-12);
  assert.ok(Math.abs(dot(i.center,i.east))+Math.abs(dot(i.east,i.north))+Math.abs(dot(i.center,i.north))<1e-12);
  const pole=localPoint(i.id,[0,1,0]);
  assert.equal(mapOf(i.id).landAt(pole.x,pole.y),i.id==='isle-55',`${i.id}: only Iceland stands on the pole`);
 }   // boss 8 Nov: neighbours may cluster round the cap; their coasts keep a boat channel from Iceland's (coastGaps)
});
test('all actual spherical shores including islets and jetties leave a calm boat channel',()=>{
 const gaps=coastGaps();
 for(const {a,b,gap}of gaps)assert.ok(gap>=BOAT_CHANNEL,`${a}/${b}: ${gap}`);
 console.log('Minimum full spherical shore gap',gaps[0].gap,gaps[0].a,gaps[0].b);
});
test('shore gaps are exact: crossing or nested coasts read as zero, a sampled gap agrees with the slow scan',()=>{
 const home=worldIsland('home'),R=WORLD_GEO.Rw,shores=sphereShores(home);
 assert.equal(sphereShoreGap(shores,shores),0,'an island against itself');
 const m=mapOf('home'),east=Math.max(...m.world.coast.map(p=>p[0]))-m.cx,width=east+Math.max(...m.world.coast.map(p=>m.cx-p[0]));
 for(const shift of [width*.5,width+BOAT_CHANNEL]){
  const copy=sphereShores({...home,...sphereFrame(home.lon+shift/R,home.lat)}),d=sphereShoreGap(shores,copy);
  shift<width?assert.equal(d,0):assert.ok(Math.abs(d-BOAT_CHANNEL)<BOAT_CHANNEL*.6,`${d}`);
  if(!d)continue;
  let slow=Infinity;
  for(const [A,B]of [[shores,copy],[copy,shores]])for(const a of A)for(const b of B)for(const p of a.points)for(let k=0;k<b.points.length;k++)slow=Math.min(slow,arcDistance(p,b.points[k],b.points[(k+1)%b.points.length])*R);
  assert.ok(Math.abs(d-slow)<1e-6,`fast ${d}, direct scan ${slow}`);
 }
});
test('every map point round-trips through every island frame, including both sides of Iceland',()=>{
 for(const i of WORLD_ISLANDS){const m=mapOf(i.id);
  for(const from of WORLD_ISLANDS)for(const p of [m.spawn,m.HARBOR.water,{x:m.cx,y:m.cy-2000},{x:m.cx,y:m.cy+2000}]){
   const q=mapPoint(i.id,from.id,p),back=mapPoint(from.id,i.id,q);
   assert.ok(Math.hypot(back.x-p.x,back.y-p.y)<1e-7,`${i.id}/${from.id}`);
  }
 }
 const ice=mapOf('isle-55');
 for(const y of [-2000,0,2000]){
  const q=spherePoint('isle-55',{x:ice.cx,y:ice.cy+y});assert.ok(q.every(Number.isFinite));
  const v=viewFrame('isle-55',{x:ice.cx,y:ice.cy+y});assert.ok(Math.abs(dot(v.center,v.east))+Math.abs(dot(v.center,v.north))<1e-10);
 }
});
test('island shape is independent of latitude, with no polar wedge or anisotropic scaling',()=>{
 for(const lat of [-Math.PI/2,-.6,0,.6,Math.PI/2]){
  const frame=sphereFrame(.42,lat),R=WORLD_GEO.Rw;
  for(const [x,y]of [[0,0],[2000,0],[0,2000],[3000,-1800]]){
   const p=expMap(frame,x,y,R),q=logMap(frame,p,R);
   assert.ok(Math.hypot(q.x-x,q.y-y)<1e-8);
   assert.ok(Math.abs(angle(frame.center,p)*R-Math.hypot(x,y))<1e-8);
  }
 }
});
test('sailing to Iceland docks on its own jetty and beach from both hemispheres',()=>{
 const ice='isle-55',m=mapOf(ice);
 for(const from of ['home','isle-176','isle-170','isle-170']){
  const target=placeRigid(from,ice,m.HARBOR.water);   // the jetty as drawn (rigid frame)
  assert.ok(canSail(target.x,target.y,from));
  const spot=landingSpot({islandId:from,...target});assert.equal(spot?.islandId,ice);
  const approach=landingApproach({islandId:from,...target},spot);assert.ok(canSail(approach.x,approach.y,from));
  const start=mapOf(from).HARBOR.water,route=sailRoute(from,start,target);assert.ok(route?.length,from);
  let length=0,last=start;for(const q of route){length+=Math.hypot(q.x-last.x,q.y-last.y);last=q;}
  // Route samples and movement substeps must agree even when their phases differ.
  for(const dt of [1/60,.05,.1]){
   const actor={...start,islandId:from,mode:'sailing',sailTarget:route[0],sailRoute:route.slice(1)};
   for(let k=0;k<Math.ceil(length/(SAIL_SPEED*dt))+route.length+1&&actor.sailTarget;k++)sailStep(actor,dt,{x:0,y:0});
   assert.ok(Math.hypot(actor.x-target.x,actor.y-target.y)<1,`${from} at dt=${dt}: reaches ice without teleporting`);
   if(destinationsFor(from).some(d=>d.destination===ice)){assert.ok(crossIsland(actor));assert.equal(actor.islandId,ice);}
  }
 }
});
test('space outside the sphere cannot sample flat land, and activity is clipped to the ball',()=>{
 const code=readFileSync(new URL('../src/pixi/world-view.js',import.meta.url),'utf8');
 assert.match(code,/if\(edge>=1\.\)return space;/);
 assert.match(code,/life.mask=pin.mask=masking\?sphereMask:null/);
 assert.match(code,/if\(masking\)sphereMask\.circle/);   // the mask disc is only drawn while masking (else it showed as a white ball)
 assert.match(code,/life.mask=sphereMask;pin.mask=sphereMask/);
 assert.doesNotMatch(code,/texture\(uWorld,\s*fract|1\s*\/\s*Math\.max\(\.3,\s*Math\.cos/);
});

test('camera transport keeps a right-handed frame at the antipode and through a full turn',()=>{
 const frame=sphereFrame(0,0),R=WORLD_GEO.Rw;
 for(const a of [0,Math.PI/2,Math.PI-1e-7,Math.PI,Math.PI+1e-7,Math.PI*1.5,Math.PI*2]){
  const v=transport(frame,expMap(frame,a*R,0,R)),n=cross(v.center,v.east);
  assert.ok(Math.hypot(...n.map((x,k)=>x-v.north[k]))<1e-8);
  assert.ok(dot(v.north,frame.north)>.999999,'North remains up while turning east/west');
 }
});
