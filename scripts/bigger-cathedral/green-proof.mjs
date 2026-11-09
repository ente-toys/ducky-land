import fs from 'node:fs';
import {render} from './render.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-check/green';
const label=process.argv[2]??'after';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/cathedral/art.json'));
fs.mkdirSync(out,{recursive:true});
for(const [name,opts] of [
 ['overview',{x:-2200,y:-2000,k:.14,width:1680,height:1330}],
 ['centre',{x:1750,y:600,k:.3,width:1680,height:1330}],
 ['northwest',{x:-1300,y:-700,k:.4,width:1680,height:1200}],
 ['south',{x:1700,y:4350,k:.4,width:1680,height:1200}],
 ['east',{x:6300,y:1000,k:.4,width:1440,height:1200}],
]) {fs.writeFileSync(`${out}/${label}-${name}.png`,await render(art,opts));console.log(`${label}-${name}.png`);}
