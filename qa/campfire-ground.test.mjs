import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {DOMParser} from '@xmldom/xmldom';
import {Path2D} from '@napi-rs/canvas';
const A='public/pixi-art/themes/community/',read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read('rive/web/themes/community/world.json'),plan=read('scripts/campfire-ground/ground-plan.json');
const parser=new DOMParser();
const tiles=art.ground.tiles.map(t=>({...t,svg:fs.readFileSync(A+t.src,'utf8')}));
const group=(root,kind)=>Array.from(root.getElementsByTagName('*')).find(n=>n.getAttribute('data-ground')===kind);
const sand=[253,228,140];
const pixels=new Map();
async function pixel(x,y){
 const t=tiles.find(t=>x>=t.x&&x<t.x+t.width&&y>=t.y&&y<t.y+t.height);
 if(!pixels.has(t.src))pixels.set(t.src,await sharp(Buffer.from(t.svg)).ensureAlpha().raw().toBuffer());
 const at=((y-t.y)*t.width+x-t.x)*4;return [...pixels.get(t.src).subarray(at,at+3)];
}
test('Campfire ground has one opaque Home sand union, only 128/104 route widths, and no raster streaming',()=>{
 assert.equal(art.raster.enabled,false);assert.deepEqual(world.pathWidths,plan.widths);assert(world.pathWidths.every(w=>w===128||w===104));
 assert.equal(plan.pathColor,'#fde48c');
 for(const t of tiles){
  assert.doesNotMatch(t.svg,/<(?:image|linearGradient|radialGradient|filter)\b|data:|rotate\(|skew[XY]?\(/i,t.src);
  assert.doesNotMatch(t.svg,/data-name="Footpaths"|hamlet-paving|roads-union/,t.src+' old path paint is gone');
  const doc=parser.parseFromString(t.svg,'image/svg+xml'),paths=Array.from(doc.getElementsByTagName('path')).filter(n=>n.getAttribute('data-ground')==='paths');
  assert(paths.length<=1,t.src+' only one merged floor');
  for(const p of paths){assert.equal(p.getAttribute('fill'),'#fde48c');assert.equal(p.getAttribute('stroke'),'');assert.equal(p.getAttribute('opacity'),'');assert.equal(p.getAttribute('fill-opacity'),'');}
  const water=group(doc,'water');if(water)for(const p of Array.from(water.getElementsByTagName('path'))){assert(['',art.sea,'none'].includes(p.getAttribute('fill')));assert(['','#fde48c','#fff0c7'].includes(p.getAttribute('stroke')),'no dark water contour');}
 }
});
test('Campfire closed circuit keeps lawn holes and crops keep the same floor at every tile boundary',()=>{
 const canonical=new Path2D(plan.paths);
 for(const p of [[4000,2650],[4000,-450],[3000,5500]])assert.equal(canonical.isPointInPath(...p),false,'lawn remains lawn at '+p);
 let checked=0;
 for(const t of tiles){
  const doc=parser.parseFromString(t.svg,'image/svg+xml'),path=group(doc,'paths');const actual=path?new Path2D(path.getAttribute('d')):new Path2D();
  for(const x of [t.x+.5,t.x+t.width-.5])for(let y=t.y+29;y<t.y+t.height;y+=47){assert.equal(actual.isPointInPath(x,y),canonical.isPointInPath(x,y),t.src+' vertical seam '+[x,y]);checked++;}
  for(const y of [t.y+.5,t.y+t.height-.5])for(let x=t.x+31;x<t.x+t.width;x+=53){assert.equal(actual.isPointInPath(x,y),canonical.isPointInPath(x,y),t.src+' horizontal seam '+[x,y]);checked++;}
 }
 assert(checked>5000);
});
test('Campfire paints the actual 104-unit lane in one colour without a centre stripe or edge band',async()=>{
 for(const x of [3950,3965,3980,4000,4020,4035,4050])assert.deepEqual(await pixel(x,250),sand,[x,250].join());
 assert.notDeepEqual(await pixel(3943,250),sand);assert.notDeepEqual(await pixel(4057,250),sand);
});
test('Campfire river core and both sea mouths use the exact sea fill with no mouth sill',async()=>{
 for(const [x,y]of [[-1200,3390],[-100,3230],[7800,3400],[9340,3800],[3000,490]]){
  assert.deepEqual(await pixel(x,y),[110,201,222],'open water '+[x,y]);
 }
});
test('Campfire retains its original lawn detail without added tufts, flowers or patches',async()=>{
 assert.deepEqual(plan.counts,{tuft:0,flower:0,patch:0});
 assert.deepEqual(plan.features,[]);
 for(const t of tiles)assert.doesNotMatch(t.svg,/lawn-detail|campfire-grass-tuft|campfire-flower-dot|#6d9236/i);
 const {composeGround}=await import('../scripts/campfire-ground/material.mjs');
 const source=fs.readFileSync('scripts/campfire-ground/source.svg','utf8');
 const before=parser.parseFromString(source,'image/svg+xml');
 const after=parser.parseFromString((await composeGround(source)).svg,'image/svg+xml');
 const children=n=>Array.from(n.childNodes??[]).filter(n=>n.nodeType===1);
 const original=children(children(before.documentElement)[6]);
 const retained=children(children(after.documentElement)[6]);
 assert.equal(retained.length,36);
 assert.deepEqual(retained.map(n=>n.getAttribute('d')),[...original.slice(0,35),original[39]].map(n=>n.getAttribute('d')));
 assert.deepEqual(children(retained.at(-1)).map(n=>n.getAttribute('d')),children(original[39]).map(n=>n.getAttribute('d')));
});
