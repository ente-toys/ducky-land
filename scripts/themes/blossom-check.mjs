import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/blossom/',D='assets/world/themes/blossom/',J=f=>JSON.parse(readFileSync(f));
const r=checkTheme('blossom');const world=J(D+'world.json'),walk=J(D+'walk-world.json'),harbor=J(D+'harbor.json'),art=J(A+'art.json');
const map=makeMap('blossom',{world,walk,harbor,sleepers:r.sleepers||[]}),nav=map.nav();
const problems=[...r.problems];
for(const [id,z]of Object.entries(world.zones)){
 if(!nav.walkable(...z.spawn))problems.push(id+' spawn blocked');
 else if(!nav.route(map.spawn.x,map.spawn.y,...z.spawn).length&&!nav.clearLine([map.spawn.x,map.spawn.y],z.spawn))problems.push(id+' unreachable');
}
const entries=[...art.ground.tiles,...art.props,...art.flats,...art.decks,...art.floating];
for(const p of entries)if(!p.src.endsWith('.svg')||/data:image\/(png|jpeg|webp)/.test(readFileSync(A+p.src,'utf8')))problems.push('Non SVG art '+p.src);
const report={ready:r.ready&&problems.length===0,sleepers:r.sleepers?.length,problems,zoneCount:Object.keys(world.zones).length,props:art.props.length,flats:art.flats.length};writeFileSync(A+'blossom-validation.json',JSON.stringify(report,null,2));console.log(report);if(problems.length)process.exitCode=1;
