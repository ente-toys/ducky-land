import world from '../rive/web/world.json';
import {createNavigation} from '../src/pixi/navigation.js';
import {DURATIONS, playEmote, setWalkDestination, walkStep} from '../src/pixi/player-motion.js';

const nav = createNavigation(world);
const PLAYER_LIMIT = 16;
const SPECTATOR_LIMIT = 64;
const RESUME_MS = 15_000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const FLOW_MS = 10 * 60 * 1000;
const ZERO = {x:0,y:0};

function reply(data, status = 200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
}

function outfitFor(id) {
  let seed = 2166136261;
  for (const digit of id) seed = Math.imul(seed ^ digit.charCodeAt(0), 16777619) >>> 0;
  return {cap:1+seed%13, shades:(seed>>>4)%4, acc:(seed>>>8)%9, shoes:1+(seed>>>12)%10};
}

function publicPose(actor) {
  const {id,x,y,turn,travel,action,emoteVersion,outfit} = actor;
  return {id,x,y,turn,travel,action,emoteVersion,outfit};
}

export class IslandRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.connections = new Map();
    this.tickCount = 0;
    this.epoch = crypto.randomUUID();
    this.sql.exec(`CREATE TABLE IF NOT EXISTS flows (
      state TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (
      digest TEXT PRIMARY KEY, account TEXT NOT NULL, login TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS resumes (
      account TEXT PRIMARY KEY, pose TEXT NOT NULL, expires INTEGER NOT NULL);`);
    for (const socket of ctx.getWebSockets()) {
      if (socket.readyState !== 1) continue;
      const info = socket.deserializeAttachment();
      if (!info) continue;
      const actor = info.actor && {...info.actor, action:0, travel:0, path:[], until:0};
      this.connections.set(socket, {...info, actor, input:ZERO, inputExpires:0, tokens:30, tokenTime:Date.now()});
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }

  session(digest, now = Date.now()) {
    if (!digest) return null;
    return this.sql.exec('SELECT account, login, expires FROM sessions WHERE digest=? AND expires>?', digest, now).toArray()[0] ?? null;
  }

  prune(now) {
    for (const table of ['flows','sessions','resumes']) this.sql.exec(`DELETE FROM ${table} WHERE expires<=?`, now);
  }

  async fetch(request) {
    const {pathname} = new URL(request.url);
    const now = Date.now();
    this.prune(now);
    this.expire(now);
    if (pathname === '/room') return this.join(request, now);
    const data = await request.json();
    if (pathname === '/flow') {
      if (data.previous) this.sql.exec('DELETE FROM flows WHERE state=?', data.previous);
      if (this.sql.exec('SELECT count(*) AS count FROM flows').one().count >= 256) return reply({}, 429);
      this.sql.exec('INSERT INTO flows VALUES(?,?,?)', data.state, data.verifier, now+FLOW_MS);
      return reply({});
    }
    if (pathname === '/consume') {
      const flow = this.sql.exec('DELETE FROM flows WHERE state=? AND expires>? RETURNING verifier', data.state, now).toArray()[0];
      return flow ? reply(flow) : reply({}, 404);
    }
    if (pathname === '/session/new') {
      this.sql.exec('INSERT INTO sessions VALUES(?,?,?,?)', data.digest, data.account, data.login, now+SESSION_MS);
      return reply({});
    }
    if (pathname === '/session/get') return reply(this.session(data.digest));
    if (pathname === '/session/revoke') {
      this.sql.exec('DELETE FROM sessions WHERE digest=?', data.digest);
      for (const [socket, info] of this.connections) {
        if (info.digest === data.digest) this.demote(socket, info, 'signed-out');
      }
      this.broadcast();
      await this.scheduleExpiry();
      return reply({});
    }
    return reply({}, 404);
  }

  join(request, now) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply({}, 426);
    const digest = request.headers.get('X-Session-Digest');
    const user = this.session(digest, now);
    const wantsPlayer = new URL(request.url).searchParams.get('play') === '1';
    const previous = user && [...this.connections].find(([,info]) => info.actor && info.account === user.account);
    const resume = user && this.sql.exec('SELECT pose FROM resumes WHERE account=? AND expires>?', user.account, now).toArray()[0];
    const active = [...this.connections.values()].filter(info => info.actor).length;
    const held = this.sql.exec('SELECT count(*) AS count FROM resumes WHERE expires>?', now).one().count;
    const playing = !!(user && wantsPlayer && (previous || resume || active+held < PLAYER_LIMIT));
    const spectators = this.connections.size-active;
    const [client, socket] = Object.values(new WebSocketPair());
    if (!playing && spectators >= SPECTATOR_LIMIT) {
      socket.accept();
      this.send(socket, {type:'welcome', id:null, reason:'spectators-full'});
      socket.close(1013, 'Live view full');
      return new Response(null,{status:101,webSocket:client});
    }
    const info = {actor:null, digest:user ? digest : null, account:user?.account, expires:user?.expires,
      input:ZERO, inputExpires:0, tokens:30, tokenTime:now, ack:0, lastDestination:-Infinity, lastEmote:-Infinity};
    if (playing) {
      const from = previous?.[1].actor ?? (resume ? JSON.parse(resume.pose) : null);
      const [x,y] = world.zones.plaza.spawn;
      info.actor = {id:crypto.randomUUID(), x,y,turn:0,outfit:outfitFor(user.account),emoteVersion:0,
        ...from, action:0,travel:0,until:0,path:[]};
      this.sql.exec('DELETE FROM resumes WHERE account=?', user.account);
      if (previous) this.demote(previous[0], previous[1], 'taken-over');
    }
    this.ctx.acceptWebSocket(socket);
    this.connections.set(socket, info);
    this.attach(socket, info);
    this.send(socket, {type:'welcome', id:info.actor?.id ?? null,
      reason:user && wantsPlayer && !playing ? 'players-full' : null});
    this.broadcast();
    this.ctx.waitUntil(this.scheduleExpiry());
    return new Response(null, {status:101, webSocket:client});
  }

  attach(socket, info) {
    const {actor,account,digest,expires,ack,lastDestination,lastEmote,tokens,tokenTime} = info;
    socket.serializeAttachment({actor:actor ? publicPose(actor) : null, account,digest,expires,ack,lastDestination,lastEmote,tokens,tokenTime});
  }

  send(socket, message) {
    if (socket.readyState !== 1) return;
    try { socket.send(JSON.stringify(message)); } catch { socket.close(1011, 'Connection lost'); }
  }

  broadcast() {
    const players = [...this.connections.values()].filter(info => info.actor).map(info => publicPose(info.actor));
    const tick = ++this.tickCount;
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      this.send(socket, {type:'snapshot', epoch:this.epoch, tick, players, self:actor ? {
        ack:info.ack, path:actor.path, emoteLeft:Math.max(0,actor.until-Date.now()/1000),
      } : null});
    }
  }

  demote(socket, info, reason) {
    const wasPlayer = !!info.actor;
    info.actor = null;
    info.input = ZERO;
    if (reason !== 'taken-over') {
      info.digest = null;
      info.account = null;
      info.expires = null;
    }
    const spectators = [...this.connections.values()].filter(entry => !entry.actor).length;
    if (wasPlayer && spectators > SPECTATOR_LIMIT) {
      this.send(socket, {type:'role', reason, id:null});
      this.connections.delete(socket);
      socket.close(4001, reason);
      return;
    }
    this.attach(socket, info);
    this.send(socket, {type:'role', reason, id:null});
  }

  expire(now) {
    let changed = false;
    for (const [socket, info] of this.connections) {
      if (info.expires && info.expires <= now) {
        this.demote(socket, info, 'expired');
        changed = true;
      }
    }
    if (changed) this.broadcast();
  }

  async scheduleExpiry() {
    const expires = Math.min(...[...this.connections.values()].map(info => info.expires || Infinity));
    const resume = this.sql.exec('SELECT min(expires) AS next FROM resumes').one().next;
    const next = Math.min(expires, resume ?? Infinity);
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
    else await this.ctx.storage.deleteAlarm();
  }

  async alarm() {
    const now = Date.now();
    this.prune(now);
    this.expire(now);
    await this.scheduleExpiry();
  }

  webSocketMessage(socket, message) {
    const info = this.connections.get(socket);
    if (!info) return;
    const now = Date.now();
    if (info.expires && now >= info.expires) {
      this.expire(now);
      this.ctx.waitUntil(this.scheduleExpiry());
      return;
    }
    info.tokens = Math.min(30, info.tokens + (now-info.tokenTime)*.024) - 1;
    info.tokenTime = now;
    if (info.tokens < 0 || typeof message !== 'string' || message.length > 512) {
      socket.close(1008, 'Invalid or excessive commands');
      return;
    }
    if (!info.actor) return; // Spectators have no gameplay authority.
    let command;
    try { command = JSON.parse(message); } catch { return; }
    if (!command || !Number.isSafeInteger(command.seq) || command.seq <= info.ack) return;
    const actor = info.actor;
    switch (command.type) {
      case 'input':
        if (![-1,0,1].includes(command.x) || ![-1,0,1].includes(command.y)) return;
        info.input = {x:command.x,y:command.y};
        info.inputExpires = now+350;
        break;
      case 'destination':
        if (!Number.isFinite(command.x) || !Number.isFinite(command.y) ||
            command.x < 0 || command.y < 0 || command.x >= world.width || command.y >= world.height) return;
        if (now-info.lastDestination >= 400) {
          info.lastDestination = now;
          info.input = ZERO;
          setWalkDestination(actor, nav, command.x, command.y);
        }
        break;
      case 'emote':
        if (!Number.isInteger(command.action) || !Object.hasOwn(DURATIONS, command.action)) return;
        if (now-info.lastEmote >= 300 || (command.action === 3 && actor.action === 2)) {
          info.lastEmote = now;
          playEmote(actor, command.action, now/1000);
        }
        break;
      default:
        return;
    }
    info.ack = command.seq;
    this.attach(socket, info);
    // The tick acknowledges every valid command, including rejected cooldown repeats.
    if (!this.timer) this.timer = setInterval(() => this.step(),50);
  }

  step() {
    const now = Date.now();
    let active = false;
    this.expire(now);
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      if (!actor) continue;
      if (now >= info.inputExpires) info.input = ZERO;
      walkStep(actor, nav, .05, now/1000, info.input);
      active ||= !!(info.input.x || info.input.y || actor.travel || actor.path.length || actor.until > now/1000);
      this.attach(socket, info);
    }
    this.stepCount = (this.stepCount ?? 0)+1;
    if (!active || this.stepCount % 2 === 0) this.broadcast();
    if (!active) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  webSocketClose(socket) {
    const info = this.connections.get(socket);
    if (!info) return;
    this.connections.delete(socket);
    if (info.actor) {
      const now = Date.now();
      if (this.session(info.digest,now)) {
        this.sql.exec('INSERT OR REPLACE INTO resumes VALUES(?,?,?)',
          info.account, JSON.stringify(publicPose(info.actor)), now+RESUME_MS);
      }
      this.broadcast();
    }
    this.ctx.waitUntil(this.scheduleExpiry());
  }

  webSocketError(socket) {
    this.webSocketClose(socket);
    socket.close(1011, 'Connection lost');
  }
}

export default {fetch:() => new Response('Not found', {status:404})};
