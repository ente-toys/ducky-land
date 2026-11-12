import {DatabaseSync} from 'node:sqlite';

globalThis.WebSocketRequestResponsePair ??= class {constructor(request, response) {this.request = request; this.response = response;}};

function fakeStorage() {
  const db = new DatabaseSync(':memory:');
  const cursor = rows => ({toArray: () => rows, one: () => rows[0], [Symbol.iterator]: () => rows[Symbol.iterator]()});
  return {
    sql: {exec(query, ...binds) {
      const q = query.trim();
      if (/^(SELECT|PRAGMA)/i.test(q) || /RETURNING/i.test(q)) return cursor(db.prepare(q).all(...binds).map(row => ({...row})));
      if (!binds.length) {db.exec(q); return cursor([]);}
      db.prepare(q).run(...binds); return cursor([]);
    }},
    setAlarm: async () => {}, deleteAlarm: async () => {},
  };
}

export function fakeSocket() {
  const socket = {readyState: 1, sent: 0, bytes: 0, last: null, attachments: 0, notes: [],
    send(data) {socket.sent++; socket.bytes += data.length; if (data.startsWith('{"type":"snapshot"')) socket.last = data; else socket.notes.push(JSON.parse(data));},
    serializeAttachment() {socket.attachments++;}, deserializeAttachment: () => null, close() {socket.readyState = 3;}};
  return socket;
}

export async function makeRoom() {
  const {IslandRoom} = await import('../worker/index.js');
  const ctx = {storage: fakeStorage(), getWebSockets: () => [], setWebSocketAutoResponse() {}, acceptWebSocket() {}, waitUntil() {}};
  const room = new IslandRoom(ctx);
  return room;
}

export function addPlayer(room, n, {islandId = 'home', x, y, mode = 'walking'} = {}) {
  const account = `load-${n}`, now = Date.now();
  room.sql.exec('INSERT OR REPLACE INTO sessions (digest,account,login,expires,can_play,github_token) VALUES(?,?,?,?,1,?)', account, account, account, now + 86400000, 'fixture');
  const socket = fakeSocket();
  const actor = {id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, x, y, turn: 0, outfit: {cap: 1 + n % 13, shades: n % 4, acc: n % 9, shoes: 1 + n % 10},
    emoteVersion: 0, islandId, mode, boatId: null, action: 0, travel: 0, until: 0, path: [], jumpLeft: 0};
  room.connections.set(socket, {actor, digest: account, account, expires: now + 86400000, login: account, input: {x: 0, y: 0}, inputExpires: 0,
    tokens: 30, tokenTime: now, ack: 0, lastDestination: -Infinity, lastEmote: -Infinity, islandId});
  return {socket, actor, account, seq: 0};
}

export function wander(room, players, nav, rnd, {spawn, radius = 1400} = {}) {
  for (const p of players) {
    if (rnd() > .025) continue;
    for (let k = 0; k < 8; k++) {
      const x = spawn.x + (rnd() * 2 - 1) * radius, y = spawn.y + (rnd() * 2 - 1) * radius * .7;
      if (!nav.walkable(x, y)) continue;
      p.lastSent = Date.now();
      const info = room.connections.get(p.socket); info.lastDestination = -Infinity;
      room.webSocketMessage(p.socket, JSON.stringify({type: 'destination', seq: ++p.seq, x, y}));
      break;
    }
  }
}

export function seeded(seed = 7) {let n = seed >>> 0; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);}
