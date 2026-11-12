import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {makeRoom, addPlayer, wander, seeded} from '../qa/room-harness.mjs';
import {mapOf} from '../src/pixi/island-maps.js';

export async function loadTest({players: N = 100, island = 'blossom', seconds = 20, quiet = false} = {}) {
  const room = await makeRoom(), map = mapOf(island), nav = map.nav(), rnd = seeded(11);
  const spots = [];
  for (let k = 0; spots.length < N && k < 50000; k++) {
    const x = map.spawn.x + (rnd() * 2 - 1) * 1200, y = map.spawn.y + (rnd() * 2 - 1) * 800;
    if (nav.walkable(x, y)) spots.push({x, y});
  }
  const players = spots.map((p, n) => addPlayer(room, n, {islandId: island, ...p}));
  room.timer = 'manual';
  room.broadcast();
  for (const p of players) {p.socket.sent = 0; p.socket.bytes = 0;}
  const steps = seconds * 20, times = [];
  let commandMs = 0;
  for (let i = 0; i < steps; i++) {
    room.timer = 'manual';
    const c0 = performance.now();
    wander(room, players, nav, rnd, {spawn: map.spawn});
    commandMs += performance.now() - c0;
    const t0 = performance.now();
    room.step();
    times.push(performance.now() - t0);
  }
  clearInterval(room.timer); room.timer = null;
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length, p95 = times[Math.floor(times.length * .95)], max = times.at(-1);
  const sent = players.reduce((a, p) => a + p.socket.sent, 0), bytes = players.reduce((a, p) => a + p.socket.bytes, 0);
  const last = JSON.parse(players[0].socket.last ?? '{}');
  const onIsland = [...room.connections.values()].filter(info => info.actor?.islandId === island).length;
  const walkable = [...room.connections.values()].every(info => nav.walkable(info.actor.x, info.actor.y) || info.actor.path?.length);
  const result = {players: N, island, map: map.id, seconds, onIsland, walkable, tickMeanMs: +mean.toFixed(2), tickP95Ms: +p95.toFixed(2), tickMaxMs: +max.toFixed(2),
    tickBudgetMs: 50, clickRoutesMsPerSecond: +(commandMs / seconds).toFixed(1), cpuShare: +((mean * 20 + commandMs / seconds) / 1000).toFixed(3), snapshotsPerPlayerPerSecond: +(sent / N / seconds).toFixed(1),
    snapshotBytes: players[0].socket.last?.length ?? 0, playersInSnapshot: last.players?.length ?? 0,
    kbPerPlayerPerSecond: +(bytes / N / seconds / 1024).toFixed(1), mbOutPerSecond: +(bytes / seconds / 1048576).toFixed(2)};
  if (!quiet) console.log(JSON.stringify(result, null, 2));
  return result;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const [players = 100, island = 'blossom', seconds = 20] = process.argv.slice(2);
  await loadTest({players: Number(players), island, seconds: Number(seconds)});
}
