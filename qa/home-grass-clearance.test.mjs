import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {HOME_MAP} from '../src/world/island-maps.js';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
import {homeClearanceOracle,auditHomeClearance,auditConnectedBodies} from '../scripts/lib/home-clearance-audit.mjs';
import {alphaContours} from '../scripts/lib/alpha-contour.mjs';
const b=await build({stdin:{resolveDir:process.cwd(),contents:`export * from './src/world/home/placements.js';export {harborWorld} from './src/gameplay/islands.js';export {sleepHalfWidths} from './src/world/home/sleep-spots.js';`},bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const props=P.createPlacements(),local=P.harborWorld(P.walkWorld(P.trimWorld(HOME_MAP.world),props));
const beds=P.sleepSpots(local,props,geometry(local).walkable,P.sleepHalfWidths(.88*.24*3));
const world={...local,obstacles:[...local.obstacles,...beds.map(P.sleeperFootprint)]};
const client=geometry(world).walkable,worker=HOME_MAP.nav();
const oracle=await homeClearanceOracle(props,world);

test('connected Home grass/sand/path clearing alpha pixels by 30 and front props by the body box is walkable on client and worker',()=>{
  const result=auditHomeClearance(world,[HOME_MAP.spawn.x,HOME_MAP.spawn.y],oracle,[client,worker.walkable]);
  console.log('Home grass clearance audit:',JSON.stringify(result));
  assert.ok(result.connectedBodySafeSamples>100000,'whole island sweep');
  assert.deepEqual(result.violations,[0,0],JSON.stringify(result.examples));
  assert.deepEqual(result.bodyClearanceViolations,[0,0],'no walkable centre overlaps opaque art plus 22-unit body');
  assert.deepEqual(result.frontBodyOverlaps,[0,0],'no walkable body rectangle intersects foreground alpha pixels');
  assert.equal(world.navigationCellSize,16);
  assert.deepEqual(world.obstacles,HOME_MAP.walk.obstacles,'client and baked worker blockers identical');
});

test('boss oak/birch/yellow cottage grass near 3178,-805 is clear and reachable',()=>{
  const candidates=[];
  for(let y=-925;y<=-625;y+=8)for(let x=3050;x<=3350;x+=8)if(oracle.clear(x,y)&&client(x,y))candidates.push([x,y]);
  candidates.sort((a,b)=>Math.hypot(a[0]-3178,a[1]+805)-Math.hypot(b[0]-3178,b[1]+805));
  const point=candidates[0];assert.ok(point,'nearby body-safe grass remains');
  console.log('Oak/birch grass safe point:',point);
  assert.ok(oracle.clear(...point),'at least 30 units from opaque drawing');
  assert.ok(client(...point));assert.ok(worker.walkable(...point));
  assert.deepEqual(worker.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...point).at(-1),point);
});

test('contour preserves recesses, closes holes and keeps disconnected art separate',()=>{
  const rgba=new Uint8Array(16*16*4);
  for(let y=1;y<15;y++)for(let x=1;x<15;x++)if((x<5||y>10)&&!(x===2&&y===12))rgba[(y*16+x)*4+3]=255;
  rgba[(2*16+12)*4+3]=255;
  const rings=alphaContours(rgba,16),shape={poly:rings[0],parts:rings.slice(1)};
  assert.equal(rings.length,2);
  assert.ok(!inShape(.5,.5,shape),'concave opening is retained');
  assert.ok(inShape(2.5/16,12.5/16,shape),'interior hole is closed');
  assert.ok(inShape(12.5/16,2.5/16,shape),'detached opaque detail is blocked');
});


test('red roof cottage flowering-bush/oak gap at Lanternleaf stays walkable',()=>{
  const cottage=props.find(p=>p.id==='hamlet-lanternleaf-rose-roof-cottage');
  const bush=oracle.shapes.find(p=>p.prop==='hamlet-lanternleaf-bush-red-house-right');
  const oak=oracle.shapes.find(p=>p.prop==='hamlet-lanternleaf-oak-northeast');
  assert.ok(cottage&&bush&&oak,'boss landmarks exist');
  // Sample the actual opaque sides at canopy/bush height, not sprite boxes.
  const y=-840;let left=-Infinity,right=Infinity;
  for(let x=3000;x<3400;x+=.25){if(inShape(x,y,bush))left=x;if(inShape(x,y,oak))right=Math.min(right,x);}
  const width=right-left;
  // A smaller oak also borders this opening. Choose the nearest clear centre
  // to the pair's midpoint using alpha distance, independently of navigation.
  const candidates=[];
  for(let yy=y;yy<=y+180;yy+=8)for(let x=left+30;x<=right-30;x+=.5)if(oracle.clear(x,yy)&&client(x,yy))candidates.push([x,yy]);
  candidates.sort((a,b)=>Math.hypot(a[0]-3208,a[1]+840)-Math.hypot(b[0]-3208,b[1]+840));
  const point=candidates[0];
  assert.ok(point,'a 30-unit-clear centre exists in the gap');
  console.log('Boss flowering bush/oak gap:',JSON.stringify({width,point}));
  assert.ok(Number.isFinite(width)&&width>=60,`opaque gap is ${width} units`);
  assert.ok(oracle.clear(...point),'gap centre clears every opaque prop by 30');
  assert.ok(client(...point));assert.ok(worker.walkable(...point));
  assert.deepEqual(worker.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...point).at(-1),point);
});

test('reported bush-over-body point is blocked on both implementations',()=>{
  assert.equal(oracle.frontClear(3208,-840),false,'reproduces foreground pixel overlap');
  assert.equal(client(3208,-840),false);
  assert.equal(worker.walkable(3208,-840),false);
});

test('every spawn-connected 16-unit Home sample has zero foreground pixel/body intersections',()=>{
  for(const [name,walkable] of [['client',client],['worker',worker.walkable]]){
    const result=auditConnectedBodies(world,[HOME_MAP.spawn.x,HOME_MAP.spawn.y],oracle,walkable);
    console.log('Connected body raster audit:',name,JSON.stringify(result));
    assert.ok(result.samples>100000);
    assert.equal(result.overlaps,0,JSON.stringify(result.examples));
  }
});
