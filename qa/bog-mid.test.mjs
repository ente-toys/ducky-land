import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../src/pixi/bog-environment.json' with {type:'json'};
import {makeMap} from '../src/pixi/island-maps.js';
const nav=makeMap('bog-mid-check',data).nav();
test('Mid hall doorstep, open centre and both cover bypasses stay connected',()=>{
 for(const [x,y] of [[4200,1940],[4200,2170],[4200,2500],[3900,2330],[4500,2330],[3500,2390],[4900,2390],[3650,1940],[4735,1940]]){
  assert.ok(nav.walkable(x,y),`Mid lane ${x},${y}`);
  assert.ok(nav.route(4200,2800,x,y).length,`Mid connected ${x},${y}`);
 }
});
