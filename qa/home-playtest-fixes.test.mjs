import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
import {HOME_MAP} from '../src/world/island-maps.js';
import E from '../src/world/home/home-expansion.json' with {type:'json'};
const result=await build({entryPoints:['src/world/home/placements.js'],bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const props=P.createPlacements(),local=P.walkWorld(P.trimWorld(HOME_MAP.world),props),client=geometry(local).walkable;

test('west bridge has a continuous client and worker deck between dry bank approaches',()=>{
 const b=E.homeArches.find(b=>b.id==='home-west-bridge'),worker=HOME_MAP.nav();
 const dry=geometry({...local,bridges:[],walkways:[],obstacles:[]}).walkable;
 assert.ok(dry(...b.a));assert.ok(dry(...b.b),'south landing is on the bank');
 for(let i=0;i<=100;i++){
  const x=b.a[0]+(b.b[0]-b.a[0])*i/100,y=b.a[1]+(b.b[1]-b.a[1])*i/100;
  assert.ok(client(x,y),`client deck ${i}`);assert.ok(worker.walkable(x,y),`worker deck ${i}`);
 }
 for(const [from,to]of [[b.a,b.b],[b.b,b.a]]){
  const route=worker.route(...from,...to);assert.deepEqual(route.at(-1),to);
  let previous=from,length=0;for(const p of route){length+=Math.hypot(p[0]-previous[0],p[1]-previous[1]);previous=p;}
  assert.ok(length<650,'walk crosses the bridge without a detour');
 }
});

test('flowering bushes and both closed public buildings remain solid on client and worker',()=>{
 for(const id of ['hamlet-butterbill-north-flower-bush','hamlet-lanternleaf-garden-shed','hamlet-lanternleaf-bandstand']){
  const p=props.find(p=>p.id===id);assert.equal(p.outlineKind,'solid');
  const poly=p.footprint.poly,x=poly.reduce((s,p)=>s+p[0],0)/poly.length,y=poly.reduce((s,p)=>s+p[1],0)/poly.length;
  assert.equal(client(x,y),false);assert.equal(HOME_MAP.nav().walkable(x,y),false);
  if(p.enterable===false)assert.equal(p.door,undefined);
 }
});

test('repaired roofs have opaque caps and connected chimney bases in the source raster',async()=>{
 for(const file of ['petalpatch/house-domed-pottery-shop','butterbill/house-petaldoor','lanternleaf/house-yellow']){
  const pixels=await sharp('public/pixi-art/home-hamlets/'+file+'.svg').resize(360,320,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  for(const [x,y]of [[75,80],[280,80],[280,90]])assert.equal(pixels[(y*360+x)*4+3],255,`${file}: roof/chimney ${x},${y}`);
 }
 const pixels=await sharp('public/pixi-art/home-hamlets/reedwhistle/smokehouse.svg').resize(360,320,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 assert.equal(pixels[(80*360+180)*4+3],255,'smokehouse roof triangle is filled');
 assert.ok(!readFileSync('public/pixi-art/lake-race.svg','utf8').includes('translate(330 -252)'),'lake waterfall drawing is removed');
});

test('every Home resident has the same small body circle on client and worker',()=>{
 const beds=P.sleepSpots(local,props,client),world={...local,obstacles:[...local.obstacles,...beds.map(P.sleeperFootprint)]},walk=geometry(world).walkable;
 assert.equal(beds.length,100);assert.deepEqual(beds.bad,[]);
 const studio=beds.find(b=>b.pose==='nod'&&b.x===50&&b.y===3300);assert.ok(studio,'studio resident stays on the authored grass coordinate');assert.equal(studio.tree,undefined,'ground coordinate never resolves to a numeric prop id');
 for(const bed of beds){const f=P.sleeperFootprint(bed);assert.equal(f.rx,f.ry);assert.ok(f.rx>=34&&f.rx<=48);assert.equal(walk(f.x,f.y),false);assert.equal(HOME_MAP.nav().walkable(f.x,f.y),false);}
});


test('Willowrest bench is visible outside both nearby tree silhouettes',async()=>{
 const bench=props.find(p=>p.id==='review-willow-picnic'),trees=props.filter(p=>['bigger-community-536','bigger-community-537'].includes(p.id));
 const pixels=await sharp('public'+bench.src).resize(48,48,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 for(let y=0;y<48;y++)for(let x=0;x<48;x++)if(pixels[(y*48+x)*4+3]>240){
  const wx=bench.x+((x+.5)/48-bench.anchor.x)*bench.width*bench.scale,wy=bench.y+((y+.5)/48-bench.anchor.y)*bench.height*bench.scale;
  for(const tree of trees)assert.equal(inShape(wx,wy,tree.footprint),false,`${tree.id}: bench remains visible`);
 }
});
