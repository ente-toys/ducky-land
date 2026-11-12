import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render-core.mjs';
import {read,write} from './design.mjs';
import {inPoly} from '../../assets/world/island-geometry.mjs';
const O='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/world-map/bigger/',A='public/pixi-art/themes/fair/';fs.mkdirSync(O+'fair-ground-crops',{recursive:true});
const art=read(A+'art.json'),e=read('scripts/bigger-fair/expansion.json');
const built=await render(art,{k:.13,x:-2500,y:-1800,width:1560,height:1066});fs.writeFileSync(O+'fair-built.png',built);
await sharp({create:{width:3120,height:1066,channels:4,background:'#82CFD1'}}).composite([{input:O+'fair-bigger.png',left:0,top:0},{input:built,left:1560,top:0}]).png().toFile(O+'fair-vs-drawing.png');
for(const p of [...e.places,{id:'north-open-lawn',x:1500,y:-150},{id:'east-promenade',x:8350,y:3400}]){
 const im=await render(art,{k:.8,x:p.x-875,y:p.y-750,width:1400,height:1000});fs.writeFileSync(O+'fair-ground-crops/'+p.id+'.png',im);
}
// Equal pixel coordinates, untouched ground sources, no image restoration or pasted baseline.
const old=read('scripts/bigger-fair/original-art.json'),w=read('scripts/bigger-fair/original-world.json');
const a=await sharp(await render({...old,flats:[],props:[],decks:[]},{k:.2,width:1450,height:970,home:true,sleepers:false})).raw().toBuffer();
const b=await sharp(await render({...art,flats:[],props:[],decks:[]},{k:.2,width:1450,height:970,home:true,sleepers:false})).raw().toBuffer();
let pixels=0,changed=0,maxDelta=0;const deltas=[];
const distance=(x,y)=>Math.min(...w.coast.map((p,i)=>{const q=w.coast[(i+1)%w.coast.length],vx=q[0]-p[0],vy=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*vx+(y-p[1])*vy)/(vx*vx+vy*vy)));return Math.hypot(x-p[0]-t*vx,y-p[1]-t*vy)}));
for(let y=0;y<970;y++)for(let x=0;x<1450;x++){if(!inPoly(x/.2,y/.2,w.coast)||distance(x/.2,y/.2)<20)continue;pixels++;const off=(y*1450+x)*4;let delta=0;for(let c=0;c<4;c++)delta=Math.max(delta,Math.abs(a[off+c]-b[off+c]));if(delta){changed++;maxDelta=Math.max(maxDelta,delta);if(deltas.length<12)deltas.push([x,y,delta]);}}
write('scripts/bigger-fair/pixel-preservation.json',{scale:.2,pixels,changed,maxDelta,examples:deltas,note:'Original coast inset 20 world units. Compares real rebuilt ground with original; no post-render replacement. Source prop/decal/deck preservation checked separately.'});
console.log('proof complete; ground interior:',pixels,'pixels,',changed,'changed');
