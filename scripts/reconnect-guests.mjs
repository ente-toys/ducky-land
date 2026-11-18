import {setTimeout as delay} from 'node:timers/promises';
import WebSocket from 'ws';
import {RoomClient} from '../src/multiplayer/room-client.js';
import {mapOf} from '../src/world/island-maps.js';
import {boardingPoint, canSail} from '../src/gameplay/islands.js';

const workloads = {walking: [20, 0], mixed: [20, 10], sailing: [40, 40], observe: [1, 0]};
const workload = process.argv[2];
const seconds = Number(process.argv[3] ?? 900);
const target = URL.canParse(process.env.DUCKY_GUEST_URL) ? new URL(process.env.DUCKY_GUEST_URL) : null;
if (!Object.hasOwn(workloads, workload) || !Number.isInteger(seconds) || seconds < 1 ||
    !target || !['https:', 'http:'].includes(target.protocol) || target.username || target.password ||
    (workload !== 'observe' && !/^#[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target.hash))) {
  console.error('Usage: set DUCKY_GUEST_URL to the isolated guest URL, then run node scripts/reconnect-guests.mjs walking|mixed|sailing|observe [seconds]');
  process.exit(1);
}

const [count, sailingTarget] = workloads[workload];
const observing = workload === 'observe';
const world = mapOf('home');
const nav = world.nav();
const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ducks = [];
const reserved = new Map();
let joiningDuck;
let stopping = false;
let reconnects = 0;
class WorkloadError extends Error {}

function log(event, fields = {}) {
  console.log(JSON.stringify({timestamp: new Date().toISOString(), event, ...fields}));
}

globalThis.location = new URL(target.origin);
globalThis.document = {hidden: false};
globalThis.WebSocket = class extends WebSocket {
  constructor(url) {
    const duck = joiningDuck;
    if (duck.token) url.searchParams.set('testSession', duck.token);
    super(url, {origin: target.origin, handshakeTimeout: 12_000});
    this.on('upgrade', response => log('upgrade', {duck: duck.index, ray: response.headers['cf-ray']}));
    this.on('error', error => log('socket_error', {duck: duck.index, code: error.code ?? error.name}));
  }
};

async function join(index) {
  const duck = {index, sailing: index < sailingTarget, direction: index % directions.length, nextAction: 0};
  if (!observing) {
    const response = await fetch(new URL('/api/test-session', target.origin), {
      method: 'POST',
      headers: {Origin: target.origin, 'X-Multiplayer-Test-Id': target.hash.slice(1)},
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new WorkloadError('Guest session HTTP ' + response.status);
    const {token, user} = await response.json();
    if (!token || !user?.canPlay) throw new WorkloadError('Guest session could not play');
    duck.token = token;
  }
  const room = duck.room = new RoomClient(() => {});
  room.onReconnectDiagnostic = ({event, ...diagnostic}) => {
    if (event === 'reconnect') reconnects++;
    log(event, {duck: index, ...diagnostic});
  };
  room.configure(nav, world.walk);
  const connect = room.connect.bind(room);
  room.connect = (...args) => {
    joiningDuck = duck;
    return connect(...args);
  };
  ducks.push(duck);
  room.connect(!observing);
}

function walk(duck, elapsed) {
  const {room} = duck;
  if (!room.player || room.islandId !== 'home') return;
  const {x, y} = room.player;
  const [dx, dy] = directions[duck.direction];
  if (elapsed >= duck.nextAction || !nav.walkable(x + dx * 96, y + dy * 96)) {
    const turns = duck.index % 2 ? [-1, 1, -2, 2, -3, 3, 4, 0] : [1, -1, 2, -2, 3, -3, 4, 0];
    duck.direction = turns.map(turn => (duck.direction + turn + 8) % 8).find(direction => {
      const [tx, ty] = directions[direction];
      return [48, 96, 144].every(distance => nav.walkable(x + tx * distance, y + ty * distance));
    }) ?? duck.direction;
    duck.nextAction = elapsed + 2800 + duck.index * 137 % 2100;
  }
  const [nextX, nextY] = directions[duck.direction];
  room.step(.05, {x: nextX, y: nextY, reducedMotion: false});
}

function sail(duck, pose) {
  const {room} = duck;
  for (let offset = 0; offset < directions.length; offset++) {
    const direction = (duck.direction + offset) % directions.length;
    const [dx, dy] = directions[direction];
    const distance = 750 + (duck.index % 5) * 45;
    if (![.25, .5, .75, 1].every(fraction =>
      canSail(pose.x + dx * distance * fraction, pose.y + dy * distance * fraction, pose.islandId, 55))) continue;
    if (room.destination(pose.x + dx * distance, pose.y + dy * distance)) {
      duck.direction = (direction + (duck.index % 2 ? 1 : 7)) % directions.length;
      break;
    }
  }
}

function board(duck, pose, elapsed) {
  const {room} = duck;
  const held = reserved.get(duck.boat);
  if (held?.duck === duck && elapsed < held.until && !room.boats.find(boat => boat.id === duck.boat)?.occupant) return;
  if (held?.duck === duck) reserved.delete(duck.boat);
  const option = room.usableBoats().filter(boat => boat.islandId === pose.islandId && !reserved.has(boat.id))
    .map(boat => ({boat, deck: boardingPoint(boat, nav)}))
    .filter(({deck}) => nav.walkable(deck.x, deck.y))
    .sort((a, b) => Math.hypot(a.deck.x - pose.x, a.deck.y - pose.y) - Math.hypot(b.deck.x - pose.x, b.deck.y - pose.y))[0];
  if (option && room.board(option.boat.id)) {
    duck.boat = option.boat.id;
    reserved.set(duck.boat, {duck, until: elapsed + 38_000});
  }
}

function move(duck, elapsed) {
  if (!duck.sailing) return walk(duck, elapsed);
  const {room} = duck;
  const pose = room.snapshotPlayers.get(room.id);
  if (!pose || elapsed < duck.nextAction) return;
  if (pose.mode === 'sailing') {
    if (reserved.get(duck.boat)?.duck === duck) reserved.delete(duck.boat);
    sail(duck, pose);
  } else if (pose.islandId === 'home') board(duck, pose, elapsed);
  duck.nextAction = elapsed + 3100 + (duck.index % 8) * 160;
}

function status() {
  return {
    active: ducks.filter(({room}) => room.tick >= 0 && (observing || room.player)).length,
    sailing: ducks.filter(({room}) => room.player?.mode === 'sailing').length,
    epochs: [...new Set(ducks.filter(({room}) => room.tick >= 0).map(({room}) => room.epoch))],
  };
}

process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
try {
  log('joining', {origin: target.origin, workload, count, seconds});
  for (let index = 0; index < count && !stopping; index++) {
    await join(index);
    await delay(350);
  }

  const warmup = performance.now();
  let started;
  let minActive = count;
  let minSailing = sailingTarget;
  let nextReport = warmup + 30_000;
  while (!stopping) {
    const frame = performance.now();
    if (!observing) for (const duck of ducks) move(duck, frame - warmup);
    const state = status();
    if (started === undefined && state.active === count && state.sailing === sailingTarget) {
      started = frame;
      log('started', state);
    }
    if (started === undefined && frame - warmup > 180_000) throw new WorkloadError('Workload did not reach requested participation');
    if (started !== undefined) {
      minActive = Math.min(minActive, state.active);
      minSailing = Math.min(minSailing, state.sailing);
      if (frame - started >= seconds * 1000) break;
    }
    if (frame >= nextReport) {
      log('progress', state);
      nextReport = frame + 30_000;
    }
    await delay(Math.max(1, 50 - (performance.now() - frame)));
  }
  log(stopping ? 'stopped' : 'finished', {...status(), minActive, minSailing, reconnects});
} catch (error) {
  log('failed', {message: error instanceof WorkloadError ? error.message : 'Guest workload failed', code: error.cause?.code, ...status()});
  process.exitCode = 1;
} finally {
  for (const duck of ducks) duck.room.dispose();
}
