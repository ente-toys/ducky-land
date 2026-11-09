// boss 6 Nov: themed islands go live on their own. Checks each theme folder against concepts/themes/THEME-CONTRACT.md
// and writes rive/web/themes/index.js, listing only the themes whose files are complete. A theme left out plays the home
// island in its place, so a half-drawn theme never breaks the game.
//   node scripts/theme-index.mjs            check and write the index once
//   node scripts/theme-index.mjs --check    print the report, write nothing
//   node scripts/theme-index.mjs --watch    keep checking every 4 s and rewrite when a theme becomes ready or changes
import {existsSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {makeMap, THEME_IDS} from '../src/pixi/island-maps.js';
import {resolveSleepSpots, sleepHalfWidths, sleepShapeProblems, SLEEP_TOTAL} from '../src/pixi/sleep-spots.js';
import {geometry} from '../rive/web/island-geometry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const DATA = theme => join(root, 'rive/web/themes', theme), ART = theme => join(root, 'public/pixi-art/themes', theme);
const INDEX = join(root, 'rive/web/themes/index.js');
const MAX = {width: 16000, height: 12000};   // boss 8 Nov: every island grows ~3x round its original (origin may go negative)   // boss 6 Nov: themed islands are BIGGER and spacious (world-map.js spaces every island by its own size)
const args = new Set(process.argv.slice(2));

const json = file => JSON.parse(readFileSync(file, 'utf8'));
const pt = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);

export function checkTheme(theme) {
  const problems = [], files = [];
  const need = file => {if (!existsSync(file)) {problems.push(`missing ${file.slice(root.length)}`); return false;} files.push(file); return true;};
  const read = file => {try {return json(file);} catch (e) {problems.push(`${file.slice(root.length)}: ${e.message}`); return null;}};
  const dataDir = DATA(theme), artDir = ART(theme);
  const world = need(join(dataDir, 'world.json')) ? read(join(dataDir, 'world.json')) : null;
  const harbor = need(join(dataDir, 'harbor.json')) ? read(join(dataDir, 'harbor.json')) : null;
  const walkFile = join(dataDir, 'walk-world.json'), walk = existsSync(walkFile) ? (files.push(walkFile), read(walkFile)) : null;
  const art = need(join(artDir, 'art.json')) ? read(join(artDir, 'art.json')) : null;
  if (world) {
    for (const key of ['width', 'height']) if (!(world[key] > 0)) problems.push(`world.json: ${key} missing`);
    if (world.width > MAX.width || world.height > MAX.height) problems.push(`world.json: ${world.width}x${world.height} is bigger than the 16000x12000 limit`);
    if (!Array.isArray(world.coast) || world.coast.length < 3 || !world.coast.every(pt)) problems.push('world.json: coast must be a list of [x,y] (3+)');
    for (const key of ['water', 'bridges', 'obstacles', 'islets', 'walkways']) if (!Array.isArray(world[key])) problems.push(`world.json: ${key} must be a list (may be [])`);
    if (!pt(world.zones?.plaza?.spawn) && !pt(harbor?.spawn)) problems.push('world.json: zones.plaza.spawn missing');
  }
  if (walk) for (const key of ['coast', 'obstacles', 'walkways', 'bridges', 'islets', 'water']) if (!Array.isArray(walk[key])) problems.push(`walk-world.json: ${key} must be a list`);
  if (harbor) {
    if (!pt(harbor.jetty?.foot) || !pt(harbor.jetty?.tip)) problems.push('harbor.json: jetty.foot and jetty.tip must be [x,y]');
    if (harbor.boats && !(Array.isArray(harbor.boats) && harbor.boats.every(b => Number.isFinite(b?.x) && Number.isFinite(b?.y)))) problems.push('harbor.json: boats must be [{x,y,turn}]');
    if (harbor.draft) problems.push('harbor.json: draft (held back on purpose)');
  }
  if (art) {
    if (!Array.isArray(art.ground?.tiles) || !art.ground.tiles.length) problems.push('art.json: ground.tiles missing');
    const all = [...(art.ground?.tiles ?? []), ...(art.decks ?? []), ...(art.flats ?? []), ...(art.props ?? []), ...(art.floating ?? [])];
    for (const item of all) {
      if (typeof item?.src !== 'string' || !(item.width > 0) || !(item.height > 0) || !Number.isFinite(item.x) || !Number.isFinite(item.y)) {problems.push(`art.json: bad entry ${JSON.stringify(item).slice(0, 80)}`); continue;}
      if (/^(\/|https?:)/.test(item.src)) {if (item.src.startsWith('/pixi-art/') && !existsSync(join(root, 'public', item.src))) problems.push(`art.json: missing ${item.src}`); continue;}
      if (!existsSync(join(artDir, item.src))) problems.push(`art.json: missing ${item.src}`);
      else files.push(join(artDir, item.src));
    }
  }
  if (!problems.length) {   // the shape is right: now does it play? (the same map object the game and the server build)
    try {
      const map = makeMap(theme, {world, walk, harbor, art: `/pixi-art/themes/${theme}/art.json`});
      const nav = map.nav();
      if (!nav.walkable(map.spawn.x, map.spawn.y)) problems.push(`spawn ${map.spawn.x},${map.spawn.y} is not walkable`);
      const {tip, dir} = map.JETTY, past = {x: tip.x + dir.x * 80, y: tip.y + dir.y * 80};
      if (map.landAt(past.x, past.y)) problems.push('the jetty tip does not reach open sea (80 past the tip is land)');
      const w = map.HARBOR.water, wet = (x, y) => !map.landAt(x, y) && Array.from({length: 16}, (_, i) => i * Math.PI / 8).every(a => !map.landAt(x + Math.cos(a) * 46, y + Math.sin(a) * 46));
      if (!wet(w.x, w.y)) problems.push(`the docking water ${w.x},${w.y} (beside the jetty tip) is not open sea`);
      if (!nav.walkable(map.HARBOR.land.x, map.HARBOR.land.y)) problems.push('the jetty end you land on is not walkable');
      if (!nav.route(map.HARBOR.land.x, map.HARBOR.land.y, map.spawn.x, map.spawn.y).length && !nav.clearLine([map.HARBOR.land.x, map.HARBOR.land.y], [map.spawn.x, map.spawn.y])) problems.push('no walking route from the jetty to the plaza');
      const spots = map.boatSpots();
      if (spots.length < 3) problems.push(`only ${spots.length} boat spots`);
      for (const [i, s] of spots.entries()) if (!wet(s.x, s.y)) problems.push(`boat spot ${i} (${s.x},${s.y}) is not open sea`);
      const ox = world.origin?.x ?? 0, oy = world.origin?.y ?? 0;
      const edge = world.coast.some(([x, y]) => x < ox + 300 || y < oy + 300 || x > ox + world.width - 300 || y > oy + world.height - 300);
      if (edge) problems.push('the coast comes within 300 of the map edge (leave sea round the island)');
    } catch (e) {problems.push(`map: ${e.message}`);}
  }
  // boss 6 Nov: the same 28 sleeping Duckies as home, at the theme's world.json "sleepSpots", checked against its walking map
  // and its ART props (nod leans on a tree by its art id). Never blocks the theme: a dropped spot is reported here and simply
  // has no sleeper. The resolved beds go into the index, so the game and the room server block the very same ground.
  let sleepers = null; const sleepNotes = [];
  if (!problems.length && world?.sleepSpots) {
    try {
      const base = makeMap(theme, {world, walk, harbor, sleepers: []}).walk;
      sleepers = resolveSleepSpots(base, art.props ?? [], geometry(base).walkable, sleepHalfWidths(), {spots: world.sleepSpots, avoid: world.sleepAvoid ?? [], warn: false});
      sleepNotes.push(...sleepShapeProblems(world.sleepSpots, world.sleepTotal ?? SLEEP_TOTAL).map(p => `sleepSpots shape: ${p}`), ...sleepers.bad.map(b => `sleeper ${b.pose} ${Math.round(b.x)},${Math.round(b.y)} dropped: ${b.reason}`));
      sleepers = sleepers.map(({x, y, pose, r, flip, tree}) => ({x: Math.round(x), y: Math.round(y), pose, r: Math.round(r * 10) / 10, flip, ...(tree ? {tree} : {})}));
      // A nod may overlap its own tree, but the tree still has to be on land.
      // Check the final map's drawn AND walking coasts, as the game does.
      const map = makeMap(theme, {world, walk, harbor, sleepers});
      for (const bed of map.sleepers) if (!map.landAt(bed.x, bed.y)) sleepNotes.push(`sleeper ${bed.pose} ${bed.x},${bed.y} is offshore`);
    } catch (e) {sleepNotes.push(`sleepers: ${e.message}`); sleepers = null;}
  } else if (!problems.length) sleepNotes.push('no sleepSpots in world.json (no sleepers yet)');
  problems.push(...sleepNotes);
  if (sleepers?.length !== (world?.sleepTotal ?? SLEEP_TOTAL)) problems.push(`expected ${world?.sleepTotal ?? SLEEP_TOTAL} resolved sleepers, got ${sleepers?.length ?? 0}`);
  return {theme, ready: !problems.length, problems, files, sleepTotal: world?.sleepTotal ?? SLEEP_TOTAL, sea: art?.sea ?? null, sleepers, sleepNotes};
}

function signature(reports) {
  return JSON.stringify(reports.map(r => [r.theme, r.ready, r.ready ? r.files.map(f => statSync(f).mtimeMs) : r.problems, r.sleepers]));
}

function writeIndex(reports) {
  const ready = reports.filter(r => r.ready);
  const lines = ['// Written by scripts/theme-index.mjs: the themes whose files are complete (concepts/themes/THEME-CONTRACT.md). Do not edit.'];
  for (const {theme} of ready) {
    lines.push(`import ${theme}World from './${theme}/world.json' with {type: 'json'};`, `import ${theme}Harbor from './${theme}/harbor.json' with {type: 'json'};`);
    if (existsSync(join(DATA(theme), 'walk-world.json'))) lines.push(`import ${theme}Walk from './${theme}/walk-world.json' with {type: 'json'};`);
  }
  lines.push('export default {');
  for (const {theme, sea, sleepers} of ready) {
    const walk = existsSync(join(DATA(theme), 'walk-world.json')) ? `${theme}Walk` : 'null';
    lines.push(`  ${theme}: {world: ${theme}World, walk: ${walk}, harbor: ${theme}Harbor, art: '/pixi-art/themes/${theme}/art.json', sea: ${JSON.stringify(sea)}, sleepers: ${JSON.stringify(sleepers)}},`);
  }
  lines.push('};', '');
  const text = lines.join('\n');
  if (!existsSync(INDEX) || readFileSync(INDEX, 'utf8') !== text) writeFileSync(INDEX, text);
}

function run(print = true) {
  const reports = THEME_IDS.filter(t => t !== 'home').map(checkTheme);
  if (print) for (const r of reports) {
    console.log(`${r.ready ? 'READY ' : 'home  '} ${r.theme}${r.ready ? `  sleepers ${r.sleepers?.length ?? 0}/${r.sleepTotal}` : '\n        ' + r.problems.slice(0, 8).join('\n        ')}`);
    if (r.ready && r.sleepNotes.length) console.log('        ' + r.sleepNotes.join('\n        '));
  }
  return reports;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (args.has('--check')) {if (run().some(r => !r.ready)) process.exitCode = 1;}
  else if (args.has('--watch')) {
    let last = '';
    const tick = () => {
      const reports = run(false), sig = signature(reports);
      if (sig !== last) {
        last = sig; writeIndex(reports);
        console.log(new Date().toLocaleTimeString(), reports.map(r => `${r.theme}:${r.ready ? 'READY' : 'home (' + r.problems[0] + ')'}`).join('  '));
      }
    };
    tick(); setInterval(tick, 4000);
  } else writeIndex(run());
}
