import {sphereFrame,expMap} from './sphere.js';
// Equirectangular sailing chart of the unchanged live globe. Units match its circumference.
export const SEA_WIDTH=80000, SEA_HEIGHT=40000, SEA_VERSION=1;
export const FLAT_RADIUS=19475.34714565078; // legacy chart radius, retained for local route grid phase
export const FLAT_RING=['isle-55','blossom','isle-251','isle-249','sunset','isle-250'];
export const SEA_ANCHORS={home:[0,0],blossom:[67,8],'isle-251':[140.8,-8],sunset:[-142.7,-8],'isle-250':[-68.9,8],'isle-55':[0,90],'isle-249':[0,-90]};
export const FLAT_POSITIONS=Object.fromEntries(Object.entries(SEA_ANCHORS).map(([id,[lon,lat]])=>[id,{x:lon*SEA_WIDTH/360,y:-lat*SEA_WIDTH/360}]));
export const wrapSea=x=>x-SEA_WIDTH*Math.floor((x+SEA_WIDTH/2)/SEA_WIDTH);
export const nearestSeaX=(x,reference)=>x-SEA_WIDTH*Math.floor((x-reference+SEA_WIDTH/2)/SEA_WIDTH);
export function flatOffset(from,to){const a=FLAT_POSITIONS[from],b=FLAT_POSITIONS[to];return {x:b.x-a.x,y:b.y-a.y};}
// A straight course can run through either pole. The next band reverses
// latitude and shifts longitude by half a turn. Two bands make a full lap.
export const nearestSeaY=(y,reference)=>y-SEA_WIDTH*Math.round((y-reference)/SEA_WIDTH);
export function seaImages(x,y,reference,centreY){
 const direct={x:nearestSeaX(x,reference.x),y:nearestSeaY(y,reference.y),flip:1};
 const reflected={x:nearestSeaX(x+SEA_WIDTH/2,reference.x),
   y:nearestSeaY(2*centreY+SEA_HEIGHT-y,reference.y),flip:-1};
 return [direct,reflected];
}
export function nearestSeaImage(x,y,reference,centreY){
 const [direct,reflected]=seaImages(x,y,reference,centreY);
 const distance=p=>(p.x-reference.x)**2+(p.y-reference.y)**2;
 return distance(reflected)<distance(direct)?reflected:direct;
}
export function seaLonLat(x,y){
 const band=Math.floor((y+SEA_HEIGHT/2)/SEA_HEIGHT),flip=band%2===0?1:-1;
 return {lon:wrapSea(x+(flip<0?SEA_WIDTH/2:0))/SEA_WIDTH*2*Math.PI,
   lat:-flip*(y-band*SEA_HEIGHT)/SEA_WIDTH*2*Math.PI,flip};
}
// Frozen pre-wrap offsets, used only to keep the live globe exactly as shipped.
export const GLOBE_ISLET_OFFSETS={
 'sea-1-1':{home:'isle-249',x:0,y:9500},
 'sea-2-1':{home:'home',x:-9500,y:0},
 'sea-3-1':{home:'isle-55',x:0,y:-10000},
 'sea-6-1':{home:'isle-251',x:10000,y:1000},
 'sea-7-1':{home:'sunset',x:-9000,y:5500},
 'sea-11-1':{home:'isle-251',x:4500,y:9500},
};

// Unwrap the existing globe islet centres, preserving their owners and globe positions.
const ISLET_PULL={'sea-2-1':.78,'sea-6-1':.84};
export const FLAT_ISLETS=Object.fromEntries(Object.entries(GLOBE_ISLET_OFFSETS).map(([id,spot])=>{
 const [lon,lat]=SEA_ANCHORS[spot.home],frame=sphereFrame(lon*Math.PI/180,lat*Math.PI/180),pull=ISLET_PULL[id]??.72;
 const c=expMap(frame,spot.x*pull,spot.y*pull,SEA_WIDTH/(2*Math.PI)),home=FLAT_POSITIONS[spot.home];
 return [id,{home:spot.home,x:Math.atan2(c[0],c[2])*SEA_WIDTH/(2*Math.PI)-home.x,y:-Math.asin(Math.max(-1,Math.min(1,c[1])))*SEA_WIDTH/(2*Math.PI)-home.y}];
}));
