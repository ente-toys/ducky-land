// Targeted data, navigation and delivered-art checks. Writes only the snow validation report.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {geometry,inPoly} from '../../rive/web/island-geometry.mjs';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
import {Texture} from 'pixi.js';
const A='public/pixi-art/themes/snow/',D='rive/web/themes/snow/',j=p=>JSON.parse(readFileSync(p));
const world=j(D+'world.json'),walk=j(D+'walk-world.json'),harbor=j(D+'harbor.json'),art=j(A+'art.json'),centre=j(A+'centre/centre.json');
const r=checkTheme('snow');assert(r.ready,r.problems.join('\n'));assert.equal(r.sleepers.length,40);
const map=makeMap('snow',{world,walk,harbor,sleepers:r.sleepers}),nav=map.nav(),sp=map.spawn;
const route=(x,y)=>nav.clearLine([sp.x,sp.y],[x,y])||nav.route(sp.x,sp.y,x,y).length>0;
const zones={};for(const [id,z]of Object.entries(world.zones)){
 assert(nav.walkable(...z.spawn),'blocked zone '+id);assert(route(...z.spawn),'unreachable zone '+id);zones[id]='reachable';
}
const bare=geometry({...walk,obstacles:[]});
for(const p of art.props)if(!/bridge|snow-ducky/.test(p.name))assert(bare.walkable(p.x,p.y-4),'prop offshore '+p.id);
const pathGeo=geometry(makeMap('snow',{world,walk,harbor,sleepers:[]}).walk);
for(const [i,l]of world.paths.entries())for(const p of l)assert(pathGeo.walkable(...p),'blocked path '+i+' '+p);
for(const b of r.sleepers.filter(b=>b.pose==='nod'))assert(!art.props.some(q=>q.id!==b.tree&&q.y>b.y-10&&q.y-b.y<q.height*q.scale*.9&&Math.abs(q.x-b.x)<q.width*q.scale*.5+25),'hidden tree sleeper '+b.tree);
const open=Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id));
for(const [id,z]of open)for(const p of art.props)assert(((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2>=1,'prop '+p.id+' on open '+id);
const crowd=[];for(let y=800;y<world.height-400&&crowd.length<100;y+=200)for(let x=650;x<world.width-350&&crowd.length<100;x+=200)if(nav.walkable(x,y)&&route(x,y))crowd.push([x,y]);assert.equal(crowd.length,100);
const entries=[...art.ground.tiles,...art.flats,...art.props,...art.decks];let bytes=0;
for(const src of new Set(entries.map(p=>p.src))){assert(src.endsWith('.svg'),'non SVG '+src);assert(existsSync(A+src),'missing '+src);const s=readFileSync(A+src,'utf8');bytes+=s.length;assert(!/<image\b|data:image|<foreignObject\b|<linearGradient\b|<radialGradient\b/.test(s),'raster/gradient '+src)}
const rasters=readdirSync(A,{recursive:true}).filter(f=>/\.(png|jpg|jpeg|webp)$/i.test(f));assert.equal(rasters.length,0);
assert.equal(centre.pieces.length,2);assert(!nav.walkable(centre.placement.x,centre.placement.y),'statue must block');
const benches=j(D+'placements.json').filter(p=>p.asset==='arc-bench');assert(benches.length>=12,'missing curved benches');for(const b of benches)assert(b.footprint.poly.length>=30);
const trees=art.props.filter(p=>p.name.startsWith('pine'));assert(trees.length>=60,'pines below 60');assert(art.props.length>=300,'props below 300');
for(const b of r.sleepers)assert(b.pose==='nod'||Math.min(...art.props.map(p=>Math.hypot(p.x-b.x,p.y-b.y)))<380,'sleeper without fitting companion');
const oldFetch=globalThis.fetch;let acquired=0,released=0;
try{
 globalThis.fetch=async url=>({ok:true,json:async()=>j('public'+url)});
 const loaded=await loadThemeArt({...map,art:'/pixi-art/themes/snow/art.json'},{acquire:async src=>{assert(existsSync('public'+src),'loader missing '+src);acquired++;return Texture.EMPTY},release:()=>released++});
 assert.equal(loaded.props.length,art.props.length);assert(loaded.props.find(p=>p.id==='snow-centre-snow-ducky').centrePiece);
 assert(!loaded.props.find(p=>p.id==='snow-centre-snow-ducky').wind);loaded.destroy();assert.equal(acquired,released);
}finally{globalThis.fetch=oldFetch}
const result={status:'READY snow',sleepers:40,poses:Object.fromEntries(Object.entries(world.sleepSpots).map(([k,v])=>[k,v.length])),...j(A+'snow-metrics.json'),zones,reachableCrowdPositions:crowd.length,artBytes:bytes,artSVGOnly:true,rasters:0,gradients:0,sharedFilesChanged:false};
result.textureAcquireRelease={acquired,released};
writeFileSync(A+'snow-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
