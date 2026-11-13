import test from 'node:test';
import assert from 'node:assert/strict';
import {globeDrag,screenFrame,lensOffset,unlens,centreOf,globeRoll,rollBasis,uprightFade,globeBall} from '../src/rendering/shared/globe-look.js';
import {globeScreen} from '../src/rendering/shared/globe-screen.js';
import {localPoint} from '../src/world/sphere-coordinates.js';
import {WORLD_GEO,WORLD_ISLANDS} from '../src/world/world-map.js';
import {dot} from '../src/world/sphere.js';

const id='home',W=1440,H=900,zoom=.0329,Rp=WORLD_GEO.Rw*zoom;
const VIEWS=[[0,0],[1.2,.3],[2.6,-.4],[-2.9,.7],[3.1,.1],[-1.4,-1.1]];
const DRAGS=[[[-150,0],[150,0]],[[0,-120],[0,120]],[[-100,-80],[110,90]],[[60,-200],[-40,-170]],[[-220,140],[-160,150]]];
const northRoll=F=>Math.atan2(dot([0,1,0],F.east),dot([0,1,0],F.north))*180/Math.PI;

test('the grabbed spot stays under the cursor and the full globe keeps an eight-degree tilt',()=>{
 let worst=0,tiltError=0;
 for(const ball of [1,.8])for(const [lon,lat]of VIEWS)for(const [a,b]of DRAGS){
  const c=centreOf(lon,lat),from={x:a[0],y:a[1]},to={x:b[0],y:b[1]};
  const p=unlens(screenFrame(id,c,uprightFade(ball)),from,ball,Rp);
  let cur=c,F;
  for(let k=1;k<=10;k++){
   const f={x:from.x+(to.x-from.x)*(k-1)/10,y:from.y+(to.y-from.y)*(k-1)/10},t={x:from.x+(to.x-from.x)*k/10,y:from.y+(to.y-from.y)*k/10};
   const n=globeDrag(id,cur,f,t,ball,Rp);cur=centreOf(n.lon,n.lat);F=screenFrame(id,cur,uprightFade(ball));
   const q=lensOffset(F,p,ball,Rp);worst=Math.max(worst,Math.hypot(q.x-t.x,q.y-t.y));
   if(ball===1)tiltError=Math.max(tiltError,Math.abs(northRoll(F)-8));
  }
 }
 assert.ok(worst<.5,`grabbed spot drifts ${worst.toFixed(3)}px`);
 assert.ok(tiltError<1e-6,`north deviates from the tilt by ${tiltError.toFixed(6)} deg`);
});

test('a drag along the tilted east-west axis keeps latitude unchanged',()=>{
 const tilt=8*Math.PI/180;
 const end={x:200*Math.cos(tilt),y:200*Math.sin(tilt)};
 for(const [lon,lat]of VIEWS){
  const n=globeDrag(id,centreOf(lon,lat),{x:-end.x,y:-end.y},end,1,Rp);
  assert.ok(Math.abs(n.lat-lat)<1e-6,`lat ${lat} -> ${n.lat}`);
  assert.ok(n.lon<lon||Math.abs(n.lon-lon)>Math.PI,'dragging right turns the ball to show what was west');
 }
});

test('the globe renderer and drag use the same tilted frame',()=>{
 for(const [lon,lat]of VIEWS)for(const ball of [1,.6,.3]){
  const c=centreOf(lon,lat),cam={...localPoint(id,c),zoom},fade=uprightFade(ball);
  const G=globeScreen({id,cam,ball,w:W,h:H,basis:rollBasis(globeRoll(id,c,fade))}),F=screenFrame(id,c,fade);
  for(const i of WORLD_ISLANDS){
   const s=G.screenOf(i.center);if(!s)continue;const q=lensOffset(F,i.center,ball,Rp);
   assert.ok(Math.hypot(s.x-W/2-q.x,s.y-H/2-q.y)<1e-6);
  }
 }
 assert.equal(uprightFade(.25),0,'flat end untouched: zooming into an island has no turn left');
 assert.equal(uprightFade(globeBall(0,.4,900)),0);
});
