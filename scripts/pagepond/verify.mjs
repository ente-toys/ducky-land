// Pixel proof of locked interior ground, with original source hashes and collision checks in qa/pagepond-ground.test.mjs.
import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
import {Path2D,PathOp,ring,stroke} from './geometry.mjs';
const out=process.env.PAGEPOND_RENDER_OUT??'../concepts/themes/work/pagepond-check/ground';
const read=p=>JSON.parse(fs.readFileSync(p)),A='public/pixi-art/themes/library/',B='scripts/bigger-library/original/';
const art=read(A+'art.json'),old=read(B+'art.json'),world=read(B+'world.json'),raw=fs.readFileSync(B+'ground.svg','utf8').replace(/<rect[^>]*fill="url\(#sea-ripples\)"[^>]*\/>/g,'').replace(/<path\b[^>]*fill="#8FD6E6"[^>]*\/>/g,'');
const empty={...art,props:[],flats:[],decks:[],floating:[]};
const baseline={...empty,ground:old.ground};
await render(baseline,[0,0,8000,5600],.25,out+'/centre-ground-before.png',{sleepers:false,resolveSource:src=>{
 const t=old.ground.tiles.find(t=>t.src===src);if(!t)throw Error(src);
 return Buffer.from(raw.replace(/<svg\b[^>]*>/,`<svg xmlns="http://www.w3.org/2000/svg" width="${t.width}" height="${t.height}" viewBox="${t.x} ${t.y} ${t.width} ${t.height}" stroke-linecap="round" stroke-linejoin="round">`));
}});
await render(empty,[0,0,8000,5600],.25,out+'/centre-ground-after.png',{sleepers:false});
const d=world.coastRings.map(ring).join(''),inside=new Path2D(d).op(stroke(d,96),PathOp.Difference);
const mask=await sharp(Buffer.from(`<svg width="2000" height="1400" viewBox="0 0 8000 5600"><path d="${inside.toSVGString()}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
const before=await sharp(out+'/centre-ground-before.png').ensureAlpha().raw().toBuffer(),after=await sharp(out+'/centre-ground-after.png').ensureAlpha().raw().toBuffer();
let compared=0,changed=0,maxDelta=0;
for(let i=0;i<before.length;i+=4){if(mask[i+3]<254)continue;compared++;let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(before[i+c]-after[i+c]));maxDelta=Math.max(maxDelta,delta);if(delta>1)changed++;}
const report={comparedInteriorPixels:compared,changedInteriorPixels:changed,maxChannelDelta:maxDelta,coastInset:48,centreProps:old.props.length,centreFlats:old.flats.length,centreDecks:old.decks.length,sleepers:40};
fs.writeFileSync(out+'/centre-lock.json',JSON.stringify(report,null,2)+'\n');console.log(report);
if(changed)throw Error('Locked centre interior ground changed');
