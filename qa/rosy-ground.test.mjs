import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapOf} from '../src/world/island-maps.js';
import {canSail,harborOf,setSailDestination,sailStep} from '../src/gameplay/islands.js';
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';
import {Path2D,createCanvas} from '@napi-rs/canvas';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const id='sunset',map=mapOf(id),art=read('public/pixi-art/themes/pink/art.json');
const routes=read('scripts/rosy-ground/sampled-routes.json');
const surface=text('scripts/rosy-ground/path-surface.svgfrag'),ctx=createCanvas(1,1).getContext('2d');
const contour=new Path2D(surface.match(/<path d="([^"]+)" fill="#FBE6C8"/)[1]);
test('Rosy uses Home widths and one unoutlined path surface in its retained palette',()=>{
 assert.deepEqual([...new Set(map.world.pathWidths)].sort((a,b)=>a-b),[104,128]);
 assert.equal((surface.match(/<path /g)??[]).length,1);
 assert.deepEqual([...new Set(surface.match(/#[0-9a-f]{6}/gi))],['#FBE6C8']);
 assert.ok(!/opacity|filter|gradient|transform=/.test(surface));
 assert.ok(!surface.includes('stroke=')&&!surface.includes('#fde48c'));
 assert.ok(!routes.some(r=>/tutu-west|tutu-tides-paths|centre-0$|centre-3$/.test(r.id)));
 for(const t of art.ground.tiles){
  const svg=text('public/pixi-art/themes/pink/'+t.src);
  assert.ok(!/data-name="(?:Continuous footpaths|Lawn Cream|Ribbon plaza|Cafe square|Festival square \(open paved square\))"/.test(svg),t.src);
  const travel=svg.match(/<g data-name="Rosy unified paths">([\s\S]*?)<\/g>/)[1];
  assert.deepEqual([...new Set(travel.match(/#[0-9a-f]{6}/gi))],['#FBE6C8'],t.src);
  assert.ok(!/opacity|stroke|filter|gradient/.test(travel),t.src);
 }
 assert.ok(!art.flats.some(p=>p.id==='path-joins'||p.src.includes('floor-detail-')));
 assert.ok(map.JETTY.art,'the marina has one authored deck');
 for(const r of routes)for(const p of r.samples)assert.ok(map.nav().walkable(...p),r.id+' at '+p);
});
function homeBody(s,dir){
 let inner=s.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const start=inner.indexOf('<g stroke='),head=inner.slice(0,start),body=inner.slice(start);
 const pos=body.indexOf('<!-- '+(dir==='ew'?'Far handrail':dir==='ns'?'The arch':'Back rail'));
 if(pos>0)inner=head+body.slice(0,body.indexOf('>')+1)+body.slice(pos);
 return inner.replace(/#885931/gi,'#b66787').replace(/#c88941/gi,'#e9a9bc').replace(/#e4c567/gi,'#f9d3dc');
}
test('four pink bridges preserve the exact Home structure, land on the union, and carry walkers both ways',()=>{
 const decks=art.decks.filter(d=>d.homeSource);assert.equal(decks.length,4);
 for(const d of decks){
  const dir=d.homeSource.match(/bridge-(\w+)\.svg/)[1],actual=text('public/pixi-art/themes/pink/'+d.src);
  assert.ok(actual.includes(homeBody(text('public'+d.homeSource),dir)),d.src+' exact recoloured planks/rails/posts');
  assert.ok(d.overBoats);assert.ok(map.world.walkways.find(w=>w.id===d.bridgeId)?.boatPassUnder);
  for(const p of [d.a,d.b])assert.ok(ctx.isPointInPath(contour,...p,'evenodd'),'path throat '+p);
  for(const [a,b]of[[d.a,d.b],[d.b,d.a]])for(const dt of [.05,1/60]){
   const actor={x:a[0],y:a[1],turn:0,travel:0,action:0,path:[],until:0};let time=0;
   assert.ok(setWalkDestination(actor,map.nav(),...b));
   for(let i=0;i<2000&&actor.path.length;i++)walkStep(actor,map.nav(),dt,time+=dt,{x:0,y:0});
   assert.ok(Math.hypot(actor.x-b[0],actor.y-b[1])<1,d.bridgeId+' crossed');
  }
 }
});
function sail(actor,to,seen){
 assert.ok(setSailDestination(actor,...to),'sail route '+to);
 for(let i=0;i<20000&&(actor.sailTarget||actor.sailRoute?.length);i++){
  sailStep(actor,.05,{x:0,y:0});assert.ok(canSail(actor.x,actor.y,id),'hull stays wet');seen.push([actor.x,actor.y]);
 }
 assert.ok(Math.hypot(actor.x-to[0],actor.y-to[1])<2,'arrived '+to+' from '+[actor.x,actor.y]);
}
test('real boats sail harbour to both springs and the inner pond and back, under all four arches',()=>{
 const harbour=harborOf(id).water,seen=[],water=read('scripts/rosy-ground/sailing-routes.json');
 for(const river of water.slice(0,2)){
  const actor={islandId:id,mode:'sailing',...harbour,turn:0};
  const sparse=river.samples.filter((_,i)=>i%6===0);sparse.push(river.samples.at(-1));
  for(const p of [...sparse].reverse())sail(actor,p,seen);
  if(river.id==='willow-ribbon'){
   const link=water.find(r=>r.id==='pond-outflow').samples.filter((_,i)=>i%6===0);
   for(const p of [...link].reverse())sail(actor,p,seen);
   sail(actor,[5654.35,1877.36],seen);
   for(const p of link)sail(actor,p,seen);
   sail(actor,river.samples[0],seen);
  }
  for(const p of sparse)sail(actor,p,seen);
  sail(actor,[harbour.x,harbour.y],seen);
 }
 for(const {a,b,id:bridge}of map.world.arches){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  assert.ok(seen.some(([x,y])=>{const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<40;}),'sailed beneath '+bridge);
 }
 for(const p of [[760,3300],[7550,3460],[6790,2000],[5654,1877]])assert.equal(map.nav().walkable(...p),false,'water blocks walkers '+p);
});
