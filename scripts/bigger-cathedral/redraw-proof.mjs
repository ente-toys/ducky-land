import fs from 'node:fs';
import {render} from './render.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-check/redraw';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/cathedral/art.json'));
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'/after-centre.png',await render(art,{x:1150,y:450,k:.3,width:1750,height:1350}));
for(const [name,cx,cy,width,height] of [
 ['fountain-parterres',4080,4130,1500,1250],
 ['rose-arbour',2290,3230,1000,1000],
 ['west-pond-bridge',1770,3280,800,1150],
])fs.writeFileSync(out+'/close-'+name+'.png',await render(art,{x:cx-width/1.8,y:cy-height/1.8,k:.9,width,height}));
console.log('Rendered centre and three close-ups.');
