import fs from 'node:fs';
import sharp from 'sharp';
import {render,read,OUT} from './render.mjs';
const art=read('public/pixi-art/themes/canal/art.json'),old=read('scripts/bigger-canal/original-art.json');
const frame={cx:4000,cy:3000,k:.105,W:1500,H:1200};
await render(art,OUT+'/canal-built.png',frame);await render(old,OUT+'/canal-original-proof.png',frame);
await sharp(OUT+'/canal-communities.svg').resize(1500,1200,{fit:'fill'}).png().toFile(OUT+'/canal-communities.png');
await sharp({create:{width:3000,height:1200,channels:3,background:art.sea}}).composite([{input:OUT+'/canal-communities.png',left:0,top:0},{input:OUT+'/canal-built.png',left:1500,top:0}]).png().toFile(OUT+'/canal-vs-drawing.png');
for(const [name,cx,cy]of [['bobbinboat',-650,1650],['petalpost',4000,-650],['pearlbutton',8850,2200],['reedwhistle',1900,6300],['road-junction',9200,2820],['lane',3350,-500],['meadow',1500,-200],['coast-walk',-1350,4100]])await render(art,OUT+'/canal-'+name+'.png',{cx,cy,k:.8,W:1500,H:1100});
const ref=OUT+'/../cursor-camp-paths-ref.jpg';const refBuffer=await sharp(ref).resize(1500,1100,{fit:'contain',background:art.sea}).png().toBuffer();
await sharp({create:{width:3000,height:2200,channels:3,background:art.sea}}).composite([{input:refBuffer,left:0,top:0},{input:OUT+'/canal-road-junction.png',left:1500,top:0},{input:refBuffer,left:0,top:1100},{input:OUT+'/canal-lane.png',left:1500,top:1100}]).png().toFile(OUT+'/canal-paths-vs-reference.png');
const before=await sharp(OUT+'/canal-original-proof.png').ensureAlpha().raw().toBuffer(),after=await sharp(OUT+'/canal-built.png').ensureAlpha().raw().toBuffer();
const mask=await sharp(OUT+'/canal-preservation-mask.svg').resize(1500,1200).ensureAlpha().raw().toBuffer();let compared=0,changed=0,maxDelta=0;
for(let i=0;i<before.length;i+=4)if(mask[i+3]===255&&mask[i]>250){compared++;let d=Math.max(...[0,1,2,3].map(c=>Math.abs(before[i+c]-after[i+c])));if(d){changed++;maxDelta=Math.max(maxDelta,d);}}
const result={renderer:'Static production SVG assembly, top-down at runtime coordinates; no players or dynamic GPU effects',overview:frame,groundCrops:{pixelsPerUnit:.8,width:1500,height:1100},preservation:{mask:'Original dry interior eroded 12 units, excluding shore antialiasing',comparedPixels:compared,changedPixels:changed,maxChannelDelta:maxDelta}};
fs.writeFileSync('scripts/bigger-canal/pixel-validation.json',JSON.stringify(result,null,2)+'\n');console.log(result);if(changed)process.exitCode=1;
