// The sled hill's room, seen from one player: watches the lobby while you are near the hill, joins a seat, readies
// up, and during a race smooths the server's updates (20 a second) for SledRace: the race is drawn DELAY seconds
// behind the server, between the two updates either side of that moment, so racers glide rather than jump.
const INPUT_EVERY = 1 / 30, DELAY = .1;
export const sledURL = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/sled-room`;

export class SledClient {
  constructor({onState = () => {}, onMedals = () => {}, onClose = () => {}, Socket = WebSocket, url = sledURL(), clock = () => performance.now() / 1000} = {}) {
    Object.assign(this, {onState, onMedals, onClose, clock});
    this.id = null; this.lobby = null; this.last = null; this.frames = []; this.lag = Infinity; this.results = null; this.events = []; this.sentAt = -Infinity; this.lastInput = null;
    this.socket = new Socket(url);
    this.socket.onmessage = e => this.receive(e.data);
    this.socket.onclose = e => this.onClose(e.code);
  }
  receive(raw) {
    let m; try {m = JSON.parse(raw);} catch {return;}
    if (m.type === 'sled-welcome') {this.id = m.id; this.profile = m.profile;}
    else if (m.type === 'sled-medals') {this.profile = m.profile; this.onMedals(m.medals);}
    else if (m.type === 'sled-busy') this.onState({...this.lobby, busy: m.reason});
    else if (m.type === 'sled-state') {
      const at = this.clock();
      // server seconds = local seconds + offset (the smallest seen, so network delay does not drift it)
      this.offset = Math.min(this.offset ?? Infinity, m.now - at);
      // the last race stays on screen, results included, until the next one starts (a background tab can miss the
      // short results window entirely)
      if (m.phase === 'racing') {
        if (this.last?.seed !== m.seed) {this.results = null; this.frames = []; this.lag = Infinity;}
        this.last = {...m, at};
        // race seconds = local seconds - lag (the smallest seen, so network jitter does not shake the racers)
        this.lag = Math.min(this.lag, at - m.time);
        this.frames.push({time: m.time, state: m.state});
        while (this.frames.length > 2 && this.frames[1].time < m.time - 1) this.frames.shift();
      }
      if (m.phase === 'results' && m.results) this.results = m.results;
      this.events.push(...(m.events ?? []));
      this.lobby = m; this.onState(m);
    }
  }
  send(message) {if (this.socket.readyState === 1) this.socket.send(JSON.stringify(message));}
  join() {this.send({type: 'sled-join'});}
  ready(on = true) {this.send({type: 'sled-ready', ready: on});}
  leaveSeat() {this.send({type: 'sled-leave'});}
  close() {this.socket.close(1000);}
  serverNow() {return this.clock() + (this.offset ?? 0);}
  seated() {return Boolean(this.lobby?.seats?.some(s => s.id === this.id) || this.lobby?.racers?.some(r => r.id === this.id));}

  // --- what SledRace asks for ---
  countdown() {return this.lobby?.phase === 'countdown' ? Math.max(0, this.lobby.endsAt - this.serverNow()) : 0;}
  steer(input) {
    const now = this.clock(), key = `${input.steer}|${input.tuck}|${input.jump}`;
    if (now - this.sentAt < INPUT_EVERY && key === this.lastInput) return;
    if (now - this.sentAt < INPUT_EVERY / 2) return;
    this.sentAt = now; this.lastInput = key;
    this.send({type: 'sled-input', steer: input.steer, tuck: input.tuck, jump: input.jump});
  }
  drainEvents() {return this.events.splice(0);}
  finished() {return Boolean(this.results);}
  standings() {
    return (this.results?.standings ?? []).map(r => ({...r, finishedAt: r.time}));
  }
  // the race DELAY seconds ago, between the two updates either side of that moment
  view() {
    const names = new Map((this.last?.racers ?? this.lobby?.racers ?? []).map(r => [r.id, r]));
    if (!this.frames.length) return {time: 0, racers: [...names.values()].map(r => ({...r, d: 0, x: 0, v: 0, vx: 0, crashUntil: -1, boostUntil: -1, airUntil: -1, finishedAt: null, place: null})), done: this.finished()};
    const time = this.clock() - this.lag - DELAY, frames = this.frames;
    let i = frames.findIndex(f => f.time > time);
    if (i < 0) i = frames.length - 1;
    const b = frames[i], a = frames[Math.max(0, i - 1)], u = b.time > a.time ? Math.min(1, Math.max(0, (time - a.time) / (b.time - a.time))) : 1;
    const before = new Map(a.state.map(r => [r.id, r]));
    const racers = b.state.map(r => {
      const p = before.get(r.id) ?? r, mix = (k) => p[k] + (r[k] - p[k]) * u;
      return {...names.get(r.id), ...r, d: mix('d'), x: mix('x')};
    });
    return {time: Math.max(0, Math.min(b.time, time)), racers, done: this.finished()};
  }
}
