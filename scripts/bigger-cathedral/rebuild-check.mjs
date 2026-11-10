import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/bellovo-review/fix/final/';
function snapshot(){
 const A='public/pixi-art/themes/cathedral/',art=JSON.parse(fs.readFileSync(A+'art.json'));
 const files=new Set([A+'art.json','rive/web/themes/cathedral/world.json','rive/web/themes/cathedral/walk-world.json','rive/web/themes/index.js','src/pixi/art-source-sizes.json','src/pixi/large-art-tiles.json','src/pixi/theme-raster-bounds.json','public/pixi-art/globe/manifest.json','public/pixi-art/globe/cathedral.svg','public/pixi-art/globe/cathedral-ground.svg']);
 for(const p of [...art.ground.tiles,...art.decks,...art.flats,...art.props,...(art.floating??[])])files.add(p.src.startsWith('/')?'public'+p.src:A+p.src);
 for(const set of Object.values(JSON.parse(fs.readFileSync('src/pixi/large-art-tiles.json')).cathedral))for(const p of set)files.add('public'+p.src);
 return Object.fromEntries([...files].sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}
const before=snapshot();
execFileSync(process.execPath,['scripts/bigger-cathedral/integrate.mjs'],{stdio:'inherit'});
const after=snapshot(),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]);
fs.writeFileSync(out+'regeneration.json',JSON.stringify({byteStable:changed.length===0,files:Object.keys(after).length,changed,sha256:after},null,2)+'\n');
if(changed.length)throw Error('Rebuild changed generated files: '+changed.join(', '));
console.log(`Full seven-generator rebuild + caches: ${Object.keys(after).length} files byte-identical.`);
