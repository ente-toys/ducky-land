import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';

test('star dialog retries without navigation, explains failures, and confirms verified access', async () => {
  const {outputFiles:[bundle]} = await build({
    entryPoints:[fileURLToPath(new URL('../src/pixi/StarDialog.jsx',import.meta.url))],
    bundle:true, packages:'external', jsx:'automatic', format:'esm', write:false,
  });
  const code = bundle.text.replaceAll('"react"',JSON.stringify(import.meta.resolve('react')))
    .replaceAll('"react/jsx-runtime"',JSON.stringify(import.meta.resolve('react/jsx-runtime')));
  const {default:StarDialog} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const dom = new JSDOM('<div id="root"></div>');
  const originals = {window:globalThis.window, document:globalThis.document, fetch:globalThis.fetch,
    IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let response = {canPlay:false}, status = 200, confirmed = 0, closed = 0;
  globalThis.fetch = async (url,options) => {
    assert.equal(url,'/api/play-access');
    assert.equal(options.method,'POST');
    return Response.json(response,{status});
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(StarDialog,{
      onConfirm:()=>confirmed++,onClose:()=>closed++,
    })));
    assert.equal(document.querySelector('dialog').open,true);
    assert.equal(document.querySelector('a').href,'https://github.com/ente/ente');
    const retry = document.querySelector('button');
    await act(async () => retry.click());
    assert.match(document.querySelector('[role="alert"]').textContent,/No star found yet/);
    assert.equal(confirmed,0);
    response = {error:'Could not check your GitHub star. Please try again.'}; status = 503;
    await act(async () => retry.click());
    assert.match(document.querySelector('[role="alert"]').textContent,/Could not check/);
    assert.equal(confirmed,0);
    response = {canPlay:true}; status = 200;
    await act(async () => retry.click());
    assert.equal(confirmed,1);
    await act(async () => document.querySelector('button:last-child').click());
    assert.equal(closed,1);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    Object.assign(globalThis,originals);
  }
});
