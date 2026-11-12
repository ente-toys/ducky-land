import sharp from 'sharp';import fs from 'node:fs';
const A='../concepts/themes/work/community/';
const home=await sharp('../concepts/themes/home-bigger-before-island.png').metadata();
const community=await sharp(A+'overview.png').metadata();
const width=community.width,height=community.height,top=78;
const labels=Buffer.from(`<svg width="${width*2}" height="${top}"><rect width="100%" height="100%" fill="#FFF0C7"/><g fill="#39472D" font-family="Arial"><text x="28" y="34" font-size="26">HOME | supplied game screenshot</text><text x="${width+28}" y="34" font-size="26">COMMUNITY | actual asset manifest render | ${process.argv[2]||'latest'}</text><text x="28" y="62" font-size="18">Same overview scale: 0.25 pixels per world unit. HOME kept at its original 1600 x 1100 resolution.</text><text x="${width+28}" y="62" font-size="18">8000 x 5800 world. 40 sleepers. Browser verification blocked by macOS sandbox.</text></g></svg>`);
const output=A+'community-vs-home.png';
await sharp({create:{width:width*2,height:height+top,channels:4,background:'#6EC9DE'}}).composite([{input:'../concepts/themes/home-bigger-before-island.png',left:Math.round((width-home.width)/2),top:top+Math.round((height-home.height)/2)},{input:A+'overview.png',left:width,top},{input:labels,left:0,top:0}]).png().toFile(output);
if(process.argv[2]){fs.copyFileSync(output,A+'community-vs-home-'+process.argv[2]+'.png');fs.copyFileSync(A+'overview.png',A+'community-'+process.argv[2]+'.png')}
console.log(output,width*2,height+top);
