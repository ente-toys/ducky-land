import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const B='scripts/bigger-cathedral/dense-before/',D='assets/world/themes/cathedral/';
test('Cathedral water upgrade preserves the densified community layout and centre',()=>{
 const world=read(D+'world.json'),old=read(B+'world.json');
 for(const key of ['coast','origin','centrePlacement'])assert.deepEqual(world[key],old[key],key);
 assert.deepEqual(world.communities.map(c=>[c.id,c.name,c.people]),old.communities.map(c=>[c.id,c.name,c.people]),'same community identities');
 assert.equal(world.arches.length,13);
 assert.ok(world.boatWater.length>0);
});
test('Cathedral roads use the design-system widths and every village frontage is a 104-unit lane',()=>{
 const world=read(D+'world.json');
 assert.equal(world.paths.length,world.pathWidths.length);
 assert.ok(world.pathWidths.every(w=>w>=90&&w<=128));
 assert.ok(world.pathSystem.routes.filter(r=>/-door$|-arrival$/.test(r.id)).every(r=>r.width===104));
});
test('Approved simple villages each have three houses, a workplace, two benches and two lamps',()=>{
 const art=read('public/pixi-art/themes/cathedral/art.json'),world=read(D+'world.json');
 for(const c of world.communities){
  assert.equal(c.homes,3);
  const props=art.props.filter(p=>p.id?.startsWith(c.id+'-'));
  assert.equal(props.filter(p=>p.id.includes('-house-')).length,3);
  assert.equal(props.filter(p=>/foundry|olive-workshop|mosaic-workshop|bakery/.test(p.id)).length,1);
  assert.equal(props.filter(p=>p.id.includes('-bench')).length,2);
  assert.equal(props.filter(p=>p.id.includes('-lamp')).length,2);
  assert.ok(!props.some(p=>/-home-\d|-garden-|washing|sign/.test(p.id)));
  assert.ok(!art.props.some(p=>p.id.startsWith('dense-')));
 }
});
