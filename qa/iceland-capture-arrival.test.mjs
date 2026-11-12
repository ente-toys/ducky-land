import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraGame} from './helpers/pixi-engine.mjs';
import {mapOf} from '../src/world/island-maps.js';

test('native island arrival waits for matching ready art and a player rig, then completes once',t=>{
 const prior=globalThis.document;globalThis.document={hidden:false};t.after(()=>globalThis.document=prior);
 const player={id:'me',mode:'walking',x:0,y:0},game=cameraGame(player),snow='isle-55';
 game.islandId=snow;game.artShown='home';game.arrival={id:'me',name:'Iceland'};
 let finishes=0,rig=null;game.playerRig=()=>rig;game.finishArrival=()=>{finishes++;game.arrival=null;};
 game.frameAt(10);assert.equal(game.arrival.start,undefined);
 game.artShown='snow';game.arts.set('snow',{ready:false});rig={};game.frameAt(20);assert.equal(game.arrival.start,undefined);
 game.arts.get('snow').ready=true;rig=null;game.frameAt(30);assert.equal(game.arrival.start,undefined);
 rig={};game.frameAt(40);assert.equal(game.arrival.start,40);game.frameAt(559);assert.equal(finishes,0);
 game.frameAt(560);assert.equal(finishes,1);game.frameAt(580);assert.equal(finishes,1);
});

test('native flyHome returns to the current player from the globe at every island, including reduced motion',t=>{
 const prior=globalThis.document;globalThis.document={hidden:false};t.after(()=>globalThis.document=prior);
 for(const id of ['home','blossom','sunset','isle-55','isle-249'])for(const reduced of [false,true]){
  const map=mapOf(id),player={id:'me',mode:'walking',x:map.cx,y:map.cy},game=cameraGame(player);
  game.islandId=id;game.motion.matches=reduced;game.camera={x:map.cx+12000,y:map.cy-8000,zoom:.03};game.target={...game.camera};
  game.archipelago={bounds:{x0:-100000,x1:100000}};game.flyHome();const start=game.fly.at;
  if(!reduced){game.stepFly(start+350,player);assert.ok(game.camera.zoom>.03&&game.camera.zoom<game.fly.zoom);player.x+=50;}
  game.stepFly(start+701,player);assert.equal(game.fly,null);assert.equal(game.follow,true);assert.ok(Math.abs(game.camera.x-player.x)<1e-8);assert.ok(Math.abs(game.camera.y-player.y+90)<1e-8);assert.ok(game.camera.zoom>game.minZoom);assert.deepEqual(game.camera,game.target);
 }
});
