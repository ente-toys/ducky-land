import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocketServer, WebSocket } from 'ws';
import { CITIES, NAMES, SLOTS, SPEED, HZ, rnd, pick, outfit, randomSpot, walkable, move } from './server-world.mjs';
import { world } from './server-world.mjs';
import { createIslandBrain, CROWD_ACTION } from './assets/world/crowd.js';

const HOST = '127.0.0.1';
const players = new Map(), bots = new Map();
const {brain,ox,oy}=createIslandBrain(world,walkable);
brain.updatePlayer=()=>{const p=players.values().next().value;if(p){brain.player.x=p.x-ox;brain.player.y=p.y-oy;}};
const quacks = Object.fromEntries(CITIES.map(city => [city, 0]));
let botId = 0, tick = 0;
const cityBread=Object.fromEntries(CITIES.map(c=>[c,0]));
const wire = d => Object.fromEntries(['id', 'name', 'city', 'cap', 'shades', 'acc', 'shoes', 'x', 'y', 'facing', 'action', 'bot', 'ack', 'turn', 'activity'].map(k => [k, d[k]]));
const snapshot = () => ({ type: 'snapshot', tick: ++tick, time: performance.now(), players: [...players.values()].map(wire), bots: [...bots.values()].map(wire).concat(brain.ducks.slice(1).map(d=>({...d,id:'social-'+d.id,bot:true,x:d.x+ox,y:d.y+oy,action:CROWD_ACTION[d.action]??0,turn:Math.atan2(d.vx||0,(d.vy||0)/1.65)*180/Math.PI}))), quacks, cityBread });
function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) ws.send(JSON.stringify(message));
}
function fillCrowd() {
  const count = Math.max(0, 24 - players.size);
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
  res.end(JSON.stringify({ players: players.size, bots: bots.size+brain.ducks.length-1, capacity: SLOTS, hz: HZ, quacks }));
});
const wss = new WebSocketServer({ server: realtime, path: '/room', maxPayload: 2048 });
wss.on('connection', (ws, req) => {
  if (req.headers.origin && !['http://127.0.0.1:8800', 'http://localhost:8800'].includes(req.headers.origin)) { ws.close(1008, 'Local page only'); return; }
  if (players.size >= SLOTS) { ws.close(1013, 'Plaza full (16 players)'); return; }
  const id = randomUUID(), now = performance.now();
  let [x,y]=world.zones.plaza.spawn;if(players.size){const a=players.size*2.399963,r=140+Math.floor(players.size/6)*40,nx=x+Math.cos(a)*r,ny=y+Math.sin(a)*r*.65;if(walkable(nx,ny)){x=nx;y=ny;}}
  const params=new URL(req.url,'http://localhost').searchParams;
  const clean=(params.get('name')||'ducky').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||'ducky';
  const n=(key,max,fallback=0)=>{const v=Number(params.get(key));return Number.isInteger(v)&&v>=0&&v<=max?v:fallback;};
  const player = { id, ws, name:clean, city:n('city',8,1),cap:n('cap',13,8),shades:n('shades',3),acc:n('acc',7),shoes:n('shoes',10),turn:0,activity:null,
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
    if(m.type==='profile') {
      for(const [key,max]of Object.entries({cap:13,shades:3,acc:7,shoes:10,city:8}))if(Number.isInteger(m[key])&&m[key]>=0&&m[key]<=max)player[key]=m[key];
      if(typeof m.name==='string')player.name=m.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,18)||player.name;
    } else if(m.type==='activity') {
      if(m.kind==='race'&&Math.hypot(player.x-4155,player.y-2070)<450){player.activity='race';player.x=4140;player.y=1745;player.lastState=now;}
      else if(m.kind==='bread'&&Math.hypot(player.x-1390,player.y-1780)<650){player.activity='bread';player.collected=new Set();}
      else if(m.kind==='end'){if(player.activity==='race')[player.x,player.y]=world.zones['race-lake'].spawn;player.activity=null;}
    } else if(m.type==='collect'&&player.activity==='bread'&&Number.isInteger(m.id)&&m.id>=0&&m.id<12&&!player.collected.has(m.id)){
      player.collected.add(m.id);cityBread[CITIES[player.city]]+=10;
    } else if (m.type === 'state') {
      if (!Number.isSafeInteger(m.seq) || m.seq <= player.ack || !(walkable(m.x,m.y)||(player.activity==='race'&&((m.x-4140)/660)**2+((m.y-1520)/350)**2<=1.3))
        || ![-1, 1].includes(m.facing) || ![0, 1].includes(m.action)) return;
      const elapsed = Math.min(1000, now - player.lastState);
      const distance = Math.hypot(m.x - player.x, m.y - player.y);
      if (distance <= SPEED * elapsed / 1000 + 4) { player.x = m.x; player.y = m.y; }
      player.lastState = now; player.ack = m.seq; player.facing = m.facing;
      if(Number.isFinite(m.turn))player.turn=Math.max(-180,Math.min(180,m.turn));
      if (now >= player.until) player.action = m.action;
    } else if (m.type === 'emote') {
      if (!Number.isSafeInteger(m.seq) || m.seq <= player.emoteSeq || !['quack', 'dance', 'heart', 'laugh', 'wave', 'sleep', 'angry', 'party'].includes(m.action)) return;
      player.emoteSeq = m.seq;
      if (m.action === 'quack') {
        if (now - player.lastQuack < 1250) return;
        player.lastQuack = now; player.action = 2; player.until = now + 1250;
        quacks[CITIES[player.city]]++;
        brain.pose(brain.player,'quack',1.3);
      } else if(!['quack','dance'].includes(m.action)){player.action={heart:4,laugh:5,wave:6,sleep:7,angry:8,party:9}[m.action];player.until=now+2300;} else if (player.action === 3) { player.action = 0; player.until = 0; }
      else if (now >= player.until) { player.action = 3; player.until = now + 6000; brain.startParty(brain.player); }
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
  brain.update(dt);
  broadcast();
}, 1000 / HZ);
const heartbeat = setInterval(() => {
  for (const p of players.values()) {
    if (!p.alive) { p.ws.terminate(); remove(p); }
    else { p.alive = false; p.ws.ping(); }
  }
}, 5000);
realtime.on('error', error => { console.error(error.message); process.exit(1); });
realtime.listen(Number(process.env.DUCKY_WS_PORT)||8810, HOST, () => console.log(`Realtime: ws://127.0.0.1:${Number(process.env.DUCKY_WS_PORT)||8810}/room`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  clearInterval(loop); clearInterval(heartbeat);
  for (const p of players.values()) p.ws.terminate();
  wss.close(); realtime.close();
});
