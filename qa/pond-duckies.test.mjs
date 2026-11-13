import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Texture} from 'pixi.js';
import {loadPondDuckies,PONDS,samplePondDucky} from '../src/rendering/pixi/environment/pond-duckies.js';
import {inShape} from '../assets/world/island-geometry.mjs';
import {populatePond,requestedPondCount} from '../scripts/pond-duckies/populate.mjs';
const assets=JSON.parse(fs.readFileSync('src/rendering/pixi/environment/pond-regions.json')).assets;
const expected={home:5,sunflower:1,pink:3,library:2,community:1,bog:0,snow:0};
const pose=()=>({x:0,y:0,dx:0,dy:0,moving:false});

test('all 12 authored ponds have two or three distinct Duckies, roughly half have three, and all seven variants are used',()=>{
 assert.equal(PONDS.length,12);
 const variants=new Set();
 for(const [island,count] of Object.entries(expected))assert.equal(PONDS.filter(p=>p.island===island).length,count,island);
 for(const p of PONDS){assert([2,3].includes(p.duckies.length));assert.equal(new Set(p.duckies.map(d=>d.name)).size,p.duckies.length);assert.equal(p.motion.tracks.length,p.duckies.length);assert.equal(p.motion.seeds.length,p.duckies.length);assert(p.source);assert(p.cells.length>=8);p.duckies.forEach(d=>variants.add(d.name));}
 const triples=PONDS.filter(p=>p.duckies.length===3).length;
 assert(triples>=4&&triples<=8,`${triples}/12 ponds have three`);
 assert.equal(variants.size,7);
});

test('ten minutes of continuous travel, arbitrary UTC offsets and cycle boundaries stay in water and clear of shores, props and each other',()=>{
 for(const p of PONDS){
  const cells=new Set(p.cells),positions=p.duckies.map(pose),visited=p.duckies.map(()=>new Set());
  for(const offset of [0,1794326400])for(let tick=0;tick<=1200;tick++){
   const time=offset+tick*.5;
   positions.forEach((v,i)=>samplePondDucky(p,i,time,false,v));
   for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){
    const a=positions[i],b=positions[j],width=p.duckies[i].width+p.duckies[j].width,gx=width/2+18,gy=width*.17+14;
    assert(Math.hypot((a.x-b.x)/gx,(a.y-b.y)/gy)>1.15,`${p.island}/${p.id}: ${i}/${j} separated at ${time}`);
   }
   for(const [i,v] of positions.entries()){
    const cell=Math.round((v.y-p.origin[1])/p.step)*p.cols+Math.round((v.x-p.origin[0])/p.step);
    assert(cells.has(cell),`${p.id}: open-water region at ${time}`);visited[i].add(cell);
    assert(p.shapes.some(s=>inShape(v.x,v.y,s)),p.id+' above water');
    if(tick%4===0)for(let k=0;k<16;k++){
     const angle=k*Math.PI/8,x=v.x+Math.cos(angle)*p.radius,y=v.y+Math.sin(angle)*p.radiusY;
     assert(p.shapes.some(s=>inShape(x,y,s)),p.id+' clears painted shore');
    }
    for(const solid of p.blockers)assert(!inShape(v.x,v.y,{...solid,rx:solid.rx+p.radius,ry:solid.ry+p.radiusY}),p.id+' clears dock/support/lily');
   }
  }
  for(const [i,n] of visited.entries())assert(n.size>3,p.island+'/'+p.id+'/'+i+' actually paddles around: '+n.size);
  for(let i=0;i<p.duckies.length;i++){
   const first=samplePondDucky(p,i,0,false,pose()),end=samplePondDucky(p,i,p.motion.period-.001,false,pose());
   assert(Math.hypot(first.x-end.x,first.y-end.y)<.1,p.id+' seamless closed itinerary');
   for(const s of p.motion.tracks[i]){assert(s.hold>=2&&s.hold<=6);assert(s.length/s.duration*1.5*.65<12.1,p.id+' lazy peak speed');}
  }
 }
});

test('seeded counts, variants and plans reproduce for every pond, independent of inventory order',()=>{
 for(const p of PONDS){
  assert.deepEqual(populatePond(p,assets),p,p.island+'/'+p.id);
  assert.deepEqual(populatePond(p,assets.toReversed()),p,p.island+'/'+p.id+' second run');
 }
});

test('a small pond seeded for three falls back to two when three cannot keep clearance',()=>{
 const p={...PONDS.find(p=>p.id==='millhead'),island:'fixture',id:'small',origin:[0,0],cols:16,rows:1,cells:Array.from({length:16},(_,i)=>i)};
 for(let i=0;requestedPondCount(p)!==3;i++)p.id='small-'+i;
 const planned=populatePond(p,assets);
 assert.equal(requestedPondCount(p),3);assert.equal(planned.duckies.length,2);
 assert.deepEqual(populatePond(p,assets),planned);
});

test('reduced motion keeps every Ducky position fixed',()=>{
 for(const p of PONDS)for(let i=0;i<p.duckies.length;i++){
  const a=samplePondDucky(p,i,0,true,pose());
  for(const t of [1,21,600,10000000]){const b=samplePondDucky(p,i,t,true,pose());assert.equal(b.x,a.x);assert.equal(b.y,a.y);assert.equal(b.moving,false);}
 }
});

test('every keeper and its archived ripple art is clean flat SVG',()=>{
 for(const name of new Set(PONDS.flatMap(p=>p.duckies.map(d=>d.name))))for(const suffix of ['',...['duck','ripple'].map(p=>'/'+p)]){
  const path=suffix?`public/pixi-duck/float/parts/${name}-${suffix.slice(1)}.svg`:`public/pixi-duck/float/${name}.svg`;
  const svg=fs.readFileSync(path,'utf8');assert(svg.startsWith('<svg'));assert(!/Gradient|<image\b|filter=|data:image|\.png/i.test(svg));assert(svg.length<16000);
  if(!suffix)assert(svg.includes('#232323'));
  assert(!svg.includes('#39472d'),'boss Ducky black stays #232323');
 }
});

test('runtime owns every assigned Ducky, pauses hidden layers and releases all water FX and leases on leave',async()=>{
 const leased=[],released=[];
 const layer=await loadPondDuckies('home',{acquire:async src=>{leased.push(src);return Texture.EMPTY;},release:src=>released.push(src)});
 assert.equal(layer.entries.length,PONDS.filter(p=>p.island==='home').reduce((n,p)=>n+p.duckies.length,0));assert(leased.every(s=>s.endsWith('-duck.svg')));
 assert(!leased.some(s=>s.includes('-ripple.svg')),'traced water sprites are never loaded');
 for(const p of PONDS.filter(p=>p.island==='home'))assert.equal(layer.entries.filter(e=>e.pond===p).length,p.duckies.length);
 layer.root.visible=true;layer.update(40,false,()=>true);
 const entry=layer.entries[0],x=entry.duck.x,y=entry.duck.y;
 layer.root.visible=false;layer.update(70,false,()=>true);assert.equal(entry.duck.x,x);assert.equal(entry.duck.y,y);
 layer.root.visible=true;layer.update(40,true,()=>true);const bob=entry.body.y,px=entry.duck.x,py=entry.duck.y;
 layer.update(41,true,()=>true);assert.equal(entry.duck.x,px);assert.equal(entry.duck.y,py);assert.equal(entry.body.y,bob);
 assert(entry.trail.every(r=>!r.graphic.visible));
 const graphics=layer.water.children.slice(),contexts=graphics.map(g=>g.context),water=layer.water;
 layer.destroy();layer.destroy();assert(layer.root.destroyed);assert(water.destroyed);
 assert(graphics.every(g=>g.destroyed));assert(contexts.every(c=>c.destroyed));
 assert.equal(layer.entries.length,0);assert.deepEqual(released.sort(),leased.sort());
 const engine=fs.readFileSync('src/rendering/pixi/engine.js','utf8');
 assert.match(engine,/this\.releasePondDuckies\('home'\)/);assert.match(engine,/art\.pondDuckies\.destroy\(\);art\.pondDuckies=null/);
 assert.match(engine,/if\(this\.disposed\|\|pending\.discarded\)\{art\.destroy\(\);return;\}/,'late preparation is destroyed');
 const loader=fs.readFileSync('src/rendering/pixi/art/theme-art.js','utf8');assert(loader.includes('result.pondDuckies?.destroy()'));
 assert(engine.includes('this.scene.getChildIndex(this.decks)'),'pond layer is below bridge decks');
});

test('a failed sprite acquisition releases successful and failed leases',async()=>{
 const leased=[],released=[];
 await assert.rejects(loadPondDuckies('pink',{acquire:async src=>{leased.push(src);if(leased.length===2)throw Error('fixture');return Texture.EMPTY;},release:src=>released.push(src)}),/fixture/);
 assert.deepEqual(leased.sort(),released.sort());
});

const visible=()=>true;
const load=map=>loadPondDuckies(map,{tilt:.6,acquire:async()=>Texture.EMPTY,release:()=>{}});
function tick(layer,from,to,step=.05){
 for(let time=from;time<to;time+=step)layer.update(time,false,visible);
 layer.update(to,false,visible);
}

test('all seven bodies stay fully opaque, untinted and the same size above every water ring',async()=>{
 const seen=new Set();
 for(const map of new Set(PONDS.map(p=>p.island))){
  const layer=await load(map);layer.root.visible=true;
  try{
   assert(layer.root.getChildIndex(layer.water)<layer.root.getChildIndex(layer.bodies));
   tick(layer,0,12);
   for(const e of layer.entries){
    seen.add(e.duck.label);const d=e.pond.duckies[e.index],sprite=e.body.children[0];
    assert.equal(e.duck.parent,layer.bodies);
    assert(Math.abs(sprite.width-d.width)<1e-8);assert(Math.abs(sprite.height*.6-d.height)<1e-8,'upright size compensates scene tilt');
    assert.equal(sprite.anchor.x,.5);assert.equal(sprite.anchor.y,.92);
    for(const node of [layer.root,layer.bodies,e.duck,e.body,sprite]){
     assert.equal(node.alpha,1);assert.equal(node.tint,0xffffff);assert(node.mask==null);assert(!node.filters?.length);
    }
    for(const r of [...e.idle,...e.trail]){
     assert.equal(r.graphic.parent,layer.water);
     assert(r.graphic.context.instructions.every(i=>i.action==='stroke'),'outlines only, no filled water');
    }
   }
  }finally{layer.destroy();}
 }
 assert.equal(seen.size,7);
});

test('rest emits concentric flat rings every 1.2-2 seconds that expand, fade and reuse a fixed pool',async()=>{
 const layer=await load('home');layer.root.visible=true;
 try{
  const e=layer.entries[0],pool=e.idle,graphics=layer.water.children.slice(),contexts=graphics.map(g=>g.context);
  const stop=e.pond.motion.tracks[e.index].find(s=>s.hold>e.interval*1.2),start=stop.at;
  tick(layer,start,start+.6);
  const r=pool.find(r=>r.born===start),scale=r.graphic.scale.x,alpha=r.graphic.alpha,x=r.graphic.x,y=r.graphic.y;
  assert(r&&r.active);assert(alpha>0&&alpha<.25);assert(e.interval>=1.2&&e.interval<=2);
  tick(layer,start+.65,start+1);
  assert(r.graphic.scale.x>scale);assert(r.graphic.alpha<alpha);
  assert.equal(r.graphic.x,x);assert.equal(r.graphic.y,y);
  tick(layer,start+1.05,start+e.interval+.2);
  const live=pool.filter(r=>r.active);assert(live.length>=2&&live.length<=3);
  assert(live.some(r=>r.born>start),'new ring emitted at rest');
  for(const r of live){assert.equal(r.x,x);assert.equal(r.y,y);}
  const shape=r.graphic.context.instructions[0].data.path.instructions[0].data;
  assert(shape[3]<shape[2]*.4,'ellipse is flat on the water');
  tick(layer,start+e.interval+.25,start+8);
  assert(!r.active||r.born>start,'old ring expires or its slot is reused');
  assert.equal(e.idle,pool);assert.deepEqual(layer.water.children,graphics);
  for(let i=0;i<graphics.length;i++)assert.equal(graphics[i].context,contexts[i],'no per-frame geometry creation');
 }finally{layer.destroy();}
});

test('moving drops expanding, fading ripples behind the Ducky that spread into a V and expire after stopping',async()=>{
 const layer=await load('home');layer.root.visible=true;
 try{
  const e=layer.entries[0],s=e.pond.motion.tracks[0][0],start=s.at+s.hold;
  tick(layer,start,start+2);
  const a=e.trail.find(r=>r.active&&start+2-r.born>.4),b=e.trail.find(r=>r!==a&&r.active&&r.born===a.born);
  assert(a&&b,'paired wake ripples');
  const born=samplePondDucky(e.pond,e.index,a.born,false,pose()),len=Math.hypot(born.dx,born.dy),dx=born.dx/len,dy=born.dy/len;
  for(const r of [a,b])assert((r.x-born.x)*dx+(r.y-born.y-3)*dy<0,'emitted behind its waterline');
  const radius=a.graphic.scale.x,alpha=a.graphic.alpha,gap=Math.hypot(a.graphic.x-b.graphic.x,a.graphic.y-b.graphic.y),x=a.x,y=a.y;
  tick(layer,start+2.05,start+2.2);
  assert(a.graphic.scale.x>radius);assert(a.graphic.alpha<alpha);
  assert(Math.hypot(a.graphic.x-b.graphic.x,a.graphic.y-b.graphic.y)>gap,'wake arms spread sideways');
  assert.equal(a.x,x);assert.equal(a.y,y,'trail origin stays on the travelled path');
  const end=s.at+s.hold+s.duration;
  tick(layer,start+2.25,end+2.1);
  assert(e.trail.every(r=>!r.active&&!r.graphic.visible),'all trailing water expires at rest');
 }finally{layer.destroy();}
});

test('hidden and offscreen Duckies skip FX; reduced motion shows exactly one static faint ring',async()=>{
 const layer=await load('home');layer.root.visible=true;
 try{
  tick(layer,0,.6);const e=layer.entries[0],last=e.last;
  layer.update(.7,false,visible,false);assert.equal(e.last,last);
  layer.root.visible=false;layer.update(.8,false,visible);assert.equal(e.last,last);
  layer.root.visible=true;layer.update(.9,false,()=>false);
  for(const e of layer.entries){assert(!e.duck.visible);assert.equal(e.last,null);assert([...e.idle,...e.trail].every(r=>!r.graphic.visible));}
  layer.update(20,true,visible);
  for(const e of layer.entries){
   const rings=[...e.idle,...e.trail].filter(r=>r.graphic.visible);assert.equal(rings.length,1);
   const g=rings[0].graphic;assert(g.alpha>0&&g.alpha<=.12);assert.equal(g.scale.x,1);
   const x=g.x,y=g.y,alpha=g.alpha;
   layer.update(21,true,visible);assert.equal(g.x,x);assert.equal(g.y,y);assert.equal(g.alpha,alpha);assert.equal(g.scale.x,1);
  }
  layer.update(21.05,false,visible);
  assert(layer.entries.every(e=>e.trail.every(r=>!r.active)),'no old trail bursts when motion resumes');
 }finally{layer.destroy();}
});
