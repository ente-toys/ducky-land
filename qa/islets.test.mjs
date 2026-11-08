import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLETS,ISLET_ART,ISLET_SEED} from '../src/pixi/islets.js';
import {WORLD_ISLANDS,WORLD_GEO,neighboursOf} from '../src/pixi/world-map.js';
import {sphereShores} from '../src/pixi/sphere-shores.js';
import {angle,arcDistance,expMap,transport} from '../src/pixi/sphere.js';
import {localPoint,spherePoint} from '../src/pixi/sphere-coordinates.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {canSail,landingSpot,sailRoute,sailStep,BOAT_RADIUS,ISLANDS,seaBoundsFor} from '../src/pixi/islands.js';
import {fileURLToPath} from 'node:url';
import {createCanvas,loadImage} from '@napi-rs/canvas';
// boss 8 Nov: islets ~1.7x bigger (width up to 2400; the polar igloo stays 600-1400)
test('22 stable decorations use all eleven approved cut-outs twice, without adding landable islands',()=>{
 assert.equal(ISLET_SEED,831511);assert.equal(ISLETS.length,22);assert.equal(ISLANDS.length,13);
 assert.equal(new Set(ISLETS.map(i=>i.id)).size,22);
 for(const art of ISLET_ART)assert.equal(ISLETS.filter(i=>i.art===art).length,2);
 for(const i of ISLETS){assert.ok(i.width>=600&&i.width<=2400);assert.ok(Math.abs(i.lat)<72*Math.PI/180);if(Math.abs(i.lat)>60*Math.PI/180)assert.equal(i.art,'08-snow-igloo');}
 for(const i of ISLETS)for(const j of ISLETS)if(i!==j&&i.art===j.art)assert.ok(angle(i.center,j.center)*WORLD_GEO.Rw>8000);
});
test('entire islet footprints clear every actual coast by 900 and protect linked harbour corridors',()=>{
 const R=WORLD_GEO.Rw,shores=WORLD_ISLANDS.flatMap(i=>sphereShores(i));
 for(const i of ISLETS){
  for(const island of WORLD_ISLANDS){const p=localPoint(island.id,i.center);assert.equal(mapOf(island.id).landAt(p.x,p.y),false);}
  for(const s of shores){
   if((angle(i.center,s.center)-s.radius)*R>900+i.width*.71)continue;
   for(let k=0;k<s.points.length;k++)assert.ok(arcDistance(i.center,s.points[k],s.points[(k+1)%s.points.length])*R>=900+i.width*.71,i.id);
  }
  for(const a of WORLD_ISLANDS)for(const {island:b}of neighboursOf(a.id))if(a.id<b.id)assert.ok(arcDistance(i.center,spherePoint(a.id,mapOf(a.id).HARBOR.water),spherePoint(b.id,mapOf(b.id).HARBOR.water))*R>=650+i.width*.71,i.id);
 }
});
test('cut-outs have clear borders, preserved opaque interiors and no rejected neon art',async()=>{
 for(const art of ISLET_ART){
  assert.doesNotMatch(art,/neon|10-/);
  const image=await loadImage(fileURLToPath(new URL(`../public/pixi-art/islets/${art}.webp`,import.meta.url))),c=createCanvas(image.width,image.height),ctx=c.getContext('2d');ctx.drawImage(image,0,0);
  const {data:d}=ctx.getImageData(0,0,c.width,c.height);let solid=0,clear=0,soft=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const a=d[(y*c.width+x)*4+3];if(x<2||y<2||x>=c.width-2||y>=c.height-2)assert.equal(a,0,art);if(a===255)solid++;else if(a===0)clear++;else soft++;}
  assert.ok(solid>c.width*c.height*.15,art);assert.ok(clear>c.width*c.height*.12,art);assert.ok(soft>0,art);
 }
});
test('boat collision agrees in different island charts, and decorative islets never offer landing',()=>{
 for(const i of ISLETS)for(const island of WORLD_ISLANDS){
  const p=localPoint(island.id,i.collisionCenter);
  assert.equal(canSail(p.x,p.y,island.id),false,`${i.id}/${island.id}`);
  assert.equal(landingSpot({...p,islandId:island.id}),null,`${i.id} has no dock or walkable land`);
  const frame=transport(i,i.collisionCenter),out=localPoint(island.id,expMap(frame,i.radius+BOAT_RADIUS+80,0,WORLD_GEO.Rw));
  const b=seaBoundsFor(island.id);
  if(out.x>=b.x0&&out.x<=b.x1&&out.y>=b.y0&&out.y<=b.y1)assert.equal(canSail(out.x,out.y,island.id),true);
 }
});
test('route planner steers round an islet and manual sailing stops at its collision circle',()=>{
 const i=ISLETS[0],frame=transport(i,i.collisionCenter),id=WORLD_ISLANDS.reduce((a,b)=>angle(i.center,a.center)<angle(i.center,b.center)?a:b).id;
 const a=localPoint(id,expMap(frame,-1500,0,WORLD_GEO.Rw)),b=localPoint(id,expMap(frame,1500,0,WORLD_GEO.Rw));
 const route=sailRoute(id,a,b);assert.ok(route?.length>1,'direct line crosses solid islet');
 let last=a;for(const to of route){const steps=Math.ceil(Math.hypot(to.x-last.x,to.y-last.y)/12);for(let k=0;k<=steps;k++){const p={x:last.x+(to.x-last.x)*k/steps,y:last.y+(to.y-last.y)*k/steps};assert.ok(canSail(p.x,p.y,id));}last=to;}
 const actor={...a,islandId:id,mode:'sailing'},p=localPoint(id,i.collisionCenter),d=Math.hypot(p.x-a.x,p.y-a.y);
 for(let k=0;k<300;k++)sailStep(actor,.02,{x:(p.x-a.x)/d,y:(p.y-a.y)/d});
 assert.ok(canSail(actor.x,actor.y,id));assert.ok(Math.hypot(actor.x-p.x,actor.y-p.y)>i.radius);
});
