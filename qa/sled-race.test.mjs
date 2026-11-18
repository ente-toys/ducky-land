import test from 'node:test';
import assert from 'node:assert/strict';
import {SLED} from '../src/features/sled-race/rules.js';
import {buildCourse,HAZARDS,laneX,laneWidth} from '../src/features/sled-race/course.js';
import {createSledRace,stepRacer,createRacer,NO_INPUT} from '../src/features/sled-race/sim.js';
import {botRoster,createBotDrivers,nextSkill} from '../src/features/sled-race/bots.js';
import {createSledLobby,raceSeed} from '../src/features/sled-race/lobby.js';
import {raceAchievements} from '../src/features/sled-race/achievements.js';

const runBots=(seed,count=6)=>{
  const course=buildCourse(seed),race=createSledRace({course,racers:botRoster(count,{seed}),bots:createBotDrivers(course,{seed,skill:.5})});
  for(let i=0;i<60*200&&!race.state.done;i++)race.step(1/60);
  return {course,race};
};

test('the same seed builds the same course, and every race rolls a new seed',()=>{
  assert.equal(JSON.stringify(buildCourse(7)),JSON.stringify(buildCourse(7)));
  assert.notEqual(JSON.stringify(buildCourse(7).hazards),JSON.stringify(buildCourse(8).hazards));
  const seeds=new Set(Array.from({length:20},raceSeed));assert.ok(seeds.size>15);
  const lobby=createSledLobby(),played=new Set();
  for(let round=0;round<3;round++){const t0=round*1000;lobby.join('me');lobby.ready('me');lobby.tick(t0);lobby.tick(t0+SLED.waitSeconds);lobby.tick(t0+SLED.waitSeconds+SLED.botCountdown);played.add(lobby.snapshot().seed);lobby.leave('me');let t=t0+SLED.waitSeconds+SLED.botCountdown;while(lobby.phase!=='empty'&&t<t0+900){t+=.5;lobby.tick(t);}}
  assert.equal(played.size,3);
});

test('every obstacle sits in a lane and rows leave at least two lanes open',()=>{
  for(const seed of [1,7,42,2026,99999]){
    const course=buildCourse(seed),centres=Array.from({length:SLED.lanes},(_,i)=>laneX(i));
    for(const h of course.hazards){
      assert.ok(centres.some(c=>Math.abs(c-h.x)<1e-9),`${h.kind} at ${h.x} is off-lane`);
      assert.ok(HAZARDS[h.kind].w*2<=laneWidth(),`${h.kind} is wider than a lane`);
    }
    const rows=new Map();for(const h of course.hazards){const k=h.d.toFixed(3);rows.set(k,(rows.get(k)??0)+1);}
    for(const n of rows.values())assert.ok(n<=SLED.lanes-2);
    assert.ok(course.hazards.every(h=>h.d>=30&&h.d<=course.length-20));
  }
});

test('a racer slides on its own, steers, crashes on a rock and gets going again',()=>{
  const course={...buildCourse(1),hazards:[],ice:[],ramps:[],forks:[],forkAt:()=>null,centre:()=>0};
  const r=createRacer({id:'a',name:'A'});
  for(let t=0;t<2;t+=1/60)stepRacer(r,NO_INPUT,1/60,course,t);
  assert.ok(r.d>10&&r.v>SLED.startSpeed*.9,'slides downhill without input');
  const x0=r.x;for(let t=2;t<2.5;t+=1/60)stepRacer(r,{steer:1},1/60,course,t);
  assert.ok(r.x>x0+1,'steers right');
  course.hazards=[{kind:'rock',d:r.d+2,x:r.x}];r.hazardIndex=0;
  let crashed=false;for(let t=2.5;t<3.5;t+=1/60)if(stepRacer(r,NO_INPUT,1/60,course,t).some(e=>e.type==='crash'))crashed=true;
  assert.ok(crashed&&r.crashes===1);
  for(let t=3.5;t<6;t+=1/60)stepRacer(r,NO_INPUT,1/60,course,t);
  assert.ok(r.v>SLED.cruiseSpeed*.9,'back up to speed after the wipeout');
});

test('after a crash the racer restarts below the obstacle, clear of a crowded row',()=>{
  const course={...buildCourse(1),hazards:[],ice:[],ramps:[],forks:[],forkAt:()=>null,centre:()=>0};
  const r=createRacer({id:'a',name:'A',x:laneX(2)});
  for(let t=0;t<2;t+=1/60)stepRacer(r,NO_INPUT,1/60,course,t);
  const d=r.d+2;
  // a row across two lanes, and another rock right below the first
  course.hazards=[{kind:'rock',d,x:laneX(2)},{kind:'snowman',d,x:laneX(3)},{kind:'rock',d:d+1.2,x:laneX(2)}];r.hazardIndex=0;
  let t=2;for(;t<3&&!r.crashes;t+=1/60)stepRacer(r,NO_INPUT,1/60,course,t);
  assert.equal(r.crashes,1);
  assert.ok(r.d>d+1.2+HAZARDS.rock.len/2,`rests below both rocks, at ${r.d}`);
  // steering toward the neighbouring lane on the restart does not catch the row again
  for(const end=t+3;t<end;t+=1/60)stepRacer(r,{steer:1},1/60,course,t);
  assert.equal(r.crashes,1,'no second crash');
});

test('bot races finish, are close and deterministic',()=>{
  for(const seed of [3,11,2026]){
    const a=runBots(seed),b=runBots(seed);
    assert.ok(a.race.state.done);
    const times=a.race.standings().map(r=>r.finishedAt);
    assert.deepEqual(times,b.race.standings().map(r=>r.finishedAt));
    // a winner averages about 10-20 course units a second
    assert.ok(times[0]>SLED.courseLength/20&&times[0]<SLED.courseLength/10,`winner time ${times[0]}`);
    assert.ok(times.at(-1)-times[0]<SLED.finishGrace+1);
    assert.deepEqual(a.race.standings().map(r=>r.place),[1,2,3,4,5,6]);
  }
});

test('skill matching nudges bots up when humans win and down when they lose',()=>{
  assert.ok(nextSkill(.5,1,4)>.5);
  assert.ok(nextSkill(.5,4,4)<.5);
  assert.ok(nextSkill(.9,1,4)<=.9&&nextSkill(.15,4,4)>=.15);
});

test('lobby: three ready players cut the wait short and race without bots',()=>{
  const lobby=createSledLobby({seed:()=>7});
  for(const id of ['a','b','c'])lobby.join(id,{name:id});
  lobby.tick(0);assert.equal(lobby.phase,'waiting');
  for(const id of ['a','b','c'])lobby.ready(id);
  lobby.tick(1);assert.equal(lobby.phase,'waiting');
  lobby.tick(1+SLED.shortWait);assert.equal(lobby.phase,'countdown');
  const racers=lobby.snapshot().racers;
  assert.equal(racers.length,3);assert.ok(racers.every(r=>!r.bot));
  lobby.tick(1+SLED.shortWait+SLED.fullCountdown);assert.equal(lobby.phase,'racing');
});

test('lobby: a lone player races bots once the wait runs out; idle seats are cleared',()=>{
  const lobby=createSledLobby({seed:()=>7});
  lobby.join('me',{name:'Me'});lobby.join('idle',{name:'Idle'});lobby.ready('me');
  lobby.tick(0);lobby.tick(SLED.waitSeconds-1);assert.equal(lobby.phase,'waiting');
  lobby.tick(SLED.waitSeconds);assert.equal(lobby.phase,'countdown');
  const racers=lobby.snapshot().racers;
  assert.equal(racers.length,SLED.botFillTo);
  assert.deepEqual(racers.filter(r=>!r.bot).map(r=>r.id),['me']);
  assert.equal(lobby.join('late').reason,'racing');
});

test('lobby: a full room of ready players starts on the short countdown and a race runs to results',()=>{
  const lobby=createSledLobby({seed:()=>11});
  for(let i=0;i<SLED.maxSeats;i++){lobby.join('p'+i);lobby.ready('p'+i);}
  assert.equal(lobby.join('extra').reason,'full');
  lobby.tick(0);assert.equal(lobby.phase,'countdown');
  let t=SLED.fullCountdown,finished=null;lobby.tick(t);assert.equal(lobby.phase,'racing');
  // nobody steers: everyone still finishes or is placed after the grace period
  while(lobby.phase==='racing'&&t<200){t+=.05;finished=lobby.tick(t).finished??finished;}
  assert.equal(lobby.phase,'results');
  assert.equal(finished.standings.length,SLED.maxSeats);
  lobby.tick(t+SLED.resultsSeconds);assert.equal(lobby.phase,'empty');
});

test('lobby: inputs steer a seated racer and leaving mid-race counts as not finishing',()=>{
  const lobby=createSledLobby({seed:()=>3});
  lobby.join('me');lobby.ready('me');lobby.tick(0);lobby.tick(SLED.waitSeconds);lobby.tick(SLED.waitSeconds+SLED.botCountdown);
  assert.equal(lobby.phase,'racing');
  assert.equal(lobby.input('me',{steer:1}),true);
  assert.equal(lobby.input('stranger',{steer:1}),false);
  lobby.tick(SLED.waitSeconds+SLED.botCountdown+1);
  lobby.leave('me');
  assert.equal(lobby.race.racer('me').dnf,true);
});

test('medals: a clean win and a comeback',()=>{
  const standings=[{id:'me',place:1,finishedAt:50,crashes:0,iceHits:0,wasLast:true,bot:false},{id:'b',place:2,finishedAt:51,crashes:1,bot:true}];
  const got=raceAchievements({me:standings[0],course:buildCourse(1),standings}).map(a=>a.id);
  assert.ok(got.includes('first-win')&&got.includes('clean-win')&&got.includes('from-last'));
});

test('Space hops over an obstacle, once per press, and again as soon as the duck lands',()=>{
  const course={...buildCourse(1),hazards:[],ice:[],ramps:[],forks:[],forkAt:()=>null,centre:()=>0};
  const r=createRacer({id:'a',name:'A'});let t=0;
  for(;t<3;t+=1/60)stepRacer(r,NO_INPUT,1/60,course,t);
  course.hazards=[{kind:'log',d:r.d+3,x:r.x}];r.hazardIndex=0;
  const events=[];
  for(let i=0;i<20;i++,t+=1/60)events.push(...stepRacer(r,{steer:0,jump:i<5},1/60,course,t));
  assert.equal(events.filter(e=>e.type==='jump').length,1,'one hop per press');
  assert.ok(!stepRacer(r,{jump:true},1/60,course,t+=1/60).some(e=>e.type==='jump'),'no second hop in the air');
  stepRacer(r,NO_INPUT,1/60,course,t+=1/60);
  for(;t<r.airUntil+.01;t+=1/60)stepRacer(r,NO_INPUT,1/60,course,t);
  assert.equal(r.crashes,0,'cleared the log');
  assert.ok(stepRacer(r,{jump:true},1/60,course,t).some(e=>e.type==='jump'),'hops again right after landing');
});
