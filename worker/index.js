// boss 6 Nov: every island walks its own map (src/pixi/island-maps.js): home's is the walking map the game uses offline
// (scripts/walk-world.mjs); a themed island's comes from its theme folder, or home's until that theme is delivered
import {randomDrop, sleepPose, navigationWithSleepers} from '../src/pixi/player-presence.js';
import {mapOf} from '../src/pixi/island-maps.js';
import {DURATIONS, playEmote, startJump, separateActors, setWalkDestination, walkStep} from '../src/pixi/player-motion.js';
import {chatText} from '../src/pixi/chat.js';
import {FRIEND_RADIUS} from '../src/pixi/friends.js';
import {islandFor, destinationsFor, harborOf, createBoats, near, canSail, canDock, setSailDestination, sailStep, crossIsland, boardingPoint, landingSpot, landingApproach, fillMoorings, retireBoat} from '../src/pixi/islands.js';

// boss 6 Nov ("room for 100 Duckies on every island, and stalls"): ONE room (this Durable Object) runs all 300 islands, so
// the old 16 was a cap on the whole world. Now each island holds up to ISLAND_LIMIT players, and the room as a whole up to
// PLAYER_LIMIT (scripts/load-room.mjs: 100 walking on one themed island cost ~5-8 ms of each 50 ms tick, see qa/load.test.mjs).
export const ISLAND_LIMIT = 100;
export const PLAYER_LIMIT = 200;
const SPECTATOR_LIMIT = 64;

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
  const {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft=0,islandId='home',mode='walking',boatId=null,exitLocked=false} = actor;
  return {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft,islandId,mode,boatId,exitLocked};
}
// boss 6 Nov (100 Duckies on one island): what goes on the wire each tick. The same pose, with positions to a hundredth of a
// unit and angles to a thousandth (a full double is ~18 digits), so a 100-Ducky snapshot is far smaller. Saved poses keep
// full precision (publicPose).
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
function wirePose(actor) {
  const pose = publicPose(actor);
  pose.x = r2(pose.x); pose.y = r2(pose.y); pose.turn = r3(pose.turn); pose.travel = r2(pose.travel); pose.jumpLeft = r3(pose.jumpLeft);
  return pose;
}
// how many players stand (or sail) on each island right now
const islandCounts = connections => {
  const counts = new Map();
  for (const info of connections.values()) if (info.actor) counts.set(info.actor.islandId, (counts.get(info.actor.islandId) ?? 0) + 1);
  return counts;
};

export class IslandRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.connections = new Map();
    this.sleepers = new Map();
    this.sleepNav = new Map();
    this.savedPlayers = new Map();
    this.tickCount = 0;
    this.epoch = crypto.randomUUID();
    this.sql.exec(`CREATE TABLE IF NOT EXISTS flows (
      state TEXT PRIMARY KEY, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (
      digest TEXT PRIMARY KEY, account TEXT NOT NULL, login TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS resumes (
      account TEXT PRIMARY KEY, pose TEXT NOT NULL, expires INTEGER NOT NULL);`);
    if (!this.sql.exec('PRAGMA table_info(sessions)').toArray().some(column => column.name === 'can_play')) {
      this.sql.exec('ALTER TABLE sessions ADD COLUMN can_play INTEGER NOT NULL DEFAULT 0');
      this.sql.exec('DELETE FROM resumes');
    }
    if (!this.sql.exec('PRAGMA table_info(sessions)').toArray().some(column => column.name === 'github_token')) {
      this.sql.exec('ALTER TABLE sessions ADD COLUMN github_token TEXT');
    }
    this.sql.exec(`CREATE TABLE IF NOT EXISTS accounts (
      account TEXT PRIMARY KEY, login TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS friends (
      owner_account_id TEXT NOT NULL, friend_account_id TEXT NOT NULL, created_at INTEGER NOT NULL,
      PRIMARY KEY (owner_account_id, friend_account_id), CHECK (owner_account_id <> friend_account_id));`);
    this.sql.exec(`INSERT OR IGNORE INTO accounts (account,login)
      SELECT account,login FROM sessions WHERE expires>? ORDER BY expires DESC`, Date.now());
    this.sql.exec('CREATE TABLE IF NOT EXISTS boats (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
    const saved = this.sql.exec('SELECT state FROM boats WHERE id=1').toArray()[0];
    // keep saved boats (position, occupant), then fill every mooring on every island (300 islands, boss 6 Nov: all the boats)
    this.boats = saved ? JSON.parse(saved.state) : createBoats();
    fillMoorings(this.boats);
    this.savedBoats = saved?.state;
    for (const socket of ctx.getWebSockets()) {
      if (socket.readyState !== 1) continue;
      const info = socket.deserializeAttachment();
      if (!info) continue;
      const actor = info.actor && this.session(info.digest)?.canPlay ? {islandId:'home',mode:'walking',boatId:null,...info.actor, action:0, travel:0, path:[], until:0,jumpLeft:0} : null;
      const login = info.login ?? (actor ? this.session(info.digest)?.login : null);
      this.connections.set(socket, {...info, actor, login, input:ZERO, inputExpires:0, tokens:30, tokenTime:Date.now()});
    }
    this.sql.exec(`CREATE TABLE IF NOT EXISTS player_states (
      account TEXT PRIMARY KEY, pose TEXT NOT NULL);
      INSERT OR IGNORE INTO player_states (account,pose) SELECT account,pose FROM resumes;`);
    for (const row of this.sql.exec('SELECT account,pose FROM player_states').toArray()) {
      this.savedPlayers.set(row.account,row.pose);
      this.sleepers.set(row.account,JSON.parse(row.pose));
    }
    for (const info of this.connections.values()) if (info.actor) {
      this.sleepers.delete(info.account);
      this.savePlayer(info);
    }
    this.reconcileBoats();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }

  savePlayer(info) {
    if (!info.account || !info.actor) return;
    const pose=JSON.stringify(publicPose(info.actor));
    if (this.savedPlayers.get(info.account) === pose) return;
    this.sql.exec('INSERT OR REPLACE INTO player_states (account,pose) VALUES(?,?)',info.account,pose);
    this.savedPlayers.set(info.account,pose);
  }

  sleepPlayer(info) {
    if (!info.actor || !info.account) return;
    this.savePlayer(info);
    this.sleepers.set(info.account,publicPose(info.actor));
    this.sleepNav.delete(info.actor.islandId);
  }

  navFor(islandId='home') {
    if (!this.sleepNav.has(islandId)) this.sleepNav.set(islandId,navigationWithSleepers(mapOf(islandId),
      [...this.sleepers.values()].filter(p=>p.islandId===islandId)));
    return this.sleepNav.get(islandId);
  }

  saveBoats() {
    const state=JSON.stringify(this.boats);
    if (state === this.savedBoats) return;
    this.sql.exec('INSERT OR REPLACE INTO boats VALUES(1,?)',state);
    this.savedBoats=state;
  }

  // boss 6 Nov: the sailor stepped off. The boat ties back up if it is still beside its own empty mooring, otherwise it
  // drifts off (the client fades it out); every mooring on every island keeps its boat either way (islands.js fillMoorings)
  parkBoat(boat) {
    retireBoat(this.boats,boat);
    this.saveBoats();
  }

  releaseBoat(actorId) {
    const boat=this.boats.find(boat => boat.occupant === actorId);
    if (boat) this.parkBoat(boat);
  }

  reconcileBoats() {
    const retained=new Set([...this.connections.values()].filter(info => info.actor).map(info => info.actor.id));
    for (const pose of this.sleepers.values()) if (pose.mode === 'sailing') retained.add(pose.id);
    for (const boat of [...this.boats]) if (boat.occupant && !retained.has(boat.occupant)) this.parkBoat(boat);
    this.saveBoats();
  }

  session(digest, now = Date.now()) {
    if (!digest) return null;
    return this.sql.exec('SELECT account, login, expires, can_play AS canPlay, github_token AS githubToken FROM sessions WHERE digest=? AND expires>?', digest, now).toArray()[0] ?? null;
  }

  prune(now) {
    for (const table of ['flows','sessions','resumes']) this.sql.exec(`DELETE FROM ${table} WHERE expires<=?`, now);
    this.reconcileBoats();
  }

  async fetch(request) {
    const {pathname} = new URL(request.url);
    const now = Date.now();
    this.prune(now);
    this.expire(now);
    if (pathname === '/room') return this.join(request, now);
    const data = await request.json();
    if (pathname === '/friends') return this.friends(data, now);
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
      this.sql.exec('INSERT INTO accounts (account,login) VALUES(?,?) ON CONFLICT(account) DO UPDATE SET login=excluded.login',
        data.account, data.login);
      this.sql.exec('UPDATE sessions SET login=? WHERE account=?', data.login, data.account);
      for (const [socket,info] of this.connections) {
        if (info.account === data.account) {info.login=data.login; this.attach(socket,info);}
      }
      this.sql.exec('INSERT INTO sessions (digest,account,login,expires,can_play,github_token) VALUES(?,?,?,?,?,?)',
        data.digest, data.account, data.login, now+SESSION_MS, data.canPlay === true ? 1 : 0, data.githubToken);
      return reply({});
    }
    if (pathname === '/session/access') {
      this.sql.exec('UPDATE sessions SET can_play=? WHERE digest=?', data.canPlay === true ? 1 : 0, data.digest);
      if (!data.canPlay) {
        const user = this.session(data.digest);
        if (user) this.sql.exec('DELETE FROM resumes WHERE account=?',user.account);
        for (const [socket,info] of this.connections) {
          if (info.digest === data.digest && info.actor) this.demote(socket,info,'star-required');
        }
        this.reconcileBoats();
        this.broadcast();
      }
      return reply({});
    }
    if (pathname === '/session/get') return reply(this.session(data.digest));
    if (pathname === '/session/revoke') {
      this.sql.exec('DELETE FROM sessions WHERE digest=?', data.digest);
      for (const [socket, info] of this.connections) {
        if (info.digest === data.digest) this.demote(socket, info, 'signed-out');
      }
      this.reconcileBoats();
      this.broadcast();
      await this.scheduleExpiry();
      return reply({});
    }
    return reply({}, 404);
  }

  friends(data, now) {
    const user = this.session(data.digest, now);
    if (!user) return reply({error:'Please sign in again to manage friends.'}, 401);
    if (data.method === 'GET') {
      const friends = this.sql.exec(`SELECT a.account AS accountId,a.login,f.created_at AS createdAt
        FROM friends f JOIN accounts a ON a.account=f.friend_account_id
        WHERE f.owner_account_id=? ORDER BY f.created_at DESC,f.friend_account_id`, user.account).toArray();
      return reply({friends});
    }
    let friend;
    if (data.method === 'POST') {
      if (typeof data.playerId !== 'string' || data.playerId.length > 64) return reply({error:'Invalid player.'},400);
      const entries = [...this.connections.entries()].filter(([socket,info]) =>
        socket.readyState === 1 && info.actor && info.expires > now);
      const owner = entries.find(([,info]) => info.account === user.account)?.[1];
      const target = entries.find(([,info]) => info.actor.id === data.playerId)?.[1];
      if (!owner || !user.canPlay) return reply({error:'Join the island to add a friend.'},403);
      if (!target) return reply({error:'That player has left the island.'},409);
      if (target.account === user.account) return reply({error:'You cannot add yourself.'},400);
      if (owner.actor.islandId !== target.actor.islandId || !near(owner.actor,target.actor,FRIEND_RADIUS)) {
        return reply({error:'That player moved away. Walk closer and try again.'},409);
      }
      this.sql.exec(`INSERT INTO friends (owner_account_id,friend_account_id,created_at) VALUES(?,?,?)
        ON CONFLICT(owner_account_id,friend_account_id) DO NOTHING`, user.account,target.account,now);
      friend = this.sql.exec(`SELECT a.account AS accountId,a.login,f.created_at AS createdAt
        FROM friends f JOIN accounts a ON a.account=f.friend_account_id
        WHERE f.owner_account_id=? AND f.friend_account_id=?`,user.account,target.account).one();
    } else if (data.method === 'DELETE') {
      if (typeof data.accountId !== 'string' || !/^[1-9][0-9]*$/.test(data.accountId) || data.accountId.length > 32) {
        return reply({error:'Invalid friend.'},400);
      }
      this.sql.exec('DELETE FROM friends WHERE owner_account_id=? AND friend_account_id=?',user.account,data.accountId);
    } else return reply({error:'Method not allowed.'},405);
    for (const [socket,info] of this.connections) {
      if (info.account === user.account && info.digest && info.expires > now) this.send(socket,{type:'friends-changed'});
    }
    return reply(friend ? {friend} : {});
  }

  newArrival(counts) {
    return randomDrop({counts,limit:ISLAND_LIMIT,
      occupied:[...this.sleepers.values(), ...[...this.connections.values()].flatMap(i=>i.actor?[i.actor]:[])]});
  }

  join(request, now) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply({}, 426);
    const digest = request.headers.get('X-Session-Digest');
    const user = this.session(digest, now);
    const wantsPlayer = new URL(request.url).searchParams.get('play') === '1';
    const previous = user && [...this.connections].find(([,info]) => info.actor && info.account === user.account);
    const saved = user && this.savedPlayers.get(user.account);
    const from = previous?.[1].actor ?? (saved ? JSON.parse(saved) : null);
    const active = [...this.connections.values()].filter(info => info.actor).length;
    const counts = islandCounts(this.connections);
    const drop = user?.canPlay && wantsPlayer && !from && active < PLAYER_LIMIT ? this.newArrival(counts) : null;
    const room = previous || (active < PLAYER_LIMIT && (from ? (counts.get(from.islandId) ?? 0)<ISLAND_LIMIT : !!drop));
    const playing = !!(user?.canPlay && wantsPlayer && room);
    const spectators = this.connections.size-active;
    const [client, socket] = Object.values(new WebSocketPair());
    if (!playing && spectators >= SPECTATOR_LIMIT) {
      socket.accept();
      this.send(socket, {type:'welcome', id:null, reason:'spectators-full'});
      socket.close(1013, 'Live view full');
      return new Response(null,{status:101,webSocket:client});
    }
    const info = {actor:null, digest:user ? digest : null, account:user?.account, expires:user?.expires, login:user?.login,
      input:ZERO, inputExpires:0, tokens:30, tokenTime:now, ack:0, lastDestination:-Infinity, lastEmote:-Infinity, islandId:from?.islandId ?? 'home'};
    if (playing) {
      info.actor = {id:crypto.randomUUID(),turn:0,outfit:outfitFor(user.account),emoteVersion:0,
        mode:'walking',boatId:null,...(from ?? drop), action:0,travel:0,until:0,path:[],jumpLeft:0};
      this.sleepers.delete(user.account);
      this.sleepNav.delete(info.actor.islandId);
      // Only a changed map can invalidate a saved location. A normal wake keeps
      // full-precision coordinates, including museum and jetty positions.
      if (info.actor.mode === 'walking' && !mapOf(info.actor.islandId).nav().walkable(info.actor.x,info.actor.y)) {
        const map=mapOf(info.actor.islandId), point=this.navFor(info.actor.islandId).nearest(info.actor.x,info.actor.y,1000);
        Object.assign(info.actor,point ? {x:point[0],y:point[1]} : map.spawn);
      }
      this.sql.exec('DELETE FROM resumes WHERE account=?', user.account);
      if (previous) this.demote(previous[0], previous[1], 'taken-over');
    }
    this.ctx.acceptWebSocket(socket);
    this.connections.set(socket, info);
    this.attach(socket, info);
    this.send(socket, {type:'welcome', id:info.actor?.id ?? null,
      reason:user && wantsPlayer && !user.canPlay ? 'star-required' : user && wantsPlayer && !playing ? 'players-full' : null});
    if (playing && !previous && !saved) {
      for (const [viewer,viewerInfo] of this.connections) {
        if (viewer === socket || viewerInfo.account === user.account) continue;
        if ((viewerInfo.actor?.islandId ?? viewerInfo.islandId ?? 'home') !== info.actor.islandId) continue;
        this.send(viewer,{type:'joined',id:info.actor.id,
          ...(viewerInfo.digest && viewerInfo.expires > now ? {login:user.login} : {})});
      }
    }
    this.broadcast();
    this.ctx.waitUntil(this.scheduleExpiry());
    return new Response(null, {status:101, webSocket:client});
  }

  attach(socket, info) {
    const {actor,account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId} = info;
    this.savePlayer(info);
    socket.serializeAttachment({actor:actor ? publicPose(actor) : null, account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId});
  }

  send(socket, message) {
    if (socket.readyState !== 1) return;
    try { socket.send(JSON.stringify(message)); } catch { socket.close(1011, 'Connection lost'); }
  }

  // boss 6 Nov (100 Duckies on one island): each island's players and boats are turned into text ONCE per tick (once for
  // signed-in viewers, once for guests); a viewer's message is that shared text plus its own few fields. The message is the
  // same JSON as before, field for field.
  broadcast() {
    const now = Date.now();
    const online = new Set([...this.connections].map(([socket,info]) =>
      info.account && info.expires > now ? info.account : socket)).size;
    const tick = ++this.tickCount;
    const groups = new Map();
    for (const info of this.connections.values()) {
      if (!info.actor) continue;
      const islandId = info.actor.islandId, pose = wirePose(info.actor);
      if (!groups.has(islandId)) groups.set(islandId, {guests:[], named:[]});
      const group = groups.get(islandId);
      group.guests.push(pose); group.named.push({...pose, login:info.login, accountId:info.account});
    }
    const sleeping = new Map();
    for (const pose of this.sleepers.values()) {
      if (!sleeping.has(pose.islandId)) sleeping.set(pose.islandId,[]);
      sleeping.get(pose.islandId).push(sleepPose(pose));
    }
    const shared = new Map(), empty = {guests:[], named:[]};
    const text = (islandId, named) => {
      const key = `${named ? 1 : 0}|${islandId}`;
      if (!shared.has(key)) {
        const group = groups.get(islandId) ?? empty;
        shared.set(key, `{"type":"snapshot","epoch":${JSON.stringify(this.epoch)},"tick":${tick},"online":${online},"islandId":${JSON.stringify(islandId)},"boats":${JSON.stringify(this.boats.filter(boat => boat.islandId === islandId))},"players":${JSON.stringify(named ? group.named : group.guests)},"sleepers":${JSON.stringify(sleeping.get(islandId) ?? [])},"self":`);
      }
      return shared.get(key);
    };
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      const islandId = actor?.islandId ?? info.islandId ?? 'home';
      const self = actor ? JSON.stringify({ack:info.ack, path:actor.path, sailTarget:actor.sailTarget ?? null, docking:!!actor.docking, emoteLeft:Math.max(0,actor.until-now/1000)}) : 'null';
      this.sendText(socket, text(islandId, !!(info.digest && info.expires > now)) + self + '}');
    }
  }

  sendText(socket, text) {
    if (socket.readyState !== 1) return;
    try { socket.send(text); } catch { socket.close(1011, 'Connection lost'); }
  }

  demote(socket, info, reason) {
    const wasPlayer = !!info.actor;
    if (info.actor && reason !== 'taken-over') this.sleepPlayer(info);
    info.islandId = info.actor?.islandId ?? info.islandId ?? 'home';
    info.actor = null;
    info.input = ZERO;
    if (!['taken-over','star-required'].includes(reason)) {
      info.digest = null;
      info.account = null;
      info.expires = null;
      info.login = null;
    }
    const spectators = [...this.connections.values()].filter(entry => !entry.actor).length;
    if (wasPlayer && spectators > SPECTATOR_LIMIT) {
      this.send(socket, {type:'role', reason, id:null});
      this.connections.delete(socket);
      socket.close(4001, reason);
      return;
    }
    this.attach(socket, info);
    // Publish the sleeping pose before telling this socket it became a viewer.
    // Clients handling the role event must already have authoritative presence.
    if (wasPlayer) this.broadcast();
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
    this.broadcast();
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
    let command;
    try { command = JSON.parse(message); } catch { return; }
    if (command?.type === 'watch' && !info.actor && islandFor(command.islandId)) {
      info.islandId = command.islandId;
      this.attach(socket,info);
      this.broadcast();
      return;
    }
    if (!info.actor) return;
    if (command?.type === 'chat') {
      const text = chatText(command.text);
      if (text === null || now - (info.lastChat ?? -Infinity) < 100) return;
      info.lastChat = now;
      const event = {type:'chat', id:info.actor.id, text};
      for (const [peer, viewer] of this.connections) {
        if (viewer.digest && viewer.expires > now && (viewer.actor?.islandId ?? viewer.islandId ?? 'home') === info.actor.islandId) this.send(peer, event);
      }
      return;
    }
    if (!command || !Number.isSafeInteger(command.seq) || command.seq <= info.ack) return;
    const actor = info.actor;
    if (command.islandId && command.islandId !== actor.islandId) {
      info.ack=command.seq; this.attach(socket,info); this.broadcast(); return;
    }
    switch (command.type) {
      case 'jump':
        startJump(actor);
        break;
      case 'input':
        if (![-1,0,1].includes(command.x) || ![-1,0,1].includes(command.y)) return;
        if (command.x || command.y) {info.boarding = null; info.landing = null;}   // steering away cancels a dock
        else if (command.stop === true) info.boarding = null;
        // boss 5 Nov: a stop from the window losing focus must not strand a Ducky in a boat that is sailing in to land
        if (command.stop === true && !info.landing) {actor.path=[];actor.sailTarget=null;actor.docking=false;actor.pace=0;actor.heading=null;}
        info.input = {x:command.x,y:command.y,run:command.run === true};   // boss 6 Nov: Shift runs; the speed itself is capped in walkStep
        info.inputExpires = now+350;
        break;
      case 'destination':
        if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) return;
        if (actor.mode === 'sailing' ? !canSail(command.x,command.y,actor.islandId)
          : command.x<0 || command.y<0 || command.x>=mapOf(actor.islandId).width || command.y>=mapOf(actor.islandId).height) return;
        if (now-info.lastDestination >= 400) {
          info.lastDestination = now;
          info.input = ZERO;
          info.boarding = null;
          info.landing = null;   // a new course cancels a dock in progress
          if (actor.mode === 'sailing') setSailDestination(actor,command.x,command.y);
          else setWalkDestination(actor, this.navFor(actor.islandId), command.x, command.y);
        }
        break;
      case 'board': {
        if (actor.mode !== 'walking' || typeof command.boatId !== 'string') break;
        info.boarding=null; actor.path=[]; info.input=ZERO;
        const boat = this.boats.find(boat => boat.id === command.boatId && boat.islandId === actor.islandId);
        if (!boat || boat.occupant) {   // boss 5 Nov: any boat, wherever it is moored
          this.send(socket,{type:'travel-notice',text:'Boat taken.'});
          break;
        }
        info.input=ZERO;
        const nav=this.navFor(actor.islandId), deck=boardingPoint(boat,nav);   // the jetty deck beside a harbor boat, or the nearest sand for a beach or islet boat
        if (near(actor,deck,45) || setWalkDestination(actor,nav,deck.x,deck.y)) info.boarding=boat.id;
        break;
      }
      case 'disembark':
        if (actor.mode === 'sailing') {
          info.input=ZERO; info.landing=null;
          if (canDock(actor)) {const {water}=harborOf(actor.islandId); setSailDestination(actor,water.x,water.y); actor.docking=true; break;}   // at the harbor: sail in to the jetty
          // boss 5 Nov: anywhere else, hop out onto the nearest shore within reach (this island's or a neighbour's)
          const spot=landingSpot(actor,this.navFor(actor.islandId));
          if (!spot) {this.send(socket,{type:'travel-notice',text:'Sail closer to the shore to dock.'}); break;}
          if (spot.islandId !== actor.islandId && (islandCounts(this.connections).get(spot.islandId) ?? 0) >= ISLAND_LIMIT) {this.send(socket,{type:'travel-notice',text:`That island is full (${ISLAND_LIMIT} Duckies). Try another one.`}); break;}
          // boss 5 Nov ("dock fix"): sail in to the water beside the sand first; the hop out happens when the boat arrives
          spot.approach=landingApproach(actor,spot);
          info.landing=spot;
          // no open-water route to that water (or already there): hop out from where the boat is now instead of waiting forever
          if (!near(actor,spot.approach,14) && !setSailDestination(actor,spot.approach.x,spot.approach.y)) info.landing={...spot,approach:{x:actor.x,y:actor.y}};
        }
        break;
      case 'emote':
        if (actor.mode === 'sailing') break;
        info.boarding=null;
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
    const counts = islandCounts(this.connections), roomOn = id => (counts.get(id) ?? 0) < ISLAND_LIMIT;
    const full = (socket, info) => {   // told once a minute at most, so a boat waiting at a full harbor does not spam
      if (now-(info.fullNotice ?? -Infinity) < 60_000) return;
      info.fullNotice = now; this.send(socket,{type:'travel-notice',text:`That island is full (${ISLAND_LIMIT} Duckies). Try another one.`});
    };
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      if (!actor) continue;
      if (now >= info.inputExpires) info.input = ZERO;
      if (actor.mode === 'sailing') {
        sailStep(actor,.05,info.input);
        const boat=this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
        if (!boat) info.landing=null;   // the boat is gone (released or restored): nothing to sail in
        if (boat) {
          const from=actor.islandId;
          if (crossIsland(actor,roomOn)) {info.input=ZERO; info.inputExpires=0; info.landing=null; counts.set(from,(counts.get(from) ?? 1)-1); counts.set(actor.islandId,(counts.get(actor.islandId) ?? 0)+1);}   // sailed into a neighbour's harbor: its jetty docking takes over
          else if (destinationsFor(actor.islandId).some(d => !roomOn(d.destination) && Math.abs(actor.x-d.dock.x)<=65 && Math.abs(actor.y-d.dock.y)<=50)) full(socket,info);   // waiting at a full island's harbor mouth
          Object.assign(boat,{x:actor.x,y:actor.y,turn:actor.turn,islandId:actor.islandId});
          if (info.landing && (near(actor,info.landing.approach,14) || !actor.sailTarget)) {   // reached the shore: hop out onto the sand
            const spot=info.landing; info.landing=null;
            if (spot.islandId !== actor.islandId && !roomOn(spot.islandId)) {full(socket,info); actor.sailTarget=null; actor.sailRoute=null;}   // that island filled up while you sailed in: stay aboard
            else {
            if (spot.islandId !== actor.islandId) {counts.set(actor.islandId,(counts.get(actor.islandId) ?? 1)-1); counts.set(spot.islandId,(counts.get(spot.islandId) ?? 0)+1); actor.islandId=spot.islandId; actor.x-=spot.offset.x; actor.y-=spot.offset.y; info.islandId=spot.islandId;}
            this.parkBoat(boat);   // boss 6 Nov: the boat drifts off and fades; the moorings here stay full
            Object.assign(actor,{x:spot.x,y:spot.y,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null,sailRoute:null});
            info.input=ZERO;
            }
          } else if (actor.docking && near(actor,harborOf(actor.islandId).water,12)) {
            this.parkBoat(boat);   // boss 6 Nov: it ties back up beside its own empty mooring, or drifts off; no island runs out
            Object.assign(actor,{...harborOf(actor.islandId).land,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null});
            info.input=ZERO;
          }
        }
      } else {
        info.landing=null;
        const nav=this.navFor(actor.islandId);
        walkStep(actor, nav, .05, now/1000, info.input);
        const boat=info.boarding && this.boats.find(boat => boat.id === info.boarding && boat.islandId === actor.islandId);
        const aboard=boat && near(actor,boardingPoint(boat,nav),45);   // boss 5 Nov: step in from the deck beside the boat (the jetty end for the tip berths)
        if (info.boarding && (aboard || !actor.path.length)) {
          info.boarding=null;
          actor.path=[];
          if (!aboard || boat.occupant) this.send(socket,{type:'travel-notice',text:'Boat taken.'});
          else {
            boat.occupant=actor.id; boat.departure=actor.islandId;
            Object.assign(actor,{x:boat.x,y:boat.y,turn:boat.turn,mode:'sailing',boatId:boat.id,action:0,until:0,travel:0,pace:0,heading:null,sailTarget:null,exitLocked:false,jumpLeft:0});
            info.input=ZERO;
          }
        }
      }
      active ||= !!(info.input.x || info.input.y || actor.travel || actor.path.length || actor.sailTarget || info.boarding || info.landing || actor.jumpLeft > 0 || actor.until > now/1000);
    }
    const walking = new Map();   // boss 6 Nov: each island's walkers, gathered in one pass (was 300 passes over every player)
    for (const info of this.connections.values()) {
      const actor = info.actor;
      if (actor?.mode !== 'walking') continue;
      if (!walking.has(actor.islandId)) walking.set(actor.islandId, []);
      walking.get(actor.islandId).push(actor);
    }
    for (const [islandId, walkers] of walking) if (walkers.length > 1 && separateActors(walkers,this.navFor(islandId),.05)) active=true;
    for (const [socket,info] of this.connections) if (info.actor) this.attach(socket,info);
    // a sailor clear of the jetty leaves a fresh boat at the mooring (boss 6 Nov); with nobody sailing no boat moves, so the
    // 1,800 boats are only re-checked and re-saved while someone is aboard
    if (this.boats.some(boat => boat.occupant) || this.boatsDirty) {
      this.boatsDirty = false;
      if (fillMoorings(this.boats)) active=true;
      this.saveBoats();
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
    this.sleepPlayer(info);
    this.broadcast();
    this.ctx.waitUntil(this.scheduleExpiry());
  }

  webSocketError(socket) {
    this.webSocketClose(socket);
    socket.close(1011, 'Connection lost');
  }
}

export default {fetch:() => new Response('Not found', {status:404})};
