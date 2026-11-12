import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Path2D} from '@napi-rs/canvas';
import {mapFor} from '../src/world/island-maps.js';
import {inShape} from '../assets/world/island-geometry.mjs';

const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/library/',map=mapFor('library');
const art=read(A+'art.json'),world=read('assets/world/themes/library/world.json');
const tile=fs.readFileSync(A+'bigger/original-ground-r2-c3.svg','utf8');
const pond=tile.match(/<g id="pagepond-reading-pond"[\s\S]*?<\/g>/)?.[0];

test('Pagepond reading pond uses an organic grassy bank and matching visual/client/server water',()=>{
 assert(pond,'runtime tile contains the authored pond');
 assert(!/<ellipse|Gradient|<image\b/.test(pond));
 const water=pond.match(/<path d="([^"]+)" fill="#6ec9de"/);
 assert(water,'flat water silhouette');
 const silhouette=new Path2D(water[1]);
 const shape=world.water.find(w=>w.name==='Pagepond reading pond');
 assert(shape?.poly?.length>100,'curved bank sampled for walking collision');
 assert.deepEqual(map.walk.water,world.water);
 let samples=0;
 for(let y=2940;y<3340;y+=7)for(let x=4400;x<5040;x+=7){
  assert.equal(inShape(x,y,shape),silhouette.isPointInPath(x,y),`bank at ${x},${y}`);
  samples++;
 }
 assert(samples>5000);
});

test('Pagepond lily pads stay afloat and the river remains separated by a walkable grassy bank',()=>{
 const wet=(x,y)=>world.water.some(w=>inShape(x,y,w));
 for(const f of art.floating.filter(f=>f.src.includes('lily-pad')))assert(wet(f.x,f.y),f.src+' afloat');
 for(const p of [[4390,3060],[4390,3125],[4410,3100]]){
  assert(!wet(...p),'dry separation from river '+p);
  assert(map.nav().walkable(...p),'bank is usable ground '+p);
 }
 for(const id of ['lib-18','lib-19','lib-20','lib-25','lib-32']){
  const p=art.props.find(p=>p.id===id);assert(!wet(p.x,p.y),id+' keeps dry footing');
 }
 assert.equal(art.props.filter(p=>p.zone==='pond'&&/reeds|cattails/.test(p.src)).length,4);
});

test('Pagepond retains the Home dock, with continuous walking from the path to its wet end',()=>{
 const d=art.decks.find(d=>d.src==='pond-reading-dock.svg');assert(d);
 const dock=fs.readFileSync(A+d.src,'utf8');
 const home=fs.readFileSync('public/pixi-art/bridge-jetty-1.svg','utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'');
 assert(dock.includes(home),'approved Home jetty body retained');
 const way=world.walkways.find(w=>w.a[0]===4692&&w.a[1]===3268);assert(way);
 assert(world.water.some(w=>inShape(...way.a,w)),'tip reaches the water');
 const floor=new Path2D(read('scripts/pagepond/layout.json').floor);
 assert(floor.isPointInPath(...way.b),'dry end touches existing single-colour path');
 const nav=map.nav();
 for(let y=way.a[1];y<=way.b[1];y+=4)assert(nav.walkable(4692,y),'continuous dock at '+y);
 assert(nav.route(map.spawn.x,map.spawn.y,...way.a).length,'dock reachable from island spawn');
});
