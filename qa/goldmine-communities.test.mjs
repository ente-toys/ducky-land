import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeMap} from '../src/pixi/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const world=read('rive/web/themes/goldmine/world.json'),walk=read('rive/web/themes/goldmine/walk-world.json'),harbor=read('rive/web/themes/goldmine/harbor.json'),art=read('public/pixi-art/themes/goldmine/art.json');
const original=read('scripts/bigger-goldmine/original/world.json'),oldArt=read('scripts/bigger-goldmine/original/art.json'),map=makeMap('goldmine',{world,walk,harbor}),nav=map.nav();
test('Goldmine communities retain the complete original prop and sleeper composition',()=>{
 assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);assert.deepEqual(world.sleepSpots,original.sleepSpots);
 assert.equal(readFileSync(new URL('../public/pixi-art/themes/goldmine/community/original-ground.svg',import.meta.url),'utf8'),readFileSync(new URL('../public/pixi-art/themes/goldmine/ground.svg',import.meta.url),'utf8'));
});
test('Goldmine homes and working communities connect to the unchanged heart',()=>{
 for(const c of read('scripts/bigger-goldmine/plan.json').communities){assert.ok(nav.walkable(...c.point),c.name);assert.ok(nav.route(map.spawn.x,map.spawn.y,...c.point).length,c.name);}
 for(const p of art.props.filter(p=>p.id.startsWith('community-')&&/ home|forge|office|cooperage/.test(p.name))){assert.ok(nav.walkable(p.x,p.y+65),p.id);assert.ok(nav.route(map.spawn.x,map.spawn.y,p.x,p.y+65).length,p.id);}
});
test('Goldmine remains ready with 40 sleepers, safe tiles and open sea moorings',()=>{
 const r=checkTheme('goldmine');assert.ok(r.ready,r.problems.join('; '));assert.equal(r.sleepers.length,40);
 for(const t of art.ground.tiles){assert.ok(t.width<=1536&&t.height<=1536);assert.ok(t.width*t.resolution<=1536&&t.height*t.resolution<=1536);}
 for(const b of harbor.boats){assert.equal(map.landAt(b.x,b.y),false);assert.ok(map.shoreFor(b.x,b.y,280));}
 assert.equal(nav.walkable(8370,2100),false,'stream water is solid to walkers');
 assert.ok(nav.walkable(8350,1280),'upper stream bridge');assert.ok(nav.walkable(8090,5460),'lower stream bridge');
});
test('Goldmine harbour and every bridge span water across the central deck width',()=>{
 const decks=read('scripts/bigger-goldmine/bridge-audit.json');
 assert.equal(decks.length,art.decks.length+1,'includes the runtime harbour deck');
 for(const d of decks){
  assert.equal(d.wetSamples,d.sampleCount,d.src+' has no dry seam beneath its crossing');
  assert.ok(d.waterUnderDeck,d.src);
  assert.ok(nav.walkable(d.x,d.y),d.src+' remains traversable');
 }
 for(const d of decks.filter(d=>/river-bridge-[23]/.test(d.src))){
  const {a,b}=d.walkAxis;
  assert.equal(a[0],b[0],'vertical art has a vertical walk strip');
  for(let t=0;t<=1;t+=.1)assert.ok(nav.walkable(a[0],a[1]+(b[1]-a[1])*t),d.src+' full span');
 }
 assert.equal(nav.walkable(8370,2100),false,'unbridged stream stays closed to walkers');
 for(const [x,y] of [[3260,4855],[5800,4620],[8090,5300]])assert.equal(nav.walkable(x,y),false,'repaired water beside a deck blocks walkers');
});
test('Goldmine orchard, kitchen plots, herb gardens and picnic commons stay reachable',()=>{
 const places=read('scripts/bigger-goldmine/commons.json').places;
 assert.equal(places.length,5);
 for(const c of places){
  assert.ok(nav.walkable(...c.point),c.name);
  assert.ok(nav.route(map.spawn.x,map.spawn.y,...c.point).length,c.name+' connects to heart');
 }
 for(const p of read('scripts/bigger-goldmine/ground-contact-audit.json'))assert.ok(p.dry,p.name+' stands on dry ground');
});

test('Goldmine densification preserves the coastline, rivers, decks, community markers and original heart',async()=>{
 const {createHash}=await import('node:crypto');
 const baseline=read('scripts/bigger-goldmine/dense-before.json').protectedJson;
 const preserved={water:world.water,bridges:world.bridges,walkways:world.walkways,coast:world.coast,zones:world.zones,decks:art.decks,previewHarbor:art.previewHarbor,originalProps:art.props.slice(0,oldArt.props.length),sleepSpots:world.sleepSpots};
 for(const [key,value] of Object.entries(preserved))assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'),baseline[key],key+' stays exactly as the committed review fix');
});
test('Goldmine main road, short spurs and shared well approaches remain clear of water and props',()=>{
 for(const [i,path] of world.paths.slice(-4).entries())for(const [x,y] of path)assert.ok(nav.walkable(x,y),`new road ${i} at ${x},${y}`);
 for(const [x,y] of [[-290,2370],[4030,-280],[9140,2980],[6290,6060]]){
  assert.ok(nav.walkable(x,y),'well approach');
  assert.ok(nav.route(map.spawn.x,map.spawn.y,x,y).length,'well reachable from heart');
 }
});
