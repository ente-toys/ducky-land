import sharp from 'sharp';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const O='../concepts/themes/world-map/bigger/',A='public/pixi-art/themes/goldmine/';
const old=JSON.parse(readFileSync('scripts/bigger-goldmine/original/art.json')),K=.2,layers=[];
async function add(p,kind){const s=kind==='prop'?p.scale??1:1,an=kind==='prop'?p.anchor??{x:.5,y:1}:kind==='flat'&&!p.topLeft?{x:.5,y:1}:{x:0,y:0};const w=Math.round(p.width*s*K),h=Math.round(p.height*s*K),x=Math.round(p.x*K-an.x*w),y=Math.round(p.y*K-an.y*h);let im=sharp(A+p.src).resize(w,h,{fit:'fill'});if(p.flip)im=im.flop();layers.push({input:await im.png().toBuffer(),left:x,top:y});}
await add({src:'ground.svg',x:0,y:0,width:8000,height:6000},'ground');for(const p of old.flats)await add(p,'flat');await add(old.previewHarbor,'deck');for(const p of old.decks)await add(p,'deck');for(const p of [...old.props].sort((a,b)=>a.y-b.y))await add(p,'prop');
await sharp({create:{width:1600,height:1200,channels:4,background:old.sea}}).composite(layers).png().toFile(O+'goldmine-now.png');
const ref=await sharp('../concepts/themes/world-map/cursor-camp-paths-ref.jpg').resize(800,600).toBuffer();const junction=await sharp(O+'goldmine-ground/road-junction.png').resize(840,600).toBuffer(),lane=await sharp(O+'goldmine-ground/lane.png').resize(840,600).toBuffer();
await sharp({create:{width:2480,height:600,channels:4,background:'#F1D391'}}).composite([{input:ref,left:0,top:0},{input:junction,left:800,top:0},{input:lane,left:1640,top:0}]).png().toFile(O+'goldmine-paths-vs-reference.png');
console.log('Original island and road comparison saved.');
