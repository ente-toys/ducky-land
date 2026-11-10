import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {objects,config} from '../scripts/bigger-fair/hamlets.mjs';
import {PLANT_MODELS,HAMLET_PLANTS} from '../scripts/bigger-fair/plant-kit.mjs';
import {OUTER_PLANTING,PLANT_RESERVES} from '../scripts/bigger-fair/plants-data.mjs';
import {applyPlants} from '../scripts/bigger-fair/plants-apply.mjs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {mapFor} from '../src/pixi/island-maps.js';
import {inPoly,inShape} from '../rive/web/island-geometry.mjs';
import {sleeperFootprint} from '../src/pixi/sleep-spots.js';

const read=p=>JSON.parse(fs.readFileSync(p));
const art=read('public/pixi-art/themes/fair/art.json');
const world=read('rive/web/themes/fair/world.json'),walk=read('rive/web/themes/fair/walk-world.json');
const plant=p=>/\/(tree|bush)-/.test(p.src);
const source=p=>p.src.startsWith('/')?'public'+p.src:'public/pixi-art/themes/fair/'+p.src;
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const added=art.props.filter(p=>p.id.startsWith('fair-plant-'));

test('Fair plants use only the nine exact approved Home SVGs, with no alternate drawings',()=>{
 const hashes=new Set(Object.values(PLANT_MODELS).map(m=>hash('public'+m.src)));
 for(const p of art.props.filter(plant))assert(hashes.has(hash(source(p))),p.id+' off kit');
 assert.equal(new Set(art.props.filter(plant).map(p=>p.src.split('/').at(-1))).size,9);
 for(const m of Object.values(PLANT_MODELS)){
  const svg=fs.readFileSync('public'+m.src,'utf8');
  assert(!/<image|gradient|<filter/i.test(svg));assert(/#39472d/i.test(svg));
 }
});

test('all 91 hamlet plants retain their layout IDs, feet, heights and solid bases',()=>{
 const expected=Object.keys(config).flatMap(h=>objects(h).filter(o=>HAMLET_PLANTS[o.file]&&art.props.some(p=>p.id===`hamlet-${h}-${o.id}`)).map(o=>[h,o]));
 assert.equal(expected.length,91);
 for(const [h,o]of expected){
  const p=art.props.find(p=>p.id===`hamlet-${h}-${o.id}`);assert(p,o.id);
  assert.equal(p.src,o.src);assert.equal(p.x,o.x);assert.equal(p.y,o.y);
  assert.equal(p.height,o.height);assert.equal(p.width,o.width);assert.equal(p.scale,1);
  assert.deepEqual(p.footprint,o.fp);assert.deepEqual(p.footprints,[o.fp]);
 }
});

test('authored outer groves have 3–7 mixed trees and low skirts, leaving feature pockets clear',()=>{
 assert.equal(added.length,112);
 for(const [name,plants]of Object.entries(OUTER_PLANTING)){
  const trees=plants.filter(p=>p[0].startsWith('tree-'));
  assert(trees.length>=3&&trees.length<=7,name);assert(new Set(trees.map(p=>p[0])).size>=3,name);
  assert(plants.some(p=>p[0].startsWith('bush-')),name+' missing understorey');
 }
 for(const p of added){
  const f=p.footprints[0];
  assert(!PLANT_RESERVES.some(r=>p.x+f.rx>r.x0&&p.x-f.rx<r.x1&&p.y+f.ry>r.y0&&p.y-f.ry<r.y1),p.id);
 }
});

test('new grove bases clear paths, coast, water, retained props and every sleeper',()=>{
 const report=applyPlants(structuredClone(art),structuredClone(world),structuredClone(walk));
 assert.deepEqual(report.problems,[]);
 const checked=checkTheme('fair');assert(checked.ready,checked.problems.join('\n'));
 assert.equal(report.sleepers,world.sleepTotal??40);
 for(const p of added){
  for(const w of [world,walk])assert(w.obstacles.some(f=>f.name===p.id&&f.x===p.x&&f.y===p.y-8),p.id);
  assert(world.props.some(q=>q.id===p.id&&q.x===p.x&&q.y===p.y),p.id);
 }
 assert.deepEqual(read('rive/web/themes/fair/placements.json'),art.props);
});

test('vegetation regeneration is idempotent and does not paint ground or alter routes and residents',()=>{
 const a=structuredClone(art),w=structuredClone(world),v=structuredClone(walk);
 applyPlants(a,w,v);
 assert.deepEqual(a,art);assert.deepEqual(w,world);assert.deepEqual(v,walk);
 assert.deepEqual(a.ground,art.ground);assert.deepEqual(w.paths,world.paths);
 assert.deepEqual(w.sleepSpots,world.sleepSpots);assert.deepEqual(w.water,world.water);
});

test('merged Fair density keeps every plant base clear of water, paving, benches and residents',()=>{
 const dense=read('scripts/bigger-fair/dense-plants-data.json');
 assert.deepEqual(art.props.filter(p=>p.id.startsWith('fair-dense-')),dense);
 assert.equal(art.props.filter(p=>/\/tree-/.test(p.src)).length,246);
 assert.equal(art.props.filter(p=>/\/bush-/.test(p.src)).length,286);
 const surface=read('scripts/bigger-fair/path-routes.json').surface;
 const polygons=surface.type==='Polygon'?[surface.coordinates]:surface.coordinates;
 const paved=([x,y])=>polygons.some(r=>inPoly(x,y,r[0])&&!r.slice(1).some(h=>inPoly(x,y,h)));
 const beds=mapFor('fair').sleepers.map(b=>({...sleeperFootprint(b),tree:b.tree}));
 const seats=art.props.filter(p=>p.pavingFeet).map(p=>{
  const xs=p.pavingFeet.map(q=>q[0]),ys=p.pavingFeet.map(q=>q[1]);
  return {id:p.id,x0:Math.min(...xs)-3,x1:Math.max(...xs)+3,y0:Math.min(...ys)-3,y1:Math.max(...ys)+3};
 });
 for(const p of art.props.filter(p=>/\/(?:tree|bush|flowers?)-/.test(p.src))){
  let feet=p.footprints??(p.footprint?[p.footprint]:[]);
  if(!feet.length)feet=walk.obstacles.filter(f=>f.name===p.id||f.name==='ac2-'+p.id||f.x===p.x&&Math.abs(f.y-p.y)<15);
  if(!feet.length)feet=[{x:p.x,y:p.y-6,rx:p.width*(p.scale??1)*.3,ry:14}];
  for(const f of feet){
   const points=f.poly??[[f.x,f.y],...Array.from({length:32},(_,i)=>[f.x+f.rx*Math.cos(i*Math.PI/16),f.y+f.ry*Math.sin(i*Math.PI/16)])];
   for(const q of points){
    assert(inPoly(...q,world.coast),p.id+' outside coast');
    assert(!world.water.some(w=>inShape(...q,w)),p.id+' in water');
    assert(!paved(q),p.id+' on paving');
    assert(!seats.some(b=>q[0]>b.x0&&q[0]<b.x1&&q[1]>b.y0&&q[1]<b.y1),p.id+' on bench');
    assert(!beds.some(b=>b.tree!==p.id&&inShape(...q,b)),p.id+' on sleeper');
   }
  }
 }
});
