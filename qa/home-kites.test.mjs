import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
import sites from '../src/rendering/pixi/environment/home-kites.json' with {type:'json'};
import routes from '../src/world/home/home-routes.json' with {type:'json'};
import paths from '../src/world/home/paths.json' with {type:'json'};
import {HOME_MAP} from '../src/world/island-maps.js';
import {inShape} from '../assets/world/island-geometry.mjs';
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
test('13 non-blocking Home kites have clear lawn stakes and reachable walking approaches',()=>{
 assert.equal(sites.length,13);assert.equal(new Set(sites.map(s=>s.colour)).size,6);
 const nav=HOME_MAP.nav();
 for(const s of sites){
  for(const dx of [-100,0,100])for(const dy of [-100,0,100])assert.ok(nav.walkable(s.x+dx,s.y+dy),s.id+' clear lawn');
  assert.ok(!HOME_MAP.walk.water.some(w=>inShape(s.x,s.y,w,80)),s.id+' away from water');
  assert.ok(!HOME_MAP.walk.obstacles.some(w=>w.id===s.id),'stake adds no collision');
  assert.deepEqual(nav.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,s.x,s.y).at(-1),[s.x,s.y],s.id+' reachable');
  for(const r of routes)for(let i=1;i<r.samples.length;i++)assert.ok(segmentDistance(s.x,s.y,r.samples[i-1],r.samples[i])>=r.width/2+90,s.id+' off paths');
  for(const r of paths)for(let i=1;i<r.length;i++)assert.ok(segmentDistance(s.x,s.y,r[i-1],r[i])>=160,s.id+' off original paths');
 }
});
test('kite flight keeps both string endpoints attached, independently phased and completely still with reduced motion',async()=>{
 const v=await createServer({configFile:false,cacheDir:'/tmp/home-kites-test-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
 try{
  const {kitePose,createHomeKites,KITE_ASSETS}=await v.ssrLoadModule('/src/rendering/pixi/environment/home-kites.js');
  const {Container,Texture}=await v.ssrLoadModule('pixi.js');
  const parent=new Container(), textures=Object.fromEntries(KITE_ASSETS.map(src=>[src,Texture.WHITE]));
  const kites=createHomeKites(parent,textures), pose={};
  for(let t=0;t<25;t+=.11){
   kites.update(t,false,()=>true);
   for(const e of kites.entries){
    assert.ok(Math.abs(e.string.scale.x*100-e.flying.x)<1e-9);
    assert.ok(Math.abs(-17-e.string.scale.y*200-e.flying.y)<1e-9);
    assert.equal(e.string.x,0);assert.equal(e.root.x,e.site.x);assert.equal(e.root.y,e.site.y);
    assert.ok(Math.abs(e.flying.x-e.site.lean)<=13.001);
   }
  }
  for(const s of sites){const a={...kitePose(s,0,true,pose)};assert.equal(kitePose(s,99,true,pose),pose);assert.deepEqual(pose,a);}
  kites.update(0,true,()=>true);const still=kites.entries.map(e=>[e.flying.x,e.flying.y,e.flying.rotation,e.tailA.rotation,e.tailB.rotation]);
  kites.update(123,true,()=>true);assert.deepEqual(kites.entries.map(e=>[e.flying.x,e.flying.y,e.flying.rotation,e.tailA.rotation,e.tailB.rotation]),still);
  assert.equal(new Set(sites.map(s=>s.phase)).size,sites.length);
  kites.update(1,false,()=>true,false);assert.ok(kites.entries.every(e=>!e.root.visible));
  parent.destroy({children:true});
  for(const src of KITE_ASSETS){const svg=readFileSync(new URL('../public'+src,import.meta.url),'utf8');assert.ok(svg.includes('#39472d'));assert.ok(!/gradient|<image/i.test(svg));}
 }finally{await v.close();}
});
