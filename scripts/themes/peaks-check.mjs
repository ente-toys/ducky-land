import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,existsSync,statSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {inPoly} from '../../assets/world/island-geometry.mjs';
import {Container,Texture} from 'pixi.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
const A='public/pixi-art/themes/peaks/',D='assets/world/themes/peaks/',read=p=>JSON.parse(readFileSync(p));
const world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),art=read(A+'art.json'),centre=read(A+'centre/centre.json'),benches=read(A+'arc-benches.json');
const ready=checkTheme('peaks');assert(ready.ready,ready.problems.join('\n'));assert.equal(ready.sleepers.length,40);
assert.deepEqual(Object.fromEntries(Object.entries(world.sleepSpots).map(([p,s])=>[p,s.length])),{nod:5,leaf:5,wing:5,hammock:5,rock:5,book:5,chair:5,box:5});
const map=makeMap('peaks',{world,walk,harbor,sleepers:ready.sleepers}),nav=map.nav(),spawn=[map.spawn.x,map.spawn.y];
const route=(x,y)=>nav.clearLine(spawn,[x,y])||nav.route(...spawn,x,y).length>0;
for(const [id,z]of Object.entries(world.zones)){assert(nav.walkable(...z.spawn),'blocked spawn '+id);assert(route(...z.spawn),'no route '+id)}
for(const [i,[x,y]]of world.islets.entries()){assert(nav.walkable(x,y),'blocked islet '+i);assert(route(x,y),'unreachable islet '+i)}
for(const [id,z]of Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id))){
 for(const p of art.props){const inside=z.poly?inPoly(p.x,p.y,z.poly):((p.x-z.x)/(z.rx*.72))**2+((p.y-z.y)/(z.ry*.72))**2<1;assert(!inside,p.id+' occupies '+id)}
}
const crowd=[];for(let y=1100;y<world.height-900&&crowd.length<100;y+=220)for(let x=800;x<world.width-700&&crowd.length<100;x+=220)if(nav.walkable(x,y)&&route(x,y))crowd.push([x,y]);assert.equal(crowd.length,100);
for(const b of benches){assert(b.footprint.poly.length>=40);assert(!nav.walkable(...b.centre.map((n,i)=>i===0?n+Math.cos(b.deg*Math.PI/180)*b.radius:n+Math.sin(b.deg*Math.PI/180)*b.radius*b.ratio)),'bench collision '+b.id)}
for(const id of ['plaza','activity-1','activity-2','activity-3'])assert(benches.filter(b=>b.id.startsWith('arc-'+id+'-')).length>=2,'missing ring benches '+id);
const files=readdirSync(A,{recursive:true}).filter(p=>!statSync(A+p).isDirectory());
assert(!files.some(p=>/\.(png|jpe?g|webp)$/i.test(p)),'working raster in public');
for(const file of files.filter(p=>p.endsWith('.svg')))assert(!/<image\b|data:image\/(png|jpe?g|webp)|<foreignObject\b|<linearGradient\b|<radialGradient\b/.test(readFileSync(A+file,'utf8')),'raster or gradient '+file);
for(const p of [...art.ground.tiles,...art.decks,...art.props,...art.flats,...art.floating])assert(p.src.endsWith('.svg')&&existsSync(A+p.src),'missing SVG '+p.src);
for(const p of centre.pieces)assert(existsSync(A+'centre/'+p.file));
const origin=centre.placement;for(const b of centre.blocked)assert(!nav.walkable(origin.x+b.ellipse.x,origin.y+b.ellipse.y),'unblocked centre '+b.name);
const originalFetch=globalThis.fetch;let acquired=0,released=0;
try{
 globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 const result=await loadThemeArt({...map,art:'/pixi-art/themes/peaks/art.json'},{acquire:async src=>{assert(existsSync('public'+src));acquired++;return Texture.EMPTY},release:()=>released++});
 assert.equal(result.props.length,art.props.length);assert.equal(result.props.filter(p=>p.centrePiece).length,5);assert(result.props.filter(p=>p.centrePiece).every(p=>!p.wind));result.destroy();assert.equal(acquired,released);
}finally{globalThis.fetch=originalFetch}
const out={status:'READY peaks',sleepers:40,poses:8,zoneRoutes:'all pass',isletRoutes:'both pass',activities:3,stallRows:2,reachableCrowdPositions:100,curvedBenches:benches.length,props:art.props.length,trees:art.props.filter(p=>/tree/.test(p.name)).length,centrePieces:centre.pieces.length,svgFiles:files.filter(p=>p.endsWith('.svg')).length,rasterFiles:0,textureAcquireRelease:[acquired,released],browser:'Chromium launch blocked by macOS bootstrap_check_in sandbox; SVG comparisons only'};
writeFileSync(A+'peaks-validation.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
