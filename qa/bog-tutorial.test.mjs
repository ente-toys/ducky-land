import test from 'node:test';
import assert from 'node:assert/strict';
import {BOG_TIPS,bogTutorialKey,createBogTutorial} from '../src/features/bog-combat/tutorial.js';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';

function fixture(identity,storage=new Map()){
  const timers=new Map(),steps=[];let nextId=0;
  const options={identity,storage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},schedule:(callback,ms)=>{assert.equal(ms,5000);timers.set(++nextId,callback);return nextId;},cancel:id=>timers.delete(id),onChange:s=>steps.push(s)};
  const tutorial=createBogTutorial(options);
  return {tutorial,steps,timers,options,storage,timeout(){const [id,callback]=timers.entries().next().value;timers.delete(id);callback();}};
}

test('first entry shows three ordered tips, each action or five-second timeout advances only its own tip',()=>{
  const f=fixture('actions');assert.equal(f.tutorial.start(),true);assert.deepEqual(f.steps,[0]);assert.equal(f.timers.size,1);
  f.tutorial.action('shoot');assert.deepEqual(f.steps,[0]);f.tutorial.action('move');assert.deepEqual(f.steps,[0,1]);assert.equal(f.timers.size,1);
  f.tutorial.action('shoot');assert.deepEqual(f.steps,[0,1,2]);f.timeout();assert.deepEqual(f.steps,[0,1,2,3]);assert.equal(f.timers.size,0);
  assert.equal(f.storage.get(bogTutorialKey('actions')),'seen');
  const again=createBogTutorial(f.options);assert.equal(again.start(),false);assert.equal(f.timers.size,0);
  assert.match(BOG_TIPS[2],/hidden for 7 s.*5 lives.*random islet/);
});

test('every tip times out independently and skip cancels the pending timer immediately',()=>{
  const f=fixture('timeout');f.tutorial.start();f.timeout();f.timeout();f.timeout();assert.deepEqual(f.steps,[0,1,2,3]);assert.equal(f.timers.size,0);
  const skip=fixture('skip');skip.tutorial.start();skip.tutorial.skip();assert.deepEqual(skip.steps,[0,3]);assert.equal(skip.timers.size,0);
});

test('leaving cancels timers, StrictMode resumes them, and accounts have separate local memories',()=>{
  const f=fixture('strict');f.tutorial.start();f.tutorial.dispose();assert.equal(f.timers.size,0);
  f.tutorial.start();assert.equal(f.timers.size,1);f.timeout();assert.equal(f.steps.at(-1),1);f.tutorial.dispose();assert.equal(f.timers.size,0);
  const other=fixture('other-account',f.storage);assert.equal(other.tutorial.start(),true);other.tutorial.dispose();
  assert.equal(createBogTutorial(f.options).start(),false);
});

test('storage denial never breaks play and remains remembered for this session',()=>{
  const storage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  let timers=0;const options={identity:'denied',storage,schedule:()=>++timers,cancel:()=>{}};
  const first=createBogTutorial(options);assert.equal(first.start(),true);first.skip();first.dispose();
  assert.equal(createBogTutorial(options).start(),false);assert.equal(timers,1);
});

test('mounted StrictMode tips follow real player state, skip returns focus, and another entry stays dismissed',async()=>{
  const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/features/bog-combat/Tutorial.jsx',import.meta.url))],bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false,loader:{'.css':'empty'}});
  let code=bundle.text;for(const name of ['react','react/jsx-runtime'])code=code.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name)));
  const {default:Tutorial}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const dom=new JSDOM('<canvas tabindex="0"></canvas><div id="root"/>',{url:'https://ducky.example'});
  const before={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,IS_REACT_ACT_ENVIRONMENT:true});
  const canvas=document.querySelector('canvas'),root=createRoot(document.getElementById('root'));
  let key='entry',identity='account-1',self={id:'you',alive:true,ammo:12,pace:0};
  const render=()=>act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(Tutorial,{key,identity,self,engine:{canvas}}))));
  try{
    await render();assert.equal(document.querySelector('[role="status"]').textContent,BOG_TIPS[0]);
    self={...self,pace:120};await render();assert.equal(document.querySelector('[role="status"]').textContent,BOG_TIPS[1]);
    self={...self,ammo:11};await render();assert.equal(document.querySelector('[role="status"]').textContent,BOG_TIPS[2]);
    await act(async()=>document.querySelector('button').click());assert.equal(document.querySelector('.bog-tutorial'),null);assert.equal(document.activeElement,canvas);
    key='re-entry';await render();assert.equal(document.querySelector('.bog-tutorial'),null);
    key='another-account';identity='account-2';self={...self,pace:0};await render();assert.equal(document.querySelector('[role="status"]').textContent,BOG_TIPS[0]);
    assert.equal(localStorage.getItem(bogTutorialKey('account-1')),'seen');
  }finally{await act(async()=>root.unmount());dom.window.close();Object.assign(globalThis,before);}
});
