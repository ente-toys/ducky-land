import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),A='public/pixi-art/themes/pink/',D='assets/world/themes/pink/';
const {world:before,art:old}=read('scripts/themes/pink-polish-base.json'),w=read(D+'world.json'),a=read(A+'art.json'),walk=read(D+'walk-world.json');
assert.deepEqual(w.coast,before.coast);assert.deepEqual(w.zones,before.zones);assert.deepEqual(w.sleepSpots,before.sleepSpots);assert.deepEqual(w.centrePlacement,before.centrePlacement);assert.deepEqual(w.arches,before.arches);assert.deepEqual(w.paths,before.paths);assert.deepEqual(w.pathWidths,before.pathWidths);
assert.deepEqual(a.props.filter(p=>p.id.startsWith('centre-')),old.props.filter(p=>p.id.startsWith('centre-')));
assert.deepEqual(w.obstacles,walk.obstacles);
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(dir+d.name+'/'):[dir+d.name]);
const raster=files(A).filter(f=>/\.(png|jpe?g|webp|gif)$/i.test(f));assert.deepEqual(raster,[]);
const entries=[...a.ground.tiles,...a.flats,...a.decks,...a.props,...(a.floating??[])];
for(const e of entries){assert.match(e.src,/\.svg$/);const file=e.src.startsWith('/')?'public'+e.src:A+e.src;assert.ok(existsSync(file),file);assert.doesNotMatch(readFileSync(file,'utf8'),/<image\b|data:image|base64/i,file);}
const ready=checkTheme('pink');assert.equal(ready.ready,true,ready.problems.join('\n'));assert.equal(ready.sleepers.length,40);
const stats=read(D+'pink-craft-validation.json');assert.equal(stats.benches,12);
const report={ready:ready.ready,sleepers:40,unchangedSleepSpots:true,unchangedLockedCentre:true,unchangedCoastPathsZonesArches:true,rasterFiles:0,svgReferences:entries.length,matchingWorldWalkObstacles:walk.obstacles.length,props:a.props.length,trees:stats.trees,benches:stats.benches,flowerbeds:stats.flowerbeds};
writeFileSync(D+'pink-audit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
