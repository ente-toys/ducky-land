import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRoom,fakeSocket} from './room-harness.mjs';
import {mapOf} from '../src/world/island-maps.js';
import {IslandRoom} from '../worker/index.js';

const NativeResponse=globalThis.Response;
globalThis.Response=class extends NativeResponse {
  constructor(body,options) {
    if(options?.status===101) {super(null,{status:200});this.webSocket=options.webSocket;}
    else super(body,options);
  }
};
globalThis.WebSocketPair=class {constructor(){this[0]=fakeSocket();this[1]=fakeSocket();}};

for(const islandId of ['isle-230','isle-93','isle-56','isle-163','isle-170','isle-176'])test(`${islandId}: walking and sailing saves, hibernated players and viewers return to Home`,async()=>{
  const room=await makeRoom(),now=Date.now(),map=mapOf('home');
  room.sql.exec('INSERT INTO sessions VALUES(?,?,?,?,?,?)','fixture','fixture','fixture',now+86400000,1,'fixture');
  const check=actor=>{
    assert.equal(actor.islandId,'home');assert.equal(actor.mode,'walking');assert.equal(actor.boatId,null);
    assert.equal(actor.exitLocked,false);assert.equal(actor.docking,false);
    assert.deepEqual([actor.x,actor.y],map.world.zones.plaza.spawn);
    assert.ok(map.nav().walkable(actor.x,actor.y));
    assert.equal(actor.sailTarget,null);assert.equal(actor.sailRoute,null);
  };
  for(const mode of ['walking','sailing']) {
    const pose={id:'retired',islandId,mode,x:-9000,y:-9000,turn:1,boatId:islandId+'-0',docking:true,exitLocked:true,sailTarget:{x:1,y:2},sailRoute:[{x:3,y:4}]};
    room.sql.exec('INSERT OR REPLACE INTO resumes VALUES(?,?,?)','fixture',JSON.stringify(pose),now+15000);
    room.join(new Request('https://island.example/api/room?play=1',{headers:{Upgrade:'websocket','X-Session-Digest':'fixture'}}),now);
    const info=[...room.connections.values()].find(i=>i.actor);
    check(info.actor);room.connections.clear();
    const player=fakeSocket(),viewer=fakeSocket();
    player.deserializeAttachment=()=>({...info,actor:pose,islandId});
    viewer.deserializeAttachment=()=>({actor:null,islandId});
    const restored=new IslandRoom({...room.ctx,getWebSockets:()=>[player,viewer]});
    check(restored.connections.get(player).actor);
    assert.equal(restored.connections.get(player).islandId,'home');
    assert.equal(restored.connections.get(viewer).islandId,'home');
    room.sql.exec('INSERT OR REPLACE INTO last_locations VALUES(?,?)','fixture',JSON.stringify(pose));
    room.join(new Request('https://island.example/api/room?play=1',{headers:{Upgrade:'websocket','X-Session-Digest':'fixture'}}),now);
    const returning=[...room.connections.values()].find(i=>i.actor);
    assert.equal(returning.actor.islandId,'home');
    assert.equal(returning.actor.mode,'walking');
    assert.deepEqual([returning.actor.x,returning.actor.y],map.world.zones.plaza.spawn);
    room.connections.clear();
  }
});
