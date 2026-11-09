import sharp from 'sharp';import fs from 'node:fs';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/home-review',V=JSON.parse(fs.readFileSync(O+'/views.json'));
const W=2400,row=840,layers=[];
for(let i=0;i<V.length;i++){
 const v=V[i],label=v.file.replace('close/','').replace('.png','');
 for(let side=0;side<2;side++){
  const file=O+(side?'/fix/':'/')+v.file,buf=await sharp(file).resize(1180,780,{fit:'contain',background:'#6ec9de'}).png().toBuffer();layers.push({input:buf,left:side*1200+10,top:i*row+50});
  layers.push({input:Buffer.from(`<svg width="1180" height="40"><rect width="1180" height="40" fill="#fff0c7"/><text x="15" y="27" font-family="Arial" font-size="21" fill="#39472d">${side?'AFTER':'BEFORE'} | ${label}</text></svg>`),left:side*1200+10,top:i*row+5});
 }
}
await sharp({create:{width:W,height:V.length*row,channels:4,background:'#fff0c7'}}).composite(layers).png().toFile(O+'/fix/compare.png');console.log('compare.png',W,V.length*row,'eleven paired views');
