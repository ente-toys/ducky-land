import assert from 'node:assert/strict';
import {BreadHunt,BREAD_SPOTS,walkable,routeTo} from './web/activities/bread-hunt.js';
import {DuckRace} from './web/activities/duck-race.js';

let points=0,finished=0;
const hunt=new BreadHunt({total:35,onCollect:()=>points++,onFinish:()=>finished++});
hunt.start();
assert.equal(routeTo(hunt.player,{x:800,y:575}).length,0,'Fountain is blocked');
assert(routeTo(hunt.player,{x:800,y:390}).length>1,'Routes go around the fountain');
for(const [x,y] of BREAD_SPOTS){
  assert(walkable(x,y),'Every slice is walkable');hunt.target(x,y);
  for(let frame=0;frame<4000&&hunt.path.length;frame++){
    hunt.update(1/60);assert(walkable(hunt.player.x,hunt.player.y),'Route stays on the plaza');
  }
}
assert.equal(hunt.phase,'finished');assert.equal(hunt.total,155);
assert.equal(points,12);assert.equal(finished,1);
for(let i=0;i<120;i++)hunt.update(1/60);
assert.equal(points,12,'Each slice awards once');assert.equal(finished,1,'Completion fires once');
hunt.start();assert.equal(hunt.collected,0);assert.equal(hunt.total,155);

for(const count of [2,4,6,8]){
  const race=new DuckRace({count});race.start();
  assert.equal(race.paddle(),false,'Cannot paddle through countdown');
  while(race.phase==='countdown')race.update(1/60);
  assert(race.paddle());assert.equal(race.paddle(),false,'Immediate repeat is rejected');
  for(let frame=0;frame<12000&&race.phase==='racing';frame++){
    if(frame%9===0)race.paddle();race.update(1/60);
  }
  assert.equal(race.finishOrder.length,count);assert.equal(race.phase,'finished');
  assert.equal(race.racers.filter(d=>d.isPlayer).length,1);
  assert(race.finishOrder.every((d,i,list)=>!i||list[i-1].finishTime<=d.finishTime));
  race.start();assert.equal(race.taps,0);assert.equal(race.finishOrder.length,0);
  assert(race.racers.every(d=>d.progress===0));
}
console.log('PASS: hunt reachability/collisions/+120/one-shot/replay; 2/4/6/8-racer countdown/input/finish order/replay.');
