import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {archBridge,BRIDGE_SILLS} from '../scripts/bigger-fair/arch.mjs';
import {geometry,inShape} from '../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const world=read('rive/web/themes/fair/world.json'),art=read('public/pixi-art/themes/fair/art.json');
test('all 12 Fair decks are unsheared Home Honeywood arches, with matching endpoints and crown',()=>{
 assert.equal(world.walkways.length,12);assert.equal(art.decks.length,12);
 for(const bridge of world.walkways){
  const model=archBridge(bridge),deck=art.decks.find(d=>d.id===bridge.id),arch=world.arches.find(b=>b.id===bridge.id);
  assert.equal(fs.readFileSync('public/pixi-art/themes/fair/'+deck.src,'utf8'),model.svg);
  assert.equal(deck.overBoats,true);assert.equal(bridge.boatPassUnder,true);assert.equal(arch.r,model.crown);
  const [sx,shearY,shearX,sy,x,y]=model.transform;
  assert.equal(shearX,0);assert.equal(shearY,0);
  if(model.dir==='ns')assert.equal(sx,1);else if(model.dir==='ew')assert.equal(sy,1);else {assert.equal(sx,1);assert.equal(sy,1);}
  const ends=BRIDGE_SILLS[model.dir].map(([px,py])=>[px*sx+x,py*sy+y]);
  for(const p of [bridge.a,bridge.b])assert.ok(ends.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1e-6),bridge.id+' exact visible landing');
  assert.ok(model.svg.includes('#39472d'));assert.ok(model.svg.includes('#c88941'));assert.ok(!model.svg.includes('#F4A7B9'));assert.ok(!/gradient|matrix\(|rotate\(/i.test(model.svg));
 }
});
test('diagonal bridge physics follows its deck polygon and blocks the bounding-box water corners',()=>{
 const nav=geometry(world);
 for(const b of world.bridges.filter(b=>b.poly)){
  assert.ok(nav.walkable(b.x,b.y),b.id+' deck centre');
  const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>[b.x+x*(b.w/2-15),b.y+y*(b.h/2-15)]);
  const wet=corners.filter(p=>world.water.some(w=>inShape(...p,w,20))&&!inShape(...p,b));
  assert.ok(wet.length,b.id+' has wet corners');for(const p of wet)assert.equal(nav.walkable(...p),false,b.id+' no invisible rectangular deck');
 }
});
