import fs from 'node:fs';
import sharp from 'sharp';
const out=process.env.HOME_REVIEW_OUT||'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review/sleepers';
const files=fs.readdirSync(out+'/close').filter(f=>f.startsWith('sleeper-')).sort();
for(let sheet=0;sheet<2;sheet++){
 const layers=[];
 for(let i=0;i<20;i++){
  const f=files[sheet*20+i];if(!f)throw Error('missing sleeper render');
  const left=(i%5)*460,top=Math.floor(i/5)*400;
  layers.push({input:await sharp(out+'/close/'+f).png().toBuffer(),left,top});
  layers.push({input:Buffer.from(`<svg width="460" height="30"><text x="12" y="21" font-family="sans-serif" font-size="17" fill="#39472d">${f.replace('.png','')}</text></svg>`),left,top:top+370});
 }
 await sharp({create:{width:2300,height:1600,channels:4,background:'#e9e5c7'}}).composite(layers).png().toFile(out+`/sleepers-sheet-${sheet+1}.png`);
}
