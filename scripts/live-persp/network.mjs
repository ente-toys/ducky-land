// Isolated copy of qa/network.test.mjs, only fixture port and relative imports differ.
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {setTimeout as delay} from 'node:timers/promises';
import {geometry} from '../../rive/web/island-geometry.mjs';
import {createIslandBrain,CROWD_ACTION} from '../../rive/web/crowd.js';
import {world} from '../../server-world.mjs';
import {sample} from '../../rive/web/interpolation.js';

async function client(name,city=0){const socket=new WebSocket(`ws://127.0.0.1:8838/room?name=${name}&city=${city}&cap=8&shades=1&acc=7&shoes=2`,{origin:'http://127.0.0.1:8800'}),messages=[];let welcome;
 socket.on('message',bytes=>{const m=JSON.parse(bytes);messages.push(m);if(m.type==='welcome')welcome=m;});
 for(let i=0;i<200&&!welcome;i++)await delay(10);assert.ok(welcome,'Socket welcome');
 return{socket,messages,welcome,send:m=>socket.send(JSON.stringify(m)),get snapshot(){return messages.findLast(m=>m.type==='snapshot');}};
}
test('two actual socket clients share identity, motion, turns, emotes, totals and departures',async()=>{
 const a=await client('test_a',0),b=await client('test_b',1);
 try{
  await delay(150);assert.equal(a.snapshot.players.length,2);assert.equal(b.snapshot.players.length,2);assert.equal(a.welcome.self.name,'test_a');assert.equal(a.welcome.self.acc,7);
  const {walkable}=geometry(world),start={...a.welcome.self};let seq=0,x=start.x,y=start.y;
  for(let i=0;i<8;i++){await delay(90);const nx=x+16;if(walkable(nx,y))x=nx;a.send({type:'state',seq:++seq,x,y,facing:1,turn:90,action:1});}
  await delay(150);let seen=b.snapshot.players.find(p=>p.id===a.welcome.id);assert.ok(seen.x>start.x+60);assert.equal(seen.turn,90);assert.equal(seen.action,1);
  const total=a.snapshot.quacks.Kochi;a.send({type:'emote',action:'quack',seq:1});a.send({type:'emote',action:'quack',seq:1});await delay(160);
  assert.equal(b.snapshot.quacks.Kochi,total+1);assert.equal(b.snapshot.players.find(p=>p.id===a.welcome.id).action,2);
  b.send({type:'emote',action:'heart',seq:1});await delay(140);assert.equal(a.snapshot.players.find(p=>p.id===b.welcome.id).action,4);
  const before={...a.snapshot.players.find(p=>p.id===a.welcome.id)};a.send({type:'state',seq:++seq,x:10,y:10,facing:1,turn:0,action:1});await delay(150);seen=b.snapshot.players.find(p=>p.id===a.welcome.id);assert.equal(seen.x,before.x);assert.equal(seen.y,before.y);
  assert.ok(a.snapshot.bots.some(d=>String(d.id).startsWith('social-')));assert.ok(a.snapshot.bots.every(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&Number.isInteger(d.action)));
  b.socket.close();await delay(200);assert.equal(a.snapshot.players.length,1);
 }finally{a.socket.close();b.socket.close();}
});
test('remote interpolation stays bounded and holds the last state',()=>{
 const h=[{time:0,x:0,y:10,action:0},{time:100,x:20,y:30,action:1}];assert.equal(sample(h,50).x,10);assert.equal(sample(h,200).x,20);assert.equal(sample(h,-100).x,0);
});
test('adapted social crowd makes finite decisions on island furniture',()=>{
 const {walkable}=geometry(world),{brain,ox,oy}=createIslandBrain(world,walkable);
 brain.updatePlayer=()=>{brain.player.x=800;brain.player.y=880;};
 for(let i=0;i<60*60;i++)brain.update(1/60);
 assert.ok(brain.events.some(e=>e.type==='sit'));assert.ok(brain.events.some(e=>e.type==='visit'));assert.ok(brain.events.some(e=>e.type==='party'));
 assert.ok(brain.ducks.every(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&CROWD_ACTION[d.action]!==undefined));
 assert.ok(brain.ducks.slice(1).every(d=>d.goal?.kind==='bench'||walkable(d.x+ox,d.y+oy)));
});
