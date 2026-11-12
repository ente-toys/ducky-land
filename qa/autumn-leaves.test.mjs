import test from 'node:test';
import assert from 'node:assert/strict';
import {autumnLeafPose,createAutumnLeafPool} from '../src/rendering/pixi/environment/autumn-leaf-motion.js';
const tree={x:100,y:500,width:260,height:360,scale:1};
const sprite=()=>({visible:false,position:{set(x,y){this.x=x;this.y=y;}},scale:{set(v){this.x=this.y=v;}},destroy(){this.destroyed=true;}});
test('SVG leaf cycle sways and spins, settles, fades and restarts without drifting beyond its grove',()=>{
 const points=Array.from({length:80},(_,i)=>autumnLeafPose(tree,i/10,0));
 assert.ok(points.some(p=>p.settled));assert.ok(points.some(p=>p.alpha<.3));
 for(const p of points){assert.ok(p.x>tree.x-tree.width*.5&&p.x<tree.x+tree.width*.5);assert.ok(p.y<=tree.y+3.01);assert.ok(p.alpha>=0&&p.alpha<=1);}
 assert.ok(new Set(points.map(p=>p.rotation.toFixed(2))).size>15);
 const settled=points.filter(p=>p.settled);assert.ok(settled.every(p=>p.y===settled[0].y&&p.rotation===settled[0].rotation));
 const a=autumnLeafPose(tree,1,0),b=autumnLeafPose(tree,8.8,0);for(const k of ['x','y','rotation','alpha'])assert.ok(Math.abs(a[k]-b[k])<1e-9);
});
test('Phone pool stays bounded, has three leaves per near tree, recycles across the island, stops for reduced motion',()=>{
 const trees=Array.from({length:300},(_,i)=>({...tree,x:i*100,y:0}));let allocations=0;
 const pool=createAutumnLeafPool(trees,()=>{allocations++;return sprite();},{mobile:true});
 pool.update(0,false,()=>true,{x:0,y:0,zoom:1});assert.equal(allocations,48);assert.equal(pool.stats.active,48);assert.equal(pool.stats.trees,16);
 const initial=pool.slots[0].tree;
 for(let i=1;i<3600;i++)pool.update(i/60,false,()=>true,{x:i*4,y:0,zoom:1});
 assert.equal(allocations,48);assert.notEqual(pool.slots[0].tree,initial);
 assert.ok(pool.slots.every(s=>!s.tree||Math.abs(s.tree.x-14396)<1800));
 pool.update(61,true,()=>true,{x:0,y:0,zoom:1});assert.equal(pool.stats.active,0);
 pool.update(62,false,()=>true,{x:0,y:0,zoom:.1});assert.equal(pool.stats.active,0);
 pool.update(63,false,()=>true,{x:0,y:0,zoom:1,shown:false});assert.equal(pool.stats.active,0);
 pool.update(64,false,()=>false,{x:0,y:0,zoom:1});assert.equal(pool.stats.active,0);
 pool.destroy();assert.ok(pool.slots.every(s=>s.sprite.destroyed));
});

test('The real theme loader acquires four SVG leaves once and disposes the entire leaf layer with the island',async t=>{
 const {readFileSync}=await import('node:fs');
 const {Texture,DOMAdapter}=await import('pixi.js');
 const adapter=DOMAdapter.get();
 DOMAdapter.set({...adapter,createCanvas:()=>({getContext:()=>null})});
 t.after(()=>DOMAdapter.set(adapter));
 const {loadThemeArt}=await import('../src/rendering/pixi/art/theme-art.js');
 const {createGroundPool}=await import('../src/rendering/pixi/art/ground-stream.js');
 const manifest=JSON.parse(readFileSync('public/pixi-art/themes/cathedral/art.json'));
 const original=globalThis.fetch;globalThis.fetch=async url=>({ok:true,json:async()=>url.endsWith('art.json')?manifest:{pieces:[]}});
 t.after(()=>{globalThis.fetch=original;});
 const leases=[],released=[],groundPool=createGroundPool({acquire:async()=>Texture.EMPTY,release(){}});
 t.after(()=>groundPool.destroy());
 const art=await loadThemeArt({id:'cathedral',art:'/pixi-art/themes/cathedral/art.json',origin:{x:-2200,y:-2400},width:12800,height:10400},{groundPool,acquire:async src=>{leases.push(src);return Texture.EMPTY;},release:src=>released.push(src)});
 const pool=art.autumnLeaves;assert.equal(pool.stats.created,96);assert.equal(art.groups.includes(pool.layer),true);assert.equal(pool.layer.visible,false);
 const leafSources=leases.filter(s=>/autumn\/leaf-/.test(s));assert.equal(leafSources.length,4);
 pool.update(2,false,()=>true,{x:0,y:1000,zoom:.8});assert.ok(pool.stats.active>0);
 pool.update(3,true,()=>true,{x:0,y:1000,zoom:.8});assert.equal(pool.stats.active,0);
 const water=art.fountainWaters[0];assert.ok(art.groups.includes(water.root));
 const buffers=[...water.surface.geometry.buffers];
 art.destroy();art.destroy();assert.ok(pool.layer.destroyed);assert.ok(pool.slots.every(s=>s.sprite.destroyed));
 for(const resource of [water.root,water.layer,water.graphics,water.surface.mesh,water.surface.heights,water.surface.clip,...buffers])assert.ok(resource.destroyed,'fountain resource released before mounting');
 assert.equal(water.surface.geometry.buffers,null);
 assert.equal(released.length,leases.length);
 for(const src of leafSources)assert.equal(released.filter(s=>s===src).length,1);
});
