import {Assets, Container, Graphics, Rectangle, Sprite, Texture} from 'pixi.js';
import {startJump,jumpPose} from '../../gameplay/player-motion.js';
import {MUSEUM_BENCHES, benchBox, benchAnchor, benchFootprint, benchFile} from '../../world/home/museum-benches.js';

const SRC = '/pixi-art/interiors/museum.svg', W = 1536, H = 1024;
const FLOOR = {x: 768, y: 1100, rx: 1500, ry: 760};
const BENCH_BOXES = MUSEUM_BENCHES.map(benchBox);
const PIECES = [...BENCH_BOXES,
  [462, 276, 578, 420], [942, 276, 1058, 420], [32, 784, 158, 958], [1362, 784, 1508, 958],
  [582, 336, 952, 466]];
const DEPTH = [...MUSEUM_BENCHES.map(b => benchAnchor(b)[1]), ...PIECES.slice(MUSEUM_BENCHES.length).map(p => p[3] - 12)];
const PIECE_ART = [...MUSEUM_BENCHES.map(benchFile), 'plant-1', 'plant-2', 'plant-3', 'plant-4', 'rope'].map(n => `/pixi-art/interiors/pieces/${n}.svg`);
const ARCH = [556, 786, 984, 1024];
const BLOCKS = [...PIECES.slice(MUSEUM_BENCHES.length, -1).map(([x0, y0, x1, y1]) => [x0 - 6, y1 - 34, x1 + 6, y1 + 4]), [582, 400, 952, 505],
  [560, 940, 652, 1024], [890, 940, 980, 1024]];
const BENCH_FEET = MUSEUM_BENCHES.map(benchFootprint);
const inPoly = (x, y, poly) => {let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;} return c;};
const DOOR = {x: 770, y: 985}, ARRIVE = {x: 770, y: 700};
const EXIT = (x, y) => y > 935 && x > 652 && x < 890;
const VIEW = {x: 770, y: 530, x0: 640, x1: 900, y0: 500, y1: 600};
const SPEED = 330, DUCK_SCALE = .62;
const MONA = {src: '/pixi-art/interiors/monalisa.svg', slot: [673, 83, 188, 159], view: [78, 205, 444], eyes: [{cx: 252, cy: 317}, {cx: 341, cy: 325}], viewW: 600};

const inside = (x, y) => ((x - FLOOR.x) / FLOOR.rx) ** 2 + ((y - FLOOR.y) / FLOOR.ry) ** 2 < 1 && y < H - 4 && x > 20 && x < W - 20;
const walkable = (x, y) => inside(x, y) && !BLOCKS.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1) && !BENCH_FEET.some(p => inPoly(x, y, p)) || EXIT(x, y) && y < H + 40;

export async function createInterior() {
  const [texture, pieceTex, monaTex] = await Promise.all([
    Assets.load({src: SRC, data: {resolution: 2}}),
    Promise.all([...PIECE_ART, '/pixi-art/interiors/pieces/arch.svg'].map(src => Assets.load({src, data: {resolution: 2}}))),
    Assets.load({src: MONA.src, data: {resolution: 3}}),
  ]);
  const root = new Container({label: 'Museum interior', visible: false}), room = new Container({sortableChildren: true});
  root.addChild(room);
  room.addChild(new Sprite(texture));
  PIECES.forEach(([x0, y0, x1, y1], k) => {
    const t = pieceTex[k], sc = t.width / W;
    const piece = new Sprite(new Texture({source: t.source, frame: new Rectangle(x0 * sc, y0 * sc, (x1 - x0) * sc, (y1 - y0) * sc)}));
    piece.position.set(x0, y0); piece.scale.set(1 / sc); piece.zIndex = DEPTH[k]; room.addChild(piece);
  });
  const at = pieceTex.at(-1), asc = at.width / W;
  const arch = new Sprite(new Texture({source: at.source, frame: new Rectangle(ARCH[0] * asc, ARCH[1] * asc, (ARCH[2] - ARCH[0]) * asc, (ARCH[3] - ARCH[1]) * asc)}));
  arch.position.set(ARCH[0], ARCH[1]); arch.scale.set(1 / asc); arch.zIndex = 4000; room.addChild(arch);
  const ground = new Graphics().rect(-4000, -4000, W + 8000, H + 8000).fill(0xFDE197); ground.zIndex = -1; room.addChild(ground);
  const [sx, sy, sw, sh] = MONA.slot, [vx, vy, vw] = MONA.view, ms = sw / vw, mx = sx - vx * ms, my = sy - vy * ms;
  const mona = new Container(); mona.zIndex = 1;
  room.addChild(mona);
  const clip = new Graphics().rect(sx, sy, sw, sh).fill(0xffffff); mona.addChild(clip); mona.mask = clip;
  const monaArt = new Sprite(monaTex); monaArt.position.set(mx, my); monaArt.scale.set(ms * MONA.viewW / monaTex.width); mona.addChild(monaArt);
  const eyes = MONA.eyes.map(e => {
    const x = mx + e.cx * ms, y = my + e.cy * ms, g = new Container();
    const mask = new Graphics().ellipse(x, y, 13 * ms, 15 * ms).fill(0xffffff);
    const pupil = new Graphics().ellipse(0, 0, 8 * ms, 10 * ms).fill(0x232323); pupil.position.set(x, y);
    const lid = new Graphics().rect(-16 * ms, -18 * ms, 32 * ms, 36 * ms).fill(0xFFD525); lid.position.set(x, y - 36 * ms);
    g.addChild(pupil, lid, mask); pupil.mask = mask; lid.mask = mask; mona.addChild(g);
    return {x, y, pupil, lid, lx: 0, ly: 0};
  });
  let blinkT = 2 + Math.random() * 3, blink = 0, twice = false;
  function eyesUpdate(dt, reduced) {
    for (const e of eyes) {
      const dx = me.x - e.x, dy = (me.y - 90) - e.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 300) * 4.5 * ms;
      e.lx += (dx / d * k - e.lx) * Math.min(1, dt * 6); e.ly += (dy / d * k - e.ly) * Math.min(1, dt * 6);
      e.pupil.position.set(e.x + e.lx, e.y + e.ly + 1 * ms);
    }
    blinkT -= dt;
    if (blinkT <= 0 && !blink) {blink = .16; twice = Math.random() < .25;}
    if (blink) {blink -= dt; if (blink <= 0) {blink = 0; if (twice) {twice = false; blinkT = .18;} else blinkT = (reduced ? 6 : 3) + Math.random() * 3;}}
    const shut = blink ? Math.sin((1 - blink / .16) * Math.PI) : 0;
    for (const e of eyes) e.lid.y = e.y - 36 * ms + shut * 33 * ms;
  }
  const heart = new Graphics().moveTo(0, 6).bezierCurveTo(-14, -6, -8, -18, 0, -9).bezierCurveTo(8, -18, 14, -6, 0, 6).fill(0xF16E4B).stroke({color: 0x39472D, width: 2.5});
  heart.visible = false; heart.zIndex = 5000; room.addChild(heart);
  const fade = new Graphics().rect(0, 0, 1, 1).fill(0xFDE197); fade.alpha = 0;
  root.addChild(fade);
  const me = {x: DOOR.x, y: DOOR.y, turn: Math.PI, path: null, travel: 0, action: 0, hearted: false, heartT: 0, inside: false};
  let rig = null, scale = 1, ox = 0, oy = 0, fadeT = 0, leaving = null;

  function layout(width, height) {
    scale = Math.min(Math.max(width / W, height / H), width / W * 1.25);
    fade.width = width; fade.height = height;
    const fit = (view, size, at) => size * scale <= view ? (view - size * scale) / 2 : Math.min(0, Math.max(view - size * scale, view / 2 - at * scale));
    const cx = fit(width, W, me.x), cy = fit(height, H, me.y - 120);
    ox += ((Number.isFinite(cx) ? cx : 0) - ox) * .15; oy += ((Number.isFinite(cy) ? cy : 0) - oy) * .15;
    room.scale.set(scale); room.position.set(ox, oy);
  }

  function step(d, vx, vy, dt) {
    const len = Math.hypot(vx, vy); if (!len) return false;
    const dx = vx / len * SPEED * dt, dy = vy / len * SPEED * dt, x0 = d.x, y0 = d.y;
    if (walkable(d.x + dx, d.y + dy)) {d.x += dx; d.y += dy;}
    else {if (walkable(d.x + dx, d.y)) d.x += dx; if (walkable(d.x, d.y + dy)) d.y += dy;}
    const want = Math.atan2(vx, vy), delta = Math.atan2(Math.sin(want - d.turn), Math.cos(want - d.turn));
    d.turn += delta * (1 - Math.exp(-13 * dt));
    d.travel = Math.hypot(d.x - x0, d.y - y0) / dt;
    return d.travel > 1;
  }

  return {
    root,
    get active() {return root.visible;},
    enter(playerRig, width, height) {
      rig = playerRig; Object.assign(me, {x: DOOR.x, y: DOOR.y, turn: Math.PI, path: {...ARRIVE}, hearted: false, heartT: 0, inside: false,jumpLeft:0}); leaving = null;
      if (rig) {rig.root.parent?.removeChild(rig.root); rig.root.scale.set(DUCK_SCALE); rig.root.zIndex = 0; room.addChild(rig.root);}
      ox = 0; oy = 0; layout(width, height); ox = room.x; oy = room.y;
      root.visible = true; fadeT = 1; fade.alpha = 1;
    },
    update(dt, input, width, height, time, reduced) {
      if (!root.visible) return false;
      me.jumpLeft = Math.max(0,(me.jumpLeft ?? 0)-dt);
      if (leaving) {fadeT = Math.min(1, fadeT + dt * 4); fade.alpha = fadeT; if (fadeT >= 1) {root.visible = false; return leaving();} return false;}
      fadeT = Math.max(0, fadeT - dt * 3); fade.alpha = fadeT;
      me.travel = 0;
      let moving = false;
      if (input.x || input.y) {me.path = null; moving = step(me, input.x, input.y, dt);}
      else if (me.path) {
        const dx = me.path.x - me.x, dy = me.path.y - me.y;
        if (Math.hypot(dx, dy) < Math.max(5, SPEED * dt)) me.path = null;
        else if (!(moving = step(me, dx, dy, dt))) me.path = null;
      }
      me.action = moving ? 1 : 0;
      const atRope = me.x > VIEW.x0 && me.x < VIEW.x1 && me.y > VIEW.y0 && me.y < VIEW.y1;
      if (atRope && !me.hearted) {me.hearted = true; me.heartT = 0; me.path = null; me.turn = Math.PI;}
      if (!atRope && me.y > VIEW.y1 + 60) me.hearted = false;
      if (me.hearted && me.heartT < 1.6) {
        me.heartT += dt; const k = me.heartT / 1.6;
        heart.visible = true; heart.position.set(me.x, me.y - 150 - (reduced ? 0 : k * 40)); heart.scale.set(reduced ? 1.4 : 1 + Math.sin(Math.min(1, k * 4) * Math.PI / 2) * .5); heart.alpha = 1 - Math.max(0, k - .6) / .4;
      } else heart.visible = false;
      if (rig) {
        const hop = jumpPose(me.jumpLeft, reduced, {turn: me.turn, moving: me.travel > 20});
        rig.root.position.set(me.x, me.y-hop.lift); rig.root.zIndex = me.y; rig.update(dt, {action: me.action, speed: me.travel, turn: me.turn, time, reducedMotion: reduced, jump: hop});
      }
      eyesUpdate(dt, reduced);
      layout(width, height);
      if (me.y < 880) me.inside = true;
      return me.inside && EXIT(me.x, me.y) ? (leaving = () => true, false) : false;
    },
    jump() {return startJump(me);},
    tap(point) {
      const x = (point.x - room.x) / scale, y = (point.y - room.y) / scale;
      me.path = {x, y: Math.min(y, H + 20)};
    },
    leave(objects, worldScale) {
      if (rig) {room.removeChild(rig.root); rig.root.scale.set(worldScale); objects.addChild(rig.root); rig.root.upright = false;}
      rig = null; root.visible = false; fade.alpha = 0;
    },
    debug: () => ({x: Math.round(me.x), y: Math.round(me.y), hearted: me.hearted}),
  };
}
