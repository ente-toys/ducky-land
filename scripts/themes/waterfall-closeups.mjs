import sharp from 'sharp';
import {copyFileSync} from 'node:fs';
const A='../concepts/themes/work/waterfall/',K=+(process.env.K||.65);
const home=A+'waterfall-home-detail-source.png',fall=A+'waterfall-detail-source.png';
const rows=[
 ['Plaza',[2820,2370],[3900,3800]],
 ['Curved bench ring',[2810,2705],[3900,3450]],
 ['Path junction',[3290,2100],[5350,4000]],
 ['Tree cluster',[2110,1840],[2710,3020]],
 ['Activity rim',[3300,2470],[1900,2240]],
 ['Market lane',[2330,2080],[1800,3490]],
];
const PW=780,PH=560,HEADER=44,items=[];
for(let i=0;i<rows.length;i++){
 const [label,h,f]=rows[i];
 for(const [col,file,xy]of [[0,home,h],[1,fall,f]]){
  const left=Math.max(0,Math.round(xy[0]*K-PW/2)),top=Math.max(0,Math.round(xy[1]*K-PH/2));
  items.push({input:await sharp(file).extract({left,top,width:PW,height:PH}).png().toBuffer(),left:col*PW,top:i*(PH+HEADER)+HEADER});
  const title=Buffer.from(`<svg width="${PW}" height="${HEADER}"><rect width="100%" height="100%" fill="#FFF0C7"/><text x="20" y="29" fill="#39472D" font-size="18" font-family="sans-serif">${col?'WATERFALL':'HOME'} / ${label} / ${K} px per unit / SVG render</text></svg>`);
  items.push({input:title,left:col*PW,top:i*(PH+HEADER)});
 }
}
const file=A+'waterfall-closeups-vs-home.png';
await sharp({create:{width:PW*2,height:(PH+HEADER)*rows.length,channels:4,background:'#6EC9DE'}}).composite(items).png().toFile(file);
if(process.env.ROUND)copyFileSync(file,A+`waterfall-closeups-round-${process.env.ROUND}-vs-home.png`);
console.log(file,'static SVG comparison, matched scale');
