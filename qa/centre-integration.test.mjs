import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Sprite,Texture,Container,Graphics,DOMAdapter} from 'pixi.js';
import {animatePieces,attachCentreMotion} from '../src/rendering/pixi/environment/centre-motion.js';
import {createGroundPool} from '../src/rendering/pixi/art/ground-stream.js';
import {loadThemeArt} from '../src/rendering/pixi/art/theme-art.js';
import {mapFor,readyThemes,THEME_OF} from '../src/world/island-maps.js';
import {createFairWater} from '../src/rendering/pixi/environment/centre-motion/fair.js';
import {updateCommunityCentre} from '../src/rendering/pixi/environment/centre-motion/community.js';
const json=p=>JSON.parse(readFileSync(p));

test('all eight theme manifests load, release textures and resolve their authored animation pieces', async t=>{
 const adapter=DOMAdapter.get();
 DOMAdapter.set({...adapter,createCanvas:()=>({getContext:()=>null})});
 t.after(()=>DOMAdapter.set(adapter));
 const original=globalThis.fetch;
 globalThis.fetch=async url=>({ok:true,json:async()=>json('public'+url)});
 try {
  const animated={sunflower:2,pink:2,library:4,community:1,fair:0};
  assert.equal(readyThemes().length,8);assert.equal(THEME_OF.size,8);
  for(const theme of readyThemes()) {
   let acquired=0,released=0;
   const groundPool=createGroundPool({acquire:async()=>Texture.EMPTY,release:()=>{}});
   const art=await loadThemeArt(mapFor(theme),{groundPool,acquire:async()=>{acquired++;return Texture.EMPTY;},release:()=>released++});
   const records=art.props.filter(p=>p.centrePiece?.animate);
   assert.equal(records.length,animated[theme]??0,theme+' animated layers');
   assert.ok(art.props.every(p=>!p.centrePiece||!p.wind),theme+' centre layers have no wind');
   const objects=new Container();
   await attachCentreMotion(art,{Graphics,Container},objects);
   art.updateCentre(.3,false);art.updateCentre(1,true);
   art.destroy();groundPool.destroy();assert.equal(objects.children.length,0,theme+' removes motion objects');
   objects.destroy();assert.equal(released,acquired,theme+' releases all texture references');
  }
 } finally {globalThis.fetch=original;}
});

test('centre motion keeps authored pivots fixed and restores a stable reduced-motion pose',()=>{
 for(const kind of ['rotate','spin','wind','jet','flow','ripple','foam']) {
  const piece={x:0,y:0,width:100,height:160,anchor:{x:.25,y:.8},animate:{kind,period:3,travel:20}};
  const sprite=new Sprite(Texture.EMPTY);sprite.anchor.set(.5,1.3);sprite.position.set(120,300);sprite.width=100;sprite.height=160/.78;
  const record={piece,sprite},rest=[sprite.x,sprite.y,sprite.scale.x,sprite.scale.y,0,1];
  const state=()=>[sprite.x,sprite.y,sprite.scale.x,sprite.scale.y,sprite.rotation,sprite.alpha];
  const pivot=()=>{const dx=(piece.anchor.x-sprite.anchor.x)*sprite.texture.width*sprite.scale.x,dy=(piece.anchor.y-sprite.anchor.y)*sprite.texture.height*sprite.scale.y;return [sprite.x+dx*Math.cos(sprite.rotation)-dy*Math.sin(sprite.rotation),sprite.y+dx*Math.sin(sprite.rotation)+dy*Math.cos(sprite.rotation)];};
  const before=pivot();animatePieces([record],.7);assert.notDeepEqual(state(),rest,kind+' moves');
  if(['rotate','wind','jet','ripple'].includes(kind)) pivot().forEach((x,i)=>assert.ok(Math.abs(x-before[i])<1e-7,kind+' pivot stays attached'));
  animatePieces([record],4,true);assert.deepEqual(state(),rest,kind+' resets');
  animatePieces([record],40,true);assert.deepEqual(state(),rest,kind+' remains still');sprite.destroy();
 }
});

test('fair pour and community fire animate, remain attached, hide and clean up',()=>{
 const objects=new Container(),fallback={id:'fair-centre-water',sprite:new Sprite(Texture.EMPTY)};
 const water=createFairWater({Graphics,Container},[fallback],objects);
 water.update(.3,false,true);assert.equal(fallback.sprite.alpha,0);assert.ok(water.root.visible);
 water.update(1,false,false);assert.equal(water.root.visible,false);water.destroy();assert.equal(fallback.sprite.alpha,1);assert.equal(objects.children.length,0);
 const a=json('public/pixi-art/themes/community/art.json');
 const props=['campfire','campfire-flame'].map(id=>{const p=a.props.find(p=>p.id===id),sprite=new Sprite(Texture.EMPTY);sprite.position.set(p.x,p.y);sprite.width=p.width*p.scale;sprite.height=p.height*p.scale/.78;return {...p,sprite};});
 const art={id:'community',props};updateCommunityCentre(art,.2);const y=props[1].sprite.scale.y;updateCommunityCentre(art,.8);assert.notEqual(props[1].sprite.scale.y,y);
 updateCommunityCentre(art,1,true);assert.equal(props[1].sprite.y,props[0].sprite.y+(props[1].anchor.y-props[0].anchor.y)*props[0].sprite.height);
 const still=props[1].sprite.scale.y;updateCommunityCentre(art,99,true);assert.equal(props[1].sprite.scale.y,still);
 for(const p of props)p.sprite.destroy();fallback.sprite.destroy();objects.destroy();
});
