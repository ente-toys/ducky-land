import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {geometry,inShape} from '../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const walk=read('rive/web/themes/cathedral/walk-world.json'),art=read('public/pixi-art/themes/cathedral/art.json');
const geo=read('scripts/bigger-cathedral/fix-water.json'),g=geometry(walk);
test('Every retained Cathedral deck has water underneath and supports walking',()=>{
 for(const [name,x,y]of [['north pier',3000,700],['west pier',750,3330],['east pier',7250,3150],['south pier',4100,5300],['olive arch',1425,1590],['garden arch',6220,4615],['pond arch',1770,3310]]){
  assert.ok(walk.water.some(o=>inShape(x,y,o)),name+' must span real water');
  assert.ok(g.walkable(x,y),name+' must support ducks');
 }
});
test('Cathedral streams block walking in water and all new road decks support their span',()=>{
 for(const [x,y]of [[1880,250],[1710,500],[7150,4350],[6940,4700]]){
  assert.ok(walk.water.some(o=>inShape(x,y,o)),`stream is wet at ${x},${y}`);
  assert.equal(g.walkable(x,y),false,`stream is not walkable at ${x},${y}`);
 }
 const crossings=read('scripts/bigger-cathedral/water-geometry.json').bridges;
 for(const c of crossings){
  assert.ok(art.decks.some(d=>d.id==='bellovo-'+c.id));
  for(let i=0;i<=20;i++){const p=c.a.map((v,k)=>v+(c.b[k]-v)*i/20);assert.ok(g.walkable(...p),c.id+' has a continuous supported deck');}
 }
});
