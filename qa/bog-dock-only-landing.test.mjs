import test from 'node:test';
import assert from 'node:assert/strict';
import {dockingSpot,harborOf,canSail,canDock,landingSpot,HARBOR_ONLY} from '../src/gameplay/islands.js';

const BOG='isle-249';
const {land,water}=harborOf(BOG);

// a sea spot beside the Bog shore, far from the dock, where an ordinary island would let the boat land
function farShore(){
 for(let r=900;r<=6000;r+=60)for(let k=0;k<72;k++){
  const a=k*Math.PI/36,actor={islandId:BOG,mode:'sailing',x:Math.round(water.x+Math.cos(a)*r),y:Math.round(water.y+Math.sin(a)*r)};
  if(!canSail(actor.x,actor.y,BOG))continue;
  const spot=landingSpot(actor,null,420,null);
  if(spot&&!spot.islet&&spot.islandId===BOG&&Math.hypot(spot.x-land.x,spot.y-land.y)>1200)return actor;
 }
 return null;
}

test('Booquack Bog only lets a boat land at its dock',()=>{
 assert.ok(HARBOR_ONLY.has(BOG));
 const actor=farShore();assert.ok(actor,'found a Bog shore far from the dock');
 assert.equal(dockingSpot(actor),null,'no landing on the far shore');
 const spot=landingSpot(actor,null,420,null);
 assert.equal(dockingSpot(actor,{x:spot.x,y:spot.y}),null,'no tapped landing on the far shore');
 const atDock={islandId:BOG,mode:'sailing',x:water.x,y:water.y};
 assert.ok(canDock(atDock));
 const docked=dockingSpot(atDock);
 assert.ok(docked?.harbor,'the dock still works');
 assert.deepEqual([docked.x,docked.y],[land.x,land.y]);
 const tapped=dockingSpot(atDock,{x:land.x,y:land.y});
 assert.ok(tapped?.harbor,'tapping the dock lands at the dock');
});
