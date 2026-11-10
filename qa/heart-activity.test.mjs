import test from 'node:test';
import assert from 'node:assert/strict';
import {createHeartLocations,heartArtContains} from '../src/pixi/heart-activity.js';
import sharp from 'sharp';
import {Quaternion} from 'three';
import {rotateGlobeFromScreen} from '../src/pixi/three-globe-math.js';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {ISLETS} from '../src/pixi/islets.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {inPoly} from '../rive/web/island-geometry.mjs';

const sampler = () => {
  let seed = 7;
  return createHeartLocations(WORLD_ISLANDS,mapOf,()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),ISLETS);
};
test('activity covers all nine islands and eleven islets, on actual dry land',()=>{
  const next=sampler(),counts=new Map(),round=WORLD_ISLANDS.length*3+ISLETS.length;
  for(let i=0;i<round*30;i++){
    const {island,x,y}=next();counts.set(island,(counts.get(island)??0)+1);
    if(WORLD_ISLANDS.includes(island)){
      const map=mapOf(island.id);assert.ok(map.landAt(x+map.cx,y+map.cy),island.id);
    }else{
      assert.ok(inPoly(x,y,island.coast),island.id);
      assert.ok(!island.lakes.some(ring=>inPoly(x,y,ring)),island.id);
    }
  }
  for(const island of WORLD_ISLANDS)assert.equal(counts.get(island),90,island.id);
  for(const island of ISLETS)assert.equal(counts.get(island),30,island.id);
});
test('each main island reaches all quadrants and avoids repeating recent spawn points',()=>{
  const next=sampler(),history=new Map(),quadrants=new Map();
  for(let i=0;i<3000;i++){
    const {island,x,y}=next(),recent=history.get(island)??[];
    assert.ok(!recent.some(p=>p.x===x&&p.y===y),island.id);
    recent.push({x,y});if(recent.length>6)recent.shift();history.set(island,recent);
    const seen=quadrants.get(island)??new Set();seen.add(`${x>0},${y>0}`);quadrants.set(island,seen);
  }
  for(const island of WORLD_ISLANDS)assert.equal(quadrants.get(island).size,4,island.id);
});

test('heart anchors must also be inside the displayed art, excluding invisible legacy coast pieces',async()=>{
  const masks=new Map();
  for(const frame of [...WORLD_ISLANDS,...ISLETS]){
    const relative=frame.art?`../public/pixi-art/islets/${frame.art}.svg`:`../public/pixi-art/globe/${frame.theme??'home'}.svg`;
    const {data,info}=await sharp(new URL(relative,import.meta.url).pathname).resize(256,256,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    masks.set(frame,{data,width:info.width,height:info.height});
  }
  let seed=7;
  const next=createHeartLocations(WORLD_ISLANDS,mapOf,()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296),ISLETS,(frame,x,y)=>heartArtContains(frame,x,y,masks.get(frame)));
  for(let i=0;i<3000;i++){
    const {island,x,y}=next();assert.ok(heartArtContains(island,x,y,masks.get(island)),island.id);
  }
});

test('background screen drags rotate both axes continuously and reverse without drift',()=>{
  const q=new Quaternion();rotateGlobeFromScreen(q,100,0,800);
  assert.ok(q.angleTo(new Quaternion())>.3);
  rotateGlobeFromScreen(q,-100,0,800);assert.ok(q.angleTo(new Quaternion())<1e-7);
  rotateGlobeFromScreen(q,0,100,800);assert.ok(q.angleTo(new Quaternion())>.3);
  rotateGlobeFromScreen(q,0,-100,800);assert.ok(q.angleTo(new Quaternion())<1e-7);
});
