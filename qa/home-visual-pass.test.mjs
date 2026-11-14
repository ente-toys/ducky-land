import test from 'node:test';import assert from 'node:assert/strict';
import E from '../src/world/home/home-expansion.json' with {type:'json'};
test('all Home crossings reuse the approved bridge family with boat-passable physical decks',()=>{
 assert.equal(E.homeArches.length,8);
 for(const b of E.homeArches){assert.ok(E.decks.some(d=>d.id===b.id));assert.ok(b.r>0);}
 for(const a of E.arches)assert.ok(E.walkways.some(w=>w.boatPassUnder&&Math.hypot(w.a[0]-a.a[0],w.a[1]-a.a[1])<2&&Math.hypot(w.b[0]-a.b[0],w.b[1]-a.b[1])<2));
});
