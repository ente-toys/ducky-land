import {Assets, Container, Graphics, Sprite} from 'pixi.js';
import {ART_TEXTURE} from './art/art-texture.js';
import {TILT} from '../shared/camera.js';
import {BOAT_UNVEIL, MATERIALS, MATERIAL_NAMES, PICKUP_RADIUS, buildSpot, scatterMaterials, strandedIslet} from '../../gameplay/boat-build.js';

const ART = Object.fromEntries(MATERIALS.map(kind => [kind, `/pixi-art/boat-build/${kind}.svg`]));
// build.svg is a 640-wide one-shot of .57 s whose smoke is centred 180 units down; drawn at BURST_SCALE world units per unit
const BURST = '/pixi-art/boat-build/build.svg', BURST_SECONDS = .57, BURST_WIDTH = 640, BURST_CLOUD = 180, BURST_SCALE = .55;
const SIZE = 84, ART_SIZE = 80, PICK_SECONDS = .35;
const HULL = {x: 25, y: -50};   // a boat's position is its waterline; its hull is drawn here, where the smoke goes

// Stranded on an islet with no boat: this player's own wood, rope and sail cloth lie about the islet (no one else
// sees them). Walking up to one offers "Pick up"; with all three, the shore offers "Build boat".
export async function createBoatBuildView(game) {
  // the SVGs are drawn on an 80-unit canvas: rasterize them sharp enough for the closest zoom on this screen
  const resolution = Math.ceil(SIZE / ART_SIZE * game.zoomCeiling() * game.app.renderer.resolution);
  await Promise.all(Object.values(ART).map(src => Assets.load({src, data: {...ART_TEXTURE, resolution}})));
  const room = game.room, host = game.host;
  let state = null, disposed = false;
  const picking = [];

  const kit = document.createElement('div');
  kit.className = 'pixi-build-kit';
  kit.setAttribute('role', 'status');
  kit.setAttribute('aria-live', 'polite');
  kit.innerHTML = MATERIALS.map(kind => `<img src="${ART[kind]}" alt="" data-kind="${kind}">`).join('') + '<span></span>';
  kit.hidden = true;
  host.append(kit);

  const bursts = [];
  room.onBoatBuilt = ({x, y}) => {
    if (disposed) return;
    const img = document.createElement('img');
    img.className = 'pixi-build-burst';
    img.alt = '';
    img.src = `${BURST}?t=${Date.now()}`;   // a fresh URL restarts the one-shot animation
    host.append(img);
    bursts.push({img, x, y, age: 0});
    game.audio.play('pop', .1);
    room.onNotice('');
    // the new boat reaches the next snapshot a moment later: keep this islet marked as done so nothing re-scatters
    const islet = state?.islet;
    clear();
    state = {islet, items: []};
  };

  function clear() {
    for (const item of state?.items ?? []) item.root?.destroy({children: true});
    state = null;
    kit.hidden = true;
  }

  // items lie on the ground: drawn with the contact shadows, under every duck, tree and prop
  function place(item, i) {
    const root = new Container({label: `Boat material: ${MATERIAL_NAMES[item.kind]}`});
    const shadow = new Graphics().ellipse(0, 0, SIZE * .42, SIZE * .13).fill({color: 0x2f4a1c, alpha: .18});
    const texture = Assets.get(ART[item.kind]);
    const sprite = new Sprite(texture), gleam = new Sprite(texture);
    for (const s of [sprite, gleam]) {
      s.anchor.set(.5, .85);
      s.width = s.height = SIZE;
      s.scale.y /= TILT;
    }
    gleam.tint = 0xfff3c4;
    gleam.blendMode = 'add';
    const sparkle = new Graphics();
    root.addChild(shadow, sprite, gleam, sparkle);
    root.position.set(item.x, item.y);
    game.contactShadows.addChild(root);
    Object.assign(item, {root, gleam, sparkle, phase: i * 2.1});
  }

  // a slow glint over the item and a small twinkling star: it reads as something to pick up
  function shimmer(item, time, reduced) {
    const pulse = reduced ? .3 : Math.pow(Math.max(0, Math.sin(time * 1.6 + item.phase)), 4);
    item.gleam.alpha = .04 + pulse * .22;
    const twinkle = reduced ? .5 : Math.pow(Math.max(0, Math.sin(time * 2.3 + item.phase * 1.7)), 6);
    const r = 4 + twinkle * 7, x = SIZE * .26, y = -SIZE * .62 / TILT;
    item.sparkle.clear();
    if (twinkle > .02) item.sparkle.moveTo(x, y - r * 1.8).quadraticCurveTo(x + r * .3, y - r * .3, x + r, y)
      .quadraticCurveTo(x + r * .3, y + r * .3, x, y + r * 1.8).quadraticCurveTo(x - r * .3, y + r * .3, x - r, y)
      .quadraticCurveTo(x - r * .3, y - r * .3, x, y - r * 1.8).fill({color: 0xfffbe6, alpha: .9 * twinkle});
  }

  const near = item => !item.taken && Math.hypot(item.x - room.player.x, item.y - room.player.y) <= PICKUP_RADIUS;

  function showKit() {
    const taken = state.items.filter(item => item.taken).length;
    for (const img of kit.querySelectorAll('img')) img.classList.toggle('pixi-build-kit-got', state.items.some(item => item.kind === img.dataset.kind && item.taken));
    kit.querySelector('span').textContent = `${taken}/${MATERIALS.length}`;
    kit.setAttribute('aria-label', `Boat materials: ${taken} of ${MATERIALS.length}`);
    kit.hidden = false;
  }

  return {
    options() {
      const me = room.player;
      if (!state || !me || me.mode !== 'walking') return {};
      const item = state.items.find(near);
      if (item) return {collect: item.kind};
      if (state.items.every(item => item.taken) && buildSpot(game.islandId, me)) return {build: true};
      return {};
    },
    collect() {
      const item = state?.items.find(near);
      if (!item) return false;
      item.taken = true;
      picking.push({root: item.root, age: 0});
      item.root = null;
      game.audio.play('pop', .08);
      showKit();
      room.onNotice(state.items.every(i => i.taken)
        ? 'You have everything. Walk to the edge of the island to build your boat.'
        : `Picked up the ${MATERIAL_NAMES[item.kind]}.`);
      return true;
    },
    build() {
      return Boolean(state?.items.every(item => item.taken) && room.build());
    },
    update(dt, time, reduced, visible) {
      const me = room.player;
      if (me?.mode !== 'walking') {if (state) clear();}
      else {
        const walk = strandedIslet(game.islandId, me, room.usableBoats());
        // a new stranding scatters a fresh set; stepping onto another islet starts over
        if (walk && state?.islet !== walk.islet.id) {
          clear();
          state = {islet: walk.islet.id, items: scatterMaterials(walk)};
          state.items.forEach(place);
          showKit();
        }
      }
      for (const item of state?.items ?? []) {
        if (!item.root) continue;
        item.root.visible = visible(item.x, item.y, SIZE);
        if (item.root.visible) shimmer(item, time, reduced);
      }
      for (let i = picking.length - 1; i >= 0; i--) {
        const p = picking[i];
        p.age += dt;
        const u = Math.min(1, p.age / PICK_SECONDS);
        p.root.alpha = 1 - u;
        p.root.scale.set(reduced ? 1 : 1 + .3 * Math.sin(u * Math.PI));
        p.root.pivot.y = reduced ? 0 : u * 40 / TILT;
        if (u >= 1) {p.root.destroy({children: true}); picking.splice(i, 1);}
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;
        if (!b.splashed && b.age >= BOAT_UNVEIL) {
          b.splashed = true;
          game.travelView?.fx.splash(b.x, b.y, 1.4);
          game.audio.play('splash', .12);
        }
        if (b.age > BURST_SECONDS + .1) {b.img.remove(); bursts.splice(i, 1); continue;}
        const at = game.screenPoint({x: b.x + HULL.x, y: b.y + HULL.y}), width = BURST_WIDTH * BURST_SCALE * game.camera.zoom;
        Object.assign(b.img.style, {width: `${width}px`, left: `${at.x - width / 2}px`, top: `${at.y - width * BURST_CLOUD / BURST_WIDTH}px`});
      }
    },
    destroy() {
      disposed = true;
      clear();
      for (const p of picking.splice(0)) p.root.destroy({children: true});
      for (const b of bursts.splice(0)) b.img.remove();
      kit.remove();
      room.onBoatBuilt = null;
    },
  };
}
