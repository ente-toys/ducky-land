import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {PALETTE} from '../src/pixi/palette.js';
const read=p=>JSON.parse(fs.readFileSync(p));
const base='public/pixi-art/themes/fair/',art=read(base+'art.json'),plan=read('scripts/bigger-fair/centre-source/sailing.json');
const sea='#'+PALETTE.water.toString(16).toUpperCase();
const terrain=fs.readFileSync(base+art.ground.tiles[0].src,'utf8');
const sites=[...plan.ring.filter((_,i)=>i%12===0),...plan.channels.flatMap(line=>line.filter((_,i)=>i%8===0)),...plan.lagoon.filter((_,i)=>i%8===0),...plan.lagoonChannel,[950,-310]];
const mouths=[[-2200,3320],[-2250,3200],[-2250,3580],[9400,1500],[9400,1750],[9400,2000]];
async function pixel(svg,x,y){
 const sample=svg.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="${x-.5} ${y-.5} 1 1">`);
 return [...(await sharp(Buffer.from(sample)).ensureAlpha().raw().toBuffer())];
}
test('Fair inland water colour equals Home sea, sharing its live wave/shimmer plane',async()=>{
 assert.equal(art.sea,sea);
 const engine=fs.readFileSync('src/pixi/engine.js','utf8');
 assert.ok(engine.includes("background: '"+sea+"'"));
 assert.ok(engine.includes("src:'/pixi-art/water-texture.svg'"));
 assert.ok(engine.includes('this.ocean.tilePosition.set('),'one world-registered animated texture');
 for(const [x,y] of sites){
  const p=await pixel(terrain,x,y);
  assert.equal(p[3],0,`water at ${x},${y} must expose the sea and its waves`);
  const filled=await sharp(Buffer.from(terrain.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="${x-.5} ${y-.5} 1 1">`))).flatten({background:sea}).raw().toBuffer();
  assert.deepEqual([...filled],[110,201,222],`inland == sea at ${x},${y}`);
 }
});
test('Fair mouths have no water overlay polygons on the sea, including fallback terrain',async()=>{
 for(const tile of art.ground.tiles){
  const svg=fs.readFileSync(base+tile.src,'utf8');
  assert.ok(!svg.includes('Fair water union'),tile.src+' cannot stamp an offshore fan');
  assert.ok(!/fill="#(?:7FD3D6|6EC9DE)"/i.test(svg),tile.src+' uses transparent water');
 }
 for(const p of mouths)assert.equal((await pixel(terrain,...p))[3],0,'no offshore overlay at '+p);
 const fallback=fs.readFileSync('public/pixi-art/globe/fair-ground.svg','utf8');
 for(const p of [...sites,...mouths].filter(([x,y])=>!art.decks.some(d=>x>d.x-30&&x<d.x+d.width+30&&y>d.y-30&&y<d.y+d.height+30))){
  const k=1024/art.width;
  assert.equal((await pixel(fallback,(p[0]-art.origin.x)*k,(p[1]-art.origin.y)*k))[3],0,'fallback water transparent at '+p);
 }
});
