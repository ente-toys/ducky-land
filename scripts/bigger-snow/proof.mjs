import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import sharp from 'sharp';
import {communities} from './plan.mjs';
import {j,output,renderArt,base} from './scene.mjs';
mkdirSync(output+'/ground-crops/snow',{recursive:true});const a=j('public/pixi-art/themes/snow/art.json'),h=j('assets/world/themes/snow/harbor.json');
// Faithful static surrogate for the procedural runtime jetty and the three moored boats.
const b=j('scripts/bigger-snow/baseline/art.json');
const preview=structuredClone(a);preview.decks.push({src:'/pixi-art/bridge-jetty-1.svg',x:h.jetty.foot[0]-100,y:h.jetty.foot[1]-30,width:220,height:h.jetty.tip[1]-h.jetty.foot[1]+60});
for(const v of h.boats)preview.props.push({src:'/pixi-art/boat-sail.svg',x:v.x,y:v.y+20,width:188,height:216,anchor:{x:.5,y:.82},scale:1});
writeFileSync(output+'/snow-built.png',await renderArt(preview,{sleepers:true}));
const concept=await sharp(output+'/snow-communities.png').metadata(),built=await sharp(output+'/snow-built.png').metadata();
await sharp({create:{width:concept.width*2,height:concept.height,channels:4,background:'#6EC9DE'}}).composite([{input:await sharp(output+'/snow-communities.png').png().toBuffer(),left:0,top:0},{input:await sharp(output+'/snow-built.png').png().toBuffer(),left:concept.width,top:0}]).png().toFile(output+'/snow-vs-drawing.png');
for(const c of communities){const [cx,cy]=c.crop;writeFileSync(output+'/ground-crops/snow/'+c.id+'.png',await renderArt(preview,{k:.8,x:cx-1000,y:cy-800,width:1600,height:1280,sleepers:true}));}
for(const [name,cx,cy]of [['junction',8400,2860],['lane',-600,2900],['aurora-bridge',3000,300],['quay',4200,7200]])writeFileSync(output+'/ground-crops/snow/'+name+'.png',await renderArt(preview,{k:.8,x:cx-700,y:cy-500,width:1120,height:800,sleepers:true}));
const ref=await sharp('../concepts/themes/world-map/cursor-camp-paths-ref.jpg').resize(800,600).png().toBuffer();const crop=await sharp(output+'/ground-crops/snow/junction.png').resize(840,600).png().toBuffer();const lane=await sharp(output+'/ground-crops/snow/lane.png').resize(840,600).png().toBuffer();await sharp({create:{width:2480,height:600,channels:4,background:'#FFFAED'}}).composite([{input:ref,left:0,top:0},{input:crop,left:800,top:0},{input:lane,left:1640,top:0}]).png().toFile(output+'/snow-paths-vs-reference.png');
console.log('Whole island, drawing comparison, four community crops and four walking/detail crops rendered from production SVGs at 0.8 px/unit.');
