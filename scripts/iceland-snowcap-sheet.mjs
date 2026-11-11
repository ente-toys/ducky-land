// Render the real rig and snow Graphics, using Pixi's software canvas renderer.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {createCanvas, loadImage, Canvas} from '@napi-rs/canvas';
import sharp from 'sharp';
import {svgPathProperties} from '/private/tmp/boat48-browser/node_modules/svg-path-properties/dist/main.mjs';
import {Assets, Container, Texture, CanvasSource, DOMAdapter} from 'pixi.js';
import {CanvasRenderer} from '../node_modules/pixi.js/lib/rendering/renderers/canvas/CanvasRenderer.mjs';

const out = '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/iceland-final/check';
const dom = new JSDOM('<body></body>', {url: 'http://localhost/'});
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.DOMParser = dom.window.DOMParser;
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
Object.defineProperty(globalThis, 'navigator', {value: dom.window.navigator, configurable: true});
dom.window.SVGElement.prototype.getTotalLength = function() {return new svgPathProperties(this.getAttribute('d')).getTotalLength();};
dom.window.SVGElement.prototype.getPointAtLength = function(n) {return new svgPathProperties(this.getAttribute('d')).getPointAtLength(n);};
function canvas(w = 1, h = 1) {
  const c = createCanvas(w, h); c.style = {}; c.addEventListener = () => {}; c.removeEventListener = () => {}; return c;
}
const createElement = document.createElement.bind(document);
document.createElement = (tag, ...args) => tag === 'canvas' ? canvas() : createElement(tag, ...args);
DOMAdapter.set({createCanvas: canvas, createImage: () => null,
  getCanvasRenderingContext2D: () => canvas().getContext('2d').constructor, getWebGLRenderingContext: () => null,
  getNavigator: () => navigator, getBaseUrl: () => dom.window.location.href, getFontFaceSet: () => document.fonts,
  fetch: (...args) => fetch(...args), parseXML: s => new DOMParser().parseFromString(s, 'text/xml')});
globalThis.HTMLCanvasElement = Canvas;
const contains = document.body.contains.bind(document.body);
document.body.contains = n => n instanceof dom.window.Node ? contains(n) : true;
globalThis.fetch = async url => {
  const data = readFileSync(path.resolve('public', String(url).replace(/^\//, '')));
  return {ok: true, text: async () => data.toString(), json: async () => JSON.parse(data)};
};
const cache = new Map();
Assets.get = url => cache.get(url);
Assets.unload = async () => {};
Assets.load = async req => {
  const url = typeof req === 'string' ? req : req.src;
  if (cache.has(url)) return cache.get(url);
  const resolution = req.data?.resolution ?? 1;
  const im = await loadImage(await sharp(readFileSync('public' + url), {density: 72 * resolution}).png().toBuffer());
  const c = canvas(im.width, im.height); c.getContext('2d').drawImage(im, 0, 0);
  const t = new Texture({source: new CanvasSource({resource: c, resolution})}); cache.set(url, t); return t;
};
const {outputFiles: [bundle]} = await build({entryPoints: ['src/pixi/duck.js'], bundle: true, packages: 'external', format: 'esm', write: false});
const code = bundle.text.replaceAll('"pixi.js"', JSON.stringify(import.meta.resolve('pixi.js')));
const {createDuck} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const W = 1280, cellW = 320, cellH = 220;
const rows = [
  ...['nod', 'leaf', 'wing', 'hammock', 'rock', 'book', 'chair', 'box'].map(pose => ({name: 'Sleep ' + pose, sleep: {pose}})),
  ...[{}, {cap: 1}, {cap: 8}].flatMap(outfit => Array.from({length: 8}, (_, i) => ({name: `${outfit.cap ? 'Hat ' + outfit.cap : 'Player'} / ${i * 45}°`, outfit, turn: i * Math.PI / 4}))),
];
const H = 62 + rows.length * cellH, sheet = canvas(W, H), ctx = sheet.getContext('2d');
ctx.fillStyle = '#c0d6df'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#232323'; ctx.font = 'bold 22px Arial';
for (let stage = 1; stage <= 4; stage++) ctx.fillText('Snow ' + stage, (stage - 1) * cellW + 16, 32);
const renderer = new CanvasRenderer(), output = canvas(cellW, cellH - 30);
await renderer.init({canvas: output, width: cellW, height: cellH - 30, resolution: 1, background: 0xc0d6df,
  antialias: true, manageImports: false, eventFeatures: {move: false, globalMove: false, click: false, wheel: false}});
for (const [row, spec] of rows.entries()) {
  const rig = await createDuck({...spec, seed: 41, outfit: spec.outfit || {}}), scene = new Container(); scene.addChild(rig.root);
  for (let i = 0; i < 120; i++) rig.update(1 / 60, {turn: spec.turn || 0, time: 80, reducedMotion: true});
  rig.trackSnow(80, 'snow', 0, 0, true); rig.trackSnow(85, 'snow', 0, 0, true);
  const bounds = rig.root.getLocalBounds(), k = Math.min(225 / bounds.width, 158 / bounds.height);
  rig.root.scale.set(k); rig.root.position.set(cellW / 2 - (bounds.x + bounds.width / 2) * k, 174 - (bounds.y + bounds.height) * k);
  for (let stage = 1; stage <= 4; stage++) {
    rig.snowCover.state.stage = stage; rig.update(0, {turn: spec.turn || 0, time: 80, reducedMotion: true});
    renderer.render(scene); const x = (stage - 1) * cellW, y = 62 + row * cellH;
    ctx.drawImage(output, x, y + 28); ctx.font = '17px Arial'; ctx.fillStyle = '#232323'; ctx.fillText(spec.name, x + 14, y + 21);
  }
  rig.dispose(); scene.destroy();
}
mkdirSync(out, {recursive: true}); writeFileSync(out + '/snowcap-sheet.png', sheet.toBuffer('image/png'));
renderer.destroy(); console.log(out + '/snowcap-sheet.png');
