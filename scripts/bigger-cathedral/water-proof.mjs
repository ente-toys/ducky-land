import fs from 'node:fs';
import {render} from './render.mjs';
const out=process.argv[2]??'/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-check/water';
fs.mkdirSync(out,{recursive:true});
for(const [label,file] of [['before','scripts/bigger-cathedral/water-source/art.json'],['after','public/pixi-art/themes/cathedral/art.json']]){
 const art=JSON.parse(fs.readFileSync(file));
 for(const [name,x,y,k,width,height] of [['overview',-2200,-2400,.12,1536,1248],['north',1350,-650,.65,1300,1100],['port',3900,6650,.7,1100,1000],['west',0,2700,.75,1500,1000]]){
  fs.writeFileSync(`${out}/${label}-${name}.png`,await render(art,{x,y,k,width,height}));
 }
}
console.log('Saved four before/after proof pairs in '+out);
