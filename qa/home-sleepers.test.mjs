import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {geometry,inShape,inPoly} from '../assets/world/island-geometry.mjs';
import {HOME_MAP} from '../src/world/island-maps.js';
import {HOME_SLEEP_TOTAL,sleepHalfWidths,homeSleeperFootprint as sleeperFootprint} from '../src/world/home/sleep-spots.js';
import relocations from './fixtures/home-canopy-relocations.json' with {type:'json'};
import originalBeds from './fixtures/home-original-sleepers.json' with {type:'json'};
import eightyBeds from './fixtures/home-eighty-sleepers.json' with {type:'json'};
import more from '../assets/world/home-sleep-more.json' with {type:'json'};
import routes from '../src/world/home/home-routes.json' with {type:'json'};
import outer from '../assets/world/home-sleep-outer.json' with {type:'json'};
import originalWorld from '../src/world/home/home-original-world.json' with {type:'json'};
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';

test('Home retains all hundred residents, their poses and stories on clear ground',async()=>{
 const vite=await createServer({configFile:false,cacheDir:'/private/tmp/home-sleepers-test',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
 try{
  const P=await vite.ssrLoadModule('/src/world/home/placements.js');
  const props=P.createPlacements(),world=P.walkWorld(P.trimWorld(JSON.parse(readFileSync('assets/world/world.json'))),props);
  const beds=P.sleepSpots(world,props,geometry(world).walkable,sleepHalfWidths());
  assert.equal(beds.length,HOME_SLEEP_TOTAL);assert.deepEqual(beds.bad,[]);
  const relocated=old=>old.map(b=>{const move=relocations.find(m=>m.pose===b.pose&&m.from[0]===b.x&&m.from[1]===b.y);const tree=b.tree&&props.find(p=>p.id===b.tree);return {...b,...(tree?{tree:tree.id,x:tree.x,y:tree.y+14}:move?{x:move.to[0],y:move.to[1]}:{})};});
  assert.deepEqual(JSON.parse(JSON.stringify(beds.slice(0,40))),relocated(originalBeds),'original positions, poses, flips, trees and animation order survive');
  const added=beds.slice(40);
  assert.equal(added.length,60);
  assert.deepEqual(JSON.parse(JSON.stringify(beds.slice(0,80))),relocated(eightyBeds));
  assert.equal(Object.values(more).flat().length,20);
  for(const bed of beds.slice(80))for(const route of routes)for(const point of route.samples)assert.equal(inShape(...point,sleeperFootprint(bed),16),false,'new residents clear every authored route');
  assert.deepEqual(Object.values(outer).map(s=>s.length),Array(8).fill(5),'five of every approved pose');
  const walk=HOME_MAP.nav(),ground=geometry({...world,obstacles:world.obstacles.filter(o=>!o.bodyBlock)}).walkable;
  for(const bed of added){
   assert.equal(inPoly(bed.x,bed.y,originalWorld.coast),false,'new resident is on the outer island');
   assert.equal(world.water.some(w=>inShape(bed.x,bed.y,w)),false,'dry ground');
  }
  const reachableNear=(x,y)=>{
   const direct=walk.nearest(x,y,400);
   if(direct&&walk.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...direct).length)return direct;
   for(let r=24;r<=400;r+=24)for(let i=0;i<24;i++){
    const p=[x+r*Math.cos(i*Math.PI/12),y+r*Math.sin(i*Math.PI/12)];
    if(walk.walkable(...p)&&walk.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p).length)return p;
   }
   return null;
  };
  for(const bed of beds){
   if(!bed.tree)for(const dx of [-22,0,22])assert.ok(ground(bed.x+dx,bed.y),`${bed.pose}: clear ground beneath body`);
   if(relocations.some(m=>m.pose===bed.pose&&m.to[0]===bed.x&&m.to[1]===bed.y)&&bed.pose==='book')assert.equal(P.groundAt(bed.x,bed.y,world),'grass','reader stays on grass');
   const f=sleeperFootprint(bed);
   assert.equal(walk.walkable(f.x,f.y),false,'server blocks every sleeper');
   const from=reachableNear(bed.x-200,bed.y+65),to=reachableNear(bed.x+200,bed.y+65);
   assert.ok(from&&to,`${bed.pose} at ${bed.x},${bed.y}: approachable from both sides`);
   const approach=[walk.nearest(bed.x,bed.y+100,180),from,to].find(p=>p&&walk.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p).length);
   assert.ok(approach&&walk.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...approach).length,`${bed.pose}: reachable from spawn`);
   const actor={x:from[0],y:from[1],previousX:from[0],previousY:from[1],turn:0,action:0,travel:0,path:[],until:0};
   assert.ok(setWalkDestination(actor,walk,...to),`server finds a route around ${bed.pose} at ${bed.x},${bed.y}, from ${from} to ${to}`);
   const routeLength=actor.path.reduce((sum,p,i)=>{const q=i?actor.path[i-1]:from;return sum+Math.hypot(p[0]-q[0],p[1]-q[1]);},0);
   const maxSteps=Math.ceil((routeLength/245+5)/.05);
   for(let k=0;k<maxSteps&&actor.path.length;k++){
    walkStep(actor,walk,.05,k*.05,{x:0,y:0});
    assert.ok(walk.walkable(actor.x,actor.y),'every simulated server step stays on walkable ground');
    assert.ok(!inShape(actor.x,actor.y,f),'never steps through a resident');
   }
   assert.ok(Math.hypot(actor.x-to[0],actor.y-to[1])<1,'walk finishes beside the resident');
  }
 }finally{await vite.close();}
});
