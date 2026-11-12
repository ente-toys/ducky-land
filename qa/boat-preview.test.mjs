import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMoorings,boatsForView} from '../src/rendering/pixi/boat-preview.js';
import {mapOf} from '../src/world/island-maps.js';
import {boatSpots} from '../src/gameplay/islands.js';
const island=(id,x,y)=>{const map=mapOf(id);return {id,x,y,width:map.width,height:map.height};};
test('local preview restores the island moorings with stable IDs and authored headings',()=>{
  const map=mapOf('home'),home=island('home',map.width/2,map.height/2);
  const preview=previewMoorings([home],{x:home.x,y:home.y,zoom:.05},1200,1344);
  assert.deepEqual(preview,boatSpots().map((spot,slot)=>({id:`home-${slot}`,islandId:'home',...spot,occupant:null,departure:'home'})));
});
test('preview boats follow other islands in world space and cull distant moorings',()=>{
  const other=island('isle-250',20000,-8000),home=island('home',2900,2200);
  const boats=previewMoorings([home,other],{x:other.x,y:other.y,zoom:.05},1200,1344);
  assert.ok(boats.length>0);assert.ok(boats.every(b=>b.islandId==='isle-250'));
  const first=boatSpots(other.id)[0];assert.equal(boats[0].x,other.x-other.width/2+first.x);assert.equal(boats[0].y,other.y-other.height/2+first.y);
});
test('real snapshots replace preview boats, including an intentionally empty fleet',()=>{
  const preview=()=>['preview'];assert.deepEqual(boatsForView({tick:-1},1,preview),['preview']);
  const room={tick:0,boatPoses:now=>{assert.equal(now,12);return [];}};
  assert.deepEqual(boatsForView(room,12,()=>{throw Error('preview replaced server data');}),[]);
});
