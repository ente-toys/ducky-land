import test from 'node:test';
import assert from 'node:assert/strict';
import {createPirateFleet,PIRATE_BOAT_GAP,PIRATE_RADIUS,pirateClearance} from '../src/gameplay/pirate-fleet.js';
import {SAIL_SPEED} from '../src/gameplay/islands.js';
import {SEA_WIDTH} from '../src/world/flat-layout.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function crossing({angle=0,fps=60,winding=0,start=1800,speed=SAIL_SPEED,count=1,seed=713913}={}){
 const fleet=createPirateFleet({count,seed}),ship=fleet.ships[0],origin=[...ship.p],dt=1/fps;
 let min=Infinity,maxStep=0,maxAcceleration=0,previousVelocity=[0,0],stopped=0;
 for(let k=0;k<Math.ceil((start*2+700)/speed*fps);k++){
  const r=start-k*speed*dt,boat=[origin[0]+Math.cos(angle)*r+winding*SEA_WIDTH,origin[1]+Math.sin(angle)*r],saved=[...boat],before=[...ship.p];
  fleet.update(dt,[boat]);assert.deepEqual(boat,saved,'never move or rewrite a player boat');
  const v=ship.p.map((n,i)=>(n-before[i])/dt),d=distance(ship.p,[boat[0]-winding*SEA_WIDTH,boat[1]]);
  min=Math.min(min,d);maxStep=Math.max(maxStep,distance(before,ship.p));maxAcceleration=Math.max(maxAcceleration,distance(v,previousVelocity)/dt);previousVelocity=v;
  if(d<1200&&distance(before,ship.p)<1e-8)stopped++;
 }
 return{min,maxStep,maxAcceleration,stopped,fleet,ship};
}
test('pirates yield before full-speed boats reach their hull on every approach angle',()=>{
 for(let k=0;k<12;k++){const result=crossing({angle:k*Math.PI/6});assert.ok(result.min>=PIRATE_BOAT_GAP,JSON.stringify({angle:k,...result,min:result.min,fleet:undefined,ship:undefined}));assert.equal(result.stopped,0,'no freeze during an open-water encounter');assert.ok(result.maxStep<=(SAIL_SPEED+130)/60+1e-7);assert.ok(result.maxAcceleration<5000,'bounded smooth acceleration');}
});
test('yielding is stable across frame rates and wrapped copies of the same boat',()=>{
 for(const fps of [15,30,120])assert.ok(crossing({fps}).min>=PIRATE_BOAT_GAP,'fps '+fps);
 const normal=crossing(),west=crossing({winding:-2}),east=crossing({winding:2});
 assert.ok(Math.abs(normal.min-west.min)<1e-6);assert.ok(Math.abs(normal.min-east.min)<1e-6);
});
test('an existing overlap clears continuously instead of freezing or teleporting',()=>{
 const fleet=createPirateFleet({count:1}),ship=fleet.ships[0],boat=[ship.p[0]+40,ship.p[1]],saved=[...boat];let previous=distance(ship.p,boat);
 for(let k=0;k<240;k++){const before=[...ship.p];fleet.update(1/60,[boat]);const next=distance(ship.p,boat);if(previous<PIRATE_BOAT_GAP)assert.ok(next>=previous-1e-6,'escape cannot make penetration worse');assert.ok(distance(ship.p,before)<12,'no position snap');previous=next;}
 assert.deepEqual(boat,saved);assert.ok(previous>PIRATE_BOAT_GAP,'pirate clears the occupied space');
});
test('a pursuing player boat and its delayed room copies cannot pin a fleeing pirate',()=>{
 for(const lag of [null,0,2,6]){
  const fleet=createPirateFleet({count:1}),ship=fleet.ships[0],boat=[ship.p[0]-1700,ship.p[1]],history=[];let min=Infinity;
  for(let k=0;k<480;k++){
   const dx=ship.p[0]-boat[0],dy=ship.p[1]-boat[1],len=Math.hypot(dx,dy);boat[0]+=dx/len*SAIL_SPEED/60;boat[1]+=dy/len*SAIL_SPEED/60;
   history.push([...boat]);fleet.update(1/60,lag===null?[boat]:[history[Math.max(0,k-lag)],boat]);min=Math.min(min,distance(ship.p,boat));
  }
  assert.ok(min>PIRATE_BOAT_GAP,'pursuit clearance with room lag '+lag+': '+min);
 }
});
test('pirates stay on water and retain clearance to other pirates during a moving encounter',()=>{
 const {fleet}=crossing({count:18});for(const ship of fleet.ships)assert.ok(pirateClearance(ship.p)>PIRATE_RADIUS+60);
 for(let k=0;k<fleet.ships.length;k++)for(let j=k+1;j<fleet.ships.length;j++)assert.ok(distance(fleet.ships[k].p,fleet.ships[j].p)>=799.9);
});
test('boat removal, disabled fleet and zero elapsed time do not produce stale escapes or invalid positions',()=>{
 const fleet=createPirateFleet({count:1}),ship=fleet.ships[0],boat=[ship.p[0]+100,ship.p[1]];
 for(let k=0;k<120;k++)fleet.update(1/60,[boat]);
 const p=[...ship.p];fleet.enabled=false;fleet.update(1,[boat]);assert.deepEqual(ship.p,p);
 fleet.enabled=true;fleet.update(0,[boat]);assert.deepEqual(ship.p,p);
 for(let k=0;k<360;k++)fleet.update(1/60,[]);
 assert.equal(ship.yielding,false);assert.ok(Math.abs(ship.velocity-ship.speed)<1,'settles back to cruising speed');assert.ok(ship.p.every(Number.isFinite));
});

test('opposing boats, crossing traffic and duplicate room poses do not pin a pirate',()=>{
 for(const scenario of ['opposite','cross','duplicates','membership']){
  const fleet=createPirateFleet({count:1}),ship=fleet.ships[0],origin=[...ship.p];let min=Infinity;
  for(let k=0;k<600;k++){
   const r=2000-k*SAIL_SPEED/60,a=[origin[0]+r,origin[1]],b=scenario==='cross'?[origin[0],origin[1]+r]:[origin[0]-r,origin[1]];
   let boats=scenario==='duplicates'?[a,[...a]]:[a,b];
   if(scenario==='membership'&&k>450)boats=[a];else if(k%2)boats.reverse();
   const previous=[...ship.p],saved=structuredClone(boats);fleet.update(1/60,boats);
   assert.deepEqual(boats,saved);assert.ok(distance(previous,ship.p)<12,'bounded movement');
   for(const boat of boats)min=Math.min(min,distance(ship.p,boat));
  }
  assert.ok(min>=PIRATE_BOAT_GAP,scenario+' clearance '+min);
 }
});
test('yielding near a coastline never trades boat clearance for sailing onto land',()=>{
 const fleet=createPirateFleet({count:1}),ship=fleet.ships[0],origin=[-2622.222222222222,-640];ship.p=[...origin];
 assert.ok(pirateClearance(origin)>PIRATE_RADIUS+80);
 for(let k=0;k<600;k++){
  const boat=[origin[0]+2000-k*SAIL_SPEED/60,origin[1]],previous=[...ship.p];fleet.update(1/60,[boat]);
  assert.ok(pirateClearance(ship.p)>=PIRATE_RADIUS+80,'stays on water');
  assert.ok(distance(ship.p,boat)>=PIRATE_BOAT_GAP,'keeps occupied boat clear');
  assert.ok(distance(previous,ship.p)<12,'no shoreline snap');
 }
});

test('varied fleet seeds and approach speeds keep open-water boats clear',()=>{
 for(const seed of [1,7,93,713913])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const speed of [SAIL_SPEED/2,SAIL_SPEED]){
  const result=crossing({seed,angle,speed});assert.ok(result.min>=PIRATE_BOAT_GAP,JSON.stringify({seed,angle,speed,min:result.min}));
 }
});
