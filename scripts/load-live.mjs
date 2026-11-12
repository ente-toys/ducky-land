import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import WebSocket from 'ws';
import {mapOf} from '../src/pixi/island-maps.js';

const [N = 100, island = 'blossom', seconds = 20, port = 8941] = process.argv.slice(2).map((v, i) => i === 1 ? v : Number(v));
if (Number(port) === 8890) throw Error('8890 is the boss\'s server: pick another port');
const root = fileURLToPath(new URL('../', import.meta.url));
const {outputFiles: [bundle]} = await build({stdin: {resolveDir: root, contents: `
  import {IslandRoom} from './worker/index.js';
  export class LoadRoom extends IslandRoom {
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/__test/session') {
        const account = await request.text();
        this.sql.exec('INSERT OR REPLACE INTO sessions (digest,account,login,expires,can_play,github_token) VALUES(?,?,?,?,1,?)', account, account, account, Date.now()+86400000, 'load');
        return new Response(null, {status: 204});
      }
      if (path === '/__test/pose') {
        const {account, pose} = await request.json();
        const entry = [...this.connections].find(([, info]) => info.account === account && info.actor);
        if (entry) {Object.assign(entry[1].actor, pose, {path: []}); entry[1].islandId = pose.islandId ?? entry[1].islandId; this.attach(...entry);}
        this.broadcast();
        return new Response(null, {status: 204});
      }
      if (path === '/__test/stats') return Response.json({steps: this.stepCount ?? 0, ticks: this.tickCount, timer: Boolean(this.timer)});
      if (path === '/__test/count') return Response.json([...this.connections.values()].filter(i => i.actor).reduce((m, i) => (m[i.actor.islandId] = (m[i.actor.islandId] ?? 0) + 1, m), {}));
      return super.fetch(request);
    }
  }
  export default {async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname, room = env.ISLAND.get(env.ISLAND.idFromName('load-island'));
    const account = request.headers.get('Cookie')?.match(/(?:^|; )test_user=([a-z0-9-]+)/)?.[1];
    if (path.startsWith('/__test/')) return room.fetch(new Request('https://test.internal' + path, request));
    if (path === '/api/room') {
      if (account) await room.fetch(new Request('https://test.internal/__test/session', {method: 'POST', body: account}));
      const headers = new Headers({Upgrade: 'websocket'}); if (account) headers.set('X-Session-Digest', account);
      return room.fetch(new Request('https://test.internal/room?play=' + url.searchParams.get('play'), {headers}));
    }
    return new Response('load test', {status: 200});
  }};
`}, bundle: true, format: 'esm', write: false});
const assets = mkdtempSync(join(tmpdir(), 'ducky-load-'));
const INSPECT = process.env.LOAD_PROFILE ? Number(port) + 1 : undefined;
const mf = new Miniflare(convertV4MiniflareOptions({host: '127.0.0.1', port: Number(port), ...(INSPECT ? {inspectorPort: INSPECT} : {}), modules: [{type: 'ESModule', path: 'index.js', contents: bundle.text}],
  compatibilityDate: '2026-11-02', durableObjects: {ISLAND: {className: 'LoadRoom', useSQLite: true}}}));
const base = String(await mf.ready).replace(/\/$/, '');
const map = mapOf(island), nav = map.nav();
let seed = 5; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const spot = (r = 1200) => {for (let k = 0; k < 500; k++) {const x = map.spawn.x + (rnd() * 2 - 1) * r, y = map.spawn.y + (rnd() * 2 - 1) * r * .7; if (nav.walkable(x, y)) return {x, y};} return {...map.spawn};};

const bots = [];
for (let n = 0; n < N; n++) {
  const account = `bot-${n}`, ws = new WebSocket(`${base.replace('http', 'ws')}/api/room?play=1`, {headers: {Cookie: `test_user=${account}`}});
  const bot = {account, ws, seq: 0, welcome: null, msgs: 0, bytes: 0, gaps: [], last: 0, players: 0};
  const sample = n < 5;
  ws.on('message', data => {
    const text = data.toString(); if (text === 'pong') return;
    if (!text.startsWith('{"type":"snapshot"')) {const m = JSON.parse(text); if (m.type === 'welcome') bot.welcome = m; return;}
    if (!bot.measuring) return;
    const now = performance.now(); if (bot.last) bot.gaps.push(now - bot.last); bot.last = now;
    bot.msgs++; bot.bytes += text.length;
    if (sample) bot.players = JSON.parse(text).players.filter(p => p.islandId === island).length;
  });
  await new Promise((ok, no) => {ws.once('open', ok); ws.once('error', no);});
  bots.push(bot);
}
await new Promise(ok => setTimeout(ok, 500));
const playing = bots.filter(b => b.welcome?.id).length;
for (const bot of bots) await fetch(`${base}/__test/pose`, {method: 'POST', body: JSON.stringify({account: bot.account, pose: {islandId: island, mode: 'walking', ...spot()}})});
const counts = await (await fetch(`${base}/__test/count`)).json();
let profiler = null;
if (INSPECT) {
  const targets = await (await fetch(`http://127.0.0.1:${INSPECT}/json/list`)).json();
  const cdp = new WebSocket(targets.find(t => /core:user/.test(t.id) || /index/.test(t.title ?? '')).webSocketDebuggerUrl ?? targets[0].webSocketDebuggerUrl);
  await new Promise(ok => cdp.once('open', ok));
  let id = 0; const pending = new Map();
  cdp.on('message', d => {const m = JSON.parse(d); pending.get(m.id)?.(m.result); pending.delete(m.id);});
  const call = (method, params = {}) => new Promise(ok => {pending.set(++id, ok); cdp.send(JSON.stringify({id, method, params}));});
  await call('Profiler.enable'); await call('Profiler.start');
  profiler = {stop: async () => {const {profile} = await call('Profiler.stop'); (await import('node:fs')).writeFileSync(process.env.LOAD_PROFILE, JSON.stringify(profile)); cdp.close();}};
}
for (const bot of bots) bot.measuring = true;
const stats0 = await (await fetch(`${base}/__test/stats`)).json(), t0 = performance.now();
const walker = setInterval(() => {
  for (const bot of bots) if (rnd() < .05) {const p = spot(1400); bot.ws.send(JSON.stringify({type: 'destination', seq: ++bot.seq, x: p.x, y: p.y}));}
}, 100);
await new Promise(ok => setTimeout(ok, seconds * 1000));
clearInterval(walker);
const stats1 = await (await fetch(`${base}/__test/stats`)).json(), wall = (performance.now() - t0) / 1000;
await profiler?.stop();
const gaps = bots.flatMap(b => b.gaps).sort((a, b) => a - b), q = k => +gaps[Math.floor(gaps.length * k)]?.toFixed(1);
const result = {players: N, playing, island, map: map.id, onIsland: counts[island] ?? 0, seconds,
  snapshotsPerPlayerPerSecond: +(bots.reduce((a, b) => a + b.msgs, 0) / N / seconds).toFixed(1),
  snapshotKB: +(bots.reduce((a, b) => a + b.bytes, 0) / Math.max(1, bots.reduce((a, b) => a + b.msgs, 0)) / 1024).toFixed(1),
  kbPerPlayerPerSecond: +(bots.reduce((a, b) => a + b.bytes, 0) / N / seconds / 1024).toFixed(1),
  playersSeen: Math.min(...bots.slice(0, 5).map(b => b.players)), gapMedianMs: q(.5), gapP95Ms: q(.95), gapP99Ms: q(.99), gapMaxMs: +gaps.at(-1)?.toFixed(1),
  serverStepsPerSecond: +((stats1.steps - stats0.steps) / wall).toFixed(1), serverSnapshotsPerSecond: +((stats1.ticks - stats0.ticks) / wall).toFixed(1)};
console.log(JSON.stringify(result, null, 2));
for (const bot of bots) bot.ws.close();
await mf.dispose();
process.exit(0);
