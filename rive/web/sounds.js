// Four local original WAVs, no remote audio service or Rive signed audio required.
class LocalSounds {
  constructor() {
    this.context = null; this.buffers = {}; this.muted = false; this.played = {};
    this.files = Promise.all(['quack','pop','splash','step'].map(async name => {
      const res = await fetch('audio/' + name + '.wav');
      if (!res.ok) throw new Error('Missing local SFX: ' + name);
      return [name, await res.arrayBuffer()];
    }));
    this.files.catch(console.error);
  }
  unlock() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.ready = this.files.then(files => Promise.all(files.map(async ([name, bytes]) => {
        this.buffers[name] = await this.context.decodeAudioData(bytes);
      })));
    }
    return this.context.resume();
  }
  async play(name, volume = .2) {
    if (this.muted || !this.context) return;
    await this.ready;
    if (this.muted || this.context.state !== 'running') return;
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = this.buffers[name]; gain.gain.value = volume;
    source.connect(gain).connect(this.context.destination); source.start();
    this.played[name] = (this.played[name] || 0) + 1;
  }
}
