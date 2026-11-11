import {nonNeighbourLanding} from './non-neighbour-fixture.mjs';
import {mapOf} from '../src/pixi/island-maps.js';
import {originOffset} from '../src/pixi/islands.js';
import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {createNavigation} from '../src/pixi/navigation.js';
import {world} from '../server-world.mjs';
import {HARBOR,harborOf,destinationsFor,canSail,boatSpots,landingSpot,landingApproach} from '../src/pixi/islands.js';
import {DUCK_RADIUS, RUN_SPEED, WALK_SPEED, MUSEUM_DOOR, atMuseumDoor} from '../src/pixi/player-motion.js';
import {randomOutfit, validOutfit} from '../src/pixi/outfits.js';

const origin = 'https://island.example';
const nav = mapOf('home').nav();
let mf;

before(async () => {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const {outputFiles:[bundle]} = await build({stdin:{resolveDir:root, contents:`
    import {IslandRoom} from './worker/index.js';
    import {createBoats} from './src/pixi/islands.js';
    import {start, callback, session, logout, connect, playAccess, friends, outfit} from './server/pages-auth.js';
    export class TestIsland extends IslandRoom {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/test/reset-boats') {this.boats=createBoats();this.saveBoats();return new Response(null,{status:204});}
        if (path === '/test/travel') {
          const {id,pose,steps=0}=await request.json();
          const entry=[...this.connections].find(([,info]) => info.actor?.id === id);
          if (entry && pose) {Object.assign(entry[1].actor,pose); this.attach(...entry);}
          for (let i=0;i<steps;i++) this.step();
          this.broadcast();
          return Response.json(this.boats);
        }
        if (path === '/test/restore') {
          for (const [socket,info] of this.connections) {
            this.attach(socket,info);
            info.actor=null;
          }
          if (this.timer) {clearInterval(this.timer); this.timer=null;}
          const restored=new IslandRoom(this.ctx);
          this.connections=restored.connections;
          this.boats=restored.boats;
          this.epoch=restored.epoch;
          this.savedBoats=restored.savedBoats;
          this.broadcast();
        }
        if (path === '/test/expire-flow') this.sql.exec('UPDATE flows SET expires=0');
        if (path === '/test/expire-resume') {this.sql.exec('UPDATE resumes SET expires=0'); await this.alarm();}
        if (path === '/test/expire-session') this.sql.exec('UPDATE sessions SET expires=0');
        if (path === '/test/legacy-session') this.sql.exec('UPDATE sessions SET can_play=0,github_token=NULL');
        if (path === '/test/backfill-accounts') {
          this.sql.exec('DELETE FROM accounts');
          new IslandRoom(this.ctx);
        }
        if (path.startsWith('/test/')) return new Response(null, {status:204});
        return super.fetch(request);
      }
    }
    const starredAccounts = new Set();
    const renamedAccounts = new Map();
    const fakeGitHub = async (url, options) => {
      if (url.endsWith('/access_token')) {
        const {code,code_verifier} = Object.fromEntries(options.body);
        if (code_verifier.length !== 43 || !/^account-[0-9]+$/.test(code)) return new Response(null,{status:400});
        return Response.json({access_token:code});
      }
      const login = options.headers.Authorization.split(' ')[1];
      if (url.endsWith('/user/starred/ente/ente')) {
        const status = login === 'account-9000' && !starredAccounts.has(login) ? 404 : login === 'account-9001' ? 503 : 204;
        return new Response(null,{status});
      }
      return Response.json({id:Number(login.slice(8)),login:renamedAccounts.get(login) ?? login});
    };
    export default {fetch(request,env) {
      const path = new URL(request.url).pathname;
      if (path === '/test/star') { starredAccounts.add('account-9000'); return new Response(null,{status:204}); }
      if (path === '/test/unstar') { starredAccounts.delete('account-9000'); return new Response(null,{status:204}); }
      if (path === '/test/rename') {
        renamedAccounts.set('account-9301','renamed-ducky');
        return new Response(null,{status:204});
      }
      if (path === '/test/rename-outfit') {
        renamedAccounts.set('account-9400','renamed-outfit-ducky');
        return new Response(null,{status:204});
      }
      if (path.startsWith('/test/')) return env.ISLAND.get(env.ISLAND.idFromName('main-island')).fetch(request);
      const handler = {'/auth/github/start':start,'/auth/github/callback':callback,'/api/session':session,
        '/auth/logout':logout,'/api/room':connect,'/api/play-access':playAccess,'/api/friends':friends,'/api/outfit':outfit}[path];
      return handler?.({request,env},fakeGitHub) ?? new Response(null,{status:404});
    }};
  `}, bundle:true, format:'esm', write:false});
  mf = new Miniflare(convertV4MiniflareOptions({
    modules:[{type:'ESModule',path:'index.js',contents:bundle.text}],
    compatibilityDate:'2026-11-02',
    bindings:{GITHUB_CLIENT_ID:'test-id',GITHUB_CLIENT_SECRET:'test-secret',SITE_ORIGIN:origin},
    durableObjects:{ISLAND:{className:'TestIsland',useSQLite:true}},
  }));
  await mf.ready;
});

after(async () => { await mf?.dispose(); });

const request = (path, options) => mf.dispatchFetch(origin+path,{redirect:'manual',...options});
const cookiePart = value => value.split(';',1)[0];

async function startFlow() {
  const res = await request('/auth/github/start');
  assert.equal(res.status,303);
  const target = new URL(res.headers.get('Location'));
  assert.equal(target.origin,'https://github.com');
  assert.equal(target.searchParams.has('scope'),false);
  assert.equal(target.searchParams.get('code_challenge_method'),'S256');
  assert.match(target.searchParams.get('code_challenge'),/^[A-Za-z0-9_-]{43}$/);
  const state = target.searchParams.get('state');
  const cookie = cookiePart(res.headers.get('Set-Cookie'));
  assert.equal(cookie,'__Host-ducky_oauth='+state);
  return {state,cookie};
}

async function signIn(account) {
  const {state,cookie} = await startFlow();
  const path = '/auth/github/callback?state='+state+'&code=account-'+account;
  const response = await request(path,{headers:{Cookie:cookie}});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('Location'),'/');
  const session = response.headers.getSetCookie().find(value => value.startsWith('__Host-ducky_session='));
  assert.match(session, /Max-Age=604800; Secure; HttpOnly; SameSite=Lax/);
  return {path, flowCookie:cookie, session:cookiePart(session)};
}

test('OAuth state is bound to its cookie and consumed on success, cancellation and expiry', async () => {
  const flow = await startFlow();
  const callback = '/auth/github/callback?state='+flow.state;
  assert.equal((await request(callback+'&code=account-1')).headers.get('Location'),'/?auth=failed');
  assert.equal((await request(callback+'&error=access_denied',{headers:{Cookie:flow.cookie}})).headers.get('Location'),'/?auth=cancelled');
  assert.equal((await request(callback+'&code=account-1',{headers:{Cookie:flow.cookie}})).headers.get('Location'),'/?auth=failed');

  const expired = await startFlow();
  await request('/test/expire-flow');
  assert.equal((await request('/auth/github/callback?state='+expired.state+'&code=account-1',
    {headers:{Cookie:expired.cookie}})).headers.get('Location'),'/?auth=failed');

  const good = await signIn(1);
  assert.deepEqual((await request('/api/session',{headers:{Cookie:good.session}}).then(r=>r.json())).user,{accountId:'1',login:'account-1',canPlay:true});
  assert.equal((await request(good.path,{headers:{Cookie:good.flowCookie}})).headers.get('Location'),'/?auth=failed');
  const response = await request('/auth/logout',{method:'POST',headers:{Origin:'https://elsewhere.example',Cookie:good.session}});
  assert.equal(response.status,403);
  await request('/test/expire-session');
  assert.equal((await request('/api/session',{headers:{Cookie:good.session}}).then(r=>r.json())).user,null);
});

async function socket(cookie, play = true) {
  const headers = {Upgrade:'websocket', Origin:origin};
  if (cookie) headers.Cookie = cookie;
  const response = await request('/api/room?play='+(play ? '1' : '0'),{headers});
  assert.equal(response.status,101);
  const ws = response.webSocket;
  const messages = [];
  ws.addEventListener('message',event => messages.push(JSON.parse(event.data)));
  ws.accept();
  let seq = 0, closed = false;
  ws.addEventListener('close', () => { closed = true; });
  const client = {ws, messages,
    close() { if (!closed) { closed = true; ws.close(); } },
    send(data) { ws.send(JSON.stringify({...data,seq:++seq})); },
    get welcome() { return messages.find(message => message.type === 'welcome'); },
    get snapshot() { return messages.findLast(message => message.type === 'snapshot'); },
    duck(id = this.welcome.id) { return this.snapshot?.players.find(duck => duck.id === id); },
  };
  await eventually(() => client.welcome);
  return client;
}

async function eventually(predicate) {
  for (let i=0;i<400;i++) {
    const value = predicate();
    if (value) return value;
    await delay(20);
  }
  assert.fail('Expected WebSocket message did not arrive');
}

const friendRequest = (session,method='GET',data,headers={}) => request('/api/friends',{
  method,headers:{Cookie:session,Origin:origin,'Content-Type':'application/json',...headers},
  ...(data === undefined ? {} : {body:JSON.stringify(data)}),
});
const position = (client,pose) => request('/test/travel',{
  method:'POST',body:JSON.stringify({id:client.welcome.id,pose}),
});

test('first-join random outfits persist by GitHub ID before any customization', async () => {
  const clients = [];
  try {
    for (const account of [9410,9411]) {
      const original = await signIn(account);
      const player = await socket(original.session);
      clients.push(player);
      await eventually(() => player.duck());
      const initial = player.duck().outfit;
      assert.ok(validOutfit(initial));
      await request('/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:original.session}});
      const returning = await socket((await signIn(account)).session);
      clients.push(returning);
      await eventually(() => returning.duck());
      assert.deepEqual(returning.duck().outfit,initial);
    }
  } finally {
    clients.forEach(client => client.close());
    await request('/test/expire-session');
    await request('/test/expire-resume');
  }
});

test('randomized outfits isolate GitHub IDs and persist across reconnects, logout, username changes and room restore', async () => {
  const owner = await signIn(9400), other = await signIn(9401), locked = await signIn(9000);
  const player = await socket(owner.session), viewer = await socket(other.session);
  const saved = randomOutfit(), otherSaved = randomOutfit(saved);
  const save = (session,outfit,headers={}) => request('/api/outfit',{
    method:'POST',headers:{Cookie:session,Origin:origin,...headers},body:JSON.stringify({outfit,account:'9401'}),
  });
  const clients = [player,viewer];
  try {
    await eventually(() => viewer.duck() && viewer.duck(player.welcome.id));
    const othersOutfit = viewer.duck().outfit;
    assert.equal((await request('/api/outfit',{method:'GET'})).status,405);
    assert.equal((await save('',saved)).status,401);
    assert.equal((await save(owner.session,saved,{Origin:'https://elsewhere.example'})).status,403);
    assert.equal((await save(locked.session,saved)).status,403);
    for (const invalid of [null,[],{}, {...saved,cap:2}, {...saved,shades:3}, {...saved,acc:2},
      {...saved,shoes:15}, {...saved,cap:'3'}, {...saved,extra:1}]) {
      assert.equal((await save(owner.session,invalid)).status,400);
    }
    assert.equal((await request('/api/outfit',{method:'POST',headers:{Origin:origin,Cookie:owner.session},body:'{'})).status,400);
    const response = await save(owner.session,saved);
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{outfit:saved});
    await eventually(() => JSON.stringify(viewer.duck(player.welcome.id)?.outfit) === JSON.stringify(saved));
    assert.deepEqual(viewer.duck().outfit,othersOutfit);
    assert.equal((await save(other.session,otherSaved)).status,200);
    await eventually(() => JSON.stringify(player.duck(viewer.welcome.id)?.outfit) === JSON.stringify(otherSaved));
    assert.deepEqual(player.duck().outfit,saved);
    await request('/test/restore');
    assert.deepEqual(player.duck().outfit,saved);
    player.close();
    await eventually(() => !viewer.duck(player.welcome.id));
    const resumed = await socket(owner.session);
    clients.push(resumed);
    await eventually(() => resumed.duck());
    assert.deepEqual(resumed.duck().outfit,saved);
    await request('/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:owner.session}});
    assert.equal((await save(owner.session,saved)).status,401);
    await request('/test/rename-outfit');
    const nextLogin = await signIn(9400);
    assert.equal((await request('/api/session',{headers:{Cookie:nextLogin.session}}).then(r => r.json())).user.login,'renamed-outfit-ducky');
    const fresh = await socket(nextLogin.session);
    clients.push(fresh);
    await eventually(() => fresh.duck());
    assert.deepEqual(fresh.duck().outfit,saved);
    await request('/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:other.session}});
    const otherReturning = await socket((await signIn(9401)).session);
    clients.push(otherReturning);
    await eventually(() => otherReturning.duck());
    assert.deepEqual(otherReturning.duck().outfit,otherSaved);
    assert.equal((await save(nextLogin.session,{cap:0,shades:0,acc:0,shoes:0})).status,200);
  } finally {
    clients.forEach(client => client.close());
    await request('/test/expire-session');
    await request('/test/expire-resume');
  }
});

test('friend requests require recipient approval and mutual friendships persist across restart, rename and expiry', async () => {
  let owner = await signIn(9300);
  const target = await signIn(9301), other = await signIn(9302);
  const player = await socket(owner.session), peer = await socket(target.session);
  const ownerTab = await socket(owner.session,false), viewer = await socket(other.session,false), guest = await socket();
  const clients = [player,peer,ownerTab,viewer,guest];
  const state = session => friendRequest(session).then(response => response.json());
  try {
    await position(player,{x:2000,y:2000}); await position(peer,{x:2180,y:2000});
    const sent = await friendRequest(owner.session,'POST',{playerId:peer.welcome.id,owner_account_id:'9302'}).then(r=>r.json());
    assert.deepEqual(sent.friends,[]);
    assert.equal(sent.outgoing[0].accountId,'9301');
    assert.equal((await state(target.session)).incoming[0].accountId,'9300');
    assert.deepEqual(await state(other.session),{friends:[],incoming:[],outgoing:[]});
    await eventually(() => ownerTab.messages.some(m => m.type === 'friends-changed'));
    await eventually(() => peer.messages.some(m => m.type === 'friends-changed'));
    assert.equal(viewer.messages.some(m => m.type === 'friends-changed'),false);
    assert.equal(guest.messages.some(m => m.type === 'friends-changed'),false);
    assert.deepEqual(await friendRequest(owner.session,'POST',{playerId:peer.welcome.id}).then(r=>r.json()),sent);
    assert.equal((await friendRequest(owner.session,'PATCH',{accountId:'9301',action:'accept'})).status,409);
    assert.equal((await friendRequest(other.session,'PATCH',{accountId:'9300',action:'accept'})).status,409);
    player.close();
    await eventually(() => !peer.duck(player.welcome.id));
    const accepted = await friendRequest(target.session,'PATCH',{accountId:'9300',action:'accept'}).then(r=>r.json());
    assert.equal(accepted.friends[0].accountId,'9300');
    const friend = (await state(owner.session)).friends[0];
    assert.equal(friend.accountId,'9301'); assert.equal(friend.login,'account-9301');
    assert.deepEqual((await state(owner.session)).outgoing,[]);
    await request('/test/restore');
    assert.deepEqual(await state(owner.session),{friends:[friend],incoming:[],outgoing:[]});
    await request('/test/rename'); await signIn(9301);
    const renamed = {...friend,login:'renamed-ducky'};
    assert.deepEqual((await state(owner.session)).friends,[renamed]);
    peer.close(); await request('/auth/logout',{method:'POST',headers:{Cookie:owner.session,Origin:origin}});
    assert.equal((await friendRequest(owner.session)).status,401);
    owner = await signIn(9300);
    assert.deepEqual((await state(owner.session)).friends,[renamed]);
    await request('/test/expire-session');
    assert.equal((await friendRequest(owner.session)).status,401);
    owner = await signIn(9300);
    assert.deepEqual((await state(owner.session)).friends,[renamed]);
    assert.equal((await friendRequest(owner.session,'DELETE',{accountId:'9301'})).status,200);
    assert.equal((await friendRequest(owner.session,'DELETE',{accountId:'9301'})).status,200);
    assert.deepEqual(await state(owner.session),{friends:[],incoming:[],outgoing:[]});
    const renewedTarget = await signIn(9301);
    assert.deepEqual((await state(renewedTarget.session)).friends,[]);
  } finally {clients.forEach(client=>client.close()); await request('/test/expire-resume');}
});

test('friend requests can be cancelled or declined, and reciprocal requests approve both directions', async () => {
  const a = await signIn(9330), b = await signIn(9331);
  const player = await socket(a.session), peer = await socket(b.session);
  const state = session => friendRequest(session).then(response => response.json());
  const send = () => friendRequest(a.session,'POST',{playerId:peer.welcome.id});
  try {
    await position(player,{x:2000,y:2000}); await position(peer,{x:2100,y:2000});
    await send();
    await friendRequest(b.session,'PATCH',{accountId:'9330',action:'cancel'});
    assert.equal((await state(b.session)).incoming.length,1,'the recipient cannot cancel the sender’s outgoing request');
    await friendRequest(a.session,'PATCH',{accountId:'9331',action:'cancel'});
    assert.deepEqual((await state(b.session)).incoming,[]);
    assert.equal((await friendRequest(b.session,'PATCH',{accountId:'9330',action:'accept'})).status,409);
    await send();
    await friendRequest(b.session,'PATCH',{accountId:'9330',action:'decline'});
    assert.deepEqual((await state(a.session)).outgoing,[]);
    await send();
    await friendRequest(b.session,'POST',{playerId:player.welcome.id});
    assert.equal((await state(a.session)).friends[0].accountId,'9331');
    assert.equal((await state(b.session)).friends[0].accountId,'9330');
    assert.deepEqual((await state(b.session)).incoming,[]);
  } finally {player.close(); peer.close(); await request('/test/expire-resume');}
});

test('live jumps are shared, preserve movement, land without more input, and reject spectator and sailing jumps', async () => {
  const account=await signIn(9400);
  const player=await socket(account.session), guest=await socket();
  try {
    const initial=await eventually(()=>guest.duck(player.welcome.id));
    player.send({type:'jump',jumpLeft:999,x:-500,y:-500});
    const airborne=await eventually(()=>guest.duck(player.welcome.id)?.jumpLeft>0 && guest.duck(player.welcome.id));
    assert.ok(airborne.jumpLeft<=.6);
    assert.deepEqual([airborne.x,airborne.y],[initial.x,initial.y]);
    player.send({type:'jump'});
    player.send({type:'input',x:1,y:0});
    await eventually(()=>{
      const pose=guest.duck(player.welcome.id);
      return pose.x>initial.x+5 && pose.jumpLeft>0 && pose.jumpLeft<airborne.jumpLeft;
    });
    player.send({type:'input',x:0,y:0,stop:true});
    await eventually(()=>guest.duck(player.welcome.id)?.jumpLeft===0);
    guest.send({type:'jump',id:player.welcome.id});
    await delay(100);
    assert.equal(guest.duck(player.welcome.id).jumpLeft,0);
    await position(player,{mode:'sailing',jumpLeft:0});
    player.send({type:'jump'});
    await delay(150);
    assert.equal(guest.duck(player.welcome.id).jumpLeft,0);
    await position(player,{mode:'walking'});
    player.send({type:'jump'});
    await eventually(()=>guest.duck(player.welcome.id)?.jumpLeft>0);
    await request('/test/restore');
    await eventually(()=>guest.duck(player.welcome.id)?.jumpLeft===0);
  } finally {
    player.close(); guest.close();
    await request('/test/expire-resume');
  }
});

test('running is a server-capped flag: Shift runs at most 1.7x walk, others see it, junk flags walk and boats ignore it (boss 6 Nov)', async () => {
  const account=await signIn(9410);
  const player=await socket(account.session), guest=await socket();
  const timed=async input => {   // holds a direction for ~0.6 s and returns the speed the guest saw in the steady middle
    const start=await eventually(()=>guest.duck(player.welcome.id));
    const samples=[];
    const t0=Date.now();
    while (Date.now()-t0 < 650) {player.send({type:'input',...input}); await delay(90); const d=guest.duck(player.welcome.id); samples.push([Date.now(),d.x,d.y,d.travel]);}
    player.send({type:'input',x:0,y:0,stop:true});
    await eventually(()=>guest.duck(player.welcome.id)?.travel===0);
    return {start, samples, top:Math.max(...samples.map(s=>s[3]))};
  };
  try {
    const lane=(()=>{for (let y=600;y<world.height;y+=40) for (let x=400;x<world.width-700;x+=40) {   // a straight 520 px run with room either side
      let ok=true; for (let d=0;d<=520 && ok;d+=10) ok=nav.walkable(x+d,y) && nav.walkable(x+d,y-40) && nav.walkable(x+d,y+40);
      if (ok) return [x+260,y];}})();
    const [ox,oy]=lane;
    await position(player,{x:ox-260,y:oy,mode:'walking',path:[]});
    const walk=await timed({x:1,y:0});
    assert.ok(walk.top<=WALK_SPEED+1, `walk ${walk.top}`);
    await position(player,{x:ox-260,y:oy,mode:'walking',path:[]});
    const run=await timed({x:1,y:0,run:true,speed:99999,travel:99999});
    assert.ok(run.top>WALK_SPEED*1.4, `run seen by others ${run.top}`);
    assert.ok(run.top<=RUN_SPEED+1, `run capped ${run.top}`);
    const span=run.samples.at(-1)[0]-run.samples[0][0], moved=run.samples.at(-1)[1]-run.samples[0][1];
    assert.ok(moved<=RUN_SPEED*(span/1000+.15), `moved ${moved} in ${span} ms`);
    await position(player,{x:ox-260,y:oy,mode:'walking',path:[]});
    const junk=await timed({x:1,y:0,run:'yes'});
    assert.ok(junk.top<=WALK_SPEED+1, `junk flag ${junk.top}`);
  } finally {
    player.close(); guest.close();
    await request('/test/expire-resume');
  }
});

test('a game never opens inside the museum: a Ducky held at its door comes back on the plaza (boss 6 Nov)', async () => {
  const account=await signIn(9420);
  const guest=await socket();
  let player=await socket(account.session);
  try {
    const door={x:(MUSEUM_DOOR.x0+MUSEUM_DOOR.x1)/2,y:MUSEUM_DOOR.y-20};
    assert.ok(atMuseumDoor(door.x,door.y));
    await position(player,{...door,mode:'walking',path:[]});
    await eventually(()=>guest.duck(player.welcome.id)?.y===door.y);
    player.close();
    await eventually(()=>!guest.duck(player.welcome.id));
    player=await socket(account.session);   // reload: the resume would have put it straight back at the door
    const back=await eventually(()=>guest.duck(player.welcome.id));
    assert.ok(!atMuseumDoor(back.x,back.y));
    assert.ok(Math.hypot(back.x-world.zones.plaza.spawn[0],back.y-world.zones.plaza.spawn[1])<=DUCK_RADIUS*2,`spawned at ${back.x},${back.y}`);
    const away={x:MUSEUM_DOOR.out.x,y:MUSEUM_DOOR.out.y};   // anywhere else outside is still resumed as it was
    await position(player,{...away,mode:'walking',path:[]});
    await eventually(()=>guest.duck(player.welcome.id)?.y===away.y);
    player.close();
    await eventually(()=>!guest.duck(player.welcome.id));
    player=await socket(account.session);
    const kept=await eventually(()=>guest.duck(player.welcome.id));
    assert.deepEqual([kept.x,kept.y],[away.x,away.y]);
  } finally {
    player.close(); guest.close();
    await request('/test/expire-resume');
  }
});

test('friend writes require authentication, same origin, live players and authoritative proximity', async () => {
  const owner = await signIn(9310), target = await signIn(9311), outsider = await signIn(9312);
  const player = await socket(owner.session), peer = await socket(target.session);
  const spectator = await socket(outsider.session,false);
  try {
    assert.equal((await request('/api/friends')).status,401);
    assert.equal((await request('/api/friends',{method:'POST',headers:{Origin:origin},body:'{}'})).status,401);
    assert.equal((await friendRequest(owner.session,'POST',{playerId:peer.welcome.id},{Origin:'https://elsewhere.example'})).status,403);
    assert.equal((await friendRequest(owner.session,'DELETE',{accountId:'9311'},{Origin:'https://elsewhere.example'})).status,403);
    assert.equal((await friendRequest(owner.session,'PATCH',{accountId:'9311',action:'accept'},{Origin:'https://elsewhere.example'})).status,403);
    assert.equal((await friendRequest(owner.session,'POST',null)).status,400);
    assert.equal((await friendRequest(owner.session,'POST',{playerId:3})).status,400);
    assert.equal((await friendRequest(owner.session,'DELETE',{accountId:{}})).status,400);
    assert.equal((await friendRequest(owner.session,'POST',{playerId:player.welcome.id})).status,400);
    assert.equal((await friendRequest(outsider.session,'POST',{playerId:peer.welcome.id})).status,403);
    await position(player,{x:2000,y:2000});
    await position(peer,{x:2181,y:2000});
    assert.equal((await friendRequest(owner.session,'POST',{playerId:peer.welcome.id,x:2000,y:2000})).status,409);
    await position(peer,{x:2000,y:2000,islandId:'blossom'});
    assert.equal((await friendRequest(owner.session,'POST',{playerId:peer.welcome.id})).status,409);
    await position(peer,{x:2000,y:2000,islandId:'home',mode:'sailing'});
    assert.equal((await friendRequest(owner.session,'POST',{playerId:peer.welcome.id})).status,200);
    assert.equal((await friendRequest(outsider.session,'DELETE',{accountId:'9311',owner_account_id:'9310'})).status,200);
    assert.equal((await friendRequest(owner.session).then(r=>r.json())).outgoing.length,1);
    peer.close();
    await eventually(() => !player.duck(peer.welcome.id));
    assert.equal((await friendRequest(owner.session,'POST',{playerId:peer.welcome.id})).status,409);
    await request('/test/backfill-accounts');
    assert.equal((await friendRequest(owner.session).then(r=>r.json())).outgoing[0].accountId,'9311');
  } finally {
    player.close(); peer.close(); spectator.close();
    await request('/test/expire-resume');
  }
});

test('join notifications respect name privacy and live counts include viewers without double-counting tabs', async () => {
  const observerAccount = await signIn(9200);
  const playerAccount = await signIn(9201);
  const observer = await socket(observerAccount.session,false);
  const guest = await socket();
  const clients = [observer,guest];
  try {
    await eventually(() => observer.snapshot?.online === 2);
    assert.equal(observer.messages.some(message => message.type === 'joined'),false);
    const player = await socket(playerAccount.session);
    clients.push(player);
    const event = await eventually(() => observer.messages.find(message => message.type === 'joined'));
    assert.equal(event.login,'account-9201');
    assert.equal(event.id,player.welcome.id);
    const anonymous = await eventually(() => guest.messages.find(message => message.type === 'joined'));
    assert.equal(anonymous.login,undefined);
    assert.equal(player.messages.some(message => message.type === 'joined'),false);
    await eventually(() => observer.snapshot.online === 3);
    const tab = await socket(playerAccount.session);
    clients.push(tab);
    await eventually(() => player.messages.some(message => message.type === 'role'));
    await delay(50);
    assert.equal(observer.snapshot.online,3);
    assert.equal(observer.messages.filter(message => message.type === 'joined').length,1);
    tab.close();
    await eventually(() => observer.snapshot.players.length === 0);
    const resumed = await socket(playerAccount.session);
    clients.push(resumed);
    await eventually(() => observer.snapshot.players.length === 1);
    assert.equal(observer.messages.filter(message => message.type === 'joined').length,1);
    guest.close();
    await eventually(() => observer.snapshot.online === 2);
    resumed.close();
    player.close();
    await eventually(() => observer.snapshot.online === 1);
  } finally {
    clients.forEach(client => client.close());
    await request('/test/expire-resume');
  }
});

test('non-stargazers and unverified legacy sessions cannot play through the room endpoint', async () => {
  const nonStar = await signIn(9000);
  const result = await request('/api/session',{headers:{Cookie:nonStar.session}}).then(r=>r.json());
  assert.deepEqual(result.user,{accountId:'9000',login:'account-9000',canPlay:false});
  const viewer = await socket(nonStar.session);
  try {
    assert.equal(viewer.welcome.id,null);
    assert.equal(viewer.welcome.reason,'star-required');
    viewer.send({type:'input',x:1,y:0});
    viewer.send({type:'emote',action:2});
    await delay(100);
    assert.equal(viewer.snapshot.players.length,0);
  } finally { viewer.close(); }

  const verified = await signIn(9002);
  await request('/test/legacy-session');
  const legacy = await socket(verified.session);
  try {
    assert.equal(legacy.welcome.id,null);
    assert.equal(legacy.welcome.reason,'star-required');
  } finally { legacy.close(); }
  const rechecked = await signIn(9002);
  const player = await socket(rechecked.session);
  try { assert.ok(player.welcome.id); } finally { player.close(); }
  await request('/test/expire-resume');
});

test('retry checks the star again, unlocks play, and rejects an unstarred reconnect', async () => {
  const signedIn = await signIn(9000);
  const retry = () => request('/api/play-access',{method:'POST',headers:{Origin:origin,Cookie:signedIn.session}});
  assert.equal((await retry().then(r=>r.json())).canPlay,false);
  assert.equal((await request('/api/play-access',{method:'POST',headers:{Origin:'https://elsewhere.example',Cookie:signedIn.session}})).status,403);
  await request('/test/star');
  assert.deepEqual(await retry().then(r=>r.json()),{canPlay:true});
  const player = await socket(signedIn.session);
  try { assert.ok(player.welcome.id); } finally { player.close(); }
  await request('/test/unstar');
  const viewer = await socket(signedIn.session);
  try {
    assert.equal(viewer.welcome.id,null);
    assert.equal(viewer.welcome.reason,'star-required');
  } finally { viewer.close(); }
  await request('/test/expire-resume');
});

test('a GitHub star-check outage never grants play access or creates a session', async () => {
  const {state,cookie} = await startFlow();
  const result = await request('/auth/github/callback?state='+state+'&code=account-9001',
    {headers:{Cookie:cookie}});
  assert.equal(result.headers.get('Location'),'/?auth=star-check');
  assert.equal(result.headers.getSetCookie().some(value=>value.startsWith('__Host-ducky_session=')),false);
});

test('two GitHub sessions and a guest share server-owned movement, emotes and presence', async () => {
  const [one,two] = await Promise.all([signIn(101),signIn(102)]);
  const [a,b,guest] = await Promise.all([socket(one.session),socket(two.session),socket()]);
  const clients = [a,b,guest];
  try {
    const id = a.welcome.id;
    assert.ok(id && b.welcome.id && id !== b.welcome.id);
    assert.equal(guest.welcome.id,null);
    await eventually(() => guest.snapshot?.players.length === 2);
    const spawn = guest.duck(id);
    assert.deepEqual([spawn.x,spawn.y],world.zones.plaza.spawn);
    assert.deepEqual(Object.keys(spawn).sort(),['action','boatId','emoteVersion','exitLocked','ice','id','islandId','jumpLeft','karma','mode','outfit','reducedMotion','travel','turn','x','y']);
    assert.equal(spawn.karma,0,'new accounts start with zero Karma');
    assert.equal((await eventually(() => b.duck(id)))?.login,'account-101');
    assert.equal(b.duck()?.login,'account-102');
    assert.equal(guest.snapshot.self,null);
    assert.equal((await request('/api/room?play=1',{headers:{Upgrade:'websocket',Origin:'https://elsewhere.example',Cookie:one.session}})).status,403);

    guest.send({type:'input',x:1,y:0,id});
    guest.send({type:'emote',action:3,id});
    a.send({type:'state',x:100,y:100});
    a.send({type:'input',x:7,y:0});
    a.send({type:'destination',x:world.origin.x-10000,y:world.origin.y-10000});
    await delay(150);
    assert.deepEqual(guest.duck(id),spawn);
    a.send({type:'input',x:1,y:0});
    await eventually(() => guest.duck(id)?.x > spawn.x+25);
    await eventually(() => a.duck()?.action === 0);
    const stopped = guest.duck(id);
    assert.ok(stopped.x-spawn.x <= 100,'stale input must stop at the allowed speed');
    assert.ok(nav.walkable(stopped.x,stopped.y));

    const [tx,ty] = nav.nearest(spawn.x,spawn.y+150);
    a.send({type:'destination',x:tx,y:ty});
    await eventually(() => {
      const duck = guest.duck(id);
      return duck.action === 0 && Math.hypot(duck.x-tx,duck.y-ty) < 1;
    });
    for (const message of guest.messages.filter(m=>m.type==='snapshot')) {
      assert.ok(message.players.every(p => nav.walkable(p.x,p.y)));
    }
    a.send({type:'emote',action:2});
    b.send({type:'emote',action:4});
    await eventually(() => guest.duck(id)?.action === 2 && guest.duck(b.welcome.id)?.action === 4);
    a.send({type:'emote',action:3});
    await eventually(() => guest.duck(id)?.action === 3);

    const tab = await socket(one.session);
    clients.push(tab);
    assert.equal(tab.welcome.id,id);
    await eventually(() => a.messages.some(m => m.type==='role' && m.reason==='taken-over'));
    const before = await eventually(() => tab.duck());
    a.send({type:'input',x:1,y:0});
    await delay(180);
    assert.deepEqual(tab.duck(),before);
    tab.close();
    await eventually(() => !guest.duck(id));
    const resumed = await socket(one.session);
    clients.push(resumed);
    assert.equal(resumed.welcome.id,id);
    const pose = await eventually(() => resumed.duck());
    assert.deepEqual([pose.x,pose.y,pose.outfit],[before.x,before.y,before.outfit]);
    resumed.close();
    await eventually(() => !guest.duck(id));
    await request('/test/expire-resume');
    const returned = await socket(one.session);
    clients.push(returned);
    const fresh = await eventually(() => returned.duck());
    assert.notEqual(fresh.id,id);
    assert.ok(Math.hypot(fresh.x-world.zones.plaza.spawn[0],fresh.y-world.zones.plaza.spawn[1])<=DUCK_RADIUS*2);
    assert.deepEqual(fresh.outfit,before.outfit);
    assert.ok(nav.walkable(fresh.x,fresh.y));

    const logout = await request('/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:one.session}});
    assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
    await eventually(() => returned.messages.some(m => m.type==='role' && m.reason==='signed-out'));
    assert.equal((await request('/api/session',{headers:{Cookie:one.session}}).then(r=>r.json())).user,null);
    await eventually(() => guest.snapshot.players.length === 1);
  } finally {
    clients.forEach(client => client.close());
  }
});

test('player chat reaches signed-in users only and is never replayed', async () => {
  const [first,second,third] = await Promise.all([signIn(103),signIn(104),signIn(105)]);
  const player = await socket(first.session);
  const viewer = await socket(second.session);
  const guest = await socket();
  let latePlayer;
  try {
    const chatEvents = client => client.messages.filter(message => message.type === 'chat');
    guest.send({type:'chat',text:'Guest message'});
    player.send({type:'chat',text:'x'.repeat(121)});
    player.send({type:'chat',id:'spoofed',text:'  Hello\n island!  '});
    player.send({type:'chat',text:'Too soon'});
    await eventually(() => chatEvents(viewer).length > 0);
    latePlayer = await socket(third.session);
    await eventually(() => latePlayer.snapshot);
    const event = {type:'chat',id:player.welcome.id,text:'Hello island!'};
    assert.deepEqual(chatEvents(player),[event]);
    assert.deepEqual(chatEvents(viewer),[event]);
    assert.equal(viewer.duck(player.welcome.id)?.login,'account-103');
    assert.equal(guest.duck(player.welcome.id)?.login,undefined);
    assert.deepEqual(chatEvents(guest),[]);
    assert.deepEqual(chatEvents(latePlayer),[]);
    assert.ok(!JSON.stringify(latePlayer.snapshot).includes(event.text));
    await delay(120);
    player.send({type:'chat',text:'Hello island! 🦆'});
    await eventually(() => chatEvents(viewer).at(-1)?.text === 'Hello island! 🦆');
    await delay(120);
    player.send({type:'chat',text:''});
    await eventually(() => chatEvents(viewer).at(-1)?.text === '');
    assert.deepEqual(chatEvents(guest),[]);
  } finally {
    player.close();
    viewer.close();
    guest.close();
    latePlayer?.close();
  }
});

test('boats board once, cross authoritatively, isolate islands and survive reconnect and restoration', async () => {
  await request('/test/expire-session');
  await request('/test/expire-resume');
  await request('/test/reset-boats');
  const [first,second,watcher]=await Promise.all([signIn(9301),signIn(9302),signIn(9303)]);
  const [a,b,watch]=await Promise.all([socket(first.session),socket(second.session),socket(watcher.session,false)]);
  const clients=[a,b,watch];
  const setup=(client,pose,steps=0) => request('/test/travel',{method:'POST',body:JSON.stringify({id:client.welcome.id,pose,steps})});
  try {
    await eventually(() => a.snapshot?.boats?.length === boatSpots().length);   // boss 5 Nov: harbor, islet and beach boats
    const boatId=a.snapshot.boats[0].id;
    a.send({type:'board',boatId});
    await setup(a,null,8);
    assert.equal(a.duck().mode,'walking');
    a.send({type:'input',x:1,y:0});
    await delay(50);
    await setup(a,{...HARBOR.land,path:[]},2);
    assert.equal(a.duck().mode,'walking','manual input cancels boarding');
    a.send({type:'input',x:0,y:0});
    await setup(b,{...HARBOR.land,path:[]});
    a.send({type:'board',boatId});
    b.send({type:'board',boatId});
    await eventually(() => a.duck()?.mode==='sailing' || b.duck()?.mode==='sailing');
    const captain=a.duck().mode==='sailing'?a:b, other=captain===a?b:a;
    const captainCookie=captain===a?first.session:second.session;
    await eventually(() => other.messages.some(message => message.type==='travel-notice' && message.text==='Boat taken.'));
    assert.equal(captain.snapshot.boats.filter(boat => boat.occupant).length,1);
    const before=captain.duck();
    captain.send({type:'state',islandId:'sunset',x:1,y:1});
    captain.send({type:'emote',action:3});
    await delay(100);
    assert.equal(captain.duck().mode,'sailing');
    assert.equal(captain.duck().x,before.x);
    captain.send({type:'destination',...mapOf('home').spawn});
    await delay(100);
    assert.equal(captain.duck().mode,'sailing');
    assert.ok(canSail(captain.duck().x,captain.duck().y));
    captain.send({type:'input',x:0,y:-1});
    await eventually(() => captain.duck().y<before.y-20);
    captain.send({type:'input',x:0,y:0});
    const exit=destinationsFor('home')[0];
    await setup(captain,{...exit.dock,exitLocked:false},1);
    await eventually(() => captain.snapshot.islandId===exit.destination);
    await eventually(() => !other.duck(captain.welcome.id));
    assert.equal(captain.snapshot.players.length,1);
    captain.send({type:'watch',islandId:'sunset'});
    await delay(100);
    assert.equal(captain.snapshot.islandId,exit.destination,'players cannot teleport with spectator commands');
    watch.send({type:'watch',islandId:exit.destination});
    await eventually(() => watch.snapshot.islandId===exit.destination);
    assert.equal(watch.duck(captain.welcome.id)?.mode,'walking');
    captain.send({type:'chat',text:'Across the sea'});
    await eventually(() => watch.messages.some(message => message.type==='chat' && message.text==='Across the sea'));
    assert.equal(other.messages.some(message => message.type==='chat' && message.text==='Across the sea'),false);
    const id=captain.welcome.id;
    const parked=await eventually(()=>captain.snapshot.boats.find(boat=>boat.id===boatId && !boat.occupant));
    assert.equal(parked.islandId,exit.destination);
    assert.deepEqual([parked.x,parked.y],[harborOf(exit.destination).water.x,harborOf(exit.destination).water.y]);
    await eventually(()=>watch.snapshot.boats.some(boat=>boat.id===boatId && !boat.occupant));
    await request('/test/restore');
    await eventually(()=>captain.snapshot.boats.some(boat=>boat.id===boatId && boat.parked));
    assert.deepEqual(captain.snapshot.boats.find(boat=>boat.id===boatId),parked,'arrival survives worker restoration');
    const localBoat=boatId;   // Reboard the same boat that brought you here.
    await setup(captain,{...harborOf(exit.destination).land,path:[]},2);   // that island's own jetty (it may be themed)
    captain.send({type:'board',boatId:localBoat});
    await eventually(() => captain.duck()?.mode==='sailing');
    captain.close();
    await eventually(() => !watch.duck(id));
    const held=watch.snapshot.boats.find(boat => boat.id===localBoat);
    assert.equal(held.occupant,id);
    const resumed=await socket(captainCookie);
    clients.push(resumed);
    await eventually(() => resumed.duck()?.mode==='sailing');
    assert.equal(resumed.welcome.id,id);
    assert.equal(resumed.snapshot.islandId,exit.destination);
    assert.equal(resumed.duck().boatId,localBoat);
    await request('/test/restore');
    await eventually(() => resumed.duck()?.mode==='sailing');
    assert.equal(resumed.snapshot.boats.find(boat => boat.id===localBoat).occupant,id);
    const there=harborOf(exit.destination);
    await setup(resumed,{x:there.water.x,y:there.water.y,exitLocked:false});
    resumed.send({type:'disembark'});
    await eventually(() => resumed.duck()?.mode==='walking');
    assert.deepEqual([resumed.duck().x,resumed.duck().y],[there.land.x,there.land.y]);
    assert.equal(resumed.snapshot.boats.find(boat => boat.id===localBoat).occupant,null);
    resumed.send({type:'board',boatId:localBoat});
    await eventually(() => resumed.duck()?.mode==='sailing');
    resumed.close();
    await eventually(() => !watch.duck(id));
    await request('/test/expire-resume');
    watch.send({type:'watch',islandId:exit.destination});
    await eventually(() => watch.snapshot.boats.find(boat => boat.id===localBoat)?.occupant===null);
    const fresh=await socket(captainCookie);
    clients.push(fresh);
    await eventually(() => fresh.duck());
    assert.equal(fresh.snapshot.islandId,'home');
    assert.equal(fresh.duck().mode,'walking');
  } finally {
    clients.forEach(client => client.close());
    await request('/test/expire-session');
    await request('/test/expire-resume');
  }
});

test('docking off a beach sails the boat in beside the sand before the Ducky hops out, and steering away cancels it', async () => {
  // boss 5 Nov ("dock fix"): no hop from where the boat was; the boat sails up to the shore first
  await request('/test/expire-session');
  await request('/test/expire-resume');
  await request('/test/reset-boats');
  const login=await signIn(9310), a=await socket(login.session);
  const setup=(pose,steps=0) => request('/test/travel',{method:'POST',body:JSON.stringify({id:a.welcome.id,pose,steps})});
  const far={x:boatSpots()[5].x-170,y:boatSpots()[5].y}, spot=landingSpot({islandId:'home',...far}); spot.approach=landingApproach({islandId:'home',...far},spot); const gap=p => Math.hypot(p.x-spot.approach.x,p.y-spot.approach.y);
  try {
    await eventually(() => a.snapshot?.boats?.length);
    // Each run uses a fresh harbor boat; previous arrivals remain parked beside the beach.
    let boatId=null;
    const boat=() => a.snapshot.boats.find(b => b.id===boatId);
    const boardHarbor=async () => {
      await setup({...HARBOR.land,mode:'walking',path:[]});
      await eventually(() => a.snapshot.boats.some(b => !b.occupant && b.id.split('~')[0]==='home-0' && b.x===boatSpots()[0].x));
      boatId=a.snapshot.boats.find(b => !b.occupant && b.id.split('~')[0]==='home-0' && b.x===boatSpots()[0].x).id;
      a.send({type:'board',boatId});
      await eventually(() => a.duck()?.mode==='sailing');
    };
    await boardHarbor();
    await setup({...far,sailTarget:null,sailRoute:null,docking:false},1);
    assert.ok(gap(far)>200,'the boat starts well out from the shore');
    a.send({type:'disembark'});
    await eventually(() => a.duck()?.mode==='sailing' && Math.hypot(boat().x-far.x,boat().y-far.y)>40);   // sailing in, not teleported
    assert.equal(boat().occupant,a.welcome.id);
    let closest=Infinity;
    await eventually(() => {const b=boat(); if (b?.occupant) closest=Math.min(closest,gap(b)); return a.duck()?.mode==='walking';});
    assert.deepEqual([a.duck().x,a.duck().y],[spot.x,spot.y],'hops out onto the sand');
    const parked=await eventually(()=>boat()?.parked && !boat().occupant && {...boat()});
    assert.equal(parked.islandId,'home');
    assert.equal(a.snapshot.boats.filter(b => !b.occupant).length,boatSpots().length+1,'every mooring and the parked boat remain');
    await request('/test/restore');
    await eventually(()=>boat()?.parked);
    assert.deepEqual([boat().x,boat().y],[parked.x,parked.y],'worker restoration preserves the beach landing');
    assert.ok(closest<=60,`the Ducky was still aboard within two ticks of the shore (${closest.toFixed(0)} px out)`);   // snapshots go out every other 50 ms step, 19 px of sailing each
    // already beside the sand: dock and it lands with no sail at all
    await boardHarbor();
    await setup({...spot.approach,sailTarget:null,sailRoute:null,docking:false},1);
    a.send({type:'disembark'});
    await eventually(() => a.duck()?.mode==='walking');
    // the window losing focus (a stop with no steering) mid-dock must not strand the Ducky in the boat
    await boardHarbor();
    await setup({...far,sailTarget:null,sailRoute:null,docking:false},1);
    a.send({type:'disembark'});
    await delay(100);
    a.send({type:'input',x:0,y:0,stop:true});
    await eventually(() => a.duck()?.mode==='walking');
    assert.deepEqual([a.duck().x,a.duck().y],[spot.x,spot.y],'still hops out onto the sand');
    // steering away mid-dock cancels it and the room goes quiet instead of waiting on a landing forever
    await boardHarbor();
    await setup({...far,sailTarget:null,sailRoute:null,docking:false},1);
    a.send({type:'disembark'});
    a.send({type:'input',x:1,y:0});
    await delay(150);
    a.send({type:'input',x:0,y:0});
    await delay(600);
    assert.equal(a.duck().mode,'sailing','steering cancelled the landing');
    const still=a.duck(); await delay(300);
    assert.deepEqual([a.duck().x,a.duck().y],[still.x,still.y],'and the boat has stopped');
  } finally {
    a.close();
    await request('/test/expire-session');
    await request('/test/expire-resume');
  }
});

test('every island always shows all its moored boats: a taken boat is replaced, and docking elsewhere leaves that island full (boss 6 Nov)', async () => {
  // boss 6 Nov: "I took the boat already. Every island should have all the boats."
  await request('/test/expire-session');
  await request('/test/expire-resume');
  await request('/test/reset-boats');
  const [first,second]=await Promise.all([signIn(9330),signIn(9331)]);
  const [a,b]=await Promise.all([socket(first.session),socket(second.session)]);
  const setup=(client,pose,steps=0) => request('/test/travel',{method:'POST',body:JSON.stringify({id:client.welcome.id,pose,steps})});
  const per=boatSpots().length, spot=boatSpots()[0], away={x:-120,y:1960};
  // each island's own map's moorings (boss 6 Nov: a themed island has its own)
  const mooredAt=(snapshot,slot) => snapshot.boats.find(boat => !boat.occupant && boat.x===boatSpots(snapshot.islandId)[slot].x && boat.y===boatSpots(snapshot.islandId)[slot].y);
  const allMoored=snapshot => boatSpots(snapshot.islandId).every((_,slot) => mooredAt(snapshot,slot));
  try {
    await eventually(() => a.snapshot?.boats?.length && b.snapshot?.boats?.length);
    assert.ok(allMoored(a.snapshot),'home starts with every mooring full');
    // A takes the harbor boat and sails clear of the jetty: a fresh boat appears at that berth
    const taken=mooredAt(a.snapshot,0).id;
    await setup(a,{...HARBOR.land,path:[]});
    a.send({type:'board',boatId:taken});
    await eventually(() => a.duck()?.mode==='sailing');
    assert.equal(a.duck().boatId,taken);
    await setup(a,{...away,sailTarget:null,sailRoute:null,docking:false},1);
    await eventually(() => mooredAt(b.snapshot,0) && mooredAt(b.snapshot,0).id!==taken);
    assert.ok(allMoored(b.snapshot),'after taking a boat its mooring is full again');
    assert.equal(b.snapshot.boats.length,per+1,'the moored boats plus the one A is sailing');
    // B takes a boat from the very same mooring right after
    const refill=mooredAt(b.snapshot,0).id;
    await setup(b,{...HARBOR.land,path:[]});
    b.send({type:'board',boatId:refill});
    await eventually(() => b.duck()?.mode==='sailing');
    assert.equal(b.duck().boatId,refill);
    await setup(b,{x:away.x,y:away.y+200,sailTarget:null,sailRoute:null,docking:false},1);
    await eventually(() => allMoored(b.snapshot) && b.snapshot.boats.length===per+2);
    // A crosses to a neighbour and docks at its jetty: every one of its moorings has a boat, islets and beaches included
    const exit=destinationsFor('home')[0];
    await setup(a,{...exit.dock,exitLocked:false},1);
    await eventually(() => a.snapshot.islandId===exit.destination);
    const there=harborOf(exit.destination), perThere=boatSpots(exit.destination).length;
    await setup(a,{x:there.water.x,y:there.water.y,exitLocked:false});
    a.send({type:'disembark'});
    await eventually(() => a.duck()?.mode==='walking');
    const parked=await eventually(()=>a.snapshot.boats.find(boat=>boat.id===taken && !boat.occupant));
    assert.equal(parked.islandId,exit.destination);
    assert.deepEqual([parked.x,parked.y],[there.water.x,there.water.y]);
    assert.ok(allMoored(a.snapshot),`all ${perThere} of ${exit.destination}'s moorings are full`);
    assert.equal(a.snapshot.boats.length,perThere+1,'the parked arrival stays alongside the existing moorings');
    // the count never dropped on any island, in any snapshot either player saw
    for (const message of [...a.messages,...b.messages].filter(message => message.type==='snapshot')) assert.ok(message.boats.length>=boatSpots(message.islandId).length,`${message.islandId} showed ${message.boats.length} boats`);
  } finally {
    a.close();
    b.close();
    await request('/test/expire-session');
    await request('/test/expire-resume');
  }
});

test('docking beside an island that is not a jetty neighbour lands you on that island', async () => {
  // A shore inside the current sea bounds can be landed on without a jetty link.
  await request('/test/expire-session');
  await request('/test/expire-resume');
  await request('/test/reset-boats');
  const login=await signIn(9320), a=await socket(login.session);
  const setup=(pose,steps=0) => request('/test/travel',{method:'POST',body:JSON.stringify({id:a.welcome.id,pose,steps})});
  const {target,...off}=nonNeighbourLanding(), spot=landingSpot(off);
  const walkNav=mapOf(target).nav();
  try {
    assert.ok(!destinationsFor(off.islandId).some(d => d.destination===target),'the target is not a jetty neighbour');
    assert.equal(spot?.islandId,target);
    await eventually(() => a.snapshot?.boats?.length);
    const boatId=a.snapshot.boats.find(boat => !boat.occupant && boat.id==='home-1').id;
    await setup({...HARBOR.land,path:[]});
    a.send({type:'board',boatId});
    await eventually(() => a.duck()?.mode==='sailing');
    await setup({...off,sailTarget:null,sailRoute:null,docking:false},1);
    await eventually(() => a.snapshot?.islandId===off.islandId);
    a.send({type:'disembark'});
    await eventually(() => a.duck()?.mode==='walking');
    assert.equal(a.snapshot.islandId,target,'the room moves you to the target island');
    assert.equal(a.duck().islandId,target);
    assert.deepEqual([a.duck().x,a.duck().y],[spot.x,spot.y],'standing on the target island sand');
    assert.ok(walkNav.walkable(a.duck().x,a.duck().y),'on walkable ground (the walking map the room uses)');
    const parked=await eventually(()=>a.snapshot.boats.find(boat=>boat.id===boatId && !boat.occupant));
    assert.equal(parked.islandId,spot.islandId);
    assert.ok(canSail(parked.x,parked.y,spot.islandId),'boat stays in destination-local water, not the departure coordinate frame');
    assert.ok(Math.hypot(parked.x-spot.x,parked.y-spot.y)<300,'the boat stays beside the landing');
    a.send({type:'board',boatId});
    await eventually(()=>a.duck()?.mode==='sailing' && a.duck().boatId===boatId);
  } finally {
    a.close();
    await request('/test/expire-session');
    await request('/test/expire-resume');
  }
});

test('player and spectator caps still allow watching and an explicit retry', async () => {
  await request('/test/expire-session');
  await request('/test/expire-resume');
  const players = [];
  const spectators = [];
  try {
    // boss 6 Nov: an island holds up to ISLAND_LIMIT (100) Duckies; a new one starts on home, so the 101st watches instead
    const {ISLAND_LIMIT} = await import('../worker/index.js');
    for (let i=0;i<ISLAND_LIMIT;i++) players.push(await socket((await signIn(i+1000)).session));
    const {session} = await signIn(1000+ISLAND_LIMIT+50);
    const extra = await socket(session);
    spectators.push(extra);
    assert.equal(extra.welcome.reason,'players-full');
    await eventually(() => extra.snapshot?.players.length === ISLAND_LIMIT);
    for (let i=1;i<64;i++) spectators.push(await socket());
    const overflow = await socket();
    assert.equal(overflow.welcome.reason,'spectators-full');
    spectators.pop().close();
    await delay(150);
    const retried = await socket();
    spectators.push(retried);
    assert.equal(retried.welcome.reason,null);
  } finally {
    for (const client of [...players,...spectators]) client.close();
  }
});

test('bigger Home accepts walking destinations west of the original origin and restores those saved positions', async () => {
  await request('/test/expire-session');
  await request('/test/expire-resume');
  const login=await signIn(9391),a=await socket(login.session);
  try {
    const start={x:-544,y:2033},target={x:-544,y:2100};
    assert.ok(mapOf('home').nav().clearLine([start.x,start.y],[target.x,target.y]));
    await request('/test/travel',{method:'POST',body:JSON.stringify({id:a.welcome.id,pose:{...start,path:[],mode:'walking'}})});
    await eventually(()=>a.duck()?.x===start.x);
    a.send({type:'destination',...target});
    await eventually(()=>a.duck()?.action===0&&Math.hypot(a.duck().x-target.x,a.duck().y-target.y)<.01);
    await request('/test/restore');
    await eventually(()=>a.duck()?.action===0);
    assert.deepEqual([a.duck().x,a.duck().y],[target.x,target.y]);
  } finally {a.close();}
});


test('whole-globe layout: worker join preserves every saved island ID and local walking pose', async () => {
  await request('/test/expire-session');
  await request('/test/expire-resume');
  const {WORLD_ISLANDS}=await import('../src/pixi/world-map.js');
  for(const [k,island] of WORLD_ISLANDS.entries()){
    const login=await signIn(9400+k),a=await socket(login.session),pose={islandId:island.id,...mapOf(island.id).spawn,turn:.3,mode:'walking',path:[]};
    let resumed;
    try {
      await request('/test/travel',{method:'POST',body:JSON.stringify({id:a.welcome.id,pose})});
      await eventually(()=>a.duck()?.islandId===island.id&&a.duck()?.turn===.3);
      a.close();await delay(80);
      resumed=await socket(login.session);
      await eventually(()=>resumed.duck()?.islandId===island.id);
      assert.deepEqual([resumed.duck().x,resumed.duck().y,resumed.duck().turn],[Math.round(pose.x*100)/100,Math.round(pose.y*100)/100,pose.turn],island.id+' keeps its local saved pose on the hundredth-unit wire format');
      assert.equal(resumed.welcome.id,a.welcome.id,'resumed identity passes worker join');
    } finally {a.close();resumed?.close();}
  }
});
