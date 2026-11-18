// This runner creates its own local runtime. It does not accept a server URL.
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';

const seconds = Number(process.argv[2] ?? 1800);
const repetitions = Number(process.argv[3] ?? 3);
assert.ok(Number.isInteger(seconds) && seconds > 0 && seconds <= 1800);
assert.ok(Number.isInteger(repetitions) && repetitions > 0 && repetitions <= 3);
const {
  outputFiles: [bundle],
} = await build({
  entryPoints: ['qa/fixtures/simulation-load-worker.js'],
  bundle: true,
  format: 'esm',
  write: false,
});
async function run() {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: [{type: 'ESModule', path: 'load.js', contents: bundle.text}],
      compatibilityDate: '2026-11-02',
      durableObjects: Object.fromEntries(
        Object.entries({
          ISLAND: 'LoadWorld',
          ISLAND_SIM: 'LoadIsland',
          SEA_SIM: 'LoadSea',
          WORLD_PRESENCE: 'WorldPresence',
        }).map(([name, className]) => [name, {className, useSQLite: true}])
      ),
    })
  );
  const active = [],
    observers = [],
    joinTimes = [],
    unexpected = [];
  const req = (path, options) => runtime.dispatchFetch('https://local.test' + path, options);
  let shuttingDown = false;
  async function open(player, observer = false) {
    const params = new URLSearchParams({
      protocol: '2',
      play: observer ? '0' : '1',
      globeFeed: '1',
      watch: player.island,
    });
    if (player.id) params.set('resume', player.id);
    if (player.token) params.set('testSession', player.token);
    const start = performance.now();
    const result = await req('/room?' + params, {
      headers: {Upgrade: 'websocket', Origin: 'https://local.test'},
    });
    assert.equal(result.status, 101, result.status === 101 ? '' : await result.text());
    const socket = result.webSocket,
      state = {island: player.island, token: player.token, socket, seq: 0, frames: 0, closing: false};
    const first = Promise.withResolvers();
    socket.addEventListener('message', ({data}) => {
      if (shuttingDown || state.closing || socket.readyState !== 1 || data === 'pong') return;
      const m = JSON.parse(data);
      if (m.type === 'welcome') {
        state.id = m.id;
        state.seq = m.ack ?? 0;
        socket.send(JSON.stringify({type: 'updates'}));
      }
      if (m.type === 'transfer') state.transfer = true;
      if (m.type === 'snapshot' || m.type === 'delta') {
        state.frames++;
        state.lastFrame = Date.now();
        if (m.type === 'snapshot') {
          state.pose = m.players.find((p) => p.id === state.id);
          state.visible = new Set(m.players.map((p) => p.id));
        } else {
          for (const id of m.players.removed) state.visible.delete(id);
          for (const p of m.players.changed) state.visible.add(p.id);
          if (m.players.changed.some((p) => Number.isFinite(p.x) || Number.isFinite(p.y)))
            state.lastMotion = Date.now();
        }
        socket.send(JSON.stringify({type: 'snapshot-ack', tick: m.tick, epoch: m.epoch}));
        first.resolve();
      }
    });
    socket.addEventListener('close', ({code}) => {
      if (!shuttingDown && !state.closing)
        unexpected.push({observer, code, island: state.island, at: Date.now()});
      first.reject(Error('Closed before first snapshot'));
    });
    socket.accept();
    let timer;
    try {
      await Promise.race([
        first.promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('First snapshot timed out')), 10000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    assert.ok(observer || state.id);
    joinTimes.push(performance.now() - start);
    return state;
  }
  try {
    const tokens = await (await req('/seed')).json();
    const start = await req('/start');
    assert.equal(start.status, 200, await start.text());
    observers.push(await open({island: 'home'}, true), await open({island: 'blossom'}, true));
    for (let i = 0; i < tokens.length; i += 25)
      active.push(...(await Promise.all(tokens.slice(i, i + 25).map((p) => open(p)))));
    const owners = [...new Set(tokens.map((p) => p.island))];
    const end = Date.now() + seconds * 1000;
    let iteration = 0;
    let transfers = 0,
      boardings = 0,
      landings = 0;
    while (Date.now() < end) {
      for (let i = 0; i < active.length; i++) {
        const p = active[i];
        if (p.transfer) {
          transfers++;
          p.closing = true;
          const replacement = await open(p);
          if (replacement.pose?.mode === 'sailing') boardings++;
          else landings++;
          p.socket.close();
          active[i] = replacement;
          continue;
        }
        const direction = (Math.floor(iteration / 8) + i) % 2 ? 1 : -1;
        p.socket.send(JSON.stringify({type: 'input', seq: ++p.seq, x: direction, y: 0, run: true}));
      }
      if (iteration % 40 === 0) {
        const probe = active[iteration % active.length];
        const friends = await req('/friends', {headers: {Cookie: '__Host-ducky_session=' + probe.token}});
        assert.equal(friends.status, 200);
        probe.socket.send(
          JSON.stringify({type: 'globe-subscription', open: true, subscriptionId: iteration + 1})
        );
      }
      if (iteration % 80 === 10) {
        const dock = await (await req('/board-fixture?island=sunset')).json();
        if (dock) {
          const traveler = active[Number(dock.login.slice('test-load-'.length))];
          traveler.socket.send(JSON.stringify({type: 'board', boatId: dock.boat, seq: ++traveler.seq}));
        }
      }
      if (iteration % 80 === 45) await req('/land-fixture?island=sea');
      iteration++;
      await delay(125);
    }
    const locations = new Map((await (await req('/owners')).json()).map((row) => [row.account, row]));
    for (let index = 0; index < active.length; index++) {
      const p = active[index];
      if (!p.transfer) continue;
      p.closing = true;
      active[index] = await open(p);
      p.socket.close();
      transfers++;
    }
    const accounts = new Set(),
      actorIds = new Set(),
      boats = new Map(),
      sailors = new Map();
    let homePlayers = 0;
    for (const owner of [...owners, 'sea']) {
      const audit = await (await req('/audit?island=' + owner)).json();
      if (owner === 'home') homePlayers = audit.actors.length;
      for (const a of audit.actors) {
        assert.equal(locations.get(a.account)?.owner, owner);
        assert.equal(locations.get(a.account)?.generation, a.generation);
        assert.ok(!accounts.has(a.account) && !actorIds.has(a.id), 'actor has one owner');
        accounts.add(a.account);
        actorIds.add(a.id);
        if (a.mode === 'sailing') sailors.set(a.id, a.boat);
      }
      for (const b of audit.boats) {
        assert.ok(!boats.has(b.id), 'boat has one owner: ' + b.id);
        boats.set(b.id, b.occupant);
      }
    }
    assert.equal(homePlayers, 100);
    for (const player of active.slice(0, 100))
      assert.ok(observers[0].visible.has(player.id), 'Home observer sees the entire crowd');
    assert.equal(accounts.size, 250);
    for (const [actor, boat] of sailors) assert.equal(boats.get(boat), actor);
    for (const [boat, actor] of boats) if (actor) assert.equal(sailors.get(actor), boat);
    const timings = [];
    for (const island of [...owners, 'sea']) {
      const h = await (await req('/health?island=' + island)).json();
      if (!h.ticks) continue;
      let cumulative = 0,
        p99 = 0;
      for (const gap of Object.keys(h.histogram)
        .map(Number)
        .sort((a, b) => a - b)) {
        cumulative += h.histogram[gap];
        if (cumulative >= Math.ceil(0.99 * h.ticks)) {
          p99 = gap;
          break;
        }
      }
      timings.push({island, p99, maxGap: h.maxGap, ticks: h.ticks});
    }
    const failures = timings.filter((h) => h.p99 > 150 || h.maxGap > 1000);
    const before = observers[1].frames;
    await req('/suspend-fixture');
    const stalledAt = Date.now();
    const moving = active.find((p) => p.island === 'blossom');
    moving.socket.send(JSON.stringify({type: 'input', seq: ++moving.seq, x: 0, y: 1, run: true}));
    const late = await open({island: 'blossom'}, true);
    await delay(250);
    assert.ok(observers[1].frames > before);
    assert.ok(observers[1].lastMotion >= stalledAt, 'quiet island motion during Home failure');
    observers.push(late);
    const p95 = Math.round(joinTimes.sort((a, b) => a - b)[Math.ceil(joinTimes.length * 0.95) - 1]);
    const result = {
      actors: accounts.size,
      homePlayers,
      boats: boats.size,
      seconds,
      transfers,
      boardings,
      landings,
      timings,
      joinP95Ms: p95,
      unexpectedCloses: unexpected,
      timingFailures: failures.slice(0, 8),
      shutdownAt: new Date().toISOString(),
    };
    console.log(JSON.stringify(result));
    assert.ok(boardings && landings, 'tested boarding and landing');
    assert.equal(unexpected.length, 0);
    assert.equal(failures.length, 0);
    assert.ok(p95 <= 2000);
  } finally {
    shuttingDown = true;
    for (const p of [...active, ...observers]) if (p.socket.readyState === 1) p.socket.close();
    await runtime.dispose();
  }
}
for (let i = 0; i < repetitions; i++) await run();
