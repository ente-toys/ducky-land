import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {Container} from 'pixi.js';
import {BOG_COMBAT} from '../src/features/bog-combat/config.js';

test('strict-mode dock chooses either side, returns with totals/medal case and restores island ownership',async()=>{
  const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/features/bog-combat/BogEntry.jsx',import.meta.url))],bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false,loader:{'.css':'empty','.svg':'dataurl'}});
  let code=bundle.text;
  for(const name of ['react','react/jsx-runtime','pixi.js'])code=code.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name)));
  const {default:BogEntry}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const dom=new JSDOM('<canvas></canvas><div id="root"></div>'),originals={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const sockets=[];let returns=0,closed=0;
  class Socket{
    readyState=1;bufferedAmount=0;
    constructor(url){
      sockets.push(this);this.url=new URL(url);
      queueMicrotask(()=>{
        if(this.readyState!==1)return;
        const send=data=>this.onmessage?.({data:JSON.stringify(data)}),team=this.url.searchParams.get('team');
        if(!team)send({type:'arena-lobby',counts:{karma:2,evil:0},suggested:'evil',stats:{tags:5,score:50,medals:5,bestStreak:3},medalCase:{'first-splat':true}});
        else{send({type:'arena-welcome',id:'self'});send({type:'arena-snapshot',tick:1,time:1,scores:{karma:2,evil:1},shots:[],splats:[],players:[{id:'self',team,alive:true,x:1900,y:2090,turn:0,ack:-1,ammo:12,stats:{tags:5,score:50,medals:5,bestStreak:3},medalCase:{'first-splat':true}}]});}
      });
    }
    send(){}
    close(){this.readyState=3;}
  }
  const oldRoom={},objects=new Container(),engine={canvas:document.querySelector('canvas'),objects,room:oldRoom,liveRigs:new Map(),stopInput(){},renderLiveDucks(){},dispose(){}};
  const root=createRoot(document.getElementById('root'));
  const props={...BOG_COMBAT,engine,Socket,profile:'ui-profile-'.padEnd(36,'a'),loadGhosts:async()=>({}),loadGun:async()=>[],travel:{islandId:'isle-249',mode:'walking'},status:'playing',onReturnToDock:()=>returns++,onLeave:()=>closed++};
  const click=async text=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));assert.ok(button,text);await act(async()=>button.click());};
  const render=async options=>{await act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(BogEntry,{...props,...options}))));};
  try{
    await render();assert.match(document.body.textContent,/Admit one Ducky.*Booquack Bog/);await click('Enter');
    assert.match(document.body.textContent,/Pick your side/);assert.equal(document.querySelector('.bog-pick-evil').disabled,false);
    await click('Evil');assert.equal(engine.bogCombat.room.client.self.team,'evil');assert.match(document.querySelector('aside').textContent,/5 splats/);
    const evilIcon=document.querySelector('.bog-combat-popper-icon').getAttribute('src');
    assert.doesNotMatch(decodeURIComponent(evilIcon),/karma-padlock/);
    assert.equal(sockets.filter(s=>s.url.searchParams.has('team')&&s.readyState===1).length,1,'strict effects leave exactly one participant');
    await click('Back to boat');assert.equal(engine.room,oldRoom);assert.equal(engine.bogCombat,undefined);assert.equal(returns,1);
    assert.match(document.body.textContent,/Back at the dock/);assert.match(document.querySelector('dl').textContent,/Score50/);assert.match(document.querySelector('ul').textContent,/Earned/);
    await click('Pick a team');await click('Karma');assert.equal(engine.bogCombat.room.client.self.team,'karma');
    const karmaIcon=document.querySelector('.bog-combat-popper-icon').getAttribute('src');
    assert.notEqual(karmaIcon,evilIcon);assert.match(decodeURIComponent(karmaIcon),/karma-padlock/);
    await click('Back to boat');await click('Back to boat');assert.equal(closed,1);
    await render({travel:{islandId:'isle-249',mode:'sailing'}});assert.equal(document.querySelector('[role="dialog"]'),null);
    await render();assert.ok(document.querySelector('[role="dialog"]'),'another landing opens the picker again');
  }finally{await act(async()=>root.unmount());assert.equal(engine.room,oldRoom);assert.equal(engine.bogCombat,undefined);assert.ok(sockets.every(s=>s.readyState===3));objects.destroy({children:true});dom.window.close();Object.assign(globalThis,originals);}
});
