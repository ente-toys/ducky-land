// The approved Rive Ducky inside the PixiJS island (boss 3 Nov: Pixi world, Rive Ducky).
// One hidden WebGL2 canvas holds an atlas: every frame each visible Ducky's Rive artboard is drawn into its own
// cell, and its Pixi sprite shows that cell, so Duckies still depth-sort with trees and benches like any sprite.
// Same interface as duck.js: createDuck() -> {root, update, dispose, setOutfit, animationNames}.
import RiveCanvas from '@rive-app/webgl2-advanced';
import {Container, Rectangle, Sprite, Texture} from 'pixi.js';
import {createDuckFeedback} from './feedback.js';

export const duckAnimationNames = Object.freeze({0:'idle',1:'walk',2:'quack',3:'dance',4:'heart',5:'laugh',6:'wave',7:'sleep',8:'grumpy',9:'party'});
const RIV = '/rive/ducky.riv', WASM = '/rive/rive.wasm';
// Rig units: the Ducky spans about x -360..353 and y -776..161 around its feet.
const RIG = {left:-370, top:-800, width:740, height:980};
const CELL_W = 240, CELL_H = Math.round(CELL_W * RIG.height / RIG.width), COLS = 8, ROWS = 4;
const WORLD_SCALE = .24;   // rig units -> world units, sized to the island's paths and benches
const WALKS = new Set([1, 14, 15]);
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;

let shared, ready = null, live = 0;
async function atlas() {
  if (shared) return shared;
  shared = (async () => {
    const rive = await RiveCanvas({locateFile: () => WASM});
    const bytes = await fetch(RIV).then(r => {if (!r.ok) throw new Error(`Ducky rig: HTTP ${r.status}`); return r.arrayBuffer();});
    const file = await rive.load(new Uint8Array(bytes));
    const canvas = document.createElement('canvas');
    canvas.width = CELL_W * COLS; canvas.height = CELL_H * ROWS;
    const renderer = rive.makeRenderer(canvas, true);
    const texture = Texture.from(canvas);
    const cells = Array.from({length: COLS * ROWS}, (_, i) => i);
    ready = {rive, file, canvas, renderer, texture, cells, ducks: new Set(), model: file.viewModelByName('DuckyVM')};
    window.__duckAtlas = ready;   // read-only diagnostics
    return ready;
  })();
  return shared;
}

/** Draws every visible Ducky into the atlas. Call once per frame, before the Pixi render. */
export function renderDuckAtlas() {
  const a = ready;
  if (!a) return;
  a.renderer.clear();
  for (const duck of a.ducks) duck.draw();
  a.renderer.flush();
  a.rive.resolveAnimationFrame();
  a.texture.source.update();
}

export async function disposeDuckAssets() {return !live;}
export async function getDuckWardrobe() {return [];}

export async function createDuck({seed = 0, isPlayer = false} = {}) {
  live++;
  const a = await atlas();
  const cell = a.cells.shift();
  if (cell === undefined) {live--; throw new Error('Ducky atlas is full');}
  const {rive, file} = a;
  const art = file.artboardByName('Ducky'); art.frameOrigin = false;
  const vm = a.model.instance(), sm = new rive.StateMachineInstance(art.stateMachineByName('Ducky'), art);
  art.bindViewModelInstance(vm); sm.bindViewModelInstance(vm);
  const c = {};
  for (const key of ['action','cap','shades','acc','shoes','city','facing','turn','isPlayer','tagVisible','arrival']) c[key] = vm.number(key);
  for (const [k, v] of Object.entries({cap:0, shades:0, acc:0, shoes:0, city:0, tagVisible:0, arrival:1, isPlayer:isPlayer ? 1 : 0, action:0, facing:1, turn:405})) if (c[k]) c[k].value = v;
  sm.advanceAndApply(0); art.advance(0);

  const cx = (cell % COLS) * CELL_W, cy = Math.floor(cell / COLS) * CELL_H, k = CELL_W / RIG.width;
  const frame = new Texture({source: a.texture.source, frame: new Rectangle(cx, cy, CELL_W, CELL_H)});
  const root = new Container({label:'Ducky'});
  const sprite = new Sprite(frame);
  // place the cell so the rig's feet (0,0) land on the root's origin
  sprite.scale.set(WORLD_SCALE / k);
  sprite.position.set(RIG.left * WORLD_SCALE, RIG.top * WORLD_SCALE);
  root.addChild(sprite);
  // Ashwin's emote bubbles and sleep Zzz stay as Pixi overlays; the rig draws its own player ring.
  const feedback = createDuckFeedback(false), overlay = new Container();
  overlay.scale.set(WORLD_SCALE * 1.15); overlay.addChild(feedback.bubble, feedback.sleep); root.addChild(overlay);

  const mat = new rive.Mat2D();
  let shown, turn = 0, action = 0, actionTime = 0, version, disposed = false;
  const self = {
    root, art,
    draw() {
      if (!root.visible) return;   // the engine culls off-screen Duckies by root.visible
      Object.assign(mat, {xx: k, xy: 0, yx: 0, yy: k, tx: cx - RIG.left * k, ty: cy - RIG.top * k});
      a.renderer.save(); a.renderer.transform(mat); art.draw(a.renderer); a.renderer.restore();
    },
  };
  a.ducks.add(self);

  function update(dt, {action: next = 0, turn: heading = 0, reducedMotion = false, emoteVersion} = {}) {
    if (disposed) return;
    dt = Math.max(0, Math.min(.1, Number.isFinite(dt) ? dt : 0));
    const chosen = Number.isInteger(+next) && +next >= 0 && +next <= 9 ? +next : 0;
    if (chosen !== action || (emoteVersion !== undefined && emoteVersion !== version)) {action = chosen; actionTime = 0; version = emoteVersion;}
    actionTime += dt;
    // Boss 2 Nov: only the 45 and 135 degree three-quarter views, so both eyes and the beak always show.
    turn += angleDiff(heading * 180 / Math.PI, turn) * (1 - Math.exp(-dt / .075));
    const raw = ((turn + 180) % 360 + 360) % 360 - 180, side = raw < 0 ? -1 : 1;
    const goal = side * (WALKS.has(action) && Math.abs(raw) > 90 ? 135 : 45);
    if (shown === undefined) shown = goal;
    shown += angleDiff(goal, shown) * (1 - Math.exp(-12 * dt));
    // Sleep keeps the plain idle for now (the old sleep pose squashes the final Ducky); others use the soft quack/dance.
    let rigAction = action === 7 ? 0 : action;
    if (!isPlayer && (rigAction === 2 || rigAction === 3)) rigAction += 14;
    c.action.value = rigAction; c.facing.value = shown < 0 ? -1 : 1; c.turn.value = shown + 360;
    sm.advanceAndApply(reducedMotion ? dt * .5 : dt); art.advance(reducedMotion ? dt * .5 : dt);
    feedback.update(action, actionTime, reducedMotion, false);
    root.duckDirection = shown;
  }
  function dispose() {
    if (disposed) return; disposed = true; live--;
    a.ducks.delete(self); a.cells.push(cell);
    sm.delete(); vm.delete(); art.delete(); mat.delete?.();
    root.removeFromParent(); root.destroy({children: true});
  }
  update(0);
  return {root, update, dispose, setOutfit: async () => {}, animationNames: duckAnimationNames};
}
