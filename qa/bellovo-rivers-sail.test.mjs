import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapFor} from '../src/pixi/island-maps.js';
import {canSail,setSailDestination,sailStep} from '../src/pixi/islands.js';
import {inShape} from '../rive/web/island-geometry.mjs';
const g=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/water-geometry.json')),id='isle-176',map=mapFor('cathedral');
function sail(a,p){assert.ok(setSailDestination(a,...p),'route '+p);for(let i=0;i<20000&&(a.sailTarget||a.sailRoute?.length);i++){sailStep(a,.05,{x:0,y:0});assert.ok(canSail(a.x,a.y,id),'afloat');}assert.ok(Math.hypot(a.x-p[0],a.y-p[1])<2,'arrives '+p);}
test('Bellovo boats sail from the sea and port through both mouths, the full ring and pond',()=>{
 const a={islandId:id,mode:'sailing',x:4780,y:7570,turn:0};
 for(const c of g.channels){for(const p of c.filter((_,i)=>i%12===0).toReversed())sail(a,p);}
 const ring=g.ring.slice(0,-1),nearest=p=>ring.reduce((best,q,i)=>Math.hypot(q[0]-p[0],q[1]-p[1])<Math.hypot(ring[best][0]-p[0],ring[best][1]-p[1])?i:best,0);
 let at=nearest([a.x,a.y]);sail(a,ring[at]);
 for(let i=0;i<ring.length;i++){at=(at+1)%ring.length;sail(a,ring[at]);}
 const follow=to=>{const goal=nearest(to);while(at!==goal){at=(at+1)%ring.length;sail(a,ring[at]);}};
 follow([1060,2800]);sail(a,[1060,2800]);sail(a,[1360,2960]);sail(a,[1510,3160]);sail(a,[1770,3310]);
 sail(a,[1510,3160]);sail(a,[1360,2960]);sail(a,[1060,2800]);sail(a,ring[at]);
 const c=g.channels[1];follow(c[0]);for(const p of c.filter((_,i)=>i%12===0))sail(a,p);
 sail(a,[4780,7570]);
});
test('Every Bellovo arch carries walkers across the full span and admits boats underneath',()=>{
 const nav=map.nav();assert.equal(g.bridges.length,13);
 for(const b of g.bridges){
  const m=b.a.map((v,i)=>(v+b.b[i])/2);assert.ok(canSail(...m,id),'under '+b.id);
  assert.ok(nav.route(map.spawn.x,map.spawn.y,...m).length,'reachable '+b.id);
  for(let i=0;i<=20;i++){const p=b.a.map((v,k)=>v+(b.b[k]-v)*i/20);assert.ok(nav.walkable(...p),'walking '+b.id+' '+p);}
 }
});
test('Bellovo keeps 120 approved sleepers on dry ground and three moored boats',()=>{
 assert.equal(map.sleepers.length,120);
 for(const s of map.sleepers){assert.ok(!map.world.water.some(w=>inShape(s.x,s.y,w)),'dry sleeper '+s.x+','+s.y);assert.ok(!map.world.bridges.some(b=>Math.abs(s.x-b.x)<b.w/2&&Math.abs(s.y-b.y)<b.h/2),'off bridges');}
 assert.equal(map.HARBOR.moorings.length,3);for(const p of map.HARBOR.moorings)assert.ok(canSail(p.x,p.y,id));
 assert.ok(map.nav().route(map.HARBOR.land.x,map.HARBOR.land.y,map.spawn.x,map.spawn.y).length,'port connected');
});
