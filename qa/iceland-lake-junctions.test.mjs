import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Path2D,PathOp,StrokeCap,StrokeJoin} from '@napi-rs/canvas';
import sharp from 'sharp';
import {LIP_WIDTH,pathSamples} from '../scripts/iceland-final/lake-junctions.mjs';
import {geometry} from '../assets/world/island-geometry.mjs';
import {onRink} from '../src/gameplay/rink-slide.js';
import {mapFor} from '../src/world/island-maps.js';
import {walkStep} from '../src/gameplay/player-motion.js';
const art=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const world=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));
const terrain=readFileSync('public/pixi-art/themes/snow/'+art.ground.vector,'utf8');
const landings=art.icelandFinal.lake.junctions,ice=world.iceland2.rink;
const attr=(tag,key)=>tag.match(new RegExp(`\\b${key}="([^"]+)"`))?.[1];
const unions=[...terrain.matchAll(/<path data-junction-union="true"[^>]+\/>/g)].map(m=>m[0]);
const blueTag=unions.find(p=>attr(p,'fill')==='#a6deec'),blue=new Path2D(attr(blueTag,'d'));
const routeTags=[...terrain.matchAll(/<path\b[^>]*stroke="#a6deec"[^>]*\/>/g)].map(m=>m[0]);
const lake=art.flats.find(p=>p.id==='rink'),lakeSVG=readFileSync('public/pixi-art/themes/snow/'+lake.src,'utf8');
const point=(l,depth,side=0)=>l.center.map((v,j)=>v-l.normal[j]*depth+[-l.normal[1],l.normal[0]][j]*side);

test('all five lake routes enter three shared flared mouths with one exterior outline',()=>{
 assert.equal(landings.length,3);
 assert.equal(world.iceland2.routes.filter(r=>r.ends.some(id=>world.iceland2.shores[id])).length,5);
 assert.equal(routeTags.length,world.iceland2.routes.length);
 assert.ok(!terrain.includes('<rect x="6399.252236043941"'),'retired rectangular rink knockout');
 const lakeBlue=lakeSVG.match(/<path id="lake-ice"[^>]+/)[0];
 assert.equal(attr(lakeBlue,'d'),attr(blueTag,'d'),'streamed lake cannot repaint an old shore across a mouth');
 for(const l of landings){
  assert.deepEqual(world.iceland2.shores[l.id],l.center);
  for(let depth=0;depth<=160;depth+=2)for(const side of [-l.width/2+10,0,l.width/2-10]){
   const p=point(l,depth,side);
   assert.ok(blue.isPointInPath(...p),l.id+' continuous visible ice '+p);
   assert.ok(onRink(ice,...p),l.id+' slide polygon starts at the mouth '+p);
  }
  for(const r of world.iceland2.routes.filter(r=>r.ends.includes(l.id))){
   const tag=routeTags[world.iceland2.routes.indexOf(r)];
   const route=new Path2D(attr(tag,'d')).stroke({width:r.width,cap:StrokeCap.Round,join:StrokeJoin.Round});
   const polygon=new Path2D('M'+ice.poly.map(p=>p.join(' ')).join('L')+'Z');
   assert.ok(route.op(polygon,PathOp.Intersect).toSVGString(),r.id+' path polygon must overlap lake ice');
   assert.deepEqual(r.samples[r.ends[0]===l.id?0:r.samples.length-1],l.center);
  }
 }
});

test('actual composed pixels have no snow band across any mouth, and both lips flare into the shore',async()=>{
 assert.equal(unions.length,3);
 for(const [color,width] of [['#eef3f9',LIP_WIDTH*2],['#d4dfec',4]]){
  const p=unions.find(p=>attr(p,'fill')===color);
  assert.equal(attr(p,'d'),attr(blueTag,'d'));assert.equal(+attr(p,'stroke-width'),width);
 }
 const walk=geometry(world).walkable;
 for(const l of landings){
  const x=l.center[0]-300,y=l.center[1]-300,W=600;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="${x} ${y} ${W} ${W}">${terrain}<g transform="translate(${lake.x} ${lake.y})">${lakeSVG}</g></svg>`;
  const {data}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let depth=0;depth<=160;depth+=2)for(const side of [-l.width/2+10,0,l.width/2-10]){
   const p=point(l,depth,side),i=(Math.floor(p[1]-y)*W+Math.floor(p[0]-x))*4;
   assert.deepEqual([...data.subarray(i,i+3)],[166,222,236],l.id+' snow gap at '+p);
   if(depth<=100)assert.ok(walk(...p),l.id+' blocked mouth corridor '+p);
  }
  const outer=new Path2D(blue).op(new Path2D(blue).stroke({width:20,join:StrokeJoin.Round}),PathOp.Union);
  const inner=new Path2D(blue).op(new Path2D(blue).stroke({width:8,join:StrokeJoin.Round}),PathOp.Union);
  const sides=[0,0];
  for(let py=0;py<W;py+=3)for(let px=0;px<W;px+=3){
   const p=[x+px+.5,y+py+.5];if(!outer.isPointInPath(...p)||inner.isPointInPath(...p))continue;
   const i=(py*W+px)*4;
   assert.ok(Math.abs(data[i]-238)<=2&&Math.abs(data[i+1]-243)<=2&&Math.abs(data[i+2]-249)<=2,l.id+' broken outer lip at '+p);
   const side=(p[0]-l.center[0])*-l.normal[1]+(p[1]-l.center[1])*l.normal[0];sides[side<0?0:1]++;
  }
  assert.ok(sides.every(n=>n>50),l.id+' both flared edge lips checked');
 }
});
