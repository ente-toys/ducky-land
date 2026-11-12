import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/round3/bellovo/';
function snapshot(){
 const roots=['public/pixi-art/themes/cathedral','assets/world/themes/cathedral'];
 const files=roots.flatMap(root=>fs.readdirSync(root,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.parentPath+'/'+e.name));
 files.push(...['buildings-doors','centre-art-metrics','life-metrics','round2-grass'].map(name=>`scripts/bigger-cathedral/${name}.json`));
 return Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}
const before=snapshot();
execFileSync(process.execPath,['scripts/bigger-cathedral/round2.mjs'],{stdio:'inherit'});
const after=snapshot(),changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(file=>before[file]!==after[file]);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'regeneration.json',JSON.stringify({byteStable:changed.length===0,files:Object.keys(after).length,changed,sha256:after},null,2)+'\n');
if(changed.length)throw Error('Bellovo regeneration changed: '+changed.join(', '));
console.log(`Bellovo round 2: ${Object.keys(after).length} files byte-identical.`);
