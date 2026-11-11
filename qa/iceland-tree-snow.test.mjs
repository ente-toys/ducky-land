import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {Container,Sprite,Texture} from 'pixi.js';
import {createPlantContacts,plantKind,LEAF_CAP} from '../src/pixi/plant-contact.js';
import {createPlantReactions} from '../src/pixi/plant-reactions.js';
import {thinSnowSVG,SNOW_CLUMP_CAP,SNOW_PILE_CAP,SNOW_REFILL} from '../src/pixi/plant-snow.js';
import {mapFor} from '../src/pixi/island-maps.js';

const manifest=JSON.parse(readFileSync('public/pixi-art/themes/snow/art.json')),map=mapFor('snow');
const nodes=n=>[n,...n.children.flatMap(nodes)],find=(parent,label)=>nodes(parent).filter(n=>n.label===label);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t,props) {
  const oldFetch=globalThis.fetch,loaded=[],unloaded=[];
  globalThis.fetch=async url=>({ok:true,text:async()=>readFileSync(`public${url}`,'utf8')});
  const parent=new Container();
  const ps=props.map((p,i)=>({...p,x:i*400,y:300,width:p.width??230,height:p.height??315,scale:1,sprite:new Container({label:p.name})}));
  const blockers=ps.map(p=>({prop:p.id,x:p.x,y:p.y-18,rx:25,ry:18}));
  const fx=createPlantReactions(parent,Texture.EMPTY,{snow:{load:async src=>{loaded.push(src);return Texture.EMPTY;},unload:async src=>unloaded.push(src)}});
  fx.register('snow',ps,blockers,'/pixi-art/themes/snow/');await settle();
  t.after(()=>{fx.destroy();for(const p of ps)p.sprite.destroy({children:true});parent.destroy({children:true});globalThis.fetch=oldFetch;});
  const bump=async(i,time=.1,who={})=>{
    const p=ps[i];fx.begin('snow',time-.05);fx.track(who,p.x-90,p.y-18);
    fx.begin('snow',time);fx.track(who,p.x-46,p.y-18);await settle();fx.update(time+.15);return who;
  };
  return {fx,parent,ps,blockers,bump,loaded,unloaded};
}

test('Iceland variant recognises actual pines, shrubs and snowy bushes while Home classification stays unchanged',()=>{
  const candidates=manifest.props.filter(p=>p.finalKind==='tree'||p.finalKind==='shrub');
  const contact=createPlantContacts(candidates,map.walk.obstacles,()=>{},{snow:true});
  assert.equal(contact.plants.length,candidates.length,'all real snowy grove/camp plants have matching contacts');
  assert.ok(contact.plants.filter(p=>p.kind==='tree').length>=510);
  assert.ok(contact.plants.filter(p=>p.kind==='bush').length>=20);
  for(const p of [{name:'pine-small'},{name:'snow-fir'},{name:'spruce-2'}])assert.equal(plantKind(p,true),'tree');
  for(const p of [{name:'snow-bush'},{name:'yard-shoulder',finalKind:'shrub'}])assert.equal(plantKind(p,true),'bush');
  assert.equal(plantKind({name:'pine-small'}),null);assert.equal(plantKind({name:'bench'} ,true),null);
});

test('local or remote bumps shed white clumps and flakes, a fading trunk pile and refilling cap, with zero green leaves',async t=>{
  const sample=manifest.props.find(p=>p.finalRole==='pine-medium');
  const {fx,parent,ps,bump,loaded}=await fixture(t,[sample]);
  const who=await bump(0),leaves=parent.children.slice(0,LEAF_CAP);
  const clumps=find(parent,'Shed snow clump'),flakes=find(parent,'Shed snow flake'),piles=find(parent,'Soft snow pile at trunk');
  assert.ok(clumps.some(g=>g.visible)&&flakes.some(g=>g.visible));assert.ok(leaves.every(s=>!s.visible));
  const pile=piles.find(g=>g.visible);assert.ok(pile);assert.equal(pile.x,ps[0].x);assert.equal(pile.y,ps[0].y-2);
  const cap=find(ps[0].sprite,'Thinned tree snow cap')[0];assert.ok(cap?.alpha>.9);
  assert.equal(cap.width,ps[0].width);assert.equal(cap.height,ps[0].height);assert.equal(loaded.length,1);
  const falling=[...clumps,...flakes].find(g=>g.visible),start={x:falling.x,y:falling.y};
  fx.update(.65);assert.ok(falling.y>start.y);assert.notEqual(falling.x,start.x);
  fx.update(3.7);assert.ok(pile.alpha<.7&&pile.alpha>0);assert.ok(cap.alpha<.6&&cap.alpha>0);
  fx.update(.1+SNOW_REFILL+.01);assert.equal(pile.visible,false);assert.equal(cap.alpha,0);
  // A separate remote actor uses the same contact throttle and snow variant.
  await bump(0,6,{});assert.ok(clumps.some(g=>g.visible));assert.ok(cap.alpha>.9);
  fx.begin('snow',7);fx.track(who,ps[0].x-46,ps[0].y-18);fx.update(7.5);
  assert.ok([...clumps,...flakes].every(g=>!g.visible),'holding a trunk cannot repeatedly shed snow');
});

test('shrubs and snowy bushes shed snow too and shared source textures are decoded once',async t=>{
  const shrub=manifest.props.find(p=>p.finalKind==='shrub');
  const bush={...shrub,id:'snow-bush',name:'snow-bush',finalKind:undefined};
  const {parent,ps,bump,loaded}=await fixture(t,[shrub,bush]);
  await bump(0);await bump(1,.3);
  assert.equal(loaded.length,1);assert.ok(ps.every(p=>find(p.sprite,'Thinned tree snow cap')[0]?.alpha>.8));
  assert.ok(find(parent,'Shed snow clump').some(g=>g.visible));
});

test('snow bursts and piles have fixed pools, reduced motion and map handoff clear effects and restore transforms',async t=>{
  const sample=manifest.props.find(p=>p.finalRole==='pine-medium');
  const {fx,parent,ps,bump}=await fixture(t,Array.from({length:20},(_,i)=>({...sample,id:`pine-${i}`})));
  for(let i=0;i<20;i++) await bump(i,.1);
  const particles=[...find(parent,'Shed snow clump'),...find(parent,'Shed snow flake')],piles=find(parent,'Soft snow pile at trunk');
  assert.equal(particles.length,SNOW_CLUMP_CAP);assert.equal(piles.length,SNOW_PILE_CAP);
  assert.equal(particles.filter(g=>g.visible).length,SNOW_CLUMP_CAP);assert.equal(piles.filter(g=>g.visible).length,SNOW_PILE_CAP);
  assert.equal(parent.children.length,LEAF_CAP+1,'effects allocate once, never on each bump');
  fx.begin('snow',.3,true);fx.update(.3);assert.ok(particles.every(g=>!g.visible));
  assert.ok(ps.every(p=>find(p.sprite,'Thinned tree snow cap').every(c=>c.alpha===0)));
  fx.register('home',[],[]);fx.begin('home',.4);fx.update(.4);
  assert.ok(particles.every(g=>!g.visible)&&piles.every(g=>!g.visible));
  for(const p of ps){assert.equal(p.sprite.scale.x,1);assert.equal(p.sprite.scale.y,1);assert.equal(p.sprite.skew.x,0);}
  fx.begin('snow',.5);fx.update(.5);assert.ok(piles.every(g=>!g.visible),'old snow does not resume on returning');
  fx.unregister('snow');assert.ok(ps.every(p=>find(p.sprite,'Thinned tree snow cap').length===0));
});

test('runtime cap film shrinks painted snow coverage on current pines and shrubs, without editing source art',async()=>{
  for(const asset of ['pine-large','pine-medium','pine-small','shrub-medium']) {
    const source=readFileSync(`public/pixi-art/themes/snow/final/props/${asset}.svg`,'utf8'),film=thinSnowSVG(source);
    assert.ok(film?.includes('feMorphology'),asset);assert.ok(film.includes('#448238'));
    const raster=async svg=>(await sharp(Buffer.from(svg)).resize({height:220}).ensureAlpha().raw().toBuffer({resolveWithObject:true})).data;
    const original=await raster(source),changed=await raster(film);
    const white=data=>{let n=0;for(let i=0;i<data.length;i+=4)if(data[i]>225&&data[i+1]>225&&data[i+2]>220&&data[i+3]>200)n++;return n;};
    assert.ok(white(changed)<white(original)*.9,asset+' has visibly thinner snow');assert.ok(white(changed)>0,asset+' retains a thin cap');
    assert.equal(readFileSync(`public/pixi-art/themes/snow/final/props/${asset}.svg`,'utf8'),source);
  }
  assert.equal(thinSnowSVG('<svg><path fill="#448238" d="M0 0Z"/></svg>'),null);
});

test('Home retains its original green leaf reaction and never allocates the Iceland snow pools',async t=>{
  const previous=globalThis.fetch;globalThis.fetch=async()=>({ok:true,text:async()=>'<path fill="#63ae45" d="M0 0L10 0L10 10Z"/>'});
  t.after(()=>{globalThis.fetch=previous;});
  const parent=new Container(),sprite=new Sprite(Texture.EMPTY),fx=createPlantReactions(parent,Texture.EMPTY);
  try {
    fx.register('home',[{id:'tree-home',name:'tree-home',src:'/tree.svg',x:0,y:0,width:200,height:280,scale:1,sprite}],[{prop:'tree-home',x:0,y:-9,rx:31,ry:22}]);
    await settle();const who={};fx.begin('home',0);fx.track(who,-100,-9);fx.begin('home',.1);fx.track(who,-50,-9);fx.update(.2);
    assert.equal(parent.children.length,LEAF_CAP);assert.equal(parent.children.filter(s=>s.visible).length,1);
    assert.equal(parent.children.find(s=>s.visible).tint,0x63ae45);
  } finally {fx.destroy();sprite.destroy();parent.destroy();}
});
