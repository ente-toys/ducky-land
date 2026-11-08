import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {mapFor} from '../src/pixi/island-maps.js';
import {inPoly,inShape} from '../rive/web/island-geometry.mjs';
import {THEME_OF} from '../src/pixi/island-maps.js';
import {boardingPoint,canSail} from '../src/pixi/islands.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/neon/',S='scripts/bigger-neon/';
const art=read(A+'art.json'),world=read('rive/web/themes/neon/world.json'),oldArt=read(S+'baseline/art.json'),oldWorld=read(S+'baseline/world.json'),plan=read(S+'plan.json');
const area=ps=>Math.abs(ps.reduce((s,p,i)=>{const q=ps[(i+1)%ps.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2);
test('bigger Neon keeps the original composition, moving clock and all forty sleepers intact',()=>{
 for(const key of ['props','flats','decks'])assert.deepEqual(art[key].slice(0,oldArt[key].length),oldArt[key],key);
 for(const key of ['sleepSpots','sleepAvoid','ambient','walkways','arches'])assert.deepEqual(world[key],oldWorld[key],key);
 for(const key of ['water','bridges'])assert.deepEqual(world[key].slice(0,oldWorld[key].length),oldWorld[key],key);
 for(const[key,value]of Object.entries(oldWorld.zones))assert.deepEqual(world.zones[key],value,key);
 const r=checkTheme('neon');assert(r.ready,r.problems.join('\n'));assert.equal(r.sleepers.length,40);
 assert.deepEqual(r.sleepers,read(A+'resolved-sleepers.json'));
});
test('bigger Neon connects all four communities and every mooring to the original clock plaza',()=>{
 const map=mapFor('neon'),nav=map.nav(),id=[...THEME_OF].find(([,t])=>t==='neon')[0];
 for(const p of plan.places){assert(nav.walkable(...p.spawn),p.name);assert(nav.route(map.spawn.x,map.spawn.y,...p.spawn).length,p.name);}
 assert(nav.route(map.spawn.x,map.spawn.y,map.HARBOR.land.x,map.HARBOR.land.y).length,'harbour route');
 for(const b of map.boatSpots()){assert(canSail(b.x,b.y,id),'mooring in open sea');const foot=boardingPoint({...b,islandId:id});assert(nav.walkable(foot.x,foot.y),'boarding foot on land');assert(nav.route(map.spawn.x,map.spawn.y,foot.x,foot.y).length,'boarding foot connected');}
 for(const q of plan.obstacles)assert(!nav.walkable(q.x,q.y),'visible new solid blocks walking');
});
test('bigger Neon has about three times the land, safe tiles and no new artwork over the original land',()=>{
 const ratio=area(world.coast)/(area(oldWorld.coast)+oldWorld.islets.reduce((s,[,,rx,ry])=>s+Math.PI*rx*ry,0));assert(ratio>2.8&&ratio<4,`land ratio ${ratio}`);
 assert(art.ground.tiles.every(t=>t.width<=1536&&t.height<=1536));
 const oldDry=(x,y)=>inPoly(x,y,oldWorld.coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1);
 for(const p of plan.props){const w=p.width*p.scale,h=p.height*p.scale;for(let y=p.y-h*p.anchor.y;y<p.y+h*(1-p.anchor.y);y+=25)for(let x=p.x-w*p.anchor.x;x<p.x+w*(1-p.anchor.x);x+=25)assert(!oldDry(x,y),`${p.id} covers original land`);}
});
test('Neon households have accessible porches and garden gates in four distinct working communities',()=>{
 const map=mapFor('neon'),nav=map.nav();
 assert.equal(plan.communities.length,4);
 assert.equal(new Set(plan.communities.map(c=>c.house)).size,4);
 for(const c of plan.communities){
  assert.equal(c.homes.length,7,c.name);
  assert(c.workplaces.length>=3,c.name);
  for(const[x,y]of c.homes){
   for(const dy of [35,175]){
    assert(nav.walkable(x,y+dy),`${c.name} doorway/gate ${x},${y+dy}`);
    assert(nav.route(map.spawn.x,map.spawn.y,x,y+dy).length,`${c.name} connected household`);
   }
   assert(!nav.walkable(x,y-75),`${c.name} house is solid`);
  }
 }
});

test('Neon coastal decks and new road crossings span real water with connected dry approaches',()=>{
 const map=mapFor('neon'),nav=map.nav(),wet=(x,y)=>world.water.some(o=>inShape(x,y,o));
 // The old pond dock has a dry entrance and its last third extends into the pond.
 for(const [i,q]of oldWorld.walkways.entries()){
  const t=i===6?.8:.5,x=q.a[0]+(q.b[0]-q.a[0])*t,y=q.a[1]+(q.b[1]-q.a[1])*t;
  assert(wet(x,y),`original deck ${i} has water under its span`);
  assert(nav.walkable(x,y),`original deck ${i} remains walkable`);
  assert(nav.route(map.spawn.x,map.spawn.y,x,y).length,`original deck ${i} remains connected`);
 }
 const crossings=world.bridges.filter(b=>b.id&&!b.id.startsWith('restored'));
 assert.equal(crossings.length,6);
 for(const b of crossings){
  assert(wet(b.x,b.y),b.id+' has water');assert(nav.walkable(b.x,b.y),b.id+' is walkable');
  const vertical=b.id.startsWith('heart-'),dx=vertical?0:290,dy=vertical?245:0;
  for(const sign of [-1,1]){const x=b.x+dx*sign,y=b.y+dy*sign;assert(nav.walkable(x,y),b.id+' dry approach');assert(nav.route(map.spawn.x,map.spawn.y,x,y).length,b.id+' connected approach');}
 }
 for(const [x,y]of [[6750,-300],[6500,-750],[5600,4600],[6650,5500]]){
  assert(wet(x,y),'stream has collision water');assert(!nav.walkable(x,y),'ducks cannot walk through stream');
 }
 assert.deepEqual(map.walk.water,world.water,'server and client use the same water');
});

test('Neon restored canal leaves the original dry interior and the two inhabited islets dry',()=>{
 const dry=(x,y)=>inPoly(x,y,oldWorld.coast)||oldWorld.islets.some(([a,b,rx,ry])=>((x-a)/rx)**2+((y-b)/ry)**2<1);
 for(let y=650;y<4700;y+=40)for(let x=400;x<7400;x+=40){
  if(dry(x,y)&&!oldWorld.water.some(o=>inShape(x,y,o)))assert(!world.water.slice(oldWorld.water.length).some(o=>inShape(x,y,o)),`new canal floods original dry land ${x},${y}`);
 }
 assert.equal(new Set(plan.props.filter(p=>/-house-\d/.test(p.src)).map(p=>p.src)).size,28);
 assert.equal(plan.review.streams.length,2);assert.equal(plan.review.commons.length,5);
});
