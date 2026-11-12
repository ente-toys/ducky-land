// Nuggetnook: is the walk map valid? Builds the same map the game and the room server build (island-maps.js
// makeMap), then flood-fills the walkable ground from the plaza spawn on a 20-unit grid and checks every zone spawn,
// both islets, every pier end and the harbor landing are reachable, and every boat spot is open sea.
//   node scripts/themes/goldmine-check.mjs
import {readFileSync} from 'node:fs';
import {checkTheme} from '../theme-index.mjs';
import {geometry,inShape} from '../../assets/world/island-geometry.mjs';
import {makeMap} from '../../src/pixi/island-maps.js';

const read = p => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));
const world = read('assets/world/themes/goldmine/world.json'), walk = read('assets/world/themes/goldmine/walk-world.json'), harbor = read('assets/world/themes/goldmine/harbor.json');
const map = makeMap('goldmine', {world, walk, harbor, art: '/pixi-art/themes/goldmine/art.json'});
const nav = map.nav(), G = 20, W = Math.ceil(world.width / G), H = Math.ceil(world.height / G);
const ok = new Uint8Array(W * H), seen = new Uint8Array(W * H);
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) ok[r * W + c] = nav.walkable(c * G, r * G) ? 1 : 0;
const cell = (x, y) => Math.round(y / G) * W + Math.round(x / G);
const start = cell(map.spawn.x, map.spawn.y), queue = [start];
seen[start] = 1;
while (queue.length) {
  const i = queue.pop(), r = Math.floor(i / W), c = i % W;
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc, j = rr * W + cc;
    if (rr >= 0 && rr < H && cc >= 0 && cc < W && ok[j] && !seen[j]) {seen[j] = 1; queue.push(j);}
  }
}
// a point counts as reached when a reached cell lies within 30 of it (the grid snaps)
const reached = (x, y) => {for (let dy = -40; dy <= 40; dy += G) for (let dx = -40; dx <= 40; dx += G) if (seen[cell(x + dx, y + dy)]) return true; return false;};
const fails = [];
const want = (label, x, y) => {const w = nav.walkable(x, y), r = reached(x, y); if (!w || !r) fails.push(`${label} (${Math.round(x)},${Math.round(y)}) walkable=${w} reached=${r}`);};
for (const [name, z] of Object.entries(world.zones)) want(`zone ${name} spawn`, ...z.spawn);
world.islets.forEach(([x, y, , ry], i) => want(`islet ${i}`, x, y + ry * .45));
world.walkways.forEach((w, i) => want(`walkway ${i} end`, ...w.b));
want('harbor landing', map.HARBOR.land.x, map.HARBOR.land.y);
const wet = (x, y) => !map.landAt(x, y) && Array.from({length: 16}, (_, i) => i * Math.PI / 8).every(a => !map.landAt(x + Math.cos(a) * 46, y + Math.sin(a) * 46));
map.boatSpots().forEach((s, i) => {
  if (!wet(s.x, s.y)) fails.push(`boat ${i} (${s.x},${s.y}) not open sea`);
  if (!map.shoreFor(s.x, s.y, 260)) fails.push(`boat ${i} (${s.x},${s.y}) has no walkable shore within 260`);
});
const area = seen.reduce((a, b) => a + b, 0) * G * G, all = ok.reduce((a, b) => a + b, 0) * G * G;
console.log(`walkable ${(all / 1e6).toFixed(2)}M units², reached from the plaza ${(area / 1e6).toFixed(2)}M (${(100 * area / all).toFixed(1)}%), ${walk.obstacles.length} obstacles, ${map.boatSpots().length} boats`);
console.log(fails.length ? 'FAIL\n  ' + fails.join('\n  ') : 'PASS: every zone, islet, pier, the harbor and every boat is reachable');
// unreached walkable pockets (islands of walkable cells cut off by props)
const pockets = [];
const mark = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (ok[i] && !seen[i] && !mark[i]) {
  let n = 0; const q = [i]; mark[i] = 1; let sx = 0, sy = 0;
  while (q.length) {const k = q.pop(), r = Math.floor(k / W), c = k % W; n++; sx += c; sy += r;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {const rr = r + dr, cc = c + dc, j = rr * W + cc; if (rr >= 0 && rr < H && cc >= 0 && cc < W && ok[j] && !seen[j] && !mark[j]) {mark[j] = 1; q.push(j);}}}
  if (n > 3) pockets.push(`${n} cells near (${Math.round(sx / n * G)},${Math.round(sy / n * G)})`);
}
if (pockets.length) console.log('cut-off pockets:', pockets.join('; '));

const art=read('public/pixi-art/themes/goldmine/art.json'), terrain=geometry({...world,obstacles:[]});
const landmark=art.props.find(p=>p.id==='gold-centre-mine-landmark');
if(!landmark||landmark.src!=='centre/mine-landmark.svg'||landmark.y<2700||landmark.y>3000||landmark.width*landmark.scale<1400)fails.push('locked giant egg is not placed in the plaza');
if(nav.walkable(4100,2800))fails.push('mine facade must be solid');
if(!nav.walkable(4100,3060))fails.push('mine entrance approach is blocked');
if(art.props.filter(p=>p.name==='Curved timber bench'&&p.id.includes('arc-plaza-')&&p.y>world.zones.plaza.y).length!==4)fails.push('plaza needs four visible front-ring arc benches');
if(art.props.filter(p=>p.id.startsWith('gold-centre-cliff-')).length!==4)fails.push('quarry foreground ledges need independent depth layers');
if(!art.flats.some(p=>p.src==='detail/yard-tracks.svg'))fails.push('plaza track spur must render above the paving');
for(const p of art.props)if(!terrain.walkable(p.x,p.y))fails.push(`prop base off land ${p.id}`);
// The route must stay visually clear across each prop footprint, not merely navigable.
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
for(const p of art.props){
 if(p.id.startsWith('gold-centre-')||p.name==='Timber support'||p.name==='Curved timber bench')continue;
 const rx=p.name==='Tree'?31:p.width*p.scale*.34,ry=Math.min(38,p.height*p.scale*.16);
 const points=[[p.x,p.y-10],...Array.from({length:32},(_,i)=>[p.x+Math.cos(i*Math.PI/16)*rx,p.y-10+Math.sin(i*Math.PI/16)*ry])];
 if(points.some(([x,y])=>world.paths.some((path,i)=>path.slice(1).some((b,j)=>segmentDistance(x,y,path[j],b)<world.pathWidths[i]/2))))fails.push('prop footprint on painted route '+p.id);
}
const arcCount=art.props.filter(p=>p.name==='Curved timber bench').length;
if(arcCount<7)fails.push('missing plaza / activity arc seating');
const report=checkTheme('goldmine');
if(art.props.length<300)fails.push(`only ${art.props.length}/300 props`);
if(art.props.filter(p=>p.name==='Tree').length<60)fails.push('fewer than 60 large trees');
if(!report.ready)fails.push(...report.problems);
if(report.sleepers?.length!==40)fails.push(`only ${report.sleepers?.length} sleepers`);
const railDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);};
for(const s of report.sleepers??[])if((world.railPaths??[]).some(path=>path.slice(1).some((b,i)=>railDistance(s.x,s.y,path[i],b)<80+s.r)))fails.push(`sleeper ${s.pose} overlaps a cart rail`);
for(const [name,z]of Object.entries(world.zones)){
 if(!/^(activity|stalls)-/.test(name))continue;
 let blocked=0;
 for(let y=z.y0??z.y-z.ry;y<=(z.y1??z.y+z.ry);y+=40)for(let x=z.x0??z.x-z.rx;x<=(z.x1??z.x+z.rx);x+=40){
  if(z.rx&&!inShape(x,y,z))continue;
  if(!nav.walkable(x,y))blocked++;
 }
 if(blocked)fails.push(`${name}: ${blocked} blocked sample points`);
}
const boats=map.boatSpots();
for(let i=0;i<boats.length;i++)for(let j=i+1;j<boats.length;j++)if(Math.hypot(boats[i].x-boats[j].x,boats[i].y-boats[j].y)<300)fails.push(`boats ${i},${j} less than 300 apart`);
// A spatial capacity check, not a network load test: 100 separate player positions in gathering zones.
const crowd=[];
for(const z of [world.zones.centre,...Object.entries(world.zones).filter(([k])=>k.startsWith('activity-')).map(([,v])=>v)]){
 // Staggered rows keep >=150 separation while using the real open area.
 let row=0;
 for(let y=z.y-z.ry+90;y<z.y+z.ry-90;y+=135,row++)for(let x=z.x-z.rx+90+(row%2)*77.5;x<z.x+z.rx-90;x+=155){
  if(crowd.length>=100)break;
  if(!inShape(x,y,z,-75)||!nav.walkable(x,y)||!nav.walkable(x-55,y)||!nav.walkable(x+55,y))continue;
  if(crowd.some(p=>Math.hypot(x-p[0],y-p[1])<150))continue;
  crowd.push([x,y]);
 }
}
if(crowd.length!==100)fails.push(`capacity ${crowd.length}/100`);
const status={ready:report.ready&&fails.length===0,acceptedSleepers:report.sleepers?.length,crowdSlots:crowd.length,crowdPositions:crowd,props:art.props.length,curvedBenches:arcCount,largeTrees:art.props.filter(p=>p.name==='Tree').length,landmark:{width:landmark.width*landmark.scale,height:landmark.height*landmark.scale,x:landmark.x,thresholdY:landmark.y},reachablePercent:Math.round(10000*area/all)/100,boats:boats.length,arches:world.arches.length,activityAreas:3,stallRows:3,failures:fails,legacySleepShapeNotes:report.sleepNotes};
const {writeFileSync}=await import('node:fs');
writeFileSync('public/pixi-art/themes/goldmine/validation.json',JSON.stringify(status,null,2)+'\n');
console.log(fails.length?'FAIL '+fails.join('; '):'READY goldmine: 40 sleepers, 100 crowd slots, open zones, connected jetties, boat clearances PASS');
process.exit(fails.length ? 1 : 0);

