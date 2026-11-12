import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';

for (const dev of [true,false]) test(`signup bypass is ${dev?'enabled in development':'ignored in production'}`,async t=>{
  const {outputFiles:[bundle]}=await build({
    entryPoints:['src/pixi/PixiPage.jsx'],bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false,
    loader:{'.css':'empty'},define:{'import.meta.env.DEV':String(dev)},
    plugins:[{name:'headless',setup(build){
      build.onLoad({filter:/\/src\/pixi\/three-game-view\.js$/},()=>({contents:'export async function createThreeGameView(){return {destroy(){}};}'}));
      build.onLoad({filter:/\/src\/pixi\/engine\.js$/},()=>({contents:`
        export class PixiIsland {
          constructor(options){globalThis.devEngines.push(options);}
          mount(){return Promise.resolve();}
          dispose(){}
          clearChat(){}
        }`}));
      build.onLoad({filter:/\/src\/pixi\/.*\.jsx$/},args=>args.path.endsWith('/PixiPage.jsx')?null:{contents:'export default function Stub(){return null;}'});
    }}],
  });
  const code=['react','react/jsx-runtime','react-dom','pixi.js'].reduce((text,name)=>text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
  const {default:Page}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/?dev=1'});
  const keys=['window','document','location','history','fetch','WebSocket','IS_REACT_ACT_ENVIRONMENT','devEngines'];
  const original=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const requests=[],sockets=[],engines=[];
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,history:dom.window.history,
    IS_REACT_ACT_ENVIRONMENT:true,devEngines:engines,
    fetch:async url=>{requests.push(url);return Response.json({user:null,signInAvailable:true});},
    WebSocket:class{static OPEN=1;constructor(){sockets.push(this);}close(){}send(){}},
  });
  const {createRoot}=await import('react-dom/client');
  const root=createRoot(document.getElementById('root'));
  t.after(async()=>{await act(async()=>root.unmount());Object.assign(globalThis,original);dom.window.close();});
  await act(async()=>root.render(React.createElement(Page)));
  assert.equal(engines[0].room===null,dev);
  assert.deepEqual(requests,dev?[]:['/api/session']);
  assert.equal(sockets.length,dev?0:1);
  assert.equal(Boolean(document.querySelector('.pixi-guest-play')),!dev);
  assert.equal(document.body.textContent.includes('Playing without sign-in'),dev);
  assert.equal(document.body.textContent.includes('Sign out'),false);
});
