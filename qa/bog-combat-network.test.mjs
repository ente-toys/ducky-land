import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArenaProfiles} from '../server/arena-socket.mjs';
import {createArenaSocket,localArenaOrigin,ARENA_INPUT_BURST} from '../server/arena-socket.mjs';
import {ArenaClient,arenaURL,profileToken,ARENA_INPUT_INTERVAL,ARENA_INPUT_KEEPALIVE} from '../src/pixi/bog-combat/client.js';

class Socket extends EventEmitter{
  readyState=1;bufferedAmount=0;messages=[];
  send(m){this.messages.push(JSON.parse(m));}
  close(code,reason){this.code=code;this.reason=reason;this.readyState=3;this.emit('close',code,reason);}
  terminate(){this.close();}
  ping(){this.pinged=true;}
}
const token='a'.repeat(36),other='b'.repeat(36);
function fixture(options={}){const server=new EventEmitter(),data=new Map(),logs=[],profiles={get:id=>data.get(id),set:(id,value)=>data.set(id,value),flush(){}};let time=0;
  const room=createArenaSocket(server,profiles,{now:()=>time,log:message=>logs.push(message),...options});
  const connect=(profile=token,team='privacy',origin='http://localhost:5173')=>{const ws=new Socket();server.emit('connection',ws,{headers:{origin},url:`/arena-room?profile=${profile}&team=${team}&name=Ducky`});return ws;};
  return {room,connect,data,logs,advance:(ms)=>{time+=ms;}};
}
test('socket transport accepts local clients, rejects unrelated origins and invalid team/profile',()=>{
  const {room,connect}=fixture();for(const ws of [connect(token,'evil'),connect('short'),connect(token,'privacy','https://evil.example')])assert.equal(ws.code,1008);
  const a=connect();assert.equal(a.messages[0].type,'arena-welcome');assert.equal(a.messages[1].practice,false);
  room.close();
  assert.equal(localArenaOrigin('http://127.0.0.1:8800'),true);assert.equal(localArenaOrigin('http://localhost.evil:8800'),false);
});
test('two WebSocket handlers share authoritative movement, snapshots and disconnect cleanup',()=>{
  const {room,connect}=fixture(),a=connect(),b=connect(other,'google'),id=a.messages[0].id;
  assert.equal(b.messages.at(-1).players.some(p=>p.id===id),false,'hidden enemies are not sent');
  room.arena.state.players.get(id).shieldUntil=0;
  assert.equal(room.arena.state.practice,false);const start=room.arena.state.players.get(id).x;
  a.emit('message',Buffer.from(JSON.stringify({type:'arena-input',seq:1,x:1,y:0,ax:1,ay:0,fire:false,score:9999})),false);
  for(let i=0;i<6;i++)room.step();room.broadcast();
  const seen=b.messages.at(-1).players.find(p=>p.id===id);assert.ok(seen.x>start);assert.equal(seen.stats.score,0);
  a.close();assert.ok(!room.arena.state.players.has(id));assert.equal(room.arena.state.practice,false);b.close();assert.equal(room.arena.state.players.size,0);room.close();
});
test('transport rate limits, heartbeat expiry and backpressure release abandoned actors',()=>{
  const {room,connect,advance,logs}=fixture(),a=connect(),id=a.messages[0].id;
  a.bufferedAmount=70000;const count=a.messages.length;room.broadcast();assert.equal(a.messages.length,count);
  for(let n=0;n<=ARENA_INPUT_BURST;n++)a.emit('message',Buffer.from('{}'),false);assert.equal(a.code,1008);assert.ok(!room.arena.state.players.has(id));
  assert.ok(logs.some(line=>line.includes('code=1008')&&line.includes('Arena input rate exceeded')));
  const b=connect();room.heartbeat();assert.ok(b.pinged);advance(16000);room.heartbeat();assert.equal(b.readyState,3);room.close();
});
test('profile totals survive a server store reload and never accept malformed counters',()=>{
  const file=join(mkdtempSync(join(tmpdir(),'bog-profile-')),'totals.json'),store=createArenaProfiles(file);
  store.set(token,{tags:7,score:70,medals:7,bestStreak:3,survives:-100});store.flush();
  const second=createArenaProfiles(file);assert.deepEqual(second.get(token),{tags:7,score:70,medals:7,bestStreak:3,survives:0});assert.equal(JSON.parse(readFileSync(file))[token].tags,7);
});
test('client emits directions only, ignores old snapshots, clears connection and disposes once',()=>{
  let ws;class ClientSocket{readyState=1;bufferedAmount=0;messages=[];constructor(){ws=this;}send(m){this.messages.push(JSON.parse(m));}close(){this.closes=(this.closes||0)+1;}}
  const statuses=[],client=new ArenaClient({team:'privacy',name:'A',profile:token,Socket:ClientSocket,url:'ws://localhost/arena-room',onStatus:s=>statuses.push(s)});
  ws.onmessage({data:JSON.stringify({type:'arena-welcome',id:'a'})});
  const snapshot={type:'arena-snapshot',tick:2,players:[{id:'a',x:100,y:100,alive:true,stats:{}}]};ws.onmessage({data:JSON.stringify(snapshot)});
  ws.onmessage({data:JSON.stringify({...snapshot,tick:1,players:[]})});assert.equal(client.snapshot.tick,2);
  client.control({x:1,y:0},Math.PI/4,true,1/60,100);client.control({x:1,y:0},Math.PI/4,true,1/60,101);
  assert.equal(ws.messages.length,1);assert.deepEqual(Object.keys(ws.messages[0]).sort(),['facing','fire','run','seq','type','x','y']);
  client.dispose();client.dispose();assert.equal(ws.closes,1);assert.ok(statuses.includes('connected'));
});
test('browser profile token persists and URL uses the current page WebSocket origin',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const profile=profileToken(storage);assert.equal(profileToken(storage),profile);
  const url=arenaURL({profile,team:'google',name:'Plain Duck'},'https://game.example/?arena');assert.equal(url.protocol,'wss:');assert.equal(url.pathname,'/arena-room');assert.equal(url.searchParams.get('name'),'Plain Duck');
});

test('run changes coalesce at 30 Hz and prediction reconciles authoritative momentum without a camera jump',()=>{
  let ws;class ClientSocket{readyState=1;bufferedAmount=0;messages=[];constructor(){ws=this;}send(m){this.messages.push(JSON.parse(m));}close(){}}
  const client=new ArenaClient({team:'privacy',profile:token,Socket:ClientSocket,url:'ws://localhost/arena-room'});
  ws.onmessage({data:JSON.stringify({type:'arena-welcome',id:'a'})});
  const receive=(tick,x,extra={})=>ws.onmessage({data:JSON.stringify({type:'arena-snapshot',tick,time:tick/60,players:[{id:'a',x,y:2400,alive:true,pace:0,heading:null,turn:0,ack:-1,...extra}]})});
  receive(1,2040);client.control({x:1,y:0,run:false},0,false,1/60,100);
  client.control({x:1,y:0,run:true},0,false,1/60,101);assert.equal(ws.messages.length,1);
  client.control({x:1,y:0,run:true},0,false,1/60,134);assert.equal(ws.messages.length,2);assert.equal(ws.messages[1].run,true);
  const shown=client.view(1).x;receive(2,2040,{ack:1});assert.ok(Math.abs(client.view(1).x-shown)<1e-7,'reconciliation preserves drawn position');
  receive(3,2040,{alive:false,ack:1});client.control({x:1,y:0,run:true},0,true,1/60,200);assert.equal(client.predicted.x,2040);
  receive(4,2040,{alive:true,ack:2});assert.equal(client.predicted.pace,0);assert.equal(client.offsetX,0);client.dispose();
});

test('120 Hz controls and held Space for 30 seconds stay below the server limit, including changing every frame',()=>{
  for(const changing of [false,true]){
    const {room,connect,advance}=fixture({practice:false});let socket,time=0,shots=0,lastFire=0;
    class ClientSocket{
      readyState=1;bufferedAmount=0;sent=[];
      constructor(){socket=this;this.peer=connect();}
      send(data){this.sent.push({time,message:JSON.parse(data)});this.peer.emit('message',Buffer.from(data),false);}
      close(){this.peer.close(1000,'Test finished');}
    }
    const client=new ArenaClient({team:'privacy',profile:token,Socket:ClientSocket,url:'ws://localhost/arena-room'});
    for(const message of socket.peer.messages)socket.onmessage({data:JSON.stringify(message)});
    const player=room.arena.state.players.get(client.id);
    for(let frame=0;frame<120*30;frame++){
      const next=frame*1000/120;advance(next-time);time=next;
      client.control({x:changing?Math.cos(frame/13):1,y:changing?Math.sin(frame/13):0,run:true},0,true,1/120,time);
      if(frame%2===0){room.step();if(player.nextFire>lastFire){shots++;lastFire=player.nextFire;}}
      assert.equal(socket.peer.readyState,1,`frame ${frame}: ${socket.peer.reason}`);
      assert.ok(room.arena.state.time-player.inputAt<.2,'keepalive prevents held input expiring');
    }
    assert.ok(socket.sent.length<=900);
    if(!changing)assert.ok(socket.sent.length<=300,'unchanged held controls only need keepalives');
    for(let i=1;i<socket.sent.length;i++){
      const gap=socket.sent[i].time-socket.sent[i-1].time;
      assert.ok(gap+1e-7>=ARENA_INPUT_INTERVAL,'changes never bypass 30 Hz');
      assert.ok(gap<=ARENA_INPUT_KEEPALIVE+1000/120+1e-7,'held controls stay fresh');
    }
    assert.ok(shots>50,'server fires repeatedly from the held flag');
    assert.ok(socket.sent.every(({message})=>message.type==='arena-input'&&message.fire&&message.run));
    client.dispose();room.close();
  }
});

test('coalescing sends the latest release and queued emote, and resumes after backpressure',()=>{
  let ws;class ClientSocket{readyState=1;bufferedAmount=0;messages=[];constructor(){ws=this;}send(data){this.messages.push(JSON.parse(data));}close(){}}
  const client=new ArenaClient({profile:token,Socket:ClientSocket,url:'ws://localhost/arena-room'});
  ws.onmessage({data:JSON.stringify({type:'arena-welcome',id:'a'})});
  client.control({x:1,y:0,run:true},0,true,0,0);
  client.control({x:0,y:1,run:true},1,true,0,8,3);
  client.control({x:0,y:0,run:false},1,false,0,16);
  assert.equal(ws.messages.length,1);
  ws.bufferedAmount=5000;client.control({x:0,y:0,run:false},1,false,0,34);assert.equal(ws.messages.length,1);
  ws.bufferedAmount=0;client.control({x:0,y:0,run:false},1,false,0,42);
  assert.deepEqual(ws.messages.at(-1),{type:'arena-input',seq:1,x:0,y:0,run:false,facing:1,fire:false,emote:3});
  client.dispose();
});

test('reconnect replaces a stale profile slot, saves totals and ignores delayed old socket events',()=>{
  const {room,connect,data,logs}=fixture(),old=connect(),oldId=old.messages[0].id;
  const player=room.arena.state.players.get(oldId);player.stats.tags=7;player.stats.score=70;
  old.close=function(code,reason){this.code=code;this.reason=reason;};
  const fresh=connect(token,'google'),id=fresh.messages[0].id;
  assert.equal(fresh.messages[0].type,'arena-welcome');assert.equal(old.code,4001);
  assert.match(old.reason,/replaced/);assert.notEqual(id,oldId);
  assert.equal(data.get(token).tags,7);assert.equal(room.arena.state.players.get(id).stats.score,70);
  assert.equal(room.arena.state.players.get(id).team,'google');
  assert.equal([...room.arena.state.players.values()].filter(p=>!p.bot).length,1);
  old.emit('message',Buffer.from(JSON.stringify({type:'arena-input',seq:99,x:1,y:0,fire:true})),false);
  old.emit('close',old.code,Buffer.from(old.reason));old.emit('error',new Error('late reset'));
  assert.ok(room.arena.state.players.has(id));assert.equal(room.arena.state.players.get(id).seq,-1);
  assert.ok(logs.some(line=>line.includes('code=4001')&&line.includes('replaced')));
  fresh.emit('message',Buffer.from(JSON.stringify({type:'arena-input',seq:0,x:0,y:1,fire:true})),false);
  assert.equal(room.arena.state.players.get(id).seq,0);fresh.close();assert.equal(room.arena.state.players.size,0);room.close();
});

function retryClient(){
  const sockets=[],timers=new Map(),statuses=[];let timerId=0;
  class ClientSocket{
    readyState=1;bufferedAmount=0;messages=[];
    constructor(){sockets.push(this);}
    send(data){this.messages.push(JSON.parse(data));}
    receive(message){this.onmessage({data:JSON.stringify(message)});}
    drop(code,reason){this.readyState=3;this.onclose({code,reason});}
    close(){this.closes=(this.closes||0)+1;this.drop(1000,'Leaving');}
  }
  const client=new ArenaClient({profile:token,Socket:ClientSocket,url:'ws://localhost/arena-room',onStatus:(status,details)=>statuses.push({status,details}),schedule:fn=>{timers.set(++timerId,fn);return timerId;},cancel:id=>timers.delete(id)});
  const retry=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
  return {client,sockets,timers,statuses,retry};
}

test('client exposes close code/reason, reconnects once, resets snapshot ordering and ignores retired sockets',()=>{
  const {client,sockets,timers,statuses,retry}=retryClient(),old=sockets[0];
  const snapshot=tick=>({type:'arena-snapshot',tick,players:[]});
  old.receive({type:'arena-welcome',id:'old'});old.receive(snapshot(100));
  old.drop(1008,'Arena input rate exceeded');
  assert.deepEqual(statuses.at(-1),{status:'reconnecting',details:{code:1008,reason:'Arena input rate exceeded'}});
  assert.equal(client.snapshot,null);assert.equal(client.id,null);assert.equal(timers.size,1);
  retry();const fresh=sockets[1];fresh.receive({type:'arena-welcome',id:'new'});fresh.receive(snapshot(1));
  assert.equal(client.id,'new');assert.equal(client.snapshot.tick,1);assert.equal(statuses.at(-1).status,'connected');
  old.receive({type:'arena-welcome',id:'retired'});old.drop(1006,'Old error');assert.equal(client.id,'new');
  client.control({x:1,y:0},0,true,0,1);assert.equal(fresh.messages[0].seq,0);
  fresh.drop(1006,'');assert.equal(timers.size,0);assert.equal(sockets.length,2);
  assert.equal(statuses.at(-1).status,'disconnected');assert.match(statuses.at(-1).details.reason,/interrupted/);
  client.dispose();
});

test('replaced clients stay retired and disposal cancels the automatic reconnect',()=>{
  for(const code of [1000,4001]){const {client,sockets,timers,statuses}=retryClient();sockets[0].drop(code,'Session ended');assert.equal(timers.size,0);assert.equal(statuses.at(-1).status,'disconnected');client.dispose();}
  const {client,sockets,timers}=retryClient();sockets[0].drop(1006,'');assert.equal(timers.size,1);client.dispose();client.dispose();assert.equal(timers.size,0);assert.equal(sockets.length,1);
});
