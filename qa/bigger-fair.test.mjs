import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeMap,THEME_OF} from '../src/world/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {inPoly} from '../assets/world/island-geometry.mjs';
import {canSail,boardingPoint,landingSpot} from '../src/gameplay/islands.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const S='scripts/bigger-fair/',D='assets/world/themes/fair/',w=read(D+'world.json'),walk=read(D+'walk-world.json'),h=read(D+'harbor.json'),a=read('public/pixi-art/themes/fair/art.json'),e=read(S+'expansion.json');
const checked=checkTheme('fair'),map=makeMap('fair',{world:w,walk,harbor:h,sleepers:checked.sleepers}),nav=map.nav();
test('AC-2 preserves retained outer scenery, keeps castle art and resolves 90 approved sleepers',()=>{
 const old=read(S+'original-art.json'),ow=read(S+'original-world.json');
 for(const p of [...old.props,...e.newProps].filter(p=>!inPoly(p.x,p.y,ow.coast))){
  const current=a.props.find(q=>q.id===p.id);if (Object.hasOwn(read(S+'hamlets.json'),p.community) || read(S+'hamlets/retired-obstacles.json').some(q=>q.id===p.id)) continue;
  assert(current,'outer prop '+p.id);
  const move=read('scripts/fair-life/layout.json').moves[p.id];
  for(const key of ['src','x','y','width','height','scale'])assert.deepEqual(current[key],move&&key==='x'?move[0]:move&&key==='y'?move[1]:p[key],p.id+' '+key);
 }
 assert.equal(a.props.find(p=>p.id==='fair-0').src,'castle.svg');
 assert.deepEqual(w.paths,read(D+'paths.json'),'sleeper checks use the combined centre and hamlet road graph');
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,90);
 assert.equal(new Set(a.props.map(p=>p.id)).size,a.props.length);
});
test('all four Fair communities, home doors and the full coast loop connect to the original plaza',()=>{
 for(const p of [...e.places.map(p=>p.point),...read(S+'communities.json').homes.map(h=>h.door),...e.paths[0].line,...w.walkways.flatMap(b=>[b.a,b.b])]){
  assert(nav.walkable(...p),p.join(',')+' blocked');const route=nav.route(map.spawn.x,map.spawn.y,...p);
  assert(route.length||nav.clearLine([map.spawn.x,map.spawn.y],p),p.join(',')+' unreachable');
  let prev=[map.spawn.x,map.spawn.y];for(const q of route){assert(nav.clearLine(prev,q));prev=q;}
 }
 // Footprints follow their prop to where the art stands now, so a moved prop never leaves an invisible wall behind.
 for(const p of e.newProps.filter(p=>a.props.some(q=>q.id===p.id))){const q=a.props.find(q=>q.id===p.id);for(const f of p.footprints)assert(!nav.walkable(f.x+q.x-p.x,f.y+q.y-p.y),'missing footprint '+p.id);}
});
test('expanded Fair has GPU-safe ground tiles, ten usable boats and a sea-facing harbour',()=>{
 assert(w.origin.x<0&&w.origin.y<0);for(const t of a.ground.tiles)assert(t.width<=1536&&t.height<=1536);
 assert.equal(a.ground.tiles.reduce((s,t)=>s+t.width*t.height,0),w.width*w.height);
 const id=[...THEME_OF].find(([,theme])=>theme==='fair')[0];assert.equal(map.boatSpots().length,10);
 for(const b of map.boatSpots()){
  assert(canSail(b.x,b.y,id),'boat afloat '+JSON.stringify(b));
  const p=boardingPoint({...b,islandId:id});assert(nav.walkable(p.x,p.y),'boat has walkable boarding point');
  assert(landingSpot({...b,islandId:id}),'boat docks at beach or jetty');
 }
 const water=map.HARBOR.water;assert(canSail(water.x,water.y,id));
});

test('Fair communities have inhabited homes and theme-specific workplaces outside the preserved heart',()=>{
 const c=read(S+'communities.json');assert.equal(c.communities.length,4);assert.equal(c.homes.length,17);
 for(const z of c.communities){
  const homes=e.newProps.filter(p=>p.community===z.id&&p.role==='home');assert.equal(homes.length,z.hamlet.homes,z.id+' home count');
  assert(e.newProps.some(p=>p.community===z.id&&p.role==='workplace'),z.id+' lacks workplace');
  assert(z.people&&z.work);
 }
 const tiles=a.ground.tiles;for(const t of tiles){const old=read(S+'original-art.json').ground.tiles.find(o=>o.x===t.x&&o.y===t.y);if(old)assert.equal(t.resolution??1,1);}
});

test('Fair inland decks cross actual blocked water and connect to the heart',async()=>{
 const {inShape}=await import('../assets/world/island-geometry.mjs');
 const wet=(x,y)=>w.water.some(shape=>inShape(x,y,shape));
 assert.equal(a.decks.length,12);
 for(const b of w.bridges){
  assert(wet(b.x,b.y),b.id+' has no water beneath its deck');
  assert(nav.walkable(b.x,b.y),b.id+' deck is blocked');
  assert(nav.route(map.spawn.x,map.spawn.y,b.x,b.y).length||nav.clearLine([map.spawn.x,map.spawn.y],[b.x,b.y]),b.id+' unreachable');
 }
 for(const point of [[-800,3500],[8240,1810],[950,-310],[5200,4100]]){
  assert(wet(...point),'missing water at '+point);
  assert(!nav.walkable(...point),'ducks can walk on water at '+point);
  assert.equal(map.landAt(...point),point[0]===950,'only the unconnected orchard pond stays closed to boats');
 }

});

test('Fair neighbours have distinct home sizes, roofs and domestic details',()=>{
 const homes=e.newProps.filter(p=>p.role==='home');
 for(const z of read(S+'communities.json').communities){
  const neighbourhood=homes.filter(p=>p.community===z.id);
  assert.equal(new Set(neighbourhood.map(p=>p.src)).size,neighbourhood.length);
  assert(new Set(neighbourhood.map(p=>`${p.width},${p.height}`)).size>=3);
 }
 const retired=new Set(read(S+'hamlets/retired-obstacles.json').map(p=>p.id));
 for(const p of e.newProps.filter(p=>p.community==='commons'))assert(!retired.has(p.id),'cleared backdrop reintroduced');
});
