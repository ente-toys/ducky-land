import assert from 'node:assert/strict';
import test from 'node:test';
import {FINISHED_THEMES, THEME_OF} from '../src/pixi/island-maps.js';
import {WORLD_ISLANDS, layoutWorld, offsetOf, neighboursOf, clearOf, GAP} from '../src/pixi/world-map.js';

const distance = i => {const o=offsetOf('home',i.id);return Math.hypot(o.x,o.y);};
test('world: finished themes occupy the nearest spots in finish order and keep saved island IDs', () => {
  const nearest=WORLD_ISLANDS.filter(i=>i.id!=='home').sort((a,b)=>distance(a)-distance(b));
  assert.deepEqual(nearest.slice(0,10).map(i=>i.theme),FINISHED_THEMES);
  assert.deepEqual(nearest.slice(0,10).map(i=>i.id),['blossom','sunset','isle-251','isle-250','isle-170','isle-230','isle-176','isle-56','isle-93','isle-163']);
  assert.deepEqual([...THEME_OF.values()],FINISHED_THEMES);
  assert.ok(neighboursOf('home').every(n=>n.island.theme),'Home jetty neighbours are finished themes');
  for(let i=1;i<10;i++) assert.ok(distance(nearest[i])>distance(nearest[i-1]));
});
test('world: appending a finished theme takes the next slot without moving earlier themes', () => {
  const next=layoutWorld(undefined,11,[...FINISHED_THEMES,'future-theme']);
  for(const old of WORLD_ISLANDS.filter(i=>i.theme)) {
    const added=next.islands.find(i=>i.id===old.id);
    assert.deepEqual([added.x,added.y,added.theme],[old.x,old.y,old.theme]);
  }
  const home=next.islands[0];
  const ordered=next.islands.filter(i=>i.id!=='home').sort((a,b)=>Math.hypot(a.x-home.x,a.y-home.y)-Math.hypot(b.x-home.x,b.y-home.y));
  assert.equal(ordered[10].theme,'future-theme');
  const geo={SX:next.SX,wrapd:next.wrapd,latOf:y=>-(y-home.y)/next.Rw};
  for(let i=0;i<next.islands.length;i++) for(let j=i+1;j<next.islands.length;j++) assert.ok(clearOf(next.islands[i],next.islands[j],geo)>GAP);
});
