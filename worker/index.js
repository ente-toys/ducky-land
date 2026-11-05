import world from '../rive/web/world.json';
import walkWorld from '../rive/web/walk-world.json';   // boss 5 Nov: the same walking map the game uses offline (scripts/walk-world.mjs)
import {createNavigation} from '../src/pixi/navigation.js';
import {DURATIONS, playEmote, startJump, separateActors, setWalkDestination, walkStep} from '../src/pixi/player-motion.js';
import {chatText} from '../src/pixi/chat.js';
import {FRIEND_RADIUS} from '../src/pixi/friends.js';
import {ISLANDS, islandFor, HARBOR, createBoats, near, canSail, canDock, setSailDestination, sailStep, crossIsland, boardingPoint, landingSpot, boatHome, boatSpot} from '../src/pixi/islands.js';

const nav = createNavigation({...world, ...walkWorld});
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
  const {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft=0,islandId='home',mode='walking',boatId=null,exitLocked=false} = actor;
  return {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft,islandId,mode,boatId,exitLocked};
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
    // keep saved boats (position, occupant) that still exist, and add any the world now has that the save lacks (300 islands)
    const fresh = createBoats(), known = new Set(fresh.map(boat => boat.id));
    const kept = saved ? JSON.parse(saved.state).filter(boat => known.has(boat.id)) : [], have = new Set(kept.map(boat => boat.id));
    this.boats = [...kept, ...fresh.filter(boat => !have.has(boat.id))];
    this.savedBoats = saved?.state;
    for (const socket of ctx.getWebSockets()) {
      if (socket.readyState !== 1) continue;
      const info = socket.deserializeAttachment();
      if (!info) continue;
      const actor = info.actor && this.session(info.digest)?.canPlay ? {islandId:'home',mode:'walking',boatId:null,...info.actor, action:0, travel:0, path:[], until:0,jumpLeft:0} : null;
      const login = info.login ?? (actor ? this.session(info.digest)?.login : null);
      this.connections.set(socket, {...info, actor, login, input:ZERO, inputExpires:0, tokens:30, tokenTime:Date.now()});
    }
    this.reconcileBoats();
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }

  saveBoats() {
    const state=JSON.stringify(this.boats);
    if (state === this.savedBoats) return;
    this.sql.exec('INSERT OR REPLACE INTO boats VALUES(1,?)',state);
    this.savedBoats=state;
  }

  // boss 5 Nov: a boat goes back to its own mooring spot on its own island (the harbor berth, islet or beach it came from)
  parkBoat(boat) {
    const islandId=boatHome(boat), spot=boatSpot(boat);
    Object.assign(boat,{x:spot.x,y:spot.y,islandId,turn:spot.turn,occupant:null,departure:islandId});
    this.saveBoats();
  }

  releaseBoat(actorId) {
    const boat=this.boats.find(boat => boat.occupant === actorId);
    if (boat) this.parkBoat(boat);
  }

  reconcileBoats() {
    const retained=new Set([...this.connections.values()].filter(info => info.actor).map(info => info.actor.id));
    for (const row of this.sql.exec('SELECT r.pose FROM resumes r JOIN sessions s ON s.account=r.account WHERE r.expires>? AND s.expires>? AND s.can_play=1',Date.now(),Date.now()).toArray()) retained.add(JSON.parse(row.pose).id);
    for (const boat of this.boats) if (boat.occupant && !retained.has(boat.occupant)) this.parkBoat(boat);
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

  join(request, now) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply({}, 426);
    const digest = request.headers.get('X-Session-Digest');
    const user = this.session(digest, now);
    const wantsPlayer = new URL(request.url).searchParams.get('play') === '1';
    const previous = user && [...this.connections].find(([,info]) => info.actor && info.account === user.account);
    const resume = user && this.sql.exec('SELECT pose FROM resumes WHERE account=? AND expires>?', user.account, now).toArray()[0];
    const active = [...this.connections.values()].filter(info => info.actor).length;
    const held = this.sql.exec('SELECT count(*) AS count FROM resumes WHERE expires>?', now).one().count;
    const playing = !!(user?.canPlay && wantsPlayer && (previous || resume || active+held < PLAYER_LIMIT));
    const spectators = this.connections.size-active;
    const [client, socket] = Object.values(new WebSocketPair());
    if (!playing && spectators >= SPECTATOR_LIMIT) {
      socket.accept();
      this.send(socket, {type:'welcome', id:null, reason:'spectators-full'});
      socket.close(1013, 'Live view full');
      return new Response(null,{status:101,webSocket:client});
    }
    const info = {actor:null, digest:user ? digest : null, account:user?.account, expires:user?.expires, login:user?.login,
      input:ZERO, inputExpires:0, tokens:30, tokenTime:now, ack:0, lastDestination:-Infinity, lastEmote:-Infinity};
    if (playing) {
      const from = previous?.[1].actor ?? (resume ? JSON.parse(resume.pose) : null);
      const [x,y] = world.zones.plaza.spawn;
      info.actor = {id:crypto.randomUUID(), x,y,turn:0,outfit:outfitFor(user.account),emoteVersion:0,
        islandId:'home',mode:'walking',boatId:null,...from, action:0,travel:0,until:0,path:[],jumpLeft:0};
      this.sql.exec('DELETE FROM resumes WHERE account=?', user.account);
      if (previous) this.demote(previous[0], previous[1], 'taken-over');
    }
    this.ctx.acceptWebSocket(socket);
    this.connections.set(socket, info);
    this.attach(socket, info);
    this.send(socket, {type:'welcome', id:info.actor?.id ?? null,
      reason:user && wantsPlayer && !user.canPlay ? 'star-required' : user && wantsPlayer && !playing ? 'players-full' : null});
    if (playing && !previous && !resume) {
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
    socket.serializeAttachment({actor:actor ? publicPose(actor) : null, account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId});
  }

  send(socket, message) {
    if (socket.readyState !== 1) return;
    try { socket.send(JSON.stringify(message)); } catch { socket.close(1011, 'Connection lost'); }
  }

  broadcast() {
    const active = [...this.connections.values()].filter(info => info.actor);
    const players = active.map(info => publicPose(info.actor));
    const namedPlayers = players.map((pose,index) => ({...pose, login:active[index].login, accountId:active[index].account}));
    const now = Date.now();
    const online = new Set([...this.connections].map(([socket,info]) =>
      info.account && info.expires > now ? info.account : socket)).size;
    const tick = ++this.tickCount;
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      const visiblePlayers = info.digest && info.expires > now ? namedPlayers : players;
      const islandId = actor?.islandId ?? info.islandId ?? 'home';
      this.send(socket, {type:'snapshot', epoch:this.epoch, tick, online, islandId, boats:this.boats.filter(boat => boat.islandId === islandId), players:visiblePlayers.filter(pose => pose.islandId === islandId), self:actor ? {
        ack:info.ack, path:actor.path, sailTarget:actor.sailTarget ?? null, docking:!!actor.docking, emoteLeft:Math.max(0,actor.until-now/1000),
      } : null});
    }
  }

  demote(socket, info, reason) {
    const wasPlayer = !!info.actor;
    if (info.actor && reason !== 'taken-over') this.releaseBoat(info.actor.id);
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
        if (command.x || command.y || command.stop === true) info.boarding = null;
        if (command.stop === true) {actor.path=[];actor.sailTarget=null;actor.docking=false;actor.pace=0;actor.heading=null;}
        info.input = {x:command.x,y:command.y};
        info.inputExpires = now+350;
        break;
      case 'destination':
        if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) return;
        if (actor.mode === 'sailing' ? !canSail(command.x,command.y,actor.islandId)
          : command.x<0 || command.y<0 || command.x>=world.width || command.y>=world.height) return;
        if (now-info.lastDestination >= 400) {
          info.lastDestination = now;
          info.input = ZERO;
          info.boarding = null;
          if (actor.mode === 'sailing') setSailDestination(actor,command.x,command.y);
          else setWalkDestination(actor, nav, command.x, command.y);
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
        const deck=boardingPoint(boat,nav);   // the jetty deck beside a harbor boat, or the nearest sand for a beach or islet boat
        if (near(actor,deck,45) || setWalkDestination(actor,nav,deck.x,deck.y)) info.boarding=boat.id;
        break;
      }
      case 'disembark':
        if (actor.mode === 'sailing') {
          info.input=ZERO;
          if (canDock(actor)) {setSailDestination(actor,HARBOR.water.x,HARBOR.water.y); actor.docking=true; break;}   // at the harbor: sail in to the jetty
          // boss 5 Nov: anywhere else, hop out onto the nearest shore within reach (this island's or a neighbour's)
          const spot=landingSpot(actor,nav);
          if (!spot) {this.send(socket,{type:'travel-notice',text:'Sail closer to the shore to dock.'}); break;}
          const boat=this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
          if (spot.islandId !== actor.islandId) {actor.islandId=spot.islandId; actor.x-=spot.offset.x; actor.y-=spot.offset.y; info.islandId=spot.islandId;}
          if (boat) {
            if (boatHome(boat) === actor.islandId) {Object.assign(boat,{x:actor.x,y:actor.y,turn:actor.turn,islandId:actor.islandId,occupant:null,departure:actor.islandId}); this.saveBoats();}   // moored where you left it
            else this.parkBoat(boat);   // landed on another island: the boat ferries home
          }
          Object.assign(actor,{x:spot.x,y:spot.y,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null,sailRoute:null});
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
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      if (!actor) continue;
      if (now >= info.inputExpires) info.input = ZERO;
      if (actor.mode === 'sailing') {
        sailStep(actor,.05,info.input);
        const boat=this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
        if (boat) {
          if (crossIsland(actor)) {info.input=ZERO; info.inputExpires=0;}
          Object.assign(boat,{x:actor.x,y:actor.y,turn:actor.turn,islandId:actor.islandId});
          if (actor.docking && near(actor,HARBOR.water,12)) {
            this.parkBoat(boat);   // a ferry: once you step off it goes back to its own mooring, so no island runs out
            Object.assign(actor,{...HARBOR.land,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null});
            info.input=ZERO;
          }
        }
      } else {
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
      active ||= !!(info.input.x || info.input.y || actor.travel || actor.path.length || actor.sailTarget || info.boarding || actor.jumpLeft > 0 || actor.until > now/1000);
      this.attach(socket, info);
    }
    for (const island of ISLANDS) {
      const walkers=[...this.connections.values()].map(info => info.actor).filter(actor => actor?.mode === 'walking' && actor.islandId === island.id);
      if (separateActors(walkers,nav,.05)) active=true;
    }
    for (const [socket,info] of this.connections) this.attach(socket,info);
    this.saveBoats();
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
    }
    if (info.actor && !this.session(info.digest)) this.releaseBoat(info.actor.id);
    this.broadcast();
    this.ctx.waitUntil(this.scheduleExpiry());
  }

  webSocketError(socket) {
    this.webSocketClose(socket);
    socket.close(1011, 'Connection lost');
  }
}

export default {fetch:() => new Response('Not found', {status:404})};
