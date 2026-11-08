// boss 8 Nov ("I should be able to dock here"): walking on the 11 sea islets. Each islet walks in the chart of its nearest
// real island (islet.home), so a Ducky ashore on an islet is simply on that island, far out in its sea. Pure data: the room
// server, the live client and the tests share it.
import {ISLETS,ISLET_SCALE} from './islets.js';
import {placeIslet} from './islet-placement.js';
import {createNavigation} from './navigation.js';
import {mapsVersion} from './island-maps.js';

let SEEN=-1;const BY_HOME=new Map(),COMPOSITE=new Map();
const fresh=()=>{if(SEEN!==mapsVersion()){SEEN=mapsVersion();BY_HOME.clear();COMPOSITE.clear();}};
const chart=(id,i,p)=>{const q=placeIslet(id,i,p);return [q.x,q.y];};
function walkOf(i){
 const id=i.home,coast=i.coast.map(p=>chart(id,i,p)),lakes=i.lakes.map(r=>({poly:r.map(p=>chart(id,i,p))}));
 // the props drawn standing on it (horse, trunks, igloo, gravestone...) from its meta.json: walked round, never through
 const props=i.blocked.map(r=>({poly:r.map(p=>chart(id,i,p))}));
 const at=p=>{const [x,y]=chart(id,i,p);return {x:Math.round(x),y:Math.round(y)};};
 const foot=at(i.jetty.foot),tip=at(i.jetty.tip);
 const walkway={a:[foot.x,foot.y],b:[tip.x,tip.y],w:i.jetty.width};
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const [x,y]of [...coast,walkway.a,walkway.b]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 const box={x0:Math.floor(x0)-64,y0:Math.floor(y0)-64,x1:Math.ceil(x1)+64,y1:Math.ceil(y1)+64};
 const world={origin:{x:box.x0,y:box.y0},width:box.x1-box.x0,height:box.y1-box.y0,coast,walkways:[walkway],islets:[],bridges:[],water:lakes,obstacles:props};
 return {islet:i,id,box,world,walkway,land:at(i.jetty.land),water:at(i.jetty.water),foot,tip,nav:createNavigation(world,{cellSize:8*ISLET_SCALE})};
}
// the islets that walk in island `id`'s chart
export function isletWalks(id){
 fresh();
 if(!BY_HOME.has(id))BY_HOME.set(id,ISLETS.filter(i=>i.home===id).map(walkOf));
 return BY_HOME.get(id);
}
export const isletWalk=isletId=>{const i=ISLETS.find(i=>i.id===isletId);return i?isletWalks(i.home).find(w=>w.islet===i):null;};
const inBox=(w,x,y,pad=0)=>x>=w.box.x0-pad&&y>=w.box.y0-pad&&x<=w.box.x1+pad&&y<=w.box.y1+pad;
export const isletAt=(id,x,y,pad=0)=>isletWalks(id).find(w=>inBox(w,x,y,pad))??null;
// may a walker in island id's chart aim at (x,y): on the island map itself, or on one of its islets
export function inWalkArea(map,id,x,y){
 if(x>=map.origin.x&&y>=map.origin.y&&x<map.origin.x+map.width&&y<map.origin.y+map.height)return true;
 return Boolean(isletAt(id,x,y));
}
// The island's own walking map joined with its islets'. Every query goes to the one piece the point is on: islets and the
// island never touch (open sea between), so a route never crosses from one to another.
export function walkNav(id,base){
 fresh();
 const walks=isletWalks(id);
 if(!walks.length)return base;
 let byBase=COMPOSITE.get(id);if(!byBase)COMPOSITE.set(id,byBase=new WeakMap());
 if(byBase.has(base))return byBase.get(base);
 const pieceAt=(x,y)=>walks.find(w=>inBox(w,x,y)&&w.nav.walkable(x,y))?.nav ?? null;
 const nav={
  islets:walks,
  walkable:(x,y)=>Boolean(base.walkable?.(x,y))||walks.some(w=>inBox(w,x,y)&&w.nav.walkable(x,y)),
  clearLine:(a,b)=>Boolean(base.clearLine?.(a,b))||walks.some(w=>inBox(w,...a)&&inBox(w,...b)&&w.nav.clearLine(a,b)),
  nearest(x,y,radius=150){
   let best=base.nearest?.(x,y,radius)??null,d=best?Math.hypot(best[0]-x,best[1]-y):Infinity;
   for(const w of walks){if(!inBox(w,x,y,radius))continue;const p=w.nav.nearest(x,y,radius);if(p&&Math.hypot(p[0]-x,p[1]-y)<d){best=p;d=Math.hypot(p[0]-x,p[1]-y);}}
   return best;
  },
  route(sx,sy,tx,ty){
   // on an islet (or just off its edge) its own map routes; anywhere else the island's own map does, exactly as before
   const piece=pieceAt(sx,sy)??walks.find(w=>inBox(w,sx,sy)&&w.nav.nearest(sx,sy,48))?.nav??base;
   return piece.route(sx,sy,tx,ty);
  },
 };
 byBase.set(base,nav);
 return nav;
}
