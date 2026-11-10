import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {snowPose,SNOW_POOL_SIZE,SNOW_PHONE_COUNT} from '../src/pixi/snowfall.js';
const w=JSON.parse(readFileSync('rive/web/themes/snow/world.json'));
const art=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json'));
const r=w.iceland2.rink;
// Signed distance to the exact rounded rectangle painted as rink ice.
function rimDistance(x,y){const qx=Math.abs(x-r.x-r.width/2)-(r.width/2-r.radius),qy=Math.abs(y-r.y-r.height/2)-(r.height/2-r.radius);return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-r.radius;}
test('FIX2 every fence foot and curved rail baseline follows the actual ice rim',()=>{
 assert.ok(r.posts.length>20);
 for(const [x,y]of [...r.posts,...r.rails.flat()])assert.ok(Math.abs(rimDistance(x,y))<.03,`rim drift ${x},${y}`);
 // Rail samples cannot cross any gate opening, including the wrapped west run.
 for(const [name,[x,y]]of Object.entries(w.iceland2.gates))for(const line of r.rails)for(const p of line)assert.ok(Math.hypot(p[0]-x,p[1]-y)>=r.gateWidth/2-.1,name+' blocked');
});
test('FIX2 every gate has a real terminating approach and no route crosses the ice',()=>{
 for(const [name,point]of Object.entries(w.iceland2.gates)){
  const routes=w.iceland2.routes.filter(route=>route.ends.includes(name));assert.ok(routes.length,name+' no approach');
  for(const route of routes){const endpoint=route.ends[0]===name?route.samples[0]:route.samples.at(-1);assert.deepEqual(endpoint,point);}
 }
 assert.ok(!w.iceland2.routes.some(route=>/square$/.test(route.id)&&route.id!=='square'));
 for(const route of w.iceland2.routes)for(const [x,y]of route.samples)assert.ok(rimDistance(x,y)>-.03,route.id+' enters ice');
});
test('FIX2 rendered path polygons leave the ice clear and land flush at each gate',async()=>{
 const terrain=readFileSync('public/pixi-art/themes/snow/v2/terrain.svg','utf8');
 assert.ok(!terrain.includes('#fde48c'));assert.ok(terrain.includes('#a6deec'));
 const pad=150,W=Math.ceil(r.width+pad*2),H=Math.ceil(r.height+pad*2);
 const svg=terrain.replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${W}" height="${H}" viewBox="${r.x-pad} ${r.y-pad} ${W} ${H}"`);
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const blue=(x,y)=>{const at=(Math.floor(y-r.y+pad)*info.width+Math.floor(x-r.x+pad))*4;return Math.abs(data[at]-166)<3&&Math.abs(data[at+1]-222)<3&&Math.abs(data[at+2]-236)<3;};
 for(let y=r.y+3;y<r.y+r.height;y+=5)for(let x=r.x+3;x<r.x+r.width;x+=5)if(rimDistance(x,y)<-3)assert.equal(blue(x,y),false,'path under ice');
 for(const [name,[x,y]]of Object.entries(w.iceland2.gates)){const dx=name==='west-gate'?-1:0,dy=name==='north-gate'?-1:name==='south-gate'?1:0;for(const d of [2,20,60,100])assert.ok(blue(x+dx*d,y+dy*d),name+' missing landing '+d);}
});
test('FIX2 groves fill the expanded land with Home plants at requested density',()=>{
 const trees=art.props.filter(p=>p.id.includes('-tree-')),bushes=art.props.filter(p=>p.id.startsWith('bush'));
 assert.ok(trees.length>=250&&trees.length<=280,trees.length);assert.ok(bushes.length>=160&&bushes.length<=185,bushes.length);
 for(const p of [...trees,...bushes])assert.ok(rimDistance(p.x,p.y)>100,p.id+' crowds rink');
});
test('FIX2 visible snowfall has three stable parallax sizes on desktop and phone',()=>{
 assert.ok(SNOW_POOL_SIZE>=120&&SNOW_POOL_SIZE<=160);assert.ok(SNOW_PHONE_COUNT>=60&&SNOW_PHONE_COUNT<=80);
 for(const count of [SNOW_POOL_SIZE,SNOW_PHONE_COUNT]){const sizes=new Set();for(let i=0;i<count;i++){const a=snowPose(i,0,390,844),b=snowPose(i,.1,390,844);sizes.add(a.size);assert.ok(a.y-a.size/2>=80&&a.y+a.size/2<=764);assert.ok(Math.abs(a.x-b.x)<1);assert.equal(a.size,b.size);}assert.equal(sizes.size,3);assert.ok([...sizes].some(s=>s>=10&&s<=12));assert.ok([...sizes].some(s=>s>=6&&s<=8));assert.ok([...sizes].some(s=>s>=3&&s<=4));}
});
