import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,addPlayer} from './room-harness.mjs';

test('holding WASD into shore stays aboard until Dock is explicitly requested',async()=>{
  const room=await makeRoom();
  const {actor,socket}=addPlayer(room,9876,{x:-120,y:1960,mode:'sailing'});
  const boat=room.boats.find(b=>b.id==='home-0');
  Object.assign(boat,{x:actor.x,y:actor.y,occupant:actor.id});actor.boatId=boat.id;
  try {
    room.webSocketMessage(socket,JSON.stringify({type:'input',seq:1,x:1,y:0}));
    for(let i=0;i<50;i++)room.step();
    assert.equal(actor.travel,0,'boat reaches shore and stops');
    assert.equal(actor.mode,'sailing','continued shoreward input does not auto-dock');
    assert.equal(boat.occupant,actor.id);
    room.webSocketMessage(socket,JSON.stringify({type:'disembark',seq:2}));
    for(let i=0;i<50 && actor.mode==='sailing';i++)room.step();
    assert.equal(actor.mode,'walking');assert.equal(boat.occupant,null);assert.equal(boat.parked,true);
    assert.ok(room.boats.includes(boat),'explicit landing still preserves the arrival boat');
  } finally {clearInterval(room.timer);}
});
