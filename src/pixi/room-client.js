import {DURATIONS, playEmote, startJump, setWalkDestination, walkStep} from './player-motion.js';
import {CHAT_INTERVAL, chatText} from './chat.js';
import {nearbyFriend} from './friends.js';
import {islandFor, HARBOR, destinationsFor, near, canSail, canDock, setSailDestination, sailStep} from './islands.js';

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
    this.pending = [];
    this.input = ZERO;
    this.lastInput = -Infinity;
    this.offsetX = this.offsetY = 0;
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
      if (message.type === 'travel-notice') this.onNotice(message.text);
      if (message.type === 'friends-changed') this.onFriendsChanged();
      if (message.type === 'snapshot') this.snapshot(message);
      if (message.type === 'joined') this.onJoin(message);
      if (message.type === 'chat') this.onChat(message.id, message.text);
      if (message.type === 'welcome' || message.type === 'role') {
        if (message.type === 'welcome') this.onFriendsChanged();
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
    const own=players.find(pose => pose.id === this.id);
    const mode=own?.mode ?? 'walking';
    const changed=this.islandId !== islandId || this.mode !== mode || this.epoch !== epoch;
    if (changed) {
      this.pending=[];
      this.input=ZERO;
      this.offsetX=this.offsetY=0;
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
          pace:previous?.pace ?? 0, heading:previous?.heading ?? null};
        this.pending = this.pending.filter(command => command.seq > self.ack);
        for (const command of this.pending) this.predict(command, now);
        if (previous) {
          this.offsetX += previous.x - this.player.x;
          this.offsetY += previous.y - this.player.y;
          if (Math.hypot(this.offsetX,this.offsetY) > 90) this.offsetX = this.offsetY = 0;
        }
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
    if (command.type === 'jump') return startJump(this.player);
    if (command.stop === true) {this.player.path=[];this.player.sailTarget=null;this.player.docking=false;this.player.pace=0;this.player.heading=null;}
    if (command.type === 'destination' && this.nav) return this.player.mode === 'sailing'
      ? setSailDestination(this.player,command.x,command.y) : setWalkDestination(this.player, this.nav, command.x, command.y);
    if (command.type === 'disembark' && this.player.mode === 'sailing' && canDock(this.player)) {
      setSailDestination(this.player,HARBOR.water.x,HARBOR.water.y); this.player.docking=true;
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
    if (this.player?.mode !== 'sailing' && (x<0 || y<0 || x>=this.world.width || y>=this.world.height)) return null;
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

  disembark() {
    return this.send({type:'disembark'});   // boss 5 Nov: the server docks at the harbor or hops you onto the nearest shore
  }

  watch(islandId) {
    if (this.id || !islandFor(islandId) || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({type:'watch',islandId}));
  }

  boatPoses(now=nowSeconds()) {
    return [...this.boatTracks.values()].map(track => {
      const boat=sample(track,now);
      return boat.occupant === this.id && this.player
        ? {...boat,x:this.player.x+this.offsetX,y:this.player.y+this.offsetY,turn:this.player.turn,travel:this.player.travel}
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
    if (this.input.x !== input.x || this.input.y !== input.y || (moving(input) && now-this.lastInput >= .1)) {
      if (this.send({type:'input',...input}, now)) {
        this.input = input;
        this.lastInput = now;
      }
    }
    if (this.player.mode === 'sailing') sailStep(this.player,dt,input);
    else walkStep(this.player, this.nav, dt, now, input);
    const decay = Math.exp(-19 * dt);
    this.offsetX *= decay;
    this.offsetY *= decay;
  }

  poses(now = nowSeconds()) {
    const poses = [...this.tracks.values()].map(track => sample(track, now));
    if (this.player) poses.push({...this.player, x:this.player.x+this.offsetX,
      y:this.player.y+this.offsetY, player:true});
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
