import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {DOMParser} from '@xmldom/xmldom';
import sharp from 'sharp';
import E from '../src/world/home/home-expansion.json' with {type:'json'};
import sizes from '../src/rendering/shared/art-source-sizes.json' with {type:'json'};
import {artResolution} from '../src/rendering/shared/art-resolution.js';

const root=new URL('../',import.meta.url);
const xml=new DOMParser();
const file=src=>fileURLToPath(new URL(src.startsWith('/assets/')?'.'+src:'public'+src,root));
const source=p=>readFileSync(file(p.src),'utf8');
const doc=p=>xml.parseFromString(source(p),'image/svg+xml');
const redrawn={
 'home-west-bridge':{a:[1137.84,3066.05],b:[940,3780],r:47.81310225627199,boards:28,posts:11,oldLength:Math.hypot(1137.84-940.19,3066.05-3417.43)},
 'river-crossing-7':{a:[4930,1530],b:[5450,1690],r:25.204205482466783,boards:16,posts:7,oldLength:Math.hypot(520,40)},
};

test('longer Home bridges add original-size planks and upright posts without stretching their source',()=>{
 for(const [id,spec] of Object.entries(redrawn)){
  const p=E.decks.find(p=>p.id===id),arch=E.homeArches.find(a=>a.id===id),svg=doc(p);
  assert.deepEqual(arch,{id,a:spec.a,b:spec.b,w:112,r:spec.r},`${id}: keep physical landings, width and crown`);
  assert.equal(svg.getElementsByTagName('image').length,0);
  for(const tag of ['linearGradient','radialGradient','filter'])assert.equal(svg.getElementsByTagName(tag).length,0);
  const elements=Array.from(svg.getElementsByTagName('*'));
  assert.equal(elements.some(n=>n.hasAttribute('transform')),false,'all timber is drawn directly in world coordinates');
  assert.equal(elements.filter(n=>n.hasAttribute('data-plank')).length,spec.boards-1);
  const posts=elements.filter(n=>n.hasAttribute('data-post'));
  assert.equal(posts.length,spec.posts*2);
  for(const post of posts){
   const n=post.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
   assert.equal(n.length,8);
   assert.ok(Math.abs(n[0]-n[6])<1e-6&&Math.abs(n[2]-n[4])<1e-6,'posts remain screen-upright');
   assert.ok(Math.abs(n[2]-n[0]-6)<2e-6,'six-unit post width');
   assert.ok(Math.abs(n[5]-n[3]-41)<2e-6,'41-unit post height');
  }
  const length=Math.hypot(arch.b[0]-arch.a[0],arch.b[1]-arch.a[1]);
  assert.ok(length/spec.boards<=spec.oldLength/15,'no elongated boards');
  assert.ok(length/(spec.posts-1)<=spec.oldLength/5,'no enlarged rail bays');
  assert.match(source(p),/stroke="#39472d" stroke-width="1.15"/,'approved flat dark ink');
 }
});

test('new bridge textures retain maximum 1.8x zoom at DPR 2 and their complete projected deck',async()=>{
 for(const id of Object.keys(redrawn)){
  const p=E.decks.find(d=>d.id===id),arch=E.homeArches.find(a=>a.id===id);
  const metadata=await sharp(file(p.src)).metadata();
  assert.deepEqual(sizes[p.src],[metadata.width,metadata.height],'resolution index matches the current source');
  const resolution=artResolution(p,p.resolution),scale=Math.max(p.width/metadata.width,p.height/metadata.height);
  assert.ok(resolution/scale>=1.8*2,`${id}: texel density at maximum zoom`);
  // Check the real raster, not a parallel polygon test, along both banks and
  // through the arch. Feet and a broad corridor must stay on opaque timber.
  const {data,info}=await sharp(file(p.src)).resize(Math.round(p.width*2),Math.round(p.height*2),{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const dx=arch.b[0]-arch.a[0],dy=arch.b[1]-arch.a[1],length=Math.hypot(dx,dy);
  for(let i=1;i<100;i++)for(const side of [-40,0,40]){
   const t=i/100,x=arch.a[0]+dx*t-dy/length*side,y=arch.a[1]+dy*t+dx/length*side-arch.r*4*t*(1-t);
   const u=Math.floor((x-p.x)/p.width*info.width),v=Math.floor((y-p.y)/p.height*info.height);
   assert.ok(u>=0&&u<info.width&&v>=0&&v<info.height,`${id}: deck inside viewport`);
   assert.ok(data[(v*info.width+u)*4+3]>240,`${id}: visible timber at ${x},${y}`);
  }
 }
});

