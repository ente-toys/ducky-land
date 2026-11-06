// Same-scale SVG asset comparisons. These are not browser screenshots.
import sharp from 'sharp';import fs from 'node:fs';
const R='../concepts/themes/work/community/',round=process.argv[2]||'final',K=.65,W=1100,H=850;
const files=[R+'community-home-reference.png',R+'community-detail-full.png'];
const views=[['Plaza',[2820,2370],[4000,2640]],['Curved bench ring',[2820,2630],[4495,2980]],['Path junction',[3050,3080],[4890,3600]],['Tree cluster',[2120,3210],[5480,2080]]];
const layers=[];
for(const [row,[label,h,c]]of views.entries())for(const col of [0,1]){
 const point=col?c:h,m=await sharp(files[col]).metadata(),left=Math.max(0,Math.min(m.width-W,Math.round(point[0]*K-W/2))),top=Math.max(0,Math.min(m.height-H,Math.round(point[1]*K-H/2)));
 const input=await sharp(files[col]).extract({left,top,width:W,height:H}).png().toBuffer();
 await sharp(input).toFile(R+`community-${round}-${row}-${col?'theme':'home'}.png`);
 layers.push({input,left:col*W,top:row*(H+48)+48});
 layers.push({input:Buffer.from(`<svg width="${W}" height="48"><rect width="100%" height="100%" fill="#FFF0C7"/><text x="20" y="32" font-size="21" font-family="Arial" fill="#39472D">${col?'COMMUNITY':'HOME'} / ${label} / SVG asset render at 0.65 px per unit</text></svg>`),left:col*W,top:row*(H+48)});
}
const buf=await sharp({create:{width:W*2,height:4*(H+48)+48,channels:4,background:'#FFF0C7'}}).composite([...layers,{input:Buffer.from('<svg width="2200" height="48"><text x="20" y="32" font-family="Arial" font-size="21" fill="#39472D">Static art evidence. Chromium launch blocked by macOS sandbox; motion, live sorting and performance need browser review.</text></svg>'),left:0,top:4*(H+48)}]).png().toBuffer();
fs.writeFileSync(R+'community-closeups-vs-home.png',buf);fs.writeFileSync(R+`community-closeups-vs-home-${round}.png`,buf);console.log('Saved same-scale closeups',round);
