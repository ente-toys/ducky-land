import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render-core.mjs';
import {A,config,mapper,read} from './hamlets.mjs';
const out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-check/homes';
const gpt='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-check/gpt/';
fs.mkdirSync(out,{recursive:true});
const art=read(A+'art.json');
for(const h of Object.keys(config)){
 const W=mapper(h),[x,y]=W([-160,-180]),[x1,y1]=W([1696,1100]),k=.5,width=Math.round((x1-x)*k),height=Math.round((y1-y)*k);
 const game=await render(art,{x,y,k,width,height});await sharp(game).toFile(`${out}/${h}-game.png`);
 const bp=await sharp(gpt+(h==='waddleshow'?'waddleshow-final':h)+'.png').resize(width,height,{fit:'contain',background:'#ffffff'}).png().toBuffer();
 await sharp({create:{width:width*2+24,height,channels:3,background:'#ffffff'}}).composite([{input:bp,left:0,top:0},{input:game,left:width+24,top:0}]).png().toFile(`${out}/${h}-vs-blueprint.png`);
}
await sharp(await render(art,{x:-2500,y:-1800,k:.14,width:1680,height:1148})).toFile(out+'/island.png');
