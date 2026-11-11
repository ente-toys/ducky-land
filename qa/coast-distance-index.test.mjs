import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoastDistanceIndex} from '../src/pixi/coast-distance-index.js';
import {coastDistance,coastPolygons} from '../src/pixi/island-coasts.js';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';

test('indexed distances preserve exact coast clearance on all islands, including capped distances',()=>{
  let seed=48;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(const island of WORLD_ISLANDS){
    const m=mapOf(island.id),rings=coastPolygons(m.world,m.walk),distance=createCoastDistanceIndex(rings);
    const points=rings.flat().concat(Array.from({length:120},()=>[m.origin.x+(random()*1.6-.3)*m.width,m.origin.y+(random()*1.6-.3)*m.height]));
    for(const [x,y] of points){
      const exact=coastDistance(x,y,rings);
      for(const limit of [440,1500,Infinity])assert.ok(Math.abs(distance(x,y,limit)-Math.min(limit,exact))<1e-7,`${island.id}: ${x},${y}`);
    }
  }
});

test('empty, degenerate, concave and disjoint coasts retain the reference result',()=>{
  for(const rings of [[],[[[1,1]]],[[[0,0],[20,0],[20,0],[20,20],[10,10],[0,20]],[[40,40],[60,40],[60,60],[40,60]]]]){
    const distance=createCoastDistanceIndex(rings);
    for(let x=-10;x<=70;x+=5)for(let y=-10;y<=70;y+=5){
      const expected=coastDistance(x,y,rings),actual=distance(x,y);
      assert.ok(actual===expected||Math.abs(actual-expected)<1e-9);
    }
  }
});
