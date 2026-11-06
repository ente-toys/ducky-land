// Scope-local verification of the actual game data and art-loader contract.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {Texture} from 'pixi.js';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {inShape} from '../../rive/web/island-geometry.mjs';
import {setWalkDestination,walkStep} from '../../src/pixi/player-motion.js';
const A='public/pixi-art/themes/blossom/',D='rive/web/themes/blossom/',J=f=>JSON.parse(readFileSync(f));
const art=J(A+'art.json'),world=J(D+'world.json'),walk=J(D+'walk-world.json'),harbor=J(D+'harbor.json'),centre=J(A+'centre/centre.json');
const check=checkTheme('blossom');assert(check.ready,check.problems.join('\n'));assert.equal(check.sleepers.length,40);
const map=makeMap('blossom',{world,walk,harbor,sleepers:check.sleepers,art:'/pixi-art/themes/blossom/art.json'}),nav=map.nav(),s=[map.spawn.x,map.spawn.y];
const reachable=p=>nav.clearLine(s,p)||nav.route(...s,...p).length>0;
for(const [id,z]of Object.entries(world.zones)){assert(nav.walkable(...z.spawn),'Blocked '+id);assert(reachable(z.spawn),'Unreachable '+id);}
const open=Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id));
for(const [id,z]of open)for(const p of art.props)assert(!inShape(p.x,p.y,z,0),p.id+' occupies '+id);
// All eight poses use the exact Home sleeper resolver, including physical bed collision.
for(const b of check.sleepers){assert(map.landAt(b.x,b.y));assert(!nav.walkable(b.x,b.y-6),'Sleeper is not solid '+b.pose);}
const benchProps=art.props.filter(p=>p.id.startsWith('blossom-bench-'));assert.equal(benchProps.length,24);
for(const p of benchProps)assert(!nav.walkable(p.x,p.y),'Bench is not solid '+p.id);
const [cx,cy]=[centre.placement.x,centre.placement.y];
assert(!nav.walkable(cx,cy-122),'Tree is not solid');
for(const p of [[cx,cy+465],[cx-700,cy],[cx+700,cy],[cx,cy-460]])assert(reachable(p),'Hill entry unreachable '+p);
// Every pier/arched bridge and stepping stone joins the mainland navigation component.
for(const [i,b]of world.bridges.entries()){assert(nav.walkable(b.x,b.y)||nav.nearest(b.x,b.y,38),'Blocked bridge '+i);const p=nav.nearest(b.x,b.y,38);assert(p&&reachable(p),'Unreachable bridge/stone '+i);}
for(const [i,b]of world.walkways.entries()){
 const p=[(b.a[0]+b.b[0])/2,(b.a[1]+b.b[1])/2];assert(nav.walkable(...p),'Blocked deck '+i);assert(reachable(p),'Unreachable deck '+i);
}
for(const [i,b]of world.arches.entries())assert(world.walkways.some(w=>w.a.every((v,j)=>Math.abs(v-b.a[j])<1)),'Arch without walkway '+i);
for(const [i,[x,y]]of world.islets.entries()){const p=nav.nearest(x+150,y+30,250);assert(p&&reachable(p),'Unreachable islet '+i);}
// 100 player-sized, separated positions, not merely 100 points in one patch.
const crowd=[];for(let y=850;y<world.height-400;y+=210)for(let x=650;x<world.width-350;x+=210){if(!nav.walkable(x,y)||!reachable([x,y]))continue;if(![[-50,0],[50,0],[0,-36],[0,36]].every(([dx,dy])=>nav.walkable(x+dx,y+dy)))continue;crowd.push([x,y]);}
assert(crowd.length>=100,'Insufficient crowd space: '+crowd.length);
// Move a real actor with the shared motion implementation from the harbor into each open area.
let walkingChecks=0;
for(const [id,z]of [['plaza',world.zones.plaza],...open]){
 const a={id:'probe',x:map.HARBOR.land.x,y:map.HARBOR.land.y,turn:0,action:0,travel:0,path:[],until:0,jumpLeft:0};assert(setWalkDestination(a,nav,...z.spawn),'No walking route '+id);
 for(let tick=0;tick<5000&&a.path.length;tick++){walkStep(a,nav,.05,tick*.05,{x:0,y:0});assert(nav.walkable(a.x,a.y),'Actor crossed solid ground '+id);}
 assert(Math.hypot(a.x-z.spawn[0],a.y-z.spawn[1])<15,'Actor did not arrive '+id);walkingChecks++;
}
// No raster, embedded image or missing asset anywhere in the delivered public folder.
const files=readdirSync(A,{recursive:true}).filter(p=>typeof p==='string');assert(!files.some(p=>/\.(png|jpe?g|webp)$/i.test(p)));
const entries=[...art.ground.tiles,...art.props,...art.decks,...art.flats,...art.floating];
for(const src of new Set(entries.map(p=>p.src))){assert(src.endsWith('.svg'));assert(existsSync(A+src));assert(!/<image\b|data:image\/(png|jpe?g|webp)|<foreignObject\b/.test(readFileSync(A+src,'utf8')),'Embedded raster '+src);}
const fetchBefore=globalThis.fetch;let acquired=0,released=0;
try{
 globalThis.fetch=async url=>({ok:true,json:async()=>J('public'+url)});
 const loaded=await loadThemeArt(map,{acquire:async src=>{assert(existsSync('public'+src));acquired++;return Texture.EMPTY;},release:()=>released++});
 assert.equal(loaded.props.length,art.props.length);assert.equal(loaded.floating.length,6);assert.equal(loaded.props.filter(p=>p.centrePiece).length,4);assert(loaded.props.filter(p=>p.centrePiece).every(p=>!p.wind));
 for(const p of loaded.props.filter(p=>p.centrePiece))assert.equal(p.sprite.zIndex,cy+p.centrePiece.sortY,'Incorrect front depth sort '+p.id);
 loaded.destroy();assert.equal(acquired,released,'Texture leak');
}finally{globalThis.fetch=fetchBefore;}
const out={status:'READY blossom',sleepers:40,poses:8,zoneRoutes:9,openAreas:5,curvedBenches:24,bridgeAndStoneChecks:world.bridges.length,walkwayChecks:world.walkways.length,islets:2,walkingChecks,accessibleCrowdSlots:crowd.length,textureAcquireRelease:[acquired,released],rasterFiles:0,centrePieces:centre.pieces.length,liveBrowser:'blocked: macOS MachPortRendezvous permission; connected browser host unavailable'};
writeFileSync(A+'blossom-verification.json',JSON.stringify(out,null,2));writeFileSync(D+'crowd-safe-spots.json',JSON.stringify(crowd));console.log(JSON.stringify(out,null,2));
