// Proof markers are composited here only, never written into game assets.
import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-check/scale';
const read=p=>JSON.parse(fs.readFileSync(p));
const art=read('public/pixi-art/themes/cathedral/art.json'),D='assets/world/themes/cathedral/';
const context={world:read(D+'world.json'),walk:read(D+'walk-world.json'),harbor:read(D+'harbor.json')};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'/after-centre.png',await render(art,{x:1150,y:450,k:.3,width:1750,height:1350,...context}));
const camera={x:2450,y:3450,k:.9,width:3000,height:1440};
const markers=[[3920,3700],[4130,3700]].map(([x,y],i)=>`<circle cx="${(x-camera.x)*camera.k}" cy="${(y-camera.y)*camera.k}" r="${65*camera.k}" fill="none" stroke="#a93865" stroke-width="3" stroke-dasharray="7 5"/><text x="${(x-camera.x)*camera.k}" y="${(y-camera.y)*camera.k+83}" text-anchor="middle" fill="#732943" font-family="sans-serif" font-size="17">130 units</text>`).join('');
const overlay=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="1440">${markers}</svg>`);
fs.writeFileSync(out+'/close-garden.png',await sharp(await render(art,{...camera,...context})).composite([{input:overlay}]).png().toBuffer());
console.log('Wrote after-centre.png and close-garden.png (two 130-unit proof-only circles).');
