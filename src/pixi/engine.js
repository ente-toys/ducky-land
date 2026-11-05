import {createWeather,windStrength} from './weather.js';
import {createBird,birdPose,createCrow,crowPose} from './birds.js';
import {createBeachSurf} from './surf.js';
import {createRowboat} from './rowboat.js';
import {createMooredBoats} from './sailboats.js';
import {createTravelView} from './travel-view.js';
import {HARBOR, islandFor, near, SEA_BOUNDS, destinationsFor, offshoreProgress, harborClear, harborWorld} from './islands.js';
import {createButterfly,butterflyPose} from './butterflies.js';
import {floatingPose} from './floating.js';
import {Application, Assets, Container, Graphics, Sprite, TilingSprite} from 'pixi.js';
import rawWorld from '../../rive/web/world.json';
import art from './art-manifest.json';
import {createSimulation} from './simulation.js';
import {createAudio} from './audio.js';
import {createDuck, disposeDuckAssets} from './duck.js';   // boss 3 Nov: back to Ashwin's PixiJS Ducky (no Rive)
import {createFountainWater} from './fountain.js';
import {createWater} from './water.js';
import {createPlacements, decalsFor, deckY, groundAt, H, JETTIES, sleeperFootprint, sleepSpots, trimWorld, walkWorld} from './placements.js';
import {sleepHalfWidths} from './sleeper.js';
import {createInterior} from './interior.js';
const napWidths = sleepHalfWidths(.88 * .24 * 3);   // world half width per sleeping pose
const world = trimWorld(rawWorld);   // round 4: the east islet and its jetty are gone
import {geometry, inShape} from '../../rive/web/island-geometry.mjs';
import {PALETTE} from './palette.js';
import {clamp, easeCamera, fitZoom, Gestures, movePinch, screenToWorld, TILT, zoomAt} from './camera.js';
import {CHAT_DURATION} from './chat.js';

// Simulation and audio are renderer-independent; neither imports Three.js or Rive.
const textureLeases = new Map();
const ZERO = {x:0,y:0};
const MUSEUM_DOOR = {x0: 2850, x1: 2990, y: 1215, out: {x: 2920, y: 1340}};   // boss 5 Nov: the top of the museum steps; out = a few steps down
const CHAT_LABEL_GAP = 4;
// boss 3 Nov, fix 4: ONE contact shadow for every grounded prop: a flat unoutlined ellipse tucked under the base,
// 12-18% opacity, tinted for the ground under it, nudged at most .15H toward the lower right. [pattern, width share, depth ratio]
const SHADOW_TINT = {sand: [PALETTE.sandShade, .18], grass: [PALETTE.deepLeaf, .15], water: [PALETTE.ink, .12]};
const FOOTPRINT = [[/bench-wood-(left|right)/, .1, 2.4], [/fountain/, .25, .82], [/^tree-/, .3, .3], [/^(bush|flower)-/, .4, .32], [/lamp|pole/, .4, .34],
  [/lighthouse/, .3, .32], [/umbrella/, .32, .4], [/library/, .44, .26], [/boat/, .36, .3]];
const NO_SHADOW = /bunting|banner|flag|bridge|blanket|lily|shell|reeds/i;
function contactShadow(prop) {
  const name = prop.asset || prop.name, [, share, depth] = FOOTPRINT.find(([re]) => re.test(name)) || [, .38, .3];
  const rx = Math.max(8, Math.min(300, prop.width * prop.scale * share)), ry = rx * depth;
  const [color, alpha] = SHADOW_TINT[/boat/i.test(name) ? 'water' : groundAt(prop.x, prop.y, world)];
  const nudge = Math.min(1, rx / 80) * .15 * H / Math.hypot(2, 1);   // up to .15H along (2, 1)
  return new Graphics().ellipse(nudge * 2, nudge, rx, ry).fill({color, alpha});
}
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
  constructor({onError = () => {}, room = null, chatLayer = null, chatEditor = null, nameLayer = null} = {}) {
    this.room = room;
    this.islandId = 'home';
    this.travelMode = 'walking';
    this.touchInput = {x:0,y:0};
    this.chatLayer = chatLayer;
    this.chatEditor = chatEditor;
    this.nameLayer = nameLayer;
    this.chatBubbles = new Map();
    this.liveRigs = new Map();
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
    this.fitMode = false;
    this.gust = 0;
    this.frame = 0;
    this.frameTimes = [];
    this.accumulator = 0;
    this.lastTap = -Infinity;
    this.doorArmed = true;
    this.audio = createAudio();
  }

  get player() { return this.room ? this.room.player : this.sim?.player; }

  async mount(host) {
    this.host = host;
    this.app = new Application();
    try {
      await this.app.init({width: host.clientWidth || 1280, height: host.clientHeight || 720,
        resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true,
        antialias: true, background: '#6EC9DE', preference: 'webgl', autoStart: false,
        sharedTicker: false});
      if (this.disposed) { this.app.destroy(true, {children: true}); return; }
      this.initialized = true;
      this.canvas = this.app.canvas;
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute('role', 'application');
      this.updateControlLabel();
      this.canvas.dataset.renderer = 'pixijs';
      this.canvas.dataset.state = 'loading';
      host.appendChild(this.canvas);
      this.scene = new Container();
      this.ground = new Container();
      this.water = new Container();
      this.objects = new Container({sortableChildren: true});
      this.air = new Container();
      this.floatLayer=new Container();
      this.contactShadows=new Container();
      this.decks=new Container();   // boss 3 Nov: the arched bridges, over the water and its lily pads, under every Ducky
      this.scene.addChild(this.ground, this.water, this.floatLayer, this.decks, this.contactShadows, this.objects, this.air);
      this.app.stage.addChild(this.scene);
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      // boss 3 Nov: props are placed on the bare island first, then the client sim collides with where they really stand
      const props = createPlacements(world, geometry({...world, obstacles: []}).walkable)
        .filter(prop => !this.room || harborClear(prop)), local = this.room ? harborWorld(walkWorld(world, props)) : walkWorld(world, props);   // boss 5 Nov: live, the jetty deck is walkable (same as scripts/walk-world.mjs)
      globalThis.__duckyProps = props.map(p => ({id: p.id, name: p.name, asset: p.asset, x: Math.round(p.x), y: Math.round(p.y), scale: p.scale, src: p.src}));   // QA readback
      // boss 5 Nov: each sleeping NPC lies where its pose belongs (client only; the socket server never sees NPCs), and each
      // sleeper + its prop is a blocked footprint in the client walk rules, so routes go around it (world.json, worker/ untouched)
      const beds = sleepSpots(local, props, geometry(local).walkable, napWidths), walk = {...local, obstacles: [...local.obstacles, ...beds.map(sleeperFootprint)]};
      this.sim = createSimulation(walk, 8612, {sleepingNpcs: true});
      this.sim.ducks.slice(1).forEach((duck, i) => {const b = beds[i]; if (!b) return; duck.x = duck.previousX = b.x; duck.y = duck.previousY = b.y; duck.sleep = {pose: b.pose, flip: b.flip}; duck.footprint = sleeperFootprint(b);});
      this.sim.ducks.splice(beds.length + 1);   // boss 5 Nov: no bed, no sleeper (never a random one left at its spawn)
      globalThis.__duckySleepers = beds.map(b => ({pose: b.pose, flip: b.flip, x: Math.round(b.x), y: Math.round(b.y), tree: b.tree}));   // QA readback
      globalThis.__duckySleepersDropped = beds.bad;
      this.room?.configure(this.sim.nav, walk);
      this.resize(true);
      this.listen(this.canvas, 'webglcontextlost', event => {event.preventDefault(); cancelAnimationFrame(this.raf); this.audio.suspend(); this.onError();});
      const tiles = art.ground.tiles;
      // round 4: ground detail decals and the plaza paving lie on the tiles; the library stair is a deck like the jetties
      const decals = decalsFor(world, props, geometry({...world, obstacles: []}).walkable);
      const flats = [{src: '/pixi-art/lake-race.svg', x: 3400, y: 1050, width: 1500, height: 950, resolution: 1, topLeft: true},   // boss 4 Nov: race lake D, the spring cove, laid over the old oval
        {src: '/pixi-art/decals/plaza-paving.svg', x: 2330, y: 1980, width: 980, height: 780, resolution: 1, topLeft: true}, ...decals.map(d => ({...d, resolution: 2.5}))];
      const STEPS = [{src: '/pixi-art/library-steps.svg', x: 2780, y: 1370, width: 280, height: 260, resolution: 1.5}];
      const decks = [...JETTIES, ...STEPS];
      const entries = [...tiles, ...decks, ...props, ...art.floating, {src:'/pixi-art/water-texture.svg'}, ...flats];   // boss 3 Nov: arched jetties right after the tiles
      const sources = entries.map(p => p.src);
      this.loaded.push(...sources);
      const textures = await Promise.all(entries.map(p => acquire(p.src, p.resolution)));
      if (this.disposed) return;
      this.ocean=new TilingSprite({texture:textures[tiles.length + decks.length + props.length + art.floating.length],width:world.width,height:world.height});this.scene.addChildAt(this.ocean,0);
      tiles.forEach((tile, i) => {
        const sprite = new Sprite(textures[i]);
        sprite.position.set(tile.x, tile.y);
        sprite.width = tile.width;
        sprite.height = tile.height;
        this.ground.addChild(sprite);
      });
      const base = tiles.length + decks.length, flatBase = base + props.length + art.floating.length + 1;
      this.flats = new Container({label: 'Ground detail'}); this.ground.addChild(this.flats);
      flats.forEach((d, i) => {
        const sprite = new Sprite(textures[flatBase + i]);
        sprite.position.set(d.x, d.y); sprite.width = d.width; sprite.height = d.height;
        if (!d.topLeft) {sprite.anchor.set(.5, 1); sprite.width = d.width; if (d.flip) sprite.scale.x *= -1;}   // decals sit on their base point
        this.flats.addChild(sprite);
      });
      decks.forEach((jetty, i) => {
        const sprite = new Sprite(textures[tiles.length + i]);
        sprite.position.set(jetty.x, jetty.y);
        sprite.width = jetty.width;
        sprite.height = jetty.height;
        this.decks.addChild(sprite);
      });
      this.floating=art.floating.map((item,i)=>{
        const sprite=new Sprite(textures[base+props.length+i]);
        sprite.anchor.set(item.anchor.x,item.anchor.y);sprite.position.set(item.x,item.y);
        sprite.width=item.width;sprite.height=item.height;this.floatLayer.addChild(sprite);
        return {...item,sprite};
      });
      this.props = props.map((prop, i) => {
        const name=prop.asset||prop.name;
        let shadow;
        // boss 3 Nov, fix 4: the redrawn plants carry no baked shadow, so plants get the one engine shadow too
        if(!NO_SHADOW.test(name)){shadow=contactShadow(prop);shadow.position.set(prop.x,prop.y);this.contactShadows.addChild(shadow);}

        const sprite = new Sprite(textures[base + i]);
        sprite.anchor.set(prop.anchor.x, prop.anchor.y);
        sprite.position.set(prop.x, prop.y);
        sprite.width = prop.width * prop.scale;
        sprite.height = prop.height * prop.scale;
        sprite.zIndex = prop.y;
        sprite.standing = true;
        if (prop.flip) sprite.scale.x *= -1;   // round 4: plants flip and tint so a spread-out lawn does not look stamped
        if (prop.tint) sprite.tint = prop.tint;
        (/bridge/i.test(name) ? this.decks : this.objects).addChild(sprite);   // boss 3 Nov: bridges lie under the Duckies who cross them
        return {sprite, shadow, ...prop, wind: /tree|reeds|cattails|flower|leaf|bush|flag|bunting|banner|umbrella/i.test(prop.name), boat: /boat/i.test(prop.asset || prop.name)};
      });
      this.localDucks = this.room ? this.sim.ducks.slice(1) : this.sim.ducks;
      const results = await Promise.allSettled(this.localDucks.map(d => createDuck({outfit: d.outfit, seed: d.id + 21, isPlayer:d.player, sleep: d.sleep})));   // boss 4 Nov: dresses back, as Ashwin had them
      this.rigs = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      this.rigs.forEach((rig, i) => {if (this.localDucks[i]?.player) rig.arrive?.();});   // boss 4 Nov: your Ducky drops in like the Rive arrival
      if (this.disposed) {this.rigs.forEach(r => r.dispose()); this.rigs = []; disposeDuckAssets().catch(() => {}); return;}
      const failure = results.find(r => r.status === 'rejected');
      if (failure) throw failure.reason;
      this.rigs.forEach((rig, i) => {
        const duck = this.localDucks[i];
        // The original flat view scales the source drawing by .88 × .24.
        // The reusable rig's own scale is 1/3; compensate at its world root.
        rig.root.scale.set(.88 * .24 * 3);
        rig.root.position.set(duck.x, duck.y);
        this.objects.addChild(rig.root);
      });
      this.interior = await createInterior(); this.app.stage.addChild(this.interior.root); globalThis.__duckyInterior = () => this.interior.debug();   // boss 5 Nov: the museum room, offline and live (the server keeps you parked at the door while you are inside)
      // boss 4 Nov: water owns only decorative fields. Navigation and multiplayer keep their existing coordinates.
      this.waterFX = await createWater({app: this.app, world, art, layer: this.water,
        objects: this.objects, props: this.props, motion: this.motion});
      if (this.disposed) {this.waterFX.dispose(); return;}
      this.createAmbient();
      if (this.room) {
        this.travelView=await createTravelView(this.objects,this.water,this.air,this.decks);
        if (this.disposed) return;
        this.travelView.fx.waterSplash=(x,y)=>this.waterFX?.splash(x,y,.85,30);   // boss 5 Nov: a boarding Ducky rocks the real water too
        this.switchIsland(this.room.islandId);
      }
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
    this.weather=createWeather(world,this.scene,this.air);
    this.surf = createBeachSurf(this.water);   // boss 5 Nov: the original beach surf, not the simulated one
    const rowingProp = this.props.find(prop => prop.asset === 'rowboat');
    this.rowboat = null;   // boss 4 Nov: no boats on the race lake
    this.boats = createMooredBoats(this.water, world.islets, {x: 2980, y: 2005}, {coast: world.coast, avoid: this.room ? [{x: HARBOR.pier.x + HARBOR.pier.width / 2, y: HARBOR.pier.y + HARBOR.pier.height / 2, r: 560}] : []});   // boss 5 Nov: 1-5 boats at each jetty islet
    globalThis.__duckyBoats = this.boats.count;
    rowingProp?.sprite?.destroy?.(); rowingProp?.shadow?.destroy?.();
    this.props = this.props.filter(prop => prop !== rowingProp);
    this.ripples = [];
    (this.waterFX?.active ? [] : world.water).forEach((lake, index) => {
      for (let i = 0; i < 4; i++) {   // fix 9: 2-4 cream ripples per water feature
        const phase = i * 2.399 + index;
        const ripple = new Graphics().moveTo(-21, 0).quadraticCurveTo(0, -6, 21, 0).stroke({width: 2, color: PALETTE.cream, alpha: .6, cap: 'round'});   // boss 3 Nov fix 9: cream ripple marks, no rings
        let k = 1;   // boss 4 Nov: on a traced lake, pull a ripple in until it sits on the drawn water
        while (lake.poly && k > .3 && !inShape(lake.x + Math.cos(phase) * lake.rx * (.25 + i / 8) * k, lake.y + Math.sin(phase) * lake.ry * .7 * k, lake, -40)) k -= .1;
        ripple.position.set(lake.x + Math.cos(phase) * lake.rx * (.25 + i / 8) * k, lake.y + Math.sin(phase) * lake.ry * .7 * k);
        this.water.addChild(ripple);
        this.ripples.push({sprite: ripple, phase,x:ripple.x,y:ripple.y});
      }
    });
    this.birds=[[2419,1928],[3185,1897],[3427,2126],[1500,2600],[4200,1700],[3900,2900]].map(([x,y],phase)=>{const bird=createBird(phase);this.air.addChild(bird.root);return {...bird,x,y,phase};});
    this.crows = [   // boss 3 Nov: no black crows
    ].map(flight => {
      const crow = createCrow();
      this.air.addChild(crow.root);
      return {...crow,...flight};
    });
    this.butterflies=[{x:2230,y:2280,color:PALETTE.coral},{x:3420,y:2270,color:PALETTE.sun}].map((item,i)=>{
      const butterfly=createButterfly(item.color);this.air.addChild(butterfly.root);
      return {...item,...butterfly,phase:i*2.4+1};
    });
    this.leaves = [];
    this.props.filter(p => /tree/.test(p.name)).forEach((tree, i) => {
      const leaf = new Graphics().ellipse(0, 0, 6, 2.5).fill(i % 3 ? PALETTE.grass : PALETTE.sandShade);
      this.air.addChild(leaf);
      this.leaves.push({sprite: leaf, x: tree.x, y: tree.y - 150, phase: i * 1.93});
    });
    this.droplets = [];
    // boss 3 Nov: the wishing-bowls fountain animates its own water (fountain.js); the old statue drops are off
    const fountain = this.props.find(p => p.asset === 'fountain-wishing');
    this.fountainWater = fountain ? createFountainWater(fountain, this.objects, this.waterFX) : null;
    for (let i = 0; i < 0; i++) {
      const drop = new Graphics().ellipse(0, 0, 2.5, 4).fill(PALETTE.cream);
      this.objects.addChild(drop);
      drop.zIndex = 2351;
      this.droplets.push(drop);
    }
    this.splashes=[].map((side,i)=>{const sprite=new Graphics().ellipse(0,0,16,5).stroke({color:PALETTE.cream,width:1.8});sprite.position.set(2820+side*62,2260);this.objects.addChild(sprite);sprite.zIndex=2351;return {sprite,phase:i*.5};});
    this.marker = new Graphics().ellipse(0, 0, 20, 9).stroke({width: 3, color: PALETTE.cream, alpha: .8});
    this.marker.visible = false;
    this.water.addChild(this.marker);
  }

  switchIsland(id) {
    this.islandId=id;
    this.stopInput();
    this.clearChat();
    this.markerUntil=0;
    if (this.ready && !this.motion.matches) this.canvas.animate([{opacity:.45},{opacity:1}],{duration:450});
    for (const entry of this.liveRigs.values()) {
      entry.rig?.dispose(); entry.nameplate?.remove(); entry.seatMask?.destroy();
    }
    this.liveRigs.clear();
    const accent=islandFor(id).accent;
    for (const prop of this.props) if (/flower|flag|bunting/i.test(prop.asset || prop.name)) prop.sprite.tint=id==='home'?(prop.tint ?? 0xffffff):accent;
    this.travelView?.switchIsland(id);
    const player=this.player;
    const focus=player ?? HARBOR.land;
    Object.assign(this.target,{x:focus.x,y:focus.y-90,zoom:player?.mode === 'sailing' ? .56 : .6});
    Object.assign(this.camera,this.target);
    this.follow=Boolean(player);
    this.fitMode=false;
  }

  focusHarbor() {
    Object.assign(this.target,{x:HARBOR.pier.x+HARBOR.pier.width/2,y:HARBOR.pier.y+HARBOR.pier.height/2,zoom:.65});   // boss 5 Nov: the whole jetty in view
    this.follow=false; this.fitMode=false;
    this.canvas?.focus();
  }

  listen(target, name, fn, options) {
    target.addEventListener(name, fn, options);
    this.cleanups.push(() => target.removeEventListener(name, fn, options));
  }

  bindInput() {
    const point = event => {const r = this.canvas.getBoundingClientRect(); return {x: event.clientX - r.left, y: event.clientY - r.top};};
    this.listen(this.canvas, 'pointerdown', event => {
      if (event.button !== 0 && event.button !== 1) return;
      event.preventDefault();
      (this.chatEditor?.current ?? this.canvas).focus({preventScroll: true});
      this.audio.unlock();
      this.canvas.setPointerCapture(event.pointerId);
      this.gestures.down(event.pointerId, point(event));
    });
    this.listen(this.canvas, 'pointermove', event => {
      const movement = this.gestures.move(event.pointerId, point(event));
      if (!movement) return;
      if (movement.after.length > 1) {
        movePinch(this.camera, movement.before, movement.after, this.minZoom*.8, 1.8, this.width, this.height);
      } else if (movement.drag) {
        this.camera.x -= movement.dx / this.camera.zoom;
        this.camera.y -= movement.dy / (this.camera.zoom * TILT);
        this.gust = clamp(movement.dx * .005, -.5, .5);
      } else return;
      this.follow = false;
      this.fitMode=false;this.constrain(this.camera);
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
      zoomAt(this.target, clamp(this.camera.zoom * Math.exp(-delta * .0018), this.minZoom*.8, 1.8), p.x, this.height / 2 + (p.y - this.height / 2) / TILT, this.width, this.height);   // tilt-aware wheel anchor
      this.follow = false;this.fitMode=false;this.constrain(this.target);
    }, {passive: false});
    this.listen(window, 'keydown', event => {
      if (event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT|BUTTON|^A$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
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
      if (key === 'f' && this.player) {this.follow=true;this.fitMode=false;this.target.zoom=Math.max(.65,this.target.zoom);}
      if (key === 'home' || key === '0') this.fit();
      if (['+','=','-'].includes(key)) {
        this.target.zoom = clamp(this.target.zoom * (key === '-' ? .8 : 1.25), this.minZoom*.8, 1.8);this.fitMode=false;this.follow=false;
      }
    });
    this.listen(window, 'keyup', event => this.keys.delete(event.key.toLowerCase()));
    this.listen(window, 'blur', () => this.stopInput());
    this.listen(document, 'visibilitychange', () => {
      this.stopInput();
      this.accumulator = 0;
      this.waterFX?.pause();
      cancelAnimationFrame(this.raf);
      if (document.hidden) this.audio.suspend();
      else {this.audio.resume(); this.lastFrame = performance.now(); this.raf = requestAnimationFrame(time => this.tick(time));}
    });
  }

  stopInput() {
    this.keys.clear();
    this.touchInput={x:0,y:0};
    this.gestures.clear();
    this.room?.stopInput();
  }

  showChat(id, text) {
    if (this.disposed || !this.chatLayer) return;
    if (!text) {
      this.removeChat(id);
      return;
    }
    const entry = this.chatBubbles.get(id);
    const bubble = entry?.bubble ?? document.createElement('div');
    if (!entry) {
      bubble.className = 'pixi-chat-bubble';
      bubble.hidden = true;
      this.chatLayer.appendChild(bubble);
    }
    clearTimeout(entry?.timer);
    bubble.textContent = text;
    const timer = setTimeout(() => this.removeChat(id), CHAT_DURATION);
    this.chatBubbles.set(id,{bubble,timer});
  }

  removeChat(id) {
    const entry = this.chatBubbles.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    entry.bubble.remove();
    this.chatBubbles.delete(id);
  }

  clearChat() {
    for (const id of this.chatBubbles.keys()) this.removeChat(id);
  }

  placeLabel(label, x, y) {
    label.hidden = x < 0 || x > this.width || y < 0 || y > this.height;
    if (!label.hidden) label.style.translate = `${x}px ${y}px`;
  }

  duckLabelPosition(pose) {
    const {zoom,x,y} = this.camera;
    return {
      x:this.width / 2 + (pose.x - x) * zoom,
      y:this.height / 2 + (pose.y - y - 165) * zoom - 8,
    };
  }

  positionChatEditor(pose = this.player) {
    const form = this.chatEditor?.current?.form;
    if (!form || !pose || !this.width || !this.height) return;
    const anchor = this.duckLabelPosition(pose);
    const left = anchor.x - form.offsetWidth / 2;
    const maxLeft = Math.max(8, this.width - form.offsetWidth - 8);
    const maxTop = Math.max(8, this.height - form.offsetHeight - 8);
    const top = anchor.y + CHAT_LABEL_GAP;
    form.style.translate = `${clamp(left, 8, maxLeft)}px ${clamp(top, 8, maxTop)}px`;
  }

  updateControlLabel() {
    const base = 'Ducky Land illustrated island. Drag to pan, scroll or pinch to zoom. M toggles sound. Home shows the island.';
    const play = this.player?.mode === 'sailing' ? ' WASD or arrows steer. Tap water to sail. Tap the harbor to dock.' : ' Click to walk. WASD or arrows move. Q quacks, E dances, 1 to 7 emote, F follows.';
    const chat = this.chatLayer && this.player ? ' Press C to chat.' : '';
    this.canvas.setAttribute('aria-label', base + (this.room && !this.player ? '' : play) + chat);
  }

  tap(point) {
    if (this.interior?.active) {this.interior.tap(point); return;}   // boss 5 Nov: inside the museum a tap walks there
    // boss 5 Nov: a tap on a sleeping Ducky only wobbles it: no walk, no emote, the player's Ducky does not react
    const p = screenToWorld(this.camera, point, this.width, this.height);
    if (this.room && this.player) {
      if (this.player.mode === 'sailing') {
        const destination=offshoreProgress(this.player)>.2 && destinationsFor(this.islandId).find(island => Math.abs(p.x-island.x)<400 && Math.abs(p.y-island.y)<350);
        if (destination) this.setDestination(destination.dock);
        else if (near(p,HARBOR.water,140) || near(p,HARBOR.land,120)) this.room.disembark();
        else this.setDestination(p);
        return;
      }
      const boat=this.room.boatPoses().find(boat => near(p,{x:boat.x,y:boat.y-45},100));
      if (boat) {this.room.board(boat.id); this.follow=true; this.fitMode=false; return;}
    }
    this.waterFX?.splash(p.x, p.y, .65, 24);   // a tap on water splashes it
    const hitRadius=Math.max(65,20/this.camera.zoom), me = this.player;
    const onMe = me && me.action !== 7 && Math.hypot(p.x - me.x, p.y - (me.y - 50)) < hitRadius;   // your own Ducky in front of a sleeper still wins
    const napper = !onMe && this.rigs.find((rig, i) => this.localDucks[i]?.sleeping && rig.root.visible && rig.sleeper && (b => point.x > b.x - 8 && point.x < b.x + b.width + 8 && point.y > b.y - 8 && point.y < b.y + b.height + 8)(rig.sleeper.bounds()));
    if (napper) {napper.sleeper.poke(); return;}
    if (!this.player) return;
    const candidates = this.room ? [this.player, ...this.room.poses().filter(duck => !duck.player), ...this.localDucks] : this.localDucks;
    const hit = candidates.find(duck => {
      if (duck.action !== 7) return Math.hypot(p.x - duck.x, p.y - (duck.y - 50)) < hitRadius;
      const width = Math.max(62, 20 / this.camera.zoom);
      const height = Math.max(31, 12 / this.camera.zoom);
      return Math.hypot((p.x - duck.x) / width, (p.y - (duck.y - 27)) / height) < 1;
    });
    const now = performance.now();
    if (hit === this.player) {
      this.triggerEmote(now - this.lastTap < 450 ? 3 : 2);
      this.lastTap = now;
    } else if (hit) {
      if (!this.room && !hit.sleeping) {
        this.sim.emote(2, hit);
        hit.turn = Math.atan2(this.sim.player.x-hit.x, this.sim.player.y-hit.y);
      }
      this.triggerEmote(6);
    } else {
      this.lastTap = -Infinity;
      this.setDestination(p);
    }
  }

  setDestination(point) {
    const destination = this.room ? this.room.destination(point.x, point.y) : this.sim.destination(point.x, point.y);
    if (destination) {
      this.marker.position.set(...destination);
      this.markerUntil = this.sim.time + 1.5;
      this.audio.play('pop', .045);
    }
    return destination;
  }

  triggerEmote(action) {
    if (this.room) {
      if (!this.room.emote(action)) return;
    } else {
      this.sim.emote(action);
      if (this.player.action === action) this.player.turn = 0;
    }
    this.audio.unlock().then(() => this.audio.play(action === 2 ? 'quack' : 'pop', action === 2 ? .12 : .06));
  }

  constrain(camera) {
    const bounds=this.room?SEA_BOUNDS:{x0:250,y0:200,x1:world.width-250,y1:world.height-200};
    camera.x=clamp(camera.x,bounds.x0,bounds.x1);camera.y=clamp(camera.y,bounds.y0,bounds.y1);
  }

  fit() {
    this.follow = false;this.fitMode=true;
    Object.assign(this.target, {x: world.width / 2, y: world.height / 2, zoom: this.minZoom});
  }

  resize(initial = false) {
    if (!this.initialized || this.disposed) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(this.width, this.height);
    this.minZoom = fitZoom(this.width, this.height, world.width, world.height);
    if (initial) {
      this.camera.zoom = Math.min(this.width / 1500, this.height / 1000);   // closer in, like Cursor Camp
      const cam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);   // boss 3 Nov: ?cam=x,y,zoom for QA shots
      if (cam?.length === 3 && cam.every(Number.isFinite)) Object.assign(this.camera, {x: cam[0], y: cam[1], zoom: cam[2]});
      Object.assign(this.target, this.camera);
    } else if(this.fitMode){this.fit();Object.assign(this.camera,this.target);}
  }

  tick(now) {
    if (this.disposed || document.hidden) return;
    const dt = Math.min(.1, (now - this.lastFrame) / 1000);
    this.frameTimes.push((now - this.lastFrame));
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    this.lastFrame = now;
    this.frame++;
    this.accumulator += dt;
    if (this.room && this.room.islandId !== this.islandId) this.switchIsland(this.room.islandId);
    if (this.room && this.room.mode !== this.travelMode) {
      this.travelMode=this.room.mode; this.stopInput(); this.updateControlLabel();
      this.follow=Boolean(this.player); this.fitMode=false;
      if (this.travelMode === 'walking' && this.player) this.target.zoom=.6;   // boss 5 Nov: back on land the camera comes back in
    }
    const input = {
      x: Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')) + this.touchInput.x,
      y: Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')) + this.touchInput.y,
    };
    input.x=Math.sign(input.x); input.y=Math.sign(input.y);
    if (this.travelView?.fx.holding(this.room?.id)) input.x=input.y=0;   // boss 5 Nov: the hop in or out finishes before steering (at most 0.6 s)
    const indoors = this.interior?.active;
    while (this.accumulator >= 1 / 60) {
      this.sim.step(1 / 60, this.room || indoors ? ZERO : input);
      this.room?.step(1 / 60, indoors ? ZERO : input);
      this.accumulator -= 1 / 60;
    }
    const player = this.player;
    if (Boolean(player) !== this.hadPlayer) {
      this.hadPlayer = Boolean(player);
      this.updateControlLabel();
      if (!player) { this.keys.clear(); this.follow = false; this.markerUntil = 0; }
    }
    const t = this.sim.time;
    const reduced = this.motion.matches;
    // boss 5 Nov: the museum door. Walk up the steps into it and the room takes over; walk out through its arch and you are back on the steps
    if (this.interior && player && player.mode !== 'sailing') {
      const atDoor = player.x > MUSEUM_DOOR.x0 && player.x < MUSEUM_DOOR.x1 && player.y < MUSEUM_DOOR.y;
      if (!indoors && atDoor && this.doorArmed && this.playerRig()) {this.doorArmed = false; this.sim.stopInput(); this.interior.enter(this.playerRig(), this.width, this.height); this.scene.visible = false; if (this.nameLayer) this.nameLayer.style.visibility = 'hidden';}
      if (!atDoor && player.y > MUSEUM_DOOR.y + 60) this.doorArmed = true;
      if (this.interior.active && this.interior.update(dt, input, this.width, this.height, t, reduced)) {
        this.interior.leave(this.objects, .88 * .24 * 3); this.scene.visible = true;
        if (this.nameLayer) this.nameLayer.style.visibility = '';
        if (this.room) this.room.destination(MUSEUM_DOOR.out.x, MUSEUM_DOOR.out.y);   // live: the server walks you back down the steps
        else Object.assign(player, {x: MUSEUM_DOOR.out.x, y: MUSEUM_DOOR.out.y, previousX: MUSEUM_DOOR.out.x, previousY: MUSEUM_DOOR.out.y, path: [], turn: 0, action: 0});
        Object.assign(this.target, {x: player.x, y: player.y - 90}); Object.assign(this.camera, this.target, {zoom: this.camera.zoom}); this.follow = true;
      }
      if (this.interior.active) {this.app.render(); this.raf = requestAnimationFrame(time => this.tick(time)); return;}
    }
    if(player?.action===1&&!this.fitMode&&!this.gestures.pointers.size){
      const x=this.width/2+(player.x-this.camera.x)*this.camera.zoom,y=this.height/2+(player.y-this.camera.y)*this.camera.zoom*TILT;
      if(x<80||x>this.width-80||y<70||y>this.height-70)this.follow=true;
    }
    if (this.follow && player) {
      Object.assign(this.target, {x:player.x, y:player.y-90});
      if (player.mode === 'sailing') this.target.zoom=.56-offshoreProgress(player)*.24;   // boss 5 Nov: pulled back a little while sailing
    }
    easeCamera(this.camera, this.target, dt, reduced);
    // Cursor Camp tilt: the whole scene is squashed vertically; anything standing up is scaled back upright once.
    this.scene.scale.set(this.camera.zoom, this.camera.zoom * TILT);
    this.scene.position.set(this.width / 2 - this.camera.x * this.camera.zoom, this.height / 2 - this.camera.y * this.camera.zoom * TILT);
    for (const layer of [this.objects, this.air, this.decks]) for (const child of layer.children) if (!child.upright && (layer !== this.decks || child.standing)) {child.upright = true; child.scale.y /= TILT;}   // the pond bridge stands up; the jetties lie flat
    const halfWidth = this.width / (2 * this.camera.zoom), halfHeight = this.height / (2 * this.camera.zoom * TILT);
    const visible = (x,y,pad=350) => Math.abs(x-this.camera.x)<halfWidth+pad && Math.abs(y-this.camera.y)<halfHeight+pad;
    this.ocean.position.set(this.camera.x-halfWidth-256,this.camera.y-halfHeight-256);this.ocean.width=halfWidth*2+512;this.ocean.height=halfHeight*2+512;
    this.ocean.tilePosition.set(-this.ocean.x+(reduced?0:t*2),-this.ocean.y+(reduced?0:t*.7));
    this.waterFX?.update(dt, t, {x: this.camera.x-halfWidth, y: this.camera.y-halfHeight, width: halfWidth*2, height: halfHeight*2});
    this.surf?.update(t, reduced, visible);
    this.rowboat?.update(t, reduced, visible);
    this.boats?.update(t, reduced, visible);
    this.travelView?.update(this.room.boatPoses(now/1000),t,reduced,visible,player,this.camera);
    this.weather.update(t,reduced,visible);
    const breeze=windStrength(t,reduced);
    this.gust *= Math.exp(-dt * 2.5);
    this.props.forEach((prop, i) => {
      prop.sprite.visible = visible(prop.x, prop.y, Math.max(prop.width, prop.height) * prop.scale);
      if(prop.shadow)prop.shadow.visible=prop.sprite.visible;
      if (!prop.sprite.visible) return;
      prop.sprite.skew.x = !reduced && prop.wind ? Math.sin(t * 1.3 + i * .7) * (/flag|bunting|banner|umbrella/i.test(prop.asset||prop.name)?.018:.009)*breeze + this.gust * .035 : 0;
      prop.sprite.y = prop.y + (!reduced && prop.boat ? Math.sin(t * 1.5 + i) * 3 : 0);
      prop.sprite.rotation = !reduced && prop.boat ? Math.sin(t * 1.1 + i) * .008 : 0;
      // boss 5 Nov: bank plants answer the same water field as floating pads.
      if (/lily|reeds|cattails/i.test(prop.asset || prop.name)) this.waterFX?.lily(prop, {y: prop.y, rotation: 0});
    });
    this.floating.forEach(item=>{const pose=floatingPose(item,t,reduced);item.sprite.position.set(pose.x,pose.y);item.sprite.rotation=pose.rotation;item.sprite.visible=visible(item.x,item.y,100);this.waterFX?.lily(item,pose,t);});
    const alpha = this.accumulator * 60;
    this.rigs.forEach((rig, i) => {
      const duck = this.localDucks[i];
      const x = duck.previousX + (duck.x-duck.previousX)*alpha;
      const y = duck.previousY + (duck.y-duck.previousY)*alpha;
      rig.root.position.set(x, deckY(x, y));   // boss 3 Nov: Duckies walk up and over the arched bridges
      rig.root.zIndex = y;
      rig.root.visible = visible(x, y, 200);
      if (rig.root.visible) rig.update(dt, {action: duck.action, speed: duck.travel, turn: duck.turn, time: t, reducedMotion: reduced, emoteVersion: duck.emoteVersion, persistentSleep: duck.sleeping});
      if (duck.sleeping && duck.footprint && player && rig.sleeper) {   // boss 5 Nov: walking into a sleeper stops at its edge and wobbles it once
        const f = duck.footprint, ex = (player.x - f.x) / (f.rx + 26), ey = (player.y - f.y) / (f.ry + 26), near = ex * ex + ey * ey < 1;
        const last = this.bumpFrom || player, mx = player.x - last.x, my = player.y - last.y, ml = Math.hypot(mx, my), tx = f.x - player.x, ty = f.y - player.y;
        const into = !player.path?.length && ml > .05 && (mx * tx + my * ty) / (ml * (Math.hypot(tx, ty) || 1)) > .55;   // heading into it, not sliding past its side or skirting it on a route
        if (near && into && !duck.bumped) {   // boss 5 Nov: the player's Ducky stumbles back off it, once per poke cooldown
          duck.bumped = true;
          if (rig.sleeper.poke()) this.playerRig()?.stumble?.({x: player.x - f.x, y: (player.y - f.y) * TILT});
        }
        if (!near) duck.bumped = false;
      }
    });
    if (player) this.bumpFrom = {x: player.x, y: player.y};
    const live = this.room?.poses(now / 1000) ?? [];
    this.waterFX?.edge([...this.localDucks, ...live]);
    if (this.room) this.renderLiveDucks(live, dt, t, reduced, visible);
    this.ripples.forEach(({sprite, phase,x,y}) => {sprite.position.set(x+(reduced?0:Math.sin(t*.18+phase)*6),y+(reduced?0:Math.sin(t*.24+phase)*2));sprite.scale.set(reduced ? 1 : 1 + Math.sin(t*.8+phase)*.22); sprite.alpha = reduced ? .35 : .35 + Math.sin(t+phase)*.2;});
    this.birds.forEach(item=>{const pose=birdPose(item.x,item.y,item.phase,t,reduced);item.root.position.set(pose.x,pose.y);item.root.rotation=pose.rotation;item.root.visible=visible(pose.x,pose.y,100);item.wings.forEach((wing,i)=>{wing.rotation=(i?1:-1)*(pose.flap-.4)*.45;wing.scale.y=.75+.25*Math.cos(pose.flap*3);});});
    for (const crow of this.crows) {
      const pose = crowPose(crow,t,reduced);
      crow.root.position.set(pose.x,pose.y);
      crow.root.rotation = pose.heading;
      crow.root.visible = visible(pose.x,pose.y,100);
      for (const wing of crow.wings) wing.scale.y = pose.flap;
    }
    this.butterflies.forEach(item=>{
      const pose=butterflyPose(item.x,item.y,item.phase,t,reduced);
      item.root.visible=visible(pose.x,pose.y,80);item.root.position.set(pose.x,pose.y);item.root.rotation=pose.rotation;
      item.wings.forEach(wing=>wing.scale.x=pose.flap);
    });
    this.leaves.forEach(({sprite,x,y,phase}) => {
      sprite.visible = !reduced && visible(x,y);
      const age = (t * .12 + phase) % 1;
      sprite.position.set(x + age * 170*(.65+breeze*.7) + Math.sin(t + phase) * 12, y + age * 210);
      sprite.rotation = Math.sin(t * 2 + phase);
      sprite.alpha = Math.sin(age*Math.PI) * .65;
    });
    this.droplets.forEach((sprite,i) => {
      sprite.visible = !reduced;
      const phase = (t*.7+i/12)%1;
      sprite.position.set(2820+Math.sin(i*2.4)*65*phase, 2260-100*Math.sin(phase*Math.PI));
      sprite.alpha = Math.sin(phase*Math.PI)*.7;
    });
    this.fountainWater?.update(t, reduced, this.fountainWater && visible(this.fountainWater.root.x + 250, this.fountainWater.root.y + 240, 400));
    this.splashes.forEach(({sprite,phase})=>{const age=(t*.7+phase)%1;sprite.visible=!reduced;sprite.scale.set(.4+age*1.3,.5+age*.9);sprite.alpha=Math.max(0,1-age*2)*.6;});
    this.marker.visible = this.markerUntil > t;
    if (this.marker.visible) {const age=1.5-(this.markerUntil-t);this.marker.alpha=1-age/1.5;this.marker.scale.set(1+age*.9,1+age*8/9);}
    // boss 4 Nov: no walking sound (Ashwin found it annoying)
    this.app.render();
    // DOM-only diagnostics make automated acceptance possible without scene overlays.
    if (this.frame % 15 === 0) {
      const d = this.canvas.dataset;
      d.ducks = String(this.localDucks.length + live.length);
      d.livePlayers = String(live.length);
      d.sleepingDucks = String(this.sim.ducks.filter(duck => duck.sleeping && duck.action === 7).length);
      d.offshoreProgress=String(offshoreProgress(player));
      d.island=this.islandId; d.travelMode=player?.mode ?? 'watching';
      d.boats=String(this.room?.boats.length ?? 0);
      d.player = player ? `${player.x.toFixed(1)},${player.y.toFixed(1)}` : '';
      d.action = player ? String(player.action) : '';
      d.quackBubbles=String(this.sim.ducks.filter(duck=>duck.action===2).length);
      d.playerRing=String(Boolean(player));d.muted=String(this.audio.muted);d.follow=String(this.follow);d.destinationMarker=String(this.marker.visible);d.birds=String(this.birds.length);
      d.camera = JSON.stringify(this.camera);
      d.frameMs = (dt * 1000).toFixed(2);
      if (this.frame % 60 === 0) {
        const sorted = [...this.frameTimes].sort((a,b) => a-b);
        d.frameMeanMs = (sorted.reduce((sum,n) => sum+n,0) / sorted.length).toFixed(2);
        d.frameP95Ms = sorted[Math.floor(sorted.length*.95)].toFixed(2);
      }
      d.simulationTime = t.toFixed(2);
      d.reducedMotion = String(reduced);
      d.waterSimulation = String(Boolean(this.waterFX?.active));
      d.waterCpuMs = (this.waterFX?.stats.cpuMs || 0).toFixed(3);
      d.waterCells = String(this.waterFX?.stats.cells || 0);
      d.waterSteps = String(this.waterFX?.stats.steps || 0);
      d.waterSplashes = String(this.waterFX?.stats.splashes || 0);
    }
    this.raf = requestAnimationFrame(time => this.tick(time));
  }

  playerRig() {
    if (this.room) return [...this.liveRigs.values()].find(entry => entry.isPlayer)?.rig;
    const i = this.localDucks?.findIndex(duck => duck.player) ?? -1;
    return i >= 0 ? this.rigs[i] : null;
  }

  renderLiveDucks(poses, dt, time, reducedMotion, visible) {
    const ids = new Set(poses.map(pose => pose.id));
    for (const [id, entry] of this.liveRigs) {
      if (ids.has(id)) continue;
      entry.rig?.dispose();
      entry.nameplate?.remove();
      entry.seatMask?.destroy();
      this.liveRigs.delete(id);
      this.removeChat(id);
    }
    for (const pose of poses) {
      const {id,x,y,action,turn,travel,emoteVersion} = pose;
      const isPlayer = Boolean(pose.player);
      const editing = isPlayer && this.chatEditor?.current;
      if (editing) this.positionChatEditor(pose);
      let entry = this.liveRigs.get(id);
      if (!entry || entry.isPlayer !== isPlayer) {
        entry?.rig?.dispose();
        entry?.nameplate?.remove();
        entry = {isPlayer, rig:null, emoteVersion};
        this.liveRigs.set(id, entry);
        createDuck({outfit:pose.outfit, seed:parseInt(id.slice(0,8),16), isPlayer}).then(rig => {
          if (this.disposed || this.liveRigs.get(id) !== entry) {
            rig.dispose();
            disposeDuckAssets().catch(() => {});
            return;
          }
          rig.arrive?.();   // boss 4 Nov: a joining Ducky drops in
          entry.rig = rig;
          rig.root.scale.set(.88 * .24 * 3);
          rig.root.visible = false;
          this.objects.addChild(rig.root);
        }).catch(error => {
          if (!this.disposed) console.error('Could not load a duck', error);
        });
      }
      if (this.nameLayer && entry.login !== pose.login) {
        entry.nameplate?.remove();
        entry.login = pose.login;
        entry.nameplate = null;
        if (pose.login) {
          entry.nameplate = document.createElement('div');
          entry.nameplate.className = 'pixi-duck-name';
          entry.nameplate.textContent = `@${pose.login}`;
          this.nameLayer.appendChild(entry.nameplate);
        }
      }
      const chat = this.chatBubbles.get(id);
      if (entry.nameplate || chat) {
        const anchor = this.duckLabelPosition(pose);
        if (entry.nameplate) this.placeLabel(entry.nameplate,anchor.x,anchor.y);
        if (chat && editing) chat.bubble.hidden = true;
        else if (chat) this.placeLabel(chat.bubble,anchor.x,anchor.y + CHAT_LABEL_GAP);
      }
      if (entry.emoteVersion !== emoteVersion && !isPlayer && action === 2 && visible(x,y)) {
        this.audio.play('quack', .08);
      }
      entry.emoteVersion = emoteVersion;
      const rig = entry.rig;
      if (!rig) continue;
      // boss 5 Nov: sailing-fx.js says where a Ducky is drawn: hopping in, seated low in the hull, or hopping out onto the jetty
      const look=this.travelView?.fx.duck(pose,reducedMotion) ?? {x,y,scale:.88*.24*3,sx:1,sy:1,rotation:0,alpha:1,mask:null,speed:travel,turn,deck:true};
      if (look.mask && !entry.seatMask) {
        entry.seatMask=new Graphics(); this.objects.addChild(entry.seatMask);
      }
      if (entry.seatMask) {
        entry.seatMask.clear();
        if (look.mask) entry.seatMask.poly(look.mask).fill(0xffffff);
        rig.root.mask=look.mask?entry.seatMask:null;
      }
      rig.root.scale.set(look.scale*look.sx,look.scale*look.sy/TILT);
      rig.root.position.set(look.x,look.deck?deckY(look.x,look.y):look.y);
      rig.root.rotation=look.rotation; rig.root.alpha=look.alpha;
      rig.root.zIndex = look.z ?? look.y;
      rig.root.visible = visible(look.x,look.y,200);
      if (rig.root.visible) rig.update(dt, {action, speed:look.speed, turn:look.turn, time, reducedMotion, emoteVersion});
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.cleanups.forEach(fn => fn());
    this.clearChat();
    this.keys.clear();
    this.gestures.clear();
    this.audio.dispose();
    this.waterFX?.dispose();
    this.liveRigs.forEach(entry => {
      entry.rig?.dispose();
      entry.nameplate?.remove();
      entry.seatMask?.destroy();
    });
    this.liveRigs.clear();
    this.rigs.forEach(rig => rig.dispose());
    this.rigs = [];
    disposeDuckAssets().catch(() => {});
    if (this.initialized) this.app.destroy(true, {children: true});
    this.loaded.forEach(release);
    this.loaded = [];
  }
}
