import test from 'node:test';
import assert from 'node:assert/strict';
import {Assets, Container, DOMAdapter, ImageSource, Sprite, Texture} from 'pixi.js';
import {PixiIsland} from './helpers/pixi-engine.mjs';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {createWholeSVGLoader} from '../src/rendering/pixi/art/whole-svg-loader.js';
import {assertFinalTexture, uploadIsland} from '../src/rendering/pixi/art/island-preparation.js';

const flush=()=>new Promise(setImmediate);
const tile=src=>({src,x:0,y:0,width:20,height:10,resolution:1});
const finalTexture=()=>new Texture({source:new ImageSource({width:20,height:10})});
const until=async predicate=>{
  for(let i=0;i<200;i++){if(predicate())return;await flush();}
  assert.fail('expected preparation checkpoint');
};
function nodesOf(roots){
  const nodes=[];
  const visit=node=>{if('texture' in node&&node.renderPipeId!=='graphics')nodes.push(node);for(const c of node.children??[])visit(c);};
  roots.forEach(visit);return nodes;
}
function assertUploaded(uploads,roots){
  const nodes=nodesOf(roots);assert(nodes.length>0);
  for(const node of nodes){
    assertFinalTexture(node.texture,node.label);
    assert(uploads.has(node.texture.source),'every final texture uploaded before artReady');
  }
}
function assertReady(game,id,uploads,roots){
  assert.equal(game.artReady(id),true);
  assert.equal(game.arts.get(id).ready,true);
  assertUploaded(uploads,roots);
}

// Exercise the real loader, pool and engine readiness methods. Only network,
// image decoding, the raster canvas and the GPU are replaced; no browser/port.
function fixture(t,kind,blocked){
  const old={load:Assets.load,unload:Assets.unload,fetch:globalThis.fetch,adapter:DOMAdapter.get()};
  const waiting=new Map(),requests=[],textures=new Map(),uploads=new Set();
  DOMAdapter.set({...old.adapter,createCanvas:(width,height)=>({width,height,getContext:()=>({drawImage(){}})})});
  const decode=async blob=>{
    const src=(await blob.text()).replace(/\.webp$/,'');
    if(blocked(src))await new Promise(resolve=>waiting.set(src,resolve));
    return {width:20,height:10,src:'',close(){}};
  };
  const loader=createWholeSVGLoader({canDecodeBitmap:()=>kind==='webp',
    getManifest:async()=>new Proxy({}, {get:(_,src)=>({w:20,h:10,padding:2,tiers:[{scale:4,url:src+'.webp',width:80,height:40}]})}),
    queue:{run:job=>job(),raster:async job=>job()},fetchBlob:async src=>new Blob([src]),decode,
    decodeBitmap:async(blob,options)=>{const image=await decode(blob);return {...image,width:options.resizeWidth,height:options.resizeHeight};}});
  Assets.load=({src,data})=>{
    requests.push(src);
    if(!textures.has(src))textures.set(src,loader.load(src,{src,data}));
    return textures.get(src);
  };
  Assets.unload=async src=>{const promise=textures.get(src);textures.delete(src);if(promise)loader.unload(await promise);};
  globalThis.fetch=async src=>({ok:true,json:async()=>src.endsWith('art.json')?{
    ground:{tiles:[tile('ground-a.svg'),tile('ground-b.svg')]},
    decks:[tile('deck.svg')],props:[{...tile('prop.svg'),shadow:false}],floating:[tile('boat.svg')],
  }:{pieces:[]}});
  const renderer={resolution:2,texture:{bindSource:source=>uploads.add(source)}};
  const pool=createGroundPool({acquire:(src,resolution)=>Assets.load({src,data:{resolution,groundPadding:2}}),release(){}});
  t.after(async()=>{
    pool.destroy();
    for(const promise of textures.values()){const texture=await promise;if(!texture.destroyed)loader.unload(texture);}
    Assets.load=old.load;Assets.unload=old.unload;globalThis.fetch=old.fetch;DOMAdapter.set(old.adapter);
  });
  return {pool,uploads,renderer,requests,waiting,finish:src=>{const resolve=waiting.get(src);assert(resolve,src);waiting.delete(src);resolve();}};
}
function homeGame(f){
  const scene=new Container(),ground=new Container(),decks=new Container();scene.addChild(ground,decks);
  const game=Object.assign(Object.create(PixiIsland.prototype),{scene,homeGround:ground,decks,artShown:'home',loaded:[],props:[],
    arts:new Map([['home',{ready:false,groups:[ground,decks]}]]),homeKites:{entries:[]},groundPool:f.pool,
    app:{renderer:f.renderer},prepareHomeWater:async()=>{},showArt(){},
    homeArtPlan:{resolutions:new Map()},plantReactions:{async register(){},async prepared(){}}});
  let ready;
  Object.defineProperty(game,'homePrepared',{get:()=>ready,set:value=>{
    if(value)assertUploaded(f.uploads,[...game.arts.get('home').groups,...game.props.map(p=>p.sprite)]);
    ready=value;
  }});
  return game;
}
function themeGame(f){
  const scene=new Container(),ground=new Container(),decks=new Container(),objects=new Container();
  scene.addChild(ground,decks,objects);
  return Object.assign(Object.create(PixiIsland.prototype),{scene,ground,decks,objects,
    contactShadows:new Container(),overDecks:new Container(),arts:new Map(),artShown:'pink',
    groundPool:f.pool,app:{renderer:f.renderer},mapSleepers:new Map(),
    plantReactions:{async register(){},sources:()=>[],unregister(){}},
    buildMapAmbience(){},async makeSleepers(){},showArt(){}});
}

for(const kind of ['webp','svg']){
  test(`${kind}: initial Home cannot become ready until its last ground decode and GPU upload finish`,async t=>{
    const last='/pixi-art/home-expansion/ground-r0-c1.svg';
    const f=fixture(t,kind,src=>src===last),game=homeGame(f);
    game.homeGroundStream=f.pool.create([tile('/pixi-art/home-expansion/ground-r0-c0.svg'),tile(last)],game.homeGround);
    const prop=new Sprite(await Assets.load({src:'/home-sign.svg',data:{resolution:1}}));
    game.props.push({sprite:prop});game.scene.addChild(prop);
    const preparing=game.uploadHomeArt();
    await until(()=>f.waiting.has(last));
    assert.equal(game.artReady('home'),undefined);assert.equal(game.arts.get('home').ready,false);
    assert.equal(game.homeGroundStream.entries[1].sprite.texture,Texture.EMPTY);
    assert.equal(f.uploads.size,0,'no partial island is uploaded as prepared');
    f.finish(last);await preparing;
    assertReady(game,'home',f.uploads,[...game.arts.get('home').groups,prop]);
    const before=f.requests.length;
    for(let i=0;i<20;i++)f.pool.update([{stream:game.homeGroundStream,camera:{x:i,y:i,zoom:.1+i/10},width:100,height:100}],2);
    await flush();assert.equal(f.requests.length,before,'walking and zoom never load after reveal');
    game.scene.destroy({children:true});
  });

  test(`${kind}: deferred Home restoration waits for both props and every real HOME_TILES entry`,async t=>{
    const propSrc=`/restore-${kind}.svg`;
    const f=fixture(t,kind,src=>src===propSrc||/home-expansion\/ground-r0-c0\.svg$/.test(src)),game=homeGame(f);
    const placeholder=new Texture({source:Texture.EMPTY.source}),prop=new Sprite(placeholder);
    game.scene.addChild(prop);game.props.push({sprite:prop});
    game.homeRestore=Promise.resolve([{src:propSrc,resolution:1,count:1,nodes:[{node:prop,width:40,height:20}]}]);
    const preparing=game.ensureHomeArt();
    await until(()=>f.waiting.has(propSrc));
    assert(!game.artReady('home'));assert.equal(game.arts.get('home').ready,false);
    f.finish(propSrc);
    await until(()=>[...f.waiting.keys()].some(src=>src.includes('home-expansion/ground-r0-c0.svg')));
    assert(!game.artReady('home'));assert.equal(game.arts.get('home').ready,false);
    f.finish([...f.waiting.keys()][0]);await preparing;
    assert(game.homeGroundStream.entries.length>10,'real Home ground layout restored');
    assertReady(game,'home',f.uploads,[...game.arts.get('home').groups,prop]);
    game.releaseHomeArt();await game.homeRestore;await flush();
    assert.equal(game.artReady('home'),false);assert.equal(game.arts.get('home').ready,false);
    placeholder.destroy();game.scene.destroy({children:true});
  });

  test(`${kind}: themed artReady stays false through delayed props, ground and GPU warmup`,async t=>{
    const f=fixture(t,kind,src=>src.endsWith('/prop.svg')||src.endsWith('/ground-b.svg'));
    const game=themeGame(f);
    const set=game.arts.set.bind(game.arts);
    game.arts.set=(id,art)=>{
      if(art.ready)assertUploaded(f.uploads,[...art.groups,...art.props.map(p=>p.sprite)]);
      return set(id,art);
    };
    const preparing=game.ensureArt('pink');
    await until(()=>[...f.waiting.keys()].some(src=>src.endsWith('/prop.svg')));
    assert.equal(game.artReady('pink'),false);f.finish([...f.waiting.keys()][0]);
    await until(()=>[...f.waiting.keys()].some(src=>src.endsWith('/ground-b.svg')));
    assert.equal(game.artReady('pink'),false);assert.equal(f.uploads.size,0);
    f.finish([...f.waiting.keys()][0]);await preparing;
    const art=game.arts.get('pink');assertReady(game,'pink',f.uploads,[...art.groups,...art.props.map(p=>p.sprite)]);
    game.freeArt('pink');await flush();
    game.scene.destroy({children:true});game.contactShadows.destroy({children:true});game.overDecks.destroy({children:true});
  });
}

test('readiness rejects EMPTY, cloned placeholders and destroyed textures in hidden island nodes',async()=>{
  const placeholder=new Texture({source:Texture.EMPTY.source}),dead=finalTexture();dead.destroy(true);
  for(const texture of [Texture.EMPTY,placeholder,dead]){
    const root=new Container(),node=new Sprite(texture);node.visible=false;root.addChild(node);
    await assert.rejects(uploadIsland({texture:{bindSource(){assert.fail('placeholder upload');}}},[root],
      {requiredRoots:[root],yieldFrame:async()=>{}}),/not final/);
    root.destroy({children:true});
  }
  placeholder.destroy();
  for(const texture of [Texture.EMPTY,new Texture({source:Texture.EMPTY.source})]){
    const pool=createGroundPool({acquire:async()=>texture,release(){}}),root=new Container();
    const stream=pool.create([tile('/empty.svg')],root);
    await assert.rejects(stream.prepare(),/not final/);assert(!stream.prepared);
    pool.destroy();root.destroy();if(texture!==Texture.EMPTY)texture.destroy();
  }
});

test('Home final gate cannot publish readiness with a placeholder prop',async()=>{
  for(const texture of [Texture.EMPTY,new Texture({source:Texture.EMPTY.source})]){
    const node=new Sprite(texture),ground=new Container(),game=Object.assign(Object.create(PixiIsland.prototype),{
      scene:ground,homeGroundStream:{async prepare(){}},app:{renderer:{resolution:2,texture:{bindSource(){}}}},
      arts:new Map([['home',{ready:false,groups:[ground]}]]),props:[{sprite:node}],homeKites:{entries:[]},
    });
    await assert.rejects(game.uploadHomeArt(),/not final/);
    assert(!game.artReady('home'));assert.equal(game.arts.get('home').ready,false);
    node.destroy();ground.destroy();if(texture!==Texture.EMPTY)texture.destroy();
  }
});

test('themed engine cannot publish readiness with a placeholder prop',async t=>{
  const f=fixture(t,'webp',()=>false),game=themeGame(f),load=Assets.load;
  const placeholder=new Texture({source:Texture.EMPTY.source});
  Assets.load=asset=>asset.src.endsWith('/prop.svg')?Promise.resolve(placeholder):load(asset);
  const warnings=[],warn=console.warn;console.warn=(message,error)=>warnings.push([message,error.message]);
  t.after(()=>{console.warn=warn;});
  await game.ensureArt('pink');
  assert.equal(game.artReady('pink'),false);assert.equal(game.arts.get('pink').failed,true);
  assert(warnings.some(([,message])=>message.includes('not final')));
  placeholder.destroy();game.scene.destroy({children:true});game.contactShadows.destroy({children:true});game.overDecks.destroy({children:true});
});

test('upload gate rechecks final sources after yields and warms replacements before returning',async()=>{
  const first=finalTexture(),last=finalTexture(),node=new Sprite(first),uploads=[];
  await uploadIsland({texture:{bindSource:source=>uploads.push(source)}},[node],
    {requiredRoots:[node],yieldFrame:async()=>{node.texture=last;}});
  assert(uploads.includes(last.source));
  node.texture=first;const replacements=[];
  await uploadIsland({texture:{bindSource:source=>{assert(!source.destroyed);replacements.push(source);}}},[node],
    {requiredRoots:[node],yieldFrame:async()=>{node.texture=last;if(!first.destroyed)first.destroy(true);}});
  assert.deepEqual(replacements,[last.source]);
  const next=finalTexture();
  node.texture=next;
  await assert.rejects(uploadIsland({texture:{bindSource(){}}},[node],
    {requiredRoots:[node],yieldFrame:async()=>{node.texture=Texture.EMPTY;}}),/not final/);
  node.destroy();next.destroy(true);last.destroy(true);
});

test('pinning ground fences older camera requests and eviction cannot blank final textures',async()=>{
  const waiting=new Map(),released=[],root=new Container();
  const pool=createGroundPool({acquire:src=>new Promise(resolve=>waiting.set(src,resolve)),release:src=>released.push(src)});
  const stream=pool.create([tile('/handover.svg')],root),view={stream,camera:{x:10,y:5,zoom:1},width:100,height:100};
  pool.update([view]);
  const preparing=stream.prepare(),final=finalTexture(),old=finalTexture();
  waiting.get('/handover.svg')(final);await preparing;
  // Finish the lower-resolution camera request after final preparation.
  waiting.get('/handover.svg?groundScale=1')(old);await flush();
  assert.equal(stream.entries[0].sprite.texture,final);
  pool.update([]);assert.equal(stream.entries[0].sprite.texture,final);
  assert.deepEqual(released,['/handover.svg?groundScale=1']);
  pool.destroy();root.destroy();final.destroy(true);old.destroy(true);
});
