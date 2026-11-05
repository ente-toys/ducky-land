import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {createNavigation} from '../src/pixi/navigation.js';
import {world} from '../server-world.mjs';
import {HARBOR,EXITS,exitsFor,canSail} from '../src/pixi/islands.js';

const origin = 'https://island.example';
const nav = createNavigation(world);
let mf;

before(async () => {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const {outputFiles:[bundle]} = await build({stdin:{resolveDir:root, contents:`
    import {IslandRoom} from './worker/index.js';
    import {start, callback, session, logout, connect, playAccess} from './server/pages-auth.js';
    export class TestIsland extends IslandRoom {
      async fetch(request) {
        const path = new URL(request.url).pathname;
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
        if (path.startsWith('/test/')) return new Response(null, {status:204});
        return super.fetch(request);
      }
    }
    const starredAccounts = new Set();
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
      return Response.json({id:Number(login.slice(8)),login});
    };
    export default {fetch(request,env) {
      const path = new URL(request.url).pathname;
      if (path === '/test/star') { starredAccounts.add('account-9000'); return new Response(null,{status:204}); }
      if (path === '/test/unstar') { starredAccounts.delete('account-9000'); return new Response(null,{status:204}); }
      if (path.startsWith('/test/')) return env.ISLAND.get(env.ISLAND.idFromName('main-island')).fetch(request);
      const handler = {'/auth/github/start':start,'/auth/github/callback':callback,'/api/session':session,
        '/auth/logout':logout,'/api/room':connect,'/api/play-access':playAccess}[path];
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
  assert.deepEqual((await request('/api/session',{headers:{Cookie:good.session}}).then(r=>r.json())).user,{login:'account-1',canPlay:true});
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
  for (let i=0;i<150;i++) {
    const value = predicate();
    if (value) return value;
    await delay(20);
  }
  assert.fail('Expected WebSocket message did not arrive');
}

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
  assert.deepEqual(result.user,{login:'account-9000',canPlay:false});
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
    assert.deepEqual(Object.keys(spawn).sort(),['action','boatId','emoteVersion','exitLocked','id','islandId','mode','outfit','travel','turn','x','y']);
    assert.equal((await eventually(() => b.duck(id)))?.login,'account-101');
    assert.equal(b.duck()?.login,'account-102');
    assert.equal(guest.snapshot.self,null);
    assert.equal((await request('/api/room?play=1',{headers:{Upgrade:'websocket',Origin:'https://elsewhere.example',Cookie:one.session}})).status,403);

    guest.send({type:'input',x:1,y:0,id});
    guest.send({type:'emote',action:3,id});
    a.send({type:'state',x:100,y:100});
    a.send({type:'input',x:7,y:0});
    a.send({type:'destination',x:-100,y:10});
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
    assert.deepEqual([fresh.x,fresh.y,fresh.outfit],[...world.zones.plaza.spawn,before.outfit]);

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
  const [first,second,watcher]=await Promise.all([signIn(9301),signIn(9302),signIn(9303)]);
  const [a,b,watch]=await Promise.all([socket(first.session),socket(second.session),socket(watcher.session,false)]);
  const clients=[a,b,watch];
  const setup=(client,pose,steps=0) => request('/test/travel',{method:'POST',body:JSON.stringify({id:client.welcome.id,pose,steps})});
  try {
    await eventually(() => a.snapshot?.boats?.length === 3);
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
    captain.send({type:'destination',x:1800,y:1000});
    await delay(100);
    assert.equal(captain.duck().mode,'sailing');
    assert.ok(canSail(captain.duck().x,captain.duck().y));
    captain.send({type:'input',x:0,y:-1});
    await eventually(() => captain.duck().y<before.y-20);
    captain.send({type:'input',x:0,y:0});
    const exit=exitsFor('home')[0];
    await setup(captain,{x:exit.x,y:exit.y,exitLocked:false},1);
    await eventually(() => captain.snapshot.islandId===exit.destination);
    await eventually(() => !other.duck(captain.welcome.id));
    assert.equal(captain.snapshot.players.length,1);
    captain.send({type:'watch',islandId:'sunset'});
    await delay(100);
    assert.equal(captain.snapshot.islandId,exit.destination,'players cannot teleport with spectator commands');
    watch.send({type:'watch',islandId:exit.destination});
    await eventually(() => watch.snapshot.islandId===exit.destination);
    assert.equal(watch.duck(captain.welcome.id)?.mode,'sailing');
    captain.send({type:'chat',text:'Across the sea'});
    await eventually(() => watch.messages.some(message => message.type==='chat' && message.text==='Across the sea'));
    assert.equal(other.messages.some(message => message.type==='chat' && message.text==='Across the sea'),false);
    const id=captain.welcome.id;
    captain.close();
    await eventually(() => !watch.duck(id));
    const held=watch.snapshot.boats.find(boat => boat.id===boatId);
    assert.equal(held.occupant,id);
    const resumed=await socket(captainCookie);
    clients.push(resumed);
    await eventually(() => resumed.duck()?.mode==='sailing');
    assert.equal(resumed.welcome.id,id);
    assert.equal(resumed.snapshot.islandId,exit.destination);
    assert.equal(resumed.duck().boatId,boatId);
    await request('/test/restore');
    await eventually(() => resumed.duck()?.mode==='sailing');
    assert.equal(resumed.snapshot.boats.find(boat => boat.id===boatId).occupant,id);
    await setup(resumed,{x:HARBOR.water.x,y:HARBOR.water.y,exitLocked:false});
    resumed.send({type:'disembark'});
    await eventually(() => resumed.duck()?.mode==='walking');
    assert.deepEqual([resumed.duck().x,resumed.duck().y],[HARBOR.land.x,HARBOR.land.y]);
    assert.equal(resumed.snapshot.boats.find(boat => boat.id===boatId).occupant,null);
    resumed.send({type:'board',boatId});
    await eventually(() => resumed.duck()?.mode==='sailing');
    resumed.close();
    await eventually(() => !watch.duck(id));
    await request('/test/expire-resume');
    watch.send({type:'watch',islandId:exit.destination});
    await eventually(() => watch.snapshot.boats.find(boat => boat.id===boatId)?.occupant===null);
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

test('player and spectator caps still allow watching and an explicit retry', async () => {
  await request('/test/expire-session');
  await request('/test/expire-resume');
  const players = [];
  const spectators = [];
  try {
    for (let i=0;i<16;i++) players.push(await socket((await signIn(i+1000)).session));
    const {session} = await signIn(1100);
    const extra = await socket(session);
    spectators.push(extra);
    assert.equal(extra.welcome.reason,'players-full');
    await eventually(() => extra.snapshot?.players.length === 16);
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
