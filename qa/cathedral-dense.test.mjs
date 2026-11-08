import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const B='scripts/bigger-cathedral/dense-before/',D='rive/web/themes/cathedral/';
test('Cathedral densification leaves all rivers, bridge art, supports and harbour unchanged',()=>{
 const world=read(D+'world.json'),walk=read(D+'walk-world.json'),old=read(B+'world.json'),oldWalk=read(B+'walk-world.json');
 for(const key of ['coast','origin','water','bridges','arches','walkways','sleepSpots','centrePlacement'])assert.deepEqual(world[key],old[key],key);
 for(const key of ['coast','origin','water','bridges'])assert.deepEqual(walk[key],oldWalk[key],key);
 assert.deepEqual(read(D+'harbor.json'),read(B+'harbor.json'));
 assert.deepEqual(read('public/pixi-art/themes/cathedral/art.json').decks,read(B+'art.json').decks);
 assert.deepEqual(world.communities,old.communities,'same communities and workplaces');
});
test('Cathedral roads occupy less than a fifth of the dry extension and shrink by at least a quarter',()=>{
 const m=read('scripts/bigger-cathedral/dense-metrics.json');
 assert.ok(m.after.roadAreaPercent<20);
 assert.ok(m.reductionPercent>25);
 assert.ok(m.after.roadLength<m.before.roadLength);
});
test('Cathedral homes cluster closer to their squares while retaining mixed sizes and local amenities',()=>{
 const before=read(B+'plan.json'),after=read('scripts/bigger-cathedral/plan.json'),art=read('public/pixi-art/themes/cathedral/art.json');
 for(const c of after.communities){const old=before.communities.find(b=>b.id===c.id),radius=h=>h.reduce((s,[x,y])=>s+Math.hypot(x-c.x,y-c.y),0)/h.length;
  assert.ok(radius(c.homes)<radius(old.homes)*.87,c.id+' homes are closer to their square');
  const homes=art.props.filter(p=>p.id?.startsWith(c.id+'-home-'));
  assert.equal(homes.length,5);assert.ok(Math.max(...homes.map(p=>p.width))/Math.min(...homes.map(p=>p.width))>1.3);
 }
 assert.equal(art.props.filter(p=>p.id?.startsWith('dense-')&&p.id.endsWith('shared-well')).length,4);
});
