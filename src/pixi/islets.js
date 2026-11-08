import data from './islets-data.json' with {type:'json'};
import {WORLD_GEO} from './world-map.js';
import {sphereFrame,expMap} from './sphere.js';
export const ISLET_SEED=data.seed;
export const ISLET_ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
export const ISLETS=data.placements.map(i=>{
 const frame=sphereFrame(i.lon,i.lat,i.rotation),radius=i.width*.34;
 return {...i,...frame,radius,collisionCenter:expMap(frame,0,i.width*.10,WORLD_GEO.Rw),cap:Math.cos(i.width*.71/WORLD_GEO.Rw)};
});
// Shared by authoritative room simulation, boat route planning and client prediction.
// Chord distance is a conservative lower bound on geodesic distance.
export function isletClearance(p,limit=Infinity){
 let best=limit;
 for(const i of ISLETS){
  const c=i.collisionCenter,x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2],squared=x*x+y*y+z*z;
  if(squared>=((best+i.radius)/WORLD_GEO.Rw)**2)continue;
  const d=Math.sqrt(squared)*WORLD_GEO.Rw-i.radius;
  if(d<best)best=d;
 }
 return Math.max(0,best);
}
