import fs from 'node:fs';
import {render} from './render-core.mjs';
import {read,write} from './design.mjs';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger/',C=O+'fair-dense-crops/';
fs.mkdirSync(C,{recursive:true});const art=read('public/pixi-art/themes/fair/art.json');
fs.writeFileSync(O+'fair-dense.png',await render(art,{k:.16,x:-2500,y:-1800,width:1920,height:1312}));
const crops=[['bobbinbell',-850,1700,1800,1500],['cloudpop',4030,-350,2400,1400],['waddleshow',8030,3180,1800,1700],['sugarspoon',2450,5220,2300,1450]];
for(const [id,x,y,width,height]of crops){const k=.7;fs.writeFileSync(C+id+'.png',await render(art,{k,x:x-width/k/2,y:y-height/k/2,width,height}));console.log('Rendered',id);}
write('scripts/bigger-fair/dense-proof.json',{overview:O+'fair-dense.png',crops:crops.map(([id])=>C+id+'.png'),cropPixelsPerWorldUnit:.7,note:'Headless assembly of production SVGs, current manifests, static sleepers and boats. Live players, animation and procedural runtime overlays excluded.'});
