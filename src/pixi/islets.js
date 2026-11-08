import data from './islets-data.json' with {type:'json'};
import shapes from './islet-shapes.json' with {type:'json'};
import {WORLD_GEO,WORLD_ISLANDS} from './world-map.js';
import {sphereFrame,expMap,logMap,angle} from './sphere.js';
export const ISLET_SEED=data.seed;
export const ISLET_ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
// boss 8 Nov ("I should be able to dock here"): every islet has dry land a Ducky can walk on and a little jetty facing
// open sea. Shapes come from the art itself (scripts/islets/vectorize.py writes islet-shapes.json in the 1024 viewBox the
// SVG is drawn in); here they are laid into each islet's own tangent frame (x east, y south, world units).
export const JETTY_WIDTH=84;
const BOAT_ROOM=46+26;   // the boat's radius plus a little water between hull and jetty tip
function tangent(art,width){
 const s=shapes.shapes[art],k=width/shapes.view,map=r=>r.map(([u,v])=>[(u-shapes.view/2)*k,(v-shapes.view/2)*k]);
 return {coast:map(s.coast),lakes:s.lakes.map(map)};
}
function inRing(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;return inside;}
// the outermost stretch of dry land along the ray from p: [from, to] distances, or null
function outerLand(p,dir,coast,lakes,limit){
 let to=0,from=0;
 for(let t=limit;t>=0;t-=8){
  const x=p[0]+dir[0]*t,y=p[1]+dir[1]*t,dry=inRing(x,y,coast)&&!lakes.some(l=>inRing(x,y,l));
  if(dry&&!to)to=from=t;else if(dry)from=t;else if(to)break;
 }
 return to?{from,to}:null;
}
function layout(i){
 const frame=sphereFrame(i.lon,i.lat,i.rotation),{coast,lakes}=tangent(i.art,i.width);
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [x,y]of coast){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const c=[(x0+x1)/2,(y0+y1)/2];
 // Solid to boats: every bit of walkable ground, plus the beach the walking line keeps Duckies back from.
 const radius=Math.max(...coast.map(([x,y])=>Math.hypot(x-c[0],y-c[1])))+i.width*.035;
 // The jetty faces open sea: away from the nearest real island, turned (within 75 degrees) to wherever the shore
 // reaches furthest out, so the deck stays short.
 const near=WORLD_ISLANDS.reduce((a,b)=>angle(frame.center,a.center)<angle(frame.center,b.center)?a:b);
 const toward=logMap(frame,near.center,WORLD_GEO.Rw),open=Math.atan2(-toward.y,-toward.x);
 let dock=null;
 for(let k=-5;k<=5;k++){
  const a=open+k*Math.PI/12,dir=[Math.cos(a),Math.sin(a)],land=outerLand(c,dir,coast,lakes,radius);
  // the jetty lands on solid ground: at least an eighth of the islet deep, never a thin spit
  if(!land||land.to-land.from<i.width*.12)continue;
  // the art is seen from the south, so a jetty on the far (north) shore would lie across trees and towers drawn there
  const reach=land.to,tip=radius-10,score=tip-reach+Math.abs(k)*i.width*.012+Math.max(0,-dir[1])*i.width*.5;
  if(!dock||score<dock.score)dock={score,dir,reach,tip};
 }
 const at=t=>[c[0]+dock.dir[0]*t,c[1]+dock.dir[1]*t];
 const jetty={foot:at(dock.reach-60),tip:at(dock.tip),land:at(dock.tip-26),water:at(radius+BOAT_ROOM),dir:dock.dir,width:JETTY_WIDTH};
 return {...i,...frame,radius,home:near.id,coast,lakes,jetty,landCentre:c,collisionCenter:expMap(frame,c[0],c[1],WORLD_GEO.Rw),cap:Math.cos(i.width*.71/WORLD_GEO.Rw)};
}
export const ISLETS=data.placements.map(layout);
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
// a point of islet i's own tangent frame on the sphere
export const isletPoint=(i,[x,y])=>expMap(i,x,y,WORLD_GEO.Rw);
