import fs from 'node:fs';
import sharp from 'sharp';
import {A,OUT,plan,svg,el,path} from './design.mjs';
import {render} from './render.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),B='scripts/bigger-cathedral/baseline/',D='rive/web/themes/cathedral/';
const art=read(A+'art.json'),world=read(D+'world.json'),walk=read(D+'walk-world.json'),harbor=read(D+'harbor.json');
const before=read(B+'art.json'),old=read(B+'world.json'),oldWalk=read(B+'walk-world.json'),oldHarbor=read(B+'harbor.json');
fs.mkdirSync(OUT+'/cathedral-crops',{recursive:true});
// Production layers at their actual map coordinates and scale. No pixels are restored after rendering.
if(!process.env.PRESERVE_ONLY){
await sharp(await render(art,{x:-2200,y:-2400,k:.12,width:1536,height:1248,world,walk,harbor})).toFile(OUT+'/cathedral-built.png');
for(const [name,x,y]of plan.crops){const size=plan.communities.some(c=>c.id===name)?2000:1400,h=size===2000?2000:1000;await sharp(await render(art,{x:x-size/1.6,y:y-h/1.6,k:.8,width:size,height:h,world,walk,harbor})).toFile(OUT+'/cathedral-crops/'+name+'.png');}
}
const oldImg=await render(before,{x:0,y:0,k:.2,width:1600,height:1200,original:true,world:old,walk:oldWalk,harbor:oldHarbor,nativeGround:true});
const newImg=await render(art,{x:0,y:0,k:.2,width:1600,height:1200,world,walk,harbor});
const inner=old.coast.map(([x,y])=>[4100+(x-4100)*.994,2800+(y-2800)*.994]);
const mask=await sharp(Buffer.from(svg(1600,1200,path(inner,'white')+old.islets.map(([x,y,rx,ry])=>el(x,y,rx-15,ry-15,'white')).join(''),'0 0 8000 6000'))).ensureAlpha().raw().toBuffer();
const a=await sharp(oldImg).ensureAlpha().raw().toBuffer(),b=await sharp(newImg).ensureAlpha().raw().toBuffer();
let compared=0,changed=0,maxDelta=0,bounds=[1600,1200,0,0];
for(let i=0;i<a.length;i+=4)if(mask[i+3]===255){compared++;let delta=Math.max(...[0,1,2,3].map(k=>Math.abs(a[i+k]-b[i+k])));maxDelta=Math.max(delta,maxDelta);if(delta){changed++;let x=i/4%1600,y=Math.floor(i/4/1600);bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x),Math.max(bounds[3],y)];}}
fs.writeFileSync('scripts/bigger-cathedral/preservation.json',JSON.stringify({compared,changed,maxChannelDelta:maxDelta,changedBounds:changed?bounds:null,scale:.2,mask:'Original dry coast inset 0.6 percent; original garden islets inset 15 units. Artwork is rendered independently, never pasted back after comparison.'},null,2)+'\n');
await sharp(oldImg).toFile(OUT+'/cathedral-original-preservation-before.png');await sharp(newImg).toFile(OUT+'/cathedral-original-preservation-after.png');
const drawing=await sharp(OUT+'/cathedral-communities.png').png().toBuffer(),built=await sharp(OUT+'/cathedral-built.png').png().toBuffer();
await sharp({create:{width:3072,height:1298,channels:4,background:'#F7EAC2'}}).composite([{input:drawing,left:0,top:50},{input:built,left:1536,top:50},{input:Buffer.from(svg(3072,50,'<text x="768" y="34" text-anchor="middle" font-family="Georgia" font-size="25" fill="#515332">DRAWING</text><text x="2304" y="34" text-anchor="middle" font-family="Georgia" font-size="25" fill="#515332">BUILT FROM PRODUCTION ART</text>')),left:0,top:0}]).png().toFile(OUT+'/cathedral-vs-communities.png');
// Two requested path details are shown beside the studied reference, never used as game artwork.
const ref=await sharp(OUT+'/../cursor-camp-paths-ref.jpg').resize(700,500,{fit:'contain',background:'#F7EAC2'}).png().toBuffer();
const junction=await sharp(OUT+'/cathedral-crops/road-junction.png').resize(700,500).png().toBuffer(),lane=await sharp(OUT+'/cathedral-crops/lane.png').resize(700,500).png().toBuffer();
await sharp({create:{width:2100,height:550,channels:4,background:'#F7EAC2'}}).composite([{input:ref,left:0,top:50},{input:junction,left:700,top:50},{input:lane,left:1400,top:50},{input:Buffer.from(svg(2100,50,'<g font-family="Georgia" font-size="22" fill="#515332" text-anchor="middle"><text x="350" y="32">CURSOR CAMP, LOOK ONLY</text><text x="1050" y="32">BELLOVO ROAD JUNCTION</text><text x="1750" y="32">TESSERA LANE</text></g>')),left:0,top:0}]).png().toFile(OUT+'/cathedral-paths-vs-reference.png');
console.log(JSON.stringify({compared,changed,maxDelta}));
