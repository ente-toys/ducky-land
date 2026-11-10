import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix';
const phase=process.argv[2]??'after';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/cathedral/art.json'));
fs.mkdirSync(out,{recursive:true});
await sharp(await render(art,{x:-2200,y:-2400,k:.12,width:1536,height:1248})).toFile(`${out}/buildings-${phase}-whole.png`);
for(const [id,x,y]of [['bellpeep',3800,-690],['olivello',-300,2390],['tessera',8400,2470],['crumbbell',4220,6580]])await sharp(await render(art,{x:x-840,y:y-640,k:.85,width:1428,height:1088})).toFile(`${out}/buildings-${phase}-${id}.png`);
if(phase==='before'){
 const refs=['public/pixi-art/home-hamlets/butterbill/house-honeyroof.svg','public/pixi-art/themes/sunflower/hamlets/seedwake/porch-cottage-red-roof.svg','public/pixi-art/themes/pink/expansion/house-01.svg','public/pixi-art/themes/neon/bigger/book-house-0.svg'];
 const layers=[];for(const [i,f]of refs.entries())layers.push({input:await sharp(f).resize(350,380,{fit:'contain',background:'#aacb65'}).png().toBuffer(),left:i*370+10,top:20});
 await sharp({create:{width:1490,height:420,channels:4,background:'#aacb65'}}).composite(layers).png().toFile(out+'/buildings-approved-references.png');
}
console.log(`Building ${phase} whole and village proofs saved to ${out}`);
