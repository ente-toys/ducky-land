import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {geometry,inPoly} from '../rive/web/island-geometry.mjs';
import {canSail,boardingPoint} from '../src/pixi/islands.js';
const read=p=>JSON.parse(fs.readFileSync(p)),B='scripts/bigger-community/baseline/',D='rive/web/themes/community/',A='public/pixi-art/themes/community/',old=read(B+'world.json'),oldArt=read(B+'art.json'),world=read(D+'world.json'),art=read(A+'art.json'),plan=read('scripts/bigger-community/plan.json');
test('community expansion keeps every original prop, decal, deck, sleeper and collision record',()=>{
 assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);
 assert.deepEqual(art.flats,oldArt.flats);assert.deepEqual(art.decks.slice(0,oldArt.decks.length),oldArt.decks);
 assert.deepEqual(world.sleepSpots,old.sleepSpots);assert.deepEqual(world.sleepAvoid,old.sleepAvoid);
 assert.deepEqual(world.obstacles.slice(0,old.obstacles.length),old.obstacles);
 for(const [key,z]of Object.entries(old.zones))assert.deepEqual(world.zones[key],z);
 assert.equal(mapFor('community').sleepers.length,40);assert.deepEqual(mapFor('community').spawn,{x:4000,y:2970});
});
test('community new places and main road circuit connect to the unchanged campfire',()=>{
 const m=mapFor('community'),n=m.nav();
 for(const s of plan.places){assert.ok(n.walkable(...s.point),s.id+' open arrival');const route=n.route(m.spawn.x,m.spawn.y,...s.point);assert.deepEqual(route.at(-1),s.point,s.id+' connected');let prev=[m.spawn.x,m.spawn.y];for(const p of route){assert.ok(n.clearLine(prev,p),s.id+' valid path');prev=p;}}
 for(let i=0;i<plan.loop.length-1;i++){const a=n.nearest(...plan.loop[i],180),b=n.nearest(...plan.loop[i+1],180);assert.ok(a&&b);assert.deepEqual(n.route(...a,...b).at(-1),b,'loop segment '+i);}
 for(const p of plan.props)assert.ok(inPoly(p.x,p.y,world.coast),p.id+' is grounded');
 const g=geometry({...world,obstacles:plan.obstacles});for(const o of plan.obstacles)assert.equal(g.walkable(o.x,o.y),false,o.id+' matching visible solid');
});
test('community outer harbour floats, boards and returns to the campfire with GPU-safe ground',()=>{
 const m=mapFor('community'),n=m.nav();assert.ok(m.origin.x<0&&m.origin.y<0);
 for(const t of art.ground.tiles)assert.ok(t.width<=1536&&t.height<=1536,'GPU-safe ground');
 assert.ok(canSail(m.HARBOR.water.x,m.HARBOR.water.y,'isle-250'));assert.ok(n.walkable(m.HARBOR.land.x,m.HARBOR.land.y));
 assert.deepEqual(n.route(m.HARBOR.land.x,m.HARBOR.land.y,m.spawn.x,m.spawn.y).at(-1),[m.spawn.x,m.spawn.y]);
 for(const b of m.boatSpots()){assert.ok(canSail(b.x,b.y,'isle-250'));const at=boardingPoint({...b,islandId:'isle-250'});assert.ok(n.walkable(at.x,at.y));assert.ok(Math.hypot(at.x-b.x,at.y-b.y)<=280,'boarding distance');}
});
test('four community neighbourhoods have accessible homes, workplace greens and short residential lanes',()=>{
 const m=mapFor('community'),n=m.nav();assert.equal(plan.communities.length,4);assert.equal(plan.homes.length,22);
 assert.equal(new Set(plan.communities.map(c=>c.type)).size,4,'different house types and activities');
 for(const c of plan.communities){assert.ok(c.homes.length>=5);assert.ok(c.residents&&c.work);for(const point of c.lane){const at=n.nearest(...point,100);assert.ok(at,c.id+' open lane');assert.deepEqual(n.route(m.spawn.x,m.spawn.y,...at).at(-1),at,c.id+' connected lane');}}
 for(const w of plan.workStops){assert.ok(n.walkable(...w.point),w.name+' open entrance');assert.deepEqual(n.route(m.spawn.x,m.spawn.y,...w.point).at(-1),w.point,w.name+' connected to heart');}
 for(const h of plan.homes){assert.ok(n.walkable(...h.door),h.id+' open front door');assert.deepEqual(n.route(m.spawn.x,m.spawn.y,...h.door).at(-1),h.door,h.id+' can walk home');}
 for(const o of plan.obstacles.filter(o=>o.poly)){const x=o.poly.reduce((s,p)=>s+p[0],0)/o.poly.length,y=o.poly.reduce((s,p)=>s+p[1],0)/o.poly.length;assert.equal(n.walkable(x,y),false,o.id+' visible fence blocks');}
});

test('community densification preserves waterways and crossings while reducing roads and clustering homes',()=>{
 const before=read('scripts/bigger-community/dense-before-plan.json'),metrics=read('scripts/bigger-community/dense-road-after.json');
 for(const key of ['coast','reviewWater','reviewBridges','reviewDecks','reviewRivers','reviewCommons','harbor'])assert.deepEqual(plan[key],before[key],key+' is unchanged');
 assert.ok(metrics.roadPercent<20,'road surface stays comfortably below a quarter of new dry land');
 assert.ok(metrics.roadAndBankPercent<25,'raised banks also fit below the quarter limit');
 assert.equal(metrics.coastLoop,false);assert.equal(plan.roadWidths.main,185);
 assert.ok(plan.roadWidths.lane<plan.roadWidths.main);
 assert.deepEqual(plan.loop[0],plan.loop.at(-1),'one closed main circuit');
 for(const lane of plan.lanes)assert.notDeepEqual(lane[0],lane.at(-1),'local lanes do not duplicate the main circuit');
 const spacing=(p,id)=>{const hs=p.homes.filter(h=>h.community===id);return hs.reduce((s,h)=>s+Math.min(...hs.filter(v=>v!==h).map(v=>Math.hypot(h.x-v.x,h.y-v.y))),0)/hs.length;};
 for(const c of plan.communities){assert.ok(spacing(plan,c.id)<spacing(before,c.id)*.9,c.id+' homes are measurably closer');assert.ok(plan.props.some(q=>q.id==='dense-'+c.id+' well'),c.id+' has a shared well');}
 for(const h of plan.homes){const x=h.x,y=h.y;for(const [dx,dy]of [[0,-110],[-150,125],[150,125]])assert.ok(!world.water.some(o=>containsWater(x+dx,y+dy,o)),h.id+' home and fences remain dry');}
 function containsWater(x,y,o){return o.poly?inPoly(x,y,o.poly):((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1;}
});

test('community review: every retained bridge crosses real water and every new crossing is reachable',()=>{
 const m=mapFor('community'),n=m.nav(),water=world.water;
 const contains=(x,y,o)=>o.poly?inPoly(x,y,o.poly):((x-o.x)/o.rx)**2+((y-o.y)/o.ry)**2<1;
 const spans=[['northwest jetty',1113,1408],['northeast jetty',6828,1404],['east jetty',7189,3129],['west islet bridge',1839,4266],['east islet bridge',6155,4264],['pond dock',1965,1640],...plan.reviewDecks.map(d=>[d.name,d.x+d.width/2,d.y+d.height/2])];
 for(const [name,x,y]of spans){assert.ok(water.some(o=>contains(x,y,o)),name+' has water beneath its span');assert.ok(n.walkable(x,y),name+' has a solid deck');assert.deepEqual(n.route(m.spawn.x,m.spawn.y,x,y).at(-1),[x,y],name+' reachable');}
 const dock=art.decks.find(d=>d.src==='expansion/jetty.svg');assert.ok(dock);assert.equal(inPoly(4000,7030,world.coast),false,'harbour deck extends over the sea');
 assert.equal(plan.reviewRivers.length,2);
 for(const [x,y]of [[350,3150],[7800,3400],[5350,5200],[3000,490],[800,2500]]){assert.ok(water.some(o=>contains(x,y,o)),'visible water is collision water');assert.equal(n.walkable(x,y),false,'ducks cannot walk through water away from a deck');}
 for(const common of plan.reviewCommons){assert.ok(n.walkable(...common.point),common.name+' open arrival');assert.deepEqual(n.route(m.spawn.x,m.spawn.y,...common.point).at(-1),common.point,common.name+' reachable');}
 const walk=read(D+'walk-world.json');assert.deepEqual(walk.water,world.water,'server and client use the same water');assert.deepEqual(walk.bridges,world.bridges,'server and client use the same crossings');
});
