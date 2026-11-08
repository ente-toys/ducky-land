import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapFor,makeMap} from '../src/pixi/island-maps.js';
import {shoreOf} from '../src/pixi/surf.js';
import {boardingPoint,canSail,originOffset,seaBoundsFor,destinationsFor} from '../src/pixi/islands.js';
import {THEME_OF} from '../src/pixi/island-maps.js';
import {geometry,inPoly} from '../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../src/pixi/sleep-spots.js';
import {communities,houses} from '../scripts/bigger-sunflower/communities.mjs';
import {REMOVE_PROPS,REMOVE_FLATS,LIFT_FLATS,MOVE_PROPS,FIELDS,FIELD_KEEP} from '../scripts/bigger-sunflower/centre-data.mjs';
import {inShape} from '../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),B='scripts/bigger-sunflower/baseline/',D='rive/web/themes/sunflower/';
const old=read(B+'world.json'),originalArt=read(B+'art.json'),art=read('public/pixi-art/themes/sunflower/art.json'),extension=read(D+'bigger-sunflower.json'),map=mapFor('sunflower');

test('bigger Sunflower keeps original centre, props, decals, decks and all 40 sleeper coordinates',()=>{
 // boss 8 Nov (inner island): three buildings stay (barn, windmill, honey stall); the flower stall, tree-73 and the two stone pads'
 // inlay decals go; whatever stood on the sunflower fence's line moved inland by hand (MOVE_PROPS); and inside the twelve
 // sunflower fields (FIELDS) only the scarecrows and three tree clumps stay. Every other original prop is unchanged, in order.
 const moved=p=>MOVE_PROPS[p.id]?{...p,x:MOVE_PROPS[p.id][0],y:MOVE_PROPS[p.id][1]}:p;
 const keep=new Set([...FIELD_KEEP,...FIELDS.map(f=>f.scarecrow).filter(s=>typeof s==='string')]);
 const stays=originalArt.props.filter(p=>!REMOVE_PROPS.includes(p.id)).map(moved).filter(p=>keep.has(p.id)||!FIELDS.some(f=>inPoly(p.x,p.y,f.poly)));
 assert.deepEqual(art.props.slice(0,stays.length),stays);
 assert.deepEqual(art.flats,originalArt.flats.filter(f=>!REMOVE_FLATS.includes(f.id)&&!LIFT_FLATS.includes(f.id)));
 // the plaza floor and petal inlay are drawn right after GPT's step rings (they were hidden under the rings' new oval fill)
 const at=art.decks.findIndex(d=>d.id==='centre-back');assert.deepEqual(art.decks.slice(at+1,at+3).map(({resolution,...d})=>d),LIFT_FLATS.map(id=>originalArt.flats.find(f=>f.id===id)));
 // boss 8 Nov (boats in the centre): the four flat jetty planks are now arched bridges (bigger/arch-original-N.svg) a boat passes
 // under; the two old arches and the centre stay, and every old walkway and arch keeps its line, now with boatPassUnder
 const kept=originalArt.decks.filter(d=>!/^jetty-/.test(d.src));assert.deepEqual(art.decks.filter(d=>kept.some(k=>k.src===d.src)).map(({overBoats,...d})=>d),kept);
 for(const n of [1,2,3,4])assert.ok(art.decks.some(d=>d.src===`bigger/arch-original-${n}.svg`),'arched bridge '+n);
 for(const key of ['sleepAvoid','centrePlacement','islets'])assert.deepEqual(map.world[key],old[key],key);
 assert.deepEqual(map.world.walkways.slice(0,old.walkways.length).map(({boatPassUnder,...w})=>w),old.walkways);assert.deepEqual(map.world.arches.slice(0,old.arches.length),old.arches);
 assert.deepEqual(map.world.water.slice(0,old.water.length),old.water);
 for(const [id,z]of Object.entries(old.zones))assert.deepEqual(map.world.zones[id],z);
 // boss 8 Nov: ten sleepers moved onto the GPT hamlets' sleeper points (hamlets.json), and the ones on the fence line or in the
 // new fields moved to path edges and clearings (SLEEP_MOVES): the same poses and count, and all 40 resolve
 assert.equal(map.sleepers.length,40);
 for(const [pose,list]of Object.entries(old.sleepSpots))assert.equal(map.world.sleepSpots[pose].length,list.length,pose);
 for(const b of map.sleepers)assert.ok(!FIELDS.some(f=>inPoly(b.x,b.y,f.poly)),'no sleeper in a field '+b.pose+' '+b.x+','+b.y);
});
test('Sunflower communities and the coast loop remain reachable across negative origins',()=>{
 assert.deepEqual(map.origin,{x:-2000,y:-1400});const nav=map.nav();
 for(const p of extension.places){assert.ok(nav.walkable(...p.point),p.id);const r=nav.route(map.spawn.x,map.spawn.y,...p.point);assert.deepEqual(r.at(-1),p.point,p.id);let prev=[map.spawn.x,map.spawn.y];for(const next of r){assert.ok(nav.clearLine(prev,next));prev=next}}
 const area=c=>Math.abs(c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p[0]*q[1]-p[1]*q[0]},0))/2;
 assert.ok(area(map.world.coast)/area(old.coast)>3);assert.equal(shoreOf(map.world).length,1,'surf follows the new sea coast, former islets are inland gardens');
 for(const t of art.ground.tiles){assert.ok(t.width<=1536&&t.height<=1536,t.src)}
});
// boss 8 Nov: the old 23 cottages are gone; each community is its GPT hamlet. Every hamlet home's door is clear and
// reachable from spawn, and its base is solid like the old foundations.
test('every Sunflower hamlet home has a reachable door and a solid base',()=>{
 const nav=map.nav();assert.equal(communities.length,5);assert.equal(houses.length,0);
 assert.equal(new Set(communities.map(c=>c.kind)).size,5);
 const homes=art.props.filter(p=>p.communityRole==='home');assert.ok(homes.length>=20,'hamlet homes '+homes.length);
 for(const c of extension.communities){assert.ok(c.hamlet.homes.length>=4,c.id+' has a residential cluster');assert.ok(c.hamlet.workplaces.length>=1,c.id+' has a workplace');}
 for(const h of homes){
  const door=[Math.round(h.x),Math.round(h.y+34)];
  assert.ok(nav.walkable(...door),h.id+' door');
  const r=nav.route(map.spawn.x,map.spawn.y,...door);assert.deepEqual(r.at(-1),door,h.id+' connected');
  let prev=[map.spawn.x,map.spawn.y];for(const q of r){assert.ok(nav.clearLine(prev,q),h.id+' clear route');prev=q;}
  assert.ok(!nav.walkable(h.footprint.x,h.footprint.y),h.id+' foundation');
 }
 const originalWalk=read(B+'walk-world.json'),before=geometry(originalWalk).walkable,after=geometry(map.baseWalk).walkable;
 // boss 8 Nov (inner island): the flower stall and tree-73 are gone and moved props took their footprints along; only those
 // footprints changed
 const owner=(o,p)=>o.name===p.id||(o.x===p.x&&p.y-o.y>=0&&p.y-o.y<60);
 const changed=[...originalWalk.obstacles.filter(o=>originalArt.props.some(p=>(REMOVE_PROPS.includes(p.id)||MOVE_PROPS[p.id]||!art.props.some(q=>q.id===p.id))&&owner(o,p))),...map.baseWalk.obstacles.filter(o=>/^centre-fill-/.test(o.name??'')||art.props.some(p=>MOVE_PROPS[p.id]&&owner(o,p)))].map(o=>o.poly&&o.x===undefined?{...o,x:o.poly.reduce((s,q)=>s+q[0],0)/o.poly.length,y:o.poly.reduce((s,q)=>s+q[1],0)/o.poly.length,rx:200,ry:120}:o);
 // and the sunflower fields are solid, as the centre's fields always were
 for(let y=0;y<5600;y+=37)for(let x=0;x<8000;x+=37){if(inPoly(x,y,originalWalk.coast)&&!changed.some(o=>inShape(x,y,o,24))&&!FIELDS.some(f=>inPoly(x,y,f.poly)||f.poly.some((q,k)=>{const a=f.poly[(k+1)%f.poly.length],dx=a[0]-q[0],dy=a[1]-q[1],t=Math.max(0,Math.min(1,((x-q[0])*dx+(y-q[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-q[0]-t*dx,y-q[1]-t*dy)<40;})))assert.equal(after(x,y),before(x,y),'original walking terrain '+x+','+y);}
});
test('bigger Sunflower boats float, board and land through the production registry',()=>{
 const island=[...THEME_OF].find(([,theme])=>theme==='sunflower')[0];
 assert.equal(map.boatSpots().length,10);
 for(const p of map.boatSpots()){assert.ok(canSail(p.x,p.y,island));const b=boardingPoint({...p,islandId:island});assert.ok(map.nav().walkable(b.x,b.y));assert.ok(map.shoreFor(p.x,p.y,300))}
 for(const d of destinationsFor(island)){const m=mapFor(d.map),b=seaBoundsFor(island),o=originOffset(island,d.destination);assert.ok(o.x+m.origin.x>=b.x0&&o.x+m.origin.x+m.width<=b.x1)}
});

test('Sunflower canals block walking, every retained and new crossing spans real water and stays reachable',async()=>{
 const {waterways}=await import('../scripts/bigger-sunflower/water.mjs');
 const {inShape}=await import('../rive/web/island-geometry.mjs');
 const nav=map.nav();
 assert.equal(waterways.courses.length,2);
 for(const w of map.world.water)for(const key of ['x','y','rx','ry'])assert.ok(Number.isFinite(w[key]),'runtime ripple '+key);
 for(const p of [[4300,-450],[0,1500],[400,2860]])assert.ok(!nav.walkable(...p),'open water cannot be walked '+p);
 for(const b of [...waterways.originalCrossings,...waterways.bridges]){
  const p=b.mid??b.a.map((v,i)=>(v+b.b[i])/2);
  assert.ok(map.world.water.some(w=>inShape(...p,w)),b.id+' has actual water beneath deck');
  assert.ok(nav.walkable(...p),b.id+' deck is walkable');
  const route=nav.route(map.spawn.x,map.spawn.y,...p);assert.deepEqual(route.at(-1),p,b.id+' reachable');
  let previous=[map.spawn.x,map.spawn.y];for(const q of route){assert.ok(nav.clearLine(previous,q),b.id+' route clearance');previous=q;}
 }
 // No new dry-land prop is left standing in the canal. Reeds/lilies live in water.
 for(const p of art.props.slice(originalArt.props.length))if(!/pond-reeds|pond-lily/.test(p.id))assert.ok(!map.world.water.slice(old.water.length).some(w=>inShape(p.x,p.y-8,w)),p.id+' has dry footing');
 // boss 8 Nov: every hamlet home is its own GPT drawing
 for(const c of communities){const homes=art.props.filter(p=>p.zone===c.id&&p.communityRole==='home');assert.equal(new Set(homes.map(p=>p.src)).size,homes.length,c.id+' house art');}
});
// boss 8 Nov: "two solid layers all the way round the inner island's bank, no gaps anywhere except at the bridges"
test('the sunflower fence is two unbroken rows round the inner bank, open only at the bridges, and every sleeper still sleeps',async()=>{
 const {FENCE}=await import('../scripts/bigger-sunflower/centre-data.mjs');
 const flowers=art.props.filter(p=>p.id.startsWith('ring-fence-'));assert.ok(flowers.length>400);
 for(const [row,line] of FENCE.rows.entries()){
  const lens=line.slice(1).map((q,k)=>Math.hypot(q[0]-line[k][0],q[1]-line[k][1])),total=lens.reduce((s,v)=>s+v,0);
  for(let s=row*FENCE.step/2;s<total;s+=FENCE.step){let k=0,t=s;while(t>lens[k])t-=lens[k++];
   const x=line[k][0]+(line[k+1][0]-line[k][0])*t/lens[k],y=line[k][1]+(line[k+1][1]-line[k][1])*t/lens[k];
   if(FENCE.gaps.some(([gx,gy,r])=>Math.hypot(x-gx,y-gy)<r))continue;
   assert.ok(flowers.some(f=>Math.hypot(f.x-x,f.y-y)<1),`a flower at ${Math.round(x)},${Math.round(y)}`);
  }
 }
 // every opening is at a bridge: near the inner end of one of the ring's 14 arches
 const ends=map.world.arches.flatMap(a=>[a.a,a.b]);
 for(const [gx,gy] of FENCE.gaps)assert.ok(ends.some(e=>Math.hypot(e[0]-gx,e[1]-gy)<450),`opening ${gx},${gy} is at a bridge`);
 assert.equal(map.sleepers.length,40);
});
