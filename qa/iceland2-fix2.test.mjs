import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {inPoly} from '../assets/world/island-geometry.mjs';
import {snowPose,SNOW_POOL_SIZE,SNOW_PHONE_COUNT} from '../src/pixi/snowfall.js';
const w=JSON.parse(readFileSync('assets/world/themes/snow/world.json'));
const art=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const r=w.iceland2.rink;
// Signed distance to the shared irregular ice outline.
function rimDistance(x,y){let d=Infinity;for(let i=0;i<r.poly.length;i++){const a=r.poly[i],b=r.poly[(i+1)%r.poly.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));}return inPoly(x,y,r.poly)?-d:d;}
test('FIX2 natural lake has a curved continuous shore without fence posts or rails',()=>{
 assert.equal(r.type,'natural-lake');assert.ok(r.poly.length>200);
 assert.equal(r.posts,undefined);assert.equal(r.rails,undefined);
 assert.ok(!art.props.some(p=>/^rink-fence/.test(p.id)));
});
test('FIX2 every shore path meets its lake mouth and the remaining network stays on snow',()=>{
 for(const [name,point]of Object.entries(w.iceland2.shores)){
  const routes=w.iceland2.routes.filter(route=>route.ends.includes(name));assert.ok(routes.length,name+' no approach');
  for(const route of routes){const endpoint=route.ends[0]===name?route.samples[0]:route.samples.at(-1);assert.deepEqual(endpoint,point);}
 }
 assert.ok(!w.iceland2.routes.some(route=>/square$/.test(route.id)&&route.id!=='square'));
 for(const route of w.iceland2.routes.filter(r=>!r.ends.some(id=>w.iceland2.shores[id])))for(const [x,y]of route.samples)assert.ok(rimDistance(x,y)>-.03,route.id+' enters ice');
});
test('FIX2 rendered paths and lake form one continuous ice surface',async()=>{
 const terrain=readFileSync('public/pixi-art/themes/snow/v2/terrain.svg','utf8');
 assert.ok(!terrain.includes('#fde48c'));assert.ok(terrain.includes('#a6deec'));
 const pad=300,W=Math.ceil(r.width+pad*2),H=Math.ceil(r.height+pad*2);
 const svg=terrain.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${W}" height="${H}" viewBox="${r.x-pad} ${r.y-pad} ${W} ${H}"`);
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const blue=(x,y)=>{const at=(Math.floor(y-r.y+pad)*info.width+Math.floor(x-r.x+pad))*4;return Math.abs(data[at]-166)<3&&Math.abs(data[at+1]-222)<3&&Math.abs(data[at+2]-236)<3;};
 for(let y=r.y+3;y<r.y+r.height;y+=5)for(let x=r.x+3;x<r.x+r.width;x+=5)if(rimDistance(x,y)<-3)assert.equal(blue(x,y),true,'continuous lake ice');
 for(const [name,[x,y]]of Object.entries(w.iceland2.shores)){const dx=name==='west-shore'?-1:0,dy=name==='north-shore'?-1:name==='south-shore'?1:0;for(const d of [2,20,60,100])assert.ok(blue(x+dx*d,y+dy*d),name+' missing landing '+d);}
});
test('FIX2 groves fill the expanded land with Home plants at requested density',()=>{
 const trees=art.props.filter(p=>p.id.includes('-tree-')),bushes=art.props.filter(p=>p.finalKind==='shrub');
 assert.ok(trees.length>=510&&trees.length<=560,trees.length);assert.ok(bushes.length>=20&&bushes.length<80,bushes.length); // Q3 counts whole groves and camps, with calm snow between.
 for(const p of [...trees,...bushes])assert.ok(rimDistance(p.x,p.y)>40,p.id+' crowds lake');
});
test('FIX2 visible snowfall has 180/90 pooled flakes and three stable parallax sizes',()=>{
 assert.equal(SNOW_POOL_SIZE,180);assert.equal(SNOW_PHONE_COUNT,90);
 for(const count of [SNOW_POOL_SIZE,SNOW_PHONE_COUNT]){
  const sizes=new Set();let top=0,bottom=0;
  for(let i=0;i<count;i++){
   const a=snowPose(i,0,390,844),b=snowPose(i,.1,390,844);sizes.add(a.size);
   assert.ok(a.y>=-48&&a.y<892);assert.ok(Math.abs(a.x-b.x)<2);assert.equal(a.size,b.size);
   if(a.y<80)top++;if(a.y>764)bottom++;
  }
  assert.equal(sizes.size,3);assert.ok(sizes.has(8)&&sizes.has(5)&&sizes.has(2.5));
  assert.ok(top&&bottom,'snow traverses the full view rather than a middle band');
 }
});
