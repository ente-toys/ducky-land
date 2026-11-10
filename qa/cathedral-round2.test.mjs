import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sharp from 'sharp';
import {JSDOM} from 'jsdom';
import {Texture} from 'pixi.js';
import {BUILDING_STYLES} from '../scripts/bigger-cathedral/buildings-data.mjs';
import {frontGable} from '../scripts/bigger-cathedral/round2-buildings.mjs';
import {createAutumnLeaves} from '../src/pixi/autumn-leaves.js';
import {autumnLeafPose} from '../src/pixi/autumn-leaf-motion.js';
import {rasterTiles} from '../src/pixi/theme-raster.js';
import {render} from '../scripts/bigger-cathedral/render.mjs';

const A='public/pixi-art/themes/cathedral/';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read(A+'art.json');
const document=src=>new JSDOM(fs.readFileSync(A+src,'utf8'),{contentType:'image/svg+xml'}).window.document;
const grass=read('scripts/bigger-cathedral/round2-grass.json');
const strip=s=>s.replace(/<g data-bellovo-grass="r2">[\s\S]*?<\/g><!--bellovo-grass-end-->/g,'');

test('Bellovo lawn detail stays entirely on painted grass, including its antialias margin',async()=>{
 // Recompose the actual floor without its new texture. This tests visual
 // surfaces, including destination paving that navigation calls walkable.
 const X=-2200,Y=-2400,k=.25,width=3200,height=2600,layers=[];
 for(const [type,parts]of [['ground',art.ground.tiles],['flat',art.flats],['deck',art.decks]])for(const p of parts){
  if(type==='flat'&&/shadow|litter/.test(p.id??''))continue;
  const anchor=type==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};
  const w=Math.round(p.width*(p.scale??1)*k),h=Math.round(p.height*(p.scale??1)*k);
  const left=Math.round((p.x-X)*k-anchor.x*w),top=Math.round((p.y-Y)*k-anchor.y*h);
  assert.ok(left>=0&&top>=0&&left+w<=width&&top+h<=height,p.src+' within floor atlas');
  const file=p.src.startsWith('/')?'public'+p.src:A+p.src;
  const input=await sharp(Buffer.from(strip(fs.readFileSync(file,'utf8')))).resize(w,h,{fit:'fill'}).png().toBuffer();
  layers.push({input,left,top});
 }
 const data=await sharp({create:{width,height,channels:4,background:art.sea}}).composite(layers).raw().toBuffer();
 const colors=new Set(['162,181,66','170,188,80','178,200,85','194,210,118']);
 assert.ok(grass.marks.length>1400,'texture reaches the whole island');
 const amber=grass.marks.filter(p=>p.amber).length/grass.marks.length;
 assert.ok(amber>.08&&amber<.16,'a few warm amber marks, mostly green');
 assert.deepEqual([...new Set(grass.marks.map(p=>p.kind))].sort(),[0,1,2,3]);
 for(const p of grass.marks){
  for(let y=Math.floor((p.y-Y-4)*k);y<=Math.ceil((p.y+19-Y+4)*k);y++)for(let x=Math.floor((p.x-X-4)*k);x<=Math.ceil((p.x+32-X+4)*k);x++){
   const i=(y*width+x)*4;
   assert.ok(data[i+3]===255&&colors.has(`${data[i]},${data[i+1]},${data[i+2]}`),`lawn-only mark at ${p.x},${p.y}, floor pixel ${x},${y}`);
  }
 }
 // Every substantial connected lawn, including coastal pockets, gets texture.
 const seen=new Uint8Array(width*height),queue=new Int32Array(width*height),centres=new Set(grass.marks.map(p=>Math.floor((p.y+9-Y)*k)*width+Math.floor((p.x+16-X)*k)));
 let lawns=0;
 for(let start=0;start<seen.length;start++){
  const isGrass=i=>data[i*4+3]===255&&colors.has(`${data[i*4]},${data[i*4+1]},${data[i*4+2]}`);
  if(seen[start]||!isGrass(start))continue;
  let head=0,tail=1,marks=0;queue[0]=start;seen[start]=1;
  while(head<tail){const i=queue[head++];if(centres.has(i))marks++;
   for(const j of [i%width?i-1:-1,i%width<width-1?i+1:-1,i-width,i+width])if(j>=0&&j<seen.length&&!seen[j]&&isGrass(j)){seen[j]=1;queue[tail++]=j;}
  }
  if(tail>3000){assert.ok(marks>0,`untextured lawn near ${start%width},${Math.floor(start/width)}`);lawns++;}
 }
 assert.ok(lawns>=8,'inner wedges and outer village lawns checked');
});

test('All four village trades have distinct roofs, porches, shutters, signs and chimney details',async()=>{
 const buildings=art.props.filter(p=>BUILDING_STYLES[p.id]);assert.equal(buildings.length,16);
 const roofs=new Set(),porches=new Set(),shutters=new Set(),trades=new Set();
 for(const p of buildings){
  const doc=document(p.src),s=BUILDING_STYLES[p.id],v=doc.querySelector('[data-village-vocabulary]');
  assert.equal(v.getAttribute('data-village-vocabulary'),s.village);
  porches.add(v.getAttribute('data-porch'));shutters.add(v.getAttribute('data-shutters'));
  trades.add(doc.querySelector('[data-trade-sign]').getAttribute('data-trade-sign'));
  roofs.add(doc.querySelector('[data-roof-plane]').getAttribute('data-roof-plane'));
  assert.equal(doc.querySelectorAll('[data-contact-shadow]').length,1);
  assert.equal(p.shadow,false);assert.equal(p.flip,false);
  assert.doesNotMatch(doc.documentElement.outerHTML,/<image\b|Gradient\b|\btransform=|<filter\b/i);
  // A prior interrupted run left see-through gables. Every opaque point of
  // the authored front wall must also be opaque in the shipped SVG.
  const W=p.width,H=p.height,work=!!s.work,c=W/2,L=work?28:29,R=W-(work?58:53),peak=work?48:39,roofEnd=H-(work?173:169)+10;
  const d=frontGable(s.roof,{L,R,c,peak,roofEnd});if(!d)continue;
  const mask=await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${d}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
  const actual=await sharp(A+p.src).ensureAlpha().raw().toBuffer();
  for(let i=3;i<mask.length;i+=4)if(mask[i]===255)assert.ok(actual[i]>=254,p.id+' opaque gable');
 }
 assert.equal(roofs.size,16);for(const set of [porches,shutters,trades])assert.equal(set.size,4);
});

test('The detailed olive has individual veined leaves and one shadow, its trunk stays on the circle centre',()=>{
 const p=art.props.find(p=>p.id==='cloister-olive-well'),doc=document(p.src);
 assert.deepEqual([p.x+p.trunk[0]-p.anchor.x*p.width,p.y+p.trunk[1]-p.anchor.y*p.height],[4100,2700]);
 const leaves=[...doc.querySelectorAll('[data-olive-leaf]')];assert.ok(leaves.length>=60);
 assert.equal(new Set(leaves.map(el=>el.firstElementChild.getAttribute('d'))).size,leaves.length);
 assert.ok(leaves.every(el=>el.querySelectorAll('path').length===2),'vein in every leaf');
 assert.equal(doc.querySelectorAll('[data-contact-shadow]').length,1);
 assert.doesNotMatch(doc.documentElement.outerHTML,/Gradient\b|\btransform=|<image\b/i);
 assert.equal(art.raster.enabled,false);
 assert.equal(p.shadow,false,'the static sprite must not add a second shadow');
});

test('Both arcade roofs connect continuously to the cathedral and tower in the placed camera',async()=>{
 const props=art.props.filter(p=>p.id==='cathedral-hall'||p.id==='campanile'||p.id.startsWith('centre-colonnade-'));
 const {data,info}=await sharp(await render({...art,ground:{tiles:[]},flats:[],decks:[],props},{x:3400,y:1400,k:2,width:2800,height:500})).raw().toBuffer({resolveWithObject:true});
 const sky=[110,201,222];
 for(const [a,b]of [[[3490,1492],[3580,1570]],[[4637,1498],[4706,1498]]])for(let i=1;i<30;i++){
  const x=a[0]+(b[0]-a[0])*i/30,y=a[1]+(b[1]-a[1])*i/30,index=(Math.round((y-1400)*2)*info.width+Math.round((x-3400)*2))*4;
  assert.notDeepEqual([...data.slice(index,index+3)],sky,'no sky slit at roof join '+x+','+y);
 }
});

test('Existing sparse raster plans retain every new olive, house and arcade join pixel',async()=>{
 const changed=art.props.filter(p=>p.src.includes('-r2.svg')||p.id==='centre-colonnade-right-1');
 for(const p of changed){
  const width=p.width,height=p.height,tiles=rasterTiles(p,'/pixi-art/themes/cathedral/'+p.src,p.anchor),covered=new Uint8Array(width*height);
  for(const tile of tiles){const [, ,x,y,w,h]=tile.src.split('rasterCrop=')[1].split(',').map(Number);
   for(let yy=Math.floor(y);yy<Math.min(height,Math.ceil(y+h));yy++)for(let xx=Math.floor(x);xx<Math.min(width,Math.ceil(x+w));xx++)covered[yy*width+xx]=1;
  }
  const data=await sharp(A+p.src).ensureAlpha().raw().toBuffer();
  for(let i=0;i<covered.length;i++)if(data[i*4+3]>16)assert.equal(covered[i],1,p.src+' raster crop contains visible pixel '+i%width+','+Math.floor(i/width));
 }
});

test('Larger four-colour SVG leaves read at phone zoom and retain >=1 texel per device pixel at 2x DPR',async()=>{
 const shapes=new Set();
 for(const src of art.autumn.leaves){
  const doc=document(src),svg=doc.documentElement,w=+svg.getAttribute('width'),h=+svg.getAttribute('height');
  shapes.add(doc.querySelector('path').getAttribute('d'));assert.deepEqual([w,h],[34,26]);
  const phone=await sharp(A+src).resize(Math.round(w*.72*.6),Math.round(h*.72*.6)).ensureAlpha().raw().toBuffer();
  assert.ok(Array.from(phone).filter((a,i)=>i%4===3&&a>200).length>=28,'readable silhouette at minimum scale and default zoom');
  for(const zoom of [.6,1.8])for(let i=0;i<3;i++)assert.ok(3.625/(autumnLeafPose({x:0,y:0,width:260,height:360},1,i).scale*zoom*2)>=1);
 }
 assert.equal(shapes.size,4);
});

test('The actual leaf renderer caps narrow phones and coarse pointers at 48 and honours live reduced motion',t=>{
 const original=globalThis.matchMedia;t.after(()=>{globalThis.matchMedia=original;});
 const props=Array.from({length:300},(_,i)=>({x:i*10,y:0,width:260,height:360,autumn:{kind:'tree'}}));
 for(const mode of ['narrow','coarse','desktop']){
  const reduced={matches:false};
  globalThis.matchMedia=q=>q.includes('reduced-motion')?reduced:{matches:q.includes('max-width')?mode==='narrow':mode==='coarse'};
  const leaves=createAutumnLeaves(props,[Texture.EMPTY],{maxSprites:1000,mobileMaxSprites:1000});
  const count=mode==='desktop'?96:48;assert.equal(leaves.stats.created,count);
  leaves.update(0,false,()=>true,{x:0,y:0,zoom:.6});assert.equal(leaves.stats.active,count);
  for(let i=1;i<600;i++)leaves.update(i/60,false,()=>true,{x:i,y:0,zoom:.6});
  assert.equal(leaves.stats.created,count);assert.equal(leaves.layer.children.length,count);
  reduced.matches=true;leaves.update(11,false,()=>true,{zoom:1});assert.equal(leaves.stats.active,0);
  reduced.matches=false;leaves.update(12,false,()=>true,{zoom:1});assert.equal(leaves.stats.active,count);
  leaves.update(13,true,()=>true,{zoom:1});assert.equal(leaves.stats.active,0);
  leaves.destroy();assert.ok(leaves.slots.every(s=>s.sprite.destroyed));assert.equal(leaves.layer.children.length,0);
  leaves.layer.destroy();
 }
});
