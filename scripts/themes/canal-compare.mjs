import sharp from 'sharp';
import {copyFileSync,writeFileSync} from 'node:fs';
const root='../concepts/themes/work/canal/', round=process.env.ROUND||'1';
const home='../concepts/themes/home-bigger-before-island.png';
const labels=Buffer.from(`<svg width="4000" height="72"><rect width="4000" height="72" fill="#FFF2CE"/><g font-family="Arial" fill="#39472D"><text x="28" y="31" font-size="24">HOME, original whole-island reference</text><text x="2028" y="31" font-size="24">CANAL, round ${round}, actual SVG assets</text><text x="28" y="57" font-size="17">Both panels: 0.25 pixels per world unit. Home screenshot padded, never resized.</text><text x="2028" y="57" font-size="17">8000 × 6000 world, 40 sleepers. Static render; browser verification pending.</text></g></svg>`);
await sharp({create:{width:4000,height:1572,channels:4,background:'#6EC9DE'}}).composite([{input:await sharp(home).png().toBuffer(),left:200,top:272},{input:root+'canal-preview.png',left:2000,top:72},{input:labels,left:0,top:0}]).png().toFile(root+'canal-vs-home.png');
copyFileSync(root+'canal-vs-home.png',root+`canal-vs-home-round-${round}.png`);
writeFileSync('public/pixi-art/themes/canal/comparison-camera.json',JSON.stringify({zoom:.25,homeCamera:[2900,2100,.25],homeOriginalPixels:[1600,1100],canalPixels:[2000,1500],homeResized:false,round},null,2));
