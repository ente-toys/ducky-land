import { W, H, SLOTS, HZ, walkable, move } from './world.js';
import { DELAY, sample } from './interpolation.js';

rive.RuntimeLoader.setWasmUrl('rive.wasm');
rive.RuntimeLoader.setWasmFallbackUrl('rive_fallback.wasm');

const canvas = document.getElementById('c');
const keys = new Set(), histories = new Map(), remotes = new Map(), pending = new Map();
let player = null, socket, connected = false, stopped = false, reconnectTimer;
let seq = 0, emoteSeq = 0, until = 0, lastQuack = -Infinity, movement = 0, clockOffset = Infinity;
let quacks = {}, realCount = 0, botCount = 0, snapshots = 0, stateSends = 0, tick = 0;
let vmi, slots = [], cache = [], drawOrder = [], last = 0;

function send(message) {
  if (!connected || socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 4096) return false;
  socket.send(JSON.stringify(message)); return true;
}
function emote(action) {
  if (!player || !connected) return;
  const now = performance.now();
  if (action === 'quack') {
    if (now - lastQuack < 1250) return;
    lastQuack = now; player.action = 2; until = now + 1250;
  } else {
    if (now < until && player.action === 2) return;
    player.action = player.action === 3 ? 0 : 3; until = player.action === 3 ? now + 6000 : 0;
  }
  send({ type: 'emote', action, seq: ++emoteSeq });
}
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys.add(k);
  if (!e.repeat && k === 'q') emote('quack');
  if (!e.repeat && k === 'e') emote('dance');
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); if (player) player.tapping = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); if (player) player.tapping = false; } });
canvas.addEventListener('pointerdown', e => {
  canvas.focus();
  if (!player || !connected) return;
  const r = canvas.getBoundingClientRect(), scale = Math.min(r.width / W, r.height / H);
  const x = (e.clientX - r.left - (r.width - W * scale) / 2) / scale;
  const y = (e.clientY - r.top - (r.height - H * scale) / 2) / scale;
  if (walkable(x, y)) { player.tx = x; player.ty = y; player.tapping = true; }
});

function connect() {
  if (stopped) return;
  document.title = 'Ducky Land · connecting';
  socket = new WebSocket(`ws://${location.hostname}:8803/room`);
  socket.addEventListener('message', e => {
    const m = JSON.parse(e.data), now = performance.now();
    if (m.type === 'welcome') {
      connected = true; player = { ...m.self, player: true }; seq = emoteSeq = 0;
      until = 0; lastQuack = -Infinity; movement = 0; pending.clear(); histories.clear(); remotes.clear(); clockOffset = Infinity;
      document.title = `Ducky Land · ${player.name}`;
    } else if (m.type === 'snapshot' && connected) {
      tick = m.tick; snapshots++; quacks = { ...m.quacks }; realCount = m.players.length; botCount = m.bots.length;
      clockOffset = Math.min(clockOffset, now - m.time);
      const all = [...m.players, ...m.bots], ids = new Set(all.map(d => d.id));
      for (const id of histories.keys()) if (!ids.has(id)) { histories.delete(id); remotes.delete(id); }
      for (const d of all) {
        if (d.id === player.id) {
          const prediction = pending.get(d.ack);
          if (prediction) {
            const dx = d.x - prediction.x, dy = d.y - prediction.y;
            if (Math.hypot(dx, dy) > 2) {
              // Preserve movement after the acknowledged packet when reconciling.
              if (walkable(player.x + dx, player.y + dy)) { player.x += dx; player.y += dy; }
              else { player.x = d.x; player.y = d.y; }
              for (const p of pending.values()) { p.x += dx; p.y += dy; }
            }
            for (const n of pending.keys()) if (n <= d.ack) pending.delete(n);
          }
          continue;
        }
        let history = histories.get(d.id);
        if (!history) { history = []; histories.set(d.id, history); remotes.set(d.id, { ...d }); }
        history.push({ ...d, time: m.time });
        if (history.length > 32) history.shift();
      }
    }
  });
  socket.addEventListener('close', e => {
    connected = false; player = null; histories.clear(); remotes.clear(); pending.clear(); keys.clear();
    document.title = e.code === 1013 ? 'Ducky Land · plaza full' : 'Ducky Land · reconnecting';
    if (!stopped) reconnectTimer = setTimeout(connect, e.code === 1013 ? 5000 : 1000);
  });
  socket.addEventListener('error', () => { /* close performs reconnect */ });
}
// Network cadence is separate from rendering and sends only the local real player.
setInterval(() => {
  if (!player || !connected) return;
  const packet = { type: 'state', seq: ++seq, x: player.x, y: player.y, facing: player.facing, action: movement };
  if (send(packet)) { pending.set(seq, { x: player.x, y: player.y }); stateSends++; }
  if (pending.size > 60) pending.delete(pending.keys().next().value);
}, 1000 / HZ);
addEventListener('pagehide', () => { stopped = true; clearTimeout(reconnectTimer); socket?.close(1000, 'Left plaza'); });

function step(dt, now) {
  if (!player || !connected) return;
  let vx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let vy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (vx || vy) player.tapping = false;
  if (!vx && !vy && player.tapping) {
    const dx = player.tx - player.x, dy = player.ty - player.y;
    if (Math.hypot(dx, dy) > 4) { vx = dx; vy = dy; } else player.tapping = false;
  }
  if ((vx || vy) && player.action === 3) emote('dance');
  movement = move(player, vx, vy, dt) ? 1 : 0;
  if (now >= until || player.action < 2) player.action = movement;
}
function write(i, key, val, string = false) {
  if (cache[i][key] === val) return;
  cache[i][key] = val;
  const property = string ? slots[i].string(key) : slots[i].number(key);
  if (property) property.value = val;
}
function sync(now) {
  for (const [id, history] of histories) Object.assign(remotes.get(id), sample(history, now - clockOffset - DELAY));
  drawOrder = [...(player ? [player] : []), ...remotes.values()].sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  for (let i = 0; i < SLOTS; i++) {
    const d = drawOrder[i];
    if (!d) { write(i, 'x', -2000); continue; }
    write(i, 'x', d.x); write(i, 'y', d.y);
    for (const key of ['action', 'facing', 'cap', 'shades', 'acc', 'shoes', 'city']) write(i, key, d[key]);
    write(i, 'isPlayer', d.player ? 1 : 0);
    write(i, 'name', ` ${d.name} `, true);
  }
}
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  step(dt, now); sync(now); requestAnimationFrame(loop);
}
const r = new rive.Rive({
  src: 'ducky-land.riv', canvas, autoplay: true, autoBind: true, artboard: 'Plaza', stateMachines: 'Plaza',
  layout: new rive.Layout({ fit: rive.Fit.Contain, alignment: rive.Alignment.Center }),
  onLoad() {
    r.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio || 1, 2));
    vmi = r.viewModelInstance;
    for (let i = 0; i < SLOTS; i++) { slots.push(vmi.viewModel('slot' + i)); cache.push({}); }
    // Read-only diagnostics for the test and developer console. No on-screen HUD.
    window.game = {
      r, vmi, slots,
      get player() { return player; },
      get ducks() { return drawOrder; },
      inspect: () => ({ connected, self: player ? { ...player } : null,
        realCount, botCount, quacks: { ...quacks }, snapshots, stateSends, tick, hz: HZ, interpolationMs: DELAY,
        ducks: drawOrder.map(d => ({ ...d })),
        histories: [...histories].map(([id, h]) => ({ id, length: h.length, newest: { ...h.at(-1) } })),
        rendered: drawOrder.map((d, i) => ({ id: d.id, name: slots[i].string('name').value,
          x: slots[i].number('x').value, y: slots[i].number('y').value, action: slots[i].number('action').value,
          facing: slots[i].number('facing').value, cap: slots[i].number('cap').value,
          shades: slots[i].number('shades').value, acc: slots[i].number('acc').value, shoes: slots[i].number('shoes').value })) }),
    };
    connect(); requestAnimationFrame(loop);
  },
  onLoadError(error) { document.title = 'Ducky Land · Rive load failed'; console.error(error); },
});
addEventListener('resize', () => r.resizeDrawingSurfaceToCanvas(Math.min(devicePixelRatio || 1, 2)));
