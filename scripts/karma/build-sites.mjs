import {writeFile} from 'node:fs/promises';
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
import {mapOf} from '../../src/pixi/island-maps.js';
import {ISLETS} from '../../src/pixi/islets.js';
import {isletWalk} from '../../src/pixi/islet-walk.js';
const sites=[];
for(const island of WORLD_ISLANDS.filter(i=>i.theme!=='bog')){
 const map=mapOf(island.id),nav=map.nav(),points=[];
 const candidates=[];
 for(let row=0;row<10;row++)for(let col=0;col<12;col++){
  const x=map.origin.x+(col+.45)*map.width/12,y=map.origin.y+(row+.55)*map.height/10;
  if(Math.hypot(x-map.spawn.x,y-map.spawn.y)<900||!map.landAt(x,y))continue;
  const p=nav.nearest(x,y,220);if(!p||!nav.walkable(...p))continue;
  if(!nav.route(map.spawn.x,map.spawn.y,...p)?.length)continue;
  candidates.push({x:p[0],y:p[1]});
 }
 while(candidates.length&&points.length<24){
  let best=0,score=-Infinity;
  candidates.forEach((p,i)=>{const d=points.length?Math.min(...points.map(q=>Math.hypot(p.x-q.x,p.y-q.y))):Math.hypot(p.x-map.spawn.x,p.y-map.spawn.y);if(d>score){best=i;score=d;}});
  const [p]=candidates.splice(best,1);if(score<650)break;points.push(p);
 }
 if(points.length<6)throw Error('Too few reachable sites '+island.id);
 points.forEach((p,k)=>sites.push({id:`${island.id}-${k}`,region:island.id,islandId:island.id,...p}));
}
for(const islet of ISLETS){
 const walk=isletWalk(islet.id),points=[];
 for(const [u,v]of [[.5,.5],[.35,.55],[.65,.5],[.5,.7],[.6,.35]]){
  const x=walk.box.x0+(walk.box.x1-walk.box.x0)*u,y=walk.box.y0+(walk.box.y1-walk.box.y0)*v,p=walk.nav.nearest(x,y,400);
  if(!p||points.some(q=>Math.hypot(p[0]-q.x,p[1]-q.y)<120)||!walk.nav.route(walk.land.x,walk.land.y,...p)?.length)continue;
  points.push({x:p[0],y:p[1]});
 }
 // Walk.land is an object; route from that exact authored dock for validation.
 if(!points.length){const p=walk.nav.nearest(walk.land.x,walk.land.y,120);if(p)points.push({x:p[0],y:p[1]});}
 points.forEach((p,k)=>sites.push({id:`${islet.id}-${k}`,region:islet.id,islandId:islet.home,...p}));
}
await writeFile(new URL('../../src/pixi/karma-sites.json',import.meta.url),JSON.stringify(sites,null,2)+'\n');
console.log(sites.length+' reachable feather sites');
