import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Container,Texture} from 'pixi.js';
import {attachGunC} from '../src/features/bog-combat/held-gun.js';
import {holdingWingTilt} from '../src/features/bog-combat/muzzle.js';
import {createCombatEffects} from '../src/features/bog-combat/effects.js';
import guns from '../src/features/bog-combat/assets/guns.json' with {type:'json'};

for(const source of guns)test(`gripping feather stays on the popper during turns: ${source.name}`,()=>{
  const objects=new Container(),root=new Container(),art=new Container(),view=new Container({label:`Direction ${source.rigAngle}`}),body=new Container();
  view.addChild(new Container(),new Container(),body);art.addChild(view);root.addChild(art);objects.addChild(root);
  const torso=new Container({label:'body-0'}),wing=new Container({label:source.wingPose.part});body.addChild(torso,wing);
  root.position.set(100,200);root.scale.set(.7);body.rotation=.1;body.scale.set(1.03,.94);
  let options;const original=(_,value)=>{options=value;};const rig={root,update:original};
  const gun=attachGunC(rig,[{...source,texture:Texture.WHITE}],source.team,objects);
  for(let i=0;i<32;i++){
    // The normal rig supplies a fresh animated shoulder each frame.
    wing.position.set(source.wingPose.pivot[0],source.wingPose.pivot[1]);wing.scale.set(.8+i/160);wing.rotation=Math.sin(i)*.12;
    const before={x:wing.x,y:wing.y,rotation:wing.rotation,sx:wing.scale.x,sy:wing.scale.y};
    const facing=i*Math.PI/16;
    gun.update({alive:true,x:100,y:200,facing,lastShotId:i,lastShotAt:i/60},{dt:1/60});
    assert.ok(body.getChildIndex(wing)>body.getChildIndex(torso),'original near wing stays visible');
    const mount=body.children.find(n=>n.label==='Gun C wing grip');
    const dx=source.wingPose.contactRest[0]-source.wingPose.pivot[0],dy=source.wingPose.contactRest[1]-source.wingPose.pivot[1];
    const hand=wing.toGlobal({x:dx,y:dy}),grip=mount.toGlobal({x:0,y:0});
    assert.ok(Math.hypot(hand.x-grip.x,hand.y-grip.y)<1e-7);
    assert.deepEqual({x:wing.x,y:wing.y,rotation:wing.rotation,sx:wing.scale.x,sy:wing.scale.y},{...before,rotation:before.rotation+holdingWingTilt(source)},'holding tilt keeps the original walking shoulder and scale');
    assert.equal(body.getChildIndex(mount),body.children.length-1,'gun stays above the hand and torso for every direction');
    const held=wing.rotation;
    for(let j=0;j<12;j++)gun.update({alive:true,x:100,y:200,facing});
    assert.equal(wing.rotation,held,'offscreen frames cannot accumulate holding tilt');
    rig.update(1/60,{turn:0});assert.equal(options.aiming,true);assert.equal(options.turn,facing);
    assert.equal(wing.rotation,before.rotation,'next walking update starts from the original feather pose');
  }
  gun.dispose();assert.equal(rig.update,original);objects.destroy({children:true});
});

test('nozzle squirt follows real shots for all players, works on the last droplet, and does not replay entry',()=>{
  const objects=new Container(),effects=createCombatEffects(objects,{muzzleFor:()=>({x:70,y:80})});
  const pose={id:'p',team:'karma',x:50,y:100,alive:true,ammo:0,facing:Math.PI/2,lastShotId:1,lastShotAt:1};
  const snapshot={time:1,players:[pose],shots:[],splats:[]};
  effects.update(snapshot,1);assert.equal(objects.children.length,0);
  pose.lastShotId=2;pose.lastShotAt=1.1;effects.update(snapshot,1.1);
  const squirt=objects.children.find(n=>n.label==='Bog paint squirt');assert.ok(squirt);
  assert.equal(squirt.x,70);assert.equal(squirt.y,80);assert.ok(Math.abs(squirt.rotation)<1e-9);
  effects.update(snapshot,1.25);assert.equal(objects.children.length,0);
  assert.equal(effects.trigger(pose,1.15),true,'last droplet still gives feedback with an empty tank');
  assert.equal(effects.trigger(pose,1.16),false);effects.dispose();objects.destroy();
});

test('paint impacts pop and shed droplets, reduced motion keeps a still readable splat, and effects recycle',()=>{
  const objects=new Container(),effects=createCombatEffects(objects),snapshot={time:1,players:[],shots:[],splats:[]};
  snapshot.splats=[{id:1,team:'karma',colour:0,kind:'hit',x:20,y:100,born:1,expires:9}];
  effects.update(snapshot,1.02);const mark=objects.children.find(n=>n.label==='Bog paint splat');
  assert.equal(mark.y,66);assert.ok(objects.children.some(n=>n.label==='Bog paint burst'));
  effects.update(snapshot,1.1);assert.ok(mark.scale.x>1);
  effects.update(snapshot,1.3,{reducedMotion:true});assert.equal(mark.scale.x,1);
  assert.equal(objects.children.length,1);
  for(let i=2;i<200;i++){snapshot.splats[0]={...snapshot.splats[0],id:i,born:i,expires:i+8};effects.update(snapshot,i+.03);assert.equal(objects.children.length,2);}
  effects.dispose();assert.equal(objects.children.length,0);objects.destroy();
});

test('team wing outlines preserve every original path and cannot clip away stroke segments',()=>{
  for(const name of ['view-11-wing-0.svg','view-15-wing-0.svg']){
    const original=readFileSync(new URL('../public/pixi-duck/'+name,import.meta.url),'utf8');
    const paths=svg=>[...svg.matchAll(/ d="([^"]+)"/g)].map(m=>m[1]);
    for(const team of ['evil-ducky']){
      const svg=readFileSync(new URL('../src/features/bog-combat/assets/'+team+'/'+name,import.meta.url),'utf8');
      assert.deepEqual(paths(svg),paths(original));assert.doesNotMatch(svg,/clip-path|clipPath/);
    }
  }
});
