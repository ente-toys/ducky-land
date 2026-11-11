import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {Container,Texture} from 'pixi.js';
import {knockoutPhase,ghostMotion,createKnockout} from '../src/pixi/bog-combat/knockout.js';
import {createCombatEffects} from '../src/pixi/bog-combat/effects.js';
import {createArena} from '../src/pixi/bog-combat/sim.js';
import {RULES} from '../src/pixi/bog-combat/rules.js';

const art=Object.fromEntries(['privacy-body','privacy-wisp','privacy-puddle','privacy-popper','google-body','google-wisp','google-puddle','google-popper','halo','devil-tail'].map(key=>[key,Texture.WHITE]));
test('ghost holds for two seconds, fades before ground, and respects the authoritative three-second respawn',()=>{
 const p={alive:false,respawnAt:13},out={};
 assert.equal(knockoutPhase(p,10,out),out);assert.equal(out.ghostAlpha,1);assert.equal(out.groundAlpha,1);
 assert.equal(knockoutPhase(p,12).ghostAlpha,1);
 assert.ok(knockoutPhase(p,12.2).ghostAlpha<1);assert.equal(knockoutPhase(p,12.2).groundAlpha,1);
 assert.equal(knockoutPhase(p,12.5).ghostAlpha,0);assert.equal(knockoutPhase(p,12.5).groundAlpha,1);
 assert.ok(knockoutPhase(p,12.7).groundAlpha<1);assert.equal(knockoutPhase(p,12.95).groundAlpha,0);
 assert.equal(knockoutPhase({...p,alive:true},13).down,false);
 assert.equal(RULES.respawnDelay,3);
});
test('quick pop settles with bounded squash, rises, and reduced motion keeps a still ghost',()=>{
 const out={};let max=0,min=1;
 for(let age=0;age<=3;age+=1/60){assert.equal(ghostMotion(age,false,out),out);max=Math.max(max,out.sy);min=Math.min(min,out.sy);assert.ok(Number.isFinite(out.rise));}
 assert.ok(max>1&&max<=1.08);assert.ok(min<1&&min>=.92);
 assert.ok(ghostMotion(.26,false).rise>ghostMotion(0,false).rise+45);
 assert.ok(ghostMotion(2,false).rise>ghostMotion(.3,false).rise);
 for(const age of [0,.1,.5,2.5]){const m=ghostMotion(age,true);assert.equal(m.rise,0);assert.equal(m.sx,1);assert.equal(m.sy,1);assert.equal(m.halo,0);assert.equal(m.wisp,0);assert.equal(m.drop,0);}
});
test('bot and observer deaths use shared pooled sprites, mirror facing, recover on respawn, and dispose',()=>{
 const objects=new Container(),rig={root:new Container()},death=createKnockout(objects,rig,{tilt:.7,art});
 const p={id:'bot-0',bot:true,team:'google',alive:false,respawnAt:13,x:350,y:600,facing:-Math.PI/2};
 rig.root.visible=true;death.update(p,10.3,{players:[p],splats:[]},false);
 assert.equal(rig.root.visible,false);assert.equal(death.root.visible,true);assert.equal(death.ground.visible,true);
 const ghost=death.root.children[0],sprites=[...ghost.children,...death.ground.children];
 assert.equal(ghost.children[0].visible,true);assert.equal(death.root.scale.x,.22);assert.equal(death.root.scale.y,.22/.7);
 const x=death.root.x;
 for(let i=0;i<180;i++){rig.root.visible=true;death.update(p,10+i/60,null,false);assert.equal(death.root.x,x);}
 assert.deepEqual([...ghost.children,...death.ground.children],sprites);assert.equal(objects.children.length,2);
 assert.equal(death.root.visible,false);assert.equal(death.ground.visible,false);
 rig.root.visible=true;death.update({...p,alive:true},13,null,false);assert.equal(rig.root.visible,true);
 rig.root.visible=true;death.update({...p,team:'privacy',respawnAt:16,facing:Math.PI/2},13.3,null,false);
 assert.equal(ghost.children[0].visible,false);assert.equal(death.root.scale.x,-.22);
 rig.root.visible=false;death.update({...p,respawnAt:17},14.3,null,false);assert.equal(death.root.visible,false);
 death.dispose();assert.equal(objects.children.length,0);assert.ok(sprites.every(s=>s.destroyed));assert.equal(Texture.WHITE.destroyed,false);
});
test('remote snapshots and reconnects at the same death age produce the same ghost pose',()=>{
 const p={id:'remote',team:'privacy',alive:false,respawnAt:13,x:100,y:200,facing:0};
 const a=createKnockout(new Container(),{root:new Container()},{art}),b=createKnockout(new Container(),{root:new Container()},{art});
 a.update(p,10.1,null,false);a.update(p,11.4,null,false);b.update(p,11.4,null,false);
 assert.equal(a.root.alpha,b.root.alpha);assert.equal(a.root.children[0].y,b.root.children[0].y);assert.equal(a.root.children[0].rotation,b.root.children[0].rotation);
 a.dispose();b.dispose();
});
test('real simulation tag snapshots contain everything needed without adding protocol fields',()=>{
 const sim=createArena({practice:false,blockers:[],bounds:{width:2000,height:1500},pads:team=>[{x:team==='privacy'?100:300,y:300}]});
 const a=sim.join({id:'a',team:'privacy'});sim.join({id:'b',team:'google'});
 for(let i=0;i<430;i++)sim.step(1/60);
 a.facing=Math.PI/2;sim.input(a.id,{seq:1,x:0,y:0,fire:true});
 for(let i=0;i<30;i++)sim.step(1/60);
 const snapshot=sim.snapshot(),victim=snapshot.players.find(p=>p.id==='b');
 assert.equal(victim.alive,false);assert.equal(snapshot.splats.find(s=>s.victim==='b').team,'privacy');
 assert.ok(knockoutPhase(victim,snapshot.time).age>0);
});
test('every ghost SVG is flat vector only and both teams retain the approved colour tokens',()=>{
 const dir=new URL('../src/pixi/bog-combat/assets/ghosts/',import.meta.url);
 for(const file of readdirSync(dir)){
  assert.match(file,/\.svg$/);const svg=readFileSync(new URL(file,dir),'utf8');
  assert.doesNotMatch(svg,/<(?:image|filter|linearGradient|radialGradient|foreignObject)\b|data:|https?:\/\/(?!www.w3.org)/i);
  assert.match(svg,/stroke="#232323"/);
 }
 const red=readFileSync(new URL('google-body.svg',dir),'utf8');
 for(const colour of ['#EF5144','#FF9C90','#7E1F27','#08C225'])assert.ok(red.includes(colour));
 const white=readFileSync(new URL('privacy-body.svg',dir),'utf8');
 for(const colour of ['#EFF0FB','#DAD5FA','#FA5452','#2788D9','#FFE23D'])assert.ok(white.includes(colour));
});

test('the old tag splat never lingers underneath the fading ghost puddle',()=>{
 const objects=new Container(),effects=createCombatEffects(objects);
 effects.update({time:0,shots:[],splats:[{id:1,kind:'tag',team:'privacy',colour:0,x:10,y:20,born:0,expires:8}]});
 assert.equal(objects.children.length,0);effects.dispose();
});
