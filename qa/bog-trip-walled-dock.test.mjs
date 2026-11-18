import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {destinationsFor,sailRoute,setSailDestination} from '../src/gameplay/islands.js';

// Bog's moorings block the exact dock point, so the route aims for free water beside it.
test('a 5-feather Ducky sails from a Home mooring to Booquack Bog past its moored boats and lands', async () => {
  const room=await makeRoom();
  try {
    const bog=destinationsFor('home').find(d=>d.destination==='isle-249');
    assert.equal(sailRoute('home',{x:3960,y:6100},bog.dock,room.boats.filter(b=>b.islandId==='isle-249')).length>0,true);
    const boat=room.boats.find(b=>b.id==='home-3');
    const p=addPlayer(room,9101,{islandId:'home',x:boat.x,y:boat.y,mode:'sailing'});
    Object.assign(boat,{occupant:p.actor.id});p.actor.boatId=boat.id;
    room.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,?)',p.account,5);room.karma.balances.delete(p.account);
    assert.ok(setSailDestination(p.actor,bog.dock.x,bog.dock.y,room.boats),'the planner finds a course');
    let landed=false;
    for (let i=0;i<20*120 && !landed;i++) {
      room.step();
      if (p.actor.islandId==='isle-249' && p.actor.mode==='sailing' && !p.actor.sailTarget && !p.sent) {
        p.sent=true; room.webSocketMessage(p.socket,JSON.stringify({type:'disembark',seq:2}));
      }
      landed=p.actor.islandId==='isle-249' && p.actor.mode==='walking';
    }
    assert.ok(landed,'lands on Bog within two minutes');
  } finally {clearInterval(room.timer);room.bog?.dispose();}
});
