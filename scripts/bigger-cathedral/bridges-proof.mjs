import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix/bridges',label=process.argv[2]??'after';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/cathedral/art.json'));
fs.mkdirSync(out,{recursive:true});
const views=[['whole',-2200,-2400,.12,1536,1248],['mouth-nw',450,-1300,.85,1280,960],['mouth-se',5850,5870,.85,1280,960],['bridge-nw',850,1570,1,1100,800],['bridge-pond',1400,2700,1,850,1100],['bridge-se',5650,4060,1,1300,1100]];
for(const [name,x,y,k,width,height]of views)fs.writeFileSync(`${out}/${label}-${name}.png`,await render(art,{x,y,k,width,height}));
const geo=JSON.parse(fs.readFileSync('scripts/bigger-cathedral/water-geometry.json'));
const images=[];
for(const [i,b]of geo.bridges.entries()){
 const cx=(b.a[0]+b.b[0])/2,cy=(b.a[1]+b.b[1])/2;
 const input=await render(art,{x:cx-470,y:cy-440,k:.7,width:658,height:616});
 images.push({input,left:(i%4)*658,top:Math.floor(i/4)*650});
 const title=Buffer.from(`<svg width="658" height="34"><rect width="658" height="34" fill="#fff0c7"/><text x="12" y="24" font-family="sans-serif" font-size="20" fill="#39472d">${b.id}</text></svg>`);
 images.push({input:title,left:(i%4)*658,top:Math.floor(i/4)*650+616});
}
await sharp({create:{width:2632,height:2600,channels:4,background:art.sea}}).composite(images).png().toFile(`${out}/${label}-all-13.png`);
console.log('Bridge and coast renders: '+label);
