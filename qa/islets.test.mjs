import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLETS,ISLET_ART,ISLET_SEED} from '../src/pixi/islets.js';
import {WORLD_ISLANDS,WORLD_GEO,neighboursOf} from '../src/pixi/world-map.js';
import {sphereShores} from '../src/pixi/sphere-shores.js';
import {angle,arcDistance,expMap,transport} from '../src/pixi/sphere.js';
import {localPoint,spherePoint} from '../src/pixi/sphere-coordinates.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {canSail,landingSpot,landingApproach,sailRoute,sailStep,setSailDestination,boardingPoint,navOf,BOAT_RADIUS,ISLANDS,seaBoundsFor} from '../src/pixi/islands.js';
import {isletPoint} from '../src/pixi/islets.js';
import {isletWalk} from '../src/pixi/islet-walk.js';
import {setWalkDestination,walkStep} from '../src/pixi/player-motion.js';
import {readFileSync,readdirSync} from 'node:fs';
import {DOMParser as XMLDOMParser} from '@xmldom/xmldom';
import {svgContext} from '../src/pixi/svg-context.js';
import {ISLET_META} from '../src/pixi/islets.js';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {fileURLToPath} from 'node:url';
const inRing=(x,y,p)=>{let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;return inside;};
// boss 8 Nov: each islet at the width its hand-drawn art was made for (ink and props match the Home centre)
test('22 stable islets use all eleven approved artworks twice, without adding islands',()=>{
 assert.equal(ISLET_SEED,831511);assert.equal(ISLETS.length,22);assert.equal(ISLANDS.length,13);
 assert.equal(new Set(ISLETS.map(i=>i.id)).size,22);
 for(const art of ISLET_ART)assert.equal(ISLETS.filter(i=>i.art===art).length,2);
 for(const i of ISLETS){assert.equal(i.width,ISLET_META[i.art].designWidth,`${i.id} is drawn at its art's own scale`);assert.ok(i.width>=600&&i.width<=2400);assert.ok(Math.abs(i.lat)<72*Math.PI/180);if(Math.abs(i.lat)>60*Math.PI/180)assert.equal(i.art,'08-snow-igloo');}
 for(const i of ISLETS)for(const j of ISLETS)if(i!==j&&i.art===j.art)assert.ok(angle(i.center,j.center)*WORLD_GEO.Rw>8000);
});
test('entire islet footprints clear every actual coast by 900 and protect linked harbour corridors',()=>{
 const R=WORLD_GEO.Rw,shores=WORLD_ISLANDS.flatMap(i=>sphereShores(i));
 for(const i of ISLETS){
  for(const island of WORLD_ISLANDS){const p=localPoint(island.id,i.center);assert.equal(mapOf(island.id).landAt(p.x,p.y),false);}
  for(const s of shores){
   if((angle(i.center,s.center)-s.radius)*R>900+i.width*.71)continue;
   for(let k=0;k<s.points.length;k++)assert.ok(arcDistance(i.center,s.points[k],s.points[(k+1)%s.points.length])*R>=900+i.width*.71,i.id);
  }
  for(const a of WORLD_ISLANDS)for(const {island:b}of neighboursOf(a.id))if(a.id<b.id)assert.ok(arcDistance(i.center,spherePoint(a.id,mapOf(a.id).HARBOR.water),spherePoint(b.id,mapOf(b.id).HARBOR.water))*R>=650+i.width*.71,i.id);
 }
});
// boss 8 Nov ("the perspective of the islets is bad", "wtf is that docking port"): hand-drawn SVG, jetty drawn in the art
const PUBLIC=f=>fileURLToPath(new URL(`../public/pixi-art/islets/${f}`,import.meta.url));
test('every islet is hand-drawn flat SVG with its jetty in the art, and no raster islet ships',()=>{
 const files=readdirSync(PUBLIC(''));
 assert.deepEqual(files.filter(f=>!/\.(svg|meta\.json)$/.test(f)),[],'only SVG art and its meta: no atlas, no webp, no png');
 for(const art of ISLET_ART){
  assert.doesNotMatch(art,/neon|10-/);
  const svg=readFileSync(PUBLIC(`${art}.svg`),'utf8');
  assert.match(svg,/viewBox="0 0 1024 1024"/,art);
  assert.doesNotMatch(svg,/<image|base64|<text|Gradient|<clipPath|<mask|<filter|<pattern|<style|class=/,`${art}: flat hand-written shapes only`);
  const tags=new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map(m=>m[1]));
  for(const t of tags)assert.ok(['svg','title','desc','defs','use','g','path','circle','ellipse','rect','line','polyline','polygon'].includes(t),`${art}: <${t}>`);
  for(const [,c]of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g))assert.match(c,/^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|none)$/,`${art}: flat colour ${c}`);
  assert.match(svg,/stroke="#39472[dD]"/,`${art}: our ink`);
  assert.match(svg,/id="jetty"|jetty/i,`${art}: the jetty is part of the drawing`);
  // the artists' own words: never traced (the old art was ~2000 potrace layers per islet)
  assert.ok((svg.match(/<path/g)??[]).length<400,`${art}: hand-drawn, not traced`);
  const m=ISLET_META[art];
  assert.equal(m.art,art);assert.ok(m.land.length>=12);
  assert.ok(inRing(...m.jetty.foot,m.land),`${art}: jetty foot on the sand`);
  assert.ok(!inRing(...m.jetty.tip,m.land),`${art}: jetty tip out in the water`);
  for(const b of m.blocked)assert.ok(b.polygon.length>=3&&b.what,`${art}: footprint ${b.what}`);
 }
 // no code-drawn dock any more
 const view=readFileSync(fileURLToPath(new URL('../src/pixi/islet-view.js',import.meta.url)),'utf8');
 assert.doesNotMatch(view,/drawJetty|roundRect|\.webp|\.png/);
});
test('the islet SVGs build into Pixi geometry, transforms and inherited styles included',()=>{
 const parse=t=>new XMLDOMParser().parseFromString(t,'image/svg+xml');
 for(const art of ISLET_ART){
  const ctx=svgContext(readFileSync(PUBLIC(`${art}.svg`),'utf8'),parse),fills=ctx.instructions.filter(i=>i.action==='fill'),strokes=ctx.instructions.filter(i=>i.action==='stroke');
  assert.ok(fills.length>40&&strokes.length>40,`${art}: ${fills.length} fills, ${strokes.length} strokes`);
  const b=ctx.bounds;assert.ok(b.minX>=-1&&b.minY>=-1&&b.maxX<=1025&&b.maxY<=1025,`${art}: inside its viewBox`);
  ctx.destroy();
 }
 // a kit piece placed with translate+scale lands where a browser puts it, its pen scaled with it
 const ctx=svgContext('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#ff0000" fill-opacity=".5"><g transform="translate(10 20) scale(2)"><path d="M0 0 L10 0 L10 10 Z" stroke="#39472D" stroke-width="1.5"/><path d="M0 0 L5 5" fill="none" stroke="#39472D"/></g></svg>',parse);
 const [fill,stroke,line]=ctx.instructions;
 assert.equal(fill.action,'fill');assert.equal(fill.data.style.alpha,.5);
 const bb=fill.data.path.bounds;assert.deepEqual([bb.minX,bb.minY,bb.maxX,bb.maxY],[10,20,30,40]);
 assert.equal(stroke.data.style.width,3);
 assert.equal(line.action,'stroke','fill="none" under a filled group draws no fill');
});
test('boat collision agrees in different island charts and covers every islet\'s walkable land',()=>{
 for(const i of ISLETS)for(const island of WORLD_ISLANDS){
  const p=localPoint(island.id,i.collisionCenter);
  assert.equal(canSail(p.x,p.y,island.id),false,`${i.id}/${island.id}`);
  const frame=transport(i,i.collisionCenter),out=localPoint(island.id,expMap(frame,i.radius+BOAT_RADIUS+80,0,WORLD_GEO.Rw));
  const b=seaBoundsFor(island.id);
  if(out.x>=b.x0&&out.x<=b.x1&&out.y>=b.y0&&out.y<=b.y1)assert.equal(canSail(out.x,out.y,island.id),true);
 }
 for(const i of ISLETS){
  for(const q of i.coast){const p=localPoint(i.home,isletPoint(i,q));assert.equal(canSail(p.x,p.y,i.home),false,`${i.id} land is solid to boats`);}
  const w=isletWalk(i.id);
  assert.ok(navOf(i.home).walkable(w.land.x,w.land.y),`${i.id} jetty end is walkable`);
  assert.ok(canSail(w.water.x,w.water.y,i.home),`${i.id} dock water is open`);
  assert.ok(Math.hypot(w.water.x-w.tip.x,w.water.y-w.tip.y)<150,`${i.id} the boat ties up beside the jetty tip`);
  // the drawn jetty faces open sea: straight out from its tip there is no land and no other islet for the docking reach
  for(let t=0;t<=420;t+=50){const q=isletPoint(i,[i.jetty.tip[0]+i.jetty.dir[0]*(t+72),i.jetty.tip[1]+i.jetty.dir[1]*(t+72)]),l=localPoint(i.home,q);
   assert.ok(canSail(l.x,l.y,i.home),`${i.id} open sea ${t} out from its jetty`);}
  // upright in the view you sail and walk it in: its art is never turned against our camera
  const p=localPoint(i.home,i.center),e=localPoint(i.home,isletPoint(i,[100,0]));
  assert.ok(Math.abs(Math.atan2(e.y-p.y,e.x-p.x))<.01,`${i.id} stands upright on ${i.home}`);
  // its props stand on the ground: walked round, never through
  for(const b of i.blocked){const cx=b.reduce((s,q)=>s+q[0],0)/b.length,cy=b.reduce((s,q)=>s+q[1],0)/b.length,q=localPoint(i.home,isletPoint(i,[cx,cy]));
   assert.equal(navOf(i.home).walkable(q.x,q.y),false,`${i.id} prop footprint is solid`);}
 }
});
// boss 8 Nov ("I should be able to dock here"): sail up, dock, walk about, take the boat and sail off, on all 22
test('every islet: sail up, dock at its jetty, walk its land, board and sail away',()=>{
 for(const i of ISLETS){
  const w=isletWalk(i.id),nav=navOf(i.home),id=i.home;
  // approach from open sea, from the side away from the jetty, so the boat must sail round the islet
  const frame=transport(i,i.collisionCenter),start=localPoint(id,expMap(frame,-i.jetty.dir[0]*(i.radius+380),-i.jetty.dir[1]*(i.radius+380),WORLD_GEO.Rw));
  assert.ok(canSail(start.x,start.y,id),`${i.id} start at sea`);
  const actor={...start,islandId:id,mode:'sailing',turn:0,path:[]};
  const spot=landingSpot(actor,nav);
  assert.equal(spot?.islet,i.id,`${i.id} offers Dock`);
  assert.equal(spot.islandId,i.home);
  const approach=landingApproach(actor,spot);
  assert.ok(Math.hypot(approach.x-w.water.x,approach.y-w.water.y)<2,`${i.id} sails to the jetty water`);
  assert.ok(setSailDestination(actor,approach.x,approach.y),`${i.id} has a route to its jetty`);
  for(let k=0;k<4000&&actor.sailTarget;k++){sailStep(actor,.05,{x:0,y:0});assert.ok(canSail(actor.x,actor.y,id));}
  assert.ok(Math.hypot(actor.x-approach.x,actor.y-approach.y)<14,`${i.id} reached the jetty`);
  // hop out (worker/index.js): onto the jetty end, walking on the islet's own ground
  Object.assign(actor,{x:spot.x,y:spot.y,mode:'walking',path:[],travel:0,pace:0,heading:null});
  const boat={id:`${id}-0`,islandId:id,x:approach.x,y:approach.y,turn:0};
  assert.ok(nav.walkable(actor.x,actor.y));
  // walk to the far side of the land and back
  const aim=localPoint(id,isletPoint(i,i.landCentre)),near=nav.nearest(aim.x,aim.y,300),goal={x:near[0],y:near[1]};
  assert.ok(setWalkDestination(actor,nav,goal.x,goal.y),`${i.id} can walk inland`);
  let walked=0;
  for(let k=0;k<1200&&actor.path.length;k++){const x=actor.x,y=actor.y;walkStep(actor,nav,.05,k*.05,{x:0,y:0});walked+=Math.hypot(actor.x-x,actor.y-y);assert.ok(nav.walkable(actor.x,actor.y),`${i.id} stays on land`);}
  assert.ok(walked>i.width*.2,`${i.id} walked ${Math.round(walked)}`);
  // the walk area is the islet itself, never the sea round it
  assert.equal(nav.walkable(w.water.x,w.water.y),false);
  // back to the boat: board from the jetty
  const deck=boardingPoint(boat,nav);
  assert.ok(Math.hypot(deck.x-w.tip.x,deck.y-w.tip.y)<90,`${i.id} boards from the jetty tip`);
  assert.ok(setWalkDestination(actor,nav,deck.x,deck.y));
  for(let k=0;k<1200&&actor.path.length;k++)walkStep(actor,nav,.05,k*.05,{x:0,y:0});
  assert.ok(Math.hypot(actor.x-deck.x,actor.y-deck.y)<45,`${i.id} reached the boat`);
  Object.assign(actor,{x:boat.x,y:boat.y,mode:'sailing',sailTarget:null,sailRoute:null});
  const away=localPoint(id,expMap(frame,i.jetty.dir[0]*(i.radius+900),i.jetty.dir[1]*(i.radius+900),WORLD_GEO.Rw));
  const d=Math.hypot(away.x-actor.x,away.y-actor.y);
  for(let k=0;k<40;k++){sailStep(actor,.05,{x:(away.x-actor.x)/d,y:(away.y-actor.y)/d});assert.ok(canSail(actor.x,actor.y,id));}
  assert.ok(Math.hypot(actor.x-boat.x,actor.y-boat.y)>500,`${i.id} sailed off`);
 }
});
test('room server: Dock at an islet lands you on it, you walk, take the boat back and sail off',async()=>{
 const i=ISLETS.find(i=>i.home==='home')??ISLETS[0],id=i.home,w=isletWalk(i.id);
 const room=await makeRoom();
 const frame=transport(i,i.collisionCenter),start=localPoint(id,expMap(frame,i.jetty.dir[0]*(i.radius+300),i.jetty.dir[1]*(i.radius+300),WORLD_GEO.Rw));
 const {actor,socket}=addPlayer(room,4242,{islandId:id,x:start.x,y:start.y,mode:'sailing'});
 const boat=room.boats.find(b=>b.islandId===id&&!b.occupant);
 Object.assign(boat,{x:actor.x,y:actor.y,occupant:actor.id});actor.boatId=boat.id;
 try{
  room.webSocketMessage(socket,JSON.stringify({type:'disembark',seq:1}));
  for(let k=0;k<400&&actor.mode==='sailing';k++)room.step();
  assert.equal(actor.mode,'walking','hopped out onto the islet');
  assert.equal(actor.islandId,id);
  assert.ok(Math.hypot(actor.x-w.land.x,actor.y-w.land.y)<2,'on the jetty end');
  assert.ok(Math.hypot(boat.x-w.water.x,boat.y-w.water.y)<16,'the boat waits beside the jetty');
  const inland=localPoint(id,isletPoint(i,i.landCentre)),to=navOf(id).nearest(inland.x,inland.y,300);
  const info=room.connections.get(socket);info.lastDestination=-Infinity;
  room.webSocketMessage(socket,JSON.stringify({type:'destination',seq:2,x:to[0],y:to[1]}));
  assert.ok(actor.path.length,'a click on the islet walks there');
  for(let k=0;k<400&&actor.path.length;k++)room.step();
  assert.ok(Math.hypot(actor.x-to[0],actor.y-to[1])<40,'walked inland');
  room.webSocketMessage(socket,JSON.stringify({type:'board',seq:3,boatId:boat.id}));
  for(let k=0;k<400&&actor.mode==='walking';k++)room.step();
  assert.equal(actor.mode,'sailing','took the boat back');
  info.lastDestination=-Infinity;
  room.webSocketMessage(socket,JSON.stringify({type:'destination',seq:4,x:start.x,y:start.y}));
  for(let k=0;k<200&&actor.sailTarget;k++)room.step();
  assert.ok(Math.hypot(actor.x-start.x,actor.y-start.y)<14,'sailed off again');
 }finally{clearInterval(room.timer);}
});
test('route planner steers round an islet and manual sailing stops at its land',()=>{
 const i=ISLETS[0],frame=transport(i,i.collisionCenter),id=WORLD_ISLANDS.reduce((a,b)=>angle(i.center,a.center)<angle(i.center,b.center)?a:b).id;
 const a=localPoint(id,expMap(frame,-1500,0,WORLD_GEO.Rw)),b=localPoint(id,expMap(frame,1500,0,WORLD_GEO.Rw));
 const route=sailRoute(id,a,b);assert.ok(route?.length>1,'direct line crosses solid islet');
 let last=a;for(const to of route){const steps=Math.ceil(Math.hypot(to.x-last.x,to.y-last.y)/12);for(let k=0;k<=steps;k++){const p={x:last.x+(to.x-last.x)*k/steps,y:last.y+(to.y-last.y)*k/steps};assert.ok(canSail(p.x,p.y,id));}last=to;}
 const actor={...a,islandId:id,mode:'sailing'},p=localPoint(id,i.collisionCenter),d=Math.hypot(p.x-a.x,p.y-a.y);
 for(let k=0;k<300;k++)sailStep(actor,.02,{x:(p.x-a.x)/d,y:(p.y-a.y)/d});
 assert.ok(canSail(actor.x,actor.y,id));assert.ok(Math.hypot(actor.x-p.x,actor.y-p.y)>BOAT_RADIUS);
});
