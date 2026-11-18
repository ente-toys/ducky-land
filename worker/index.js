import {seaViewPose} from '../src/world/sea-view.js';
import {SEA_VERSION,FLAT_ISLETS} from '../src/world/flat-layout.js';
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
import {migrateSeaPosition, islandFor, harborOf, boatSpots, boatRoom, freeBoatPosition, refusedLandingPosition, createBoats, near, canSail, setSailDestination, sailStep, crossIsland, boardingPoint, dockingSpot, HARBOR_ONLY, landingApproach, fillMoorings, retireBoat, navOf, canWalkTo} from '../src/gameplay/islands.js';
import {randomOutfit, validOutfit} from '../src/gameplay/outfits.js';
import {pickWorldSpawn} from '../src/gameplay/world-spawn.js';
import {BUILD_COOLDOWN, buildSpot, strandedIslet} from '../src/gameplay/boat-build.js';
import {RoomKarma} from './karma.js';

const STARGAZER_LIMIT = 5000;
const RESUME_MS = 30_000;
const CHECKPOINT_MS = 1_000;
const PRESENCE_UPDATE_MS = 100;
const GLOBE_UPDATE_MS = 500;
const SOCKET_COMMAND_BURST = 300;
const SOCKET_COMMANDS_PER_SECOND = 240;
const INPUT_TIMEOUT_MS = 350;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const FLOW_MS = 10 * 60 * 1000;
const ZERO = {x:0,y:0};

function takeCommandToken(info, now) {
  info.tokens = Math.min(SOCKET_COMMAND_BURST, info.tokens + (now - info.tokenTime) * SOCKET_COMMANDS_PER_SECOND / 1000);
  info.tokenTime = now;
  if (info.tokens < 1) return false;
  info.tokens--;
  return true;
}

function validMovementInput(command) {
  return [-1, 0, 1].includes(command.x) && [-1, 0, 1].includes(command.y);
}

function reply(data, status = 200) {
  return Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
}

function publicPose(actor) {
  const {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft=0,islandId='home',mode='walking',boatId=null,exitLocked=false} = actor;
  return {id,x,y,turn,travel,action,emoteVersion,outfit,jumpLeft,islandId,mode,boatId,exitLocked,karma:actor.karma??0,
    ice:mode==='walking'?actor.ice??null:null,reducedMotion:actor.reducedMotion===true};
}
// Persist the chart version privately; wire poses keep their existing public shape.
const savedPose=actor=>({...publicPose(actor),seaVersion:actor.seaVersion??SEA_VERSION});
// a built boat's owner is an account id: clients only learn which boats are theirs (from their own self block)
function wireBoat({owner, ownershipVersion, buildRevision, ...boat}) {
  return owner ? {...boat, built:true} : boat;
}
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
export function wirePose(actor) {
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
  if(actor)migrateSeaPosition(actor);
  return actor;
}
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
    const waiting=refusedLandingPosition(info.actor,islandId,this.boats);
    if(waiting){
      Object.assign(info.actor,waiting,{travel:0});
      const boat=this.boats.find(b=>b.id===info.actor.boatId && b.occupant===info.actor.id);
      if(boat)Object.assign(boat,waiting);
    }
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
  constructor(ctx, bindings, simulation = null, inactiveWorld = false) {
    this.simulation = simulation;
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.connections = new Map();
    this.globeSubscribers = new Set();
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
    const boats = saved ? JSON.parse(saved.state) : rows.length ? rows.map(row => JSON.parse(row.state)) : simulation ? [] : createBoats();
    for(const boat of boats) {
      if(boat.seaVersion!==SEA_VERSION && islandFor(boat.islandId) && (boat.occupant||boat.parked)) {
        const pose={...boat,mode:'sailing'};migrateSeaPosition(pose);Object.assign(boat,{x:pose.x,y:pose.y});
        if(boat.landing){const landing={...boat.landing,islandId:boat.islandId,mode:'walking'};migrateSeaPosition(landing);boat.landing=near(pose,landing,420)?{x:landing.x,y:landing.y}:null;}
      }
      boat.seaVersion=SEA_VERSION;
    }
    this.boats = boats.filter(boat => boat?.parked !== true || boat.occupant ||
      (islandFor(boat.islandId) && canSail(boat.x,boat.y,boat.islandId)));
    this.savedBoatRows = new Map(saved ? [] : rows.map(row => [row.id, row.state]));
    this.sql.exec('CREATE TABLE IF NOT EXISTS room_checkpoints (account TEXT PRIMARY KEY, digest TEXT NOT NULL, pose TEXT NOT NULL)');
    this.savedCheckpointRows = new Map(this.sql.exec('SELECT account,digest,pose FROM room_checkpoints').toArray()
      .map(row => [row.account, row]));
    this.checkpointAt = 0;
    fillMoorings(this.boats, this.simulation?.owner ?? null);
    this.legacyBoats = Boolean(saved);
    for (const socket of inactiveWorld ? [] : ctx.getWebSockets()) {
      if (socket.readyState !== 1) continue;
      const info = socket.deserializeAttachment();
      if (!info) continue;
      if(info.bog)continue;
      const actor = recoverIsland(info.actor && this.session(info.digest)?.canPlay ? {islandId:'home',mode:'walking',boatId:null,...info.actor, action:0, travel:0, path:[], until:0,jumpLeft:0} : null);
      const login = info.login ?? (actor ? this.session(info.digest)?.login : null);
      const restored = {...info, actor, islandId:actor?.islandId ?? (islandFor(info.islandId) ? info.islandId : 'home'), login, input:ZERO, inputExpires:0, tokens:SOCKET_COMMAND_BURST, tokenTime:Date.now()};
      this.connections.set(socket, restored);
      if (restored.globeFeed && restored.globeSubscriptionId !== undefined) this.globeSubscribers.add(socket);
      this.recoverSailingPosition(actor);
      this.attach(socket, restored);
    }
    if (!inactiveWorld) {
      this.restoreCheckpoints(Date.now());
      this.reconcileBoats();
    }
    this.karma=new RoomKarma(this);
    for(const socket of inactiveWorld ? [] : ctx.getWebSockets()){
      const saved=socket.readyState===1&&socket.deserializeAttachment()?.bog;
      if(saved&&!(this.bog??=new LiveBogRoom(this)).open(socket,saved))socket.close(1008,'Bog visit ended');
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
    this.updateGlobeTimer();
    ctx.waitUntil(this.scheduleExpiry());
  }

  navFor(islandId='home') { return navOf(islandId); }

  restoreCheckpoints(now) {
    // A reset can remove the sockets before webSocketClose gets a chance to save a resume.
    const live = new Set([...this.connections.values()].filter(info => info.actor).map(info => info.account));
    const orphaned = [...this.savedCheckpointRows.values()].filter(row => !live.has(row.account));
    if (!orphaned.length) return;
    const restore = () => {
      for (const row of orphaned) {
        const session = this.session(row.digest, now);
        if (this.simulation || session?.canPlay && session.account === row.account) {
          this.sql.exec('INSERT OR IGNORE INTO resumes VALUES(?,?,?)', row.account, row.pose, this.simulation ? Number.MAX_SAFE_INTEGER : now+RESUME_MS);
        }
        this.sql.exec('DELETE FROM room_checkpoints WHERE account=?', row.account);
      }
    };
    if (this.ctx.storage.transactionSync) this.ctx.storage.transactionSync(restore);
    else restore();
    for (const {account} of orphaned) this.savedCheckpointRows.delete(account);
  }

  saveBoats(now = Date.now(), departed = null) {
    // Commit sailing poses with their boats so a restart can't restore different versions of them.
    for(const boat of this.boats)boat.seaVersion=SEA_VERSION;
    const next = new Map(this.boats.map(boat => [String(boat.id), JSON.stringify(boat)]));
    const checkpoints = new Map();
    for (const {actor, account, digest, expires} of this.connections.values()) {
      if (actor && account && digest && expires > now) checkpoints.set(account, {digest, pose:JSON.stringify(savedPose(actor))});
    }
    const changedBoats = [...next].filter(([id, state]) => this.savedBoatRows.get(id) !== state);
    const removedBoats = [...this.savedBoatRows.keys()].filter(id => !next.has(id));
    const changedCheckpoints = [...checkpoints].filter(([account, row]) => {
      const previous = this.savedCheckpointRows.get(account);
      return previous?.digest !== row.digest || previous.pose !== row.pose;
    });
    const removedCheckpoints = [...this.savedCheckpointRows.keys()].filter(account => !checkpoints.has(account));
    this.checkpointAt = now + CHECKPOINT_MS;
    if (!changedBoats.length && !removedBoats.length && !changedCheckpoints.length &&
        !removedCheckpoints.length && !this.legacyBoats && !departed) return;
    const save = () => {
      for (const [id, state] of changedBoats) {
        this.sql.exec('INSERT OR REPLACE INTO boat_states VALUES(?,?)', id, state);
      }
      for (const id of removedBoats) this.sql.exec('DELETE FROM boat_states WHERE id=?', id);
      for (const [account, {digest, pose}] of changedCheckpoints) {
        this.sql.exec('INSERT OR REPLACE INTO room_checkpoints VALUES(?,?,?)', account, digest, pose);
      }
      for (const account of removedCheckpoints) this.sql.exec('DELETE FROM room_checkpoints WHERE account=?', account);
      if (departed) {
        this.sql.exec('INSERT OR REPLACE INTO resumes VALUES(?,?,?)',
          departed.account, JSON.stringify(savedPose(departed.actor)), this.simulation ? Number.MAX_SAFE_INTEGER : now+RESUME_MS);
      }
      if (this.legacyBoats) this.sql.exec('DELETE FROM boats WHERE id=1');
    };
    if (this.ctx.storage.transactionSync) this.ctx.storage.transactionSync(save);
    else save();
    this.savedBoatRows = next;
    this.savedCheckpointRows = checkpoints;
    this.legacyBoats = false;
    return true;
  }

  parkBoat(boat,landing=null) {
    retireBoat(this.boats,boat,landing,this.simulation?.owner ?? null);
    this.boatsDirty = true;
  }

  releaseBoat(actorId) {
    const boat=this.boats.find(boat => boat.occupant === actorId);
    if (boat) this.parkBoat(boat);
  }

  reconcileBoats() {
    const retained=new Set([...this.connections.values()].filter(info => info.actor).map(info => info.actor.id));
    if (this.simulation) for (const row of this.sql.exec('SELECT pose FROM resumes WHERE expires>?',Date.now())) retained.add(JSON.parse(row.pose).id);
    for (const row of this.sql.exec('SELECT r.pose FROM resumes r JOIN sessions s ON s.account=r.account WHERE r.expires>? AND s.expires>? AND s.can_play=1',Date.now(),Date.now()).toArray()) retained.add(JSON.parse(row.pose).id);
    for (const boat of [...this.boats]) if (boat.occupant && !retained.has(boat.occupant)) this.parkBoat(boat);
    fillMoorings(this.boats, this.simulation?.owner ?? null);
    this.saveBoats();
  }

  recoverSailingPosition(actor) {
    if (actor?.mode !== 'sailing') return false;
    const boat = this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
    if(!boat)return false;
    if(canSail(actor.x,actor.y,actor.islandId) && boatRoom(actor,this.boats)) {
      if(boat.x!==actor.x||boat.y!==actor.y||boat.islandId!==actor.islandId){Object.assign(boat,{x:actor.x,y:actor.y,islandId:actor.islandId,seaVersion:SEA_VERSION});return true;}
      return false;
    }
    const reserved=[...this.boats,...boatSpots(actor.islandId).map((p,i)=>({...p,islandId:actor.islandId,id:`reserved-${i}`}))];
    const position=freeBoatPosition(actor,reserved,520) ??
      freeBoatPosition({...actor,...harborOf(actor.islandId).water},reserved,4160);
    if (!position) return false;
    const {x, y} = position, docking=actor.docking && near(position,harborOf(actor.islandId).water,650);
    Object.assign(actor, {x, y, travel:0, sailTarget:null, sailRoute:null, docking:Boolean(docking), dockTarget:docking?position:null, exitLocked:false,seaVersion:SEA_VERSION});
    Object.assign(boat, {x, y, islandId:actor.islandId,seaVersion:SEA_VERSION});
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
      if (this.sql.exec('SELECT count(*) AS count FROM flows WHERE expires>?', now).one().count >= 256) return reply({}, 429);
      this.sql.exec('INSERT INTO flows VALUES(?,?,?)', data.state, data.verifier, now+FLOW_MS);
      this.ctx.waitUntil(this.scheduleExpiry());
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
      this.ctx.waitUntil(this.scheduleExpiry());
      return reply({});
    }
    if (pathname === '/session/get') return reply(this.session(data.digest));
    if (pathname === '/session/access' || pathname === '/session/revoke') return this.updateSession(pathname,data,now);
    return reply({}, 404);
  }

  updateSession(pathname,data,now = Date.now()) {
    if (pathname === '/session/access') {
      this.sql.exec('UPDATE sessions SET can_play=? WHERE digest=?', data.canPlay === true ? 1 : 0, data.digest);
      const checked = this.session(data.digest, now);
      if (checked && typeof data.starred === 'boolean') this.stargazer(checked.account, data.starred);
      if (!data.canPlay) {
        const user = this.session(data.digest);
        if (user && !this.simulation) this.sql.exec('DELETE FROM resumes WHERE account=?',user.account);
        for (const [socket,info] of this.connections) {
          if (info.digest === data.digest && info.actor) this.demote(socket,info,'star-required');
        }
        this.reconcileBoats();
        this.broadcast();
      }
      return reply({});
    }
    if (pathname === '/session/revoke') {
      this.sql.exec('DELETE FROM sessions WHERE digest=?', data.digest);
      for (const [socket, info] of this.connections) {
        if (info.digest === data.digest) this.demote(socket, info, 'signed-out');
      }
      this.reconcileBoats();
      this.broadcast();
      this.ctx.waitUntil(this.scheduleExpiry());
      return reply({});
    }
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
    // Where each friend is right now, if they are playing, so the mini-map and globe can show them.
    // Friends only: requests and strangers never get a location.
    const now = Date.now(), playing = new Map();
    if (friends.length) for (const info of this.connections.values())
      if (info.actor && info.account && info.expires > now) playing.set(String(info.account), info);
    for (const friend of friends) {
      const live = playing.get(String(friend.accountId));
      if (live) friend.where = {islandId:live.actor.islandId, x:Math.round(live.actor.x), y:Math.round(live.actor.y), mode:live.actor.mode};
    }
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

  friends(data, now, nearbyAccount = null) {
    const user = this.session(data.digest, now);
    if (!user) return reply({error:'Please sign in again to manage friends.'}, 401);
    if (data.method === 'GET') return reply(this.friendState(user.account));
    let account;
    if (data.method === 'POST' && nearbyAccount) {
      if (nearbyAccount === user.account) return reply({},400);
      account = nearbyAccount;
    } else if (data.method === 'POST') {
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

  standable({islandId = 'home', x, y}) {
    return Number.isFinite(x) && Number.isFinite(y) && canWalkTo(islandId, x, y) && this.navFor(islandId).walkable(x, y);
  }

  pickSpawn(_account, occupied) {
    if (this.simulation && this.simulation.owner !== 'home') return null;
    const home = mapOf('home');
    return pickWorldSpawn({occupied, hasRoom:id => id === 'home'}) ??
      {islandId:'home', ...home.spawn, name:islandFor('home').name};
  }

  join(request, now) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply({}, 426);
    const digest = request.headers.get('X-Session-Digest');
    const user = this.session(digest, now);
    const params = new URL(request.url).searchParams;
    const wantsPlayer = params.get('play') === '1';
    const globeFeed = params.get('globeFeed') === '1';
    const resumeId = params.get('resume');
    const canPlay = user?.canPlay && wantsPlayer;
    const previous = canPlay ? [...this.connections].find(([,info]) => info.actor && info.account === user.account) : undefined;
    const resume = canPlay && this.sql.exec('SELECT pose FROM resumes WHERE account=? AND expires>?', user.account, now).toArray()[0];
    // A transport reconnect sends its previous player ID.
    // Revalidate walking poses in case the map changed while the room was offline.
    const resumed = resume ? JSON.parse(resume.pose) : null;
    const live = previous?.[1].actor;
    const resumable = (resumeId && resumed?.id === resumeId || this.simulation && resumed) &&
      (resumed.mode !== 'walking' || !islandFor(resumed.islandId) || this.standable(resumed));
    const from = (live && (live.id === resumeId || this.simulation) ? live : null) ?? (resumable ? resumed : null);
    let spawn = null;
    if (canPlay && !from) {
      const actors = [...this.connections.values()].flatMap(info => info.actor ? [info.actor] : []);
      const held = this.sql.exec('SELECT pose FROM resumes WHERE expires>?', now).toArray().map(row => JSON.parse(row.pose));
      spawn = this.pickSpawn(user.account, [...actors, ...held]);
    }
    const playing = Boolean(canPlay && (from || spawn));
    const [client, socket] = Object.values(new WebSocketPair());
    const info = {actor:null, ...(this.simulation && {generation:Number(request.headers.get('X-Owner-Generation')),islandId:this.simulation.owner}), digest:user ? digest : null, account:user?.account, expires:user?.expires, login:user?.login, globeFeed,
      input:ZERO, inputExpires:0, tokens:SOCKET_COMMAND_BURST, tokenTime:now, ack:0, lastDestination:-Infinity, lastEmote:-Infinity};
    if (playing) {
      const [x,y] = mapOf('home').world.zones.plaza.spawn;
      const savedOutfit = this.sql.exec('SELECT outfit FROM outfits WHERE account=?',user.account).toArray()[0];
      const outfit = savedOutfit ? JSON.parse(savedOutfit.outfit) : validOutfit(from?.outfit) ? from.outfit : randomOutfit();
      if (!savedOutfit) this.sql.exec('INSERT INTO outfits (account,outfit) VALUES(?,?)',user.account,JSON.stringify(outfit));
      const pose = from ?? {islandId:spawn.islandId, x:spawn.x, y:spawn.y};
      info.actor = {id:crypto.randomUUID(), turn:0, emoteVersion:0,
        islandId:'home',mode:'walking',boatId:null,...pose,outfit, action:0,travel:0,until:0,path:[],jumpLeft:0};
      recoverIsland(info.actor);
      this.recoverSailingPosition(info.actor);
      if(!this.simulation && (info.actor.islandId!==BOG_ISLAND||info.actor.mode!=='walking'))this.karma.endBogEntry(user.account);
      info.actor.karma=this.karma.balance(user.account);
      if (mapOf(info.actor.islandId).home && info.actor.mode === 'walking' && atMuseumDoor(info.actor.x,info.actor.y)) Object.assign(info.actor,{x,y,turn:0});
      this.sql.exec('DELETE FROM resumes WHERE account=?', user.account);
      if (live && live.id !== from?.id) this.releaseBoat(live.id);
      if (resumed && resumed.id !== from?.id) this.releaseBoat(resumed.id);
      if (previous) this.demote(previous[0], previous[1], 'taken-over');
    }
    this.ctx.acceptWebSocket(socket);
    this.connections.set(socket, info);
    if (playing) {
      info.ack = Number(request.headers.get('X-Transfer-Ack')) || 0;
      this.saveBoats(now);
    }
    this.attach(socket, info);
    this.send(socket, {type:'welcome', id:info.actor?.id ?? null,...(this.simulation && {protocol:2,ack:info.ack}),
      ...(globeFeed ? {globeFeed:true} : {}),
      ...(spawn ? {arrival:spawn.name} : {}),
      reason:user && wantsPlayer && !user.canPlay ? 'star-required' : null});
    if (playing && !previous && !resume) {
      for (const [viewer,viewerInfo] of this.connections) {
        if (viewer === socket || viewerInfo.account === user.account) continue;
        if ((viewerInfo.actor?.islandId ?? viewerInfo.islandId ?? 'home') !== info.actor.islandId) continue;
        this.send(viewer,{type:'joined',id:info.actor.id,
          ...(viewerInfo.digest && viewerInfo.expires > now ? {login:user.login} : {})});
      }
    }
    this.broadcast(socket);
    if (this.connections.size > 1) this.schedulePresenceBroadcast();
    this.ctx.waitUntil(this.scheduleExpiry());
    return new Response(null, {status:101, webSocket:client});
  }

  attach(socket, info) {
    const {actor,account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId,deltas,globeFeed,globeSubscriptionId} = info;
    info.lastAttachmentAt = Date.now();
    socket.serializeAttachment({...(this.simulation && {generation:info.generation,transferring:info.transferring}),actor:actor ? savedPose(actor) : null, account,digest,expires,login,ack,lastDestination,lastEmote,tokens,tokenTime,islandId,deltas,globeFeed,globeSubscriptionId});
  }

  send(socket, message) {
    if (socket.readyState !== 1) return;
    try { socket.send(JSON.stringify(message)); } catch { socket.close(1011, 'Connection lost'); }
  }

  serializeGlobePlayers(named, now) {
    const players = [];
    for (const info of this.connections.values()) {
      if (!info.actor || (info.expires && info.expires <= now)) continue;
      const {id, islandId = 'home', x, y, mode = 'walking'} = info.actor;
      players.push({id, islandId, x:r2(x), y:r2(y), mode, ...(named && info.login ? {login:info.login} : {})});
    }
    return JSON.stringify(players);
  }

  broadcastGlobe(recipients = this.globeSubscribers) {
    const now = Date.now(), lists = new Map();
    for (const socket of recipients) {
      const info = this.connections.get(socket);
      if (!info || socket.readyState !== 1) {
        this.globeSubscribers.delete(socket);
        continue;
      }
      const named = Boolean(info.digest && info.expires > now);
      if (!lists.has(named)) lists.set(named, this.serializeGlobePlayers(named, now));
      this.sendText(socket, `{"type":"globe-players","subscriptionId":${info.globeSubscriptionId},"players":${lists.get(named)}}`);
    }
    this.updateGlobeTimer();
  }

  updateGlobeTimer() {
    if (this.globeSubscribers.size && this.globeTimer == null) {
      this.globeTimer = setInterval(() => this.broadcastGlobe(), GLOBE_UPDATE_MS);
    } else if (!this.globeSubscribers.size && this.globeTimer != null) {
      clearInterval(this.globeTimer);
      this.globeTimer = null;
    }
  }

  schedulePresenceBroadcast() {
    if (!this.connections.size) {
      this.clearPresenceBroadcast();
    } else if (this.presenceTimer == null) {
      this.presenceTimer = setTimeout(() => this.broadcast(), PRESENCE_UPDATE_MS);
    }
  }

  clearPresenceBroadcast() {
    if (this.presenceTimer == null) return;
    clearTimeout(this.presenceTimer);
    this.presenceTimer = null;
  }

  broadcast(target = null) {
    if (!target) this.clearPresenceBroadcast();
    const info = target ? this.connections.get(target) : null;
    if (target ? !info : !this.connections.size) return;
    const recipients = target ? [[target, info]] : this.connections;
    const now = Date.now();
    if (this.simulation) this.broadcastKarma(now, recipients);
    else this.karma.broadcast(now, recipients);
    const online = this.remotePresence?.online ?? new Set([...this.connections].map(([socket,info]) =>
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
    const liveAccounts = this.simulation && new Set([...this.connections.values()].filter(i=>i.actor).map(i=>i.account));
    for (const peer of this.remotePresence?.players ?? []) {
      if (!peer.pose || peer.owner === this.simulation.owner || liveAccounts.has(peer.account) ||
          (peer.owner !== 'sea' && this.simulation.owner !== 'sea')) continue;
      const island = peer.pose.islandId;
      if (!groups.has(island)) groups.set(island,{guests:[],named:[]});
      groups.get(island).guests.push(peer.pose);
      groups.get(island).named.push({...peer.pose,login:peer.login,accountId:peer.account});
    }
    if(this.simulation && now >= (this.farPosesAt ?? 0)) {
      this.farPoses=new Map();
      for(const group of groups.values()) for(const pose of group.guests) {
        this.farPoses.set(pose.id,{x:pose.x,y:pose.y,turn:pose.turn,travel:pose.travel,islandId:pose.islandId});
      }
      this.farPosesAt=now+1000;
    }
    const boatsForView = this.remoteBoats ? [...this.boats,...this.remoteBoats] : this.boats;
    const legacyGlobeFields = new Map();
    const shared = new Map(), empty = {guests:[], named:[]};
    const snapshotView = (islandId, named, info) => {
      const combatSelf=!!info.actor&&combatAccounts.has(info.account);
      // Main-island walkers share a canonical packet, including wrapped sailors.
      // Islet visitors and sailors need the periodic image around their position.
      const actor=info.actor,m=mapOf(islandId);
      const onIslet=actor&&ISLETS.some(i=>{if(i.home!==actor.islandId)return false;const p=FLAT_ISLETS[i.id];return near(actor,{x:m.cx+p.x,y:m.cy+p.y},i.radius+200);});
      const chartViewer=actor&&(actor.mode==='sailing'||onIslet)?actor:null;
      const localViewer={islandId,x:m.cx,y:m.cy};
      // Cache viewers in the same square together. Players within one square
      // of any viewer in it keep the full update rate; distant motion is sampled.
      const cell = this.simulation && actor && !chartViewer && (groups.get(islandId)?.guests.length ?? 0)>=40 ?
        {x:Math.floor(actor.x/1024),y:Math.floor(actor.y/1024)} : null;
      const key = `${named ? 1 : 0}|${islandId}${cell?'|cell:'+cell.x+','+cell.y:''}${chartViewer?'|sea:'+chartViewer.id:''}${combatSelf?'|'+info.account:''}`;
      if (!shared.has(key)) {
        const group = groups.get(islandId) ?? empty;
        let poses=named?group.named:group.guests;
        if(cell) poses=poses.map(p=>{
          if(Math.abs(Math.floor(p.x/1024)-cell.x)<=1 && Math.abs(Math.floor(p.y/1024)-cell.y)<=1) return p;
          const prior=this.farPoses?.get(p.id);
          return prior?.islandId===p.islandId ? {...p,...prior}:p;
        });
        if(chartViewer) {
          poses=[...groups.values()].flatMap(g=>named?g.named:g.guests).map(p=>seaViewPose(info.actor,p,p.islandId===islandId?Infinity:8000))
            .filter(p=>p && (p.islandId===islandId || info.actor.mode==='sailing' || p.mode==='sailing'));
        } else if(localViewer)poses=poses.map(p=>seaViewPose(localViewer,p));
        const visibleBoats=chartViewer?boatsForView.map(b=>seaViewPose(info.actor,b,b.islandId===islandId?Infinity:8000)).filter(Boolean):boatsForView.filter(b=>b.islandId===islandId).map(b=>localViewer?seaViewPose(localViewer,b):b);
        const players=combatSelf?[...poses,{...wirePose(info.actor),...(named?{login:info.login,accountId:info.account}:{})}]:poses;
        shared.set(key, {key, players, boats: visibleBoats.map(wireBoat)});
      }
      return shared.get(key);
    };
    const snapshotPrefix = `{"type":"snapshot","epoch":${JSON.stringify(this.epoch)},"tick":${tick},"online":${online}`;
    const fullSnapshot = (view, islandId, self, globeField) => {
      view.text ??= snapshotPrefix + `,"islandId":${JSON.stringify(islandId)},"boats":${JSON.stringify(view.boats)},"players":${JSON.stringify(view.players)},"self":`;
      return view.text + JSON.stringify(self) + globeField + '}';
    };
    // built boats by owner, once per broadcast (each player's self block lists theirs)
    const owned = new Map();
    for (const boat of this.boats) if (boat.owner) owned.set(boat.owner, [...(owned.get(boat.owner) ?? []), boat.id]);
    for (const [socket, info] of recipients) {
      if (info.transferring) continue;
      if (this.simulation && info.deltas) {
        if ((info.unacknowledged ??= []).length >= 3) {
          info.snapshotMissed = true;
          continue;
        }
        if (info.snapshotMissed) info.snapshotBase = null;
        info.snapshotMissed = false;
        info.unacknowledged.push(tick);
      }
      const actor = info.actor;
      const islandId = actor?.islandId ?? info.islandId ?? 'home';
      const self = actor ? {ack:info.ack, path:actor.path, sailTarget:actor.sailTarget ?? null, docking:!!actor.docking, emoteLeft:Math.max(0,actor.until-now/1000),ice:actor.ice??null,reducedMotion:actor.reducedMotion===true,
        ownBoats:owned.get(info.account) ?? []} : null;
      const named = !!(info.digest && info.expires > now);
      let globeField = '';
      if (!info.globeFeed) {
        if (!legacyGlobeFields.has(named)) legacyGlobeFields.set(named, `,"globePlayers":${this.serializeGlobePlayers(named, now)}`);
        globeField = legacyGlobeFields.get(named);
      }
      const view = snapshotView(islandId, named, info);
      if (!info.deltas) {this.sendText(socket, fullSnapshot(view, islandId, self, globeField)); continue;}
      // A delta must describe the same chart and visibility as its full snapshot.
      const {key} = view;
      if (!view.deltaGroup) {
        view.deltaGroup = {tick, players: new Map(view.players.map(p => [p.id, p])), boats: new Map(view.boats.map(b => [b.id, b])), patches: new WeakMap()};
      }
      const group = view.deltaGroup;
      const base = info.snapshotBase;
      if (!base || base.key !== key || tick - base.fullTick >= 50) {
        this.sendText(socket, fullSnapshot(view, islandId, self, globeField));
        info.snapshotBase = {key, group, fullTick: tick};
        continue;
      }
      let patch = group.patches.get(base.group);
      if (!patch) {
        const diff = (before, after) => ({
          changed: [...after].flatMap(([id, value]) => {
            const old = before.get(id);
            if (!old) return [value];
            const fields = Object.fromEntries(Object.entries(value).filter(([field, v]) => v !== old[field] &&
              (typeof v !== 'object' || JSON.stringify(v) !== JSON.stringify(old[field]))));
            return Object.keys(fields).length ? [{id, ...fields}] : [];
          }),
          removed: [...before.keys()].filter(id => !after.has(id)),
        });
        patch = {players: diff(base.group.players, group.players), boats: diff(base.group.boats, group.boats)};
        group.patches.set(base.group, patch);
      }
      const delta = JSON.stringify({type: 'delta', epoch: this.epoch, tick, baseTick: base.group.tick, islandId, online, ...patch, self});
      this.sendText(socket, globeField ? delta.slice(0, -1) + globeField + '}' : delta);
      info.snapshotBase = {key, group, fullTick: base.fullTick};
    }
  }

  sendText(socket, text) {
    if (socket.readyState !== 1) return;
    try { socket.send(text); } catch { socket.close(1011, 'Connection lost'); }
  }

  demote(socket, info, reason) {
    if (info.actor && reason !== 'taken-over') {
      if (this.simulation) this.saveBoats(Date.now(),info);
      else this.releaseBoat(info.actor.id);
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
    if (changed) {
      this.saveBoats(now);
      this.broadcast();
    }
  }

  async scheduleExpiry() {
    const {next} = this.sql.exec('SELECT min(next) AS next FROM (SELECT min(expires) AS next FROM flows UNION ALL SELECT min(expires) AS next FROM sessions UNION ALL SELECT min(expires) AS next FROM resumes WHERE expires<9007199254740991)').one();
    if (next === this.expiryAt) return;
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
    this.expiryAt = next;
  }

  async alarm() {
    const now = Date.now();
    this.expiryAt = undefined;
    this.prune(now);
    this.expire(now);
    this.broadcast();
    await this.scheduleExpiry();
  }

  webSocketMessage(socket, message) {
    if(this.bog?.members.has(socket)){this.bog.message(socket,message);return;}
    const info = this.connections.get(socket);
    if (!info || info.transferring) return;
    const now = Date.now();
    const expired = info.expires && now >= info.expires;
    if (expired) {
      this.expire(now);
      this.ctx.waitUntil(this.scheduleExpiry());
      if (!this.connections.has(socket)) return;
    }
    let rejectionReason;
    if (typeof message !== 'string') rejectionReason = 'non_text_message';
    else if (message.length > 512) rejectionReason = 'message_too_large';
    if (rejectionReason) {
      const closeCode = 1008;
      this.reportSocketRejection?.(rejectionReason, closeCode);
      socket.close(closeCode, 'Invalid or excessive commands');
      return;
    }
    let command;
    try { command = JSON.parse(message); } catch { return; }
    if (command?.type === 'snapshot-ack' && this.simulation) {
      if (command.epoch === this.epoch && info.unacknowledged?.includes(command.tick)) {
        info.unacknowledged = info.unacknowledged.filter(tick => tick > command.tick);
        if (info.snapshotMissed && !this.timer) this.broadcast(socket);
      }
      return;
    }
    if (!takeCommandToken(info, now)) {
      const actor = info.actor;
      const lastSequence = Math.max(info.ack, info.throttled?.seq ?? 0);
      if (!actor || expired || !Number.isSafeInteger(command?.seq) || command.seq <= lastSequence) return;
      // Only movement may be deferred. Acknowledge dropped actions on the next
      // tick so the client can clear any prediction for them.
      let movement = info.throttled?.movement;
      if (command.type === 'input' && validMovementInput(command) && (!command.islandId || command.islandId === actor.islandId)) {
        movement = {command, islandId: actor.islandId, mode: actor.mode, receivedAt: now};
      }
      info.throttled = {seq: command.seq, movement};
      if (!this.timer) this.timer = setInterval(() => this.step(),50);
      return;
    }
    if (command?.type === 'globe-subscription') {
      const {open, subscriptionId} = command;
      if (!info.globeFeed || typeof open !== 'boolean' || !Number.isSafeInteger(subscriptionId) || subscriptionId < 1) return;
      const activeId = open ? subscriptionId : undefined;
      if (activeId === info.globeSubscriptionId) return;
      info.globeSubscriptionId = activeId;
      this.attach(socket, info);
      if (open) {
        this.globeSubscribers.add(socket);
        this.broadcastGlobe([socket]);
      } else {
        this.globeSubscribers.delete(socket);
        this.updateGlobeTimer();
      }
      return;
    }
    if (expired) return;
    if (command?.type === 'updates') {
      if (info.deltas) return;
      info.deltas = true;
      info.snapshotBase = null;
      this.attach(socket, info);
      this.broadcast(socket);
      return;
    }
    if (command?.type === 'watch' && !info.actor && islandFor(command.islandId)) {
      if (this.simulation || (info.islandId ?? 'home') === command.islandId) return;
      info.islandId = command.islandId;
      info.snapshotBase = null;
      this.attach(socket,info);
      this.broadcast(socket);
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
    if (!command || !Number.isSafeInteger(command.seq) || command.seq <= Math.max(info.ack, info.throttled?.seq ?? 0)) return;
    const actor = info.actor;
    if (command.islandId && command.islandId !== actor.islandId) {
      info.ack=command.seq; this.attach(socket,info); this.broadcast(); return;
    }
    switch (command.type) {
      case 'jump':
        startJump(actor);
        break;
      case 'input':
        if (!validMovementInput(command)) return;
        this.applyMovementInput(info, command, now);
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
          if (actor.mode === 'sailing') setSailDestination(actor,command.x,command.y,this.boats);
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
        const spot=strandedIslet(actor.islandId,actor,usable) && buildSpot(actor.islandId,actor,this.boats);
        if (!spot) {this.send(socket,{type:'travel-notice',text:'Walk to the edge of the island to build your boat.'}); break;}
        info.lastBuild=now;
        if (this.simulation) {
          this.buildBoat(info,spot);
          break;
        }
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
          if (!spot) {this.send(socket,{type:'travel-notice',text:HARBOR_ONLY.has(actor.islandId)?'Boats land at the dock on Booquack Bog.':'Sail closer to the shore to dock.'}); break;}
          if (!spot.islet&&!this.allowLanding(socket,info,spot.islandId)) break;
          info.input=ZERO; info.landing=null;
          actor.sailTarget=null; actor.sailRoute=null; actor.docking=false;
          if (spot.harbor) {
            const {water}=harborOf(actor.islandId);
            const target=setSailDestination(actor,water.x,water.y,this.boats);
            actor.docking=Boolean(target);
            actor.dockTarget=target?{x:target[0],y:target[1]}:null;
            break;
          }
          spot.approach=landingApproach(actor,spot,this.boats);
          info.landing=spot;
          if (!near(actor,spot.approach,14) && !setSailDestination(actor,spot.approach.x,spot.approach.y,this.boats)) info.landing={...spot,approach:{x:actor.x,y:actor.y}};
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
    if (command.type !== 'input' || now - (info.lastAttachmentAt ?? 0) >= CHECKPOINT_MS) this.attach(socket, info);
    if (!this.timer) this.timer = setInterval(() => this.step(),50);
  }

  applyMovementInput(info, command, receivedAt) {
    const actor = info.actor;
    if (command.x || command.y) {info.boarding = null; info.landing = null;}
    else if (command.stop === true) info.boarding = null;
    if (command.stop === true && !info.landing) {actor.path=[];actor.sailTarget=null;actor.docking=false;actor.pace=0;actor.heading=null;}
    info.input = {x:command.x,y:command.y,run:command.run === true};
    if (typeof command.reducedMotion==='boolean') actor.reducedMotion=command.reducedMotion;
    info.inputExpires = receivedAt + INPUT_TIMEOUT_MS;
  }

  applyThrottledCommands(info, now) {
    const {seq, movement} = info.throttled;
    if (movement && movement.command.seq > info.ack && now - movement.receivedAt < INPUT_TIMEOUT_MS &&
        movement.islandId === info.actor.islandId && movement.mode === info.actor.mode) {
      if (!takeCommandToken(info, now)) return;
      this.applyMovementInput(info, movement.command, movement.receivedAt);
    }
    info.ack = Math.max(info.ack, seq);
    info.throttled = null;
  }

  step() {
    const now = Date.now();
    let active = false;
    let changedTravel = false;
    this.expire(now);
    for (const [socket, info] of this.connections) {
      const actor = info.actor;
      if (!actor) continue;
      if (info.throttled) {
        this.applyThrottledCommands(info, now);
        active ||= Boolean(info.throttled);
      }
      if (now >= info.inputExpires) info.input = ZERO;
      const previousBoat = actor.boatId;
      const crossing = this.simulation && (info.boarding || info.landing || actor.docking);
      const before = crossing && {actor:structuredClone(actor),
        boat:structuredClone(this.boats.find(b=>b.id === (previousBoat ?? info.boarding)) ?? null)};
      if (actor.mode === 'sailing') {
        this.recoverSailingPosition(actor);
        sailStep(actor,.05,info.input,now/1000,this.boats);
        const boat=this.boats.find(boat => boat.id === actor.boatId && boat.occupant === actor.id);
        if (!boat) info.landing=null;
        if (boat) {
          if (!info.landing && crossIsland(actor,id=>this.allowLanding(socket,info,id),this.boats)) {
            changedTravel = true;
            info.input=ZERO;
            info.inputExpires=0;
          }
          Object.assign(boat,{x:actor.x,y:actor.y,turn:actor.turn,islandId:actor.islandId});
          if (info.landing && (near(actor,info.landing.approach,14) || !actor.sailTarget)) {
            const spot=info.landing; info.landing=null;
            if (!spot.islet&&!this.allowLanding(socket,info,spot.islandId)) continue;
            if(!spot.islet&&!this.chargeBogLanding(socket,info,spot.islandId))continue;
            Object.assign(actor,spot.islet?reframeIslet(actor.islandId,spot.islandId,ISLETS.find(i=>i.id===spot.islet),actor):unplaceRigid(actor.islandId,spot.islandId,actor)); actor.islandId=spot.islandId; info.islandId=spot.islandId;
            Object.assign(boat,{x:actor.x,y:actor.y,islandId:actor.islandId});
            this.parkBoat(boat,spot);
            changedTravel = true;
            Object.assign(actor,{x:spot.x,y:spot.y,mode:'walking',boatId:null,path:[],travel:0,pace:0,heading:null,docking:false,sailTarget:null,sailRoute:null});
            info.input=ZERO;
          } else if (actor.docking && near(actor,actor.dockTarget??harborOf(actor.islandId).water,12)) {
            if (!this.allowLanding(socket,info,actor.islandId)||!this.chargeBogLanding(socket,info,actor.islandId)) continue;
            Object.assign(boat,unplaceRigid(actor.islandId,actor.islandId,boat));
            this.parkBoat(boat);
            changedTravel = true;
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
          // A boat someone else holds is taken; a free boat you could not walk to is out of reach.
          if (!boat || boat.occupant) this.send(socket,{type:'travel-notice',text:'Boat taken.'});
          else if (!aboard) this.send(socket,{type:'travel-notice',text:"Can't walk to that boat from here."});
          else {
            if(actor.islandId===BOG_ISLAND)this.karma.endBogEntry(info.account);
            boat.occupant=actor.id; boat.departure=actor.islandId;
            if (boat.landing) boat.landing=null;
            Object.assign(actor,{x:boat.x,y:boat.y,turn:boat.turn,mode:'sailing',boatId:boat.id,action:0,until:0,travel:0,pace:0,heading:null,sailTarget:null,exitLocked:false,jumpLeft:0});
            changedTravel = true;
            info.input=ZERO;
          }
        }
      }
      if (this.simulation && this.transferIfNeeded(socket, info, previousBoat, before)) continue;
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
    if (this.simulation) this.updateKarma(now);
    else this.karma.update(now);
    for (const [socket, info] of this.connections) {
      if (info.actor && (changedTravel || !active || now - (info.lastAttachmentAt ?? 0) >= CHECKPOINT_MS)) this.attach(socket, info);
    }
    if (changedTravel || this.boatsDirty || now >= this.checkpointAt || !active) {
      if ((changedTravel || this.boatsDirty || this.boats.some(boat => boat.occupant)) && fillMoorings(this.boats, this.simulation?.owner ?? null)) active=true;
      this.boatsDirty = false;
      this.saveBoats(now);
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
    if (this.globeSubscribers.delete(socket)) this.updateGlobeTimer();
    if (info.actor) {
      const now = Date.now();
      const resumable = this.simulation || this.session(info.digest,now)?.canPlay;
      if (!resumable) this.releaseBoat(info.actor.id);
      this.saveBoats(now, resumable ? info : null);
    }
    this.schedulePresenceBroadcast();
    this.ctx.waitUntil(this.scheduleExpiry());
  }

  webSocketError(socket) {
    this.webSocketClose(socket);
    socket.close(1011, 'Connection lost');
  }
}

export default {fetch:() => new Response('Not found', {status:404})};
