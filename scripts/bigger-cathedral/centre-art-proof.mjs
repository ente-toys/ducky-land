import fs from 'node:fs';
import {render} from './render.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix/';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/cathedral/art.json'));
for(const [name,opts]of [
 ['whole',{x:-2200,y:-2400,k:.12,width:1536,height:1248}],
 ['close',{x:2580,y:500,k:.5,width:1520,height:1540}],
 ['arches',{x:2700,y:1480,k:1,width:1200,height:1280}],
 ['cathedral',{x:3400,y:520,k:.9,width:1200,height:1300}],
])fs.writeFileSync(out+`centre-after-${name}.png`,await render(art,opts));
console.log('CENTRE proof rendered.');
