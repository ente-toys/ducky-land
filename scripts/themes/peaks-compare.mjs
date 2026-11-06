// Equal-scale SVG compositing evidence. This is not a browser capture.
import sharp from 'sharp';
import {readFileSync,mkdirSync} from 'node:fs';
import {render} from './peaks-render.mjs';
const OUT='../concepts/themes/work/peaks/',round=process.argv[2]||'round-2';mkdirSync(OUT,{recursive:true});
const read=p=>JSON.parse(readFileSync(p));
const peaks=read('public/pixi-art/themes/peaks/art.json'),home=read(OUT+'home-reference.json');
const views=[['overview',[2900,2200,.18],[4000,2900,.18]],['plaza',[2820,2370,.65],[4000,3100,.65]],['summit',[2920,1130,.65],[3150,1050,.65]],['activity',[2820,2370,.65],[5700,2850,.65]],['bench',[2537,2118,.65],[3530,2810,.65]],['junction',[3050,3080,.65],[4470,3420,.65]],['trees',[2120,3210,.65],[2870,3340,.65]]];
const panels=[],W=1600,H=1100;
for(let i=0;i<views.length;i++){
 const [name,h,p]=views[i];
 for(const[col,art,cam]of [[0,home,h],[1,peaks,p]]){
  const [x,y,k]=cam,buf=await render(art,{k,x:x-W/2/k,y:y-H/2/k,width:W,height:H,home:col===0});
  const file=`${OUT}/${col?'peaks':'home'}-${name}-${round}.png`;await sharp(buf).toFile(file);
  const title=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="46"><rect width="100%" height="100%" fill="#fff4d2"/><text x="18" y="30" font-size="23" font-family="sans-serif" fill="#39472D">${col?'MOSSNAP PEAKS':'HOME'} / ${name} / ${k} px per world unit / SVG render</text></svg>`);
  panels.push({i,col,buf,title});
 }
}
for(const [name,ids]of [['vs-home',[0]],['closeups-vs-home',[1,2,3,4,5,6]]]){
 const layers=[];for(let r=0;r<ids.length;r++)for(const col of [0,1]){const p=panels.find(p=>p.i===ids[r]&&p.col===col);layers.push({input:p.title,left:col*W,top:r*(H+46)},{input:p.buf,left:col*W,top:r*(H+46)+46})}
 const result=await sharp({create:{width:W*2,height:(H+46)*ids.length,channels:4,background:'#FFF4D2'}}).composite(layers).png().toBuffer();
 await sharp(result).toFile(`${OUT}/peaks-${name}-${round}.png`);await sharp(result).toFile(`${OUT}/peaks-${name}.png`);
}
console.log('Equal-scale SVG overview and six close-up pairs saved:',round);
