// Compare independently assembled production layers, never paste old pixels over the result.
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
import {render} from './render.mjs';
import {original,out} from './design.mjs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const art=JSON.parse(readFileSync('public/pixi-art/themes/bog/art.json')),k=.25,opts={x:0,y:0,w:8000,h:6000,k};
const a=await render(original.art,out+'/bog-original-interior.png',opts),b=await render(art,out+'/bog-built-interior.png',opts);
const aa=await sharp(a).ensureAlpha().raw().toBuffer(),bb=await sharp(b).ensureAlpha().raw().toBuffer();let checked=0,changed=0,maxDelta=0,examples=[];
// Original dry interior, excluding the antialiased coast itself. All old land is opaque.
for(let y=0;y<1500;y++)for(let x=0;x<2000;x++){
 const wx=(x+.5)/k,wy=(y+.5)/k;if(!inPoly(wx,wy,original.world.coast)||![[wx-12,wy],[wx+12,wy],[wx,wy-12],[wx,wy+12]].every(p=>inPoly(...p,original.world.coast)))continue;
 checked++;const i=(y*2000+x)*4,delta=Math.max(...[0,1,2,3].map(j=>Math.abs(aa[i+j]-bb[i+j])));if(delta){changed++;maxDelta=Math.max(maxDelta,delta);if(examples.length<12)examples.push({wx,wy,delta});}
}
const result={scale:k,checkedInteriorPixels:checked,changedInteriorPixels:changed,maxChannelDifference:maxDelta,examples,method:'Independent before and after production-art assembly; no pixel replacement or restoration.'};
writeFileSync('scripts/bigger-bog/pixel-preservation.json',JSON.stringify(result,null,2));console.log(result);
