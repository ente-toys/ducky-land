import fs from 'node:fs';
import {render} from './render-core.mjs';
const out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-check/flowerlay';
fs.mkdirSync(out,{recursive:true});
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/fair/art.json'));
for(const [name,view]of Object.entries({centre:{x:0,y:0,k:.25,width:1875,height:1250},'tulip-closeup':{x:1400,y:600,k:1,width:1450,height:1050},'sunflower-closeup':{x:650,y:1600,k:1,width:1550,height:1200}})){
 fs.writeFileSync(`${out}/${name}.png`,await render(art,view));console.log(name);
}
