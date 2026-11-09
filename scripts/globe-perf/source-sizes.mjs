import sharp from 'sharp';
import {readFileSync,writeFileSync} from 'node:fs';
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
import {homeArtwork} from './snapshot.mjs';
const selected=process.argv[2];
if(selected&&!WORLD_ISLANDS.some(i=>i.theme===selected))throw Error('Unknown theme '+selected);
const sources=new Set(selected?[]:homeArtwork().map(p=>p.src));
for(const island of WORLD_ISLANDS.filter(i=>i.theme&&(!selected||i.theme===selected))){
 const base=`/pixi-art/themes/${island.theme}/`,a=JSON.parse(readFileSync(`public${base}art.json`));
 for(const p of [...a.ground.tiles,...a.decks,...a.flats,...a.props,...(a.floating??[])])sources.add(p.src.startsWith('/')?p.src:base+p.src);
}
const sizes=selected?JSON.parse(readFileSync('src/pixi/art-source-sizes.json')):{};
for(const src of [...sources].sort()){
 const m=await sharp(src.startsWith('/assets/')?'.'+src:'public'+src).metadata();sizes[src]=[m.width,m.height];
}
writeFileSync('src/pixi/art-source-sizes.json',JSON.stringify(sizes)+'\n');console.log(`${sources.size} SVG source dimensions indexed`);
