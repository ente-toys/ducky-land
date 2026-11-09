import fs from 'node:fs';
import {render} from './render.mjs';
import {VILLAGES} from './villages-data.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),art=read('public/pixi-art/themes/cathedral/art.json'),world=read('rive/web/themes/cathedral/world.json'),walk=read('rive/web/themes/cathedral/walk-world.json'),harbor=read('rive/web/themes/cathedral/harbor.json');
const out='../concepts/themes/work/bellovo-check/villages/place/';
fs.writeFileSync(out+'overview.png',await render(art,{x:-2200,y:-2400,k:.12,width:1536,height:1248,world,walk,harbor}));
for(const v of VILLAGES)fs.writeFileSync(out+v.id+'.png',await render(art,{x:v.square[0]-1750,y:v.square[1]-1350,k:.5,width:1750,height:1350,world,walk,harbor}));
