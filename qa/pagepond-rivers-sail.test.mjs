import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {canSail,harborOf,createBoats,setSailDestination,sailStep,BOAT_RADIUS} from '../src/pixi/islands.js';
import {paperboatMoorings,retiredBoatIds} from '../scripts/pagepond-boats/config.mjs';
import {deckX} from '../src/pixi/bridge-projection.mjs';
import {shoreOf} from '../src/pixi/surf.js';
const read=p=>JSON.parse(fs.readFileSync(p)),id='isle-251',map=mapFor('library'),report=read('scripts/pagepond-rework/report.json'),ground=read('scripts/pagepond/layout.json'),art=read('public/pixi-art/themes/library/art.json');
function sail(actor,p){assert(canSail(...p,id),'open boat waypoint '+p);assert(setSailDestination(actor,...p),'route to '+p);for(let i=0;i<12000&&(actor.sailTarget||actor.sailRoute?.length);i++){sailStep(actor,1/20,{x:0,y:0});assert(canSail(actor.x,actor.y,id),'boat remains in water');}assert(Math.hypot(actor.x-p[0],actor.y-p[1])<2,'arrives at '+p);}
function sparse(samples){return samples.filter((p,i)=>i%7===0||i===samples.length-1).map(p=>p.slice(0,2));}
const harborActor=()=>({islandId:id,mode:'sailing',...harborOf(id).water,turn:0});
const sameAxis=(a,b)=>JSON.stringify([a.a,a.b])===JSON.stringify([b.a,b.b]);
const centreBanks=read('scripts/bigger-library/original/world.json').coastRings;
const bankXs=(ring,y)=>ring.flatMap((p,i)=>{
 const q=ring[(i+1)%ring.length];return (p[1]>y)!==(q[1]>y)?[p[0]+(q[0]-p[0])*(y-p[1])/(q[1]-p[1])]:[];
});
const centralChannel=[[4000,-1900],[4000,0],...Array.from({length:42},(_,i)=>{
 const y=700+i*100;return [(Math.max(...bankXs(centreBanks[0],y))+Math.min(...bankXs(centreBanks[1],y)))/2,y];
}),[3780.4139473164,5500],[4000,7200]];

test('Pagepond replaces every floating paperboat with the approved playable Home fleet',()=>{
 for(const group of ['props','flats','floating'])assert(!art[group].some(p=>retiredBoatIds.has(p.id)||p.kind==='boat'),'no decorative boat remains in '+group);
 const fleet=createBoats().filter(b=>b.islandId===id),nav=map.nav();
 for(const p of paperboatMoorings){
  const boat=fleet.find(b=>b.x===p.x&&b.y===p.y);assert(boat,p.id+' is a real fleet boat');assert(canSail(boat.x,boat.y,id),p.id+' full hull clears the shore');
  const shore=nav.nearest(boat.x,boat.y,280);assert(shore,p.id+' has boarding land');assert(nav.route(map.spawn.x,map.spawn.y,...shore).length,p.id+' boarding land is reachable');
 }
 const props=read('assets/world/themes/library/placements.json');
 assert(!props.some(p=>retiredBoatIds.has(p.id)));assert(!map.world.props.some(p=>retiredBoatIds.has(p.id)));
});

test('Pagepond exported water tiles leave no invisible land seams across a sailing hull',()=>{
 // A rounded tile seam here used to stop the south-moat to Paperboat route
 // between two valid waypoints. Check the exact contact and nearby hulls.
 for(let offset=-10;offset<=10;offset+=.25)assert(canSail(5578.37622480126+offset,7019.081055312963,id),'no hairline land plug at '+offset);
 assert.deepEqual(map.world.boatWater,map.walk.boatWater,'client and authority share the repaired mask');
});

test('one harbour boat visits every Pagepond channel, both complete moats and the north/south central canal, then returns',()=>{
 const actor=harborActor(),harbor=[actor.x,actor.y],visited=new Set();
 for(const ch of ground.channels){
  const points=sparse(ch.samples).reverse();for(const p of points)sail(actor,p);for(const p of [...points].reverse())sail(actor,p);visited.add(ch.id);
 }
 for(const tour of report.boatTours){for(const p of tour.points)sail(actor,p);visited.add(tour.id);}
 // The natural sea channel between the two page-shaped halves is not one
 // of the three authored river mouths. Cover it explicitly, end to end.
 for(const p of centralChannel)sail(actor,p);for(const p of [...centralChannel].reverse())sail(actor,p);visited.add('central-canal');
 sail(actor,harbor);assert.equal(visited.size,ground.channels.length+report.boatTours.length+1);
 for(const p of paperboatMoorings){sail(actor,[p.x,p.y]);sail(actor,harbor);}
});

test('every Pagepond crossing has hull clearance and sails under the raised deck from both sides',()=>{
 // The small reading dock ends in the isolated pond. It is a pier, rather
 // than a bridge between island sections; the other 17 arches cross channels.
 const readingDock=read('scripts/pagepond-ground/data/source.json').walkways.at(-1);
 const arches=map.world.arches.filter(a=>!sameAxis(a,readingDock));assert.equal(arches.length,17);
 const actor=harborActor();
 for(const a of arches){
  const w=map.world.walkways.find(w=>sameAxis(w,a));assert(w?.boatPassUnder,(a.id??a.a)+' boatPassUnder');
  assert(map.walk.walkways.find(w=>sameAxis(w,a))?.boatPassUnder,'client/server underpass agrees');
  const dx=a.b[0]-a.a[0],dy=a.b[1]-a.a[1],len=Math.hypot(dx,dy),x=(a.a[0]+a.b[0])/2,y=(a.a[1]+a.b[1])/2;
  const sides=[-1,1].map(k=>[x-dy/len*k*(a.w/2+BOAT_RADIUS+30),y+dx/len*k*(a.w/2+BOAT_RADIUS+30)]);
  for(const p of [sides[0],[x,y],sides[1],[x,y],sides[0]]){assert(canSail(...p,id),'full hull clears the banks under '+(a.id??a.a));sail(actor,p);}
 }
 const harbor=harborOf(id).water;sail(actor,[harbor.x,harbor.y]);
 // Every authored river and moat spine retains the hull plus a 30-unit
 // bank margin, including bends and mouths, with no dry-land plugs.
 for(const ch of [...ground.channels,...report.boatTours])for(const p of ch.samples??ch.points)assert(canSail(p[0],p[1],id,BOAT_RADIUS+30),ch.id+' bank clearance '+p);
 for(const p of centralChannel)assert(canSail(...p,id,BOAT_RADIUS+30),'central canal bank clearance '+p);
});
test('Pagepond boats enter from sea, circle both complete centre moats and sail back out',()=>{
 for(const [i,tour]of report.boatTours.entries()){
  const ch=ground.channels[i],inbound=sparse(ch.samples).reverse(),start=inbound[0],actor={islandId:id,mode:'sailing',x:start[0],y:start[1],turn:0};
  for(const p of inbound)sail(actor,p);
  let index=0;for(let k=1;k<tour.points.length-1;k++)if(Math.hypot(tour.points[k][0]-actor.x,tour.points[k][1]-actor.y)<Math.hypot(tour.points[index][0]-actor.x,tour.points[index][1]-actor.y))index=k;
  const points=[...tour.points.slice(index,-1),...tour.points.slice(0,index+1)];for(const p of points)sail(actor,p);for(const p of [...inbound].reverse())sail(actor,p);
 }
});
test('Pagepond south river is one clean, wide, sailable route from the sea to the moat and back',()=>{
 const pts=sparse(ground.channels[2].samples),start=pts.at(-1),actor={islandId:id,mode:'sailing',x:start[0],y:start[1],turn:0};for(const p of [...pts].reverse())sail(actor,p);for(const p of pts)sail(actor,p);assert(report.minimumBrookWidth>=180);assert(report.moatWidth>=180);
});
test('Every Pagepond river crossing uses Home Honeywood arch art, renders over boats, carries walkers and has calm open mouths',()=>{
 const nav=map.nav();for(const c of ground.crossings){const d=art.decks.find(d=>d.id===c.id);assert(d?.overBoats,c.id+' raised deck');assert(fs.readFileSync('public/pixi-art/themes/library/'+d.src,'utf8').includes('data-home-source="/pixi-art/home-expansion-c/bridges/bridge-'));assert(map.world.walkways.find(w=>w.id===c.id)?.boatPassUnder);assert(nav.walkable(c.x,c.y),c.id+' walkable');assert(canSail(c.x,c.y,id),c.id+' sails underneath');const a=map.world.arches.find(a=>a.id===c.id);assert.equal(deckX(c.x,c.y,map.world.arches),c.x,'no sideways crown shear');assert.equal(a.r,c.rise,'feet follow the direction-specific artwork crown');}
 for(const d of art.decks.filter(d=>d.homeSource||/jetty-(west|east|south)/.test(d.src)))assert(d.overBoats,'old centre bridge/jetty raised over boats');assert(map.world.riverMouths.length>=5);assert(shoreOf(map.world).length===map.world.shoreRings.length,'surf follows cut banks');
 assert(art.props.filter(p=>p.zone==='outer-meadow'&&p.kind==='tree').length>=90,'authored meadow groves');assert(report.meadowResidents>=10,'approved sleeping duckies in reading clearings');
 const before=read('scripts/pagepond-rework/baseline.json').art.props;for(const p of art.props.filter(p=>p.kind==='building'&&p.hamlet)){const old=before.find(o=>o.id===p.id);assert.equal(p.width,old.width);assert.equal(p.height,old.height);}
});
