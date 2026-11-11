import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {Assets,Sprite,Graphics,Texture,TextureSource} from 'pixi.js';
import {attachGunC} from '../src/pixi/bog-combat/held-gun.js';
import guns from '../src/pixi/bog-combat/assets/guns.json' with {type:'json'};
const base=new URL('../src/pixi/bog-combat/assets/google-ducky/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('../public/pixi-duck/manifest.json',import.meta.url)));
const banned=/<(?:image|linearGradient|radialGradient|filter)\b|data:/i;

test('all eight Google directions preserve every live body, wing and two-lobe tuft path with only the approved fill changes',()=>{
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

test('Google Popper has the reference colours, valid muzzle bounds and all eight original wing grips',()=>{
 assert.equal(guns.filter(g=>g.team==='google').length,8);
 for(const google of guns.filter(g=>g.team==='google')){
  const privacy=guns.find(g=>g.team==='privacy'&&g.rigAngle===google.rigAngle);
  assert.deepEqual(google.grip,privacy.grip);assert.deepEqual(google.wingPose,privacy.wingPose);
  const svg=fs.readFileSync(new URL('../src/pixi/bog-combat/assets/'+google.file,import.meta.url),'utf8');
  for(const c of ['#FFD525','#EF5144','#61D94E','#1689F9','#AA65D4','#232323'])assert.ok(svg.includes(c),google.facing+' '+c);
  assert.doesNotMatch(svg,banned);
  const [x,y,w,h]=google.viewBox;
  assert.ok(google.muzzle[0]>=x&&google.muzzle[0]<=x+w);assert.ok(google.muzzle[1]>=y&&google.muzzle[1]<=y+h);
 }
});

const {outputFiles:[bundle]}=await build({entryPoints:[fileURLToPath(new URL('../src/pixi/duck.js',import.meta.url))],bundle:true,packages:'external',format:'esm',write:false});
const {createDuck,disposeDuckAssets}=await import('data:text/javascript;base64,'+Buffer.from(bundle.text.replaceAll('"pixi.js"',JSON.stringify(import.meta.resolve('pixi.js')))).toString('base64'));
const descendants=node=>[node,...(node.children??[]).flatMap(descendants)];
const direction=rig=>descendants(rig.root).find(n=>n.label?.startsWith('Direction ')&&n.visible);

test('real rigs share red textures, morph in red, keep every emote and restore yellow without changing a Privacy neighbour',async()=>{
 const original={fetch:globalThis.fetch,document:globalThis.document,DOMParser:globalThis.DOMParser,load:Assets.load,get:Assets.get,unload:Assets.unload,fill:Graphics.prototype.fill};
 const dom=new JSDOM('<body></body>'),rigs=[],owned=[];
 const fills=new Map();
 // Synthetic sampling exercises the real morph renderer in Node. Art fidelity
 // is checked against the original SVG paths above, independently of sampling.
 dom.window.SVGElement.prototype.getTotalLength=()=>100;
 dom.window.SVGElement.prototype.getPointAtLength=function(at){const a=at/100*Math.PI*2;return {x:300+180*Math.sin(a),y:350-260*Math.cos(a)};};
 globalThis.document=dom.window.document;globalThis.DOMParser=dom.window.DOMParser;
 globalThis.fetch=async url=>({ok:true,json:async()=>structuredClone(manifest),text:async()=>fs.readFileSync('public'+url,'utf8')});
 Assets.load=async()=>Texture.EMPTY;Assets.get=()=>Texture.EMPTY;Assets.unload=async()=>{};
 Graphics.prototype.fill=function(style){const list=fills.get(this)??[];list.push(typeof style==='number'?style:style?.color);fills.set(this,list);return original.fill.call(this,style);};
 const texture=(width=80,height=110)=>{const t=new Texture({source:new TextureSource({width,height})});owned.push(t);return t;};
 const look={body:0xEF5144,belly:0xFF9C90,horn:texture(),tail:texture(205,232),textures:new Map()};
 for(const file of fs.readdirSync(base))look.textures.set(file,texture());
 try{
  const privacy=await createDuck({outfit:{},seed:1}),google=await createDuck({outfit:{},seed:7}),peer=await createDuck({outfit:{},seed:9});rigs.push(privacy,google,peer);
  google.setAppearance(look);peer.setAppearance(look);
  const firstMorph=descendants(direction(google)).find(n=>n.label==='body-0').children.find(n=>n instanceof Graphics);
  assert.equal(fills.get(firstMorph).at(-3),0xEF5144,'appearance repaints the visible morph before the next frame');
  const bodies=new Map();
  for(const angle of manifest.views.map(v=>v.angle)){
   for(let i=0;i<180;i++)for(const rig of rigs)rig.update(1/60,{turn:angle*Math.PI/180,time:5,reducedMotion:false});
   const view=direction(google),nodes=descendants(view),body=nodes.find(n=>n.label==='body-0'),morph=body.children.find(n=>n instanceof Graphics);
   assert.equal(Number(view.label.slice(10)),angle);assert.ok(fills.get(morph).includes(0xEF5144));
   if(angle!==180&&Math.abs(angle)!==135)assert.ok(fills.get(morph).includes(0xFF9C90));
   const reference=manifest.views.find(v=>v.angle===angle);
   for(const part of reference.parts.filter(p=>['body','wing','tuft'].includes(p.role))){const sprite=nodes.find(n=>n.label===part.id).children[0];assert.equal(sprite.texture,look.textures.get(part.url.split('/').at(-1)));}
   assert.equal(nodes.find(n=>n.label==='tail-0').children[0].visible,false);
   const horns=nodes.find(n=>n.label==='Google devil horns');assert.ok(horns.visible);assert.equal(horns.children.length,2);assert.equal(horns.children[0].texture,look.horn);
   assert.ok(!descendants(privacy.root).some(n=>n.label==='Google devil horns'));
   const privacyBody=descendants(direction(privacy)).find(n=>n.label==='body-0'),privacyMorph=privacyBody.children.find(n=>n instanceof Graphics);
   assert.ok(fills.get(privacyMorph).includes(0xFFD525));assert.ok(!fills.get(privacyMorph).includes(0xEF5144));
   bodies.set(angle,{view,horns,count:nodes.length});
  }
  for(let action=0;action<=9;action++)for(const rig of [google,peer]){
   for(let frame=0;frame<40;frame++)rig.update(1/60,{action,speed:action===1?275:0,turn:Math.PI/2,time:6+frame/60});
   if(action===7){const sleep=descendants(rig.root).find(n=>n.label?.startsWith('Sleeping Ducky'));assert.ok(sleep.visible);assert.ok(descendants(sleep).some(n=>n instanceof Sprite&&[look.textures.get('nod-duck.svg'),look.textures.get('wing-duck.svg')].includes(n.texture)));}
  }
  for(const angle of manifest.views.map(v=>v.angle)){
   for(let i=0;i<180;i++)google.update(1/60,{turn:angle*Math.PI/180});
   const now=direction(google),old=bodies.get(angle);assert.equal(now,old.view);assert.equal(descendants(now).length,old.count);assert.equal(descendants(now).find(n=>n.label==='Google devil horns'),old.horns);
  }
  // Reset on leaving combat does not allocate replacement artwork or mutate peers.
  google.setAppearance(null);google.update(1/60,{turn:Math.PI/4});
  assert.equal(descendants(direction(google)).find(n=>n.label==='Google devil horns').visible,false);
  assert.equal(descendants(direction(google)).find(n=>n.label==='tail-0').children[0].visible,true);
  assert.ok(descendants(direction(peer)).find(n=>n.label==='Google devil horns').visible);
  google.dispose();google.setAppearance(null); // engine may dispose before attachment cleanup
 }finally{
  for(const rig of rigs)rig.dispose();await disposeDuckAssets();for(const t of owned)t.destroy(true);
  globalThis.fetch=original.fetch;globalThis.document=original.document;globalThis.DOMParser=original.DOMParser;Assets.load=original.load;Assets.get=original.get;Assets.unload=original.unload;Graphics.prototype.fill=original.fill;dom.window.close();
 }
});

test('the shared gun attachment selects Google appearance and removes it on cleanup',()=>{
 const changes=[],look={},items=[];items.googleLook=look;
 const rig={setAppearance:a=>changes.push(a)},google=attachGunC(rig,items,'google',{});google.dispose();
 const privacy=attachGunC(rig,items,'privacy',{});privacy.dispose();assert.deepEqual(changes,[look,null,null,null]);
});
