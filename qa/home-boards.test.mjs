import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {fileURLToPath} from 'node:url';
import E from '../src/world/home/home-expansion.json' with {type:'json'};
import {HOME_MAP} from '../src/world/island-maps.js';
import {inShape} from '../assets/world/island-geometry.mjs';

// Test the resolved production placements, including original props, layout edits,
// home-extra-props and expansion.reviewProps, rather than just one JSON source.
const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({root, configFile:false, cacheDir:'/private/tmp/home-boards-test',
  optimizeDeps:{noDiscovery:true}, server:{middlewareMode:true, hmr:false, ws:false, watch:null}, logLevel:'error'});
let props, decks, tiles, flats;
try {
  const P = await vite.ssrLoadModule('/src/world/home/placements.js');
  props = P.createPlacements();
  decks = [...P.JETTIES, ...P.HOME_DECKS];
  tiles = P.HOME_TILES;
  flats = [...P.homeDecals(props), ...P.HOME_GROUND_DECALS];
} finally {await vite.close();}

const boardLike = p => /(?:^|[-_ /])(?:boards?|planks?|decks?|docks?|jett(?:y|ies)|bridges?|signs?|wayfinding)(?:$|[-_ /])/i
  .test([p.name, p.asset, p.src].join(' '));
const boards = props.filter(boardLike);
const box = p => {
  const w = p.width * (p.scale ?? 1), h = p.height * (p.scale ?? 1);
  const x = p.x - w * (p.anchor?.x ?? 0), y = p.y - h * (p.anchor?.y ?? 0);
  return {x, y, w, h};
};
const overlaps = (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
const fishing = E.decks.find(d => d.src.endsWith('/fishing-deck.svg'));
const crossings = E.homeArches.map(a => {
  const d = decks.find(d => d.id === a.id);
  assert.ok(d, `${a.id} retains its approved SVG deck`);
  return d;
});

test('Home ground SVGs and the pond flat contain no stray timber decks baked into their paint', () => {
  // These are the filled timber colours/patterns used by the retired flat
  // jetties. Brown reed strokes are vegetation, not deck surfaces.
  const timber = /^(?:#(?:885931|c88941|af6734|d58e50|a45f32|89502c|714323)|url\(#(?:boardwalk|ground-material-(?:af6734|d58e50)))/i;
  const artRoot = new URL('../public/pixi-art/', import.meta.url);
  const files = tiles.map(t=>new URL('../public'+t.src,import.meta.url));
  files.push(new URL('lake-race.svg',artRoot));
  for (const src of new Set(flats.filter(p=>!p.groundCloth).map(p=>p.src))) files.push(new URL('../public'+src,import.meta.url));
  for (const file of files) {
    const svg = new DOMParser().parseFromString(readFileSync(file,'utf8'),'image/svg+xml');
    for (const node of Array.from(svg.getElementsByTagName('*'))) {
      assert.equal(timber.test(node.getAttribute('fill') || ''), false, `${file.pathname}: timber fill ${node.getAttribute('fill')}`);
    }
  }
  assert.ok(tiles.every(t=>!t.src.endsWith('/ground.svg')), 'retired monolithic ground with baked boardwalks is never rendered');
  const lake = readFileSync(new URL('lake-race.svg',artRoot),'utf8');
  assert.ok(!lake.includes('translate(-215 245)'), 'the photographed dry-land jetty group is removed');
  assert.ok(lake.includes('translate(330 -252)'), 'pond spring rocks are preserved');
});

test('Home has no loose board props on any of its ten bridges or fishing jetty', () => {
  assert.equal(crossings.length, 10, 'audit every crossing');
  assert.ok(fishing, 'audit the harbour jetty too');
  for (const p of boards) for (const deck of [...crossings, fishing]) {
    assert.equal(overlaps(box(p), box(deck)), false, `${p.id} overlaps ${deck.id ?? deck.src}`);
  }
  assert.equal(props.some(p => String(p.id) === '16'), false, 'old pond bridge is not drawn on the replacement');
  assert.equal(props.some(p => /^Wayfinding\b/i.test(p.name)), false, 'old name boards stay removed');
});

test('Home has no lone board or flat dock on open land', () => {
  // The only purposeful upright signs are part of the two authored telescope
  // scenes. A new board must have an actual purpose before being added here.
  const expected = new Set(['home-hill-northeast-star-sign', 'home-hill-southwest-star-sign']);
  assert.deepEqual(new Set(boards.map(p => p.id)), expected);
  for (const p of boards) {
    const telescope = props.find(q => q.name === 'stargazing-telescope' && Math.hypot(q.x-p.x,q.y-p.y) < 300);
    assert.ok(telescope, `${p.id} belongs beside a telescope`);
    assert.ok(!HOME_MAP.walk.water.some(w => inShape(p.x,p.y,w)), `${p.id} stands on dry ground`);
    assert.ok(p.footprint && !HOME_MAP.nav().walkable(p.footprint.x,p.footprint.y), `${p.id} has a grounded solid post`);
  }
  assert.equal(decks.length, crossings.length + 1, 'only approved bridges and the fishing dock remain');
  assert.equal(decks.some(d => /pond-jetty|dock-piece/.test(d.src)), false, 'retired flat planks stay removed');
  for (const d of decks.filter(d => !E.homeArches.some(a => a.id === d.id))) {
    assert.equal(d.src, fishing.src, 'no unaccounted standalone deck');
    const mid = [E.jetty.foot[0], (E.jetty.foot[1] + E.jetty.tip[1])/2];
    assert.ok(overlaps(box(d), {x:mid[0]-1,y:mid[1]-1,w:2,h:2}), 'fishing deck remains at its harbour');
  }
});

test('every Home bridge and the fishing jetty retain walkable central decks', () => {
  const nav = HOME_MAP.nav();
  for (const a of E.homeArches) for (const t of [.25, .5, .75]) {
    const p = [a.a[0]+(a.b[0]-a.a[0])*t, a.a[1]+(a.b[1]-a.a[1])*t];
    assert.ok(nav.walkable(...p), `${a.id} walkway at ${t}`);
  }
  const p = [E.jetty.foot[0], (E.jetty.foot[1]+E.jetty.tip[1])/2];
  assert.ok(nav.walkable(...p), 'fishing jetty remains usable');
  for (const d of decks) {
    const svg = readFileSync(new URL('../public'+d.src,import.meta.url),'utf8');
    assert.ok(!/<(?:image|linearGradient|radialGradient)\b/.test(svg), `${d.src} stays flat SVG art`);
  }
});
