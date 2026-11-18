import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join as pathJoin} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

test(
  'split world migrates, routes Pages joins, transfers a sailing actor and boat, and rolls back',
  {timeout: 60000},
  async (t) => {
    const source = `
    import {WorldService} from './worker/world-service.js';
    import {IslandSimulation, SeaSimulation} from './worker/simulation.js';
    import {WorldPresence} from './worker/world-presence.js';
    import {worldStub,simulationStub,internalPost} from './server/simulation-routing.js';
    import {connect,createTestSession,logout} from './server/pages-auth.js';
    import {boardingPoint,harborOf} from './src/gameplay/islands.js';
    export {WorldPresence};
    export class TestWorld extends WorldService {
      async fetch(request) {
        if(new URL(request.url).pathname==='/fixture/economy') {
          const account='fixture-economy',digest='fixture-local',bog='isle-249';
          this.sql.exec('INSERT INTO sessions(digest,account,login,expires,can_play) VALUES(?,?,?,?,1)',digest,account,account,Date.now()+60000);
          const slot=this.karma.pool.slots.find(s=>s.readyAt===0);
          const site=this.karma.pool.sites.get(slot.siteId),owner=site.islandId;
          this.sql.exec('INSERT INTO simulation_owners VALUES(?,?,?)',account,owner,123);
          this.sql.exec('INSERT OR REPLACE INTO karma_balances VALUES(?,4)',account);
          const data={id:'one-pickup',account,digest,owner,generation:123,site:site.id,actor:{...site,mode:'walking'}};
          const claim=await this.control('/simulation/claim',data);
          const again=await this.control('/simulation/claim',data);
          const duplicateClaim=await this.control('/simulation/claim',{...data,id:'other-claim'});
          this.sql.exec("UPDATE simulation_owners SET owner='sea' WHERE account=?",account);
          await this.control('/simulation/prepare',{...data,id:'bog-landing',owner:'sea',destination:bog,chargeBog:true});
          const enter={id:'bog-landing',digest};
          const first=await this.control('/simulation/commit',enter),second=await this.control('/simulation/commit',enter);
          const entry=this.karma.bogEntry(account);
          const retryArena=await this.control('/simulation/arena-entry',{...data,owner:bog,generation:124});
          return Response.json({claim:await claim.json(),again:await again.json(),duplicate:duplicateClaim.status,
            charges:[first.status,second.status],balance:this.karma.balance(account),entry:entry?.id,arena:(await retryArena.json()).entry.id});
        }
        if(new URL(request.url).pathname==='/fixture/stages')
          return Response.json(this.sql.exec('SELECT state FROM simulation_transfers').toArray());
        if(new URL(request.url).pathname==='/simulation/commit' && this.env.HOLD_COMMIT==='1')return new Response(null,{status:503});
        const response=await super.fetch(request);
        if(new URL(request.url).pathname==='/simulation/commit' && response.ok && !this.lostCommit) {
          this.lostCommit=true;
          return new Response(null,{status:503});
        }
        return response;
      }
    }
    export class TestSea extends SeaSimulation {
      async fetch(request) {
        const response=await super.fetch(request);
        if(new URL(request.url).pathname==='/stage' && response.ok && !this.lostStage) {
          this.lostStage=true;
          return new Response(null,{status:503});
        }
        return response;
      }
    }
    export class FixtureIsland extends IslandSimulation {
      async fetch(request) {
        const path=new URL(request.url).pathname;
        if(path==='/fixture/build'){
          const info=[...this.room.connections.values()].find(i=>i.actor);
          await internalPost(simulationStub(this.env,this.room.simulation.world,'blossom'),'/fixture/old-built',{account:info.account});
          this.room.buildBoat(info,{...harborOf('home').water,turn:0});
          return Response.json(info.account);
        }
        if(path==='/fixture/old-built'){
          const {account}=await request.json();
          this.room.boats.push({id:'blossom-0~built-old',islandId:'blossom',...harborOf('blossom').water,turn:0,occupant:null,departure:'blossom',parked:true,owner:account});
          this.room.saveBoats();
          return Response.json({});
        }
        if(path==='/fixture/built')return Response.json(this.room.boats.filter(b=>b.owner).map(b=>b.id));
        if(path==='/fixture/dock') {
          const info=[...this.room.connections.values()].find(i=>i.actor);
          const boat=this.room.boats.find(b=>!b.occupant);
          Object.assign(info.actor,boardingPoint(boat,this.room.navFor(info.actor.islandId)));
          return Response.json({boat:boat.id, actor:info.actor.id});
        }
        return super.fetch(request);
      }
    }
    export default {async fetch(request,env) {
      const url=new URL(request.url);
      const world=url.searchParams.get('world')??'qa';
      env={...env,ISLAND_ROOM_NAME:world};
      const ctx={env,request,data:{}};
      if(url.pathname==='/economy')return internalPost(worldStub(env,world),'/fixture/economy',{});
      if(url.pathname==='/stage-status')return internalPost(worldStub(env,world),'/fixture/stages',{});
      if(url.pathname==='/session') return createTestSession(ctx);
      if(url.pathname==='/room') return connect(ctx);
      if(url.pathname==='/logout')return logout(ctx);
      if(url.pathname==='/migrate') return internalPost(worldStub(env,world),'/simulation/migrate',
        {id:url.searchParams.get('id'),target:url.searchParams.get('target'),world});
      if(url.pathname==='/build'||url.pathname==='/built')return simulationStub(env,world,url.searchParams.get('island')??'home').fetch('https://island.internal/fixture'+url.pathname);
      if(url.pathname==='/dock')return simulationStub(env,world,'home').fetch('https://island.internal/fixture/dock');
      return new Response(null,{status:404});
    }}`;
    const bundle = await build({
      stdin: {contents: source, resolveDir: process.cwd()},
      bundle: true,
      format: 'esm',
      write: false,
    });
    const storage = await mkdtemp(pathJoin(tmpdir(), 'ducky-crossing-'));
    const start = (hold) =>
      new Miniflare(
        convertV4MiniflareOptions({
          resourcePersistencePath: storage,
          bindings: {HOLD_COMMIT: hold ? '1' : '0'},
          modules: [{type: 'ESModule', path: 'index.js', contents: bundle.outputFiles[0].text}],
          compatibilityDate: '2026-11-02',
          durableObjects: Object.fromEntries(
            Object.entries({
              ISLAND: 'TestWorld',
              ISLAND_SIM: 'FixtureIsland',
              SEA_SIM: 'TestSea',
              WORLD_PRESENCE: 'WorldPresence',
            }).map(([key, className]) => [key, {className, useSQLite: true}])
          ),
        })
      );
    let runtime = start(true);
    t.after(async () => {
      await runtime.dispose();
      await rm(storage, {recursive: true, force: true});
    });
    const request = (path, opts) => runtime.dispatchFetch('https://game.test' + path, opts);
    const migrate = async (target, id) => {
      const response = await request('/migrate?target=' + target + '&id=' + id);
      assert.equal(response.status, 200, await response.text());
    };
    const wait = async (fn) => {
      for (let i = 0; i < 700; i++) {
        const result = fn();
        if (result) return result;
        await delay(15);
      }
      assert.fail('Timed out waiting for world event');
    };
    const waitAsync = async (fn) => {
      for (let i = 0; i < 100; i++) {
        if (await fn()) return true;
        await delay(100);
      }
      assert.fail('Timed out waiting for durable transfer');
    };
    const join = async (params) => {
      const response = await request('/room?protocol=2&' + params, {
        headers: {Upgrade: 'websocket', Origin: 'https://game.test'},
      });
      assert.equal(response.status, 101, response.status === 101 ? '' : await response.text());
      const socket = response.webSocket,
        messages = [];
      socket.addEventListener('message', ({data}) => messages.push(JSON.parse(data)));
      socket.accept();
      const snapshot = await wait(() => messages.find((m) => m.type === 'snapshot'));
      return {socket, messages, snapshot, welcome: messages.find((m) => m.type === 'welcome')};
    };
    const sessionResponse = await request('/session', {
      method: 'POST',
      headers: {'X-Multiplayer-Test-Id': '919c4104-faed-4a20-931c-9b3abec359ab', Origin: 'https://game.test'},
    });
    assert.equal(sessionResponse.status, 200);
    const {token} = await sessionResponse.json();
    await migrate('split', 'one');
    await migrate('split', 'one');
    const other = await join('world=other&play=0');
    assert.equal(other.welcome.protocol, undefined);
    const watcher = await join('play=0&watch=blossom');
    assert.equal(watcher.snapshot.islandId, 'blossom');
    const player = await join('play=1&testSession=' + token);
    assert.equal(player.welcome.protocol, 2);
    assert.ok((await request('/migrate?world=other&target=split&id=other-cutover')).ok);
    const isolated = await join('world=other&play=0&watch=home');
    assert.equal(isolated.welcome.protocol, 2);
    assert.deepEqual(isolated.snapshot.players, []);
    isolated.socket.close();
    await request('/build');
    const built = await wait(() => player.messages.find((m) => m.type === 'boat-built'));
    assert.deepEqual(await (await request('/built?island=blossom')).json(), []);
    assert.deepEqual(await (await request('/built?island=home')).json(), [built.boatId]);
    const dock = await (await request('/dock')).json();
    player.socket.send(JSON.stringify({type: 'board', boatId: dock.boat, seq: 1}));
    const handoff = await waitAsync(async () =>
      (await (await request('/stage-status')).json()).some((row) => row.state === 'prepared')
    );
    assert.ok(handoff);
    // Drop both isolates with the source journal and destination prepare on disk.
    await runtime.dispose();
    runtime = start(false);
    await runtime.ready;
    await waitAsync(async () =>
      (await (await request('/stage-status')).json()).some((row) => row.state === 'committed')
    );
    const sailor = await join('play=1&testSession=' + token + '&resume=' + dock.actor);
    assert.equal(sailor.welcome.id, dock.actor);
    assert.equal(sailor.snapshot.players.find((p) => p.id === dock.actor).mode, 'sailing');
    assert.equal(sailor.snapshot.boats.filter((b) => b.id === dock.boat).length, 1);
    const guest = await join('play=1&testSession=' + token);
    assert.equal(guest.welcome.id, dock.actor, 'replacement login keeps the active sailing actor');
    const taken = await wait(() => sailor.messages.find((m) => m.type === 'role'));
    assert.equal(taken.reason, 'taken-over');
    const second = await (
      await request('/session', {
        method: 'POST',
        headers: {
          'X-Multiplayer-Test-Id': '919c4104-faed-4a20-931c-9b3abec359ab',
          Origin: 'https://game.test',
        },
      })
    ).json();
    const revoked = await join('play=1&testSession=' + second.token);
    const loggedOut = await request('/logout', {
      method: 'POST',
      headers: {Cookie: '__Host-ducky_session=' + second.token, Origin: 'https://game.test'},
    });
    assert.ok(loggedOut.status < 400);
    const demoted = await wait(() => revoked.messages.find((m) => m.type === 'role'));
    assert.equal(demoted.reason, 'signed-out');
    const audit = await (await request('/economy')).json();
    assert.deepEqual(audit.claim, audit.again);
    assert.equal(audit.claim.total, 5);
    assert.equal(audit.duplicate, 409);
    assert.deepEqual(audit.charges, [200, 200]);
    assert.equal(audit.balance, 0);
    assert.equal(audit.entry, audit.arena);
    await migrate('legacy', 'two');
    assert.equal(
      (await request('/migrate?target=split&id=one')).status,
      409,
      'superseded deployment cannot start another cutover'
    );
    const restored = await join('play=1&testSession=' + token + '&resume=' + dock.actor);
    assert.equal(restored.welcome.protocol, undefined);
    assert.equal(restored.welcome.id, dock.actor);
    assert.equal(restored.snapshot.players.find((p) => p.id === dock.actor).boatId, dock.boat);
    for (const {socket} of [other, watcher, player, sailor, guest, revoked, restored])
      if (socket.readyState === 1) socket.close();
  }
);
