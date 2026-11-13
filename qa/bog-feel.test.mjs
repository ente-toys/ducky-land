import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Container} from 'pixi.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';
import {PAINT,RULES} from '../src/features/bog-combat/rules.js';
import {createBogFeel,createCombatFeedback,createHitFeelState} from '../src/features/bog-combat/feel.js';

test('real authoritative tags provide shooter colour, one local tag pop, ghost and respawn feedback',()=>{
  const sim=createBogCombat({blockers:[],bounds:{width:2000,height:1500},pads:team=>[{x:team==='karma'?100:300,y:300}]});
  const shooter=sim.join({id:'you',team:'evil'}),victim=sim.join({id:'other',team:'karma'});
  const calls=[],hits=[],selfFeedback=createCombatFeedback({onTag:e=>calls.push(['tag',e.victimId]),onGhost:()=>calls.push(['ghost'])});
  const victimFeedback=createCombatFeedback({onHit:c=>hits.push(c),onRespawn:()=>calls.push(['respawn'])});
  const observe=()=>{const snapshot=sim.snapshot();selfFeedback.observe(snapshot,snapshot.players.find(p=>p.id===shooter.id));victimFeedback.observe(snapshot,snapshot.players.find(p=>p.id===victim.id));return snapshot;};
  observe();for(let i=0;i<430;i++)sim.step(1/60);
  victim.hits=RULES.hitsPerHeart-1;shooter.facing=-Math.PI/2;sim.input(shooter.id,{seq:1,x:0,y:0,fire:true});
  for(let i=0;i<12;i++){sim.step(1/60);observe();}
  assert.equal(victim.alive,false);assert.equal(hits.length,1);assert.equal(hits[0],PAINT.evil[1]);
  assert.deepEqual(calls,[['tag','other'],['ghost']]);
  const last=observe();selfFeedback.observe(last,last.players[0]);assert.equal(calls.length,2);
  let replayed=0;createCombatFeedback({onTag:()=>replayed++,onGhost:()=>replayed++}).observe(last,last.players[0]);assert.equal(replayed,0);
  sim.input(shooter.id,{seq:2,x:0,y:0,fire:false});
  for(let i=0;i<190;i++){sim.step(1/60);observe();}
  assert.equal(victim.alive,true);assert.deepEqual(calls.at(-1),['respawn']);
});

test('shake stays within six screen pixels, ends at 150 ms, and reduced motion is still',()=>{
  const feel=createHitFeelState(),out={};assert.equal(feel.sample(0,false,out),out);assert.deepEqual(out,{x:0,y:0,alpha:0});
  feel.hit(100,0xfa5452);assert.equal(feel.colour,0xfa5452);
  for(let time=100;time<=250;time++){
    feel.sample(time,false,out);assert.ok(Math.hypot(out.x,out.y)<=6);
    feel.sample(time,true,out);assert.equal(out.x,0);assert.equal(out.y,0);
  }
  feel.sample(250,false,out);assert.equal(out.x,0);assert.equal(out.y,0);assert.ok(out.alpha>0);
  feel.sample(340,false,out);assert.equal(out.alpha,0);
});

test('tag holds only presentation for 40 ms, flashes one rendered frame, and restores filters/camera/DOM on leave',()=>{
  const dom=new JSDOM('<canvas/>'),scene=new Container(),root=new Container(),ghost=new Container(),calls=[];let time=100;
  root.visible=false;scene.position.set(70,80);const originalFilters=[];ghost.filters=originalFilters;
  const engine={canvas:dom.window.document.querySelector('canvas'),scene,app:{render(){calls.push({x:scene.x,y:scene.y,filters:ghost.filters});}}};
  const render=engine.app.render,previousDocument=globalThis.document;globalThis.document=dom.window.document;
  let feel;try{feel=createBogFeel(engine,{now:()=>time});}finally{globalThis.document=previousDocument;}
  const self={id:'you',alive:true},snapshot={tick:1,time:1,events:[],players:[self],splats:[]};
  feel.beginFrame(false);feel.observe(snapshot,self);
  feel.observe({...snapshot,tick:2,time:2,events:[{id:1,time:2,actorId:'you',victimId:'other',team:'karma'}]},self);
  feel.flashTarget('other',{root},{root:ghost});assert.equal(ghost.filters.length,1);assert.ok(root.filters==null);
  engine.app.render();assert.equal(calls.length,1);assert.ok(calls[0].filters[0]);
  for(time=110;time<140;time+=10){feel.beginFrame(false);engine.app.render();}
  assert.equal(calls.length,1);assert.deepEqual(ghost.filters,originalFilters);
  time=140;feel.beginFrame(false);engine.app.render();assert.equal(calls.length,2);assert.deepEqual(calls[1].filters,originalFilters);
  feel.observe({...snapshot,tick:3,time:3,events:[{id:2,time:3,actorId:'other',victimId:'you',team:'evil'}]},self);
  time+=15;feel.beginFrame(false);engine.app.render();assert.notEqual(calls.at(-1).x,70);assert.equal(scene.x,70);assert.equal(scene.y,80);
  const edge=dom.window.document.querySelector('.bog-hit-paint');assert.ok(Number(edge.style.opacity)>0);assert.equal(edge.style.pointerEvents,'none');assert.equal(edge.style.color,'rgb(39, 136, 217)');
  assert.doesNotMatch(edge.innerHTML,/gradient|<image/i);
  feel.beginFrame(true);engine.app.render();assert.equal(calls.at(-1).x,70);assert.equal(calls.at(-1).y,80);
  feel.dispose();feel.dispose();assert.equal(engine.app.render,render);assert.equal(dom.window.document.querySelector('.bog-hit-paint'),null);
  scene.destroy();root.destroy();ghost.destroy();dom.window.close();
});

test('reduced motion keeps the white confirmation but never holds the display',()=>{
  const state=createHitFeelState();state.tag();assert.equal(state.shouldHold(100,true),false);assert.equal(state.shouldHold(101,true),false);
});

test('authoritative pickups chime once for the local collector, without replay on entry or reconnect',()=>{
  const sim=createBogCombat({blockers:[],bounds:{width:2000,height:1500},pads:team=>[{x:team==='karma'?100:600,y:300}],
    pickupSpots:[{id:'paint',kind:'paint',x:300,y:300},{id:'shield',kind:'shield',x:900,y:300}]});
  const self=sim.join({id:'you',team:'karma'});sim.join({id:'bot',team:'evil'}).bot=true;
  const scene=new Container(),sounds=[],engine={scene};
  const feel=createBogFeel(engine,{playSound:name=>sounds.push(name)});
  const observe=()=>{const snapshot=sim.snapshot();feel.observe(snapshot,snapshot.players.find(p=>p.id===self.id));return snapshot;};
  try{
    observe();sim.step(1/60);observe();assert.deepEqual(sounds,[],'another collector stays silent');
    self.x=300;self.ammo=2;sim.step(1/60);const collected=observe();
    assert.equal(self.ammo,12);assert.equal(collected.pickups[0].collectedBy,'you');assert.deepEqual(sounds,['pickup']);
    feel.observe(collected,collected.players[0]);sim.step(1/60);observe();assert.deepEqual(sounds,['pickup']);
    const replay=[];createCombatFeedback({onPickup:p=>replay.push(p.id)}).observe(collected,collected.players[0]);assert.deepEqual(replay,[]);
    self.x=900;sim.step(1/60);const delayed=sim.snapshot();delayed.time+=1;
    feel.observe(delayed,delayed.players[0]);assert.deepEqual(sounds,['pickup'],'stale collections stay silent');
    feel.observe({...collected,tick:0},collected.players[0]);assert.deepEqual(sounds,['pickup']);
    feel.observe({...collected,tick:1},collected.players.find(p=>p.id==='bot'));assert.deepEqual(sounds,['pickup']);
  }finally{feel.dispose();scene.destroy();}
});
