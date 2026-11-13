import test from 'node:test';
import assert from 'node:assert/strict';
import {ISLETS,ISLET_ART,ISLET_SEED,ISLET_SCALE} from '../src/world/islets.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import {sphereShores,sphereShoreGap,BOAT_CHANNEL} from '../src/world/sphere-shores.js';
import {angle,sphereFrame} from '../src/world/sphere.js';
import {mapOf} from '../src/world/island-maps.js';
import {canSail,landingSpot,landingApproach,sailRoute,sailStep,setSailDestination,boardingPoint,navOf,BOAT_RADIUS,ISLANDS,seaBoundsFor} from '../src/gameplay/islands.js';
import {placeIslet,reframeIslet,isletLandingFrame} from '../src/world/islet-placement.js';
import {isletShores,isletHull,flatRingGap} from '../src/world/islet-shores.js';
import {placeRigid} from '../src/world/rigid.js';
import {isletWalk} from '../src/world/islet-walk.js';
import {rigidLandingBasis,easeLandingBasis,cameraMatrix} from '../src/rendering/shared/sphere-camera.js';
import {setWalkDestination,walkStep} from '../src/gameplay/player-motion.js';
import {readFileSync,readdirSync} from 'node:fs';
import {DOMParser as XMLDOMParser} from '@xmldom/xmldom';
import {svgContext} from '../src/rendering/pixi/art/svg-context.js';
import {ISLET_META} from '../src/world/islets.js';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {fileURLToPath} from 'node:url';
const inRing=(x,y,p)=>{let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;return inside;};
test('7 stable islets use each of the seven approved artworks once, without adding islands',()=>{
 assert.equal(ISLET_SEED,831511);assert.equal(ISLETS.length,7);assert.equal(ISLANDS.length,7);
 assert.equal(new Set(ISLETS.map(i=>i.id)).size,7);
 for(const art of ISLET_ART)assert.equal(ISLETS.filter(i=>i.art===art).length,1);
 for(const i of ISLETS){assert.equal(i.width,ISLET_META[i.art].designWidth*ISLET_SCALE,`${i.id} is drawn at its art's own scale`);assert.ok(i.width>=3072&&i.width<=4800);assert.ok(Math.abs(i.lat)<72*Math.PI/180);if(Math.abs(i.lat)>60*Math.PI/180)assert.equal(i.art,'08-snow-igloo');}
 for(const i of ISLETS)for(const j of ISLETS)if(i!==j&&i.art===j.art)assert.ok(angle(i.center,j.center)*WORLD_GEO.Rw>8000);
});
test('all enlarged islet ground and prop bases leave a 600-unit boat channel on the globe and in gameplay',()=>{
 const rings=ISLETS.map(i=>isletShores(i));
 const bounds=new Map(ISLET_ART.map(art=>{const c=svgContext(readFileSync(PUBLIC(`${art}.svg`),'utf8'),t=>new XMLDOMParser().parseFromString(t,'image/svg+xml')),b=c.bounds,out=[b.minX,b.minY,b.maxX,b.maxY];c.destroy();return [art,out];}));
 for(const [k,i]of ISLETS.entries()){
  const [x0,y0,x1,y1]=bounds.get(i.art),scale=i.width/1024;
  const artBox=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>{const p=placeIslet(i.home,i,[(x-512)*scale,(y-512)*scale]);return [p.x,p.y];});
  for(const island of WORLD_ISLANDS){
   const shores=sphereShores(island);
   assert.ok(sphereShoreGap(rings[k],shores)>=BOAT_CHANNEL,`${i.id}/${island.id}: spherical boat channel`);
   const a=isletHull(i).map(p=>{const q=placeIslet(i.home,i,p);return [q.x,q.y];}),m=mapOf(island.id);
   for(const shore of shores){
    const b=shore.local.map(([x,y])=>{const q=placeRigid(i.home,island.id,{x:x+m.cx,y:y+m.cy});return [q.x,q.y];});
    assert.ok(flatRingGap(a,b,BOAT_CHANNEL)>=BOAT_CHANNEL,`${i.id}/${island.id}: rigid gameplay boat channel`);
    assert.ok(flatRingGap(artBox,b,1)>=1,`${i.id}/${island.id}: the complete vector art does not overlap land`);
   }
  }
  for(let j=0;j<k;j++){
   const other=ISLETS[j];
   assert.ok(sphereShoreGap(rings[k],rings[j])>=BOAT_CHANNEL,`${i.id}/${other.id}: islet boat channel`);
   for(const chart of new Set([i.home,other.home])){
    const flat=t=>isletHull(t).map(p=>{const q=placeIslet(chart,t,p);return [q.x,q.y];});
    assert.ok(flatRingGap(flat(i),flat(other),BOAT_CHANNEL)>=BOAT_CHANNEL,`${i.id}/${other.id}: rigid islet boat channel`);
   }
  }
 }
 const sectors=new Set(ISLETS.map(i=>Math.floor((i.lon+Math.PI)/(Math.PI/3))));
 assert.equal(sectors.size,5,'the seven islets span five of the six longitude sectors');
 assert.ok(ISLETS.some(i=>i.lat>.6)&&ISLETS.some(i=>i.lat<-.6),'both hemispheres retain islets');
});
const PUBLIC=f=>fileURLToPath(new URL(`../public/pixi-art/islets/${f}`,import.meta.url));
test('every islet is hand-drawn flat SVG with open shoreline, and no raster islet ships',()=>{
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
  assert.doesNotMatch(svg,/id="jetty"/,`${art}: no jetty in the drawing`);
  assert.ok((svg.match(/<path/g)??[]).length<400,`${art}: hand-drawn, not traced`);
  const m=ISLET_META[art];
  assert.equal(m.art,art);assert.ok(m.land.length>=12);
  assert.ok(inRing(...m.landing.land,m.land),`${art}: landing point on the sand`);
  assert.ok(!inRing(...m.landing.water,m.land),`${art}: boat position out in the water`);
  for(const b of m.blocked)assert.ok(b.polygon.length>=3&&b.what,`${art}: footprint ${b.what}`);
 }
 const view=readFileSync(fileURLToPath(new URL('../src/rendering/pixi/islet-view.js',import.meta.url)),'utf8');
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
 const ctx=svgContext('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#ff0000" fill-opacity=".5"><g transform="translate(10 20) scale(2)"><path d="M0 0 L10 0 L10 10 Z" stroke="#39472D" stroke-width="1.5"/><path d="M0 0 L5 5" fill="none" stroke="#39472D"/></g></svg>',parse);
 const [fill,stroke,line]=ctx.instructions;
 assert.equal(fill.action,'fill');assert.equal(fill.data.style.alpha,.5);
 const bb=fill.data.path.bounds;assert.deepEqual([bb.minX,bb.minY,bb.maxX,bb.maxY],[10,20,30,40]);
 assert.equal(stroke.data.style.width,3);
 assert.equal(line.action,'stroke','fill="none" under a filled group draws no fill');
});
test('boat collision agrees in different island charts and covers every islet\'s walkable land',()=>{
 for(const i of ISLETS)for(const island of WORLD_ISLANDS){
  const p=placeIslet(island.id,i,i.landCentre);
  assert.equal(canSail(p.x,p.y,island.id),false,`${i.id}/${island.id}`);
  const out=placeIslet(island.id,i,[i.landCentre[0]+i.radius+BOAT_RADIUS+80,i.landCentre[1]]);
  const b=seaBoundsFor(island.id);
  if(out.x>=b.x0&&out.x<=b.x1&&out.y>=b.y0&&out.y<=b.y1)assert.equal(canSail(out.x,out.y,island.id),true);
 }
 for(const i of ISLETS){
  for(const q of i.coast){const p=placeIslet(i.home,i,q);assert.equal(canSail(p.x,p.y,i.home),false,`${i.id} land is solid to boats`);}
  const w=isletWalk(i.id);
  assert.ok(navOf(i.home).walkable(w.land.x,w.land.y),`${i.id} landing point is walkable`);
  assert.ok(canSail(w.water.x,w.water.y,i.home),`${i.id} dock water is open`);
  assert.deepEqual(w.world.walkways,[],`${i.id} has no offshore walkways`);
  assert.ok(Math.hypot(w.water.x-w.land.x,w.water.y-w.land.y)<160,`${i.id} the boat waits near the shore`);
  const north=sphereFrame(i.lon,i.lat).north;
  assert.ok(Math.hypot(...north.map((v,k)=>v-i.north[k]))<1e-10,`${i.id} follows geographic north`);
  for(const b of i.blocked){const cx=b.reduce((s,q)=>s+q[0],0)/b.length,cy=b.reduce((s,q)=>s+q[1],0)/b.length,q=placeIslet(i.home,i,[cx,cy]);
   assert.equal(navOf(i.home).walkable(q.x,q.y),false,`${i.id} prop footprint is solid`);}
 }
});
function offshore(id,i,distance){
 const {land,water}=i.landing,dx=water[0]-land[0],dy=water[1]-land[1],length=Math.hypot(dx,dy);
 return placeIslet(id,i,[water[0]+dx*distance/length,water[1]+dy*distance/length]);
}
test('every islet: sail up, dock at its shore, walk its land, board and sail away',()=>{
 for(const i of ISLETS){
  const w=isletWalk(i.id),nav=navOf(i.home),id=i.home;
  const start=offshore(id,i,120);
  assert.ok(canSail(start.x,start.y,id),`${i.id} start at sea`);
  const actor={...start,islandId:id,mode:'sailing',turn:0,path:[]};
  const spot=landingSpot(actor,nav);
  assert.equal(spot?.islet,i.id,`${i.id} offers Dock`);
  assert.equal(spot.islandId,i.home);
  const approach=landingApproach(actor,spot);
  assert.ok(Math.hypot(approach.x-w.water.x,approach.y-w.water.y)<2,`${i.id} sails to the water by the shore`);
  assert.ok(setSailDestination(actor,approach.x,approach.y),`${i.id} has a route to its landing`);
  for(let k=0;k<4000&&actor.sailTarget;k++){sailStep(actor,.05,{x:0,y:0});assert.ok(canSail(actor.x,actor.y,id));}
  assert.ok(Math.hypot(actor.x-approach.x,actor.y-approach.y)<14,`${i.id} reached the landing`);
  Object.assign(actor,{x:spot.x,y:spot.y,mode:'walking',path:[],travel:0,pace:0,heading:null});
  const boat={id:`${id}-0`,islandId:id,x:approach.x,y:approach.y,turn:0};
  assert.ok(nav.walkable(actor.x,actor.y));
  const aim=placeIslet(id,i,i.landCentre),near=nav.nearest(aim.x,aim.y,300*ISLET_SCALE),goal={x:near[0],y:near[1]};
  assert.ok(setWalkDestination(actor,nav,goal.x,goal.y),`${i.id} can walk inland`);
  let walked=0;
  for(let k=0;k<1200&&actor.path.length;k++){const x=actor.x,y=actor.y;walkStep(actor,nav,.05,k*.05,{x:0,y:0});walked+=Math.hypot(actor.x-x,actor.y-y);assert.ok(nav.walkable(actor.x,actor.y),`${i.id} stays on land`);}
  assert.ok(walked>100,`${i.id} traversed inland from its shore`);
  assert.ok(Math.hypot(actor.x-goal.x,actor.y-goal.y)<45,`${i.id} reached the inland destination`);
  assert.equal(nav.walkable(w.water.x,w.water.y),false);
  const deck=boardingPoint(boat,nav);
  assert.ok(Math.hypot(deck.x-w.land.x,deck.y-w.land.y)<2,`${i.id} boards from the shore`);
  assert.ok(setWalkDestination(actor,nav,deck.x,deck.y));
  for(let k=0;k<1200&&actor.path.length;k++)walkStep(actor,nav,.05,k*.05,{x:0,y:0});
  assert.ok(Math.hypot(actor.x-deck.x,actor.y-deck.y)<45,`${i.id} reached the boat`);
  Object.assign(actor,{x:boat.x,y:boat.y,mode:'sailing',sailTarget:null,sailRoute:null});
  let away;
  for(let n=0;n<24&&!away;n++){
   const a=Math.atan2(i.landing.water[1]-i.landing.land[1],i.landing.water[0]-i.landing.land[0])+n*Math.PI/12;
   const p=placeIslet(id,i,[i.landing.water[0]+Math.cos(a)*900,i.landing.water[1]+Math.sin(a)*900]);
   if(canSail(p.x,p.y,id)&&setSailDestination(actor,p.x,p.y))away=p;
  }
  assert.ok(away,`${i.id} has open sea to sail into`);
  for(let n=0;n<4000&&actor.sailTarget;n++){sailStep(actor,.05,{x:0,y:0});assert.ok(canSail(actor.x,actor.y,id));}
  assert.ok(Math.hypot(actor.x-boat.x,actor.y-boat.y)>500,`${i.id} sailed off`);
 }
});
test('room server: Dock at an islet lands you on it, you walk, take the boat back and sail off',async()=>{
 const i=ISLETS.find(i=>i.home==='home')??ISLETS[0],id=i.home,w=isletWalk(i.id);
 const room=await makeRoom();
 const start=offshore(id,i,120);
 const {actor,socket}=addPlayer(room,4242,{islandId:id,x:start.x,y:start.y,mode:'sailing'});
 const boat=room.boats.find(b=>b.islandId===id&&!b.occupant);
 Object.assign(boat,{x:actor.x,y:actor.y,occupant:actor.id});actor.boatId=boat.id;
 try{
  room.webSocketMessage(socket,JSON.stringify({type:'disembark',seq:1}));
  for(let k=0;k<400&&actor.mode==='sailing';k++)room.step();
  assert.equal(actor.mode,'walking','hopped out onto the islet');
  assert.equal(actor.islandId,id);
  assert.ok(Math.hypot(actor.x-w.land.x,actor.y-w.land.y)<2,'on the shore');
  assert.ok(Math.hypot(boat.x-w.water.x,boat.y-w.water.y)<16,'the boat waits beside the shore');
  const inland=placeIslet(id,i,i.landCentre),to=navOf(id).nearest(inland.x,inland.y,300*ISLET_SCALE);
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
 const i=ISLETS[0],id=WORLD_ISLANDS.reduce((a,b)=>angle(i.center,a.center)<angle(i.center,b.center)?a:b).id;
 const a=placeIslet(id,i,[i.landCentre[0]-1000*ISLET_SCALE,i.landCentre[1]]),b=placeIslet(id,i,[i.landCentre[0]+1000*ISLET_SCALE,i.landCentre[1]]);
 const route=sailRoute(id,a,b);assert.ok(route?.length>1,'direct line crosses solid islet');
 let last=a;for(const to of route){const steps=Math.ceil(Math.hypot(to.x-last.x,to.y-last.y)/12);for(let k=0;k<=steps;k++){const p={x:last.x+(to.x-last.x)*k/steps,y:last.y+(to.y-last.y)*k/steps};assert.ok(canSail(p.x,p.y,id));}last=to;}
 const actor={...a,islandId:id,mode:'sailing'},p=placeIslet(id,i,i.landCentre),d=Math.hypot(p.x-a.x,p.y-a.y);
 for(let k=0;k<300;k++)sailStep(actor,.02,{x:(p.x-a.x)/d,y:(p.y-a.y)/d});
 assert.ok(canSail(actor.x,actor.y,id));assert.ok(Math.hypot(actor.x-p.x,actor.y-p.y)>BOAT_RADIUS);
});

test('room server: docking from another rigid chart keeps every islet boat at its shoreline',async()=>{
 const room=await makeRoom();
 try{
  for(const [k,i]of ISLETS.entries()){
   const from=WORLD_ISLANDS.filter(a=>a.id!==i.home).sort((a,b)=>angle(i.center,a.center)-angle(i.center,b.center))[0].id;
   const water=placeIslet(from,i,i.landing.water),w=isletWalk(i.id);
   assert.ok(canSail(water.x,water.y,from),`${i.id} water in ${from}`);
   const {actor,socket}=addPlayer(room,6000+k,{islandId:from,...water,mode:'sailing'});
   const boat=room.boats.find(b=>b.islandId===from&&!b.occupant);
   Object.assign(boat,{...water,occupant:actor.id});actor.boatId=boat.id;
   const spot=landingSpot(actor);assert.equal(spot?.islet,i.id);
   const drawn=placeIslet(from,i,i.landing.land);
   assert.ok(Math.hypot(spot.x+spot.offset.x-drawn.x,spot.y+spot.offset.y-drawn.y)<1e-6);
   room.webSocketMessage(socket,JSON.stringify({type:'disembark',seq:1}));
   for(let n=0;n<10&&actor.mode==='sailing';n++)room.step();
   assert.equal(actor.mode,'walking',`${i.id} docked from ${from}`);
   assert.equal(actor.islandId,i.home);
   assert.ok(Math.hypot(actor.x-w.land.x,actor.y-w.land.y)<2,`${i.id} on the shore`);
   assert.ok(Math.hypot(boat.x-w.water.x,boat.y-w.water.y)<2,`${i.id} boat stays at the landing point after changing chart`);
  }
 }finally{clearInterval(room.timer);}
});

test('an islet landing keeps its drawn art fixed on screen across rigid charts',()=>{
 const screen=(m,p)=>[m.a*p.x+m.c*p.y+m.tx,m.b*p.x+m.d*p.y+m.ty];
 for(const i of ISLETS){
  const from=WORLD_ISLANDS.find(a=>a.id!==i.home).id,to=i.home;
  const camera={...placeIslet(from,i,i.landing.water),zoom:1.8};
  const before=cameraMatrix(camera,1440,900),after={...reframeIslet(from,to,i,camera),zoom:camera.zoom};
  after.basis=easeLandingBasis(rigidLandingBasis(from,to,undefined,isletLandingFrame(from,to,i)),0);
  const matrix=cameraMatrix(after,1440,900);
  for(const q of [i.landing.land,...i.coast]){
   const a=screen(before,placeIslet(from,i,q)),b=screen(matrix,placeIslet(to,i,q));
   assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6,`${i.id}: no jump at its landing`);
  }
 }
});

test('3x scales land, prop footprints and shore landing coordinates',()=>{
 assert.equal(ISLET_SCALE,3);
 const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 for(const i of ISLETS){
  const m=ISLET_META[i.art],k=m.designWidth/1024;
  for(const [n,p]of m.land.entries())for(let a=0;a<2;a++)close(i.coast[n][a],(p[a]-512)*k*3);
  for(const [n,b]of m.blocked.entries())for(const [j,p]of b.polygon.entries())for(let a=0;a<2;a++)close(i.blocked[n][j][a],(p[a]-512)*k*3);
  for(const key of ['land','water'])for(let a=0;a<2;a++)close(i.landing[key][a],(m.landing[key][a]-512)*k*3);
 }
});
