import {DUCK_RADIUS, WALK_SPEED, walkStep} from '../player-motion.js';
export {DUCK_RADIUS,WALK_SPEED};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function inside(p,poly) {
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[i],b=poly[j];
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
export function overlaps(p,r,poly) {
  if(inside(p,poly))return true;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dy=b.y-a.y;
    const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
    if((p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2<r*r)return true;
  }
  return false;
}
const navigations=new WeakMap();
// Adapt arena polygons to the island navigation contract. Index static footprints
// once; a 3px clearLine never scans the whole map or allocates candidate lists.
export function createCombatNavigation(blockers,bounds,r=DUCK_RADIUS){
  const cell=256,cols=Math.ceil(bounds.width/cell)+1,buckets=new Map(),point={x:0,y:0},onLand=bounds.contains??null;
  for(const b of blockers)if(b.blocksWalk){
    const xs=b.polygon.map(p=>p.x),ys=b.polygon.map(p=>p.y);
    const x0=Math.floor((Math.min(...xs)-r)/cell),x1=Math.floor((Math.max(...xs)+r)/cell),y0=Math.floor((Math.min(...ys)-r)/cell),y1=Math.floor((Math.max(...ys)+r)/cell);
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=y*cols+x;let list=buckets.get(key);if(!list)buckets.set(key,list=[]);list.push(b);}
  }
  function walkable(x,y){
    if(x<(bounds.x0??0)+r||y<(bounds.y0??0)+r||x>(bounds.x0??0)+bounds.width-r||y>(bounds.y0??0)+bounds.height-r||onLand&&!onLand(x,y))return false;
    const list=buckets.get(Math.floor(y/cell)*cols+Math.floor(x/cell));if(!list)return true;
    point.x=x;point.y=y;
    for(const b of list)if(overlaps(point,r,b.polygon))return false;
    return true;
  }
  function clearLine(from,to){const dx=to[0]-from[0],dy=to[1]-from[1],steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/3));
    for(let i=0;i<=steps;i++)if(!walkable(from[0]+dx*i/steps,from[1]+dy*i/steps))return false;return true;
  }
  return {walkable,clearLine};
}
export function navigationFor(blockers,bounds){let entry=navigations.get(blockers);if(!entry||entry.bounds!==bounds){entry={bounds,nav:createCombatNavigation(blockers,bounds)};navigations.set(blockers,entry);}return entry.nav;}
export function canWalk(p,blockers,bounds,r=DUCK_RADIUS){return r===DUCK_RADIUS?navigationFor(blockers,bounds).walkable(p.x,p.y):createCombatNavigation(blockers,bounds,r).walkable(p.x,p.y);}
export function walkingActor(p){return {until:0,pace:0,turn:0,action:0,travel:0,emoteVersion:0,...p,path:p.path?.map(point=>[...point])??[],heading:p.heading?[...p.heading]:null};}
// Compatibility for tools that ask for a single step. Gameplay calls walkStep
// directly with a persistent actor, exactly as the islands do.
export function movePlayer(p,vector,dt,blockers,bounds){const actor=walkingActor(p);walkStep(actor,navigationFor(blockers,bounds),Math.min(.1,Math.max(0,dt)),0,vector);return actor;}
// Shots share a static spatial broad phase, like walking. Adding groves must
// not turn every short paint trajectory into a scan of the entire forest.
const shotIndices=new WeakMap();
export function prepareShotIndex(blockers){
  let index=shotIndices.get(blockers);if(index)return index;
  const cell=256,buckets=new Map(),key=(x,y)=>(y+32768)*65536+x+32768;
  for(const b of blockers)if(b.blocksShots){
    const xs=b.polygon.map(p=>p.x),ys=b.polygon.map(p=>p.y),node={b,stamp:0};
    for(let y=Math.floor(Math.min(...ys)/cell);y<=Math.floor(Math.max(...ys)/cell);y++)for(let x=Math.floor(Math.min(...xs)/cell);x<=Math.floor(Math.max(...xs)/cell);x++){
      const k=key(x,y);let list=buckets.get(k);if(!list)buckets.set(k,list=[]);list.push(node);
    }
  }
  index={cell,buckets,key,stamp:0};shotIndices.set(blockers,index);return index;
}
export function traceShot(from,to,blockers,out=null) {
  out??={point:{x:0,y:0},fraction:1,blocker:null};
  const rx=to.x-from.x,ry=to.y-from.y,index=prepareShotIndex(blockers),stamp=++index.stamp;let nearest=1,blocker=null;
  for(let y=Math.floor(Math.min(from.y,to.y)/index.cell);y<=Math.floor(Math.max(from.y,to.y)/index.cell);y++)for(let x=Math.floor(Math.min(from.x,to.x)/index.cell);x<=Math.floor(Math.max(from.x,to.x)/index.cell);x++){
    const list=index.buckets.get(index.key(x,y));if(!list)continue;
    for(const node of list){
      if(node.stamp===stamp)continue;node.stamp=stamp;const b=node.b;
      if(inside(from,b.polygon)){out.point.x=from.x;out.point.y=from.y;out.fraction=0;out.blocker=b;return out;}
      for(let i=0;i<b.polygon.length;i++){
        const a=b.polygon[i],c=b.polygon[(i+1)%b.polygon.length],ex=c.x-a.x,ey=c.y-a.y,den=rx*ey-ry*ex;
        if(Math.abs(den)<1e-9)continue;
        const ox=a.x-from.x,oy=a.y-from.y,t=(ox*ey-oy*ex)/den,u=(ox*ry-oy*rx)/den;
        if(t>=0&&t<=nearest&&u>=0&&u<=1){nearest=t;blocker=b;}
      }
    }
  }
  out.point.x=from.x+rx*nearest;out.point.y=from.y+ry*nearest;out.fraction=nearest;out.blocker=blocker;return out;
}
