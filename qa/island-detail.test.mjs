import test from 'node:test';
import assert from 'node:assert/strict';
import {detailedIslands} from '../src/pixi/island-detail.js';
const islands=Array.from({length:20},(_,id)=>({id,width:5800,height:4400,x:(id%5-2)*6500,y:(Math.floor(id/5)-1)*5000}));
test('islands switch to live detail at overview zoom even when more than six are visible',()=>{
  const selected=detailedIslands(islands,{x:0,y:0,zoom:.04},1200,1344);
  assert.equal(selected.length,12);
  assert.ok(selected.some(i=>i.x===0&&i.y===0));
  assert.ok(selected.every(i=>i.width*.04>=150));
});
test('globe overview stays bounded and detailed rendering follows the explored island',()=>{
  assert.equal(detailedIslands(islands,{x:0,y:0,zoom:.015},1200,1344).length,0);
  const selected=detailedIslands(islands,{x:13000,y:10000,zoom:1},1200,1344);
  assert.equal(selected[0].x,13000);assert.equal(selected[0].y,10000);
  assert.ok(!selected.some(i=>i.x===0&&i.y===0));
});
