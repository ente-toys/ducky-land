import test from 'node:test';
import assert from 'node:assert/strict';
import {Container, RenderTexture, Texture, TextureSource} from 'pixi.js';
import {createArchipelago} from '../src/rendering/pixi/archipelago.js';
import {artOf,mapFor} from '../src/world/island-maps.js';
import {cameraGame} from './helpers/pixi-engine.mjs';
import {WORLD_ISLANDS} from '../src/world/world-map.js';

const flush=()=>new Promise(setImmediate);
function deferredPreviews(t){
  const scene=new Container(),jobs=[],leases=new Map(),textures=new Map(),released=[];
  const arch=createArchipelago({renderer:{generateTexture:()=>RenderTexture.create({width:16,height:16})}},scene,scene,mapFor('home'));
  const acquire=src=>{
    assert.equal(leases.get(src)??0,0,'no overlapping leases: '+src);leases.set(src,1);
    return new Promise((resolve,reject)=>jobs.push({src,reject,resolve(){
      const texture=new Texture({source:new TextureSource({width:16,height:16})});textures.set(src,texture);resolve(texture);
    }}));
  };
  const release=src=>{assert.equal(leases.get(src),1);leases.delete(src);textures.get(src)?.destroy(true);textures.delete(src);released.push(src);};
  t.after(()=>{arch.destroy();scene.destroy({children:true});assert.equal(leases.size,0);});
  return {arch,jobs,leases,released,acquire,release};
}

test('reopening after partial inactive completion restores every preview with one lease per URL',async t=>{
  const {arch,jobs,leases,acquire,release}=deferredPreviews(t);
  const pending=arch.loadPreviews(acquire,release),first=jobs.splice(0),inactive=first.slice(0,3);
  assert(inactive.some(job=>job.src.endsWith('/home.svg')),'Home is among the discarded previews');
  arch.setPreviewActive(false);inactive.forEach(job=>job.resolve());await flush();
  arch.setPreviewActive(true);arch.setPreviewActive(true);
  first.slice(3).forEach(job=>job.resolve());await flush();
  assert.deepEqual(jobs.map(job=>job.src).sort(),inactive.map(job=>job.src).sort(),'only discarded previews reload');
  jobs.splice(0).forEach(job=>job.resolve());await pending;
  const ids=[...new Set(WORLD_ISLANDS.map(island=>artOf(island.id)))];
  for(const island of WORLD_ISLANDS)assert.notEqual(arch.globeTextureOf(island.id),Texture.EMPTY,island.id);
  for(const id of ids)assert.equal(leases.get(`/pixi-art/globe/${id}.svg`),1);
  assert.equal(leases.size,ids.length);
});

test('preview repairs survive another close/reopen and release late completions after destroy',async t=>{
  const {arch,jobs,leases,acquire,release}=deferredPreviews(t);
  const pending=arch.loadPreviews(acquire,release),first=jobs.splice(0);
  first[0].resolve();await flush(); // Installed while active, then released on close.
  arch.setPreviewActive(false);first[1].resolve();await flush();arch.setPreviewActive(true);
  first.slice(2).forEach(job=>job.resolve());await flush();
  const repair=jobs.splice(0);assert.equal(repair.length,2);
  arch.setPreviewActive(false);repair[0].resolve();await flush();arch.setPreviewActive(true);
  repair[1].resolve();await flush();
  assert(jobs.length>0,'another close during repair reloads every newly released preview');
  arch.destroy();jobs.splice(0).forEach(job=>job.resolve());await pending;
  assert.equal(leases.size,0);await arch.loadPreviews(acquire,release);assert.equal(jobs.length,0);
});

test('an early preview failure waits for remaining acquires, repairs discards once and never retries failure',async t=>{
  const {arch,jobs,leases,acquire,release}=deferredPreviews(t);
  const failure=new Error('preview unavailable'),pending=arch.loadPreviews(acquire,release);
  const rejected=assert.rejects(pending,error=>error===failure),first=jobs.splice(0);
  arch.setPreviewActive(false);first[0].resolve();first[1].reject(failure);await flush();
  arch.setPreviewActive(true);await flush();assert.equal(jobs.length,0,'no retry while other acquires remain pending');
  first.slice(2).forEach(job=>job.resolve());await flush();
  assert.deepEqual(jobs.map(job=>job.src),[first[0].src]);jobs.splice(0).forEach(job=>job.resolve());await rejected;
  for(let i=0;i<5;i++)await flush();assert.equal(jobs.length,0,'a failed URL does not trigger a retry loop');
  assert.equal(leases.size,first.length-1);assert(!leases.has(first[1].src),'failed acquire lease released');
});

test('authored globe previews release while walking and reacquire once on reopening',async()=>{
  const scene=new Container(),held=new Map(),requests=[],released=[];
  const arch=createArchipelago({renderer:{generateTexture:()=>RenderTexture.create({width:16,height:16})}},scene,scene,mapFor('home'));
  const acquire=async src=>{
    assert(!held.has(src),'one lease per shared preview URL');requests.push(src);
    const t=new Texture({source:new TextureSource({width:16,height:16})});held.set(src,t);return t;
  };
  const release=src=>{assert(held.has(src));released.push(src);held.get(src).destroy(true);held.delete(src);};
  try{
    await arch.loadPreviews(acquire,release);const count=held.size,first=[...held.values()],version=arch.previewVersion;assert(count>0);
    await arch.loadPreviews(acquire,release);assert.equal(requests.length,count,'loading twice does not retain extra leases');
    assert.equal(arch.previewVersion,version,'an unchanged preview batch never invalidates the world atlas');
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

test('globe prewarming keeps native neighbours until the sphere actually owns the scene',()=>{
 const scene=new Container(),arch=createArchipelago({renderer:{}},scene,scene,mapFor('home'));
 try{
  arch.setGlobePreparing(true,false);assert.equal(arch.root.visible,true);
  arch.setGlobePreparing(true,true);assert.equal(arch.root.visible,false);
  arch.setGlobePreparing(false,false);assert.equal(arch.root.visible,true);
 }finally{arch.destroy();scene.destroy({children:true});}
});
