import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import { CITIES, NAMES, SLOTS, SPEED, HZ, rnd, pick, outfit, randomSpot, walkable, move } from './rive/web/world.js';

const HOST = '127.0.0.1';
const root = fileURLToPath(new URL('./rive/web/', import.meta.url));
const players = new Map(), bots = new Map();
const quacks = Object.fromEntries(CITIES.map(city => [city, 0]));
let botId = 0, tick = 0;
const wire = d => Object.fromEntries(['id', 'name', 'city', 'cap', 'shades', 'acc', 'shoes', 'x', 'y', 'facing', 'action', 'bot', 'ack'].map(k => [k, d[k]]));
const snapshot = () => ({ type: 'snapshot', tick: ++tick, time: performance.now(), players: [...players.values()].map(wire), bots: [...bots.values()].map(wire), quacks });
function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) ws.send(JSON.stringify(message));
}
function fillCrowd() {
  const count = Math.max(0, 10 - players.size);
  while (bots.size > count) bots.delete(bots.keys().next().value);
  while (bots.size < count) {
    const [x, y] = randomSpot(), id = `bot-${++botId}`;
    bots.set(id, { id, name: pick(NAMES), city: Math.floor(rnd(0, 4)), ...outfit(), x, y, tx: x, ty: y, facing: 1, action: 0, bot: true, until: 0, wait: rnd(.5, 3) });
  }
}
function broadcast() {
  const message = snapshot();
  for (const player of players.values()) send(player.ws, message);
}
function remove(player) {
  if (!players.delete(player.id)) return;
  fillCrowd(); broadcast();
}
const realtime = createServer((req, res) => {
  if (req.url !== '/health') { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ players: players.size, bots: bots.size, capacity: SLOTS, hz: HZ, quacks }));
});
const wss = new WebSocketServer({ server: realtime, path: '/room', maxPayload: 2048 });
wss.on('connection', (ws, req) => {
  // Local-only build: refuse browser connections from other origins.
  if (req.headers.origin && !['http://127.0.0.1:8804', 'http://localhost:8804'].includes(req.headers.origin)) { ws.close(1008, 'Local page only'); return; }
  if (players.size >= SLOTS) { ws.close(1013, 'Plaza full (16 players)'); return; }
  const id = randomUUID(), now = performance.now();
  const [x, y] = randomSpot();
  const player = { id, ws, name: `${pick(NAMES)}_${id.slice(0, 3)}`, city: Math.floor(rnd(0, 4)), ...outfit(),
    x, y, facing: 1, action: 0, bot: false, ack: -1, emoteSeq: -1, until: 0, lastQuack: -Infinity,
    lastState: now, lastSeen: now, tokens: 40, tokenTime: now, alive: true };
  players.set(id, player); fillCrowd();
  send(ws, { type: 'welcome', id, hz: HZ, capacity: SLOTS, self: wire(player) });
  broadcast();
  ws.on('error', () => remove(player));
  ws.on('pong', () => { player.alive = true; });
  ws.on('close', () => remove(player));
  ws.on('message', (buffer, binary) => {
    const now = performance.now();
    player.tokens = Math.min(40, player.tokens + (now - player.tokenTime) * .03); player.tokenTime = now;
    if (binary || --player.tokens < 0) { ws.close(1008, 'Message rate exceeded'); return; }
    let m; try { m = JSON.parse(buffer.toString()); } catch { return; }
    if (!m || typeof m !== 'object') return;
    player.lastSeen = now;
    if (m.type === 'state') {
      if (!Number.isSafeInteger(m.seq) || m.seq <= player.ack || !walkable(m.x, m.y)
        || ![-1, 1].includes(m.facing) || ![0, 1].includes(m.action)) return;
      // One second of bounded movement credit handles jitter, never unlimited teleports.
      const elapsed = Math.min(1000, now - player.lastState);
      const distance = Math.hypot(m.x - player.x, m.y - player.y);
      if (distance <= SPEED * elapsed / 1000 + 4) { player.x = m.x; player.y = m.y; }
      player.lastState = now; player.ack = m.seq; player.facing = m.facing;
      if (now >= player.until) player.action = m.action;
    } else if (m.type === 'emote') {
      if (!Number.isSafeInteger(m.seq) || m.seq <= player.emoteSeq || !['quack', 'dance'].includes(m.action)) return;
      player.emoteSeq = m.seq;
      if (m.action === 'quack') {
        if (now - player.lastQuack < 1250) return;
        player.lastQuack = now; player.action = 2; player.until = now + 1250;
        quacks[CITIES[player.city]]++;
      } else if (player.action === 3) { player.action = 0; player.until = 0; }
      else if (now >= player.until) { player.action = 3; player.until = now + 6000; }
    }
  });
});
fillCrowd();
let previous = performance.now();
const loop = setInterval(() => {
  const now = performance.now(), dt = Math.min(.2, (now - previous) / 1000); previous = now;
  for (const player of players.values()) {
    if (now > player.until && (player.action > 1 || now - player.lastState > 300)) player.action = 0;
  }
  for (const b of bots.values()) {
    if (b.action > 1 && now < b.until) continue;
    const dx = b.tx - b.x, dy = b.ty - b.y;
    if (Math.hypot(dx, dy) > 4) {
      b.action = move(b, dx, dy, dt, SPEED * .75) ? 1 : 0;
      if (!b.action) { b.tx = b.x; b.ty = b.y; }
    } else {
      b.action = 0; b.wait -= dt;
      if (b.wait <= 0) {
        const r = Math.random();
        if (r < .15) { b.action = 3; b.until = now + rnd(2500, 5000); }
        else if (r < .3) { b.action = 2; b.until = now + 1250; }
        else [b.tx, b.ty] = randomSpot();
        b.wait = rnd(.8, 3.5);
      }
    }
  }
  broadcast();
}, 1000 / HZ);
const heartbeat = setInterval(() => {
  for (const p of players.values()) {
    if (!p.alive) { p.ws.terminate(); remove(p); }
    else { p.alive = false; p.ws.ping(); }
  }
}, 5000);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.riv': 'application/octet-stream', '.ico': 'image/x-icon' };
const page = createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
  if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(target);
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404).end('Not found'); }
});
for (const server of [realtime, page]) server.on('error', error => { console.error(error.message); process.exit(1); });
realtime.listen(8803, HOST, () => console.log('Realtime: ws://127.0.0.1:8803/room'));
page.listen(8804, HOST, () => console.log('Ducky Land: http://127.0.0.1:8804/'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(loop); clearInterval(heartbeat);
  for (const p of players.values()) p.ws.terminate();
  wss.close(); realtime.close(); page.close();
});
