import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {Texture} from 'pixi.js';
const A='public/pixi-art/themes/lantern/',D='rive/web/themes/lantern/';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),centre=read(A+'centre/centre.json');
const result=checkTheme('lantern');assert(result.ready,result.problems.join('\n'));assert.equal(result.sleepers.length,40);
const map=makeMap('lantern',{world,walk,harbor,sleepers:result.sleepers}),nav=map.nav();
const reachable=(x,y)=>nav.walkable(x,y)&&(nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||nav.route(map.spawn.x,map.spawn.y,x,y).length>0);
for(const [id,z]of Object.entries(world.zones))if(z.spawn)assert(reachable(...z.spawn),'blocked/unreachable zone '+id);
for(const [x,y]of [[4200,2480],[5020,3190],[1980,2820],[4310,4250]])assert(reachable(x,y),'unreachable lake/gate '+x+','+y);
for(const [x,y]of [[4350,3250],[3550,2700],[5400,2600]])assert(!nav.walkable(x,y),'lake must block walking');
for(const b of centre.blocked)assert(!nav.walkable(centre.placement.x+b.ellipse.x,centre.placement.y+b.ellipse.y),'missing gate post collision');
for(const b of world.arches){for(const t of [.1,.3,.5,.7,.9])assert(nav.walkable(b.a[0]+(b.b[0]-b.a[0])*t,b.a[1]+(b.b[1]-b.a[1])*t),'bridge gap '+JSON.stringify(b));}
const crowd=[];for(let y=800;y<5300&&crowd.length<100;y+=180)for(let x=800;x<7200&&crowd.length<100;x+=180)if(reachable(x,y))crowd.push([x,y]);assert.equal(crowd.length,100);
for(const [id,z]of Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id))){assert(!art.props.some(p=>((p.x-z.x)/(z.rx*.72))**2+((p.y-z.y)/(z.ry*.72))**2<1),'prop inside open core '+id);}
const rasters=fs.readdirSync(A,{recursive:true}).filter(f=>/\.(png|jpe?g|webp)$/i.test(f));assert.equal(rasters.length,0);
for(const p of [...art.ground.tiles,...art.flats,...art.decks,...art.props,...art.floating]){assert(p.src.endsWith('.svg'));const file=A+p.src;assert(fs.existsSync(file),file);assert(!/<image\b|data:image|foreignObject/i.test(fs.readFileSync(file,'utf8')),'embedded image '+file);}
for(const bed of result.sleepers)if(bed.pose!=='nod')assert(Math.min(...art.props.filter(p=>/Tree|Bush|bench|stall|Flowers|table|umbrella/.test(p.name)).map(p=>Math.hypot(p.x-bed.x,p.y-bed.y)))<410,'sleeper missing companion');
for(const id of ['centre','release','activity-1','activity-2','activity-3','stalls-1','stalls-2'])assert(art.props.some(p=>p.name==='Curved wooden bench'&&p.zone===id),'missing curved bench '+id);
const fetchOriginal=globalThis.fetch;let acquired=0,released=0;
try{globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 const loaded=await loadThemeArt({...map,art:'/pixi-art/themes/lantern/art.json'},{acquire:async src=>{assert(fs.existsSync('public'+src),'loader missing '+src);acquired++;return Texture.EMPTY;},release:()=>released++});
 assert.equal(loaded.props.length,art.props.length);assert.equal(loaded.floating.length,45);assert.equal(loaded.props.filter(p=>p.centrePiece).length,6);assert(loaded.props.filter(p=>p.centrePiece).every(p=>!p.wind));loaded.destroy();assert.equal(acquired,released);
}finally{globalThis.fetch=fetchOriginal;}
const report={status:'READY lantern',sleepers:40,reachableCrowdPositions:crowd.length,zoneRoutes:'all pass',bridgeSamples:'all pass',lakeBlocks:'pass',centrePostCollision:'pass',openCores:'all clear',svgOnly:true,textureAcquireRelease:[acquired,released],metrics:read(A+'lantern-metrics.json')};
fs.writeFileSync(A+'lantern-validation.json',JSON.stringify(report,null,2)+'\n');console.log(report);
