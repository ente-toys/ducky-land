import test from 'node:test';
import assert from 'node:assert/strict';
import {Container, RenderTexture, Texture} from 'pixi.js';
import {createArchipelago} from '../src/rendering/pixi/archipelago.js';
import {mapFor} from '../src/world/island-maps.js';
import {cameraGame} from './helpers/pixi-engine.mjs';

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
