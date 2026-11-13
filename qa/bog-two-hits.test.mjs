import test from 'node:test';
import assert from 'node:assert/strict';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {RULES,emptyStats} from '../src/features/bog-combat/rules.js';

const advance=(sim,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)sim.step(1/60);};
function fixture(){
  const sim=createBogCombat({blockers:[],pickupSpots:[],hideBushes:[],bounds:{width:1000,height:1000},
    pads:team=>[{x:team==='karma'?200:400,y:400}]});
  const shooter=sim.join({id:'shooter',team:'karma'}),victim=sim.join({id:'victim',team:'evil'});
  shooter.shieldUntil=victim.shieldUntil=0;
  return {sim,shooter,victim};
}
function fire(sim,shooter){
  shooter.facing=Math.PI/2;
  assert.ok(sim.input(shooter.id,{seq:shooter.seq+1,x:0,y:0,fire:true}));
  sim.step(1/60);
  assert.ok(sim.input(shooter.id,{seq:shooter.seq+1,x:0,y:0,fire:false}));
  advance(sim,RULES.fireDelay);
}
const snapshotVictim=sim=>sim.snapshot().players.find(p=>p.id==='victim');

test('first paint hit leaves a hit splat without a tag; second hit loses a heart and respawns with no hits',()=>{
  const {sim,shooter,victim}=fixture(),lives=victim.lives;
  assert.equal(victim.hits,0);
  fire(sim,shooter);
  assert.equal(victim.hits,1);assert.equal(victim.lives,lives);assert.equal(victim.alive,true);
  assert.equal(victim.respawnAt,0);assert.deepEqual(shooter.stats,emptyStats());
  assert.deepEqual(sim.state.scores,{karma:0,evil:0});assert.deepEqual(sim.state.events,[]);
  assert.equal(sim.state.splats.length,1);assert.equal(sim.state.splats[0].kind,'hit');
  assert.equal(sim.state.splats[0].victim,victim.id);assert.equal(snapshotVictim(sim).hits,1);

  for(let hit=1;hit<RULES.hitsPerHeart;hit++)fire(sim,shooter);
  assert.equal(victim.lives,lives-1);assert.equal(victim.hits,0);assert.equal(victim.alive,false);
  assert.equal(sim.state.splats.at(-1).kind,'tag');assert.equal(sim.state.splats.at(-1).victim,victim.id);
  assert.equal(shooter.stats.tags,1);assert.equal(shooter.stats.score,RULES.tagScore);
  assert.equal(sim.state.scores.karma,RULES.tagPoints);assert.equal(sim.state.events.length,1);
  assert.equal(sim.state.events[0].victimId,victim.id);assert.equal(snapshotVictim(sim).hits,0);
  advance(sim,RULES.respawnDelay);
  assert.equal(victim.alive,true);assert.equal(victim.lives,lives-1);
  assert.equal(victim.hits,0);assert.equal(snapshotVictim(sim).hits,0);
});

test('respawning clears partial hits independently of the tag reset',()=>{
  const {sim,victim}=fixture();
  // Seed the downed state so this checks spawn itself, rather than tag's reset.
  victim.alive=false;victim.hits=RULES.hitsPerHeart-1;victim.respawnAt=sim.state.time+RULES.respawnDelay;
  advance(sim,RULES.respawnDelay+.05);
  assert.equal(victim.alive,true);assert.equal(victim.hits,0);assert.equal(snapshotVictim(sim).hits,0);
});

test('a small shield absorbs a whole hit without adding or clearing partial hits',()=>{
  for(const hits of [0,RULES.hitsPerHeart-1]){
    const {sim,shooter,victim}=fixture(),lives=victim.lives;
    victim.hits=hits;victim.hitShield=1;victim.hitShieldUntil=sim.state.time+RULES.hitShieldSeconds;
    fire(sim,shooter);
    assert.equal(victim.hitShield,0);assert.equal(victim.hits,hits);assert.equal(snapshotVictim(sim).hits,hits);
    assert.equal(victim.lives,lives);assert.equal(victim.alive,true);
    assert.equal(sim.state.splats.length,1);assert.equal(sim.state.splats[0].kind,'shield');
    assert.equal(sim.state.splats[0].victim,victim.id);
    assert.deepEqual(shooter.stats,emptyStats());assert.deepEqual(sim.state.scores,{karma:0,evil:0});
    assert.deepEqual(sim.state.events,[]);
  }
});
