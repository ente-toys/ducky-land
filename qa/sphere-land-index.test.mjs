import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {inPoly,inShape} from '../assets/world/island-geometry.mjs';
// Independent reference to the exact pre-index boat geometry. This protects
// thin jetties, coast cells and raised crossings while removing cold field cost.
function original(m,x,y){
 const {world:w,walk,JETTY:j}=m,foot=j.foot,dir=j.dir;
 const t=Math.max(0,Math.min(j.length,(x-foot.x)*dir.x+(y-foot.y)*dir.y));
 if(Math.hypot(x-foot.x-dir.x*t,y-foot.y-dir.y*t)<j.width/2+4)return true;
 if((w.boatCoast?inPoly(x,y,w.boatCoast):inPoly(x,y,walk.coast)||inPoly(x,y,w.coast))&&!(w.boatWater??[]).some(p=>inPoly(x,y,p)))return true;   // boss 8 Nov: home's sea-joined rivers are water for boats
 if(w.islets.some(([cx,cy,rx,ry])=>inShape(x,y,{x:cx,y:cy,rx,ry})))return true;
 return (m.home?walk.walkways:w.walkways).some(({a,b,w,boatPassUnder})=>{if(boatPassUnder)return false;const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<w/2;});
}
test('indexed boat land retains original geometry on every island and along every coast edge',()=>{
 let count=0;
 for(const i of WORLD_ISLANDS){const m=mapOf(i.id);
  for(let x=m.origin.x-100;x<m.origin.x+m.width+100;x+=131)for(let y=m.origin.y-100;y<m.origin.y+m.height+100;y+=127){assert.equal(m.landAt(x,y),original(m,x,y),`${i.id} ${x},${y}`);count++;}
  for(let k=0;k<m.walk.coast.length;k++){const a=m.walk.coast[k],b=m.walk.coast[(k+1)%m.walk.coast.length];for(const t of [.01,.5,.99])for(const offset of [-1,0,1]){const x=a[0]+(b[0]-a[0])*t+offset,y=a[1]+(b[1]-a[1])*t+offset;assert.equal(m.landAt(x,y),original(m,x,y),`${i.id} coast ${k}`);count++;}}
 }
 assert.ok(count>80000);
});
