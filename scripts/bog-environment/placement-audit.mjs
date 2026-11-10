// Offline placement audit only. Never substitute this for a real runtime capture.
import fs from 'node:fs';
import sharp from 'sharp';
const base='public/pixi-art/themes/bog-arena/',a=JSON.parse(fs.readFileSync(base+'art.json')),z=.16;
const layers=[];
async function put(p,anchor={x:0,y:0}){
 const w=Math.round(p.width*z),h=Math.round(p.height*z);if(!w||!h)return;
 const input=await sharp(base+p.src).resize(w,h).png().toBuffer();
 layers.push({input,left:Math.round(p.x*z-w*anchor.x),top:Math.round(p.y*z-h*anchor.y)});
}
for(const p of a.ground.tiles)await put(p);
for(const p of [...a.flats,...a.floating])await put(p,p.anchor??{x:.5,y:1});
for(const p of a.decks)await put(p);
for(const p of a.props.toSorted((a,b)=>a.y-b.y))await put(p,p.anchor);
await sharp({create:{width:1344,height:1312,channels:4,background:'#6ec9de'}}).composite(layers).png().toFile('scripts/bog-environment/placement-audit.png');
