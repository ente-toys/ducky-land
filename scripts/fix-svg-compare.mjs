// Compare approved raster exports with the SVG layers at their actual world size.
// Originals and review images stay outside public/.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import data from '../src/pixi/sleep-poses.json' with {type:'json'};
const archive = process.argv[2] ?? '/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/raster-originals';
const out = path.join(archive, 'fix-svg-review');
await fs.mkdir(out, {recursive:true});
const pieces=[], metrics=[];
const text = (s,w=240,h=30) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="10" y="22" font-family="Arial" font-size="15" fill="#232323">${s}</text></svg>`);
let i=0;
for(const [name,p] of Object.entries(data.poses)) {
 const scale=.88*.24*.81*p.k, w=Math.round(p.W*data.F), h=Math.round(p.H*data.F), worlds=scale/data.F;
 const oldLayers=[],newLayers=[];
 for(const l of p.layers){oldLayers.push({input:path.join(archive,'public',l.src.replace(/\.svg$/,'.png')),left:0,top:0});newLayers.push({input:await sharp('public'+l.src).png().toBuffer(),left:0,top:0});}
 const base={create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}};
 const originals=await sharp(base).composite(oldLayers).png().toBuffer(), vectors=await sharp(base).composite(newLayers).png().toBuffer();
 const dw=Math.round(w*worlds),dh=Math.round(h*worlds);
 const old=await sharp(originals).resize(dw,dh).png().toBuffer(), svg=await sharp(vectors).resize(dw,dh).png().toBuffer();
 const r=await sharp(old).flatten({background:'#a5d568'}).raw().toBuffer(),s=await sharp(svg).flatten({background:'#a5d568'}).raw().toBuffer();
 metrics.push({pose:name,width:dw,height:dh,meanChannelDifference:r.reduce((n,v,k)=>n+Math.abs(v-s[k]),0)/r.length});
 const row=Math.floor(i/2), col=i%2;
 for(const [kind,buf] of [['PNG',old],['SVG',svg]]){const x=col*500+(kind==='SVG'?250:0),y=row*215;pieces.push({input:text(`${name}: ${kind}`),left:x,top:y},{input:buf,left:x+Math.round((250-dw)/2),top:y+202-dh});}
 i++;
}
const zOld=await sharp(path.join(archive,'public/pixi-duck/sleep/z.png')).resize({height:18}).png().toBuffer(),zNew=await sharp('public/pixi-duck/sleep/z.svg').resize({height:18}).png().toBuffer();
pieces.push({input:text('Floating Z: PNG / SVG',450),left:20,top:875},{input:zOld,left:230,top:880},{input:zNew,left:280,top:880});
for(const [kind,f,x] of [['PNG',path.join(archive,'public/ente-wordmark-white.png'),40],['SVG','public/ente-wordmark-white.svg',300]]){const logo=await sharp(f).resize({width:76}).png().toBuffer();pieces.push({input:text(`Ente: ${kind}`),left:x,top:925},{input:logo,left:x+90,top:930});}
await sharp({create:{width:1000,height:985,channels:4,background:'#a5d568'}}).composite(pieces).png().toFile(path.join(out,'sleep-and-logo-side-by-side.png'));
await fs.writeFile(path.join(out,'comparison-metrics.json'),JSON.stringify(metrics,null,2)+'\n');
console.log(out);console.log(metrics);
