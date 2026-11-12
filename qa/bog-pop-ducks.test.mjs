import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Container,Texture} from 'pixi.js';
import {attachBogCombat} from '../src/features/bog-combat/attach.js';
import {BOG_OUTLINE_PIXELS,BOG_TEAM_COLOURS} from '../src/features/bog-combat/readability.js';
import {createTeamMarker} from '../src/features/bog-combat/effects.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';

test('solid team rings keep their rims, team-tinted names and hidden icon through both concealment states',()=>{
  for(const team of ['privacy','google']){
    const objects=new Container(),rig={root:new Container()};rig.root.position.set(100,200);rig.root.zIndex=200;
    const marker=createTeamMarker(objects,{team,name:'Ducky'},{tilt:.7});
    const [ring,tag,icon]=marker.root.children;
    const strokes=ring.context.instructions.filter(i=>i.action==='stroke').map(i=>i.data.style);
    assert.deepEqual(strokes.map(s=>[s.color,s.width,s.alpha]),[[BOG_TEAM_COLOURS[team].rim,11,1],[BOG_TEAM_COLOURS[team].ring,7,1]]);
    assert.equal(tag.style.fill,BOG_TEAM_COLOURS[team].ring);
    for(const hidden of [{shieldUntil:17},{bushId:'cover',bushRevealUntil:0},{}]){
      const p={team,name:'Ducky',alive:true,...hidden};marker.update(p,rig,10);
      assert.equal(icon.visible,!!(p.shieldUntil||p.bushId));assert.equal(ring.alpha,1);
      assert.equal(marker.root.visible,true);assert.equal(marker.root.x,100);assert.equal(marker.root.y,200);
      assert.equal(icon.scale.y,1/.7);
    }
    marker.update({team,name:'Ducky',alive:true,bushId:'cover',bushRevealUntil:12},rig,10);
    assert.equal(icon.visible,false,'firing reveal clears the hidden indicator');
    marker.update({team,name:'Ducky',alive:false},rig,10);assert.equal(marker.root.visible,false);
    rig.root.visible=false;marker.update({team,name:'Ducky',alive:true},rig,10);assert.equal(marker.root.visible,false);
    marker.dispose();assert.equal(objects.children.length,0);assert.ok(ring.destroyed&&tag.destroyed&&icon.destroyed);
    objects.destroy();rig.root.destroy();
  }
});

test('combat renders self and teammates at full alpha with no filter during hiding (outline shader off) and restores on exit',async()=>{
  const dom=new JSDOM('<canvas tabindex="0"/>'),oldWindow=globalThis.window,oldDocument=globalThis.document;
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  let layer;
  const objects=new Container(),liveRigs=new Map();
  try{
    const nav={walkable:()=>true,clearLine:()=>true};
    const players=['privacy','google'].flatMap(team=>['self','ally'].map(id=>({id:team+id,team,name:team+id,alive:true,x:100,y:200,shieldUntil:17})));
    for(const p of players){const root=new Container();objects.addChild(root);liveRigs.set(p.id,{rig:{root,dispose(){root.removeFromParent();root.destroy({children:true});}}});}
    class Room{
      client={snapshot:{tick:1,time:10,players,shots:[],splats:[],events:[]},receivedAt:performance.now()};
      setFire(){}dispose(){}
    }
    const engine={canvas:document.querySelector('canvas'),objects,liveRigs,stopInput(){},dispose(){},renderLiveDucks(poses){for(const p of poses){const root=liveRigs.get(p.id).rig.root;root.visible=true;root.alpha=.7;root.tint=0x777777;}}};
    layer=await attachBogCombat(engine,{navigation:nav,Room,loadGun:async()=>[],loadGhosts:async()=>({}),loadPickups:async()=>({}),loadLeaves:async()=>Texture.EMPTY});
    const outlines=new Set();
    for(const state of [{shieldUntil:17,bushId:null},{shieldUntil:0,bushId:'cover',bushRevealUntil:0},{shieldUntil:0,bushId:null}]){
      for(const p of players)Object.assign(p,state);
      engine.renderLiveDucks(players,1/60,10,false,()=>true);
      for(const {rig}of liveRigs.values()){
        assert.equal(rig.root.alpha,1);assert.equal(rig.root.tint,0xFFFFFF);assert.ok(rig.root.filters==null||rig.root.filters.length===0,'no filter hides or dims the Ducky');
      }
    }
    engine.renderLiveDucks([],1/60,10,false,()=>true);
    for(const {rig}of liveRigs.values())assert.ok(rig.root.filters==null,'disappearing participants lose their combat filter');
    layer.leave();assert.equal(objects.children.length,0);
  }finally{layer?.leave(false);objects.destroy({children:true});globalThis.window=oldWindow;globalThis.document=oldDocument;dom.window.close();}
});

test('colour accents are exact, and concealment still omits enemies from the authority snapshot',()=>{
  assert.equal(BOG_TEAM_COLOURS.privacy.body,0xFFD525);assert.equal(BOG_TEAM_COLOURS.google.body,0xEF5144);
  const sim=createBogCombat({blockers:[],bounds:{width:1000,height:1000},pads:()=>[{x:200,y:300}]});
  const self=sim.join({id:'self',team:'privacy'}),ally=sim.join({id:'ally',team:'privacy'}),enemy=sim.join({id:'enemy',team:'google'});
  for(const p of [self,ally,enemy])p.shieldUntil=7;
  assert.deepEqual(sim.snapshot('privacy').players.map(p=>p.id).sort(),['ally','self']);
  for(const p of [self,ally,enemy]){p.shieldUntil=0;p.bushId='cover';p.bushRevealUntil=0;}
  assert.deepEqual(sim.snapshot('privacy').players.map(p=>p.id).sort(),['ally','self']);
  enemy.bushRevealUntil=2;assert.ok(sim.snapshot('privacy').players.some(p=>p.id==='enemy'));
});
