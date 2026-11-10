import test from 'node:test';
import assert from 'node:assert/strict';
import {setBogReviewCamera,waitForBogArt} from '../src/pixi/bog-review-camera.js';

test('direct Bog entry clears Home landing basis and inertia before the first frame',()=>{
 const game={camera:{x:NaN,y:NaN,zoom:.1,basis:{a:0}},target:{basis:{}},zoomMotion:{velocity:4},landingView:{at:0},fly:{},spin:{},globeAim:{},globeT:1,birdEye:true,scene:{visible:false}};
 setBogReviewCamera(game,1900,2000);
 assert.deepEqual(game.camera,{x:1900,y:2000,zoom:.65});assert.deepEqual(game.target,game.camera);
 for(const key of ['landingView','fly','spin','globeAim'])assert.equal(game[key],null);
 assert.equal(game.zoomMotion.velocity,0);assert.equal(game.globeT,0);assert.equal(game.scene.visible,true);
});
test('Bog readiness waits for lazy island artwork and shows it without a camera click',async()=>{
 const art={ready:false},shown=[],game={arts:new Map([['bog-arena',art]]),showArt:id=>shown.push(id)};
 let frames=0;
 assert.equal(await waitForBogArt(game,{nextFrame:async()=>{if(++frames===3)art.ready=true;}}),true);
 assert.equal(frames,3);assert.deepEqual(shown,['bog-arena']);
 game.arts.set('bog-arena',{failed:true});await assert.rejects(waitForBogArt(game),/artwork failed/);
 assert.equal(await waitForBogArt(game,{cancelled:()=>true}),false);
});
