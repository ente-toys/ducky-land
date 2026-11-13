import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeMap,mapFor} from '../src/world/island-maps.js';
import {geometry,inPoly,inShape} from '../assets/world/island-geometry.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
const read=p=>JSON.parse(readFileSync(p));
const world=read('assets/world/themes/bog/world.json'),walk=read('assets/world/themes/bog/walk-world.json'),harbor=read('assets/world/themes/bog/harbor.json'),art=read('public/pixi-art/themes/bog/art.json');
const original=read('scripts/bigger-bog/original-world.json'),oldWalk=read('scripts/bigger-bog/original-walk.json'),oldArt=read('scripts/bigger-bog/original-art.json');
const map=makeMap('bog',{world,walk,harbor}),nav=map.nav();
const routeTo=p=>{assert.ok(nav.walkable(...p),`destination ${p} is ground`);const r=nav.route(map.spawn.x,map.spawn.y,...p);assert.ok(r.length,`route to ${p}`);assert.ok(Math.hypot(r.at(-1)[0]-p[0],r.at(-1)[1]-p[1])<2,`route reaches ${p}`);};
test('Bog retains every original prop, sleeper, path and zone in place',()=>{
 for(const p of oldArt.props)assert.deepEqual(art.props.find(q=>q.id===p.id),p);
 for(const p of oldArt.decks)assert.deepEqual(art.decks.find(q=>q.id===p.id),p);
 assert.deepEqual(world.sleepSpots,original.sleepSpots);assert.deepEqual(world.paths.slice(0,original.paths.length),original.paths);
 for(const [id,z]of Object.entries(original.zones))assert.deepEqual(world.zones[id],z);
 const old=geometry(oldWalk),now=geometry(walk);for(let y=650;y<5200;y+=64)for(let x=650;x<7400;x+=64)if(inPoly(x,y,oldWalk.coast))assert.equal(now.walkable(x,y),old.walkable(x,y),`original walking ground changed ${x},${y}`);
});
test('legacy Bog assets keep all 40 original sleepers while the delivered map is the new combat island',()=>{
 const r=checkTheme('bog');assert.equal(r.ready,true,r.problems.join('\n'));assert.equal(r.sleepers.length,40);assert.equal(mapFor('bog').width,8400);
 for(const b of r.sleepers)assert.ok(inPoly(b.x,b.y,world.coast));
});
test('Each Bog neighbourhood has six homes, a workplace, and a reachable shared green',()=>{
 assert.equal(world.communities.length,4);for(const c of world.communities){assert.equal(c.homes.length,6);routeTo(c.point);for(const id of c.homes){const p=art.props.find(p=>p.id===id);routeTo([p.x,p.y+100]);}const p=art.props.find(p=>p.id===c.workplace);assert.ok(p);routeTo([p.x,p.y+120]);}
});
test('Bog streams block walking and all four bridge decks cross real water',()=>{
 assert.equal(world.water.filter(w=>w.poly).length,2);assert.equal(world.bridges.length,4);
 for(const b of world.bridges){assert.ok(world.water.some(w=>inShape(b.x,b.y,w)),`${b.id} must cross real water`);routeTo([b.x,b.y]);assert.ok(nav.clearLine([b.x-b.w/2+25,b.y],[b.x+b.w/2-25,b.y]),`${b.id} crossing clear`);}
 for(const w of world.water.filter(w=>w.poly)){let blocked=0;for(const [x,y]of w.poly){const p=[x*.99+w.poly[0][0]*.01,y];if(!world.bridges.some(b=>Math.abs(p[0]-b.x)<b.w/2&&Math.abs(p[1]-b.y)<b.h/2)&&!nav.walkable(...p))blocked++;}assert.ok(blocked>10,'river remains water away from bridges');}
});
test('Bog sea pier, docking point and all moorings stay usable',()=>{
 routeTo([map.JETTY.foot.x,map.JETTY.foot.y]);routeTo([map.HARBOR.land.x,map.HARBOR.land.y]);assert.equal(map.landAt(map.HARBOR.water.x,map.HARBOR.water.y),false);
 for(const b of map.boatSpots()){assert.equal(map.landAt(b.x,b.y),false,`boat ${b.x},${b.y} afloat`);assert.ok(map.shoreFor(b.x,b.y,320),`boat ${b.x},${b.y} boardable`);}
});
test('Bog ground textures stay below 1536 and solid buildings have matching contacts',()=>{
 for(const t of art.ground.tiles){assert.ok((t.nativePixels??[t.width*(t.resolution??1),t.height*(t.resolution??1)]).every(n=>n<=1536));const src='public/pixi-art/themes/bog/'+t.src;assert.ok(readFileSync(src).length);}
 for(const p of art.props.filter(p=>p.community&&p.neighbourhood&&(/ home |workplace/.test(p.name)))){const o=walk.obstacles.find(o=>o.prop===p.id);assert.ok(o);assert.ok(Math.abs(o.x-p.x)<2);assert.ok(Math.abs(o.y-p.y)<60);assert.equal(nav.walkable(o.x,o.y),false);}
});
test('Bog review: every common is outside the original heart and reachable, with matching solid furniture',()=>{
 assert.equal(world.commons.length,9);
 for(const c of world.commons){
  assert.ok(!inPoly(...c.point,original.coast),`${c.id} belongs to new land`);routeTo(c.point);
  assert.ok(c.props.length>=2,`${c.id} contains a composed group`);
  for(const id of c.props){const p=art.props.find(p=>p.id===id);assert.ok(p);assert.ok(inPoly(p.x,p.y,world.coast));assert.ok(!inPoly(p.x,p.y,original.coast));
   if(/picnic-table|dye-rack|net-rack/.test(p.src)){const o=walk.obstacles.find(o=>o.prop===id);assert.ok(o);assert.equal(nav.walkable(o.x,o.y),false);}
  }
 }
});
test('Bog review: all crossing decks have wet spans and both banks stay reachable',()=>{
 const crossingDecks=art.decks.filter(p=>/crossing|pier|jetty|boardwalk|bridge/.test([p.id,p.src,p.name].join(' ')));
 assert.equal(crossingDecks.length,5);
 for(const b of world.bridges){
  for(const dy of [-60,0,60]){let wet=0;for(let dx=-b.w*.4;dx<=b.w*.4;dx+=20)if(world.water.some(w=>inShape(b.x+dx,b.y+dy,w)))wet++;assert.ok(wet>=5,`${b.id} has a real wet span at ${dy}`);}
  for(const x of [b.x-b.w/2+25,b.x+b.w/2-25]){assert.ok(inPoly(x,b.y,world.coast));assert.equal(world.water.some(w=>inShape(x,b.y,w)),false,`${b.id} ends on a dry bank`);routeTo([x,b.y]);}
 }
 const p=crossingDecks.find(p=>p.id==='reedwhistle-sea-pier');assert.ok(inPoly(p.x,p.y+p.height/2,world.coast));assert.equal(inPoly(p.x+p.width*.6,p.y+p.height/2,world.coast),false);assert.equal(inPoly(p.x+p.width-20,p.y+p.height/2,world.coast),false);
 for(const c of world.communities){const homes=c.homes.map(id=>art.props.find(p=>p.id===id));assert.equal(new Set(homes.map(p=>p.width+':'+p.height)).size,6);}
});
test('Bog density pass preserves its reviewed rivers, crossings, coast, harbour and communities',()=>{
 const before=read('scripts/bigger-bog/evidence/dense/before-world.json');
 const previousArt=read('scripts/bigger-bog/evidence/dense/before-art.json');
 for(const key of ['coast','water','bridges','commons','communities','zones','sleepSpots','origin','width','height'])assert.deepEqual(world[key],before[key],key);
 assert.deepEqual(art.decks,previousArt.decks);
 for(const c of world.communities){
  const mean=a=>c.homes.reduce((sum,id)=>{const p=a.props.find(p=>p.id===id);return sum+Math.hypot(p.x-c.point[0],p.y-c.point[1]);},0)/c.homes.length;
  assert.ok(mean(art)<mean(previousArt)*.95,`${c.id} homes are closer to their green`);
  const well=art.props.find(p=>p.id===c.id+'-shared-well');assert.ok(well);routeTo([well.x,well.y+90]);
  const homes=c.homes.map(id=>art.props.find(p=>p.id===id));assert.ok(Math.max(...homes.map(p=>p.width))/Math.min(...homes.map(p=>p.width))>1.4);
 }
});
test('Bog density gardens stay on new land and their solid plants match the map',()=>{
 for(const p of art.props.filter(p=>p.dense)){
  assert.ok(inPoly(p.x,p.y,world.coast),`${p.id} is on land`);
  assert.equal(inPoly(p.x,p.y,original.coast),false,`${p.id} leaves the heart alone`);
  for(const o of walk.obstacles.filter(o=>o.prop===p.id))assert.equal(nav.walkable(o.x,o.y),false,`${p.id} has a solid contact`);
 }
 for(const c of world.communities)for(const id of c.homes){const i=art.props.findIndex(p=>p.id===id),garden=art.props[i+1];routeTo([garden.x,garden.y+35]);}
});
