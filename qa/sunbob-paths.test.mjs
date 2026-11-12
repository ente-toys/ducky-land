import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCanvas,Path2D} from '@napi-rs/canvas';
import {mapOf} from '../src/world/island-maps.js';
import {IslandRoom} from '../worker/index.js';
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const art=read('public/pixi-art/themes/sunflower/art.json'),map=mapOf('blossom');
const surface=readFileSync(new URL('../scripts/sunbob-ground/path-surface.svgfrag',import.meta.url),'utf8');
const contour=new Path2D(surface.match(/<path d="([^"]+)" fill="#fde48c"/)[1]),ctx=createCanvas(1,1).getContext('2d');
const onPath=(x,y)=>ctx.isPointInPath(contour,x,y,'evenodd');
const sourceBody=(s,dir)=>{
 let inner=s.replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 const start=inner.indexOf('<g stroke='),head=inner.slice(0,start),body=inner.slice(start);
 const pos=body.indexOf('<!-- '+(dir==='ew'?'Far handrail':dir==='ns'?'The arch':'Back rail'));
 if(pos>0)inner=head+body.slice(0,body.indexOf('>')+1)+body.slice(pos);
 return inner;
};
test('every Sunbob river crossing contains the exact approved Home arched SVG, and both deck ends touch the path union',()=>{
 const bridges=art.decks.filter(d=>d.src!=='bigger/landing-pier.svg');
 assert.equal(bridges.length,14);assert.equal(map.world.arches.length,14);
 for(const d of bridges){
  assert.match(d.homeSource,/^\/pixi-art\/home-expansion-c\/bridges\/bridge-(ew|ns|ne|nw)\.svg$/);
  const original=readFileSync(new URL('../public'+d.homeSource,import.meta.url),'utf8'),actual=readFileSync(new URL('../public/pixi-art/themes/sunflower/'+d.src,import.meta.url),'utf8');
  const dir=d.homeSource.match(/bridge-(\w+)\.svg/)[1];
  assert.ok(actual.includes(sourceBody(original,dir)),d.src+' retains Home planks, rails and posts');
  assert.ok(actual.includes('data-home-source="'+d.homeSource+'"'));
  assert.ok(d.overBoats);
  const physical=map.world.walkways.find(w=>JSON.stringify(w.a)===JSON.stringify(d.a)&&JSON.stringify(w.b)===JSON.stringify(d.b));
  assert.ok(physical?.boatPassUnder,d.src+' shares its exact deck with walk/sail physics');
  for(const p of [d.a,d.b])assert.ok(onPath(...p)||[0,Math.PI/2,Math.PI,Math.PI*1.5].some(a=>onPath(p[0]+Math.cos(a)*2,p[1]+Math.sin(a)*2)),d.src+' joins sand at '+p);
 }
});
test('the whole Sunbob network has Home widths and colours, no second plaza painter, and clear client/server route samples',()=>{
 assert.deepEqual([...new Set(map.world.pathWidths)].sort((a,b)=>a-b),[104,128]);
 assert.equal((surface.match(/<path /g)??[]).length,2);
 assert.match(surface,/fill="#e4c567" transform="translate\(0 3\)"/);assert.match(surface,/fill="#fde48c"/);assert.ok(!surface.includes('stroke='));
 const ground=readFileSync(new URL('../public/pixi-art/globe/sunflower-ground.svg',import.meta.url),'utf8');
 assert.ok(!onPath(3576,745),'the reported book-side rectangle is gone');
 assert.ok(!ground.includes('seven path joins')&&!ground.includes('stroke="#f5dfa1"'));
 const navs=[map.nav(),IslandRoom.prototype.navFor.call({},'blossom')];
 for(const r of read('scripts/sunbob-ground/sampled-routes.json'))for(const p of r.samples)for(const nav of navs)assert.ok(nav.walkable(...p),r.id+' at '+p);
});
test('a walking actor crosses every Home deck in both directions at server and render tick rates',()=>{
 const nav=map.nav();
 for(const b of map.world.arches)for(const[a,z]of[[b.a,b.b],[b.b,b.a]])for(const dt of [.05,1/60]){
  const actor={x:a[0],y:a[1],turn:0,travel:0,action:0,path:[],until:0};let time=0;
  assert.ok(setWalkDestination(actor,nav,...z));
  for(let i=0;i<2000&&actor.path.length;i++){const before=[actor.x,actor.y];walkStep(actor,nav,dt,time+=dt,{x:0,y:0});assert.ok(nav.clearLine(before,[actor.x,actor.y]),'on deck '+b.id);}
  assert.ok(Math.hypot(actor.x-z[0],actor.y-z[1])<1,'crossed '+b.id);
 }
});
