import test from 'node:test';
import assert from 'node:assert/strict';
import {Container} from 'pixi.js';
import {createPaintHitReactions} from '../src/features/bog-combat/hit-reaction.js';

test('both teams wobble on real paint hits, stay bounded, and return exactly to the original pose',()=>{
 for(const team of ['karma','evil']){
  const hits=createPaintHitReactions(),root=new Container();root.position.set(100,200);root.scale.set(.7,.8);root.rotation=.03;
  const p={id:'target',team,alive:true,x:100,y:200};
  hits.observe({tick:1,time:1,players:[p],splats:[]});
  hits.observe({tick:2,time:2,players:[p],splats:[{id:1,kind:'hit',victim:p.id,born:2,x:78,y:200}]});
  hits.apply(p.id,{root},2.03);assert.notEqual(root.rotation,.03);assert.ok(Math.abs(root.rotation-.03)<.09);assert.ok(Math.abs(root.x-100)<=3);
  hits.beginFrame();assert.equal(root.x,100);assert.equal(root.y,200);assert.equal(root.rotation,.03);assert.equal(root.scale.x,.7);assert.equal(root.scale.y,.8);
  hits.apply(p.id,{root},2.1,true);assert.equal(root.rotation,.03);
  hits.apply(p.id,{root},2.4);assert.equal(root.rotation,.03);hits.dispose();root.destroy();
 }
});
test('entry, duplicate snapshots, old paint and wall splashes do not invent hits',()=>{
 const hits=createPaintHitReactions(),root=new Container(),p={id:'p',alive:true,x:0,y:0};
 const snapshot={tick:1,time:1,players:[p],splats:[{id:1,kind:'hit',victim:'p',born:1,x:10,y:0}]};
 hits.observe(snapshot);hits.apply('p',{root},1);assert.equal(root.rotation,0);
 hits.observe({...snapshot,tick:2,time:3,splats:[...snapshot.splats,{id:2,kind:'wall',victim:'p',born:3}]});hits.apply('p',{root},3);assert.equal(root.rotation,0);
 hits.dispose();root.destroy();
});

test('Bog walking and running use exactly 1.5 times the normal island speed',async()=>{
 const {walkStep}=await import('../src/gameplay/player-motion.js');
 const {combatWalkStep}=await import('../src/features/bog-combat/mechanics.js');
 const nav={walkable:()=>true,clearLine:()=>true};
 for(const run of [false,true]){
  const actor=()=>({x:100,y:100,pace:0,turn:0,until:0,path:[],heading:null});const normal=actor(),bog=actor();
  for(let i=0;i<120;i++){walkStep(normal,nav,1/60,(i+1)/60,{x:1,y:0,run});combatWalkStep(bog,nav,1/60,(i+1)/60,{x:1,y:0,run});}
  assert.ok(Math.abs((bog.x-100)/(normal.x-100)-1.5)<1e-9);assert.equal(bog.pace,normal.pace*1.5);
 }
});
