import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';
import {waterPoint,waterFrame,createFairWater} from '../../src/pixi/centre-motion/fair.js';
import {Graphics,Container,Texture} from 'pixi.js';
import {loadThemeArt} from '../../src/pixi/theme-art.js';
const A='public/pixi-art/themes/fair/',D='rive/web/themes/fair/',json=p=>JSON.parse(readFileSync(p,'utf8'));
const art=json(A+'art.json'),world=json(D+'world.json'),walk=json(D+'walk-world.json'),harbor=json(D+'harbor.json'),centre=json(A+'centre/centre.json');
const r=checkTheme('fair');assert(r.ready,r.problems.join('\n'));assert.equal(r.sleepers.length,40);assert(!r.sleepNotes.some(s=>s.includes('dropped')));
const map=makeMap('fair',{world,walk,harbor,sleepers:r.sleepers}),nav=map.nav();
assert(nav.walkable(map.spawn.x,map.spawn.y));
const route=(x,y)=>nav.clearLine([map.spawn.x,map.spawn.y],[x,y])||nav.route(map.spawn.x,map.spawn.y,x,y).length>0;
for(const [id,z]of Object.entries(world.zones))if(z.spawn){assert(nav.walkable(...z.spawn),'blocked zone '+id);assert(route(...z.spawn),'unreachable '+id);}
const {x:cx,y:cy}=centre.placement;
for(const b of centre.blocked)if(b.ellipse)assert(!nav.walkable(cx+b.ellipse.x,cy+b.ellipse.y),'missing obstacle '+b.name);
for(const [x,y]of [[0,370],[-565,0],[565,0],[0,180]])assert(route(cx+x,cy+y),'centre gate/floor unreachable '+x+','+y);
const inPoly=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c};
for(const [id,z]of Object.entries(world.zones).filter(([id])=>/^(activity|stalls)-/.test(id)))for(const p of [...art.props.filter(p=>!p.id.startsWith('fair-centre-')),...centre.blocked.filter(b=>b.ellipse).map(b=>({id:b.name,x:cx+b.ellipse.x,y:cy+b.ellipse.y}))])assert(!(z.poly?inPoly(p.x,p.y,z.poly):((p.x-z.x)/z.rx)**2+((p.y-z.y)/z.ry)**2<1),'prop '+p.id+' occupies '+id);
// 100 distinct accessible player positions, 170 units apart, on free land including sleeper collision.
const crowd=[];for(let y=850;y<world.height-400&&crowd.length<100;y+=210)for(let x=650;x<world.width-350&&crowd.length<100;x+=210)if(nav.walkable(x,y)&&route(x,y))crowd.push([x,y]);assert.equal(crowd.length,100);
for(const p of centre.pieces)assert(existsSync(A+'centre/'+p.file));
assert.deepEqual(waterPoint(0),{x:-170,y:-276});assert.deepEqual(waterPoint(1),{x:-263,y:-76});assert.notDeepEqual(waterFrame(0),waterFrame(.25));assert.deepEqual(waterFrame(0,true),waterFrame(10,true));
const objects=new Container(),fallback={id:'fair-centre-water',sprite:{alpha:1}};
const fx=createFairWater({Graphics,Container},[fallback],objects);assert.equal(fallback.sprite.alpha,0);fx.update(1,false,true);assert(fx.root.visible);fx.update(2,true,false);assert(!fx.root.visible);fx.destroy();assert.equal(fallback.sprite.alpha,1);assert.equal(objects.children.length,0);objects.destroy();
// Validate the deliverable that the renderer will actually load.
const props=json(D+'placements.json'),benches=props.filter(p=>p.asset==='arc-bench');
assert(benches.length>=12,'curved seats missing');
for(const zone of ['centre','teacups','carousel','activity-2'])assert(benches.some(p=>p.zone===zone),'missing bench ring '+zone);
for(const b of benches){assert(b.footprint?.poly?.length>20,'bench collision absent '+b.id);assert(!nav.walkable(b.x,b.y),'bench seat must block '+b.id);}
for(const p of art.props.filter(p=>!p.id.startsWith('fair-centre-')))assert(((p.x-cx)/700)**2+((p.y-cy)/420)**2>=1,'furniture intrudes into locked ride '+p.id);
const entries=[...art.ground.tiles,...art.decks,...art.flats,...art.props,...(art.floating??[])];
for(const file of new Set(entries.map(p=>p.src))){assert(file.endsWith('.svg'),'non SVG '+file);assert(existsSync(A+file),'missing '+file);assert(!/<image\b|data:image\/(?:png|jpe?g|webp)|<foreignObject\b/i.test(readFileSync(A+file,'utf8')),'embedded raster '+file);}
const rasters=readdirSync(A,{recursive:true}).filter(f=>/\.(png|webp|jpe?g)$/i.test(f));assert.equal(rasters.length,0,'working raster under public');
for(const b of r.sleepers)assert(b.pose==='nod'||Math.min(...props.filter(p=>/tree|bush|bench|rock|stall|ticket|flower|umbrella|towel|planter/i.test(p.name)).map(p=>Math.hypot(p.x-b.x,p.y-b.y)))<380,'sleeper has no nearby companion '+b.pose);
const originalFetch=globalThis.fetch;let acquired=0,released=0;
try{
 globalThis.fetch=async url=>({ok:true,json:async()=>json('public'+url)});
 const loaded=await loadThemeArt({...map,art:'/pixi-art/themes/fair/art.json'},{acquire:async src=>{assert(existsSync('public'+src),'loader missing '+src);acquired++;return Texture.EMPTY;},release:()=>released++});
 assert.equal(loaded.props.length,art.props.length);assert.equal(loaded.props.filter(p=>p.centrePiece?.animate).length,1);assert(loaded.props.filter(p=>p.centrePiece).every(p=>!p.wind));loaded.destroy();assert.equal(acquired,released);
}finally{globalThis.fetch=originalFetch;}
const metrics=json(A+'fair-metrics.json');
const out={status:'READY fair',sleepers:40,coastArea:metrics.coastArea,homeRatio:metrics.homeRatio,activities:4,stallRows:3,centrePieces:centre.pieces.length,reachableCrowdPositions:crowd.length,zoneRoutes:'all pass',centreEntrances:'3 pass',water:'source, landing, motion, reduced motion, visibility and cleanup pass',curvedBenches:benches.length,trees:props.filter(p=>/^tree-/.test(p.asset)).length,groundDecals:art.flats.length,rasterFiles:rasters.length,textureAcquireRelease:acquired+' / '+released,registryNote:'Fair is checked directly against its current files. Shared generated index must be refreshed by integration after all theme jobs finish.'};
writeFileSync(A+'fair-validation.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
