import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
import {waterFrame} from '../../src/pixi/centre-motion/fair.js';
const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair/centre/';mkdirSync(OUT,{recursive:true});
const D='public/pixi-art/themes/fair/centre/',data=JSON.parse(readFileSync(D+'centre.json','utf8'));
const W=1500,H=1100,ox=750,oy=570;
const pieces=[...data.pieces].sort((a,b)=>((a.layer==='decal'?-2000:a.layer==='back'?-1000:a.sortY??0)-(b.layer==='decal'?-2000:b.layer==='back'?-1000:b.sortY??0)));
const comps=[];
for(const p of pieces){const buf=await sharp(D+p.file).resize(Math.round(p.width),Math.round(p.height)).png().toBuffer();comps.push({input:buf,left:Math.round(ox+p.x),top:Math.round(oy+p.y)});}
await sharp({create:{width:W,height:H,channels:4,background:'#94C557'}}).composite(comps).png().toFile(OUT+'fair-centre-preview.png');
// Filmstrip uses the same coordinates and time function as the Pixi component.
const frames=[];
for(const [i,t]of [0,.24,.48].entries()){
 const f=waterFrame(t);const marks=f.flecks.map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="2.1" ry="4" fill="#FFF8D8"/>`).join('')+f.rings.map(q=>`<ellipse cx="-263" cy="-70" rx="${8+q*35}" ry="${3+q*10}" fill="none" stroke="#FFF8D8" stroke-width="2.4" opacity="${1-q}"/>`).join('');
 const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="translate(${ox} ${oy})">${marks}</g></svg>`);
 const full=await sharp(OUT+'fair-centre-preview.png').composite([{input:overlay,left:0,top:0}]).png().toBuffer();const frame=await sharp(full).resize(750,550).png().toBuffer();frames.push({input:frame,left:i*750,top:0});
}
await sharp({create:{width:2250,height:550,channels:4,background:'#94C557'}}).composite(frames).png().toFile(OUT+'fair-water-frames.png');
