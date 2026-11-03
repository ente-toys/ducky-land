import assert from 'node:assert/strict';
import test, {after, before} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {createNavigation} from '../src/pixi/navigation.js';
import {world} from '../server-world.mjs';

const origin = 'https://island.example';
const nav = createNavigation(world);
let mf;

before(async () => {
  const root = fileURLToPath(new URL('../',import.meta.url));
  const {outputFiles:[bundle]} = await build({stdin:{resolveDir:root, contents:`
    import {IslandRoom} from './worker/index.js';
    import {start, callback, session, logout, connect} from './server/pages-auth.js';
    export class TestIsland extends IslandRoom {
      fetch(request) {
        const path = new URL(request.url).pathname;
        if (path === '/test/expire-flow') this.sql.exec('UPDATE flows SET expires=0');
        if (path === '/test/expire-resume') this.sql.exec('UPDATE resumes SET expires=0');
        if (path === '/test/expire-session') this.sql.exec('UPDATE sessions SET expires=0');
        if (path.startsWith('/test/')) return new Response(null, {status:204});
        return super.fetch(request);
      }
    }
    const fakeGitHub = async (url, options) => {
      if (url.endsWith('/access_token')) {
        const {code,code_verifier} = Object.fromEntries(options.body);
        if (code_verifier.length !== 43 || !/^account-[0-9]+$/.test(code)) return new Response(null,{status:400});
        return Response.json({access_token:code});
      }
      const login = options.headers.Authorization.split(' ')[1];
      return Response.json({id:Number(login.slice(8)),login});
    };
    export default {fetch(request,env) {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/test/')) return env.ISLAND.get(env.ISLAND.idFromName('main-island')).fetch(request);
      const handler = {'/auth/github/start':start,'/auth/github/callback':callback,'/api/session':session,
        '/auth/logout':logout,'/api/room':connect}[path];
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
  assert.deepEqual((await request('/api/session',{headers:{Cookie:good.session}}).then(r=>r.json())).user,{login:'account-1'});
  assert.equal((await request(good.path,{headers:{Cookie:good.flowCookie}})).headers.get('Location'),'/?auth=failed');
  const response = await request('/auth/logout',{method:'POST',headers:{Origin:'https://elsewhere.example',Cookie:good.session}});
  assert.equal(response.status,403);
  await request('/test/expire-session');
  assert.equal((await request('/api/session',{headers:{Cookie:good.session}}).then(r=>r.json())).user,null);
});

async function socket(cookie) {
  const headers = {Upgrade:'websocket', Origin:origin};
  if (cookie) headers.Cookie = cookie;
  const response = await request('/api/room?play=1',{headers});
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
    assert.deepEqual(Object.keys(spawn).sort(),['action','emoteVersion','id','outfit','travel','turn','x','y']);
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
