import fs from 'node:fs';
import sharp from 'sharp';
import {render} from './render-core.mjs';
const out='/Users/pragadees.xd/Downloads/Ducky Land/concepts/themes/work/fair-review/fix/bridges';
fs.mkdirSync(out,{recursive:true});
const art=JSON.parse(fs.readFileSync('public/pixi-art/themes/fair/art.json')),world=JSON.parse(fs.readFileSync('rive/web/themes/fair/world.json'));
const parts=[];
for(const [i,b] of world.walkways.entries()){
 const x=(b.a[0]+b.b[0])/2,y=(b.a[1]+b.b[1])/2;
 const png=await render(art,{k:.6,x:x-500,y:y-480,width:600,height:540,sleepers:false});
 fs.writeFileSync(out+'/'+b.id+'.png',png);parts.push({input:png,left:(i%4)*600,top:Math.floor(i/4)*540});
}
await sharp({create:{width:2400,height:1620,channels:4,background:'#6EC9DE'}}).composite(parts).png().toFile(out+'/all-crossings.png');
fs.writeFileSync(out+'/castle-channel.png',await render(art,{k:.5,x:2400,y:200,width:1400,height:900,sleepers:false}));
console.log(out);
