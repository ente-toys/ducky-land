// Production-art previews. Never load a complete island to make a globe picture.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WORLD_ISLANDS} from '../../src/pixi/world-map.js';
import {snapshot} from './snapshot.mjs';
const out='public/pixi-art/globe';mkdirSync(out,{recursive:true});
const manifest={};
for(const island of WORLD_ISLANDS){
 const id=island.theme??'home',png=await snapshot(island);
 writeFileSync(`${out}/${id}-ground.png`,await snapshot(island,{groundOnly:true}));
 writeFileSync(`${out}/${id}.png`,png);
 manifest[id]={src:`/pixi-art/globe/${id}.png`,sha256:createHash('sha256').update(png).digest('hex')};
 console.log(`${id}: ${png.length} bytes`);
}
writeFileSync(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
