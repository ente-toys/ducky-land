import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {Gestures, movePinch, screenToWorld} from '../src/pixi/camera.js';

test('pinch keeps its world anchor while translating, zooming, and hitting zoom limits', () => {
  for (const ratio of [.01, .6, 1.8, 30]) {
    const camera = {x: 2820, y: 2410, zoom: .6};
    const before = [{x: 100, y: 180}, {x: 300, y: 280}];
    const after = [{x: 260-100*ratio, y: 300-50*ratio}, {x: 260+100*ratio, y: 300+50*ratio}];
    const anchor = screenToWorld(camera, {x: 200, y: 230}, 390, 844);
    movePinch(camera, before, after, .1, 1.65, 390, 844);
    const result = screenToWorld(camera, {x: 260, y: 300}, 390, 844);
    assert.ok(Math.abs(result.x-anchor.x)<1e-8 && Math.abs(result.y-anchor.y)<1e-8);
    assert.ok(camera.zoom>=.1 && camera.zoom<=1.65);
  }
});

test('cancelled, dragged, and multi-touch pointers never become taps', () => {
  const gestures = new Gestures();
  gestures.down(1, {x: 100, y: 100});
  gestures.move(1, {x: 104, y: 102});
  assert.deepEqual(gestures.up(1), {x: 104, y: 102});
  gestures.down(1, {x: 100, y: 100});
  gestures.move(1, {x: 120, y: 100});
  gestures.move(1, {x: 100, y: 100});
  assert.equal(gestures.up(1), null);
  gestures.down(1, {x: 100, y: 100});
  gestures.down(2, {x: 110, y: 100});
  assert.equal(gestures.up(2), null);
  assert.equal(gestures.up(1), null);
  gestures.down(3, {x: 100, y: 100});
  assert.equal(gestures.up(3, true), null);
  gestures.down(1, {x: 100, y: 100});
  gestures.clear();
  assert.equal(gestures.up(1), null);
});

test('original island art has complete placements, valid clipped SVGs and GPU-safe ground tiles', () => {
  const art = JSON.parse(readFileSync(new URL('../src/pixi/art-manifest.json', import.meta.url)));
  const world = JSON.parse(readFileSync(new URL('../rive/web/world.json', import.meta.url)));
  assert.equal(art.props.length, world.props.length);
  const parser = new (new JSDOM('').window.DOMParser)();
  for (const item of [...art.props, ...art.ground.tiles]) {
    const text = readFileSync(new URL(`../public${item.src}`, import.meta.url), 'utf8');
    const svg = parser.parseFromString(text, 'image/svg+xml');
    assert.equal(svg.querySelector('parsererror'), null, item.src);
    assert.ok(svg.querySelector('path,ellipse,rect'), item.src);
    assert.ok(item.width > 0 && item.height > 0);
    for (const match of text.matchAll(/url\(#([^\)]+)\)/g)) assert.ok(svg.getElementById(match[1]), `${item.src}: missing clip ${match[1]}`);
  }
  for (const [i, prop] of art.props.entries()) {
    assert.equal(prop.artboard, world.props[i].artboard);
    assert.equal(prop.x, world.props[i].x);
    assert.equal(prop.y, world.props[i].y);
    assert.ok(Number.isFinite(prop.anchor.x) && Number.isFinite(prop.anchor.y));
  }
  let area = 0;
  for (const tile of art.ground.tiles) {
    assert.ok(tile.width <= 1536 && tile.height <= 1536);
    area += tile.width * tile.height;
  }
  assert.equal(area, world.width * world.height);
});
