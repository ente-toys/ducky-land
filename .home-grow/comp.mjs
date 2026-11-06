import sharp from 'sharp';import {readFileSync} from 'node:fs';
const root='/Users/pragadees.xd/Downloads/Ducky Land/aswin-ducky-land/';
const S=+process.argv[2]||.2, out=process.argv[3];
const art=JSON.parse(readFileSync(root+'src/pixi/art-manifest.json'));
const comps=[];
for(const t of art.ground.tiles) comps.push({input:await sharp(root+'public'+t.src,{density:72*S}).resize(Math.round(t.width*S),Math.round(t.height*S)).png().toBuffer(),left:Math.round(t.x*S),top:Math.round(t.y*S)});
await sharp({create:{width:5800*S|0,height:4400*S|0,channels:4,background:{r:70,g:150,b:200,alpha:1}}}).composite(comps).png().toFile(out);
