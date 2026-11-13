import './art/whole-svg-loader.js';
import {uploadIsland, nextArtFrame, markArtActivity, mapArtInFrames} from './art/island-preparation.js';
import {renderPolaroid} from '../shared/polaroid.js';
import {ART_TEXTURE} from './art/art-texture.js';
import {createPirateFleet,pirateBoatPoint} from '../../gameplay/pirate-fleet.js';
import {createPirateView} from './pirate-view.js';
import {homePropY, homePropRotation} from './environment/home-motion.js';
import {createHomeKites, KITE_ASSETS} from './environment/home-kites.js';
import {easeLandingBasis,canonicalCamera,turnLongitude,cameraMatrix,cameraSpan} from '../shared/sphere-camera.js';
import {createSailingCamera} from '../shared/sailing-camera.js';
import {sailingUpright} from './sailing-upright.js';
import {WORLD_GEO,WORLD_ISLANDS,neighboursOf} from '../../world/world-map.js';
import {createLivePatches} from './sphere-mesh.js';
import {createIsletView} from './islet-view.js';
import {globeBall,uprightFade,globeRoll,rollBasis,lonLat,lookOf,centreOf,LAT_MAX} from '../shared/globe-look.js';
import {unplaceRigid,flatRigid} from '../../world/rigid.js';
import {withRigidVisitors} from '../shared/rigid-visitors.js';
import {localPoint,spherePoint} from '../../world/sphere-coordinates.js';
import {previewMoorings, boatsForView} from './boat-preview.js';
import {easeZoomCamera} from '../shared/zoom-motion.js';
import {planIslandArt} from './art/island-budget.js';
import {walkingZoom} from './art/texture-footprint.js';
import {createGroundPool} from './art/ground-stream.js';
import {propZ} from '../shared/flat-props.js';
import {constrainExploreCamera, zoomToWorldPoint} from '../shared/explore-camera.js';
import {sampleGlobeSpin, coastGlobeSpin} from '../shared/globe-motion.js';
import {trackUpright} from '../shared/upright.js';
import {attachCentreMotion} from './environment/centre-motion.js';
import {createWeather,windStrength} from './environment/weather.js';
import {createSnowfall} from './environment/snowfall.js';
import {createBird,birdPose,createCrow,crowPose} from './environment/birds.js';
import {createBeachSurf, shoreOf} from './environment/surf.js';
import {createRowboat} from './rowboat.js';
import {loadBoatViews,prepareBoatViews} from './boat-views.js';
import {createMooredBoats} from './sailboats.js';
import {createTravelView} from './travel-view.js';
import {createArchipelago} from './archipelago.js';
import {copyHolding} from '../../world/sphere-shores.js';
import {createWorldView} from './world-view.js';
import {CLOUD_TEXTURE} from './globe-clouds.js';
import {createKarmaView} from './karma-view.js';
import {createBoatBuildView} from './boat-build-view.js';
import {isletUnder} from '../../gameplay/boat-build.js';
import {HARBOR, harborOf, islandFor, near, seaBoundsFor, destinationsFor, offshoreProgress, harborClear, harborWorld, boardingPoint, dockingSpot, canDock, islandOffset} from '../../gameplay/islands.js';
import {isletWalks} from '../../world/islet-walk.js';
import {reframeIslet} from '../../world/islet-placement.js';
import {ambientOf, artOf, mapFor, mapOf} from '../../world/island-maps.js';
import {loadThemeArt} from './art/theme-art.js';
import {telescopeNear,telescopePeerAt} from './telescope.js';
import {setSailingHarbor} from './sailing-fx.js';
import {createButterfly,butterflyPose} from './environment/butterflies.js';
import {loadPondDuckies} from './environment/pond-duckies.js';
import {floatingPose} from './environment/floating.js';
import {Application, Assets, Container, Graphics, Sprite, TilingSprite, Texture, Matrix} from 'pixi.js';
import rawWorld from '../../../assets/world/world.json';
import art from '../../world/home/art-manifest.json';
import {pickWorldSpawn} from '../../gameplay/world-spawn.js';
import {createSimulation} from '../../gameplay/simulation.js';
import {startJump,jumpHeight,jumpPose,JUMP_SECONDS,MUSEUM_DOOR,atMuseumDoor} from '../../gameplay/player-motion.js';
import {createDust} from './environment/dust.js';
import {createPlantReactions, LEAF_TEXTURE} from './environment/plant-reactions.js';
import {createRinkTrails} from './environment/rink-trails.js';
import {createAudio} from './audio.js';
import {prepareDuckPortrait} from './duck-portrait.js';
import {createDuck, prepareDuckAssets, duckTextureSources, disposeDuckAssets} from './duck.js';
import {createFountainWater} from './environment/fountain.js';
import {createWater} from './environment/water.js';
import {createPlacements, homeDecals, HOME_TILES, HOME_DECKS, HOME_MOUTHS, HOME_GROUND_DECALS, HOME_ORIGIN, decalsFor, deckY, deckX, groundAt, H, JETTIES, sleeperFootprint, sleepSpots, trimWorld, walkWorld} from '../../world/home/placements.js';
import {sleepHalfWidths} from './environment/sleeper.js';
import {createInterior} from './interior.js';
const napWidths = sleepHalfWidths(.88 * .24 * 3);
const world = trimWorld(rawWorld);
import {geometry, inShape} from '../../../assets/world/island-geometry.mjs';
import {PALETTE} from '../shared/palette.js';
import {clamp, fitZoom, Gestures, movePinch, screenToWorld, TILT, zoomAt} from '../shared/camera.js';
import {CHAT_DURATION} from '../../multiplayer/chat.js';
import {sameOutfit} from '../../gameplay/outfits.js';

const textureLeases = new Map();
const SOLO_HIDDEN=new Set(WORLD_ISLANDS.map(island=>island.id));
const ZERO = {x:0,y:0};
const SIM_STEP = 1 / 60;
const renderJumpLeft = (left, accumulator) => left > 0
  ? Math.min(JUMP_SECONDS, left + SIM_STEP - accumulator)
  : 0;
const CHAT_LABEL_GAP = 4;
const SHADOW_TINT = {sand: [PALETTE.sandShade, .18], grass: [PALETTE.deepLeaf, .15], water: [PALETTE.ink, .12]};
const FOOTPRINT = [[/bench-wood-(left|right)/, .1, 2.4], [/fountain/, .25, .82], [/^tree-/, .3, .3], [/^(bush|flower)-/, .4, .32], [/lamp|pole/, .4, .34],
  [/lighthouse/, .3, .32], [/umbrella/, .32, .4], [/library/, .44, .26], [/boat/, .36, .3]];
const NO_SHADOW = /bunting|banner|flag|bridge|blanket|lily|shell|reeds/i;
function contactShadow(prop) {
  const name = prop.asset || prop.name, [, share, depth] = FOOTPRINT.find(([re]) => re.test(name)) || [, .38, .3];
  const [rx, ry] = prop.shadowSize ?? (r => [r, r * depth])(Math.max(8, Math.min(300, prop.width * prop.scale * share)));
  const [color, alpha] = SHADOW_TINT[/boat/i.test(name) ? 'water' : groundAt(prop.x, prop.y, world)];
  const nudge = Math.min(1, rx / 80) * .15 * H / Math.hypot(2, 1);
  const [sx,sy] = prop.shadowOffset ?? [nudge*2,nudge];
  return new Graphics().ellipse(sx, sy, rx, ry).fill({color, alpha});
}
function acquire(src, resolution = 1, {mipmaps = true} = {}) {
  let entry = textureLeases.get(src);
  if (!entry) {
    entry = {count: 0, resolution, promise: Assets.load({src, data: {resolution, ...(mipmaps ? ART_TEXTURE : {groundPadding:2})}})};
    textureLeases.set(src, entry);
  }
  entry.count++;
  return entry.promise;
}
const acquireGround = (src, resolution) => acquire(src, resolution, {mipmaps: false});
function release(src) {
  const entry = textureLeases.get(src);
  if (!entry || --entry.count) return;
  entry.promise.then(() => {
    if (entry.count || textureLeases.get(src) !== entry) return;
    textureLeases.delete(src);
    Assets.unload(src).catch(() => {});
  }).catch(() => {if(textureLeases.get(src)===entry)textureLeases.delete(src);});
}

// the next island on the fewest-hops sea route from one island to another (null when there is no route)
function nextIsland(from, to) {
  const previous=new Map([[from,null]]), queue=[from];
  while (queue.length) {
    const id=queue.shift();
    if (id === to) break;
    for (const {island} of neighboursOf(id)) if (!previous.has(island.id)) {previous.set(island.id,id); queue.push(island.id);}
  }
  if (!previous.has(to) || to === from) return null;
  let step=to;
  while (previous.get(step) !== from) step=previous.get(step);
  return step;
}

export class PixiIsland {
  constructor({onError = () => {}, onInteriorChange = () => {}, room = null, chatLayer = null, chatEditor = null, nameLayer = null, transparent = false, renderResolution, randomArrival = false, onArrival = () => {}, onGlobeChange = () => {}, onPhotoReady} = {}) {
    this.onPhotoReady = onPhotoReady;
    this.onGlobeChange = onGlobeChange; this.globeOpen = false;
    this.transparent=transparent;this.renderResolution=renderResolution;
    this.onInteriorChange = onInteriorChange;
    this.room = room;
    this.islandId = 'home';
    this.randomArrival = randomArrival;
    this.onArrival = onArrival;
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
    this.startupPrepared = false;
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
    this.mapSleepers = new Map();
    this.doorArmed = false;
    this.audio = createAudio();
  }

  get player() { return this.room ? this.room.player : this.sim?.player; }

  async mount(host) {
    this.host = host;
    this.app = new Application();
    try {
      await this.app.init({width: host.clientWidth || 1280, height: host.clientHeight || 720,
        resolution: Math.min(this.renderResolution ?? (devicePixelRatio || 1), 2), autoDensity: true,
        antialias: true, background: '#6EC9DE', backgroundAlpha:this.transparent?0:1, preference: 'webgl', autoStart: false,
        sharedTicker: false});
      if (this.disposed) { this.app.destroy({removeView:true,releaseGlobalResources:false}, {children: true}); return; }
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
      this.dust = createDust(this.objects);
      this.air = new Container();
      this.floatLayer=new Container();
      this.contactShadows=new Container();
      this.decks=new Container();
      this.upright=trackUpright([[this.objects], [this.air], [this.decks, true]], TILT);
      this.cleanups.push(() => this.upright.destroy());
      this.overDecks=new Container({label: 'Bridges over boats'});
      this.scene.addChild(this.ground, this.water, this.floatLayer, this.decks, this.contactShadows, this.objects, this.overDecks, this.air);
      this.app.stage.addChild(this.scene);
      // Render the same sea and player rig throughout startup. Island scaffolding
      // can be assembled offscreen without stopping the stage's render loop.
      this.scene.visible=false;
      this.arrivalScene=new Container({label:'Arrival sea'});
      this.app.stage.addChild(this.arrivalScene);
      this.ocean=new TilingSprite({texture:Texture.EMPTY,width:1280,height:720});
      this.arrivalScene.addChild(this.ocean);
      this.lastFrame=performance.now();
      this.renderArrival(this.lastFrame);
      this.loaded.push('/pixi-art/water-texture.svg');
      const seaTexture=await acquire('/pixi-art/water-texture.svg');
      if(this.disposed)return;
      this.ocean.texture=seaTexture;
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.snowfall=createSnowfall(this.app.stage);
      this.loaded.push(LEAF_TEXTURE);
      const leafTexture=await acquire(LEAF_TEXTURE);
      if (this.disposed) return;
      this.plantReactions=createPlantReactions(this.air,leafTexture);
      this.rinkTrails=createRinkTrails(this.decks);
      const props = createPlacements(world, geometry({...world, obstacles: []}).walkable)
        .filter(prop => !this.room || harborClear(prop)), local = this.room ? harborWorld(walkWorld(world, props)) : walkWorld(world, props);
      globalThis.__duckyProps = props.map(p => ({id: p.id, name: p.name, asset: p.asset, x: Math.round(p.x), y: Math.round(p.y), scale: p.scale, src: p.src}));
      const beds = sleepSpots(local, props, geometry(local).walkable, napWidths), walk = {...local, obstacles: [...local.obstacles, ...beds.map(sleeperFootprint)]};
      this.sim = createSimulation(walk, 8612, {sleepingNpcs: true, npcCount: beds.length});
      this.sim.ducks.slice(1).forEach((duck, i) => {const b = beds[i]; if (!b) return; duck.x = duck.previousX = b.x; duck.y = duck.previousY = b.y; duck.sleep = {pose: b.pose, flip: b.flip}; duck.footprint = sleeperFootprint(b);});
      this.sim.ducks.splice(beds.length + 1);
      globalThis.__duckySleepers = beds.map(b => ({pose: b.pose, flip: b.flip, x: Math.round(b.x), y: Math.round(b.y), tree: b.tree}));
      globalThis.__duckySleepersDropped = beds.bad;
      this.room?.configure(this.sim.nav, walk);
      this.initialSpawn=this.randomArrival&&!this.room?pickWorldSpawn({homeNav:this.sim.nav}):null;
      const startingIsland=this.room ? await this.room.waitForIsland() : this.initialSpawn?.islandId ?? 'home';
      if(this.disposed||!startingIsland)return;
      const prepareHome=artOf(startingIsland)==='home';
      this.arrivalRig=await createDuck({outfit:this.player?.outfit,seed:21,isPlayer:true});
      if(this.disposed){this.arrivalRig.dispose();return;}
      this.arrivalScene.addChild(this.arrivalRig.root);
      const homeDeferred=new Map();
      const acquireHome=(src,resolution=1)=>{
        if(src==='/pixi-art/water-texture.svg')return Promise.resolve(seaTexture);
        if(prepareHome){this.loaded.push(src);return acquire(src,resolution);}
        let lease=homeDeferred.get(src);
        if(!lease){lease={src,resolution,count:0,texture:new Texture({source:Texture.EMPTY.source})};homeDeferred.set(src,lease);}
        lease.count++;return Promise.resolve(lease.texture);
      };
      this.resize(true);
      this.listen(this.canvas, 'webglcontextlost', event => {event.preventDefault(); cancelAnimationFrame(this.raf); this.audio.suspend(); this.onError();});
      const tiles = HOME_TILES;
      this.homeGround = new Container({label: 'Home ground'}); this.ground.addChild(this.homeGround);
      this.homeDecks = new Container({label: 'Home decks'}); this.decks.addChild(this.homeDecks);
      this.homeShadows = new Container({label: 'Home shadows'}); this.contactShadows.addChild(this.homeShadows);
      const decals = homeDecals(props);
      const flats = [{src: '/pixi-art/lake-race.svg', x: 3400, y: 1050, width: 1500, height: 950, resolution: 1, topLeft: true},
        {src: '/pixi-art/decals/plaza-paving.svg', x: 2330, y: 1980, width: 980, height: 780, resolution: 1, topLeft: true}, ...decals.map(d => ({...d, resolution: 2.5})), ...HOME_GROUND_DECALS.map(d => ({...d, resolution: 2.5}))];
      const STEPS = [{src: '/pixi-art/library-steps.svg', x: 2780, y: 1370, width: 280, height: 260, resolution: 1.5}];
      const decks = [...JETTIES, ...STEPS, ...HOME_DECKS];
      this.groundPool=createGroundPool({acquire:acquireGround,release});
      const entries = [...decks, ...props, ...art.floating, {src:'/pixi-art/water-texture.svg'}, ...flats.map(e=>({...e,ground:true}))].map(entry=>({...entry}));

      this.homeArtPlan=planIslandArt([...entries,...tiles.map(t=>({...t,mipmaps:false}))],{dpr:this.app.renderer.resolution,defaultZoom:walkingZoom(this.width,this.height)});
      const sourceResolutions=this.homeArtPlan.resolutions;
      for(const entry of entries)entry.rasterResolution=sourceResolutions.get(entry.src);
      const artTextures = await Promise.all(entries.map(entry => {
        return acquireHome(entry.src, entry.rasterResolution);
      }));
      const textures=[...tiles.map(()=>Texture.EMPTY),...artTextures];
      this.sceneryPending = false;
      if (this.disposed) return;
      // The ocean stays in the arrival scene until the main loop takes over.
      this.homeGroundStream=this.groundPool.create(tiles,this.homeGround);
      // Arrival already renders sea + Duck until all final pieces are uploaded.
      // A whole-island preview is never exposed here, including restored Home.
      const base = tiles.length + decks.length, flatBase = base + props.length + art.floating.length + 1;
      this.flats = new Container({label: 'Ground detail'}); this.homeGround.addChild(this.flats);
      await mapArtInFrames(flats,(d, i) => {
        const sprite = new Sprite(textures[flatBase + i]);
        sprite.position.set(d.x, d.y); sprite.width = d.width; sprite.height = d.height;
        if (!d.topLeft) {sprite.anchor.set(.5, 1); sprite.width = d.width; if (d.flip) sprite.scale.x *= -1;}
        this.flats.addChild(sprite);
      });
      await mapArtInFrames(decks,(jetty, i) => {
        const sprite = new Sprite(textures[tiles.length + i]);
        sprite.position.set(jetty.x, jetty.y);
        sprite.width = jetty.width;
        sprite.height = jetty.height;
        this.homeDecks.addChild(sprite);
        if (/river-crossing-|bridge-jetty-/.test(jetty.src)) {
          const over = new Sprite(textures[tiles.length + i]);
          over.position.set(jetty.x, jetty.y); over.width = jetty.width; over.height = jetty.height; over.visible = false;
          this.overDecks.addChild(over);
          (this.bridgeOver ??= []).push({sprite: over, x0: jetty.x - 20, x1: jetty.x + jetty.width + 20, y0: jetty.y, y1: jetty.y + jetty.height + 40});
        }
      });
      this.floating=art.floating.map((item,i)=>{
        const sprite=new Sprite(textures[base+props.length+i]);
        sprite.anchor.set(item.anchor.x,item.anchor.y);sprite.position.set(item.x,item.y);
        sprite.width=item.width;sprite.height=item.height;this.floatLayer.addChild(sprite);
        return {...item,sprite};
      });
      this.props = await mapArtInFrames(props,(prop, i) => {
        const name=prop.asset||prop.name;
        let shadow;
        if(!NO_SHADOW.test(name)&&!prop.noShadow){shadow=contactShadow(prop);shadow.position.set(prop.x,prop.y);this.homeShadows.addChild(shadow);}

        const sprite = new Sprite(textures[base + i]);
        sprite.anchor.set(prop.anchor.x, prop.anchor.y);
        sprite.position.set(prop.x, prop.y);
        sprite.width = prop.width * prop.scale;
        sprite.height = prop.height * prop.scale;
        sprite.zIndex = prop.z ?? propZ(prop, prop.y);
        sprite.standing = true;
        if (prop.flip) sprite.scale.x *= -1;
        if (prop.tint) sprite.tint = prop.tint;
        (/bridge/i.test(name) ? this.decks : this.objects).addChild(sprite);
        return {sprite, shadow, ...prop, wind: /tree|reeds|cattails|flower|leaf|bush|flag|bunting|banner|umbrella/i.test(prop.name), boat: /boat/i.test(prop.asset || prop.name)};
      });
      const kiteTextures = await Promise.all(KITE_ASSETS.map(src => acquireHome(src,2)));
      if (this.disposed) return;
      this.homeKites = createHomeKites(this.objects, Object.fromEntries(KITE_ASSETS.map((src, i) => [src, kiteTextures[i]])));
      this.homePlantObstacles=walk.obstacles;
      if(prepareHome)await this.plantReactions.register('home',this.props,walk.obstacles);
      this.homeDucks = this.room ? this.sim.ducks.slice(1) : this.sim.ducks;
      this.localDucks = prepareHome ? this.homeDucks : this.room ? [] : [this.sim.player];
      const results = await mapArtInFrames(this.localDucks,async d => {
        try{return {status:'fulfilled',value:d.player?this.arrivalRig:await createDuck({outfit:d.outfit,seed:d.id+21,isPlayer:d.player,sleep:d.sleep})};}
        catch(reason){return {status:'rejected',reason};}
      },{batchSize:2});
      this.rigs = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      this.rigs.forEach((rig, i) => {if (this.localDucks[i]?.player) rig.arrive?.();});
      if (this.disposed) {this.rigs.forEach(r => r.dispose()); this.rigs = []; disposeDuckAssets().catch(() => {}); return;}
      const failure = results.find(r => r.status === 'rejected');
      if (failure) throw failure.reason;
      this.rigs.forEach((rig, i) => {
        const duck = this.localDucks[i];
        rig.root.scale.set(.88 * .24 * 3);
        rig.root.position.set(duck.x, duck.y);
        this.objects.addChild(rig.root);
      });
      globalThis.__duckyInterior = () => this.interior?.debug() ?? {active: false, loading: Boolean(this.interiorPending)};
      const before = new Set([...this.water.children, ...this.objects.children, ...this.air.children]);
      if(prepareHome)await this.prepareHomeWater();
      if (this.disposed) return;
      this.createAmbient();
      const keep = new Set([this.marker, ...this.birds.map(b => b.root), ...this.crows.map(c => c.root), ...this.butterflies.map(b => b.root), ...(this.weather?.roots?.() ?? [])]);
      const extras = [...this.water.children, ...this.objects.children, ...this.air.children].filter(c => !before.has(c) && !keep.has(c) && !/weather|cloud|rain|wind/i.test(c.label || ''));
      this.homePondDuckies=await loadPondDuckies(prepareHome?'home':'deferred-home',{tilt:TILT,acquire,release});
      if(this.disposed){this.homePondDuckies.destroy();return;}
      this.scene.addChildAt(this.homePondDuckies.root,this.scene.getChildIndex(this.decks));
      this.arts = new Map([['home', {id: 'home', ready: false, pondDuckies:this.homePondDuckies, groups: [this.homeGround, this.homeDecks, this.homeShadows, this.floatLayer, this.homePondDuckies.root, ...extras]}]]);
      this.artShown = 'home';
      this.homeSources=this.loaded.filter(src=>src!==LEAF_TEXTURE&&src!=='/pixi-art/water-texture.svg');
      if(prepareHome){
        await this.uploadHomeArt();
      }else{
        const nodes=this.homeTextureNodes();
        this.homeRestore=Promise.resolve([...homeDeferred.values()].map(lease=>{
          lease.nodes=nodes.filter(node=>node.texture===lease.texture).map(node=>({node,width:node.width,height:node.height}));
          for(const {node} of lease.nodes)node.texture=Texture.EMPTY;
          lease.texture.destroy();delete lease.texture;return lease;
        }));
        this.homeGroundStream.destroy();
        this.releasePondDuckies('home');
      }

      if (new URLSearchParams(location.search).has('qa')) globalThis.__duckyEngine = this;
      this.archipelago = createArchipelago(this.app, this.scene, this.scene, world);
      // Globe and open-sea scenery are prepared on demand, outside walking.
      globalThis.__duckyPin=()=>this.worldView?.pinPoint();globalThis.__duckyRigid=()=>this.rigidReadback();
      if (this.room) {
        this.travelView=await createTravelView(this.objects,this.water,this.decks);
        if (this.disposed) {this.travelView.dispose(); return;}
        this.travelView.fx.waterSplash=(x,y)=>{if (this.artShown === 'home') this.waterFX?.splash(x,y,.85,30);};
        this.switchIsland(this.room.islandId);
        this.karmaView=await createKarmaView(this);
        createBoatBuildView(this).then(view => {if (this.disposed) view.destroy(); else this.boatBuild=view;});
      }
      if (this.randomArrival && !this.room) {
        const spawn = this.initialSpawn;
        if (spawn) {
          const {x,y,islandId,name} = spawn;
          Object.assign(this.sim.player,{x,y,previousX:x,previousY:y});
          if (islandId !== 'home') this.sim.setPlayerNav(mapOf(islandId).nav());
          this.switchIsland(islandId);
          this.offlineArrival = name;
        }
      }
      this.bindInput();
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(host);
      // Start ordinary frames before destination preparation, audio, portraits or
      // GPU warmup. Those jobs yield while the ocean and Duck keep animating.
      cancelAnimationFrame(this.raf);
      this.scene.addChildAt(this.ocean,0);
      this.arrivalRig.root.scale.set(.88*.24*3);
      if(!this.room)this.objects.addChild(this.arrivalRig.root);
      if(this.room){
        const player=this.player;
        if(player){
          this.objects.addChild(this.arrivalRig.root);
          this.liveRigs.set(player.id,{isPlayer:true,rig:this.arrivalRig,outfit:{...player.outfit},emoteVersion:player.emoteVersion});
        }else this.arrivalRig.dispose();
      }
      this.arrivalRig=null;
      this.arrivalScene.destroy();this.arrivalScene=null;
      this.scene.visible=true;
      this.lastFrame=performance.now();
      this.raf=requestAnimationFrame(time=>this.tick(time));
      await this.ensureArt(this.artShown);
      if(this.disposed)return;
      await prepareDuckAssets();
      await loadBoatViews();
      await this.audio.prepare();
      if(this.player?.outfit)await prepareDuckPortrait(this.player.outfit).catch(()=>null);
      if(this.disposed)return;
      await uploadIsland(this.app.renderer,[this.scene],{sources:duckTextureSources(),cancelled:()=>this.disposed});
      this.startupPrepared = true;
      this.showArt(this.artShown);
      this.ready = true;
      this.canvas.dataset.state = 'ready';
      void prepareBoatViews(this.app.renderer,{cancelled:()=>this.disposed}).catch(()=>null);

    } catch (error) {
      if (!this.disposed) {console.error('Pixi island:', error); this.onError(error); this.dispose();}
    }
  }


  renderArrival(now) {
    if(this.disposed||!this.arrivalScene)return;
    const dt=Math.min(.1,Math.max(0,now-this.lastFrame)/1000),t=now/1000;
    this.lastFrame=now;
    const player=this.player ?? this.initialSpawn;
    const width=this.host.clientWidth||1280,height=this.host.clientHeight||720;
    const camera={x:player?.x??this.camera.x,y:(player?.y??this.camera.y)-90,zoom:.6};
    const matrix=cameraMatrix(camera,width,height,TILT);
    this.arrivalScene.setFromMatrix(new Matrix(matrix.a,matrix.b,matrix.c,matrix.d,matrix.tx,matrix.ty));
    this.positionOcean(camera,width,height,t,this.motion?.matches);
    if(this.arrivalRig){
      const root=this.arrivalRig.root;
      // Setup may reparent the offline rig before all scaffolding is complete.
      if(root.parent!==this.arrivalScene)this.arrivalScene.addChild(root);
      root.position.set(player?.x??camera.x,player?.y??camera.y+90);
      root.scale.set(.88*.24*3,.88*.24*3/TILT);root.visible=true;
      this.arrivalRig.update(dt,{action:0,speed:0,turn:player?.turn??0,time:t,reducedMotion:this.motion?.matches});
    }
    this.app.render();
    this.raf=requestAnimationFrame(time=>this.renderArrival(time));
  }

  positionOcean(camera,width,height,t,reduced) {
    const span=cameraSpan(camera,width,height);
    const halfWidth=span.width/(2*camera.zoom),halfHeight=span.height/(2*camera.zoom*TILT);
    this.ocean.position.set(camera.x-halfWidth-256,camera.y-halfHeight-256);
    this.ocean.width=halfWidth*2+512;this.ocean.height=halfHeight*2+512;
    this.ocean.tilePosition.set(-this.ocean.x+(reduced?0:t*2),-this.ocean.y+(reduced?0:t*.7));
    this.ocean.visible=true;
  }

  async prepareHomeWater() {
    if(this.waterFX)return;
    // These hidden roots also prevent pond/fountain surfaces leaking into a
    // Home arrival before all of its art has been uploaded.
    const water=new Container({label:'Home water'}),objects=new Container({label:'Home water objects'});
    objects.upright=true;
    water.visible=objects.visible=false;
    objects.zIndex=(this.props.find(p=>p.asset==='fountain-wishing')?.y??0)+.5;
    this.water.addChild(water);this.objects.addChild(objects);
    this.waterFX=await createWater({app:this.app,world,art,layer:water,objects,props:this.props,motion:this.motion});
    if(this.disposed){this.waterFX.dispose();return;}
    // Compensate each surface around its own pin, as when it was a direct
    // child of objects. Scaling the wrapper would move its world coordinates.
    for(const child of objects.children){child.scale.y/=TILT;child.upright=true;}
    const home=this.arts?.get('home');
    if(home){
      home.groups.push(water,objects);
      if(this.waterFX.active){
        for(const {sprite} of this.ripples??[])sprite.visible=false;
        this.ripples=[];
      }
      const fountain=this.props.find(p=>p.asset==='fountain-wishing');
      if(fountain){
        this.fountainWater=createFountainWater(fountain,this.objects,this.waterFX);
        home.groups.push(this.fountainWater.root);
      }
    }
  }


  createAmbient() {
    this.weather=createWeather(world,this.air);
    this.surf = createBeachSurf(this.water, shoreOf(world), HOME_MOUTHS);
    const rowingProp = this.props.find(prop => prop.asset === 'rowboat');
    this.rowboat = null;
    this.boats = this.room ? null : createMooredBoats(this.water, world.islets, {x: 2980, y: 2005}, {coast: world.coast});
    globalThis.__duckyBoats = this.boats?.count ?? 0;
    rowingProp?.sprite?.destroy?.(); rowingProp?.shadow?.destroy?.();
    this.props = this.props.filter(prop => prop !== rowingProp);
    this.ripples = [];
    (this.waterFX?.active ? [] : world.water).forEach((lake, index) => {
      for (let i = 0; i < 4; i++) {
        const phase = i * 2.399 + index;
        const ripple = new Graphics().moveTo(-21, 0).quadraticCurveTo(0, -6, 21, 0).stroke({width: 2, color: PALETTE.cream, alpha: .6, cap: 'round'});
        let k = 1;
        while (lake.poly && k > .3 && !inShape(lake.x + Math.cos(phase) * lake.rx * (.25 + i / 8) * k, lake.y + Math.sin(phase) * lake.ry * .7 * k, lake, -40)) k -= .1;
        ripple.position.set(lake.x + Math.cos(phase) * lake.rx * (.25 + i / 8) * k, lake.y + Math.sin(phase) * lake.ry * .7 * k);
        this.water.addChild(ripple);
        this.ripples.push({sprite: ripple, phase,x:ripple.x,y:ripple.y});
      }
    });
    this.birds=[[2419,1928],[3185,1897],[3427,2126],[1500,2600],[4200,1700],[3900,2900]].map(([x,y],phase)=>{const bird=createBird(phase);this.air.addChild(bird.root);return {...bird,x,y,phase};});
    this.crows = [
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
    const fountain = this.props.find(p => p.asset === 'fountain-wishing');
    this.fountainWater = fountain && this.waterFX ? createFountainWater(fountain, this.objects, this.waterFX) : null;
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
    const previousIsland=this.islandId;
    const landed=this.player?.mode==='walking'?isletWalks(id).find(w=>near(this.player,w.land,100))?.islet:null;
    const reframe=p=>landed?reframeIslet(previousIsland,id,landed,p):unplaceRigid(previousIsland,id,p);
    const hop=this.ready ? islandOffset(this.islandId,id) : null;
    this.islandId=id;
    this.archipelago?.setCurrent(id);
    const mapId=artOf(id);
    const previousArt=this.artShown;
    this.artShown=mapId;
    if(previousArt!==mapId)this.revealMap=null;
    this.ensureArt(mapId)?.then(()=>{
      if(this.disposed||this.artShown!==mapId||!this.artReady(mapId))return;
      this.showArt(mapId);
      if(previousArt!==mapId){
        if(previousArt==='home')this.releaseHomeArt();else this.freeArt(previousArt);
      }
      for(const other of this.arts.keys())if(other!=='home'&&other!==mapId)this.freeArt(other);
      this.destinationArt=null;
      if(mapId!=='home')this.releaseHomeArt();
    });
    this.showArt(mapId);
    this.arches=mapId === 'home' ? undefined : mapFor(mapId).world.arches ?? [];
    this.applyMapAmbience(mapId);
    setSailingHarbor(harborOf(id));
    this.stopInput();
    this.clearChat();
    this.markerUntil=0;
    for (const [key, entry] of this.liveRigs) {
      if (hop && entry.isPlayer) continue;
      entry.rig?.dispose(); entry.nameplate?.remove(); entry.seatMask?.destroy();
      this.liveRigs.delete(key);
    }
    const accent=islandFor(id).accent;
    for (const prop of this.props) if (/flower|flag|bunting/i.test(prop.asset || prop.name)) prop.sprite.tint=id==='home'?(prop.tint ?? 0xffffff):accent;
    this.travelView?.switchIsland(id, hop && reframe);
    this.landingView=null;
    delete this.camera.basis;
    if(this.sailingCamera)this.sailingCamera.active=false;
    if (hop) {
      for (const c of [this.camera, this.target]) Object.assign(c,reframe(c));
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
    Object.assign(this.target,{x:pier.x+pier.width/2,y:pier.y+pier.height/2,zoom:.65});
    this.follow=false; this.fitMode=false;
    this.canvas?.focus();
  }

  // zooming in draws the view in toward your own Duck, wherever it is on screen
  zoomTowardPlayer(prev,next) {
    const me=this.player;this.target.zoom=next;
    if(!me||this.globeOpen||!Number.isFinite(me.x+me.y))return;
    const k=1-prev/next;this.target.x+=(me.x-this.target.x)*k;this.target.y+=(me.y-60-this.target.y)*k;
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
      if(!this.gestures.pointers.size) {Object.assign(this.target,this.camera);this.target.zoom=clamp(this.target.zoom,this.zoomFloor(),this.zoomCeiling());this.zoomMotion.velocity=0;this.globeAim=null;}
      this.zoomAnchor=null;
      this.gestures.down(event.pointerId, point(event));
    });
    this.listen(this.canvas, 'pointermove', event => {
      if (!this.gestures.pointers.size && event.pointerType !== 'touch') {
        const over=Boolean(this.globeT > 0 && this.worldView?.pinAt(point(event)));
        if (over !== this.overPin) {this.overPin=over; this.canvas.style.cursor=over ? 'pointer' : ''; this.worldView?.hoverPin(over);}
      }
      const movement = this.gestures.move(event.pointerId, point(event));
      if (!movement) return;
      this.fly=null;
      if (movement.after.length > 1) {
        this.spin=null; this.globeAim=null;
        const span=ps=>Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y));
        if (this.zoomPastLimit(span(movement.after)/span(movement.before))) return;
        movePinch(this.target, movement.before, movement.after, this.zoomFloor(), this.zoomCeiling(), this.width, this.height);
      } else if (movement.drag) {
        const at=movement.after[0], grab=this.birdEye && this.worldView?.grab({x:at.x-movement.dx, y:at.y-movement.dy}, at, this.target, this.globeAim);
        let mx, my;
        if (grab) {
          this.globeAim=grab.aim; Object.assign(this.target, localPoint(this.islandId, grab.aim));
          mx=grab.dlon; my=grab.dlat;
        } else {
          mx=-movement.dx / this.camera.zoom; my=-movement.dy / (this.camera.zoom * TILT);
          const destination=this.birdEye ? this.target : this.camera;
          destination.x += mx; destination.y += my;
        }
        const now=performance.now(), gap=now-this.dragAt; this.dragAt=now;
        this.spin=grab ? {...sampleGlobeSpin(this.spin?.globe ? this.spin : null,mx,my,gap),globe:true} : sampleGlobeSpin(this.spin?.globe ? null : this.spin,mx,my,gap);
        if (grab) {
          const cap=2.09/1000, lat=lookOf(this.islandId,this.target).lat, v=Math.hypot(this.spin.x*Math.cos(lat),this.spin.y);
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
      markArtActivity();
      event.preventDefault();
      const p = point(event);
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      this.fly=null; this.spin=null; this.globeAim=null; this.quietAt=performance.now();
      if (this.zoomPastLimit(Math.exp(-delta * .0018))) return;
      const next=clamp(this.target.zoom * Math.exp(-delta * .0018), this.zoomFloor(), this.zoomCeiling());
      const stamp=performance.now();
      if(!this.zoomAnchor || stamp-this.zoomAnchor.at>180 || Math.hypot(p.x-this.zoomAnchor.x,p.y-this.zoomAnchor.y)>4) {
        this.zoomAnchor={...p,focus:this.globeT>0 && this.worldView?.worldAt?.(p)};
      }
      this.zoomAnchor.at=stamp;
      const focus=this.zoomAnchor.focus,prev=this.target.zoom;
      if (focus) zoomToWorldPoint(this.target,next,{x:focus[0],y:focus[1]});
      else if (next>prev) this.zoomTowardPlayer(prev,next);
      else zoomAt(this.target, next, p.x, this.height / 2 + (p.y - this.height / 2) / TILT, this.width, this.height);
      this.follow = false;this.fitMode=false;this.constrain(this.target);
    }, {passive: false});
    this.listen(window, 'keydown', event => {
      markArtActivity();
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT|BUTTON|^A$/.test(event.target?.tagName) || event.target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (this.globeOpen && ['escape','home','0','f'].includes(key)) {event.preventDefault(); this.closeGlobe(); return;}
      if (this.globeOpen && ['+','='].includes(key)) {event.preventDefault(); this.closeGlobe(); return;}
      if (this.globeBusy()) return;   // no walking, emotes or travel keys while the globe is up
      if (!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','q','e','1','2','3','4','5','6','7','m','f','home','0','+','=','-',' ','enter','shift'].includes(key)) return;
      event.preventDefault();
      this.keys.add(key);
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) this.trip=null;
      if (event.repeat) return;
      if (!['f','home','0','+','=','-'].includes(key)) this.audio.unlock();
      if (key === ' ') this.jump();
      if (key === 'enter') this.travelAction();
      if (key === 'q') this.triggerEmote(2);
      if (key === 'e') this.triggerEmote(3);
      if (/^[1-7]$/.test(key)) this.triggerEmote(key === '1' ? 2 : Number(key) + 2);
      if (key === 'm') this.audio.toggle();
      if (key === 'f' && this.player) {this.follow=true;this.fitMode=false;this.target.zoom=Math.max(.65,this.target.zoom);}
      if (key === 'home') {if (this.player) this.flyHome(); else this.fit();}
      if (key === '0') this.fit();
      if (['+','=','-'].includes(key)) {
        if (this.zoomPastLimit(key === '-' ? .8 : 1.25)) return;
        this.fly=null; {const prev=this.target.zoom,next=clamp(prev * (key === '-' ? .8 : 1.25), this.zoomFloor(), this.zoomCeiling()); if(next>prev)this.zoomTowardPlayer(prev,next); else this.target.zoom=next;}this.fitMode=false;this.follow=false;this.constrain(this.target);
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
    this.sim?.stopInput();
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

  screenPoint(p) {
    const {zoom,x,y} = this.camera;
    return {x:this.width / 2 + (p.x - x) * zoom, y:this.height / 2 + (p.y - y) * zoom};
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
    const play = this.player?.mode === 'sailing' ? ' WASD or arrows steer. Tap water to sail. Tap a nearby shore or press Enter to dock.' : ' Click to walk. WASD or arrows move. Space jumps. Q quacks, E dances, 1 to 7 emote, F follows.';
    const chat = this.chatLayer && this.player ? ' Press C to chat.' : '';
    this.canvas.setAttribute('aria-label', base + (this.room && !this.player ? '' : play) + chat);
  }

  travelOptions() {
    const me=this.player;
    if (!this.room || !me) return {};
    if (me.mode === 'sailing') return {dock:Boolean(dockingSpot(me))};
    const nav=this.room.navHere?.() ?? this.sim.nav;
    let best=null;
    for (const boat of this.room.boatPoses()) {
      if (boat.occupant || (boat.built && !this.room.ownBoats?.has(boat.id))) continue;
      const deck=boardingPoint(boat, nav), d=Math.hypot(deck.x-me.x, deck.y-me.y);
      if (d < 260 && (!best || d < best.d)) best={id:boat.id, d};
    }
    return best ? {take: best.id} : this.boatBuild?.options() ?? {};
  }
  // "Take me to …": walk to a boat, sail island to island (landing and re-boarding on the way, as a player would),
  // and dock at the target. Any movement key or tap hands control back. Returns a reason string when it cannot start.
  tripTo(target) {
    if (this.globeBusy()) return 'Close the globe first.';
    const me=this.player;
    if (!this.room || !me) return 'Your duck is still arriving.';
    if (this.interior?.active) return 'Step outside first.';
    if (this.islandId === target && me.mode === 'walking') return 'You are already here.';
    if (!nextIsland(this.islandId, target) && this.islandId !== target) return 'There is no way to sail there from here.';
    this.trip={target, leg:null, boarded:null, docked:false};
    this.follow=true; this.fitMode=false;
    return '';
  }
  stepTrip() {
    const trip=this.trip, me=this.player;
    if (!trip || !me || !this.room || this.arrival || this.globeBusy()) return;
    if (me.mode === 'walking') {
      if (this.islandId === trip.target) {this.trip=null; return;}
      if (trip.boarded === this.islandId) return;
      trip.boarded=this.islandId;
      if (!this.room.returnToBoat()) {this.trip=null; this.room.onNotice('No free boat here right now. Try again in a moment.');}
      return;
    }
    if (me.mode !== 'sailing') return;
    if (this.islandId === trip.target) {
      if (canDock(me)) {if (!trip.docked) {trip.docked=true; this.room.disembark();}}
      else if (trip.leg !== this.islandId && this.setDestination(harborOf(trip.target).water)) trip.leg=this.islandId;
      return;
    }
    if (trip.leg === this.islandId) {
      // the boat stopped short of the next island (a refused landing, a full island): hand control back once it
      // has stayed stopped for a moment (the target blinks empty between route waypoints)
      if (me.sailTarget) {trip.idleSince=null; return;}
      if ((trip.idleSince ??= performance.now()) >= performance.now() - 1500) return;
      // long legs can stop partway (the sea route is planned in pieces): re-send the leg while the boat still gains ground
      const moved=!trip.stoppedAt || Math.hypot(me.x-trip.stoppedAt.x, me.y-trip.stoppedAt.y) > 200;
      trip.stoppedAt={x:me.x, y:me.y}; trip.leg=null; trip.idleSince=null;
      if (!moved) this.trip=null;
      return;
    }
    const next=nextIsland(this.islandId, trip.target), route=destinationsFor(this.islandId).find(island => island.destination === next);
    if (route && this.setDestination(route.dock)) {trip.leg=this.islandId; trip.idleSince=null;}
  }

  travelAction() {
    if (this.globeBusy()) return;
    const options=this.travelOptions();
    if (options.take) {this.room.board(options.take); this.follow=true; this.fitMode=false;}
    else if (options.dock) this.dock();
    else if (options.collect) this.boatBuild.collect();
    else if (options.build) this.boatBuild.build();
  }

  dock(target) {
    this.keys.clear();
    this.touchInput={x:0,y:0};
    this.room.disembark(target);
  }

  telescopeOptions() {
    const me=this.player;
    if (!me || me.mode === 'sailing' || this.interior?.active) return {};
    const props=this.artProps(this.artShown), spot=telescopeNear(props, me);
    return spot ? {telescope:spot.id, at:Boolean(telescopePeerAt(props, me))} : {};
  }
  telescopeAction() {
    if (this.globeBusy()) return false;
    const me=this.player, props=this.artProps(this.artShown), spot=me && me.mode !== 'sailing' ? telescopeNear(props, me) : null;
    if (!spot) return false;
    if (!telescopePeerAt(props, me)) this.setDestination(spot);
    this.follow=true; this.fitMode=false;
    return true;
  }

  tap(point) {
    this.trip=null;
    if (this.interior?.active) {this.interior.tap(point); return;}
    if (this.globeT > 0 && this.worldView?.pinAt(point)) {if (this.globeOpen) this.closeGlobe(); else if (!this.globeBusy()) this.flyHome(); return;}
    if (this.globeBusy()) return;   // the globe is a view only: taps never walk, board or sail the hidden Ducky
    const p = screenToWorld(this.camera, point, this.width, this.height);
    if (this.room && this.player) {
      if (this.player.mode === 'sailing') {
        const destination=destinationsFor(this.islandId).find(island => Math.abs(p.x-island.x)<mapFor(island.map).width*.42 && Math.abs(p.y-island.y)<mapFor(island.map).height*.4);
        const harbor=harborOf(this.islandId);
        const islet=isletWalks(this.islandId).find(w => w.nav.walkable(p.x,p.y) || near(p,w.land,160));
        if (dockingSpot(this.player,p)) this.dock(p);
        else if ((near(p,harbor.water,140) || near(p,harbor.land,120)) && canDock(this.player)) this.dock();
        else if (destination) this.setDestination(destination.dock);
        else if (islet) this.setDestination(islet.water);
        else this.setDestination(p);
        return;
      }
      const boat=this.room.boatPoses().find(boat => near(p,{x:boat.x,y:boat.y-45},100));
      if (boat) {this.room.board(boat.id); this.follow=true; this.fitMode=false; return;}
    }
    if (this.artShown === 'home') this.waterFX?.splash(p.x, p.y, .65, 24);
    const hitRadius=Math.max(65,20/this.camera.zoom), me = this.player;
    const onMe = me && me.action !== 7 && Math.hypot(p.x - me.x, p.y - (me.y - 50)) < hitRadius;
    const napper = !onMe && this.sleepersShown().map(s => s.rig).find(rig => rig.root.visible && rig.sleeper && (b => point.x > b.x - 8 && point.x < b.x + b.width + 8 && point.y > b.y - 8 && point.y < b.y + b.height + 8)(rig.sleeper.bounds()));
    if (napper) {napper.sleeper.poke(); return;}
    if (!this.player) return;
    const here = this.artShown === 'home' ? this.localDucks : this.localDucks.filter(duck => duck.player);
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

  finishArrival() {
    if (!this.arrival) return;
    this.onArrival(this.arrival.name);
    this.arrival = null;
  }

  arrivalLift(now) {
    if (!this.arrival || this.motion.matches) return 0;
    const t = Math.min(1,(now - (this.arrival.start ?? now)) / 520);
    return 220 * (1 - t * t);
  }

  setDestination(point) {
    if (this.arrival) return false;
    const destination = this.room ? this.room.destination(point.x, point.y) : this.sim.destination(point.x, point.y);
    if (destination) {
      this.marker.position.set(...destination);
      this.markerUntil = this.sim.time + 1.5;
      this.audio.play('pop', .045);
    }
    return destination;
  }

  jump() {
    if (this.arrival) return false;
    if (this.interior?.active) return this.interior.jump();
    return this.room ? this.room.jump() : startJump(this.sim?.player);
  }

  triggerEmote(action) {
    if (this.arrival) return;
    if (this.room) {
      if (!this.room.emote(action)) return;
    } else {
      this.sim.emote(action);
      if (this.player.action === action) this.player.turn = 0;
    }
    this.audio.unlock().then(() => this.audio.play(action === 2 ? 'quack' : 'pop', action === 2 ? .12 : .06));
  }

  constrain(camera) {
    if (this.archipelago) {
      constrainExploreCamera(camera,this.archipelago.bounds);
      if (this.globeOpen || this.player?.mode === 'sailing') return;
      // walking view: keep the camera over your own island so zooming out frames it, never a neighbour. A Duck on
      // an islet stands outside that island's box, so the box grows to take the Duck in (pad: a little sea round it).
      const m=this.mapHere(), me=this.player, pad=1200, zoom=Math.max(camera.zoom,1e-6);
      let x0=m.cx-m.width/2,x1=m.cx+m.width/2,y0=m.cy-m.height/2,y1=m.cy+m.height/2;
      if(me&&Number.isFinite(me.x+me.y)){x0=Math.min(x0,me.x-pad);x1=Math.max(x1,me.x+pad);y0=Math.min(y0,me.y-pad);y1=Math.max(y1,me.y+pad);}
      const rx=Math.max(0,(x1-x0)/2-this.width/(2*zoom)), ry=Math.max(0,(y1-y0)/2-this.height/(2*zoom*TILT));
      camera.x=clamp(camera.x,(x0+x1)/2-rx,(x0+x1)/2+rx); camera.y=clamp(camera.y,(y0+y1)/2-ry,(y0+y1)/2+ry);
      return;
    }
    const bounds=this.room?seaBoundsFor(this.islandId):{x0:HOME_ORIGIN.x+100,y0:HOME_ORIGIN.y+100,x1:HOME_ORIGIN.x+world.width-100,y1:HOME_ORIGIN.y+world.height-100};
    camera.x=clamp(camera.x,bounds.x0,bounds.x1);camera.y=clamp(camera.y,bounds.y0,bounds.y1);
  }

  transientForCopies() {
    return [...this.rigs.filter((r,i) => this.localDucks[i]?.player).map(r => r.root), ...[...this.liveRigs.values()].map(e => e.rig?.root),
      this.marker, ...(this.travelView?.transient() ?? [])].filter(o => o?.visible);
  }
  artProps(mapId) {return mapId === 'home' ? this.props : this.arts?.get(mapId)?.props ?? [];}
  sleeperRigs() {return this.rigs.filter((r,i) => !this.localDucks[i]?.player);}
  showArt(mapId) {
    if (!this.arts) return;
    for (const [id, art] of this.arts) {
      if (!art.ready) continue;
      const on=id === mapId && this.revealArtReady(id);
      for (const g of art.groups) g.visible=on;
      for (const e of art.kites?.entries ?? []) e.root.visible=on && this.globeT < .97;
      if (!on) for (const p of this.artProps(id)) {p.sprite.visible=false; if (p.shadow) p.shadow.visible=false;}
    }
    if (mapId !== 'home') {for (const r of this.sleeperRigs()) r.root.visible=false; for (const f of this.floating ?? []) f.sprite.visible=false;}
    for (const [id, set] of this.mapSleepers) if (id !== mapId) for (const {rig} of set) rig.root.visible=false;
    if (mapId !== 'snow' && this.artShown !== 'snow') {
      for (const rig of this.rigs ?? []) rig.clearSnow?.();
      for (const {rig} of this.liveRigs?.values() ?? []) rig?.clearSnow?.();
      for (const list of this.mapSleepers.values()) for (const {rig} of list) rig.clearSnow?.();
    }
    this.travelView?.showJetty(mapId);
  }
  mapHere() {return mapFor(this.artShown ?? 'home');}
  applyMapAmbience(mapId) {
    const map=mapFor(mapId), spots=ambientOf(map);
    this.weather?.setMap?.(map.home ? null : map);
    (this.birds ?? []).forEach((bird, i) => {const p=spots.birds[i % spots.birds.length]; bird.x=p[0]; bird.y=p[1];});
    (this.butterflies ?? []).forEach((b, i) => {const p=spots.butterflies[i % spots.butterflies.length]; b.x=p[0]; b.y=p[1];});
    if (this.width) this.minZoom=fitZoom(this.width, this.height, map.width, map.height);
  }
  buildMapAmbience(mapId, art) {
    const map=mapFor(mapId), extra=[];
    const surf=createBeachSurf(this.water, shoreOf(map.world), map.world.riverMouths ?? []); extra.push(...surf.crests);
    const ripples=[];
    (map.world.water ?? []).forEach((lake, index) => {
      for (let i=0;i<4;i++) {
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
    if (art.pondDuckies) this.scene.addChildAt(art.pondDuckies.root,this.scene.getChildIndex(this.decks));
    if (art.floatLayer) this.scene.addChildAt(art.floatLayer, this.scene.getChildIndex(this.floatLayer)+1);
    art.groups.push(...extra);
    for (const o of extra) o.visible=false;
    art.ambience={surf, ripples, leaves, floats: art.floating ?? []};
    const destroy = art.destroy.bind(art);
    art.destroy = () => {
      for (const object of extra) if (!object.destroyed) object.destroy({children: true});
      destroy();
    };
  }
  async makeSleepers(mapId,{cancelled=()=>this.disposed}={}) {
    const beds=mapFor(mapId).sleepers ?? [];
    if (!beds.length || this.mapSleepers.has(mapId)) return;
    this.mapSleepers.set(mapId, []);
    let salt=0; for (const c of mapId) salt=(salt*31+c.charCodeAt(0)) % 997;
    const ducks=beds.map((b, i) => ({id: 1000+i, x: b.x, y: b.y, previousX: b.x, previousY: b.y, sleeping: true, action: 7, turn: 0, travel: 0, emoteVersion: 0, jumpLeft: 0,
      sleep: {pose: b.pose, flip: b.flip}, footprint: sleeperFootprint(b), outfit: {cap: 1+i%13, shades: i%4===0 ? 1+i%3 : 0, acc: 0, shoes: 1+i%10}}));
    const results=await mapArtInFrames(ducks,async d => {
      try{return {status:'fulfilled',value:await createDuck({outfit:d.outfit,seed:d.id+21+salt,isPlayer:false,sleep:d.sleep})};}
      catch(reason){return {status:'rejected',reason};}
    },{batchSize:2,cancelled});
    const set=results.map((r, i) => r.status === 'fulfilled' ? {duck: ducks[i], rig: r.value} : null).filter(Boolean);
    if (cancelled()) {set.forEach(({rig}) => rig.dispose());this.mapSleepers.delete(mapId);return;}
    for (const {duck, rig} of set) {rig.root.scale.set(.88 * .24 * 3); rig.root.position.set(duck.x, duck.y); rig.root.zIndex=duck.y; rig.root.visible=false; this.objects.addChild(rig.root);}
    this.mapSleepers.set(mapId, set);
    globalThis.__duckyMapSleepers = Object.fromEntries([...this.mapSleepers].map(([id, list]) => [id, list.map(({duck}) => ({pose: duck.sleep.pose, flip: duck.sleep.flip, x: duck.x, y: duck.y}))]));
  }
  sleepersShown() {
    if (this.artShown === 'home' || !this.artShown) return this.rigs.map((rig, i) => ({duck: this.localDucks[i], rig})).filter(({duck}) => duck?.sleeping);
    return this.mapSleepers.get(this.artShown) ?? [];
  }
  bumpSleeper(duck, rig, player) {
    if (!(duck.sleeping && duck.footprint && player && rig.sleeper)) return;
    const f=duck.footprint, ex=(player.x-f.x)/(f.rx+26), ey=(player.y-f.y)/(f.ry+26);
    if (ex*ex+ey*ey >= 1) {duck.bumped=false;return;}
    if (duck.bumped || player.path?.length) return;
    const last=this.bumpFrom || player, mx=player.x-last.x, my=player.y-last.y, ml=Math.hypot(mx, my), tx=f.x-player.x, ty=f.y-player.y;
    const into=ml > .05 && (mx*tx+my*ty)/(ml*(Math.hypot(tx, ty) || 1)) > .55;
    if (into) {
      duck.bumped=true;
      if (rig.sleeper.poke()) this.playerRig()?.stumble?.({x: player.x-f.x, y: (player.y-f.y)*TILT});
    }
  }
  ensureArt(mapId) {
    if (!this.arts || this.disposed) return;
    if(mapId==='home')return this.ensureHomeArt();
    const existing=this.arts.get(mapId);
    if(existing?.discarded)return existing.preparation.then(()=>this.ensureArt(mapId));
    if(existing)return existing.preparation??Promise.resolve(existing);
    const map=mapFor(mapId);
    if (!map.art) return;
    const pending={id:mapId,ready:false};this.arts.set(mapId,pending);
    let pendingArt;
    pending.preparation=loadThemeArt(map, {acquire, release, groundPool:this.groundPool, tilt:TILT,prepare:true,dpr:this.app.renderer.resolution,defaultZoom:walkingZoom(this.width,this.height)}).then(async art => {
      pendingArt = art;
      if (this.disposed||pending.discarded) {art.destroy(); return;}
      this.ground.addChild(art.ground); this.decks.addChild(art.decks); this.contactShadows.addChild(art.shadows); this.overDecks.addChild(art.overLayer);
      if (art.kiteLayer) {
        this.objects.addChild(art.kiteLayer);
        for (const {root} of art.kites.entries) {root.visible=false;this.objects.addChild(root); art.groups.push(root);}
      }
      for (const p of art.props) {p.sprite.visible=false;(p.deck ? this.decks : this.objects).addChild(p.sprite);}
      art.icelandLife?.current?.mount(this.objects);
      await attachCentreMotion(art, this.objects);
      if (this.disposed||pending.discarded) {art.destroy(); return;}
      await this.plantReactions.register(mapId,art.props,map.walk.obstacles,map.art.slice(0,map.art.lastIndexOf('/')+1));
      this.buildMapAmbience(mapId, art);
      await this.makeSleepers(mapId,{cancelled:()=>this.disposed||pending.discarded});
      if (this.disposed||pending.discarded) {art.destroy();return;}
      const roots=[...art.groups,...art.props.map(p=>p.sprite),...(this.mapSleepers.get(mapId)??[]).map(s=>s.rig.root)];
      await uploadIsland(this.app.renderer,roots,{requiredRoots:roots,sources:this.plantReactions.sources(),cancelled:()=>this.disposed||pending.discarded});
      if(this.disposed||pending.discarded){art.destroy();return;}
      art.ready=true;
      this.arts.set(mapId, art);
      this.scene.addChildAt(art.pondDuckies.root,this.scene.getChildIndex(this.decks));
      this.showArt(this.artShown);
      globalThis.__duckyThemeArt = [...this.arts.values()].filter(a => a.ready).map(a => a.id);
    }).catch(error => {
      this.plantReactions?.unregister(mapId);
      pendingArt?.destroy();
      for (const {rig} of this.mapSleepers.get(mapId) ?? []) rig.dispose();
      this.mapSleepers.delete(mapId);
      if (this.disposed||pending.discarded) return;
      console.warn(`theme ${mapId}: art did not load`, error);
      this.arts.set(mapId, {id: mapId, ready: false, failed: true});
    }).finally(()=>{if(pending.discarded&&this.arts.get(mapId)===pending)this.arts.delete(mapId);});
    return pending.preparation;
  }
  homeTextureNodes() {
    const nodes=new Set();
    const visit=node=>{if(node.texture)nodes.add(node);for(const child of node.children??[])visit(child);};
    for(const root of [...this.arts.get('home').groups,...this.props.map(p=>p.sprite),
      ...this.homeKites.entries.map(e=>e.root),...(this.bridgeOver??[]).map(e=>e.sprite)])visit(root);
    return [...nodes];
  }
  releaseHomeArt() {
    if(!this.homePrepared)return;
    this.homePrepared=false;
    this.arts.get('home').ready=false;
    const leases=new Map();
    for(const src of this.homeSources??[]) {
      const held=textureLeases.get(src);if(!held)continue;
      if(!leases.has(src))leases.set(src,{src,resolution:held.resolution,count:0,promise:held.promise});
      leases.get(src).count++;
    }
    const nodes=this.homeTextureNodes();
    this.homeRestore=Promise.all([...leases.values()].map(async lease=>{
      const texture=await lease.promise;
      lease.nodes=nodes.filter(node=>node.texture===texture).map(node=>({node,width:node.width,height:node.height}));
      for(const {node} of lease.nodes)node.texture=Texture.EMPTY;
      for(let i=0;i<lease.count;i++){release(lease.src);this.loaded.splice(this.loaded.indexOf(lease.src),1);}
      return lease;
    }));
    this.homeGroundStream.destroy();
    this.releasePondDuckies('home');
  }
  async prepareHomeDucks() {
    if(!this.homeDucks||this.localDucks.length===this.homeDucks.length)return;
    const previous=new Map(this.localDucks.map((duck,i)=>[duck,this.rigs[i]]));
    const created=[];let rigs;
    try{
      rigs=await mapArtInFrames(this.homeDucks,async duck=>{
        if(previous.has(duck))return previous.get(duck);
        const rig=await createDuck({outfit:duck.outfit,seed:duck.id+21,isPlayer:duck.player,sleep:duck.sleep});
        created.push(rig);return rig;
      },{batchSize:2,cancelled:()=>this.disposed});
    }catch(error){created.forEach(rig=>rig.dispose());throw error;}
    if(this.disposed){created.forEach(rig=>rig.dispose());return;}
    this.localDucks=this.homeDucks;this.rigs=rigs;
    for(let i=0;i<rigs.length;i++){
      const root=rigs[i].root,duck=this.localDucks[i];
      if(previous.has(duck))continue;
      root.scale.set(.88*.24*3);root.position.set(duck.x,duck.y);root.visible=false;
      this.objects.addChild(root);
    }
  }

  ensureHomeArt() {
    if(this.homePrepared)return Promise.resolve();
    if(this.homePreparing)return this.homePreparing;
    if(!this.homeRestore)return Promise.resolve();
    this.homePreparing=(async()=>{
      const leases=await this.homeRestore;
      await Promise.all(leases.map(async lease=>{
        const requests=Array.from({length:lease.count},()=>{this.loaded.push(lease.src);return acquire(lease.src,lease.resolution);});
        const [texture]=await Promise.all(requests);
        if(this.disposed)return;
        for(const {node,width,height} of lease.nodes)if(!node.destroyed){node.texture=texture;node.width=width;node.height=height;}
      }));
      if(this.disposed)return;
      this.homeSources=leases.flatMap(lease=>Array(lease.count).fill(lease.src));
      this.homeGroundStream=this.groundPool.create(HOME_TILES,this.homeGround);
      await this.homeGroundStream.prepare({dpr:this.app.renderer.resolution,resolutions:this.homeArtPlan?.resolutions});
      await this.prepareHomeWater();
      await this.prepareHomeDucks();
      if(this.disposed)return;
      await this.plantReactions?.register('home',this.props,this.homePlantObstacles);
      const home=this.arts.get('home');
      home.pondDuckies=await loadPondDuckies('home',{tilt:TILT,acquire,release});home.groups.push(home.pondDuckies.root);
      this.scene.addChildAt(home.pondDuckies.root,this.scene.getChildIndex(this.decks));
      await this.uploadHomeArt();
      if(this.artShown!=='home'&&this.destinationArt!=='home')this.releaseHomeArt();
      this.showArt(this.artShown);
    })().catch(error=>console.warn('Home preparation',error)).finally(()=>{this.homePreparing=null;});
    return this.homePreparing;
  }
  async uploadHomeArt() {
    // Both initial Home and a deferred/restored Home use the same final gate.
    await this.homeGroundStream.prepare({dpr:this.app.renderer.resolution,resolutions:this.homeArtPlan?.resolutions});
    await this.plantReactions?.prepared();
    const roots=this.homeTextureNodes();
    await uploadIsland(this.app.renderer,[this.scene],{requiredRoots:roots,cancelled:()=>this.disposed});
    this.arts.get('home').ready=true;
    this.homePrepared=true;
  }
  releasePondDuckies(id) {
    const art=this.arts?.get(id);if(!art?.pondDuckies)return;
    const root=art.pondDuckies.root,k=art.groups.indexOf(root);
    if(k>=0)art.groups.splice(k,1);
    art.pondDuckies.destroy();art.pondDuckies=null;
    if(id==='home')this.homePondDuckies=null;
  }
  freeArt(id) {
    if(id==='home'){this.releaseHomeArt();return;}
    const art=this.arts?.get(id);if(!art)return;
    if(!art.ready){art.discarded=true;return;}
    this.plantReactions?.unregister(id);
    for (const {rig} of this.mapSleepers.get(id) ?? []) rig.dispose();
    this.mapSleepers.delete(id);
    art.destroy();
    this.arts.delete(id);
    this.prewarmed?.delete(id);
  }
  artReady(mapId) {return mapId === 'home' ? this.homePrepared : Boolean(this.arts?.get(mapId)?.ready);}
  revealArtReady(mapId) {return this.startupPrepared!==false&&this.artReady(mapId);}

  liveCopies() {
    // Destination preparation starts at departure, independently of camera zoom.
    // Walking uses only the already prepared current island.
    return [];
  }

  copyVisitors(copies) {
    if (!copies.length) return [];
    return this.transientForCopies().map(o => ({o, copy:copyHolding(o.x, o.y, copies, 300, this.mapHere())})).filter(v => v.copy);
  }

  renderLiveCopies(target, copies, visitors=[]) {
    this.livePatches?.retain(new Set(copies.map(i=>i.id)));
    if (!copies.length) return;
    this.livePatches??=createLivePatches(this.app.renderer);
    const transient=this.transientForCopies();
    const hide=[this.archipelago.root, this.ocean, ...(this.isletView?.transient()??[]), ...transient].filter(o => o?.visible);
    hide.forEach(o => {o.visible=false;});
    const sets=[...new Set([this.artShown, ...copies.map(i => i.map)])];
    const props=sets.flatMap(id => this.artProps(id)).map(p => [p, p.sprite.visible, p.shadow?.visible]);
    const sleepers=this.sleeperRigs().map(r => [r.root, r.root.visible]);
    const floats=(this.floating ?? []).map(f => [f.sprite, f.sprite.visible]);
    const naps=sets.flatMap(id => this.mapSleepers.get(id) ?? []).map(({rig}) => [rig.root, rig.root.visible]);
    const sceneVisible=this.scene.visible; this.scene.visible=true;
    const z=this.camera.zoom;
    const span=cameraSpan(this.camera,this.width,this.height),hw=span.width/(2*z), hh=span.height/(2*z*TILT);
    const cull=(mapId,id)=>{
      const camera=unplaceRigid(this.islandId,id,this.camera);
      const on=(x,y,pad)=>Math.abs(x-camera.x)<hw+pad*2&&Math.abs(y-camera.y)<hh+pad*2;
      for(const p of this.artProps(mapId)){p.sprite.visible=on(p.x,p.y,Math.max(p.width,p.height)*p.scale+350);if(p.shadow)p.shadow.visible=p.sprite.visible;}
      if(mapId==='home'){for(const [root]of sleepers)root.visible=on(root.x,root.y,200);for(const [sprite]of floats)sprite.visible=on(sprite.x,sprite.y,100);}
      else for(const {rig}of this.mapSleepers.get(mapId)??[])rig.root.visible=on(rig.root.x,rig.root.y,200);
    };
    for (const island of copies) {
      const mine=visitors.filter(v => v.copy === island).map(v => v.o);
      withRigidVisitors(this.islandId,island.id,mine,()=>{
        this.showArt(island.map);cull(island.map,island.id);
        this.livePatches.draw(this.islandId,island.id,this.scene,this.camera,this.width,this.height,TILT,target);
      });
    }
    this.scene.visible=sceneVisible;
    this.showArt(this.artShown);
    hide.forEach(o => {o.visible=true;});
    for (const [p,v,sh] of props) {p.sprite.visible=v; if (p.shadow) p.shadow.visible=sh;}
    for (const [root,v] of sleepers) root.visible=v;
    for (const [sprite,v] of floats) sprite.visible=v;
    for (const [root,v] of naps) root.visible=v;
  }

  rigidReadback() {
    if (this.globeT > .001) return this.worldView?.stickers ?? [];
    const m=cameraMatrix(this.camera,this.width,this.height,TILT),out=[];
    const push=(kind,id,r,scale=1)=>out.push({kind,id,a:(m.a*r.a+m.c*r.b)*scale,b:(m.b*r.a+m.d*r.b)*scale,c:(m.a*r.c+m.c*r.d)*scale,d:(m.b*r.c+m.d*r.d)*scale,x:m.a*r.x+m.c*r.y+m.tx,y:m.b*r.x+m.d*r.y+m.ty});
    for (const island of WORLD_ISLANDS) push('island',island.id,flatRigid(this.islandId,island.id));
    (this.isletView?.placed ?? []).forEach((r,k) => {if (this.isletView.layer.children[k]?.visible) push('islet',`islet-${k}`,{a:r.cos,b:r.sin,c:-r.sin,d:r.cos,x:r.x,y:r.y});});
    return out;
  }

  birdZoom() {const b=this.archipelago.bounds; return .43*this.height*2*Math.PI/(b.x1-b.x0);}
  // Zooming out stops at your own island framed in sea; the globe opens only from the globe button, and while it is
  // open you cannot zoom back down onto an island (you sail there instead).
  zoomFloor() {return this.archipelago && this.globeOpen ? this.birdZoom() : this.minZoom*(this.archipelago ? .97 : .8);}
  // Walking on your own island with the globe shut: only this island is drawn. Neighbours, their live art and
  // their globe previews come back for the globe, a fly home, a landing or sailing.
  walkSolo() {
    return !!this.archipelago && !this.globeOpen && !((this.globeT ?? 0) > .001) && !this.fly && !this.landingView && this.player?.mode !== 'sailing';
  }
  zoomCeiling() {
    if (!this.archipelago || !this.globeOpen) return 1.8;
    const top=this.minZoom*.95;
    // stay a whole globe (t >= .97): below that the live world would have to be drawn into it
    return Math.exp(Math.log(top)+.97*(Math.log(this.birdZoom())-Math.log(top)));
  }
  ensureWorldArt() {
    if(this.worldArtPending)return this.worldArtPending;
    this.worldArtPending=(async()=>{
      await nextArtFrame();
      if(this.disposed)return;
      await this.archipelago.loadPreviews((src)=>{this.loaded.push(src);return acquire(src);});
      if(this.disposed)return;
      this.pirateFleet=createPirateFleet();
      this.pirateView=await createPirateView(this.objects,this.pirateFleet);
      if(this.disposed){this.pirateView.destroy();return;}
      this.cleanups.push(()=>this.pirateView.destroy());
      this.isletView=await createIsletView(this.app,this.scene,this.objects);
      if(this.disposed){this.isletView.destroy();return;}
      this.scene.setChildIndex(this.isletView.layer,this.scene.getChildIndex(this.water)+1);
      {
        this.loaded.push(CLOUD_TEXTURE);
        const clouds=await acquire(CLOUD_TEXTURE);
        if(this.disposed)return;
        clouds.source.style.addressModeU='repeat';clouds.source.style.maxAnisotropy=4;clouds.source.style.update();
        this.worldView=createWorldView(this.app,this.scene,this.isletView,clouds);
        // The globe shader warms when the globe is first opened.
      }
      await uploadIsland(this.app.renderer,[this.scene,...this.isletView.transient()],{cancelled:()=>this.disposed});
      this.worldArtReady=true;
    })();
    this.worldArtPending.catch(error=>{if(!this.disposed)console.warn('World artwork failed',error);});
    return this.worldArtPending;
  }

  // The globe is a separate, generic view built from the premade island art, reached only from the globe button.
  // For now it cuts straight in and out (the zoom transition comes later).
  globeBusy() {return Boolean(this.globeOpen||this.globeRequested);}
  openGlobe() {
    if(!this.worldView||(this.worldArtPending&&!this.worldArtReady)){
      if(!this.disposed&&this.archipelago&&!this.globeRequested){
        this.globeRequested=true;this.stopInput();
        this.ensureWorldArt().then(()=>{this.globeRequested=false;if(!this.disposed)this.openGlobe();},()=>{this.globeRequested=false;});
      }
      return false;
    }
    if (!this.archipelago || this.globeOpen || this.interior?.active) return false;
    const m=this.mapHere();
    this.globeReturn={zoom:this.camera.zoom};
    this.fly=null; this.spin=null; this.follow=false; this.fitMode=false; this.zoomAnchor=null; this.globeAim=null;
    this.stopInput(); this.trip=null; this.zoomMotion.velocity=0;
    this.globeOpen=true; this.quietAt=performance.now();
    Object.assign(this.camera,{x:m.cx,y:m.cy,zoom:this.birdZoom()}); Object.assign(this.target,this.camera);
    this.onGlobeChange?.(true);
    return true;
  }
  closeGlobe() {
    if (!this.globeOpen) return false;
    this.globeOpen=false; this.landOnPlayer(this.globeReturn?.zoom); this.onGlobeChange?.(false);
    return true;
  }
  // Keep zooming past a limit to cut between views: out past your island opens the globe, in past the globe's
  // limit returns to your Ducky. About four wheel notches (or a pinch of the same size) past the limit.
  zoomPastLimit(factor) {
    const now=performance.now();
    if (now-(this.pastLimitAt ?? 0)>500) this.pastLimit=0;
    this.pastLimitAt=now;
    const out=factor<1;
    const atFloor=!this.globeOpen && out && this.target.zoom<=this.zoomFloor()*1.001;
    const atCeiling=this.globeOpen && !out && this.target.zoom>=this.zoomCeiling()*.999;
    if (!atFloor && !atCeiling) {this.pastLimit=0; return false;}
    this.pastLimit=(this.pastLimit ?? 0)+Math.abs(Math.log(factor));
    if (this.pastLimit<.7) return false;
    this.pastLimit=0;
    return atFloor ? this.openGlobe() : this.closeGlobe();
  }
  landOnPlayer(zoom) {
    delete this.camera.basis;
    this.globeAim=null; this.spin=null; this.zoomAnchor=null; this.fly=null; this.zoomMotion.velocity=0;
    const me=this.room?.view() ?? this.player;
    if (me) {
      const z=clamp(zoom ?? Math.min(this.width/1500, this.height/1000), this.zoomFloor(), 1.8);
      Object.assign(this.camera,{x:me.x,y:me.y-90,zoom:z}); Object.assign(this.target,this.camera); this.follow=true; this.fitMode=false;
    } else {this.fit(); Object.assign(this.camera,this.target);}
  }




  flyHome() {
    const me=this.room?.view() ?? this.player;
    if (!me) {this.fit(); return;}
    Object.assign(this.camera,localPoint(this.islandId,spherePoint(this.islandId,this.camera)));
    const zoom=Math.max(this.minZoom*1.05, Math.min(this.width/1500, this.height/1000));
    this.spin=null; this.follow=false; this.fitMode=false;
    this.fly={at:performance.now(), ms:this.motion.matches ? 0 : 700, x0:this.camera.x, y0:this.camera.y, z0:this.camera.zoom, zoom};
    if (this.overPin) {this.overPin=false; this.canvas.style.cursor=''; this.worldView?.hoverPin(false);}
  }
  stepFly(now, player) {
    const f=this.fly, s=f.ms ? Math.min(1, Math.max(0, (now-f.at)/f.ms)) : 1, me=this.room?.view() ?? player;
    if (!me) {this.fly=null; return;}
    const io=s < .5 ? 4*s*s*s : 1-Math.pow(-2*s+2, 3)/2, pos=1-Math.pow(1-Math.min(1, s/.8), 3);
    this.camera.zoom=Math.exp(Math.log(f.z0)+(Math.log(f.zoom)-Math.log(f.z0))*io);
    this.camera.x=f.x0+(me.x-f.x0)*pos; this.camera.y=f.y0+(me.y-90-f.y0)*pos;
    Object.assign(this.target, this.camera); this.quietAt=performance.now();
    if (s >= 1) {this.fly=null; this.follow=true;}
  }

  fit() {
    this.fly=null; this.follow = false;this.fitMode=true;
    const m=this.mapHere();
    Object.assign(this.target, {x: m.cx, y: m.cy, zoom: this.minZoom});
  }

  resize(initial = false) {
    if (!this.initialized || this.disposed) return;
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    this.app.renderer.resize(this.width, this.height);
    const here = this.mapHere();
    this.minZoom = fitZoom(this.width, this.height, here.width, here.height);
    if (initial) {
      this.camera.zoom = Math.min(this.width / 1500, this.height / 1000);
      const cam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number);
      if (cam?.length === 3 && cam.every(Number.isFinite)) Object.assign(this.camera, {x: cam[0], y: cam[1], zoom: cam[2]});
      Object.assign(this.target, this.camera);
    } else if(this.fitMode){this.fit();Object.assign(this.camera,this.target);}
    else if(this.archipelago){
      // a new window size moves the zoom limits: keep the walking view on its island and the globe a globe
      for(const c of [this.camera,this.target])c.zoom=clamp(c.zoom,this.zoomFloor(),this.zoomCeiling());
      this.constrain(this.camera);this.constrain(this.target);
    }
  }

  ensureInterior() {
    if (this.interior || this.interiorPending || this.interiorFailed || this.disposed) return;
    this.interiorPending = nextArtFrame().then(()=>createInterior()).then(async interior => {
      try {await uploadIsland(this.app.renderer,[interior.root],{cancelled:()=>this.disposed});}
      catch(error){interior.root.destroy({children:true});throw error;}
      if (this.disposed) {interior.root.destroy({children: true}); return;}
      this.interior = interior;
      this.app.stage.addChild(interior.root);
    }).catch(error => {
      this.interiorFailed = true;
      if (!this.disposed) console.warn('Museum interior did not load', error);
    }).finally(() => {this.interiorPending = null;});
  }

  playerView() {
    if (this.room) return this.room.view();
    const player = this.player;
    if (!player) return null;
    const alpha = this.accumulator * 60;
    return {
      x: player.previousX + (player.x - player.previousX) * alpha,
      y: player.previousY + (player.y - player.previousY) * alpha,
    };
  }

  tick(now,{forceRender=false}={}) {
    if (this.disposed || (document.hidden&&!forceRender)) return;
    const elapsed = Math.max(0, now - this.lastFrame);
    const dt = Math.min(.1, elapsed / 1000);
    this.frameTimes.push(elapsed);
    if (this.frameTimes.length > 180) this.frameTimes.shift();
    this.lastFrame = now;
    this.frame++;
    this.accumulator += dt;
    if (this.room && this.room.islandId !== this.islandId) this.switchIsland(this.room.islandId);
    if (this.room && this.room.mode !== this.travelMode) {
      this.travelMode=this.room.mode; this.stopInput(); this.updateControlLabel();
      this.follow=Boolean(this.player); this.fitMode=false;
    }
    this.stepTrip();
    const actor = this.player;
    if(actor?.mode==='sailing') {
      const target=actor.sailRoute?.at(-1)??actor.sailTarget??{x:actor.x-Math.sin(actor.turn??0)*4000,y:actor.y-Math.cos(actor.turn??0)*4000};
      const routes=destinationsFor(this.islandId);
      const next=target?routes.reduce((best,r)=>!best||Math.hypot(r.dock.x-target.x,r.dock.y-target.y)<Math.hypot(best.dock.x-target.x,best.dock.y-target.y)?r:best,null):null;
      if(next){
        const mapId=artOf(next.destination);
        if(this.destinationArt&&this.destinationArt!==mapId&&this.destinationArt!==this.artShown)this.freeArt(this.destinationArt);
        this.destinationArt=mapId;this.ensureArt(mapId);
      }
    }
    const arrivalName = this.room ? this.room.arrival : this.offlineArrival;
    if (actor && actor.id !== this.focusedActor) {
      this.focusedActor = actor.id;
      if (arrivalName) this.arrival = {id:actor.id,name:arrivalName};
      if (!this.globeBusy()) this.flyHome();   // with the globe up, closing it lands on this Ducky instead
    }
    if (this.arrival?.id !== actor?.id) this.arrival = null;
    const arrivalViewReady =
      this.artShown === artOf(this.islandId) && this.revealArtReady(this.artShown);
    if (this.arrival && arrivalViewReady && this.playerRig()) {
      if (this.arrival.start === undefined) {this.arrival.start = now;this.playerRig().arrive?.();}
      if (this.motion.matches || now - this.arrival.start >= 520) this.finishArrival();
    }
    const input = {
      reducedMotion:this.motion.matches,
      x: this.globeBusy() ? 0 : Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')) + this.touchInput.x,
      y: this.globeBusy() ? 0 : Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')) + this.touchInput.y,
    };
    input.x=Math.sign(input.x); input.y=Math.sign(input.y);
    if(input.x||input.y||Math.abs(this.camera.zoom-this.target.zoom)>.0005||this.gestures.pointers.size||this.player?.travel>1&&this.player.mode!=='sailing')markArtActivity();
    // islets are drawn with the world art: load it to sail, and for a duck that starts out standing on an islet
    if(this.player&&!this.worldArtPending&&(this.player.mode==='sailing'||isletUnder(this.islandId,this.player)))this.ensureWorldArt();
    if (this.keys.has('shift') && ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].some(k => this.keys.has(k)) && (input.x || input.y)) input.run=true;
    if (this.travelView?.fx.holding(this.room?.id)) input.x=input.y=0;
    const indoors = this.interior?.active;
    while (this.accumulator >= SIM_STEP) {
      this.sim.step(SIM_STEP, this.room || indoors || this.arrival ? ZERO : input);
      this.room?.step(SIM_STEP, indoors || this.arrival ? ZERO : input);
      this.accumulator -= SIM_STEP;
    }
    this.room?.setAlpha(this.accumulator * 60);
    const player = this.player;
    if (Boolean(player) !== this.hadPlayer) {
      this.hadPlayer = Boolean(player);
      this.updateControlLabel();
      if (!player) { this.keys.clear(); this.follow = false; this.markerUntil = 0; }
    }
    if(this.pirateFleet){
      const occupied=(this.room?.boats??[]).filter(b=>b.occupant).map(b=>pirateBoatPoint(b,this.islandId));
      if(player?.mode==='sailing')occupied.push(pirateBoatPoint({...player,islandId:this.islandId},this.islandId));
      this.pirateFleet.update(dt,occupied);
    }
    const t = this.sim.time + this.accumulator;
    const reduced = this.motion.matches;
    if (player && player.mode !== 'sailing' && this.artShown === 'home' && mapOf(this.islandId).home && Math.hypot(player.x-MUSEUM_DOOR.x, player.y-MUSEUM_DOOR.y) < 700) this.ensureInterior();
    if (player && player.mode !== 'sailing') {
      const atDoor = this.artShown === 'home' && mapOf(this.islandId).home && atMuseumDoor(player.x, player.y);
      if (!indoors && atDoor && this.doorArmed && !this.interior && !this.interiorFailed) this.stopInput();
      if (this.interior && !indoors && atDoor && this.doorArmed && this.playerRig()) {this.doorArmed = false; this.sim.stopInput(); this.interior.enter(this.playerRig(), this.width, this.height); this.onInteriorChange(true); this.scene.visible = false; if (this.nameLayer) this.nameLayer.style.visibility = 'hidden';}
      if (!atDoor && player.y > MUSEUM_DOOR.y + 60) this.doorArmed = true;
      if (this.interior?.active && this.interior.update(dt, input, this.width, this.height, t, reduced)) {
        this.interior.leave(this.objects, .88 * .24 * 3); this.onInteriorChange(false); this.scene.visible = true;
        if (this.nameLayer) this.nameLayer.style.visibility = '';
        if (this.room) this.room.destination(MUSEUM_DOOR.out.x, MUSEUM_DOOR.out.y);
        else Object.assign(player, {x: MUSEUM_DOOR.out.x, y: MUSEUM_DOOR.out.y, previousX: MUSEUM_DOOR.out.x, previousY: MUSEUM_DOOR.out.y, path: [], turn: 0, action: 0});
        Object.assign(this.target, {x: player.x, y: player.y - 90}); Object.assign(this.camera, this.target, {zoom: this.camera.zoom}); this.follow = true;
      }
      if (this.interior?.active && this.globeOpen) this.closeGlobe();   // back to walking zoom indoors
      if (this.interior?.active) {this.renderScreen(); this.raf = requestAnimationFrame(time => this.tick(time)); return;}
    }
    if(player?.action===1&&(input.x||input.y)&&!this.fitMode&&!this.birdEye&&!this.gestures.pointers.size){
      const x=this.width/2+(player.x-this.camera.x)*this.camera.zoom,y=this.height/2+(player.y-this.camera.y)*this.camera.zoom*TILT;
      if(x<80||x>this.width-80||y<70||y>this.height-70)this.follow=true;
    }
    if (this.follow && player) {
      const shown=this.playerView();
      Object.assign(this.target, {x:shown.x, y:shown.y-90});
    }
    if (this.birdEye && this.spin && !this.gestures.pointers.size && !reduced) {
      const coast=coastGlobeSpin(this.spin,dt);
      this.spin.x=coast.x; this.spin.y=coast.y;
      if (this.spin.globe) {
        const look=this.globeAim ? lonLat(this.globeAim) : lookOf(this.islandId,this.target), lat=look.lat+coast.dy;
        if (Math.abs(lat)>LAT_MAX) this.spin.y=0;
        this.globeAim=centreOf(look.lon+coast.dx,lat); Object.assign(this.target, localPoint(this.islandId,this.globeAim));
        if (Math.hypot(this.spin.x,this.spin.y)<1e-7) this.spin=null;
      } else {
        const sx=coast.dx, sy=coast.dy;
        this.camera.x+=sx; this.camera.y+=sy; this.target.x+=sx; this.target.y+=sy; this.constrain(this.camera); this.constrain(this.target);
        const before={x:this.camera.x,y:this.camera.y};canonicalCamera(this.islandId,this.camera);
        this.target.x+=this.camera.x-before.x;this.target.y+=this.camera.y-before.y;
        if (Math.hypot(this.spin.x,this.spin.y)*this.camera.zoom<.0001) this.spin=null;
      }
    } else if (!this.birdEye || (this.gestures.pointers.size && performance.now()-(this.dragAt||0)>80)) this.spin=null;
    if (this.fly) this.stepFly(now, player);
    easeZoomCamera(this.camera, this.target, this.zoomMotion, dt, reduced, this.birdEye && (this.gestures.pointers.size || this.spin) ? 30 : 14);
    if (this.globeAim) {
      if (!this.birdEye) this.globeAim=null;
      else {
        const c=spherePoint(this.islandId,this.camera),a=this.globeAim,k=reduced ? 1 : 1-Math.exp(-30*dt),w=Math.acos(Math.max(-1,Math.min(1,c[0]*a[0]+c[1]*a[1]+c[2]*a[2])));
        const p=w<1e-9 ? a : c.map((v,i)=>(Math.sin((1-k)*w)*v+Math.sin(k*w)*a[i])/Math.sin(w));
        Object.assign(this.camera,localPoint(this.islandId,p)); Object.assign(this.target,localPoint(this.islandId,a));
        if (w<1e-7 && !this.spin && !this.gestures.pointers.size) this.globeAim=null;
      }
    }
    this.birdEye=!!this.archipelago && this.camera.zoom<this.minZoom*.95;

    const solo=this.walkSolo();
    this.archipelago?.update(this.camera.zoom);
    if (this.worldView) {
      const top = this.minZoom * .95, t = this.camera.zoom >= top ? 0 : Math.min(1, Math.log(top / this.camera.zoom) / Math.log(top / this.birdZoom()));

      if (this.gestures.pointers.size || this.spin) this.quietAt=performance.now();
      const quiet=t > .9 && !reduced ? Math.min(1, Math.max(0, (performance.now()-(this.quietAt||0)-2000)/1500)) : 0;
      if (quiet > 0) {this.globeAim=null; const b=this.archipelago.bounds, step=quiet*(t-.9)/.1*(b.x1-b.x0)/240*dt; turnLongitude(this.islandId,this.camera,step/WORLD_GEO.Rw); turnLongitude(this.islandId,this.target,step/WORLD_GEO.Rw);}
      this.globeT=t;
    }
    const sailing=player?.mode==='sailing'&&!this.globeT&&!this.fly;
    if(sailing){
      this.sailingCamera??=createSailingCamera();
      this.camera.basis=this.sailingCamera.update(this.islandId,player,dt,reduced,this.camera.basis);
      this.landingView=null;
    }else if(this.sailingCamera)this.sailingCamera.active=false;
    if(!this.landingView&&!sailing){
      const ball=this.globeT>.001 ? globeBall(this.globeT,this.camera.zoom,this.height) : 0,fade=uprightFade(ball);
      if(fade>0)this.camera.basis=rollBasis(globeRoll(this.islandId,spherePoint(this.islandId,this.camera),fade));
      else delete this.camera.basis;
    }
    if(this.landingView){
      const progress=(now-this.landingView.at)/600;
      this.camera.basis=easeLandingBasis(this.landingView.basis,progress);
      if(progress>=1){this.landingView=null;delete this.camera.basis;}
    }
    const viewMatrix=cameraMatrix(this.camera,this.width,this.height,TILT);
    this.scene.setFromMatrix(new Matrix(viewMatrix.a,viewMatrix.b,viewMatrix.c,viewMatrix.d,viewMatrix.tx,viewMatrix.ty));
    this.upright.update();
    this.viewSpan=cameraSpan(this.camera,this.width,this.height);
    const halfWidth = this.viewSpan.width / (2 * this.camera.zoom), halfHeight = this.viewSpan.height / (2 * this.camera.zoom * TILT);
    const visible = (x,y,pad=350) => Math.abs(x-this.camera.x)<halfWidth+pad && Math.abs(y-this.camera.y)<halfHeight+pad;
    this.positionOcean(this.camera,this.width,this.height,t,reduced);
    const flatVisible = !(this.globeT >= .97);
    const homeShown=this.artShown === 'home';
    const pondSeconds=Date.now()/1000;
    this.arts?.get(this.artShown)?.pondDuckies?.update(pondSeconds,reduced,visible,flatVisible&&this.scene.visible);
    this.homeKites?.update(t, reduced, visible, homeShown && flatVisible);
    for (const [id, art] of this.arts ?? []) if (art.ready) art.kites?.update(t, reduced, visible, id === this.artShown && flatVisible);
    this.plantReactions?.begin(this.artShown,t,reduced,flatVisible);
    this.rinkTrails?.begin(t,mapFor(this.artShown).walk.iceland2?.rink,reduced,flatVisible&&!this.interior?.active);
    if (homeShown && flatVisible) this.waterFX?.update(dt, t, {x: this.camera.x-halfWidth, y: this.camera.y-halfHeight, width: halfWidth*2, height: halfHeight*2});
    if (homeShown && flatVisible) this.surf?.update(t, reduced, visible);
    if (flatVisible) this.rowboat?.update(t, reduced, visible);
    if (homeShown && flatVisible) this.boats?.update(t, reduced, visible);
    const boatPoses=boatsForView(this.room,now/1000,()=>
      this.room && import.meta.env.DEV && this.archipelago && this.globeT<.97
        ? previewMoorings(this.archipelago.islands,this.camera,this.width,this.height,TILT) : []);
    this.travelView?.update(boatPoses,t,reduced,visible,player,this.camera);
    if(this.pirateFleet){
      this.pirateView?.update(this.islandId,this.camera,t,dt,reduced,visible);
      this.canvas.dataset.pirateCpuMs=this.pirateFleet.stats.cpuMs.toFixed(3);
      this.canvas.dataset.pirateCount=this.pirateFleet.ships.length;
    }
    this.weather.update(t,reduced,visible);
    this.snowfall?.update(t,reduced,this.artShown,this.width,this.height,flatVisible && !this.interior?.active);
    const breeze=windStrength(t,reduced);
    this.gust *= Math.exp(-dt * 2.5);
    if (!homeShown) this.artProps(this.artShown).forEach((prop, i) => {
      prop.sprite.visible = visible(prop.x, prop.y, Math.max(prop.width, prop.height) * prop.scale);
      if (prop.shadow) prop.shadow.visible = prop.sprite.visible;
      if (prop.sprite.visible) prop.sprite.skew.x = !reduced && prop.wind ? Math.sin(t * 1.3 + i * .7) * .009 * breeze + this.gust * .035 : 0;
      if (prop.boat) {
        prop.sprite.y = homePropY(prop,t,reduced,i);
        prop.sprite.rotation = homePropRotation(prop,t,reduced,i);
      }
    });
    for (const art of this.arts.values()) if (art.ready) art.updateCentre?.(t, reduced);
    if (homeShown) this.props.forEach((prop, i) => {
      prop.sprite.visible = visible(prop.x, prop.y, Math.max(prop.width, prop.height) * prop.scale);
      if(prop.shadow)prop.shadow.visible=prop.sprite.visible;
      if (!prop.sprite.visible) return;
      prop.sprite.skew.x = !reduced && prop.wind ? Math.sin(t * 1.3 + i * .7) * (/flag|bunting|banner|umbrella/i.test(prop.asset||prop.name)?.018:.009)*breeze + this.gust * .035 : 0;
      prop.sprite.y = homePropY(prop,t,reduced,i);
      prop.sprite.rotation = homePropRotation(prop,t,reduced,i);
      if (/lily|reeds|cattails/i.test(prop.asset || prop.name)) this.waterFX?.lily(prop, {y: prop.y, rotation: 0});
    });
    if (homeShown) this.floating.forEach(item=>{const pose=floatingPose(item,t,reduced);item.sprite.position.set(pose.x,pose.y);item.sprite.rotation=pose.rotation;item.sprite.visible=visible(item.x,item.y,100);this.waterFX?.lily(item,pose,t);});
    this.dust?.update(dt);
    const alpha = this.accumulator * 60;
    this.rigs.forEach((rig, i) => {
      const duck = this.localDucks[i];
      const x = duck.previousX + (duck.x-duck.previousX)*alpha;
      const y = duck.previousY + (duck.y-duck.previousY)*alpha;
      const peer = duck.player ? telescopePeerAt(this.artProps(this.artShown), {...duck,x,y}) : null;
      const hop = jumpPose(renderJumpLeft(duck.jumpLeft, this.accumulator), reduced, {turn: duck.turn, moving: duck.travel > 20});
      rig.root.position.set(deckX(x,y,this.arches), deckY(x, y, this.arches) - hop.lift - (duck.player ? this.arrivalLift(now) : 0));
      rig.root.zIndex = y;
      if (peer) {rig.root.position.set(peer.x,peer.y);rig.root.zIndex=peer.y;}
      rig.root.visible = (homeShown || duck.player) && visible(x, y, 200);
      if (duck.player) this.plantReactions?.track(duck,x,y,rig.root.visible && !(duck.jumpLeft>0));
      rig.trackSnow?.(t, (homeShown || duck.player) && !this.interior?.active ? this.artShown : null,
        duck.action, duck.travel, reduced, duck.emoteVersion, duck.jumpLeft > 0);
      if (flatVisible && rig.root.visible) rig.update(dt, {action: duck.action, ice:duck.ice, speed: duck.travel, turn: peer?.turn ?? duck.turn, time: t, reducedMotion: reduced, emoteVersion: duck.emoteVersion, persistentSleep: duck.sleeping, jump: hop});
      if (duck.player) this.rinkTrails?.track(duck,x,y,duck.travel,rig.root.visible&&!(duck.jumpLeft>0));
      if (duck.player) {rig.showRing?.(hop.phase !== 'air'); this.dust?.track(duck, {x:deckX(x,y,this.arches), y: deckY(x, y, this.arches), z: y, jumpLeft: duck.jumpLeft, travel: duck.travel, turn: duck.turn, reduced, dt});}
      if (homeShown) this.bumpSleeper(duck, rig, player);
    });
    if (!homeShown) {
      for (const {duck, rig} of this.mapSleepers.get(this.artShown) ?? []) {
        rig.root.position.set(duck.x, duck.y); rig.root.zIndex=duck.y;
        rig.root.visible=visible(duck.x, duck.y, 200);
        rig.trackSnow?.(t, this.artShown, 7, 0, reduced, 0);
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
    this.arts?.get(this.artShown)?.icelandLife?.current?.update(t, reduced, visible, flatVisible && this.scene.visible, player, live);
    if (homeShown && flatVisible) this.waterFX?.edge([...this.localDucks, ...live]);
    if (this.room) this.renderLiveDucks(live, dt, t, reduced, visible, now);
    this.karmaView?.update(dt,t,reduced,visible);
    this.boatBuild?.update(dt,t,reduced,visible);
    this.plantReactions?.update(t);
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
    const copies=this.liveCopies();
    const views=[];
    if(flatVisible) {
      const streams=this.artShown==='home'?[this.homeGroundStream]:this.arts.get(this.artShown)?.groundStreams??[];
      for(const stream of streams)views.push({stream,camera:this.camera,width:this.viewSpan.width,height:this.viewSpan.height,tilt:TILT});
      for(const island of copies) {
        const m=mapFor(island.map),streams=island.map==='home'?[this.homeGroundStream]:this.arts.get(island.map)?.groundStreams??[];
        for(const stream of streams)views.push({stream,camera:{...this.camera,...unplaceRigid(this.islandId,island.id,this.camera)},width:this.viewSpan.width,height:this.viewSpan.height,tilt:TILT});
      }
    }
    this.groundPool?.update(views,Math.min(devicePixelRatio||1,2));
    for(const art of this.arts.values())art.rasterPool?.update(views,Math.min(devicePixelRatio||1,2));
    this.archipelago?.showLive(solo ? SOLO_HIDDEN : new Set(copies.map(i => i.id)));
    const visitors=this.copyVisitors(copies);
    for (const {o} of visitors) o.visible=false;
    if (this.worldView) this.worldView.liveCopies=target => this.renderLiveCopies(target, copies, visitors);
    this.isletView?.update(this.islandId,this.camera,this.viewSpan.width,this.viewSpan.height,(this.globeT||0)>.001);
    if (this.worldView) this.worldView.globeWanted=!this.archipelago || !this.walkSolo();
    this.renderScreen(() => {
      this.worldView?.update(this.globeT||0, this.width, this.height, performance.now() / 1000, this.camera, this.archipelago, this.mapHere(), this.birdZoom(), !this.gestures.pointers.size, this.player, reduced);
      if (this.nameLayer) {
        const tags=1-(this.worldView?.pinIn ?? 0), css=tags >= 1 ? '' : tags.toFixed(3);
        if (css !== this.tagOpacity) {this.tagOpacity=css; this.nameLayer.style.opacity=css; this.nameLayer.style.pointerEvents=tags < .5 ? 'none' : '';}
      }
      this.scene.visible=!this.interior?.active;
    }, copies, visitors);
    for (const {o} of visitors) o.visible=true;
    if (this.frame % 15 === 0) {
      const d = this.canvas.dataset;
      d.ducks = String(this.localDucks.length + live.length);
      d.livePlayers = String(live.length);
      d.sleepingDucks = String(homeShown ? this.sim.ducks.filter(duck => duck.sleeping && duck.action === 7).length : (this.mapSleepers.get(this.artShown)?.length ?? 0));
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

  capturePhoto() {
    if (this.disposed || !this.photoReady || this.pendingPhoto) {
      return Promise.reject(new Error('The camera is unavailable.'));
    }
    return new Promise((resolve, reject) => {
      const request = {resolve, reject};
      request.timeout = setTimeout(() => {
        this.finishPhoto(request, new Error('The photo timed out.'));
      }, 2000);
      this.pendingPhoto = request;
    });
  }

  finishPhoto(request, error, blob) {
    if (this.pendingPhoto !== request) return;
    this.pendingPhoto = null;
    clearTimeout(request.timeout);
    if (error) request.reject(error);
    else request.resolve(blob);
  }

  renderPhotoFrame(request) {
    if (!this.host.clientWidth || !this.host.clientHeight || this.app.renderer.gl?.isContextLost()) return;
    if (!this.photoReady) {
      this.photoReady = true;
      this.onPhotoReady?.();
    }
    if (!request || request.encoding) return;
    request.encoding = true;
    clearTimeout(request.timeout);
    try {
      renderPolaroid(this.host, [this.canvas], '#86cee6').then(
        blob => this.finishPhoto(request, null, blob), error => this.finishPhoto(request, error));
    } catch (error) {
      this.finishPhoto(request, error);
    }
  }

  islandNodes(id,art) {
    return [...(art.groups??[]),...this.artProps(id).map(p=>p.sprite),
      ...(id==='home' ? [...(this.homeKites?.entries??[]).map(e=>e.root),
        ...this.sleeperRigs().map(r=>r.root),...(this.bridgeOver??[]).map(b=>b.sprite)]
        : (this.mapSleepers.get(id)??[]).map(s=>s.rig.root))];
  }

  applyIslandReveal(now=performance.now()) {
    const ready=this.revealArtReady(this.artShown);
    if(!ready){this.revealMap=null;this.revealAt=null;}
    else if(this.revealMap!==this.artShown){this.revealMap=this.artShown;this.revealAt=now;}
    const progress=ready?Math.min(1,Math.max(0,(now-this.revealAt)/250)):0;
    if(progress===1)return ()=>{};
    const alpha=1-(1-progress)**3,restore=[];
    const art=this.arts?.get(this.artShown);
    if(art){
      const nodes=new Set(this.islandNodes(this.artShown,art));
      for(const node of nodes){
        if(!node||node.destroyed)continue;
        if(!ready){node.visible=false;continue;}
        // A prop may already be inside a faded group. Multiply only once.
        let parent=node.parent;
        while(parent&&!nodes.has(parent))parent=parent.parent;
        if(parent||alpha===1)continue;
        restore.push([node,node.alpha]);node.alpha*=alpha;
      }
    }
    return ()=>{for(const [node,alpha] of restore)if(!node.destroyed)node.alpha=alpha;};
  }

  renderScreen(updateWorld, copies, visitors) {
    const request = this.pendingPhoto;
    // The globe can project a texture of this same scene during a handoff.
    const ring = request && !request.encoding ? this.playerRig()?.playerRing : null;
    const renderable = ring?.renderable;
    if (ring) ring.renderable = false;
    let restoreIsland;
    try {
      updateWorld?.();
      restoreIsland=this.applyIslandReveal();
      this.app.render();
      if (copies && !(this.globeT > 0)) this.renderLiveCopies(undefined, copies, visitors);
      this.renderPhotoFrame(request);
    } finally {
      restoreIsland?.();
      if (ring) ring.renderable = renderable;
    }
  }

  playerRig() {
    if (this.room) return [...this.liveRigs.values()].find(entry => entry.isPlayer)?.rig;
    const i = this.localDucks?.findIndex(duck => duck.player) ?? -1;
    return i >= 0 ? this.rigs[i] : null;
  }

  async setPlayerOutfit(outfit) {
    const player = this.player;
    if (!player) throw new Error('Your duck is still arriving. Please try again.');
    await this.playerRig()?.setOutfit(outfit);
    player.outfit = {...outfit};
  }

  renderLiveDucks(poses, dt, time, reducedMotion, visible, now) {
    const ids = new Set(poses.map(pose => pose.id)), sailers = [];
    const scopeProps = this.artShown === 'home' ? this.props : this.arts?.get(this.artShown)?.props;
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
          rig.arrive?.();
          entry.rig = rig;
          entry.outfit = {...pose.outfit};
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
      rig.setKarma?.(pose.karma??0);
      if (!sameOutfit(entry.outfit,pose.outfit) && !entry.outfitLoading) {
        entry.outfitLoading = true;
        rig.setOutfit(pose.outfit).then(() => {entry.outfit = {...pose.outfit};})
          .catch(error => console.error('Could not update an outfit',error))
          .finally(() => {entry.outfitLoading = false;});
      }
      const look=this.travelView?.fx.duck(pose,reducedMotion) ?? {x,y,scale:.88*.24*3,sx:1,sy:1,rotation:0,alpha:1,mask:null,speed:travel,turn,deck:true};
      const peer = telescopePeerAt(scopeProps, {...pose,x,y,action,travel});
      if (look.mask && !entry.seatMask) {
        entry.seatMask=new Graphics(); this.objects.addChild(entry.seatMask);
      }
      if (entry.seatMask) {
        entry.seatMask.clear();
        if (look.mask) entry.seatMask.poly(look.mask).fill(0xffffff);
        rig.root.mask=look.mask?entry.seatMask:null;
      }
      rig.root.scale.set(look.scale*look.sx,look.scale*look.sy/TILT);
      const jumpLeft=isPlayer?renderJumpLeft(pose.jumpLeft,this.accumulator):pose.jumpLeft;
      const hop=look.deck ? jumpPose(jumpLeft,reducedMotion,{turn:look.turn,moving:look.speed>20}) : null;
      rig.root.position.set(look.deck&&pose.mode!=='sailing'?deckX(look.x,look.y,this.arches):look.x,(look.deck?deckY(look.x,look.y,this.arches):look.y)-(hop?.lift ?? 0)-(isPlayer ? this.arrivalLift(now) : 0));
      rig.root.rotation=look.rotation;rig.root.skew.set(0,0); rig.root.alpha=look.alpha;
      if(pose.mode==='sailing')sailingUpright(rig.root,this.camera.basis,TILT);
      rig.showRing?.(look.deck && pose.mode !== 'sailing' && hop?.phase !== 'air');
      if (look.deck && pose.mode !== 'sailing') this.dust?.track(entry, {x:deckX(look.x,look.y,this.arches), y:deckY(look.x,look.y,this.arches), z:look.z ?? look.y, jumpLeft:pose.jumpLeft, travel:look.speed, turn:look.turn, reduced:reducedMotion, dt});
      rig.root.zIndex = look.z ?? look.y;
      if (peer) {rig.root.position.set(peer.x,peer.y);rig.root.zIndex=peer.y;}
      rig.root.visible = visible(look.x,look.y,200);
      this.plantReactions?.track(entry,x,y,rig.root.visible && look.deck && pose.mode!=='sailing' && !(pose.jumpLeft>0));
      const snowMoved = entry.snowX !== undefined && (Math.abs(x - entry.snowX) > .01 || Math.abs(y - entry.snowY) > .01);
      rig.trackSnow?.(time, !this.interior?.active && pose.mode !== 'sailing' ? this.artShown : null,
        action, travel, reducedMotion, emoteVersion, snowMoved || pose.jumpLeft > 0);
      entry.snowX = x; entry.snowY = y;
      if (rig.root.visible) rig.update(dt, {action, ice:pose.mode==='sailing'?null:pose.ice, speed:look.speed, turn:peer?.turn ?? look.turn, time, reducedMotion, emoteVersion, jump:hop, sailing:pose.mode==='sailing'});
      this.rinkTrails?.track(entry,x,y,travel,rig.root.visible&&look.deck&&pose.mode!=='sailing'&&!(pose.jumpLeft>0));
      if (pose.mode === 'sailing') sailers.push(look);
    }
    this.updateBridgeOver(sailers);
  }
  updateBridgeOver(sailers) {
    for (const b of this.bridgeOver ?? []) b.sprite.visible = this.artShown === 'home' && sailers.some(p => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1);
    for (const [id, art] of this.arts ?? []) for (const b of art.bridgeOver ?? []) b.sprite.visible = id === this.artShown && sailers.some(p => p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.pendingPhoto) this.finishPhoto(this.pendingPhoto, new Error('The game view was closed.'));
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.cleanups.forEach(fn => fn());
    this.snowfall?.destroy();
    this.karmaView?.destroy();
    this.boatBuild?.destroy();
    this.groundPool?.destroy();
    this.livePatches?.destroy();this.archipelago?.destroy(); this.worldView?.destroy();this.isletView?.destroy();
    this.clearChat();
    this.keys.clear();
    this.gestures.clear();
    this.audio.dispose();
    this.arrivalRig?.dispose();
    this.waterFX?.dispose();
    this.plantReactions?.destroy();
    this.rinkTrails?.destroy();
    this.travelView?.dispose();
    for (const art of this.arts?.values() ?? []) {art.pondDuckies?.destroy();if (art.id !== 'home') art.destroy?.();}
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
    if (this.initialized) this.app.destroy({removeView:true,releaseGlobalResources:false}, {children: true});
    this.loaded.forEach(release);
    this.loaded = [];
  }
}
