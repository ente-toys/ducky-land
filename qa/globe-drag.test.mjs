import test from 'node:test';
import assert from 'node:assert/strict';
import {globeDrag,screenFrame,lensOffset,unlens,centreOf,lonLat,northUpRoll,rollBasis,uprightFade,globeBall} from '../src/pixi/globe-look.js';
import {globeScreen} from '../src/pixi/globe-screen.js';
import {localPoint} from '../src/pixi/sphere-coordinates.js';
import {WORLD_GEO,WORLD_ISLANDS} from '../src/pixi/world-map.js';
import {dot} from '../src/pixi/sphere.js';

const id='home',W=1440,H=900,zoom=.0329,Rp=WORLD_GEO.Rw*zoom;
const VIEWS=[[0,0],[1.2,.3],[2.6,-.4],[-2.9,.7],[3.1,.1],[-1.4,-1.1]];
const DRAGS=[[[-150,0],[150,0]],[[0,-120],[0,120]],[[-100,-80],[110,90]],[[60,-200],[-40,-170]],[[-220,140],[-160,150]]];
const northRoll=F=>Math.abs(Math.atan2(dot([0,1,0],F.east),dot([0,1,0],F.north)))*180/Math.PI;

test('the grabbed spot stays under the cursor, and north stays up (no roll) on a full ball',()=>{
 let worst=0,roll=0;
 for(const ball of [1,.8])for(const [lon,lat]of VIEWS)for(const [a,b]of DRAGS){
  const c=centreOf(lon,lat),from={x:a[0],y:a[1]},to={x:b[0],y:b[1]};
  const p=unlens(screenFrame(id,c,uprightFade(ball)),from,ball,Rp);
  let cur=c,F;
  for(let k=1;k<=10;k++){
   const f={x:from.x+(to.x-from.x)*(k-1)/10,y:from.y+(to.y-from.y)*(k-1)/10},t={x:from.x+(to.x-from.x)*k/10,y:from.y+(to.y-from.y)*k/10};
   const n=globeDrag(id,cur,f,t,ball,Rp);cur=centreOf(n.lon,n.lat);F=screenFrame(id,cur,uprightFade(ball));
   const q=lensOffset(F,p,ball,Rp);worst=Math.max(worst,Math.hypot(q.x-t.x,q.y-t.y));
   if(ball===1)roll=Math.max(roll,northRoll(F));
  }
 }
 assert.ok(worst<.5,`grabbed spot drifts ${worst.toFixed(3)}px`);
 assert.ok(roll<1,`north rolls ${roll.toFixed(3)} deg`);
 console.log(`# globe drag: max under-cursor drift ${worst.toExponential(2)} px, max north roll ${roll.toExponential(2)} deg`);
});

test('a sideways drag through the middle spins the ball sideways: latitude unchanged, no roll',()=>{
 for(const [lon,lat]of VIEWS){
  const n=globeDrag(id,centreOf(lon,lat),{x:-200,y:0},{x:200,y:0},1,Rp);
  assert.ok(Math.abs(n.lat-lat)<1e-6,`lat ${lat} -> ${n.lat}`);
  assert.ok(n.lon<lon||Math.abs(n.lon-lon)>Math.PI,'dragging right turns the ball to show what was west');
 }
});

test('the ball drawn through camera.basis is exactly the north-up frame (render and drag agree)',()=>{
 for(const [lon,lat]of VIEWS)for(const ball of [1,.6,.3]){
  const c=centreOf(lon,lat),cam={...localPoint(id,c),zoom},fade=uprightFade(ball);
  const G=globeScreen({id,cam,ball,w:W,h:H,basis:rollBasis(fade*northUpRoll(id,c))}),F=screenFrame(id,c,fade);
  for(const i of WORLD_ISLANDS){
   const s=G.screenOf(i.center);if(!s)continue;const q=lensOffset(F,i.center,ball,Rp);
   assert.ok(Math.hypot(s.x-W/2-q.x,s.y-H/2-q.y)<1e-6);
  }
 }
 assert.equal(uprightFade(.25),0,'flat end untouched: zooming into an island has no turn left');
 assert.equal(uprightFade(globeBall(0,.4,900)),0);
});
