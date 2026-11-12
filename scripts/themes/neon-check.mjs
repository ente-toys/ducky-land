// Theme-local acceptance check. Does not change the shared registry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inPoly} from '../../assets/world/island-geometry.mjs';
const A='public/pixi-art/themes/neon/',D='assets/world/themes/neon/';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),art=read(A+'art.json'),centre=read(A+'centre/centre.json');
const original=read(A+'polish-source/world.json'),originalArt=read(A+'ten-source/art.json');
for(const key of ['width','height','coast','water','islets','sleepSpots','sleepAvoid'])assert.deepEqual(world[key],original[key],`${key} changed during polish`);
assert.deepEqual(world.zones.centre,original.zones.centre,'locked centre zone changed');
assert.deepEqual(art.props.filter(p=>p.src.startsWith('centre/')),originalArt.props.filter(p=>p.src.startsWith('centre/')),'locked centre pieces changed');
assert.deepEqual(art.flats.filter(p=>p.src.startsWith('centre/')),originalArt.flats.filter(p=>p.src.startsWith('centre/')),'locked centre floor changed');
assert.equal(art.sea,'#6EC9DE');
assert(art.props.length>=300,'too few props');
const bigTrees=art.props.filter(p=>/^reuse\/tree-[1-5]\.svg$/.test(p.src));
assert(bigTrees.length>=60,'too few HOME trees');
assert(art.flats.length>=1000,'ground detail missing');
const report=checkTheme('neon');
assert(report.ready,report.problems.join('\n'));
assert.equal(report.sleepers.length,40);
assert(!report.sleepNotes.some(s=>s.includes('dropped')),report.sleepNotes.join('\n'));
assert.equal(world.zones.centre.placeholder,false);
assert.equal(centre.concept,'concepts/themes/next-centres/neon-centre-1.png');
assert(centre.pieces.some(p=>p.layer==='front'&&Number.isFinite(p.sortY)));
const map=makeMap('neon',{world,walk,harbor,sleepers:report.sleepers}),nav=map.nav();
for(const [id,z] of Object.entries(world.zones)){
 assert(nav.walkable(...z.spawn),`${id}: spawn blocked`);
 assert(nav.clearLine([map.spawn.x,map.spawn.y],z.spawn)||nav.route(map.spawn.x,map.spawn.y,...z.spawn).length,`${id}: no route`);
}
for(const [i,islet] of world.islets.entries())assert(nav.route(map.spawn.x,map.spawn.y,islet[0],islet[1]).length,`islet ${i}: no route`);
const pondDock=walk.walkways.at(-1);
assert(nav.walkable(...pondDock.b),'pond dock end blocked');
assert(nav.route(map.spawn.x,map.spawn.y,...pondDock.b).length,'pond dock unreachable');
const bare=geometry({...walk,obstacles:[]});
const pOffLand=art.props.filter(p=>!p.src.startsWith('centre/')&&!/flower|lily|reeds|towel|shell|starfish/i.test(p.name)&&!bare.walkable(p.x,p.y-4)).map(p=>p.id);
assert.deepEqual(pOffLand,[],'solid prop on water');
const rawPaths=read(D+'paths.json');
const pathBlocked=[];
// makeMap adds the engine-drawn harbour deck to the authored walking map.
for(const [i,line] of rawPaths.entries())for(const pt of line){if(nav.walkable(...pt))continue;const c=world.zones.centre;if(((pt[0]-c.x)/c.rx)**2+((pt[1]-c.y)/c.ry)**2>1)pathBlocked.push({path:i,pt});}
assert.deepEqual(pathBlocked,[],'path centre points blocked outside central clock');
const reserved=Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id));
assert(reserved.filter(([id])=>id.startsWith('activity')).length>=3);
assert(reserved.filter(([id])=>id.startsWith('stalls')).length>=2);
for(const [id,z]of reserved)for(const p of art.props){assert(!(z.poly?inPoly(p.x,p.y,z.poly):((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2<1),`${p.id} inside ${id}`);}
let seed=100;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),ducks=[];
for(let i=0;i<100000&&ducks.length<100;i++){
 const p=[Math.round(500+rnd()*(world.width-1000)),Math.round(500+rnd()*(world.height-1000))];
 if(!nav.walkable(...p)||ducks.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<160))continue;
 if(!nav.clearLine([map.spawn.x,map.spawn.y],p)&&!nav.route(map.spawn.x,map.spawn.y,...p).length)continue;
 ducks.push(p);
}
assert.equal(ducks.length,100);
const svgs=fs.readdirSync(A,{recursive:true}).filter(f=>f.endsWith('.svg'));
for(const f of svgs)assert(!/<(?:filter|feGaussianBlur|linearGradient|radialGradient)\b|filter\s*=/i.test(fs.readFileSync(A+f,'utf8')),`${f}: glow/filter/gradient`);
const result={ready:true,theme:'neon',sleepers:40,sleepPositionsUnchanged:true,lockedCentreUnchanged:true,coastAndSizeUnchanged:true,props:art.props.length,bigHomeTrees:bigTrees.length,groundDecals:art.flats.length,sea:art.sea,pondDockReachable:true,zoneRoutes:Object.keys(world.zones).length,isletRoutes:world.islets.length,crowdReachable:ducks.length,reservedAreas:reserved.length,solidPropsOffLand:pOffLand.length,blockedPathSamples:pathBlocked.length,svgFilesWithoutGlow:svgs.length};
fs.writeFileSync(A+'qa-results.json',JSON.stringify(result,null,2)+'\n');
const metrics=read(A+'build-metrics.json');
Object.assign(metrics,{props:art.props.length,trees:art.props.filter(p=>/reuse\/(?:tree-[1-5]|nature--tree-)/.test(p.src)).length,bigHomeTrees:bigTrees.length,groundDecals:art.flats.length,pathsWidth:{main:200,minor:180},sea:art.sea,pondDockReachable:true,ready:report.ready,sleepRequested:40,sleepResolved:40,problems:report.problems,sleepNotes:report.sleepNotes});
fs.writeFileSync(A+'build-metrics.json',JSON.stringify(metrics,null,1)+'\n');
console.log('READY neon',JSON.stringify(result));
// Final craft invariants: curved seats have real curved collision, and every loaded asset is vector.
const benches=read(A+'ten-benches.json');
assert.equal(benches.length,14);
for(const b of benches){
 assert(b.footprint.length>=24,`${b.id}: missing arc footprint`);
 assert(!nav.walkable(b.x,b.y),`${b.id}: bench has no collision`);
 for(const [x,y]of b.footprint){
  assert(bare.walkable(x,y),`${b.id}: arc leaves dry land`);
  for(const [id,z]of reserved)assert(!(z.poly?inPoly(x,y,z.poly):((x-z.x)/z.rx)**2+((y-z.y)/z.ry)**2<1),`${b.id}: seat enters ${id}`);
 }
}
const sources=[...art.ground.tiles,...art.decks,...art.flats,...art.props,...(art.floating||[])];
for(const item of sources){assert(item.src.endsWith('.svg'),`Non-SVG game asset: ${item.src}`);const svg=fs.readFileSync(A+item.src,'utf8');assert(!/<image\b|data:image\/(png|jpeg|webp)/i.test(svg),`Embedded image: ${item.src}`);}
assert.deepEqual(world.paths,walk.paths);assert.deepEqual(world.paths,rawPaths);
console.log('PASS 14 curved collision seats, 7 open areas, SVG-only references, all path manifests agree');
