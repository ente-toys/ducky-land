import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';

for (const {name,dev,query,offline,signInAvailable=true} of [
  {name:'the dev shortcut starts offline play in development',dev:true,query:'?dev=1',offline:true},
  {name:'production ignores the dev shortcut',dev:false,query:'?dev=1',offline:false},
  {name:'production offers guest play even when GitHub sign-in is unavailable',dev:false,query:'',offline:false,signInAvailable:false},
  {name:'production guest play starts without a session or room connection',dev:false,query:'?offline',offline:true},
]) test(name,async t=>{
  const {outputFiles:[bundle]}=await build({
    entryPoints:['src/app/PixiPage.jsx'],bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false,
    loader:{'.css':'empty'},define:{'import.meta.env.DEV':String(dev)},
    plugins:[{name:'headless',setup(build){
      build.onLoad({filter:/\/src\/rendering\/pixi\/engine\.js$/},()=>({contents:`
        export class PixiIsland {
          constructor(options){globalThis.devEngines.push(options);}
          mount(){return Promise.resolve();}
          dispose(){}
          clearChat(){}
        }`}));
      build.onLoad({filter:/\/src\/(?:app|features\/bog-combat)\/.*\.jsx$/},args=>args.path.endsWith('/PixiPage.jsx')?null:{contents:'export default function Stub(){return null;}'});
    }}],
  });
  const code=['react','react/jsx-runtime','react-dom','pixi.js'].reduce((text,name)=>text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
  const {default:Page}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const dom=new JSDOM('<div id="root"></div>',{url:`http://localhost/${query}`});
  const keys=['window','document','location','history','fetch','WebSocket','IS_REACT_ACT_ENVIRONMENT','devEngines'];
  const original=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const requests=[],sockets=[],engines=[];
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,
    IS_REACT_ACT_ENVIRONMENT:true,devEngines:engines,
    fetch:async url=>{requests.push(url);return Response.json({user:null,signInAvailable});},
    WebSocket:class{static OPEN=1;constructor(){sockets.push(this);}close(){}send(){}},
  });
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('root'));
  t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,original);dom.window.close();});
  await act(async()=>root.render(React.createElement(Page)));
  assert.equal(engines[0].room===null,offline);
  assert.deepEqual(requests,offline?[]:['/api/session']);
  assert.equal(sockets.length,offline?0:1);
  const guestLink=document.querySelector('.pixi-guest-play a[href="?offline"]');
  if (offline) {
    assert.equal(guestLink,null);
    assert.equal(document.querySelector('.pixi-live a[href="/"]').textContent,'Back to live');
  } else {
    assert.equal(guestLink.textContent,'Continue as guest');
    assert.equal(Boolean(document.querySelector('a[href="/auth/github/start"]')),signInAvailable);
  }
  assert.equal(document.body.textContent.includes('Playing without sign-in'),offline);
  assert.equal(document.body.textContent.includes('Sign out'),false);
});
