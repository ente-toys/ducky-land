import sharp from 'sharp';
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const out='../concepts/themes/world-map/bigger',A='public/pixi-art/themes/pink/';
const W=1980,H=1470,parts=[];
for(const [i,name]of ['pink-bigger.png','pink-built.png'].entries()){
 parts.push({input:out+'/'+name,left:i*W,top:48});
 parts.push({input:Buffer.from(`<svg width="${W}" height="48"><rect width="${W}" height="48" fill="#fff0c7"/><text x="24" y="32" font-size="23" font-family="Arial" fill="#39472d">${i?'BUILT PINK / actual production art and placements':'PINK / nine-place authored drawing'}</text></svg>`),left:i*W,top:0});
}
await sharp({create:{width:W*2,height:H+48,channels:4,background:'#6ec9de'}}).composite(parts).png().toFile(out+'/pink-vs-drawing.png');
// Read the same two ground sources tiled into production. Composite the original
// in its own layer exactly as Pixi does, without replacing pixels after rendering.
const k=.25,w=2000,h=1450,oldWorld=JSON.parse(readFileSync('scripts/bigger-pink/original-world.json')),coast=oldWorld.coast;
const original=await sharp(A+'ground.svg').resize(w,h).ensureAlpha().raw().toBuffer();
const outer=await sharp(A+'expansion/outer-ground.svg').resize(3300,2450).extract({left:650,top:475,width:w,height:h}).png().toBuffer();
const inner=await sharp(A+'expansion/original-ground.svg').resize(w,h).png().toBuffer();
const built=await sharp(outer).composite([{input:inner}]).ensureAlpha().raw().toBuffer();
let protectedPixels=0,changed=0;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=(y*w+x)*4;
 const protectedLand=inPoly(x/k,y/k,coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((x/k-cx)/rx)**2+((y/k-cy)/ry)**2<1);
 if(original[i+3]!==255||!protectedLand)continue;
 protectedPixels++;if(!original.subarray(i,i+4).equals(built.subarray(i,i+4)))changed++;
}
const validation={scale:k,protectedPixels,changed,originalProps:393,originalFlats:1166,originalSleepers:40,note:'Original opaque ground inside its dry coast. Original SVG stays untouched; only former offshore ripple/wet-coast decoration is omitted from derivative source. Prop/decal/centre/sleeper records are independently checked by qa/bigger-pink.test.mjs. Static proof excludes live shadows and animated water.'};
writeFileSync('scripts/bigger-pink/pixel-validation.json',JSON.stringify(validation,null,2)+'\n');
copyFileSync('scripts/bigger-pink/pixel-validation.json',out+'/pink-pixel-validation.json');
assert.equal(changed,0,'original ground stays pixel-identical');
console.log(validation);
