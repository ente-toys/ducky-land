import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';
import {harborOf} from '../src/gameplay/islands.js';

// A sailor who disconnects keeps the boat for a resume. Nobody is in it to draw, so other
// players saw piles of "empty" boats while sailing that vanished again when they docked.
test('a boat whose rider disconnected is neither sent nor solid until the rider returns',async t=>{
  const room=await makeRoom();t.after(()=>clearInterval(room.timer));
  const h=harborOf('home'),at={x:h.water.x,y:h.water.y+900};
  const viewer=addPlayer(room,1,{islandId:'home',mode:'sailing',...at});
  viewer.actor.boatId='mine';
  room.boats.push({id:'mine',islandId:'home',...at,turn:0,occupant:viewer.actor.id});
  const ghost={id:'ghost',islandId:'home',x:at.x+400,y:at.y,turn:0,occupant:'gone-rider',unattendedAt:Date.now()};
  room.boats.push(ghost);
  room.broadcast();
  const ids=()=>JSON.parse(viewer.socket.last).boats.map(b=>b.id);
  assert.ok(ids().includes('mine'),'the viewer still sees their own boat');
  assert.ok(!ids().includes('ghost'),'the abandoned boat is not sent');

  const info=room.connections.get(viewer.socket);
  info.input={x:1,y:0};info.inputExpires=Date.now()+60000;
  for(let k=0;k<40;k++)room.stepMovement(Date.now());
  assert.ok(viewer.actor.x>ghost.x,'sailing straight through the empty spot is allowed');

  delete ghost.unattendedAt;
  room.broadcast();
  assert.ok(ids().includes('ghost'),'once the rider is back the boat is visible again');
});
