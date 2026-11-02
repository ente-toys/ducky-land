import {Application, Assets, Container, Graphics, Sprite} from 'pixi.js';
import world from '../../rive/web/world.json';
import art from './art-manifest.json';
import {createSimulation} from '../three/simulation.js';
import {createAudio} from '../three/audio.js';
import {createDuck, disposeDuckAssets} from './duck.js';
import {createPlacements} from './placements.js';
import {clamp, easeCamera, fitZoom, Gestures, movePinch, screenToWorld, zoomAt} from './camera.js';

// Simulation and audio are renderer-independent; neither imports Three.js or Rive.
const textureLeases = new Map();
function acquire(src, resolution = 1) {
  let entry = textureLeases.get(src);
  if (!entry) {
    entry = {count: 0, promise: Assets.load({src, data: {resolution}})};
    textureLeases.set(src, entry);
  }
  entry.count++;
  return entry.promise;
}
function release(src) {
  const entry = textureLeases.get(src);
  if (!entry || --entry.count) return;
  entry.promise.then(() => {
    if (entry.count || textureLeases.get(src) !== entry) return;
    textureLeases.delete(src);
    Assets.unload(src).catch(() => {});
  }).catch(() => textureLeases.delete(src));
}

export class PixiIsland {
  constructor({onError = () => {}} = {}) {
    this.onError = onError;
    this.disposed = false;
    this.ready = false;
    this.cleanups = [];
    this.loaded = [];
    this.rigs = [];
    this.keys = new Set();
    this.gestures = new Gestures();
    this.camera = {x: 2820, y: 2410, zoom: .6};
    this.target = {...this.camera};
    this.follow = false;
    this.gust = 0;
    this.frame = 0;
    this.frameTimes = [];
    this.accumulator = 0;
    this.lastTap = -Infinity;
    this.audio = createAudio();
  }

  async mount(host) {
    this.host = host;
    this.app = new Application();
    try {
      await this.app.init({width: host.clientWidth || 1280, height: host.clientHeight || 720,
        resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true,
        antialias: true, background: '#86cee6', preference: 'webgl', autoStart: false,
        sharedTicker: false});
      if (this.disposed) { this.app.destroy(true, {children: true}); return; }
      this.initialized = true;
      this.canvas = this.app.canvas;
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute('role', 'application');
      this.canvas.setAttribute('aria-label', 'Ducky Land illustrated island. Drag to pan, scroll or pinch to zoom, click to walk. WASD or arrows move. Q quacks, E dances, 1 to 7 emote, M toggles sound, F follows, Home shows the island.');
      this.canvas.dataset.renderer = 'pixijs';
      this.canvas.dataset.state = 'loading';
      host.appendChild(this.canvas);
      this.scene = new Container();
      this.ground = new Container();
      this.water = new Container();
      this.objects = new Container({sortableChildren: true});
      this.air = new Container();
      this.scene.addChild(this.ground, this.water, this.objects, this.air);
      this.app.stage.addChild(this.scene);
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.sim = createSimulation(world);
      this.resize(true);
      this.listen(this.canvas, 'webglcontextlost', event => {event.preventDefault(); cancelAnimationFrame(this.raf); this.audio.suspend(); this.onError();});
      const props = createPlacements(world, this.sim.nav.walkable);
      const tiles = art.ground.tiles;
      const entries = [...tiles, ...props];
      const sources = entries.map(p => p.src);
      this.loaded.push(...sources);
      const textures = await Promise.all(entries.map(p => acquire(p.src, p.resolution)));
      if (this.disposed) return;
      tiles.forEach((tile, i) => {
        const sprite = new Sprite(textures[i]);
        sprite.position.set(tile.x, tile.y);
        sprite.width = tile.width;
        sprite.height = tile.height;
        this.ground.addChild(sprite);
      });
      this.props = props.map((prop, i) => {
        const sprite = new Sprite(textures[tiles.length + i]);
        sprite.anchor.set(prop.anchor.x, prop.anchor.y);
        sprite.position.set(prop.x, prop.y);
        sprite.width = prop.width * prop.scale;
        sprite.height = prop.height * prop.scale;
        sprite.zIndex = prop.y;
        this.objects.addChild(sprite);
        return {sprite, ...prop, wind: /tree|reeds|bunting|banner|umbrella/i.test(prop.name), boat: /boat/i.test(prop.asset || prop.name)};
      });
      const results = await Promise.allSettled(this.sim.ducks.map(d => createDuck({outfit: d.outfit, seed: d.id + 21})));
      this.rigs = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      if (this.disposed) {this.rigs.forEach(r => r.dispose()); this.rigs = []; disposeDuckAssets().catch(() => {}); return;}
      const failure = results.find(r => r.status === 'rejected');
      if (failure) throw failure.reason;
      this.rigs.forEach((rig, i) => {
        const duck = this.sim.ducks[i];
        // The original flat view scales the source drawing by .88 × .24.
        // The reusable rig's own scale is 1/3; compensate at its world root.
        rig.root.scale.set(.88 * .24 * 3);
        rig.root.position.set(duck.x, duck.y);
        this.objects.addChild(rig.root);
      });
      this.createAmbient();
      this.bindInput();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(host);
      this.ready = true;
      this.canvas.dataset.state = 'ready';
      this.lastFrame = performance.now();
      this.raf = requestAnimationFrame(time => this.tick(time));
    } catch (error) {
      if (!this.disposed) {console.error('Pixi island:', error); this.onError(error); this.dispose();}
    }
  }

  createAmbient() {
    this.ripples = [];
    world.water.forEach((lake, index) => {
      for (let i = 0; i < 12; i++) {
        const phase = i * 2.399 + index;
        const ripple = new Graphics().ellipse(0, 0, 21, 5).stroke({width: 2, color: '#d5fbff', alpha: .6});
        ripple.position.set(lake.x + Math.cos(phase) * lake.rx * (.2 + i / 18), lake.y + Math.sin(phase) * lake.ry * .7);
        this.water.addChild(ripple);
        this.ripples.push({sprite: ripple, phase});
      }
    });
    this.leaves = [];
    this.props.filter(p => /tree/.test(p.name)).forEach((tree, i) => {
      const leaf = new Graphics().ellipse(0, 0, 6, 2.5).fill(i % 3 ? '#a9c96d' : '#f3d77b');
      this.air.addChild(leaf);
      this.leaves.push({sprite: leaf, x: tree.x, y: tree.y - 150, phase: i * 1.93});
    });
    this.droplets = [];
    for (let i = 0; i < 12; i++) {
      const drop = new Graphics().ellipse(0, 0, 2.5, 4).fill('#ddfaff');
      this.objects.addChild(drop);
      drop.zIndex = 2351;
      this.droplets.push(drop);
    }
    this.marker = new Graphics().ellipse(0, 0, 24, 12).stroke({width: 3, color: '#fff9da', alpha: .8});
    this.marker.visible = false;
    this.water.addChild(this.marker);
  }

  listen(target, name, fn, options) {
    target.addEventListener(name, fn, options);
    this.cleanups.push(() => target.removeEventListener(name, fn, options));
  }

  bindInput() {
    const point = event => {const r = this.canvas.getBoundingClientRect(); return {x: event.clientX - r.left, y: event.clientY - r.top};};
    this.listen(this.canvas, 'pointerdown', event => {
      if (event.button > 0) return;
      event.preventDefault();
      this.canvas.focus({preventScroll: true});
      this.audio.unlock();
      this.canvas.setPointerCapture(event.pointerId);
      this.gestures.down(event.pointerId, point(event));
    });
    this.listen(this.canvas, 'pointermove', event => {
      const movement = this.gestures.move(event.pointerId, point(event));
      if (!movement) return;
      if (movement.after.length > 1) {
        movePinch(this.camera, movement.before, movement.after, this.minZoom, 1.65, this.width, this.height);
      } else if (movement.drag) {
        this.camera.x -= movement.dx / this.camera.zoom;
        this.camera.y -= movement.dy / this.camera.zoom;
        this.gust = clamp(movement.dx * .005, -.5, .5);
      } else return;
      this.follow = false;
      Object.assign(this.target, this.camera);
    });
    const up = (event, cancelled) => {
      // Account for a final position that did not generate a pointermove event.
      if (!cancelled) this.gestures.move(event.pointerId, point(event));
      const tap = this.gestures.up(event.pointerId, cancelled);
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      if (tap) this.tap(tap);
    };
    this.listen(this.canvas, 'pointerup', event => up(event, false));
    this.listen(this.canvas, 'pointercancel', event => up(event, true));
    this.listen(this.canvas, 'lostpointercapture', event => this.gestures.up(event.pointerId, true));
    this.listen(this.canvas, 'contextmenu', event => event.preventDefault());
    this.listen(this.canvas, 'wheel', event => {
      event.preventDefault();
      const p = point(event);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      Object.assign(this.target, this.camera);
      zoomAt(this.target, clamp(this.camera.zoom * Math.exp(-delta * .0015), this.minZoom, 1.65), p.x, p.y, this.width, this.height);
      this.follow = false;
    }, {passive: false});
    this.listen(window, 'keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|BUTTON/.test(event.target?.tagName)) return;
      const key = event.key.toLowerCase();
      if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','q','e','1','2','3','4','5','6','7','m','f','home','0','+','=','-'].includes(key)) return;
      event.preventDefault();
      this.audio.unlock();
      this.keys.add(key);
      if (event.repeat) return;
      if (key === 'q') this.triggerEmote(2);
      if (key === 'e') this.triggerEmote(3);
      if (/^[1-7]$/.test(key)) this.triggerEmote(key === '1' ? 2 : Number(key) + 2);
      if (key === 'm') this.audio.toggle();
      if (key === 'f') {this.follow = !this.follow; if (this.follow) this.target.zoom = Math.max(.65, this.camera.zoom);}
      if (key === 'home' || key === '0') this.fit();
      if (['+','=','-'].includes(key)) {
        this.target.zoom = clamp(this.target.zoom * (key === '-' ? .8 : 1.25), this.minZoom, 1.65);
      }
    });
    this.listen(window, 'keyup', event => this.keys.delete(event.key.toLowerCase()));
    this.listen(window, 'blur', () => {this.keys.clear(); this.gestures.clear();});
    this.listen(document, 'visibilitychange', () => {
      this.keys.clear(); this.gestures.clear(); this.accumulator = 0;
      cancelAnimationFrame(this.raf);
      if (document.hidden) this.audio.suspend();
      else {this.audio.resume(); this.lastFrame = performance.now(); this.raf = requestAnimationFrame(time => this.tick(time));}
    });
  }

  tap(point) {
    const p = screenToWorld(this.camera, point, this.width, this.height);
    const hit = [...this.sim.ducks].sort((a,b) => b.y - a.y).find(d => ((p.x-d.x)/43)**2 + ((p.y-(d.y-53))/65)**2 < 1);
    const now = performance.now();
    if (hit?.player) {
      this.triggerEmote(now - this.lastTap < 330 ? 3 : 2);
      this.lastTap = now;
    } else if (hit) {
      this.sim.emote(6, hit);
      hit.turn = Math.atan2(this.sim.player.x-hit.x, this.sim.player.y-hit.y);
      this.triggerEmote(2);
    } else {
      this.lastTap = -Infinity;
      this.setDestination(p);
    }
  }

  setDestination(point) {
    const destination = this.sim.destination(point.x, point.y);
    if (destination) {
      this.marker.position.set(...destination);
      this.markerUntil = this.sim.time + .7;
      this.audio.play('pop', .045);
    }
    return destination;
  }

  triggerEmote(action) {
    this.sim.emote(action);
    this.audio.unlock().then(() => this.audio.play(action === 2 ? 'quack' : 'pop', action === 2 ? .12 : .06));
  }

  fit() {
    this.follow = false;
    Object.assign(this.target, {x: world.width / 2, y: world.height / 2, zoom: this.minZoom});
  }

  resize(initial = false) {
    if (!this.initialized || this.disposed) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(this.width, this.height);
    this.minZoom = fitZoom(this.width, this.height, world.width, world.height);
    if (initial) {
      this.camera.zoom = Math.min(this.width / 1850, this.height / 1250);
      Object.assign(this.target, this.camera);
    }
  }

  tick(now) {
    if (this.disposed || document.hidden) return;
    const dt = Math.min(.1, (now - this.lastFrame) / 1000);
    this.frameTimes.push((now - this.lastFrame));
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    this.lastFrame = now;
    this.frame++;
    this.accumulator += dt;
    const input = {
      x: Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')),
      y: Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')),
    };
    while (this.accumulator >= 1 / 60) {this.sim.step(1 / 60, input); this.accumulator -= 1 / 60;}
    const t = this.sim.time;
    const reduced = this.motion.matches;
    if (this.follow) Object.assign(this.target, {x: this.sim.player.x, y: this.sim.player.y - 100});
    easeCamera(this.camera, this.target, dt, reduced);
    this.scene.scale.set(this.camera.zoom);
    this.scene.position.set(this.width / 2 - this.camera.x * this.camera.zoom, this.height / 2 - this.camera.y * this.camera.zoom);
    const halfWidth = this.width / (2 * this.camera.zoom), halfHeight = this.height / (2 * this.camera.zoom);
    const visible = (x,y,pad=350) => Math.abs(x-this.camera.x)<halfWidth+pad && Math.abs(y-this.camera.y)<halfHeight+pad;
    this.gust *= Math.exp(-dt * 2.5);
    this.props.forEach((prop, i) => {
      prop.sprite.visible = visible(prop.x, prop.y, Math.max(prop.width, prop.height) * prop.scale);
      if (!prop.sprite.visible) return;
      prop.sprite.skew.x = !reduced && prop.wind ? Math.sin(t * 1.3 + i * .7) * .006 + this.gust * .035 : 0;
      prop.sprite.y = prop.y + (!reduced && prop.boat ? Math.sin(t * 1.5 + i) * 3 : 0);
      prop.sprite.rotation = !reduced && prop.boat ? Math.sin(t * 1.1 + i) * .008 : 0;
    });
    const alpha = this.accumulator * 60;
    this.rigs.forEach((rig, i) => {
      const duck = this.sim.ducks[i];
      const x = duck.previousX + (duck.x-duck.previousX)*alpha;
      const y = duck.previousY + (duck.y-duck.previousY)*alpha;
      rig.root.position.set(x, y);
      rig.root.zIndex = y;
      rig.root.visible = visible(x, y, 200);
      if (rig.root.visible) rig.update(dt, {action: duck.action, speed: duck.travel, turn: duck.turn, time: t, reducedMotion: reduced, emoteVersion: duck.emoteVersion});
    });
    this.ripples.forEach(({sprite, phase}) => {sprite.scale.set(reduced ? 1 : 1 + Math.sin(t*.8+phase)*.22); sprite.alpha = reduced ? .35 : .35 + Math.sin(t+phase)*.2;});
    this.leaves.forEach(({sprite,x,y,phase}) => {
      sprite.visible = !reduced && visible(x,y);
      const age = (t * .12 + phase) % 1;
      sprite.position.set(x + age * 170 + Math.sin(t + phase) * 12, y + age * 210);
      sprite.rotation = Math.sin(t * 2 + phase);
      sprite.alpha = Math.sin(age*Math.PI) * .65;
    });
    this.droplets.forEach((sprite,i) => {
      sprite.visible = !reduced;
      const phase = (t*.7+i/12)%1;
      sprite.position.set(2820+Math.sin(i*2.4)*65*phase, 2260-100*Math.sin(phase*Math.PI));
      sprite.alpha = Math.sin(phase*Math.PI)*.7;
    });
    this.marker.visible = this.markerUntil > t;
    if (this.marker.visible) {this.marker.alpha = (this.markerUntil-t)/.7; this.marker.scale.set(1.3-(this.markerUntil-t)*.6);}
    if (this.sim.player.travel && t > (this.nextStep || 0)) {this.audio.play('step', .018); this.nextStep = t + .32;}
    this.app.render();
    // DOM-only diagnostics make automated acceptance possible without scene overlays.
    if (this.frame % 15 === 0) {
      const d = this.canvas.dataset;
      d.ducks = String(this.sim.ducks.length);
      d.player = `${this.sim.player.x.toFixed(1)},${this.sim.player.y.toFixed(1)}`;
      d.action = String(this.sim.player.action);
      d.camera = JSON.stringify(this.camera);
      d.frameMs = (dt * 1000).toFixed(2);
      if (this.frame % 60 === 0) {
        const sorted = [...this.frameTimes].sort((a,b) => a-b);
        d.frameMeanMs = (sorted.reduce((sum,n) => sum+n,0) / sorted.length).toFixed(2);
        d.frameP95Ms = sorted[Math.floor(sorted.length*.95)].toFixed(2);
      }
      d.simulationTime = t.toFixed(2);
      d.reducedMotion = String(reduced);
    }
    this.raf = requestAnimationFrame(time => this.tick(time));
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.cleanups.forEach(fn => fn());
    this.keys.clear();
    this.gestures.clear();
    this.audio.dispose();
    this.rigs.forEach(rig => rig.dispose());
    this.rigs = [];
    disposeDuckAssets().catch(() => {});
    if (this.initialized) this.app.destroy(true, {children: true});
    this.loaded.forEach(release);
    this.loaded = [];
  }
}
