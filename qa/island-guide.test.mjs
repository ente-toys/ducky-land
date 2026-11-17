import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {RULES} from '../src/features/bog-combat/rules.js';
const {outputFiles:[bundle]}=await build({entryPoints:['src/app/IslandGuide.jsx'],bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false});
const code=['react','react/jsx-runtime','pixi.js'].reduce((s,n)=>s.replaceAll(JSON.stringify(n),JSON.stringify(import.meta.resolve(n))),bundle.text);
const {default:IslandGuide}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('help topics work with pointer and keyboard, keep current Bog rules, and restore focus on close',async()=>{
 const dom=new JSDOM('<div id="root"></div>');
 const old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new window.Event('close'));};
 const root=createRoot(document.querySelector('#root'));let stops=0;
 try{
  await act(async()=>root.render(React.createElement(IslandGuide,{island:{current:{stopInput(){stops++;}}}})));
  const trigger=document.querySelector('.pixi-guide-button');await act(async()=>trigger.click());
  assert.equal(stops,1);assert.equal(document.querySelector('dialog').open,true);
  assert.equal(document.querySelectorAll('[role=tab]').length,3);assert.equal(document.querySelectorAll('.pixi-guide-emote').length,8);
  assert.equal(document.querySelector('details').open,false);
  const controls=document.querySelector('#guide-tab-controls');
  await act(async()=>controls.dispatchEvent(new window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true})));
  assert.equal(document.activeElement.id,'guide-tab-bog');assert.equal(document.querySelector('[aria-selected=true]').id,'guide-tab-bog');
  const text=document.querySelector('[role=tabpanel]').textContent;
  assert.ok(text.includes(`${RULES.ammoCapacity}droplets per tank`));assert.ok(text.includes(`${RULES.hitsPerHeart}hits per heart`));assert.ok(text.includes('Hold click'));assert.ok(text.includes('no winning team'));
  assert.ok(!text.includes('12 shots'));assert.ok(!text.includes('three splats'));
  await act(async()=>document.querySelector('#guide-tab-world').click());assert.match(document.querySelector('[role=tabpanel]').textContent,/Take the scenic route/);
  await act(async()=>document.querySelector('.pixi-guide-close').click());assert.equal(document.activeElement,trigger);
  await act(async()=>trigger.click());assert.equal(document.querySelector('[aria-selected=true]').id,'guide-tab-controls');
 }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,old);}
});
