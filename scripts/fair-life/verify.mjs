import fs from 'node:fs';
import assert from 'node:assert/strict';
import {mapFor,mapOf} from '../../src/pixi/island-maps.js';
import {checkTheme} from '../theme-index.mjs';
import {original,read,A,D,clearance} from './apply.mjs';
const map=mapOf('isle-170'),checked=checkTheme('fair'),world=read(D+'world.json'),art=read(A+'art.json'),walk=read(D+'walk-world.json');
const clear=clearance(world,walk,art),added=map.sleepers.filter(b=>!original.beds.some(s=>s.pose===b.pose&&s.x===b.x&&s.y===b.y));
const report={island:'isle-170',theme:map.id,checkedReady:checked.ready,problems:checked.problems,runtime:mapFor('fair').sleepers.length,serverMap:map.sleepers.length,sourceTarget:world.sleepTotal,retainedForty:original.beds.every(s=>map.sleepers.some(b=>s.x===b.x&&s.y===b.y&&s.pose===b.pose&&s.flip===b.flip&&s.tree===b.tree)),additional:added.length,invalidNewFootprints:added.filter(b=>!clear(b.x,b.y,b.pose,b.tree)),kites:art.kites.length,featureApproaches:[]};
for(const [name,x,y]of [['hill',7500,1340],['picnic',5030,4640]]){
 const nav=map.nav();report.featureApproaches.push({name,x,y,walkable:nav.walkable(x,y),reachable:nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||!!nav.route(map.spawn.x,map.spawn.y,x,y).length});
}
fs.writeFileSync('scripts/fair-life/evidence/runtime-readback.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
assert(checked.ready,checked.problems.join('\n'));assert.equal(report.runtime,90);assert.equal(report.serverMap,90);assert.equal(report.additional,50);assert(report.retainedForty);assert.equal(report.invalidNewFootprints.length,0);assert(report.featureApproaches.every(s=>s.walkable&&s.reachable));
