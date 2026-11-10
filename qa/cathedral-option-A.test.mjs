import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Container, DOMAdapter} from 'pixi.js';
import {createFountainWater,fountainPoint} from '../src/pixi/fountain.js';
import {makeMap,mapFor} from '../src/pixi/island-maps.js';
import {JSDOM} from 'jsdom';
const A='public/pixi-art/themes/cathedral/',D='rive/web/themes/cathedral/';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json');
const map=makeMap('cathedral',{world,walk,harbor:read(D+'harbor.json')});
const basin=art.props.find(p=>p.id==='centre-A-fountain');
// Exercise real meshes without requiring a browser GPU for Pixi's precision probe.
DOMAdapter.set({...DOMAdapter.get(),createCanvas:()=>({getContext:()=>null})});
test('Option A replaces the old centre with a smaller quiet piazza and a raised olive fountain island',()=>{
 assert.equal(art.raster.enabled,false);
 assert.ok(!art.flats.some(p=>/detail\/(piazza-mosaic|rose-inlay)/.test(p.src)));
 assert.ok(!art.props.some(p=>p.id==='centre-wishing-well'));
 const floor=art.flats.find(p=>p.id==='centre-A-paving');assert.deepEqual([floor.width,floor.height],[2320,1700]);
 assert.ok(basin);assert.equal(art.props.filter(p=>/^centre-A-cafe-/.test(p.id)).length,4);
 assert.equal(art.props.filter(p=>/^centre-A-lamp-/.test(p.id)).length,4);
 assert.equal(art.props.filter(p=>/^centre-A-lights-/.test(p.id)).length,2);
 assert.equal(map.sleepers.length,120);assert.equal(mapFor('cathedral').sleepers.length,120);
 assert.ok(map.sleepers.some(p=>p.pose==='leaf'&&p.x===5401&&p.y===1971),'existing resident keeps a clear lawn bed');
});
test('Every new solid matches server navigation and all arrivals stay open around the fountain',()=>{
 for(const o of world.obstacles.filter(o=>o.id?.startsWith('centre-A-'))){assert.deepEqual(o,walk.obstacles.find(p=>p.id===o.id));assert.equal(map.nav().walkable(o.x,o.y),false,o.id);}
 for(const q of [[4100,2210],[3520,2630],[4680,2630],[4100,3150],[4100,3290]])assert.ok(map.nav().walkable(...q),'clear lane '+q);
 for(const p of art.props.filter(p=>p.sittable&&p.id.startsWith('cloister-bench-'))){assert.equal(p.flip,false);assert.equal(p.rotation,undefined);assert.match(p.src,/autumn\/bench-(north|east|west)\.svg/);assert.deepEqual(p.bench.target,[4100,2720]);}
});
test('New SVGs use placed-size viewBoxes, flat Home ink, one contact shadow and no drawn residents',()=>{
 for(const p of art.props.filter(p=>p.src.startsWith('centre-A/'))){
  const s=fs.readFileSync(A+p.src,'utf8'),d=new JSDOM(s,{contentType:'image/svg+xml'}).window.document;
  assert.equal(d.documentElement.getAttribute('viewBox'),`0 0 ${p.width} ${p.height}`);
  assert.doesNotMatch(s,/<image\b|Gradient\b|<filter\b|\btransform=|duck|sleeper/i);
  assert.match(s,/#39472d/i);assert.equal(p.shadow,false);
  assert.equal(d.querySelectorAll('[data-contact-shadow]').length,p.id.includes('lights')?0:1);
 }
});
test('The olive fountain runs Home water, shares its jet curves and honours visibility and reduced motion',()=>{
 const parent=new Container(),fx=createFountainWater(basin,parent,null,basin.fountainWater);
 try{
  assert.deepEqual([fx.root.x,fx.root.y],[3620,2420]);
  for(const sp of basin.fountainWater.spills){assert.deepEqual(fountainPoint(sp,0),{x:sp.start,y:sp.jet.y});assert.deepEqual(fountainPoint(sp,1),{x:sp.x,y:sp.bottom});}
  fx.update(1,false,true);const g=fx.graphics;assert.ok(g.context.instructions.length>0);
  fx.update(2,false,true);assert.ok(g.context.instructions.length>0);
  fx.update(3,true,true);assert.equal(g.context.instructions.length,0);
  fx.update(4,false,false);assert.equal(fx.root.visible,false);
 }finally{parent.destroy({children:true});}
});
