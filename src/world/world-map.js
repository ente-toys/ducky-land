import {sphereFrame, logMap} from './sphere.js';
import world from '../../assets/world/world.json' with {type: 'json'};
import READY from './delivered-themes.js';

const W = 5800, H = 4400;
export const FINISHED_THEMES = ['sunflower', 'pink', 'library', 'community', 'bog', 'snow'];
export const TEST_THEMES = FINISHED_THEMES.slice(0, 3);
export const THEMED_ISLANDS = [
  ['blossom', 'sunflower', 'Sunbob Fields', 0xf2c53d],
  ['sunset', 'pink', 'Rosybutton Bay', 0xf29bb7],
  ['isle-251', 'library', 'Pagepond', 0xd9b578],
  ['isle-250', 'community', 'Campfire Commons', 0xb98cf0],
  ['isle-249', 'bog', 'Booquack Bog', 0xb98cf0],
  ['isle-55', 'snow', 'Iceland', 0x9fd4ff],
];
export const sizeOfTheme = theme => {const w = theme && theme !== 'home' ? READY?.[theme]?.world : null; return w?.width > 0 && w?.height > 0 ? {width: w.width, height: w.height} : theme === 'home' || !theme ? {width:world.width,height:world.height} : {width:W,height:H};};
export const ISLAND_COUNT = 1 + FINISHED_THEMES.length;

const ANCHORS = [
  [60, 28], [-140, -22], [105, -23], [-85, 29], [0, -90], [0, 90],
];
const RAD=Math.PI/180;
export const SPHERE_CIRCUMFERENCE=74000;
const BASE_SIZES=new Map(['home',...FINISHED_THEMES].map(t=>[t,sizeOfTheme(t)]));
export function layoutWorld(sizeOf=sizeOfTheme,seed=11,finished=FINISHED_THEMES){
 const out=[{index:0,id:'home',name:'Home Island',accent:0xffda69,tint:0xffffff,lon:0,lat:0,...sizeOf('home')}];
 for(const theme of finished){
  const k=FINISHED_THEMES.indexOf(theme),meta=THEMED_ISLANDS.find(row=>row[1]===theme);
  if(!meta||k<0)throw Error(`No stable island identity for ${theme}`);
  const [lon,lat]=ANCHORS[k];out.push({index:k+1,id:meta[0],theme,name:meta[2],accent:meta[3],tint:0xffffff,lon:lon*RAD,lat:lat*RAD,...sizeOf(theme)});
 }
 let scale=1;
 for(const i of out){
  if(!(i.width>0&&i.height>0&&Number.isFinite(i.width+i.height)))throw Error(`Invalid map bounds for ${i.id}`);
  const base=BASE_SIZES.get(i.theme??'home');scale=Math.max(scale,i.width/base.width,i.height/base.height);
 }
 const Rw=SPHERE_CIRCUMFERENCE/(2*Math.PI)*scale,SX=2*Math.PI*Rw,wrapd=(v,p)=>v-p*Math.round(v/p);
 const islands=out.map(i=>({...i,...sphereFrame(i.lon,i.lat),x:W/2+(i.lon*Rw),y:H/2+(-i.lat*Rw)}));
 return {islands,Rw,SX,wrapd,bounds:{x0:W/2-SX/2,x1:W/2+SX/2,y0:H/2-Math.PI*Rw/2,y1:H/2+Math.PI*Rw/2}};
}

const MAP = layoutWorld();
export const WORLD_ISLANDS = MAP.islands;
export const MAP_BOUNDS = MAP.bounds;
export const WORLD_GEO = {SX: MAP.SX, Rw: MAP.Rw, wrapd: MAP.wrapd, latOf: y => -(y - H / 2) / MAP.Rw};
const byId = new Map(WORLD_ISLANDS.map(island => [island.id, island]));
export const worldIsland = id => byId.get(id);
export function offsetOf(a, b) {
  const A = byId.get(a), B = byId.get(b);
  return logMap(A,B.center,MAP.Rw);
}
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
