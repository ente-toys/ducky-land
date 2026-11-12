import test from 'node:test';
import assert from 'node:assert/strict';
import {KarmaPool,KARMA_SITES,KARMA_ACTIVE,KARMA_RADIUS} from '../src/gameplay/karma-pool.js';
import {makeRoom,addPlayer,seeded} from './room-harness.mjs';
import {isletWalk} from '../src/world/islet-walk.js';
import {mapOf} from '../src/world/island-maps.js';

test('50 unique shared feathers cover all safe islands and islets; no Bog farming',()=>{
 const pool=new KarmaPool(null,seeded()),visible=pool.slots.map(s=>pool.sites.get(s.siteId));
 assert.equal(pool.slots.length,KARMA_ACTIVE);assert.equal(new Set(pool.slots.map(s=>s.siteId)).size,50);
 assert.equal(new Set(visible.filter(s=>!s.region.startsWith('sea-')).map(s=>s.islandId)).size,8);
 assert.ok(visible.every(s=>s.islandId!=='isle-249'||s.region.startsWith('sea-')));
});
test('all authored pickup sites are on navigable ground, clear of props and water',()=>{
 for(const site of KARMA_SITES){const nav=site.region.startsWith('sea-')?isletWalk(site.region).nav:mapOf(site.islandId).nav();assert.ok(nav.walkable(site.x,site.y),site.id);}
});
test('first arrival wins; cooldown respawns elsewhere, preserving 50 slots across restarts',()=>{
 const pool=new KarmaPool(null,seeded()),slot=pool.slots[0],from=pool.sites.get(slot.siteId),actor={...from,mode:'walking',jumpLeft:0},now=1_000_000;
 assert.equal(pool.claim({...actor,x:actor.x+KARMA_RADIUS+1},now),null);
 assert.equal(pool.claim({...actor,mode:'sailing'},now),null);
 assert.equal(pool.claim(actor,now,()=>false),null);
 const picked=pool.claim(actor,now);assert.equal(picked.id,slot.id);assert.notEqual(slot.siteId,from.id);
 assert.equal(pool.claim(actor,now),null);assert.ok(slot.readyAt>=now+30000&&slot.readyAt<=now+60000);
 assert.ok(!pool.visible(from.islandId).some(s=>s.id===slot.id));
 const restored=new KarmaPool(pool.save(),seeded(19));assert.deepEqual(restored.save(),pool.save());
 restored.refresh(slot.readyAt);assert.ok(restored.slots.every(s=>s.readyAt===0));assert.equal(restored.slots.length,50);
});
test('real room awards once to one account, persists balance, and publishes shared removal',async()=>{
 const room=await makeRoom(),slot=room.karma.pool.slots.find(s=>room.karma.pool.sites.get(s.siteId).region==='home'),site=room.karma.pool.sites.get(slot.siteId);
 const a=addPlayer(room,401,{...site}),b=addPlayer(room,402,{...site});
 room.karma.update(Date.now());
 assert.equal((a.actor.karma??0)+(b.actor.karma??0),1);assert.equal(a.actor.karma,1);assert.equal(b.actor.karma,0);
 assert.equal(room.sql.exec('SELECT balance FROM karma_balances WHERE account=?',a.account).one().balance,1);
 room.karma.update(Date.now());assert.equal(a.actor.karma,1);
 room.broadcast();
 const state=a.socket.notes.filter(n=>n.type==='karma-state').at(-1);assert.equal(state.balance,1);assert.ok(!state.feathers.some(s=>s.id===slot.id));
 const events=b.socket.notes.filter(n=>n.type==='karma-pickup');assert.equal(events.length,1);assert.equal(events[0].playerId,a.actor.id);
 room.karma.balances.clear();assert.equal(room.karma.balance(a.account),1,'reload reads persisted account balance');
});

test('50 shared pickups span every landmass with at most three on each; respawns travel elsewhere',()=>{
 const pool=new KarmaPool(null,seeded(33));
 const check=()=>{
  const counts=new Map();for(const slot of pool.slots){const region=pool.sites.get(slot.siteId).region;counts.set(region,(counts.get(region)??0)+1);}
  assert.equal(pool.slots.length,50);assert.equal(new Set(pool.slots.map(s=>s.siteId)).size,50);
  assert([...counts.values()].every(n=>n<=3));return counts;
 };
 assert.equal(check().size,19);
 for(let n=0;n<300;n++){
  const slot=pool.slots[n%50],from=pool.sites.get(slot.siteId),now=1e6+n*60001;
  pool.refresh(now);assert(pool.claim({...from,mode:'walking',jumpLeft:0},now));
  assert.notEqual(pool.sites.get(slot.siteId).region,from.region);check();
 }
 assert.deepEqual(new KarmaPool(pool.save(),seeded()).save(),pool.save());
});

test('real room collects five over two islands with an exact persisted balance',async()=>{
 const room=await makeRoom(),player=addPlayer(room,501,{islandId:'home',x:2920,y:1340}),now=Date.now();
 const homes=room.karma.pool.slots.filter(s=>room.karma.pool.sites.get(s.siteId).region==='home');
 const next=room.karma.pool.slots.filter(s=>room.karma.pool.sites.get(s.siteId).region==='blossom');
 assert.equal(homes.length,3);assert.equal(next.length,3);
 const journey=[...homes,...next.slice(0,2)].map(slot=>({...room.karma.pool.sites.get(slot.siteId)}));
 for(const [n,site] of journey.entries()){
  Object.assign(player.actor,site);room.karma.update(now+n);
  assert.equal(player.actor.karma,n+1);
 }
 assert.equal(new Set(journey.map(s=>s.region)).size,2);
 room.karma.balances.clear();assert.equal(room.karma.balance(player.account),5);
});
