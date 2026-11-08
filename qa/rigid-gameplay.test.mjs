import test from 'node:test';
import assert from 'node:assert/strict';
import {patchGeometry} from '../src/pixi/sphere-mesh.js';
import {destinationsFor,canSail,landingSpot,BOAT_RADIUS,harborOf} from '../src/pixi/islands.js';
import {mapPoint,spherePoint} from '../src/pixi/sphere-coordinates.js';
import {unplaceRigid} from '../src/pixi/rigid.js';
import {isletClearance} from '../src/pixi/islets.js';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';

// Reviewer, 8 Nov: the neighbours are DRAWN rigid (sphere-mesh.js quads), so the dock you sail to, the beach you land on
// and the coast you bump into must be the drawn ones. "Drawn" here is read off the very mesh the game renders.
function drawn(from,to){
 const m=mapOf(to),g=patchGeometry(from,to,{...m.origin,width:m.width,height:m.height}),p=g.positions;
 const c=[0,1,2,3].map(k=>({x:p[k*2],y:p[k*2+1]}));g.destroy();
 return q=>{const u=(q.x-m.origin.x)/m.width,v=(q.y-m.origin.y)/m.height;   // bilinear over the drawn quad (exact: it is a rigid rectangle)
  return {x:(1-u)*(1-v)*c[0].x+u*(1-v)*c[1].x+u*v*c[2].x+(1-u)*v*c[3].x,y:(1-u)*(1-v)*c[0].y+u*(1-v)*c[1].y+u*v*c[2].y+(1-u)*v*c[3].y};};
}
const PAIRS=['home','sunset','isle-176'].flatMap(from=>destinationsFor(from).map(d=>[from,d.destination,d]));

test('a neighbour\'s dock target is on its drawn jetty',()=>{
 let worstOld=0;
 for(const [from,to,d]of PAIRS){
  const D=drawn(from,to),h=harborOf(to),water=D(h.water),land=D(h.land);
  assert.ok(Math.hypot(d.dock.x-water.x,d.dock.y-water.y)<3,`${from}->${to} dock on the drawn jetty`);
  assert.ok(Math.hypot(d.land.x-land.x,d.land.y-land.y)<3,`${from}->${to} landing on the drawn deck`);
  const old=mapPoint(to,from,h.water);worstOld=Math.max(worstOld,Math.hypot(old.x-water.x,old.y-water.y));
 }
 console.log(`# the old warped dock missed the drawn jetty by up to ${worstOld.toFixed(0)} units`);
});

test('a neighbour\'s collision coast is its drawn coast',()=>{
 for(const [from,to]of PAIRS.slice(0,6)){
  const m=mapOf(to),D=drawn(from,to),ring=(x,y,r)=>[...Array(16)].some((_,k)=>m.landAt(x+Math.cos(k*Math.PI/8)*r,y+Math.sin(k*Math.PI/8)*r));
  let land=0,water=0,open=0;
  for(let x=m.origin.x+60;x<m.origin.x+m.width;x+=150)for(let y=m.origin.y+60;y<m.origin.y+m.height;y+=150){
   const q=D({x,y});
   if(m.landAt(x,y)){land++;assert.equal(canSail(q.x,q.y,from),false,`${to} ground at ${x},${y} drawn round ${from} is sailable`);}
   else if(!ring(x,y,BOAT_RADIUS*3)&&!ring(x,y,BOAT_RADIUS*1.5)&&!m.landAt(x,y,0)){
    // only water clear of everything else drawn there too (another island's rigid copy, an islet)
    const busy=WORLD_ISLANDS.some(i=>{if(i.id===to)return false;const L=i.id===from?q:unplaceRigid(from,i.id,q),mm=mapOf(i.id);
     return [0,1.5,3].some(r=>[...Array(16)].some((_,k)=>mm.landAt(L.x+Math.cos(k*Math.PI/8)*r*BOAT_RADIUS,L.y+Math.sin(k*Math.PI/8)*r*BOAT_RADIUS)));});
    if(busy||isletClearance(spherePoint(from,q),BOAT_RADIUS*3)<BOAT_RADIUS*2)continue;
    water++;if(canSail(q.x,q.y,from))open++;}
  }
  assert.ok(land>20,`${to}: ${land} ground samples`);
  assert.ok(water===0||open/water>.97,`${from}->${to}: drawn open water is sailable (${open}/${water})`);
 }
});

test('docking at a neighbour\'s beach lands on the drawn sand',()=>{
 for(const [from,to,d]of PAIRS.slice(0,4)){
  const spot=landingSpot({islandId:from,...d.dock});
  assert.equal(spot?.islandId,to);
  const D=drawn(from,to),q=D(spot);
  assert.ok(Math.hypot(q.x-(spot.x+spot.offset.x),q.y-(spot.y+spot.offset.y))<3,'the landing point is where the sand is drawn');
 }
});
