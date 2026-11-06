// Check Candy Coast directly even before the integrator adds it to FINISHED_THEMES.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {animatePieces} from '../../src/pixi/centre-motion.js';
import {Texture} from 'pixi.js';
const A='public/pixi-art/themes/candy/',D='rive/web/themes/candy/',j=p=>JSON.parse(readFileSync(p));
const art=j(A+'art.json'),world=j(D+'world.json'),walk=j(D+'walk-world.json'),harbor=j(D+'harbor.json'),centre=j(A+'centre/centre.json'),props=j(D+'placements.json');
const r=checkTheme('candy');assert(r.ready,r.problems.join('\n'));assert.equal(r.sleepers.length,40);
const map=makeMap('candy',{world,walk,harbor,sleepers:r.sleepers}),nav=map.nav(),route=(x,y)=>nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||nav.route(map.spawn.x,map.spawn.y,x,y).length>0;
const open=Object.entries(world.zones).filter(([k])=>/^(activity|stalls)-/.test(k));
const inside=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c};
for(const [id,z]of Object.entries(world.zones)){if(!z.spawn)continue;assert(nav.walkable(...z.spawn),'blocked spawn '+id);assert(route(...z.spawn),'unreachable '+id)}
for(const [id,z]of open)for(const p of props)assert(!(z.poly?inside(p.x,p.y,z.poly):((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2<1),'standing prop '+p.id+' occupies '+id);
const paths=world.paths.map((l,i)=>({i,blocked:l.filter(p=>!nav.walkable(...p))}));
// Sleeper collision may block an individual path sample, but no path may run into sea.
const bare=makeMap('candy',{world,walk:{...walk,obstacles:[]},harbor,sleepers:[]}).nav();
const offshore=world.paths.flatMap((l,i)=>l.filter(p=>!bare.walkable(...p)).map(p=>({path:i,p})));assert.equal(offshore.length,0,'path centres off land '+JSON.stringify(offshore.slice(0,10)));
const crowd=[];for(let y=800;y<world.height-400&&crowd.length<100;y+=200)for(let x=650;x<world.width-350&&crowd.length<100;x+=200)if(nav.walkable(x,y)&&route(x,y))crowd.push([x,y]);assert.equal(crowd.length,100);
const benches=props.filter(p=>p.asset==='arc-bench');assert(benches.length>=12);assert(benches.filter(p=>p.zone==='centre').length>=3);
for(const b of benches){assert(b.footprint.poly.length>20);assert(!nav.walkable(b.x,b.y),'bench lacks collision '+b.id)}
for(const b of centre.blocked){assert(!nav.walkable(centre.placement.x+b.ellipse.x,centre.placement.y+b.ellipse.y),'centre collision missing')}
for(const [x,y]of [[0,370],[-550,0],[550,0],[0,-210]])assert(route(centre.placement.x+x,centre.placement.y+y),'fountain floor inaccessible');
const pond=world.water[0];assert(nav.walkable(pond.x,pond.y+5),'pond bridge not walkable');assert(route(pond.x,pond.y+5),'pond bridge not connected');
const trees=props.filter(p=>/^tree-/.test(p.asset));assert(trees.length>=60,'fewer than 60 home canopy trees');
const all=[...art.ground.tiles,...art.decks,...art.flats,...art.props,...(art.floating||[])];
for(const src of new Set(all.map(p=>p.src))){assert(src.endsWith('.svg'),'not SVG '+src);assert(existsSync(A+src),'missing '+src);assert(!/<image\b|data:image\/(png|webp|jpe?g)|<foreignObject/i.test(readFileSync(A+src,'utf8')),'raster embedded in '+src)}
assert(!readdirSync(A,{recursive:true}).some(p=>/\.(png|webp|jpe?g)$/i.test(p)),'raster file under public candy');
const area=Math.abs(world.coast.reduce((s,a,i)=>{const b=world.coast[(i+1)%world.coast.length];return s+a[0]*b[1]-b[0]*a[1]},0)/2);
assert(area/11090000>1.7&&area/11090000<2,'land size out of brief');
// Exercise the real theme loader and generic centre motion, including resource cleanup.
const originalFetch=globalThis.fetch;let acquired=0,released=0,animated=0;
try{
 globalThis.fetch=async url=>({ok:true,json:async()=>j('public'+url)});
 const loaded=await loadThemeArt({...map,art:'/pixi-art/themes/candy/art.json'},{acquire:async src=>{assert(existsSync('public'+src));acquired++;return Texture.EMPTY},release:()=>released++});
 assert.equal(loaded.props.length,art.props.length);
 const records=loaded.props.filter(p=>p.centrePiece?.animate).map(p=>{p.sprite.visible=true;return {piece:p.centrePiece,sprite:p.sprite}});animated=records.length;assert.equal(animated,3);
 const jets=records.find(p=>p.piece.id==='water');animatePieces(records,0);const yScale=jets.sprite.scale.y;animatePieces(records,.7);assert.notEqual(jets.sprite.scale.y,yScale);
 animatePieces(records,.7,true);assert.equal(jets.sprite.scale.y,jets.sprite.centreRest.sy);assert(records.every(p=>p.sprite.alpha===1));
 assert(loaded.props.filter(p=>p.centrePiece).every(p=>!p.wind));loaded.destroy();assert.equal(acquired,released);
}finally{globalThis.fetch=originalFetch}
const out={status:'READY candy',map:[world.width,world.height],coastArea:Math.round(area),homeRatio:area/11090000,props:props.length,trees:trees.length,curvedBenches:benches.length,groundFlats:art.flats.length,sleepers:r.sleepers.length,sleeperCounts:Object.fromEntries(Object.entries(world.sleepSpots).map(([k,v])=>[k,v.length])),activityZones:open.filter(([k])=>k.startsWith('activity')).length,stallRows:open.filter(([k])=>k.startsWith('stalls')).length,centreLayers:centre.pieces.length,animatedLayers:animated,textureAcquireRelease:[acquired,released],pathsOffLand:offshore.length,pathSampleCollision:paths.filter(p=>p.blocked.length).map(p=>({path:p.i,n:p.blocked.length})),zoneRoutes:'all pass',reachableCrowdPositions:crowd.length,rasterFiles:0,notes:'Direct checker uses final candy files. Shared FINISHED_THEMES and generated index are integrator-owned.'};
writeFileSync(A+'candy-validation.json',JSON.stringify(out,null,2));console.log(JSON.stringify(out,null,2));
