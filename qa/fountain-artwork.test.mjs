import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Container,Sprite,Texture,TextureSource} from 'pixi.js';
import {createFountainWater} from '../src/rendering/pixi/environment/fountain.js';

const flush=()=>new Promise(setImmediate);
function fixture(t){
  const dom=new JSDOM('<body></body>',{pretendToBeVisual:true}),names=['document','DOMParser','XMLSerializer','Image','fetch'];
  const prior=Object.fromEntries(names.map(name=>[name,globalThis[name]]));
  let finishDecode,decodes=0,canvases=0;
  const decoded=new Promise(resolve=>{finishDecode=resolve;});
  const create=dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement=(tag,...args)=>{
    if(tag!=='canvas')return create(tag,...args);
    canvases++;return {width:0,height:0,getContext:()=>({drawImage(){}})};
  };
  Object.assign(globalThis,{document:dom.window.document,DOMParser:dom.window.DOMParser,XMLSerializer:dom.window.XMLSerializer,
    Image:class{decode(){decodes++;return decoded;}},fetch:async()=>({ok:true,text:async()=>'<svg xmlns="http://www.w3.org/2000/svg"><g id="jet"/><g id="foam"/></svg>'})});
  const parent=new Container(),original=new Texture({source:new TextureSource({width:480,height:480})});
  const sprite=new Sprite(original);sprite.scale.set(.7,.9);parent.addChild(sprite);
  const fx=createFountainWater({src:'/fountain.svg',x:2820,y:2370,scale:1.05,sprite},parent);
  t.after(async()=>{parent.destroy({children:true});finishDecode();await fx.artworkReady;original.destroy(true);Object.assign(globalThis,prior);dom.window.close();});
  return {fx,sprite,original,finishDecode,get decodes(){return decodes;},get canvases(){return canvases;}};
}

test('fountain artwork waits for decode, reuses one canvas across revisits and destroys its owned texture',async t=>{
  const f=fixture(t),{fx,sprite,original}=f;
  let ready=false;fx.artworkReady.then(()=>{ready=true;});await flush();
  assert.equal(f.decodes,1);assert.equal(ready,false);assert.equal(sprite.texture,original);assert.equal(f.canvases,0);
  const size=[sprite.width,sprite.height];f.finishDecode();await fx.artworkReady;
  assert(ready);const texture=sprite.texture;assert.notEqual(texture,original);assert.deepEqual([sprite.width,sprite.height],size);
  let unloads=0;texture.source.on('unload',()=>{unloads++;});
  fx.update(0,false,false);assert.equal(unloads,0,'a visible base is retained even if only its water is culled');
  for(let i=0;i<4;i++){sprite.visible=false;fx.update(i,false,false);sprite.visible=true;fx.update(i+.1,false,true);assert.equal(sprite.texture,texture);}
  assert.equal(unloads,4,'hidden fountain releases its GPU backing, including later snapshot uploads');assert(!texture.destroyed);
  sprite.parent.visible=false;fx.update(5,false,false);assert.equal(unloads,5,'a hidden island ancestor also releases the canvas');sprite.parent.visible=true;
  assert.equal(f.canvases,1);assert.equal(f.decodes,1,'revisits do not create another fountain texture');
  fx.root.destroy({children:true});assert(texture.destroyed);assert.equal(sprite.texture,original);assert.deepEqual([sprite.scale.x,sprite.scale.y],[.7,.9]);
  assert(!original.destroyed,'the borrowed original remains owned by its art budget');
});

test('fountain disposal before native decode finishes never installs or allocates replacement artwork',async t=>{
  const f=fixture(t);await flush();assert.equal(f.decodes,1);
  f.fx.root.destroy({children:true});f.finishDecode();await f.fx.artworkReady;
  assert.equal(f.canvases,0);assert.equal(f.sprite.texture,f.original);assert(!f.original.destroyed);
});
