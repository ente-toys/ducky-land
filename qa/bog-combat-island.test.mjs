import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Container,Texture} from 'pixi.js';
import {walkStep} from '../src/gameplay/player-motion.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {walkingActor} from '../src/features/bog-combat/physics.js';
import {movementFacing,facingVector} from '../src/features/bog-combat/facing.js';
import {bindCombatInput} from '../src/features/bog-combat/input.js';
import {BogCombatRoom} from '../src/features/bog-combat/room.js';
import {attachGunC} from '../src/features/bog-combat/held-gun.js';
import {attachBogCombat} from '../src/features/bog-combat/attach.js';
import {normalizeBogBlockers} from '../src/features/bog-combat/blockers.js';
import {combatForBogEnvironment} from '../src/features/bog-combat/environment.js';
import guns from '../src/features/bog-combat/assets/guns.json' with {type:'json'};

test('Bog walking, Shift acceleration, braking and sliding are identical to the island player',()=>{
  const nav={walkable:(x,y)=>x>0&&x<500&&y>0&&y<500,clearLine(from,to){return this.walkable(...from)&&this.walkable(...to);}};
  const arena=createBogCombat({navigation:nav,blockers:[],bounds:{width:500,height:500},pads:()=>[{x:250,y:250}]});
  const p=arena.join({id:'a',team:'karma'}),reference=walkingActor(p);
  for(let i=0;i<360;i++){
    const control=i<30?{x:1,y:0}:i<120?{x:1,y:1,run:true}:i<180?{x:-1,y:0}:i<240?{x:0,y:0}:{x:-1,y:-1,run:true};
    arena.input('a',{seq:i,...control,fire:false});arena.step(1/60);
    walkStep(reference,nav,1/60,arena.state.time,control);
    for(const key of ['x','y','pace','turn','travel','action'])assert.equal(p[key],reference[key],`${key} at frame ${i}`);
  }
});

test('all eight facing directions use island axes and mouse-style aim packets cannot steer paint',()=>{
  for(const x of [-1,0,1])for(const y of [-1,0,1]){
    if(!x&&!y)continue;
    const facing=movementFacing({x,y}),vector=facingVector(facing),length=Math.hypot(x,y);
    assert.ok(Math.abs(vector.x-x/length)<1e-9);assert.ok(Math.abs(vector.y-y/length)<1e-9);
    assert.equal(movementFacing({x:0,y:0},facing),facing);
  }
  const arena=createBogCombat(),p=arena.join({id:'a',team:'karma'});
  arena.input('a',{seq:0,x:0,y:1,facing:Math.PI,ax:1,ay:0,fire:true});arena.step(1/60);
  assert.equal(p.facing,0);assert.equal(arena.state.shots[0].dx,0);assert.equal(arena.state.shots[0].dy,1);
});

test('shoot captures Space, J and left click while island movement and Shift keep their original listeners',()=>{
  const dom=new JSDOM('<canvas tabindex="0"></canvas><input><button>Join</button>'),{window}=dom,{document}=window;
  const canvas=document.querySelector('canvas'),fire=[],island=[];let leaves=0;
  window.addEventListener('keydown',e=>island.push(e.code));canvas.addEventListener('pointerdown',()=>island.push('walk-click'));
  const unbind=bindCombatInput(canvas,{keyboard:window,document,onFire:value=>fire.push(value),onLeave:()=>leaves++});
  const key=(code,type='keydown',target=canvas,extra={})=>target.dispatchEvent(new window.KeyboardEvent(type,{code,key:code==='Space'?' ':code==='Escape'?'Escape':code==='KeyJ'?'j':'w',bubbles:true,cancelable:true,...extra}));
  key('KeyW');key('ShiftLeft');assert.deepEqual(island,['KeyW','ShiftLeft']);
  key('Space');assert.equal(fire.at(-1),true);assert.deepEqual(island,['KeyW','ShiftLeft']);
  key('KeyJ');key('Space','keyup');assert.equal(fire.at(-1),true);key('KeyJ','keyup');assert.equal(fire.at(-1),false);
  key('Space','keydown',document.querySelector('input'));assert.equal(fire.at(-1),false);
  key('KeyJ','keydown',canvas,{ctrlKey:true});assert.equal(fire.at(-1),false);
  canvas.dispatchEvent(new window.MouseEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));assert.equal(fire.at(-1),true);assert.ok(!island.includes('walk-click'));
  window.dispatchEvent(new window.Event('blur'));assert.equal(fire.at(-1),false);
  key('Space');document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(fire.at(-1),false);
  key('Escape');assert.equal(leaves,1);unbind();key('Space');assert.ok(island.includes('Space'));dom.window.close();
});

test('the room adapter keeps one shared movement step and ignores movement while tagged',()=>{
  let ws;class Socket{readyState=1;bufferedAmount=0;sent=[];constructor(){ws=this;}send(value){this.sent.push(JSON.parse(value));}close(){}}
  const navigation={walkable:()=>true,clearLine:()=>true};
  const room=new BogCombatRoom({Socket,navigation,profile:'x'.repeat(36),url:'ws://localhost/arena-room'});
  const receive=value=>ws.onmessage({data:JSON.stringify(value)});
  receive({type:'arena-welcome',id:'self'});
  const snapshot=(tick,alive)=>({type:'arena-snapshot',tick,time:tick/60,scores:{karma:0,evil:0},shots:[],splats:[],players:[{id:'self',team:'karma',name:'Ducky',alive,x:100,y:100,turn:0,facing:0,ack:-1,stats:{},ammo:12}]});
  receive(snapshot(1,true));const reference=walkingActor(room.player),control={x:1,y:-1,run:true};
  room.setFire(true);room.step(1/60,control,100);walkStep(reference,navigation,1/60,2/60,control);
  assert.equal(room.player.x,reference.x);assert.equal(room.player.y,reference.y);assert.equal(room.player.pace,reference.pace);
  assert.equal(ws.sent[0].fire,true);assert.equal(ws.sent[0].run,true);assert.equal(room.poses()[0].mode,'walking');assert.deepEqual(room.poses()[0].outfit,{});
  receive(snapshot(2,false));room.step(1/60,control,200);assert.equal(room.player.x,100);assert.equal(ws.sent.at(-1).fire,false);assert.equal(ws.sent.at(-1).x,0);
  room.dispose();
});

test('Gun C is seated on the original Ducky wing and its barrel follows facing through a smooth turn',()=>{
  const objects=new Container(),root=new Container(),art=new Container(),view=new Container({label:'Direction 0'}),body=new Container();
  view.addChild(new Container(),new Container(),body);art.addChild(view);root.addChild(art);objects.addChild(root);
  const source=guns.find(g=>g.team==='karma'&&g.rigAngle===0),wing=new Container({label:source.wingPose.part});body.addChild(wing);
  root.position.set(100,200);root.scale.set(.7);body.rotation=.12;body.scale.set(1.03,.94);
  const gun=attachGunC({root},[{...source,texture:Texture.WHITE}],'karma',objects);
  const pose={alive:true,x:100,y:200,facing:Math.PI/2};gun.update(pose);
  const mount=body.children.find(c=>c.label==='Gun C wing grip');assert.ok(mount);assert.equal(wing.parent,body);
  const grip=objects.toLocal(mount.toGlobal({x:0,y:0})),muzzle=gun.muzzle();
  assert.ok(muzzle.x>grip.x);assert.ok(Math.abs(muzzle.y-grip.y)<1e-6,'barrel points right even while the body is facing down');
  gun.update({...pose,alive:false});assert.equal(mount.visible,false);assert.equal(gun.muzzle(),null);
  gun.dispose();assert.equal(body.children.length,1);assert.equal(body.children[0],wing);objects.destroy({children:true});
});

test('combat attaches to one existing scene and restores the island room and listeners on leaving',async()=>{
  const dom=new JSDOM('<canvas tabindex="0"></canvas>'),previousWindow=globalThis.window,previousDocument=globalThis.document;
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  let layer;
  try{
    const canvas=document.querySelector('canvas'),navigation={walkable:()=>true,clearLine:()=>true},previousRoom={navHere:()=>navigation},objects=new Container();
    let leaves=0,stops=0,draws=0;class Socket{readyState=1;bufferedAmount=0;send(){}close(){}}
    const engine={canvas,objects,room:previousRoom,islandId:'isle-249',liveRigs:new Map(),renderLiveDucks(){draws++;},stopInput(){stops++;},dispose(){this.disposed=true;}};
    const originalRender=engine.renderLiveDucks,originalDispose=engine.dispose;
    layer=await attachBogCombat(engine,{team:'karma',profile:'x'.repeat(36),Socket,url:'ws://localhost/arena-room',loadGhosts:async()=>({}),loadGun:async()=>[],onLeave:()=>leaves++});
    assert.equal(engine.room,layer.room);assert.equal(engine.objects,objects);assert.equal(engine.bogCombat,layer);
    engine.renderLiveDucks([],1/60,0,false,()=>true);assert.equal(draws,1);
    await assert.rejects(()=>attachBogCombat(engine,{loadGhosts:async()=>({}),loadGun:async()=>[]}),/already attached/);
    let removed=0;engine.liveRigs.set('combat-ghost',{rig:{dispose(){removed++;}},nameplate:{remove(){removed++;}}});
    layer.leave();layer.leave();assert.equal(leaves,1);assert.equal(stops,2);assert.equal(engine.room,previousRoom);
    assert.equal(engine.liveRigs.size,0);assert.equal(removed,2,'offline exit disposes combat rigs immediately');
    assert.equal(engine.renderLiveDucks,originalRender);assert.equal(engine.dispose,originalDispose);assert.equal(engine.bogCombat,undefined);assert.equal(objects.children.length,0);
    layer=await attachBogCombat(engine,{team:'evil',profile:'x'.repeat(36),Socket,url:'ws://localhost/arena-room',loadGhosts:async()=>({}),loadGun:async()=>[]});
    engine.dispose();assert.equal(engine.disposed,true);assert.equal(engine.room,previousRoom);assert.equal(engine.bogCombat,undefined);objects.destroy({children:true});
  }finally{layer?.leave(false);globalThis.window=previousWindow;globalThis.document=previousDocument;dom.window.close();}
});

test('a cancelled gun load cannot attach combat after its React visit has ended',async()=>{
  const originalRoom={},engine={canvas:{},objects:{},room:originalRoom};
  const abort=new AbortController();let finish;
  const pending=attachBogCombat(engine,{navigation:{},signal:abort.signal,loadGhosts:async()=>({}),loadGun:()=>new Promise(resolve=>{finish=resolve;})});
  abort.abort();finish([]);await assert.rejects(pending,{name:'AbortError'});
  assert.equal(engine.room,originalRoom);assert.equal(engine.bogCombat,undefined);
});

test('environment rectangle and polygon interfaces share exact solid footprints and four valid base pads',()=>{
  const rect={id:'wall',type:'rect',kind:'wall',x:100,y:200,width:60,height:20};
  const [a]=normalizeBogBlockers([rect]),[b]=normalizeBogBlockers([{id:'wall',kind:'wall',poly:[[100,200],[160,200],[160,220],[100,220]]}]);
  assert.deepEqual(a,b);assert.ok(a.blocksWalk&&a.blocksShots);assert.ok(Object.isFrozen(a.polygon));
  assert.throws(()=>normalizeBogBlockers([{id:'bad',polygon:[]}]),/Invalid Bog blocker/);
  const navigation={walkable:()=>true,clearLine:()=>true},areas={'karma-nw':{x:1900,y:1850},'karma-sw':{x:1900,y:5650},'evil-ne':{x:6500,y:1850},'evil-se':{x:6500,y:5650},'site-a':{x:2050,y:3770}};
  const config=combatForBogEnvironment({map:{nav:()=>navigation,width:8400,height:8200,world:{}},islandId:'isle-249'},[rect],areas);
  assert.equal(config.navigation,navigation);assert.equal(config.pads('karma').length,2);assert.equal(config.pads('evil').length,2);
  assert.deepEqual(config.pads('karma')[0],{x:1900,y:2090,base:'karma-nw'});assert.ok(config.isBonusZone(areas['site-a']));
  const arena=createBogCombat(config);for(const team of ['karma','evil'])assert.ok(arena.join({id:team,team}));
});
