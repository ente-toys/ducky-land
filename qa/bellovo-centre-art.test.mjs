import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {geometry,inShape} from '../rive/web/island-geometry.mjs';
import {makeMap} from '../src/pixi/island-maps.js';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json'),metrics=read('scripts/bigger-cathedral/centre-art-metrics.json');
const nav=makeMap('cathedral',{world,walk,harbor,sleepers:[]}).nav(),ground=geometry(walk);
const pieces=art.props.filter(p=>['cathedral-hall','campanile'].includes(p.id)||/^centre-(colonnade-|end-pavilion-)/.test(p.id));
const centreSolids=w=>w.obstacles.filter(o=>o.id?.startsWith('centre-'));
test('The centre has one cathedral, an attached corner tower and two curved open arms; the dividing arcade is retired',()=>{
 assert.equal(pieces.length,10);
 assert.equal(art.props.filter(p=>p.id.startsWith('centre-colonnade-left-')).length,3);
 assert.equal(art.props.filter(p=>p.id.startsWith('centre-colonnade-right-')).length,3);
 assert.ok(!art.props.some(p=>/^cathedral-[23]$|^cloister-(cloister-back|roof-roses)/.test(p.id)));
 const hall=pieces.find(p=>p.id==='cathedral-hall'),tower=pieces.find(p=>p.id==='campanile');
 assert.ok(Math.abs(tower.x-hall.x)<hall.width/2,'tower meets the cathedral corner');
 assert.ok(tower.y<hall.y&&hall.y-tower.y<200,'same ground camera');
 const tree=art.props.find(p=>p.id==='cloister-olive-well'),well=art.props.find(p=>p.id==='centre-wishing-well');
 assert.deepEqual([tree.x,tree.y],[4100,2700],'olive rooted on raised fountain island');
 assert.equal(well,undefined,'freestanding old well retired');
 assert.ok(art.props.some(p=>p.id==='centre-A-fountain'));
});
test('Every centre SVG stays sharp at placed size, uses flat vector ink and has exactly one attached shadow',()=>{
 for(const p of pieces){
  const s=fs.readFileSync(A+p.src,'utf8'),root=s.match(/<svg\b[^>]*>/)[0];
  assert.ok(+root.match(/\bwidth="([\d.]+)"/)[1]>=p.width*(p.scale??1),p.id+' native width');
  assert.ok(+root.match(/\bheight="([\d.]+)"/)[1]>=p.height*(p.scale??1),p.id+' native height');
  assert.doesNotMatch(s,/<image\b|<(?:linear|radial)Gradient|<filter\b|(?:matrix|skewX|skewY|rotate)\(/i,p.id);
  assert.match(s,/#39472d/,p.id+' Home ink');
  assert.equal((s.match(/data-contact-shadow=/g)||[]).length,1,p.id+' one shadow');
  assert.equal(p.shadow,false,p.id+' no second runtime shadow');
 }
});
test('Open arch holes are genuinely transparent, so the actual piazza paving can show through',async()=>{
 for(const portal of metrics.portals){
  const p=pieces.find(p=>p.id===`centre-colonnade-${portal.side}-${portal.bay}`),x0=p.x-p.width*p.anchor.x,y0=p.y-p.height*p.anchor.y;
  const {data,info}=await sharp(A+p.src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  // End bays recede almost edge-on. Sample the opening below the intrados,
  // where upright near/far piers can overlap in this camera.
  let clear=0;
  for(let dx=-35;dx<=35;dx+=5)for(let rise=60;rise<=150;rise+=5){
   const x=Math.round(portal.front[0]-x0+dx),y=Math.round(portal.front[1]-rise-y0);
   if(x>=0&&x<info.width&&y>=0&&y<info.height&&data[(y*info.width+x)*4+3]===0)clear++;
  }
  assert.ok(clear>20,p.id+' open arch, including foreshortened end bay');
  assert.equal(p.contact,false,'open bay is not a solid sleeper exclusion rectangle');
 }
});
test('Duckies can traverse every colonnade bay and follow the covered arm; only the actual pier feet block them',()=>{
 assert.deepEqual(centreSolids(world),centreSolids(walk),'server and local footprints agree');
 for(const p of metrics.portals){
  for(let i=0;i<=20;i++){
   const t=i/20,x=p.front[0]*(1-t)+p.rear[0]*t,y=p.front[1]*(1-t)+p.rear[1]*t;
   assert.ok(ground.walkable(x,y),p.side+' bay '+p.bay+' underpass '+i);
  }
 }
 for(const side of ['left','right']){
  const points=metrics.coveredWalkways[side];
  for(let i=1;i<points.length;i++)assert.ok(nav.clearLine(points[i-1],points[i]),side+' covered route '+i);
 }
 for(const o of centreSolids(walk).filter(o=>o.id.startsWith('centre-pier-')))assert.equal(ground.walkable(o.x,o.y),false,o.id+' solid foot');
 for(const p of [[4020,1760],[4500,1740]])assert.equal(ground.walkable(...p),false,'building base solid');
 // The steps and the former dividing arcade remain on open, connected ground.
 for(const p of [[4020,1900],[4020,1960],[4100,2150],[3800,2172],[4400,2172]])assert.ok(ground.walkable(...p),'steps and central axis '+p);
});
test('The new footprint leaves the existing garden lanes clear and both sides of the piazza reachable',()=>{
 for(const [i,line]of world.paths.entries())for(const [x,y]of line){
  assert.ok(!centreSolids(walk).some(o=>inShape(x,y,o,16)),'lane '+i+' clear of centre solids');
 }
 for(const point of [[3150,2750],[5050,2750],[4020,1960]])assert.deepEqual(nav.route(4100,2172,...point).at(-1),point,'piazza destination reachable');
});
