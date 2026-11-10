// Run in the merged tree. This invokes the paths worker's ONE canonical Home
// union implementation, adding the two feature approaches to its normal input.
// No decal, overlay, local path SVG or additional painter is introduced.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {layout,read,A,D} from './apply.mjs';
import {mapFor} from '../../src/pixi/island-maps.js';
import {sleeperFootprint} from '../../src/pixi/sleep-spots.js';

assert(fs.existsSync('scripts/bigger-fair/paths.mjs')&&fs.existsSync('scripts/bigger-fair/paths.py'),'Merge fp-paths first. The life branch deliberately has no terrain painter.');
const {fairRoutes}=await import('../bigger-fair/paths.mjs');
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
walk.obstacles.push(...mapFor('fair').sleepers.map(sleeperFootprint));
const routes=fairRoutes(art,world);
// fairRoutes includes the two feature approaches for every regeneration.
const result=JSON.parse(execFileSync('python3',['scripts/bigger-fair/paths.py'],{input:JSON.stringify({art,world,walk,layout:read('scripts/bigger-fair/centre-source/layout.json'),routes}),maxBuffer:32*1024*1024,encoding:'utf8'}));
world.paths=result.routes.map(r=>r.samples);
world.fairLife.routes=layout.routes.map(r=>({...r,samples:result.routes.find(q=>q.id===r.id).samples}));
fs.writeFileSync(D+'world.json',JSON.stringify(world,null,1)+'\n');
fs.writeFileSync(D+'paths.json',JSON.stringify(world.paths,null,1)+'\n');
fs.writeFileSync('scripts/bigger-fair/path-routes.json',JSON.stringify(result)+'\n');
console.log('Hill and picnic approaches joined through the canonical Fair path union. Run verify.mjs and the merged clearance tests.');
