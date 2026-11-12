import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {makeMap} from '../src/pixi/island-maps.js';
import {VILLAGES} from '../scripts/bigger-cathedral/villages-data.mjs';
import {BUILDING_STYLES} from '../scripts/bigger-cathedral/buildings-data.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const A='public/pixi-art/themes/cathedral/',D='assets/world/themes/cathedral/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
const map=makeMap('cathedral',{world,walk,harbor:read(D+'harbor.json')}),nav=map.nav();
const buildings=art.props.filter(p=>BUILDING_STYLES[p.id]);
const document=p=>new JSDOM(fs.readFileSync(A+p.src,'utf8'),{contentType:'image/svg+xml'}).window.document;

test('All 16 village/harbour buildings retain door anchors, visible thresholds and reachable Ducky-width approaches',()=>{
 assert.equal(buildings.length,16);
 for(const v of VILLAGES)for(const o of v.pieces.filter(o=>/building|house|workplace/.test(o.role))){
  const p=buildings.find(p=>p.id===v.id+'-'+o.id);assert.ok(p,o.id);
  const x=v.square[0]+o.offset[0],y=v.square[1]+o.offset[1]+o.size[1]/2;
  assert.deepEqual([p.x,p.y],[x,y],p.id+' unchanged sort origin');
  assert.deepEqual(p.door,[x,y+40]);
  const door=document(p).querySelector('[data-threshold-y]');
  assert.ok(+door.getAttribute('data-door-width')>=60);
  assert.equal(+door.getAttribute('data-door-height'),92);
  const threshold=p.y-p.anchor.y*p.height+ +door.getAttribute('data-threshold-y');
  assert.ok(Math.abs(threshold-(y+40))<.001,p.id+' visible step meets path');
  for(const dx of [-14,0,14])for(const dy of [0,16,32])assert.ok(nav.walkable(x+dx,y+40+dy),p.id+' clear approach');
  assert.deepEqual(nav.route(map.spawn.x,map.spawn.y,x,y+40).at(-1),p.door,p.id+' reachable');
  assert.equal(nav.walkable(x,y-12),false,p.id+' building base solid');
  assert.deepEqual(walk.obstacles.find(q=>q.id===p.id),world.obstacles.find(q=>q.id===p.id));
 }
});

test('Building camera is upright, crisp at placed size and has exactly one ink contact shadow',()=>{
 for(const p of buildings){
  const doc=document(p),svg=doc.documentElement,source=svg.outerHTML;
  assert.deepEqual(svg.getAttribute('viewBox').split(' ').map(Number),[0,0,p.width,p.height]);
  assert.equal(+svg.getAttribute('width'),p.width);assert.equal(+svg.getAttribute('height'),p.height);
  assert.ok(doc.querySelector('[data-camera="home-front-roof-side"]'));
  assert.ok(doc.querySelector('[data-roof-plane]'));
  assert.equal(doc.querySelectorAll('[data-contact-shadow]').length,1,p.id);
  assert.equal(doc.querySelectorAll('[opacity]').length,1,p.id+' no second shadow');
  assert.equal(p.shadow,false,p.id+' runtime shadow disabled');
  assert.equal(p.flip,false);
  assert.doesNotMatch(source,/<image\b|<filter\b|Gradient\b|\btransform=|data:image/i);
  assert.ok(source.includes('#39472d'));assert.ok(source.includes('#839953'));
  assert.ok(source.includes(BUILDING_STYLES[p.id].roofColor));
 }
 for(const v of VILLAGES){
  const homes=buildings.filter(p=>p.id.startsWith(v.id+'-house-'));
  assert.equal(homes.length,3);
  const roofShapes=homes.map(p=>document(p).querySelector('[data-roof-plane]>path').getAttribute('d'));
  assert.equal(new Set(roofShapes).size,3,v.id+' three distinct house silhouettes');
 }
});

test('Every village plaza is flat opaque gold paving without extrusion, shadow or perimeter stroke',()=>{
 const floors=art.flats.filter(p=>/^villages\//.test(p.src)&&/square/.test(p.src));assert.equal(floors.length,4);
 for(const p of floors){
  const doc=document(p),source=doc.documentElement.outerHTML;
  assert.ok(doc.querySelector('[data-flat-paving="true"]'));
  assert.doesNotMatch(source,/opacity=|<ellipse\b|Gradient\b|filter=|transform=/);
  const surface=doc.querySelector('path');assert.equal(surface.getAttribute('fill'),'#F7DC88');assert.equal(surface.getAttribute('stroke'),'none');
  assert.deepEqual(doc.documentElement.getAttribute('viewBox').split(' ').map(Number),[0,0,p.width,p.height]);
 }
});

test('The Tessera flower inlay stays flat without a cast shadow',()=>{
 const doc=document({src:'villages/tessera/flower-mosaic.svg'});
 for(const el of doc.querySelectorAll('[opacity]'))assert.equal(+el.getAttribute('opacity'),1);
 assert.ok(doc.querySelectorAll('path').length>40,'authored ring and petals retained');
});
