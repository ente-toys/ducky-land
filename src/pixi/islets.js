import data from './islets-data.json' with {type:'json'};
import {ISLET_SCALE} from './islet-scale.js';
export {ISLET_SCALE};
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
import {placeIslet,unplaceIslet} from './islet-placement.js';
import {inPoly} from '../../assets/world/island-geometry.mjs';
export const ISLET_SEED=data.seed;
export const ISLET_ART=['odyssey','tree-and-rowboat','broken-shipwreck','04-small-mountain','05-lighthouse-rock','06-palm-treasure','07-pink-blossom','08-snow-igloo','09-spooky-purple','11-volcano','12-coral-atoll'];
export const ISLET_META=Object.fromEntries([odyssey,treeAndRowboat,brokenShipwreck,smallMountain,lighthouseRock,palmTreasure,pinkBlossom,snowIgloo,spookyPurple,volcano,coralAtoll].map(m=>[m.art,m]));
export const ISLET_VIEWBOX=1024;
const BOAT_ROOM=46+26;
export function layoutIslet(i){
 const centre=sphereFrame(i.lon,i.lat).center;
 const distance=a=>angle(centre,a.center);
 const near=WORLD_ISLANDS.reduce((a,b)=>distance(a)<distance(b)?a:b);
 const frame=sphereFrame(i.lon,i.lat),m=ISLET_META[i.art],k=i.width/ISLET_VIEWBOX;
 const map=([u,v])=>[(u-ISLET_VIEWBOX/2)*k,(v-ISLET_VIEWBOX/2)*k],ring=r=>r.map(map);
 const coast=ring(m.land),lakes=m.holes.map(ring),blocked=m.blocked.map(b=>ring(b.polygon));
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [x,y]of coast){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const c=[(x0+x1)/2,(y0+y1)/2];
 const radius=Math.max(...[...coast,...blocked.flat()].map(([x,y])=>Math.hypot(x-c[0],y-c[1])))+i.width*.02;
 const foot=map(m.jetty.foot),tip=map(m.jetty.tip),len=Math.hypot(tip[0]-foot[0],tip[1]-foot[1]),dir=[(tip[0]-foot[0])/len,(tip[1]-foot[1])/len];
 const at=t=>[tip[0]+dir[0]*t,tip[1]+dir[1]*t];
 const out=(tip[0]-c[0])*-dir[1]+(tip[1]-c[1])*dir[0],side=out>=0?[-dir[1],dir[0]]:[dir[1],-dir[0]],across=Math.abs(dir[1])>Math.abs(dir[0]);
 const water=across?[tip[0]-dir[0]*40+side[0]*(m.jetty.width*k/2+BOAT_ROOM-12),tip[1]-dir[1]*40+side[1]*(m.jetty.width*k/2+BOAT_ROOM-12)]:at(BOAT_ROOM);
 const jetty={foot,tip,land:at(-26),water,dir,width:m.jetty.width*k};
 return {...i,...frame,radius,home:near.id,coast,lakes,blocked,jetty,landCentre:c,collisionCenter:expMap(frame,c[0],c[1],WORLD_GEO.Rw),cap:Math.cos(i.width*.71/WORLD_GEO.Rw)};
}
export const ISLETS=data.placements.map(layoutIslet);
export function isletClearance(p,limit=Infinity,id=null){
 let best=limit;
 for(const i of ISLETS){
  let q;
  if(id!==null){
   const c=placeIslet(id,i,i.landCentre);
   if(Math.hypot(p.x-c.x,p.y-c.y)>=best+i.radius)continue;
   q=unplaceIslet(id,i,p);
  }else{
   const c=i.collisionCenter,x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2];
   if(x*x+y*y+z*z>=((best+i.radius)/WORLD_GEO.Rw)**2)continue;
   q=logMap(i,p,WORLD_GEO.Rw);
  }
  best=isletLocalClearance(i,q,best);
 }
 return Math.max(0,best);
}
export const isletPoint=(i,[x,y])=>expMap(i,x,y,WORLD_GEO.Rw);

export function isletLocalClearance(i,q,limit=Infinity){
 let best=limit;
 for(const ring of [i.coast,...i.blocked]){
  if(inPoly(q.x,q.y,ring))return 0;
  for(let k=0,j=ring.length-1;k<ring.length;j=k++){
   const a=ring[j],b=ring[k],dx=b[0]-a[0],dy=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((q.x-a[0])*dx+(q.y-a[1])*dy)/(dx*dx+dy*dy||1)));
   best=Math.min(best,Math.hypot(q.x-a[0]-dx*t,q.y-a[1]-dy*t));
  }
 }
 return best;
}
