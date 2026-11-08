import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render-core.mjs';
import {read,write} from './design.mjs';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger/',C=O+'fair-fixed-crops/';
fs.mkdirSync(C,{recursive:true});const a=read('public/pixi-art/themes/fair/art.json');
fs.writeFileSync(O+'fair-fixed.png',await render(a,{k:.13,x:-2500,y:-1800,width:1560,height:1066}));
const crops=[['bridge-river',2454,4050],['road-junction',-750,2570],['community-bobbinbell',-750,1250],['community-cloudpop',3000,-300],['community-waddleshow',8000,3200],['community-sugarspoon',2600,5100],['community-lane',2750,-200],['orchard-pond',1000,-100],['ribbon-run',-1050,3500]];
for(const [name,x,y]of crops){fs.writeFileSync(C+name+'.png',await render(a,{k:.8,x:x-1000,y:y-750,width:1600,height:1200}));console.log('Rendered',name);}
const ref=await sharp(O+'../cursor-camp-paths-ref.jpg').resize(1600,1200,{fit:'contain',background:'#FFF0AE'}).png().toBuffer();
for(const name of ['road-junction','community-lane'])await sharp({create:{width:3200,height:1200,channels:4,background:'#FFF0AE'}}).composite([{input:ref,left:0,top:0},{input:C+name+'.png',left:1600,top:0}]).png().toFile(C+name+'-vs-reference.png');
write('scripts/bigger-fair/fix-proof.json',{overview:O+'fair-fixed.png',crops:crops.map(([name])=>C+name+'.png'),scale:.8,note:'Headless assembly of production SVGs and manifests. Static boats and sleepers included; live players, animation and procedural runtime overlays excluded.'});
