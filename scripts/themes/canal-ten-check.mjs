// Canal-only integration verification. Registers the map in this process, never
// rewrites the shared generated theme index while other owners are editing it.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {Texture} from 'pixi.js';
import {checkTheme} from '../theme-index.mjs';
import {registerMap,mapFor} from '../../src/pixi/island-maps.js';
import {canSail} from '../../src/pixi/islands.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
const A='public/pixi-art/themes/canal/',D='assets/world/themes/canal/',read=p=>JSON.parse(readFileSync(p,'utf8'));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const check=checkTheme('canal');assert.ok(check.ready,check.problems.join('\n'));assert.equal(check.sleepers.length,40);
assert.equal(new Set(art.props.map(p=>p.id)).size,art.props.length);
const refs=[...art.ground.tiles,...art.props,...art.flats,...art.decks,...art.floating].map(p=>p.src);
for(const src of refs){assert.ok(src.endsWith('.svg'),src);assert.ok(existsSync(A+src),src);}
const files=readdirSync(A,{recursive:true});let svgCount=0;
for(const file of files){
 assert.ok(!/\.(png|jpe?g|webp)$/i.test(file),file+' raster under public');
 if(!file.endsWith('.svg'))continue;svgCount++;
 assert.ok(!/<image\b|data:image\/(png|jpe?g|webp)|<(linear|radial)Gradient/.test(readFileSync(A+file,'utf8')),file+' raster/gradient');
}
assert.ok(registerMap('canal',{world,walk,harbor,sleepers:check.sleepers,art:'/pixi-art/themes/canal/art.json',sea:art.sea}));
const map=mapFor('canal'),entries=world.arches.filter(a=>a.r!==64).flatMap(a=>[a.a,a.b]);assert.equal(entries.length,8);
for(const p of entries){assert.ok(map.nav().walkable(...p),'centre entrance');assert.ok(map.nav().route(map.spawn.x,map.spawn.y,...p).length,'centre route');}
const bridges=world.walkways.filter(w=>w.boatPassUnder);assert.equal(bridges.length,3);
for(const w of bridges){const p=[(w.a[0]+w.b[0])/2,(w.a[1]+w.b[1])/2];assert.ok(map.nav().walkable(...p));assert.ok(canSail(...p,'isle-56'));}
let acquired=0,released=0;const fetchBefore=globalThis.fetch;
globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
try{
 const loaded=await loadThemeArt(map,{acquire:async()=>{acquired++;return Texture.EMPTY;},release:()=>released++});
 assert.equal(loaded.props.filter(p=>p.centrePiece?.animate).length,1,'locked fountain jet animation');
 assert.ok(loaded.props.every(p=>!p.centrePiece||!p.wind));loaded.destroy();assert.equal(released,acquired);
}finally{globalThis.fetch=fetchBefore;}
const output={ready:true,sleepers:40,props:art.props.length,trees:art.props.filter(p=>p.name==='Canal tree').length,curvedBenches:art.props.filter(p=>/Curved/.test(p.name??'')).length,ringPlanters:art.props.filter(p=>/planter/i.test(p.name??'')).length,centreEntrances:8,boatPassUnderBridges:bridges.length,svgFiles:svgCount,assetReferences:refs.length,uniqueAssets:new Set(refs).size,missingAssets:0,rasterAssets:0,embeddedRaster:0,textureReferencesAcquired:acquired,textureReferencesReleased:released,lockedFountainAnimationLayers:1,scope:'Map, manifest and navigation checks. Static SVG evidence inspected separately; browser render blocked by macOS sandbox.'};
writeFileSync(A+'ten-validation.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
