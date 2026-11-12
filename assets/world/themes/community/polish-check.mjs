import fs from 'node:fs';import assert from 'node:assert/strict';
import {checkTheme} from '../../../../scripts/theme-index.mjs';
import {makeMap} from '../../../../src/pixi/island-maps.js';
import {inPoly} from '../../island-geometry.mjs';
const A='public/pixi-art/themes/community/',D='assets/world/themes/community/',j=p=>JSON.parse(fs.readFileSync(p));
const a=j(A+'art.json'),w=j(D+'world.json'),walk=j(D+'walk-world.json'),h=j(D+'harbor.json'),old=j(D+'polish-source/world.json'),oldArt=j(D+'polish-source/art.json');
const checked=checkTheme('community');assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,40);
for(const k of ['width','height','coast','islets','arches','pathWidths','paths','sleepSpots'])assert.deepEqual(w[k],old[k],`${k} changed`);
for(const oldProp of oldArt.props)assert(a.props.some(p=>p.id===oldProp.id),`Lost ${oldProp.id}`);
const trees=a.props.filter(p=>/tree/i.test(p.name));assert(trees.length>=60);assert(a.props.length>=300);assert.equal(a.sea,'#6EC9DE');
const problems=[];
for(const p of a.props.filter(p=>p.id.startsWith('polish-'))){
 const onLand=inPoly(p.x,p.y,w.coast)||w.islets.some(([x,y,rx,ry])=>((p.x-x)/(rx+20))**2+((p.y-y)/(ry+20))**2<1);
 if(!onLand)problems.push(`Off land: ${p.id} ${p.x},${p.y}`);
 for(const [id,z]of Object.entries(w.zones).filter(([id])=>/^(activity|stalls)-/.test(id))){
  const inside=z.kind==='stall-row'?Math.abs(p.x-z.x)<z.length/2-25&&Math.abs(p.y-z.y)<z.depth/2-20:((p.x-z.x)/(z.rx-20))**2+((p.y-z.y)/(z.ry-20))**2<1;
  if(inside)problems.push(`Reserved interior: ${p.id} in ${id}`);
 }
}
assert.equal(new Set(a.props.map(p=>p.id)).size,a.props.length,'duplicate prop ids');
assert.equal(a.ground.tiles.reduce((v,t)=>v+t.width*t.height,0),a.width*a.height);
for(const t of a.ground.tiles)assert(fs.readFileSync(A+t.src,'utf8').includes(`viewBox="${t.x} ${t.y} ${t.width} ${t.height}"`));
const map=makeMap('community',{world:w,walk,harbor:h,sleepers:checked.sleepers}),nav=map.nav();
for(const [id,z]of Object.entries(w.zones))assert(nav.walkable(...z.spawn),`Blocked ${id}`);
assert(nav.walkable(1965,1600),'Pond dock unavailable');assert(!nav.walkable(2100,1450),'Pond water walkable');
assert(!nav.walkable(4000,2585),'Campfire footprint missing');assert(!nav.walkable(4000,1170),'Stage footprint missing');
const output={ready:checked.ready,sleepers:checked.sleepers.length,sleepersUnchanged:true,originalLandmarksRetained:true,geometryUnchanged:true,trees:trees.length,props:a.props.length,flats:a.flats.length,groundTiles:a.ground.tiles.length,openAreaProblems:problems,pondDockWalkable:true,pondWaterBlocked:true,fireAndStageSolid:true};
fs.writeFileSync(D+'polish-validation.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));assert.equal(problems.length,0,problems.join('\n'));
