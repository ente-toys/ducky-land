import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {Assets,Sprite,Graphics,Texture,TextureSource} from 'pixi.js';
import {attachGunC} from '../src/features/bog-combat/held-gun.js';
import guns from '../src/features/bog-combat/assets/guns.json' with {type:'json'};
const base=new URL('../src/features/bog-combat/assets/evil-ducky/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('../public/pixi-duck/manifest.json',import.meta.url)));
const banned=/<(?:image|linearGradient|radialGradient|filter)\b|data:/i;

test('all eight Evil directions preserve every live body, wing and two-lobe tuft path with only the approved fill changes',()=>{
 for(const view of manifest.views)for(const part of view.parts.filter(p=>['body','wing','tuft'].includes(p.role))){
  const live=fs.readFileSync(new URL('../public'+part.url,import.meta.url),'utf8');
  const devil=fs.readFileSync(new URL(part.url.split('/').at(-1),base),'utf8');
  assert.equal(devil,live.replace(/#ffd525/ig,'#EF5144').replace(/#ffe161/ig,'#FF9C90'),part.url);
  assert.doesNotMatch(devil,banned);
 }
 for(const file of ['horn.svg','spade-tail.svg','nod-duck.svg','wing-duck.svg'])assert.doesNotMatch(fs.readFileSync(new URL(file,base),'utf8'),banned);
 assert.match(fs.readFileSync(new URL('horn.svg',base),'utf8'),/fill="#7E1F27"/);
 assert.match(fs.readFileSync(new URL('spade-tail.svg',base),'utf8'),/fill="#EF5144"/);
});

test('Evil Popper has the reference colours, valid muzzle bounds and all eight original wing grips',()=>{
 assert.equal(guns.filter(g=>g.team==='evil').length,8);
 for(const evil of guns.filter(g=>g.team==='evil')){
  const karma=guns.find(g=>g.team==='karma'&&g.rigAngle===evil.rigAngle);
  assert.deepEqual(evil.grip,karma.grip);assert.deepEqual(evil.wingPose,karma.wingPose);
  const svg=fs.readFileSync(new URL('../src/features/bog-combat/assets/'+evil.file,import.meta.url),'utf8');
  for(const c of ['#FFD525','#EF5144','#61D94E','#1689F9','#AA65D4','#232323'])assert.ok(svg.includes(c),evil.facing+' '+c);
  assert.doesNotMatch(svg,banned);
  const [x,y,w,h]=evil.viewBox;
  assert.ok(evil.muzzle[0]>=x&&evil.muzzle[0]<=x+w);assert.ok(evil.muzzle[1]>=y&&evil.muzzle[1]<=y+h);
 }
});

test('Karma alone has flat black shades and white/yellow padlock poppers in every direction, on death and in the HUD',()=>{
 const dir=new URL('../src/features/bog-combat/assets/',import.meta.url);
 for(const spec of guns){
  const svg=fs.readFileSync(new URL(spec.file,dir),'utf8');
  assert.doesNotMatch(svg,banned);
  if(spec.team==='karma'){
   for(const colour of ['#FFFFFF','#FFD525','#232323'])assert.ok(svg.includes(colour),spec.file+' '+colour);
   assert.match(svg,/id="karma-padlock"/);
   assert.doesNotMatch(svg,/#348261|#99d74b|#9e79be/i);
  }else assert.doesNotMatch(svg,/karma-padlock/);
 }
 const dropped=fs.readFileSync(new URL('ghosts/karma-popper.svg',dir),'utf8');
 for(const colour of ['#FFFFFF','#FFD525','#232323'])assert.ok(dropped.includes(colour));
 assert.match(dropped,/id="karma-padlock"/);assert.doesNotMatch(dropped,banned);
 for(const file of fs.readdirSync(new URL('karma-ducky/',dir))){
  const svg=fs.readFileSync(new URL('karma-ducky/'+file,dir),'utf8');
  assert.doesNotMatch(svg,banned);assert.match(svg,/#232323/);
 }
 const hud=fs.readFileSync(new URL('../src/features/bog-combat/BogGame.jsx',import.meta.url),'utf8');
 assert.ok(hud.includes('/pixi-art/themes/bog-arena/hud/'));assert.ok(hud.includes("'karma-padlock'"));
 assert.ok(fs.readFileSync(new URL('../public/pixi-art/themes/bog-arena/hud/karma-padlock-popper.svg',import.meta.url),'utf8').includes('id="karma-padlock"'));
});

const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/rendering/pixi/duck.js',import.meta.url))],bundle:true,packages:'external',format:'esm',write:false});
const {createDuck,disposeDuckAssets}=await import('data:text/javascript;base64,'+Buffer.from(bundle.text.replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')))).toString('base64'));
const descendants=node=>[node,...(node.children??[]).flatMap(descendants)];
const direction=rig=>descendants(rig.root).find(n=>n.label?.startsWith('Direction ')&&n.visible);

test('real rigs share red textures, morph in red, keep every emote and restore yellow without changing a Karma neighbour',async()=>{
 const original={fetch:globalThis.fetch,document:globalThis.document,DOMParser:globalThis.DOMParser,load:Assets.load,get:Assets.get,unload:Assets.unload,fill:Graphics.prototype.fill};
 const dom=new JSDOM('<body></body>'),rigs=[],owned=[];
 const fills=new Map();
 dom.window.SVGElement.prototype.getTotalLength=()=>100;
 dom.window.SVGElement.prototype.getPointAtLength=function(at){const a=at/100*Math.PI*2;return {x:300+180*Math.sin(a),y:350-260*Math.cos(a)};};
 globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
 globalThis.fetch=async url=>({ok:true,json:async()=>structuredClone(manifest),text:async()=>fs.readFileSync('public'+url,'utf8')});
 Assets.load=async()=>Texture.EMPTY;Assets.get=()=>Texture.EMPTY;Assets.unload=async()=>{};
 Graphics.prototype.fill=function(style){const list=fills.get(this)??[];list.push(typeof style==='number'?style:style?.color);fills.set(this,list);return original.fill.call(this,style);};
 const texture=(width=80,height=110)=>{const t=new Texture({source:new TextureSource({width,height})});owned.push(t);return t;};
 const look={body:0xEF5144,belly:0xFF9C90,horn:texture(),tail:texture(205,232),textures:new Map()};
 const privateTextures=new Map(['lens.svg','bridge.svg','nod-shades.svg','wing-shades.svg'].map(file=>[file,texture()]));
 const privateLook={textures:privateTextures,shades:{lens:privateTextures.get('lens.svg'),bridge:privateTextures.get('bridge.svg'),sleep:privateTextures}};
 for(const file of fs.readdirSync(base))look.textures.set(file,texture());
 try{
  const karma=await createDuck({outfit:{},seed:1}),evil=await createDuck({outfit:{},seed:7}),peer=await createDuck({outfit:{},seed:9});rigs.push(karma,evil,peer);
  evil.setAppearance(look);peer.setAppearance(look);karma.setAppearance(privateLook);
  const firstMorph=descendants(direction(evil)).find(n=>n.label==='body-0').children.find(n=>n instanceof Graphics);
  assert.equal(fills.get(firstMorph).at(-3),0xEF5144,'appearance repaints the visible morph before the next frame');
  const bodies=new Map();
  for(const angle of manifest.views.map(v=>v.angle)){
   for(let i=0;i<180;i++)for(const rig of rigs)rig.update(1/60,{turn:angle*Math.PI/180,time:5,reducedMotion:false});
   const view=direction(evil),nodes=descendants(view),body=nodes.find(n=>n.label==='body-0'),morph=body.children.find(n=>n instanceof Graphics);
   assert.equal(Number(view.label.slice(10)),angle);assert.ok(fills.get(morph).includes(0xEF5144));
   if(angle!==180&&Math.abs(angle)!==135)assert.ok(fills.get(morph).includes(0xFF9C90));
   const reference=manifest.views.find(v=>v.angle===angle);
   for(const part of reference.parts.filter(p=>['body','wing','tuft'].includes(p.role))){const sprite=nodes.find(n=>n.label===part.id).children[0];assert.equal(sprite.texture,look.textures.get(part.url.split('/').at(-1)));}
   assert.equal(nodes.find(n=>n.label==='tail-0').children[0].visible,false);
   const horns=nodes.find(n=>n.label==='Evil devil horns');assert.ok(horns.visible);assert.equal(horns.children.length,2);assert.equal(horns.children[0].texture,look.horn);
   assert.ok(!descendants(karma.root).some(n=>n.label==='Evil devil horns'));
   const privateView=direction(karma),privateNodes=descendants(privateView),shades=privateNodes.find(n=>n.label==='Karma sunglasses');
   const hasEyes=Math.abs(angle)<=90;
   assert.equal(shades.visible,hasEyes);
   for(const eye of privateNodes.filter(n=>n.label?.startsWith('eye-'))){
    assert.equal(eye.visible,false,'Karma eyes are replaced, including after a blink');
    const lens=privateNodes.find(n=>n.label===`Karma lens ${eye.label}`);
    assert.equal(lens.x,eye.x);assert.equal(lens.y,eye.y);assert.equal(lens.rotation,eye.rotation);
    assert.equal(lens.scale.y,1,'glasses never squash with blinking eyes');
   }
   assert.ok(privateNodes.find(n=>n.label==='tail-0').children[0].visible,'Karma keeps the original tail');
   assert.ok(!descendants(evil.root).some(n=>n.label==='Karma sunglasses'));
   const karmaBody=descendants(direction(karma)).find(n=>n.label==='body-0'),karmaMorph=karmaBody.children.find(n=>n instanceof Graphics);
   assert.ok(fills.get(karmaMorph).includes(0xFFD525));assert.ok(!fills.get(karmaMorph).includes(0xEF5144));
   bodies.set(angle,{view,horns,count:nodes.length});
  }
  for(let action=0;action<=9;action++)for(const rig of [evil,peer,karma]){
   for(let frame=0;frame<40;frame++)rig.update(1/60,{action,speed:action===1?275:0,turn:Math.PI/2,time:6+frame/60});
   if(action===7){const sleep=descendants(rig.root).find(n=>n.label?.startsWith('Sleeping Ducky'));assert.ok(sleep.visible);if(rig===karma)assert.ok(descendants(sleep).find(n=>n.label==='Sleeping Karma sunglasses').visible);else assert.ok(descendants(sleep).some(n=>n instanceof Sprite&&[look.textures.get('nod-duck.svg'),look.textures.get('wing-duck.svg')].includes(n.texture)));}
  }
  for(let angle=-180;angle<=180;angle+=5){
   for(let frame=0;frame<90;frame++)karma.update(1/60,{turn:angle*Math.PI/180,action:3,time:7+frame/60});
   const nodes=descendants(direction(karma));
   for(const eye of nodes.filter(n=>n.label?.startsWith('eye-'))){
    const lens=nodes.find(n=>n.label===`Karma lens ${eye.label}`);
    assert.equal(lens.x,eye.x);assert.equal(lens.y,eye.y);assert.equal(lens.rotation,eye.rotation);
   }
  }
  karma.setAppearance(null);karma.update(1/60,{turn:0,reducedMotion:true});
  assert.equal(descendants(direction(karma)).find(n=>n.label==='Karma sunglasses').visible,false);
  assert.ok(descendants(direction(karma)).filter(n=>n.label?.startsWith('eye-')).every(n=>n.visible));
  for(const angle of manifest.views.map(v=>v.angle)){
   for(let i=0;i<180;i++)evil.update(1/60,{turn:angle*Math.PI/180});
   const now=direction(evil),old=bodies.get(angle);assert.equal(now,old.view);assert.equal(descendants(now).length,old.count);assert.equal(descendants(now).find(n=>n.label==='Evil devil horns'),old.horns);
  }
  evil.setAppearance(privateLook);evil.update(1/60,{turn:0,reducedMotion:true});
  assert.equal(descendants(direction(evil)).find(n=>n.label==='Evil devil horns').visible,false);
  assert.ok(descendants(direction(evil)).find(n=>n.label==='Karma sunglasses').visible);
  evil.setAppearance(look);
  evil.setAppearance(null);evil.update(1/60,{turn:Math.PI/4});
  assert.equal(descendants(direction(evil)).find(n=>n.label==='Evil devil horns').visible,false);
  assert.equal(descendants(direction(evil)).find(n=>n.label==='tail-0').children[0].visible,true);
  assert.ok(descendants(direction(peer)).find(n=>n.label==='Evil devil horns').visible);
  evil.dispose();evil.setAppearance(null);
 }finally{
  for(const rig of rigs)rig.dispose();await disposeDuckAssets();for(const t of owned)t.destroy(true);
  globalThis.fetch=original.fetch;globalThis.document=original.document;globalThis.DOMParser=original.DOMParser;Assets.load=original.load;Assets.get=original.get;Assets.unload=original.unload;Graphics.prototype.fill=original.fill;dom.window.close();
 }
});

test('the shared player and bot gun attachment selects each team appearance and removes it on cleanup',()=>{
 const changes=[],look={},privateLook={},items=[];items.evilLook=look;items.karmaLook=privateLook;
 const rig={setAppearance:a=>changes.push(a)},evil=attachGunC(rig,items,'evil',{});evil.dispose();
 const karma=attachGunC(rig,items,'karma',{});karma.dispose();assert.deepEqual(changes,[look,null,privateLook,null]);
});
