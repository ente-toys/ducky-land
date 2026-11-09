import {sphereFrame, logMap} from './sphere.js';
// Home and the eight delivered themes, with stable save identities.
// Pure placement data shared by the live client, room worker and tests.
// Coordinates here are 'map' coordinates; each island plays in its own local coordinates, and
// offsetOf(a, b) turns one island's local coordinates into the other's.
import world from '../../rive/web/world.json' with {type: 'json'};
import READY from '../../rive/web/themes/index.js';   // the delivered themes, for their map sizes (boss 6 Nov: themed islands are bigger)

const W = 5800, H = 4400; // stable world layout, independent of Home's expanding bounds
// The delivered roster, in finish order. Exactly Home plus these eight themes.
export const FINISHED_THEMES = ['sunflower', 'pink', 'library', 'community', 'fair', 'cathedral', 'bog', 'snow'];
export const TEST_THEMES = FINISHED_THEMES.slice(0, 3);
// Existing save identities and display metadata, not placement or finish order.
// Changes to the roster need an explicit save identity here and an angular anchor below.
export const THEMED_ISLANDS = [
  ['blossom', 'sunflower', 'Sunbob Fields', 0xf2c53d],
  ['sunset', 'pink', 'Rosybutton Bay', 0xf29bb7],
  ['isle-251', 'library', 'Pagepond', 0xd9b578],
  ['isle-250', 'community', 'Campfire Commons', 0xb98cf0],
  ['isle-170', 'fair', 'Waddlewish Fair', 0xf29bb7],
  ['isle-176', 'cathedral', 'Bellovo Piazza', 0xd9b578],
  ['isle-249', 'bog', 'Booquack Bog', 0xb98cf0],
  ['isle-55', 'snow', 'Iceland', 0x9fd4ff],
];
export const sizeOfTheme = theme => {const w = theme && theme !== 'home' ? READY?.[theme]?.world : null; return w?.width > 0 && w?.height > 0 ? {width: w.width, height: w.height} : theme === 'home' || !theme ? {width:world.width,height:world.height} : {width:W,height:H};};
export const ISLAND_COUNT = 1 + FINISHED_THEMES.length;

// Deliberate groups with unequal gaps, an isolated polar ice cap and southern sea.
// Angles only author the unit vectors. Every island uses its OWN tangent frame.
// boss 8 Nov 15:25 picked layout C "real little planet": cold band under the Iceland cap, warm belt round Home, Bog alone in the far south.
// Order = FINISHED_THEMES: sunflower, pink, library, community, fair, cathedral, bog, snow.
const ANCHORS = [
  [55.7, 25.7], [-74.1, -5.7], [66, -34], [-107.4, 36.9], [154.3, -32.5],
  [-31.8, -35.3], [0, -90], [0, 90],
];   // boss 8 Nov 17:05: spread to shrink the biggest empty sea patch (17.4 -> 14.2 deg); Iceland N pole, fight club S pole
// After moving an anchor or changing the globe size: coastGaps() (sphere-shores.js) must keep BOAT_CHANNEL between every
// pair of real coasts, jetties included, then re-place the islets with `node scripts/islets/place.mjs`.
const RAD=Math.PI/180;
export const SPHERE_CIRCUMFERENCE=74000;   // spacing is checked on the real coasts: coastGaps() in sphere-shores.js
const BASE_SIZES=new Map(['home',...FINISHED_THEMES].map(t=>[t,sizeOfTheme(t)]));
export function layoutWorld(sizeOf=sizeOfTheme,seed=11,finished=FINISHED_THEMES){
 const out=[{index:0,id:'home',name:'Home Island',accent:0xffda69,tint:0xffffff,lon:0,lat:0,...sizeOf('home')}];
 for(const theme of finished){
  const k=FINISHED_THEMES.indexOf(theme),meta=THEMED_ISLANDS.find(row=>row[1]===theme);
  if(!meta||k<0)throw Error(`No stable island identity for ${theme}`);
  const [lon,lat]=ANCHORS[k];out.push({index:k+1,id:meta[0],theme,name:meta[2],accent:meta[3],tint:0xffffff,lon:lon*RAD,lat:lat*RAD,...sizeOf(theme)});
 }
 // Maps bigger than their delivered size grow the whole globe by the same factor, so every coast keeps its angular
 // footprint and every channel only widens. Delivered sizes give scale 1.
 let scale=1;
 for(const i of out){
  if(!(i.width>0&&i.height>0&&Number.isFinite(i.width+i.height)))throw Error(`Invalid map bounds for ${i.id}`);
  const base=BASE_SIZES.get(i.theme??'home');scale=Math.max(scale,i.width/base.width,i.height/base.height);
 }
 const Rw=SPHERE_CIRCUMFERENCE/(2*Math.PI)*scale,SX=2*Math.PI*Rw,wrapd=(v,p)=>v-p*Math.round(v/p);
 const islands=out.map(i=>({...i,...sphereFrame(i.lon,i.lat),x:W/2+i.lon*Rw,y:H/2-i.lat*Rw}));
 return {islands,Rw,SX,wrapd,bounds:{x0:W/2-SX/2,x1:W/2+SX/2,y0:H/2-Math.PI*Rw/2,y1:H/2+Math.PI*Rw/2}};
}

const MAP = layoutWorld();
export const WORLD_ISLANDS = MAP.islands;
export const MAP_BOUNDS = MAP.bounds;
export const WORLD_GEO = {SX: MAP.SX, Rw: MAP.Rw, wrapd: MAP.wrapd, latOf: y => -(y - H / 2) / MAP.Rw};
const byId = new Map(WORLD_ISLANDS.map(island => [island.id, island]));
export const worldIsland = id => byId.get(id);
// how far island b sits from island a, in a's local coordinates (east-west takes the short way round the globe)
export function offsetOf(a, b) {
  const A = byId.get(a), B = byId.get(b);
  return logMap(A,B.center,MAP.Rw);
}
// the islands you can sail to from this one: its four nearest, plus any island that counts this one among its four
// nearest, so every route also runs back the other way and the whole world is one connected sea
const nearest = id => WORLD_ISLANDS.filter(island => island.id !== id).map(island => ({island, ...offsetOf(id, island.id)}))
  .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)).slice(0, 4);
const LINKS = new Map(WORLD_ISLANDS.map(island => [island.id, new Set()]));
for (const island of WORLD_ISLANDS) for (const {island: other} of nearest(island.id)) {LINKS.get(island.id).add(other.id); LINKS.get(other.id).add(island.id);}
const NEIGHBOURS = new Map();
export function neighboursOf(id) {
  if (!NEIGHBOURS.has(id)) NEIGHBOURS.set(id, [...LINKS.get(id)].map(other => ({island: byId.get(other), ...offsetOf(id, other)}))
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)));
  return NEIGHBOURS.get(id);
}
// copyHolding (which neighbour's copy a boat out at sea is drawn in) lives in sphere-shores.js, beside the real coasts.
