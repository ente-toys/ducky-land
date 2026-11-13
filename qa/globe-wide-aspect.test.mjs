import test from 'node:test';
import assert from 'node:assert/strict';
import {Container,Texture,RenderTexture,GlProgram,DOMAdapter} from 'pixi.js';
import {Canvas,createCanvas} from '@napi-rs/canvas';
import {JSDOM} from 'jsdom';
import {createWorldView} from '../src/rendering/pixi/world-view.js';
import {createArchipelago} from '../src/rendering/pixi/archipelago.js';
import {mapOf} from '../src/world/island-maps.js';
import {WORLD_ISLANDS,WORLD_GEO} from '../src/world/world-map.js';
import {cameraMatrix} from '../src/rendering/shared/sphere-camera.js';
import {screenToWorld} from '../src/rendering/shared/camera.js';
import {rollBasis} from '../src/rendering/shared/globe-look.js';

for(const [width,height]of [[2560,1080],[1920,1080],[393,852]])test(`native overview owns its viewport, previews, live capture and resize at ${width}x${height}`,async t=>{
 const prior={window:globalThis.window,document:globalThis.document,DOMParser:globalThis.DOMParser,HTMLCanvasElement:globalThis.HTMLCanvasElement},adapter=DOMAdapter.get(),compile=GlProgram.from;
 const dom=new JSDOM('<body></body>'),create=dom.window.document.createElement.bind(dom.window.document);
 dom.window.document.createElement=(tag,...args)=>tag==='canvas'?createCanvas(64,64):create(tag,...args);
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;globalThis.HTMLCanvasElement=Canvas;
 DOMAdapter.set({...adapter,createCanvas:()=>createCanvas(64,64)});
 // Only GPU compilation/submission is stubbed. Actual Pixi geometry, uniforms,
 // world-view updates, chart projection and archipelago loading run unchanged.
 GlProgram.from=options=>({...options,destroy(){}});
 t.after(()=>{Object.assign(globalThis,prior);DOMAdapter.set(adapter);GlProgram.from=compile;dom.window.close();});
 const stage=new Container(),scene=new Container();stage.addChild(scene);
 const calls=[],app={stage,renderer:{render(options){calls.push(options);},generateTexture(){return RenderTexture.create({width:16,height:16});}}};
 const isletAtlas=RenderTexture.create({width:2048,height:1536}),view=createWorldView(app,scene,{atlas:isletAtlas}),m=mapOf('home');
 const arch=createArchipelago(app,scene,scene,{width:m.width,height:m.height}),previews=[];
 try{
  await arch.loadPreviews(async src=>{previews.push(src);return Texture.WHITE;});
  assert.equal(previews.length,WORLD_ISLANDS.length);assert.ok(previews.every(src=>src.startsWith('/pixi-art/globe/')));
  for(const i of WORLD_ISLANDS)assert.ok(arch.has(i.theme??'home'));
  arch.textureOf=()=>{throw Error('raw live snapshots must not feed the globe atlas');};
  const me={x:m.cx,y:m.cy},cam={...me,zoom:.15};
  let captures=0;view.liveCopies=target=>{assert.equal(target.width,width);assert.equal(target.height,height);captures++;};
  view.prepare();assert.equal(stage.children.find(c=>c.label==='World view').visible,false);
  view.update(.4,width,height,1,cam,arch,m,.02,true,me);
  const mesh=stage.children.find(c=>c.label==='World view'),u=mesh.shader.resources.viewUniforms.uniforms;
  assert.ok(mesh.visible);assert.equal(scene.visible,false);assert.equal(captures,1);
  assert.deepEqual([...u.uRes],[width,height]);assert.equal(mesh.scale.x,width);assert.equal(mesh.scale.y,height);
  const capture=calls.find(c=>c.container===scene&&c.target);assert.equal(capture.target.width,width);assert.equal(capture.target.height,height);
  assert.equal(u.uLive,1);assert.equal(view.debug.source,'live');assert.equal(view.debug.colourBlends,0);
  cam.zoom=.43*height/WORLD_GEO.Rw;
  view.update(1,width,height,2,cam,arch,m,.02,true,me);
  assert.equal(captures,1,'full globe uses atlas and skips live scene capture');assert.equal(u.uLive,0);assert.equal(view.debug.source,'atlas');
  assert.ok(view.pinPoint());assert.ok(view.pinAt(view.pinPoint()));
  const aim=view.grab({x:width/2,y:height/2},{x:width/2+30,y:height/2},cam);
  assert.ok(aim&&aim.aim.every(Number.isFinite),'native globe drag is available');
  assert.ok(view.worldAt({x:width/2,y:height/2}).every(Number.isFinite));
  assert.equal(view.worldAt({x:width*2,y:height*2}),null,'space does not select land');
  assert.ok(view.stickers.length>0);assert.ok(view.stickers.every(s=>['a','b','c','d','x','y'].every(k=>Number.isFinite(s[k]))));
  view.liveCopies=null;view.update(.4,height,width,3,{...cam,zoom:.15},arch,m,.02,true,me);
  assert.deepEqual([...u.uRes],[height,width]);assert.equal(mesh.scale.x,height);assert.equal(mesh.scale.y,width);
  view.update(0,height,width,4,{...cam,zoom:.7},arch,m,.02,true,me);
  assert.equal(mesh.visible,false);assert.equal(scene.visible,true);assert.equal(view.pinPoint(),null);
  // Follow each current island through the same live-to-painted handoff. Both
  // current art and neighbours must use the curved atlas once paint begins.
  view.liveCopies=null;
  for(const island of WORLD_ISLANDS){
   arch.setCurrent(island.id);const current=mapOf(island.id);
   for(const progress of [.002,.1,.4,.7,.969,.97,1]){
    const camera={x:current.cx,y:current.cy,zoom:.7*(1-progress)+(.43*height/WORLD_GEO.Rw)*progress};
    view.update(progress,width,height,4,camera,arch,current,.02,true,{x:current.cx,y:current.cy},true);
    const own=view.stickers.find(s=>s.kind==='island'&&s.id===island.id);
    assert.ok(own,`${island.id} is present while current at ${progress}`);
    if(u.uPaint>0)assert.ok(view.stickers.filter(s=>s.kind==='island').every(s=>s.mode==='atlas'),'painted islands never use a flat live patch');
    if(progress===1){
     assert.equal(u.uLive,0);
     assert.ok(view.stickers.every(s=>s.onBall===1),'every visible island and islet is fully sphere-mapped');
    }
   }
  }
  for(const heading of [0,.7,Math.PI/2,Math.PI]){
   const camera={x:m.cx,y:m.cy,zoom:.7,basis:rollBasis(heading)},matrix=cameraMatrix(camera,width,height);
   for(const [x,y]of [[0,0],[width,0],[0,height],[width,height],[width/2,height/2]]){
    const p=screenToWorld(camera,{x,y},width,height);
    assert.ok(Math.hypot(matrix.a*p.x+matrix.c*p.y+matrix.tx-x,matrix.b*p.x+matrix.d*p.y+matrix.ty-y)<1e-8,'native camera preserves every viewport edge under rotation');
   }
  }
 }finally{view.destroy();arch.destroy();isletAtlas.destroy(true);stage.destroy({children:true});}
});
