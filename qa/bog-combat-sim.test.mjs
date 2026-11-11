import test from 'node:test';
import assert from 'node:assert/strict';
import {createArena,circleHit,spawnPads} from '../src/pixi/bog-combat/sim.js';
import {RULES,emptyStats} from '../src/pixi/bog-combat/rules.js';
import {DUCK_LENGTH as D} from '../src/pixi/bog-combat/rules.js';
import {getBogBlockers} from '../src/pixi/bog-combat/blockers.js';
import {BOG_COMBAT} from '../src/pixi/bog-combat/config.js';
const BLOCKERS=getBogBlockers(),BOUNDS=BOG_COMBAT.bounds;
import {canWalk} from '../src/pixi/bog-combat/physics.js';

const wall={blocksWalk:true,blocksShots:true,polygon:[{x:400,y:50},{x:410,y:50},{x:410,y:900},{x:400,y:900}]};
const advance=(arena,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)arena.step(1/60);};
function fixture(options={}){
  const arena=createArena({blockers:[],bounds:{width:2000,height:1500},pads:team=>[{x:team==='privacy'?100:450,y:300,base:team}],practice:false,...options});
  const a=arena.join({id:'a',name:'A',team:'privacy'}),b=arena.join({id:'b',name:'B',team:'google'});
  advance(arena,RULES.spawnShield+.1);return {arena,a,b};
}
// Collision fixtures set the actor's authoritative facing before the trigger.
const shot=(arena,id='a',seq=0,extra={})=>{arena.state.players.get(id).facing=(extra.ax??1)>0?Math.PI/2:-Math.PI/2;return arena.input(id,{seq,x:0,y:0,ax:1,ay:0,fire:true,...extra});};
test('only gun C Popper uses review range and projectile speed',()=>{
  assert.equal(RULES.range,10*D);assert.equal(RULES.shotSpeed,28*D);
  const {arena,b}=fixture();b.x=1100;shot(arena);arena.step(1/60);const s=arena.state.shots[0];
  assert.ok(Math.abs(s.x-100-RULES.shotSpeed/60)<1e-7);
  advance(arena,.5);assert.equal(b.alive,true);assert.equal(arena.state.shots.length,0);assert.ok(arena.state.splats.length);
});
test('swept collision catches a fast shot even when neither endpoint is inside the duck',()=>{
  assert.equal(circleHit({x:0,y:0},{x:100,y:0},{x:50,y:0},10),.4);
  assert.equal(circleHit({x:0,y:0},{x:100,y:0},{x:50,y:50},10),null);
  assert.equal(circleHit({x:50,y:0},{x:50,y:0},{x:50,y:0},10),0);
});
test('server tags once, scores team and saves medals, score and best streak',()=>{
  const saves=[],{arena,a,b}=fixture({onStats:(profile,stats)=>saves.push({profile,stats})});
  shot(arena);advance(arena,.3);
  assert.equal(b.alive,false);assert.equal(a.stats.tags,1);assert.equal(a.stats.score,10);assert.equal(a.stats.medals,1);assert.equal(a.stats.bestStreak,1);
  assert.equal(arena.state.scores.privacy,1);assert.equal(arena.state.splats.at(-1).kind,'tag');assert.ok(saves.some(s=>s.profile==='a'&&s.stats.tags===1));
  advance(arena,.5);assert.equal(a.stats.tags,1);
});
test('paint stops at cover before a duck and produces a wall splat',()=>{
  const {arena,a,b}=fixture({blockers:[wall]});shot(arena);advance(arena,.3);
  assert.equal(b.alive,true);assert.equal(a.stats.tags,0);assert.equal(arena.state.splats[0].kind,'wall');assert.equal(arena.state.splats[0].x,400);
});
test('nearest enemy consumes the shot, friendly fire passes through teammates',()=>{
  const {arena,a,b}=fixture();b.x=300;
  const friend=arena.join({id:'friend',team:'privacy'});friend.x=200;friend.shieldUntil=0;
  const farther=arena.join({id:'farther',team:'google'});farther.x=430;farther.shieldUntil=0;
  shot(arena);advance(arena,.3);assert.equal(friend.alive,true);assert.equal(b.alive,false);assert.equal(farther.alive,true);assert.equal(a.stats.tags,1);
});
test('tagged duck cannot move or fire and respawns at its own base after three seconds',()=>{
  const {arena,b}=fixture();shot(arena);advance(arena,.3);const position={x:b.x,y:b.y};
  shot(arena,'b',10,{x:-1,ax:-1});advance(arena,.3);assert.equal(b.x,position.x);assert.equal(b.y,position.y);assert.equal(arena.state.shots.length,0);
  advance(arena,2.5);assert.equal(b.alive,false);advance(arena,.3);assert.equal(b.alive,true);assert.equal(b.x,450);assert.equal(b.base,'google');assert.ok(b.shieldUntil>arena.state.time);
});
test('spawn hiding is seven seconds and firing breaks your own protection',()=>{
  const {arena,a,b}=fixture();b.shieldUntil=arena.state.time+1;shot(arena);advance(arena,.3);assert.equal(b.alive,true);
  a.shieldUntil=arena.state.time+1;shot(arena,'a',2);advance(arena,.1);assert.ok(a.shieldUntil<=arena.state.time);
});
test('inputs cannot teleport, increase movement speed, report hits or bypass fire cooldown',()=>{
  const {arena,a,b}=fixture();b.x=1100;
  assert.ok(shot(arena,'a',1,{x:999,score:9999,kills:999,hit:'b'}));advance(arena,.1);
  assert.ok(a.x<=124.50001);assert.equal(a.stats.tags,0);assert.equal(b.alive,true);
  for(let i=2;i<20;i++)shot(arena,'a',i);assert.equal(arena.state.shots.length,1);
  assert.equal(shot(arena,'a',1),false);assert.equal(shot(arena,'a',20,{x:NaN}),false);assert.equal(shot(arena,'a',20,{ax:Infinity}),false);
  advance(arena,.8);assert.equal(arena.state.shots.length,0);assert.ok(a.x<200,'stale movement input stops after 350 ms');
});
test('live teams allow uneven sizes with no rounds or timer',()=>{
  const {arena}=fixture();for(let i=0;i<20;i++)assert.ok(arena.join({id:`p${i}`,team:'privacy'}));
  assert.equal(arena.join({id:'bad',team:'evil'}),null);assert.equal(arena.state.players.size,22);
  const s=arena.snapshot();assert.equal(s.round,undefined);assert.equal(s.phase,undefined);assert.equal(s.scores.google,0);
});
test('real Bog pads remain distinct and walkable in the delivered environment',()=>{
  for(const team of ['privacy','google']){const pads=spawnPads(team);assert.equal(pads.length,2);for(const p of pads)assert.ok(canWalk(p,BLOCKERS,BOUNDS));}
});
test('leave and return preserve lifetime totals but reset live streak and position',()=>{
  let saved;const {arena}=fixture({onStats:(profile,stats)=>{if(profile==='a')saved=stats;}});shot(arena);advance(arena,.3);arena.leave('a');
  const p=arena.join({id:'again',profile:'a',team:'google',stats:saved});assert.equal(p.stats.tags,1);assert.equal(p.stats.medals,1);assert.equal(p.stats.bestStreak,1);assert.equal(p.streak,0);assert.equal(p.base,'google');
  assert.equal(arena.join({id:'duplicate',profile:'a',team:'privacy'}),null);
});
test('snapshots are isolated from simulation state and effects expire with bounded history',()=>{
  const {arena,a}=fixture();a.heading=[1,0];const snap=arena.snapshot();snap.players[0].heading[0]=5;assert.equal(a.heading[0],1);snap.players[0].stats.tags=100;snap.scores.privacy=100;assert.deepEqual(a.stats,emptyStats());assert.equal(arena.state.scores.privacy,0);
  shot(arena);advance(arena,.3);assert.ok(arena.state.splats.length);advance(arena,9);assert.equal(arena.state.splats.length,0);
});
test('survives counts active living minutes, never idle or tagged-out time',()=>{
  const {arena,a,b}=fixture();b.x=1500;
  for(let i=0;i<61*60;i++){if(i%6===0)shot(arena,'a',i,{fire:false});arena.step(1/60);}
  assert.equal(a.stats.survives,1);advance(arena,120);shot(arena,'a',99999,{fire:false});arena.step(1/60);assert.equal(a.stats.survives,1);
});
