// The globe shader's islet atlas (boss 8 Nov): the 11 vector islets rasterised from their SVGs into a 4x3 grid of 512px
// cells, each drawn 2px inside its cell (world-view.js samples (2 + uv*508)/512). Run after scripts/islets/vectorize.py.
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readFileSync,writeFileSync} from 'node:fs';
import {ISLET_ART} from '../../src/pixi/islets.js';
const CELL=512,out=createCanvas(4*CELL,3*CELL),g=out.getContext('2d');
for(const [k,art]of ISLET_ART.entries()){
 const svg=await loadImage(readFileSync(`public/pixi-art/islets/${art}.svg`));
 g.drawImage(svg,k%4*CELL+2,Math.floor(k/4)*CELL+2,CELL-4,CELL-4);
}
writeFileSync('public/pixi-art/islets/atlas.webp',await out.encode('webp',92));
console.log('wrote public/pixi-art/islets/atlas.webp');
