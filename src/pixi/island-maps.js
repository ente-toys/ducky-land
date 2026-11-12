import expansion from './home-expansion.json' with {type:'json'};
import homeWorld from '../../assets/world/world.json' with {type: 'json'};
import homeWalk from '../../assets/world/walk-world.json' with {type: 'json'};
import READY from './delivered-themes.js';
import {geometry, inPoly, inShape, coastIndex, polygonIndex, shapeIndex} from '../../assets/world/island-geometry.mjs';
import {resolveSleepSpots, sleepHalfWidths, sleeperFootprint} from './sleep-spots.js';
import {createNavigation} from './navigation.js';
import {FINISHED_THEMES, TEST_THEMES, WORLD_ISLANDS} from './world-map.js';
import {fixThemeWorld, fixThemeBed} from './theme-map-fixes.js';

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
  world = fixThemeWorld(id, world);
  if (walk) walk = fixThemeWorld(id, walk);
  const W = world.width, H = world.height, walking = walk ?? world;
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
  const baseWalk = {...world, ...walking, walkways: [...(walking.walkways ?? []), ...(addJetty ? [JETTY.walkway] : [])]};
  const beds = id === 'home' ? [] : (sleepers ?? (world.sleepSpots ? resolveSleepSpots(baseWalk, world.props ?? [], geometry(baseWalk).walkable, sleepHalfWidths(),
    {spots: world.sleepSpots, avoid: world.sleepAvoid ?? [], warn: false}) : [])).map(bed => fixThemeBed(id, bed)).map(({x, y, pose, r, flip, tree}) => ({x, y, pose, r, flip: Boolean(flip), tree}));
  const walkMap = beds.length ? {...baseWalk, obstacles: [...(baseWalk.obstacles ?? []), ...beds.map(sleeperFootprint)]} : baseWalk;
  let NAV = null;
  const nav = () => NAV ??= createNavigation(walkMap, {cellSize: walking.navigationCellSize ?? 32});
  const shoreFor = (x, y, reach = 280) => {const p = nav().nearest(x, y, reach); return p ? {x: Math.round(p[0]), y: Math.round(p[1])} : null;};
  const localWet = (x, y) => !landAt(x, y) && Array.from({length: 16}, (_, i) => i * Math.PI / 8).every(a => !landAt(x + Math.cos(a) * BOAT_RADIUS, y + Math.sin(a) * BOAT_RADIUS));
  let SPOTS = null;
  const boatSpots = () => SPOTS ??= (() => {
    if (harbor.boats?.length) return harbor.boats.map(({x, y, turn}) => ({x: Math.round(x), y: Math.round(y), turn: turn ?? Math.PI}));
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
    return spots;
  })();
  let FIELD = null;
  const field = () => FIELD ??= landDistance(landAt, W, H, world.origin);
  const spawn = harbor.spawn ?? world.zones?.plaza?.spawn ?? [W / 2, H / 2];
  return {id, width: W, height: H, origin: world.origin ?? {x:0,y:0}, cx:(world.origin?.x ?? 0)+W/2, cy:(world.origin?.y ?? 0)+H/2, world, walk: walkMap, baseWalk, sleepers: beds, JETTY, HARBOR, spawn: {x: spawn[0], y: spawn[1]}, landAt, nav, shoreFor, boatSpots, field,
    art, sea, home: id === 'home', centre: centre ?? coastCentre(walking.coast)};
}

function coastCentre(coast) {
  let x = 0, y = 0;
  for (const p of coast) {x += p[0]; y += p[1];}
  return {x: x / coast.length, y: y / coast.length};
}

function landDistance(landAt, W, H, origin = {x:0,y:0}) {
  const RES = FIELD_RES, PAD = FIELD_PAD, X0 = origin.x - PAD, Y0 = origin.y - PAD, FW = Math.ceil((W + 2 * PAD) / RES), FH = Math.ceil((H + 2 * PAD) / RES);
  const d = new Float32Array(FW * FH).fill(1e9);
  const h = RES / 2, subs = [[0, 0], [-h, -h], [h, -h], [-h, h], [h, h]];
  for (let r = 0; r < FH; r++) for (let c = 0; c < FW; c++) {
    const x = X0 + c * RES, y = Y0 + r * RES;
    if (subs.some(([u, v]) => landAt(x + u, y + v))) d[r * FW + c] = 0;
  }
  const D = RES, DD = RES * Math.SQRT2;
  for (let r = 0; r < FH; r++) for (let c = 0; c < FW; c++) {
    const i = r * FW + c; let v = d[i];
    if (c > 0) v = Math.min(v, d[i - 1] + D);
    if (r > 0) {v = Math.min(v, d[i - FW] + D); if (c > 0) v = Math.min(v, d[i - FW - 1] + DD); if (c < FW - 1) v = Math.min(v, d[i - FW + 1] + DD);}
    d[i] = v;
  }
  for (let r = FH - 1; r >= 0; r--) for (let c = FW - 1; c >= 0; c--) {
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
  const birds = Array.from({length: 6}, (_, k) => given.birds?.[k] ?? zones[k]?.at ?? ring(k, 6, 900)).map(onLand);
  const garden = zones.find(z => /garden|flower|field|meadow|heart|tree|story/i.test(z.name)) ?? zones[1] ?? zones[0];
  const butterflies = Array.from({length: 2}, (_, k) => given.butterflies?.[k] ?? (garden ? [garden.at[0] + 120 + k*480, garden.at[1] + 60] : ring(k, 2, 500))).map(onLand);
  return {birds, butterflies};
}
