// Fixed pixel scale: Home reference is kept at native 1600x1100, never independently resized.
import sharp from 'sharp';
import {writeFileSync} from 'node:fs';
const A='../concepts/themes/work/goldmine/';
const home='../concepts/themes/home-bigger-before-island.png';
const mine=A+'goldmine-preview.png';
const hm=await sharp(home).metadata(),mm=await sharp(mine).metadata();
const pad=32,top=70,W=hm.width+mm.width+pad*3,H=Math.max(hm.height,mm.height)+top+pad;
const title=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff3cf"/><g font-family="Arial" font-size="25" fill="#39472D"><text x="32" y="44">HOME · supplied in-game reference</text><text x="${hm.width+64}" y="44">GOLDMINE · full art-manifest render, same world scale</text></g></svg>`);
await sharp(title).composite([{input:home,left:pad,top:top+Math.round((H-top-pad-hm.height)/2)},{input:mine,left:hm.width+pad*2,top}]).png().toFile(A+'goldmine-vs-home.png');
const round=process.argv[2];if(round)await sharp(A+'goldmine-vs-home.png').png().toFile(A+`goldmine-round-${round}-vs-home.png`);
writeFileSync(A+'goldmine-comparison-metrics.json',JSON.stringify({home:'concepts/themes/home-bigger-before-island.png',homePixels:[hm.width,hm.height],goldminePixels:[mm.width,mm.height],worldUnitsToPixels:mm.width/8000,homeResized:false,render:'Static assets, not an in-game screenshot'},null,2));
console.log('Saved whole-island side-by-side',W,H);
