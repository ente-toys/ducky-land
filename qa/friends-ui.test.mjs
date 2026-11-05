import test from 'node:test';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {RoomClient} from '../src/pixi/room-client.js';

const {outputFiles:[bundle]} = await build({
  entryPoints:[fileURLToPath(new URL('../src/pixi/IslandFriends.jsx',import.meta.url))],
  bundle:true,packages:'external',jsx:'automatic',format:'esm',write:false,
});
const code = ['react','react/jsx-runtime','react-dom'].reduce((text,name) =>
  text.replaceAll(JSON.stringify(name),JSON.stringify(import.meta.resolve(name))),bundle.text);
const {default:IslandFriends} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

async function setup(api) {
  const dom = new JSDOM('<div id="root"></div><div id="notifications"></div>');
  const originals = {window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,
    IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,fetch:api,IS_REACT_ACT_ENVIRONMENT:true});
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const room = new RoomClient(()=>{});
  room.id='self';
  room.friendPlayers=[
    {id:'self',accountId:'1',login:'aswin',x:0,y:0,islandId:'home'},
    {id:'peer',accountId:'2',login:'prag-design',x:100,y:0,islandId:'home'},
  ];
  let stopped=0;
  const props={room:{current:room},island:{current:{stopInput(){stopped++;}}},status:'playing',indoors:false,
    notificationHost:document.getElementById('notifications')};
  const root = createRoot(document.getElementById('root'));
  const render = overrides => act(async () => root.render(React.createElement(IslandFriends,{...props,...overrides})));
  const click = text => {
    const button=[...document.querySelectorAll('button')].find(button => button.textContent === text);
    assert.ok(button,`Missing button: ${text}`);
    return act(async()=>button.click());
  };
  await render();
  return {room,render,click,get stopped(){return stopped;},async close(){
    await act(async()=>root.unmount());
    dom.window.close(); Object.assign(globalThis,originals);
  }};
}

test('friend UI retries saves, waits for confirmation, lists offline friends and suppresses removed or dismissed prompts', async()=>{
  let friends=[],failSave=true,releaseSave;
  const api=async (url,options={})=>{
    assert.equal(url,'/api/friends');
    if (options.method==='POST') {
      assert.deepEqual(JSON.parse(options.body),{playerId:'peer'});
      if (failSave) return Response.json({error:'That player moved away.'},{status:409});
      await new Promise(resolve=>{releaseSave=resolve;});
      const friend={accountId:'2',login:'prag-design',createdAt:1};
      friends=[friend];
      return Response.json({friend});
    }
    if (options.method==='DELETE') {friends=[];return Response.json({});}
    return Response.json({friends});
  };
  const ui=await setup(api);
  try {
    assert.match(document.querySelector('.pixi-friend-prompt').textContent,/Add @prag-design as a friend/);
    await ui.click('Add friend');
    assert.match(document.querySelector('[role="alert"]').textContent,/moved away/);
    failSave=false;
    await ui.click('Add friend');
    assert.equal([...document.querySelectorAll('button')].find(button=>button.textContent==='Adding…').disabled,true);
    assert.doesNotMatch(document.body.textContent,/added to friends/);
    await act(async()=>releaseSave());
    assert.match(document.body.textContent,/@prag-design added to friends/);
    assert.equal(document.body.textContent.includes('as a friend?'),false);
    await ui.click('Friends');
    assert.equal(document.querySelector('dialog').open,true);
    assert.equal(ui.stopped,1);
    assert.equal(document.querySelector('.pixi-friend-prompt'),null);
    assert.match(document.querySelector('li').textContent,/@prag-design/);
    await ui.click('Remove');
    assert.match(document.querySelector('.pixi-friends-empty').textContent,/No friends yet/);
    await ui.click('×');
    assert.equal(document.querySelector('.pixi-friend-prompt'),null,'removing suppresses the nearby prompt');
    await act(async()=>{
      ui.room.dismissedFriends.clear(); ui.room.updateNearby();
    });
    await ui.render({indoors:true});
    assert.equal(document.querySelector('.pixi-friend-prompt'),null);
    await ui.render({status:'reconnecting'});
    assert.equal(document.querySelector('.pixi-friend-prompt'),null);
    await ui.render({status:'watching'});
    assert.equal(document.querySelector('.pixi-friend-prompt'),null);
    await ui.render();
    await ui.click('Dismiss');
    assert.equal(document.querySelector('.pixi-friend-prompt'),null);
    friends=[{accountId:'3',login:'offline-friend',createdAt:2}];
    await act(async()=>ui.room.onFriendsChanged());
    await ui.click('Friends');
    assert.match(document.querySelector('li').textContent,/@offline-friend/);
  } finally {await ui.close();}
});

test('friend loading failures have a retry and responses from an unmounted session are ignored', async()=>{
  let fail=true,release;
  const ui=await setup(async()=>{
    if (fail) return Response.json({error:'Friends are unavailable.'},{status:503});
    await new Promise(resolve=>{release=resolve;});
    return Response.json({friends:[{accountId:'2',login:'private-friend',createdAt:1}]});
  });
  await ui.click('Friends');
  assert.match(document.querySelector('[role="alert"]').textContent,/unavailable/);
  assert.equal(document.querySelector('.pixi-friend-prompt'),null);
  fail=false;
  await ui.click('Try again');
  assert.match(document.querySelector('[role="status"]').textContent,/Loading/);
  await ui.close();
  release();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.room.friends,null);
});
