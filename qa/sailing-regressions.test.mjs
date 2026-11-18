import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PixiIsland} from './helpers/pixi-engine.mjs';
import {neighboursOf} from '../src/world/world-map.js';
import {mapOf} from '../src/world/island-maps.js';
import {SEA_WIDTH} from '../src/world/flat-layout.js';
import {unplaceRigid} from '../src/world/rigid.js';
import {tileInView} from '../src/rendering/pixi/art/ground-stream.js';
import {ISLANDS,destinationsFor,harborOf,setSailDestination,sailStep,boatRoom,canSail,BOAT_GAP,harborApproachClear,fillMoorings,createBoats} from '../src/gameplay/islands.js';
import {OfflineFleet} from '../src/multiplayer/room-client.js';
import {makeRoom,addPlayer} from './room-harness.mjs';

test('visitor boat docks at Home, then a second autopilot arrival from Pagepond docks successfully',async()=>{
 const room=await makeRoom();
 try{
  const exit=destinationsFor('isle-55').find(d=>d.destination==='home');
  const first=addPlayer(room,9911,{islandId:'isle-55',mode:'sailing',...exit.dock});
  const visitor=room.boats.find(b=>b.id==='isle-55-2');
  Object.assign(visitor,exit.dock,{occupant:first.actor.id});first.actor.boatId=visitor.id;
  room.step();assert.equal(first.actor.mode,'walking');assert.equal(first.actor.islandId,'home');
  assert.equal(visitor.occupant,null);assert(harborApproachClear(visitor));assert(boatRoom(visitor,room.boats));

  const dock=destinationsFor('isle-251').find(d=>d.destination==='home').dock;
  const second=addPlayer(room,9912,{islandId:'isle-251',mode:'sailing',x:dock.x,y:dock.y+1400});
  const boat=room.boats.find(b=>b.islandId==='isle-251'&&!b.occupant);
  Object.assign(boat,{x:second.actor.x,y:second.actor.y,occupant:second.actor.id});second.actor.boatId=boat.id;
  assert(setSailDestination(second.actor,dock.x,dock.y,room.boats));
  for(let k=0;k<400&&second.actor.mode==='sailing';k++){
   room.step();assert(boatRoom(boat,room.boats),'arrival preserves every boat gap');
  }
  assert.equal(second.actor.islandId,'home');assert.equal(second.actor.mode,'walking');
  assert(harborApproachClear(boat));
 }finally{clearInterval(room.timer);room.bog?.dispose();}
});

test('occupied Home dock accepts a free approach',async()=>{
 const room=await makeRoom();
 try{
  // A live sailor can still occupy the reserved transit space.
  const blocked=room.boats.find(b=>b.id==='isle-55-2');
  const holder=addPlayer(room,9914,{islandId:'home',mode:'sailing',...harborOf('home').water});
  Object.assign(blocked,harborOf('home').water,{islandId:'home',occupant:holder.actor.id});holder.actor.boatId=blocked.id;
  const dock=destinationsFor('isle-251').find(d=>d.destination==='home').dock;
  const p=addPlayer(room,9913,{islandId:'isle-251',mode:'sailing',x:dock.x,y:dock.y+1400});
  const boat=room.boats.find(b=>b.islandId==='isle-251'&&!b.occupant);
  Object.assign(boat,{x:p.actor.x,y:p.actor.y,occupant:p.actor.id});p.actor.boatId=boat.id;
  const approach=setSailDestination(p.actor,dock.x,dock.y,room.boats);assert(approach);
  assert(Math.hypot(approach[0]-dock.x,approach[1]-dock.y)>=BOAT_GAP);
  for(let k=0;k<400&&p.actor.mode==='sailing';k++){
   room.step();assert(boatRoom(boat,room.boats));
  }
  assert.equal(p.actor.islandId,'home');assert.equal(p.actor.mode,'walking');
 }finally{clearInterval(room.timer);room.bog?.dispose();}
});

test('saved parked boats and offline landings reserve every harbour approach in every chart',()=>{
 for(const {id}of ISLANDS){
  const boats=createBoats(),visitor=boats.find(b=>b.id==='isle-55-2');
  Object.assign(visitor,harborOf(id).water,{islandId:id,parked:true});
  assert(fillMoorings(boats));assert(boats.includes(visitor));
  assert(harborApproachClear(visitor));assert(boatRoom(visitor,boats));
  Object.assign(visitor,harborOf(id).water,{occupant:'offline'});
  const fleet=new OfflineFleet(boats);fleet.land('offline');
  assert(harborApproachClear(visitor));assert(boatRoom(visitor,boats));
  assert(boats.filter(b=>!b.occupant).every(harborApproachClear));
 }
});

test('Pagepond parked visitor can sail to Home through the saved harbour fleet',async()=>{
 const room=await makeRoom();
 try{
  // Saved live fleet in each boat's chart, including the Pagepond departure and Home approach.
  room.boats=[
   ["home-0","home",3390,5895],
   ["home-1","home",4525,5850],
   ["home-2","home",4878,5844],
   ["home-4","home",7826,3330],
   ["home-5","home",-2344,2974],
   ["home-6","home",-2275,4338],
   ["home-7","home",360,5780],
   ["home-8","home",5236,5804],
   ["home-9","home",7644,4656],
   ["blossom-0","blossom",-1700,3240],
   ["blossom-1","blossom",-2067,3730],
   ["blossom-2","blossom",-1671,2870],
   ["blossom-3","blossom",9510,3851],
   ["blossom-4","blossom",6764,6031],
   ["blossom-5","blossom",1703,6323],
   ["blossom-6","blossom",-1652,3768],
   ["blossom-7","blossom",-989,925],
   ["blossom-8","blossom",3783,-967],
   ["blossom-9","blossom",8021,-49],
   ["sunset-0","sunset",10100,2617],
   ["sunset-1","sunset",10453,2614],
   ["sunset-2","sunset",10052,3126],
   ["sunset-3","sunset",6402,-1192],
   ["sunset-4","sunset",10010,1150],
   ["sunset-5","sunset",4517,6969],
   ["sunset-6","sunset",-239,4644],
   ["sunset-7","sunset",392,-1180],
   ["sunset-8","sunset",6938,5568],
   ["isle-251-0","isle-251",6850,7320],
   ["isle-251-1","isle-251",7194,7242],
   ["isle-251-2","isle-251",6049,7076],
   ["isle-251-3","isle-251",-2203,2433],
   ["isle-251-4","isle-251",-1700,-1080],
   ["isle-251-5","isle-251",9540,-730],
   ["isle-251-6","isle-251",10260,5050],
   ["isle-251-7","isle-251",8275,7012],
   ["isle-251-8","isle-251",8757,7000],
   ["isle-251-9","isle-251",7915,7005],
   ["isle-250-0","isle-250",4230,7140],
   ["isle-250-1","isle-250",4552,6966],
   ["isle-250-2","isle-250",3275,7133],
   ["isle-250-3","isle-250",4901,7027],
   ["isle-249-0","isle-249",4292,7193],
   ["isle-249-1","isle-249",3931,7141],
   ["isle-249-2","isle-249",4815,7984],
   ["isle-55-0","isle-55",9217,7969],
   ["isle-55-1","isle-55",8697,8026],
   ["isle-55-2~0","isle-55",9217,8430],
   ["isle-55-2","home",4335,6159],
   ["home-3","home",4155,6461],
   ["home-3~0","home",7753,1204],
   ["home-3~1","isle-251",6780,7727],
  ].map(([id,islandId,x,y])=>({id,islandId,x,y,occupant:null,seaVersion:1}));
  const p=addPlayer(room,9915,{islandId:'isle-251',mode:'sailing',x:6780,y:7727});
  const boat=room.boats.find(b=>b.id==='home-3~1');
  Object.assign(boat,{occupant:p.actor.id,parked:true});p.actor.boatId=boat.id;
  const dock=destinationsFor('isle-251').find(d=>d.destination==='home').dock;
  assert(boatRoom(p.actor,room.boats));assert(harborApproachClear(boat));
  assert.deepEqual(setSailDestination(p.actor,dock.x,dock.y,room.boats),[dock.x,dock.y]);
  for(let k=0;k<2400&&p.actor.mode==='sailing';k++){
   room.step();assert(boatRoom(boat,room.boats),'whole journey keeps the boat gap');
  }
  assert.equal(p.actor.islandId,'home',JSON.stringify(p.actor));assert.equal(p.actor.mode,'walking');
  assert.equal(boat.occupant,null);assert(harborApproachClear(boat));
 }finally{clearInterval(room.timer);room.bog?.dispose();}
});

test('the boat ignores a tap on open water and still accepts a tap to dock',()=>{
 const water=harborOf('home').water;
 const player={...water,mode:'sailing',islandId:'home'};
 const game=Object.assign(Object.create(PixiIsland.prototype),{
  room:{player},islandId:'home',camera:{x:3000,y:10000,zoom:1},width:100,height:100,
  globeBusy:()=>false,setDestination:()=>assert.fail('a water tap must not start sailing'),
  dock:()=>{docks++;},
 });
 let docks=0;
 game.tap({x:50,y:50});
 assert.equal(docks,0);
 Object.assign(game.camera,water);
 game.tap({x:50,y:50});
 assert.equal(docks,1);
});

test('Pagepond and Rosybutton planned routes sail across the seam in both directions',()=>{
 for(const [from,to,direction]of [['isle-251','sunset',1],['sunset','isle-251',-1]]){
  assert(neighboursOf(from).some(n=>n.island.id===to));
  const h=harborOf(from),actor={islandId:from,mode:'sailing',...h.water,path:[],action:0};
  const d=destinationsFor(from).find(d=>d.destination===to);assert(d);
  assert(setSailDestination(actor,d.dock.x,d.dock.y));
  const end=actor.sailRoute.at(-1)??actor.sailTarget;
  assert.equal(Math.sign(end.x-actor.x),direction);
  assert(Math.abs(end.x-actor.x)<SEA_WIDTH/2);
  for(let k=0;k<4000&&actor.sailTarget;k++)sailStep(actor,.05,{x:0,y:0});
  assert.equal(actor.sailTarget,null);assert(Math.abs(actor.x-end.x)<1);
 }
});

test('refused Bog landing leaves a 600-unit escape apron and preserves boat gaps',async()=>{
 const room=await makeRoom();
 try{
  for(const from of ['isle-249','isle-251']){
   const point=from==='isle-249'?harborOf(from).water:destinationsFor(from).find(d=>d.destination==='isle-249').dock;
   const p=addPlayer(room,from==='isle-249'?9901:9902,{islandId:from,...point,mode:'sailing'});
   const boat=room.boats.find(b=>b.islandId===from&&!b.occupant);Object.assign(boat,point,{occupant:p.actor.id});p.actor.boatId=boat.id;
   const info=room.connections.get(p.socket);assert.equal(room.allowLanding(p.socket,info,'isle-249'),false);
   assert(boatRoom(p.actor,room.boats));assert.equal(p.actor.mode,'sailing');assert.deepEqual([boat.x,boat.y],[p.actor.x,p.actor.y]);
   for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const a={...p.actor,path:[]};for(let k=0;k<20;k++)sailStep(a,.05,{x,y},null,room.boats);
    assert(Math.hypot(a.x-p.actor.x,a.y-p.actor.y)>500);assert(boatRoom(a,room.boats));assert(canSail(a.x,a.y,from));
   }
  }
  assert.equal(BOAT_GAP,260);
 }finally{clearInterval(room.timer);room.bog?.dispose();}
});

test('travel refusal notice expires and cleans up its timer',()=>{
 const source=readFileSync(new URL('../src/app/PixiPage.jsx',import.meta.url),'utf8');
 const match=source.match(/useEffect\(\(\) => \{\s*if \(!travelNotice\) return;([\s\S]*?)\},\[travelNotice\]\)/);assert(match);
 let callback,delay,cleared,notice='Bog refusal';
 const cleanup=new Function('setTimeout','clearTimeout','setTravelNotice',match[1])((fn,ms)=>{callback=fn;delay=ms;return 42;},id=>cleared=id,value=>notice=value);
 assert.equal(delay,5000);callback();assert.equal(notice,'');cleanup();assert.equal(cleared,42);
});

test('Home ground culling returns to authored tile coordinates after repeated laps',()=>{
 const m=mapOf('home'),tile={x:m.cx-100,y:m.cy-100,width:200,height:200};
 for(const winding of [-2,-1,0,1,2]){
  const camera={x:m.cx+winding*SEA_WIDTH,y:m.cy,zoom:.19};
  const local={...camera,...unplaceRigid('home','home',camera)};
  assert(tileInView(tile,local,1440,900));
 }
 const source=readFileSync(new URL('../src/rendering/pixi/engine.js',import.meta.url),'utf8');
 assert(source.includes('unplaceRigid(this.islandId,this.islandId,this.camera)'));
});


test('a blocked dock search shares the fine-work budget across alternatives and keeps the current route', () => {
 const islandId = 'home';
 const destination = {x:4000,y:9500};
 const boats = Array.from({length:26},(_,index) => {
  const angle = index * 2 * Math.PI / 26;
  return {id:`home-0~dock-fixture-${index}`,islandId,
   x:destination.x + 1600 * Math.cos(angle),y:destination.y + 1600 * Math.sin(angle)};
 });
 const sailTarget = {x:4400,y:12300};
 const sailRoute = [{x:5100,y:12300}];
 const actor = {id:'sailor',islandId,x:4000,y:12300,mode:'sailing',sailTarget,sailRoute,docking:true};
 const work = {visitLimit:8};
 assert.equal(setSailDestination(actor,destination.x,destination.y,boats,work),null);
 assert.ok(work.alternatives > 1, 'the search considered multiple alternate dock targets');
 assert.equal(work.fineVisits,work.visitLimit, 'alternatives share the exhausted budget');
 assert.strictEqual(actor.sailTarget,sailTarget);
 assert.strictEqual(actor.sailRoute,sailRoute);
 assert.equal(actor.docking,true);
});
