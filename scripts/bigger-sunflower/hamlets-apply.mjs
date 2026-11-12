import {config, layouts, hamletObjects, hamletGround, mapper, BUILDING, TREE} from './hamlets.mjs';
import {siteKind, roadGap, inPoly, NAMES} from './site.mjs';
const r1 = v => Math.round(v * 10) / 10;
const HOME = /cottage|seed-merchant|timber-cabin/, FLAT = /bed|field|patch|garden|crop|coldframe|stepping|planter|flower-island|meadow|daisy|pebble|grass|rock|flowers-/;
const glob = s => new RegExp('^' + s.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

export function hamletGroundArt() {
  const d = Object.keys(config).flatMap(hamletGround).map(r => `<path d="M${r.map(p => p.join(' ')).join('L')}Z"/>`).join('');
  const u = '<use href="#hamlet-ground"/>';
  return `<defs><g id="hamlet-ground">${d}</g></defs><g mask="url(#hamlet-land)" stroke-linejoin="round"><g opacity=".35" fill="#4AA539" stroke="#4AA539" stroke-width="34">${u}</g>`
    + `<g opacity=".6" fill="#39472D" stroke="#39472D" stroke-width="18">${u}</g><g fill="#E4C567" stroke="#E4C567" stroke-width="14">${u}</g><g fill="#FDE48C">${u}</g></g>`;
}
export const hamletMask = shape => `<mask id="hamlet-land" x="-2000" y="-1400" width="12000" height="8400" maskUnits="userSpaceOnUse"><path d="${shape}" fill="white" stroke="black" stroke-width="360"/></mask>`;

export function applyHamlets({newProps, obstacles, world}) {
  const report = {};
  const grounds = Object.fromEntries(Object.keys(config).map(h => [h, hamletGround(h)]));
  const onGround = (x, y) => Object.values(grounds).some(R => R.some(r => inPoly(x, y, r)));
  for (const [h, cfg] of Object.entries(config)) {
    const objs = hamletObjects(h), placed = [], dropped = [], walls = [];
    const names = (cfg.remove ?? []).map(glob), gone = new Set();
    for (const p of newProps) if (names.some(re => re.test(p.id))) gone.add(p.id);
    for (const o of objs) {
      if ((cfg.drop ?? []).includes(o.id)) continue;
      if (o.building) {
        const bad = [];
        for (const fx of [-.42, -.2, 0, .2, .42]) for (const fy of [-.25, -.1, 0]) {
          const x = o.x + o.w * fx, y = o.y + o.h * fy, k = siteKind(x, y);
          if (k !== 0) bad.push(NAMES[k]); else if (roadGap(x, y) < 10 && !onGround(x, y)) bad.push('road');
        }
        if (bad.length) {const m = `${h}: ${o.id} stands on ${[...new Set(bad)].join('/')} at ${o.x},${o.y}`; if (process.env.HAMLET_LOOSE) console.warn(m); else throw Error(m);}
      } else {
        const pts = o.fp ? [[o.fp.x, o.fp.y], [o.fp.x - o.fp.rx * .8, o.fp.y], [o.fp.x + o.fp.rx * .8, o.fp.y], [o.x, o.y - 8]] : [[o.x, o.y]];
        const ring = ([x, y]) => [[0, 0], ...Array.from({length: 8}, (_, a) => [Math.cos(a * Math.PI / 4) * 80, Math.sin(a * Math.PI / 4) * 80])].map(([dx, dy]) => siteKind(x + dx, y + dy)).find(k => k) ?? 0;
        const why = pts.map(([x, y]) => ring([x, y]) ? NAMES[ring([x, y])] : roadGap(x, y) < 0 && !onGround(x, y) && !o.decal ? 'road' : null).find(Boolean);
        if (why) {dropped.push(`${o.id}:${why}`); continue;}
      }
      const src = `hamlets/${h}/${o.file}`;
      const p = {id: `hamlet-${h}-${o.id}`, name: o.name, src, x: o.x, y: o.y, width: o.w, height: o.h, scale: 1, anchor: {x: .5, y: 1}, resolution: 1.5,
        zone: h, order: o.order};
      if (o.decal) {p.asset = 'grass-decal'; p.shadow = false; p.z = r1(o.y - 4000);}
      else if (FLAT.test(o.name) || (o.w < 60 && !/lamp|lantern/.test(o.name))) p.shadow = false;
      else if (o.building) p.shadowSize = [r1(o.fp.rx * 1.05), r1(Math.min(70, o.fp.rx * .3))];
      if (TREE.test(o.file) || /sunflower|flower|bush|shrub/.test(o.name)) p.wind = true;
      if (HOME.test(o.file)) p.communityRole = 'home'; else if (o.building) p.communityRole = 'workplace';
      if (o.fp) {p.footprint = {x: r1(o.fp.x), y: r1(o.fp.y), rx: r1(o.fp.rx), ry: r1(o.fp.ry)}; walls.push({name: p.id, ...p.footprint});}
      placed.push(p);
    }
    for (const q of newProps) {
      if (gone.has(q.id) || /^hamlet-|bridge|crossing/.test(q.id)) continue;
      const qx = q.x, qy = q.y, qw = q.width * (q.scale ?? 1) / 2;
      const hit = onGround(qx, qy) && grounds[h].some(r => inPoly(qx, qy, r))
        || placed.some(p => p.footprint && Math.hypot((p.footprint.x - qx) / (p.footprint.rx + qw + 40), (p.footprint.y - qy) / (p.footprint.ry + 60)) < 1)
        || placed.some(p => p.communityRole && Math.abs(p.x - qx) < p.width * .5 + qw && qy < p.y + 40 && qy > p.y - p.height);
      if (hit) gone.add(q.id);
    }
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i]; if (p.z !== undefined) continue; p.z = p.y;
      for (let j = 0; j < i; j++) {
        const q = placed[j]; if (q.asset === 'grass-decal') continue;
        if (q.z >= p.z && Math.abs(q.x - p.x) < (q.width + p.width) / 2 && p.y > q.y - q.height && q.y > p.y - p.height) p.z = r1(q.z + .5);
      }
    }
    for (let i = newProps.length - 1; i >= 0; i--) if (gone.has(newProps[i].id)) newProps.splice(i, 1);
    for (let i = obstacles.length - 1; i >= 0; i--) if (gone.has(obstacles[i].name)) obstacles.splice(i, 1);
    newProps.push(...placed); obstacles.push(...walls);
    const W = mapper(h);
    (cfg.sleepers ?? []).forEach((s, i) => {
      const list = world.sleepSpots[s.pose], at = list?.findIndex(q => q[0] === s.replaces[0] && q[1] === s.replaces[1]);
      if (!(at >= 0)) throw Error(`${h}: no ${s.pose} sleeper at ${s.replaces} to move`);
      const [x, y] = W([layouts[h].sleepers[i].x, layouts[h].sleepers[i].y]);
      list[at] = [Math.round(x + (s.nudge?.[0] ?? 0)), Math.round(y + (s.nudge?.[1] ?? 0)), Boolean(s.flip)];
    });
    report[h] = {cleared: gone.size, placed: placed.length, homes: placed.filter(p => p.communityRole === 'home').map(p => p.id),
      workplaces: placed.filter(p => p.communityRole === 'workplace').map(p => p.id), dropped};
  }
  return report;
}
