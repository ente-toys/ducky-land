import {DURATIONS, playEmote, setWalkDestination, walkStep} from './player-motion.js';

const ZERO = {x:0,y:0};
const moving = input => input.x !== 0 || input.y !== 0;
const nowSeconds = () => performance.now() / 1000;

function sample(track, now) {
  const {from,to,start} = track;
  const blend = Math.min(1, Math.max(0, (now-start) * 10));
  const turn = to.turn - from.turn;
  return {...to, x:from.x+(to.x-from.x)*blend, y:from.y+(to.y-from.y)*blend,
    turn:from.turn+Math.atan2(Math.sin(turn), Math.cos(turn))*blend};
}

export class RoomClient {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.tracks = new Map();
    this.reset();
  }

  configure(nav, world) {
    this.nav = nav;
    this.world = world;
  }

  reset() {
    this.tracks.clear();
    this.id = null;
    this.player = null;
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
      if (message.type === 'snapshot') this.snapshot(message);
      if (message.type === 'welcome' || message.type === 'role') {
        this.failures = 0;
        this.id = message.id;
        if (!this.id) this.player = null;
        if (message.type === 'role' || message.reason === 'players-full') this.wantsPlay = false;
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

  snapshot({epoch,tick,players,self}) {
    if (epoch === this.epoch && tick <= this.tick) return;
    this.epoch = epoch;
    this.tick = tick;
    const now = nowSeconds();
    const tracks = new Map();
    for (const pose of players) {
      if (pose.id === this.id && self) {
        const previous = this.player;
        this.player = {...pose, path:self.path, until:now+self.emoteLeft};
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
  }

  predict(command, now) {
    if (command.type === 'destination' && this.nav) return setWalkDestination(this.player, this.nav, command.x, command.y);
    if (command.type === 'emote') playEmote(this.player, command.action, now);
    return null;
  }

  send(command, now = nowSeconds()) {
    if (!this.player || this.socket?.readyState !== WebSocket.OPEN || this.pending.length >= 40) return false;
    command.seq = ++this.seq;
    this.socket.send(JSON.stringify(command));
    this.pending.push(command);
    return this.predict(command, now) ?? true;
  }

  destination(x, y) {
    if (!this.world || x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return null;
    const result = this.send({type:'destination',x,y});
    return Array.isArray(result) ? result : null;
  }

  emote(action) {
    return Object.hasOwn(DURATIONS, action) && this.send({type:'emote',action});
  }

  stopInput() {
    if (moving(this.input)) this.send({type:'input',...ZERO});
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
    walkStep(this.player, this.nav, dt, now, input);
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
