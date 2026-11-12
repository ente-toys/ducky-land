import {render} from './cathedral-render.mjs';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
const ROOT='public/pixi-art/themes/cathedral/',OUT='../concepts/themes/work/cathedral/';
const cat=JSON.parse(readFileSync(ROOT+'art.json')),home=JSON.parse(readFileSync(ROOT+'cathedral-home-reference.json'));
const W=1100,H=800,k=.65,round=process.env.ROUND||'ten-1';
const rows=[['Plaza',[2820,2370],[4100,2680]],['Curved bench ring',[2820,2630],[4100,3010]],['Path junction',[3780,2720],[5500,2750]],['Tree cluster',[2200,1560],[2500,1180]],['Activity court',[2820,2370],[2240,2200]],['Stall court',[2820,2370],[4860,3900]],['Cathedral forecourt',[2820,2370],[4100,1670]]];
let comps=[];
for(const [i,[name,h,c]]of rows.entries()){
 for(const [j,[art,pos]]of [[home,h],[cat,c]].entries()){
  const buf=await render(art,{k,x:pos[0]-W/(k*2),y:pos[1]-H/(k*2),width:W,height:H,home:j===0,sleepers:j===1});
  await sharp(buf).toFile(OUT+`cathedral-${round}-${i}-${j?'theme':'home'}.png`);
  comps.push({input:buf,left:j*W,top:i*(H+42)+42});
  const label=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="42"><rect width="100%" height="100%" fill="#FFF6E1"/><text x="22" y="28" font-family="Arial" font-size="20" fill="#39472D">${j?'CATHEDRAL':'HOME'} / ${name} / asset render at 0.65</text></svg>`);
  comps.push({input:label,left:j*W,top:i*(H+42)});
 }
}
const buf=await sharp({create:{width:W*2,height:(H+42)*rows.length,channels:4,background:'#FFF6E1'}}).composite(comps).png().toBuffer();
await sharp(buf).toFile(OUT+'cathedral-closeups-vs-home.png');await sharp(buf).toFile(OUT+`cathedral-closeups-vs-home-${round}.png`);
console.log('Saved four matching 0.65 close-up pairs');
