import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {HOME_MAP, makeMap} from '../src/world/island-maps.js';
import {geometry} from '../assets/world/island-geometry.mjs';
import raw from '../assets/world/walk-world.json' with {type:'json'};
import {homeHouseBases} from '../src/world/prop-outlines/islands.js';
import {homeHouseCut,islandHouseCut} from './home-house-rule.mjs';

const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`export {computeHomeScene} from './src/world/home/startup-scene.js';`},bundle:true,platform:'node',format:'esm',write:false});
const P=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const scene=P.computeHomeScene(true), client=geometry(scene.walk).walkable, worker=HOME_MAP.nav();
// The outline rebuild now bakes the house bases. Reconstruct full silhouettes
// for the independent before/after check instead of clipping a baked base twice.
const silhouettes=new Map(scene.props.filter(p=>p.footprint).map(p=>[p.id,p.footprint]));
const bakedHouses=new Set(raw.obstacles.filter(o=>o.homeHouseBase).map(o=>o.prop));
const fullRaw={...raw,obstacles:[...raw.obstacles.map(o=>o.homeHouseBase ? silhouettes.get(o.prop) : o),
  ...scene.props.filter(p=>bakedHouses.has(p.id)&&p.bodyFootprint).map(p=>p.bodyFootprint)]};

test('client and worker agree on every 16-unit Home sample and both cottage gaps are reachable',t=>{
  assert.deepEqual(scene.walk.obstacles,HOME_MAP.walk.obstacles);
  let samples=0;
  for(let y=raw.origin.y+8;y<raw.origin.y+raw.height;y+=16)for(let x=raw.origin.x+8;x<raw.origin.x+raw.width;x+=16){
    assert.equal(client(x,y),worker.walkable(x,y),`${x},${y}`);samples++;
  }
  t.diagnostic(`${samples} Home samples agree`);
  for(const point of [[-349,612],[4458,-68]]){
    assert.ok(!geometry(fullRaw).walkable(...point),'gap was blocked by the full house');
    assert.ok(client(...point),'client gap is open');
    assert.ok(worker.walkable(...point),'worker gap is open');
    assert.deepEqual(worker.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...point).at(-1),point);
  }
});

test('only Home house feet change, with body masks dropped and render depth retained',()=>{
  const changed=homeHouseBases(fullRaw.obstacles);
  for(const o of fullRaw.obstacles){
    const cut=homeHouseCut(o);
    if(cut===null){assert.ok(changed.includes(o),'non-house obstacle retained verbatim');continue;}
    if(o.bodyBlock){assert.ok(!changed.includes(o),'house body mask removed');continue;}
    const base=changed.find(b=>b.prop===o.prop&&!b.bodyBlock);
    const ys=[base.poly,...(base.parts??[])].flat().map(q=>q[1]);
    assert.ok(Math.abs(Math.min(...ys)-cut)<1e-8,'bottom 30%, clamped to 36..140');
    assert.equal(base.clearance,o.clearance);
  }
  assert.deepEqual(homeHouseBases(changed),changed,'safe for a regenerated baked map');
  for(const p of scene.props.filter(p=>homeHouseCut(p)!==null)){
    assert.equal(p.sortY,p.z);
    assert.equal(p.z,Math.max(...[p.footprint.poly,...(p.footprint.parts??[])].flat().map(q=>q[1])));
  }
});

test('band clamps, disconnected parts and excluded house names retain their rules',()=>{
  const rect=(x,top,bottom)=>[[x,top],[x+20,top],[x+20,bottom],[x,bottom]];
  for(const [height,band] of [[80,36],[200,60],[600,140]]){
    const o={prop:'cottage',poly:rect(0,0,height),parts:[rect(40,0,height)],clearance:22};
    const [base]=homeHouseBases([o,{...o,bodyBlock:true}]);
    assert.equal(Math.min(...base.poly.map(q=>q[1])),height-band);
    assert.equal(Math.min(...base.parts[0].map(q=>q[1])),height-band);
  }
  for(const prop of ['lighthouse','house-lamp','house-sign','house-shadow','bench','tree','stage','wall']){
    const o={prop,poly:rect(0,0,300)},body={...o,bodyBlock:true};
    assert.deepEqual(homeHouseBases([o,body]),[o,body]);
  }
  for(const prop of ['pink-arc-cafe-70','cafe-candy-cart','birdhouse-north','workshop-chair','bakery-yard-woodpile-3','lodge-yard-bench-5','treehouse-hanging-lantern','treehouse-bookshelf','lectern-hall','books-hall','hall-pool','house-stage']){
    const o={prop,poly:rect(0,0,300)},body={...o,bodyBlock:true};
    assert.deepEqual(homeHouseBases([o,body],true),[o,body],prop+' remains fully solid on other islands');
  }
  assert.equal(homeHouseBases([{prop:'hamlet-lanternloaf-cottage-northwest',poly:rect(0,0,300)}],true)[0].homeHouseBase,true,'a neighbourhood name is not a lantern');
  const world={...raw,props:[],obstacles:[{prop:'cottage',building:true,poly:rect(0,0,300)}]};
  const map=makeMap('other',{world,harbor:{jetty:{foot:[0,0],tip:[0,400]}},addJetty:false});
  assert.equal(map.walk.obstacles[0].homeHouseBase,true,'other islands use house bases');
  assert.deepEqual(makeMap('bog-arena',{world,harbor:{jetty:{foot:[0,0],tip:[0,400]}},addJetty:false}).walk.obstacles,world.obstacles,'Bog keeps full house blockers');
});

test('Duckies behind every Home house stay behind its roof instead of sorting on top',async()=>{
  const {furnitureDepth}=await import('../src/rendering/pixi/furniture-depth.js');
  let checked=0;
  for(const p of scene.props.filter(p=>islandHouseCut(p)!==null)){
    const points=[p.footprint.poly,...(p.footprint.parts??[])].flat(),top=Math.min(...points.map(q=>q[1]));
    const y=top+(p.z-top)*.2;
    assert.ok(y<p.z);
    assert.ok(furnitureDepth([p],p.x,y,y)<p.z,`${p.id}: standing behind the house must not draw over its roof`);
    assert.equal(furnitureDepth([p],p.x,p.z+100),p.z+100,`${p.id}: front depth stays in front`);
    checked++;
  }
  assert.ok(checked>=20,'covers the real Home houses');
});
