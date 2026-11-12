import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {checkTheme} from '../scripts/theme-index.mjs';
import {makeMap} from '../src/world/island-maps.js';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';
import {tileInView} from '../src/rendering/pixi/art/ground-stream.js';
import {outsideStageProps,clearedStageFlat,stageEditedIds} from './campfire-stage-scope.mjs';
import {Container,Graphics,ImageSource,Texture} from 'pixi.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {attachCentreMotion} from '../src/rendering/pixi/environment/centre-motion.js';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/community/',D='assets/world/themes/community/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),layout=read(D+'stage-layout.json');
const baseline=read('scripts/bigger-community/baseline/art.json'),stage=art.props.find(p=>p.id==='events-stage');
const bounds=p=>{const w=p.width*(p.scale??1),h=p.height*(p.scale??1),a=p.anchor??{x:.5,y:1};return [p.x-w*a.x,p.y-h*a.y,p.x+w*(1-a.x),p.y+h*(1-a.y)];};
const overlaps=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
const checked=checkTheme('community'),map=makeMap('community',{world,walk,harbor:read(D+'harbor.json'),sleepers:checked.sleepers});

test('Campfire stage is world-sized vector art, flat ink, with roof top, deep deck, cabinet sides and one contact shadow',()=>{
 assert.deepEqual(bounds(stage),layout.bounds);
 const svg=fs.readFileSync(A+stage.src,'utf8');
 assert.match(svg,/width="830" height="695" viewBox="0 0 830 695"/);
 for(const id of ['canopy-top','canopy-fascia','deck-side','shell-side','speaker-left','speaker-right','centred-stairs','backdrop'])assert(svg.includes(`id="${id}"`),id);
 assert.match(svg,/#39472d/);assert.equal((svg.match(/id="contact-shadow"/g)??[]).length,1);assert.equal(stage.shadow,false);
 for(const src of ['detail/stage.svg','detail/stage-cabinet.svg','detail/stage-approach.svg'])assert.doesNotMatch(fs.readFileSync(A+src,'utf8'),/<(?:image|linearGradient|radialGradient|filter)\b|data:|skew\(|rotate\(/i);
 assert.doesNotMatch(svg,/bubble|cloud screen/i);
 assert.equal(stage.wind,false);assert.equal(stage.sortY,1049);
 for(const id of ['stage-cabinet-w','stage-cabinet-e']){let p=art.props.find(p=>p.id===id);assert.equal(p.sortY,1126);assert.equal(p.shadow,false);}
});

test('Campfire stage canopy has 24 world units of tree clearance and the audience lawn has no trees',()=>{
 const b=layout.bounds,pad=layout.roofClearance,clear=[b[0]-pad,b[1]-pad,b[2]+pad,b[3]+pad];
 for(const p of art.props.filter(p=>/tree/i.test(p.src))){assert(!overlaps(bounds(p),clear),p.id+' crowds the stage');assert(!overlaps(bounds(p),layout.audience),p.id+' crowds the audience');}
 for(const [id,[x,y]]of Object.entries(layout.treeMoves)){
  const p=art.props.find(p=>p.id===id);assert.deepEqual([p.x,p.y],[x,y]);
  for(const w of [world,walk]){assert(!w.water.some(o=>inShape(x,y,o,40)),id+' planted on dry land');assert(w.obstacles.some(o=>o.x===x&&o.y===y-(id.startsWith('polish-')?8:9)&&o.rx===31),id+' blocker moved with trunk');}
 }
});

test('Campfire stair landing joins a 104-unit path and preserves all stage signs, lights and surrounding art',()=>{
 const approach=art.flats.find(p=>p.id==='stage-approach');assert.deepEqual([approach.x+630,approach.y],[4000,1282]);
 assert.equal(approach.width,690);assert.equal(approach.height,520);assert.match(fs.readFileSync(A+approach.src,'utf8'),/M578 0H682/);
 assert.deepEqual(art.flats,[...baseline.flats.filter(p=>!clearedStageFlat(p)),approach]);
 const original=baseline.props.filter(p=>!p.src.includes('badge-buoy'));
 assert.deepEqual(outsideStageProps(art.props.slice(0,original.length)),outsideStageProps(original));
 for(const id of stageEditedIds){const before=original.find(p=>p.id===id),after=art.props.find(p=>p.id===id);
  assert(before&&after,id);
  if(id==='events-stage')assert.deepEqual(after,{...before,...layout.placement,scale:1,shadow:false,wind:false,sortY:1049});
  else {const [x,y]=layout.treeMoves[id]??layout.audienceMoves[id];assert.deepEqual(after,{...before,x,y});}
 }
 assert.deepEqual(world.props,art.props.filter(p=>!p.lifeGrove));assert.deepEqual(walk.props,art.props.filter(p=>!p.lifeGrove));
 assert.deepEqual(checked.problems,[]);assert.equal(checked.sleepers.length,100);
});

test('Campfire server and client block physical stage walls and cabinets, leaving every stair tread and deck open',()=>{
 assert.deepEqual(world.obstacles,walk.obstacles);
 const expected=Object.entries(layout.solidLocal).map(([id,poly])=>({id,poly:poly.map(([x,y])=>[x+layout.origin[0],y+layout.origin[1]])}));
 assert.deepEqual(world.obstacles.filter(o=>o.id?.startsWith('stage-')),expected);
 for(const w of [world,walk]){
  const g=geometry(w);
  for(const [name,p]of Object.entries(layout.walkChecks))assert(g.walkable(...p),name+' is open');
  for(const p of [[4000,1041],[3850,1200],[4150,1200],[3640,1170],[4360,1170],[3710,1116],[4290,1116]])assert(!g.walkable(...p),'solid '+p);
 }
 const nav=map.nav();
 for(const [name,p]of Object.entries(layout.walkChecks))assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,...p).at(-1),p,name+' reachable from commons');
 for(const x of [3945,4000,4055])assert(nav.clearLine([x,1450],[x,1070]),'stairs stay open for full-width ascent');
});

test('Campfire Duckies actually walk from the path up all three steps and stand on the deck at client and authority ticks',()=>{
 const nav=map.nav();
 for(const dt of [1/60,.05]){
  const duck={x:4000,y:1450,previousX:4000,previousY:1450,turn:0,path:[],until:0,action:0,travel:0,emoteVersion:0};
  setWalkDestination(duck,nav,4000,1080);let treadMask=0;
  for(let t=0;t<12;t+=dt){walkStep(duck,nav,dt,t,{x:0,y:0});assert(nav.walkable(duck.x,duck.y));for(const [i,y]of [1265,1220,1175].entries())if(Math.abs(duck.y-y)<15)treadMask|=1<<i;}
  assert.equal(treadMask,7);assert(Math.hypot(duck.x-4000,duck.y-1080)<8,'reached deck');
 }
});

test('Campfire static centre view loads and draws the stage and cabinets',async t=>{
 assert.equal(art.raster.enabled,false);
 const previousFetch=globalThis.fetch;t.after(()=>globalThis.fetch=previousFetch);
 globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 const textures=new Map(),released=[],objects=new Container();
 const groundPool=createGroundPool({acquire:async()=>Texture.EMPTY,release(){}});
 let loaded;
 try{
  loaded=await loadThemeArt({...map,art:'/pixi-art/themes/community/art.json'},{groundPool,
   acquire:async src=>{const texture=new Texture({source:new ImageSource({width:16,height:16})});textures.set(src,texture);return texture;},
   release:src=>{released.push(src);textures.get(src)?.destroy(true);},
   rasterLoaderFactory:()=>{throw Error('Campfire must use static prop textures');}});
  assert.equal(loaded.rasterPool,null);
  for(const id of ['events-stage','stage-cabinet-w','stage-cabinet-e']){
   const p=loaded.props.find(p=>p.id===id);assert(p,id+' in loaded prop set');objects.addChild(p.sprite);
   assert.equal(p.sprite.parent,objects);assert.equal(p.sprite.themeArt,'community');
   assert.equal(p.sprite.texture,textures.get('/pixi-art/themes/community/'+p.src));
   assert.notEqual(p.sprite.texture,Texture.EMPTY);assert.equal(p.sprite.texture.destroyed,false);
   assert.equal(p.sprite.visible,true);assert.equal(p.sprite.renderable,true);assert.equal(p.sprite.alpha,1);
   assert.equal(p.sprite.width,p.width*(p.scale??1));assert.equal(p.sprite.height,p.height*(p.scale??1));
   assert.equal(p.shadow,null,'art supplies its own contact shadow');
   const [x,y,x1,y1]=bounds(p);
   for(const zoom of [.6,1.8])for(const [width,height]of (id==='events-stage'?[[390,844],[1400,1000],[1920,1080]]:[[1400,1000],[1920,1080]]))assert(tileInView({x,y,width:x1-x,height:y1-y},{x:4000,y:1050,zoom},width,height,1,0),id+' visible in centre view');
   assert(!loaded.groundStreams.some(s=>s.entries.some(t=>t.src.includes(p.src))),id+' needs no raster crop stream');
  }
 }finally{loaded?.destroy();groundPool.destroy();objects.destroy();}
 assert.equal(released.length,textures.size);assert.equal(new Set(released).size,textures.size);
 assert([...textures.values()].every(t=>t.destroyed));
});

test('Campfire static art preserves the existing animated hearth and releases its artwork',async()=>{
 const fetch=globalThis.fetch,objects=new Container();let acquired=0,released=0;
 const groundPool=createGroundPool({acquire:async()=>Texture.EMPTY,release:()=>{}});
 globalThis.fetch=async url=>({ok:true,json:async()=>read('public'+url)});
 let loaded;
 try{
  loaded=await loadThemeArt({...map,art:'/pixi-art/themes/community/art.json'},{groundPool,acquire:async()=>{acquired++;return Texture.EMPTY;},release:()=>released++});
  await attachCentreMotion(loaded,{Graphics,Container},objects);
  const flame=loaded.props.find(p=>p.id==='campfire-flame').sprite;
  const rest=[flame.x,flame.y,flame.scale.x,flame.scale.y];
  loaded.updateCentre(.2,false);const a=flame.scale.y;
  loaded.updateCentre(.8,false);assert.notEqual(flame.scale.y,a,'hearth still breathes');
  loaded.updateCentre(1,true);assert.deepEqual([flame.x,flame.y,flame.scale.x,flame.scale.y],rest);
  loaded.updateCentre(99,true);assert.deepEqual([flame.x,flame.y,flame.scale.x,flame.scale.y],rest);
 }finally{loaded?.destroy();groundPool.destroy();objects.destroy();globalThis.fetch=fetch;}
 assert.equal(released,acquired);
});
