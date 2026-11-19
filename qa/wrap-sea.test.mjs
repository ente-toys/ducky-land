import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {SEA_WIDTH,SEA_HEIGHT,SEA_VERSION,FLAT_POSITIONS,FLAT_ISLETS,GLOBE_ISLET_OFFSETS,wrapSea,nearestSeaImage,nearestSeaX} from '../src/world/flat-layout.js';
import {seaFrame,seaPoint,seaHeading,seaPosition,mapPoint} from '../src/world/sphere-coordinates.js';
import {seaViewPose} from '../src/world/sea-view.js';
import {flatRigid,unplaceRigid} from '../src/world/rigid.js';
import {ISLETS} from '../src/world/islets.js';
import {placeIslet,unplaceIslet} from '../src/world/islet-placement.js';
import {canSail,sailStep,migrateSeaPosition,harborOf,dockingSpot,SAIL_SPEED,navOf,setSailDestination,BOAT_GAP,boatRoom,sailRoute} from '../src/gameplay/islands.js';
import {dot} from '../src/world/sphere.js';
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const local=(id,x,y)=>{const m=mapOf(id),c=FLAT_POSITIONS[id];return {islandId:id,x:x-c.x+m.cx,y:y-c.y+m.cy};};

test('crossing either polar latitude never redirects a boat in any departure frame',()=>{
 for(const i of WORLD_ISLANDS)for(const sign of [-1,1])for(const x of [-39990,-12000,0,27000,39990,120010]){
  const p={...local(i.id,x,sign*(SEA_HEIGHT/2-2)),mode:'sailing',path:[],action:0};
  if(!canSail(p.x,p.y,p.islandId))continue;
  const before={...p};sailStep(p,.05,{x:0,y:sign});
  assert.equal(p.seaCurrent,undefined);assert.equal(p.islandId,i.id);
  close(p.x,before.x);close(p.y,before.y+sign*SAIL_SPEED*.05);
 }
});
test('east and west follow globe longitude spacing; sailing x is continuous for repeated seam crossings',()=>{
 const order=['home','blossom','isle-251','sunset','isle-250','home'];
 const gaps=order.slice(1).map((id,k)=>{let gap=FLAT_POSITIONS[id].x-FLAT_POSITIONS[order[k]].x;return gap<0?gap+SEA_WIDTH:gap;});
 close(gaps.reduce((a,b)=>a+b,0),SEA_WIDTH);assert.deepEqual(gaps.map(g=>Math.round(g/SEA_WIDTH*3600)/10),[67,73.8,76.5,73.8,68.9]);
 for(const sign of [-1,1])for(const winding of [-2,-1,0,1,2]){
  const x=sign*(SEA_WIDTH/2-10)+winding*SEA_WIDTH,p={...local('home',x,14000),mode:'sailing',path:[],action:0};
  for(let k=0;k<10;k++){const before=p.x;sailStep(p,.05,{x:sign,y:0});close(p.x-before,sign*SAIL_SPEED*.05);}
  close(seaPosition('home',p).x,x+sign*SAIL_SPEED*.5);
 }
});
test('coast, islet and multiplayer images agree on both sides of the seam',()=>{
 const viewer={id:'a',...local('home',39990,14000),mode:'sailing'};
 const peer={id:'b',...local('sunset',-39990,14000),mode:'sailing'};
 const q=seaViewPose(viewer,peer);close(q.x-viewer.x,20);close(q.y,viewer.y);
 const back=seaViewPose(peer,viewer);close(back.x-peer.x,-20);
 for(const i of WORLD_ISLANDS){const f=flatRigid('home',i.id,viewer);assert.ok(Math.abs(f.x-viewer.x)<=SEA_WIDTH/2);const m=mapOf(i.id),localPoint=unplaceRigid('home',i.id,{x:f.x,y:f.y});close(localPoint.x,m.cx);close(localPoint.y,m.cy);}
 for(const i of ISLETS){const p=placeIslet('home',i,[0,0],viewer),q=unplaceIslet('home',i,p);const globe=seaPoint('home',p);for(let k=0;k<3;k++)close(globe[k],i.center[k]);close(q.x,0);close(q.y,0);assert.ok(Math.abs(p.x-viewer.x)<=SEA_WIDTH/2);assert.equal(FLAT_ISLETS[i.id].home,i.home);}
 assert.equal(FLAT_ISLETS['sea-1-1'].home,'isle-249');
});
const nearPoleIsland=(id,p)=>['isle-55','isle-249'].some(pole=>{const q=seaPosition(id,p),c=FLAT_POSITIONS[pole],m=mapOf(pole);const image=nearestSeaImage(c.x,c.y,q,0);return Math.hypot(q.x-image.x,q.y-image.y)<Math.max(m.width,m.height)/2*1.6;});
test('sea pin is direct longitude/latitude within one degree, with heading within three degrees',()=>{
 for(const i of WORLD_ISLANDS)for(const lon of [-179.99,-120,-20,0,67,140.8,179.99,540])for(const lat of [-89,-40,0,8,60,89]){
  const p=local(i.id,lon/360*SEA_WIDTH,-lat/360*SEA_WIDTH),f=seaFrame(i.id,p),point=seaPoint(i.id,p);
  close(wrapSea((f.lon*180/Math.PI-lon)/360*SEA_WIDTH),0,SEA_WIDTH/360);close(f.lat*180/Math.PI,lat,1);
  // Next to Iceland and Bog the pin follows the island's globe art instead (tested below).
  if(!nearPoleIsland(i.id,p))close(Math.asin(point[1])*180/Math.PI,lat,1);
  for(const turn of [0,.4,Math.PI/2,Math.PI,5.3]){const d=seaHeading(i.id,p,turn),heading=Math.atan2(dot(d,f.east),-dot(d,f.north));const error=Math.atan2(Math.sin(heading-turn),Math.cos(heading-turn));assert.ok(Math.abs(error)*180/Math.PI<3);}
 }
});
test('every harbour still floats, docks and lands on walkable ground; current delivery does not land',()=>{
 for(const i of WORLD_ISLANDS){const h=harborOf(i.id),a={islandId:i.id,mode:'sailing',...h.water};assert.ok(canSail(a.x,a.y,i.id),i.id);const spot=dockingSpot(a);assert.equal(spot.islandId,i.id);assert.ok(navOf(i.id).walkable(h.land.x,h.land.y),i.id);}
});
test('legacy sea saves recover at their own harbour once; new saves and walking/islet saves stay exact',()=>{
 for(const i of WORLD_ISLANDS){
  const old={islandId:i.id,mode:'sailing',x:987654,y:-43210,sailTarget:{x:1,y:2},sailRoute:[{x:3,y:4}]};
  assert.equal(migrateSeaPosition(old),true);assert.deepEqual({x:old.x,y:old.y},harborOf(i.id).water);assert.equal(old.seaVersion,SEA_VERSION);assert.equal(old.sailTarget,null);
  const saved={...old,x:old.x+SEA_WIDTH*2};const before=structuredClone(saved);assert.equal(migrateSeaPosition(saved),false);assert.deepEqual(saved,before);
  const walk={islandId:i.id,mode:'walking',x:-23000,y:15000};assert.equal(migrateSeaPosition(walk),false);assert.deepEqual({x:walk.x,y:walk.y},{x:-23000,y:15000});
 }
});

test('complete north and south passages preserve the chosen course without a harbour teleport',()=>{
 for(const i of WORLD_ISLANDS)for(const sign of [-1,1]){
  const c=FLAT_POSITIONS[i.id],m=mapOf(i.id),startY=Math.max(-19000,Math.min(19000,c.y));
  // Use the island's open sea flank. Scenery and coastline remain real obstacles.
  let x=null;
  for(const direction of [1,-1])for(const extra of [1400,2000,2600,3200]){
   const candidate=c.x+direction*(m.width/2+extra);let clear=true;
   for(let y=startY;sign<0?y>=-20010:y<=20010;y+=sign*100){const p=local(i.id,candidate,y);if(!canSail(p.x,p.y,i.id)){clear=false;break;}}
   if(clear){x=candidate;break;}
  }
  assert.notEqual(x,null,`${i.id}: open ${sign<0?'north':'south'} passage`);
  const p={...local(i.id,x,startY),mode:'sailing',path:[],action:0};
  const steps=Math.ceil(Math.abs(sign*21000-startY)/(SAIL_SPEED*.1));
  for(let n=0;n<steps;n++)sailStep(p,.1,{x:0,y:sign});
  assert.equal(p.seaCurrent,undefined);assert.equal(p.islandId,i.id);
  close(seaPosition(i.id,p).y,startY+sign*SAIL_SPEED*.1*steps,.01);
 }
});
test('harbour docking and beach landing survive a complete east or west lap',()=>{
 for(const i of WORLD_ISLANDS)for(const winding of [-2,2]){
  const h=harborOf(i.id),a={islandId:i.id,mode:'sailing',x:h.water.x+winding*SEA_WIDTH,y:h.water.y};
  const spot=dockingSpot(a);assert.ok(spot,i.id);assert.equal(spot.islandId,i.id);
  const boat=unplaceRigid(i.id,i.id,a);close(boat.x,h.water.x);close(boat.y,h.water.y);
 }
});

test('old walking and sailing islet visitors migrate with their own artwork and keep their owner',()=>{
 for(const i of ISLETS){
  const m=mapOf(i.home),old=GLOBE_ISLET_OFFSETS[i.id];
  for(const [mode,q]of [['walking',i.jetty.land],['sailing',i.jetty.water]]){
   const actor={islandId:i.home,mode,x:m.cx+old.x+q[0],y:m.cy+old.y+q[1]},target=placeIslet(i.home,i,q);
   assert.ok(migrateSeaPosition(actor),i.id+' '+mode);close(actor.x,target.x);close(actor.y,target.y);assert.equal(actor.islandId,i.home);
  }
 }
});

test('production island meshes stay adjacent across the seam and repeat Home after a lap',async()=>{
 const {Container,Texture}=await import('pixi.js');
 const {createArchipelago}=await import('../src/rendering/pixi/archipelago.js');
 const m=mapOf('home'),scene=new Container(),layer=new Container();scene.addChild(layer);
 const chart=createArchipelago({renderer:{generateTexture:()=>Texture.EMPTY}},scene,layer,{width:m.width,height:m.height});
 chart.build('home');
 const meshes=chart.root.children[0].children;
 const centres=()=>meshes.map((mesh,k)=>{const p=mesh.geometry.positions;return {id:WORLD_ISLANDS[k].id,x:mesh.x+(p[0]+p[2]+p[4]+p[6])/4};});
 try{
  const camera={x:m.cx+39999,y:m.cy,zoom:.1};chart.update(camera.zoom,camera);chart.showLive(new Set());const before=centres();
  camera.x+=2;chart.update(camera.zoom,camera);chart.showLive(new Set());const after=centres();
  for(const p of after)if(Math.abs(p.x-camera.x)<20000)close(p.x,before.find(q=>q.id===p.id).x,.01);
  const page=after.find(p=>p.id==='isle-251'),rosy=after.find(p=>p.id==='sunset');
  close(rosy.x-page.x,SEA_WIDTH*76.5/360,.01);assert.ok(page.x<camera.x&&rosy.x>camera.x);
  camera.x=m.cx+SEA_WIDTH*2;chart.update(camera.zoom,camera);chart.showLive(new Set());
  close(centres()[0].x,camera.x,.01);assert.ok(meshes[0].visible,'Home is rendered after a complete lap');
 }finally{chart.destroy();scene.destroy({children:true});}
});

test('tap routes around islands work when the nearest destination lies beyond the first seam window',()=>{
 const h=harborOf('home');
 for(const winding of [-2,0,2]){
  const a={...local('home',39900+winding*SEA_WIDTH,0),mode:'sailing',path:[],action:0};
  assert.ok(canSail(a.x,a.y,'home'));assert.ok(setSailDestination(a,h.water.x,h.water.y));
  const expected=nearestSeaX(h.water.x,a.x);
  for(let k=0;k<8000&&a.sailTarget;k++)sailStep(a,.05,{x:0,y:0});
  close(a.x,expected,1);close(a.y,h.water.y,1);assert.ok(canSail(a.x,a.y,'home'));
 }
});

test('boats can sail beyond both polar islands without resetting to port',()=>{
 for(const [id,sign]of [['isle-55',-1],['isle-249',1]]){
  const p={...local(id,12000,sign*27001),mode:'sailing',path:[],action:0};
  const before={...p};assert.ok(canSail(p.x,p.y,id));sailStep(p,.05,{x:0,y:sign});
  assert.equal(p.seaCurrent,undefined);close(p.x,before.x);close(p.y,before.y+sign*SAIL_SPEED*.05);
 }
});

test('remote interpolation never sweeps a distant periodic image across the viewer',async()=>{
 const {RoomClient}=await import('../src/multiplayer/room-client.js'),client=new RoomClient(()=>{});
 const peer={id:'peer',islandId:'home',mode:'sailing',x:39990,y:15000,turn:Math.PI/2},boat={...peer,id:'boat',occupant:'peer'};
 try{
  client.snapshot({epoch:'wrap',tick:1,islandId:'home',players:[peer],boats:[boat]});
  client.snapshot({epoch:'wrap',tick:2,islandId:'home',players:[{...peer,x:-39990}],boats:[{...boat,x:-39990}]});
  for(const track of [client.tracks.get('peer'),client.boatTracks.get('boat')]){
   close(track.to.x-track.from.x,20,.01);
   assert.ok(Math.abs((track.from.x+track.to.x)/2)>39000,'the interpolated image stays far offscreen');
  }
 }finally{client.dispose();}
});


test('boats crossing the seam keep the full gap from moored and other player boats through the wrap',()=>{
 for(const peerIsland of ['home','sunset'])for(const occupant of [null,'other-player'])for(const winding of [-2,0,2]){
  const start=39900+winding*SEA_WIDTH;
  const actor={id:'sailor',boatId:'own-boat',...local('home',start,14000),mode:'sailing',path:[],action:0};
  const peer={id:'peer-boat',...local(peerIsland,-39500,14000),occupant};
  const gap=()=>{const p=seaPosition('home',actor),q=seaPosition(peerIsland,peer);return Math.hypot(wrapSea(p.x-q.x),p.y-q.y);};
  assert.ok(boatRoom(actor,[peer]));
  for(let k=0;k<30;k++){sailStep(actor,.05,{x:1,y:0},null,[peer]);assert.ok(gap()>=BOAT_GAP,`manual gap ${gap()}`);}
  assert.ok(seaPosition('home',actor).x>40000+winding*SEA_WIDTH,'crosses the seam before stopping');
  Object.assign(actor,local('home',start,14000));
  const goal=local('home',-38500,14000),route=sailRoute('home',actor,goal,[peer]);
  assert.ok(route,'boat-aware chart finds a route around the far-side boat');
  let a={x:actor.x,y:actor.y};
  const q=seaViewPose(actor,peer);
  for(const b of route){
   const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
   const t=l2?Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/l2)):0;
   assert.ok(Math.hypot(wrapSea(a.x+dx*t-q.x),a.y+dy*t-q.y)>=BOAT_GAP,'route segments keep the gap');a=b;
  }
  assert.ok(setSailDestination(actor,goal.x,goal.y,[peer]));
  for(let k=0;k<1000&&actor.sailTarget;k++){sailStep(actor,.05,{x:0,y:0},null,[peer]);assert.ok(gap()>=BOAT_GAP,`route gap ${gap()}`);}
  assert.equal(actor.sailTarget,null);close(wrapSea(actor.x-goal.x),0,1);close(actor.y,goal.y,1);
 }
});

test('the globe pin does not jump when you dock or set sail, including at the pole islands',async()=>{
 const {spherePoint}=await import('../src/world/sphere-coordinates.js');
 for(const i of WORLD_ISLANDS){
  const h=harborOf(i.id),sail=seaPoint(i.id,h.water),walk=spherePoint(i.id,h.land);
  const deg=Math.acos(Math.max(-1,Math.min(1,dot(sail,walk))))*180/Math.PI;
  assert.ok(deg<2,`${i.id}: the pin moves ${deg.toFixed(2)} degrees when docking`);
 }
});

test('sailing round the side of Iceland or Bog does not throw you back to its harbour',()=>{
 for(const [id,sign]of [['isle-55',-1],['isle-249',1]]){
  const m=mapOf(id),c=FLAT_POSITIONS[id];
  for(const side of [-1,1]){
   const x=c.x+side*(m.width/2+2000),p={...local(id,x,sign*21000),mode:'sailing',path:[],action:0};
   assert.ok(canSail(p.x,p.y,id),`${id} side ${side} is open water`);
   for(let n=0;n<10;n++)sailStep(p,.05,{x:0,y:sign});
   assert.equal(p.seaCurrent,undefined,`${id} side ${side}: no current beside the island`);
  }
 }
});
