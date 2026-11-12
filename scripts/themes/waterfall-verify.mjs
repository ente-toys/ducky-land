import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {Texture} from 'pixi.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {animatePieces} from '../../src/pixi/centre-motion.js';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry} from '../../assets/world/island-geometry.mjs';
import {sleeperFootprint} from '../../src/pixi/sleep-spots.js';
const A='public/pixi-art/themes/waterfall/',D='assets/world/themes/waterfall/';
const read=p=>JSON.parse(readFileSync(p)),art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const report=checkTheme('waterfall');assert.equal(report.ready,true);assert.equal(report.sleepers.length,40);
const files=readdirSync(A,{recursive:true}).filter(s=>s.endsWith('.svg'));
assert(!readdirSync(A,{recursive:true}).some(s=>/\.(png|jpe?g|webp)$/i.test(s)),'working rasters stay outside public');
for(const f of files)assert(!/<image\b|data:image|<foreignObject\b/i.test(readFileSync(A+f,'utf8')),f+' has no embedded raster');
const baseline=read('scripts/themes/waterfall-ten-source.json');
for(const key of ['coast','islets','paths','pathWidths','zones','sleepSpots','centrePlacement'])assert.deepEqual(world[key],baseline.world[key],key+' stays locked');
const centre=read(A+'centre/centre.json');
assert.deepEqual(centre.pieces.filter(p=>!p.id.startsWith('bench-')),baseline.centre.pieces.filter(p=>!p.id.startsWith('bench-')),'locked centre placement stays intact');
const map=makeMap('waterfall',{world,walk,harbor,sleepers:report.sleepers});
const base=geometry(map.baseWalk);
for(const bed of report.sleepers){
 assert(map.landAt(bed.x,bed.y),bed.pose+' sleeper on land');
 if(!bed.tree)assert(base.walkable(bed.x,bed.y),bed.pose+' sleeper on open ground');
 const f=sleeperFootprint(bed);assert.equal(map.nav().walkable(f.x,f.y),false,'sleeper footprint stays solid');
}
for(const a of world.centrePlacement.access){const point=a.point;assert(map.nav().route(...world.zones.plaza.spawn,...point).length,a.name+' centre approach');}
const originalFetch=globalThis.fetch;let acquired=0,released=0,loaded;
try{
 globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 loaded=await loadThemeArt({id:'waterfall',art:'/pixi-art/themes/waterfall/art.json'},{acquire:async src=>{assert(src.endsWith('.svg'),src);acquired++;return Texture.EMPTY},release:()=>released++});
 const animated=loaded.props.filter(p=>p.centrePiece?.animate);assert.equal(animated.length,19);
 const records=animated.map(p=>{p.sprite.visible=true;return{piece:p.centrePiece,sprite:p.sprite}});
 for(const t of [0,.1,.75,4,10000]){animatePieces(records,t);for(const r of records)assert(Number.isFinite(r.sprite.x+r.sprite.y+r.sprite.alpha));}
 assert.equal(loaded.props.filter(p=>/Curved ring bench|Centre bench-/.test(p.name)).length,10);
 loaded.destroy();assert.equal(released,acquired);
 const result={ready:true,sleepers:40,svgFiles:files.length,loadedSVGTextures:acquired,animatedCentrePieces:19,arcBenches:10,centreEntrances:3,protectedLayoutUnchanged:true,sharedSleeperRasterMigrationRequired:false,browserVerified:false};
 writeFileSync(A+'waterfall-verification.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{globalThis.fetch=originalFetch;}
