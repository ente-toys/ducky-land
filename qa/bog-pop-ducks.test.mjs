import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Container,Texture} from 'pixi.js';
import {attachBogCombat} from '../src/features/bog-combat/attach.js';
import {BOG_OUTLINE_PIXELS,BOG_TEAM_COLOURS} from '../src/features/bog-combat/readability.js';
import {createTeamMarker} from '../src/features/bog-combat/effects.js';
import {createBogCombat} from '../src/features/bog-combat/sim.js';

// Hidden Duckies fade the cached whole-rig quad, after all equipment is posed.
const seen=rig=>rig.root.alpha;
test('team markers carry no ring, only a team-tinted name and the hidden icon through both concealment states',()=>{
  for(const team of ['karma','evil']){
    const objects=new Container(),rig={root:new Container()};rig.root.position.set(100,200);rig.root.zIndex=200;
    const marker=createTeamMarker(objects,{team,name:'Ducky'},{tilt:.7});
    assert.equal(marker.root.children.length,2,'no team ring under the Ducky');
    const [tag,icon]=marker.root.children;
    assert.equal(tag.style.fill,BOG_TEAM_COLOURS[team].ring);
    for(const hidden of [{shieldUntil:17},{bushId:'cover',bushRevealUntil:0},{}]){
      const p={team,name:'Ducky',alive:true,...hidden};marker.update(p,rig,10);
      assert.equal(icon.visible,!!(p.shieldUntil||p.bushId));
      assert.equal(marker.root.visible,true);assert.equal(marker.root.x,100);assert.equal(marker.root.y,200);
      assert.equal(icon.scale.y,1/.7);
    }
    marker.update({team,name:'Ducky',alive:true,bushId:'cover',bushRevealUntil:12},rig,10);
    assert.equal(icon.visible,false,'firing reveal clears the hidden indicator');
    marker.update({team,name:'Ducky',alive:false},rig,10);assert.equal(marker.root.visible,false);
    rig.root.visible=false;marker.update({team,name:'Ducky',alive:true},rig,10);assert.equal(marker.root.visible,false);
    marker.dispose();assert.equal(objects.children.length,0);assert.ok(tag.destroyed&&icon.destroyed);
    objects.destroy();rig.root.destroy();
  }
});

test('only your own Ducky gets the coral player ring; everyone else has none',()=>{
  const objects=new Container();
  const other=createTeamMarker(objects,{team:'evil',name:'Them'}),mine=createTeamMarker(objects,{team:'karma',name:'Me'},{self:true});
  assert.equal(other.root.children.some(c=>c.label==='Your player ring'),false);
  assert.equal(mine.root.children.filter(c=>c.label==='Your player ring').length,1);
  const ring=mine.root.children.find(c=>c.label==='Your player ring'),rig={root:new Container()};
  for(const state of [{shieldUntil:17},{bushId:'cover',bushRevealUntil:0},{}]){
    mine.update({team:'karma',name:'Me',alive:true,...state},rig,10);
    assert.equal(ring.visible,!(state.shieldUntil||state.bushId),'ground ring cannot show through the hidden body');
  }
  rig.root.destroy();
  other.dispose();mine.dispose();objects.destroy();
});

test('combat fades whole Duckies during spawn hiding and bush hiding, and restores on exit',async()=>{
  const dom=new JSDOM('<canvas tabindex="0"/>'),oldWindow=globalThis.window,oldDocument=globalThis.document;
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
  globalThis.window=dom.window;globalThis.document=dom.window.document;
  let layer;
  const objects=new Container(),liveRigs=new Map();
  try{
    const nav={walkable:()=>true,clearLine:()=>true};
    const players=['karma','evil'].flatMap(team=>['self','ally'].map(id=>({id:team+id,team,name:team+id,alive:true,x:100,y:200,shieldUntil:17})));
    for(const p of players){const root=new Container();objects.addChild(root);liveRigs.set(p.id,{rig:{root,dispose(){root.removeFromParent();root.destroy({children:true});}}});}
    class Room{
      client={snapshot:{tick:1,time:10,players,shots:[],splats:[],events:[]},receivedAt:performance.now()};
      setAim(){}setFire(){}dispose(){}
    }
    const engine={canvas:document.querySelector('canvas'),objects,liveRigs,stopInput(){},dispose(){},renderLiveDucks(poses){for(const p of poses){const root=liveRigs.get(p.id).rig.root;root.visible=true;root.alpha=.7;root.tint=0x777777;}}};
    layer=await attachBogCombat(engine,{navigation:nav,Room,loadGun:async()=>[],loadGhosts:async()=>({}),loadPickups:async()=>({}),loadLeaves:async()=>Texture.EMPTY});
    const outlines=new Set();
    for(const state of [{shieldUntil:17,bushId:null},{shieldUntil:0,bushId:'cover',bushRevealUntil:0},{shieldUntil:0,bushId:null}]){
      for(const p of players)Object.assign(p,state);
      engine.renderLiveDucks(players,1/60,10,true,()=>true);
      for(const {rig}of liveRigs.values()){
        assert.equal(seen(rig),state.shieldUntil?.4:state.bushId?.5:1,'spawn hiding and bush hiding fade the whole Ducky as one picture');assert.equal(rig.root.isCachedAsTexture,!!(state.shieldUntil||state.bushId));assert.equal(rig.root.tint,0xFFFFFF);
      }
    }
    for(const p of players)p.shieldUntil=17;
    engine.renderLiveDucks(players,1/60,10,false,()=>true);
    for(const {rig}of liveRigs.values())assert.equal(seen(rig),.4,'new shields hide immediately');
    for(const p of players)p.shieldUntil=0;
    engine.renderLiveDucks(players,1/60,10,false,()=>true);
    for(const {rig}of liveRigs.values())assert.ok(seen(rig)>.4&&seen(rig)<1,'shield expiry fades back in');
    for(let frame=0;frame<30;frame++)engine.renderLiveDucks(players,1/60,10,false,()=>true);
    for(const {rig}of liveRigs.values())assert.equal(rig.root.alpha,1,'fade settles at full opacity');
    engine.renderLiveDucks([],1/60,10,false,()=>true);
    for(const {rig}of liveRigs.values()){
      assert.ok(rig.root.filters==null);assert.equal(rig.root.isCachedAsTexture,false,'disappearing participants release their combat texture');
    }
    layer.leave();assert.equal(objects.children.length,0);
  }finally{layer?.leave(false);objects.destroy({children:true});globalThis.window=oldWindow;globalThis.document=oldDocument;dom.window.close();}
});

test('colour accents are exact, and concealment still omits enemies from the authority snapshot',()=>{
  assert.equal(BOG_TEAM_COLOURS.karma.body,0xFFD525);assert.equal(BOG_TEAM_COLOURS.evil.body,0xEF5144);
  const sim=createBogCombat({blockers:[],bounds:{width:1000,height:1000},pads:()=>[{x:200,y:300}]});
  const self=sim.join({id:'self',team:'karma'}),ally=sim.join({id:'ally',team:'karma'}),enemy=sim.join({id:'enemy',team:'evil'});
  for(const p of [self,ally,enemy])p.shieldUntil=7;
  assert.deepEqual(sim.snapshot('karma').players.map(p=>p.id).sort(),['ally','self']);
  for(const p of [self,ally,enemy]){p.shieldUntil=0;p.bushId='cover';p.bushRevealUntil=0;}
  assert.deepEqual(sim.snapshot('karma').players.map(p=>p.id).sort(),['ally','self']);
  enemy.bushRevealUntil=2;assert.ok(sim.snapshot('karma').players.some(p=>p.id==='enemy'));
});
