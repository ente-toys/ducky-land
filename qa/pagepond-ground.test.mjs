import {retiredBoatIds} from '../scripts/pagepond-boats/config.mjs';
import {test} from 'node:test';
import {changedIds} from '../scripts/pagepond-benches/geometry.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Path2D,PathOp,even,ring,dist,curve,contours} from '../scripts/pagepond/geometry.mjs';
import {inPoly,inShape,geometry} from '../assets/world/island-geometry.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {makeMap} from '../src/world/island-maps.js';
const A='public/pixi-art/themes/library/',D='assets/world/themes/library/';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),plan=read('scripts/pagepond/layout.json');
const oldArt=read('scripts/bigger-library/original/art.json'),old=read('scripts/bigger-library/original/world.json');
const checked=checkTheme('library'),map=makeMap('library',{world,walk,harbor:read(D+'harbor.json'),sleepers:checked.sleepers}),geo=geometry(map.walk);

test('Library art never contains a raster file, SVG image element or embedded picture',()=>{
 const files=fs.readdirSync(A,{recursive:true});
 for(const src of files){
  assert(!/\.(?:png|apng|jpe?g|webp|gif|avif|bmp|tiff?|ico)$/i.test(src),'raster file '+src);
  if(!src.endsWith('.svg'))continue;
  const svg=fs.readFileSync(A+src,'utf8');
  assert(!/<(?:\w+:)?image\b|<foreignObject\b|data\s*:/i.test(svg),'embedded raster '+src);
 }
 const tiles=art.ground.tiles.filter(t=>/^bigger\/ground-/.test(t.src));assert.equal(tiles.length,80);
 for(const t of tiles){const svg=fs.readFileSync(A+t.src,'utf8');assert(!/<(?:linear|radial)Gradient\b/i.test(svg),t.src+' has flat vector fills');assert(/<path\b/.test(svg),t.src+' has vector paths');}
});

test('Pagepond keeps literary signatures, residents, props and useful pier destinations',()=>{
 const keep=read('scripts/pagepond-ground/data/keep.json');
 const shadows=read('scripts/pagepond-b/shadows.json');
 for(const [src,hash] of Object.entries(keep.assets)){const strip=shadows.stripBakedGroundShadows.find(p=>p.file===A+src);if(strip){assert(!fs.readFileSync(A+src,'utf8').includes(strip.exactElement),src+' baked contact removed');}else assert.equal(createHash('sha256').update(fs.readFileSync(A+src)).digest('hex'),hash,src);}
 const b=read('scripts/pagepond-b/placements.json');
 for(const prior of keep.props){if(prior.id==='lib-256'||retiredBoatIds.has(prior.id)||[...read('scripts/pagepond-bridges/report.json').clearedLandscape,...read('scripts/pagepond-bridges/report.json').retiredBridgeParts].includes(prior.id))continue;const actual=art.props.find(p=>p.id===prior.id);assert(actual,prior.id+' retained');const allowed=new Set(['shadow','shadowSize','shadowOffset']);if(changedIds.has(prior.id))for(const k of ['src','x','y','width','height','scale','anchor','flip','wind','footprint'])allowed.add(k);if(b.planting.replace.some(p=>p.id===prior.id))for(const k of ['src','width','height','scale'])allowed.add(k);if(b.planting.moves.some(p=>p.id===prior.id))for(const k of ['x','y','footprint'])allowed.add(k);for(const k of Object.keys(prior))if(!allowed.has(k))assert.deepEqual(actual[k],prior[k],prior.id+' '+k);}
 for(const [pose,spots] of Object.entries(keep.sleepSpots))assert.deepEqual(world.sleepSpots[pose].slice(0,spots.length),spots);assert.equal(checked.sleepers.length,250);assert(checked.ready,checked.problems.join('\n'));
 for(const src of ['jetty-west.svg','jetty-east.svg','jetty-south.svg','pond-reading-dock.svg','hamlets/paperboat/south-jetty.svg'])assert(art.decks.some(d=>d.src===src),src);
 assert.deepEqual(world.coastRings,keep.coastRings,'paired page-like land retained');
 assert.equal(plan.pathSystem.main,128);assert.equal(plan.pathSystem.lane,104);assert.equal(plan.pathSystem.fill,'#FFF0C7');
});

test('Pagepond has one Home Honeywood arch per crossing and flush physical banks',()=>{
 assert(plan.crossings.length>=11,'both full moats include their south crossings');
 assert.equal(art.decks.filter(d=>d.id?.startsWith('bridge-')).length,plan.crossings.length);for(const d of art.decks.filter(d=>d.id?.startsWith('bridge-')))assert(d.overBoats);
 assert.deepEqual(world.bridges,walk.bridges);assert.deepEqual(world.water,walk.water);
 const wet=(x,y)=>world.water.slice(old.water.length).some(w=>inShape(x,y,w));
 const nav=map.nav(),floor={isPointInPath:(x,y)=>plan.floorRings?plan.floorRings.reduce((n,r)=>n+(inPoly(x,y,r)?1:0),0)%2===1:even(new Path2D(plan.floor)).isPointInPath(x,y)};
 for(const c of plan.crossings){
  assert(wet(c.x,c.y),c.id+' crosses water');assert(nav.route(map.spawn.x,map.spawn.y,c.x,c.y).length,c.id+' reachable');
  for(const p of [c.bankA,c.bankB]){assert(!wet(...p),c.id+' foot is a bank');assert(floor.isPointInPath(...p),c.id+' lands on path');}
  for(const [i,other]of plan.crossings.entries())if(other!==c)assert(Math.hypot(other.x-c.x,other.y-c.y)>250,c.id+' duplicated crossing '+i);
  const dx=(c.bankB[0]-c.bankA[0])/c.length,dy=(c.bankB[1]-c.bankA[1])/c.length;
  for(let t=-20;t<=c.length+20;t+=4){const p=[c.bankA[0]+dx*t,c.bankA[1]+dy*t];assert(geo.walkable(...p),c.id+' continuous deck/bank '+t);}
  assert(/^\/pixi-art\/home-expansion-c\/bridges\/bridge-(ew|ns|ne|nw)\.svg$/.test(c.homeSource),c.id+' authored source direction');
  for(const side of [-1,1]){let shortest=Infinity;for(let j=-12;j<=12;j++){const v=c.width/2*j/12;let dryRun=0;for(let t=c.length/2;t>0;t-=1){const x=c.x+dx*t*side-dy*v,y=c.y+dy*t*side+dx*v;if(wet(x,y))break;dryRun++;}shortest=Math.min(shortest,dryRun);}assert(shortest<(c.homeSource.match(/-(ne|nw)\.svg$/)?90:75),c.id+' bank throat across full deck '+shortest);}
  const deck=art.decks.find(d=>d.id===c.id),back=fs.readFileSync(A+deck.src,'utf8'),front='';
  assert(back.includes('data-home-source="/pixi-art/home-expansion-c/bridges/bridge-'),c.id+' exact Home source');
  assert(back.includes('#c88941')&&back.includes('#885931')&&back.includes('#39472d'),c.id+' Pagepond palette');

 }
});

test('Pagepond river mouths are open to the sea and preserve navigable original centre land',()=>{
 const water=world.water.slice(old.water.length),dry=even(new Path2D(plan.dry)),wet=p=>water.some(w=>inShape(...p,w));
 for(const ch of plan.channels){
  for(const end of [ch.points.at(-1)]){assert(!map.landAt(end[0],end[1]),ch.id+' open end');assert(!world.coastRings.some(r=>inPoly(...end.slice(0,2),r)),ch.id+' reaches sea');}
  for(const line of contours(curve(ch.points)))for(const p of line){if(old.coastRings.some(r=>inPoly(...p,r)))continue;assert(!dry.isPointInPath(...p),ch.id+' no water stub at '+p);}
 }
 for(const [x,y]of [[-650,2520],[8600,2900],[5900,5380],[5870,7080]]){assert(wet([x,y]),'river painted wet '+x+','+y);assert(!geo.walkable(x,y),'river blocks walking '+x+','+y);assert(!map.landAt(x,y),'boat water '+x+','+y);}
});

test('Pagepond original tree clusters keep trunks and sleepers off paths',()=>{
 const floor=even(new Path2D(plan.floor)),plants=art.props.filter(p=>p.zone==='outer-grove');assert(plants.length>=45);
 const originalSources=new Set(oldArt.props.map(p=>p.src));
 for(const p of plants){assert(originalSources.has(p.src),p.id+' original art');assert(/reuse\/(?:tree-[1-5]|bush-[\w-]+)\.svg|lantern-tree\.svg/.test(p.src),p.id+' plant');
  assert(!floor.isPointInPath(p.x,p.y),p.id+' trunk off paths');
  for(const b of checked.sleepers){if(b.tree===p.id)continue;const w=p.width*(p.scale??1),rx=b.r*.9+w*.16,ry=Math.min(34,Math.max(22,b.r*.42))+w*.065;assert(((p.x-b.x)/rx)**2+((p.y-10-(b.y-6))/ry)**2>=1,p.id+' trunk/sleeper footprints clear');}
 }
 assert(!art.props.some(p=>p.id.startsWith('bigger-')));assert(!world.obstacles.some(o=>o.name?.startsWith('bigger-')));
 const source=fs.readFileSync(A+'pagepond/outer-source.svg','utf8');assert.equal((source.match(/data-pagepond-paths="home-system"/g)??[]).length,1,'one opaque path union');assert(!/data-merged-paths|data-bridge-landings/.test(source));
});

test('Every Pagepond tile has one opaque Home-system painter and the exact lane audit is clear',()=>{
 for(const t of art.ground.tiles){
  const svg=fs.readFileSync(A+t.src,'utf8');
  const paths=[...svg.matchAll(/<path\b[^>]*data-pagepond-paths="home-system"[^>]*>/g)].map(m=>m[0]);
  assert.equal(paths.length,1,t.src+' has one surface owner');assert(paths[0].includes('fill="#FFF0C7"'),t.src);
  assert(!/\s(?:opacity|fill-opacity|stroke)="/.test(paths[0]),t.src+' fully opaque without edge bands');
  assert(!/data-merged-paths|data-bridge-landings|path-joint-inlays/.test(svg),t.src+' has no retired paint');
  if(t.src.includes('original-ground-')){
   assert(svg.includes('M6108 3596q-66-45-162-12v133'),'complete book medallion silhouette');
   assert(svg.includes('M6082 3623q-50 -18 -106 -12'),'medallion page lettering retained');
  }
 }
 const audit=read('scripts/pagepond-ground/geometry-audit.json');assert.deepEqual(audit.issues,[]);assert.equal(audit.unservedEnds,0);assert.deepEqual(audit.routeWidths,[104,128]);
 for(const color of ['sage','lavender','blue','coral'])assert(fs.readFileSync(A+`hamlets/inkleaf/cottage-${color}-book.svg`,'utf8').includes('M40 136H239V254H40Z'));
 assert(fs.readFileSync(A+'hamlets/inkleaf/print-hall.svg','utf8').includes('M50 173H493V382H50Z'));
});
