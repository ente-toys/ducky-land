import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Path2D,PathOp,even,ring,dist,curve,contours} from '../scripts/pagepond/geometry.mjs';
import {inPoly,inShape,geometry} from '../rive/web/island-geometry.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {makeMap} from '../src/pixi/island-maps.js';
const A='public/pixi-art/themes/library/',D='rive/web/themes/library/';
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

test('Pagepond locks both centre compositions, source drawings, original decks and forty approved residents',()=>{
 const hashes=read('scripts/pagepond/centre-lock.json');
 for(const [src,hash]of Object.entries(hashes))assert.equal(createHash('sha256').update(fs.readFileSync(A+src)).digest('hex'),hash,src+' source changed');
 assert.deepEqual(art.props.slice(0,oldArt.props.length),oldArt.props);
 for(const key of ['flats','floating'])assert.deepEqual(art[key],oldArt[key]);
 const withoutBoat=({overBoats,...p})=>p;assert.deepEqual(art.decks.slice(0,oldArt.decks.length).map(withoutBoat),oldArt.decks);for(const d of art.decks.slice(0,5))assert(d.overBoats,'centre bridge/jetty raises over boats');
 for(const key of ['sleepAvoid','paths'])assert.deepEqual(world[key],old[key],key);assert.deepEqual(world.walkways.slice(0,old.walkways.length).map(({boatPassUnder,...w})=>w),old.walkways);
 for(const [id,z]of Object.entries(old.zones))assert.deepEqual(world.zones[id],z,id);
 assert(checked.ready,checked.problems.join('\n'));assert.equal(checked.sleepers.length,40);
 const addedFloor={isPointInPath:(x,y)=>(plan.outerFloorRings??[]).reduce((n,r)=>n+(inPoly(x,y,r)?1:0),0)%2===1};
 for(const b of checked.sleepers)for(const dx of [-b.r*.8,0,b.r*.8])assert(!addedFloor.isPointInPath(b.x+dx,b.y),b.pose+' clear of new routes');
});

test('Pagepond has one centre-art arch per crossing, bank landings and no extended dry-ground bridges',()=>{
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
  // A straight deck encloses the complete curved-bank cross section. Measure
  // its shortest landing across that width, rather than requiring a diagonal
  // bank to meet every plank at the same longitudinal station.
  assert(c.bankA[0]===c.bankB[0]||c.bankA[1]===c.bankB[1],c.id+' camera-axis crossing');
  for(const side of [-1,1]){let shortest=Infinity;for(let j=-12;j<=12;j++){const v=c.width/2*j/12;let dryRun=0;for(let t=c.length/2;t>0;t-=1){const x=c.x+dx*t*side-dy*v,y=c.y+dy*t*side+dx*v;if(wet(x,y))break;dryRun++;}shortest=Math.min(shortest,dryRun);}assert(shortest<50,c.id+' dry overrun across full deck '+shortest);}
  const back=fs.readFileSync(A+`pagepond/${c.id}-back.svg`,'utf8'),front=fs.readFileSync(A+`pagepond/${c.id}-front.svg`,'utf8');
  assert(back.includes('data-source="canal-bridge-north"')&&front.includes('data-source="canal-bridge-north"'),c.id+' original arch art');
  assert(!/transform=/.test(back+front),c.id+' direction art is never rotated or skewed');
  assert(!/<rect\b/.test(back),c.id+' no flat plank replacement');
 }
});

test('Pagepond river mouths are open to the sea and preserve navigable original centre land',()=>{
 const water=world.water.slice(old.water.length),dry=even(new Path2D(plan.dry)),wet=p=>water.some(w=>inShape(...p,w));
 for(const ch of plan.channels){
  for(const end of [ch.points.at(-1)]){assert(!map.landAt(end[0],end[1]),ch.id+' open end');assert(!world.coastRings.some(r=>inPoly(...end.slice(0,2),r)),ch.id+' reaches sea');}
  // No blind pocket anywhere on the river spine, except exact preserved jetty decks.
  for(const line of contours(curve(ch.points)))for(const p of line){if(old.coastRings.some(r=>inPoly(...p,r)))continue;assert(!dry.isPointInPath(...p),ch.id+' no water stub at '+p);}
 }
 for(const [x,y]of [[-650,2520],[8600,2900],[5900,5380],[5870,7080]]){assert(wet([x,y]),'river painted wet '+x+','+y);assert(!geo.walkable(x,y),'river blocks walking '+x+','+y);assert(!map.landAt(x,y),'boat water '+x+','+y);}
});

test('Pagepond original tree clusters keep trunks and sleepers off paths',()=>{
 const floor=even(new Path2D(plan.floor)),plants=art.props.filter(p=>p.zone==='outer-grove');assert(plants.length>=45);
 const originalSources=new Set(oldArt.props.map(p=>p.src));
 for(const p of plants){assert(originalSources.has(p.src),p.id+' original art');assert(/reuse\/(?:tree-[1-5]|bush-[\w-]+)\.svg|lantern-tree\.svg/.test(p.src),p.id+' plant');
  assert(!floor.isPointInPath(p.x,p.y),p.id+' trunk off paths');
  for(const b of checked.sleepers){const w=p.width*(p.scale??1),rx=b.r*.9+w*.16,ry=Math.min(34,Math.max(22,b.r*.42))+w*.065;assert(((p.x-b.x)/rx)**2+((p.y-10-(b.y-6))/ry)**2>=1,p.id+' trunk/sleeper footprints clear');}
 }
 assert(!art.props.some(p=>p.id.startsWith('bigger-')));assert(!world.obstacles.some(o=>o.name?.startsWith('bigger-')));
 const source=fs.readFileSync(A+'pagepond/outer-source.svg','utf8');assert.equal((source.match(/data-merged-paths="true"/g)??[]).length,1,'one outlined path union, no strokes across joins');
});
