import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeMap} from '../src/pixi/island-maps.js';
import {LEFT,RIGHT} from '../scripts/bigger-cathedral/centre-art-data.mjs';
const A='public/pixi-art/themes/cathedral/';
const art=JSON.parse(fs.readFileSync(A+'art.json'));
const bays=art.props.filter(p=>p.id.startsWith('centre-colonnade-'));
const doc=p=>new JSDOM(fs.readFileSync(A+p.src,'utf8'),{contentType:'image/svg+xml'}).window.document;
function worldPier(p,element){
 const x0=p.x-p.width*p.anchor.x,y0=p.y-p.height*p.anchor.y;
 return [...element.querySelectorAll('path')].map(el=>el.getAttribute('d').replace(/([MLVHZ])([^MLVHZ]*)/g,(_,command,args)=>{
  const values=args.trim().split(/[ ,]+/).filter(Boolean).map(Number);
  return command+values.map((v,i)=>Math.round((v+(command==='H'?x0:command==='V'?y0:i%2?y0:x0))*100)/100).join(' ');
 }));
}
test('Three readable masonry bays per arm have one chunky pier per station and a square end pavilion',()=>{
 assert.equal(bays.length,6);
 assert.deepEqual([...new Set(bays.map(p=>p.arcadeVariant))].sort(),['front-facing','three-quarter-left','three-quarter-right']);
 assert.equal(art.raster.enabled,false);
 for(const side of ['left','right']){
  const stations=side==='left'?LEFT:RIGHT;
  for(let i=1;i<=3;i++){
   const p=bays.find(p=>p.id===`centre-colonnade-${side}-${i}`),d=doc(p),root=d.documentElement;
   assert.equal(root.getAttribute('viewBox'),`0 0 ${p.width} ${p.height}`);
   assert.equal(d.querySelectorAll('[data-contact-shadow]').length,1);
   assert.equal(d.querySelectorAll('[data-arcade-pier]').length,1);
   assert.equal(d.querySelectorAll('[data-rear-boundary-plinth]').length,0);
   const masonry=d.querySelector('[data-open-round-arch]');
   assert.ok([...masonry.querySelectorAll('path')].filter(el=>el.getAttribute('fill')!=='none').length>=2,'filled stone arch and soffit');
   const roof=d.querySelector('[data-straight-tiled-roof]');assert.ok(roof);
   for(const el of roof.querySelectorAll('path'))assert.doesNotMatch(el.getAttribute('d'),/[CQAS]/i,'roof planes are straight, never bent');
   assert.doesNotMatch(root.outerHTML,/\btransform=|<image\b|Gradient\b/);
   const piers=[...d.querySelectorAll('[data-arcade-pier]')].map(el=>worldPier(p,el));
   const [x,y]=stations[i-1];
   assert.equal(piers[0][0],`M${x-26} ${y-166}L${x+26} ${y-166}L${x+26} ${y-18}L${x-26} ${y-18}Z`,'one full width pier at its authored station');
  }
 }
 const world=JSON.parse(fs.readFileSync('assets/world/themes/cathedral/world.json'));
 const walk=JSON.parse(fs.readFileSync('assets/world/themes/cathedral/walk-world.json'));
 const feet=w=>w.obstacles.filter(o=>o.id?.startsWith('centre-pier-'));
 assert.equal(feet(world).length,6,'three unique pier supports per arm');
 assert.deepEqual(feet(world),feet(walk));
 assert.ok(feet(world).every(o=>!o.id.includes('rear')),'no collision from removed loose rear blocks');
});

test('End pavilion footprints match both navigation manifests and removed bays leave open ground',()=>{
 const world=JSON.parse(fs.readFileSync('assets/world/themes/cathedral/world.json'));
 const walk=JSON.parse(fs.readFileSync('assets/world/themes/cathedral/walk-world.json'));
 const harbor=JSON.parse(fs.readFileSync('assets/world/themes/cathedral/harbor.json'));
 const nav=makeMap('cathedral',{world,walk,harbor}).nav();
 const ends=art.props.filter(p=>p.id.startsWith('centre-end-pavilion-'));
 assert.equal(ends.length,2);
 for(const [side,stations]of [['left',LEFT],['right',RIGHT]]){
  const p=ends.find(p=>p.id===`centre-end-pavilion-${side}`),d=doc(p),out=side==='left'?-1:1;
  assert.equal(d.querySelectorAll('[data-end-pavilion="square"]').length,1);
  assert.equal(d.querySelectorAll('[data-hipped-terracotta-roof]').length,1);
  assert.equal(d.querySelectorAll('[data-contact-shadow]').length,1);
  assert.equal(d.querySelectorAll('[data-arcade-pier]').length,0,'terminal block replaces the thin end pier');
  assert.doesNotMatch(d.documentElement.outerHTML,/\btransform=|<image\b|Gradient\b/);
  const solid=world.obstacles.find(o=>o.id===p.id);
  assert.deepEqual(solid,walk.obstacles.find(o=>o.id===p.id));
  const [x,y]=stations[3];
  assert.deepEqual(solid.poly,[[x-72,y+5],[x+72,y+5],[x+72+out*82,y-51],[x-72+out*82,y-51]]);
  assert.equal(nav.walkable(x,y-15),false,'stone pavilion is solid');
  assert.ok(nav.walkable(x,y+65),'walk around the end remains clear');
  for(const [x,y]of stations.slice(4)){
   assert.ok(nav.walkable(x+out*11,y-15),'removed pier leaves no invisible blocker');
  }
  assert.ok(!art.props.some(p=>new RegExp(`^centre-colonnade-${side}-[4-6]$`).test(p.id)));
 }
});
