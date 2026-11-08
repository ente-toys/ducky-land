import test from 'node:test';
import assert from 'node:assert/strict';
import E from '../src/pixi/home-expansion.json' with {type:'json'};
import {HOME_MAP} from '../src/pixi/island-maps.js';
import {inShape} from '../rive/web/island-geometry.mjs';
import {canSail} from '../src/pixi/islands.js';
const at=([x,y])=>[(x-278)/.18,(y-204)/.18];
const wet=p=>HOME_MAP.walk.water.some(w=>inShape(...p,w));
test('Home former shoreline jetties cross real water and retain walking access',()=>{
 const n=HOME_MAP.nav();
 for(const p of [[3320,3524.5],[1039.015,3241.74],[2304.895,3561.995],[5251.99,1660.2],[4082,5584.44]]){
  assert.ok(wet(p),'painted water has a matching water collision shape');
  assert.ok(n.walkable(...p),'duck can stand on the deck over water');
  assert.equal(canSail(...p,'home'),false,'inland water and decks are closed to boats');
  assert.deepEqual(n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p).at(-1),p,'deck is reachable from Home');
 }
});
test('Home rivers block walking between crossings and the new crossing decks remain usable',()=>{
 const n=HOME_MAP.nav();
 for(const p of [[570,831],[940,950],[1290,421],[1400,383]].map(at)){
  assert.ok(wet(p));assert.equal(n.walkable(...p),false);assert.equal(canSail(...p,'home'),false);
 }
 for(const c of E.crossings){const p=at([c.x,c.y]);assert.ok(wet(p));assert.ok(n.walkable(...p));assert.deepEqual(n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...p).at(-1),p);}
});
test('Home households vary within every neighbourhood and all six useful commons are accessible',()=>{
 for(const c of E.communities){const homes=E.props.filter(p=>c.homes.includes(p.id));assert.equal(new Set(homes.map(p=>p.src)).size,homes.length);assert.ok(new Set(homes.map(p=>p.houseVariant.roof)).size>=5);assert.ok(new Set(homes.map(p=>p.houseVariant.feature)).size>=3);}
 const n=HOME_MAP.nav();assert.equal(E.commons.length,6);
 for(const c of E.commons){assert.ok(n.walkable(...c.point),c.id);assert.deepEqual(n.route(HOME_MAP.spawn.x,HOME_MAP.spawn.y,...c.point).at(-1),c.point,c.id);}
});
