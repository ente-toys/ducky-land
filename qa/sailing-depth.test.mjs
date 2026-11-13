import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {Assets,Container,Sprite,Texture,TextureSource,DOMAdapter} from 'pixi.js';
import {blendBoatViews} from '../src/rendering/pixi/boat-blend.js';
import {prepareBoatViews} from '../src/rendering/pixi/boat-views.js';
const adapter=DOMAdapter.get();DOMAdapter.set({...adapter,createCanvas:()=>({getContext:()=>null})});
const hooks=registerHooks({load(url,context,next){if(url.endsWith('.json'))return {format:'module',source:`export default ${readFileSync(new URL(url),'utf8')}`,shortCircuit:true};return next(url,context);}});
const {createSailingFX}=await import('../src/rendering/pixi/sailing-fx.js');hooks.deregister();
const manifest=JSON.parse(readFileSync(new URL('../public/pixi-art/boat/views.json',import.meta.url)));

const pairs=buffer=>Array.from({length:buffer.count},(_,i)=>[buffer.keys[i],buffer.values[i]]);
test('reversal preserves displayed weights; a third target drops the weaker source',()=>{
 const s={};blendBoatViews(s,'f00',0,.08);blendBoatViews(s,'f01',.01,.08);blendBoatViews(s,'f01',.012,.08);
 const shown=new Map(pairs(s.weights));assert.ok(shown.get('f01')>0&&shown.get('f01')<.2);
 const reverse=new Map(pairs(blendBoatViews(s,'f00',.012,.08)));
 for(const [key,weight]of shown)assert.equal(reverse.get(key),weight);
 blendBoatViews(s,'f00',.03,.08);
 const next=blendBoatViews(s,'f02',.03,.08);
 assert.deepEqual(pairs(next),[['f00',1]]);
 assert.deepEqual(pairs(blendBoatViews(s,'f02',.2,.08)),[['f02',1]]);
});

test('a fast 360 keeps normalized coverage and settles without retaining old views',()=>{
 const s={};let now=0;const storage=blendBoatViews(s,'f00',now,.08),keys=storage.keys,values=storage.values;
 for(let i=1;i<480;i++){
  now+=1/120;const weights=blendBoatViews(s,`f${String(Math.floor(i/3)%48).padStart(2,'0')}`,now,.08);
  assert.equal(weights,storage);assert.equal(weights.keys,keys);assert.equal(weights.values,values);
  assert.ok(weights.count<=2);
  const active=values.subarray(0,weights.count);
  assert.ok(Math.abs(active.reduce((a,b)=>a+b)-1)<1e-12);
  assert.ok(active.every(v=>v>=.01&&v<=1));
 }
 const key=s.target;assert.deepEqual(pairs(blendBoatViews(s,key,now+.1,.08)),[[key,1]]);
});

test('cut and reduced-motion transitions clear every stale slot immediately',()=>{
 const s={};blendBoatViews(s,'f00',0,.08);blendBoatViews(s,'f01',.01,.08);blendBoatViews(s,'f01',.03,.08);
 assert.equal(s.weights.count,2);
 assert.deepEqual(pairs(blendBoatViews(s,'f38',.031,0)),[['f38',1]]);
 assert.equal(s.weights.keys[1],null);assert.equal(s.weights.values[1],0);assert.equal(s.blending,false);
 assert.deepEqual(pairs(blendBoatViews(s,'f05',.032,.08,true)),[['f05',1]]);
});

test('real sailing rig keeps all seats pinned under roll and bob with one opaque silhouette',async()=>{
 const fetchBefore=globalThis.fetch,loadBefore=Assets.load,nowBefore=performance.now;let now=1000;
 globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
 Assets.load=async request=>new Texture({label:request.src,source:new TextureSource({width:640,height:560})});
 performance.now=()=>now;
 const objects=new Container({sortableChildren:true}),water=new Container();
 try{
  const fx=await createSailingFX({water,objects}),root=new Container(),sprite=new Sprite();root.addChild(sprite);objects.addChild(root);root.zIndex=202;
  // Keep the real bank promotion and sailing geometry, replacing raster/GPU
  // work only. Pixel fidelity and packing are covered by boat-views.test.
  await prepareBoatViews(null,{buildAtlas:async()=>({source:new TextureSource({width:320,height:280}),width:320,height:280,
   frames:new Map(Object.values(manifest.views).flatMap(v=>[v.file,v.front,v.rigFront].filter(Boolean)).map(file=>[file,{x:0,y:0,w:320,h:280,left:0,top:0}]))})});
  const entry={root,sprite},boat={id:'b',x:100,y:200,occupant:'d',travel:0};
  const pose={id:'d',x:100,y:200,mode:'sailing',boatId:'b',travel:0};
  for(const [key,v] of Object.entries(manifest.views)){
   fx.forget('b');now+=19;const pin=fx.boat(entry,{...boat,turn:v.deg*Math.PI/180},false);fx.front(entry);
   const rider=fx.duck(pose,false);assert.equal(rider.x,100);assert.equal(rider.y,root.y);assert.equal(rider.z,214);assert.equal(entry.front.zIndex,216);assert.equal(rider.mask,null);
   assert.ok(Math.abs(root.rotation)>1e-6,'roll is enabled');assert.ok(Math.abs(root.y-150)>1e-6,'bob is enabled');
   for(const layer of [entry.layers.get(key).boat,entry.layers.get(key).front]){
    const seat=layer.parent.toGlobal({x:layer.x+v.seat[0],y:layer.y+v.seat[1]});assert.ok(Math.hypot(seat.x-pin.x,seat.y-pin.y)<1e-8,key);
   }
  }
  fx.forget('b');fx.boat(entry,{...boat,turn:-Math.PI},false);
  const visited=new Set(),activeBuffer=entry.activeLayers;
  let filterWrites=0;
  const track=node=>{let proto=node,descriptor;
   while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'filters');proto=Object.getPrototypeOf(proto);}
   Object.defineProperty(node,'filters',{get(){return descriptor.get.call(this);},set(value){filterWrites++;descriptor.set.call(this,value);}});
  };track(root);track(entry.front);
  for(let i=0;i<480;i++){
   now+=1000/120;const pin=fx.boat(entry,{...boat,turn:Math.PI/2-i*Math.PI/60},false);fx.front(entry);
   const layers=[...entry.layers.values()].filter(l=>l.boat.visible);
   assert.equal(layers.length,1);assert.equal(entry.activeLayers,activeBuffer);assert.equal(entry.activeCount,1);
   assert.ok(!root.filters?.length);assert.ok(!entry.front.filters?.length);
   assert.equal(layers[0].boat.alpha,1);assert.equal(layers[0].front.alpha,1);
   assert.equal(entry.front.visible,root.visible);
   for(const [key,l] of entry.layers){if(!l.front.visible)continue;
    visited.add(key);assert.equal(l.front.blendMode,'normal');
    const v=manifest.views[key],p=l.front.parent.toGlobal({x:l.front.x+v.seat[0],y:l.front.y+v.seat[1]});
    assert.ok(Math.hypot(p.x-pin.x,p.y-pin.y)<1e-8,'rear foreground uses the same roll pivot');
   }
  }
  assert.equal(filterWrites,0,'no filter writes during cut turns');
  assert.ok(visited.size>35,'fast turns exercise most sectors');fx.dispose();
 }finally{globalThis.fetch=fetchBefore;Assets.load=loadBefore;performance.now=nowBefore;objects.destroy({children:true});water.destroy({children:true});}
});
