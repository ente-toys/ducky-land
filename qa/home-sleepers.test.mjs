import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {geometry,inShape,inPoly} from '../assets/world/island-geometry.mjs';
import {HOME_MAP} from '../src/world/island-maps.js';
import {HOME_SLEEP_TOTAL,sleepHalfWidths,sleeperFootprint} from '../src/world/home/sleep-spots.js';
import originalBeds from './fixtures/home-original-sleepers.json' with {type:'json'};
import eightyBeds from './fixtures/home-eighty-sleepers.json' with {type:'json'};
import more from '../assets/world/home-sleep-more.json' with {type:'json'};
import routes from '../src/world/home/home-routes.json' with {type:'json'};
import outer from '../assets/world/home-sleep-outer.json' with {type:'json'};
import originalWorld from '../src/world/home/home-original-world.json' with {type:'json'};
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';

test('Home adds sixty outer sleepers without moving the first eighty, and the room walks around all hundred',async()=>{
 const vite=await createServer({configFile:false,cacheDir:'/private/tmp/home-sleepers-test',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
 try{
  const P=await vite.ssrLoadModule('/src/world/home/placements.js');
  const props=P.createPlacements(),world=P.walkWorld(P.trimWorld(JSON.parse(readFileSync('assets/world/world.json'))),props);
  const beds=P.sleepSpots(world,props,geometry(world).walkable,sleepHalfWidths());
  assert.equal(beds.length,HOME_SLEEP_TOTAL);assert.deepEqual(beds.bad,[]);
  assert.deepEqual(JSON.parse(JSON.stringify(beds.slice(0,40))),originalBeds,'original positions, poses, flips, trees and animation order survive');
  const added=beds.slice(40);
  assert.equal(added.length,60);
  assert.deepEqual(JSON.parse(JSON.stringify(beds.slice(0,80))),eightyBeds);
  assert.equal(Object.values(more).flat().length,20);
  for(const bed of beds.slice(80))for(const route of routes)for(const point of route.samples)assert.equal(inShape(...point,sleeperFootprint(bed),16),false,'new residents clear every authored route');
  assert.deepEqual(Object.values(outer).map(s=>s.length),Array(8).fill(5),'five of every approved pose');
  const walk=HOME_MAP.nav();
  for(const bed of added){
   assert.equal(inPoly(bed.x,bed.y,originalWorld.coast),false,'new resident is on the outer island');
   assert.equal(world.water.some(w=>inShape(bed.x,bed.y,w)),false,'dry ground');
  }
  for(const bed of beds){
   const f=sleeperFootprint(bed);
   assert.equal(walk.walkable(f.x,f.y),false,'server blocks every sleeper');
   const from=walk.nearest(bed.x-200,bed.y+65,250),to=walk.nearest(bed.x+200,bed.y+65,250);
   assert.ok(from&&to,'approachable from both sides');
   const actor={x:from[0],y:from[1],previousX:from[0],previousY:from[1],turn:0,action:0,travel:0,path:[],until:0};
   assert.ok(setWalkDestination(actor,walk,...to),'server finds a route around the sleeper');
   for(let k=0;k<600&&actor.path.length;k++){
    walkStep(actor,walk,.05,k*.05,{x:0,y:0});
    assert.ok(walk.walkable(actor.x,actor.y),'every simulated server step stays on walkable ground');
    assert.ok(!inShape(actor.x,actor.y,f),'never steps through a resident');
   }
   assert.ok(Math.hypot(actor.x-to[0],actor.y-to[1])<1,'walk finishes beside the resident');
  }
 }finally{await vite.close();}
});
