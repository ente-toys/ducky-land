import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render-core.mjs';
import {read,write} from './design.mjs';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger/';
const C=O+'fair-ground-crops/';fs.mkdirSync(C,{recursive:true});
const art=read('public/pixi-art/themes/fair/art.json');
const built=await render(art,{k:.13,x:-2500,y:-1800,width:1560,height:1066});
fs.writeFileSync(O+'fair-built.png',built);
await sharp({create:{width:3120,height:1066,channels:4,background:'#82CFD1'}}).composite([{input:O+'fair-communities.png',left:0,top:0},{input:built,left:1560,top:0}]).png().toFile(O+'fair-vs-communities.png');
for(const [name,x,y]of [['bobbinbell',-800,1100],['cloudpop',3950,-200],['waddleshow',8000,3320],['sugarspoon',2600,5200],['road-junction',-1200,2550],['community-lane',2750,-200],['open-common',6000,4500]]){
 const png=await render(art,{k:.8,x:x-1000,y:y-850,width:1600,height:1200});fs.writeFileSync(C+name+'.png',png);
}
const ref='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/cursor-camp-paths-ref.jpg';
const refImage=await sharp(ref).resize(1600,1200).png().toBuffer();
for(const name of ['road-junction','community-lane'])await sharp({create:{width:3200,height:1200,channels:4,background:'#FFF0AE'}}).composite([{input:refImage,left:0,top:0},{input:C+name+'.png',left:1600,top:0}]).png().toFile(C+name+'-vs-reference.png');
write('scripts/bigger-fair/communities-proof.json',{scale:.8,source:'production SVGs and manifests',overview:'fair-built.png',comparison:'fair-vs-communities.png',communityCrops:['bobbinbell','cloudpop','waddleshow','sugarspoon'],pathCrops:['road-junction','community-lane'],note:'Headless SVG assembly. Runtime players, moving water, procedural harbour overlay and animation excluded.'});
console.log('Production overview, four community crops, two path/reference comparisons and open common at 0.8 px/unit complete.');
