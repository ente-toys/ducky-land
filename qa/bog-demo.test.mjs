import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,demoBotCount} from '../src/features/bog-combat/demo.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';
import {RULES} from '../src/features/bog-combat/rules.js';
import {teamCounts} from '../src/features/bog-combat/entry.js';

test('local autoplay uses ten real fighters, tags, respawns and valid island walking without bot medals',async()=>{
 // Allow enough combat time for repeated knockouts under the hits-per-heart rule.
 let seed=98;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const demo=createDemo(BOG_COMBAT,10,{random}),room=new demo.Room({...BOG_COMBAT,profile:'demo-test'});
 await new Promise(resolve=>queueMicrotask(resolve));
 assert.equal(room.client.id,null);
 assert.equal(room.client.snapshot.players.length,10);
 assert.deepEqual(teamCounts(room.client.snapshot.players),{karma:0,evil:0});
 assert.equal(room.client.snapshot.players.filter(p=>p.team==='karma').length,5);
 demo.sim.state.players.get('bot-0').ammo=2;
 let tagged=false,reloading=false;
 for(let i=0;i<7200*RULES.hitsPerHeart;i++){
  room.step(1/60,{x:0,y:0},i*1000/60);
  for(const p of demo.sim.state.players.values()){
   if(i%60===0)assert.ok(BOG_COMBAT.navigation.walkable(p.x,p.y),p.name);
   tagged||=!p.alive;reloading||=p.ammo===0;
  }
 }
 assert.ok(tagged);assert.ok(reloading);
 assert.ok(demo.sim.state.scores.karma>0&&demo.sim.state.scores.evil>0);
 assert.ok([...demo.sim.state.players.values()].some(p=>p.spawns>5&&p.stats.tags>0));
 assert.ok([...demo.sim.state.players.values()].every(p=>p.stats.medals===0&&Object.keys(p.medalCase).length===0));
 room.dispose();
 const human=new demo.Room({...BOG_COMBAT,team:'karma',name:'You',profile:'demo-human'});
 await new Promise(resolve=>queueMicrotask(resolve));
 assert.equal(human.client.self.name,'You');assert.equal(demo.sim.state.players.size,11);
 human.step(1/60,{x:1,y:0},0);human.dispose();assert.equal(demo.sim.state.players.size,10);
});

test('bot URL values are bounded and optional',()=>{
 assert.equal(demoBotCount('?arena&bots=10'),10);assert.equal(demoBotCount('?bots=999'),20);
 for(const query of ['', '?bots=-2','?bots=wat','?bots=0'])assert.equal(demoBotCount(query),0);
});

test('open match keeps running past thirty tags with no winner, rounds or score reset',async()=>{
 let seed=97;const demo=createDemo(BOG_COMBAT,10,{random:()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)});
 const room=new demo.Room({...BOG_COMBAT,profile:'open-match-test'});await new Promise(queueMicrotask);
 const players=[...demo.sim.state.players.values()];
 demo.sim.state.scores.karma=45;demo.sim.state.scores.evil=47;
 for(let i=0;i<360;i++)room.step(1/60,{x:0,y:0},i*1000/60);
 assert.equal(demo.match,undefined);assert.equal(demo.sim.state.tick,360);
 assert.ok(demo.sim.state.scores.karma>=45);assert.ok(demo.sim.state.scores.evil>=47);
 assert.ok(demo.sim.state.time>5.9);assert.equal(demo.sim.state.players.size,10);
 assert.ok(players.every(p=>demo.sim.state.players.get(p.id)===p),'no whole-match respawn/reset');
 room.dispose();
});
