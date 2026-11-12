import {render} from './neon-render.mjs';
import sharp from 'sharp';import fs from 'node:fs';
const A='public/pixi-art/themes/neon/',O='../concepts/themes/work/neon/';
const neon=JSON.parse(fs.readFileSync(A+'art.json')),home=JSON.parse(fs.readFileSync(A+'neon-home-reference.json'));
const shots=[['Plaza',[2820,2290],[3844,2110]],['Bench ring',[3230,2300],[4130,2660]],['Path junction',[2920,1710],[3844,3390]],['Tree cluster',[2220,2050],[1600,2850]],['Activity rim',[2820,2290],[2436.4,2944.8]],['Market row',[2920,1710],[1500,2130]]];
const w=900,h=650,k=+(process.env.ZOOM||.6),lh=40,comps=[];
for(const [i,[title,hp,np]]of shots.entries())for(const [j,art,pt,name]of [[0,home,hp,'HOME'],[1,neon,np,'NEON']]){
 const buf=await render(art,{k,width:w,height:h,x:pt[0]-w/2/k,y:pt[1]-h/2/k,home:j===0,sleepers:j===1});
 const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${lh}"><rect width="100%" height="100%" fill="#FFF0C7"/><text x="18" y="27" font-family="Arial" font-size="20">${name} | ${title} | ${k} px/unit | offline asset assembly</text></svg>`);
 comps.push({input:label,left:j*w,top:i*(h+lh)},{input:buf,left:j*w,top:i*(h+lh)+lh});
 await sharp(buf).png().toFile(O+name.toLowerCase()+'-detail-'+i+'.png');
}
await sharp({create:{width:w*2,height:shots.length*(h+lh),channels:4,background:'#FFF0C7'}}).composite(comps).png().toFile(O+'neon-closeups-vs-home.png');
if(process.env.ROUND)fs.copyFileSync(O+'neon-closeups-vs-home.png',O+'close-round-'+process.env.ROUND+'-vs-home.png');
console.log(O+'neon-closeups-vs-home.png');
