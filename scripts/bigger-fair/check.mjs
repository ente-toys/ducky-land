import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {read,write} from './design.mjs';
const D='rive/web/themes/fair/',S='scripts/bigger-fair/',a=read('public/pixi-art/themes/fair/art.json'),w=read(D+'world.json'),walk=read(D+'walk-world.json'),h=read(D+'harbor.json'),e=read(S+'expansion.json');
const check=checkTheme('fair');assert(check.ready,check.problems.join('\n'));
const map=makeMap('fair',{world:w,walk,harbor:h,sleepers:check.sleepers}),n=map.nav();
const failures=[];
for(const p of e.places){if(!n.walkable(...p.point))failures.push('Blocked '+p.id);else{const r=n.route(map.spawn.x,map.spawn.y,...p.point);if(!r.length&&!n.clearLine([map.spawn.x,map.spawn.y],p.point))failures.push('Unreachable '+p.id);}}
const old=read(S+'original-art.json');for(const key of ['props','flats','decks'])assert.deepEqual(a[key].slice(0,old[key].length),old[key],key+' changed');
const ow=read(S+'original-world.json');assert.deepEqual(w.sleepSpots,ow.sleepSpots);assert.deepEqual(w.sleepAvoid,ow.sleepAvoid);for(const [id,z] of Object.entries(ow.zones))assert.deepEqual(w.zones[id],z);
assert.deepEqual(walk.obstacles.slice(0,read(S+'original-walk-world.json').obstacles.length),read(S+'original-walk-world.json').obstacles);
for(const t of a.ground.tiles)assert(t.width<=1536&&t.height<=1536);
for(const p of e.newProps)for(const f of p.footprints)assert(!n.walkable(f.x,f.y),'missing solid '+p.id);
for(let i=0;i<e.paths[0].line.length;i+=3){const p=e.paths[0].line[i];if(!n.walkable(...p))failures.push('Coast promenade blocked '+p.join(','));else if(!n.route(map.spawn.x,map.spawn.y,...p).length&&!n.clearLine([map.spawn.x,map.spawn.y],p))failures.push('Coast promenade unreachable '+p.join(','));}
const area=c=>Math.abs(c.reduce((s,p,i)=>{const q=c[(i+1)%c.length];return s+p[0]*q[1]-p[1]*q[0]},0)/2);
const result={ready:check.ready,sleepers:check.sleepers.length,originalProps:old.props.length,originalFlats:old.flats.length,newProps:e.newProps.length,coastAreaBefore:area(ow.coast),coastAreaAfter:area(w.coast),areaRatio:area(w.coast)/area(ow.coast),tiles:a.ground.tiles.length,groundMiBBefore:e.groundBeforeBytes/1048576,groundMiBAfter:e.groundAfterBytes/1048576,failures};write(S+'validation.json',result);console.log(JSON.stringify(result,null,2));assert.equal(failures.length,0,failures.join('\n'));
