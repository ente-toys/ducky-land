import {authenticateTestSocket} from '../app/test-session.js';
import {nearestSeaX} from '../world/flat-layout.js';
import {nearbyCell} from './nearby.js';
import {isletAt} from '../world/islet-walk.js';
import {takeArrivalSocket} from '../app/arrival-start.js';
import {DURATIONS, playEmote, playSailEmote, RUN_SPEED, WALK_SPEED, SAIL_EMOTES, startJump, setWalkDestination, walkStep} from '../gameplay/player-motion.js';
import {CHAT_INTERVAL, chatText} from './chat.js';
import {nearbyFriend} from './friends.js';
import {mapOf,islandMapReady} from '../world/island-maps.js';
import {getPlayerKarma} from '../features/bog-combat/karma.js';
import {bogLandingNotice} from '../features/bog-combat/entry.js';
import {BOAT_UNVEIL} from '../gameplay/boat-build.js';
import {islandFor, harborOf, destinationsFor, near, dockingSpot, refusedLandingPosition, landingApproach, setSailDestination, sailStep, SAIL_SPEED, createBoats, fillMoorings, retireBoat, navOf, canWalkTo} from '../gameplay/islands.js';

const ZERO = {x:0,y:0};
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 9000;
const POSITION_SNAP_DISTANCE = 90;
const PEER_BLEND_SECONDS = .05;
const PEER_LEAD_SECONDS = .05;
const PEER_DELAY_SECONDS = .25;
const moving = input => input.x !== 0 || input.y !== 0;
const nowSeconds = () => performance.now() / 1000;

function sample(track, now) {
  const {from,to,start,poseAt=start,blendSeconds=.1,vx=0,vy=0} = track;
  const age = Math.max(0, now-start);
  const blend = Math.min(1, age / blendSeconds);
  const lead = Math.min(PEER_LEAD_SECONDS, Math.max(0, age-blendSeconds));
  const turn = to.turn - from.turn;
  const walkingCorrection = track.recovery && to.mode === 'walking' && to.action <= 1 && blend < 1
    ? Math.hypot(to.x-from.x,to.y-from.y)/blendSeconds : 0;
  return {...to, ...(walkingCorrection > 1 && {action:1,travel:walkingCorrection}),
    jumpLeft:Math.max(0,(to.jumpLeft ?? 0)-Math.max(0,now-poseAt)), x:from.x+(to.x-from.x)*blend+vx*lead, y:from.y+(to.y-from.y)*blend+vy*lead,
    turn:from.turn+Math.atan2(Math.sin(turn), Math.cos(turn))*blend};
}

// A nearest-image change must stay offscreen, rather than interpolate across a world.
function periodicFrom(last,to,now){
 const from=last?sample(last,now):to;
 return {...from,x:nearestSeaX(from.x,to.x)};
}

function peerTrack(last, to, now) {
  const track = {from:to, to, start:now, blendSeconds:PEER_BLEND_SECONDS};
  if (!last || last.to.islandId !== to.islandId || last.to.mode !== to.mode) return track;
  const sampleSeconds = (to.positionSampleMs || 0) / 1000;
  if (sampleSeconds) {
    // Ordinary snapshots repeat the same distant pose between position samples.
    // Keep the existing interpolation running while refreshing animation state.
    if (last.to.positionSampleMs === to.positionSampleMs &&
        last.to.x === to.x && last.to.y === to.y && last.to.turn === to.turn) {
      return {...last, to, poseAt:now};
    }
    return {...track, from:periodicFrom(last,to,now), blendSeconds:sampleSeconds};
  }
  if (last.to.positionSampleMs) {
    return {...track, from:periodicFrom(last,to,now), blendSeconds:.15};
  }
  const elapsed = now-last.start;
  const dx = to.x-nearestSeaX(last.to.x,to.x), dy = to.y-last.to.y;
  const distance = Math.hypot(dx,dy);
  const travel = Number.isFinite(to.travel) ? Math.max(0,to.travel) : 0;
  const recovery = elapsed > PEER_DELAY_SECONDS ? {gap:elapsed,until:now+PEER_DELAY_SECONDS} : last.recovery;
  const maxSpeed = to.mode === 'sailing' ? SAIL_SPEED : RUN_SPEED;
  // A duck can have walked a normal distance during a gap and stopped before
  // the last packet. Its final speed alone cannot identify a teleport.
  const reachable = recovery ? maxSpeed * Math.min(2,recovery.gap) : travel * Math.min(1,elapsed);
  if (distance > POSITION_SNAP_DISTANCE + reachable) return track;
  track.from = periodicFrom(last,to,now);
  if (recovery) {
    // Bound the catch-up speed even when several fresh packets arrive together.
    const speed = Math.min(maxSpeed, Math.max(WALK_SPEED,travel,last.to.travel ?? 0)) * 1.5;
    const remaining = Math.hypot(to.x-track.from.x,to.y-track.from.y);
    track.blendSeconds = Math.max(PEER_BLEND_SECONDS,remaining/speed);
    if (track.blendSeconds > PEER_BLEND_SECONDS || now < recovery.until) track.recovery = recovery;
    return track;
  }
  if (elapsed > 0 && distance > 0 && travel > 0) {
    const speed = Math.min(distance/elapsed,travel);
    track.vx = speed*dx/distance;
    track.vy = speed*dy/distance;
  }
  return track;
}

export class RoomClient {
  constructor(onStatus, onChat = () => {}, onPresence = () => {}, onJoin = () => {}, onTravel = () => {}, onNotice = () => {}) {
    this.onStatus = onStatus;
    this.onChat = onChat;
    this.onPresence = onPresence;
    this.onJoin = onJoin;
    this.onTravel = onTravel;
    this.onNotice = onNotice;
    this.onNearby = () => {};
    this.onFriendsChanged = () => {};
    this.onKarmaPickup = () => {};
    this.friends = null;
    this.dismissedFriends = new Set();
    this.islandId = 'home';
    this.mode = 'walking';
    this.boats = [];
    this.boatTracks = new Map();
    this.tracks = new Map();
    this.globeOpen = false;
    this.globeSubscriptionId = 0;
    this.reset();
  }

  // The first snapshot identifies the island the server is showing.
  waitForIsland() {
    if (this.tick >= 0) return Promise.resolve(this.islandId);
    return this.initialIsland ??= new Promise(resolve => {this.resolveInitialIsland = resolve;});
  }

  configure(nav, world) {
    this.nav = nav;
    this.world = world;
  }
  navHere() { const map = mapOf(this.islandId); return navOf(this.islandId, map.home ? this.nav : map.nav()); }
  worldHere() { const map = mapOf(this.islandId); return map.home ? this.world : map.walk; }

  reset() {
    clearTimeout(this.chatTimer);
    this.lastChat = -Infinity;
    this.tracks.clear();
    this.boatTracks.clear();
    this.boats = [];
    this.onPresence(null);
    this.id = null;
    this.player = null;
    this.authoritativePlayer = null;
    this.arrival = null;
    this.friendPlayers = [];
    this.updateNearby();
    this.seq = 0;
    this.tick = -1;
    this.snapshotPlayers = new Map();
    this.detachedSelfId = null;
    this.snapshotBoats = new Map();
    this.globeFeed = false;
    this.clearGlobePlayers();
    this.karma=0;this.feathers=[];this.featherIsland=null;
    this.pending = [];
    this.input = ZERO;
    this.lastInput = -Infinity;
    this.offsetX = this.offsetY = 0;
    this.correctionX = this.correctionY = 0;
    this.prev = null; this.alpha = 1;
  }

  recordReconnect(reason, details = {}) {
    this.reconnectReason ??= reason;
    if (!this.onReconnectDiagnostic || this.reconnectIncident) return;
    const now = performance.now();
    const pose = this.snapshotPlayers.get(this.id);
    const since = timestamp => timestamp == null ? null : Math.round(now - timestamp);
    this.reconnectIncident = {
      at: Date.now(), reason, epoch: this.epoch ?? null, tick: this.tick,
      sincePongMs: since(this.lastPongAt), sinceSnapshotMs: since(this.lastSnapshotAt),
      before: this.diagnosticPosition(pose), player: this.id, boat: pose?.boatId,
    };
    const {player, boat, ...event} = this.reconnectIncident;
    this.onReconnectDiagnostic({event: 'reconnect', ...event, ...details});
  }

  diagnosticPosition(pose) {
    return pose ? {x: pose.x, y: pose.y, island: pose.islandId, mode: pose.mode} : null;
  }

  connect(play = true, reconnecting = false, handoff = false) {
    this.wantsPlay = play;
    if (play) this.watchDestination = null;
    if (!reconnecting) {
      this.resumeId = null;
      this.reconnectIncident = null;
      this.overloadBackoff = false;
      this.failures = 0;
    }
    this.lastPongAt = null;
    this.lastSnapshotAt = null;
    this.sentWatchCell = null;
    this.lastWatchCellAt = -Infinity;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    const old = this.socket;
    this.socket = null;
    if (handoff) this.leavingSocket ??= old;
    if (old !== this.leavingSocket) old?.close();
    if (!this.leavingSocket) this.reset();
    if (!this.leavingSocket) this.onStatus(reconnecting ? 'reconnecting' : 'connecting');
    const url = new URL('/api/room', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    authenticateTestSocket(url);
    if (url.searchParams.has('testSession') && this.reconnectReason) url.searchParams.set('reconnect',this.reconnectReason);
    url.searchParams.set('protocol','2');
    url.searchParams.set('nearby','1');
    if (!play) url.searchParams.set('watch',this.watchDestination ?? this.islandId ?? 'home');
    url.searchParams.set('play', play ? '1' : '0');
    url.searchParams.set('globeFeed', '1');
    if (play && this.resumeId) url.searchParams.set('resume', this.resumeId);
    const held = play && !reconnecting ? takeArrivalSocket() : null;
    const socket = this.socket = held?.socket ?? new WebSocket(url);
    let full = false;
    let pendingPing = null;
    socket.onopen = () => {
      if (socket !== this.socket) return;
      if (this.islandId !== 'home') socket.send(JSON.stringify({type:'watch',islandId:this.islandId}));
      this.heartbeat = setInterval(() => {
        if (document.hidden) { pendingPing = null; return; }
        if (socket.readyState !== WebSocket.OPEN) return;
        const now = performance.now();
        if (pendingPing !== null) {
          if (now - pendingPing <= HEARTBEAT_TIMEOUT_MS) return;
          // An advancing room snapshot proves the socket is still receiving game updates.
          if (this.lastSnapshotAt === null || now - this.lastSnapshotAt > HEARTBEAT_TIMEOUT_MS) {
            this.recordReconnect('heartbeat_timeout');
            this.connect(this.wantsPlay, true);
            return;
          }
        }
        pendingPing = now;
        socket.send('ping');
      }, HEARTBEAT_INTERVAL_MS);
    };
    socket.onmessage = ({data}) => {
      if (socket !== this.socket) return;
      if (data === 'pong') {
        pendingPing = null;
        if (this.onReconnectDiagnostic) this.lastPongAt = performance.now();
        return;
      }
      const message = JSON.parse(data);
      if (message.type === 'globe-players') {
        if (this.globeFeed && this.globeOpen && message.subscriptionId === this.globeSubscriptionId) {
          this.globePlayers = message.players;
        }
        return;
      }
      if(message.type==='karma-state'){
        this.karma=message.balance;this.feathers=message.feathers;this.featherIsland=message.islandId;
      }
      if(message.type==='karma-pickup'){
        if(message.playerId===this.id)this.karma=message.total;
        this.feathers=this.feathers.filter(f=>f.id!==message.id);
        this.onKarmaPickup(message);
      }
      if (message.type === 'travel-notice') this.onNotice(message.text);
      if (message.type === 'boat-built') {
        // the new boat stays hidden until the build smoke covers its spot
        this.unveil = {id: message.boatId, at: nowSeconds() + BOAT_UNVEIL};
        this.onBoatBuilt?.(message);
      }
      if (message.type === 'friends-changed') this.onFriendsChanged();
      if (message.type === 'delta') {
        if (message.epoch !== this.epoch || message.baseTick !== this.tick || message.islandId !== this.islandId) {
          this.recordReconnect('snapshot_mismatch', {
            receivedEpoch: message.epoch, baseTick: message.baseTick, receivedTick: message.tick,
          });
          this.connect(this.wantsPlay, true);
          return;
        }
        const merge = (target, patch) => {
          for (const id of patch.removed) target.delete(id);
          for (const value of patch.changed) target.set(value.id, {...target.get(value.id), ...value});
        };
        if (this.detachedSelfId) this.snapshotPlayers.delete(this.detachedSelfId);
        merge(this.snapshotPlayers, message.players);
        merge(this.snapshotBoats, message.boats);
        this.snapshot({...message, players: [...this.snapshotPlayers.values()], boats: [...this.snapshotBoats.values()]});
      }
      if (message.type === 'transfer' && message.version === 1 && message.player === this.id) {
        this.connect(true,true,true);
        return;
      }
      if (message.type === 'snapshot') {
        this.snapshot(message);
        this.leavingSocket?.close();
        this.leavingSocket = null;
      }
      if (this.splitWorld && (message.type === 'snapshot' || message.type === 'delta') && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({type:'snapshot-ack',epoch:message.epoch,tick:message.tick}));
      }
      if (message.type === 'joined') this.onJoin(message);
      if (message.type === 'chat') this.onChat(message.id, message.text);
      if (message.type === 'welcome' || message.type === 'role') {
        if (message.type === 'welcome') {
          this.reconnectReason = null;
          this.splitWorld = message.protocol === 2;
          if (this.splitWorld && Number.isSafeInteger(message.ack)) this.seq=Math.max(this.seq,message.ack);
          this.overloadBackoff = false;
          this.globeFeed = message.globeFeed === true;
          if (this.globeOpen) this.sendGlobeSubscription();
          this.onFriendsChanged();
          socket.send(JSON.stringify({type:'updates',nearby:true}));
        }
        if (['expired', 'signed-out'].includes(message.reason)) this.clearGlobePlayers();
        this.failures = 0;
        this.id = this.resumeId = message.id;
        this.arrival = message.arrival ?? null;
        if (!this.id && !this.leavingSocket) this.player = null;
        this.updateNearby();
        if (message.type === 'role' || ['players-full','star-required'].includes(message.reason)) this.wantsPlay = false;
        full = message.reason === 'spectators-full';
        this.onStatus(this.id ? 'playing' : message.reason ?? 'watching');
      }
    };
    socket.onclose = ({code, wasClean}) => {
      if (socket !== this.socket) return;
      clearInterval(this.heartbeat);
      if (!full && code !== 4001) this.recordReconnect('transport_close', {code, wasClean});
      if (!this.leavingSocket) this.reset();
      if (full || code === 4001) {
        this.onStatus('spectators-full');
        return;
      }
      this.onStatus('reconnecting');
      this.failures = (this.failures ?? 0) + 1;
      if (code === 1013) this.overloadBackoff = true;
      const maxDelay = this.overloadBackoff ? 15_000 : 5000;
      const initialDelay = this.overloadBackoff ? 3000 : 350;
      this.retryTimer = setTimeout(() => this.connect(this.wantsPlay, true),
        Math.min(maxDelay, initialDelay * 2 ** (this.failures-1)) * (.5 + Math.random() * .5));
    };
    if (held) {
      if (socket.readyState === 1) socket.onopen();
      for (const event of held.messages) socket.onmessage(event);
    }
  }

  clearGlobePlayers() {
    this.globePlayers = [];
    this.legacyGlobePlayers = [];
  }

  setGlobeOpen(open) {
    if (open === this.globeOpen) return;
    this.globeOpen = open;
    this.globeSubscriptionId++;
    this.globePlayers = open && !this.globeFeed ? this.legacyGlobePlayers : [];
    this.sendGlobeSubscription();
  }

  sendGlobeSubscription() {
    if (!this.globeFeed || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({type: 'globe-subscription', open: this.globeOpen, subscriptionId: this.globeSubscriptionId}));
  }

  watchNearby(islandId, camera) {
    if (this.id || this.lastSnapshotAt === null || this.socket?.readyState !== WebSocket.OPEN ||
        islandId !== this.islandId || islandId !== (this.watchDestination ?? islandId)) return;
    const now = performance.now();
    if (now - this.lastWatchCellAt < 250) return;
    const {x,y} = nearbyCell(camera);
    const key = `${islandId}|${x}|${y}`;
    if (key === this.sentWatchCell) return;
    this.socket.send(JSON.stringify({type:'watch-cell',islandId,x,y}));
    this.sentWatchCell = key;
    this.lastWatchCellAt = now;
  }

  snapshot({epoch,tick,players,self,online,islandId='home',boats=[],globePlayers=[]}) {
    if (epoch === this.epoch && tick <= this.tick) return;
    const snapshotAt = performance.now();
    const previousSnapshotAt = this.lastSnapshotAt;
    const previousPose = this.authoritativePlayer;
    this.lastSnapshotAt = snapshotAt;
    if (!this.globeFeed) {
      this.legacyGlobePlayers = globePlayers;
      if (this.globeOpen) this.globePlayers = globePlayers;
    }
    this.snapshotPlayers = new Map(players.map(p => [p.id, p]));
    this.snapshotBoats = new Map(boats.map(b => [b.id, b]));
    this.detachedSelfId = null;
    if (self?.pose?.id && self.pose.id === this.id && !this.snapshotPlayers.has(this.id)) {
      this.detachedSelfId = this.id;
      this.snapshotPlayers.set(this.id,self.pose);
      players = [...players,self.pose];
    }
    const own=this.snapshotPlayers.get(this.id);
    this.authoritativePlayer = own;
    if (this.onReconnectDiagnostic) {
      const incident = this.reconnectIncident;
      if (incident && (own && self || !this.wantsPlay)) {
        this.reconnectIncident = null;
        this.onReconnectDiagnostic({
          event: 'reconnected', at: Date.now(), startedAt: incident.at, reason: incident.reason,
          epoch, tick, after: this.diagnosticPosition(own),
          samePlayer: Boolean(own && own.id === incident.player),
          sameBoat: Boolean(own && own.boatId === incident.boat),
        });
      }
    }
    const mode=own?.mode ?? 'walking';
    if(this.mode==='sailing'&&mode==='walking')this.arrivalBoatId=this.player?.boatId;
    const changed=this.islandId !== islandId || this.mode !== mode || this.epoch !== epoch;
    if (changed) {
      this.pending=[];
      this.input=ZERO;
      this.offsetX=this.offsetY=0;
      this.correctionX=this.correctionY=0;
      this.tracks.clear();
      this.boatTracks.clear();
      clearTimeout(this.chatTimer);
    }
    this.islandId=islandId;
    if (this.watchDestination === islandId) this.watchDestination = null;
    this.mode=mode;
    this.epoch = epoch;
    this.tick = tick;
    if (Number.isSafeInteger(online) && online >= 0) this.onPresence(online);
    const now = snapshotAt / 1000;
    const boatTracks=new Map();
    for (const boat of boats) {
      const last=this.boatTracks.get(boat.id);
      boatTracks.set(boat.id,{from:periodicFrom(last,boat,now),to:boat,start:now});
    }
    this.boatTracks=boatTracks;
    this.boats=boats;
    const tracks = new Map();
    for (const pose of players) {
      if (pose.id === this.id && self) {
        const previous = changed ? null : this.player;
        const owned = (self.ownBoats ?? []).join();
        if (owned !== this.ownedKey) {this.ownedKey = owned; this.ownBoats = new Set(self.ownBoats ?? []);}
        this.player = {...pose, path:self.path, sailTarget:self.sailTarget ?? null, docking:self.docking, until:now+self.emoteLeft,
          pace:previous?.pace ?? 0, heading:previous?.heading ?? null,
          ice:self.ice?structuredClone(self.ice):null,reducedMotion:self.reducedMotion===true};
        this.pending = this.pending.filter(command => command.seq > self.ack);
        for (const command of this.pending) this.predict(command, now);
        if (previous) {
          this.offsetX += previous.x - this.player.x;
          this.offsetY += previous.y - this.player.y;
          if (Math.hypot(this.offsetX,this.offsetY) > POSITION_SNAP_DISTANCE) {
            // Judge a walking relocation from consecutive server poses. Prediction can run ahead during a slow tick.
            const maxTravel = POSITION_SNAP_DISTANCE + RUN_SPEED * (snapshotAt - previousSnapshotAt) / 1000;
            if (mode !== 'walking' || !previousPose || Math.hypot(pose.x-previousPose.x,pose.y-previousPose.y) > maxTravel) {
              this.offsetX = this.offsetY = 0;
              this.correctionX = this.correctionY = 0;
              this.prev = null;
            }
          }
        } else this.prev = null;
      } else {
        const last = this.tracks.get(pose.id);
        tracks.set(pose.id, peerTrack(last,pose,now));
      }
    }
    this.tracks = tracks;
    this.friendPlayers = players;
    this.updateNearby();
    const available=this.usableBoats(boats).length;
    // Islets belong to a nearby island's frame; say when you stand on one so island-only UI (Bog entry) can skip it.
    const islet=Boolean(own&&isletAt(islandId,own.x,own.y));
    const travelKey=`${islandId}:${mode}:${available}:${islet}`;
    if (changed || this.travelKey !== travelKey) this.onTravel({islandId,mode,available,islet});
    this.travelKey=travelKey;
    this.resolveInitialIsland?.(islandId);
    this.resolveInitialIsland=null;
  }

  setFriends(friends) {
    this.friends = friends === null ? null : new Set(friends.map(friend => friend.accountId));
    this.updateNearby();
  }

  // Friends who are playing, for the mini-map and globe. Positions come from /api/friends every few seconds;
  // a friend on your island uses their live position instead so the dot moves smoothly.
  setFriendSpots(friends) {
    this.friendSpots = (friends ?? []).filter(friend => friend.where)
      .map(friend => ({accountId:friend.accountId, login:friend.login, ...friend.where}));
  }

  friendMarks() {
    if (this.showFriendsOnMap === false || !this.friendSpots?.length) return [];
    return this.friendSpots.map(spot => {
      const live = this.friendPlayers.find(player => String(player.accountId) === String(spot.accountId) && player.id !== this.id);
      return live ? {...spot, islandId:live.islandId ?? spot.islandId, x:live.x, y:live.y, mode:live.mode ?? spot.mode} : spot;
    });
  }

  dismissFriend(accountId) {
    if (accountId) this.dismissedFriends.add(accountId);
    this.updateNearby();
  }

  clearFriends() {
    this.friends = null;
    this.friendSpots = [];
    this.dismissedFriends.clear();
    this.updateNearby();
  }

  updateNearby() {
    const self = this.id && this.friendPlayers.find(player => player.id === this.id);
    const next = nearbyFriend(self,this.friendPlayers,this.friends,this.dismissedFriends,this.nearby);
    const changed = next?.id !== this.nearby?.id || next?.login !== this.nearby?.login;
    this.nearby = next;
    if (changed) this.onNearby(next && {id:next.id,accountId:next.accountId,login:next.login});
  }

  predict(command, now) {
    if(!islandMapReady(this.islandId))return;
    if (command.type==='input' && typeof command.reducedMotion==='boolean') this.player.reducedMotion=command.reducedMotion;
    if (command.type === 'jump') return startJump(this.player);
    if (command.stop === true) {this.player.path=[];this.player.sailTarget=null;this.player.docking=false;this.player.pace=0;this.player.heading=null;}
    if (command.type === 'destination' && this.nav && this.player.mode !== 'sailing')
      return setWalkDestination(this.player, this.navHere(), command.x, command.y);
    if (command.type === 'disembark' && this.player.mode === 'sailing') {
      const spot=dockingSpot(this.player,Number.isFinite(command.x) ? command : null);
      if (spot && !spot.islet && bogLandingNotice(spot.islandId,getPlayerKarma({room:this}))) {
        Object.assign(this.player,refusedLandingPosition(this.player,spot.islandId,this.boats),{sailTarget:null,sailRoute:null,docking:false});
      }
      if (spot && (spot.islet || !bogLandingNotice(spot.islandId,getPlayerKarma({room:this})))) {
        const approach=spot.harbor ? harborOf(this.islandId).water : landingApproach(this.player,spot,this.boats);
        this.player.sailTarget=null; this.player.sailRoute=null; this.player.docking=false;
        if (!near(this.player,approach,14) || spot.harbor) {
          const routed=setSailDestination(this.player,approach.x,approach.y,this.boats);
          this.player.docking=Boolean(routed && spot.harbor);
          this.player.dockTarget=routed&&spot.harbor?{x:routed[0],y:routed[1]}:null;
        }
      }
    }
    if (command.type === 'emote') {if (this.player.mode === 'sailing') playSailEmote(this.player, command.action, now); else playEmote(this.player, command.action, now);}
    return null;
  }

  send(command, now = nowSeconds()) {
    if (!this.player || this.socket?.readyState !== WebSocket.OPEN || this.pending.length >= 40) return false;
    command.seq = ++this.seq;
    command.islandId = this.islandId;
    this.socket.send(JSON.stringify(command));
    this.pending.push(command);
    return this.predict(command, now) ?? true;
  }

  destination(x, y) {
    if(!islandMapReady(this.islandId))return null;
    if (!this.world || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (this.player?.mode === 'sailing') return null;
    const w = this.worldHere(), o = w.origin ?? {x:0,y:0};
    if (!canWalkTo(this.islandId, x, y) && (x<o.x || y<o.y || x>=o.x+w.width || y>=o.y+w.height)) return null;
    const result = this.send({type:'destination',x,y});
    return Array.isArray(result) ? result : null;
  }

  emote(action) {
    return (this.player?.mode !== 'sailing' || SAIL_EMOTES.has(action)) && Object.hasOwn(DURATIONS, action) && this.send({type:'emote',action});
  }

  jump() {
    if (!this.player || this.player.mode === 'sailing' || this.player.jumpLeft > 0) return false;
    return this.send({type:'jump'});
  }

  board(boatId) { return this.send({type:'board',boatId}); }

  // free boats this player may take: built boats belong to whoever built them
  usableBoats(boats=this.boats) { return boats.filter(boat => !boat.occupant && (!boat.built || this.ownBoats?.has(boat.id))); }

  build() { return this.player?.mode === 'walking' && this.send({type:'build'}); }

  returnToBoat() {
    if(!this.player||this.player.mode!=='walking')return false;
    const available=this.usableBoats();
    const boat=available.find(b=>b.id===this.arrivalBoatId)??available.sort((a,b)=>
      Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];
    return boat?this.board(boat.id):false;
  }

  disembark(target=null) {
    if(this.player?.mode==='sailing'){
      const spot=dockingSpot(this.player,target);
      const text=spot&&!spot.islet&&bogLandingNotice(spot.islandId,getPlayerKarma({room:this}));
      if(text)this.onNotice(text);
    }
    return this.send(target ? {type:'disembark',x:target.x,y:target.y} : {type:'disembark'});
  }

  watch(islandId) {
    if (this.id || !islandFor(islandId) || this.socket?.readyState !== WebSocket.OPEN) return;
    if (this.splitWorld) {
      if (islandId === this.islandId && !this.leavingSocket) return;
      this.watchDestination = islandId;
      this.connect(false,true,true);
      return;
    }
    this.socket.send(JSON.stringify({type:'watch',islandId}));
  }

  boatPoses(now=nowSeconds()) {
    const hidden = this.unveil?.at > now ? this.unveil.id : null;
    return [...this.boatTracks.values()].filter(track => track.to.id !== hidden).map(track => {
      const boat=sample(track,now);
      return boat.occupant === this.id && this.player
        ? {...boat,...this.view(),travel:this.player.travel}
        : {...boat,travel:Math.hypot(track.to.x-track.from.x,track.to.y-track.from.y)*10};
    });
  }

  chat(value) {
    const text = chatText(value);
    if (text === null || !this.id || this.socket?.readyState !== WebSocket.OPEN) return;
    clearTimeout(this.chatTimer);
    const socket = this.socket;
    const send = () => {
      if (!this.id || socket !== this.socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({type:'chat',text}));
      this.lastChat = performance.now();
    };
    const wait = CHAT_INTERVAL - (performance.now() - this.lastChat);
    if (wait > 0) this.chatTimer = setTimeout(send, wait);
    else send();
  }

  stopInput() {
    if (this.player) this.send({type:'input',...ZERO,stop:true});
    this.input = ZERO;
  }

  step(dt, input) {
    if (!this.player || !islandMapReady(this.islandId)) return;
    const now = nowSeconds();
    const {x,y,turn}=this.player;
    this.prev = {x:x+this.offsetX, y:y+this.offsetY, turn};
    if (this.input.x !== input.x || this.input.y !== input.y || Boolean(this.input.run) !== Boolean(input.run) || this.input.reducedMotion!==input.reducedMotion || (moving(input) && now-this.lastInput >= .1)) {
      if (this.send({type:'input',x:input.x,y:input.y,reducedMotion:input.reducedMotion===true,...(input.run ? {run:true} : {})}, now)) {
        this.input = input;
        this.lastInput = now;
      }
    }
    if (this.player.mode === 'sailing') sailStep(this.player,dt,input,now,this.boats);
    else walkStep(this.player, this.navHere(), dt, now, input);
    const omega = 12, decay = Math.exp(-omega * dt);
    const settle = (offset, velocity) => {
      const c = velocity + omega * offset;
      return [(offset + c * dt) * decay, (velocity - omega * c * dt) * decay];
    };
    let [offsetX, velocityX] = settle(this.offsetX, this.correctionX);
    let [offsetY, velocityY] = settle(this.offsetY, this.correctionY);
    const dx = this.player.x - x, dy = this.player.y - y;
    const distance2 = dx * dx + dy * dy;
    const backward = (this.offsetX - offsetX) * dx + (this.offsetY - offsetY) * dy;
    // A walking correction can absorb the whole predicted step when the server is falling behind.
    const maxBackward = this.player.mode === 'walking' ? distance2 : distance2 / 2;
    if (backward > maxBackward && distance2 > 0) {
      const scale = maxBackward / backward;
      offsetX = this.offsetX + (offsetX - this.offsetX) * scale;
      offsetY = this.offsetY + (offsetY - this.offsetY) * scale;
      velocityX *= scale;
      velocityY *= scale;
    }
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.correctionX = velocityX;
    this.correctionY = velocityY;
  }

  setAlpha(alpha) { this.alpha = Math.max(0, Math.min(1, alpha)); }
  view() {
    const p = this.player;
    if (!p) return null;
    const q = this.prev, k = 1 - this.alpha;
    const x = p.x + this.offsetX, y = p.y + this.offsetY;
    if (!q || k <= 0) return {x,y,turn:p.turn};
    const turn = p.turn - q.turn;
    return {x:x+(q.x-x)*k, y:y+(q.y-y)*k, turn:p.turn-Math.atan2(Math.sin(turn), Math.cos(turn))*k};
  }

  poses(now = nowSeconds()) {
    const poses = [...this.tracks.values()].map(track => sample(track, now));
    if (this.player) poses.push({...this.player, ...this.view(), player:true});
    return poses;
  }

  dispose() {
    this.globeOpen = false;
    this.resolveInitialIsland?.(null);
    this.resolveInitialIsland=null;
    clearInterval(this.heartbeat);
    clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
    this.leavingSocket?.close();
    this.leavingSocket = null;
    socket?.close();
    this.reset();
  }
}

export class OfflineFleet {
  constructor(boats = createBoats()) {
    this.list = boats;
    fillMoorings(this.list);
  }
  boats(islandId = 'home') { return this.list.filter(boat => boat.islandId === islandId); }
  boatOf(actorId) { return this.list.find(boat => boat.occupant === actorId) ?? null; }
  take(boatId, actorId) {
    const boat = this.list.find(boat => boat.id === boatId);
    if (!boat || boat.occupant || this.boatOf(actorId)) return null;
    boat.occupant = actorId; boat.departure = boat.islandId;
    return boat;
  }
  sail(actorId, {x, y, turn, islandId}) {
    const boat = this.boatOf(actorId);
    if (!boat) return false;
    Object.assign(boat, {x, y, turn: turn ?? boat.turn, islandId: islandId ?? boat.islandId});
    return fillMoorings(this.list);
  }
  land(actorId) {
    const boat = this.boatOf(actorId);
    if (boat) retireBoat(this.list, boat);
    return boat;
  }
}
