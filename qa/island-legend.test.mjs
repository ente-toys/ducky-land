import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';

const {outputFiles:[bundle]} = await build({entryPoints:['src/app/IslandLegend.jsx'], bundle:true,
  packages:'external', jsx:'automatic', format:'esm', write:false});
const code = ['react','react/jsx-runtime'].reduce((text,name) =>
  text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
const {default:IslandLegend} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('guide opens on demand, stops movement, isolates keys and reopens after dismissal', async () => {
  const dom = new JSDOM('<div id="root"></div>');
  const previous = {window:globalThis.window,document:globalThis.document,
    IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close = function(){this.open=false;};
  const root = createRoot(document.getElementById('root'));
  let stops=0, keys=0;
  const island={current:{stopInput(){stops++;}}};
  window.addEventListener('keydown',()=>keys++);
  try {
    await act(async()=>root.render(React.createElement(IslandLegend,{island})));
    const trigger=document.querySelector('button');
    assert.equal(document.querySelector('dialog'),null);
    await act(async()=>trigger.click());
    let dialog=document.querySelector('dialog');
    assert.equal(dialog.open,true);
    assert.equal(stops,1);
    assert.equal(dialog.querySelectorAll('details').length,6);
    assert.match(dialog.textContent,/Each entry to Booquack Bog costs 5 feathers/);
    assert.match(dialog.textContent,/Harbor teleporters.*3 golden feathers/);
    assert.match(dialog.textContent,/name and online status/);
    dialog.querySelector('summary').dispatchEvent(new window.KeyboardEvent('keydown',{key:' ',bubbles:true}));
    assert.equal(keys,0);
    await act(async()=>{dialog.open=false;dialog.dispatchEvent(new window.Event('close'));});
    assert.equal(document.querySelector('dialog'),null);
    await act(async()=>trigger.click());
    assert.equal(stops,2);
    await act(async()=>document.querySelector('[aria-label="Close island guide"]').click());
    assert.equal(document.querySelector('dialog'),null);
  } finally {
    await act(async()=>root.unmount());
    dom.window.close();
    Object.assign(globalThis,previous);
  }
});
