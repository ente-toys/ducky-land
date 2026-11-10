import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';

// Exercise the real page, toolbar components and RoomClient. Only the GPU
// renderer and the WebSocket transport are replaced, so no server is needed.
const {outputFiles:[bundle]} = await build({
  entryPoints:[fileURLToPath(new URL('../src/pixi/PixiPage.jsx',import.meta.url))],
  bundle:true, packages:'external', jsx:'automatic', format:'esm', write:false,
  loader:{'.css':'empty'}, define:{'import.meta.env.DEV':'false'},
  plugins:[{name:'headless-island',setup(build) {
    build.onLoad({filter:/\/src\/pixi\/three-game-view\.js$/},()=>({contents:'export async function createThreeGameView(){return {destroy(){}};}'}));
    build.onLoad({filter:/\/src\/pixi\/engine\.js$/},()=>({contents:`
      export class PixiIsland {
        constructor({room}) {this.room = room; globalThis.toolbarEngines.push(this);}
        mount() {return Promise.resolve();}
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
const {default:PixiPage} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

// IDs are scoped by item type, including accounts whose IDs match an island.
for (const accountId of ['42','home']) test(`five reconnects and map reloads retain one toolbar and clean up listeners (account ${accountId})`,async t=>{
  const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  const originals = Object.fromEntries(['window','document','location','history','fetch','WebSocket',
    'IS_REACT_ACT_ENVIRONMENT','toolbarEngines'].map(key=>[key,globalThis[key]]));
  const sockets = [], engines = [], warnings = [], keydowns = new Set(), intervals = new Map();
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,location:dom.window.location,
    history:dom.window.history,IS_REACT_ACT_ENVIRONMENT:true,toolbarEngines:engines,
    fetch:async url=>{
      if (url === '/api/session') return Response.json({user:{accountId,login:'boss',canPlay:true}});
      assert.equal(url,'/api/friends');
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
  dom.window.HTMLDialogElement.prototype.showModal = function () {this.open = true;};
  dom.window.HTMLDialogElement.prototype.close = function () {this.open = false;};
  t.mock.method(console,'error',(...args)=>warnings.push(args.join(' ')));
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  t.mock.method(window,'addEventListener',(type,fn,...args)=>{
    // React also registers a native browser event dispatcher. Count the
    // component's shortcut subscription, which must follow its lifetime.
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
  // React detects input/focus support on import, after the DOM is available.
  const {createRoot} = await import('react-dom/client');
  let root = createRoot(document.getElementById('root'));
  const mount = ()=>act(async()=>root.render(React.createElement(React.StrictMode,null,React.createElement(PixiPage))));
  const current = ()=>sockets.at(-1);
  const welcome = ()=>act(async()=>{
    current().onopen();
    current().receive({type:'welcome',id:'self'});
  });
  const map = (epoch,islandId)=>act(async()=>current().receive({type:'snapshot',epoch,tick:1,islandId,players:[],boats:[]}));
  const buttons = text=>[...document.querySelectorAll('.pixi-live button')].filter(button=>button.textContent.trim() === text);
  const counts = playing=>{
    for (const name of ['Change outfit','Chat C','Friends','Sign out']) {
      assert.equal(buttons(name).length,playing || ['Friends','Sign out'].includes(name) ? 1 : 0,name);
    }
    assert.equal(keydowns.size,playing ? 1 : 0,'one live Chat shortcut');
    assert.deepEqual([...intervals.values()].sort((a,b)=>a-b),playing ? [80,250,5000] : [80],
      'one minimap timer, one travel timer and one connection heartbeat');
  };
  const click = async text=>{
    assert.equal(buttons(text).length,1,text);
    await act(async()=>buttons(text)[0].click());
  };
  try {
    await mount();
    await welcome();
    counts(true);
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
      // A new server/map epoch and an island change each force UI updates.
      await map(`restart-${i}`,'home');
      await map(`island-${i}`,'blossom');
      counts(true);
      assert.equal(client.onFriendsChanged,friendsChanged,'friend subscription survives reconnects');
      assert.equal(client.onNearby,nearby,'nearby subscription survives reconnects');
      await act(async()=>old.receive({type:'role',id:null,reason:'expired'}));
      counts(true); // Old connections cannot alter the active session.
      const engine = engines.at(-1), stops = engine.stops ?? 0;
      await act(async()=>window.dispatchEvent(new window.KeyboardEvent('keydown',{key:'c',cancelable:true})));
      assert.equal(engine.stops,stops+1,'C invokes exactly one Chat handler');
      assert.equal(document.querySelectorAll('input[aria-label="Message"]').length,1);
      await act(async()=>document.querySelector('.pixi-chat').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
      counts(true);
    }
    await click('Change outfit');
    assert.match(document.querySelector('.pixi-live').textContent,/Your duck is still arriving/,
      'the retained Outfit button has a working handler');
    await act(async()=>client.onNearby({id:'peer',accountId:'99',login:'friend'}));
    assert.equal(document.querySelectorAll('.pixi-friend-prompt').length,1,'one friend notification portal');
    await click('Friends');
    assert.equal(document.querySelectorAll('dialog[open]').length,1);
    await act(async()=>document.querySelector('[aria-label="Close friends"]').click());
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
    // Full page/HMR remount also starts with a single toolbar.
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
