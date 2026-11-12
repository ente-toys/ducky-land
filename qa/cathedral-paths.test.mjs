import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeMap} from '../src/pixi/island-maps.js';
import {geometry,inShape} from '../assets/world/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/',S='scripts/bigger-cathedral/';
const world=read(D+'world.json'),walk=read(D+'walk-world.json'),art=read(A+'art.json'),input=read(S+'paths-input.json');
const map=makeMap('cathedral',{world,walk,harbor:read(D+'harbor.json')});
const distance=(q,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q[0]-a[0]-dx*t,q[1]-a[1]-dy*t);};
test('Bellovo paths are one opaque gold polygon union without edge or centre painters',()=>{
 const surface=fs.readFileSync(S+'path-surface.svgfrag','utf8'),g=new JSDOM('<svg xmlns="http://www.w3.org/2000/svg">'+surface+'</svg>',{contentType:'image/svg+xml'}).window.document.querySelector('g');
 assert.equal(g.children.length,1);assert.equal(g.firstElementChild.getAttribute('fill'),'#F7DC88');
 assert.doesNotMatch(surface,/\bstroke=|opacity=|gradient|filter/i);
 const shape=read(S+'path-surface.json');assert.equal(shape.type,'Polygon','all destinations and bridges share one component');
 for(const ring of shape.coordinates)assert.ok(ring.length>3,'no triangular grass holes');
 for(const file of ['green.mjs','villages.mjs','centre.mjs']){const src=fs.readFileSync(S+file,'utf8');assert.match(src,/rebuildPaths\(\)/);assert.doesNotMatch(src,/stroke="#(?:fde48c|fff0c7)" stroke-width="\$\{/i);}
});
test('Every support tile carries the identical global union at placed resolution',()=>{
 for(const t of art.ground.tiles.filter(t=>t.src.startsWith('communities/'))){
  const svg=fs.readFileSync(A+t.src,'utf8');
  assert.equal(svg.split('data-name="Bellovo unified paths"').length-1,1,t.src);
  assert.ok(svg.includes(fs.readFileSync(S+'path-surface.svgfrag','utf8')),t.src+' has exact shared geometry');
  assert.doesNotMatch(svg,/<image\b|(?:linear|radial)Gradient|<!--b2-garden-->/i);
  const head=svg.match(/<svg[^>]*>/)[0];assert.ok(head.includes(`width="${t.width}"`));assert.ok(head.includes(`height="${t.height}"`));
 }
});
test('Visible routes and both navigation files use the same 128 main and 104 lane samples',()=>{
 assert.deepEqual(world.paths,input.routes.map(r=>r.samples));assert.deepEqual(world.pathWidths,input.routes.map(r=>r.width));
 assert.deepEqual(walk.paths,world.paths);assert.deepEqual(walk.pathWidths,world.pathWidths);
 assert.ok(world.pathWidths.every(w=>[104,128].includes(w)));
 for(const r of input.routes.filter(r=>/-arrival$|-door$/.test(r.id)))assert.equal(r.width,104,r.id);
});
test('Every declared centreline is walkable with the production 16-unit obstacle clearance and existing sleepers',()=>{
 let samples=0;for(const [i,line]of world.paths.entries())for(const p of line){samples++;assert.ok(map.nav().walkable(...p),world.pathSystem.routes[i].id+' '+p);}
 assert.ok(samples>6000);assert.equal(map.sleepers.length,120,'all integrated residents resolve');
});
test('All thirteen fixed bridge anchors and their tangential path throats are retained',()=>{
 for(const b of input.bridges){
  const r=input.routes.find(r=>r.id==='bridge-'+b.id);assert.deepEqual(r.points,[b.a,b.b]);assert.equal(r.width,b.w);
  assert.deepEqual(world.walkways.find(w=>w.id===b.id),{...b,boatPassUnder:true});
  for(const side of ['a','b']){const t=input.routes.find(r=>r.id==='throat-'+b.id+'-'+side);assert.deepEqual(t.points[0],b[side]);assert.ok(Math.hypot(t.points[1][0]-t.points[0][0],t.points[1][1]-t.points[0][1])>=79);}
 }
});
test('All 16 village doors have short flush approaches; option A paving replaces only the centre mosaics',()=>{
 const doors=input.routes.filter(r=>r.id.endsWith('-door'));assert.equal(doors.length,16);
 for(const r of doors){const p=art.props.find(p=>p.id===r.id.slice(0,-5));assert.deepEqual(r.points[0],[p.x,p.y+40]);assert.ok(map.nav().walkable(...r.points[0]));}
 for(const src of ['centre-A/paving.svg','villages/tessera/flower-mosaic.svg'])assert.ok(art.flats.some(p=>p.src===src));
 assert.doesNotMatch(fs.readFileSync(A+'communities/preserved-3200-1500.svg','utf8'),/clip-path="url\(#close-forecourt\)"/,'retired rear court stays removed');
 assert.ok(!art.flats.some(p=>/detail\/(piazza-mosaic|rose-inlay)\.svg/.test(p.src)));
 assert.ok(input.courts.some(c=>c.id==='centre-piazza'&&c.rx===1160&&c.ry===850));
});
test('No approach ends as an unserved grass stub',()=>{
 const inCourt=p=>input.courts.some(c=>((p[0]-c.x)/c.rx)**2+((p[1]-c.y)/c.ry)**2<=1.05)||art.flats.filter(f=>/square/.test(f.src)).some(f=>p[0]>=f.x&&p[0]<=f.x+f.width&&p[1]>=f.y&&p[1]<=f.y+f.height);
 for(const r of input.routes)for(const [end,p]of [[0,r.samples[0]],[1,r.samples.at(-1)]]){
  if(r.id.endsWith('-door')&&end===0||r.id==='harbour'&&end===1||inCourt(p))continue;
  const joined=input.routes.some(other=>other!==r&&other.samples.slice(1).some((b,i)=>distance(p,other.samples[i],b)<(r.width+other.width)/2-5));
  assert.ok(joined,r.id+' end '+end+' must meet another lane or court');
 }
});
test('The dry walking corridor stays clear across its width with a 16-unit Ducky margin',()=>{
 let samples=0;
 for(const [i,line]of world.paths.entries())for(let j=0;j<line.length;j++){
  const q=line[j],a=line[Math.max(0,j-1)],b=line[Math.min(line.length-1,j+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
  for(const off of [world.pathWidths[i]/2-16,16-world.pathWidths[i]/2]){
   const x=q[0]-(b[1]-a[1])/len*off,y=q[1]+(b[0]-a[0])/len*off;
   // The authoritative water layer covers the union at bridge apron corners.
   // Supported deck centres are tested above; wet bank pixels are never a road.
   if(walk.water.some(o=>inShape(x,y,o,20)))continue;
   samples++;assert.ok(map.nav().walkable(x,y),world.pathSystem.routes[i].id+' shoulder '+[x,y]);
  }
 }
 assert.ok(samples>9000);
});
