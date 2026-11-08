import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {makeMap,mapFor} from '../../src/pixi/island-maps.js';
import {geometry} from '../../rive/web/island-geometry.mjs';
import {resolveSleepSpots,sleepHalfWidths} from '../../src/pixi/sleep-spots.js';
import {checkTheme} from '../theme-index.mjs';
import {places,lanes} from './design.mjs';
import {communities,houses} from './communities.mjs';
import {OUT} from './render.mjs';
const read=p=>JSON.parse(readFileSync(p)),D='rive/web/themes/sunflower/',A='public/pixi-art/themes/sunflower/',B='scripts/bigger-sunflower/baseline/';
const world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),art=read(A+'art.json'),oldWorld=read(B+'world.json'),oldWalk=read(B+'walk-world.json'),oldArt=read(B+'art.json');
const base=makeMap('sunflower',{world,walk,harbor,sleepers:[]});
const beds=resolveSleepSpots(base.baseWalk,art.props,geometry(base.baseWalk).walkable,sleepHalfWidths(),{spots:world.sleepSpots,avoid:world.sleepAvoid,warn:false});
const oldBase=makeMap('sunflower',{world:oldWorld,walk:oldWalk,harbor:read(B+'harbor.json'),sleepers:[]});
const oldBeds=resolveSleepSpots(oldBase.baseWalk,oldArt.props,geometry(oldBase.baseWalk).walkable,sleepHalfWidths(),{spots:oldWorld.sleepSpots,avoid:oldWorld.sleepAvoid,warn:false});
assert.deepEqual(beds,oldBeds,'all resolved sleepers stay exactly in place');
assert.equal(beds.length,40);assert.deepEqual(beds.bad,[]);
assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);
assert.deepEqual(art.flats,oldArt.flats);assert.deepEqual(art.decks.slice(0,oldArt.decks.length),oldArt.decks);
for(const k of ['sleepSpots','sleepAvoid','centrePlacement','islets','walkways','arches'])assert.deepEqual(world[k],oldWorld[k],k);
assert.deepEqual(world.water.slice(0,oldWorld.water.length),oldWorld.water);
for(const [k,v]of Object.entries(oldWorld.zones))assert.deepEqual(world.zones[k],v,'original zone '+k);
assert.deepEqual(walk.obstacles.slice(0,oldWalk.obstacles.length),oldWalk.obstacles);
const map=makeMap('sunflower',{world,walk,harbor,sleepers:beds}),nav=map.nav(),routes=[];
for(const h of houses){
 const door=[h.x,h.y+24],gate=[h.x,h.y+223];
 for(const p of [door,gate]){assert.ok(nav.walkable(...p),h.id+' entrance clear');assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...p).at(-1),p,h.id+' reachable entrance');}
 assert.ok(!nav.walkable(h.x,h.y-38),h.id+' solid house');
 assert.ok(!nav.walkable(h.x-146,h.y+183),h.id+' solid front rail');
}
for(const [name,p]of [...places.map(p=>[p.id,p.point]),...Object.entries(oldWorld.zones).map(([k,z])=>[k,z.spawn])]){
 assert.ok(nav.walkable(...p),name+' clear ground');
 const r=nav.route(map.spawn.x,map.spawn.y,...p);assert.deepEqual(r.at(-1),p,name+' reachable');
 let prev=[map.spawn.x,map.spawn.y];for(const next of r){assert.ok(nav.clearLine(prev,next),name+' route segment');prev=next}routes.push({name,point:p,steps:r.length});
}
// Actual coast points sampled inside the shore must all connect, so the walk is a loop.
for(let i=0;i<world.coast.length;i+=5){const p=world.coast[i],dx=4000-p[0],dy=2800-p[1],r=Math.hypot(dx,dy),q=[Math.round(p[0]+dx/r*180),Math.round(p[1]+dy/r*180)];assert.ok(nav.walkable(...q),'coast walk '+i);assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...q).at(-1),q,'coast route '+i)}
// Boarding uses the production map's nearest clear walking point within a short hop.
const boatChecks=[];
for(const p of map.boatSpots()){
 for(let i=0;i<16;i++){const a=i*Math.PI/8;assert.ok(!map.landAt(p.x+Math.cos(a)*46,p.y+Math.sin(a)*46),'boat afloat '+JSON.stringify(p))}
 const shore=map.shoreFor(p.x,p.y,300);assert.ok(shore,'reachable boarding shore '+JSON.stringify(p));boatChecks.push({boat:p,shore});
}
const ready=checkTheme('sunflower');assert.ok(ready.ready,ready.problems.join('\n'));
assert.equal(mapFor('sunflower').width,12000,'registry loads expanded island');
const area=c=>Math.abs(c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p[0]*q[1]-p[1]*q[0]},0))/2;
const report={ready:true,communities:communities.map(c=>({name:c.name,homes:c.homes.length,who:c.who,work:c.work})),reachableHouseDoors:houses.length,routes,coastChecks:36,boats:boatChecks,sleepers:40,originalProps:oldArt.props.length,originalFlats:oldArt.flats.length,addedProps:art.props.length-oldArt.props.length,areaBefore:area(oldWorld.coast),areaAfter:area(world.coast),areaRatio:area(world.coast)/area(oldWorld.coast),preserved:{props:true,flats:true,decks:true,zones:true,sleepers:true,interiorWater:true,centre:true,originalObstacles:true}};
writeFileSync(OUT+'/sunflower-work/validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
