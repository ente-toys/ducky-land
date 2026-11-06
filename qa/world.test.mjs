import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {FINISHED_THEMES, THEME_OF, mapOf} from '../src/pixi/island-maps.js';
import {WORLD_ISLANDS, layoutWorld, offsetOf, neighboursOf, clearOf, GAP} from '../src/pixi/world-map.js';
import {DROP_SPACING, randomDrop, validDrop, navigationWithSleepers, sleepPose} from '../src/pixi/player-presence.js';
import {makeRoom, addPlayer, fakeSocket, seeded} from './room-harness.mjs';
import {RoomClient} from '../src/pixi/room-client.js';

const distance = i => {const o=offsetOf('home',i.id);return Math.hypot(o.x,o.y);};
test('world: finished themes occupy the nearest spots in finish order and keep saved island IDs', () => {
  const nearest=WORLD_ISLANDS.filter(i=>i.id!=='home').sort((a,b)=>distance(a)-distance(b));
  assert.deepEqual(nearest.slice(0,10).map(i=>i.theme),FINISHED_THEMES);
  assert.deepEqual(nearest.slice(0,10).map(i=>i.id),['blossom','sunset','isle-251','isle-250','isle-170','isle-230','isle-176','isle-56','isle-93','isle-163']);
  assert.deepEqual([...THEME_OF.values()],FINISHED_THEMES);
  assert.ok(neighboursOf('home').every(n=>n.island.theme),'Home jetty neighbours are finished themes');
  for(let i=1;i<10;i++) assert.ok(distance(nearest[i])>distance(nearest[i-1]));
});
test('world: appending a finished theme takes the next slot without moving earlier themes', () => {
  const next=layoutWorld(undefined,11,[...FINISHED_THEMES,'future-theme']);
  for(const old of WORLD_ISLANDS.filter(i=>i.theme)) {
    const added=next.islands.find(i=>i.id===old.id);
    assert.deepEqual([added.x,added.y,added.theme],[old.x,old.y,old.theme]);
  }
  const home=next.islands[0];
  const ordered=next.islands.filter(i=>i.id!=='home').sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y));
  assert.equal(ordered[10].theme,'future-theme');
  const geo={SX:next.SX,wrapd:next.wrapd,latOf:y=>-(y-home.y)/next.Rw};
  for(let i=0;i<next.islands.length;i++) for(let j=i+1;j<next.islands.length;j++) assert.ok(clearOf(next.islands[i],next.islands[j],geo)>GAP);
});
test('world: 550 seeded random drops are valid, use all finished islands and never stack', () => {
  const random=seeded(39), occupied=[], counts=new Map();
  for(let i=0;i<550;i++) {
    const drop=randomDrop({random,occupied,counts});
    assert.ok(drop);
    assert.ok(validDrop(mapOf(drop.islandId),drop.x,drop.y,occupied.filter(p=>p.islandId===drop.islandId)));
    occupied.push(drop);counts.set(drop.islandId,(counts.get(drop.islandId)??0)+1);
  }
  assert.equal(counts.size,11);
  assert.ok([...counts.values()].every(n=>n>=25 && n<=80),JSON.stringify([...counts]));
  for(let i=0;i<occupied.length;i++) for(let j=i+1;j<occupied.length;j++) if(occupied[i].islandId===occupied[j].islandId)
    assert.ok(Math.hypot(occupied[i].x-occupied[j].x,occupied[i].y-occupied[j].y)>=DROP_SPACING);
});
test('world: random drops reject water, props, NPC beds, player beds and full islands', () => {
  for(const id of ['home',...THEME_OF.keys()]) {
    const map=mapOf(id);
    assert.equal(validDrop(map,0,0),false);
    for(const bed of map.sleepers) assert.equal(validDrop(map,bed.x,bed.y),false);
    for(const p of map.walk.obstacles.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,20)) assert.equal(validDrop(map,p.x,p.y),false);
    const drop=randomDrop({random:seeded(12)});
    assert.equal(validDrop(mapOf(drop.islandId),drop.x,drop.y,[drop]),false);
  }
  const counts=new Map(['home',...THEME_OF.keys()].map(id=>[id,100]));
  assert.equal(randomDrop({counts}),null);
  counts.set('isle-163',99);
  assert.equal(randomDrop({counts,random:seeded(22)}).islandId,'isle-163');
});
test('world: offline close saves exact pose and outfit in SQLite, publishes sleeping art, and blocks walking', async () => {
  const room=await makeRoom(), drop=randomDrop({random:seeded(5)});
  const p=addPlayer(room,1,{...drop,x:drop.x+.123456,y:drop.y+.654321});
  const observer=fakeSocket();room.connections.set(observer,{islandId:drop.islandId});
  const other=fakeSocket();room.connections.set(other,{islandId:drop.islandId==='home'?'blossom':'home'});
  room.webSocketClose(p.socket);
  const saved=JSON.parse(room.sql.exec('SELECT pose FROM player_states WHERE account=?',p.account).one().pose);
  assert.deepEqual([saved.islandId,saved.x,saved.y,saved.outfit],[p.actor.islandId,p.actor.x,p.actor.y,p.actor.outfit]);
  const snap=JSON.parse(observer.last), sleeping=snap.sleepers[0];
  assert.equal(snap.players.length,0);assert.equal(snap.online,2);
  assert.equal(sleeping.id,p.actor.id);assert.equal(sleeping.action,7);assert.equal(sleeping.sleep.pose,'wing');assert.equal(sleeping.sleeping,true);
  assert.deepEqual(sleeping.outfit,p.actor.outfit);
  assert.equal(JSON.parse(other.last).sleepers.length,0);
  const nav=room.navFor(drop.islandId);
  assert.equal(nav.walkable(saved.x,saved.y),false);
  assert.equal(nav.clearLine([saved.x-120,saved.y],[saved.x+120,saved.y]),false);
  const route=nav.route(saved.x-120,saved.y,saved.x+120,saved.y);
  assert.ok(route.length>1);
  let last=[saved.x-120,saved.y];for(const point of route){assert.ok(nav.clearLine(last,point));last=point;}
});
test('world: client draws offline players as sleepers and uses their footprints for prediction until wake', async () => {
  const room=new RoomClient();const map=mapOf('home');room.configure(map.nav(),map.walk);
  const sleeper=sleepPose({id:'sleeping',islandId:'home',x:2820,y:2640,mode:'walking',turn:0,travel:0,outfit:{cap:3}});
  room.snapshot({epoch:'world',tick:1,players:[],sleepers:[sleeper],self:null,online:0});
  assert.equal(room.tracks.get('sleeping').to.sleeping,true);
  assert.equal(room.navHere().walkable(sleeper.x,sleeper.y),false);
  assert.equal(room.friendPlayers.length,0);
  room.snapshot({epoch:'world',tick:2,players:[{...sleeper,sleeping:false,action:0}],sleepers:[],self:null,online:1});
  assert.equal(room.tracks.get('sleeping').to.sleeping,false);
  assert.equal(room.navHere().walkable(sleeper.x,sleeper.y),true);
});

let bundled;
async function runtime(t) {
  if(!bundled) {
    const {outputFiles:[file]}=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),contents:`
      import {IslandRoom} from './worker/index.js';
      export class TestRoom extends IslandRoom {
        async fetch(request) {
          const path=new URL(request.url).pathname;
          if(path==='/test/pose') {
            const {account,pose}=await request.json();
            const entry=[...this.connections].find(([,i])=>i.account===account && i.actor);
            Object.assign(entry[1].actor,pose);this.attach(...entry);this.broadcast();return Response.json({});
          }
          if(path==='/test/record') {
            const {account}=await request.json();return Response.json(this.sql.exec('SELECT pose FROM player_states WHERE account=?',account).toArray());
          }
          if(path==='/test/capacity') {
            const {islandId,count}=await request.json();this.testFill=count ? {islandId,count}:null;
            for(const [s,i] of this.connections) if(i.fixture) this.connections.delete(s);
            for(let i=0;i<count;i++) this.connections.set({readyState:0},{fixture:true,actor:{id:'fill'+i,islandId,x:100,y:100,turn:0,travel:0,outfit:{}}});
            return Response.json({});
          }
          return super.fetch(request);
        }
      }
      export default {fetch(request,env){return env.ROOM.get(env.ROOM.idFromName('world')).fetch(request);}};
    `},bundle:true,format:'esm',write:false});bundled=file.text;
  }
  const dir=await mkdtemp(join(tmpdir(),'ducky-world-'));
  const options=convertV4MiniflareOptions({modules:[{type:'ESModule',path:'index.js',contents:bundled}],compatibilityDate:'2026-11-02',
    durableObjects:{ROOM:{className:'TestRoom',useSQLite:true}},resourcePersistencePath:dir});
  let mf=new Miniflare(options);await mf.ready;
  const clients=[];
  t.after(async()=>{for(const c of clients)try{c.ws.close();}catch{}await mf.dispose();await rm(dir,{recursive:true,force:true});});
  const request=(path,body,headers={})=>mf.dispatchFetch('https://world.test'+path,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers});
  async function connect(account,play=true) {
    const r=await request('/room?play='+(play?1:0),null,{Upgrade:'websocket',...(account?{'X-Session-Digest':account}:{})});
    assert.equal(r.status,101);const ws=r.webSocket,messages=[];ws.addEventListener('message',e=>messages.push(JSON.parse(e.data)));ws.accept();
    const c={ws,messages,get welcome(){return messages.find(m=>m.type==='welcome');},get snapshot(){return messages.findLast(m=>m.type==='snapshot');},
      watch(id){ws.send(JSON.stringify({type:'watch',islandId:id}));}};clients.push(c);await until(()=>c.snapshot||c.welcome);return c;
  }
  return {request,connect,async account(id){await request('/session/new',{account:id,login:'duck'+id,digest:id,canPlay:true,githubToken:'fixture'});},
    async restart(){await mf.dispose();mf=new Miniflare(options);await mf.ready;}};
}
async function until(fn) {for(let i=0;i<150;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,20));}assert.fail('Timed out waiting for presence');}
const own=c=>c.snapshot?.players.find(p=>p.id===c.welcome.id);

test('world: real joins randomize, close sleeps, reconnect wakes exactly, and takeover leaves one actor', async t => {
  const r=await runtime(t);await r.account('2001');await r.account('2002');
  const a=await r.connect('2001'), b=await r.connect('2002');
  assert.ok(validDrop(mapOf(own(a).islandId),own(a).x,own(a).y));assert.ok(validDrop(mapOf(own(b).islandId),own(b).x,own(b).y));
  const id=a.welcome.id, pose={islandId:'sunset',x:4000.123456,y:4000.654321,outfit:{cap:8,shades:2,acc:4,shoes:3}};
  const m=mapOf('sunset'), p=m.nav().nearest(pose.x,pose.y);pose.x=p[0];pose.y=p[1];
  await r.request('/test/pose',{account:'2001',pose});
  const guest=await r.connect(null,false);guest.watch('sunset');await until(()=>guest.snapshot?.islandId==='sunset');
  a.ws.close();await until(()=>guest.snapshot?.sleepers.some(p=>p.id===id));
  const record=await r.request('/test/record',{account:'2001'}).then(r=>r.json());assert.deepEqual(JSON.parse(record[0].pose).outfit,pose.outfit);
  const awake=await r.connect('2001');assert.equal(awake.welcome.id,id);
  assert.deepEqual([own(awake).islandId,own(awake).x,own(awake).y],['sunset',Math.round(pose.x*100)/100,Math.round(pose.y*100)/100]);
  await until(()=>!guest.snapshot.sleepers.some(p=>p.id===id));
  const takeover=await r.connect('2001');assert.equal(takeover.welcome.id,id);
  await until(()=>awake.messages.some(m=>m.type==='role'&&m.reason==='taken-over'));
  assert.equal(takeover.snapshot.players.filter(p=>p.id===id).length,1);assert.equal(takeover.snapshot.sleepers.length,0);
});
test('world: disk-backed SQLite survives a full Workers runtime restart, offline and during active movement', async t => {
  const r=await runtime(t);await r.account('3001');let c=await r.connect('3001');
  const pose={islandId:'isle-251',...mapOf('isle-251').spawn,outfit:{cap:6,shades:1,acc:3,shoes:9}};
  pose.x+=.123456;pose.y+=.654321;
  await r.request('/test/pose',{account:'3001',pose});const id=c.welcome.id;c.ws.close();
  const watch=await r.connect(null,false);watch.watch(pose.islandId);await until(()=>watch.snapshot?.sleepers.some(p=>p.id===id));
  await r.restart();
  const observer=await r.connect(null,false);observer.watch(pose.islandId);await until(()=>observer.snapshot?.sleepers.some(p=>p.id===id));
  const raw=await r.request('/test/record',{account:'3001'}).then(r=>r.json());
  assert.deepEqual([JSON.parse(raw[0].pose).x,JSON.parse(raw[0].pose).y],[pose.x,pose.y]);
  c=await r.connect('3001');assert.equal(c.welcome.id,id);assert.equal(own(c).islandId,pose.islandId);assert.deepEqual(own(c).outfit,pose.outfit);
  // Persist an active position before any close event, then discard the runtime.
  pose.x+=32;await r.request('/test/pose',{account:'3001',pose});await r.restart();
  c=await r.connect('3001');assert.equal(c.welcome.id,id);assert.equal(own(c).x,Math.round(pose.x*100)/100);
});
test('world: sleeping players do not consume capacity, but waking cannot bypass island or global limits', async t => {
  const r=await runtime(t);await r.account('4001');await r.account('4002');const c=await r.connect('4001');
  const pose={islandId:'home',...mapOf('home').spawn};await r.request('/test/pose',{account:'4001',pose});c.ws.close();
  const watch=await r.connect(null,false);await until(()=>watch.snapshot?.sleepers.length===1);
  await r.request('/test/capacity',{islandId:'home',count:100});
  const blocked=await r.connect('4001');assert.equal(blocked.welcome.reason,'players-full');
  assert.equal(blocked.snapshot.sleepers.length,1);
  const newcomer=await r.connect('4002');assert.ok(newcomer.welcome.id);assert.notEqual(own(newcomer).islandId,'home');
  await r.request('/test/capacity',{islandId:'home',count:200});
  const global=await r.connect('4001');assert.equal(global.welcome.reason,'players-full');
  await r.request('/test/capacity',{islandId:'home',count:0});
  const woke=await r.connect('4001');assert.equal(woke.welcome.id,c.welcome.id);assert.equal(own(woke).islandId,'home');
});

test('world: session expiry and sign-out preserve the sleeper for a fresh GitHub session', async t => {
  const r=await runtime(t);await r.account('5001');const c=await r.connect('5001'), before=own(c), id=c.welcome.id;
  await r.request('/session/revoke',{digest:'5001'});
  await until(()=>c.messages.some(m=>m.type==='role'));
  assert.ok(c.snapshot.sleepers.some(p=>p.id===id));
  const spectator=await r.connect('5001');assert.equal(spectator.welcome.id,null);
  await r.request('/session/new',{account:'5001',login:'renamed',digest:'new-session',canPlay:true,githubToken:'fixture'});
  const awake=await r.connect('new-session');assert.equal(awake.welcome.id,id);
  assert.deepEqual([own(awake).islandId,own(awake).x,own(awake).y,own(awake).outfit],[before.islandId,before.x,before.y,before.outfit]);
  assert.equal(own(awake).login,'renamed');
});
test('world: legacy resumes migrate once and hibernated sockets never duplicate a sleeper', async () => {
  const room=await makeRoom(), p=addPlayer(room,77,{islandId:'home',...mapOf('home').spawn});
  room.sql.exec('INSERT INTO resumes VALUES(?,?,?)',p.account,JSON.stringify(p.actor),Date.now()+15000);
  const {IslandRoom}=await import('../worker/index.js');
  const restored=new IslandRoom(room.ctx);
  assert.equal(restored.sleepers.get(p.account).x,p.actor.x);
  assert.equal(restored.sql.exec('SELECT count(*) AS n FROM player_states').one().n,1);
  p.socket.deserializeAttachment=()=>({...room.connections.get(p.socket),actor:p.actor});
  const hibernated=new IslandRoom({...room.ctx,getWebSockets:()=>[p.socket]});
  assert.equal(hibernated.sleepers.size,0);assert.equal(hibernated.connections.size,1);
  const info=hibernated.connections.get(p.socket);info.expires=Date.now()-1;
  hibernated.expire(Date.now());
  assert.equal(hibernated.sleepers.size,1);assert.equal(info.actor,null);
});
