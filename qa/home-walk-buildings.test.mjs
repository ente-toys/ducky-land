import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {HOME_MAP, mapFor, readyThemes} from '../src/world/island-maps.js';
import {geometry, inShape} from '../assets/world/island-geometry.mjs';
import {createNavigation} from '../src/world/navigation.js';
import {homeBuildingAt, homeBuildingTarget, isHomeBuilding} from '../src/world/home/home-buildings.js';
import {MUSEUM_DOOR, atMuseumDoor, setWalkDestination, walkStep} from '../src/gameplay/player-motion.js';
import {sleepHalfWidths} from '../src/world/home/sleep-spots.js';

// Rebuild the real client map, rather than testing a simplified house fixture.
const vite = await createServer({configFile:false, cacheDir:'/private/tmp/ducky-walk-a-buildings-qa', optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true,hmr:false,ws:false,watch:null}, logLevel:'error'});
let buildings, client, siloShrub;
try {
  const P = await vite.ssrLoadModule('/src/world/home/placements.js');
  const {harborClear, harborWorld} = await vite.ssrLoadModule('/src/gameplay/islands.js');
  const original = JSON.parse(readFileSync(new URL('../src/world/home/home-original-world.json', import.meta.url)));
  const world = P.trimWorld(JSON.parse(readFileSync(new URL('../assets/world/world.json', import.meta.url))));
  const props = P.createPlacements().filter(harborClear);
  siloShrub = props.find(p => p.id === 'hamlet-clovercrust-silo-front-shrub');
  const local = harborWorld(P.walkWorld(world, props));
  const beds = P.sleepSpots(local, props, geometry(local).walkable, sleepHalfWidths());
  client = createNavigation({...local, obstacles:[...local.obstacles, ...beds.map(P.sleeperFootprint)]});
  buildings = props.filter(isHomeBuilding).map(p => {const collision=p.footprint,all=[collision,...(p.occlusionBlockers??[])],xs=all.flatMap(s=>s.poly?s.poly.map(q=>q[0]):[s.x-s.rx,s.x+s.rx]),ys=all.flatMap(s=>s.poly?s.poly.map(q=>q[1]):[s.y-s.ry,s.y+s.ry]);return {...p,collision,perimeter:{poly:[[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)],[Math.min(...xs),Math.max(...ys)]]}};});
} finally {await vite.close();}
const nav = HOME_MAP.nav(), spawn = [HOME_MAP.spawn.x, HOME_MAP.spawn.y];
const centre = f => f.poly ? [f.poly.reduce((s,p)=>s+p[0],0)/f.poly.length, f.poly.reduce((s,p)=>s+p[1],0)/f.poly.length] : [f.x,f.y];
const radius = f => f.poly ? [Math.max(...f.poly.map(p=>p[0]))-Math.min(...f.poly.map(p=>p[0])), Math.max(...f.poly.map(p=>p[1]))-Math.min(...f.poly.map(p=>p[1]))].map(v=>v/2) : [f.rx,f.ry];
// A radial ellipse falls inside a rectangular wall at the diagonals. Sample
// a rectangular perimeter for polygon bases so the full wall-route coverage
// survives the switch from the old undersized cottage ellipses.
const beside = (f,x,y,rx,ry,a,pad) => {
  const c=Math.cos(a),s=Math.sin(a),k=f.poly?1/Math.max(Math.abs(c),Math.abs(s)):1;
  return [x+c*k*(rx+pad),y+s*k*(ry+pad)];
};
function clearRoute(n, start, click, label) {
  const path = n.route(...start, ...click);
  assert.ok(path.length, `${label}: reachable target ${start} -> ${click}`);
  let prev = start;
  for (const p of path) {assert.ok(n.walkable(...p), `${label}: waypoint outside solids`);assert.ok(n.clearLine(prev,p), `${label}: clear leg ${prev} -> ${p}`);prev=p;}
  return path;
}
const actorAt = ([x,y]) => ({x,y,previousX:x,previousY:y,turn:0,path:[],until:0,action:0,travel:0,emoteVersion:0});
const left = a => a.path.reduce((s,p,i) => s + Math.hypot(p[0]-(i?a.path[i-1][0]:a.x),p[1]-(i?a.path[i-1][1]:a.y)),0);
function follow(start, click, dt, label) {
  const a = actorAt(start), end = setWalkDestination(a,nav,...click);
  assert.ok(end, `${label}: destination ${start} -> ${click}`);
  const points = [start, ...a.path], deadline = left(a)/200 + 5;
  let t=0;
  while (a.path.length && t<deadline) {
    const before=left(a), count=a.path.length;
    walkStep(a,nav,dt,t+=dt,{x:0,y:0});
    assert.ok(nav.walkable(a.x,a.y), `${label}: stayed outside walls`);
    assert.ok(nav.clearLine([a.previousX,a.previousY],[a.x,a.y]), `${label}: no collision recovery ${start} -> ${click}, dt=${dt}, ${a.previousX},${a.previousY} -> ${a.x},${a.y}, t=${t}`);
    assert.ok(a.path.length<=count && left(a)<before-1e-8, `${label}: forward route progress, no oscillation or stall ${start} -> ${click}, dt=${dt}, ${a.previousX},${a.previousY} -> ${a.x},${a.y}, before=${before}, after=${left(a)}, t=${t}, next=${a.path[0]}`);
    assert.ok(points.slice(1).some((p,i)=>{
      const q=points[i],dx=p[0]-q[0],dy=p[1]-q[1],k=Math.max(0,Math.min(1,((a.x-q[0])*dx+(a.y-q[1])*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(a.x-q[0]-dx*k,a.y-q[1]-dy*k)<1e-6;
    }), `${label}: followed the route without wall sliding`);
  }
  assert.deepEqual([a.x,a.y],end, `${label}: reached exact outside target`);
  for(let k=0;k<20;k++)walkStep(a,nav,dt,t+=dt,{x:0,y:0});
  assert.deepEqual([a.x,a.y],end, `${label}: no bounce after arrival`);
  assert.equal(a.travel,0);assert.equal(a.action,0);
}

test('every Home building has a solid footprint, with identical client and room destinations',()=>{
  assert.ok(buildings.length>=25, `${buildings.length} buildings including all shops and landmarks`);
  for(const b of buildings) {
    const f=b.collision,c=centre(f);
    assert.ok(f && !nav.walkable(...c) && !client.walkable(...c), `${b.id}: solid base`);
    const path=clearRoute(nav,spawn,c,b.id);
    assert.equal(inShape(...path.at(-1),f,16),false, `${b.id}: blocked click resolves outside`);
    assert.deepEqual(client.route(...spawn,...c),path, `${b.id}: local prediction matches authority`);
    const roof={x:b.x,y:b.y-b.height*b.scale*.7},target=homeBuildingTarget(b,roof);
    const clicked=clearRoute(nav,spawn,[target.x,target.y],`${b.id} roof`);
    assert.equal(inShape(...clicked.at(-1),f,16),false, `${b.id}: roof click stops outside`);
    if(b.id===34)assert.equal(atMuseumDoor(...clicked.at(-1)),false,'museum roof does not enter the room');
  }
});

test('routes beginning beside every Home wall never cut a building on the first or final connector',t=>{
  let checked=0;
  for(const b of buildings) {
    const f=b.perimeter,[x,y]=centre(f),[rx,ry]=radius(f);
    const targets=[[x,y],[x-rx-24,y],[x+rx+24,y],[x,y-ry-24],[x,y+ry+24]];
    for(let k=0;k<96;k++) {
      const a=k*Math.PI/48,start=beside(f,x,y,rx,ry,a,20);
      if(!nav.walkable(...start)||!nav.route(...spawn,...start).length)continue;
      for(const click of targets){
        if(nav.walkable(...click)&&!nav.route(...spawn,...click).length)continue;
        clearRoute(nav,start,click,b.id);checked++;
      }
    }
  }
  assert.ok(checked>=4000, `${checked} wall-adjacent routes`);
  t.diagnostic(`${buildings.length} buildings, ${checked} reachable wall-adjacent routes`);
});

test('click walking around every Home building finishes without wall sliding, oscillation or bounce at 60 fps and server tick',()=>{
  for(const b of buildings) {
    const f=b.collision,[x,y]=centre(f),[rx,ry]=radius(f);
    for(let k=0;k<8;k++) {
      const a=k*Math.PI/4,start=beside(f,x,y,rx,ry,a,28);
      if(!nav.walkable(...start)||!nav.route(...spawn,...start).length)continue;
      // Across the wall and into the wall both exercised the dropped connector.
      for(const click of [[x,y],[x-Math.cos(a)*(rx+32),y-Math.sin(a)*(ry+32)]])
        if(!nav.walkable(...click)||nav.route(...spawn,...click).length)
          for(const dt of [1/60,.05])follow(start,click,dt,b.id);
    }
  }
});

test('a blocked Home click skips an unreachable pocket for the nearest reachable outside verge',()=>{
  const box=(x0,y0,x1,y1)=>({poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]});
  const w={width:1000,height:1000,coast:[[0,0],[1000,0],[1000,1000],[0,1000]],walkways:[],islets:[],water:[],bridges:[],obstacles:[box(470,350,530,650),box(530,350,730,380),box(530,620,730,650),box(700,350,730,650)]};
  const n=createNavigation(w,{safeEndpoints:true});
  const path=clearRoute(n,[200,500],[500,500],'pocket');
  assert.ok(path.at(-1)[0]<470,'outside on the reachable west side');
  assert.equal(Math.hypot(path.at(-1)[0]-500,path.at(-1)[1]-500),48,'first reachable sampled ring');
});

test('Home route lines reject a sub-pixel wall graze that three-unit samples miss',()=>{
  const w={width:1000,height:1000,coast:[[0,0],[1000,0],[1000,1000],[0,1000]],walkways:[],islets:[],water:[],bridges:[],obstacles:[{x:500,y:500,rx:10,ry:10}]};
  const a=[498.8,525.999],b=[501.8,525.999],n=createNavigation(w,{safeEndpoints:true});
  assert.ok(n.walkable(...a)&&n.walkable(...b));
  assert.equal(createNavigation(w).clearLine(a,b),true,'old sampling misses the graze');
  assert.equal(n.clearLine(a,b),false,'whole segment checked against the padded wall');
  assert.equal(n.clearLine([NaN,0],b),false,'invalid clicks cannot enter the segment traversal');
});

test('the narrow reachable verge between the silo and its yard props retains a complete route',()=>{
  const start=[5304.638564286262,-405.6730880654188],target=[5360.5,-488.2];
  clearRoute(nav,spawn,start,'silo approach');
  clearRoute(nav,start,target,'silo narrow verge');
  for(const dt of [1/60,.05])follow(start,target,dt,'silo narrow verge');
});

test('the merged solid silo-front shrub preserves both directions of the client and room approach',()=>{
  const verge=[5304.638564286262,-405.6730880654188],behind=[5360.5,-488.2];
  // Keep the original exact verge and the broad bush blocker. Moving the
  // destination or dropping collision would hide the merged enclosure.
  const f=siloShrub.footprint;
  for(const n of [nav,client])assert.equal(n.walkable(f.x,f.y),false,'shrub stays solid');
  for(const [from,to] of [[spawn,verge],[verge,spawn],[verge,behind],[behind,verge]]){
    const path=clearRoute(nav,from,to,'merged silo approach');
    assert.deepEqual(path.at(-1),to);
    assert.deepEqual(client.route(...from,...to),path,'client and room agree');
  }
});

test('building hit testing follows rendered roof bounds and draw order, while museum entry is confined to the real door',()=>{
  const sprite=(x,y,w,h)=>({visible:true,getBounds:()=>({x,y,width:w,height:h})});
  const rear={id:'rear',asset:'house-blue',x:0,y:10,sprite:sprite(0,0,100,100)};
  const front={id:'front',asset:'house-rose',x:0,y:20,sprite:sprite(0,40,100,100)};
  assert.equal(homeBuildingAt([front,rear],{x:50,y:5}),rear,'roof above the ground base is clickable');
  assert.equal(homeBuildingAt([rear,front],{x:50,y:50}),front,'front building wins an overlap');
  assert.equal(homeBuildingAt([rear],{x:150,y:5}),undefined,'outside the rendered building');
  const museum=buildings.find(b=>b.id===34),door={x:MUSEUM_DOOR.x,y:1195};
  assert.ok(nav.walkable(door.x,door.y));assert.ok(atMuseumDoor(door.x,door.y));
  assert.deepEqual(homeBuildingTarget(museum,door),door,'actual threshold keeps interior entry');
  for(const p of [[2920,900],[2920,-830],[2820,1195],[3020,1195],[2920,1340]])assert.equal(atMuseumDoor(...p),false,'wall, roof, other homes and steps do not enter');
  const entry=clearRoute(nav,[MUSEUM_DOOR.out.x,MUSEUM_DOOR.out.y],[door.x,door.y],'museum doorway');
  assert.deepEqual(entry.at(-1),[door.x,door.y]);
});

test('safe Home connectors do not enable a routing change on other islands',()=>{
  for(const id of readyThemes()) {
    const m=mapFor(id),n=m.nav(),legacy=createNavigation(m.walk,{cellSize:m.walk.navigationCellSize??32,safeEndpoints:false});
    for(const z of Object.values(m.world.zones??{}).slice(0,3)) {
      if(!z.spawn)continue;
      assert.deepEqual(n.route(m.spawn.x,m.spawn.y,...z.spawn),legacy.route(m.spawn.x,m.spawn.y,...z.spawn),id);
    }
  }
});
