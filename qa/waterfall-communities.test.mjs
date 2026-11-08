import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {makeMap}from '../src/pixi/island-maps.js';import {checkTheme}from '../scripts/theme-index.mjs';import {inShape,inPoly}from '../rive/web/island-geometry.mjs';
import {crossings,isWet}from '../scripts/bigger-waterfall/review-audit.mjs';
const j=p=>JSON.parse(fs.readFileSync(p)),D='rive/web/themes/waterfall/',A='public/pixi-art/themes/waterfall/',O='scripts/bigger-waterfall/original/';
const world=j(D+'world.json'),walk=j(D+'walk-world.json'),art=j(A+'art.json'),harbor=j(D+'harbor.json'),original=j(O+'world.json'),oldArt=j(O+'art.json'),plan=j('scripts/bigger-waterfall/plan.json'),map=makeMap('waterfall',{world,walk,harbor});
test('Waterfall communities preserve original props, landmarks, paths and all forty residents',()=>{
 assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);assert.deepEqual(world.sleepSpots,original.sleepSpots);assert.deepEqual(world.centrePlacement,original.centrePlacement);assert.deepEqual(world.zones,original.zones);assert.deepEqual(world.paths.slice(0,original.paths.length),original.paths);assert.equal(map.sleepers.length,40);assert.equal(checkTheme('waterfall').ready,true);
});
test('Waterfall has four working neighbourhoods, twenty reachable front gates, and a connected sea harbour',()=>{
 const n=map.nav();assert.equal(world.communities.length,4);
 for(const c of plan.communities){assert.equal(c.homes.length,5);for(const p of [c.point,...c.homes.map(([x,y])=>[x,y+160]),[c.work[0],c.work[1]+170]]){assert.ok(n.walkable(...p),`${c.id}: open entrance ${p}`);assert.ok(n.route(map.spawn.x,map.spawn.y,...p).length,`${c.id}: route to ${p}`);}}
 assert.ok(n.route(map.spawn.x,map.spawn.y,map.HARBOR.land.x,map.HARBOR.land.y).length);
 for(const boat of harbor.boats){assert.equal(map.landAt(boat.x,boat.y),false);assert.ok(Math.abs(boat.x-harbor.jetty.tip[0])<=180,'moored within boarding distance of pier');}
});
test('Waterfall new streams block feet and have actual water under their bridges; old canal islets stay dry',()=>{
 for(const river of plan.rivers){const pts=river.p.filter(([x,y])=>inPoly(x,y,world.coast));assert.ok(pts.some(([x,y])=>!map.nav().walkable(x,y)),`${river.id} blocks walking`);}
 for(const b of world.bridges.filter(b=>b.communityBridge!==undefined)){assert.ok(world.water.some(w=>[-.35,0,.35].some(u=>[-.35,0,.35].some(v=>inShape(b.x+b.w*u,b.y+b.h*v,w)))),`bridge ${b.communityBridge} spans actual water`);}
 for(const [x,y]of original.islets)assert.ok(map.nav().walkable(x,y)||map.nav().nearest(x,y,70),'old canal islet stays dry');
 // Every added road crossing is supported by a real bridge. Props may require walkers to skirt their footprints.
 for(const road of world.paths.slice(original.paths.length))for(const [x,y]of road){if(world.water.some(w=>inShape(x,y,w,10)))assert.ok(world.bridges.some(b=>Math.abs(x-b.x)<b.w/2&&Math.abs(y-b.y)<b.h/2),'road does not run unbridged through water: '+[x,y]);}
});
test('Waterfall ground is tiled within 1536 pixels and new solid footprints refer to drawn props',()=>{
 for(const t of art.ground.tiles){assert.ok(t.width<=1536&&t.height<=1536);assert.ok(t.width*(t.resolution??1)<=1536&&t.height*(t.resolution??1)<=1536);}
 const ids=new Set(art.props.map(p=>p.id));for(const o of world.obstacles.filter(o=>o.communityProp))assert.ok(ids.has(o.communityProp.replace(/-fence-(left|right)$/,''))||ids.has(o.communityProp.replace(/-fence-(left|right)$/,'-yard')));
});
test('Waterfall review audits every deck source and the sea harbour against actual water',()=>{
 for(const deck of art.decks)assert.ok(crossings.some(c=>c.id.split('@')[0]===deck.src),'unreviewed deck '+deck.src);
 for(const c of crossings)for(const p of c.samples)assert.ok(isWet(world,p,c.sea),`${c.name}: water below span at ${p}`);
 const pond=world.water.find(w=>w.communityWater==='spring-garden-pond');assert.ok(pond);
 assert.equal(map.nav().walkable(6860,900),false,'the new garden pond blocks feet');
});
test('Waterfall review commons remain reachable without painting over the original heart or islets',()=>{
 const n=map.nav();for(const p of plan.commonEntrances){assert.ok(n.walkable(...p),'open common entrance '+p);assert.ok(n.route(map.spawn.x,map.spawn.y,...p).length,'reachable common '+p);}
 for(const p of art.props.filter(p=>p.id.startsWith('community-common'))){
  assert.equal(inPoly(p.x,p.y,original.coast),false,'new common prop stays outside original heart: '+p.id);
  assert.equal(original.islets.some(([x,y,rx,ry])=>(p.x-x)**2/(rx+70)**2+(p.y-y)**2/(ry+70)**2<1),false,'new common prop stays off original islet: '+p.id);
  for(const [x,y,rx,ry]of original.islets){const cx=Math.max(p.x-p.width/2,Math.min(x,p.x+p.width/2)),cy=Math.max(p.y-p.height,Math.min(y,p.y));assert.ok((cx-x)**2/rx**2+(cy-y)**2/ry**2>1,'new common artwork stays off original islet: '+p.id);}
 }
});
