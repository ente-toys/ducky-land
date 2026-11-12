import {Assets, Sprite} from 'pixi.js';
import {ART_TEXTURE} from './art/art-texture.js';
import {HARBOR} from '../../gameplay/islands.js';

let boardSource;
const signLeases = new Map();
function acquireSign(name) {
  let entry = signLeases.get(name);
  if (!entry) {
    entry = {count: 0, src: null};
    entry.promise = signTexture(name, entry);
    signLeases.set(name, entry);
  }
  entry.count++;
  return entry.promise;
}
function releaseSign(name) {
  const entry = signLeases.get(name);
  if (!entry || --entry.count) return;
  entry.promise.finally(() => {
    if (entry.count || signLeases.get(name) !== entry) return;
    signLeases.delete(name);
    if (entry.src) Assets.unload(entry.src).catch(() => {});
  }).catch(() => {});
}
const smooth = (a, b, x) => {const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t);};
const SIGN = {dx: 150, dy: 30, rest: 1.3, big: 2.3};

async function signTexture(name, entry) {
  boardSource ??= fetch('/pixi-art/prop-82.svg').then(response => {
    if (!response.ok) throw Error(`Island sign: HTTP ${response.status}`);
    return response.text();
  }).catch(error => {boardSource = null; throw error;});
  let svg = await boardSource;
  svg = svg.replace(/<text([^>]*?)x="[^"]*"/, '<text$1x="0" text-anchor="middle"').replace(/font-size="22"([^>]*)>LITTLE ISLE</, `font-size="20"$1>${name.toUpperCase()}<`);
  entry.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return Assets.load({src: entry.src, data: {resolution: 3, ...ART_TEXTURE}});
}

const revealed = new Set();
const easeBack = p => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

export async function createSea(water, objects) {
  const signs = new Map();
  let boards = [], token = 0, disposed = false;
  return {
    transient: () => boards.map(board => board.sprite),
    dispose() {
      if (disposed) return;
      disposed = true; token++;
      for (const board of boards) board.sprite.destroy();
      boards = [];
      for (const name of signs.keys()) releaseSign(name);
      signs.clear();
    },
    async switchIsland(destinations) {
      if (disposed) return;
      const mine = ++token;
      for (const board of boards) board.sprite.destroy();
      boards = [];
      const built = await Promise.all(destinations.map(async destination => {
        if (!signs.has(destination.name)) signs.set(destination.name, acquireSign(destination.name));
        const sprite = new Sprite(await signs.get(destination.name));
        sprite.anchor.set(129 / 258, 120 / 129);
        const land = destination.land ?? {x: HARBOR.land.x + destination.offset.x, y: HARBOR.land.y + destination.offset.y};
        const x = land.x + SIGN.dx, y = land.y + SIGN.dy;
        sprite.position.set(x, y); sprite.zIndex = y; sprite.visible = false;
        return {sprite, x, y, id: destination.destination, revealAt: revealed.has(destination.destination) ? -1 : null};
      }));
      if (mine !== token) {for (const board of built) board.sprite.destroy(); return;}
      for (const board of built) objects.addChild(board.sprite);
      boards = built;
    },
    update(t, reduced, visible, player, camera) {
      const anchor = player || camera;
      for (const board of boards) {
        const near = anchor ? smooth(1800, 900, Math.hypot(anchor.x - board.x, anchor.y - board.y)) : 0;
        if (board.revealAt === null && near > .35) {board.revealAt = t; revealed.add(board.id);}
        const b = board.sprite;
        b.visible = visible(board.x, board.y - 100, 400) && board.revealAt !== null;
        if (!b.visible) continue;
        const age = board.revealAt < 0 ? 99 : t - board.revealAt, k = SIGN.rest;
        let scale = k, alpha = 1;
        if (reduced) alpha = Math.min(1, age / .4);
        else if (age < .4) {scale = SIGN.big * easeBack(age / .4); alpha = Math.min(1, age / .4);}
        else if (age < 2.2) scale = SIGN.big;
        else if (age < 2.8) {const p = (age - 2.2) / .6, e = p * p * (3 - 2 * p); scale = SIGN.big + (k - SIGN.big) * e;}
        b.scale.set(Math.max(.001, scale)); b.alpha = alpha;
        b.zIndex = board.y + (scale > k + .01 ? 5000 : 0);
      }
    },
  };
}
