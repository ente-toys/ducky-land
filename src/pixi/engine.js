import {createWeather,windStrength} from './weather.js';
import {createBird,birdPose,createCrow,crowPose} from './birds.js';
import {createBeachSurf} from './surf.js';
import {createRowboat} from './rowboat.js';
import {createButterfly,butterflyPose} from './butterflies.js';
import {floatingPose} from './floating.js';
import {Application, Assets, Container, Graphics, Sprite, TilingSprite} from 'pixi.js';
import world from '../../rive/web/world.json';
import art from './art-manifest.json';
import {createSimulation} from './simulation.js';
import {createAudio} from './audio.js';
import {createDuck, disposeDuckAssets} from './duck.js';   // boss 3 Nov: back to Ashwin's PixiJS Ducky (no Rive)
import {createFountainWater} from './fountain.js';
import {createPlacements} from './placements.js';
import {clamp, easeCamera, fitZoom, Gestures, movePinch, screenToWorld, TILT, zoomAt} from './camera.js';

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
    this.fitMode = false;
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
      this.floatLayer=new Container();
      this.contactShadows=new Container();
      this.scene.addChild(this.ground, this.water, this.floatLayer, this.contactShadows, this.objects, this.air);
      this.app.stage.addChild(this.scene);
      this.motion = matchMedia('(prefers-reduced-motion: reduce)');
      this.sim = createSimulation(world, 8612, {sleepingNpcs: true});
      this.resize(true);
      this.listen(this.canvas, 'webglcontextlost', event => {event.preventDefault(); cancelAnimationFrame(this.raf); this.audio.suspend(); this.onError();});
      const props = createPlacements(world, this.sim.nav.walkable);
      const tiles = art.ground.tiles;
      const entries = [...tiles, ...props, ...art.floating, {src:'/pixi-art/water-texture.svg'}];
      const sources = entries.map(p => p.src);
      this.loaded.push(...sources);
      const textures = await Promise.all(entries.map(p => acquire(p.src, p.resolution)));
      if (this.disposed) return;
      this.ocean=new TilingSprite({texture:textures[textures.length-1],width:world.width,height:world.height});this.scene.addChildAt(this.ocean,0);
      tiles.forEach((tile, i) => {
        const sprite = new Sprite(textures[i]);
        sprite.position.set(tile.x, tile.y);
        sprite.width = tile.width;
        sprite.height = tile.height;
        this.ground.addChild(sprite);
      });
      this.floating=art.floating.map((item,i)=>{
        const sprite=new Sprite(textures[tiles.length+props.length+i]);
        sprite.anchor.set(item.anchor.x,item.anchor.y);sprite.position.set(item.x,item.y);
        sprite.width=item.width;sprite.height=item.height;this.floatLayer.addChild(sprite);
        return {...item,sprite};
      });
      this.props = props.map((prop, i) => {
        const name=prop.asset||prop.name,tree=/tree/i.test(name),boat=/boat/i.test(name);
        let shadow;
        // GPT plants carry their own tight base shadow (boss 3 Nov: fix the tree base), so no extra ground shadow here.
        if(!/bunting|banner|flag|bridge|reeds|shell|blanket|^(tree|bush|flower)-\d/i.test(name)){
          const width=prop.width*prop.scale,height=prop.height*prop.scale;
          const radius=Math.max(7,Math.min(140,width*(tree?.34:.32))),depth=Math.max(3,Math.min(20,height*.04));
          shadow=new Graphics().ellipse(radius*.22,5,radius*1.16,depth*1.2).fill({color:boat?0x245569:0x304732,alpha:.065})
            .ellipse(0,2,tree?Math.max(9,width*.075):radius*.65,tree?5:depth*.58).fill({color:0x243a2b,alpha:.13});
          shadow.position.set(prop.x,prop.y);this.contactShadows.addChild(shadow);
        }

        const sprite = new Sprite(textures[tiles.length + i]);
        sprite.anchor.set(prop.anchor.x, prop.anchor.y);
        sprite.position.set(prop.x, prop.y);
        sprite.width = prop.width * prop.scale;
        sprite.height = prop.height * prop.scale;
        sprite.zIndex = prop.y;
        this.objects.addChild(sprite);
        return {sprite, shadow, ...prop, wind: /tree|reeds|cattails|flower|leaf|bush|flag|bunting|banner|umbrella/i.test(prop.name), boat: /boat/i.test(prop.asset || prop.name)};
      });
      const results = await Promise.allSettled(this.sim.ducks.map(d => createDuck({outfit: {}, seed: d.id + 21, isPlayer:d.player})   /* plain Ducky, no Drip outfits */));
      this.rigs = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      if (this.disposed) {this.rigs.forEach(r => r.dispose()); this.rigs = []; disposeDuckAssets().catch(() => {}); return;}
      const failure = results.find(r => r.status === 'rejected');
      if (failure) throw failure.reason;
      this.rigs.forEach((rig, i) => {
        const duck = this.sim.ducks[i];
        // The original flat view scales the source drawing by .88 × .24; the rig's own scale is 1/3.
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
    this.weather=createWeather(world,this.scene,this.air);
    this.surf = createBeachSurf(this.water);
    const rowingProp = this.props.find(prop => prop.asset === 'rowboat');
    this.rowboat = createRowboat(rowingProp,world.water[1],this.objects,this.water);
    this.props = this.props.filter(prop => prop !== rowingProp);
    this.ripples = [];
    world.water.forEach((lake, index) => {
      for (let i = 0; i < 12; i++) {
        const phase = i * 2.399 + index;
        const ripple = new Graphics().ellipse(0, 0, 21, 5).stroke({width: 2, color: '#d5fbff', alpha: .6});
        ripple.position.set(lake.x + Math.cos(phase) * lake.rx * (.2 + i / 18), lake.y + Math.sin(phase) * lake.ry * .7);
        this.water.addChild(ripple);
        this.ripples.push({sprite: ripple, phase,x:ripple.x,y:ripple.y});
      }
    });
    this.birds=[[2419,1928],[3185,1897],[3427,2126]].map(([x,y],phase)=>{const bird=createBird();this.air.addChild(bird.root);return {...bird,x,y,phase};});
    this.crows = [   // boss 3 Nov: no black crows
    ].map(flight => {
      const crow = createCrow();
      this.air.addChild(crow.root);
      return {...crow,...flight};
    });
    this.butterflies=[{x:2230,y:2280,color:'#ff669d'},{x:3420,y:2270,color:'#9271cf'}].map((item,i)=>{
      const butterfly=createButterfly(item.color);this.air.addChild(butterfly.root);
      return {...item,...butterfly,phase:i*2.4+1};
    });
    this.leaves = [];
    this.props.filter(p => /tree/.test(p.name)).forEach((tree, i) => {
      const leaf = new Graphics().ellipse(0, 0, 6, 2.5).fill(i % 3 ? '#a9c96d' : '#f3d77b');
      this.air.addChild(leaf);
      this.leaves.push({sprite: leaf, x: tree.x, y: tree.y - 150, phase: i * 1.93});
    });
    this.droplets = [];
    // boss 3 Nov: the wishing-bowls fountain animates its own water (fountain.js); the old statue drops are off
    const fountain = this.props.find(p => p.asset === 'fountain-wishing');
    this.fountainWater = fountain ? createFountainWater(fountain, this.objects) : null;
    for (let i = 0; i < 0; i++) {
      const drop = new Graphics().ellipse(0, 0, 2.5, 4).fill('#ddfaff');
      this.objects.addChild(drop);
      drop.zIndex = 2351;
      this.droplets.push(drop);
    }
    this.splashes=[].map((side,i)=>{const sprite=new Graphics().ellipse(0,0,16,5).stroke({color:0xddfaff,width:1.8});sprite.position.set(2820+side*62,2260);this.objects.addChild(sprite);sprite.zIndex=2351;return {sprite,phase:i*.5};});
    this.marker = new Graphics().ellipse(0, 0, 20, 9).stroke({width: 3, color: '#fff9da', alpha: .8});
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
      if (event.button !== 0 && event.button !== 1) return;
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
      if (event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target?.tagName) || event.target?.isContentEditable) return;
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
      if (key === 'f') {this.follow=true;this.fitMode=false;this.target.zoom=Math.max(.65,this.target.zoom);}
      if (key === 'home' || key === '0') this.fit();
      if (['+','=','-'].includes(key)) {
        this.target.zoom = clamp(this.target.zoom * (key === '-' ? .8 : 1.25), this.minZoom*.8, 1.8);this.fitMode=false;this.follow=false;
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
    const hitRadius=Math.max(65,20/this.camera.zoom);
    const hit = this.sim.ducks.find(duck => {
      if (duck.action !== 7) return Math.hypot(p.x - duck.x, p.y - (duck.y - 50)) < hitRadius;
      const width = Math.max(62, 20 / this.camera.zoom);
      const height = Math.max(31, 12 / this.camera.zoom);
      return Math.hypot((p.x - duck.x) / width, (p.y - (duck.y - 27)) / height) < 1;
    });
    const now = performance.now();
    if (hit?.player) {
      this.triggerEmote(now - this.lastTap < 450 ? 3 : 2);
      this.lastTap = now;
    } else if (hit) {
      if (!hit.sleeping) {
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
    const destination = this.sim.destination(point.x, point.y);
    if (destination) {
      this.marker.position.set(...destination);
      this.markerUntil = this.sim.time + 1.5;
      this.audio.play('pop', .045);
    }
    return destination;
  }

  triggerEmote(action) {
    this.sim.emote(action);
    if(this.sim.player.action===action)this.sim.player.turn=0;
    this.audio.unlock().then(() => this.audio.play(action === 2 ? 'quack' : 'pop', action === 2 ? .12 : .06));
  }

  constrain(camera) {camera.x=clamp(camera.x,250,world.width-250);camera.y=clamp(camera.y,200,world.height-200);}

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
    const input = {
      x: Number(this.keys.has('d') || this.keys.has('arrowright')) - Number(this.keys.has('a') || this.keys.has('arrowleft')),
      y: Number(this.keys.has('s') || this.keys.has('arrowdown')) - Number(this.keys.has('w') || this.keys.has('arrowup')),
    };
    while (this.accumulator >= 1 / 60) {this.sim.step(1 / 60, input); this.accumulator -= 1 / 60;}
    const t = this.sim.time;
    const reduced = this.motion.matches;
    if(this.sim.player.action===1&&!this.fitMode&&!this.gestures.pointers.size){
      const x=this.width/2+(this.sim.player.x-this.camera.x)*this.camera.zoom,y=this.height/2+(this.sim.player.y-this.camera.y)*this.camera.zoom*TILT;
      if(x<80||x>this.width-80||y<70||y>this.height-70)this.follow=true;
    }
    if (this.follow) Object.assign(this.target, {x: this.sim.player.x, y: this.sim.player.y - 90});
    easeCamera(this.camera, this.target, dt, reduced);
    // Cursor Camp tilt: the whole scene is squashed vertically; anything standing up is scaled back upright once.
    this.scene.scale.set(this.camera.zoom, this.camera.zoom * TILT);
    this.scene.position.set(this.width / 2 - this.camera.x * this.camera.zoom, this.height / 2 - this.camera.y * this.camera.zoom * TILT);
    for (const layer of [this.objects, this.air]) for (const child of layer.children) if (!child.upright) {child.upright = true; child.scale.y /= TILT;}
    const halfWidth = this.width / (2 * this.camera.zoom), halfHeight = this.height / (2 * this.camera.zoom * TILT);
    const visible = (x,y,pad=350) => Math.abs(x-this.camera.x)<halfWidth+pad && Math.abs(y-this.camera.y)<halfHeight+pad;
    this.ocean.position.set(this.camera.x-halfWidth-256,this.camera.y-halfHeight-256);this.ocean.width=halfWidth*2+512;this.ocean.height=halfHeight*2+512;
    this.ocean.tilePosition.set(-this.ocean.x+(reduced?0:t*2),-this.ocean.y+(reduced?0:t*.7));
    this.surf.update(t, reduced, visible);
    this.rowboat.update(t, reduced, visible);
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
    });
    this.floating.forEach(item=>{const pose=floatingPose(item,t,reduced);item.sprite.position.set(pose.x,pose.y);item.sprite.rotation=pose.rotation;item.sprite.visible=visible(item.x,item.y,100);});
    const alpha = this.accumulator * 60;
    this.rigs.forEach((rig, i) => {
      const duck = this.sim.ducks[i];
      const x = duck.previousX + (duck.x-duck.previousX)*alpha;
      const y = duck.previousY + (duck.y-duck.previousY)*alpha;
      rig.root.position.set(x, y);
      rig.root.zIndex = y;
      rig.root.visible = visible(x, y, 200);
      if (rig.root.visible) rig.update(dt, {action: duck.action, speed: duck.travel, turn: duck.turn, time: t, reducedMotion: reduced, emoteVersion: duck.emoteVersion, persistentSleep: duck.sleeping});
    });
    this.ripples.forEach(({sprite, phase,x,y}) => {sprite.position.set(x+(reduced?0:Math.sin(t*.18+phase)*6),y+(reduced?0:Math.sin(t*.24+phase)*2));sprite.scale.set(reduced ? 1 : 1 + Math.sin(t*.8+phase)*.22); sprite.alpha = reduced ? .35 : .35 + Math.sin(t+phase)*.2;});
    this.birds.forEach(item=>{const pose=birdPose(item.x,item.y,item.phase,t,reduced);item.root.position.set(pose.x,pose.y);item.root.rotation=pose.rotation;item.root.visible=visible(pose.x,pose.y,100);item.wings.forEach((wing,i)=>wing.rotation=(i?1:-1)*pose.flap);});
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
    if (this.sim.player.travel && t > (this.nextStep || 0)) {this.audio.play('step', .045); this.nextStep = t + .28;}
    this.app.render();
    // DOM-only diagnostics make automated acceptance possible without scene overlays.
    if (this.frame % 15 === 0) {
      const d = this.canvas.dataset;
      d.ducks = String(this.sim.ducks.length);
      d.sleepingDucks = String(this.sim.ducks.filter(duck => duck.sleeping && duck.action === 7).length);
      d.player = `${this.sim.player.x.toFixed(1)},${this.sim.player.y.toFixed(1)}`;
      d.action = String(this.sim.player.action);
      d.quackBubbles=String(this.sim.ducks.filter(duck=>duck.action===2).length);
      d.playerRing='true';d.muted=String(this.audio.muted);d.follow=String(this.follow);d.destinationMarker=String(this.marker.visible);d.birds=String(this.birds.length);
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
