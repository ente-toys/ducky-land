import fs from 'node:fs';import sharp from 'sharp';import assert from 'node:assert/strict';import {render}from './render.mjs';
const OUT='../concepts/themes/world-map/bigger',A='public/pixi-art/themes/waterfall/';
fs.copyFileSync(OUT+'/waterfall-built.png',OUT+'/waterfall-fixed.png');
for(const [from,to]of [['mistmill-bridge','bridge'],['junction','junction'],['fern','community'],['lane','lane']])fs.copyFileSync(OUT+'/waterfall-crops/'+from+'.png',OUT+'/waterfall-fixed-'+to+'.png');
await render(OUT+'/waterfall-fix-proof/pond-common.png',{x:6830,y:980,k:.8,w:1440,h:1120});
await render(OUT+'/waterfall-fix-proof/orchard-common.png',{x:-140,y:830,k:.8,w:1440,h:1120});
// The three heart bridges are flat art records, with eighteen separate front rail props.
// Verify the actual illustrated water below their painted pixels, rather than a bounding-box centre.
const art=JSON.parse(fs.readFileSync(A+'art.json')),old=JSON.parse(fs.readFileSync('scripts/bigger-waterfall/original/art.json'));
const W=900,H=700,ox=3100,oy=3100,k=.5;
async function mask(p){const w=Math.round(p.width*k),h=Math.round(p.height*k),x=Math.round((p.x-ox)*k),y=Math.round((p.y-oy)*k);const b=await sharp(A+p.src).resize(w,h,{fit:'fill'}).png().toBuffer();return sharp({create:{width:W,height:H,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:b,left:x,top:y}]).ensureAlpha().raw().toBuffer();}
const water=await mask(art.flats.find(p=>p.src==='centre/decal-water.svg')),checks=[];
for(const src of ['centre/bridge-west.svg','centre/bridge-east.svg','centre/bridge-south.svg']){
 const p=art.flats.find(p=>p.src===src),b=await mask(p);let overlaps=0;for(let i=3;i<b.length;i+=4)if(b[i]>128&&water[i]>128)overlaps++;
 assert.ok(overlaps>100,'painted water beneath '+src);assert.deepEqual(p,old.flats.find(p=>p.src===src));checks.push({src,waterOverlapPixels:overlaps,scale:k,originalRecordUnchanged:true});
}
const rails=art.props.filter(p=>/centre\/bridge-rail-/.test(p.src));assert.equal(rails.length,18);for(const p of rails)assert.deepEqual(p,old.props.find(o=>o.id===p.id));
fs.writeFileSync(OUT+'/waterfall-fix-proof/centre-bridge-audit.json',JSON.stringify({checks,unchangedRails:rails.map(p=>p.src)},null,2));
console.log('Saved waterfall-fixed.png, four required 0.8 crops, two commons crops, and the three illustrated heart-bridge checks.');
