import data from './islets-data.json' with {type:'json'};
import odyssey from '../../public/pixi-art/islets/odyssey.meta.json' with {type:'json'};
import treeAndRowboat from '../../public/pixi-art/islets/tree-and-rowboat.meta.json' with {type:'json'};
import brokenShipwreck from '../../public/pixi-art/islets/broken-shipwreck.meta.json' with {type:'json'};
import smallMountain from '../../public/pixi-art/islets/04-small-mountain.meta.json' with {type:'json'};
import lighthouseRock from '../../public/pixi-art/islets/05-lighthouse-rock.meta.json' with {type:'json'};
import palmTreasure from '../../public/pixi-art/islets/06-palm-treasure.meta.json' with {type:'json'};
import pinkBlossom from '../../public/pixi-art/islets/07-pink-blossom.meta.json' with {type:'json'};
import snowIgloo from '../../public/pixi-art/islets/08-snow-igloo.meta.json' with {type:'json'};
import spookyPurple from '../../public/pixi-art/islets/09-spooky-purple.meta.json' with {type:'json'};
import volcano from '../../public/pixi-art/islets/11-volcano.meta.json' with {type:'json'};
import coralAtoll from '../../public/pixi-art/islets/12-coral-atoll.meta.json' with {type:'json'};
import {WORLD_GEO,WORLD_ISLANDS} from './world-map.js';
import {sphereFrame,expMap,logMap,angle} from './sphere.js';
import {localPoint} from './sphere-coordinates.js';
import {inPoly} from '../../rive/web/island-geometry.mjs';
export const ISLET_SEED=data.seed;
export const ISLET_ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
// boss 8 Nov ("the perspective of the islets is bad", "wtf is that docking port"): every islet is hand-drawn SVG with its
// jetty drawn in the art (public/pixi-art/islets/<art>.svg). Its <art>.meta.json, in the same 1024 viewBox, says where that
// jetty runs, which ground is walkable and which props stand on it. Here they are laid into each islet's own tangent frame
// (x east, y south, world units).
export const ISLET_META=Object.fromEntries([odyssey,treeAndRowboat,brokenShipwreck,smallMountain,lighthouseRock,palmTreasure,pinkBlossom,snowIgloo,spookyPurple,volcano,coralAtoll].map(m=>[m.art,m]));
export const ISLET_VIEWBOX=1024;
const BOAT_ROOM=46+26;   // the boat's radius plus a little water between hull and jetty tip
// The art is drawn for our camera (ground from above, props standing up facing south), so an islet must never turn: its
// frame is rolled until its east runs straight across the screen of its home island, the view you sail and walk it in.
function upright(i,home){
 let roll=0;
 const p=localPoint(home,sphereFrame(i.lon,i.lat).center);
 for(let k=0;k<4;k++){const f=sphereFrame(i.lon,i.lat,roll),q=localPoint(home,expMap(f,100,0,WORLD_GEO.Rw));roll+=Math.atan2(q.y-p.y,q.x-p.x);}
 return sphereFrame(i.lon,i.lat,roll);
}
function layout(i){
 const centre=sphereFrame(i.lon,i.lat).center;
 const near=WORLD_ISLANDS.reduce((a,b)=>angle(centre,a.center)<angle(centre,b.center)?a:b);
 const frame=upright(i,near.id),m=ISLET_META[i.art],k=i.width/ISLET_VIEWBOX;
 const map=([u,v])=>[(u-ISLET_VIEWBOX/2)*k,(v-ISLET_VIEWBOX/2)*k],ring=r=>r.map(map);
 const coast=ring(m.land),lakes=m.holes.map(ring),blocked=m.blocked.map(b=>ring(b.polygon));
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [x,y]of coast){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const c=[(x0+x1)/2,(y0+y1)/2];
 // Broad phase for boat collision. The exact coast and prop footprints are tested below.
 const radius=Math.max(...[...coast,...blocked.flat()].map(([x,y])=>Math.hypot(x-c[0],y-c[1])))+i.width*.02;
 const foot=map(m.jetty.foot),tip=map(m.jetty.tip),len=Math.hypot(tip[0]-foot[0],tip[1]-foot[1]),dir=[(tip[0]-foot[0])/len,(tip[1]-foot[1])/len];
 const at=t=>[tip[0]+dir[0]*t,tip[1]+dir[1]*t];
 // Where the boat ties up. Off an east or west jetty it waits past the tip; off a south (or north) jetty it lies alongside
 // the tip on the side away from the island's middle, because a boat stands up on screen and would cover the deck and the Ducky stepping off it.
 const out=(tip[0]-c[0])*-dir[1]+(tip[1]-c[1])*dir[0],side=out>=0?[-dir[1],dir[0]]:[dir[1],-dir[0]],across=Math.abs(dir[1])>Math.abs(dir[0]);
 const water=across?[tip[0]-dir[0]*40+side[0]*(m.jetty.width*k/2+BOAT_ROOM-12),tip[1]-dir[1]*40+side[1]*(m.jetty.width*k/2+BOAT_ROOM-12)]:at(BOAT_ROOM);
 const jetty={foot,tip,land:at(-26),water,dir,width:m.jetty.width*k};
 return {...i,...frame,radius,home:near.id,coast,lakes,blocked,jetty,landCentre:c,collisionCenter:expMap(frame,c[0],c[1],WORLD_GEO.Rw),cap:Math.cos(i.width*.71/WORLD_GEO.Rw)};
}
export const ISLETS=data.placements.map(layout);
// Shared by authoritative room simulation, boat route planning and client prediction.
// Chord distance is a conservative lower bound on geodesic distance.
export function isletClearance(p,limit=Infinity){
 let best=limit;
 for(const i of ISLETS){
  const c=i.collisionCenter,x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2],squared=x*x+y*y+z*z;
  if(squared>=((best+i.radius)/WORLD_GEO.Rw)**2)continue;
  const q=logMap(i,p,WORLD_GEO.Rw);
  // The broad circle only culls distant islets. The actual sand boundary leaves
  // water open at short jetties and around long, narrow islets.
  for(const ring of [i.coast,...i.blocked]){
   if(inPoly(q.x,q.y,ring))return 0;
   for(let k=0,j=ring.length-1;k<ring.length;j=k++){
    const a=ring[j],b=ring[k],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((q.x-a[0])*dx+(q.y-a[1])*dy)/(dx*dx+dy*dy||1)));
    best=Math.min(best,Math.hypot(q.x-a[0]-dx*t,q.y-a[1]-dy*t));
   }
  }
 }
 return Math.max(0,best);
}
// a point of islet i's own tangent frame on the sphere
export const isletPoint=(i,[x,y])=>expMap(i,x,y,WORLD_GEO.Rw);
