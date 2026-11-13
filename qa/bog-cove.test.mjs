import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/features/bog-combat/bog-environment.json' with {type:'json'};
import {makeMap} from '../src/world/island-maps.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';

const map=makeMap('bog-arena',data),nav=map.nav();

test('Lantern Cove trims the former blade tips while retaining both headlands',()=>{
 for(const [x,y] of [[3900,7980],[4700,7860]]){
  assert.equal(map.landAt(x,y),false,`former blade ${x},${y} is sea`);
  assert.equal(nav.walkable(x,y),false,`former blade ${x},${y} cannot be walked`);
 }
 for(const [x,y] of [[3700,7820],[4900,7670]]){
  assert.equal(map.landAt(x,y),true,`headland ${x},${y} remains`);
  assert.equal(nav.walkable(x,y),true,`headland ${x},${y} is accessible`);
 }
});

test('Lantern Cove keeps a 450-unit sailing corridor clear for full-size boats',()=>{
 for(let y=7560;y<=8400;y+=20)for(let x=4100;x<=4550;x+=30)
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   assert.equal(map.landAt(x+46*Math.cos(a),y+46*Math.sin(a)),false,`boat clearance ${x},${y}`);
  }
});

test('Lantern Cove client and authority agree on the rounded shore',()=>{
 for(let y=7580;y<=8100;y+=40)for(let x=3500;x<=5100;x+=40)
  assert.equal(nav.walkable(x,y),BOG_COMBAT.navigation.walkable(x,y),`shared shoreline ${x},${y}`);
});
