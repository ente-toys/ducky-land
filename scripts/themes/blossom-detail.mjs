// SVG source renders at game detail scale, saved outside public.
import {readFileSync,mkdirSync} from 'node:fs';
import {render} from './blossom-render.mjs';
const OUT='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/blossom/';mkdirSync(OUT,{recursive:true});
const art=JSON.parse(readFileSync('public/pixi-art/themes/blossom/art.json'));
for(const [id,x,y,width,height,k]of [['landmark',2590,1050,1575,1650,.75],['koi-pond',750,1950,1200,1000,.75],['gate',3100,3200,1000,900,.75]]){
 const b=await render(art,{x,y,width,height,k});await import('node:fs').then(f=>f.writeFileSync(OUT+'blossom-'+id+'-detail.png',b));
}
console.log('Saved landmark, koi pond and gate SVG detail renders');
