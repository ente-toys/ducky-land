import test from 'node:test';
import assert from 'node:assert/strict';
import {createThreeGameView} from '../src/pixi/three-game-view.js';

test('island arrival clears the previous capture before throttling and never uploads mismatched art',async t=>{
 const old={document:globalThis.document,window:globalThis.window,performance:globalThis.performance,devicePixelRatio:globalThis.devicePixelRatio,cancelAnimationFrame:globalThis.cancelAnimationFrame};
 t.after(()=>Object.assign(globalThis,old));
 let time=100,frame,capture=null,clears=0,presentation,switchDuringTick=false;
 const element=()=>({style:{},dataset:{},append(){},remove(){},setAttribute(){},querySelector(){return null;}});
 Object.assign(globalThis,{document:{createElement:element},window:{},performance:{now:()=>time},devicePixelRatio:1,cancelAnimationFrame(){}});
 const host={...element(),clientWidth:1440,clientHeight:900};
 const game={ready:true,artShown:'home',islandId:'home',camera:{x:0,y:0,zoom:1},target:{},width:1440,height:900,keys:new Set(),zoomMotion:{},
  canvas:element(),app:{render(){},renderer:{resolution:1,resize(){},background:{alpha:1}}},arts:new Map([['home',{ready:true}]]),rigs:[],localDucks:[],liveRigs:new Map(),
  playerView(){return this.player;},tick(){if(switchDuringTick)this.artShown='home';},resize(){},onInteriorChange(){},listen(){},ensureArt(){},showArt(){},applyMapAmbience(){},freeArt(id){this.arts.delete(id);},artReady(id){return id==='home'||Boolean(this.arts.get(id)?.ready);}};
 const view=await createThreeGameView(game,host,{createWorld:async(_layer,options)=>{frame=options.onFrame;return {
  ready:Promise.resolve(),centreOn(){},destroy(){},setLiveCanvas(id){capture=id;},clearLiveCanvas(){capture=null;clears++;},setPresentation(blend,direct){presentation={blend,direct};}};}});
 const state=id=>({now:time,id,altitude:.3,heading:0,fov:45,point:{x:0,y:0}});
 frame(state('home'));assert.equal(capture,'home');
 const before=clears;time+=1;frame(state('isle-55'));assert.equal(capture,null);assert(clears>before,'invalidation precedes the 60Hz gate');assert.equal(presentation.blend,0);
 time+=20;frame(state('isle-55'));assert.equal(capture,null);assert.equal(game.canvas.style.visibility,'hidden');
 game.arts.set('snow',{ready:true});time+=20;frame(state('isle-55'));assert.equal(capture,'isle-55');
 // The room can change art during nativeTick while the globe reports its last camera.
 switchDuringTick=true;
 time+=20;frame(state('isle-55'));assert.equal(capture,null);assert.equal(game.canvas.style.visibility,'hidden');
 view.destroy();
});
