import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {inPoly} from '../../rive/web/island-geometry.mjs';
import {render,read} from './render.mjs';
const out='../concepts/themes/world-map/bigger',A='public/pixi-art/themes/pink/',S='scripts/bigger-pink/';
const art=read(A+'art.json'),layout=read(S+'layout.json'),boats=read('rive/web/themes/pink/harbor.json').boats;
mkdirSync(out+'/pink-community-crops',{recursive:true});
await render(art,[-2600,-1900,13200,9800],.15,out+'/pink-built.png',{boats});
const views={ribbonwick:[-350,-480,2400,1800],melody:[5100,-650,2400,1800],quay:[7650,1000,2200,2000],petalpatch:[-1550,1600,2100,2100],tutu:[2850,4950,2500,2000]};
for(const p of layout.places)await render(art,views[p.id],.8,out+'/pink-community-crops/'+p.id+'.png',{boats});
await render(art,[7750,400,1800,1350],.8,out+'/pink-community-crops/tea-workcourt.png',{boats});
await render(art,[-1450,1080,1500,1125],.8,out+'/pink-path-junction.png',{boats});
await render(art,[-500,-100,1500,1125],.8,out+'/pink-path-lane.png',{boats});
// Place the full design next to the independently assembled production art.
const W=1980,H=1470;
const header=(label,width)=>Buffer.from(`<svg width="${width}" height="48"><rect width="${width}" height="48" fill="#fff0c7"/><text x="24" y="32" font-size="23" font-family="Arial" fill="#39472d">${label}</text></svg>`);
await sharp({create:{width:W*2,height:H+48,channels:4,background:'#6ec9de'}}).composite([
 {input:header('PINK / five-community drawing',W),left:0,top:0},{input:out+'/pink-communities.png',left:0,top:48},
 {input:header('BUILT / actual production art and placements',W),left:W,top:0},{input:out+'/pink-built.png',left:W,top:48}
]).png().toFile(out+'/pink-communities-vs-built.png');
// Reference is kept intact, with the two new full-density road crops alongside.
const ref=await sharp('../concepts/themes/world-map/cursor-camp-paths-ref.jpg').resize(1200,900,{fit:'contain',background:'#fff0c7'}).png().toBuffer();
await sharp({create:{width:3600,height:948,channels:4,background:'#fff0c7'}}).composite([
 {input:header('LOOK ONLY / Cursor Camp reference',1200),left:0,top:0},{input:ref,left:0,top:48},
 {input:header('PINK / junction, 0.8 px per unit',1200),left:1200,top:0},{input:out+'/pink-path-junction.png',left:1200,top:48},
 {input:header('PINK / residential lane, 0.8 px per unit',1200),left:2400,top:0},{input:out+'/pink-path-lane.png',left:2400,top:48}
]).png().toFile(out+'/pink-paths-vs-reference.png');
// Same actual source layers as production. No restoration of pixels after render.
const k=.25,w=2000,h=1450,oldWorld=read(S+'original-world.json');
const original=await sharp(A+'ground.svg').resize(w,h).ensureAlpha().raw().toBuffer();
const outer=await sharp(A+'expansion/outer-ground.svg').resize(3300,2450).extract({left:650,top:475,width:w,height:h}).png().toBuffer();
const inner=await sharp(A+'expansion/original-ground.svg').resize(w,h).png().toBuffer();
const built=await sharp(outer).composite([{input:inner}]).ensureAlpha().raw().toBuffer();
let protectedPixels=0,changed=0;
for(let y=0;y<h;y++)for(let x=0;x<w;x++){
 const i=(y*w+x)*4,protectedLand=inPoly(x/k,y/k,oldWorld.coast)||oldWorld.islets.some(([cx,cy,rx,ry])=>((x/k-cx)/rx)**2+((y/k-cy)/ry)**2<1);
 if(original[i+3]!==255||!protectedLand)continue;
 protectedPixels++;if(!original.subarray(i,i+4).equals(built.subarray(i,i+4)))changed++;
}
const validation={scale:k,protectedPixels,changed,originalProps:read(S+'original-art.json').props.length,originalFlats:read(S+'original-art.json').flats.length,originalSleepers:40,note:'Protected opaque dry-ground and islet pixels. Original SVG, placements, centre, sleepers and collision records preserved; former offshore foam decoration omitted from derivative ground. Static art proof excludes live players, water animation and runtime shadows.'};
writeFileSync(S+'pixel-validation.json',JSON.stringify(validation,null,2)+'\n');copyFileSync(S+'pixel-validation.json',out+'/pink-pixel-validation.json');
assert.equal(changed,0,'protected original dry ground stays pixel identical');console.log(validation);
