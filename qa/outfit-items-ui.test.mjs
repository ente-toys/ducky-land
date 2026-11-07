import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {OUTFIT_OPTIONS, validOutfit} from '../src/pixi/outfits.js';

const {outputFiles:[bundle]} = await build({
  entryPoints:[fileURLToPath(new URL('../src/pixi/IslandOutfit.jsx',import.meta.url))],
  bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false,
});
const code = ['react','react/jsx-runtime','react-dom','pixi.js'].reduce((text,name) =>
  text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
const {OutfitItems} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {wardrobe} = JSON.parse(await readFile(new URL('../public/pixi-duck/manifest.json',import.meta.url)));

test('item rows show all supported assets, change only the chosen slot, allow removal and disable while loading', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const originals = {window:globalThis.window,document:globalThis.document,
    IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const root = createRoot(document.getElementById('root'));
  let outfit = {cap:8,shades:1,acc:4,shoes:2}, changes = 0;
  const render = (disabled=false) => act(async () => root.render(React.createElement(OutfitItems,{
    wardrobe,outfit,disabled,onChange(next){outfit=next; changes++;},
  })));
  try {
    await render();
    const rows = [...document.querySelectorAll('fieldset')];
    assert.deepEqual(rows.map(row => row.querySelector('legend').textContent),['Hats','Glasses','Accessories','Shoes']);
    for (const [i,slot] of Object.keys(OUTFIT_OPTIONS).entries()) {
      const row = rows[i];
      const items = wardrobe.filter(item => item.slot === slot && OUTFIT_OPTIONS[slot].includes(item.index));
      assert.equal(row.querySelectorAll('button').length,items.length+1);
      assert.equal(row.querySelectorAll('[aria-pressed="true"]').length,1);
      assert.ok([...row.querySelectorAll('img')].every(img => img.getAttribute('src').endsWith('.svg')));
      const selected = items.find(item => item.index !== outfit[slot]);
      const before = {...outfit};
      await act(async () => row.querySelector(`[aria-label="${selected.name}"]`).click());
      assert.deepEqual(outfit,{...before,[slot]:selected.index});
      assert.ok(validOutfit(outfit));
      await render();
      assert.equal(row.querySelector(`[aria-label="${selected.name}"]`).getAttribute('aria-pressed'),'true');
      await act(async () => row.querySelector('[aria-label="None"]').click());
      assert.deepEqual(outfit,{...before,[slot]:0});
      await render();
    }
    await render(true);
    const before = changes;
    const button = rows[0].querySelector('button');
    assert.equal(button.matches(':disabled'),true);
    await act(async () => button.click());
    assert.equal(changes,before);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis,originals);
  }
});
