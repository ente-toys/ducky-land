import {previewMoorings, boatsForView} from './boat-preview.js';
import {easeZoomCamera} from './zoom-motion.js';
import {detailedIslands} from './island-detail.js';
import {constrainExploreCamera, zoomToWorldPoint} from './explore-camera.js';
import {sampleGlobeSpin, coastGlobeSpin} from './globe-motion.js';
import {trackUpright} from './upright.js';
import {attachCentreMotion} from './centre-motion.js';
import {createWeather,windStrength} from './weather.js';
import {createBird,birdPose,createCrow,crowPose} from './birds.js';
import {createBeachSurf, shoreOf} from './surf.js';
import {createRowboat} from './rowboat.js';
import {createMooredBoats} from './sailboats.js';
import {createTravelView} from './travel-view.js';
import {createArchipelago} from './archipelago.js';
import {copyHolding} from './world-map.js';
import {createWorldView} from './world-view.js';
import {HARBOR, harborOf, islandFor, near, seaBoundsFor, destinationsFor, offshoreProgress, harborClear, harborWorld, boardingPoint, landingSpot, canDock, islandOffset} from './islands.js';
import {ambientOf, artOf, mapFor, mapOf} from './island-maps.js';   // boss 6 Nov: themed islands, each with its own map and art
import {loadThemeArt} from './theme-art.js';
import {setSailingHarbor} from './sailing-fx.js';
import {createButterfly,butterflyPose} from './butterflies.js';
import {floatingPose} from './floating.js';
import {Application, Assets, Container, Graphics, Sprite, TilingSprite, Matrix} from 'pixi.js';
import rawWorld from '../../rive/web/world.json';
import art from './art-manifest.json';
import {createSimulation} from './simulation.js';
import {startJump,jumpHeight,jumpPose,MUSEUM_DOOR,atMuseumDoor} from './player-motion.js';
import {createDust} from './dust.js';
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
import {clamp, fitZoom, Gestures, movePinch, screenToWorld, TILT, zoomAt} from './camera.js';
import {CHAT_DURATION} from './chat.js';

// Simulation and audio are renderer-independent; neither imports Three.js or Rive.
const textureLeases = new Map();
const ZERO = {x:0,y:0};
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
  constructor({onError = () => {}, onInteriorChange = () => {}, room = null, chatLayer = null, chatEditor = null, nameLayer = null} = {}) {
    this.onInteriorChange = onInteriorChange;
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
    this.zoomMotion={velocity:0};
    this.accumulator = 0;
    this.lastTap = -Infinity;
    this.mapSleepers = new Map();   // boss 6 Nov: each themed map's sleeping Duckies ({duck, rig}), made when its art loads
    this.doorArmed = false;   // boss 6 Nov: armed only once your Ducky has been seen below the steps, so a game never opens inside the museum
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
      this.dust = createDust(this.objects);   // boss 6 Nov: landing and running puffs
      this.air = new Container();
      this.floatLayer=new Container();
      this.contactShadows=new Container();
      this.decks=new Container();   // boss 3 Nov: the arched bridges, over the water and its lily pads, under every Ducky
      this.upright=trackUpright([[this.objects], [this.air], [this.decks, true]], TILT);
      this.cleanups.push(() => this.upright.destroy());
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
      this.sim = createSimulation(walk, 8612, {sleepingNpcs: true, npcCount: beds.length});
      this.sim.ducks.slice(1).forEach((duck, i) => {const b = beds[i]; if (!b) return; duck.x = duck.previousX = b.x; duck.y = duck.previousY = b.y; duck.sleep = {pose: b.pose, flip: b.flip}; duck.footprint = sleeperFootprint(b);});
      this.sim.ducks.splice(beds.length + 1);   // boss 5 Nov: no bed, no sleeper (never a random one left at its spawn)
      globalThis.__duckySleepers = beds.map(b => ({pose: b.pose, flip: b.flip, x: Math.round(b.x), y: Math.round(b.y), tree: b.tree}));   // QA readback
      globalThis.__duckySleepersDropped = beds.bad;
      this.room?.configure(this.sim.nav, walk);
      this.resize(true);
      this.listen(this.canvas, 'webglcontextlost', event => {event.preventDefault(); cancelAnimationFrame(this.raf); this.audio.suspend(); this.onError();});
      const tiles = art.ground.tiles;
      // boss 6 Nov: the home island's own art lives in its own groups, so a themed island (or its copy) can be drawn instead
      this.homeGround = new Container({label: 'Home ground'}); this.ground.addChild(this.homeGround);
      this.homeDecks = new Container({label: 'Home decks'}); this.decks.addChild(this.homeDecks);
      this.homeShadows = new Container({label: 'Home shadows'}); this.contactShadows.addChild(this.homeShadows);
      // round 4: ground detail decals and the plaza paving lie on the tiles; the library stair is a deck like the jetties
      const oldLand = geometry({...world, obstacles: []}).walkable, grownLand = {...world, coast: local.coast};
      const decals = [...decalsFor(world, props, oldLand), ...decalsFor(grownLand, props, geometry({...grownLand, obstacles: []}).walkable).filter(d => !oldLand(d.x, d.y))];
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
        this.homeGround.addChild(sprite);
      });
      const base = tiles.length + decks.length, flatBase = base + props.length + art.floating.length + 1;
      this.flats = new Container({label: 'Ground detail'}); this.homeGround.addChild(this.flats);
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
        this.homeDecks.addChild(sprite);
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
        if(!NO_SHADOW.test(name)){shadow=contactShadow(prop);shadow.position.set(prop.x,prop.y);this.homeShadows.addChild(shadow);}

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
      globalThis.__duckyInterior = () => this.interior?.debug() ?? {active: false, loading: Boolean(this.interiorPending)};
      const before = new Set([...this.water.children, ...this.objects.children, ...this.air.children]);
      // boss 4 Nov: water owns only decorative fields. Navigation and multiplayer keep their existing coordinates.
      this.waterFX = await createWater({app: this.app, world, art, layer: this.water,
        objects: this.objects, props: this.props, motion: this.motion});
      if (this.disposed) {this.waterFX.dispose(); return;}
      this.createAmbient();
      // home-only extras: the pond and cove water, the fountain, the beach surf, the lake ripples, offline boats, falling leaves
      const keep = new Set([this.marker, ...this.birds.map(b => b.root), ...this.crows.map(c => c.root), ...this.butterflies.map(b => b.root), ...(this.weather?.roots?.() ?? [])]);
      const extras = [...this.water.children, ...this.objects.children, ...this.air.children].filter(c => !before.has(c) && !keep.has(c) && !/weather|cloud|rain|wind/i.test(c.label || ''));
      this.arts = new Map([['home', {id: 'home', ready: true, groups: [this.homeGround, this.homeDecks, this.homeShadows, this.floatLayer, ...extras]}]]);
      this.artShown = 'home';
      if (new URLSearchParams(location.search).has('qa')) globalThis.__duckyEngine = this;   // QA readback (headless checks only)
      this.archipelago = createArchipelago(this.app, this.scene, this.scene, world);   // boss 5 Nov: 300 islands, same island for now; zoom out to see them
      this.worldView = createWorldView(this.app, this.scene); globalThis.__duckyPin = () => this.worldView?.pinPoint();   // QA readback: where the 'You' pin is on screen   // boss 5 Nov: tilted horizon, then the little planet
      if (this.room) {
        this.travelView=await createTravelView(this.objects,this.water,this.air,this.decks);
        if (this.disposed) {this.travelView.dispose(); return;}
        this.travelView.fx.waterSplash=(x,y)=>{if (this.artShown === 'home') this.waterFX?.splash(x,y,.85,30);};   // home's water field only (boss 6 Nov)   // boss 5 Nov: a boarding Ducky rocks the real water too
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
    this.boats = this.room ? null : createMooredBoats(this.water, world.islets, {x: 2980, y: 2005}, {coast: world.coast});   // boss 5 Nov: offline decoration only; live, every boat is a real one you can take (islands.js boatSpots)
    globalThis.__duckyBoats = this.boats?.count ?? 0;
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
    // boss 5 Nov ("the Ducky jumps to the ground and right there a FLASH comes, I want it seamless"): landing on (or sailing
    // into) a neighbour makes it the real island, so its coordinates become the local ones. Nothing fades or restarts: the
    // camera, your own Ducky, its hop and the boat it leaves are all moved by that island's offset and carry straight on.
    const hop=this.ready ? islandOffset(this.islandId,id) : null;   // boss 6 Nov: any island drawn in this sea, not only the jetty neighbours
    this.islandId=id;
    this.archipelago?.setCurrent(id);   // the island you landed on becomes the real one, the rest are redrawn round it
    // boss 6 Nov: a themed island draws its own art (loaded now if it is not already) and walks its own map
    const mapId=artOf(id);
    this.ensureArt(mapId); this.artShown=mapId; this.showArt(mapId);
    this.arches=mapId === 'home' ? undefined : mapFor(mapId).world.arches ?? [];   // Duckies rise over this island's own arched bridges (placements.js deckY)
    this.applyMapAmbience(mapId);
    setSailingHarbor(harborOf(id));
    this.stopInput();
    this.clearChat();
    this.markerUntil=0;
    for (const [key, entry] of this.liveRigs) {
      if (hop && entry.isPlayer) continue;   // your own Ducky stays as it is (no drop-in again)
      entry.rig?.dispose(); entry.nameplate?.remove(); entry.seatMask?.destroy();
      this.liveRigs.delete(key);
    }
    const accent=islandFor(id).accent;
    for (const prop of this.props) if (/flower|flag|bunting/i.test(prop.asset || prop.name)) prop.sprite.tint=id==='home'?(prop.tint ?? 0xffffff):accent;
    this.travelView?.switchIsland(id, hop && {x:-hop.x, y:-hop.y});
    if (hop) {
      for (const c of [this.camera, this.target]) {c.x-=hop.x; c.y-=hop.y;}
    } else {
      const player=this.player;
      const focus=player ?? harborOf(id).land;
      Object.assign(this.target,{x:focus.x,y:focus.y-90,zoom:this.target.zoom ?? .6});
      Object.assign(this.camera,this.target);
    }
    this.follow=Boolean(this.player);
    this.fitMode=false;
  }

  focusHarbor() {
    const {pier}=harborOf(this.islandId);
    Object.assign(this.target,{x:pier.x+pier.width/2,y:pier.y+pier.height/2,zoom:.65});   // boss 5 Nov: the whole jetty in view
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
      this.spin=null; this.dragAt=performance.now(); this.quietAt=this.dragAt;
      if(!this.gestures.pointers.size) {Object.assign(this.target,this.camera);this.zoomMotion.velocity=0;}
      this.zoomAnchor=null;
      this.gestures.down(event.pointerId, point(event));
    });
    this.listen(this.canvas, 'pointermove', event => {
      if (!this.gestures.pointers.size && event.pointerType !== 'touch') {   // boss 6 Nov: the 'You' pin shows it is a button
        const over=Boolean(this.globeT > 0 && this.worldView?.pinAt(point(event)));
        if (over !== this.overPin) {this.overPin=over; this.canvas.style.cursor=over ? 'pointer' : ''; this.worldView?.hoverPin(over);}
      }
      const movement = this.gestures.move(event.pointerId, point(event));
      if (!movement) return;
      this.fly=null;
      if (movement.after.length > 1) {
        this.spin=null;
        movePinch(this.target, movement.before, movement.after, this.zoomFloor(), 1.8, this.width, this.height);
      } else if (movement.drag) {
        // on the globe the ball is grabbed: the spot under the finger stays under it (GPT review); flat, it pans as before
        const at=movement.after[0], grab=this.birdEye && this.worldView?.grab({x:at.x-movement.dx, y:at.y-movement.dy}, at, this.target);
        const mx=grab ? grab.dx : -movement.dx / this.camera.zoom, my=grab ? grab.dy : -movement.dy / (this.camera.zoom * TILT);
        // Accumulate globe input in the target; render frames ease toward it,
        // including frames between pointer samples. Flat-map panning stays direct.
        const destination=this.birdEye ? this.target : this.camera;
        destination.x += mx; destination.y += my;
        const now=performance.now(), gap=now-this.dragAt; this.dragAt=now;
        this.spin=sampleGlobeSpin(this.spin,mx,my,gap);
        if (this.birdEye) {   // at most 120 degrees a second, however hard the flick (GPT review)
          const b=this.archipelago.bounds, cap=(b.x1-b.x0)/(2*Math.PI)*2.09/1000, v=Math.hypot(this.spin.x,this.spin.y);
          if (v>cap) {this.spin.x*=cap/v; this.spin.y*=cap/v;}
        }
        this.gust = clamp(movement.dx * .005, -.5, .5);
      } else return;
      this.follow = false;
      this.fitMode=false;
      if (this.birdEye || movement.after.length > 1) this.constrain(this.target);
      else {this.constrain(this.camera); Object.assign(this.target, this.camera);}
    });
    const up = (event, cancelled) => {
      // Account for a final position that did not generate a pointermove event.
      if (!cancelled) this.gestures.move(event.pointerId, point(event));
      const tap = this.gestures.up(event.pointerId, cancelled);
      if (cancelled || performance.now()-this.dragAt > 80) this.spin=null;
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
      this.fly=null; this.spin=null; this.quietAt=performance.now();
      const next=clamp(this.target.zoom * Math.exp(-delta * .0018), this.zoomFloor(), 1.8);
      const stamp=performance.now();
      if(!this.zoomAnchor || stamp-this.zoomAnchor.at>180 || Math.hypot(p.x-this.zoomAnchor.x,p.y-this.zoomAnchor.y)>4) {
        this.zoomAnchor={...p,focus:this.globeT>0 && this.worldView?.worldAt?.(p)};
      }
      this.zoomAnchor.at=stamp;
      const focus=this.zoomAnchor.focus;
      if (focus) zoomToWorldPoint(this.target,next,{x:focus[0],y:focus[1]});
      else zoomAt(this.target, next, p.x, this.height / 2 + (p.y - this.height / 2) / TILT, this.width, this.height);   // tilt-aware wheel anchor
      this.follow = false;this.fitMode=false;this.constrain(this.target);
    }, {passive: false});
    this.listen(window, 'keydown', event => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT|BUTTON|^A$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','q','e','1','2','3','4','5','6','7','m','f','home','0','+','=','-',' ','enter','shift'].includes(key)) return;
      event.preventDefault();
      this.audio.unlock();
      this.keys.add(key);
      if (event.repeat) return;
      if (key === ' ') this.jump();
      if (key === 'enter') this.travelAction();   // boss 5 Nov: Enter takes the boat you are next to, or docks at the shore you are near
      if (key === 'q') this.triggerEmote(2);
      if (key === 'e') this.triggerEmote(3);
      if (/^[1-7]$/.test(key)) this.triggerEmote(key === '1' ? 2 : Number(key) + 2);
      if (key === 'm') this.audio.toggle();
      if (key === 'f' && this.player) {this.follow=true;this.fitMode=false;this.target.zoom=Math.max(.65,this.target.zoom);}
      if (key === 'home') {if (this.player) this.flyHome(); else this.fit();}   // boss 6 Nov: Home flies back to your Ducky, like tapping the 'You' pin
      if (key === '0') this.fit();
      if (['+','=','-'].includes(key)) {
        this.fly=null; this.target.zoom = clamp(this.target.zoom * (key === '-' ? .8 : 1.25), this.zoomFloor(), 1.8);this.fitMode=false;this.follow=false;
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
      y:this.height / 2 + (pose.y - y - 165 - jumpHeight(pose.jumpLeft,this.motion.matches) * TILT) * zoom - 8,
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
    const base = 'Ducky Land illustrated island. Drag to pan, scroll or pinch to zoom. M toggles sound. Home flies back to your Ducky, 0 shows the island.';
    const play = this.player?.mode === 'sailing' ? ' WASD or arrows steer. Tap water to sail. Tap the harbor to dock.' : ' Click to walk. WASD or arrows move. Space jumps. Q quacks, E dances, 1 to 7 emote, F follows.';
    const chat = this.chatLayer && this.player ? ' Press C to chat.' : '';
    this.canvas.setAttribute('aria-label', base + (this.room && !this.player ? '' : play) + chat);
  }

  // boss 5 Nov: "when I go near a boat, Take boat appears; near the shore while sailing, Dock appears". Shown by IslandTravel.jsx.
  travelOptions() {
    const me=this.player;
    if (!this.room || !me) return {};
    if (me.mode === 'sailing') return {dock: canDock(me) || Boolean(landingSpot(me, this.sim.nav))};
    let best=null;
    for (const boat of this.room.boatPoses()) {
      if (boat.occupant) continue;
      const deck=boardingPoint(boat, this.sim.nav), d=Math.hypot(deck.x-me.x, deck.y-me.y);
      if (d < 260 && (!best || d < best.d)) best={id:boat.id, d};
    }
    return {take: best?.id ?? null};
  }
  travelAction() {
    const options=this.travelOptions();
    if (options.take) {this.room.board(options.take); this.follow=true; this.fitMode=false;}
    else if (options.dock) {this.keys.clear(); this.touchInput={x:0,y:0}; this.room.disembark();}   // a held arrow key would steer away and cancel the dock
  }

  tap(point) {
    if (this.interior?.active) {this.interior.tap(point); return;}   // boss 5 Nov: inside the museum a tap walks there
    if (this.globeT > 0 && this.worldView?.pinAt(point)) {this.flyHome(); return;}   // boss 6 Nov: tap the 'You' pin, fly back to your Ducky
    // boss 5 Nov: a tap on a sleeping Ducky only wobbles it: no walk, no emote, the player's Ducky does not react
    const p = screenToWorld(this.camera, point, this.width, this.height);
    if (this.room && this.player) {
      if (this.player.mode === 'sailing') {
        const destination=destinationsFor(this.islandId).find(island => Math.abs(p.x-island.x)<mapFor(island.map).width*.42 && Math.abs(p.y-island.y)<mapFor(island.map).height*.4);   // tap a neighbour island: sail to its jetty
        const harbor=harborOf(this.islandId);
        if (destination) this.setDestination(destination.dock);
        else if (near(p,harbor.water,140) || near(p,harbor.land,120)) this.room.disembark();
        else this.setDestination(p);
        return;
      }
      const boat=this.room.boatPoses().find(boat => near(p,{x:boat.x,y:boat.y-45},100));
      if (boat) {this.room.board(boat.id); this.follow=true; this.fitMode=false; return;}
    }
    if (this.artShown === 'home') this.waterFX?.splash(p.x, p.y, .65, 24);   // a tap on water splashes it (home's water field only)
    const hitRadius=Math.max(65,20/this.camera.zoom), me = this.player;
    const onMe = me && me.action !== 7 && Math.hypot(p.x - me.x, p.y - (me.y - 50)) < hitRadius;   // your own Ducky in front of a sleeper still wins
    const napper = !onMe && this.sleepersShown().map(s => s.rig).find(rig => rig.root.visible && rig.sleeper && (b => point.x > b.x - 8 && point.x < b.x + b.width + 8 && point.y > b.y - 8 && point.y < b.y + b.height + 8)(rig.sleeper.bounds()));   // boss 6 Nov: this map's sleepers
    if (napper) {napper.sleeper.poke(); return;}
    if (!this.player) return;
    const here = this.artShown === 'home' ? this.localDucks : this.localDucks.filter(duck => duck.player);   // home's sleepers only on home
    const candidates = this.room ? [this.player, ...this.room.poses().filter(duck => !duck.player), ...here] : here;
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

  jump() {
    if (this.interior?.active) return this.interior.jump();
    return this.room ? this.room.jump() : startJump(this.sim?.player);
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
    if (this.archipelago) {constrainExploreCamera(camera,this.archipelago.bounds); return;}
    const bounds=this.room?seaBoundsFor(this.islandId):{x0:250,y0:200,x1:world.width-250,y1:world.height-200};
    camera.x=clamp(camera.x,bounds.x0,bounds.x1);camera.y=clamp(camera.y,bounds.y0,bounds.y1);
  }

  // The 299 other islands are copies of one snapshot of this island. Take it with every prop showing (not culled), in home
  // colours, and without anything live or island-specific (Duckies, boats, the marker, this island's sign and flag).
  // what belongs to this island and this moment only, never shown on a copy: players, boats, the marker, this island's
  // sign, flag and neighbour boards (the sleeping and wandering local Duckies stay: they are part of every island)
  transientForCopies() {
    return [...this.rigs.filter((r,i) => this.localDucks[i]?.player).map(r => r.root), ...[...this.liveRigs.values()].map(e => e.rig?.root),
      this.marker, ...(this.travelView?.transient() ?? [])].filter(o => o?.visible);
  }
  // boss 6 Nov: the props of one map's art (home's are this.props), and its sleeping Duckies (home only: they lie on home's spots)
  artProps(mapId) {return mapId === 'home' ? this.props : this.arts?.get(mapId)?.props ?? [];}
  sleeperRigs() {return this.rigs.filter((r,i) => !this.localDucks[i]?.player);}
  // Show one island map's art and hide every other's (the real island, or a copy being drawn, or a snapshot being taken)
  showArt(mapId) {
    if (!this.arts) return;
    for (const [id, art] of this.arts) {
      if (!art.ready) continue;
      const on=id === mapId;
      for (const g of art.groups) g.visible=on;
      if (!on) for (const p of this.artProps(id)) {p.sprite.visible=false; if (p.shadow) p.shadow.visible=false;}
    }
    if (mapId !== 'home') {for (const r of this.sleeperRigs()) r.root.visible=false; for (const f of this.floating ?? []) f.sprite.visible=false;}
    for (const [id, set] of this.mapSleepers) if (id !== mapId) for (const {rig} of set) rig.root.visible=false;   // boss 6 Nov: each map shows only its own sleepers
    this.travelView?.showJetty(mapId);
  }
  // boss 6 Nov: the map the camera is on now (its size sets the island fit and the zoom floor)
  mapHere() {return mapFor(this.artShown ?? 'home');}
  // boss 6 Nov ("every home feature on the themed islands"): the birds, butterflies, clouds and wind ribbons move to this map's
  // own places, and the island fit follows its size. Home gets exactly its own back.
  applyMapAmbience(mapId) {
    const map=mapFor(mapId), spots=ambientOf(map);
    this.weather?.setMap?.(map.home ? null : map);
    (this.birds ?? []).forEach((bird, i) => {const p=spots.birds[i % spots.birds.length]; bird.x=p[0]; bird.y=p[1];});
    (this.butterflies ?? []).forEach((b, i) => {const p=spots.butterflies[i % spots.butterflies.length]; b.x=p[0]; b.y=p[1];});
    if (this.width) this.minZoom=fitZoom(this.width, this.height, map.width, map.height);
  }
  // A themed island's own surf, pond ripples, falling leaves and floating pads, built once when its art loads and shown with it
  buildMapAmbience(mapId, art) {
    const map=mapFor(mapId), extra=[];
    const surf=createBeachSurf(this.water, shoreOf(map.world)); extra.push(...surf.crests);
    const ripples=[];
    (map.world.water ?? []).forEach((lake, index) => {
      for (let i=0;i<4;i++) {   // 2-4 cream ripple marks per pond, pulled in until they sit on the water (as home's)
        const phase=i*2.399+index;
        const ripple=new Graphics().moveTo(-21, 0).quadraticCurveTo(0, -6, 21, 0).stroke({width: 2, color: PALETTE.cream, alpha: .6, cap: 'round'});
        let k=1;
        while (k > .3 && !inShape(lake.x+Math.cos(phase)*lake.rx*(.25+i/8)*k, lake.y+Math.sin(phase)*lake.ry*.7*k, lake, lake.poly ? -40 : 0)) k-=.1;
        ripple.position.set(lake.x+Math.cos(phase)*lake.rx*(.25+i/8)*k, lake.y+Math.sin(phase)*lake.ry*.7*k);
        this.water.addChild(ripple); extra.push(ripple);
        ripples.push({sprite: ripple, phase, x: ripple.x, y: ripple.y});
      }
    });
    const leaves=art.props.filter(p => /tree/i.test(p.name)).slice(0, 60).map((tree, i) => {
      const leaf=new Graphics().ellipse(0, 0, 6, 2.5).fill(i % 3 ? PALETTE.grass : PALETTE.sandShade);
      this.air.addChild(leaf); extra.push(leaf);
      return {sprite: leaf, x: tree.x, y: tree.y-150, phase: i*1.93};
    });
    if (art.floatLayer) this.scene.addChildAt(art.floatLayer, this.scene.getChildIndex(this.floatLayer)+1);
    art.groups.push(...extra);
    for (const o of extra) o.visible=false;
    art.ambience={surf, ripples, leaves, floats: art.floating ?? []};
  }
  // boss 6 Nov ("the same sleeping Duckies as home"): a themed map's 28 sleepers lie at its own beds (island-maps.js resolves
  // them from its world.json sleepSpots; the room server walks round the same footprints). Made once, when its art loads.
  async makeSleepers(mapId) {
    const beds=mapFor(mapId).sleepers ?? [];
    if (!beds.length || this.mapSleepers.has(mapId)) return;
    this.mapSleepers.set(mapId, []);
    let salt=0; for (const c of mapId) salt=(salt*31+c.charCodeAt(0)) % 997;
    const ducks=beds.map((b, i) => ({id: 1000+i, x: b.x, y: b.y, previousX: b.x, previousY: b.y, sleeping: true, action: 7, turn: 0, travel: 0, emoteVersion: 0, jumpLeft: 0,
      sleep: {pose: b.pose, flip: b.flip}, footprint: sleeperFootprint(b), outfit: {cap: 1+i%13, shades: i%4===0 ? 1+i%3 : 0, acc: i%3===0 ? 1+i%7 : 0, shoes: 1+i%10}}));
    const results=await Promise.allSettled(ducks.map((d, i) => createDuck({outfit: d.outfit, seed: d.id+21+salt, isPlayer: false, sleep: d.sleep})));
    const set=results.map((r, i) => r.status === 'fulfilled' ? {duck: ducks[i], rig: r.value} : null).filter(Boolean);
    if (this.disposed) {set.forEach(({rig}) => rig.dispose()); return;}
    for (const {duck, rig} of set) {rig.root.scale.set(.88 * .24 * 3); rig.root.position.set(duck.x, duck.y); rig.root.zIndex=duck.y; rig.root.visible=false; this.objects.addChild(rig.root);}
    this.mapSleepers.set(mapId, set);
    globalThis.__duckyMapSleepers = Object.fromEntries([...this.mapSleepers].map(([id, list]) => [id, list.map(({duck}) => ({pose: duck.sleep.pose, flip: duck.sleep.flip, x: duck.x, y: duck.y}))]));   // QA readback
  }
  // the sleepers drawn now: home's when home is shown, else the shown map's
  sleepersShown() {
    if (this.artShown === 'home' || !this.artShown) return this.rigs.map((rig, i) => ({duck: this.localDucks[i], rig})).filter(({duck}) => duck?.sleeping);
    return this.mapSleepers.get(this.artShown) ?? [];
  }
  // boss 5 Nov: walking into a sleeper stops at its edge and wobbles it once (every map's sleepers)
  bumpSleeper(duck, rig, player) {
    if (!(duck.sleeping && duck.footprint && player && rig.sleeper)) return;
    const f=duck.footprint, ex=(player.x-f.x)/(f.rx+26), ey=(player.y-f.y)/(f.ry+26), near=ex*ex+ey*ey < 1;
    const last=this.bumpFrom || player, mx=player.x-last.x, my=player.y-last.y, ml=Math.hypot(mx, my), tx=f.x-player.x, ty=f.y-player.y;
    const into=!player.path?.length && ml > .05 && (mx*tx+my*ty)/(ml*(Math.hypot(tx, ty) || 1)) > .55;   // heading into it, not sliding past its side or skirting it on a route
    if (near && into && !duck.bumped) {
      duck.bumped=true;
      if (rig.sleeper.poke()) this.playerRig()?.stumble?.({x: player.x-f.x, y: (player.y-f.y)*TILT});
    }
    if (!near) duck.bumped=false;
  }
  // Lazy: a theme's art loads only when its island (or a copy of it) comes near; until then that island is not drawn live
  ensureArt(mapId) {
    if (!this.arts || mapId === 'home' || this.arts.has(mapId) || this.disposed) return;
    const map=mapFor(mapId);
    if (!map.art) return;
    this.arts.set(mapId, {id: mapId, ready: false});
    loadThemeArt(map, {acquire, release}).then(async art => {
      if (this.disposed) {art.destroy(); return;}
      this.ground.addChild(art.ground); this.decks.addChild(art.decks); this.contactShadows.addChild(art.shadows);
      for (const p of art.props) (p.deck ? this.decks : this.objects).addChild(p.sprite);
      await attachCentreMotion(art, {Graphics, Container}, this.objects);
      if (this.disposed) {art.destroy(); return;}
      this.buildMapAmbience(mapId, art);
      this.arts.set(mapId, art);
      this.makeSleepers(mapId).catch(error => console.warn(`theme ${mapId}: sleepers did not load`, error));
      this.showArt(this.artShown);
      globalThis.__duckyThemeArt = [...this.arts.values()].filter(a => a.ready).map(a => a.id);   // QA readback
    }).catch(error => {console.warn(`theme ${mapId}: art did not load`, error); this.arts.set(mapId, {id: mapId, ready: false, failed: true});});
  }
  artReady(mapId) {return mapId === 'home' || Boolean(this.arts?.get(mapId)?.ready);}

  // The other islands far away are snapshots of their map's art. Take each once, with every prop showing (not culled), in home
  // colours, and without anything live or island-specific (Duckies, boats, the marker, this island's sign and flag).
  // what belongs to this island and this moment only, never shown on a copy: players, boats, the marker, this island's
  // sign, flag and neighbour boards (the sleeping and wandering local Duckies stay: they are part of every home-map island)
  transientForCopies() {
    return [...this.rigs.filter((r,i) => this.localDucks[i]?.player).map(r => r.root), ...[...this.liveRigs.values()].map(e => e.rig?.root),
      this.marker, ...(this.travelView?.transient() ?? [])].filter(o => o?.visible);
  }
  buildCopies() {
    if (!this.archipelago || this.snapshotFrame===this.frame) return;
    if (!this.archipelago.has('home')) {this.snapshotFrame=this.frame;this.captureArt('home');return;}
    // Snapshotting a newly loaded theme can rasterize thousands of objects.
    // Keep it out of active gestures, then capture at most one theme per frame.
    if(this.gestures.pointers.size || this.spin || Math.abs(Math.log(this.camera.zoom/this.target.zoom))>.015) return;
    for (const [id, art] of this.arts ?? []) if (art.ready && id !== 'home' && !this.archipelago.has(id)) {
      this.snapshotFrame=this.frame;this.captureArt(id);break;
    }
  }
  captureArt(mapId) {
    if (!this.archipelago || this.archipelago.has(mapId) || !this.artReady(mapId)) return;
    const hide=this.transientForCopies();
    hide.forEach(o => {o.visible=false;});
    this.showArt(mapId);
    const props=this.artProps(mapId).map(p => ({p, v:p.sprite.visible, s:p.shadow?.visible, tint:p.sprite.tint}));
    for (const {p} of props) {p.sprite.visible=true; if (p.shadow) p.shadow.visible=true; if (mapId === 'home' && /flower|flag|bunting/i.test(p.asset || p.name)) p.sprite.tint=p.tint ?? 0xffffff;}
    const floats=mapId === 'home' ? (this.floating ?? []).map(f => [f, f.sprite.visible]) : []; floats.forEach(([f]) => {f.sprite.visible=true;});
    const naps=(this.mapSleepers.get(mapId) ?? []).map(({rig}) => [rig.root, rig.root.visible]); naps.forEach(([root]) => {root.visible=true;});
    // boss 6 Nov: a themed island's art loads lazily, usually while you are zoomed out on the globe, when the flat scene is
    // switched off; its snapshot came out empty (the globe and the far copies showed only its shallows). Draw it switched on.
    const sceneVisible=this.scene.visible; this.scene.visible=true;
    this.archipelago.build(mapId);
    this.scene.visible=sceneVisible;
    hide.forEach(o => {o.visible=true;});
    for (const {p,v,s,tint} of props) {p.sprite.visible=v; if (p.shadow) p.shadow.visible=s; p.sprite.tint=tint;}
    floats.forEach(([f,v]) => {f.sprite.visible=v;});
    naps.forEach(([root,v]) => {root.visible=v;});
    this.showArt(this.artShown);
  }

  // boss 5 Nov ("very pixelated, these should be live islands with sleeping Duckies"): the copies on screen up close are
  // the live island drawn again at their offsets, sharp and moving; past a few on screen the snapshot stands in.
  // boss 6 Nov: each copy is drawn with its own map's art; a themed copy whose art is still loading stays a snapshot.
  liveCopies() {
    if (!this.archipelago?.texture || this.interior?.active) return [];
    const z=this.camera.zoom, hw=this.width/(2*z), hh=this.height/(2*z*TILT);   // boss 6 Nov: each island by its own size
    const near=this.archipelago.islands.filter(i => !i.home && Math.abs(i.x-this.camera.x)<hw+(i.width ?? world.width)*.6 && Math.abs(i.y-this.camera.y)<hh+(i.height ?? world.height)*.6);
    for (const i of near) this.ensureArt(i.map);   // lazy-load the themes coming into view
    return detailedIslands(near,this.camera,this.width,this.height,TILT).filter(i=>this.artReady(i.map));
  }
  renderLiveCopies(target, copies) {
    if (!copies.length) return;
    const transient=this.transientForCopies();
    const hide=[this.archipelago.root, this.ocean, ...transient].filter(o => o?.visible);
    hide.forEach(o => {o.visible=false;});
    const sets=[...new Set([this.artShown, ...copies.map(i => i.map)])];
    const props=sets.flatMap(id => this.artProps(id)).map(p => [p, p.sprite.visible, p.shadow?.visible]);
    const sleepers=this.sleeperRigs().map(r => [r.root, r.root.visible]);
    const floats=(this.floating ?? []).map(f => [f.sprite, f.sprite.visible]);
    const naps=sets.flatMap(id => this.mapSleepers.get(id) ?? []).map(({rig}) => [rig.root, rig.root.visible]);
    const sceneVisible=this.scene.visible; this.scene.visible=true;
    const z=this.camera.zoom, sx=this.scene.scale.x, sy=this.scene.scale.y;
    const hw=this.width/(2*z), hh=this.height/(2*z*TILT);
    const cull=(mapId, dx, dy) => {   // the copy's props culled to the screen as seen through that copy (the real pass culls the same way)
      const on=(x, y, pad) => Math.abs(x+dx-this.camera.x)<hw+pad && Math.abs(y+dy-this.camera.y)<hh+pad;
      for (const p of this.artProps(mapId)) {
        const shown=on(p.x, p.y, Math.max(p.width, p.height)*p.scale+350);
        p.sprite.visible=shown; if (p.shadow) p.shadow.visible=shown;
      }
      if (mapId === 'home') {
        for (const [root, v] of sleepers) root.visible=v || on(root.x, root.y, 200);
        for (const [sprite] of floats) sprite.visible=on(sprite.x, sprite.y, 100);
      } else for (const {rig} of this.mapSleepers.get(mapId) ?? []) rig.root.visible=on(rig.root.x, rig.root.y, 200);   // boss 6 Nov: a themed copy's own sleepers
    };
    // boss 5 Nov ("I went to another island, but I am going under the island"): a copy is drawn over the real island, so a
    // boat, Ducky or name board out in a neighbour's waters went under that copy's jetty, sign and trees. Each one is drawn
    // again inside its copy's pass, moved into that island's frame for the moment, so it sorts among the copy's own things.
    const visitors=transient.map(o => ({o, copy:copyHolding(o.x, o.y, copies, 300, this.mapHere())})).filter(v => v.copy);
    const shift=(o, dx, dy) => {o.x+=dx; o.y+=dy; o.zIndex+=dy; if (o.mask?.position) {o.mask.x+=dx; o.mask.y+=dy;}};   // a seated Ducky's hull mask moves with it
    for (const island of copies) {
      const m=mapFor(island.map), dx=island.x-m.width/2, dy=island.y-m.height/2, mine=visitors.filter(v => v.copy === island).map(v => v.o);   // the copy's map origin
      for (const o of mine) {o.visible=true; shift(o, -dx, -dy);}
      this.showArt(island.map);
      cull(island.map, dx, dy);
      this.app.renderer.render({container:this.scene, target, clear:false,   // the camera's own transform, shifted to that island
        transform:new Matrix(sx,0,0,sy,this.scene.position.x+dx*z,this.scene.position.y+dy*z*TILT)});
      for (const o of mine) {shift(o, dx, dy); o.visible=false;}
    }
    this.scene.visible=sceneVisible;
    this.showArt(this.artShown);
    hide.forEach(o => {o.visible=true;});
    for (const [p,v,sh] of props) {p.sprite.visible=v; if (p.shadow) p.shadow.visible=sh;}
    for (const [root,v] of sleepers) root.visible=v;
    for (const [sprite,v] of floats) sprite.visible=v;
    for (const [root,v] of naps) root.visible=v;
  }

  // boss 5 Nov: zoom out past the island and the other 300 islands come into view (no button); the floor fits them all
  birdZoom() {const b=this.archipelago.bounds; return .43*this.height*2*Math.PI/(b.x1-b.x0);}   // the globe at .43 of the screen height
  zoomFloor() {return this.archipelago ? this.birdZoom() : this.minZoom*.8;}

  // boss 6 Nov: from the globe (pin tap or Home) straight back to your Ducky in about 0.7 s. The camera itself travels, so the
  // globe unwraps along the very path a scroll zoom takes; the turn lands a little before the zoom, then it follows you.
  flyHome() {
    const me=this.room?.view() ?? this.player;
    if (!me) {this.fit(); return;}
    if (this.archipelago) {const b=this.archipelago.bounds, sx=b.x1-b.x0; this.camera.x-=sx*Math.round((this.camera.x-me.x)/sx);}   // nearest wrap: never round the world
    const zoom=Math.max(this.minZoom*1.05, Math.min(this.width/1500, this.height/1000));   // the normal play zoom (as on load)
    this.spin=null; this.follow=false; this.fitMode=false;
    this.fly={at:performance.now(), ms:this.motion.matches ? 0 : 700, x0:this.camera.x, y0:this.camera.y, z0:this.camera.zoom, zoom};
    if (this.overPin) {this.overPin=false; this.canvas.style.cursor=''; this.worldView?.hoverPin(false);}
  }
  stepFly(now, player) {
    const f=this.fly, s=f.ms ? Math.min(1, Math.max(0, (now-f.at)/f.ms)) : 1, me=this.room?.view() ?? player;
    if (!me) {this.fly=null; return;}
    const io=s < .5 ? 4*s*s*s : 1-Math.pow(-2*s+2, 3)/2, pos=1-Math.pow(1-Math.min(1, s/.8), 3);   // zoom: ease in-out (log scale); turn: ease-out, done by 80%
    this.camera.zoom=Math.exp(Math.log(f.z0)+(Math.log(f.zoom)-Math.log(f.z0))*io);
    this.camera.x=f.x0+(me.x-f.x0)*pos; this.camera.y=f.y0+(me.y-90-f.y0)*pos;
    Object.assign(this.target, this.camera); this.quietAt=performance.now();
    if (s >= 1) {this.fly=null; this.follow=true;}
  }

  fit() {
    this.fly=null; this.follow = false;this.fitMode=true;
    const m=this.mapHere();   // boss 6 Nov: the island you are on, at its own size
    Object.assign(this.target, {x: m.width / 2, y: m.height / 2, zoom: this.minZoom});
  }

  resize(initial = false) {
    if (!this.initialized || this.disposed) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(this.width, this.height);
    const here = this.mapHere();
    this.minZoom = fitZoom(this.width, this.height, here.width, here.height);
    if (initial) {
      this.camera.zoom = Math.min(this.width / 1500, this.height / 1000);   // closer in, like Cursor Camp
      const cam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);   // boss 3 Nov: ?cam=x,y,zoom for QA shots
      if (cam?.length === 3 && cam.every(Number.isFinite)) Object.assign(this.camera, {x: cam[0], y: cam[1], zoom: cam[2]});
      Object.assign(this.target, this.camera);
    } else if(this.fitMode){this.fit();Object.assign(this.camera,this.target);}
  }

  ensureInterior() {
    if (this.interior || this.interiorPending || this.interiorFailed || this.disposed) return;
    this.interiorPending = createInterior().then(interior => {
      if (this.disposed) {interior.root.destroy({children: true}); return;}
      this.interior = interior;
      this.app.stage.addChild(interior.root);
    }).catch(error => {
      this.interiorFailed = true;
      if (!this.disposed) console.warn('Museum interior did not load', error);
    }).finally(() => {this.interiorPending = null;});
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
      // boss 5 Nov: boarding and docking keep the zoom you chose (no camera jump), the camera only follows
    }
    const input = {
      x: Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')) + this.touchInput.x,
      y: Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')) + this.touchInput.y,
    };
    input.x=Math.sign(input.x); input.y=Math.sign(input.y);
    // boss 6 Nov: Shift with the arrow keys / WASD runs (keyboard only; the server decides the speed, never on a boat)
    if (this.keys.has('shift') && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].some(k => this.keys.has(k)) && (input.x || input.y)) input.run=true;
    if (this.travelView?.fx.holding(this.room?.id)) input.x=input.y=0;   // boss 5 Nov: the hop in or out finishes before steering (at most 0.6 s)
    const indoors = this.interior?.active;
    while (this.accumulator >= 1 / 60) {
      this.sim.step(1 / 60, this.room || indoors ? ZERO : input);
      this.room?.step(1 / 60, indoors ? ZERO : input);
      this.accumulator -= 1 / 60;
    }
    this.room?.setAlpha(this.accumulator * 60);   // boss 5 Nov ("blurry and shaky"): the own Ducky and boat draw between steps
    const player = this.player;
    if (Boolean(player) !== this.hadPlayer) {
      this.hadPlayer = Boolean(player);
      this.updateControlLabel();
      if (!player) { this.keys.clear(); this.follow = false; this.markerUntil = 0; }
    }
    const t = this.sim.time;
    const reduced = this.motion.matches;
    // Prepare the hidden museum only when a player approaches it; visiting the island
    // or watching the globe no longer rasterizes the entire room at startup.
    if (player && player.mode !== 'sailing' && this.artShown === 'home' && mapOf(this.islandId).home && Math.hypot(player.x-MUSEUM_DOOR.x, player.y-MUSEUM_DOOR.y) < 700) this.ensureInterior();
    // boss 5 Nov: the museum door. Walk up the steps into it and the room takes over; walk out through its arch and you are back on the steps
    if (player && player.mode !== 'sailing') {
      const atDoor = this.artShown === 'home' && mapOf(this.islandId).home && atMuseumDoor(player.x, player.y);   // the museum is on the home map only
      if (!indoors && atDoor && this.doorArmed && !this.interior && !this.interiorFailed) this.stopInput();
      if (this.interior && !indoors && atDoor && this.doorArmed && this.playerRig()) {this.doorArmed = false; this.sim.stopInput(); this.interior.enter(this.playerRig(), this.width, this.height); this.onInteriorChange(true); this.scene.visible = false; if (this.nameLayer) this.nameLayer.style.visibility = 'hidden';}
      if (!atDoor && player.y > MUSEUM_DOOR.y + 60) this.doorArmed = true;
      if (this.interior?.active && this.interior.update(dt, input, this.width, this.height, t, reduced)) {
        this.interior.leave(this.objects, .88 * .24 * 3); this.onInteriorChange(false); this.scene.visible = true;
        if (this.nameLayer) this.nameLayer.style.visibility = '';
        if (this.room) this.room.destination(MUSEUM_DOOR.out.x, MUSEUM_DOOR.out.y);   // live: the server walks you back down the steps
        else Object.assign(player, {x: MUSEUM_DOOR.out.x, y: MUSEUM_DOOR.out.y, previousX: MUSEUM_DOOR.out.x, previousY: MUSEUM_DOOR.out.y, path: [], turn: 0, action: 0});
        Object.assign(this.target, {x: player.x, y: player.y - 90}); Object.assign(this.camera, this.target, {zoom: this.camera.zoom}); this.follow = true;
      }
      if (this.interior?.active) {this.app.render(); this.raf = requestAnimationFrame(time => this.tick(time)); return;}
    }
    if(player?.action===1&&(input.x||input.y)&&!this.fitMode&&!this.birdEye&&!this.gestures.pointers.size){
      const x=this.width/2+(player.x-this.camera.x)*this.camera.zoom,y=this.height/2+(player.y-this.camera.y)*this.camera.zoom*TILT;
      if(x<80||x>this.width-80||y<70||y>this.height-70)this.follow=true;
    }
    if (this.follow && player) {
      const shown=this.room?.view() ?? player;   // follow where the Ducky is drawn, not its last fixed step or uncorrected guess
      Object.assign(this.target, {x:shown.x, y:shown.y-90});
    }
    if (this.birdEye && this.spin && !this.gestures.pointers.size && !reduced) {   // a flicked globe keeps turning and slows down
      const coast=coastGlobeSpin(this.spin,dt), sx=coast.dx, sy=coast.dy;
      this.spin.x=coast.x; this.spin.y=coast.y;
      const y0=this.camera.y; this.camera.x+=sx; this.camera.y+=sy; this.target.x+=sx; this.target.y+=sy; this.constrain(this.camera); this.constrain(this.target);
      if (Math.abs(this.camera.y-(y0+sy))>1e-6) this.spin.y=0;   // hit the latitude limit: stop tilting, keep turning
      if (Math.hypot(this.spin.x,this.spin.y)*this.camera.zoom<.0001) this.spin=null;
    } else if (!this.birdEye || (this.gestures.pointers.size && performance.now()-(this.dragAt||0)>80)) this.spin=null;   // off the globe, or held still: no flick
    if (this.fly) this.stepFly(now, player);
    easeZoomCamera(this.camera, this.target, this.zoomMotion, dt, reduced, this.birdEye && (this.gestures.pointers.size || this.spin) ? 30 : 14);
    this.birdEye=!!this.archipelago && this.camera.zoom<this.minZoom*.95;   // zoomed out past the island: the archipelago shows
    if (this.birdEye || (this.ready && this.frame > 40)) this.buildCopies();   // the neighbours are in sight from the harbor, so the copies exist from the start
    this.archipelago?.update(this.camera.zoom);
    if (this.worldView) {   // 0 at the island, 1 fully zoomed out (log scale between the island fit and the whole world)
      const top = this.minZoom * .95, t = this.camera.zoom >= top ? 0 : Math.min(1, Math.log(top / this.camera.zoom) / Math.log(top / this.birdZoom()));
      if (t > 0) this.buildCopies();
      // left alone on the globe for two seconds it starts to turn, easing up to about 1.5 degrees a second (GPT review)
      if (this.gestures.pointers.size || this.spin) this.quietAt=performance.now();
      const quiet=t > .9 && !reduced ? Math.min(1, Math.max(0, (performance.now()-(this.quietAt||0)-2000)/1500)) : 0;
      if (quiet > 0) {const b=this.archipelago.bounds, step=quiet*(t-.9)/.1*(b.x1-b.x0)/240*dt; this.camera.x+=step; this.target.x+=step;}
      this.globeT=t;
    }
    if (this.archipelago && !(this.globeT >= .97)) {
      const span=this.archipelago.bounds.x1-this.archipelago.bounds.x0;
      const shift=span*Math.round((this.camera.x-this.mapHere().width/2)/span);
      this.camera.x-=shift; this.target.x-=shift;
    }
    // Cursor Camp tilt: the whole scene is squashed vertically; anything standing up is scaled back upright once.
    this.scene.scale.set(this.camera.zoom, this.camera.zoom * TILT);
    this.scene.position.set(this.width / 2 - this.camera.x * this.camera.zoom, this.height / 2 - this.camera.y * this.camera.zoom * TILT);
    this.upright.update();   // the pond bridge stands up; the jetties lie flat
    const halfWidth = this.width / (2 * this.camera.zoom), halfHeight = this.height / (2 * this.camera.zoom * TILT);
    const visible = (x,y,pad=350) => Math.abs(x-this.camera.x)<halfWidth+pad && Math.abs(y-this.camera.y)<halfHeight+pad;
    this.ocean.position.set(this.camera.x-halfWidth-256,this.camera.y-halfHeight-256);this.ocean.width=halfWidth*2+512;this.ocean.height=halfHeight*2+512;
    this.ocean.tilePosition.set(-this.ocean.x+(reduced?0:t*2),-this.ocean.y+(reduced?0:t*.7));
    const flatVisible = !(this.globeT >= .97);   // a full globe samples snapshots, not the animated island scene
    const homeShown=this.artShown === 'home';   // boss 6 Nov: on a themed island the home art (and its water, surf, leaves) rests
    if (homeShown && flatVisible) this.waterFX?.update(dt, t, {x: this.camera.x-halfWidth, y: this.camera.y-halfHeight, width: halfWidth*2, height: halfHeight*2});
    if (homeShown && flatVisible) this.surf?.update(t, reduced, visible);
    if (flatVisible) this.rowboat?.update(t, reduced, visible);
    if (homeShown && flatVisible) this.boats?.update(t, reduced, visible);
    const boatPoses=boatsForView(this.room,now/1000,()=>
      this.room && import.meta.env.DEV && this.archipelago && this.globeT<.97
        ? previewMoorings(this.archipelago.islands,this.camera,this.width,this.height,TILT) : []);
    this.travelView?.update(boatPoses,t,reduced,visible,player,this.camera);
    this.weather.update(t,reduced,visible);
    const breeze=windStrength(t,reduced);
    this.gust *= Math.exp(-dt * 2.5);
    if (!homeShown) this.artProps(this.artShown).forEach((prop, i) => {   // the themed island's own props: culled, and the plants sway
      prop.sprite.visible = visible(prop.x, prop.y, Math.max(prop.width, prop.height) * prop.scale);
      if (prop.shadow) prop.shadow.visible = prop.sprite.visible;
      if (prop.sprite.visible) prop.sprite.skew.x = !reduced && prop.wind ? Math.sin(t * 1.3 + i * .7) * .009 * breeze + this.gust * .035 : 0;
    });
    for (const art of this.arts.values()) if (art.ready) art.updateCentre?.(t, reduced);
    if (homeShown) this.props.forEach((prop, i) => {
      prop.sprite.visible = visible(prop.x, prop.y, Math.max(prop.width, prop.height) * prop.scale);
      if(prop.shadow)prop.shadow.visible=prop.sprite.visible;
      if (!prop.sprite.visible) return;
      prop.sprite.skew.x = !reduced && prop.wind ? Math.sin(t * 1.3 + i * .7) * (/flag|bunting|banner|umbrella/i.test(prop.asset||prop.name)?.018:.009)*breeze + this.gust * .035 : 0;
      prop.sprite.y = prop.y + (!reduced && prop.boat ? Math.sin(t * 1.5 + i) * 3 : 0);
      prop.sprite.rotation = !reduced && prop.boat ? Math.sin(t * 1.1 + i) * .008 : 0;
      // boss 5 Nov: bank plants answer the same water field as floating pads.
      if (/lily|reeds|cattails/i.test(prop.asset || prop.name)) this.waterFX?.lily(prop, {y: prop.y, rotation: 0});
    });
    if (homeShown) this.floating.forEach(item=>{const pose=floatingPose(item,t,reduced);item.sprite.position.set(pose.x,pose.y);item.sprite.rotation=pose.rotation;item.sprite.visible=visible(item.x,item.y,100);this.waterFX?.lily(item,pose,t);});
    this.dust?.update(dt);
    const alpha = this.accumulator * 60;
    this.rigs.forEach((rig, i) => {
      const duck = this.localDucks[i];
      const x = duck.previousX + (duck.x-duck.previousX)*alpha;
      const y = duck.previousY + (duck.y-duck.previousY)*alpha;
      const hop = jumpPose(duck.jumpLeft, reduced, {turn: duck.turn, moving: duck.travel > 20});   // boss 6 Nov: crouch, stretch, lean, land
      rig.root.position.set(x, deckY(x, y, this.arches) - hop.lift);   // boss 3 Nov: Duckies walk up and over the arched bridges
      rig.root.zIndex = y;
      rig.root.visible = (homeShown || duck.player) && visible(x, y, 200);   // the sleepers lie on the home map's spots
      if (flatVisible && rig.root.visible) rig.update(dt, {action: duck.action, speed: duck.travel, turn: duck.turn, time: t, reducedMotion: reduced, emoteVersion: duck.emoteVersion, persistentSleep: duck.sleeping, jump: hop});
      if (duck.player) {rig.showRing?.(hop.phase !== 'air'); this.dust?.track(duck, {x, y: deckY(x, y, this.arches), z: y, jumpLeft: duck.jumpLeft, travel: duck.travel, turn: duck.turn, reduced, dt});}
      if (homeShown) this.bumpSleeper(duck, rig, player);   // boss 5 Nov: walking into a sleeper stops at its edge and wobbles it once
    });
    if (!homeShown) {   // boss 6 Nov: a themed island's own sleepers (and its surf, pond ripples, leaves and floating pads)
      for (const {duck, rig} of this.mapSleepers.get(this.artShown) ?? []) {
        rig.root.position.set(duck.x, duck.y); rig.root.zIndex=duck.y;
        rig.root.visible=visible(duck.x, duck.y, 200);
        if (flatVisible && rig.root.visible) rig.update(dt, {action: 7, speed: 0, turn: 0, time: t, reducedMotion: reduced, emoteVersion: 0, persistentSleep: true, jump: jumpPose(0, reduced, {turn: 0, moving: false})});
        this.bumpSleeper(duck, rig, player);
      }
      const amb=this.arts?.get(this.artShown)?.ambience;
      if (amb) {
        if (flatVisible) amb.surf.update(t, reduced, visible);
        for (const {sprite, phase, x, y} of amb.ripples) {sprite.visible=visible(x, y, 100); sprite.position.set(x+(reduced?0:Math.sin(t*.18+phase)*6), y+(reduced?0:Math.sin(t*.24+phase)*2)); sprite.scale.set(reduced ? 1 : 1+Math.sin(t*.8+phase)*.22); sprite.alpha=reduced ? .35 : .35+Math.sin(t+phase)*.2;}
        for (const {sprite, x, y, phase} of amb.leaves) {
          sprite.visible=!reduced && visible(x, y); const age=(t*.12+phase)%1;
          sprite.position.set(x+age*170*(.65+breeze*.7)+Math.sin(t+phase)*12, y+age*210); sprite.rotation=Math.sin(t*2+phase); sprite.alpha=Math.sin(age*Math.PI)*.65;
        }
        for (const item of amb.floats) {const pose=floatingPose(item, t, reduced); item.sprite.position.set(pose.x, pose.y); item.sprite.rotation=pose.rotation; item.sprite.visible=visible(item.x, item.y, 100);}
      }
    }
    if (player) this.bumpFrom = {x: player.x, y: player.y};
    const live = this.room?.poses(now / 1000) ?? [];
    if (homeShown && flatVisible) this.waterFX?.edge([...this.localDucks, ...live]);
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
      sprite.visible = homeShown && !reduced && visible(x,y);
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
    this.fountainWater?.update(t, reduced, flatVisible && homeShown && this.fountainWater && visible(this.fountainWater.root.x + 250, this.fountainWater.root.y + 240, 400));
    this.splashes.forEach(({sprite,phase})=>{const age=(t*.7+phase)%1;sprite.visible=!reduced;sprite.scale.set(.4+age*1.3,.5+age*.9);sprite.alpha=Math.max(0,1-age*2)*.6;});
    this.marker.visible = this.markerUntil > t;
    if (this.marker.visible) {const age=1.5-(this.markerUntil-t);this.marker.alpha=1-age/1.5;this.marker.scale.set(1+age*.9,1+age*8/9);}
    // boss 4 Nov: no walking sound (Ashwin found it annoying)
    // the globe captures the scene only now, after this frame's camera and animations are set (GPT review: no frame lag)
    const copies=this.liveCopies(); this.archipelago?.showLive(new Set(copies.map(i => i.id)));
    if (this.worldView) this.worldView.liveCopies=target => this.renderLiveCopies(target, copies);
    this.worldView?.update(this.globeT||0, this.width, this.height, performance.now() / 1000, this.camera, this.archipelago, this.mapHere(), this.birdZoom(), !this.gestures.pointers.size, this.player);   // Guests have no player island to point toward.
    if (this.nameLayer) {   // boss 6 Nov: the name tags fade out as the 'You' pin fades in, by the same zoom progress (no pop)
      const tags=1-(this.worldView?.pinIn ?? 0), css=tags >= 1 ? '' : tags.toFixed(3);
      if (css !== this.tagOpacity) {this.tagOpacity=css; this.nameLayer.style.opacity=css; this.nameLayer.style.pointerEvents=tags < .5 ? 'none' : '';}
    }
    this.app.render();
    if (!(this.globeT > 0)) {this.renderLiveCopies(undefined, copies);this.worldView?.renderGuide();}   // flat view: straight onto the screen, after the real island
    // DOM-only diagnostics make automated acceptance possible without scene overlays.
    if (this.frame % 15 === 0) {
      const d = this.canvas.dataset;
      d.ducks = String(this.localDucks.length + live.length);
      d.livePlayers = String(live.length);
      d.sleepingDucks = String(homeShown ? this.sim.ducks.filter(duck => duck.sleeping && duck.action === 7).length : (this.mapSleepers.get(this.artShown)?.length ?? 0));   // boss 6 Nov: the shown map's
      d.map = this.artShown;
      d.offshoreProgress=String(offshoreProgress(player));
      d.island=this.islandId; d.travelMode=player?.mode ?? 'watching';
      d.boats=String(this.room?.tick>=0 ? this.room.boats.length : boatPoses.length);
      d.player = player ? `${player.x.toFixed(1)},${player.y.toFixed(1)}` : '';
      d.action = player ? String(player.action) : '';
      d.jumpLeft = (player?.jumpLeft ?? 0).toFixed(3);
      d.quackBubbles=String(this.sim.ducks.filter(duck=>duck.action===2).length);
      d.playerRing=String(Boolean(player));d.muted=String(this.audio.muted);d.follow=String(this.follow);d.destinationMarker=String(this.marker.visible);d.birds=String(this.birds.length);
      d.camera = JSON.stringify(this.camera);
      d.islandGuide = JSON.stringify(this.worldView?.pinPoint() ?? null);
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
      const hop=look.deck ? jumpPose(pose.jumpLeft,reducedMotion,{turn:look.turn,moving:look.speed>20}) : null;   // boss 6 Nov: the jump's crouch, stretch, lean and landing
      rig.root.position.set(look.x,(look.deck?deckY(look.x,look.y,this.arches):look.y)-(hop?.lift ?? 0));   // Ashwin's space-to-jump, on our boarding/sailing look
      rig.root.rotation=look.rotation; rig.root.alpha=look.alpha;
      rig.showRing?.(look.deck && pose.mode !== 'sailing' && hop?.phase !== 'air');   // boss 5 Nov: your ring only on land, never on the boat or mid-hop
      if (look.deck && pose.mode !== 'sailing') this.dust?.track(entry, {x:look.x, y:deckY(look.x,look.y,this.arches), z:look.z ?? look.y, jumpLeft:pose.jumpLeft, travel:look.speed, turn:look.turn, reduced:reducedMotion, dt});
      rig.root.zIndex = look.z ?? look.y;
      rig.root.visible = visible(look.x,look.y,200);
      if (rig.root.visible) rig.update(dt, {action, speed:look.speed, turn:look.turn, time, reducedMotion, emoteVersion, jump:hop});
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.cleanups.forEach(fn => fn());
    this.archipelago?.destroy(); this.worldView?.destroy();
    this.clearChat();
    this.keys.clear();
    this.gestures.clear();
    this.audio.dispose();
    this.waterFX?.dispose();
    this.travelView?.dispose();
    for (const art of this.arts?.values() ?? []) if (art.id !== 'home') art.destroy?.();
    for (const sleepers of this.mapSleepers.values()) for (const {rig} of sleepers) rig.dispose();
    this.mapSleepers.clear();
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
