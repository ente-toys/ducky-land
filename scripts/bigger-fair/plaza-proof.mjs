import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render-core.mjs';
const out='../concepts/themes/work/fair-check/plaza';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/fair/art.json'));
fs.mkdirSync(out,{recursive:true});
const view={x:2700,y:2780,k:.7,width:1250,height:1000};
const png=await render(art,view);
// A 130-world-unit marker beside the kiosk. It is proof-only, never game art.
const x=(3870-view.x)*view.k,y=(3390-view.y)*view.k,h=130*view.k;
const marker=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1250" height="1000"><g transform="translate(${x} ${y})" stroke="#39472d" stroke-width="2" fill="#FFD95B"><ellipse cx="0" cy="-28" rx="23" ry="27"/><circle cx="-6" cy="-65" r="24"/><path d="M-24 -66l-17 7 19 7" fill="#E9A14D"/><circle cx="-13" cy="-71" r="2.3" fill="#39472d"/><path d="M27 0h12M33 0v-${h}M27 -${h}h12" fill="none"/></g><text x="${x+45}" y="${y-40}" font-family="sans-serif" font-size="16" fill="#39472d">130 units</text></svg>`);
fs.writeFileSync(out+'/plaza.png',await sharp(png).composite([{input:marker}]).png().toBuffer());
fs.writeFileSync(out+'/centre.png',await render(art,{x:0,y:0,k:.25,width:1875,height:1250}));
