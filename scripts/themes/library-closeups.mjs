// Equal-scale asset evidence when sandbox denies Chromium. Never labelled as live screenshots.
import sharp from 'sharp';
const R='../concepts/themes/work/library/',round=process.argv[2]||'final',K=.65,W=1400,H=800;
const home=R+'library-home-reference.png',lib=R+'library-detail-full.png';
const views=[['Globe plaza',[2820,2370],[2412,2566]],['Bookstore plaza',[2820,2370],[5868,1760]],['Reading court',[2820,2370],[6108,3658]],['Curved bench ring',[2537,2118],[5700,3300]],['Path junction',[3050,3080],[5148,3658]],['Tree cluster',[2120,3210],[2890,4160]]];
const composite=[];
for(let row=0;row<views.length;row++){
 const [label,h,l]=views[row];
 for(const [col,file,point] of [[0,home,h],[1,lib,l]]){
  const m=await sharp(file).metadata(),left=Math.max(0,Math.min(m.width-W,Math.round(point[0]*K-W/2))),top=Math.max(0,Math.min(m.height-H,Math.round(point[1]*K-H/2)));
  const input=await sharp(file).extract({left,top,width:W,height:H}).png().toBuffer();
  await sharp(input).toFile(R+`library-close-${round}-${col?'library':'home'}-${row}.png`);
  composite.push({input,left:col*W,top:row*(H+58)+58});
  const title=`${col?'PAGEPOND':'HOME'} / ${label} / 0.65 px per unit`;
  composite.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="58"><rect width="100%" height="100%" fill="#fff5d5"/><text x="22" y="37" font-family="sans-serif" font-size="23" fill="#39472d">${title}</text></svg>`),left:col*W,top:row*(H+58)});
 }
}
const output=await sharp({create:{width:W*2,height:(H+58)*views.length+44,channels:4,background:'#fff5d5'}}).composite([...composite,{input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W*2}" height="44"><text x="22" y="30" font-size="20" font-family="sans-serif" fill="#39472d">Static SVG asset renders at game scale. Browser launch blocked. No live motion or performance verdict.</text></svg>`),left:0,top:(H+58)*views.length}]).png().toBuffer();
await sharp(output).toFile(R+'library-closeups-vs-home.png');
await sharp(output).toFile(R+`library-closeups-vs-home-${round}.png`);
console.log('closeups saved',round);
