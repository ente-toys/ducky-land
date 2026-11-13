import test from 'node:test';
import assert from 'node:assert/strict';
import {Container, RenderTexture, Texture, TextureSource} from 'pixi.js';
import {createArchipelago} from '../src/rendering/pixi/archipelago.js';
import {mapFor} from '../src/world/island-maps.js';
import {cameraGame} from './helpers/pixi-engine.mjs';

test('authored globe previews release while walking and reacquire once on reopening',async()=>{
  const scene=new Container(),held=new Map(),requests=[],released=[];
  const arch=createArchipelago({renderer:{generateTexture:()=>RenderTexture.create({width:16,height:16})}},scene,scene,mapFor('home'));
  const acquire=async src=>{
    assert(!held.has(src),'one lease per shared preview URL');requests.push(src);
    const t=new Texture({source:new TextureSource({width:16,height:16})});held.set(src,t);return t;
  };
  const release=src=>{assert(held.has(src));released.push(src);held.get(src).destroy(true);held.delete(src);};
  try{
    await arch.loadPreviews(acquire,release);const count=held.size,first=[...held.values()];assert(count>0);
    await arch.loadPreviews(acquire,release);assert.equal(requests.length,count,'loading twice does not retain extra leases');
    for(let cycle=0;cycle<3;cycle++){
      arch.setPreviewActive(false);arch.setPreviewActive(false);assert.equal(held.size,0);
      assert.equal(arch.globeTextureOf('home'),Texture.EMPTY);assert(first.every(t=>t.destroyed));
      arch.setPreviewActive(true);arch.setPreviewActive(true);await arch.loadPreviews(acquire,release);
      assert.equal(held.size,count);assert.notEqual(arch.globeTextureOf('home'),Texture.EMPTY);
    }
  }finally{arch.destroy();scene.destroy({children:true});}
  assert.equal(held.size,0);assert.equal(released.length,requests.length);
});

test('preview loads completing after walking, rapid reopening or disposal keep exactly the desired leases',async()=>{
  for(const outcome of ['walk','reopen','dispose']){
    const scene=new Container(),jobs=[],held=new Map();let released=0;
    const arch=createArchipelago({renderer:{generateTexture:()=>RenderTexture.create({width:16,height:16})}},scene,scene,mapFor('home'));
    const pending=arch.loadPreviews(src=>new Promise(resolve=>jobs.push(()=>{
      const t=new Texture({source:new TextureSource({width:16,height:16})});held.set(src,t);resolve(t);
    })),src=>{held.get(src).destroy(true);held.delete(src);released++;});
    arch.setPreviewActive(false);
    if(outcome==='reopen')arch.setPreviewActive(true);
    if(outcome==='dispose')arch.destroy();
    jobs.forEach(f=>f());await pending;
    assert.equal(held.size,outcome==='reopen'?jobs.length:0);
    assert.equal(released,outcome==='reopen'?0:jobs.length);
    assert.equal(arch.globeTextureOf('home')!==Texture.EMPTY,outcome==='reopen');
    if(outcome!=='dispose')arch.destroy();
    assert.equal(held.size,0);scene.destroy({children:true});
  }
});

test('opaque live snapshots never supply the globe atlas, including before previews finish loading',async()=>{
 const scene=new Container();
 const app={renderer:{generateTexture(){return RenderTexture.create({width:16,height:16});}}};
 const arch=createArchipelago(app,scene,scene,mapFor('home'));
 try{
  arch.build('home');arch.build('library');
  const snapshots=[arch.textureOf('home'),arch.textureOf('isle-251')];
  assert.notEqual(snapshots[0],snapshots[1],'each captured island has its own snapshot');
  assert.equal(arch.globeTextureOf('home'),Texture.EMPTY,'an unmasked snapshot cannot become globe land');
  assert.equal(arch.globeTextureOf('isle-251'),Texture.EMPTY);
  let finish;
  const pending=new Promise(resolve=>{finish=resolve;});
  const loading=arch.loadPreviews(()=>pending);
  assert.equal(arch.globeTextureOf('isle-251'),Texture.EMPTY,'pending preview does not expose the snapshot');
  finish(Texture.WHITE);await loading;
  assert.equal(arch.globeTextureOf('home'),Texture.WHITE);
  assert.equal(arch.globeTextureOf('isle-251'),Texture.WHITE);
  assert.ok(snapshots.every(t=>t.destroyed),'replaced snapshot textures are released');
 }finally{arch.destroy();scene.destroy({children:true});}
});

test('Home and theme snapshot capture exclude the ocean and restore its visibility',()=>{
 for(const mapId of ['home','library'])for(const visible of [false,true]){
  const game=cameraGame();game.artShown=mapId;game.arts.set(mapId,{ready:true});
  game.ocean.visible=visible;game.scene.visible=false;game.rigs=[];game.localDucks=[];
  game.mapSleepers=new Map();game.artProps=()=>[];
  const actor={visible:true};game.transientForCopies=()=>[actor];let captured=false;
  game.archipelago={has:()=>false,build(id){
   assert.equal(id,mapId);assert.equal(game.ocean.visible,false,'sea must not be baked into the island');
   assert.equal(actor.visible,false);assert.equal(game.scene.visible,true);captured=true;
  }};
  game.captureArt(mapId);
  assert.ok(captured);assert.equal(game.ocean.visible,visible);assert.equal(actor.visible,true);assert.equal(game.scene.visible,false);
 }
});

test('any globe transition disables direct flat live patches',()=>{
 const game=cameraGame();game.archipelago={texture:Texture.WHITE,islands:[]};
 for(const t of [.0001,.01,.1,.4,.7,.969,.97,1]){
  game.globeT=t;
  assert.deepEqual(game.liveCopies(),[],`no flat live patch at globe progress ${t}`);
 }
});
