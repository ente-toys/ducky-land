import {DURATIONS, playEmote, startJump, setWalkDestination, walkStep} from '../gameplay/player-motion.js';
import {CHAT_INTERVAL, chatText} from './chat.js';
import {nearbyFriend} from './friends.js';
import {mapOf} from '../world/island-maps.js';
import {getPlayerKarma} from '../features/bog-combat/karma.js';
import {bogLandingNotice} from '../features/bog-combat/entry.js';
import {islandFor, harborOf, destinationsFor, near, canSail, canDock, landingSpot, setSailDestination, sailStep, createBoats, fillMoorings, retireBoat, navOf, canWalkTo} from '../gameplay/islands.js';

const ZERO = {x:0,y:0};
const moving = input => input.x !== 0 || input.y !== 0;
const nowSeconds = () => performance.now() / 1000;

function sample(track, now) {
  const {from,to,start} = track;
  const blend = Math.min(1, Math.max(0, (now-start) * 10));
  const turn = to.turn - from.turn;
  return {...to, jumpLeft:Math.max(0,(to.jumpLeft ?? 0)-(now-start)), x:from.x+(to.x-from.x)*blend, y:from.y+(to.y-from.y)*blend,
    turn:from.turn+Math.atan2(Math.sin(turn), Math.cos(turn))*blend};
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
    this.reset();
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
    this.friendPlayers = [];
    this.updateNearby();
    this.seq = 0;
    this.tick = -1;
    this.snapshotPlayers = new Map();
    this.snapshotBoats = new Map();
    this.karma=0;this.feathers=[];this.featherIsland=null;
    this.pending = [];
    this.input = ZERO;
    this.lastInput = -Infinity;
    this.offsetX = this.offsetY = 0;
    this.correctionX = this.correctionY = 0;
    this.prev = null; this.alpha = 1;
  }

  connect(play = true, reconnecting = false) {
    this.wantsPlay = play;
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    const old = this.socket;
    this.socket = null;
    old?.close();
    this.reset();
    this.onStatus(reconnecting ? 'reconnecting' : 'connecting');
    const url = new URL('/api/room', location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('play', play ? '1' : '0');
    const socket = this.socket = new WebSocket(url);
    let full = false;
    let pendingPing = null;
    socket.onopen = () => {
      if (socket !== this.socket) return;
      if (this.islandId !== 'home') socket.send(JSON.stringify({type:'watch',islandId:this.islandId}));
      this.heartbeat = setInterval(() => {
        if (document.hidden) { pendingPing = null; return; }
        if (pendingPing !== null) {
          if (nowSeconds()-pendingPing > 9) this.connect(this.wantsPlay, true);
          return;
        }
        if (socket.readyState === WebSocket.OPEN) {
          socket.send('ping');
          pendingPing = nowSeconds();
        }
      }, 5000);
    };
    socket.onmessage = ({data}) => {
      if (socket !== this.socket) return;
      if (data === 'pong') { pendingPing = null; return; }
      const message = JSON.parse(data);
      if(message.type==='karma-state'){
        this.karma=message.balance;this.feathers=message.feathers;this.featherIsland=message.islandId;
      }
      if(message.type==='karma-pickup'){
        if(message.playerId===this.id)this.karma=message.total;
        this.feathers=this.feathers.filter(f=>f.id!==message.id);
        this.onKarmaPickup(message);
      }
      if (message.type === 'travel-notice') this.onNotice(message.text);
      if (message.type === 'friends-changed') this.onFriendsChanged();
      if (message.type === 'delta') {
        if (message.epoch !== this.epoch || message.baseTick !== this.tick || message.islandId !== this.islandId) {
          this.connect(this.wantsPlay, true);
          return;
        }
        const merge = (target, patch) => {
          for (const id of patch.removed) target.delete(id);
          for (const value of patch.changed) target.set(value.id, {...target.get(value.id), ...value});
        };
        merge(this.snapshotPlayers, message.players);
        merge(this.snapshotBoats, message.boats);
        this.snapshot({...message, players: [...this.snapshotPlayers.values()], boats: [...this.snapshotBoats.values()]});
      }
      if (message.type === 'snapshot') this.snapshot(message);
      if (message.type === 'joined') this.onJoin(message);
      if (message.type === 'chat') this.onChat(message.id, message.text);
      if (message.type === 'welcome' || message.type === 'role') {
        if (message.type === 'welcome') {this.onFriendsChanged(); socket.send(JSON.stringify({type: 'updates'}));}
        this.failures = 0;
        this.id = message.id;
        if (!this.id) this.player = null;
        this.updateNearby();
        if (message.type === 'role' || ['players-full','star-required'].includes(message.reason)) this.wantsPlay = false;
        full = message.reason === 'spectators-full';
        this.onStatus(this.id ? 'playing' : message.reason ?? 'watching');
      }
    };
    socket.onclose = ({code}) => {
      if (socket !== this.socket) return;
      clearInterval(this.heartbeat);
      this.reset();
      if (full || code === 4001) {
        this.onStatus('spectators-full');
        return;
      }
      this.onStatus('reconnecting');
      this.failures = (this.failures ?? 0) + 1;
      this.retryTimer = setTimeout(() => this.connect(this.wantsPlay, true),
        Math.min(5000, 350 * 2 ** (this.failures-1)));
    };
  }

  snapshot({epoch,tick,players,self,online,islandId='home',boats=[]}) {
    if (epoch === this.epoch && tick <= this.tick) return;
    this.snapshotPlayers = new Map(players.map(p => [p.id, p]));
    this.snapshotBoats = new Map(boats.map(b => [b.id, b]));
    const own=players.find(pose => pose.id === this.id);
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
    this.mode=mode;
    this.epoch = epoch;
    this.tick = tick;
    if (Number.isSafeInteger(online) && online >= 0) this.onPresence(online);
    const now = nowSeconds();
    const boatTracks=new Map();
    for (const boat of boats) {
      const last=this.boatTracks.get(boat.id);
      boatTracks.set(boat.id,{from:last?sample(last,now):boat,to:boat,start:now});
    }
    this.boatTracks=boatTracks;
    this.boats=boats;
    const tracks = new Map();
    for (const pose of players) {
      if (pose.id === this.id && self) {
        const previous = changed ? null : this.player;
        this.player = {...pose, path:self.path, sailTarget:self.sailTarget ?? null, docking:self.docking, until:now+self.emoteLeft,
          pace:previous?.pace ?? 0, heading:previous?.heading ?? null,
          ice:self.ice?structuredClone(self.ice):null,reducedMotion:self.reducedMotion===true};
        this.pending = this.pending.filter(command => command.seq > self.ack);
        for (const command of this.pending) this.predict(command, now);
        if (previous) {
          this.offsetX += previous.x - this.player.x;
          this.offsetY += previous.y - this.player.y;
          if (Math.hypot(this.offsetX,this.offsetY) > 90) {this.offsetX = this.offsetY = 0; this.correctionX = this.correctionY = 0; this.prev = null;}
        } else this.prev = null;
      } else {
        const last = this.tracks.get(pose.id);
        tracks.set(pose.id, {from:last ? sample(last, now) : pose, to:pose, start:now});
      }
    }
    this.tracks = tracks;
    this.friendPlayers = players;
    this.updateNearby();
    const available=boats.filter(boat => !boat.occupant).length;
    const travelKey=`${islandId}:${mode}:${available}`;
    if (changed || this.travelKey !== travelKey) this.onTravel({islandId,mode,available});
    this.travelKey=travelKey;
  }

  setFriends(friends) {
    this.friends = friends === null ? null : new Set(friends.map(friend => friend.accountId));
    this.updateNearby();
  }

  dismissFriend(accountId) {
    if (accountId) this.dismissedFriends.add(accountId);
    this.updateNearby();
  }

  clearFriends() {
    this.friends = null;
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
    if (command.type==='input' && typeof command.reducedMotion==='boolean') this.player.reducedMotion=command.reducedMotion;
    if (command.type === 'jump') return startJump(this.player);
    if (command.stop === true) {this.player.path=[];this.player.sailTarget=null;this.player.docking=false;this.player.pace=0;this.player.heading=null;}
    if (command.type === 'destination' && this.nav) return this.player.mode === 'sailing'
      ? setSailDestination(this.player,command.x,command.y) : setWalkDestination(this.player, this.navHere(), command.x, command.y);
    if (command.type === 'disembark' && this.player.mode === 'sailing' && canDock(this.player)) {
      const {water} = harborOf(this.islandId); setSailDestination(this.player,water.x,water.y); this.player.docking=true;
    }
    if (command.type === 'emote' && this.player.mode !== 'sailing') playEmote(this.player, command.action, now);
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
    if (!this.world || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (this.player?.mode === 'sailing' && !canSail(x,y,this.islandId)) return null;
    const w = this.worldHere(), o = w.origin ?? {x:0,y:0};
    if (this.player?.mode !== 'sailing' && !canWalkTo(this.islandId, x, y) && (x<o.x || y<o.y || x>=o.x+w.width || y>=o.y+w.height)) return null;
    const result = this.send({type:'destination',x,y});
    return Array.isArray(result) ? result : null;
  }

  emote(action) {
    return this.player?.mode !== 'sailing' && Object.hasOwn(DURATIONS, action) && this.send({type:'emote',action});
  }

  jump() {
    if (!this.player || this.player.mode === 'sailing' || this.player.jumpLeft > 0) return false;
    return this.send({type:'jump'});
  }

  board(boatId) { return this.send({type:'board',boatId}); }

  returnToBoat() {
    if(!this.player||this.player.mode!=='walking')return false;
    const available=this.boats.filter(b=>!b.occupant);
    const boat=available.find(b=>b.id===this.arrivalBoatId)??available.sort((a,b)=>
      Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];
    return boat?this.board(boat.id):false;
  }

  disembark() {
    if(this.player?.mode==='sailing'){
      const spot=canDock(this.player)?{islandId:this.islandId}:landingSpot(this.player,this.navHere());
      const text=spot&&!spot.islet&&bogLandingNotice(spot.islandId,getPlayerKarma({room:this}));
      if(text)this.onNotice(text);
    }
    return this.send({type:'disembark'});
  }

  watch(islandId) {
    if (this.id || !islandFor(islandId) || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({type:'watch',islandId}));
  }

  boatPoses(now=nowSeconds()) {
    return [...this.boatTracks.values()].map(track => {
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
    if (!this.player) return;
    const now = nowSeconds();
    const {x,y,turn}=this.player;
    this.prev = {x:x+this.offsetX, y:y+this.offsetY, turn};
    if (this.input.x !== input.x || this.input.y !== input.y || Boolean(this.input.run) !== Boolean(input.run) || this.input.reducedMotion!==input.reducedMotion || (moving(input) && now-this.lastInput >= .1)) {
      if (this.send({type:'input',x:input.x,y:input.y,reducedMotion:input.reducedMotion===true,...(input.run ? {run:true} : {})}, now)) {
        this.input = input;
        this.lastInput = now;
      }
    }
    if (this.player.mode === 'sailing') sailStep(this.player,dt,input);
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
    if (backward > distance2 / 2 && distance2 > 0) {
      const scale = distance2 / (2 * backward);
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
    clearInterval(this.heartbeat);
    clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
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
