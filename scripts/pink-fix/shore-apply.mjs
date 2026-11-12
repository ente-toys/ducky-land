// Package the hand-authored Rosybutton shore drawings and explicit placements.
// Run from the repo root: node scripts/pink-fix/shore-apply.mjs
// Art source: scripts/pink-fix/art. Collision contours are sampled from the same pen curves.
// Base: the saved pre-shore build; rerunning does not accumulate patches.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
const BASE = '96f36ed5';
const A = 'public/pixi-art/themes/pink/', D = 'assets/world/themes/pink/', OUT = A + 'expansion/shore/';
const git = p => execFileSync('git', ['show', `${BASE}:${p}`], {encoding: 'utf8', maxBuffer: 1 << 28});
const P = JSON.parse(readFileSync('scripts/pink-fix/shore.json', 'utf8'));
const r1 = v => Math.round(v * 10) / 10;

// ---------- geometry helpers (curves through the hand-picked points) ----------
const bez = pts => pts.slice(0, -1).map((p, i) => {   // Catmull-Rom through the points, as cubic Bezier segments
  const a = pts[Math.max(0, i - 1)], b = pts[i + 1], c = pts[Math.min(pts.length - 1, i + 2)];
  return [p, [p[0] + (b[0] - a[0]) / 6, p[1] + (b[1] - a[1]) / 6], [b[0] - (c[0] - p[0]) / 6, b[1] - (c[1] - p[1]) / 6], b];
});
const closedBez = pts => pts.map((p, i) => {
  const n = pts.length, a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
  return [p, [p[0] + (b[0] - a[0]) / 6, p[1] + (b[1] - a[1]) / 6], [b[0] - (c[0] - p[0]) / 6, b[1] - (c[1] - p[1]) / 6], b];
});
const dOf = (segs, close) => 'M' + segs[0][0].map(r1).join(' ') + segs.map(s => 'C' + [s[1], s[2], s[3]].map(q => q.map(r1).join(' ')).join(' ')).join('') + (close ? 'Z' : '');
const at = (s, t) => [0, 1].map(k => (1 - t) ** 3 * s[0][k] + 3 * (1 - t) ** 2 * t * s[1][k] + 3 * (1 - t) * t * t * s[2][k] + t ** 3 * s[3][k]);
const sample = (segs, n = 8) => [...segs.flatMap(s => Array.from({length: n}, (_, i) => at(s, i / n))), segs.at(-1)[3]];
const box = pts => pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
const waterEntry = (name, poly) => {const b = box(poly); return {name, x: r1((b[0] + b[2]) / 2), y: r1((b[1] + b[3]) / 2), rx: r1((b[2] - b[0]) / 2), ry: r1((b[3] - b[1]) / 2), poly: poly.map(p => p.map(r1))};};
// a brook's water for walking: overlapping strips along the same curve the art draws, each a simple polygon
function brookWater(b) {
  const pts = sample(bez(b.centre), 6), out = [], step = 6;
  const side = (i, s) => {const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; return [p[0] - dy / l * b.half * s, p[1] + dx / l * b.half * s];};
  for (let i = 0; i < pts.length - 1; i += step) {
    const idx = Array.from({length: Math.min(step, pts.length - 1 - i) + 1}, (_, k) => i + k);
    const ext = (j, back) => {const p = pts[j], q = pts[back ? j + 1 : j - 1] ?? p, dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1; return [dx / l * 24, dy / l * 24];};
    const [ex0, ey0] = ext(idx[0], true), [ex1, ey1] = ext(idx.at(-1), false);
    const left = idx.map(j => side(j, 1)), right = idx.map(j => side(j, -1)).reverse();
    left[0] = [left[0][0] + ex0, left[0][1] + ey0]; right.at(-1)[0] += ex0; right.at(-1)[1] += ey0;
    left.at(-1)[0] += ex1; left.at(-1)[1] += ey1; right[0] = [right[0][0] + ex1, right[0][1] + ey1];
    out.push(waterEntry(b.name, [...left, ...right]));
  }
  return out;
}

// Package the authored SVGs and retire superseded art layers.
const base = {art: JSON.parse(git(A + 'art.json')), world: JSON.parse(git(D + 'world.json')), walk: JSON.parse(git(D + 'walk-world.json')), harbor: JSON.parse(git(D + 'harbor.json'))};
execFileSync('python3', ['scripts/pink-fix/prepare-ground.py']);
const INK = '#39472D', CREAM = '#FFF0C7';
const content = p => readFileSync('scripts/pink-fix/art/' + p, 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
const coastD = content('coast.svg').match(/ d="([^"]+)"/)[1];
// Sample the authored cubic pen contour for walking, sailing and surf. The drawing is the source.
const nums = coastD.match(/-?\d+(?:\.\d+)?/g).map(Number), coastSegs=[];
let cursor=nums.slice(0,2);
for(let i=2;i<nums.length;i+=6){const end=nums.slice(i+4,i+6);coastSegs.push([cursor,nums.slice(i,i+2),nums.slice(i+2,i+4),end]);cursor=end;}
const contour=sample(coastSegs,18).slice(0,-1);
const winding=Math.sign(contour.reduce((v,p,i)=>{const q=contour[(i+1)%contour.length];return v+p[0]*q[1]-q[0]*p[1];},0));
// Collision and surf follow the outside of the 92-unit sand stroke, not its centreline.
const coast=contour.map((p,i)=>{const a=contour[(i+contour.length-1)%contour.length],b=contour[(i+1)%contour.length],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);return [r1(p[0]+winding*dy/l*46),r1(p[1]-winding*dx/l*46)];});
let SRC = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2600 -1900 13200 9800"><defs><path id="pink-coast" d="${coastD}"/></defs>${content('paths.svg')}${content('shore.svg')}</svg>`;
mkdirSync(OUT, {recursive: true});
writeFileSync(OUT+'shore-source.svg', SRC);
const xs = [-2600,-1300,0,1333,2666,4000,5333,6666,8000,9300,10600], ys = [-1900,-950,0,1450,2900,4350,5800,6850,7900];
const shoreTiles=[];
for(let r=2;r<8;r++)for(let c=0;c<10;c++){
 const x=xs[c]-2,y=ys[r]-2,width=xs[c+1]-x+2,height=ys[r+1]-y+2,src=`expansion/shore/r${r}-c${c}.svg`;
 writeFileSync(A+src,SRC.replace('viewBox="-2600 -1900 13200 9800"',`width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}"`));
 shoreTiles.push({src,x,y,width,height,resolution:1});
}

// ---------- 3. bridges and the marina pier ----------
// Place the hand-drawn diagonal arched bridges in the centre palette.
const decks = [], bridges = [], arches = [];
const support = (name, a, b, width) => {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(length / (width * .65));
  for (let i = 0; i <= n; i++) {const t = i / n; bridges.push({name, x: r1(a[0] + (b[0] - a[0]) * t), y: r1(a[1] + (b[1] - a[1]) * t), w: r1(width * .75 + 16), h: r1(width * .75 + 24)});}
};
for (const c of P.crossings) {
  const [a, b] = [c.a, c.b];
  const rising=(b[0]-a[0])*(b[1]-a[1])<0, file=rising?'bridge-ne.svg':'bridge-nw.svg';
  const raw=readFileSync('scripts/pink-fix/art/'+file,'utf8');
  const left=a[0]<b[0]?a:b,right=a[0]<b[0]?b:a;
  const sx=(right[0]-left[0])/307, sy=Math.abs(right[1]-left[1])/190;
  const ax=87.5,ay=rising?296:106, tx=left[0]-ax*sx,ty=left[1]-ay*sy;
  const W=480*sx,H=350*sy,src=`expansion/shore/${c.id}.svg`;
  writeFileSync(A+src,raw);
  decks.push({src,x:tx,y:ty,width:W,height:H});
  support(c.id, a, b, c.width); arches.push({a: c.a, b: c.b, r: c.rise ?? 40, w: c.width});
}
// The marina pier is a fixed pen drawing, with rounded rope-banded posts.
writeFileSync(OUT+'marina-pier.svg',readFileSync('scripts/pink-fix/art/marina-pier.svg'));
decks.push({src:'expansion/shore/marina-pier.svg',x:9560,y:2730,width:880,height:240});

// ---------- 4. data ----------
const dropDeck = new Set(P.removeDecks.src);
const water = [base.world.water[0], ...P.brooks.flatMap(brookWater), ...P.ponds.map(p => waterEntry(p.name, sample(closedBez(p.poly), 4)))];
for (const target of [base.world, base.walk]) {
  target.water = water; target.bridges = bridges; target.walkways = P.crossings.map(c=>({a:c.a,b:c.b,w:c.width,boatPassUnder:true})); target.coast=coast; target.islets=[]; target.surfIslets=[];
}
base.world.jetties = [{name: 'marina', foot: P.harbour.jetty.foot, tip: P.harbour.jetty.tip, width: P.harbour.jetty.width}];
base.world.arches = arches;
// Keep bathers on their real beach; both chair poses now face the southeast sea.
base.world.sleepSpots.chair=[[6150,5410,false],[7480,4640,false]];
// These paths connect the original endpoints; keep the navigation metadata in the same style.
base.world.pathWidths=base.world.pathWidths.map(()=>160);
base.world.paths.push([[1043,1275],[570,1240]],[[1124,2736],[900,2780]],[[6865,2778],[7000,2700]],[[4000,3907],[4000,4900]],[[3060,1050],[2600,350]],[[4930,1120],[5750,500]],[[6362,894],[7100,850]]);

base.world.pathWidths=base.world.paths.map(()=>160);
// moved props (art.json by id; world.json props and their obstacles by their old spot)
for (const m of P.moveProps ?? []) {
  const p = base.art.props.find(q => q.id === m.id); if (!p) throw Error('no prop ' + m.id);
  const [ox, oy] = [p.x, p.y], dx = m.x - ox, dy = m.y - oy; p.x = m.x; p.y = m.y; if (m.flip !== undefined) p.flip = m.flip;
  for (const w of [base.world, base.walk]) {
    for (const q of w.props ?? []) if (q.x === ox && q.y === oy) {q.x = m.x; q.y = m.y;}
    for (const o of w.obstacles) if (o.x !== undefined && Math.abs(o.x - ox) < 4 && Math.abs(o.y - oy) < 40 && (o.name === undefined || o.name === m.id)) {o.x += dx; o.y += dy;}
  }
}
base.art.flats=base.art.flats.filter(f=>!(f.y>4100&&f.x>2900&&f.x<5150&&(/sand-speck/.test(f.src)||/^pink-shore-/.test(f.id??''))));
for (const p of P.plants ?? []) base.art.props.push(p);
base.art.decks = [...base.art.decks.filter(d => !dropDeck.has(d.src)), ...decks];
base.art.ground.tiles.push(...shoreTiles);
base.harbor.jetty = P.harbour.jetty; base.harbor.water=P.harbour.water;
base.harbor.boats = [...P.harbour.marinaBoats, ...P.harbour.beachBoats];
const write = (p, d, pretty) => writeFileSync(p, JSON.stringify(d, null, pretty ? 1 : undefined) + '\n');
const layout=JSON.parse(readFileSync('scripts/bigger-pink/layout.json','utf8'));
layout.coast=coast;layout.pathWidths=layout.pathWidths.map(()=>160);layout.water=water.slice(1);layout.bridges=bridges;layout.decks=decks;layout.bridgeAudit=[];
layout.riverCrossings=P.crossings.map(c=>({name:c.id,a:c.a,b:c.b,mid:[(c.a[0]+c.b[0])/2,(c.a[1]+c.b[1])/2],width:c.width}));
layout.streams=P.brooks.map(b=>({name:b.name,points:b.centre,width:b.half*2}));
for(const m of P.moveProps){const p=layout.props.find(p=>p.id===m.id);if(!p)continue;const dx=m.x-p.x,dy=m.y-p.y;p.x=m.x;p.y=m.y;for(const o of layout.obstacles)if(o.name===m.id){o.x+=dx;o.y+=dy;}}
write('scripts/bigger-pink/layout.json',layout,true);
write(A + 'art.json', base.art, true); write(D + 'world.json', base.world, true); write(D + 'walk-world.json', base.walk, true); write(D + 'harbor.json', base.harbor, true);
console.log(`shore applied: ground repackaged, ${shoreTiles.length} shore tiles, ${P.crossings.length} crossings, ${water.length} water shapes, ${bridges.length} deck supports`);
