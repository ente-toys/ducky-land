import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {JSDOM} from 'jsdom';
import {commands,honeywoodBridge} from '../scripts/bigger-cathedral/bridges.mjs';
import {canSail} from '../src/pixi/islands.js';
import {mapFor} from '../src/pixi/island-maps.js';
const A='public/pixi-art/themes/cathedral/',read=p=>JSON.parse(fs.readFileSync(p)),art=read(A+'art.json'),geo=read('scripts/bigger-cathedral/water-geometry.json');
const doc=s=>new JSDOM(s,{contentType:'image/svg+xml'}).window.document;
const coords=d=>commands(d).flatMap(([,vs])=>vs.flatMap((n,i)=>i%2?[]:[[n,vs[i+1]]]));
const close=(a,b,msg)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<.0001,msg+' '+a+' != '+b));
test('All 13 crossings retain the Home paths, rigid posts and cross-planks, without transforms',()=>{
 assert.equal(geo.bridges.length,13);
 for(const b of geo.bridges){
  const d=art.decks.find(d=>d.id==='bellovo-'+b.id),svg=fs.readFileSync(A+d.src,'utf8'),root=doc(svg).documentElement;
  assert.match(d.homeSource,/home-expansion-c\/bridges\/bridge-(ew|ns|ne|nw)\.svg$/);
  assert.equal(root.getAttribute('data-home-source'),d.homeSource);
  assert.doesNotMatch(svg,/transform=|<(?:image|linearGradient|radialGradient|filter)\b|#(?:e4c567|c88941|885931)/i);
  close([+root.getAttribute('width'),+root.getAttribute('height')],[d.width,d.height],b.id+' sharpness');
  const source=[...doc(fs.readFileSync('public'+d.homeSource,'utf8')).querySelectorAll('path')];
  assert.equal(root.querySelectorAll('path').length,source.length-2,'only bank sills removed');
  const posts=d.homeBridge==='ns'?[8,9]:d.homeBridge==='ew'?[2,11]:[2,13],board=d.homeBridge==='ns'?4:7;
  for(const index of [...posts,board]){
   const actual=root.querySelector(`[data-home-path="${index}"]`).getAttribute('d').match(/M[^M]+/g),before=source[index].getAttribute('d').match(/M[^M]+/g);
   assert.equal(actual.length,before.length);
   for(let i=0;i<actual.length;i++){
    const aa=coords(actual[i]),bb=coords(before[i]),shift=aa[0].map((n,k)=>n-bb[0][k]);assert.equal(aa.length,bb.length);
    for(let j=0;j<aa.length;j++)close(aa[j].map((n,k)=>n-bb[j][k]),shift,b.id+' rigid source part '+index);
   }
  }
  assert.equal(svg,honeywoodBridge(b).svg,'generated source of truth '+b.id);
 }
 assert.equal(fs.existsSync(A+'bridges/ns-arch.svg'),false);
});
test('Physical source deck ends land on the unchanged path anchors at both banks',()=>{
 for(const b of geo.bridges){
  const d=art.decks.find(d=>d.id==='bellovo-'+b.id),root=doc(fs.readFileSync(A+d.src,'utf8')).documentElement,box=root.getAttribute('viewBox').split(' ').map(Number);
  const path=root.querySelector(`[data-home-path="${d.homeBridge==='ns'?3:6}"]`),cs=commands(path.getAttribute('d')),m=cs[0][1],q1=cs[1][1].slice(-2),l=cs[2][1],q2=cs[3][1].slice(-2);
  const average=(a,z)=>a.map((n,k)=>(n+z[k])/2+[d.x-box[0],d.y-box[1]][k]);
  const ends=[average(m,q2),average(q1,l)];
  for(const p of [b.a,b.b])assert.ok(ends.some(e=>Math.hypot(e[0]-p[0],e[1]-p[1])<.0001),'source end meets '+b.id+' '+p);
  assert.deepEqual(d.a,b.a);assert.deepEqual(d.b,b.b);
 }
});
test('Every crossing still carries walkers and boatPassUnder across a 46-radius boat transect',()=>{
 const map=mapFor('cathedral'),nav=map.nav();
 for(const b of geo.bridges){
  assert.deepEqual(map.world.walkways.find(w=>w.id===b.id),{...b,boatPassUnder:true});
  const dx=b.b[0]-b.a[0],dy=b.b[1]-b.a[1],len=Math.hypot(dx,dy),m=b.a.map((n,k)=>(n+b.b[k])/2);
  for(let t=-80;t<=80;t+=8)assert.ok(canSail(m[0]-dy/len*t,m[1]+dx/len*t,'isle-176'),'boat transect '+b.id+' '+t);
  for(let i=0;i<=20;i++)assert.ok(nav.walkable(...b.a.map((n,k)=>n+(b.b[k]-n)*i/20)),'full deck '+b.id);
 }
});
test('Coast tiles are joined sea/river contours with exact sea-colour inland water and no coast clipping',async()=>{
 const tiles=art.ground.tiles.filter(t=>t.src.startsWith('bridges/water-'));
 for(const t of tiles){const svg=fs.readFileSync(A+t.src,'utf8');assert.match(svg,/data-bellovo-shore="joined-sea-river"/);assert.doesNotMatch(svg,/clipPath|clip-path|stroke=|Gradient|<image/);}
 async function sample(x,y){
  const layers=[];
  for(const t of tiles){if(x<t.x||y<t.y||x>=t.x+t.width||y>=t.y+t.height)continue;
   const svg=fs.readFileSync(A+t.src,'utf8').replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="1" height="1" viewBox="${x} ${y} 1 1"`);
   layers.push({input:await sharp(Buffer.from(svg)).png().toBuffer(),left:0,top:0});
  }
  return [...await sharp({create:{width:1,height:1,channels:4,background:art.sea}}).composite(layers).raw().toBuffer()];
 }
 for(const p of [[1770,3310],[1710,500],[7350,3950],[1100,-900],[6510,6240],[700,-1450],[6000,7050]])assert.deepEqual(await sample(...p),[110,201,222,255],'seamless water '+p);
});
test('Independently rasterized neighbouring water tiles agree across every shared boundary',async()=>{
 const coast=read('scripts/bigger-cathedral/water-coast.json'),tiles=coast.tiles;let checked=0;
 const strip=async(t,x,y,w,h)=>{
  const s=fs.readFileSync(A+t.src,'utf8').replace(/width="[^"]+" height="[^"]+" viewBox="[^"]+"/,`width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}"`);
  return sharp(Buffer.from(s)).ensureAlpha().raw().toBuffer();
 };
 for(const a of tiles)for(const b of tiles){
  let region;
  if(a.x+a.width===b.x&&a.y===b.y)region=[b.x-2,a.y+4,4,Math.min(a.height,b.height)-8];
  if(a.y+a.height===b.y&&a.x===b.x)region=[a.x+4,b.y-2,Math.min(a.width,b.width)-8,4];
  if(!region)continue;
  const aa=await strip(a,...region),bb=await strip(b,...region);let max=0;
  for(let i=0;i<aa.length;i++)max=Math.max(max,Math.abs(aa[i]-bb[i]));
  assert.ok(max<=1,'independent boundary '+a.src+' / '+b.src+' delta '+max);checked++;
 }
 assert.ok(checked>=50,'both tile-grid axes covered');
});
