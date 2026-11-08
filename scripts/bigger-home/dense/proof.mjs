import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const O='../concepts/themes/world-map/bigger',script='scripts/bigger-home/dense/render.mjs';
const metrics=JSON.parse(readFileSync(O+'/home-dense-work/metrics.json'));
const crops=[['butterbill',[215,220]],['lanternleaf',[795,177]],['clovercrust',[1375,230]],['petalpatch',[175,875]],['reedwhistle',[1295,1045]]];
for(const[id,[x,y]]of crops)execFileSync(process.execPath,[script],{env:{...process.env,HOME_CROP:[(x-278)/.18,(y-204)/.18,.6].join(','),HOME_CROP_NAME:id},stdio:'inherit'});
writeFileSync(O+'/home-dense-work/crops.json',JSON.stringify(crops.map(([id,p])=>({id,centerDrawing:p,centerWorld:[(p[0]-278)/.18,(p[1]-204)/.18],pixelsPerWorldUnit:.6,width:1800,height:1500})),null,2));
const label=(w,text)=>Buffer.from(`<svg width="${w}" height="50"><rect width="100%" height="100%" fill="#fff0c7"/><text x="24" y="33" font-family="Arial" font-size="23" fill="#39472d">${text}</text></svg>`);
await sharp({create:{width:3200,height:1250,channels:4,background:'#6ec9de'}}).composite([
 {input:label(1600,`BEFORE / ${metrics.stages.before.percent.toFixed(2)}% roads and banks in new dry land`),left:0,top:0},{input:O+'/home-dense-before.png',left:0,top:50},
 {input:label(1600,`AFTER / ${metrics.stages.after.percent.toFixed(2)}% roads and banks, tighter household courts`),left:1600,top:0},{input:O+'/home-dense.png',left:1600,top:50}
]).png().toFile(O+'/home-dense-before-after.png');
console.log('Home dense proof: whole island, five community crops, before and after.');
