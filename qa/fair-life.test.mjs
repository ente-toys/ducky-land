import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createServer} from 'vite';
import {mapFor,mapOf} from '../src/world/island-maps.js';
import {checkTheme} from '../scripts/theme-index.mjs';
import {layout,original,read,A,D,clearance,segmentDistance,sample} from '../scripts/fair-life/apply.mjs';
import {inShape} from '../assets/world/island-geometry.mjs';

const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
test('Fair runtime and server registry resolve 90 residents, retaining the exact original forty',()=>{
 const checked=checkTheme('fair');assert(checked.ready,checked.problems.join('\n'));
 assert.equal(world.sleepTotal,90);assert.equal(checked.sleepers.length,90);
 assert.equal(mapFor('fair').sleepers.length,90);assert.equal(mapOf('isle-170').sleepers.length,90);
 assert.deepEqual(mapFor('fair').sleepers.map(({tree,...s})=>({...s,...(tree?{tree}:{})})),checked.sleepers);
 assert.deepEqual(read(D+'sleepers-resolved.json'),checked.sleepers);
 for(const [pose,spots]of Object.entries(original.spots))assert.deepEqual(world.sleepSpots[pose].slice(0,spots.length),spots);
 for(const s of original.beds)assert(checked.sleepers.some(b=>JSON.stringify(b)===JSON.stringify(s)),'retained resident '+JSON.stringify(s));
 const clear=clearance(world,walk,art);
 for(const bed of checked.sleepers.filter(b=>!original.beds.some(s=>s.pose===b.pose&&s.x===b.x&&s.y===b.y)))assert(clear(bed.x,bed.y,bed.pose,bed.tree),'clear full footprint '+JSON.stringify(bed));
 assert.deepEqual(Object.fromEntries([...new Set(layout.sleepers.map(s=>s.region))].map(r=>[r,layout.sleepers.filter(s=>s.region===r).length])),{'north':8,'northwest':8,'southwest':8,'south':8,'east-southeast':8,'hill':5,'west-picnic':5});
});
test('Home hill and modest workers picnic retain the listed props, use upright benches and approved bush art',()=>{
 assert.equal(art.flats.find(p=>p.id==='fair-life-hill-mound').src,'/pixi-art/home-review/hill/mound.svg');
 const telescope=art.props.find(p=>p.id==='fair-life-hill-telescope');assert.deepEqual([telescope.x,telescope.y],[7500,1250]);
 for(const id of Object.keys(layout.moves)){const p=art.props.find(p=>p.id===id);assert(p,'retained '+id);assert.deepEqual([p.x,p.y],layout.moves[id]);}
 for(const p of art.props.filter(p=>p.id.startsWith('fair-life-'))){
  assert(!p.rotation&&!p.skew,'upright '+p.id);
  const svg=fs.readFileSync(p.src.startsWith('/')?'public'+p.src:A+p.src,'utf8');assert(!/gradient|<image|<filter/i.test(svg));assert(/#39472d/i.test(svg));
  for(const f of p.footprints)assert(walk.obstacles.some(o=>JSON.stringify(o)===JSON.stringify(f)),'server obstacle '+p.id);
 }
 const seats=art.props.filter(p=>/^fair-life-picnic-seat-/.test(p.id));assert.equal(seats.length,2);assert.deepEqual(seats.map(p=>p.look),['right','left']);
 assert.equal(layout.routes.length,2);
 for(const route of world.fairLife.routes){assert.equal(route.width,104);assert(route.samples.length>=2);assert(world.paths.some(p=>JSON.stringify(p)===JSON.stringify(route.samples)));}
});
test('twelve authored kite stakes and flying envelopes clear water, roofs and route corridors in four pockets',()=>{
 assert.equal(art.kites.length,12);assert.deepEqual(art.kites,layout.kites);
 assert.equal(new Set(art.kites.map(s=>s.colour)).size,6);
 for(const pocket of ['nw','sw','hill','se'])assert.equal(art.kites.filter(s=>s.pocket===pocket).length,3);
 const roads=world.paths.flatMap(p=>p.slice(1).map((b,i)=>[p[i],b]));
 for(const s of art.kites){
  assert(!world.water.some(w=>inShape(s.x,s.y,w,90)),s.id+' dry stake');
  assert(!roads.some(([a,b])=>segmentDistance(s.x,s.y,a,b)<160),s.id+' off lane');
  for(const p of art.props){const a=p.anchor??{x:.5,y:1},w=p.width*(p.scale??1),h=p.height*(p.scale??1);assert(!(s.x+s.lean+145>p.x-w*a.x-15&&s.x+s.lean-65<p.x+w*(1-a.x)+15&&s.y-s.height+100>p.y-h*a.y-15&&s.y-s.height-120<p.y+h*(1-a.y)+15),s.id+' flight clears '+p.id);}
  for(const p of art.props){const a=p.anchor??{x:.5,y:1},w=p.width*(p.scale??1),h=p.height*(p.scale??1);assert(!(s.x+24>p.x-w*a.x&&s.x-24<p.x+w*(1-a.x)&&s.y>p.y-h*a.y&&s.y-34<p.y+h*(1-a.y)),s.id+' visible stake clears '+p.id);}
  assert(!walk.obstacles.some(o=>o.id===s.id||o.name===s.id),'nonblocking kite');
  const poses=read('src/world/home/sleep-poses.json').poses;
  for(const bed of mapFor('fair').sleepers){
   const p=poses[bed.pose],h=(p.box[3]-p.box[1])*p.k*.81*(.88*.24*3)/3;
   assert(!(bed.x+bed.r+20>s.x+s.lean-65&&bed.x-bed.r-20<s.x+s.lean+145&&bed.y+20>s.y-s.height-120&&bed.y-h-20<s.y-s.height+100),s.id+' flight clears resident '+bed.pose+' '+bed.x+','+bed.y);
  }
 }
});
test('Fair kites use the actual Home animation, attached strings and reduced-motion stillness without sockets',async()=>{
 const vite=await createServer({configFile:false,cacheDir:'/tmp/fair-life-vite',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
 try{
  const {createHomeKites,KITE_ASSETS}=await vite.ssrLoadModule('/src/rendering/pixi/environment/home-kites.js');
  const {Container,Texture}=await vite.ssrLoadModule('pixi.js'),parent=new Container();
  const kites=createHomeKites(parent,Object.fromEntries(KITE_ASSETS.map(src=>[src,Texture.WHITE])),art.kites);
  assert.equal(kites.entries.length,12);
  kites.update(0,false,()=>true);const first=kites.entries.map(e=>e.flying.x);
  kites.update(1.2,false,()=>true);assert(kites.entries.some((e,i)=>e.flying.x!==first[i]));
  for(let t=0;t<25;t+=.21){kites.update(t,false,()=>true);for(const e of kites.entries){assert(Math.abs(e.string.scale.x*100-e.flying.x)<1e-9);assert(Math.abs(-17-e.string.scale.y*200-e.flying.y)<1e-9);}}
  kites.update(0,true,()=>true);const still=kites.entries.map(e=>[e.flying.x,e.flying.y,e.flying.rotation,e.tailA.rotation,e.tailB.rotation]);
  kites.update(99,true,()=>true);assert.deepEqual(kites.entries.map(e=>[e.flying.x,e.flying.y,e.flying.rotation,e.tailA.rotation,e.tailB.rotation]),still);
  kites.update(1,false,()=>true,false);assert(kites.entries.every(e=>!e.root.visible));parent.destroy({children:true});
 }finally{await vite.close();}
});
