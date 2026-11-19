import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';

const {outputFiles:[bundle]} = await build({
  entryPoints:[fileURLToPath(new URL('../src/app/PixiPage.jsx',import.meta.url))],
  bundle:true, packages:'external', jsx:'automatic', format:'esm', write:false,
  loader:{'.css':'empty','.svg':'dataurl'}, define:{'import.meta.env.DEV':'false'},
  plugins:[{name:'headless-island',setup(build) {
    build.onLoad({filter:/\/src\/rendering\/pixi\/engine\.js$/},()=>({contents:`
      export class PixiIsland {
        constructor({room}) {this.room = room; globalThis.toolbarEngines.push(this);}
        mount() {return Promise.resolve();}
        async prepareIsland() {}
        clearChat() {}
        stopInput() {this.stops = (this.stops ?? 0) + 1;}
        positionChatEditor() {}
        travelOptions() {return {};}
        dispose() {this.disposed = true;}
      }
    `}));
  }}],
});
const code = ['react','react/jsx-runtime','react-dom','pixi.js'].reduce((text,name)=>
  text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
const pageModule = 'data:text/javascript;base64,'+Buffer.from(code).toString('base64');

for (const accountId of ['42','home']) test(`five reconnects and map reloads retain one toolbar and clean up listeners (account ${accountId})`,async t=>{
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  const originals = Object.fromEntries(['window','document','location','history','fetch','WebSocket',
    'IS_REACT_ACT_ENVIRONMENT','toolbarEngines'].map(key=>[key,globalThis[key]]));
  const sockets = [], engines = [], warnings = [], keydowns = new Set(), intervals = new Map();
  let friendReads = 0;
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,
    history:dom.window.history,IS_REACT_ACT_ENVIRONMENT:true,toolbarEngines:engines,
    fetch:async url=>{
      if (url === '/api/session') return Response.json({user:{accountId,login:'boss',canPlay:true}});
      assert.equal(url,'/api/friends');
      friendReads++;
      return Response.json({friends:[],incoming:[],outgoing:[]});
    },
    WebSocket:class {
      static OPEN = 1;
      constructor() {this.readyState = 1; sockets.push(this);}
      send() {}
      close() {this.readyState = 3; this.onclose?.({code:1006});}
      receive(message) {this.onmessage({data:JSON.stringify(message)});}
    },
  });
  // Pixi probes canvas support when imported; the headless engine needs no context.
  t.mock.method(dom.window.HTMLCanvasElement.prototype,'getContext',() => null);
  t.mock.method(console,'error',(...args)=>warnings.push(args.join(' ')));
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  t.mock.method(window,'addEventListener',(type,fn,...args)=>{
    if (type === 'keydown' && fn.name === 'shortcut') keydowns.add(fn);
    return add(type,fn,...args);
  });
  t.mock.method(window,'removeEventListener',(type,fn,...args)=>{
    if (type === 'keydown' && fn.name === 'shortcut') keydowns.delete(fn);
    return remove(type,fn,...args);
  });
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const schedule = globalThis.setInterval, cancel = globalThis.clearInterval;
  t.mock.method(globalThis,'setInterval',(fn,delay,...args)=>{
    const id = schedule(fn,delay,...args); intervals.set(id,delay); return id;
  });
  t.mock.method(globalThis,'clearInterval',id=>{intervals.delete(id); cancel(id);});
  const {createRoot} = await import('react-dom/client');
  let root = createRoot(document.getElementById('root'));
  const current = ()=>sockets.at(-1);
  const welcome = ()=>act(async()=>{
    current().onopen();
    current().receive({type:'welcome',id:'self'});
  });
  const map = (epoch,islandId)=>act(async()=>current().receive({type:'snapshot',epoch,tick:1,islandId,players:[],boats:[]}));
  const chatButtons = ()=>[...document.querySelectorAll('.pixi-chat-dock button')].filter(button=>button.textContent.trim() === 'Chat C');
  const counts = playing=>{
    assert.equal(document.querySelectorAll('.pixi-profile-button').length,1,'one profile button');
    assert.equal(chatButtons().length,playing ? 1 : 0,'Chat C');
    assert.equal(keydowns.size,playing ? 1 : 0,'one live Chat shortcut');
    assert.deepEqual([...intervals.values()].sort((a,b)=>a-b),playing ? [80,150,250,250,500,500,4000,5000] : [80,150,500,500],
      'one minimap timer, one startup canvas timer, one travel timer, one telescope timer, the profile outfit and feather-chip watchers, one friends-on-map poll and one connection heartbeat');
  };
  try {
    const {default:PixiPage} = await import(pageModule);
    const mount = ()=>act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(PixiPage))));
    await mount();
    await welcome();
    counts(true);
    const initialFriendReads = friendReads;
    const client = engines.at(-1).room;
    const friendsChanged = client.onFriendsChanged, nearby = client.onNearby;
    for (let i=0;i<5;i++) {
      const old = current(), total = sockets.length;
      await act(async()=>old.close());
      counts(false);
      await act(async()=>t.mock.timers.tick(350));
      assert.equal(sockets.length,total+1,'one automatic reconnect');
      await welcome();
      counts(true);
      await map(`restart-${i}`,'home');
      await map(`island-${i}`,'blossom');
      counts(true);
      assert.equal(client.onFriendsChanged,friendsChanged,'friend subscription survives reconnects');
      assert.equal(client.onNearby,nearby,'nearby subscription survives reconnects');
      await act(async()=>old.receive({type:'role',id:null,reason:'expired'}));
      counts(true);
      const engine = engines.at(-1), stops = engine.stops ?? 0;
      await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'c',cancelable:true})));
      assert.equal(engine.stops,stops+1,'C invokes exactly one Chat handler');
      assert.equal(document.querySelectorAll('input[aria-label="Message"]').length,1);
      await act(async()=>document.querySelector('.pixi-chat').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
      counts(true);
      await act(async()=>t.mock.timers.tick(650));
      assert.equal(friendReads,initialFriendReads,'repeated reconnects do not fetch friends');
    }
    await act(async()=>t.mock.timers.tick(2350));
    assert.equal(friendReads,initialFriendReads+1,'friends refresh once after the connection settles');
    await act(async()=>current().receive({type:'friends-changed'}));
    assert.equal(friendReads,initialFriendReads+2,'friend change events still refresh immediately');
    await act(async()=>client.onNearby({id:'peer',accountId:'99',login:'friend'}));
    assert.equal(document.querySelectorAll('.pixi-friend-prompt').length,1,'one friend notification portal');
    await act(async()=>document.querySelector('.pixi-profile-button').click());
    assert.equal(document.querySelector('.pixi-profile-panel').hidden,false,'profile opens');
    assert.equal(document.querySelectorAll('.pixi-friends-inline').length,1,'friends list sits in the profile panel');
    assert.equal([...document.querySelectorAll('.pixi-profile-signout')].length,1,'sign out sits in the profile panel');
    await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape'})));
    assert.equal(document.querySelector('.pixi-profile-panel').hidden,true,'Escape closes the profile');
    await act(async()=>root.unmount());
    assert.equal(keydowns.size,0);
    assert.equal(intervals.size,0);
    assert.equal(client.friends,null);
    assert.notEqual(client.onFriendsChanged,friendsChanged,'friend callbacks detached');
    assert.notEqual(client.onNearby,nearby,'nearby callback detached');
    assert.ok(engines.every(engine=>engine.disposed));
    const total = sockets.length;
    await act(async()=>t.mock.timers.tick(10000));
    assert.equal(sockets.length,total,'unmount cancels reconnects');
    root = createRoot(document.getElementById('root'));
    await mount(); await welcome(); counts(true);
    assert.equal(warnings.length,0,warnings.join('\n'));
  } finally {
    await act(async()=>root.unmount());
    t.mock.restoreAll();
    t.mock.timers.reset();
    dom.window.close();
    Object.assign(globalThis,originals);
  }
});
