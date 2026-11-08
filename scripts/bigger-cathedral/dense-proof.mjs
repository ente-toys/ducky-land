import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
import {OUT,A} from './design.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),D='rive/web/themes/cathedral/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
fs.mkdirSync(OUT+'/cathedral-dense-crops',{recursive:true});
await sharp(await render(art,{x:-2200,y:-2400,k:.12,width:1536,height:1248,world,walk,harbor})).toFile(OUT+'/cathedral-dense.png');
for(const c of read('scripts/bigger-cathedral/plan.json').communities){const width=1920,height=1920;await sharp(await render(art,{x:c.x-1200,y:c.y-1100,k:.8,width,height,world,walk,harbor})).toFile(OUT+'/cathedral-dense-crops/'+c.id+'.png');}
console.log('Saved cathedral-dense.png and four community crops.');
