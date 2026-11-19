import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join as pathJoin} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

test(
  'split world migrates, routes spawns and sailors, and returns unattended boats after restart',
  {timeout: 60000},
  async (t) => {
    const source = `
    import {WorldService} from './worker/world-service.js';
    import {IslandSimulation, SeaSimulation} from './worker/simulation.js';
    import {WorldPresence} from './worker/world-presence.js';
    import {worldStub,simulationStub,presenceStub,internalPost} from './server/simulation-routing.js';
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
        const path=new URL(request.url).pathname;
        if(path==='/activate' && this.env.HOLD_ACTIVATION==='1')return new Response(null,{status:503});
        if(path==='/fixture/staged')return Response.json(this.room.sql.exec('SELECT count(*) AS count FROM incoming').one().count);
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
        if(path==='/fixture/fleet')return Response.json(this.room.boats);
        if(path==='/fixture/seed-replica') {
          const boat=this.room.boats[0];
          this.room.boats.push(
            {...boat,id:'home-0~old-replacement',parked:true,parkedAt:Date.now()},
            {...boat,id:'home-0~built-repair-fixture',owner:'repair-fixture',parked:true,parkedAt:Date.now()}
          );
          this.room.saveBoats();
          return Response.json({});
        }
        if(path==='/fixture/move-boat') {
          const boat=this.room.boats.find(item=>item.id==='home-0');
          this.room.boats=this.room.boats.filter(item=>item!==boat);
          this.room.saveBoats();
          const target=simulationStub(this.env,this.room.simulation.world,'blossom');
          return internalPost(target,'/fixture/park-boat',boat);
        }
        if(path==='/fixture/park-boat') {
          const boat=await request.json();
          Object.assign(boat,{...harborOf('blossom').water,islandId:'blossom'});
          this.room.parkBoat(boat);
          this.room.boats.push(boat);
          this.room.saveBoats();
          return Response.json(boat);
        }
        if(path==='/fixture/age-boat') {
          const boat=this.room.boats.find(item=>item.id==='home-0');
          const {age}=await request.json();
          this.room.returnIdleBoats(boat.parkedAt+age);
          const pending=this.room.sql.exec('SELECT payload FROM boat_returns WHERE id=?',boat.id).toArray()[0];
          await this.room.sendBoatReturns();
          if(pending) {
            const home=simulationStub(this.env,this.room.simulation.world,'home');
            const retry=await internalPost(home,'/return-boat',JSON.parse(pending.payload));
            if(!retry.ok)return retry;
          }
          return Response.json(this.room.boats.some(item=>item.id===boat.id));
        }
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
      if(url.pathname==='/staged')return simulationStub(env,world,'sea').fetch('https://island.internal/fixture/staged');
      if(url.pathname==='/stage-status')return internalPost(worldStub(env,world),'/fixture/stages',{});
      if(url.pathname==='/seed-presence') {
        const count=Number(url.searchParams.get('count'));
        return internalPost(presenceStub(env,world),'/publish',{
          owner:'isle-249',revision:count+1,watchers:25,
          players:Array.from({length:count},(_,i)=>({account:'seed-'+i,generation:1})),
        });
      }
      if(url.pathname==='/session') return createTestSession(ctx);
      if(url.pathname==='/room') return connect(ctx);
      if(url.pathname==='/logout')return logout(ctx);
      if(url.pathname==='/migrate') return internalPost(worldStub(env,world),'/simulation/migrate',
        {id:url.searchParams.get('id'),target:url.searchParams.get('target'),world});
      if(url.pathname==='/repair-fleet')return internalPost(worldStub(env,world),'/simulation/mode',
        {id:'fleet-repair',target:'split',fleetRepair:true,world});
      if(url.pathname==='/build'||url.pathname==='/built')return simulationStub(env,world,url.searchParams.get('island')??'home').fetch('https://island.internal/fixture'+url.pathname);
      if(['/fleet','/move-boat','/age-boat','/seed-replica'].includes(url.pathname)) {
        const owner=url.searchParams.get('island')??'home';
        return simulationStub(env,world,owner).fetch(new Request('https://island.internal/fixture'+url.pathname,request));
      }
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
    const start = (hold, holdActivation = false) =>
      new Miniflare(
        convertV4MiniflareOptions({
          resourcePersistencePath: storage,
          bindings: {HOLD_COMMIT: hold ? '1' : '0', HOLD_ACTIVATION: holdActivation ? '1' : '0'},
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
    assert.equal(player.snapshot.roomSentAt, undefined);
    player.socket.send(JSON.stringify({type: 'room-timing', id: 13}));
    const probe = await wait(() => player.messages.find(m => m.type === 'room-timing' && m.id === 13));
    assert.equal(probe.owner, 'home');
    assert.equal(probe.epoch, player.snapshot.epoch);
    assert.ok(Number.isFinite(probe.roomAt));
    const timedSnapshot = await wait(() => player.messages.find(m => m.type === 'snapshot' && m.roomSentAt));
    assert.ok(timedSnapshot.roomSentAt >= probe.roomAt);
    assert.ok(timedSnapshot.tick > probe.tick);
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
    runtime = start(false, true);
    await runtime.ready;
    await waitAsync(async () =>
      (await (await request('/stage-status')).json()).some((row) => row.state === 'committed')
    );
    assert.equal(await (await request('/staged')).json(), 1);
    // Now the directory has committed, but the destination still has only its prepare.
    await runtime.dispose();
    runtime = start(false);
    await runtime.ready;
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

    assert.ok((await request('/migrate?world=spawn&target=split&id=spawn-cutover')).ok);
    const newSpawnToken = async () => {
      const response = await request('/session?world=spawn', {
        method: 'POST',
        headers: {'X-Multiplayer-Test-Id': '919c4104-faed-4a20-931c-9b3abec359ab', Origin: 'https://game.test'},
      });
      assert.equal(response.status, 200);
      return (await response.json()).token;
    };
    const homeToken = await newSpawnToken();
    assert.ok((await request('/seed-presence?world=spawn&count=14')).ok);
    const homeSpawn = await join('world=spawn&play=1&testSession=' + homeToken);
    assert.equal(homeSpawn.snapshot.islandId, 'home', 'spectators do not contribute to the threshold');
    homeSpawn.socket.close();

    const overflowToken = await newSpawnToken();
    assert.ok((await request('/seed-presence?world=spawn&count=15')).ok);
    const overflowParams = 'world=spawn&play=1&testSession=' + overflowToken;
    const overflow = await join(overflowParams);
    assert.ok(['blossom', 'sunset', 'isle-251', 'isle-250', 'isle-55'].includes(overflow.snapshot.islandId));
    assert.ok(overflow.welcome.arrival);
    assert.ok(overflow.snapshot.players.some((p) => p.id === overflow.welcome.id));
    overflow.socket.close();
    const rejoined = await join(overflowParams + '&resume=' + overflow.welcome.id);
    assert.equal(rejoined.welcome.id, overflow.welcome.id);
    assert.equal(rejoined.snapshot.islandId, overflow.snapshot.islandId);
    rejoined.socket.close();

    const boatFixture = async (path, options) => {
      const response = await request(path, options);
      const body = await response.text();
      assert.equal(response.status, 200, `${path} returned ${response.status} ${body}`);
      return JSON.parse(body);
    };
    const fleet = (island) => boatFixture('/fleet?world=spawn&island=' + island);
    const homeFleet = await fleet('home');
    const startingBoat = homeFleet.find((boat) => boat.id === 'home-0');
    const blossomCount = (await fleet('blossom')).length;
    const parked = await boatFixture('/move-boat?world=spawn');
    assert.equal(parked.islandId, 'blossom');
    assert.equal((await fleet('home')).length, homeFleet.length - 1);
    assert.equal((await fleet('blossom')).length, blossomCount + 1);
    await runtime.dispose();
    runtime = start(false);
    const saved = (await fleet('blossom')).find((boat) => boat.id === startingBoat.id);
    assert.deepEqual([saved.x, saved.y, saved.parkedAt], [parked.x, parked.y, parked.parkedAt]);
    const ageBoat = (age) => boatFixture('/age-boat?world=spawn&island=blossom', {
      method: 'POST', body: JSON.stringify({age}),
    });
    const sixHours = 6 * 60 * 60 * 1000;
    assert.equal(await ageBoat(sixHours - 1), true, 'still available one millisecond before six hours');
    assert.equal(await ageBoat(sixHours), false, 'leaves the visiting island at the deadline');
    assert.equal((await fleet('blossom')).length, blossomCount);
    const returned = (await fleet('home')).filter((boat) => boat.id === startingBoat.id);
    assert.equal(returned.length, 1, 'a retried return creates no duplicate');
    assert.deepEqual([returned[0].x, returned[0].y], [startingBoat.x, startingBoat.y]);

    await boatFixture('/seed-replica?world=spawn&island=blossom');
    assert.equal((await fleet('blossom')).length, blossomCount + 2);
    assert.deepEqual(await boatFixture('/repair-fleet?world=spawn'), {mode:'split'});
    assert.deepEqual(await boatFixture('/repair-fleet?world=spawn'), {mode:'split'});
    const repaired = await fleet('blossom');
    assert.equal(repaired.length, blossomCount + 1);
    assert.ok(repaired.some(boat => boat.id === 'home-0~built-repair-fixture'));
    assert.equal((await fleet('home')).find(boat => boat.id === 'home-0').x, startingBoat.x);
  }
);
