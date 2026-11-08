import fs from 'node:fs';
import sharp from 'sharp';
import {render,OUT} from './render.mjs';
import {inPoly} from '../../rive/web/island-geometry.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),S='scripts/bigger-community/';
const a=read('public/pixi-art/themes/community/art.json'),h=read('rive/web/themes/community/harbor.json');
if(!process.argv.includes('--crops-only'))await render(a,h,OUT+'/community-dense.png');
for(const [id,x,y]of [['storynest',550,580],['patchwing',8040,1400],['sproutshare',980,5510],['lanternloaf',7550,5510]]){
 await render(a,h,OUT+'/community-crops/dense-'+id+'.png',{crop:[x,y,.48]});console.log('Rendered',id);
}
if(process.argv.includes('--crops-only'))process.exit(0);
const framing={crop:[4000,2900,.2]},before=OUT+'/community-crops/dense-preservation-before.png',after=OUT+'/community-crops/dense-preservation-after.png';
const f=await render(read(S+'baseline/art.json'),{...h,boats:[]},before,framing);
await render(a,{...h,boats:[]},after,framing);
const b=await sharp(before).ensureAlpha().raw().toBuffer(),c=await sharp(after).ensureAlpha().raw().toBuffer(),coast=read(S+'baseline/world.json').coast;
let protectedPixels=0,changed=0,maxDelta=0;
for(let y=0;y<f.H;y++)for(let x=0;x<f.W;x++){
 const wx=(x-f.ox)/f.k,wy=(y-f.oy)/f.k;
 if(![[0,0],[-20,0],[20,0],[0,-20],[0,20]].every(([dx,dy])=>inPoly(wx+dx,wy+dy,coast)))continue;
 protectedPixels++;const i=(y*f.W+x)*4;let d=0;for(let j=0;j<4;j++)d=Math.max(d,Math.abs(b[i+j]-c[i+j]));
 if(d){changed++;maxDelta=Math.max(maxDelta,d);}
}
fs.writeFileSync(S+'dense-pixel-validation.json',JSON.stringify({protectedPixels,changed,maxDelta,description:'Production art including sleepers, original coast inset 20, 0.2 px/unit; boats excluded, no restored proof pixels.'},null,2)+'\n');
console.log({protectedPixels,changed,maxDelta});
