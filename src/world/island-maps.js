import {finishWork} from '../gameplay/work-steps.js';
import {BOAT_GAP,boatSeparated,nearestBoatSpace} from '../gameplay/boat-spacing.js';
import {outlineBogProps,loadBogScene,bogSceneReady} from './prop-outlines/bog-scene.js';
import snowSleepers from '../../assets/world/themes/snow/sleepers.json' with {type:'json'};
import {outlineSnowProps,loadSnowScene,snowSceneReady} from './prop-outlines/snow-scene.js';
import librarySleepers from '../../assets/world/themes/library/sleepers.json' with {type:'json'};
import {outlineLibraryProps,loadLibraryScene,librarySceneReady} from './prop-outlines/library-scene.js';
import communitySleepers from '../../assets/world/themes/community/sleepers.json' with {type:'json'};
import {outlineCommunityProps,loadCommunityScene,communitySceneReady} from './prop-outlines/community-scene.js';
import pinkSleepers from '../../assets/world/themes/pink/sleepers.json' with {type:'json'};
import {hasPropOutlines,propObstacles,homeHouseBases} from './prop-outlines/islands.js';
import {outlinePinkProps,loadPinkScene,pinkSceneReady} from './prop-outlines/pink-scene.js';
import expansion from './home/home-expansion.json' with {type:'json'};
import homeWorld from '../../assets/world/world.json' with {type: 'json'};
import {blockerFilter} from './walk-rule.js';
import homeWalk from '../../assets/world/walk-world.json' with {type: 'json'};
import READY from './delivered-themes.js';
import {geometry, inPoly, inShape, coastIndex, polygonIndex, shapeIndex} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots, sleepHalfWidths} from './home/sleep-spots.js';
import {createNavigation} from './navigation.js';
// Boats: the port holds its moorings; more wait all round the island, one on every stretch of coast COAST_SPREAD long.
export const PORT_BOATS=3, PORT_CLEAR=1000, COAST_SPREAD=2000;
import {FINISHED_THEMES, TEST_THEMES, WORLD_ISLANDS} from './world-map.js';

export {FINISHED_THEMES};
export const THEME_IDS = ['home', ...FINISHED_THEMES];
export {TEST_THEMES};
export const THEME_OF = new Map(WORLD_ISLANDS.filter(i => i.theme).map(i => [i.id,i.theme]));
export const themeOfIsland = id => THEME_OF.get(id) ?? 'home';

const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) <= r;
const BOAT_RADIUS = 46;
export const FIELD_RES = 25, FIELD_PAD = 700;

const HOME_JETTY = expansion.jetty;
const trimHome = w => ({...w, islets: w.islets.filter(a => ![3930, 3340, 2290, 5450].includes(a[0])), walkways: w.walkways.filter(b => ![3940, 3320, 2320, 5050].includes(b.a[0]))});

export function makeMap(id, {world, walk = null, harbor, art = null, sea = null, centre = null, addJetty = true, sleepers = null}) {
  const liveBog=art==='/pixi-art/themes/bog-arena/art.json';
  const enabled=liveBog||hasPropOutlines(id === 'pink' ? 'sunset' : id === 'library' ? 'isle-251' : id === 'community' ? 'isle-250' : id === 'snow' ? 'isle-55' : id) && id !== 'home';
  const scene=liveBog?{ready:bogSceneReady,outline:outlineBogProps}:id==='library'?{ready:librarySceneReady,outline:outlineLibraryProps}:id==='community'?{ready:communitySceneReady,outline:outlineCommunityProps}:id==='snow'?{ready:snowSceneReady,outline:outlineSnowProps}: {ready:pinkSceneReady,outline:outlinePinkProps};
  const deferred=enabled&&!scene.ready();
  const W = world.width, H = world.height;
  let walking = walk ?? world;
  const FOOT = {x: harbor.jetty.foot[0], y: harbor.jetty.foot[1]}, TIP = {x: harbor.jetty.tip[0], y: harbor.jetty.tip[1]};
  const JETTY_W = harbor.jetty.width ?? 104, AXIS = Math.hypot(TIP.x - FOOT.x, TIP.y - FOOT.y);
  const DIR = {x: (TIP.x - FOOT.x) / AXIS, y: (TIP.y - FOOT.y) / AXIS};
  const along = (t, side = 0) => ({x: FOOT.x + DIR.x * t - DIR.y * side, y: FOOT.y + DIR.y * t + DIR.x * side});
  const JETTY = {foot: FOOT, tip: TIP, width: JETTY_W, length: AXIS, angle: Math.atan2(DIR.x, -DIR.y), wetFrom: .14, dir: DIR, along, art: harbor.jetty.art ?? null,
    walkway: {a: [Math.round(along(-55).x), Math.round(along(-55).y)], b: [Math.round(along(AXIS - 44).x), Math.round(along(AXIS - 44).y)], w: JETTY_W}};
  let moorings;
  if (id === 'home') moorings = expansion.boats.map(({x,y})=>({x,y}));
else if (harbor.boats?.length) moorings = harbor.boats.map(({x, y}) => ({x, y}));
  else moorings = [[.62, 150], [.75, -150], [.88, 150]].map(([k, side]) => {const p = along(AXIS * k, side); return {x: Math.round(p.x), y: Math.round(p.y)};});
  const water = harbor.water ?? along(AXIS + 20, 125);
  const HARBOR = {land: {x: JETTY.walkway.b[0], y: JETTY.walkway.b[1]}, water: {x: Math.round(water.x), y: Math.round(water.y)},
    pier: {x: Math.min(FOOT.x, TIP.x) - JETTY_W / 2, y: Math.min(FOOT.y, TIP.y), width: Math.abs(FOOT.x - TIP.x) + JETTY_W, height: Math.abs(FOOT.y - TIP.y)}, moorings};
  const onJetty = (x, y, pad) => {
    const t = Math.max(0, Math.min(AXIS, (x - FOOT.x) * DIR.x + (y - FOOT.y) * DIR.y)), p = along(t);
    return Math.hypot(x - p.x, y - p.y) < JETTY_W / 2 + pad;
  };
  const islets = world.islets ?? [], walkways = (id === 'home' ? walking.walkways : world.walkways) ?? world.walkways ?? [];
  let coastTests=null;
  const coastContains=(x,y)=>{
    coastTests??=(world.boatCoast?[world.boatCoast]:[...new Set([walking.coast,world.coast])]).map(poly=>({contains:polygonIndex(poly),index:coastIndex(poly)}));
    return coastTests.some(({contains,index})=>{const side=index(x,y);return side===1||side===2&&contains(x,y);});
  };
  const boatWater=(world.boatWater??[]).map(poly=>({poly,x0:Math.min(...poly.map(p=>p[0])),x1:Math.max(...poly.map(p=>p[0])),y0:Math.min(...poly.map(p=>p[1])),y1:Math.max(...poly.map(p=>p[1]))}));
  let waterNear=null;
  const riverAt=(x,y)=>{
    waterNear??=shapeIndex(boatWater,0);
    return waterNear(x,y).some(w=>x>w.x0&&x<w.x1&&y>w.y0&&y<w.y1&&inPoly(x,y,w.poly));
  };
  const solidDecks=walkways.filter(w=>!w.boatPassUnder).map(({a,b,w})=>({a,b,w,dx:b[0]-a[0],dy:b[1]-a[1],l2:(b[0]-a[0])**2+(b[1]-a[1])**2,x0:Math.min(a[0],b[0])-w/2,x1:Math.max(a[0],b[0])+w/2,y0:Math.min(a[1],b[1])-w/2,y1:Math.max(a[1],b[1])+w/2}));
  function landAt(x, y) {
    if (x < (world.origin?.x ?? 0) - 600 || y < (world.origin?.y ?? 0) - 600 || x > (world.origin?.x ?? 0) + W + 600 || y > (world.origin?.y ?? 0) + H + 600) return false;
    if (onJetty(x, y, 4) || coastContains(x,y) && !riverAt(x,y)) return true;
    if (islets.some(([cx, cy, rx, ry]) => inShape(x, y, {x: cx, y: cy, rx, ry}))) return true;
    return solidDecks.some(({a,w,dx,dy,l2,x0,x1,y0,y1})=>{
      if(x<x0||x>x1||y<y0||y>y1)return false;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l2));
      return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<w/2;
    });
  }
  // Sailing, world layout and mooring loops need only the cheap coastline and
  // harbour data above. Build exact prop/sleeper obstacles on first walking use.
  let baseWalk, beds, walkMap;
  function buildWalking() {
    if(walkMap)return;
    if(enabled&&!deferred){
      if(id==='pink')sleepers??=pinkSleepers;
      if(id==='snow'&&world.sleepSpots)sleepers??=snowSleepers;
      if(id==='library'&&world.sleepSpots)sleepers??=librarySleepers;
      if(id==='community')sleepers??=communitySleepers;
      const props=scene.outline(liveBog?world.props:world.props??[]);
      world={...world,props};
      const ids=new Set(props.map(p=>p.id));
      const structures=(walk??world).obstacles.filter(o=>liveBog?!ids.has(o.id):o.name&&!ids.has(o.name));
      walk={...(walk??world),props,navigationCellSize:16,indexPropContours:true,obstacles:[...structures,...propObstacles(props)]};
    }
    walking = walk ?? world;
    // Houses block only at their base on every island except Bog, whose buildings are paint-fight cover.
    if (!/^bog/.test(id) && walking.obstacles) walking = {...walking, obstacles: homeHouseBases(walking.obstacles, id !== 'home')};
    const sources = [...(world.props ?? []), ...(id === 'home' ? [...homeWorld.props.map(p=>({...p,id:Number(p.artboard.replace('Prop ',''))})),...expansion.props] : [])];
    if (walking.obstacles) walking = {...walking, obstacles: walking.obstacles.filter(blockerFilter(sources))};
    baseWalk = {...world, ...walking, walkways: [...(walking.walkways ?? []), ...(addJetty ? [JETTY.walkway] : [])]};
    beds = id === 'home' || deferred ? [] : (sleepers ?? (world.sleepSpots ? resolveSleepSpots(baseWalk, world.props ?? [], geometry(baseWalk).walkable, sleepHalfWidths(),
      {spots: world.sleepSpots, avoid: world.sleepAvoid ?? [], warn: false}) : [])).map(({x, y, pose, r, flip, tree, approach}) => ({x, y, pose, r, flip: Boolean(flip), tree, ...(approach?{approach}:{})}));
    walkMap = baseWalk; // sleeping Ducks are walkable (boss rule)
  }
  let NAV = null;
  const nav = () => {
    if(deferred)throw Error(`${id} layout is not ready`);
    buildWalking();
    return NAV ??= createNavigation(walkMap, {cellSize: walking.navigationCellSize ?? 32});
  };
  const shoreFor = (x, y, reach = 280) => {
    const n = nav(), p = n.nearest(x, y, reach);
    if (!p) return null;
    const rounded = {x: Math.round(p[0]), y: Math.round(p[1])};
    return n.walkable(rounded.x, rounded.y) ? rounded : {x:p[0], y:p[1]};
  };
  const localWet = (x, y) => !landAt(x, y) && Array.from({length: 16}, (_, i) => i * Math.PI / 8).every(a => !landAt(x + Math.cos(a) * BOAT_RADIUS, y + Math.sin(a) * BOAT_RADIUS));
  // Use the authored collision shapes, before deferred walking preparation changes
  // them, so server and browser pick identical slots even during island prefetch.
  const MOORING_HULL=160;
  const mooringProps=(world.props ?? []).filter(p=>p.width&&p.height).map(p=>{
    const w=p.width*(p.scale??1),h=p.height*(p.scale??1),x=p.x-w*(p.anchor?.x??.5),y=p.y-h*(p.anchor?.y??1);
    return {poly:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]};
  });
  const mooringObstacles = [...mooringProps,...(walking.obstacles ?? []),...(walking.bridges ?? []).map(b=>b.poly?b:{x:b.x,y:b.y,rx:b.w/2,ry:b.h/2})];
  const mooringNear=shapeIndex(mooringObstacles.map(o=>({...o,clearance:MOORING_HULL+16})),MOORING_HULL+16);
  const boardingGround=geometry({...world,...walking,indexPropContours:false,walkways:[...walkways,JETTY.walkway]}).walkable;
  const mooringBoardable = p => {
    if(near(p,HARBOR.water,600)){
      const t=Math.max(AXIS*JETTY.wetFrom,Math.min(AXIS-44,(p.x-FOOT.x)*DIR.x+(p.y-FOOT.y)*DIR.y));
      const q=along(t);
      return near(p,q,295) && boardingGround(q.x,q.y);
    }
    for(let r=40;r<=260;r+=40)for(let k=0;k<24;k++){
      const a=k*Math.PI/12;
      if(boardingGround(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r))return true;
    }
    return false;
  };
  const mooringWet = p => localWet(p.x,p.y) && !mooringNear(p.x,p.y).some(o=>inShape(p.x,p.y,o,MOORING_HULL+16)) &&
    Array.from({length:16},(_,k)=>k*Math.PI/8).every(a=>{
      const x=p.x+Math.cos(a)*MOORING_HULL,y=p.y+Math.sin(a)*MOORING_HULL;
      return !landAt(x,y);
    });
  const spaceMoorings = spots => {
    const placed=[];
    for(const [slot,spot] of spots.entries()){
      const at=nearestBoatSpace(spot,p=>boatSeparated(p,HARBOR.water,BOAT_GAP+24) && placed.every(q=>boatSeparated(p,q,BOAT_GAP+1)) && mooringWet(p) && mooringBoardable(p));
      if(!at){if(slot<PORT_BOATS)throw Error(`No safe mooring on ${id}`);continue;}   // a coast boat with no safe water is skipped
      placed.push({...spot,...at});
    }
    // HARBOR and boatSpots describe the same harbour slots.
    return placed;
  };
  let SPOTS = null;
  // The port keeps its moorings only (2-3 boats). Every other boat waits on the open coast around the island,
  // spread out so each part of the shore has one to board.
  const aroundIsland = spots => {
    const port=spots.slice(0,PORT_BOATS),c=centre ?? coastCentre(walking.coast);
    // Hand-placed boats (Home's fleet, Pagepond's river paperboats) stay unless they crowd the port itself.
    const coast=spots.slice(PORT_BOATS).filter(p=>Math.hypot(p.x-HARBOR.water.x,p.y-HARBOR.water.y)>PORT_CLEAR);
    const order=[0,180,90,270,45,225,135,315,22.5,202.5,112.5,292.5,67.5,247.5,157.5,337.5];
    for(const deg of order){
      const a=deg*Math.PI/180;
      // Come in from the open sea, so inner lakes and rivers are never mistaken for the coast.
      const o=world.origin??{x:0,y:0},edge=Math.min(...[[Math.cos(a),c.x,o.x,o.x+W],[Math.sin(a),c.y,o.y,o.y+H]]
        .map(([d,p,lo,hi])=>Math.abs(d)<1e-6?Infinity:((d>0?hi:lo)-p)/d))-200;
      for(let r=edge;r>300;r-=20){
        const x=c.x+Math.cos(a)*r,y=c.y+Math.sin(a)*r;
        if(!landAt(x,y))continue;
        const bx=Math.round(x+Math.cos(a)*145),by=Math.round(y+Math.sin(a)*145);
        if(Math.hypot(bx-HARBOR.water.x,by-HARBOR.water.y)>PORT_CLEAR*2 && [...port,...coast].every(o=>Math.hypot(o.x-bx,o.y-by)>COAST_SPREAD) &&
          !nav().walkable(bx,by) && localWet(bx,by) && shoreFor(bx,by,200))coast.push({x:bx,y:by,turn:Math.cos(a)<0?-Math.PI/2:Math.PI/2});
        break;
      }
    }
    return [...port,...coast];
  };
  const boatSpots = () => SPOTS ??= (() => {
    if (harbor.boats?.length) return spaceMoorings(aroundIsland(harbor.boats.map(({x, y, turn}) => ({x: Math.round(x), y: Math.round(y), turn: turn ?? Math.PI}))));
    const spots = [0, 1, 2].map(i => ({...moorings[i], turn: Math.PI}));
    const c = centre ?? coastCentre(walking.coast);
    for (const [cx, cy, rx, ry] of islets) {
      const a = Math.atan2(cy - c.y, cx - c.x);
      spots.push({x: Math.round(cx + Math.cos(a) * (rx * 1.25 + 70)), y: Math.round(cy + Math.sin(a) * (ry * 1.25 + 55)), turn: Math.cos(a) < 0 ? -Math.PI / 2 : Math.PI / 2});
    }
    for (const deg of [150, 175, 200, 225]) {
      const a = deg * Math.PI / 180;
      for (let r = 600; r < 5000; r += 20) {
        const x = c.x + Math.cos(a) * r * 1.3, y = c.y + Math.sin(a) * r;
        if (!landAt(x, y) && !landAt(x + Math.cos(a) * 60, y + Math.sin(a) * 60) && Math.hypot(x - HARBOR.water.x, y - HARBOR.water.y) > 700) {
          const bx = Math.round(x + Math.cos(a) * 85), by = Math.round(y + Math.sin(a) * 85);
          if (spots.every(o => Math.hypot(o.x - bx, o.y - by) > 300) && !nav().walkable(bx, by) && localWet(bx, by) && shoreFor(bx, by, 200)) spots.push({x: bx, y: by, turn: -Math.PI / 2});
          break;
        }
      }
    }
    return spaceMoorings(aroundIsland(spots));
  })();
  Object.defineProperty(HARBOR,'moorings',{enumerable:true,get:()=>boatSpots().slice(0,Math.min(PORT_BOATS,moorings.length)).map(({x,y})=>({x,y}))});
  let fieldValue, builder;
  function* fieldSteps() {
    if (!fieldValue) builder ??= landDistance(landAt, W, H, world.origin);
    while (!fieldValue) {
      const next = builder.next();
      if (next.done) {
        fieldValue = next.value;
        builder = undefined;
      } else yield next.value;
    }
    return fieldValue;
  }
  const field = () => finishWork(fieldSteps());
  const spawn = harbor.spawn ?? world.zones?.plaza?.spawn ?? [W / 2, H / 2];
  return {id, width: W, height: H, origin: world.origin ?? {x:0,y:0}, cx:(world.origin?.x ?? 0)+W/2, cy:(world.origin?.y ?? 0)+H/2, get world(){buildWalking();return world;}, get walk(){buildWalking();return walkMap;}, get baseWalk(){buildWalking();return baseWalk;}, get sleepers(){buildWalking();return beds;}, JETTY, HARBOR, spawn: {x: spawn[0], y: spawn[1]}, landAt, nav, shoreFor, boatSpots, field, fieldSteps, get cachedField(){return fieldValue;},
    art, sea, home: id === 'home', centre: centre ?? coastCentre(walking.coast)};
}

function coastCentre(coast) {
  let x = 0, y = 0;
  for (const p of coast) {x += p[0]; y += p[1];}
  return {x: x / coast.length, y: y / coast.length};
}

function* landDistance(landAt, W, H, origin = {x:0,y:0}) {
  const RES = FIELD_RES, PAD = FIELD_PAD, X0 = origin.x - PAD, Y0 = origin.y - PAD, FW = Math.ceil((W + 2 * PAD) / RES), FH = Math.ceil((H + 2 * PAD) / RES);
  const d = new Float32Array(FW * FH).fill(1e9);
  const h = RES / 2, subs = [[0, 0], [-h, -h], [h, -h], [-h, h], [h, h]];
  for (let r = 0; r < FH; r++) for (let c = 0; c < FW; c++) {
    yield 2;
    const x = X0 + c * RES, y = Y0 + r * RES;
    if (subs.some(([u, v]) => landAt(x + u, y + v))) d[r * FW + c] = 0;
  }
  const D = RES, DD = RES * Math.SQRT2;
  for (let r = 0; r < FH; r++) for (let c = 0; c < FW; c++) {
    if (c % 8 === 0) yield 1;
    const i = r * FW + c; let v = d[i];
    if (c > 0) v = Math.min(v, d[i - 1] + D);
    if (r > 0) {v = Math.min(v, d[i - FW] + D); if (c > 0) v = Math.min(v, d[i - FW - 1] + DD); if (c < FW - 1) v = Math.min(v, d[i - FW + 1] + DD);}
    d[i] = v;
  }
  for (let r = FH - 1; r >= 0; r--) for (let c = FW - 1; c >= 0; c--) {
    if (c % 8 === 7 || c === FW - 1) yield 1;
    const i = r * FW + c; let v = d[i];
    if (c < FW - 1) v = Math.min(v, d[i + 1] + D);
    if (r < FH - 1) {v = Math.min(v, d[i + FW] + D); if (c < FW - 1) v = Math.min(v, d[i + FW + 1] + DD); if (c > 0) v = Math.min(v, d[i + FW - 1] + DD);}
    d[i] = v;
  }
  return {d, FW, FH, X0, Y0};
}

const MAPS = new Map();
let VERSION = 0;
export const mapsVersion = () => VERSION;
MAPS.set('home', makeMap('home', {world: {...trimHome(homeWorld), boatWater: expansion.boatWater ?? []}, walk: homeWalk, harbor: {jetty: HOME_JETTY, boats: expansion.boats, water: expansion.harborWater}, art: null, centre: {x: 2980, y: 2005}, addJetty: false}));
export function registerMap(theme, data) {
  if (!theme || theme === 'home') throw Error('home is fixed');
  try {
    if (!data) MAPS.delete(theme);
    else MAPS.set(theme, makeMap(theme, data));
  } catch (error) {
    console.warn(`theme ${theme}: falling back to the home island`, error?.message ?? error);
    MAPS.delete(theme);
  }
  VERSION++;
  return Boolean(data && MAPS.has(theme));
}
for (const [theme, data] of Object.entries(READY ?? {})) if (THEME_IDS.includes(theme) && theme !== 'home') registerMap(theme, data);

const outlinedScenes={snow:{ready:snowSceneReady,load:loadSnowScene},bog:{ready:bogSceneReady,load:loadBogScene},'bog-arena':{ready:bogSceneReady,load:loadBogScene},pink:{ready:pinkSceneReady,load:loadPinkScene},library:{ready:librarySceneReady,load:loadLibraryScene},community:{ready:communitySceneReady,load:loadCommunityScene}};
const loadedScenes=new Set(Object.entries(outlinedScenes).filter(([,scene])=>scene.ready()).map(([theme])=>theme));
const pendingScenes=new Map();
export const islandMapReady=id=>!outlinedScenes[themeOfIsland(id)]||loadedScenes.has(themeOfIsland(id));
export function prepareIslandMap(id){
  if(islandMapReady(id))return Promise.resolve();
  const theme=themeOfIsland(id);
  if(!pendingScenes.has(theme))pendingScenes.set(theme,outlinedScenes[theme].load().then(()=>{
    // Keep coastline/harbour references held by sailing and scenery consumers.
    Object.defineProperties(MAPS.get(theme),Object.getOwnPropertyDescriptors(makeMap(theme,READY[theme]??READY.bog)));
    VERSION++;
    loadedScenes.add(theme);
  }).catch(error=>{pendingScenes.delete(theme);throw error;}));
  return pendingScenes.get(theme);
}

export const HOME_MAP = MAPS.get('home');
export const mapFor = theme => MAPS.get(theme) ?? HOME_MAP;
export const mapOf = islandId => mapFor(themeOfIsland(islandId));
export const readyThemes = () => [...MAPS.keys()].filter(id => id !== 'home');
export const artOf = islandId => mapOf(islandId).id;

const HOME_AMBIENT = {birds: [[2419, 1928], [3185, 1897], [3427, 2126], [1500, 2600], [4200, 1700], [3900, 2900]], butterflies: [[2230, 2280], [3420, 2270]]};
export function ambientOf(map) {
  if (!map || map.home) return HOME_AMBIENT;
  const onLand = ([x, y]) => map.landAt(x, y) && !map.landAt(-9999, -9999) ? [Math.round(x), Math.round(y)] : [map.spawn.x, map.spawn.y];
  const zones = Object.entries(map.world.zones ?? {}).filter(([name, z]) => name !== 'harbor' && Number.isFinite(z?.x) && Number.isFinite(z?.y))
    .sort(([a], [b]) => (b === 'plaza') - (a === 'plaza')).map(([name, z]) => ({name, at: [z.x, z.y]}));
  const given = map.world.ambient ?? {};
  const ring = (k, n, r) => [map.spawn.x + Math.cos(k / n * 6.283 + .4) * r, map.spawn.y + Math.sin(k / n * 6.283 + .4) * r * .7];
  // Birds hover low and drift about 90 to each side, so a spot on a prop (the Campfire fire sits on the plaza
  // centre) makes a bird look perched on it. Move such a spot to the nearest clear ground.
  const walk = map.nav?.(), clear = ([x, y]) => [-90, 0, 90].every(dx => walk.walkable(x + dx, y));
  const offProps = p => {
    if (!walk?.walkable || clear(p)) return p;
    for (let r = 80; r <= 960; r += 80) for (let i = 0; i < 16; i++) {
      const q = [Math.round(p[0] + Math.cos(i * Math.PI / 8) * r), Math.round(p[1] + Math.sin(i * Math.PI / 8) * r)];
      if (clear(q)) return q;
    }
    return p;
  };
  const birds = Array.from({length: 6}, (_, k) => given.birds?.[k] ?? zones[k]?.at ?? ring(k, 6, 900)).map(onLand).map(offProps);
  const garden = zones.find(z => /garden|flower|field|meadow|heart|tree|story/i.test(z.name)) ?? zones[1] ?? zones[0];
  const butterflies = Array.from({length: 2}, (_, k) => given.butterflies?.[k] ?? (garden ? [garden.at[0] + 120 + k*480, garden.at[1] + 60] : ring(k, 2, 500))).map(onLand);
  return {birds, butterflies};
}
