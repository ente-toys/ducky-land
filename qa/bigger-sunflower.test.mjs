import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {mapFor,makeMap} from '../src/pixi/island-maps.js';
import {shoreOf} from '../src/pixi/surf.js';
import {boardingPoint,canSail,originOffset,seaBoundsFor,destinationsFor} from '../src/pixi/islands.js';
import {THEME_OF} from '../src/pixi/island-maps.js';
import {geometry,inPoly} from '../assets/world/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths,SUNBOB_SLEEP_TOTAL} from '../src/pixi/sleep-spots.js';
import {communities,houses} from '../scripts/bigger-sunflower/communities.mjs';
import {REMOVE_PROPS,REMOVE_FLATS,LIFT_FLATS,MOVE_PROPS,FIELDS,FIELD_KEEP} from '../scripts/bigger-sunflower/centre-data.mjs';
import {inShape} from '../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url))),B='scripts/bigger-sunflower/baseline/',D='assets/world/themes/sunflower/';
const canonical=p=>{const {pathOriginalSrc,...q}=p;return pathOriginalSrc?{...q,src:pathOriginalSrc}:q;};
const moves=read('scripts/sunbob-ground/path-report.json').relocated;
const old=read(B+'world.json'),originalArt=read(B+'art.json'),art=read('public/pixi-art/themes/sunflower/art.json'),extension=read(D+'bigger-sunflower.json'),map=mapFor('sunflower');

test('Sunbob bloom replaces raised plaza, retains untouched props and resolves 90 residents',()=>{
 const centre=read('public/pixi-art/themes/sunflower/bloom/centre-placements.json');
 const retired=new Set(centre.retirePropIds);
 assert.ok(!art.props.some(p=>retired.has(p.id)&&!/^detail\/field-(flower|row-short)\.svg$/.test(p.pathOriginalSrc??p.src)));
 assert.ok(!art.decks.some(p=>['centre-back','centre-decal-floor','close-sunflower-rosette'].includes(p.id)));
 assert.deepEqual(map.world.centrePlacement.stairs,[]);
 for(const p of centre.props){
  let actual=art.props.find(q=>q.id===p.id);
  const moved=moves.find(m=>m.id===p.id);if(moved){assert.deepEqual([actual.x,actual.y],moved.to);actual={...actual,x:p.x,y:p.y};}
  if(/(?:^|[-/])(?:tree|bush|shrub)(?=[-/.]|$)/i.test(p.src)){
   assert.match(actual.src,/^\/pixi-art\/plants\/(tree-[1-5]|bush-[1-4])\.svg$/);
   assert.deepEqual({...actual,src:p.src},p);
  }else assert.deepEqual(actual,p);
 }
 for(const p of art.props.filter(p=>/(?:^|[-/])(?:tree|bush|shrub)(?=[-/.]|$)/i.test(p.src)))assert.match(p.src,/^\/pixi-art\/plants\/(tree-[1-5]|bush-[1-4])\.svg$/);
 for(const key of ['islets','water'])assert.deepEqual(map.world[key].slice(0,old[key].length),old[key]);
 assert.equal(map.world.sleepTotal,SUNBOB_SLEEP_TOTAL);assert.equal(new Set(art.props.map(p=>p.id)).size,art.props.length);assert.equal(map.sleepers.length,90);
 assert.equal(new Set(map.sleepers.map(b=>b.pose)).size,8);
 const beds=resolveSleepSpots(map.baseWalk,art.props,geometry(map.baseWalk).walkable,sleepHalfWidths(),{spots:map.world.sleepSpots,avoid:map.world.sleepAvoid,warn:false});
 assert.equal(beds.length,90);assert.deepEqual(beds.bad,[]);
});
test('Sunflower communities and the coast loop remain reachable across negative origins',()=>{
 assert.deepEqual(map.origin,{x:-2000,y:-1400});const nav=map.nav();
 for(const p of extension.places){assert.ok(nav.walkable(...p.point),p.id);const r=nav.route(map.spawn.x,map.spawn.y,...p.point);assert.deepEqual(r.at(-1),p.point,p.id);let prev=[map.spawn.x,map.spawn.y];for(const next of r){assert.ok(nav.clearLine(prev,next));prev=next}}
 const area=c=>Math.abs(c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p[0]*q[1]-p[1]*q[0]},0))/2;
 assert.ok(area(map.world.coast)/area(old.coast)>3);assert.equal(shoreOf(map.world).length,1,'surf follows the new sea coast, former islets are inland gardens');
 for(const t of art.ground.tiles){assert.ok(t.width<=1536&&t.height<=1536,t.src)}
});
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
 const owner=(o,p)=>o.name===p.id||(o.x===p.x&&p.y-o.y>=0&&p.y-o.y<60);
 const changed=[...originalWalk.obstacles.filter(o=>originalArt.props.some(p=>(REMOVE_PROPS.includes(p.id)||MOVE_PROPS[p.id]||!art.props.some(q=>q.id===p.id))&&owner(o,p))),...map.baseWalk.obstacles.filter(o=>/^centre-fill-|^bloom-|^sunbob-outer-/.test(o.name??'')||art.props.some(p=>MOVE_PROPS[p.id]&&owner(o,p)))].map(o=>o.poly&&o.x===undefined?{...o,x:o.poly.reduce((s,q)=>s+q[0],0)/o.poly.length,y:o.poly.reduce((s,q)=>s+q[1],0)/o.poly.length,rx:200,ry:120}:o);
 for(const m of moves)for(const [x,y] of [m.fromPoint,m.to])changed.push({x,y,rx:250,ry:160});
 for(let y=0;y<5600;y+=37)for(let x=0;x<8000;x+=37){if(!inShape(x,y,{x:3880,y:2608.5,rx:1750,ry:1100})&&inPoly(x,y,originalWalk.coast)&&!changed.some(o=>inShape(x,y,o,24))&&!FIELDS.some(f=>inPoly(x,y,f.poly)||f.poly.some((q,k)=>{const a=f.poly[(k+1)%f.poly.length],dx=a[0]-q[0],dy=a[1]-q[1],t=Math.max(0,Math.min(1,((x-q[0])*dx+(y-q[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-q[0]-t*dx,y-q[1]-t*dy)<40;})))assert.equal(after(x,y),before(x,y),'original walking terrain '+x+','+y);}
});
test('bigger Sunflower boats float, board and land through the production registry',()=>{
 const island=[...THEME_OF].find(([,theme])=>theme==='sunflower')[0];
 assert.equal(map.boatSpots().length,10);
 for(const p of map.boatSpots()){assert.ok(canSail(p.x,p.y,island));const b=boardingPoint({...p,islandId:island});assert.ok(map.nav().walkable(b.x,b.y));assert.ok(map.shoreFor(p.x,p.y,300))}
 for(const d of destinationsFor(island)){const m=mapFor(d.map),b=seaBoundsFor(island),o=originOffset(island,d.destination);assert.ok(o.x+m.origin.x>=b.x0&&o.x+m.origin.x+m.width<=b.x1)}
});

test('Sunflower canals block walking, every retained and new crossing spans real water and stays reachable',async()=>{
 const {waterways}=await import('../scripts/bigger-sunflower/water.mjs');
 const {inShape}=await import('../assets/world/island-geometry.mjs');
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
 for(const p of art.props.slice(originalArt.props.length))if(!/pond-reeds|pond-lily/.test(p.id))assert.ok(!map.world.water.slice(old.water.length).some(w=>inShape(p.x,p.y-8,w)),p.id+' has dry footing');
 for(const c of communities){const homes=art.props.filter(p=>p.zone===c.id&&p.communityRole==='home');assert.equal(new Set(homes.map(p=>p.src)).size,homes.length,c.id+' house art');}
});
test('the original sunflower fence follows both bank rows at main density, preserving bridge openings and sleepers',async()=>{
 const {FENCE}=await import('../scripts/bigger-sunflower/centre-data.mjs');
 const flowers=art.props.filter(p=>p.id.startsWith('ring-fence-'));assert.equal(flowers.length,448);
 assert.ok(flowers.every(f=>(f.pathOriginalSrc??f.src)==='detail/field-flower.svg'));
 for(const [row,line] of FENCE.rows.entries()){
  const lens=line.slice(1).map((q,k)=>Math.hypot(q[0]-line[k][0],q[1]-line[k][1])),total=lens.reduce((s,v)=>s+v,0);
  for(let s=row*FENCE.step/2;s<total;s+=FENCE.step){let k=0,t=s;while(t>lens[k])t-=lens[k++];
   const x=line[k][0]+(line[k+1][0]-line[k][0])*t/lens[k],y=line[k][1]+(line[k+1][1]-line[k][1])*t/lens[k];
   if(FENCE.gaps.some(([gx,gy,r])=>Math.hypot(x-gx,y-gy)<r))continue;
   assert.ok(flowers.some(f=>Math.hypot(f.x-x,f.y-y)<140),`a nearby flower at ${Math.round(x)},${Math.round(y)}`);
  }
 }
 const ends=map.world.arches.flatMap(a=>[a.a,a.b]);
 for(const [gx,gy] of FENCE.gaps)assert.ok(ends.some(e=>Math.hypot(e[0]-gx,e[1]-gy)<450),`opening ${gx},${gy} is at a bridge`);
 assert.equal(map.sleepers.length,90);
});

test('Sunbob field art, positions, rows, density and arrangement retain main data',()=>{
 const fields=art.props.filter(p=>/^detail\/field-(flower|row-short)\.svg$/.test(p.pathOriginalSrc??p.src)).map(canonical);
 assert.equal(fields.length,1050);
 assert.equal(createHash('sha256').update(JSON.stringify(fields)).digest('hex'),'92b3214083df040248e0837acc094d7101839b777fb3b0ee4a1dd8da9c167ce3');
 for(const [name,hash] of Object.entries({"field-flower": "91c7d92214d073a3ad3cef194912d31d03ea85b0b59dd5d8ede4b680f688bc10", "field-row-short": "c1fff6a105775d0cd6d81f0b336ed80ef7aeaf9d8d7ab119ae386534125b3210"}))
  assert.equal(createHash('sha256').update(readFileSync(new URL('../public/pixi-art/themes/sunflower/detail/'+name+'.svg',import.meta.url))).digest('hex'),hash);
});
