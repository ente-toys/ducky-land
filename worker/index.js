import {unplaceRigid} from '../src/world/rigid.js';
import {reframeIslet} from '../src/world/islet-placement.js';
import {ISLETS} from '../src/world/islets.js';
import {mapOf} from '../src/world/island-maps.js';
import {BOG_ISLAND,bogLandingNotice} from '../src/features/bog-combat/entry.js';
import {getPlayerKarma} from '../src/features/bog-combat/karma.js';
import {LiveBogRoom} from './bog-room.js';
import {DURATIONS, playEmote, playSailEmote, SAIL_EMOTES, startJump, separateActors, setWalkDestination, walkStep, atMuseumDoor} from '../src/gameplay/player-motion.js';
import {chatText} from '../src/multiplayer/chat.js';
import {FRIEND_RADIUS} from '../src/multiplayer/friends.js';
import {islandFor, destinationsFor, harborOf, createBoats, near, canSail, setSailDestination, sailStep, crossIsland, boardingPoint, dockingSpot, landingApproach, fillMoorings, retireBoat, navOf, canWalkTo} from '../src/gameplay/islands.js';
import {randomOutfit, validOutfit} from '../src/gameplay/outfits.js';
import {pickWorldSpawn} from '../src/gameplay/world-spawn.js';
import {BUILD_COOLDOWN, buildSpot, strandedIslet} from '../src/gameplay/boat-build.js';
import {RoomKarma} from './karma.js';

export const ISLAND_LIMIT = 100;
export const PLAYER_LIMIT = 200;
const SPECTATOR_LIMIT = 64;
const STARGAZER_LIMIT = 5000;
const RESUME_MS = 15_000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const FLOW_MS = 10 * 60 * 1000;
const ZERO = {x:0,y:0};

function reply(data, status = 200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
}

function publicPose(actor) {
  const {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft=0,islandId='home',mode='walking',boatId=null,exitLocked=false} = actor;
  return {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft,islandId,mode,boatId,exitLocked,karma:actor.karma??0,
    ice:mode==='walking'?actor.ice??null:null,reducedMotion:actor.reducedMotion===true};
}
// a built boat's owner is an account id: clients only learn which boats are theirs (from their own self block)
function wireBoat({owner, ...boat}) {
  return owner ? {...boat, built:true} : boat;
}
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
function wirePose(actor) {
  const pose = publicPose(actor);
  if (pose.ice) pose.ice={phase:pose.ice.phase,elapsed:pose.ice.elapsed};
  pose.x = r2(pose.x); pose.y = r2(pose.y); pose.turn = r3(pose.turn); pose.travel = r2(pose.travel); pose.jumpLeft = r3(pose.jumpLeft);
  return pose;
}
function recoverIsland(actor) {
  if (actor && !islandFor(actor.islandId)) {
    const [x,y] = mapOf('home').world.zones.plaza.spawn;
    Object.assign(actor,{islandId:'home',mode:'walking',boatId:null,x,y,turn:0,path:[],
      sailTarget:null,sailRoute:null,docking:false,exitLocked:false,heading:null,pace:0});
  }
  return actor;
}
const islandCounts = connections => {
  const counts = new Map();
  for (const info of connections.values()) if (info.actor) counts.set(info.actor.islandId, (counts.get(info.actor.islandId) ?? 0) + 1);
  return counts;
};

export class IslandRoom {
  getPlayerKarma(actor,account) {
    if(!actor||!account)return 0;
    actor.karma=this.karma.balance(account);
    return getPlayerKarma(actor);
  }

  allowLanding(socket,info,islandId) {
    const text=bogLandingNotice(islandId,this.getPlayerKarma(info.actor,info.account));
    if(!text)return true;
    info.landing=null;
    Object.assign(info.actor,{docking:false,sailTarget:null,sailRoute:null});
    info.input=ZERO;
    if(Date.now()-(info.karmaNoticeAt??-Infinity)>3000){
      this.send(socket,{type:'travel-notice',text});info.karmaNoticeAt=Date.now();
    }
    return false;
  }
  chargeBogLanding(socket,info,islandId){
    if(islandId!==BOG_ISLAND)return true;
    if(!this.karma.beginBogEntry(info.account))return this.allowLanding(socket,info,islandId);
    info.actor.karma=this.karma.balance(info.account);
    return true;
  }
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
      account TEXT PRIMARY KEY, pose TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS last_locations (
      account TEXT PRIMARY KEY, pose TEXT NOT NULL);`);
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
    this.migrateFriends();
    if (!this.sql.exec("SELECT 1 FROM sqlite_master WHERE type='table' AND name='stargazers'").toArray().length) {
      this.sql.exec('CREATE TABLE stargazers (account TEXT PRIMARY KEY)');
      this.sql.exec('INSERT OR IGNORE INTO stargazers SELECT account FROM sessions WHERE can_play=1 AND expires>?', Date.now());
    }
    this.sql.exec('CREATE TABLE IF NOT EXISTS star_count (id INTEGER PRIMARY KEY, count INTEGER NOT NULL, checked INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS outfits (account TEXT PRIMARY KEY, outfit TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS boats (id INTEGER PRIMARY KEY, state TEXT NOT NULL)');
    const saved = this.sql.exec('SELECT state FROM boats WHERE id=1').toArray()[0];
    this.sql.exec('CREATE TABLE IF NOT EXISTS boat_states (id TEXT PRIMARY KEY, state TEXT NOT NULL)');
    const rows = this.sql.exec('SELECT id,state FROM boat_states').toArray();
    const boats = saved ? JSON.parse(saved.state) : rows.length ? rows.map(row => JSON.parse(row.state)) : createBoats();
    this.boats = boats.filter(boat => boat?.parked !== true || boat.occupant ||
      (islandFor(boat.islandId) && canSail(boat.x,boat.y,boat.islandId)));
    this.savedBoatRows = new Map(saved ? [] : rows.map(row => [row.id, row.state]));
    fillMoorings(this.boats);
    this.legacyBoats = Boolean(saved);
    for (const socket of ctx.getWebSockets()) {
      if (socket.readyState !== 1) continue;
      const info = socket.deserializeAttachment();
      if (!info) continue;
      if(info.bog)continue;
      const actor = recoverIsland(info.actor && this.session(info.digest)?.canPlay ? {islandId:'home',mode:'walking',boatId:null,...info.actor, action:0, travel:0, path:[], until:0,jumpLeft:0} : null);
      const login = info.login ?? (actor ? this.session(info.digest)?.login : null);
      const restored = {...info, actor, islandId:actor?.islandId ?? (islandFor(info.islandId) ? info.islandId : 'home'), login, input:ZERO, inputExpires:0, tokens:30, tokenTime:Date.now()};
      this.connections.set(socket, restored);
      if (this.recoverSailingPosition(actor)) this.attach(socket, restored);
    }
    this.reconcileBoats();
    this.karma=new RoomKarma(this);
    for(const socket of ctx.getWebSockets()){
      const saved=socket.readyState===1&&socket.deserializeAttachment()?.bog;
      if(saved&&!(this.bog??=new LiveBogRoom(this)).open(socket,saved))socket.close(1008,'Bog visit ended');
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }

  navFor(islandId='home') { return navOf(islandId); }

  saveBoats() {
    const next = new Map(this.boats.map(boat => [String(boat.id), JSON.stringify(boat)]));
    const save = () => {
      for (const [id, state] of next) if (this.savedBoatRows.get(id) !== state) {
        this.sql.exec('INSERT OR REPLACE INTO boat_states VALUES(?,?)', id, state);
      }
      for (const id of this.savedBoatRows.keys()) if (!next.has(id)) this.sql.exec('DELETE FROM boat_states WHERE id=?', id);
      if (this.legacyBoats) this.sql.exec('DELETE FROM boats WHERE id=1');
    };
    if (this.ctx.storage.transactionSync) this.ctx.storage.transactionSync(save);
    else save();
    this.savedBoatRows = next;
    this.legacyBoats = false;
  }

  parkBoat(boat,landing=null) {
    retireBoat(this.boats,boat,landing);
    this.saveBoats();
  }

  releaseBoat(actorId) {
    const boat=this.boats.find(boat => boat.occupant === actorId);
    if (boat) this.parkBoat(boat);
  }

  reconcileBoats() {
    const retained=new Set([...this.connections.values()].filter(info => info.actor).map(info => info.actor.id));
    for (const row of this.sql.exec('SELECT r.pose FROM resumes r JOIN sessions s ON s.account=r.account WHERE r.expires>? AND s.expires>? AND s.can_play=1',Date.now(),Date.now()).toArray()) retained.add(JSON.parse(row.pose).id);
    for (const boat of [...this.boats]) if (boat.occupant && !retained.has(boat.occupant)) this.parkBoat(boat);
    this.saveBoats();
  }

  recoverSailingPosition(actor) {
    if (actor?.mode !== 'sailing') return false;
    const boat = this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
    if (!boat || canSail(actor.x, actor.y, actor.islandId)) return false;

    let position = harborOf(actor.islandId).water;
    search: for (const distance of [16, 32, 64, 128, 256]) {
      for (let i = 0; i < 16; i++) {
        const angle = i * Math.PI / 8;
        const x = actor.x + Math.cos(angle) * distance;
        const y = actor.y + Math.sin(angle) * distance;
        if (canSail(x, y, actor.islandId)) {
          position = {x, y};
          break search;
        }
      }
    }
    const {x, y} = position;
    Object.assign(actor, {x, y, travel:0, sailTarget:null, sailRoute:null, docking:false, exitLocked:false});
    Object.assign(boat, {x, y, islandId:actor.islandId});
    return true;
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
    if (pathname === '/bog-room') {
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return reply({},426);
      const params=new URL(request.url).searchParams,digest=request.headers.get('X-Session-Digest');
      const bog=this.bog??=new LiveBogRoom(this);
      if(!bog.admitted(digest))return reply({error:'Land at the Bog harbour with 5 karma first.'},403);
      const team=params.get('mode')==='lobby'?null:params.get('team');
      if(team===null&&params.get('mode')!=='lobby'||team!==null&&!['karma','evil'].includes(team))return reply({},400);
      const [client,socket]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(socket);if(!bog.open(socket,{digest,team}))socket.close(1008,'Bog visit ended');
      return new Response(null,{status:101,webSocket:client});
    }
    const data = await request.json();
    if (pathname === '/friends') return this.friends(data, now);
    if (pathname === '/outfit') return this.saveOutfit(data, now);
    if (pathname === '/stars') return this.stars(data, now);
    if (pathname === '/stars/count') {
      if (Number.isSafeInteger(data.count) && data.count >= 0) this.sql.exec('INSERT OR REPLACE INTO star_count VALUES(1,?,?)', data.count, now);
      return reply({});
    }
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
      this.stargazer(data.account, data.canPlay === true);
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
      const checked = this.session(data.digest, now);
      if (checked && typeof data.starred === 'boolean') this.stargazer(checked.account, data.starred);
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

  migrateFriends() {
    if (this.sql.exec('PRAGMA table_info(friend_requests)').toArray().length) return;
    const migrate = () => {
      this.sql.exec(`CREATE TABLE friend_requests (
        sender_account_id TEXT NOT NULL, receiver_account_id TEXT NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY (sender_account_id,receiver_account_id), CHECK (sender_account_id <> receiver_account_id));
        INSERT INTO friend_requests SELECT f.owner_account_id,f.friend_account_id,f.created_at FROM friends f
        WHERE NOT EXISTS (SELECT 1 FROM friends reverse WHERE reverse.owner_account_id=f.friend_account_id AND reverse.friend_account_id=f.owner_account_id);
        DELETE FROM friends WHERE NOT EXISTS (SELECT 1 FROM friends reverse WHERE reverse.owner_account_id=friends.friend_account_id AND reverse.friend_account_id=friends.owner_account_id);`);
    };
    if (this.ctx.storage.transactionSync) this.ctx.storage.transactionSync(migrate);
    else migrate();
  }

  friendState(account) {
    const friends = this.sql.exec(`SELECT a.account AS accountId,a.login,f.created_at AS createdAt
      FROM friends f JOIN accounts a ON a.account=f.friend_account_id
      WHERE f.owner_account_id=? ORDER BY f.created_at DESC,f.friend_account_id`, account).toArray();
    const incoming = this.sql.exec(`SELECT a.account AS accountId,a.login,r.created_at AS createdAt
      FROM friend_requests r JOIN accounts a ON a.account=r.sender_account_id
      WHERE r.receiver_account_id=? ORDER BY r.created_at,r.sender_account_id`, account).toArray();
    const outgoing = this.sql.exec(`SELECT a.account AS accountId,a.login,r.created_at AS createdAt
      FROM friend_requests r JOIN accounts a ON a.account=r.receiver_account_id
      WHERE r.sender_account_id=? ORDER BY r.created_at,r.receiver_account_id`, account).toArray();
    return {friends,incoming,outgoing};
  }

  stargazer(account, starred) {
    if (starred) this.sql.exec('INSERT OR IGNORE INTO stargazers VALUES(?)', account);
    else this.sql.exec('DELETE FROM stargazers WHERE account=?', account);
  }

  stars(data, now) {
    const user = this.session(data.digest, now);
    if (!user) return reply({error:'Please sign in again to look through the telescope.'},401);
    const count = this.sql.exec('SELECT count,checked FROM star_count WHERE id=1').toArray()[0];
    const named = new Map(this.sql.exec('SELECT account,login FROM accounts WHERE account IN (SELECT account FROM stargazers) ORDER BY account LIMIT ?', STARGAZER_LIMIT)
      .toArray().map(row => [row.account,row.login]));
    const playing = [...this.connections.values()].filter(info => info.actor && info.account && info.expires > now);
    for (const info of playing) if (info.login) named.set(info.account, info.login);
    const players = [...named], online = [...new Set(playing.map(info => info.account))];
    const friends = this.sql.exec('SELECT friend_account_id AS account FROM friends WHERE owner_account_id=?', user.account)
      .toArray().map(row => row.account);
    return reply({total:count?.count ?? null, checked:count?.checked ?? 0,
      me:{accountId:user.account,login:user.login,starred:!!user.canPlay}, players, online, friends});
  }

  saveOutfit(data, now) {
    const user = this.session(data.digest, now);
    if (!user) return reply({error:'Please sign in again to save your outfit.'},401);
    if (!user.canPlay) return reply({error:'Unlock play to save your outfit.'},403);
    if (!validOutfit(data.outfit)) return reply({error:'Invalid outfit. Randomize and try again.'},400);
    const outfit = data.outfit;
    this.sql.exec('INSERT INTO outfits (account,outfit) VALUES(?,?) ON CONFLICT(account) DO UPDATE SET outfit=excluded.outfit',
      user.account, JSON.stringify(outfit));
    for (const [socket,info] of this.connections) {
      if (info.account !== user.account || !info.actor) continue;
      info.actor.outfit = outfit;
      this.attach(socket,info);
    }
    this.broadcast();
    return reply({outfit});
  }

  friends(data, now) {
    const user = this.session(data.digest, now);
    if (!user) return reply({error:'Please sign in again to manage friends.'}, 401);
    if (data.method === 'GET') return reply(this.friendState(user.account));
    let account;
    if (data.method === 'POST') {
      if (typeof data.playerId !== 'string' || data.playerId.length > 64) return reply({error:'Invalid player.'},400);
      const entries = [...this.connections.entries()].filter(([socket,info]) =>
        socket.readyState === 1 && info.actor && info.expires > now);
      const owner = entries.find(([,info]) => info.account === user.account)?.[1];
      const target = entries.find(([,info]) => info.actor.id === data.playerId)?.[1];
      if (!owner || !user.canPlay) return reply({error:'Join the island to send a friend request.'},403);
      if (!target) return reply({error:'That player has left the island.'},409);
      if (target.account === user.account) return reply({error:'You cannot add yourself.'},400);
      if (owner.actor.islandId !== target.actor.islandId || !near(owner.actor,target.actor,FRIEND_RADIUS)) {
        return reply({error:'That player moved away. Walk closer and try again.'},409);
      }
      account = target.account;
    } else if (data.method === 'PATCH' || data.method === 'DELETE') {
      if (typeof data.accountId !== 'string' || !/^[1-9][0-9]*$/.test(data.accountId) || data.accountId.length > 32 || data.accountId === user.account) {
        return reply({error:'Invalid friend.'},400);
      }
      if (data.method === 'PATCH' && !['accept','decline','cancel'].includes(data.action)) return reply({error:'Invalid action.'},400);
      account = data.accountId;
    } else return reply({error:'Method not allowed.'},405);

    const accepted = this.sql.exec('SELECT 1 FROM friends WHERE owner_account_id=? AND friend_account_id=?',user.account,account).toArray().length > 0;
    const incoming = this.sql.exec('SELECT 1 FROM friend_requests WHERE sender_account_id=? AND receiver_account_id=?',account,user.account).toArray().length > 0;
    if (data.method === 'PATCH' && data.action === 'accept' && !incoming && !accepted) {
      return reply({error:'That friend request is no longer available.'},409);
    }
    const mutate = () => {
      if ((data.method === 'PATCH' && data.action === 'accept') || (data.method === 'POST' && incoming)) {
        this.sql.exec(`INSERT OR IGNORE INTO friends VALUES(?,?,?),(?,?,?)`,user.account,account,now,account,user.account,now);
        this.sql.exec('DELETE FROM friend_requests WHERE (sender_account_id=? AND receiver_account_id=?) OR (sender_account_id=? AND receiver_account_id=?)',user.account,account,account,user.account);
      } else if (data.method === 'POST' && !accepted) {
        this.sql.exec('INSERT OR IGNORE INTO friend_requests VALUES(?,?,?)',user.account,account,now);
      } else if (data.method === 'PATCH') {
        const sender = data.action === 'cancel' ? user.account : account;
        const receiver = data.action === 'cancel' ? account : user.account;
        this.sql.exec('DELETE FROM friend_requests WHERE sender_account_id=? AND receiver_account_id=?',sender,receiver);
      } else if (data.method === 'DELETE') {
        this.sql.exec('DELETE FROM friends WHERE (owner_account_id=? AND friend_account_id=?) OR (owner_account_id=? AND friend_account_id=?)',user.account,account,account,user.account);
        this.sql.exec('DELETE FROM friend_requests WHERE (sender_account_id=? AND receiver_account_id=?) OR (sender_account_id=? AND receiver_account_id=?)',user.account,account,account,user.account);
      }
    };
    if (this.ctx.storage.transactionSync) this.ctx.storage.transactionSync(mutate);
    else mutate();
    for (const [socket,info] of this.connections) {
      if ((info.account === user.account || info.account === account) && info.digest && info.expires > now) this.send(socket,{type:'friends-changed'});
    }
    return reply(this.friendState(user.account));
  }

  saveLocation(account, actor) {
    const {islandId, x, y, turn, mode} = actor;
    this.sql.exec('INSERT OR REPLACE INTO last_locations VALUES(?,?)',
      account, JSON.stringify({islandId, x, y, turn, mode}));
  }

  savedLocation(account, counts) {
    const row = this.sql.exec('SELECT pose FROM last_locations WHERE account=?',account).toArray()[0];
    if (!row) return null;
    const {islandId, x, y, turn, mode} = recoverIsland(JSON.parse(row.pose));
    if ((counts.get(islandId) ?? 0) >= ISLAND_LIMIT) return null;
    if (islandId === BOG_ISLAND && !this.karma.bogEntry(account) &&
        bogLandingNotice(islandId,this.karma.balance(account))) return null;

    const nav = this.navFor(islandId);
    if (mode === 'sailing') {
      // The short reservation releases the shared boat. Return on foot at the harbor.
      const dock = harborOf(islandId).land;
      const point = nav.nearest(dock.x,dock.y,180);
      return point ? {islandId, x:point[0], y:point[1], turn:0} : null;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !canWalkTo(islandId,x,y) || !nav.walkable(x,y)) return null;
    return {islandId, x, y, turn};
  }

  pickSpawn(account, counts, occupied) {
    return pickWorldSpawn({
      karma:this.karma.balance(account), boats:this.boats, occupied,
      hasRoom:id => (counts.get(id) ?? 0) < ISLAND_LIMIT,
    });
  }

  join(request, now) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply({}, 426);
    const digest = request.headers.get('X-Session-Digest');
    const user = this.session(digest, now);
    const wantsPlayer = new URL(request.url).searchParams.get('play') === '1';
    const previous = user && [...this.connections].find(([,info]) => info.actor && info.account === user.account);
    const resume = user && this.sql.exec('SELECT pose FROM resumes WHERE account=? AND expires>?', user.account, now).toArray()[0];
    const actors = [...this.connections.values()].flatMap(info => info.actor ? [info.actor] : []);
    const held = this.sql.exec('SELECT pose FROM resumes WHERE expires>?', now).toArray()
      .map(row => JSON.parse(row.pose));
    const active = actors.length;
    const from = previous?.[1].actor ?? (resume ? JSON.parse(resume.pose) : null);
    const canPlay = user?.canPlay && wantsPlayer;
    let spawn = null, saved = null;
    if (canPlay && !from && active + held.length < PLAYER_LIMIT) {
      const occupied = [...actors, ...held];
      const counts = new Map();
      for (const pose of occupied) {
        const id = pose.islandId ?? 'home';
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      saved = this.savedLocation(user.account, counts);
      if (!saved) spawn = this.pickSpawn(user.account, counts, occupied);
    }
    const playing = Boolean(canPlay && (from || saved || spawn));
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
      const [x,y] = mapOf('home').world.zones.plaza.spawn;
      const savedOutfit = this.sql.exec('SELECT outfit FROM outfits WHERE account=?',user.account).toArray()[0];
      const outfit = savedOutfit ? JSON.parse(savedOutfit.outfit) : validOutfit(from?.outfit) ? from.outfit : randomOutfit();
      if (!savedOutfit) this.sql.exec('INSERT INTO outfits (account,outfit) VALUES(?,?)',user.account,JSON.stringify(outfit));
      const pose = from ?? saved ?? {islandId:spawn.islandId, x:spawn.x, y:spawn.y};
      info.actor = {id:crypto.randomUUID(), turn:0, emoteVersion:0,
        islandId:'home',mode:'walking',boatId:null,...pose,outfit, action:0,travel:0,until:0,path:[],jumpLeft:0};
      recoverIsland(info.actor);
      if (this.recoverSailingPosition(info.actor)) this.saveBoats();
      if(info.actor.islandId!==BOG_ISLAND||info.actor.mode!=='walking')this.karma.endBogEntry(user.account);
      info.actor.karma=this.karma.balance(user.account);
      if (mapOf(info.actor.islandId).home && info.actor.mode === 'walking' && atMuseumDoor(info.actor.x,info.actor.y)) Object.assign(info.actor,{x,y,turn:0});
      this.sql.exec('DELETE FROM resumes WHERE account=?', user.account);
      if (previous) this.demote(previous[0], previous[1], 'taken-over');
    }
    this.ctx.acceptWebSocket(socket);
    this.connections.set(socket, info);
    this.attach(socket, info);
    this.send(socket, {type:'welcome', id:info.actor?.id ?? null,
      ...(spawn ? {arrival:spawn.name} : {}),
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
    const {actor,account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId,deltas} = info;
    socket.serializeAttachment({actor:actor ? publicPose(actor) : null, account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId,deltas});
  }

  send(socket, message) {
    if (socket.readyState !== 1) return;
    try { socket.send(JSON.stringify(message)); } catch { socket.close(1011, 'Connection lost'); }
  }

  broadcast() {
    const now = Date.now();
    this.karma.broadcast(now);
    const online = new Set([...this.connections].map(([socket,info]) =>
      info.account && info.expires > now ? info.account : socket)).size;
    const tick = ++this.tickCount;
    const groups = new Map();
    const combatAccounts=new Set([...(this.bog?.arena.state.players.values()??[])].map(p=>p.profile));
    for (const info of this.connections.values()) {
      if (!info.actor||combatAccounts.has(info.account)) continue;
      const islandId = info.actor.islandId, pose = wirePose(info.actor);
      if (!groups.has(islandId)) groups.set(islandId, {guests:[], named:[]});
      const group = groups.get(islandId);
      group.guests.push(pose); group.named.push({...pose, login:info.login, accountId:info.account});
    }
    const shared = new Map(), empty = {guests:[], named:[]};
    const text = (islandId, named, info) => {
      const combatSelf=!!info.actor&&combatAccounts.has(info.account);
      const key = `${named ? 1 : 0}|${islandId}${combatSelf?'|'+info.account:''}`;
      if (!shared.has(key)) {
        const group = groups.get(islandId) ?? empty;
        const poses=named?group.named:group.guests;
        const players=combatSelf?[...poses,{...wirePose(info.actor),...(named?{login:info.login,accountId:info.account}:{})}]:poses;
        shared.set(key, `{"type":"snapshot","epoch":${JSON.stringify(this.epoch)},"tick":${tick},"online":${online},"islandId":${JSON.stringify(islandId)},"boats":${JSON.stringify(this.boats.filter(boat => boat.islandId === islandId).map(wireBoat))},"players":${JSON.stringify(players)},"self":`);
      }
      return shared.get(key);
    };
    // built boats by owner, once per broadcast (each player's self block lists theirs)
    const owned = new Map();
    for (const boat of this.boats) if (boat.owner) owned.set(boat.owner, [...(owned.get(boat.owner) ?? []), boat.id]);
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      const islandId = actor?.islandId ?? info.islandId ?? 'home';
      const self = actor ? JSON.stringify({ack:info.ack, path:actor.path, sailTarget:actor.sailTarget ?? null, docking:!!actor.docking, emoteLeft:Math.max(0,actor.until-now/1000),ice:actor.ice??null,reducedMotion:actor.reducedMotion===true,
        ownBoats:owned.get(info.account) ?? []}) : 'null';
      const named = !!(info.digest && info.expires > now);
      const full = text(islandId, named, info) + self + '}';
      if (!info.deltas) {this.sendText(socket, full); continue;}
      this.snapshotGroups ??= new Map();
      const key = `${named ? 1 : 0}|${islandId}${info.actor&&combatAccounts.has(info.account)?'|'+info.account:''}`;
      let group = this.snapshotGroups.get(key);
      if (group?.tick !== tick) {
        const snapshot = JSON.parse(full);
        group = {tick, players: new Map(snapshot.players.map(p => [p.id, p])), boats: new Map(snapshot.boats.map(b => [b.id, b])), patches: new WeakMap()};
        this.snapshotGroups.set(key, group);
      }
      const base = info.snapshotBase;
      if (!base || base.key !== key || tick - base.fullTick >= 50) {
        this.sendText(socket, full);
        info.snapshotBase = {key, group, fullTick: tick};
        continue;
      }
      let patch = group.patches.get(base.group);
      if (!patch) {
        const diff = (before, after) => ({
          changed: [...after].flatMap(([id, value]) => {
            const old = before.get(id);
            if (!old) return [value];
            const fields = Object.fromEntries(Object.entries(value).filter(([field, v]) => JSON.stringify(v) !== JSON.stringify(old[field])));
            return Object.keys(fields).length ? [{id, ...fields}] : [];
          }),
          removed: [...before.keys()].filter(id => !after.has(id)),
        });
        patch = {players: diff(base.group.players, group.players), boats: diff(base.group.boats, group.boats)};
        group.patches.set(base.group, patch);
      }
      this.sendText(socket, JSON.stringify({type: 'delta', epoch: this.epoch, tick, baseTick: base.group.tick, islandId, online, ...patch, self: JSON.parse(self)}));
      info.snapshotBase = {key, group, fullTick: base.fullTick};
    }
  }

  sendText(socket, text) {
    if (socket.readyState !== 1) return;
    try { socket.send(text); } catch { socket.close(1011, 'Connection lost'); }
  }

  demote(socket, info, reason) {
    const wasPlayer = !!info.actor;
    if (info.actor && reason !== 'taken-over') {
      this.saveLocation(info.account,info.actor);
      this.releaseBoat(info.actor.id);
    }
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
    if(this.bog?.members.has(socket)){this.bog.message(socket,message);return;}
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
    if (command?.type === 'updates') {
      info.deltas = true;
      info.snapshotBase = null;
      this.attach(socket, info);
      this.broadcast();
      return;
    }
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
        if (command.x || command.y) {info.boarding = null; info.landing = null;}
        else if (command.stop === true) info.boarding = null;
        if (command.stop === true && !info.landing) {actor.path=[];actor.sailTarget=null;actor.docking=false;actor.pace=0;actor.heading=null;}
        info.input = {x:command.x,y:command.y,run:command.run === true};
        if (typeof command.reducedMotion==='boolean') actor.reducedMotion=command.reducedMotion;
        info.inputExpires = now+350;
        break;
      case 'destination':
        if (!Number.isFinite(command.x) || !Number.isFinite(command.y)) return;
        if (actor.mode === 'sailing' ? !canSail(command.x,command.y,actor.islandId)
          : !canWalkTo(actor.islandId,command.x,command.y)) return;
        if (now-info.lastDestination >= 400) {
          info.lastDestination = now;
          info.input = ZERO;
          info.boarding = null;
          info.landing = null;
          if (actor.mode === 'sailing') setSailDestination(actor,command.x,command.y);
          else setWalkDestination(actor, this.navFor(actor.islandId), command.x, command.y);
        }
        break;
      case 'board': {
        if (actor.mode !== 'walking' || typeof command.boatId !== 'string') break;
        info.boarding=null; actor.path=[]; info.input=ZERO;
        const boat = this.boats.find(boat => boat.id === command.boatId && boat.islandId === actor.islandId);
        if (!boat || boat.occupant) {
          this.send(socket,{type:'travel-notice',text:'Boat taken.'});
          break;
        }
        if (boat.owner && boat.owner !== info.account) {
          this.send(socket,{type:'travel-notice',text:'Someone else built that boat.'});
          break;
        }
        info.input=ZERO;
        const nav=this.navFor(actor.islandId), deck=boardingPoint(boat,nav);
        if (near(actor,deck,45) || setWalkDestination(actor,nav,deck.x,deck.y)) info.boarding=boat.id;
        break;
      }
      case 'build': {
        // stranded on an islet: the client gathered the materials, the server checks the place and makes the boat
        if (actor.mode !== 'walking' || !info.account || now-(info.lastBuild ?? -Infinity) < BUILD_COOLDOWN) break;
        const usable=this.boats.filter(boat => !boat.owner || boat.owner === info.account);
        const spot=strandedIslet(actor.islandId,actor,usable) && buildSpot(actor.islandId,actor);
        if (!spot) {this.send(socket,{type:'travel-notice',text:'Walk to the edge of the island to build your boat.'}); break;}
        info.lastBuild=now;
        // one built boat per player: an old one left idle somewhere is replaced
        this.boats=this.boats.filter(boat => boat.owner !== info.account || boat.occupant);
        const id=`${actor.islandId}-0~built-${now.toString(36)}${Math.floor(Math.random()*1296).toString(36)}`;
        this.boats.push({id,islandId:actor.islandId,x:spot.x,y:spot.y,turn:spot.turn,occupant:null,departure:actor.islandId,parked:true,owner:info.account});
        this.saveBoats();
        this.send(socket,{type:'boat-built',boatId:id,x:spot.x,y:spot.y});
        break;
      }
      case 'disembark':
        if (actor.mode === 'sailing') {
          const targeted=command.x !== undefined || command.y !== undefined;
          if (targeted && (!Number.isFinite(command.x) || !Number.isFinite(command.y))) return;
          const spot=dockingSpot(actor,targeted ? {x:command.x,y:command.y} : null);
          if (!spot) {this.send(socket,{type:'travel-notice',text:'Sail closer to the shore to dock.'}); break;}
          if (!spot.islet&&!this.allowLanding(socket,info,spot.islandId)) break;
          if (spot.islandId !== actor.islandId && (islandCounts(this.connections).get(spot.islandId) ?? 0) >= ISLAND_LIMIT) {this.send(socket,{type:'travel-notice',text:`That island is full (${ISLAND_LIMIT} Duckies). Try another one.`}); break;}
          info.input=ZERO; info.landing=null;
          actor.sailTarget=null; actor.sailRoute=null; actor.docking=false;
          if (spot.harbor) {
            const {water}=harborOf(actor.islandId);
            actor.docking=Boolean(setSailDestination(actor,water.x,water.y));
            break;
          }
          spot.approach=landingApproach(actor,spot);
          info.landing=spot;
          if (!near(actor,spot.approach,14) && !setSailDestination(actor,spot.approach.x,spot.approach.y)) info.landing={...spot,approach:{x:actor.x,y:actor.y}};
        }
        break;
      case 'emote':
        if (actor.mode === 'sailing') {
          if (SAIL_EMOTES.has(command.action) && (now-info.lastEmote >= 300 || (command.action === 3 && actor.action === 2))) {
            info.lastEmote = now; playSailEmote(actor, command.action, now/1000);
          }
          break;
        }
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
    if (!this.timer) this.timer = setInterval(() => this.step(),50);
  }

  step() {
    const now = Date.now();
    let active = false;
    this.expire(now);
    const counts = islandCounts(this.connections), roomOn = id => (counts.get(id) ?? 0) < ISLAND_LIMIT;
    const full = (socket, info) => {
      if (now-(info.fullNotice ?? -Infinity) < 60_000) return;
      info.fullNotice = now; this.send(socket,{type:'travel-notice',text:`That island is full (${ISLAND_LIMIT} Duckies). Try another one.`});
    };
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      if (!actor) continue;
      if (now >= info.inputExpires) info.input = ZERO;
      if (actor.mode === 'sailing') {
        sailStep(actor,.05,info.input,now/1000);
        const boat=this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
        if (!boat) info.landing=null;
        if (boat) {
          const from=actor.islandId;
          if (!info.landing) {
            if (crossIsland(actor,id=>roomOn(id)&&this.allowLanding(socket,info,id))) {info.input=ZERO; info.inputExpires=0; counts.set(from,(counts.get(from) ?? 1)-1); counts.set(actor.islandId,(counts.get(actor.islandId) ?? 0)+1);}
            else if (destinationsFor(actor.islandId).some(d => !roomOn(d.destination) && Math.abs(actor.x-d.dock.x)<=65 && Math.abs(actor.y-d.dock.y)<=50)) full(socket,info);
          }
          Object.assign(boat,{x:actor.x,y:actor.y,turn:actor.turn,islandId:actor.islandId});
          if (info.landing && (near(actor,info.landing.approach,14) || !actor.sailTarget)) {
            const spot=info.landing; info.landing=null;
            if (!spot.islet&&!this.allowLanding(socket,info,spot.islandId)) continue;
            if (spot.islandId !== actor.islandId && !roomOn(spot.islandId)) {full(socket,info); actor.sailTarget=null; actor.sailRoute=null;}
            else {
            if(!spot.islet&&!this.chargeBogLanding(socket,info,spot.islandId))continue;
            if (spot.islandId !== actor.islandId) {counts.set(actor.islandId,(counts.get(actor.islandId) ?? 1)-1); counts.set(spot.islandId,(counts.get(spot.islandId) ?? 0)+1); Object.assign(actor,spot.islet?reframeIslet(actor.islandId,spot.islandId,ISLETS.find(i=>i.id===spot.islet),actor):unplaceRigid(actor.islandId,spot.islandId,actor)); actor.islandId=spot.islandId; info.islandId=spot.islandId;}
            Object.assign(boat,{x:actor.x,y:actor.y,islandId:actor.islandId});
            this.parkBoat(boat,spot);
            Object.assign(actor,{x:spot.x,y:spot.y,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null,sailRoute:null});
            info.input=ZERO;
            }
          } else if (actor.docking && near(actor,harborOf(actor.islandId).water,12)) {
            if (!this.allowLanding(socket,info,actor.islandId)||!this.chargeBogLanding(socket,info,actor.islandId)) continue;
            this.parkBoat(boat);
            Object.assign(actor,{...harborOf(actor.islandId).land,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null});
            info.input=ZERO;
          }
        }
      } else {
        info.landing=null;
        const nav=this.navFor(actor.islandId);
        walkStep(actor, nav, .05, now/1000, info.input);
        const boat=info.boarding && this.boats.find(boat => boat.id === info.boarding && boat.islandId === actor.islandId);
        const aboard=boat && near(actor,boardingPoint(boat,nav),45);
        if (info.boarding && (aboard || !actor.path.length)) {
          info.boarding=null;
          actor.path=[];
          if (!aboard || boat.occupant) this.send(socket,{type:'travel-notice',text:'Boat taken.'});
          else {
            if(actor.islandId===BOG_ISLAND)this.karma.endBogEntry(info.account);
            boat.occupant=actor.id; boat.departure=actor.islandId;
            if (boat.landing) boat.landing=null;
            Object.assign(actor,{x:boat.x,y:boat.y,turn:boat.turn,mode:'sailing',boatId:boat.id,action:0,until:0,travel:0,pace:0,heading:null,sailTarget:null,exitLocked:false,jumpLeft:0});
            info.input=ZERO;
          }
        }
      }
      active ||= !!(info.input.x || info.input.y || actor.travel || actor.path.length || actor.sailTarget || info.boarding || info.landing || actor.jumpLeft > 0 || actor.until > now/1000 || (actor.ice && actor.ice.phase!=='drift'));
    }
    const walking = new Map();
    for (const info of this.connections.values()) {
      const actor = info.actor;
      if (actor?.mode !== 'walking') continue;
      if (!walking.has(actor.islandId)) walking.set(actor.islandId, []);
      walking.get(actor.islandId).push(actor);
    }
    for (const [islandId, walkers] of walking) if (walkers.length > 1 && separateActors(walkers,this.navFor(islandId),.05)) active=true;
    this.karma.update(now);
    for (const [socket,info] of this.connections) if (info.actor) this.attach(socket,info);
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
    if(this.bog?.members.has(socket)){this.bog.close(socket);return;}
    const info = this.connections.get(socket);
    if (!info) return;
    this.connections.delete(socket);
    if (info.actor) {
      this.saveLocation(info.account,info.actor);
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
