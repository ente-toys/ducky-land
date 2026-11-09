import fs from 'node:fs';
import {render} from './render-core.mjs';
const out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-check/simplify';
fs.mkdirSync(out,{recursive:true});
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/fair/art.json'));
for(const [name,view]of Object.entries({centre:{x:0,y:0,k:.25,width:1875,height:1250},island:{x:-2800,y:-2000,k:.18,width:2400,height:1800}})){
 fs.writeFileSync(`${out}/${name}.png`,await render(art,view));console.log(name);
}
