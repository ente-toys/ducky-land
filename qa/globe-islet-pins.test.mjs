import test from 'node:test';
import assert from 'node:assert/strict';
import {globePlayerPoint} from '../src/rendering/shared/globe-player-point.js';
import {ISLETS,isletPoint} from '../src/world/islets.js';
import {placeIslet,unplaceIslet} from '../src/world/islet-placement.js';
import {isletWalk} from '../src/world/islet-walk.js';
import {WORLD_ISLANDS} from '../src/world/world-map.js';
import {spherePoint,seaFrame} from '../src/world/sphere-coordinates.js';
import {mapOf} from '../src/world/island-maps.js';
import {SEA_WIDTH} from '../src/world/flat-layout.js';
import {angle} from '../src/world/sphere.js';
import {globeScreen} from '../src/rendering/shared/globe-screen.js';
import {harborOf,navOf,canSail,setSailDestination,sailStep} from '../src/gameplay/islands.js';
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';
const degrees=(a,b)=>angle(a,b)*180/Math.PI;

function checkWalking(i,actor){
 const q=unplaceIslet(i.home,i,actor),expected=isletPoint(i,[q.x,q.y]),actual=globePlayerPoint(i.home,actor);
 assert.ok(degrees(actual,expected)<1e-7,`${i.id}: pin follows the islet artwork`);
 const m=mapOf(i.home),camera={x:m.cx,y:m.cy,zoom:.025},view=globeScreen({id:i.home,cam:camera,ball:1,w:1280,h:900});
 const pin=view.screenOf(actual),foot=view.screenOf(expected);
 assert.ok(pin&&foot);assert.ok(Math.hypot(pin.x-foot.x,pin.y-foot.y)<.01);
}

test('walking pins follow every islet dock and inland walk, including wrapped chart copies',()=>{
 for(const i of ISLETS){
  const walk=isletWalk(i.id),nav=navOf(i.home),actor={...walk.land,mode:'walking',path:[],travel:0,action:0};
  checkWalking(i,actor);
  for(const winding of [-2,-1,1,2])checkWalking(i,{...actor,x:actor.x+winding*SEA_WIDTH});
  const center=placeIslet(i.home,i,i.landCentre),goal=nav.nearest(center.x,center.y,300);
  assert.ok(goal&&setWalkDestination(actor,nav,goal[0],goal[1]),`${i.id}: inland route`);
  let frames=0;for(;frames<1200&&actor.path.length;frames++){walkStep(actor,nav,.05,frames*.05,{x:0,y:0});checkWalking(i,actor);}
  assert.ok(frames>0&&frames<1200,`${i.id}: completed walk`);
 }
});

test('boarding, sailing away and docking keep each islet pin in the same globe neighbourhood',()=>{
 for(const i of ISLETS){
  const w=isletWalk(i.id),actor={...w.water,islandId:i.home,mode:'sailing',turn:0,path:[],action:0};
  const landPin=globePlayerPoint(i.home,{...w.land,mode:'walking'}),waterPin=globePlayerPoint(i.home,actor);
  assert.ok(degrees(landPin,waterPin)<1,`${i.id}: no boarding/docking jump`);
  let away;
  for(let n=0;n<24&&!away;n++){
   const a=Math.atan2(i.jetty.dir[1],i.jetty.dir[0])+n*Math.PI/12;
   const point=placeIslet(i.home,i,[i.jetty.water[0]+Math.cos(a)*900,i.jetty.water[1]+Math.sin(a)*900]);
   if(canSail(point.x,point.y,i.home)&&setSailDestination(actor,point.x,point.y))away=point;
  }
  assert.ok(away,`${i.id}: sea route`);
  let previous=waterPin,frames=0;
  for(;frames<4000&&actor.sailTarget;frames++){
   sailStep(actor,.05,{x:0,y:0});const pin=globePlayerPoint(i.home,actor);
   assert.ok(degrees(pin,seaFrame(i.home,actor).center)<1e-6,`${i.id}: sailing pin follows the boat chart`);
   assert.ok(degrees(pin,previous)<.5,`${i.id}: continuous pin movement`);previous=pin;
  }
  assert.ok(frames>0&&frames<4000);assert.ok(Math.hypot(actor.x-w.water.x,actor.y-w.water.y)>500);
  assert.ok(degrees(previous,waterPin)>.1,`${i.id}: pin actually moves with boat`);
  for(const winding of [-2,-1,1,2])assert.ok(degrees(previous,globePlayerPoint(i.home,{...actor,x:actor.x+winding*SEA_WIDTH}))<1e-6);
  assert.ok(setSailDestination(actor,w.water.x,w.water.y),`${i.id}: return to dock`);
  for(let n=0;n<4000&&actor.sailTarget;n++)sailStep(actor,.05,{x:0,y:0});
  assert.ok(Math.hypot(actor.x-w.water.x,actor.y-w.water.y)<14,`${i.id}: reached dock again`);
  assert.ok(degrees(globePlayerPoint(i.home,actor),landPin)<1,`${i.id}: no jump on return`);
  checkWalking(i,{...w.land,mode:'walking'});
 }
});

test('main-island walking pins retain their existing projection',()=>{
 for(const i of WORLD_ISLANDS)for(const p of [harborOf(i.id).land,navOf(i.id).nearest(harborOf(i.id).land.x,harborOf(i.id).land.y,100)]){
  const actor=Array.isArray(p)?{x:p[0],y:p[1],mode:'walking'}:{...p,mode:'walking'};
  assert.deepEqual(globePlayerPoint(i.id,actor),spherePoint(i.id,actor));
 }
});

test('final Bog knockout world snapshot pins the returned Ducky on Broken Shipwreck instead of Bog',async()=>{
 const {makeRoom,addPlayer,fakeSocket}=await import('./room-harness.mjs');
 const {LiveBogRoom}=await import('../worker/bog-room.js');
 const {setBogExitRandom}=await import('../worker/bog-exit.js');
 const {RULES}=await import('../src/features/bog-combat/rules.js');
 const room=await makeRoom();
 try{
  const index=ISLETS.findIndex(i=>i.id==='sea-3-1'),islet=ISLETS[index];setBogExitRandom(()=>(index+.5)/ISLETS.length);
  const h=harborOf('isle-249'),p=addPlayer(room,9451,{islandId:'isle-249',...h.water,mode:'sailing'});
  const boat=room.boats.find(b=>b.islandId==='isle-249'&&!b.occupant);
  Object.assign(boat,{...h.water,occupant:p.actor.id});Object.assign(p.actor,{boatId:boat.id,docking:true});
  room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',p.account,10);room.karma.balances.delete(p.account);room.step();
  const combat=room.bog=new LiveBogRoom(room),socket=fakeSocket();assert.ok(combat.open(socket,{digest:p.account,team:'karma'}));
  const fighter=combat.arena.state.players.get(combat.members.get(socket).id);
  fighter.lives=1;fighter.shieldUntil=0;fighter.hits=RULES.hitsPerHeart-1;
  combat.arena.state.shots.push({id:999,owner:'enemy',team:'evil',x:fighter.x,y:fighter.y,dx:1,dy:0,left:RULES.range,colour:0});
  for(let i=0;i<190;i++)combat.step();
  assert.equal(socket.notes.find(m=>m.type==='arena-exit').destination.islet,islet.id);
  const snapshot=JSON.parse(p.socket.last),own=snapshot.players.find(q=>q.id===p.actor.id);
  assert.equal(snapshot.islandId,islet.home);assert.equal(own.mode,'walking');
  checkWalking(islet,own);
  const before=spherePoint(snapshot.islandId,own),after=globePlayerPoint(snapshot.islandId,own);
  assert.ok(degrees(before,after)>140,'regression exercises the old wrong-hemisphere pin');
 }finally{setBogExitRandom();clearInterval(room.timer);room.bog?.dispose();}
});
