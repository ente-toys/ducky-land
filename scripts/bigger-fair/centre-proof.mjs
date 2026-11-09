import fs from 'node:fs';
import {render} from './render-core.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-check/inner/';
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/fair/art.json'));
await fs.promises.writeFile(out+'centre.png',await render(art,{x:0,y:0,k:.25,width:1875,height:1250}));
await fs.promises.writeFile(out+'lagoon.png',await render(art,{x:2300,y:500,k:.65,width:1700,height:1350}));
await fs.promises.writeFile(out+'west.png',await render(art,{x:500,y:1400,k:.55,width:1700,height:1500}));
