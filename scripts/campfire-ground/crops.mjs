// Ground-package evidence only. PNGs never enter the repository.
import fs from 'node:fs';
import sharp from 'sharp';
import {render} from '../pagepond/render.mjs';
const A='public/pixi-art/themes/community/';
export const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/campfire-review/fix';
export const VIEWS=[['lanes',[2550,1950,2400,1600]],['river',[-1550,2600,2400,1600]],['lawn',[2300,-780,2400,1600]],['hamlet',[-700,-250,2400,1600]]];
export async function crops(version){
 if(!['before','after'].includes(version))throw Error('Expected before or after');
 const art=JSON.parse(fs.readFileSync(A+'art.json'));
 fs.mkdirSync(OUT,{recursive:true});
 const layers=[];
 for(const [i,[name,view]]of VIEWS.entries()){
  const file=`${OUT}/ground-${name}-${version}.png`;
  await render(art,view,.5,file,{sleepers:false,resolveSource:s=>s.startsWith('/')?'public'+s:A+s});
  layers.push({input:file,left:i%2*1200,top:Math.floor(i/2)*800});
 }
 await sharp({create:{width:2400,height:1600,channels:4,background:art.sea}}).composite(layers).png().toFile(`${OUT}/ground-${version}.png`);
}
if(process.argv[1]?.endsWith('/crops.mjs'))await crops(process.argv[2]);
