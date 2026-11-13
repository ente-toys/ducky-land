import test from 'node:test';
import assert from 'node:assert/strict';
import {Container, Sprite, Texture} from 'pixi.js';
import {createPlantContacts, plantKind, plantBlocker, foliageColour, PLANT_COOLDOWN, LEAF_CAP} from '../src/rendering/pixi/environment/plant-contact.js';
import {createPlantReactions} from '../src/rendering/pixi/environment/plant-reactions.js';
import {geometry} from '../assets/world/island-geometry.mjs';
import {walkStep} from '../src/gameplay/player-motion.js';
import {createNavigation} from '../src/world/navigation.js';

const prop=(x=0,kind='tree')=>({id:`${kind}-${x}`,name:`${kind}-1`,src:'/tree.svg',x,y:0,width:200,height:280,scale:1,sprite:{visible:true}});
const obstacle=(x=0)=>({x,y:-9,rx:31,ry:22});

test('walk/run reaches the real padded blocker and triggers once, including a fully stopped wall push',()=>{
  const blocker=obstacle(), world={coast:[[-500,-500],[500,-500],[500,500],[-500,500]],water:[],bridges:[],islets:[],walkways:[],obstacles:[blocker]};
  for (const run of [false,true]) {
    const hits=[],contact=createPlantContacts([prop()],[blocker],p=>hits.push(p));
    const nav=createNavigation(world), actor={x:-180,y:-9,turn:0,path:[],until:0,action:0};
    contact.begin(0);contact.track(actor,actor.x,actor.y);
    for (let frame=1;frame<=240;frame++) {
      walkStep(actor,nav,1/60,frame/60,{x:1,y:0,run});
      contact.begin(frame/60);contact.track(actor,actor.x,actor.y);
      assert.ok(geometry(world).walkable(actor.x,actor.y));
    }
    assert.equal(hits.length,1,`run=${run}: holding into a trunk cannot spam`);
    assert.ok(actor.x<=-47,'the padded trunk remains solid');
  }
});

test('per-plant cooldown covers different players and re-entry, and holding contact never repeats',()=>{
  const hits=[],contact=createPlantContacts([prop(),prop(400)],[obstacle(),obstacle(400)],p=>hits.push(p.prop.id));
  const local={},remote={};
  const at=(t,a,x,y=-9)=>{contact.begin(t);contact.track(a,x,y);};
  at(0,local,-100);at(.05,local,-50);assert.deepEqual(hits,['tree-0']);
  for(let i=1;i<60;i++)at(.05+i/60,local,-50);
  assert.equal(hits.length,1,'idle contact past cooldown does not repeat');
  at(1.1,local,-100);at(1.2,local,-50);assert.equal(hits.length,2);
  at(1.25,remote,-100);at(1.3,remote,-50);assert.equal(hits.length,2,'another player shares the plant throttle');
  at(1.4,local,300);at(1.5,local,350);assert.equal(hits.length,3,'a different plant has its own cooldown');
  at(1.6,remote,-100);at(1.2+PLANT_COOLDOWN+.01,remote,-50);assert.equal(hits.length,4,'remote duck can trigger after cooldown');
  at(2.2,local,-100);at(2.3,local,-50);
  contact.begin(3.2);contact.track(remote,-50,-9);contact.track(local,-100,-9);
  contact.begin(3.3);contact.track(remote,-50,-9);contact.track(local,-50,-9);
  assert.equal(hits.length,5,'a duck parked at the trunk does not prevent another duck from bumping it');
});

test('spawn, teleport, sailing, reduced motion, passing outside and leaving a plant do not trigger',()=>{
  for (const mode of ['spawn','teleport','sailing','reduced','outside','leaving']) {
    let hits=0;const contact=createPlantContacts([prop()],[obstacle()],()=>hits++),actor={};
    const start=mode==='spawn'||mode==='leaving'?-50:mode==='teleport'?-400:-100;
    contact.begin(0);contact.track(actor,start,-9,mode!=='sailing');
    contact.begin(.1,mode==='reduced');contact.track(actor,mode==='outside'?-70:mode==='leaving'?-55:-50,-9,mode!=='sailing');
    assert.equal(hits,0,mode);
  }
  assert.equal(plantKind({name:'Bench',src:'reuse/street--bench.svg'}),null);
  assert.equal(plantKind({name:'Heart hedge bush'}),'bush');
  assert.equal(plantBlocker(prop(),[{x:100,y:0,rx:30,ry:20}]),null);
  const poly={prop:'tree-0',poly:[[-20,-30],[20,-30],[20,0],[-20,0]]};
  assert.equal(plantBlocker(prop(),[poly]),poly);
});

test('pooled leaves cap at twelve, bushes only sway, and transforms settle at the fixed base',async t=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=()=>assert.fail('plant reactions cannot fetch on the main thread');
  t.after(()=>{globalThis.fetch=oldFetch;});
  const parent=new Container(),effects=createPlantReactions(parent,Texture.EMPTY,{loadColour:async()=>0x6faf42}),props=[],obstacles=[],actors=[];
  t.after(()=>{effects.destroy();props.forEach(p=>p.sprite.destroy());parent.destroy();});
  for(let i=0;i<20;i++) {
    const p=prop(i*400,i===0?'bush':'tree');p.sprite=new Sprite(Texture.EMPTY);
    p.sprite.position.set(p.x,p.y);p.sprite.scale.set(-2,3);p.sprite.anchor.set(.5,1);
    props.push(p);obstacles.push(obstacle(p.x));actors.push({});
  }
  await effects.register('home',props,obstacles);
  effects.begin('home',0);actors.forEach((a,i)=>effects.track(a,props[i].x-100,-9));effects.update(0);
  effects.begin('home',.1);actors.forEach((a,i)=>effects.track(a,props[i].x-50,-9));effects.update(.15);
  assert.equal(parent.children.length,LEAF_CAP);assert.equal(parent.children.filter(s=>s.visible).length,LEAF_CAP);
  assert.equal(parent.children[0].tint,0x6faf42);
  assert.ok(props[0].sprite.scale.y<3,'bush squashes too');
  for (const p of props) {assert.equal(p.sprite.x,p.x);assert.equal(p.sprite.y,p.y);assert.equal(p.sprite.rotation,0);}
  const firstX=parent.children[0].x;
  props.forEach(p=>{p.sprite.skew.x=0;});effects.update(.5);
  assert.notEqual(parent.children[0].x,firstX,'leaf drifts');
  for(const p of props)assert.deepEqual([p.sprite.scale.x,p.sprite.scale.y],[-2,3]);
  effects.begin('home',.6,true);effects.update(.6);
  assert.ok(parent.children.every(s=>!s.visible),'reduced motion cancels leaves immediately');
  effects.begin('home',.7);effects.update(.7);assert.ok(parent.children.every(s=>!s.visible));
});

test('leaf palette selects the painted canopy over neutral outlines and short highlights',()=>{
  assert.equal(foliageColour('<path fill="#232323" d="long outline"/><path fill="#fff" d="highlight"/><path fill="#e795bd" d="M0 0C1 2 4 5 8 9L15 14Z"/>'),0xe795bd);
});
