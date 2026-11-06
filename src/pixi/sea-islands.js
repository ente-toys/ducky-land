// boss 5 Nov: the islands you can sail to are real copies of ours now (archipelago.js draws them at their true places),
// so the sea only adds each neighbour's name board: it stands on that island's jetty and pops up once as you sail close.
import {Assets, Sprite} from 'pixi.js';
import {HARBOR} from './islands.js';

const svgTexture = (svg, resolution = 1) => Assets.load({src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), data: {resolution}});
const smooth = (a, b, x) => {const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t);};
const SIGN = {dx: 150, dy: 30, rest: 1.3, big: 2.3};   // on the neighbour's jetty deck, just east of where you land

async function signTexture(name) {
  // The home wayfinding board (prop-82, LITTLE ISLE) with this island's name, centred, in its own Gilroy.
  let svg = await (await fetch('/pixi-art/prop-82.svg')).text();
  svg = svg.replace(/<text([^>]*?)x="[^"]*"/, '<text$1x="0" text-anchor="middle"').replace(/font-size="22"([^>]*)>LITTLE ISLE</, `font-size="20"$1>${name.toUpperCase()}<`);
  return svgTexture(svg, 3);
}

const revealed = new Set();   // a name pops once per visit to the page; after that the sign just stands there
const easeBack = p => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;

export async function createSea(water, objects) {
  const signs = new Map();
  let boards = [], token = 0;
  return {
    transient: () => boards.map(board => board.sprite),
    async switchIsland(destinations) {
      const mine = ++token;
      for (const board of boards) board.sprite.destroy();
      boards = [];
      const built = await Promise.all(destinations.map(async destination => {
        if (!signs.has(destination.name)) signs.set(destination.name, signTexture(destination.name));
        const sprite = new Sprite(await signs.get(destination.name));
        sprite.anchor.set(129 / 258, 120 / 129);   // prop-82's post foot
        const land = destination.land ?? {x: HARBOR.land.x + destination.offset.x, y: HARBOR.land.y + destination.offset.y};   // that island's own jetty
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
        // first time: pops (scale + fade, .4 s), holds big, then settles on its post
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
