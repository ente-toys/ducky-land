import test from 'node:test';import assert from 'node:assert/strict';
import E from '../src/world/home/home-expansion.json' with {type:'json'};
import {homePropRotation} from '../src/rendering/pixi/environment/home-motion.js';
import {readFileSync} from 'node:fs';
test('windmill sails complete a gentle nine-second turn and stop for reduced motion, the tower stays fixed',()=>{
 const mill=E.props.find(p=>p.id==='hamlet-clovercrust-mill'),sails=E.props.find(p=>p.id==='home-windmill-sails');
 assert.equal(mill.scale,1.23);assert.equal(mill.y,-496);assert.deepEqual(sails.anchor,{x:.5,y:.5});
 assert.equal(homePropRotation(sails,2.25),Math.PI/2);assert.equal(homePropRotation(sails,9),Math.PI*2);assert.equal(homePropRotation(sails,7,true),0);assert.equal(homePropRotation(mill,7),0);
 assert.ok(!readFileSync(new URL('../public'+mill.src,import.meta.url),'utf8').includes('M68 86L6 29'),'static tower contains no sails');
});
test('all Home crossings reuse the approved bridge family with boat-passable physical decks',()=>{
 assert.equal(E.homeArches.length,10);
 for(const b of E.homeArches){assert.ok(E.decks.some(d=>d.id===b.id));assert.ok(b.r>0);}
 for(const a of E.arches)assert.ok(E.walkways.some(w=>w.boatPassUnder&&Math.hypot(w.a[0]-a.a[0],w.a[1]-a.a[1])<2&&Math.hypot(w.b[0]-a.b[0],w.b[1]-a.b[1])<2));
});
