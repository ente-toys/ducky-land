import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {OUTFIT_OPTIONS, randomOutfit, validOutfit, sameOutfit} from '../src/pixi/outfits.js';

test('random outfits use approved directional assets and always change the current look', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/pixi-duck/manifest.json',import.meta.url)));
  for (const [slot,indices] of Object.entries(OUTFIT_OPTIONS)) {
    for (const index of indices) {
      const entry = manifest.wardrobe.find(entry => entry.slot === slot && entry.index === index);
      assert.ok(entry,`${slot} ${index} is in the asset manifest`);
      assert.ok(manifest.views.every(view => entry.frames[String(view.angle)]?.length));
    }
  }
  let current;
  for (let i=0;i<1000;i++) {
    const next = randomOutfit(current);
    assert.ok(validOutfit(next));
    assert.equal(sameOutfit(current,next),false);
    current = next;
  }
  const first = randomOutfit(null,() => 0);
  assert.equal(sameOutfit(first,randomOutfit(first,() => 0)),false);
  assert.equal(sameOutfit(first,Object.fromEntries(Object.entries(first).reverse())),true);
});
